'use client';

// Aba "Mapa de mesas" — por EVENTO: escolhe o evento, aplica um layout (via API
// autoritativa) e ALOCA convidados nas mesas (manual ou auto-distribuído pelo nº
// de convidados do evento). Mostra ocupação por mesa, exporta para a recepção e
// PUBLICA a capacidade no Acesso (lotação). Critério de aceite: aloca e exporta;
// capacidade conversa com Acesso. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Layout, type EventoLite, type PropLite, type MapaMesas as Mapa, type Convidado,
  setupLabel, mesasDaPlanta, ocupacaoMesas, distribuirConvidados, convidadosAnonimos,
  eventoLabel, mapEventoLayout, isMissingTable,
  aplicarLayout, publicarCapacidade, buscarEventoLayout, salvarMapa, exportCSV,
} from '../_lib';
import {
  Kpi, Chip, EmptyState, ModalShell, btnPrimary, btnSecondary,
  IcoMap, IcoTable, IcoUsers, IcoSparkle, IcoDownload, IcoShield, IcoCheck, IcoX, IcoPlus,
  IcoCopy, IcoClapper, IcoLink,
} from './ui';
import PlantaCanvas, { type OcupacaoMap } from './PlantaCanvas';

type Props = {
  userId: string;
  eventos: EventoLite[];
  layouts: Layout[];
  propriedades: PropLite[];
  initialEventoId: string | null;
  onSetupMissing: () => void;
};

