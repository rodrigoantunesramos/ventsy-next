'use client';

// Estacionamento & Mobilidade — /painel/estacionamento.
// Gere o estacionamento e a mobilidade do evento: capacidade de VAGAS por SETOR,
// CONTROLE DE ENTRADA/SAÍDA por placa (credenciado não paga), VALET, RECEITA (que
// entra no financeiro do evento) e TRANSFER/SHUTTLE/ÔNIBUS. Vale do salão pequeno
// ao autódromo/feira agro com milhares de carros e ônibus de excursão.
// PILARES (5 abas):
//   • Setores    — vagas por setor, lotação atual × capacidade, tarifa, PCD/idoso.
//   • Pátio      — entrada/saída por placa, tempo de permanência, cobrança.
//   • Valet      — fila, chaves/vaga, ciclo recebido→entregue, comprovante.
//   • Receita    — faturamento por setor, ticket médio, lançar no financeiro.
//   • Mobilidade — transfers/shuttles: rotas, horários, capacidade, fornecedor.
// Engine pura: lib/estacionamento.ts (reusa a lotação de lib/acesso). Movimento
// autoritativo: /api/estacionamento. Receita→caixa: /api/estacionamento/receita.
// Sem "R$" hardcoded — moeda/datas/números via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatPercent, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Setor, type AcessoVeicular, type Transfer,
  SETOR_TIPOS, setorTipoMeta, COBRANCAS, COBRANCA_META,
  TRANSFER_TIPOS, transferTipoMeta, valetStatusMeta, proximoValet,
  calcularTarifa, normalizarPlaca, placaValidaBR, permanenciaMs,
  ocupacaoPorSetor, lotacaoSetor, resumoPatio, resumoReceita, resumoTransfer, picoPatio,
  parseHorarios, proximoHorario, estaNoPatio, LOTACAO_META,
} from '@/lib/estacionamento';
import { type EventoLite, eventoLabel, fmtDuracao, exportAcessosCSV, printValetTicket } from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
type Tab = 'setores' | 'patio' | 'valet' | 'receita' | 'mobilidade';

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}

type FornecedorLite = { id: string; nome: string };
type EntradaArgs = {
  setor_id: string; placa: string; tipo: string; valet: boolean;
  modelo?: string; cor_veiculo?: string; token?: string; pago?: boolean; metodo?: string; obs?: string;
};
type ApiResult = { ok: boolean; json: { error?: string; motivo?: string; aviso?: string; bloqueante?: boolean; data?: AcessoVeicular; valor?: number;[k: string]: unknown } };

