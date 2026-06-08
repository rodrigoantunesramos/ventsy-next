'use client';

// Aba "Gatilhos & Planos" — os planos de contingência do evento. Cada plano
// observa uma MÉTRICA (chuva/vento/calor/…), com limiares de ATENÇÃO (amarelo) e
// CRÍTICO (vermelho); a engine (lib/plano-b) avalia contra a previsão e mostra o
// nível atual ao vivo. Gera planos prontos por TIPO de evento (corrida, air show,
// equestre, casamento, show). CRUD via RLS. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type PlanoBBag, type Plano, type ChecklistItem, type RiscoTipo,
  RISCOS, METRICAS, PLANO_STATUS_META,
  riscoMeta, metricaUnidade, gatilhoPadrao, nivelMeta, avaliarPlano, comunicadoSeed,
  listarTemplates, templateKeyParaTipo, gerarPlanosDoTemplate,
  criarPlano, bulkInserirPlanos, salvarPlano, excluirPlano, inp, selCls,
} from '../_lib';
import {
  ModalShell, Campo, EmptyState, Chip,
  IcoCloud, IcoPlus, IcoEdit, IcoTrash, IcoSparkle, IcoCheck, IcoAlert,
  btnPrimary, btnSecondary,
} from './ui';

export default function Planos({ bag }: { bag: PlanoBBag }) {
  const toast = useToast();
  const { planos, resumo } = bag;
  const [edit, setEdit] = useState<Plano | 'novo' | null>(null);
  const [tplKey, setTplKey] = useState(() => templateKeyParaTipo(bag.evento.tipo_evento));
  const [gerando, setGerando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const avaliados = useMemo(
    () => [...planos].sort((a, b) => a.ordem - b.ordem || a.tipo_risco.localeCompare(b.tipo_risco))
      .map((p) => ({ p, av: avaliarPlano(p, resumo) })),
    [planos, resumo],
  );

  const gerarModelos = async () => {
    setGerando(true);
    const seeds = gerarPlanosDoTemplate(tplKey);
    const base = planos.reduce((m, p) => Math.max(m, p.ordem), -1) + 1;
    const rows = seeds.map((s, i) => ({
      usuario_id: bag.userId, evento_id: bag.evento.id, tipo_risco: s.tipo_risco, gatilho: s.gatilho,
      acao: s.acao, responsavel: s.responsavel, status: 'armado', comunicado_template: s.comunicado_template,
      checklist: s.checklist, ordem: base + i,
    }));
    const { error } = await bulkInserirPlanos(rows);
    setGerando(false);
    if (error) { toast.error('Não foi possível gerar os planos.'); return; }
    toast.success(`${rows.length} planos de contingência gerados.`);
    await bag.recarregarPlanos();
  };

  const mudarStatus = async (p: Plano, status: string) => {
    setBusyId(p.id);
    const { error } = await salvarPlano(p.id, { status });
    setBusyId(null);
    if (error) { toast.error('Não foi possível atualizar o status.'); return; }
    await bag.recarregarPlanos();
  };

  const excluir = async (p: Plano) => {
    if (!confirm(`Excluir o plano de ${riscoMeta(p.tipo_risco).label.toLowerCase()}?`)) return;
    const { error } = await excluirPlano(p.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Plano excluído.');
    await bag.recarregarPlanos();
  };

  if (planos.length === 0) {
    return (
      <>
        <EmptyState icon={<IcoCloud />} title="Monte os gatilhos de contingência"
          cta={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <select value={tplKey} onChange={(e) => setTplKey(e.target.value as typeof tplKey)} className={selCls}>
                  {listarTemplates().map((t) => <option key={t.key} value={t.key}>{t.nome}</option>)}
                </select>
                <button onClick={gerarModelos} disabled={gerando} className={btnPrimary}><IcoSparkle /> {gerando ? 'Gerando…' : 'Gerar do modelo'}</button>
              </div>
              <button onClick={() => setEdit('novo')} className="text-sm font-semibold text-ink-muted hover:text-ink">ou criar um plano manualmente</button>
            </div>
          }>
          O modelo cria os planos certos para o tipo de evento — com gatilhos (limiares de chuva/vento/calor/visibilidade), ação, checklist de contingência e comunicado prontos. Você ajusta depois.
        </EmptyState>
        {edit && <PlanoModal bag={bag} plano={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.recarregarPlanos(); }} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{planos.length} plano(s) — o nível é calculado ao vivo contra a previsão.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tplKey} onChange={(e) => setTplKey(e.target.value as typeof tplKey)} className={selCls}>
            {listarTemplates().map((t) => <option key={t.key} value={t.key}>{t.nome}</option>)}
          </select>
          <button onClick={gerarModelos} disabled={gerando} className={btnSecondary}><IcoSparkle /> {gerando ? 'Gerando…' : 'Gerar modelo'}</button>
          <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Plano</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {avaliados.map(({ p, av }) => {
          const rm = riscoMeta(p.tipo_risco);
          const nm = nivelMeta(av.nivel);
          const un = p.gatilho.unidade;
          const sentido = p.gatilho.operador === 'abaixo' ? '≤' : '≥';
          return (
            <div key={p.id} className={`rounded-2xl border bg-white p-4 shadow-card ${p.status === 'descartado' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${rm.cor}1a`, color: rm.cor }}><IcoCloud /></span>
                  <div>
                    <div className="text-sm font-bold text-ink">{rm.label}</div>
                    <div className="text-[0.7rem] text-ink-muted">{rm.descricao}</div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button onClick={() => setEdit(p)} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
                  <button onClick={() => excluir(p)} aria-label="Excluir" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                </div>
              </div>

              {/* Semáforo + valor atual vs limiar */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${nm.chip}`}>
                  <span className={`h-2 w-2 rounded-full ${nm.dot}`} /> {nm.label}
                </span>
                {av.valor != null ? (
                  <span className="text-xs text-ink-muted">
                    agora <strong className="text-ink-soft">{formatNumber(av.valor, { maximumFractionDigits: 1 })}{un}</strong>
                    {' · '}gatilho {sentido} {formatNumber(p.gatilho.atencao)}{un} / {formatNumber(p.gatilho.critico)}{un}
                  </span>
                ) : (
                  <span className="text-xs text-ink-muted">gatilho {sentido} {formatNumber(p.gatilho.atencao)}{un} (atenção) / {formatNumber(p.gatilho.critico)}{un} (crítico)</span>
                )}
              </div>

              {p.acao && <p className="mt-2.5 text-sm text-ink-soft"><span className="font-semibold">Plano B:</span> {p.acao}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.05] pt-3">
                {p.responsavel && <Chip className="bg-black/[0.04] text-ink-soft">{p.responsavel}</Chip>}
                {p.checklist.length > 0 && <Chip className="bg-black/[0.04] text-ink-muted">{p.checklist.filter((c) => c.ok).length}/{p.checklist.length} contingência</Chip>}
                <Chip className={PLANO_STATUS_META[p.status]?.chip || 'bg-gray-100 text-gray-600'}>{PLANO_STATUS_META[p.status]?.label || p.status}</Chip>
                <div className="ml-auto flex gap-1.5">
                  {p.status !== 'acionado' && (
                    <button onClick={() => mudarStatus(p, 'acionado')} disabled={busyId === p.id} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"><IcoAlert /> Acionar</button>
                  )}
                  {p.status === 'acionado' && (
                    <button onClick={() => mudarStatus(p, 'armado')} disabled={busyId === p.id} className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">Rearmar</button>
                  )}
                  {p.status !== 'descartado'
                    ? <button onClick={() => mudarStatus(p, 'descartado')} disabled={busyId === p.id} className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-black/[0.07] disabled:opacity-50">Descartar</button>
                    : <button onClick={() => mudarStatus(p, 'armado')} disabled={busyId === p.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><IcoCheck /> Rearmar</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {edit && <PlanoModal bag={bag} plano={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.recarregarPlanos(); }} />}
    </div>
  );
}

// ── Modal de criar/editar plano ────────────────────────────────────────────────
function PlanoModal({ bag, plano, onClose, onSaved }: { bag: PlanoBBag; plano: Plano | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editando = !!plano;
  const [tipo, setTipo] = useState<RiscoTipo | string>(plano?.tipo_risco || 'chuva');
  const g0 = plano?.gatilho || gatilhoPadrao('chuva');
  const [metrica, setMetrica] = useState(g0.metrica);
  const [operador, setOperador] = useState(g0.operador);
  const [atencao, setAtencao] = useState(String(g0.atencao));
  const [critico, setCritico] = useState(String(g0.critico));
  const [unidade, setUnidade] = useState(g0.unidade);
  const [acao, setAcao] = useState(plano?.acao || '');
  const [responsavel, setResponsavel] = useState(plano?.responsavel || '');
  const [comunicado, setComunicado] = useState(plano?.comunicado_template || comunicadoSeed('chuva'));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(plano?.checklist || []);
  const [salvando, setSalvando] = useState(false);

  // Trocar o tipo de risco reseta o gatilho/comunicado p/ o padrão daquele risco.
  const onTipo = (t: string) => {
    setTipo(t);
    const g = gatilhoPadrao(t as RiscoTipo);
    setMetrica(g.metrica); setOperador(g.operador); setAtencao(String(g.atencao)); setCritico(String(g.critico)); setUnidade(g.unidade);
    if (!plano && !acao) setComunicado(comunicadoSeed(t as RiscoTipo));
  };
  const onMetrica = (m: string) => { setMetrica(m as typeof metrica); setUnidade(metricaUnidade(m)); };

  const salvar = async () => {
    const at = Number(atencao.replace(',', '.'));
    const cr = Number(critico.replace(',', '.'));
    if (!Number.isFinite(at) || !Number.isFinite(cr)) { toast.error('Informe limiares de atenção e crítico.'); return; }
    const limpa = checklist.map((c) => ({ label: c.label.trim(), responsavel: c.responsavel?.trim() || null, ok: !!c.ok })).filter((c) => c.label);
    const payload = {
      tipo_risco: tipo, gatilho: { metrica, operador, atencao: at, critico: cr, unidade },
      acao: acao.trim() || null, responsavel: responsavel.trim() || null, comunicado_template: comunicado.trim() || null,
      checklist: limpa,
    };
    setSalvando(true);
    if (editando && plano) {
      const { error } = await salvarPlano(plano.id, payload);
      setSalvando(false);
      if (error) { toast.error('Falha ao salvar o plano.'); return; }
      toast.success('Plano atualizado.');
    } else {
      const ordem = bag.planos.reduce((m, p) => Math.max(m, p.ordem), -1) + 1;
      const { error } = await criarPlano({ usuario_id: bag.userId, evento_id: bag.evento.id, status: 'armado', ordem, ...payload });
      setSalvando(false);
      if (error) { toast.error('Não foi possível criar o plano.'); return; }
      toast.success('Plano criado.');
    }
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-ink">{editando ? 'Editar plano' : 'Novo plano de contingência'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Risco">
          <select value={tipo} onChange={(e) => onTipo(e.target.value)} className={`${inp} bg-white`}>
            {RISCOS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
        </Campo>
        <Campo label="Métrica observada">
          <select value={metrica} onChange={(e) => onMetrica(e.target.value)} className={`${inp} bg-white`}>
            {METRICAS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
        </Campo>
        <Campo label="Sentido do limiar">
          <select value={operador} onChange={(e) => setOperador(e.target.value as typeof operador)} className={`${inp} bg-white`}>
            <option value="acima">Dispara acima de (≥)</option>
            <option value="abaixo">Dispara abaixo de (≤)</option>
          </select>
        </Campo>
        <Campo label={`Unidade`} hint="Só exibição (ex.: %, km/h, °C)">
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inp} />
        </Campo>
        <Campo label="Limiar de atenção (amarelo)">
          <input value={atencao} onChange={(e) => setAtencao(e.target.value)} inputMode="decimal" className={inp} />
        </Campo>
        <Campo label="Limiar crítico (vermelho)">
          <input value={critico} onChange={(e) => setCritico(e.target.value)} inputMode="decimal" className={inp} />
        </Campo>
        <Campo label="Plano B (ação)" full>
          <input value={acao} onChange={(e) => setAcao(e.target.value)} className={inp} placeholder="Ex.: acionar tenda e mover a cerimônia para a área coberta" />
        </Campo>
        <Campo label="Responsável" full hint={bag.equipe.length ? 'Sugestões da sua equipe' : undefined}>
          <input list="resp-equipe" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} placeholder="Quem aciona / acompanha" />
          <datalist id="resp-equipe">{bag.equipe.map((e) => <option key={e.id} value={e.nome} />)}</datalist>
        </Campo>
        <Campo label="Comunicado (modelo)" full hint="Variáveis: {evento} {data} {local} {empresa} {acao} {contato}">
          <textarea value={comunicado} onChange={(e) => setComunicado(e.target.value)} rows={3} className={inp} />
        </Campo>
      </div>

      {/* Checklist de contingência */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-soft">Checklist de contingência</span>
          <button onClick={() => setChecklist((l) => [...l, { label: '', responsavel: null, ok: false }])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-600"><IcoPlus /> Item</button>
        </div>
        <div className="space-y-2">
          {checklist.length === 0 && <p className="text-xs text-ink-muted">Itens a preparar (lonas, escoamento, ventiladores, sinalização…).</p>}
          {checklist.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c.label} onChange={(e) => setChecklist((l) => l.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className={`${inp} flex-1`} placeholder="Item de contingência" />
              <input list="resp-equipe" value={c.responsavel || ''} onChange={(e) => setChecklist((l) => l.map((x, j) => j === i ? { ...x, responsavel: e.target.value || null } : x))} className={`${inp} w-32`} placeholder="Resp." />
              <button onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label="Remover" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar plano'}</button>
      </div>
    </ModalShell>
  );
}