export default function MapaMesas({ eventos, layouts, initialEventoId, onSetupMissing }: Props) {
  const toast = useToast();
  const [eventoId, setEventoId] = useState<string | null>(initialEventoId || eventos[0]?.id || null);
  const [carregando, setCarregando] = useState(false);
  const [evlId, setEvlId] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [mapa, setMapa] = useState<Mapa>({ mesas: {}, naoAlocados: [] });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [escolher, setEscolher] = useState(false);

  const evento = useMemo(() => eventos.find((e) => e.id === eventoId) || null, [eventos, eventoId]);
  const layout = useMemo(() => layouts.find((l) => l.id === layoutId) || null, [layouts, layoutId]);
  const convidadosEvento = (evento?.qtd_adultos || 0) + (evento?.qtd_criancas || 0);

  // Layouts compatíveis com o evento (mesma propriedade, se houver).
  const layoutsCompat = useMemo(
    () => layouts.filter((l) => evento?.propriedade_id == null || l.propriedade_id == null || l.propriedade_id === evento.propriedade_id),
    [layouts, evento],
  );

  const carregar = useCallback(async (evId: string) => {
    setCarregando(true);
    setEvlId(null); setLayoutId(null); setMapa({ mesas: {}, naoAlocados: [] }); setDirty(false);
    const { data, error } = await buscarEventoLayout(evId);
    setCarregando(false);
    if (error) { if (isMissingTable(error)) onSetupMissing(); return; }
    if (data) {
      const evl = mapEventoLayout(data);
      setEvlId(evl.id); setLayoutId(evl.layout_id); setMapa(evl.mapa);
    }
  }, [onSetupMissing]);

  useEffect(() => { if (eventoId) carregar(eventoId); }, [eventoId, carregar]);

  const ocup = useMemo<OcupacaoMap>(() => {
    if (!layout) return {};
    const r = ocupacaoMesas(layout.planta.itens, mapa);
    return Object.fromEntries(r.mesas.map((m) => [m.id, { ocupados: m.ocupados, lugares: m.lugares, excedido: m.excedido }]));
  }, [layout, mapa]);
  const resumo = useMemo(() => (layout ? ocupacaoMesas(layout.planta.itens, mapa) : null), [layout, mapa]);
  const mesas = layout ? mesasDaPlanta(layout.planta.itens) : [];

  // ── Aplicar um layout ao evento (API autoritativa) ──────────────────────────
  async function aplicar(lid: string, auto: boolean) {
    if (!eventoId) return;
    setBusy(true);
    const r = await aplicarLayout(eventoId, lid, { auto_distribuir: auto });
    setBusy(false);
    setEscolher(false);
    if (!r.ok) {
      if (r.status === 500 && isMissingTable({ message: r.error })) { onSetupMissing(); return; }
      toast.error(r.error || 'Não foi possível aplicar o layout.');
      return;
    }
    const evl = mapEventoLayout(r.data);
    setEvlId(evl.id); setLayoutId(evl.layout_id); setMapa(evl.mapa); setDirty(false);
    toast.success(auto ? 'Layout aplicado e convidados distribuídos.' : 'Layout aplicado ao evento.');
  }

  // ── Edição do mapa (local; salva via RLS) ───────────────────────────────────
  function addConvidado(mesaId: string, nome: string) {
    const nm = nome.trim(); if (!nm) return;
    setMapa((m) => ({ ...m, mesas: { ...m.mesas, [mesaId]: [...(m.mesas[mesaId] || []), { nome: nm }] } }));
    setDirty(true);
  }
  function removeConvidado(mesaId: string, idx: number) {
    setMapa((m) => ({ ...m, mesas: { ...m.mesas, [mesaId]: (m.mesas[mesaId] || []).filter((_, i) => i !== idx) } }));
    setDirty(true);
  }
  function addNaoAlocado(nome: string) {
    const nm = nome.trim(); if (!nm) return;
    setMapa((m) => ({ ...m, naoAlocados: [...m.naoAlocados, { nome: nm }] }));
    setDirty(true);
  }
  function moverParaMesa(idx: number, mesaId: string) {
    setMapa((m) => {
      const c = m.naoAlocados[idx]; if (!c) return m;
      return { ...m, naoAlocados: m.naoAlocados.filter((_, i) => i !== idx), mesas: { ...m.mesas, [mesaId]: [...(m.mesas[mesaId] || []), c] } };
    });
    setDirty(true);
  }
  function todosConvidados(): Convidado[] {
    if (!layout) return [];
    const arr: Convidado[] = [];
    for (const mz of mesasDaPlanta(layout.planta.itens)) arr.push(...(mapa.mesas[mz.id] || []));
    arr.push(...mapa.naoAlocados);
    return arr;
  }
  function autoDistribuir() {
    if (!layout) return;
    let convidados = todosConvidados();
    if (convidados.length === 0) convidados = convidadosAnonimos(convidadosEvento);
    if (convidados.length === 0) { toast.info('Sem convidados para distribuir. Informe o nº de convidados no evento ou adicione nomes.'); return; }
    setMapa(distribuirConvidados(layout.planta.itens, convidados));
    setDirty(true);
    toast.info(`${formatNumber(convidados.length)} convidados distribuídos nas mesas.`);
  }
  function limpar() {
    if (!window.confirm('Limpar toda a alocação de convidados?')) return;
    setMapa({ mesas: {}, naoAlocados: [] }); setDirty(true);
  }

  async function salvar() {
    if (!evlId) return;
    setBusy(true);
    const { error } = await salvarMapa(evlId, mapa);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar o mapa.'); return; }
    setDirty(false);
    toast.success('Mapa de mesas salvo.');
  }

  async function publicar() {
    if (!eventoId || !layout) return;
    setBusy(true);
    const r = await publicarCapacidade(eventoId, layout.id);
    setBusy(false);
    if (!r.ok) { toast.error(r.error || 'Falha ao publicar capacidade.'); return; }
    if (r.publicado) toast.success(`Capacidade (${formatNumber(r.capacidade || 0)}) publicada na lotação do Acesso.`);
    else toast.info('Módulo Acesso ainda não ativado — capacidade não publicada.');
  }

  function exportar() {
    if (!layout || !resumo) return;
    const rows: (string | number)[][] = mesas.map((mz) => {
      const conv = (mapa.mesas[mz.id] || []).map((c) => c.nome).join('; ');
      return [mz.rotulo, mz.lugares, (mapa.mesas[mz.id] || []).length, conv];
    });
    if (mapa.naoAlocados.length) rows.push(['Não alocados', '', mapa.naoAlocados.length, mapa.naoAlocados.map((c) => c.nome).join('; ')]);
    exportCSV(`mapa-mesas-${(eventoLabel(evento) || 'evento').replace(/\s+/g, '-').toLowerCase()}.csv`, ['Mesa', 'Lugares', 'Ocupados', 'Convidados'], rows);
  }

  function compartilhar() {
    if (!layout || !resumo) return;
    const linhas = [
      `Layout: ${layout.nome} (${setupLabel(layout.tipo_setup)})`,
      `Evento: ${eventoLabel(evento)}${evento?.data_inicio ? ' — ' + formatDate(evento.data_inicio) : ''}`,
      `Lugares: ${resumo.totais.lugares} · Alocados: ${resumo.totais.alocados} · Não alocados: ${resumo.totais.naoAlocados}`,
      '',
      ...mesas.map((mz) => `• ${mz.rotulo} (${(mapa.mesas[mz.id] || []).length}/${mz.lugares}): ${(mapa.mesas[mz.id] || []).map((c) => c.nome).join(', ') || '—'}`),
    ];
    navigator.clipboard?.writeText(linhas.join('\n')).then(
      () => toast.success('Resumo do mapa copiado.'),
      () => toast.error('Não foi possível copiar.'),
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (eventos.length === 0) {
    return <EmptyState icon={<IcoUsers />} title="Nenhum evento ainda" cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>O mapa de mesas parte de um evento. Cadastre um lead/evento e ele aparece aqui.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      {/* Seletor de evento */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoUsers /></span>
        <div className="min-w-0 flex-1">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
          <select value={eventoId || ''} onChange={(e) => setEventoId(e.target.value)} className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
          </select>
        </div>
        {convidadosEvento > 0 && <Chip className="bg-black/[0.04] text-ink-soft"><IcoUsers /> {formatNumber(convidadosEvento)} convidados</Chip>}
      </div>

      {carregando ? (
        <div className="h-72 animate-pulse rounded-2xl bg-black/[0.05]" />
      ) : !layout ? (
        <EmptyState
          icon={<IcoMap />}
          title="Nenhum layout aplicado a este evento"
          cta={layouts.length ? <button onClick={() => setEscolher(true)} className={btnPrimary}><IcoPlus /> Aplicar um layout</button> : <span className="text-sm text-ink-muted">Crie um layout na aba <strong>Biblioteca</strong> primeiro.</span>}
        >
          Escolha uma planta da biblioteca para este evento e aloque os convidados nas mesas.
        </EmptyState>
      ) : (
        <>
          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip className="bg-brand-50 text-brand">{layout.nome} · {setupLabel(layout.tipo_setup)}</Chip>
            <button onClick={() => setEscolher(true)} className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline">trocar layout</button>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={autoDistribuir} className={btnSecondary}><IcoSparkle /> Auto-distribuir</button>
              <button onClick={exportar} className={btnSecondary}><IcoDownload /> Exportar</button>
              <button onClick={compartilhar} className={btnSecondary}><IcoCopy /> Copiar resumo</button>
              <button onClick={publicar} disabled={busy} className={btnSecondary}><IcoShield /> Publicar no Acesso</button>
              <button onClick={salvar} disabled={busy || !dirty} className={btnPrimary}><IcoCheck /> {dirty ? 'Salvar mapa' : 'Salvo'}</button>
            </div>
          </div>

          {/* KPIs de ocupação */}
          {resumo && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Lugares" value={formatNumber(resumo.totais.lugares)} tone="brand" icon={<IcoTable />} />
              <Kpi label="Alocados" value={formatNumber(resumo.totais.alocados)} tone="verde" icon={<IcoUsers />} />
              <Kpi label="Livres" value={formatNumber(resumo.totais.livres)} tone="azul" />
              <Kpi label="Não alocados" value={formatNumber(resumo.totais.naoAlocados)} tone={resumo.totais.naoAlocados ? 'gold' : 'cinza'} />
              <Kpi label="Mesas excedidas" value={formatNumber(resumo.totais.mesasExcedidas)} tone={resumo.totais.mesasExcedidas ? 'vermelho' : 'cinza'} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Prévia */}
            <div className="rounded-2xl bg-white p-3 shadow-card">
              <PlantaCanvas planta={layout.planta} plantaUrl={layout.planta_url} ocupacao={ocup} />
              <p className="mt-2 text-center text-xs text-ink-muted">Verde = cheia · Amarelo = parcial · Vermelho = excedida</p>
            </div>

            {/* Alocação */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">Mesas ({formatNumber(mesas.length)})</h3>
                <button onClick={limpar} className="text-xs font-medium text-red-600 hover:underline">Limpar tudo</button>
              </div>
              <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {mesas.map((mz) => (
                  <MesaCard
                    key={mz.id} rotulo={mz.rotulo} lugares={mz.lugares}
                    convidados={mapa.mesas[mz.id] || []}
                    onAdd={(nome) => addConvidado(mz.id, nome)}
                    onRemove={(idx) => removeConvidado(mz.id, idx)}
                  />
                ))}
                {/* Não alocados */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="mb-2 text-xs font-bold text-amber-800">Não alocados ({formatNumber(mapa.naoAlocados.length)})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {mapa.naoAlocados.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs">
                        {c.nome}
                        <select value="" onChange={(e) => e.target.value && moverParaMesa(i, e.target.value)} className="cursor-pointer rounded text-[0.65rem] text-ink-muted" title="Mover para mesa">
                          <option value="">→</option>
                          {mesas.map((mz) => <option key={mz.id} value={mz.id}>{mz.rotulo}</option>)}
                        </select>
                      </span>
                    ))}
                  </div>
                  <AddInput placeholder="Adicionar convidado…" onAdd={addNaoAlocado} />
                </div>
              </div>

              {/* Compartilhar com outros módulos */}
              <div className="rounded-xl border border-black/[0.06] bg-white p-3 text-xs">
                <div className="mb-2 font-bold text-ink-soft">Compartilhar</div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/painel/producao?evento=${eventoId}`} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 font-medium hover:bg-black/[0.03]"><IcoClapper /> Produção</a>
                  <a href="/painel/propostas" className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 font-medium hover:bg-black/[0.03]"><IcoLink /> Propostas</a>
                  <a href={`/painel/acesso?evento=${eventoId}`} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 font-medium hover:bg-black/[0.03]"><IcoShield /> Acesso</a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: escolher layout */}
      {escolher && (
        <ModalShell onClose={() => setEscolher(false)} maxW="max-w-lg">
          <h3 className="mb-1 font-display text-xl font-bold text-ink">Aplicar layout ao evento</h3>
          <p className="mb-4 text-sm text-ink-muted">Escolha a planta para <strong>{eventoLabel(evento)}</strong>.</p>
          {layoutsCompat.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhum layout compatível. Crie um na aba <strong>Biblioteca</strong>.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {layoutsCompat.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl border border-black/10 p-2.5">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f7f7f8]">
                    {l.planta.itens.length > 0 && <PlantaCanvas planta={l.planta} thumbnail />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.nome}</div>
                    <div className="text-xs text-ink-muted">{setupLabel(l.tipo_setup)} · {formatNumber(mesasDaPlanta(l.planta.itens).reduce((s, m) => s + m.lugares, 0))} lugares</div>
                  </div>
                  <button onClick={() => aplicar(l.id, false)} disabled={busy} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.03] disabled:opacity-50">Aplicar</button>
                  {convidadosEvento > 0 && <button onClick={() => aplicar(l.id, true)} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">Aplicar + distribuir</button>}
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

// ── Card de uma mesa (lista de convidados + adicionar) ───────────────────────
function MesaCard({ rotulo, lugares, convidados, onAdd, onRemove }: {
  rotulo: string; lugares: number; convidados: Convidado[]; onAdd: (nome: string) => void; onRemove: (idx: number) => void;
}) {
  const excedido = convidados.length > lugares;
  const cheia = lugares > 0 && convidados.length >= lugares && !excedido;
  return (
    <div className={`rounded-xl border p-3 ${excedido ? 'border-red-300 bg-red-50/50' : cheia ? 'border-emerald-300 bg-emerald-50/40' : 'border-black/10 bg-white'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-ink">{rotulo}</span>
        <Chip className={excedido ? 'bg-red-100 text-red-700' : cheia ? 'bg-emerald-100 text-emerald-700' : 'bg-black/[0.04] text-ink-soft'}>{formatNumber(convidados.length)}/{formatNumber(lugares)}</Chip>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {convidados.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs">
            {c.nome}
            <button onClick={() => onRemove(i)} aria-label={`Remover ${c.nome}`} className="text-ink-muted hover:text-red-600"><IcoX /></button>
          </span>
        ))}
        {convidados.length === 0 && <span className="text-xs text-ink-muted">Vazia</span>}
      </div>
      <AddInput placeholder="Adicionar convidado…" onAdd={onAdd} />
    </div>
  );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (nome: string) => void }) {
  const [v, setV] = useState('');
  function go() { if (v.trim()) { onAdd(v); setV(''); } }
  return (
    <div className="mt-2 flex gap-1.5">
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none" />
      <button onClick={go} className="shrink-0 rounded-lg border border-black/10 px-2 py-1.5 text-xs font-semibold hover:bg-black/[0.03]"><IcoPlus /></button>
    </div>
  );
}