// ── Página ────────────────────────────────────────────────────────────────────
export default function EstacionamentoPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('setores');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [eventoSel, setEventoSel] = useState<string>('');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [acessos, setAcessos] = useState<AcessoVeicular[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);

  // relógio (permanência/tarifa ao vivo)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 30000); return () => clearInterval(t); }, []);

  // modais
  const [setorModal, setSetorModal] = useState<{ editing: Setor | null } | null>(null);
  const [transferModal, setTransferModal] = useState<{ editing: Transfer | null } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [lancando, setLancando] = useState(false);

  const evento = useMemo(() => eventos.find((e) => e.id === eventoSel) || null, [eventos, eventoSel]);

  // ── Carregamento ──
  const carregarBase = useCallback(async (uid: string) => {
    const [evRes, stRes, foRes] = await Promise.all([
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,propriedade_id').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('estacionamento_setores').select('*').eq('usuario_id', uid).order('ordem'),
      sb.from('fornecedores').select('id,nome').eq('usuario_id', uid).order('nome'),
    ]);
    if (isMissingTable(stRes.error)) { setNeedsSetup(true); return { evs: [] as EventoLite[] }; }
    setNeedsSetup(false);
    setSetores((stRes.data || []) as Setor[]);
    setFornecedores(foRes.error ? [] : (foRes.data || []) as FornecedorLite[]);
    const evs = (evRes.error ? [] : (evRes.data || [])) as EventoLite[];
    setEventos(evs);
    return { evs };
  }, []);

  const carregarEvento = useCallback(async (uid: string, eventoId: string) => {
    if (!eventoId) { setAcessos([]); setTransfers([]); return; }
    const [acRes, trRes] = await Promise.all([
      sb.from('estacionamento_acessos').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('entrada', { ascending: false, nullsFirst: false }).limit(8000),
      sb.from('transfer').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('criado_em'),
    ]);
    setAcessos(acRes.error ? [] : ((acRes.data || []) as AcessoVeicular[]));
    setTransfers(trRes.error ? [] : ((trRes.data || []) as Transfer[]).map((t) => ({ ...t, horarios: parseHorarios(t.horarios) })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);
      const base = await carregarBase(uid);
      const first = base?.evs?.[0]?.id || '';
      setEventoSel(first);
      if (first) await carregarEvento(uid, first);
      setLoading(false);
    })();
  }, [carregarBase, carregarEvento]);

  const trocarEvento = useCallback(async (id: string) => {
    setEventoSel(id);
    if (userId) { setLoading(true); await carregarEvento(userId, id); setLoading(false); }
  }, [userId, carregarEvento]);

  const refetchEvento = useCallback(() => { if (userId && eventoSel) carregarEvento(userId, eventoSel); }, [userId, eventoSel, carregarEvento]);

  // ── Derivados ──
  const setoresDoEvento = useMemo(() => {
    const pid = evento?.propriedade_id ?? null;
    return setores.filter((s) => s.propriedade_id == null || s.propriedade_id === pid);
  }, [setores, evento]);
  const setorById = useMemo(() => new Map(setoresDoEvento.map((s) => [s.id, s])), [setoresDoEvento]);
  const ocupSetor = useMemo(() => ocupacaoPorSetor(acessos), [acessos]);
  const patio = useMemo(() => resumoPatio(acessos, setoresDoEvento), [acessos, setoresDoEvento]);
  const receita = useMemo(() => resumoReceita(acessos), [acessos]);
  const transferResumo = useMemo(() => resumoTransfer(transfers), [transfers]);
  const pico = useMemo(() => picoPatio(acessos), [acessos]);

  // ── Setores (RLS) ──
  async function salvarSetor(payload: Partial<Setor>, editing: Setor | null): Promise<boolean> {
    if (!userId) return false;
    if (editing) {
      const { error } = await sb.from('estacionamento_setores').update(payload).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar o setor.'); return false; }
      toast.success('Setor atualizado.');
    } else {
      const row = { ...payload, usuario_id: userId, propriedade_id: evento?.propriedade_id ?? null, ordem: setores.length };
      const { error } = await sb.from('estacionamento_setores').insert(row);
      if (error) { toast.error('Não foi possível criar o setor.'); return false; }
      toast.success('Setor criado.');
    }
    if (userId) { const { data } = await sb.from('estacionamento_setores').select('*').eq('usuario_id', userId).order('ordem'); setSetores((data || []) as Setor[]); }
    return true;
  }
  async function removerSetor(s: Setor) {
    const key = `delsetor:${s.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir o setor.'); setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('estacionamento_setores').delete().eq('id', s.id);
    if (error) { toast.error('Não foi possível excluir (há veículos vinculados? desative em vez de excluir).'); return; }
    setSetores((arr) => arr.filter((x) => x.id !== s.id));
    toast.success('Setor removido.');
  }

  // ── Movimento veicular (API autoritativa) ──
  const registrarEntrada = useCallback(async (args: EntradaArgs, force = false): Promise<ApiResult> => {
    try {
      const res = await fetch('/api/estacionamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ acao: 'entrada', evento_id: eventoSel, force, ...args }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) { setAcessos((arr) => [json.data as AcessoVeicular, ...arr]); }
      return { ok: res.ok, json };
    } catch { return { ok: false, json: { aviso: 'Sem conexão — tente novamente.' } }; }
  }, [eventoSel]);

  const registrarSaida = useCallback(async (acesso: AcessoVeicular, pago?: boolean, metodo?: string): Promise<ApiResult> => {
    try {
      const res = await fetch('/api/estacionamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ acao: 'saida', acesso_id: acesso.id, evento_id: eventoSel, pago, metodo }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) setAcessos((arr) => arr.map((a) => (a.id === acesso.id ? json.data as AcessoVeicular : a)));
      return { ok: res.ok, json };
    } catch { return { ok: false, json: { aviso: 'Sem conexão — tente novamente.' } }; }
  }, [eventoSel]);

  // ── Valet / cobrança (RLS) ──
  async function atualizarAcesso(id: string, patch: Partial<AcessoVeicular>) {
    const { error } = await sb.from('estacionamento_acessos').update(patch).eq('id', id);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    setAcessos((arr) => arr.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  // ── Transfer (RLS) ──
  async function salvarTransfer(payload: Partial<Transfer>, editing: Transfer | null): Promise<boolean> {
    if (!userId || !eventoSel) return false;
    if (editing) {
      const { error } = await sb.from('transfer').update(payload).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar a rota.'); return false; }
    } else {
      const { error } = await sb.from('transfer').insert({ ...payload, usuario_id: userId, evento_id: eventoSel });
      if (error) { toast.error('Não foi possível criar a rota.'); return false; }
    }
    toast.success('Rota salva.');
    refetchEvento();
    return true;
  }
  async function removerTransfer(t: Transfer) {
    const { error } = await sb.from('transfer').delete().eq('id', t.id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setTransfers((arr) => arr.filter((x) => x.id !== t.id));
  }

  // ── Receita → caixa (API) ──
  async function lancarReceita() {
    if (!eventoSel || receita.naoLancado <= 0) return;
    setLancando(true);
    try {
      const res = await fetch('/api/estacionamento/receita', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ evento_id: eventoSel }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || 'Falha ao lançar a receita.'); return; }
      if ((json.qtd || 0) === 0) { toast.info('Nenhuma receita nova para lançar.'); return; }
      toast.success(`${formatMoney(json.valor)} lançado(s) no financeiro do evento.`);
      refetchEvento();
    } finally { setLancando(false); }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const semSetores = setoresDoEvento.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Estacionamento & Mobilidade</h1>
          <p className="mt-1 text-sm text-ink-muted">Vagas por setor, controle de entrada/saída por placa, valet, receita e transfers do evento.</p>
        </div>
        {eventos.length > 0 && (
          <label className="flex flex-col">
            <span className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</span>
            <select value={eventoSel} onChange={(e) => trocarEvento(e.target.value)} className={`${selCls} min-w-[220px]`}>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </label>
        )}
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O módulo de estacionamento ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/estacionamento.sql</code> no Supabase para criar <code className="rounded bg-amber-100 px-1 py-0.5">estacionamento_setores</code>, <code className="rounded bg-amber-100 px-1 py-0.5">estacionamento_acessos</code> e <code className="rounded bg-amber-100 px-1 py-0.5">transfer</code>.
        </div>
      )}

      {!needsSetup && eventos.length === 0 ? (
        <EmptyCard title="Nenhum evento ainda" msg="O estacionamento é por evento. Crie um evento em Leads/Clientes para configurar setores, controlar a entrada de veículos e os transfers." />
      ) : !needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="No pátio agora" value={formatNumber(patio.noPatio)} sub={patio.capacidadeTotal ? `de ${formatNumber(patio.capacidadeTotal)} vagas` : 'sem limite'} tone="verde" icon={<IcoCar />} />
            <Kpi label="Ocupação" value={patio.capacidadeTotal ? formatPercent(patio.noPatio / patio.capacidadeTotal) : '—'} sub={`pico ${formatNumber(pico.pico)}`} tone="azul" icon={<IcoGauge />} />
            <Kpi label="Receita paga" value={formatMoneyShort(receita.receita)} sub={`ticket ${formatMoney(receita.ticketMedio)}`} tone="ink" icon={<IcoMoney />} />
            <Kpi label="Transfers" value={formatNumber(transferResumo.rotas)} sub={`${formatNumber(transferResumo.lugares)} lugares`} tone="gold" icon={<IcoRoute />} />
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['setores', 'Setores'], ['patio', 'Pátio'], ['valet', 'Valet'], ['receita', 'Receita'], ['mobilidade', 'Mobilidade']] as [Tab, string][]).map(([k, lab]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}>{lab}</button>
            ))}
          </div>

          {/* ───────────── SETORES ───────────── */}
          {tab === 'setores' && (
            <SetoresTab
              setores={setoresDoEvento} ocup={ocupSetor} confirmKey={confirmKey}
              onNovo={() => setSetorModal({ editing: null })} onEditar={(s) => setSetorModal({ editing: s })} onRemover={removerSetor}
            />
          )}

          {/* ───────────── PÁTIO ───────────── */}
          {tab === 'patio' && (
            <PatioTab
              setores={setoresDoEvento} acessos={acessos} ocup={ocupSetor} nowMs={nowMs} setorById={setorById}
              onEntrada={registrarEntrada} onSaida={registrarSaida}
            />
          )}

          {/* ───────────── VALET ───────────── */}
          {tab === 'valet' && (
            <ValetTab
              acessos={acessos} setorById={setorById} evento={evento} nowMs={nowMs}
              onAtualizar={atualizarAcesso} onSaida={registrarSaida}
            />
          )}

          {/* ───────────── RECEITA ───────────── */}
          {tab === 'receita' && (
            <ReceitaTab
              receita={receita} setores={setoresDoEvento} acessos={acessos} lancando={lancando}
              onLancar={lancarReceita} onExport={() => exportAcessosCSV(acessos, setoresDoEvento, nowMs)}
            />
          )}

          {/* ───────────── MOBILIDADE ───────────── */}
          {tab === 'mobilidade' && (
            <MobilidadeTab
              transfers={transfers} fornecedores={fornecedores} nowMs={nowMs}
              onNovo={() => setTransferModal({ editing: null })} onEditar={(t) => setTransferModal({ editing: t })} onRemover={removerTransfer}
            />
          )}

          {semSetores && tab !== 'setores' && tab !== 'mobilidade' && (
            <p className="mt-4 text-center text-xs text-ink-muted">Crie um setor na aba <b>Setores</b> para começar a registrar veículos.</p>
          )}
        </>
      )}

      {/* Modais */}
      {setorModal && (
        <SetorModal editing={setorModal.editing} onClose={() => setSetorModal(null)} onSave={(p) => salvarSetor(p, setorModal.editing).then((ok) => { if (ok) setSetorModal(null); })} />
      )}
      {transferModal && (
        <TransferModal editing={transferModal.editing} fornecedores={fornecedores} onClose={() => setTransferModal(null)} onSave={(p) => salvarTransfer(p, transferModal.editing).then((ok) => { if (ok) setTransferModal(null); })} />
      )}
    </div>
  );
}

// ════════════════════ SETORES ════════════════════
function SetoresTab({ setores, ocup, confirmKey, onNovo, onEditar, onRemover }: {
  setores: Setor[]; ocup: Record<string, number>; confirmKey: string | null;
  onNovo: () => void; onEditar: (s: Setor) => void; onRemover: (s: Setor) => void;
}) {
  const temPcd = setores.some((s) => s.tipo === 'pcd');
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">Setores & capacidade</h3>
          <p className="text-xs text-ink-muted">Vagas físicas do espaço, reutilizadas entre eventos. A ocupação é do evento selecionado.</p>
        </div>
        <button onClick={onNovo} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Setor</button>
      </div>

      {!temPcd && setores.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          Lembrete de acessibilidade: reserve vagas <b>PCD</b> e <b>Idoso</b> (obrigatórias por lei conforme a capacidade).
        </div>
      )}

      {setores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoCar size={30} /></div>
          <h2 className="text-lg font-bold text-ink">Defina os setores do estacionamento</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Crie setores (Setor A, Valet, Ônibus, PCD…) com capacidade e tarifa. Depois controle a entrada de veículos no Pátio.</p>
          <button onClick={onNovo} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Primeiro setor</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {setores.map((s) => (
            <SetorCard key={s.id} s={s} ocupacao={ocup[s.id] || 0} confirmKey={confirmKey} onEditar={() => onEditar(s)} onRemover={() => onRemover(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetorCard({ s, ocupacao, confirmKey, onEditar, onRemover }: { s: Setor; ocupacao: number; confirmKey: string | null; onEditar: () => void; onRemover: () => void }) {
  const meta = setorTipoMeta(s.tipo);
  const lot = lotacaoSetor(ocupacao, s.capacidade);
  const lm = LOTACAO_META[lot.nivel];
  const isento = s.tipo === 'credenciado' || s.preco_num === 0;
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-card ${!s.ativo ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.cor || meta.hex }} />
            <h4 className="truncate font-bold text-ink">{s.nome}</h4>
          </div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${meta.chip}`}>{meta.label}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEditar} aria-label="Editar setor" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand"><IcoEdit /></button>
          <button onClick={onRemover} aria-label="Remover setor" className={`rounded-lg border p-1.5 ${confirmKey === `delsetor:${s.id}` ? 'border-red-400 bg-red-50 text-red-600' : 'border-black/10 text-ink-muted hover:border-red-300 hover:text-red-500'}`}><IcoTrash /></button>
        </div>
      </div>

      {/* Lotação */}
      <div className="mt-3">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-ink">{formatNumber(ocupacao)}</span>
          <span className="text-xs text-ink-muted">{s.capacidade > 0 ? `de ${formatNumber(s.capacidade)} vagas` : 'sem limite'}</span>
        </div>
        {s.capacidade > 0 && (
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={`h-full rounded-full ${lm.barra}`} style={{ width: `${Math.min(100, Math.round(lot.ratio * 100))}%` }} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5 text-sm">
        <span className="text-ink-muted">{isento ? 'Cortesia' : `${COBRANCA_META[s.cobranca]?.label || s.cobranca}`}</span>
        <span className="font-semibold text-ink">{isento ? '—' : `${formatMoney(s.preco_num)}${s.cobranca !== 'fixo' ? ` /${COBRANCA_META[s.cobranca]?.sufixo}` : ''}`}</span>
      </div>
    </div>
  );
}

