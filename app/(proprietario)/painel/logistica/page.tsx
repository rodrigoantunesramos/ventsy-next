'use client';

// Logística: Montagem & Desmontagem — /painel/logistica.
// Orquestra o FÍSICO antes/depois do evento. PILARES (4 abas):
//   • Cronograma  — montagem → evento → desmontagem numa linha do tempo; cada
//                   JANELA bloqueia o espaço em Reservas/Calendário (via API).
//   • Fornecedores— agenda de chegadas (quem chega quando, doca, o que traz),
//                   fluxo de recebimento, checklist e credencial de veículo.
//   • Docas       — carga & descarga por doca/portão; a engine flagra CHOQUE.
//   • Frota       — veículos/motoristas e roteiros de transporte de material.
// Conflito/cronograma/choque: lib/logistica.ts (pura) + /api/logistica
// (autoritativo p/ janelas → bloqueio em `reservas`). Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { formatNumber, formatPercent, formatDate, formatDateTime, formatDateRange } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Janela, type Chegada, type Veiculo, type Viagem, type ChecklistItem,
  type JanelaTipo, JANELA_TIPOS, janelaTipoMeta, chegadaStatusMeta, frotaStatusMeta, viagemStatusMeta,
  FROTA_TIPOS, cronogramaFisico, janelaRange, chegadaRange, credencialVeiculo,
  detectarChoqueDocas, chegadasEmChoque, ordenarChegadas, proximaDocaLivre,
  progressoRecebimento, progressoChecklist, conflitosViagem, viagensEmConflito,
  janelasProximas,
  startOfDayLocal, ymd, addDaysYmd, MINUTO, HORA,
} from '@/lib/logistica';
import {
  type EventoLite, type FornecedorLite, type EspacoLite, type PropriedadeLite,
  eventoLabel, fornecedorLabel, fornecedorContato, propriedadeLabel, iniciais,
  isoToLocalInput, localInputToISO, ymdHmToISO,
  exportJanelasCSV, exportChegadasCSV, exportFrotaCSV,
} from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
type Tab = 'cronograma' | 'fornecedores' | 'docas' | 'frota';

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function asChecklist(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === 'object').map((x) => ({ label: String((x as ChecklistItem).label ?? ''), ok: !!(x as ChecklistItem).ok }));
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function LogisticaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('cronograma');

  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [chegadas, setChegadas] = useState<Chegada[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [espacos, setEspacos] = useState<EspacoLite[]>([]);
  const [propriedades, setPropriedades] = useState<PropriedadeLite[]>([]);

  const hoje = useMemo(() => ymd(new Date()), []);

  // seleção / filtros
  const [eventoCron, setEventoCron] = useState<string>('');     // cronograma
  const [fEvento, setFEvento] = useState<string>('');           // fornecedores
  const [fStatus, setFStatus] = useState<string>('');
  const [docaDia, setDocaDia] = useState(hoje);                 // docas

  // modais
  const [janelaModal, setJanelaModal] = useState<{ editing: Janela | null; preset?: Partial<Janela> } | null>(null);
  const [chegadaModal, setChegadaModal] = useState<{ editing: Chegada | null; preset?: Partial<Chegada> } | null>(null);
  const [veiculoModal, setVeiculoModal] = useState<{ editing: Veiculo | null } | null>(null);
  const [viagemModal, setViagemModal] = useState<{ editing: Viagem | null; preset?: Partial<Viagem> } | null>(null);
  const [credencial, setCredencial] = useState<Chegada | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const jaRes = await sb.from('logistica_janelas').select('*').eq('usuario_id', uid).order('inicio', { ascending: true });
    if (isMissingTable(jaRes.error)) { setNeedsSetup(true); return; }
    setNeedsSetup(false);
    setJanelas((jaRes.data || []) as Janela[]);

    const [chRes, frRes, viRes, evRes, foRes, espRes, prRes] = await Promise.all([
      sb.from('logistica_chegadas').select('*').eq('usuario_id', uid),
      sb.from('frota').select('*').eq('usuario_id', uid).order('nome'),
      sb.from('frota_viagens').select('*').eq('usuario_id', uid),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,propriedade_id').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('fornecedores').select('id,nome,fantasia,categoria,telefone,whatsapp,contato').eq('usuario_id', uid).order('nome'),
      sb.from('espacos').select('*').eq('usuario_id', uid).order('ordem'),
      sb.from('propriedades').select('*').eq('usuario_id', uid),
    ]);
    setChegadas(chRes.error ? [] : ((chRes.data || []) as Chegada[]).map((c) => ({ ...c, duracao_min: num(c.duracao_min) || 30, checklist: asChecklist(c.checklist) })));
    setVeiculos(frRes.error ? [] : ((frRes.data || []) as Veiculo[]).map((v) => ({ ...v, capacidade: v.capacidade == null ? null : num(v.capacidade) })));
    setViagens(viRes.error ? [] : (viRes.data || []) as Viagem[]);
    setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
    setFornecedores(foRes.error ? [] : (foRes.data || []) as FornecedorLite[]);
    setEspacos(espRes.error ? [] : ((espRes.data || []) as EspacoLite[]));
    setPropriedades(prRes.error ? [] : (prRes.data || []) as PropriedadeLite[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const refetch = useCallback(() => { if (userId) carregar(userId); }, [userId, carregar]);

  // ── Mapas auxiliares ──
  const eventoById = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const fornById = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const espacoById = useMemo(() => new Map(espacos.map((e) => [e.id, e])), [espacos]);
  const veiculoById = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const eventoNome = useCallback((id: string | null) => eventoLabel(id ? eventoById.get(id) : null), [eventoById]);
  const fornNome = useCallback((id: string | null) => fornecedorLabel(id ? fornById.get(id) : null), [fornById]);

  // ── KPIs (cabeçalho) ──
  const kpis = useMemo(() => {
    const eventosComJanela = new Set(janelas.map((j) => j.evento_id).filter(Boolean)).size;
    const proximas = janelasProximas(janelas, 7).length;
    const minMontagem = janelas.filter((j) => j.tipo === 'montagem').reduce((s, j) => { const r = janelaRange(j); return s + (r ? (r.end - r.start) / MINUTO : 0); }, 0);
    const choques = detectarChoqueDocas(chegadas).length;
    const conflFrota = conflitosViagem(viagens).length;
    const disponiveis = veiculos.filter((v) => v.status === 'disponivel').length;
    return { eventosComJanela, proximas, horasMontagem: minMontagem / 60, choques, conflFrota, disponiveis };
  }, [janelas, chegadas, viagens, veiculos]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const semDados = janelas.length === 0 && chegadas.length === 0 && veiculos.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Logística</h1>
          <p className="mt-1 text-sm text-ink-muted">Montagem e desmontagem, chegada de fornecedores, carga &amp; descarga e frota — o físico do evento sob controle.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setChegadaModal({ editing: null })} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">+ Chegada</button>
          <button onClick={() => setJanelaModal({ editing: null })} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Nova janela</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O módulo de logística ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/logistica.sql</code> no Supabase para criar <code className="rounded bg-amber-100 px-1 py-0.5">logistica_janelas</code>, <code className="rounded bg-amber-100 px-1 py-0.5">logistica_chegadas</code>, <code className="rounded bg-amber-100 px-1 py-0.5">frota</code> e <code className="rounded bg-amber-100 px-1 py-0.5">frota_viagens</code>.
        </div>
      )}

      {!needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Janelas" value={formatNumber(janelas.length)} sub={`${formatNumber(kpis.proximas)} nos próx. 7 dias`} tone="brand" icon={<IcoCalendar />} />
            <Kpi label="Eventos c/ logística" value={formatNumber(kpis.eventosComJanela)} tone="ink" icon={<IcoFlag />} />
            <Kpi label="Horas de montagem" value={formatNumber(kpis.horasMontagem, { maximumFractionDigits: 1 })} sub="agendadas" tone="azul" icon={<IcoWrench />} />
            <Kpi label="Choque de docas" value={formatNumber(kpis.choques)} sub="a resolver" tone={kpis.choques ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
            <Kpi label="Frota disponível" value={formatNumber(kpis.disponiveis)} sub={`${formatNumber(veiculos.length)} no total`} tone="verde" icon={<IcoTruck />} />
            <Kpi label="Conflito de frota" value={formatNumber(kpis.conflFrota)} tone={kpis.conflFrota ? 'vermelho' : 'ink'} icon={<IcoRoute />} />
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['cronograma', 'Cronograma físico'], ['fornecedores', 'Fornecedores'], ['docas', 'Carga & descarga'], ['frota', 'Frota']] as [Tab, string][]).map(([k, lab]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}>{lab}</button>
            ))}
          </div>

          {semDados && tab === 'cronograma' && <EmptyLogistica onNova={() => setJanelaModal({ editing: null })} />}

          {/* ───────────────────── CRONOGRAMA FÍSICO ───────────────────── */}
          {tab === 'cronograma' && !semDados && (
            <CronogramaTab
              janelas={janelas} eventos={eventos} eventoSel={eventoCron} setEventoSel={setEventoCron}
              espacoById={espacoById} eventoById={eventoById} eventoNome={eventoNome}
              confirmKey={confirmKey}
              onNova={(preset) => setJanelaModal({ editing: null, preset })}
              onEditar={(j) => setJanelaModal({ editing: j })}
              onExcluir={async (j) => {
                const key = `delj:${j.id}`;
                if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir a janela e liberar o espaço.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
                setConfirmKey(null);
                const res = await fetch(`/api/logistica?id=${j.id}`, { method: 'DELETE', headers: await authHeaders() });
                if (!res.ok) { toast.error('Não foi possível excluir a janela.'); return; }
                toast.success('Janela removida — espaço liberado na agenda.'); refetch();
              }}
              onExport={() => exportJanelasCSV(janelas, eventoNome)}
            />
          )}

          {/* ───────────────────── FORNECEDORES (chegadas) ───────────────────── */}
          {tab === 'fornecedores' && (
            <FornecedoresTab
              chegadas={chegadas} eventos={eventos} fEvento={fEvento} setFEvento={setFEvento} fStatus={fStatus} setFStatus={setFStatus}
              fornById={fornById} eventoNome={eventoNome} confirmKey={confirmKey}
              onNova={() => setChegadaModal({ editing: null, preset: fEvento ? { evento_id: fEvento } : undefined })}
              onEditar={(c) => setChegadaModal({ editing: c })}
              onCredencial={(c) => setCredencial(c)}
              onStatus={async (c, to) => {
                const { error } = await sb.from('logistica_chegadas').update({ status: to }).eq('id', c.id);
                if (error) { toast.error('Não foi possível atualizar o status.'); return; }
                toast.success(`Marcado como ${chegadaStatusMeta(to).label.toLowerCase()}.`); refetch();
              }}
              onChecklist={async (c, checklist) => {
                const { error } = await sb.from('logistica_chegadas').update({ checklist }).eq('id', c.id);
                if (error) { toast.error('Não foi possível salvar a conferência.'); return; }
                setChegadas((arr) => arr.map((x) => (x.id === c.id ? { ...x, checklist } : x)));
              }}
              onExcluir={async (c) => {
                const key = `delc:${c.id}`;
                if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir a chegada.'); setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000); return; }
                setConfirmKey(null);
                const { error } = await sb.from('logistica_chegadas').delete().eq('id', c.id);
                if (error) { toast.error('Não foi possível excluir.'); return; }
                toast.success('Chegada removida.'); refetch();
              }}
              onExport={() => exportChegadasCSV(chegadas, fornNome, eventoNome)}
            />
          )}

          {/* ───────────────────── DOCAS (carga & descarga) ───────────────────── */}
          {tab === 'docas' && (
            <DocasTab
              chegadas={chegadas} dia={docaDia} setDia={setDocaDia} fornById={fornById}
              onEditar={(c) => setChegadaModal({ editing: c })} onCredencial={(c) => setCredencial(c)}
              onNova={(doca, previstoISO) => setChegadaModal({ editing: null, preset: { doca, previsto: previstoISO } })}
            />
          )}

          {/* ───────────────────── FROTA ───────────────────── */}
          {tab === 'frota' && (
            <FrotaTab
              veiculos={veiculos} viagens={viagens} eventos={eventos} veiculoById={veiculoById} eventoNome={eventoNome} confirmKey={confirmKey}
              onNovoVeiculo={() => setVeiculoModal({ editing: null })} onEditarVeiculo={(v) => setVeiculoModal({ editing: v })}
              onNovaViagem={(preset) => setViagemModal({ editing: null, preset })} onEditarViagem={(v) => setViagemModal({ editing: v })}
              onStatusVeiculo={async (v, to) => {
                const { error } = await sb.from('frota').update({ status: to }).eq('id', v.id);
                if (error) { toast.error('Não foi possível atualizar.'); return; }
                setVeiculos((arr) => arr.map((x) => (x.id === v.id ? { ...x, status: to } : x)));
              }}
              onExcluirViagem={async (vi) => {
                const key = `delvi:${vi.id}`;
                if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir a viagem.'); setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000); return; }
                setConfirmKey(null);
                const { error } = await sb.from('frota_viagens').delete().eq('id', vi.id);
                if (error) { toast.error('Não foi possível excluir.'); return; }
                toast.success('Viagem removida.'); refetch();
              }}
              onExport={() => exportFrotaCSV(veiculos)}
            />
          )}
        </>
      )}

      {/* ── Modais ── */}
      {janelaModal && userId && (
        <JanelaModal userId={userId} editing={janelaModal.editing} preset={janelaModal.preset}
          eventos={eventos} espacos={espacos} propriedades={propriedades} eventoById={eventoById}
          onClose={() => setJanelaModal(null)} onSaved={() => { setJanelaModal(null); refetch(); }} />
      )}
      {chegadaModal && userId && (
        <ChegadaModal userId={userId} editing={chegadaModal.editing} preset={chegadaModal.preset}
          eventos={eventos} fornecedores={fornecedores}
          onClose={() => setChegadaModal(null)} onSaved={() => { setChegadaModal(null); refetch(); }} />
      )}
      {veiculoModal && userId && (
        <VeiculoModal userId={userId} editing={veiculoModal.editing}
          onClose={() => setVeiculoModal(null)} onSaved={() => { setVeiculoModal(null); refetch(); }} />
      )}
      {viagemModal && userId && (
        <ViagemModal userId={userId} editing={viagemModal.editing} preset={viagemModal.preset}
          veiculos={veiculos} eventos={eventos}
          onClose={() => setViagemModal(null)} onSaved={() => { setViagemModal(null); refetch(); }} />
      )}
      {credencial && (
        <CredencialModal chegada={credencial} fornecedor={credencial.fornecedor_id ? fornById.get(credencial.fornecedor_id) || null : null} eventoNome={eventoNome} onClose={() => setCredencial(null)} />
      )}
    </div>
  );
}

