'use client';

// Segurança, Acesso & Credenciamento — /painel/acesso.
// Controla QUEM ENTRA no evento: credenciamento, check-in por QR, LOTAÇÃO EM
// TEMPO REAL vs. capacidade autorizada (bombeiros), listas e ocorrências de
// segurança. Vale da festa fechada (lista de convidados) ao evento aberto de
// milhares (corrida, show, feira).
// PILARES (5 abas):
//   • Credenciamento — emitir/importar credenciais c/ QR único, zonas, crachá.
//   • Portaria       — leitura de QR (coletor/câmera) com validação instantânea,
//                      anti-duplicidade e bloqueio por capacidade.
//   • Lotação        — público presente × capacidade por zona e total, pico,
//                      curva e alerta de compliance.
//   • Listas         — convidados / VIPs / autoridades / lista de bloqueio.
//   • Segurança      — ocorrências, rondas, achados e perdidos, posições.
// Engine pura: lib/acesso.ts + lib/qrcode.ts. Movimento autoritativo:
// /api/acesso. Sem "R$" hardcoded — datas/números via lib/format.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Credencial, type AcessoLog, type Zona, type Direcao,
  CRED_TIPOS, credTipoMeta, credStatusMeta, CRED_STATUS_META,
  ZONA_GERAL, ZONA_TODAS, LOTACAO_META,
  calcularOcupacao, picoOcupacao, curvaOcupacao, nivelLotacao,
  resumoCredenciais, ultimoMovimento, gerarQrPayload, tokenCurto,
} from '@/lib/acesso';
import {
  type EventoLite, eventoLabel, iniciais, gerarToken,
  parseImportText, exportCredenciaisCSV, printCredenciais,
} from './_lib';
import { QrCode } from './_components/QrCode';

// ── Constantes ────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 24;
type Tab = 'credenciais' | 'portaria' | 'lotacao' | 'listas' | 'seguranca';

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}
const slug = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);