// ════════════════════ PÁTIO ════════════════════
function PatioTab({ setores, acessos, ocup, nowMs, setorById, onEntrada, onSaida }: {
  setores: Setor[]; acessos: AcessoVeicular[]; ocup: Record<string, number>; nowMs: number; setorById: Map<string, Setor>;
  onEntrada: (a: EntradaArgs, force?: boolean) => Promise<ApiResult>; onSaida: (a: AcessoVeicular, pago?: boolean, metodo?: string) => Promise<ApiResult>;
}) {
  const toast = useToast();
  const setoresAtivos = setores.filter((s) => s.ativo);
  const [placa, setPlaca] = useState('');
  const [setorId, setSetorId] = useState(setoresAtivos[0]?.id || '');
  const [tipo, setTipo] = useState('carro');
  const [valet, setValet] = useState(false);
  const [modelo, setModelo] = useState('');
  const [token, setToken] = useState('');
  const [pagarAgora, setPagarAgora] = useState(false);
  const [metodo, setMetodo] = useState('Dinheiro');
  const [busy, setBusy] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => { if (!setorId && setoresAtivos[0]) setSetorId(setoresAtivos[0].id); }, [setoresAtivos, setorId]);

  const setor = setorById.get(setorId) || null;
  const tarifaPreview = setor ? calcularTarifa({ setor, credenciado: !!token, entrada: new Date(nowMs).toISOString(), saida: null, nowMs }) : 0;
  const setorLotado = setor && setor.capacidade > 0 && (ocup[setor.id] || 0) >= setor.capacidade;

  const submit = useCallback(async (force = false) => {
    const p = normalizarPlaca(placa);
    if (!p) { toast.error('Informe a placa.'); return; }
    if (!setorId) { toast.error('Escolha um setor.'); return; }
    setBusy(true);
    const r = await onEntrada({ setor_id: setorId, placa: p, tipo, valet, modelo: modelo.trim() || undefined, token: token.trim() || undefined, pago: pagarAgora, metodo }, force);
    setBusy(false);
    if (r.ok) {
      toast.success(`${p} — entrada registrada${r.json.isento ? ' (cortesia)' : ''}.`);
      setPlaca(''); setModelo(''); setToken('');
    } else if (r.json.motivo === 'lotacao' && !force) {
      toast.error(r.json.aviso || 'Setor lotado.');
    } else if (r.json.motivo === 'ja_no_patio') {
      toast.info(r.json.aviso || 'Placa já no pátio.');
    } else {
      toast.error(r.json.aviso || r.json.error || 'Não foi possível registrar a entrada.');
    }
  }, [placa, setorId, tipo, valet, modelo, token, pagarAgora, metodo, onEntrada, toast]);

  const noPatio = useMemo(() => acessos.filter(estaNoPatio), [acessos]);
  const filtrados = useMemo(() => {
    const q = normalizarPlaca(busca);
    return q ? noPatio.filter((a) => normalizarPlaca(a.placa).includes(q)) : noPatio;
  }, [noPatio, busca]);

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
      {/* Registro de entrada */}
      <div className="rounded-2xl bg-white p-5 shadow-card lg:sticky lg:top-4 lg:self-start">
        <h3 className="mb-3 text-base font-bold text-ink">Registrar entrada</h3>
        {setoresAtivos.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum setor ativo. Crie um setor na aba Setores.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Placa</label>
              <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="ABC1D23" autoFocus className={`${inp} font-mono text-lg tracking-widest`} />
              {placa && !placaValidaBR(placa) && <p className="mt-1 text-[0.7rem] text-amber-600">Placa fora do padrão BR — registrada mesmo assim.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Setor</span>
                <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className={inp}>
                  {setoresAtivos.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.capacidade > 0 ? ` (${ocup[s.id] || 0}/${s.capacidade})` : ''}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{SETOR_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
              </label>
            </div>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo / cor (opcional)" className={inp} />
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Credencial / QR (isenta a tarifa)" className={inp} />

            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-black/[0.02] px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={valet} onChange={(e) => setValet(e.target.checked)} /> Valet</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pagarAgora} onChange={(e) => setPagarAgora(e.target.checked)} disabled={tarifaPreview <= 0} /> Cobrar agora</label>
              {pagarAgora && tarifaPreview > 0 && (
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={`${selCls} ml-auto py-1.5`}>
                  {['Dinheiro', 'Pix', 'Cartão'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>

            {/* Tarifa */}
            <div className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
              <span className="text-ink-muted">Tarifa</span>
              <span className="font-semibold text-ink">
                {token ? 'Cortesia (credencial)' : setor?.tipo === 'credenciado' ? 'Cortesia' : setor?.cobranca === 'fixo' ? formatMoney(tarifaPreview) : `${formatMoney(setor?.preco_num || 0)} /${COBRANCA_META[setor?.cobranca || 'fixo']?.sufixo} (calc. na saída)`}
              </span>
            </div>

            {setorLotado ? (
              <button onClick={() => submit(true)} disabled={busy} className="w-full rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">Setor lotado — forçar entrada</button>
            ) : (
              <button onClick={() => submit(false)} disabled={busy || !placa.trim()} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy ? 'Registrando…' : 'Registrar entrada'}</button>
            )}
          </div>
        )}
      </div>

      {/* Veículos no pátio */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink">No pátio <span className="text-ink-muted">({formatNumber(noPatio.length)})</span></h3>
          <div className="relative min-w-[160px]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar placa…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none" />
          </div>
        </div>
        {noPatio.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhum veículo no pátio. Registre uma entrada ao lado.</p>
        ) : filtrados.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhuma placa corresponde à busca.</p>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {filtrados.map((a) => <AcessoRow key={a.id} a={a} setor={a.setor_id ? setorById.get(a.setor_id) || null : null} nowMs={nowMs} onSaida={onSaida} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AcessoRow({ a, setor, nowMs, onSaida }: { a: AcessoVeicular; setor: Setor | null; nowMs: number; onSaida: (a: AcessoVeicular, pago?: boolean, metodo?: string) => Promise<ApiResult> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const meta = setorTipoMeta(a.tipo);
  const perm = permanenciaMs(a, nowMs);
  const tarifaAtual = setor ? calcularTarifa({ setor, credenciado: !!a.credencial_id, entrada: a.entrada, saida: null, nowMs }) : a.valor_num;

  const sair = async (cobrar: boolean) => {
    setBusy(true);
    const r = await onSaida(a, cobrar || a.pago, a.metodo || 'Dinheiro');
    setBusy(false);
    if (r.ok) toast.success(`${a.placa} — saída registrada${(r.json.valor || 0) > 0 ? ` · ${formatMoney(r.json.valor)}` : ''}.`);
    else toast.error(r.json.aviso || 'Não foi possível registrar a saída.');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold tracking-wider text-ink">{a.placa || '—'}</span>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${meta.chip}`}>{meta.label}</span>
          {a.valet && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700">Valet</span>}
          {a.credencial_id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">Cortesia</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
          {setor && <span>{setor.nome}</span>}
          {a.entrada && <span>entrada {formatDateTime(a.entrada)}</span>}
          <span className="font-medium text-ink-soft">{fmtDuracao(perm)}</span>
        </div>
      </div>
      <div className="text-right">
        {tarifaAtual > 0 && <div className={`text-sm font-semibold ${a.pago ? 'text-emerald-600' : 'text-ink'}`}>{formatMoney(tarifaAtual)}{a.pago ? ' ✓' : ''}</div>}
        <div className="mt-1 flex justify-end gap-1.5">
          {!a.pago && tarifaAtual > 0 && <button onClick={() => sair(true)} disabled={busy} className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Cobrar + saída</button>}
          <button onClick={() => sair(false)} disabled={busy} className="rounded-lg bg-ink px-3 py-1 text-xs font-semibold text-white hover:bg-ink-soft disabled:opacity-50">Saída</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════ VALET ════════════════════
function ValetTab({ acessos, setorById, evento, nowMs, onAtualizar, onSaida }: {
  acessos: AcessoVeicular[]; setorById: Map<string, Setor>; evento: EventoLite | null; nowMs: number;
  onAtualizar: (id: string, patch: Partial<AcessoVeicular>) => void; onSaida: (a: AcessoVeicular, pago?: boolean, metodo?: string) => Promise<ApiResult>;
}) {
  const toast = useToast();
  const valets = useMemo(() => acessos.filter((a) => a.valet && a.status !== 'saiu'), [acessos]);
  const fila = valets.filter((a) => a.valet_status === 'solicitado');

  return (
    <div className="mt-5 space-y-4">
      {fila.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-card">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800"><IcoBell /> Fila de retirada ({formatNumber(fila.length)})</h3>
          <div className="flex flex-wrap gap-2">
            {fila.map((a) => <span key={a.id} className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-bold text-ink shadow-sm">{a.placa}{a.valet_local ? ` · ${a.valet_local}` : ''}</span>)}
          </div>
        </div>
      )}

      {valets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoKey size={28} /></div>
          <h2 className="text-lg font-bold text-ink">Nenhum veículo no valet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Marque <b>Valet</b> ao registrar a entrada no Pátio. Aqui você acompanha a chave/vaga, chama o veículo e imprime o comprovante.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {valets.map((a) => (
            <ValetCard key={a.id} a={a} setor={a.setor_id ? setorById.get(a.setor_id) || null : null} eventoNome={eventoLabel(evento)} nowMs={nowMs}
              onAvancar={() => { const prox = proximoValet(a.valet_status); if (prox) onAtualizar(a.id, { valet_status: prox }); }}
              onLocal={(local) => onAtualizar(a.id, { valet_local: local })}
              onEntregar={async () => { const r = await onSaida(a, a.pago, a.metodo || 'Dinheiro'); if (r.ok) toast.success(`${a.placa} entregue.`); else toast.error('Não foi possível entregar.'); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ValetCard({ a, setor, eventoNome, nowMs, onAvancar, onLocal, onEntregar }: {
  a: AcessoVeicular; setor: Setor | null; eventoNome: string; nowMs: number;
  onAvancar: () => void; onLocal: (local: string) => void; onEntregar: () => void;
}) {
  const [local, setLocal] = useState(a.valet_local || '');
  const vm = valetStatusMeta(a.valet_status);
  const prox = proximoValet(a.valet_status);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-lg font-bold tracking-wider text-ink">{a.placa}</div>
          {a.modelo && <div className="text-xs text-ink-muted">{a.modelo}{a.cor_veiculo ? ` · ${a.cor_veiculo}` : ''}</div>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${vm.chip}`}>{vm.label}</span>
      </div>
      <div className="mt-2 text-xs text-ink-muted">{setor?.nome || '—'} · {fmtDuracao(permanenciaMs(a, nowMs))}</div>

      <div className="mt-3 flex gap-2">
        <input value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => { if (local !== (a.valet_local || '')) onLocal(local.trim()); }}
          placeholder="Vaga / chave (ex.: G2-14)" className="min-w-0 flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <button onClick={() => printValetTicket({ ...a, valet_local: local }, setor?.nome || '', eventoNome)} aria-label="Imprimir comprovante" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand"><IcoPrint /></button>
      </div>

      <div className="mt-3 flex gap-2">
        {prox && prox !== 'entregue' && <button onClick={onAvancar} className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">→ {valetStatusMeta(prox).label}</button>}
        <button onClick={onEntregar} className="flex-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">Entregar (saída)</button>
      </div>
    </div>
  );
}

// ════════════════════ RECEITA ════════════════════
function ReceitaTab({ receita, setores, acessos, lancando, onLancar, onExport }: {
  receita: ReturnType<typeof resumoReceita>; setores: Setor[]; acessos: AcessoVeicular[]; lancando: boolean;
  onLancar: () => void; onExport: () => void;
}) {
  const setorById = new Map(setores.map((s) => [s.id, s]));
  const porSetor = Object.entries(receita.porSetor)
    .map(([id, v]) => ({ id, nome: setorById.get(id)?.nome || '—', ...v }))
    .sort((a, b) => b.receita - a.receita);
  const maxSetor = Math.max(1, ...porSetor.map((s) => s.receita));
  const porMetodo = Object.entries(receita.porMetodo).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-5 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receita paga" value={formatMoney(receita.receita)} sub={`${formatNumber(receita.pagos)} pagos`} tone="verde" icon={<IcoMoney />} />
        <Kpi label="Ticket médio" value={formatMoney(receita.ticketMedio)} sub="por veículo pago" tone="ink" icon={<IcoGauge />} />
        <Kpi label="A receber" value={formatMoney(receita.pendente)} sub="saíram sem pagar" tone={receita.pendente > 0 ? 'amber' : 'ink'} icon={<IcoClock />} />
        <Kpi label="Cortesias" value={formatNumber(receita.isentos)} sub="credenciados" tone="azul" icon={<IcoCheck />} />
      </div>

      {/* Lançar no financeiro */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-card">
        <div>
          <h3 className="text-base font-bold text-ink">Receita no financeiro do evento</h3>
          <p className="text-xs text-ink-muted">Envia a receita paga ainda não conciliada como um único lançamento no caixa (Financeiro).</p>
        </div>
        <div className="flex items-center gap-3">
          {receita.naoLancado > 0 && <span className="text-sm font-semibold text-brand">{formatMoney(receita.naoLancado)} a lançar</span>}
          <button onClick={onLancar} disabled={lancando || receita.naoLancado <= 0} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{lancando ? 'Lançando…' : 'Lançar no financeiro'}</button>
          <button onClick={onExport} disabled={acessos.length === 0} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand disabled:opacity-50"><IcoDownload /> CSV</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Por setor */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold text-ink">Por setor</h3>
          {porSetor.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Sem receita registrada ainda.</p> : (
            <div className="space-y-2.5">
              {porSetor.map((s) => (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{s.nome} <span className="text-ink-muted">· {formatNumber(s.qtd)}</span></span>
                    <span className="font-semibold text-ink">{formatMoney(s.receita)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((s.receita / maxSetor) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por método */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold text-ink">Por método de pagamento</h3>
          {porMetodo.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Sem pagamentos registrados.</p> : (
            <div className="space-y-2">
              {porMetodo.map(([m, v]) => (
                <div key={m} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
                  <span className="text-ink-soft">{m}</span>
                  <span className="font-semibold text-ink">{formatMoney(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════ MOBILIDADE ════════════════════
function MobilidadeTab({ transfers, fornecedores, nowMs, onNovo, onEditar, onRemover }: {
  transfers: Transfer[]; fornecedores: FornecedorLite[]; nowMs: number;
  onNovo: () => void; onEditar: (t: Transfer) => void; onRemover: (t: Transfer) => void;
}) {
  const fornById = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const d = new Date(nowMs);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">Transfers & shuttles</h3>
          <p className="text-xs text-ink-muted">Rotas de transporte (vans, ônibus de excursão, shuttle) com horários, capacidade e ponto de embarque.</p>
        </div>
        <button onClick={onNovo} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Rota</button>
      </div>

      {transfers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoRoute size={28} /></div>
          <h2 className="text-lg font-bold text-ink">Nenhuma rota de transfer</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Cadastre shuttles e ônibus (hotel ↔ evento, estacionamento remoto ↔ portaria) com horários e capacidade.</p>
          <button onClick={onNovo} className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Primeira rota</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {transfers.map((t) => {
            const meta = transferTipoMeta(t.tipo);
            const prox = proximoHorario(t.horarios, nowMin);
            return (
              <div key={t.id} className={`rounded-2xl bg-white p-4 shadow-card ${!t.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${meta.chip}`}>{meta.label}</span>
                    <h4 className="mt-1 truncate font-bold text-ink">{t.rota || '—'}</h4>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => onEditar(t)} aria-label="Editar rota" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => onRemover(t)} aria-label="Remover rota" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-red-300 hover:text-red-500"><IcoTrash /></button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.horarios.length === 0 ? <span className="text-xs text-ink-muted">Sem horários</span> : t.horarios.map((h) => (
                    <span key={h} className={`rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium ${h === prox ? 'bg-brand text-white' : 'bg-black/[0.05] text-ink-soft'}`}>{h}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5 text-xs text-ink-muted">
                  <span>{formatNumber(t.capacidade)} lugares</span>
                  {t.fornecedor_id && fornById.get(t.fornecedor_id) && <span className="truncate">{fornById.get(t.fornecedor_id)}</span>}
                </div>
                {(t.ponto_embarque || t.motorista) && (
                  <div className="mt-1 text-xs text-ink-muted">
                    {t.ponto_embarque && <div>📍 {t.ponto_embarque}</div>}
                    {t.motorista && <div>{t.motorista}{t.contato ? ` · ${t.contato}` : ''}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════ MODAIS ════════════════════
function ModalShell({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.05]"><IcoX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SetorModal({ editing, onClose, onSave }: { editing: Setor | null; onClose: () => void; onSave: (p: Partial<Setor>) => void }) {
  const [nome, setNome] = useState(editing?.nome || '');
  const [tipo, setTipo] = useState<string>(editing?.tipo || 'carro');
  const [capacidade, setCapacidade] = useState(String(editing?.capacidade ?? ''));
  const [preco, setPreco] = useState(editing ? String(editing.preco_num) : '');
  const [cobranca, setCobranca] = useState<string>(editing?.cobranca || 'fixo');
  const [cor, setCor] = useState(editing?.cor || setorTipoMeta(editing?.tipo || 'carro').hex);
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const cortesia = tipo === 'credenciado';

  const submit = () => {
    if (!nome.trim()) return;
    onSave({
      nome: nome.trim(), tipo, capacidade: Number(capacidade) || 0,
      preco_num: cortesia ? 0 : (Number(String(preco).replace(',', '.')) || 0),
      cobranca, cor, ativo,
    });
  };

  return (
    <ModalShell title={editing ? 'Editar setor' : 'Novo setor'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Setor A, Valet, Ônibus, PCD…" className={inp} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value); setCor(setorTipoMeta(e.target.value).hex); }} className={inp}>{SETOR_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Capacidade</span>
            <input value={capacidade} onChange={(e) => setCapacidade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0 = sem limite" className={inp} />
          </label>
        </div>
        {!cortesia ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tarifa</span>
              <input value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0,00" className={inp} />
            </label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Cobrança</span>
              <select value={cobranca} onChange={(e) => setCobranca(e.target.value)} className={inp}>{COBRANCAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
            </label>
          </div>
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Setor de cortesia: veículos credenciados não pagam.</p>
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-ink-soft">Cor</span><input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-black/10" aria-label="Cor do setor" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={submit} disabled={!nome.trim()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{editing ? 'Salvar' : 'Criar setor'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function TransferModal({ editing, fornecedores, onClose, onSave }: { editing: Transfer | null; fornecedores: FornecedorLite[]; onClose: () => void; onSave: (p: Partial<Transfer>) => void }) {
  const [tipo, setTipo] = useState<string>(editing?.tipo || 'shuttle');
  const [rota, setRota] = useState(editing?.rota || '');
  const [horariosTxt, setHorariosTxt] = useState((editing?.horarios || []).join(', '));
  const [capacidade, setCapacidade] = useState(String(editing?.capacidade ?? ''));
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id || '');
  const [motorista, setMotorista] = useState(editing?.motorista || '');
  const [contato, setContato] = useState(editing?.contato || '');
  const [veiculo, setVeiculo] = useState(editing?.veiculo || '');
  const [ponto, setPonto] = useState(editing?.ponto_embarque || '');
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);

  const submit = () => {
    if (!rota.trim()) return;
    onSave({
      tipo, rota: rota.trim(), horarios: parseHorarios(horariosTxt), capacidade: Number(capacidade) || 0,
      fornecedor_id: fornecedorId || null, motorista: motorista.trim() || null, contato: contato.trim() || null,
      veiculo: veiculo.trim() || null, ponto_embarque: ponto.trim() || null, ativo,
    });
  };

  return (
    <ModalShell title={editing ? 'Editar rota' : 'Nova rota de transfer'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{TRANSFER_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Capacidade (lugares)</span>
            <input value={capacidade} onChange={(e) => setCapacidade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" className={inp} />
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Rota *</span>
          <input value={rota} onChange={(e) => setRota(e.target.value)} placeholder="Hotel Central ↔ Arena" className={inp} autoFocus />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Horários</span>
          <input value={horariosTxt} onChange={(e) => setHorariosTxt(e.target.value)} placeholder="08:00, 12:00, 18:00" className={inp} />
          <span className="mt-1 block text-[0.7rem] text-ink-muted">Separe por vírgula. Formato 24h (HH:MM).</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Ponto de embarque</span>
            <input value={ponto} onChange={(e) => setPonto(e.target.value)} placeholder="Portão B / Lobby" className={inp} />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Fornecedor</span>
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={inp}>
              <option value="">— próprio / nenhum</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Motorista</span><input value={motorista} onChange={(e) => setMotorista(e.target.value)} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Contato</span><input value={contato} onChange={(e) => setContato(e.target.value)} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Veículo/placa</span><input value={veiculo} onChange={(e) => setVeiculo(e.target.value)} className={inp} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Rota ativa</label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={submit} disabled={!rota.trim()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{editing ? 'Salvar' : 'Criar rota'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════ HELPERS DE UI ════════════════════
function EmptyCard({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{msg}</p>
    </div>
  );
}

const TONES: Record<string, string> = {
  ink: 'text-ink', brand: 'text-brand', verde: 'text-emerald-600', azul: 'text-sky-600',
  vermelho: 'text-red-600', amber: 'text-amber-600', gold: 'text-amber-500',
};
function Kpi({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {icon && <span className="text-ink-muted/60">{icon}</span>}
      </div>
      <div className={`mt-1.5 text-2xl font-bold ${TONES[tone] || 'text-ink'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

// ── Ícones (stroke premium) ──
function I({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d={d} /></svg>;
}
const IcoCar = ({ size = 16 }: { size?: number }) => <I d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3h2m14-5a2 2 0 0 1 2 2v3h-2m-2 0H7m10 0v2m-10-2v2M7 14h.01M17 14h.01" size={size} />;
const IcoSearch = () => <I d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3" size={16} />;
const IcoDownload = () => <I d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" size={16} />;
const IcoPrint = () => <I d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6Z" size={15} />;
const IcoEdit = () => <I d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" size={15} />;
const IcoTrash = () => <I d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" size={15} />;
const IcoX = () => <I d="M18 6 6 18M6 6l12 12" size={16} />;
const IcoCheck = ({ size = 16 }: { size?: number }) => <I d="M20 6 9 17l-5-5" size={size} />;
const IcoMoney = () => <I d="M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 9v.01M18 15v.01" size={16} />;
const IcoGauge = () => <I d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0 4-4M4 18a9 9 0 1 1 16 0" size={16} />;
const IcoRoute = ({ size = 16 }: { size?: number }) => <I d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0h7a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" size={size} />;
const IcoKey = ({ size = 16 }: { size?: number }) => <I d="M14 7a4 4 0 1 0-3.9 5L4 18v3h3l1-1h2v-2h2l1.1-1.1A4 4 0 0 0 14 7Zm2-1h.01" size={size} />;
const IcoBell = () => <I d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0" size={16} />;
const IcoClock = () => <I d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" size={16} />;