// ══════════════════════════ ABA: CRONOGRAMA ══════════════════════════════════
function CronogramaTab({ janelas, eventos, eventoSel, setEventoSel, espacoById, eventoById, eventoNome, confirmKey, onNova, onEditar, onExcluir, onExport }: {
  janelas: Janela[]; eventos: EventoLite[]; eventoSel: string; setEventoSel: (v: string) => void;
  espacoById: Map<number, EspacoLite>; eventoById: Map<string, EventoLite>; eventoNome: (id: string | null) => string;
  confirmKey: string | null; onNova: (preset?: Partial<Janela>) => void; onEditar: (j: Janela) => void; onExcluir: (j: Janela) => void; onExport: () => void;
}) {
  const evento = eventoSel ? eventoById.get(eventoSel) || null : null;
  const janelasEvento = useMemo(() => janelas.filter((j) => j.evento_id === eventoSel), [janelas, eventoSel]);
  const cron = useMemo(() => cronogramaFisico(
    evento ? { inicio: evento.data_inicio, fim: evento.data_fim } : null,
    janelasEvento,
  ), [evento, janelasEvento]);
  const proximas = useMemo(() => janelasProximas(janelas, 30), [janelas]);

  return (
    <div className="mt-5 space-y-5">
      {/* Seletor de evento + Gantt */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[240px] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Cronograma físico do evento</span>
            <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className={inp}>
              <option value="">Selecione um evento…</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {janelas.length > 0 && <button onClick={onExport} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
            <button onClick={() => onNova(eventoSel ? presetJanelaDoEvento(eventoById.get(eventoSel)) : undefined)} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Janela</button>
          </div>
        </div>

        {!eventoSel ? (
          <p className="mt-6 rounded-xl border border-dashed border-brand/30 bg-brand-50/30 px-4 py-8 text-center text-sm text-ink-soft">Escolha um evento para ver a linha do tempo <b>montagem → evento → desmontagem</b>. Cada janela bloqueia o espaço no <a className="font-semibold text-brand hover:underline" href="/painel/calendario">Calendário</a>.</p>
        ) : cron.fases.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-brand/30 bg-white px-4 py-8 text-center">
            <p className="text-sm text-ink-soft">Nenhuma janela para <b>{eventoLabel(evento)}</b> ainda{evento?.data_inicio ? '' : ' (e o evento não tem data definida)'}.</p>
            <button onClick={() => onNova(presetJanelaDoEvento(evento))} className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Adicionar montagem</button>
          </div>
        ) : (
          <GanttFisico cron={cron} espacoById={espacoById} janelas={janelasEvento} onEditar={onEditar} />
        )}
      </div>

      {/* Janelas do evento (lista editável) */}
      {eventoSel && janelasEvento.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold text-ink">Janelas de {eventoLabel(evento)}</h3>
          <div className="space-y-2">
            {janelasEvento.map((j) => <JanelaRow key={j.id} j={j} espaco={j.espaco_id ? espacoById.get(j.espaco_id) || null : null} confirmKey={confirmKey} onEditar={onEditar} onExcluir={onExcluir} />)}
          </div>
        </div>
      )}

      {/* Próximas janelas (global) */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Próximas janelas</h3>
        <p className="mb-4 text-xs text-ink-muted">Montagens/desmontagens nos próximos 30 dias — cada uma ocupa o espaço na agenda.</p>
        {proximas.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Nenhuma janela agendada nos próximos 30 dias.</p> : (
          <div className="space-y-2">
            {proximas.map((j) => (
              <button key={j.id} onClick={() => onEditar(j)} className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] p-2.5 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: janelaTipoMeta(j.tipo).hex }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{janelaTipoMeta(j.tipo).label}{j.titulo ? ` · ${j.titulo}` : ''}</p>
                  <p className="truncate text-xs text-ink-muted">{eventoNome(j.evento_id)}</p>
                </div>
                <span className="shrink-0 text-right text-xs text-ink-soft">{j.inicio ? formatDateTime(j.inicio) : '—'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function presetJanelaDoEvento(ev: EventoLite | null | undefined): Partial<Janela> | undefined {
  if (!ev) return undefined;
  return { evento_id: ev.id, propriedade_id: ev.propriedade_id, tipo: 'montagem' };
}

function GanttFisico({ cron, espacoById, janelas, onEditar }: { cron: ReturnType<typeof cronogramaFisico>; espacoById: Map<number, EspacoLite>; janelas: Janela[]; onEditar: (j: Janela) => void }) {
  const span = (cron.fim ?? 0) - (cron.inicio ?? 0) || 1;
  const janelaById = new Map(janelas.map((j) => [j.id, j]));
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
        <span>{cron.inicio != null ? formatDateTime(cron.inicio) : ''}</span>
        <span className="font-semibold text-ink-soft">{Math.round(cron.duracaoTotalMin / 60)} h no total</span>
        <span>{cron.fim != null ? formatDateTime(cron.fim) : ''}</span>
      </div>
      <div className="space-y-1.5">
        {cron.fases.map((f, i) => {
          const left = ((f.start - (cron.inicio ?? 0)) / span) * 100;
          const width = Math.max(2, ((f.end - f.start) / span) * 100);
          const meta = janelaTipoMeta(f.tipo);
          const j = f.janelaId ? janelaById.get(f.janelaId) : null;
          const esp = j?.espaco_id ? espacoById.get(j.espaco_id) : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-[108px] shrink-0 text-right text-xs font-medium text-ink-soft">{f.label}</div>
              <div className="relative h-8 flex-1 rounded-lg bg-black/[0.03]">
                <button
                  onClick={() => j && onEditar(j)} disabled={!j}
                  title={`${f.label} · ${formatDateRange(f.start, f.end)} · ${Math.round(f.duracaoMin / 60 * 10) / 10}h${esp ? ` · ${esp.nome}` : ''}`}
                  className={`absolute top-0 h-8 rounded-lg border-l-4 ${meta.bar} ${j ? 'cursor-pointer' : 'cursor-default'} flex items-center px-2 text-[0.65rem] font-semibold text-ink/80 overflow-hidden`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate">{f.tipo === 'evento' ? 'Evento' : (esp?.nome || f.label)}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JanelaRow({ j, espaco, confirmKey, onEditar, onExcluir }: { j: Janela; espaco: EspacoLite | null; confirmKey: string | null; onEditar: (j: Janela) => void; onExcluir: (j: Janela) => void }) {
  const meta = janelaTipoMeta(j.tipo);
  const r = janelaRange(j);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{j.titulo || meta.label}{espaco ? ` · ${espaco.nome}` : ''}</p>
        <p className="truncate text-xs text-ink-muted">{j.inicio ? formatDateRange(j.inicio, j.fim) : '—'}{r ? ` · ${Math.round((r.end - r.start) / HORA * 10) / 10} h` : ''}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-[0.7rem] text-emerald-700 sm:inline-flex"><IcoLock /> bloqueia o espaço</span>
      <button onClick={() => onEditar(j)} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Editar</button>
      <button onClick={() => onExcluir(j)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${confirmKey === `delj:${j.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `delj:${j.id}` ? 'Confirmar?' : 'Excluir'}</button>
    </div>
  );
}

// ══════════════════════════ ABA: FORNECEDORES ════════════════════════════════
const CHEGADA_FLUXO: Record<string, { to: string; label: string; cls: string } | null> = {
  agendado: { to: 'chegou', label: 'Registrar chegada', cls: 'bg-sky-600 hover:bg-sky-700' },
  chegou: { to: 'descarregando', label: 'Iniciar descarga', cls: 'bg-blue-600 hover:bg-blue-700' },
  descarregando: { to: 'montado', label: 'Concluir montagem', cls: 'bg-emerald-600 hover:bg-emerald-700' },
  montado: { to: 'saiu', label: 'Registrar saída', cls: 'bg-gray-600 hover:bg-gray-700' },
  saiu: null, cancelado: null,
};

function FornecedoresTab({ chegadas, eventos, fEvento, setFEvento, fStatus, setFStatus, fornById, eventoNome, confirmKey, onNova, onEditar, onCredencial, onStatus, onChecklist, onExcluir, onExport }: {
  chegadas: Chegada[]; eventos: EventoLite[]; fEvento: string; setFEvento: (v: string) => void; fStatus: string; setFStatus: (v: string) => void;
  fornById: Map<string, FornecedorLite>; eventoNome: (id: string | null) => string; confirmKey: string | null;
  onNova: () => void; onEditar: (c: Chegada) => void; onCredencial: (c: Chegada) => void;
  onStatus: (c: Chegada, to: string) => void; onChecklist: (c: Chegada, checklist: ChecklistItem[]) => void; onExcluir: (c: Chegada) => void; onExport: () => void;
}) {
  const filtradas = useMemo(() => {
    let arr = chegadas;
    if (fEvento) arr = arr.filter((c) => c.evento_id === fEvento);
    if (fStatus) arr = arr.filter((c) => c.status === fStatus);
    return ordenarChegadas(arr);
  }, [chegadas, fEvento, fStatus]);
  const prog = useMemo(() => progressoRecebimento(fEvento ? chegadas.filter((c) => c.evento_id === fEvento) : chegadas), [chegadas, fEvento]);
  const choque = useMemo(() => chegadasEmChoque(chegadas), [chegadas]);

  return (
    <div className="mt-5 space-y-5">
      {/* Filtros + progresso */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} className={selCls}>
            <option value="">Todos os eventos</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
            <option value="">Todos os status</option>
            {(['agendado', 'chegou', 'descarregando', 'montado', 'saiu', 'cancelado'] as const).map((s) => <option key={s} value={s}>{chegadaStatusMeta(s).label}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            {chegadas.length > 0 && <button onClick={onExport} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
            <button onClick={onNova} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Chegada</button>
          </div>
        </div>
        {prog.total > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-muted"><span>Recebimento</span><span>{formatNumber(prog.recebidos)}/{formatNumber(prog.total)} · {formatPercent(prog.percent)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(prog.percent * 100)}%` }} /></div>
          </div>
        )}
      </div>

      {filtradas.length === 0 ? (
        <EmptyCard title="Sem chegadas agendadas" msg="Agende quem chega quando, por qual doca/portão e o que traz. O sistema avisa se duas chegadas disputam a mesma doca e gera a credencial do veículo." cta="+ Agendar chegada" onCta={onNova} />
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((c) => (
            <ChegadaCard key={c.id} c={c} fornecedor={c.fornecedor_id ? fornById.get(c.fornecedor_id) || null : null} eventoNome={eventoNome}
              emChoque={choque.has(c.id)} confirmKey={confirmKey}
              onEditar={onEditar} onCredencial={onCredencial} onStatus={onStatus} onChecklist={onChecklist} onExcluir={onExcluir} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChegadaCard({ c, fornecedor, eventoNome, emChoque, confirmKey, onEditar, onCredencial, onStatus, onChecklist, onExcluir }: {
  c: Chegada; fornecedor: FornecedorLite | null; eventoNome: (id: string | null) => string; emChoque: boolean; confirmKey: string | null;
  onEditar: (c: Chegada) => void; onCredencial: (c: Chegada) => void; onStatus: (c: Chegada, to: string) => void; onChecklist: (c: Chegada, checklist: ChecklistItem[]) => void; onExcluir: (c: Chegada) => void;
}) {
  const [openCheck, setOpenCheck] = useState(false);
  const meta = chegadaStatusMeta(c.status);
  const fluxo = CHEGADA_FLUXO[c.status];
  const contato = fornecedorContato(fornecedor) || c.contato || '';
  const checkPct = progressoChecklist(c.checklist);
  function toggleItem(idx: number) { onChecklist(c, c.checklist.map((it, i) => (i === idx ? { ...it, ok: !it.ok } : it))); }

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${emChoque ? 'border-red-300 ring-1 ring-red-200' : 'border-black/[0.06]'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: meta.hex }}>{iniciais(fornecedorLabel(fornecedor) === '—' ? c.item : fornecedorLabel(fornecedor))}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink">{c.item}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${meta.chip}`}>{meta.label}</span>
            {emChoque && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-bold text-red-600"><IcoAlert /> choque de doca</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{fornecedorLabel(fornecedor)} · {eventoNome(c.evento_id)}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1"><IcoClock /> {c.previsto ? formatDateTime(c.previsto) : 'sem horário'} · {formatNumber(c.duracao_min)} min</span>
            {c.doca && <span className="inline-flex items-center gap-1"><IcoDock /> {c.doca}</span>}
            {(c.veiculo || c.placa) && <span className="inline-flex items-center gap-1"><IcoTruck /> {[c.veiculo, c.placa].filter(Boolean).join(' · ')}</span>}
            {c.responsavel && <span className="inline-flex items-center gap-1"><IcoUser /> {c.responsavel}</span>}
            {contato && <a href={`tel:${contato.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 text-brand hover:underline"><IcoPhone /> {contato}</a>}
          </div>
        </div>
      </div>

      {/* checklist de recebimento */}
      {c.checklist.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpenCheck((v) => !v)} className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded transition ${openCheck ? 'rotate-90' : ''}`}>›</span>
            Conferência {formatNumber(c.checklist.filter((i) => i.ok).length)}/{formatNumber(c.checklist.length)} · {formatPercent(checkPct)}
          </button>
          {openCheck && (
            <div className="mt-2 space-y-1.5 pl-6">
              {c.checklist.map((it, i) => (
                <label key={i} className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={it.ok} onChange={() => toggleItem(i)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
                  <span className={it.ok ? 'text-ink-muted line-through' : ''}>{it.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.05] pt-3">
        {fluxo && <button onClick={() => onStatus(c, fluxo.to)} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${fluxo.cls}`}>{fluxo.label}</button>}
        <button onClick={() => onCredencial(c)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand"><IcoBadge /> Credencial</button>
        <button onClick={() => onEditar(c)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Editar</button>
        {c.status !== 'cancelado' && c.status !== 'saiu' && <button onClick={() => onStatus(c, 'cancelado')} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-amber-300 hover:text-amber-700">Cancelar</button>}
        <button onClick={() => onExcluir(c)} className={`ml-auto rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${confirmKey === `delc:${c.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `delc:${c.id}` ? 'Confirmar?' : 'Excluir'}</button>
      </div>
    </div>
  );
}

// ══════════════════════════ ABA: DOCAS ═══════════════════════════════════════
const DOCA_H_INI = 6;   // janela visível do dia (06:00 → 24:00)
const DOCA_H_FIM = 24;

function DocasTab({ chegadas, dia, setDia, fornById, onEditar, onCredencial, onNova }: {
  chegadas: Chegada[]; dia: string; setDia: (v: string) => void; fornById: Map<string, FornecedorLite>;
  onEditar: (c: Chegada) => void; onCredencial: (c: Chegada) => void; onNova: (doca: string, previstoISO: string | null) => void;
}) {
  const dayStart = startOfDayLocal(dia);
  const winStart = dayStart + DOCA_H_INI * HORA;
  const winEnd = dayStart + DOCA_H_FIM * HORA;
  const win = winEnd - winStart;

  const doDia = useMemo(() => chegadas.filter((c) => {
    const r = chegadaRange(c);
    return !!r && r.end > winStart && r.start < winEnd && c.status !== 'cancelado';
  }), [chegadas, winStart, winEnd]);

  const docas = useMemo(() => {
    const s = new Set<string>();
    doDia.forEach((c) => { if (c.doca && c.doca.trim()) s.add(c.doca.trim()); });
    const arr = [...s].sort((a, b) => a.localeCompare(b));
    return arr.length ? arr : ['Doca 1'];
  }, [doDia]);

  const choque = useMemo(() => chegadasEmChoque(chegadas), [chegadas]);
  const horas = Array.from({ length: DOCA_H_FIM - DOCA_H_INI + 1 }, (_, i) => DOCA_H_INI + i);
  const semDoca = doDia.filter((c) => !c.doca || !c.doca.trim());

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-ink">Ocupação das docas</h3>
            <p className="text-xs text-ink-muted">Carga &amp; descarga por doca/portão. Vermelho = choque (duas chegadas ao mesmo tempo).</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDia(addDaysYmd(dia, -1))} className="rounded-lg border border-black/10 px-2 py-2 text-sm hover:bg-black/[0.03]" aria-label="Dia anterior">‹</button>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={selCls} />
            <button onClick={() => setDia(addDaysYmd(dia, 1))} className="rounded-lg border border-black/10 px-2 py-2 text-sm hover:bg-black/[0.03]" aria-label="Próximo dia">›</button>
          </div>
        </div>

        {doDia.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhuma chegada com horário neste dia. Agende na aba <b>Fornecedores</b>.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* régua de horas */}
              <div className="flex pl-[100px]">
                {horas.map((h) => <div key={h} className="flex-1 border-l border-black/[0.06] pb-1 pl-1 text-[0.6rem] text-ink-muted">{String(h).padStart(2, '0')}h</div>)}
              </div>
              {docas.map((doca) => {
                const daDoca = doDia.filter((c) => (c.doca || '').trim() === doca);
                return (
                  <div key={doca} className="flex items-center border-t border-black/[0.04]">
                    <div className="flex w-[100px] shrink-0 items-center gap-1.5 py-2 pr-2 text-xs font-semibold text-ink-soft"><IcoDock /> <span className="truncate" title={doca}>{doca}</span></div>
                    <div className="relative h-12 flex-1" onDoubleClick={() => onNova(doca, null)}>
                      {daDoca.map((c) => {
                        const r = chegadaRange(c)!;
                        const left = Math.max(0, ((r.start - winStart) / win) * 100);
                        const width = Math.max(3, ((Math.min(r.end, winEnd) - Math.max(r.start, winStart)) / win) * 100);
                        const bad = choque.has(c.id);
                        const meta = chegadaStatusMeta(c.status);
                        return (
                          <button key={c.id} onClick={() => onEditar(c)} title={`${c.item} · ${c.previsto ? formatDateTime(c.previsto) : ''} · ${formatNumber(c.duracao_min)}min${bad ? ' — CHOQUE!' : ''}`}
                            className={`absolute top-1.5 h-9 overflow-hidden rounded-lg border-l-4 px-1.5 text-left text-[0.62rem] font-semibold ${bad ? 'border-red-600 bg-red-200 text-red-900 ring-1 ring-red-400' : `${meta.bar} text-ink/80`}`}
                            style={{ left: `${left}%`, width: `${width}%` }}>
                            <span className="block truncate">{c.item}</span>
                            <span className="block truncate font-normal opacity-80">{fornecedorLabel(c.fornecedor_id ? fornById.get(c.fornecedor_id) || null : null)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="mt-2 pl-[100px] text-[0.65rem] text-ink-muted">Dê duplo-clique numa faixa livre para agendar uma chegada naquela doca.</p>
            </div>
          </div>
        )}
      </div>

      {/* Fila de entrada (ordem) */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Ordem de entrada</h3>
        <p className="mb-4 text-xs text-ink-muted">Sequência por horário previsto — controle do portão para evitar congestionamento.</p>
        {ordenarChegadas(doDia).length === 0 ? <p className="py-6 text-center text-sm text-ink-muted">Sem chegadas neste dia.</p> : (
          <div className="space-y-2">
            {ordenarChegadas(doDia).map((c, i) => {
              const bad = choque.has(c.id);
              const sugestao = bad ? proximaDocaLivre(chegadas, docas, chegadaRange(c)!, c.id) : null;
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${bad ? 'border-red-200 bg-red-50/50' : 'border-black/[0.06]'}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-xs font-bold text-ink-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.item} <span className="font-normal text-ink-muted">· {fornecedorLabel(c.fornecedor_id ? fornById.get(c.fornecedor_id) || null : null)}</span></p>
                    <p className="truncate text-xs text-ink-muted">{c.previsto ? formatDateTime(c.previsto) : 'sem horário'} · {c.doca || 'sem doca'}{bad && sugestao ? ` · sugestão: remanejar p/ ${sugestao}` : ''}</p>
                  </div>
                  <button onClick={() => onCredencial(c)} className="shrink-0 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Credencial</button>
                </div>
              );
            })}
          </div>
        )}
        {semDoca.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{formatNumber(semDoca.length)} chegada(s) sem doca definida — atribua uma doca para organizar o recebimento.</p>}
      </div>
    </div>
  );
}

// ══════════════════════════ ABA: FROTA ═══════════════════════════════════════
function FrotaTab({ veiculos, viagens, eventos, veiculoById, eventoNome, confirmKey, onNovoVeiculo, onEditarVeiculo, onNovaViagem, onEditarViagem, onStatusVeiculo, onExcluirViagem, onExport }: {
  veiculos: Veiculo[]; viagens: Viagem[]; eventos: EventoLite[]; veiculoById: Map<string, Veiculo>; eventoNome: (id: string | null) => string; confirmKey: string | null;
  onNovoVeiculo: () => void; onEditarVeiculo: (v: Veiculo) => void; onNovaViagem: (preset?: Partial<Viagem>) => void; onEditarViagem: (v: Viagem) => void;
  onStatusVeiculo: (v: Veiculo, to: string) => void; onExcluirViagem: (v: Viagem) => void; onExport: () => void;
}) {
  const emConflito = useMemo(() => viagensEmConflito(viagens), [viagens]);
  const viagensOrdenadas = useMemo(() => [...viagens].sort((a, b) => (Date.parse(b.partida || '') || 0) - (Date.parse(a.partida || '') || 0)), [viagens]);

  return (
    <div className="mt-5 space-y-5">
      {/* Veículos */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink">Veículos</h3>
          <div className="flex items-center gap-2">
            {veiculos.length > 0 && <button onClick={onExport} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
            <button onClick={onNovoVeiculo} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Veículo</button>
          </div>
        </div>
        {veiculos.length === 0 ? (
          <EmptyCard title="Cadastre sua frota" msg="Caminhões, vans e utilitários que transportam material entre o depósito e o evento. Defina capacidade, motorista e status." cta="+ Adicionar veículo" onCta={onNovoVeiculo} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {veiculos.map((v) => {
              const meta = frotaStatusMeta(v.status);
              return (
                <div key={v.id} className="rounded-xl border border-black/[0.06] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onEditarVeiculo(v)} className="min-w-0 text-left">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-ink"><IcoTruck /> {v.nome}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{FROTA_TIPOS.find((t) => t.v === v.tipo)?.label || v.tipo}{v.placa ? ` · ${v.placa}` : ''}</p>
                    </button>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${meta.chip}`}>{meta.label}</span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-ink-soft">
                    {v.capacidade != null && <p>Capacidade: {formatNumber(v.capacidade)} {v.capacidade_unidade}</p>}
                    {v.motorista && <p className="truncate">Motorista: {v.motorista}{v.motorista_contato ? ` · ${v.motorista_contato}` : ''}</p>}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <select value={v.status} onChange={(e) => onStatusVeiculo(v, e.target.value)} className="rounded-lg border border-black/10 px-2 py-1 text-xs">
                      {['disponivel', 'em_viagem', 'manutencao', 'inativo'].map((s) => <option key={s} value={s}>{frotaStatusMeta(s).label}</option>)}
                    </select>
                    <button onClick={() => onNovaViagem({ frota_id: v.id })} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">+ Viagem</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Viagens / roteiros */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-ink">Roteiros de transporte</h3>
            <p className="text-xs text-ink-muted">Viagens de material. Vermelho = veículo em duas viagens ao mesmo tempo.</p>
          </div>
          <button onClick={() => onNovaViagem()} disabled={veiculos.length === 0} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand disabled:opacity-40">+ Viagem</button>
        </div>
        {viagensOrdenadas.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Nenhuma viagem planejada.</p> : (
          <div className="space-y-2">
            {viagensOrdenadas.map((vi) => {
              const v = veiculoById.get(vi.frota_id);
              const meta = viagemStatusMeta(vi.status);
              const bad = emConflito.has(vi.id);
              return (
                <div key={vi.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${bad ? 'border-red-300 bg-red-50/50 ring-1 ring-red-200' : 'border-black/[0.06]'}`}>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{v?.nome || 'Veículo'} · {[vi.origem, vi.destino].filter(Boolean).join(' → ') || 'rota não definida'}{bad && <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-600"><IcoAlert /> conflito</span>}</p>
                    <p className="truncate text-xs text-ink-muted">{vi.partida ? formatDateTime(vi.partida) : '—'}{vi.retorno ? ` → ${formatDateTime(vi.retorno)}` : ''}{vi.carga ? ` · ${vi.carga}` : ''}{vi.evento_id ? ` · ${eventoNome(vi.evento_id)}` : ''}</p>
                  </div>
                  <button onClick={() => onEditarViagem(vi)} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Editar</button>
                  <button onClick={() => onExcluirViagem(vi)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${confirmKey === `delvi:${vi.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `delvi:${vi.id}` ? 'Confirmar?' : 'Excluir'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════ MODAIS ═══════════════════════════════════════════
function JanelaModal({ userId: _userId, editing, preset, eventos, espacos, propriedades, eventoById, onClose, onSaved }: {
  userId: string; editing: Janela | null; preset?: Partial<Janela>; eventos: EventoLite[]; espacos: EspacoLite[]; propriedades: PropriedadeLite[]; eventoById: Map<string, EventoLite>;
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const base: Partial<Janela> = editing || preset || {};
  const [eventoId, setEventoId] = useState(base.evento_id || '');
  const [propriedadeId, setPropriedadeId] = useState<string>(base.propriedade_id != null ? String(base.propriedade_id) : (propriedades.length === 1 ? String(propriedades[0].id) : ''));
  const [espacoId, setEspacoId] = useState<string>(base.espaco_id != null ? String(base.espaco_id) : '');
  const [tipo, setTipo] = useState<JanelaTipo | string>(base.tipo || 'montagem');
  const [titulo, setTitulo] = useState(base.titulo || '');
  const [inicio, setInicio] = useState(isoToLocalInput(base.inicio));
  const [fim, setFim] = useState(isoToLocalInput(base.fim));
  const [obs, setObs] = useState(base.obs || '');
  const [saving, setSaving] = useState(false);
  const [conflito, setConflito] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Ao escolher evento, herda propriedade e sugere datas de montagem (véspera).
  function aoEscolherEvento(id: string) {
    setEventoId(id);
    const ev = id ? eventoById.get(id) : null;
    if (ev?.propriedade_id != null) setPropriedadeId(String(ev.propriedade_id));
    if (ev?.data_inicio && !inicio) {
      const vespera = addDaysYmd(ev.data_inicio.slice(0, 10), -1);
      setInicio(isoToLocalInput(ymdHmToISO(vespera, '08:00')));
      setFim(isoToLocalInput(ymdHmToISO(vespera, '18:00')));
    }
  }

  const espacosProp = espacos.filter((e) => (propriedadeId ? Number(e.propriedade_id) === Number(propriedadeId) : true) && e.ativo !== false);

  async function salvar(force: boolean) {
    if (!propriedadeId) { toast.error('Selecione a propriedade.'); return; }
    const iniISO = localInputToISO(inicio), fimISO = localInputToISO(fim);
    if (!iniISO || !fimISO) { toast.error('Defina início e fim da janela.'); return; }
    if (Date.parse(fimISO) <= Date.parse(iniISO)) { toast.error('O fim deve ser depois do início.'); return; }
    setSaving(true);
    const body = {
      id: editing?.id, evento_id: eventoId || null, propriedade_id: Number(propriedadeId),
      espaco_id: espacoId ? Number(espacoId) : null, tipo, titulo: titulo.trim() || null,
      inicio: iniISO, fim: fimISO, obs: obs.trim() || null, force,
    };
    const res = await fetch('/api/logistica', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.status === 409) { setConflito(true); toast.error('O espaço já está ocupado nesse período. Você pode bloquear mesmo assim.'); return; }
    if (!res.ok) { toast.error(json.error || 'Não foi possível salvar a janela.'); return; }
    toast.success(editing ? 'Janela atualizada — agenda sincronizada.' : 'Janela criada — espaço bloqueado na agenda.'); onSaved();
  }

  return (
    <Modal onClose={onClose} title={editing ? 'Editar janela' : 'Nova janela física'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo">
            <select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{JANELA_TIPOS.map((t) => <option key={t} value={t}>{janelaTipoMeta(t).label}</option>)}</select>
          </Campo>
          <Campo label="Evento (opcional)">
            <select className={inp} value={eventoId} onChange={(e) => aoEscolherEvento(e.target.value)}><option value="">Sem evento</option>{eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}</select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Propriedade">
            <select className={inp} value={propriedadeId} onChange={(e) => { setPropriedadeId(e.target.value); setEspacoId(''); }}>
              <option value="">Selecione…</option>
              {propriedades.map((p) => <option key={p.id} value={p.id}>{propriedadeLabel(p)}</option>)}
            </select>
          </Campo>
          <Campo label="Espaço (vazio = local todo)">
            <select className={inp} value={espacoId} onChange={(e) => setEspacoId(e.target.value)}>
              <option value="">Propriedade inteira</option>
              {espacosProp.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Título (opcional)"><input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Montagem da estrutura, Desmontagem do palco" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Início"><input type="datetime-local" className={inp} value={inicio} onChange={(e) => { setInicio(e.target.value); setConflito(false); }} /></Campo>
          <Campo label="Fim"><input type="datetime-local" className={inp} value={fim} onChange={(e) => { setFim(e.target.value); setConflito(false); }} /></Campo>
        </div>
        <Campo label="Observações"><textarea className={`${inp} min-h-[60px] resize-y`} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Equipe, acessos, restrições…" /></Campo>
        <p className="flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700"><IcoLock /> Esta janela cria um bloqueio no Calendário/Reservas para o período — o espaço fica indisponível para locação.</p>
      </div>
      <div className="mt-6 flex items-center gap-3">
        {conflito
          ? <button onClick={() => salvar(true)} disabled={saving} className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Bloquear mesmo assim'}</button>
          : <button onClick={() => salvar(false)} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar janela'}</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function ChegadaModal({ userId, editing, preset, eventos, fornecedores, onClose, onSaved }: {
  userId: string; editing: Chegada | null; preset?: Partial<Chegada>; eventos: EventoLite[]; fornecedores: FornecedorLite[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const base: Partial<Chegada> = editing || preset || {};
  const [eventoId, setEventoId] = useState(base.evento_id || '');
  const [fornecedorId, setFornecedorId] = useState(base.fornecedor_id || '');
  const [item, setItem] = useState(base.item || '');
  const [previsto, setPrevisto] = useState(isoToLocalInput(base.previsto));
  const [duracao, setDuracao] = useState(String(base.duracao_min ?? 30));
  const [doca, setDoca] = useState(base.doca || '');
  const [veiculo, setVeiculo] = useState(base.veiculo || '');
  const [placa, setPlaca] = useState(base.placa || '');
  const [responsavel, setResponsavel] = useState(base.responsavel || '');
  const [contato, setContato] = useState(base.contato || '');
  const [checklistTxt, setChecklistTxt] = useState((base.checklist || []).map((i) => i.label).join('\n'));
  const [obs, setObs] = useState(base.obs || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!item.trim()) { toast.error('Descreva o que será entregue.'); return; }
    setSaving(true);
    const existentes = new Map((editing?.checklist || []).map((i) => [i.label, i.ok]));
    const checklist: ChecklistItem[] = checklistTxt.split('\n').map((s) => s.trim()).filter(Boolean).map((label) => ({ label, ok: existentes.get(label) ?? false }));
    const payload = {
      usuario_id: userId, evento_id: eventoId || null, fornecedor_id: fornecedorId || null, item: item.trim(),
      previsto: localInputToISO(previsto), duracao_min: Math.max(5, Math.floor(Number(duracao) || 30)),
      doca: doca.trim() || null, veiculo: veiculo.trim() || null, placa: placa.trim() || null,
      responsavel: responsavel.trim() || null, contato: contato.trim() || null, checklist, obs: obs.trim() || null,
    };
    const res = editing
      ? await sb.from('logistica_chegadas').update(payload).eq('id', editing.id)
      : await sb.from('logistica_chegadas').insert(payload);
    setSaving(false);
    if (res.error) { toast.error('Erro ao salvar a chegada.'); return; }
    toast.success(editing ? 'Chegada atualizada!' : 'Chegada agendada!'); onSaved();
  }

  return (
    <Modal onClose={onClose} title={editing ? 'Editar chegada' : 'Agendar chegada de fornecedor'}>
      <div className="space-y-4">
        <Campo label="O que chega"><input className={inp} value={item} onChange={(e) => setItem(e.target.value)} autoFocus placeholder="Ex: Estrutura de palco, Buffet, Som & iluminação" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Fornecedor">
            <select className={inp} value={fornecedorId} onChange={(e) => { setFornecedorId(e.target.value); const f = fornecedores.find((x) => x.id === e.target.value); if (f && !contato) setContato(fornecedorContato(f)); }}>
              <option value="">{fornecedores.length ? 'Selecione…' : 'Cadastre em /painel/fornecedores'}</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{fornecedorLabel(f)}</option>)}
            </select>
          </Campo>
          <Campo label="Evento"><select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">Sem evento</option>{eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="Previsto"><input type="datetime-local" className={inp} value={previsto} onChange={(e) => setPrevisto(e.target.value)} /></Campo>
          <Campo label="Descarga (min)"><input type="number" min={5} step={5} className={inp} value={duracao} onChange={(e) => setDuracao(e.target.value)} /></Campo>
          <Campo label="Doca / portão"><input className={inp} value={doca} onChange={(e) => setDoca(e.target.value)} placeholder="Ex: Doca 1" /></Campo>
          <Campo label="Responsável"><input className={inp} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem recebe" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Campo label="Veículo"><input className={inp} value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Ex: Caminhão baú" /></Campo>
          <Campo label="Placa"><input className={inp} value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-1D23" /></Campo>
          <Campo label="Contato"><input className={inp} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Telefone do motorista" /></Campo>
        </div>
        <Campo label="Checklist de recebimento (um por linha)"><textarea className={`${inp} min-h-[64px] resize-y`} value={checklistTxt} onChange={(e) => setChecklistTxt(e.target.value)} placeholder={'Conferir quantidade\nVerificar avarias\nAssinar nota'} /></Campo>
        <Campo label="Observações"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Acesso, restrições de horário…" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !item.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Agendar chegada'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function VeiculoModal({ userId, editing, onClose, onSaved }: { userId: string; editing: Veiculo | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(editing?.nome || '');
  const [tipo, setTipo] = useState(editing?.tipo || 'caminhao');
  const [placa, setPlaca] = useState(editing?.placa || '');
  const [capacidade, setCapacidade] = useState(editing?.capacidade != null ? String(editing.capacidade) : '');
  const [unidade, setUnidade] = useState(editing?.capacidade_unidade || 'kg');
  const [motorista, setMotorista] = useState(editing?.motorista || '');
  const [motoristaContato, setMotoristaContato] = useState(editing?.motorista_contato || '');
  const [status, setStatus] = useState(editing?.status || 'disponivel');
  const [obs, setObs] = useState(editing?.obs || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome ao veículo.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId, nome: nome.trim(), tipo, placa: placa.trim() || null,
      capacidade: capacidade ? Number(capacidade) : null, capacidade_unidade: unidade.trim() || 'kg',
      motorista: motorista.trim() || null, motorista_contato: motoristaContato.trim() || null, status, obs: obs.trim() || null,
    };
    const res = editing ? await sb.from('frota').update(payload).eq('id', editing.id) : await sb.from('frota').insert(payload);
    setSaving(false);
    if (res.error) { toast.error('Erro ao salvar o veículo.'); return; }
    toast.success(editing ? 'Veículo atualizado!' : 'Veículo cadastrado!'); onSaved();
  }

  async function excluir() {
    if (!editing) return;
    const res = await sb.from('frota').delete().eq('id', editing.id);
    if (res.error) { toast.error('Há viagens vinculadas — exclua-as antes ou marque como inativo.'); return; }
    toast.success('Veículo removido.'); onSaved();
  }

  return (
    <Modal onClose={onClose} title={editing ? 'Editar veículo' : 'Novo veículo'}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_140px] gap-4">
          <Campo label="Nome / identificação"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Caminhão 1" /></Campo>
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{FROTA_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="Placa"><input className={inp} value={placa} onChange={(e) => setPlaca(e.target.value)} /></Campo>
          <Campo label="Capacidade"><input type="number" min={0} className={inp} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} /></Campo>
          <Campo label="Unidade"><select className={inp} value={unidade} onChange={(e) => setUnidade(e.target.value)}>{['kg', 'm3', 'lugares', 'un'].map((u) => <option key={u} value={u}>{u}</option>)}</select></Campo>
          <Campo label="Status"><select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{['disponivel', 'em_viagem', 'manutencao', 'inativo'].map((s) => <option key={s} value={s}>{frotaStatusMeta(s).label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Motorista"><input className={inp} value={motorista} onChange={(e) => setMotorista(e.target.value)} /></Campo>
          <Campo label="Contato do motorista"><input className={inp} value={motoristaContato} onChange={(e) => setMotoristaContato(e.target.value)} /></Campo>
        </div>
        <Campo label="Observações"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editing ? 'Salvar' : 'Cadastrar'}</button>
        {editing && <button onClick={excluir} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50">Excluir</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function ViagemModal({ userId, editing, preset, veiculos, eventos, onClose, onSaved }: {
  userId: string; editing: Viagem | null; preset?: Partial<Viagem>; veiculos: Veiculo[]; eventos: EventoLite[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const base: Partial<Viagem> = editing || preset || {};
  const [frotaId, setFrotaId] = useState(base.frota_id || (veiculos[0]?.id ?? ''));
  const [eventoId, setEventoId] = useState(base.evento_id || '');
  const [origem, setOrigem] = useState(base.origem || '');
  const [destino, setDestino] = useState(base.destino || '');
  const [partida, setPartida] = useState(isoToLocalInput(base.partida));
  const [retorno, setRetorno] = useState(isoToLocalInput(base.retorno));
  const [carga, setCarga] = useState(base.carga || '');
  const [status, setStatus] = useState(base.status || 'planejada');
  const [obs, setObs] = useState(base.obs || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!frotaId) { toast.error('Escolha o veículo.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId, frota_id: frotaId, evento_id: eventoId || null,
      origem: origem.trim() || null, destino: destino.trim() || null,
      partida: localInputToISO(partida), retorno: localInputToISO(retorno),
      carga: carga.trim() || null, status, obs: obs.trim() || null,
    };
    const res = editing ? await sb.from('frota_viagens').update(payload).eq('id', editing.id) : await sb.from('frota_viagens').insert(payload);
    setSaving(false);
    if (res.error) { toast.error('Erro ao salvar a viagem.'); return; }
    toast.success(editing ? 'Viagem atualizada!' : 'Viagem planejada!'); onSaved();
  }

  return (
    <Modal onClose={onClose} title={editing ? 'Editar viagem' : 'Nova viagem'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Veículo"><select className={inp} value={frotaId} onChange={(e) => setFrotaId(e.target.value)}><option value="">Selecione…</option>{veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></Campo>
          <Campo label="Evento (opcional)"><select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">Sem evento</option>{eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Origem"><input className={inp} value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex: Depósito" /></Campo>
          <Campo label="Destino"><input className={inp} value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex: Local do evento" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Partida"><input type="datetime-local" className={inp} value={partida} onChange={(e) => setPartida(e.target.value)} /></Campo>
          <Campo label="Retorno (opcional)"><input type="datetime-local" className={inp} value={retorno} onChange={(e) => setRetorno(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-[1fr_160px] gap-4">
          <Campo label="Carga"><input className={inp} value={carga} onChange={(e) => setCarga(e.target.value)} placeholder="O que transporta" /></Campo>
          <Campo label="Status"><select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{['planejada', 'em_curso', 'concluida', 'cancelada'].map((s) => <option key={s} value={s}>{viagemStatusMeta(s).label}</option>)}</select></Campo>
        </div>
        <Campo label="Observações"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !frotaId} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editing ? 'Salvar' : 'Planejar viagem'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function CredencialModal({ chegada, fornecedor, eventoNome, onClose }: { chegada: Chegada; fornecedor: FornecedorLite | null; eventoNome: (id: string | null) => string; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);
  const codigo = credencialVeiculo(chegada);
  return (
    <Modal onClose={onClose} title="Credencial de veículo">
      <div id="credencial-print" className="rounded-2xl border-2 border-dashed border-brand/40 bg-gradient-to-br from-brand-50 to-white p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold italic text-brand">VENTSY</span>
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">ACESSO FORNECEDOR</span>
        </div>
        <div className="mt-4 text-center">
          <p className="text-[0.7rem] uppercase tracking-widest text-ink-muted">Credencial</p>
          <p className="font-mono text-3xl font-black tracking-wider text-ink">{codigo}</p>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <Linha k="Fornecedor" v={fornecedorLabel(fornecedor)} />
          <Linha k="Entrega" v={chegada.item} />
          <Linha k="Evento" v={eventoNome(chegada.evento_id)} />
          <Linha k="Previsto" v={chegada.previsto ? formatDateTime(chegada.previsto) : '—'} />
          <Linha k="Doca / portão" v={chegada.doca || '—'} />
          <Linha k="Veículo" v={[chegada.veiculo, chegada.placa].filter(Boolean).join(' · ') || '—'} />
          <Linha k="Responsável" v={chegada.responsavel || '—'} />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><IcoPrint /> Imprimir</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Fechar</button>
      </div>
    </Modal>
  );
}
function Linha({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 border-b border-black/[0.05] pb-1"><span className="text-ink-muted">{k}</span><span className="text-right font-semibold text-ink">{v}</span></div>;
}

// ══════════════════════════ UI helpers ═══════════════════════════════════════
function EmptyLogistica({ onNova }: { onNova: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoTruck size={30} /></div>
      <h2 className="text-lg font-bold text-ink">A logística do seu evento começa aqui</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Programe janelas de montagem e desmontagem (que ocupam o espaço além do evento), a agenda de chegada dos fornecedores, o controle de docas e a frota. Em evento grande, a montagem dura dias.</p>
      <button onClick={onNova} className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Criar primeira janela</button>
    </div>
  );
}
function EmptyCard({ title, msg, cta, onCta }: { title: string; msg: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{msg}</p>
      {cta && onCta && <button onClick={onCta} className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{cta}</button>}
    </div>
  );
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}</label>;
}
function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: 'ink' | 'brand' | 'azul' | 'verde' | 'vermelho'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', brand: 'text-brand', azul: 'text-blue-600', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone];
  const iconBg = { ink: 'bg-black/[0.05] text-ink-soft', brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2"><span className="text-xs text-ink-muted">{label}</span>{icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoTruck = ({ size = 15 }: { size?: number }) => svg(<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />, size);
const IcoCalendar = () => svg(<path d="M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />, 15);
const IcoFlag = () => svg(<path d="M4 21V4M4 4h12l-2 4 2 4H4" />, 15);
const IcoWrench = () => svg(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-2.3 2.5-2.5Z" />, 15);
const IcoAlert = () => svg(<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />, 13);
const IcoRoute = () => svg(<path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a3 3 0 0 1 3-3h6M18 9v6a3 3 0 0 1-3 3H9" />, 15);
const IcoLock = () => svg(<path d="M6 10V8a6 6 0 1 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />, 12);
const IcoClock = () => svg(<path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />, 13);
const IcoDock = () => svg(<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />, 13);
const IcoUser = () => svg(<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />, 13);
const IcoPhone = () => svg(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />, 13);
const IcoBadge = () => svg(<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3 9a3 3 0 0 1 6 0" />, 13);
const IcoPrint = () => svg(<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6Z" />, 15);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);