// ── Página ────────────────────────────────────────────────────────────────────
export default function AcessoPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('credenciais');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [eventoSel, setEventoSel] = useState<string>('');
  const [credenciais, setCredenciais] = useState<Credencial[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [logs, setLogs] = useState<AcessoLog[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);

  // filtros (credenciais)
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fZona, setFZona] = useState('');
  const [page, setPage] = useState(0);

  // modais
  const [credEditor, setCredEditor] = useState<{ editing: Credencial | null } | null>(null);
  const [zonasModal, setZonasModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [qrView, setQrView] = useState<Credencial | null>(null);
  const [ocorrEditor, setOcorrEditor] = useState<{ editing: Ocorrencia | null } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const evento = useMemo(() => eventos.find((e) => e.id === eventoSel) || null, [eventos, eventoSel]);

  // ── Carregamento ──
  const carregarEventos = useCallback(async (uid: string) => {
    const evRes = await sb.from('clientes_eventos')
      .select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,propriedade_id')
      .eq('usuario_id', uid).order('data_inicio', { ascending: false });
    const evs = (evRes.error ? [] : (evRes.data || [])) as EventoLite[];
    setEventos(evs);
    return evs;
  }, []);

  const carregarDados = useCallback(async (uid: string, eventoId: string) => {
    if (!eventoId) { setCredenciais([]); setZonas([]); setLogs([]); setOcorrencias([]); return; }
    const credRes = await sb.from('credenciais').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('criado_em', { ascending: false });
    if (isMissingTable(credRes.error)) { setNeedsSetup(true); return; }
    setNeedsSetup(false);
    setCredenciais(((credRes.data || []) as Credencial[]).map((c) => ({ ...c, zonas: c.zonas || [] })));
    const [zoRes, lgRes, ocRes] = await Promise.all([
      sb.from('acesso_zonas').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('ordem'),
      sb.from('acesso_eventos_log').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('criado_em', { ascending: false }).limit(5000),
      sb.from('acesso_ocorrencias').select('*').eq('usuario_id', uid).eq('evento_id', eventoId).order('criado_em', { ascending: false }),
    ]);
    setZonas(zoRes.error ? [] : ((zoRes.data || []) as Zona[]).map((z) => ({ ...z, tipos_permitidos: z.tipos_permitidos || [] })));
    setLogs(lgRes.error ? [] : (lgRes.data || []) as AcessoLog[]);
    setOcorrencias(ocRes.error ? [] : (ocRes.data || []) as Ocorrencia[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);
      const evs = await carregarEventos(uid);
      const first = evs[0]?.id || '';
      setEventoSel(first);
      if (first) await carregarDados(uid, first);
      setLoading(false);
    })();
  }, [carregarEventos, carregarDados]);

  useEffect(() => { setPage(0); }, [busca, fTipo, fStatus, fZona, eventoSel]);

  const trocarEvento = useCallback(async (id: string) => {
    setEventoSel(id);
    if (userId) { setLoading(true); await carregarDados(userId, id); setLoading(false); }
  }, [userId, carregarDados]);

  const refetch = useCallback(() => { if (userId && eventoSel) carregarDados(userId, eventoSel); }, [userId, eventoSel, carregarDados]);

  // recarrega só logs+credenciais (lotação/portaria em tempo real)
  const recarregarTempoReal = useCallback(async () => {
    if (!userId || !eventoSel) return;
    const [lgRes, credRes] = await Promise.all([
      sb.from('acesso_eventos_log').select('*').eq('usuario_id', userId).eq('evento_id', eventoSel).order('criado_em', { ascending: false }).limit(5000),
      sb.from('credenciais').select('id,status').eq('usuario_id', userId).eq('evento_id', eventoSel),
    ]);
    if (!lgRes.error) setLogs((lgRes.data || []) as AcessoLog[]);
    if (!credRes.error) {
      const statusById = new Map((credRes.data as { id: string; status: string }[]).map((c) => [c.id, c.status]));
      setCredenciais((arr) => arr.map((c) => ({ ...c, status: statusById.get(c.id) || c.status })));
    }
  }, [userId, eventoSel]);

  // ── Derivados ──
  const zonaByCodigo = useMemo(() => new Map(zonas.map((z) => [z.codigo, z])), [zonas]);
  const credById = useMemo(() => new Map(credenciais.map((c) => [c.id, c])), [credenciais]);
  const ocupacao = useMemo(() => calcularOcupacao(logs), [logs]);
  const pico = useMemo(() => picoOcupacao(logs), [logs]);
  const resumo = useMemo(() => resumoCredenciais(credenciais), [credenciais]);

  const geralZona = zonaByCodigo.get(ZONA_GERAL);
  const capacidadeTotal = geralZona?.capacidade ?? 0;
  const lotacaoTotal = useMemo(() => nivelLotacao(ocupacao.total, capacidadeTotal), [ocupacao.total, capacidadeTotal]);

  const tipoDist = useMemo(() => {
    return Object.entries(resumo.porTipo)
      .map(([v, n]) => ({ v, label: credTipoMeta(v).label, cor: credTipoMeta(v).hex, n }))
      .sort((a, b) => b.n - a.n);
  }, [resumo]);

  // ── Lista filtrada/paginada ──
  const filtradas = useMemo(() => {
    let arr = credenciais;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((c) => `${c.nome} ${c.doc || ''} ${c.empresa || ''} ${c.qr_token}`.toLowerCase().includes(q));
    if (fTipo) arr = arr.filter((c) => c.tipo === fTipo);
    if (fStatus) arr = arr.filter((c) => c.status === fStatus);
    if (fZona) arr = arr.filter((c) => (c.zonas || []).includes(fZona) || (fZona !== ZONA_GERAL && (c.zonas || []).includes(ZONA_TODAS)));
    return arr;
  }, [credenciais, busca, fTipo, fStatus, fZona]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = filtradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fTipo || fStatus || fZona);

  // ── Mutações de credencial (RLS) ──
  async function salvarCredencial(payload: Partial<Credencial>, editing: Credencial | null): Promise<boolean> {
    if (!userId || !eventoSel) return false;
    if (editing) {
      const { error } = await sb.from('credenciais').update(payload).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar a credencial.'); return false; }
      toast.success('Credencial atualizada.');
    } else {
      const row = { ...payload, usuario_id: userId, evento_id: eventoSel, qr_token: gerarToken(), status: 'emitida' };
      const { error } = await sb.from('credenciais').insert(row);
      if (error) { toast.error('Não foi possível emitir a credencial.'); return false; }
      toast.success('Credencial emitida.');
    }
    refetch();
    return true;
  }

  async function importarCredenciais(linhas: { nome: string; doc: string | null; empresa: string | null }[], tipo: string, zonasSel: string[]): Promise<void> {
    if (!userId || !eventoSel || !linhas.length) return;
    const rows = linhas.map((l) => ({
      usuario_id: userId, evento_id: eventoSel, tipo, nome: l.nome, doc: l.doc, empresa: l.empresa,
      zonas: zonasSel, status: 'emitida', qr_token: gerarToken(),
    }));
    const { error } = await sb.from('credenciais').insert(rows);
    if (error) { toast.error('Falha ao importar. Verifique os dados.'); return; }
    toast.success(`${formatNumber(rows.length)} credenciais importadas.`);
    setImportModal(false);
    refetch();
  }

  async function alternarBloqueio(c: Credencial) {
    const novo = c.status === 'bloqueada' ? 'emitida' : 'bloqueada';
    const { error } = await sb.from('credenciais').update({ status: novo }).eq('id', c.id);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    setCredenciais((arr) => arr.map((x) => (x.id === c.id ? { ...x, status: novo } : x)));
    toast.success(novo === 'bloqueada' ? 'Credencial bloqueada.' : 'Bloqueio removido.');
  }

  async function removerCredencial(c: Credencial) {
    const key = `del:${c.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir a credencial.'); setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('credenciais').delete().eq('id', c.id);
    if (error) { toast.error('Não foi possível excluir (há movimentos vinculados? bloqueie em vez de excluir).'); return; }
    toast.success('Credencial removida.'); refetch();
  }

  // ── Movimento (API autoritativa) ──
  const registrarMovimento = useCallback(async (args: { token?: string; credencial_id?: string; zona: string; ponto: string; direcao: Direcao; force?: boolean }): Promise<MovResultado> => {
    try {
      const res = await fetch('/api/acesso', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(args) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        // otimista: anexa log + atualiza status da credencial
        if (json.data) setLogs((arr) => [json.data as AcessoLog, ...arr]);
        if (json.credencial) setCredenciais((arr) => arr.map((c) => (c.id === json.credencial.id ? { ...c, status: json.credencial.status } : c)));
        return { kind: json.decisao?.aviso ? 'warn' : 'ok', json, args };
      }
      if (res.status === 404) return { kind: 'erro', json: { ...json, motivo: 'desconhecida' }, args };
      return { kind: json.bloqueante === false ? 'warn' : 'erro', json, args };
    } catch {
      return { kind: 'erro', json: { motivo: 'rede', aviso: 'Sem conexão — tente novamente.' }, args };
    }
  }, []);

  // ── Zonas (RLS) ──
  async function salvarZona(z: Partial<Zona> & { id?: string }): Promise<boolean> {
    if (!userId || !eventoSel) return false;
    if (z.id) {
      const { error } = await sb.from('acesso_zonas').update({ nome: z.nome, capacidade: z.capacidade, cor: z.cor, tipos_permitidos: z.tipos_permitidos, ordem: z.ordem }).eq('id', z.id);
      if (error) { toast.error('Não foi possível salvar a zona.'); return false; }
    } else {
      const { error } = await sb.from('acesso_zonas').insert({ usuario_id: userId, evento_id: eventoSel, codigo: z.codigo, nome: z.nome, capacidade: z.capacidade || 0, cor: z.cor || null, tipos_permitidos: z.tipos_permitidos || [], ordem: z.ordem || zonas.length });
      if (error) { toast.error(error.message?.includes('duplicate') ? 'Já existe uma zona com esse código.' : 'Não foi possível criar a zona.'); return false; }
    }
    refetch();
    return true;
  }
  async function removerZona(z: Zona) {
    const { error } = await sb.from('acesso_zonas').delete().eq('id', z.id);
    if (error) { toast.error('Não foi possível remover a zona.'); return; }
    refetch();
  }

  // ── Ocorrências (RLS) ──
  async function salvarOcorrencia(payload: Partial<Ocorrencia>, editing: Ocorrencia | null): Promise<boolean> {
    if (!userId || !eventoSel) return false;
    if (editing) {
      const { error } = await sb.from('acesso_ocorrencias').update(payload).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar.'); return false; }
    } else {
      const { error } = await sb.from('acesso_ocorrencias').insert({ ...payload, usuario_id: userId, evento_id: eventoSel });
      if (error) { toast.error('Não foi possível registrar.'); return false; }
    }
    toast.success('Ocorrência registrada.');
    refetch();
    return true;
  }
  async function mudarStatusOcorrencia(o: Ocorrencia, status: string) {
    const { error } = await sb.from('acesso_ocorrencias').update({ status }).eq('id', o.id);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    setOcorrencias((arr) => arr.map((x) => (x.id === o.id ? { ...x, status } : x)));
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Segurança, Acesso & Credenciamento</h1>
          <p className="mt-1 text-sm text-ink-muted">Credenciais com QR, check-in na portaria e lotação em tempo real vs. capacidade autorizada.</p>
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
          O módulo de acesso ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/acesso.sql</code> no Supabase para criar <code className="rounded bg-amber-100 px-1 py-0.5">credenciais</code>, <code className="rounded bg-amber-100 px-1 py-0.5">acesso_zonas</code>, <code className="rounded bg-amber-100 px-1 py-0.5">acesso_eventos_log</code> e <code className="rounded bg-amber-100 px-1 py-0.5">acesso_ocorrencias</code>.
        </div>
      )}

      {!needsSetup && eventos.length === 0 ? (
        <EmptyCard title="Nenhum evento ainda" msg="O credenciamento é por evento. Crie um evento em Leads/Clientes para começar a emitir credenciais e controlar o acesso." />
      ) : !needsSetup && (
        <>
          {/* Tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['credenciais', 'Credenciamento'], ['portaria', 'Portaria'], ['lotacao', 'Lotação'], ['listas', 'Listas'], ['seguranca', 'Segurança']] as [Tab, string][]).map(([k, lab]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}>{lab}</button>
            ))}
          </div>

          {/* ───────────── CREDENCIAMENTO ───────────── */}
          {tab === 'credenciais' && (
            <div className="mt-5 space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                <Kpi label="Credenciais" value={formatNumber(resumo.total)} sub="emitidas no evento" tone="ink" icon={<IcoId />} />
                <Kpi label="Presentes agora" value={formatNumber(Math.max(0, ocupacao.total))} sub={capacidadeTotal ? `de ${formatNumber(capacidadeTotal)}` : 'sem limite'} tone="verde" icon={<IcoUsers />} />
                <Kpi label="Check-in" value={formatPercent(resumo.taxaCheckin)} sub="já entraram" tone="azul" icon={<IcoCheck />} />
                <Kpi label="VIPs" value={formatNumber(resumo.porTipo['vip'] || 0)} sub={`${formatNumber(resumo.porTipo['autoridade'] || 0)} autoridades`} tone="gold" icon={<IcoStar />} />
                <Kpi label="Bloqueadas" value={formatNumber(resumo.bloqueadas)} sub="lista de bloqueio" tone={resumo.bloqueadas ? 'vermelho' : 'ink'} icon={<IcoBan />} />
              </div>

              {/* Distribuição por tipo */}
              {tipoDist.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-base font-bold text-ink">Por tipo de credencial</h3>
                  <div className="flex flex-wrap gap-2">
                    {tipoDist.map((t) => (
                      <button key={t.v} onClick={() => { setFTipo(fTipo === t.v ? '' : t.v); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${fTipo === t.v ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand/30'}`}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.cor }} />{t.label}<span className="text-ink-muted">{formatNumber(t.n)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações + filtros */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, documento, empresa…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={selCls}>
                    <option value="">Tipo</option>
                    {CRED_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
                    <option value="">Status</option>
                    {Object.entries(CRED_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                  </select>
                  {zonas.length > 0 && (
                    <select value={fZona} onChange={(e) => setFZona(e.target.value)} className={selCls}>
                      <option value="">Zona</option>
                      {zonas.map((z) => <option key={z.id} value={z.codigo}>{z.nome}</option>)}
                    </select>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button onClick={() => setZonasModal(true)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoZone /> Zonas</button>
                    {filtradas.length > 0 && <button onClick={() => exportCredenciaisCSV(filtradas)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> CSV</button>}
                    {filtradas.length > 0 && <button onClick={() => printCredenciais(filtradas, eventoLabel(evento))} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoPrint /> Crachás</button>}
                    <button onClick={() => setImportModal(true)} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/[0.03]">Importar</button>
                    <button onClick={() => setCredEditor({ editing: null })} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Credencial</button>
                  </div>
                </div>

                {credenciais.length === 0 ? (
                  <EmptyCredenciais onNova={() => setCredEditor({ editing: null })} onImportar={() => setImportModal(true)} />
                ) : filtradas.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-muted">{temFiltro ? 'Nenhuma credencial corresponde aos filtros.' : '—'}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {pageItems.map((c) => (
                        <CredencialCard key={c.id} c={c} ultimo={ultimoMovimento(logs, c.id)} confirmKey={confirmKey}
                          onQr={() => setQrView(c)} onEditar={() => setCredEditor({ editing: c })}
                          onPrint={() => printCredenciais([c], eventoLabel(evento))}
                          onBloquear={() => alternarBloqueio(c)} onRemover={() => removerCredencial(c)} />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                        <span>{formatNumber(filtradas.length)} credencial(is) · página {page + 1} de {totalPages}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ───────────── PORTARIA ───────────── */}
          {tab === 'portaria' && (
            <Portaria zonas={zonas} credenciais={credenciais} logs={logs} evento={evento}
              onRegistrar={registrarMovimento} onSync={recarregarTempoReal} />
          )}

          {/* ───────────── LOTAÇÃO ───────────── */}
          {tab === 'lotacao' && (
            <Lotacao ocupacao={ocupacao} pico={pico} curva={curvaOcupacao(logs)} zonas={zonas}
              lotacaoTotal={lotacaoTotal} capacidadeTotal={capacidadeTotal} logs={logs} credById={credById}
              onConfigZonas={() => setZonasModal(true)} onSync={recarregarTempoReal} />
          )}

          {/* ───────────── LISTAS ───────────── */}
          {tab === 'listas' && (
            <Listas credenciais={credenciais} logs={logs} onBloquear={alternarBloqueio} onQr={(c) => setQrView(c)} onEditar={(c) => setCredEditor({ editing: c })} />
          )}

          {/* ───────────── SEGURANÇA ───────────── */}
          {tab === 'seguranca' && (
            <Seguranca ocorrencias={ocorrencias} onNova={() => setOcorrEditor({ editing: null })} onEditar={(o) => setOcorrEditor({ editing: o })} onStatus={mudarStatusOcorrencia} />
          )}
        </>
      )}

      {/* Modais */}
      {credEditor && (
        <CredencialModal editing={credEditor.editing} zonas={zonas} onClose={() => setCredEditor(null)} onSave={(p) => salvarCredencial(p, credEditor.editing).then((ok) => { if (ok) setCredEditor(null); })} />
      )}
      {zonasModal && <ZonasModal zonas={zonas} capacidadeSugerida={capacidadeTotal} onClose={() => setZonasModal(false)} onSalvar={salvarZona} onRemover={removerZona} />}
      {importModal && <ImportModal zonas={zonas} onClose={() => setImportModal(false)} onImportar={importarCredenciais} />}
      {qrView && <QrModal cred={qrView} evento={evento} onClose={() => setQrView(null)} />}
      {ocorrEditor && <OcorrenciaModal editing={ocorrEditor.editing} onClose={() => setOcorrEditor(null)} onSave={(p) => salvarOcorrencia(p, ocorrEditor.editing).then((ok) => { if (ok) setOcorrEditor(null); })} />}
    </div>
  );
}

// ════════════════════ PORTARIA ════════════════════
function Portaria({ zonas, credenciais, logs, evento, onRegistrar, onSync }: {
  zonas: Zona[]; credenciais: Credencial[]; logs: AcessoLog[]; evento: EventoLite | null;
  onRegistrar: (a: { token?: string; credencial_id?: string; zona: string; ponto: string; direcao: Direcao; force?: boolean }) => Promise<MovResultado>;
  onSync: () => void;
}) {
  const toast = useToast();
  const [ponto, setPonto] = useState('Portão principal');
  const [zona, setZona] = useState(ZONA_GERAL);
  const [direcao, setDirecao] = useState<Direcao>('entrada');
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [ultimo, setUltimo] = useState<MovResultado | null>(null);
  const [feed, setFeed] = useState<MovResultado[]>([]);
  const [buscaManual, setBuscaManual] = useState('');
  const [camOn, setCamOn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ v: string; t: number }>({ v: '', t: 0 });

  useEffect(() => { inputRef.current?.focus(); }, [direcao, zona]);

  const processar = useCallback(async (args: { token?: string; credencial_id?: string; force?: boolean }) => {
    setBusy(true);
    const r = await onRegistrar({ ...args, zona, ponto, direcao });
    setBusy(false);
    setUltimo(r);
    setFeed((f) => [r, ...f].slice(0, 14));
    if (r.kind === 'ok') toast.success(`${r.json?.credencial?.nome || 'Credencial'} — ${direcao === 'entrada' ? 'entrada' : 'saída'} registrada.`);
    else if (r.kind === 'warn') toast.info(r.json?.aviso || 'Registrado com aviso.');
    else toast.error(r.json?.aviso || 'Acesso recusado.');
    inputRef.current?.focus();
  }, [onRegistrar, zona, ponto, direcao, toast]);

  const onScanSubmit = useCallback(() => {
    const v = scan.trim();
    if (!v || busy) return;
    setScan('');
    processar({ token: v });
  }, [scan, busy, processar]);

  // câmera (progressive enhancement via BarcodeDetector)
  const pararCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);
  useEffect(() => () => pararCamera(), [pararCamera]);

  async function iniciarCamera() {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) { toast.info('Leitura por câmera não é suportada neste navegador — use um leitor/coletor (campo abaixo) ou a busca manual.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new BD({ formats: ['qr_code'] });
      setCamOn(true);
      const loop = async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              const now = Date.now();
              if (raw !== lastScanRef.current.v || now - lastScanRef.current.t > 3000) {
                lastScanRef.current = { v: raw, t: now };
                processar({ token: raw });
              }
            }
          } catch { /* frame sem código */ }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch { toast.error('Não foi possível acessar a câmera. Verifique a permissão.'); }
  }

  const sugestoes = useMemo(() => {
    const q = buscaManual.trim().toLowerCase();
    if (!q) return [];
    return credenciais.filter((c) => `${c.nome} ${c.doc || ''} ${c.empresa || ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [buscaManual, credenciais]);

  const movimentosHoje = logs.length;

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      {/* Console */}
      <div className="space-y-4">
        {/* Config */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Direção</span>
              <div className="flex overflow-hidden rounded-xl border border-black/10">
                <button onClick={() => setDirecao('entrada')} className={`flex-1 py-2 text-sm font-bold transition ${direcao === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-white text-ink-muted hover:bg-black/[0.03]'}`}>Entrada</button>
                <button onClick={() => setDirecao('saida')} className={`flex-1 py-2 text-sm font-bold transition ${direcao === 'saida' ? 'bg-ink text-white' : 'bg-white text-ink-muted hover:bg-black/[0.03]'}`}>Saída</button>
              </div>
            </label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Zona</span>
              <select value={zona} onChange={(e) => setZona(e.target.value)} className={inp}>
                <option value={ZONA_GERAL}>Perímetro (geral)</option>
                {zonas.filter((z) => z.codigo !== ZONA_GERAL).map((z) => <option key={z.id} value={z.codigo}>{z.nome}</option>)}
              </select>
            </label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Ponto de acesso</span>
              <input value={ponto} onChange={(e) => setPonto(e.target.value)} className={inp} placeholder="Portão A, Catraca 1…" />
            </label>
          </div>
        </div>

        {/* Feedback grande */}
        <FeedbackCheckin r={ultimo} onForce={ultimo && ultimo.kind === 'erro' && ultimo.json?.bloqueante && ultimo.json?.motivo !== 'duplicado' && ultimo.json?.motivo !== 'desconhecida' && ultimo.args ? () => processar({ ...(ultimo.args!.credencial_id ? { credencial_id: ultimo.args!.credencial_id } : { token: ultimo.args!.token }), force: true }) : undefined} />

        {/* Leitura */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Leitura</h3>
            <button onClick={() => (camOn ? pararCamera() : iniciarCamera())} className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${camOn ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/30'}`}>
              <IcoCam /> {camOn ? 'Parar câmera' : 'Usar câmera'}
            </button>
          </div>
          {camOn && (
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="mx-auto max-h-[260px] w-full object-cover" muted playsInline />
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); onScanSubmit(); }} className="mt-3 flex gap-2">
            <input ref={inputRef} value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Aponte o leitor/coletor e bipe o QR, ou digite o código…" autoComplete="off" className="flex-1 rounded-xl border border-black/10 px-3.5 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <button type="submit" disabled={busy || !scan.trim()} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">Validar</button>
          </form>
          <p className="mt-2 text-xs text-ink-muted">O coletor digita o código e envia automaticamente (Enter). A validação é autoritativa no servidor — anti-duplicidade e capacidade.</p>

          {/* Busca manual */}
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Sem QR? Buscar manualmente</span>
            <input value={buscaManual} onChange={(e) => setBuscaManual(e.target.value)} placeholder="Nome, documento ou empresa…" className={inp} />
            {sugestoes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {sugestoes.map((c) => (
                  <button key={c.id} onClick={() => { setBuscaManual(''); processar({ credencial_id: c.id }); }} className="flex w-full items-center gap-2.5 rounded-xl border border-black/[0.06] p-2 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: credTipoMeta(c.tipo).hex }}>{iniciais(c.nome)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{c.nome}</span><span className="block truncate text-xs text-ink-muted">{credTipoMeta(c.tipo).label}{c.empresa ? ` · ${c.empresa}` : ''}</span></span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${credStatusMeta(c.status).chip}`}>{credStatusMeta(c.status).label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed recente */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Movimentos recentes</h3>
          <button onClick={onSync} className="text-xs font-semibold text-brand hover:underline">Atualizar</button>
        </div>
        <p className="mb-3 text-xs text-ink-muted">{formatNumber(movimentosHoje)} movimento(s) no evento.</p>
        {feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Os check-ins aparecem aqui em tempo real.</p>
        ) : (
          <div className="space-y-2">
            {feed.map((r, i) => <FeedItem key={i} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackCheckin({ r, onForce }: { r: MovResultado | null; onForce?: () => void }) {
  if (!r) {
    return (
      <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white py-10 text-center text-sm text-ink-muted">
        Aguardando leitura… bipe um QR ou busque a credencial.
      </div>
    );
  }
  const cred = r.json?.credencial;
  const cfg = r.kind === 'ok'
    ? { bg: 'bg-emerald-50 border-emerald-300', ico: <IcoCheck size={34} />, icoCls: 'bg-emerald-600', tit: 'text-emerald-900' }
    : r.kind === 'warn'
      ? { bg: 'bg-amber-50 border-amber-300', ico: <IcoAlert size={30} />, icoCls: 'bg-amber-500', tit: 'text-amber-900' }
      : { bg: 'bg-red-50 border-red-300', ico: <IcoX size={30} />, icoCls: 'bg-red-600', tit: 'text-red-900' };
  const titulo = r.kind === 'ok' ? (r.args?.direcao === 'saida' ? 'Saída liberada' : 'Entrada liberada')
    : r.kind === 'warn' ? 'Liberado com aviso' : (MOTIVO_LABEL[r.json?.motivo || ''] || 'Acesso recusado');
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-card ${cfg.bg}`}>
      <div className="flex items-center gap-4">
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white ${cfg.icoCls}`}>{cfg.ico}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-lg font-bold ${cfg.tit}`}>{titulo}</div>
          {cred ? (
            <div className="mt-0.5 truncate text-sm text-ink-soft"><span className="font-semibold text-ink">{cred.nome}</span> · {credTipoMeta(cred.tipo).label}</div>
          ) : <div className="mt-0.5 text-sm text-ink-soft">{r.json?.aviso || '—'}</div>}
          {cred && r.json?.aviso && <div className="mt-0.5 text-xs text-ink-muted">{r.json.aviso}</div>}
          {r.json?.ocupacao?.capacidade > 0 && (
            <div className="mt-1 text-xs text-ink-muted">Zona {r.json.ocupacao.zona}: {formatNumber(r.json.ocupacao.atual)}/{formatNumber(r.json.ocupacao.capacidade)}</div>
          )}
        </div>
        {onForce && (
          <button onClick={onForce} className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Liberar mesmo assim</button>
        )}
      </div>
    </div>
  );
}

function FeedItem({ r }: { r: MovResultado }) {
  const cred = r.json?.credencial;
  const dot = r.kind === 'ok' ? 'bg-emerald-500' : r.kind === 'warn' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.05] p-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{cred?.nome || (r.json?.motivo === 'desconhecida' ? 'QR não reconhecido' : '—')}</div>
        <div className="truncate text-xs text-ink-muted">{r.args?.direcao === 'saida' ? 'Saída' : 'Entrada'} · {r.args?.zona === ZONA_GERAL ? 'perímetro' : r.args?.zona}{r.json?.motivo && r.kind !== 'ok' ? ` · ${MOTIVO_LABEL[r.json.motivo] || r.json.motivo}` : ''}</div>
      </div>
    </div>
  );
}

// ════════════════════ LOTAÇÃO ════════════════════
function Lotacao({ ocupacao, pico, curva, zonas, lotacaoTotal, capacidadeTotal, logs, credById, onConfigZonas, onSync }: {
  ocupacao: ReturnType<typeof calcularOcupacao>; pico: ReturnType<typeof picoOcupacao>; curva: ReturnType<typeof curvaOcupacao>;
  zonas: Zona[]; lotacaoTotal: ReturnType<typeof nivelLotacao>; capacidadeTotal: number; logs: AcessoLog[];
  credById: Map<string, Credencial>; onConfigZonas: () => void; onSync: () => void;
}) {
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(onSync, 15000);
    return () => clearInterval(t);
  }, [auto, onSync]);

  const subZonas = zonas.filter((z) => z.codigo !== ZONA_GERAL);
  const tm = LOTACAO_META[lotacaoTotal.nivel];
  const ultimosMov = logs.slice(0, 10);

  return (
    <div className="mt-5 space-y-5">
      {lotacaoTotal.capacidade > 0 && (lotacaoTotal.nivel === 'alerta' || lotacaoTotal.nivel === 'lotado') && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${tm.classe}`}>
          <IcoAlert /><span className="text-sm font-semibold">{lotacaoTotal.nivel === 'lotado' ? 'Capacidade autorizada atingida — pare novas entradas no perímetro (compliance bombeiros).' : 'Aproximando da capacidade máxima — atenção ao fluxo de entrada.'}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${auto ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          {auto ? 'Atualizando a cada 15s' : 'Atualização pausada'}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAuto((v) => !v)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30">{auto ? 'Pausar' : 'Retomar'}</button>
          <button onClick={onSync} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30">Atualizar agora</button>
        </div>
      </div>

      {/* Total + pico */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Lotação total</h3>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${tm.classe}`}>{tm.label}</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-bold text-ink">{formatNumber(lotacaoTotal.presentes)}</span>
            <span className="mb-1.5 text-sm text-ink-muted">{capacidadeTotal > 0 ? `/ ${formatNumber(capacidadeTotal)}` : 'presentes'}</span>
          </div>
          {capacidadeTotal > 0 ? (
            <>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-black/[0.06]">
                <div className={`h-full rounded-full transition-all ${tm.barra}`} style={{ width: `${Math.min(100, lotacaoTotal.ratio * 100)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-ink-muted">
                <span>{formatPercent(lotacaoTotal.ratio, { maximumFractionDigits: 0 })} da capacidade</span>
                <span>{lotacaoTotal.restante === Infinity ? '' : `${formatNumber(lotacaoTotal.restante)} vagas`}</span>
              </div>
            </>
          ) : (
            <button onClick={onConfigZonas} className="mt-3 text-sm font-semibold text-brand hover:underline">Definir capacidade autorizada →</button>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-4 text-center">
            <div><div className="text-xs text-ink-muted">Pico</div><div className="text-lg font-bold text-ink">{formatNumber(pico.pico)}</div>{pico.picoEm && <div className="text-[0.65rem] text-ink-muted">{formatDateTime(new Date(pico.picoEm), { withSeconds: false })}</div>}</div>
            <div><div className="text-xs text-ink-muted">Entradas / saídas</div><div className="text-lg font-bold text-ink">{formatNumber(ocupacao.entradas)} / {formatNumber(ocupacao.saidas)}</div></div>
          </div>
        </div>

        {/* Curva de presença */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-1 text-base font-bold text-ink">Curva de presença</h3>
          <p className="mb-3 text-xs text-ink-muted">Pessoas no perímetro ao longo do tempo.</p>
          {curva.length < 2 ? <div className="flex h-[200px] items-center justify-center text-sm text-ink-muted">Sem movimentos suficientes ainda.</div>
            : <CurvaPresenca curva={curva} capacidade={capacidadeTotal} pico={pico.pico} />}
        </div>
      </div>

      {/* Por zona */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Por zona</h3>
          <button onClick={onConfigZonas} className="text-xs font-semibold text-brand hover:underline">Configurar zonas</button>
        </div>
        {subZonas.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Nenhuma sub-zona configurada (camarote, pista, arquibancada…). O controle usa apenas o perímetro.</p>
        ) : (
          <div className="space-y-3">
            {subZonas.map((z) => {
              const pres = Math.max(0, ocupacao.porZona[z.codigo] || 0);
              const lot = nivelLotacao(pres, z.capacidade);
              const m = LOTACAO_META[lot.nivel];
              return (
                <div key={z.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-ink"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: z.cor || '#94a3b8' }} />{z.nome}</span>
                    <span className="text-ink-muted">{formatNumber(pres)}{z.capacidade ? ` / ${formatNumber(z.capacidade)}` : ''} {z.capacidade ? <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${m.classe}`}>{m.label}</span> : <span className="text-[0.65rem]">sem limite</span>}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
                    <div className={`h-full rounded-full ${z.capacidade ? m.barra : 'bg-slate-400'}`} style={{ width: z.capacidade ? `${Math.min(100, lot.ratio * 100)}%` : '0%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Últimos movimentos */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-3 text-base font-bold text-ink">Últimos movimentos</h3>
        {ultimosMov.length === 0 ? <p className="py-6 text-center text-sm text-ink-muted">Sem movimentos registrados.</p> : (
          <div className="space-y-1.5">
            {ultimosMov.map((l) => {
              const c = credById.get(l.credencial_id || '');
              return (
                <div key={l.id} className="flex items-center gap-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${l.direcao === 'entrada' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{c?.nome || 'Credencial'}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{l.direcao === 'entrada' ? 'entrada' : 'saída'} · {l.zona === ZONA_GERAL ? 'perímetro' : l.zona}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatDateTime(l.criado_em, { withSeconds: true })}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CurvaPresenca({ curva, capacidade, pico }: { curva: { t: number; n: number }[]; capacidade: number; pico: number }) {
  const W = 600, H = 200, pad = 6;
  const t0 = curva[0].t, t1 = curva[curva.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const maxY = Math.max(pico, capacidade || 0, 1);
  const x = (t: number) => pad + ((t - t0) / span) * (W - pad * 2);
  const y = (n: number) => H - pad - (n / maxY) * (H - pad * 2);
  // série em degraus
  let d = `M ${x(curva[0].t)} ${y(0)} L ${x(curva[0].t)} ${y(curva[0].n)}`;
  for (let i = 1; i < curva.length; i++) d += ` L ${x(curva[i].t)} ${y(curva[i - 1].n)} L ${x(curva[i].t)} ${y(curva[i].n)}`;
  const area = `${d} L ${x(t1)} ${y(0)} Z`;
  const capY = capacidade > 0 ? y(capacidade) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none">
      <path d={area} fill="#ff385c" opacity={0.08} />
      <path d={d} fill="none" stroke="#ff385c" strokeWidth={2} />
      {capY != null && <line x1={pad} y1={capY} x2={W - pad} y2={capY} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="5 4" />}
      {capY != null && <text x={W - pad} y={capY - 4} textAnchor="end" className="fill-red-500 text-[10px]">capacidade</text>}
    </svg>
  );
}

// ════════════════════ LISTAS ════════════════════
function Listas({ credenciais, logs, onBloquear, onQr, onEditar }: {
  credenciais: Credencial[]; logs: AcessoLog[]; onBloquear: (c: Credencial) => void; onQr: (c: Credencial) => void; onEditar: (c: Credencial) => void;
}) {
  const [sub, setSub] = useState<'convidados' | 'vips' | 'autoridades' | 'bloqueio'>('convidados');
  const lista = useMemo(() => {
    if (sub === 'vips') return credenciais.filter((c) => c.tipo === 'vip');
    if (sub === 'autoridades') return credenciais.filter((c) => c.tipo === 'autoridade');
    if (sub === 'bloqueio') return credenciais.filter((c) => c.status === 'bloqueada');
    return credenciais.filter((c) => c.tipo === 'convidado');
  }, [credenciais, sub]);

  const subs: [typeof sub, string, number][] = [
    ['convidados', 'Convidados', credenciais.filter((c) => c.tipo === 'convidado').length],
    ['vips', 'VIPs', credenciais.filter((c) => c.tipo === 'vip').length],
    ['autoridades', 'Autoridades', credenciais.filter((c) => c.tipo === 'autoridade').length],
    ['bloqueio', 'Lista de bloqueio', credenciais.filter((c) => c.status === 'bloqueada').length],
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        {subs.map(([k, lab, n]) => (
          <button key={k} onClick={() => setSub(k)} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${sub === k ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand/30'}`}>
            {lab}<span className="rounded-full bg-black/[0.05] px-1.5 text-xs text-ink-muted">{formatNumber(n)}</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        {lista.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">{sub === 'bloqueio' ? 'Ninguém na lista de bloqueio. Bloqueie uma credencial pela aba Credenciamento ou aqui.' : 'Nenhuma credencial nesta lista.'}</p>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {lista.map((c) => {
              const ult = ultimoMovimento(logs, c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: credTipoMeta(c.tipo).hex }}>{iniciais(c.nome)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{c.nome}</div>
                    <div className="truncate text-xs text-ink-muted">{credTipoMeta(c.tipo).label}{c.empresa ? ` · ${c.empresa}` : ''}{ult ? ` · ${ult.direcao === 'entrada' ? 'entrou' : 'saiu'} ${formatDateTime(ult.criado_em)}` : ''}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${credStatusMeta(c.status).chip}`}>{credStatusMeta(c.status).label}</span>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => onQr(c)} aria-label="Ver QR" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand"><IcoQr /></button>
                    <button onClick={() => onEditar(c)} aria-label="Editar" className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => onBloquear(c)} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${c.status === 'bloqueada' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{c.status === 'bloqueada' ? 'Liberar' : 'Bloquear'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════ SEGURANÇA ════════════════════
const OCORR_TIPO: Record<string, string> = { ocorrencia: 'Ocorrência', ronda: 'Ronda', achado_perdido: 'Achado/Perdido', emergencia: 'Emergência' };
const GRAVIDADE_META: Record<string, { label: string; chip: string }> = {
  baixa: { label: 'Baixa', chip: 'bg-slate-100 text-slate-600' },
  media: { label: 'Média', chip: 'bg-amber-100 text-amber-700' },
  alta: { label: 'Alta', chip: 'bg-orange-100 text-orange-700' },
  critica: { label: 'Crítica', chip: 'bg-red-100 text-red-700' },
};
const OCORR_STATUS: Record<string, { label: string; chip: string }> = {
  aberta: { label: 'Aberta', chip: 'bg-red-50 text-red-700' },
  em_andamento: { label: 'Em andamento', chip: 'bg-amber-50 text-amber-700' },
  resolvida: { label: 'Resolvida', chip: 'bg-emerald-50 text-emerald-700' },
};

function Seguranca({ ocorrencias, onNova, onEditar, onStatus }: {
  ocorrencias: Ocorrencia[]; onNova: () => void; onEditar: (o: Ocorrencia) => void; onStatus: (o: Ocorrencia, s: string) => void;
}) {
  const [fTipo, setFTipo] = useState('');
  const abertas = ocorrencias.filter((o) => o.status !== 'resolvida').length;
  const criticas = ocorrencias.filter((o) => o.gravidade === 'critica' && o.status !== 'resolvida').length;
  const lista = fTipo ? ocorrencias.filter((o) => o.tipo === fTipo) : ocorrencias;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ocorrências" value={formatNumber(ocorrencias.length)} tone="ink" icon={<IcoShield />} />
        <Kpi label="Em aberto" value={formatNumber(abertas)} tone={abertas ? 'amber' : 'verde'} icon={<IcoAlert />} />
        <Kpi label="Críticas" value={formatNumber(criticas)} tone={criticas ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
        <Kpi label="Resolvidas" value={formatNumber(ocorrencias.filter((o) => o.status === 'resolvida').length)} tone="verde" icon={<IcoCheck />} />
      </div>

      <div className="rounded-2xl border border-brand/15 bg-brand-50/40 p-4 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Posições & brigada:</span> defina o efetivo de segurança/brigadistas e as escalas por posto em <a href="/painel/ponto" className="font-semibold text-brand hover:underline">Ponto & Escala</a>. As ocorrências abaixo alimentam o relatório de segurança do evento.
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-ink">Ocorrências, rondas & achados</h3>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={`${selCls} ml-auto`}>
            <option value="">Todos os tipos</option>
            {Object.entries(OCORR_TIPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={onNova} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Registrar</button>
        </div>
        {lista.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhum registro. Use para anotar ocorrências, rondas, achados e perdidos e emergências.</p>
        ) : (
          <div className="space-y-2.5">
            {lista.map((o) => {
              const g = GRAVIDADE_META[o.gravidade] || GRAVIDADE_META.media;
              const st = OCORR_STATUS[o.status] || OCORR_STATUS.aberta;
              return (
                <div key={o.id} className="rounded-xl border border-black/[0.06] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">{OCORR_TIPO[o.tipo] || o.tipo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${g.chip}`}>{g.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${st.chip}`}>{st.label}</span>
                    <span className="ml-auto text-xs text-ink-muted">{formatDateTime(o.criado_em)}</span>
                  </div>
                  <button onClick={() => onEditar(o)} className="mt-1.5 block text-left text-sm font-semibold text-ink hover:text-brand">{o.titulo}</button>
                  {o.descricao && <p className="mt-0.5 text-sm text-ink-soft">{o.descricao}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                    {o.local && <span>📍 {o.local}</span>}
                    {o.responsavel && <span>👤 {o.responsavel}</span>}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {o.status !== 'em_andamento' && o.status !== 'resolvida' && <button onClick={() => onStatus(o, 'em_andamento')} className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600">Em andamento</button>}
                    {o.status !== 'resolvida' && <button onClick={() => onStatus(o, 'resolvida')} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">Resolver</button>}
                    {o.status === 'resolvida' && <button onClick={() => onStatus(o, 'aberta')} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand/30">Reabrir</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.05]"><IcoX size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CredencialModal({ editing, zonas, onClose, onSave }: { editing: Credencial | null; zonas: Zona[]; onClose: () => void; onSave: (p: Partial<Credencial>) => void }) {
  const [tipo, setTipo] = useState(editing?.tipo || 'convidado');
  const [nome, setNome] = useState(editing?.nome || '');
  const [doc, setDoc] = useState(editing?.doc || '');
  const [empresa, setEmpresa] = useState(editing?.empresa || '');
  const [obs, setObs] = useState(editing?.obs || '');
  const [zsel, setZsel] = useState<string[]>(editing?.zonas || []);
  const [todas, setTodas] = useState((editing?.zonas || []).includes(ZONA_TODAS));
  const subZonas = zonas.filter((z) => z.codigo !== ZONA_GERAL);

  const toggleZona = (cod: string) => setZsel((s) => (s.includes(cod) ? s.filter((x) => x !== cod) : [...s, cod]));
  const submit = () => {
    if (!nome.trim()) return;
    const zonasFinal = todas ? [ZONA_TODAS] : zsel.filter((z) => z !== ZONA_TODAS);
    onSave({ tipo, nome: nome.trim(), doc: doc.trim() || null, empresa: empresa.trim() || null, obs: obs.trim() || null, zonas: zonasFinal });
  };

  return (
    <ModalShell title={editing ? 'Editar credencial' : 'Nova credencial'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{CRED_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Nome *</span><input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} autoFocus /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Documento</span><input value={doc} onChange={(e) => setDoc(e.target.value)} className={inp} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Empresa</span><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inp} placeholder="fornecedor/imprensa…" /></label>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Zonas autorizadas</span>
          <label className="mb-2 flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Acesso total (todas as zonas)</label>
          {!todas && (subZonas.length === 0
            ? <p className="text-xs text-ink-muted">Sem sub-zonas. A credencial acessa o perímetro por padrão. Crie zonas (camarote, pista…) em “Zonas”.</p>
            : <div className="flex flex-wrap gap-1.5">{subZonas.map((z) => <button key={z.id} type="button" onClick={() => toggleZona(z.codigo)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${zsel.includes(z.codigo) ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand/30'}`}>{z.nome}</button>)}</div>)}
        </div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Observações</span><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} /></label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={submit} disabled={!nome.trim()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{editing ? 'Salvar' : 'Emitir credencial'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ZonasModal({ zonas, capacidadeSugerida, onClose, onSalvar, onRemover }: { zonas: Zona[]; capacidadeSugerida: number; onClose: () => void; onSalvar: (z: Partial<Zona> & { id?: string }) => Promise<boolean>; onRemover: (z: Zona) => void }) {
  const [nome, setNome] = useState('');
  const [cap, setCap] = useState('');
  const [cor, setCor] = useState('#0ea5e9');
  const temGeral = zonas.some((z) => z.codigo === ZONA_GERAL);

  const addZona = async () => {
    if (!nome.trim()) return;
    const ok = await onSalvar({ codigo: slug(nome), nome: nome.trim(), capacidade: Number(cap) || 0, cor });
    if (ok) { setNome(''); setCap(''); }
  };
  const criarGeral = () => onSalvar({ codigo: ZONA_GERAL, nome: 'Perímetro (geral)', capacidade: 0, cor: '#ff385c' });

  return (
    <ModalShell title="Zonas & capacidade" onClose={onClose} wide>
      <div className="space-y-4">
        {!temGeral && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>Crie a zona <b>perímetro (geral)</b> — é o total do evento (lotação autorizada pelos bombeiros).</span>
            <button onClick={criarGeral} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">Criar perímetro</button>
          </div>
        )}
        <div className="rounded-xl border border-black/[0.06]">
          {zonas.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhuma zona ainda.</p> : (
            <div className="divide-y divide-black/[0.05]">
              {zonas.map((z) => <ZonaRow key={z.id} z={z} onSalvar={onSalvar} onRemover={onRemover} />)}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-dashed border-black/15 p-4">
          <span className="mb-2 block text-xs font-semibold text-ink-soft">Adicionar sub-zona (camarote, pista, arquibancada, backstage…)</span>
          <div className="flex flex-wrap items-end gap-2">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da zona" className={`${inp} min-w-[160px] flex-1`} />
            <input value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} placeholder="Capacidade" inputMode="numeric" className={`${selCls} w-28`} />
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-black/10" aria-label="Cor" />
            <button onClick={addZona} disabled={!nome.trim()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">Adicionar</button>
          </div>
          {capacidadeSugerida === 0 && <p className="mt-2 text-xs text-ink-muted">Defina a capacidade do perímetro (geral) para acompanhar a lotação total.</p>}
        </div>
      </div>
    </ModalShell>
  );
}

function ZonaRow({ z, onSalvar, onRemover }: { z: Zona; onSalvar: (z: Partial<Zona> & { id?: string }) => Promise<boolean>; onRemover: (z: Zona) => void }) {
  const [nome, setNome] = useState(z.nome);
  const [cap, setCap] = useState(String(z.capacidade || ''));
  const [dirty, setDirty] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: z.cor || '#94a3b8' }} />
      <input value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} className="min-w-[120px] flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
      <span className="text-xs text-ink-muted">cap.</span>
      <input value={cap} onChange={(e) => { setCap(e.target.value.replace(/\D/g, '')); setDirty(true); }} inputMode="numeric" className="w-20 rounded-lg border border-black/10 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" placeholder="—" />
      {dirty && <button onClick={async () => { const ok = await onSalvar({ id: z.id, nome: nome.trim(), capacidade: Number(cap) || 0, cor: z.cor, tipos_permitidos: z.tipos_permitidos, ordem: z.ordem }); if (ok) setDirty(false); }} className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-600">Salvar</button>}
      {z.codigo !== ZONA_GERAL && <button onClick={() => onRemover(z)} aria-label="Remover zona" className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50"><IcoTrash /></button>}
      {z.codigo === ZONA_GERAL && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">total</span>}
    </div>
  );
}

function ImportModal({ zonas, onClose, onImportar }: { zonas: Zona[]; onClose: () => void; onImportar: (l: { nome: string; doc: string | null; empresa: string | null }[], tipo: string, zonas: string[]) => void }) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('convidado');
  const [zsel, setZsel] = useState<string[]>([]);
  const [todas, setTodas] = useState(false);
  const linhas = useMemo(() => parseImportText(texto), [texto]);
  const subZonas = zonas.filter((z) => z.codigo !== ZONA_GERAL);
  return (
    <ModalShell title="Importar credenciais" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Cole uma pessoa por linha: <code className="rounded bg-black/[0.05] px-1">nome, documento, empresa</code> (documento e empresa opcionais). Cada credencial recebe um QR único.</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder={'Maria Souza, 123.456.789-00\nJoão Lima\nRádio FM, , Imprensa Local'} className={`${inp} font-mono text-xs`} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><span className="text-xs font-semibold text-ink-soft">Tipo:</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selCls}>{CRED_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
          </label>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand">{formatNumber(linhas.length)} para importar</span>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Zonas autorizadas</span>
          <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Acesso total</label>
          {!todas && subZonas.length > 0 && <div className="flex flex-wrap gap-1.5">{subZonas.map((z) => <button key={z.id} type="button" onClick={() => setZsel((s) => s.includes(z.codigo) ? s.filter((x) => x !== z.codigo) : [...s, z.codigo])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${zsel.includes(z.codigo) ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft'}`}>{z.nome}</button>)}</div>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={() => onImportar(linhas, tipo, todas ? [ZONA_TODAS] : zsel)} disabled={!linhas.length} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">Importar {linhas.length ? formatNumber(linhas.length) : ''}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function QrModal({ cred, evento, onClose }: { cred: Credencial; evento: EventoLite | null; onClose: () => void }) {
  return (
    <ModalShell title="Credencial" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="rounded-2xl border border-black/10 p-4"><QrCode value={gerarQrPayload(cred.qr_token)} size={220} /></div>
        <div className="mt-3 text-lg font-bold text-ink">{cred.nome}</div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-ink-muted">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${credTipoMeta(cred.tipo).chip}`}>{credTipoMeta(cred.tipo).label}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${credStatusMeta(cred.status).chip}`}>{credStatusMeta(cred.status).label}</span>
        </div>
        <div className="mt-2 font-mono text-xs tracking-widest text-ink-muted">{tokenCurto(cred.qr_token)}</div>
        <button onClick={() => printCredenciais([cred], eventoLabel(evento))} className="mt-4 w-full rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Imprimir crachá</button>
      </div>
    </ModalShell>
  );
}

function OcorrenciaModal({ editing, onClose, onSave }: { editing: Ocorrencia | null; onClose: () => void; onSave: (p: Partial<Ocorrencia>) => void }) {
  const [tipo, setTipo] = useState(editing?.tipo || 'ocorrencia');
  const [titulo, setTitulo] = useState(editing?.titulo || '');
  const [descricao, setDescricao] = useState(editing?.descricao || '');
  const [gravidade, setGravidade] = useState(editing?.gravidade || 'media');
  const [local, setLocal] = useState(editing?.local || '');
  const [responsavel, setResponsavel] = useState(editing?.responsavel || '');
  const submit = () => { if (!titulo.trim()) return; onSave({ tipo, titulo: titulo.trim(), descricao: descricao.trim() || null, gravidade, local: local.trim() || null, responsavel: responsavel.trim() || null }); };
  return (
    <ModalShell title={editing ? 'Editar registro' : 'Registrar ocorrência'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{Object.entries(OCORR_TIPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Gravidade</span>
            <select value={gravidade} onChange={(e) => setGravidade(e.target.value)} className={inp}>{Object.entries(GRAVIDADE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}</select></label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Título *</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} autoFocus /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Descrição</span><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inp} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Local</span><input value={local} onChange={(e) => setLocal(e.target.value)} className={inp} placeholder="Portão B, Camarote…" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Responsável</span><input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} /></label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={submit} disabled={!titulo.trim()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{editing ? 'Salvar' : 'Registrar'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════ CARDS / EMPTY ════════════════════
function CredencialCard({ c, ultimo, confirmKey, onQr, onEditar, onPrint, onBloquear, onRemover }: {
  c: Credencial; ultimo: AcessoLog | null; confirmKey: string | null;
  onQr: () => void; onEditar: () => void; onPrint: () => void; onBloquear: () => void; onRemover: () => void;
}) {
  const meta = credTipoMeta(c.tipo);
  const st = credStatusMeta(c.status);
  return (
    <div className={`rounded-2xl border bg-white p-3.5 shadow-card transition ${c.status === 'bloqueada' ? 'border-red-200' : 'border-black/[0.06]'}`}>
      <div className="flex items-start gap-3">
        <button onClick={onQr} className="shrink-0 rounded-lg border border-black/[0.06] p-1 transition hover:border-brand/40" title="Ver QR"><QrCode value={gerarQrPayload(c.qr_token)} size={56} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.hex }} /><button onClick={onEditar} className="truncate text-sm font-bold text-ink hover:text-brand">{c.nome}</button></div>
          <div className="mt-0.5 truncate text-xs text-ink-muted">{meta.label}{c.empresa ? ` · ${c.empresa}` : c.doc ? ` · ${c.doc}` : ''}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${st.chip}`}>{st.label}</span>
            {(c.zonas || []).includes(ZONA_TODAS) ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.6rem] font-bold text-violet-700">acesso total</span>
              : (c.zonas || []).length > 0 && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.6rem] font-semibold text-ink-muted">{formatNumber(c.zonas.length)} zona(s)</span>}
          </div>
        </div>
      </div>
      {ultimo && <div className="mt-2 text-[0.7rem] text-ink-muted">{ultimo.direcao === 'entrada' ? '↳ Entrou' : '↰ Saiu'} {formatDateTime(ultimo.criado_em)} · {ultimo.zona === ZONA_GERAL ? 'perímetro' : ultimo.zona}</div>}
      <div className="mt-2.5 flex items-center gap-1 border-t border-black/[0.05] pt-2.5">
        <button onClick={onPrint} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoPrint /> Crachá</button>
        <button onClick={onEditar} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /> Editar</button>
        <div className="ml-auto flex gap-1">
          <button onClick={onBloquear} className={`rounded-lg px-2 py-1 text-xs font-semibold ${c.status === 'bloqueada' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-red-600 hover:bg-red-50'}`}>{c.status === 'bloqueada' ? 'Liberar' : 'Bloquear'}</button>
          <button onClick={onRemover} aria-label="Excluir" className={`rounded-lg px-1.5 py-1 ${confirmKey === `del:${c.id}` ? 'bg-red-600 text-white' : 'text-ink-muted hover:bg-red-50 hover:text-red-600'}`}><IcoTrash /></button>
        </div>
      </div>
    </div>
  );
}

function EmptyCredenciais({ onNova, onImportar }: { onNova: () => void; onImportar: () => void }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoId size={30} /></div>
      <h2 className="text-lg font-bold text-ink">Comece o credenciamento</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Emita credenciais com QR único para convidados, equipe, fornecedores, imprensa e VIPs. Defina zonas de acesso, imprima crachás e controle a entrada na portaria.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button onClick={onNova} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Primeira credencial</button>
        <button onClick={onImportar} className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.03]">Importar lista</button>
      </div>
    </div>
  );
}

function EmptyCard({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{msg}</p>
    </div>
  );
}

// ── KPI ──
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

// ── Tipos auxiliares (UI) ──
type Ocorrencia = {
  id: string; usuario_id?: string; evento_id: string | null;
  tipo: string; titulo: string; descricao: string | null; gravidade: string;
  local: string | null; responsavel: string | null; status: string; criado_em: string; atualizado_em?: string;
};
type MovResultado = {
  kind: 'ok' | 'warn' | 'erro';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
  args?: { token?: string; credencial_id?: string; zona: string; ponto: string; direcao: Direcao; force?: boolean };
};
const MOTIVO_LABEL: Record<string, string> = {
  bloqueada: 'Credencial bloqueada', zona_negada: 'Sem acesso à zona', duplicado: 'Leitura repetida',
  ja_dentro: 'Já está dentro', ja_fora: 'Já está fora', lotacao: 'Zona lotada', desconhecida: 'QR não reconhecido', rede: 'Sem conexão',
};

// ── Ícones (stroke premium) ──
function I({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d={d} /></svg>;
}
const IcoSearch = () => <I d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3" size={16} />;
const IcoDownload = () => <I d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" size={16} />;
const IcoPrint = () => <I d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6Z" size={15} />;
const IcoEdit = () => <I d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" size={15} />;
const IcoTrash = () => <I d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" size={15} />;
const IcoQr = () => <I d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" size={15} />;
const IcoZone = () => <I d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" size={16} />;
const IcoCam = () => <I d="M3 7h3l2-2h8l2 2h3v12H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" size={15} />;
const IcoId = ({ size }: { size?: number }) => <I d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3 6a3 3 0 0 1 6 0M15 9h4M15 13h4" size={size} />;
const IcoUsers = () => <I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" size={16} />;
const IcoCheck = ({ size = 16 }: { size?: number }) => <I d="M20 6 9 17l-5-5" size={size} />;
const IcoX = ({ size = 16 }: { size?: number }) => <I d="M18 6 6 18M6 6l12 12" size={size} />;
const IcoAlert = ({ size = 16 }: { size?: number }) => <I d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" size={size} />;
const IcoStar = () => <I d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18l-5.8 3 1.1-6.5L2.6 9.8l6.5-.9Z" size={16} />;
const IcoBan = () => <I d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8" size={16} />;
const IcoShield = () => <I d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" size={16} />;
