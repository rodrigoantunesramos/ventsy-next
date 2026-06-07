'use client';

// Ficha do cliente (CRM 360º) — /painel/clientes/[id].
// Raio-x completo de um contratante: cabeçalho com contatos acionáveis + tags +
// segmento, métricas (LTV, nº eventos, ticket, recência) e abas:
// Visão geral (+IA Pro+) · Eventos · Financeiro · Interações · Documentos ·
// Avaliações · Campanhas. Edição com auto-save (mesmo padrão da ficha de Leads).
// Fonte: clientes, clientes_eventos (cliente_id), parcelas, clientes_interacoes,
// avaliacoes (best-effort). Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatPercent, formatDate, formatDateRange } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Cliente, type EventoLite, type ParcelaLite, type Interacao, type TipoInteracao,
  SEG_BY, ORIGENS, ORIGEM_LABEL, INTERACOES, INTERACAO_BY,
  eventosDoCliente, metricsCliente, segmentar, grupoDe, iniciais,
  waLink, telLink, mailLink, ymd,
} from '../_lib';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
type Tab = 'visao' | 'eventos' | 'financeiro' | 'interacoes' | 'documentos' | 'avaliacoes' | 'campanhas';
const TABS: { v: Tab; label: string }[] = [
  { v: 'visao', label: 'Visão geral' }, { v: 'eventos', label: 'Eventos' }, { v: 'financeiro', label: 'Financeiro' },
  { v: 'interacoes', label: 'Interações' }, { v: 'documentos', label: 'Documentos' }, { v: 'avaliacoes', label: 'Avaliações' }, { v: 'campanhas', label: 'Campanhas' },
];
const GRUPO_CLS: Record<string, string> = {
  negociando: 'bg-amber-50 text-amber-700', contratados: 'bg-emerald-50 text-emerald-700',
  finalizados: 'bg-blue-50 text-blue-700', perdidos: 'bg-red-50 text-red-700',
};
const CONTRATADOS = new Set<string>(['contratados', 'finalizados']);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Avaliacao = { id: any; nota: number; texto: string | null; autor: string | null; evento_tipo: string | null; data: string | null; criado_em: string | null };

export default function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const isPro = plano === 'pro' || plano === 'ultra';

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaLite[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [tab, setTab] = useState<Tab>('visao');

  // draft + auto-save
  const [draft, setDraft] = useState<Cliente | null>(null);
  const draftRef = useRef<Cliente | null>(null);
  const [saude, setSaude] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const { data: cli } = await sb.from('clientes').select('*').eq('id', id).eq('usuario_id', uid).maybeSingle();
    if (!cli) { setNotFound(true); return; }
    const c = { ...cli, tags: Array.isArray(cli.tags) ? cli.tags : [] } as Cliente;
    draftRef.current = c; setDraft(c);
    const nome = c.nome.trim();
    const [evRes, pcRes, inRes, avRes] = await Promise.all([
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,criado_em').eq('usuario_id', uid),
      sb.from('parcelas').select('id,evento_id,valor,vencimento,status,pago_em').eq('usuario_id', uid),
      sb.from('clientes_interacoes').select('*').eq('usuario_id', uid).eq('cliente_id', id).order('data', { ascending: false }),
      sb.from('avaliacoes').select('id,nota,texto,autor,evento_tipo,data,criado_em').ilike('autor', `%${nome}%`),
    ]);
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setParcelas(((pcRes.data || []) as ParcelaLite[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor) })));
    setInteracoes((inRes.data || []) as Interacao[]);
    setAvaliacoes(avRes.error ? [] : ((avRes.data || []) as Avaliacao[]));
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      try { const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle(); setPlano((a?.plano_ativo || 'basico').toLowerCase()); } catch { /* opcional */ }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  // ── Métricas + segmento ──
  const eventosCli = useMemo(() => (draft ? eventosDoCliente(draft, eventos) : []), [draft, eventos]);
  const m = useMemo(() => (draft ? metricsCliente(draft, eventosCli, parcelas, interacoes, now) : null), [draft, eventosCli, parcelas, interacoes, now]);
  // Valor de referência da carteira (LTV médio dos compradores) — mantém o rótulo
  // RFM consistente com a Lista, sem precisar carregar todos os clientes.
  const refValor = useMemo(() => {
    const byCli = new Map<string, number>();
    for (const e of eventos) {
      if (!CONTRATADOS.has(grupoDe(e.status))) continue;
      const key = e.cliente_id || 'n:' + (e.quem_contratou || '').trim().toLowerCase();
      byCli.set(key, (byCli.get(key) || 0) + (e.valor_total_num || 0));
    }
    const vals = [...byCli.values()].filter((v) => v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [eventos]);
  const seg = useMemo(() => (draft && m ? segmentar(draft, m, now, refValor) : 'lead'), [draft, m, now, refValor]);
  const ultimoContato = useMemo(() => (interacoes.length ? interacoes[0].data : null), [interacoes]);

  // ── Auto-save ──
  function montar(d: Cliente) {
    return {
      tipo: d.tipo, nome: d.nome.trim() || 'Sem nome', doc: d.doc || null, email: d.email || null,
      telefone: d.telefone || null, whatsapp: d.whatsapp || null, endereco: d.endereco || null,
      cidade: d.cidade || null, estado: (d.estado || '').toUpperCase().slice(0, 2) || null,
      origem: d.origem || null, tags: d.tags || [], segmento: d.segmento || null,
      aniversario: d.aniversario || null, vip: d.vip, obs: d.obs || null,
    };
  }
  const persist = useCallback(async () => {
    const d = draftRef.current; if (!d || !userId) return;
    const { error } = await sb.from('clientes').update(montar(d)).eq('id', d.id).eq('usuario_id', userId);
    if (error) { setSaude('idle'); toast.error('Erro ao salvar.'); return; }
    setSaude('saved'); setTimeout(() => setSaude((s) => (s === 'saved' ? 'idle' : s)), 1400);
  }, [userId, toast]);
  function scheduleSave() { if (saveTimer.current) clearTimeout(saveTimer.current); setSaude('saving'); saveTimer.current = setTimeout(() => void persist(), 700); }
  function updateDraft(patch: Partial<Cliente>) { const nd = { ...(draftRef.current as Cliente), ...patch }; draftRef.current = nd; setDraft(nd); scheduleSave(); }
  function addTag(t: string) { const v = t.trim(); if (!v || (draft!.tags || []).includes(v)) return; updateDraft({ tags: [...(draft!.tags || []), v] }); }
  function rmTag(t: string) { updateDraft({ tags: (draft!.tags || []).filter((x) => x !== t) }); }

  async function excluir() {
    if (!userId || !draft) return;
    if (!confirm(`Excluir o cliente "${draft.nome}"? Os eventos são desvinculados, não apagados.`)) return;
    const { error } = await sb.from('clientes').delete().eq('id', draft.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Cliente removido.'); router.push('/painel/clientes');
  }

  // ── Interações ──
  async function addInteracao(tipo: TipoInteracao, conteudo: string, data: string) {
    if (!userId || !draft || !conteudo.trim()) return;
    const row = { cliente_id: draft.id, usuario_id: userId, tipo, conteudo: conteudo.trim(), data: data || new Date().toISOString() };
    const { data: ins, error } = await sb.from('clientes_interacoes').insert(row).select().single();
    if (error) { toast.error('Erro ao registrar interação.'); return; }
    setInteracoes((arr) => [ins as Interacao, ...arr]);
    toast.success('Interação registrada.');
  }
  async function rmInteracao(iid: string) {
    if (!userId) return;
    const { error } = await sb.from('clientes_interacoes').delete().eq('id', iid).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setInteracoes((arr) => arr.filter((i) => i.id !== iid));
  }

  // ── Criar evento a partir do cliente ──
  const [evModal, setEvModal] = useState(false);
  async function criarEvento(nomeEvento: string, tipoEvento: string) {
    if (!userId || !draft) return;
    const tel = [draft.whatsapp, draft.telefone].filter(Boolean) as string[];
    const { data, error } = await sb.from('clientes_eventos').insert({
      usuario_id: userId, cliente_id: draft.id, nome_evento: nomeEvento.trim() || `Evento — ${draft.nome}`,
      quem_contratou: draft.nome, documento: draft.doc || null, email: draft.email || null,
      telefones: tel, tipo_evento: tipoEvento, status: 'lead', parcelas: [], checklist: {},
    }).select().single();
    if (error || !data) { toast.error('Erro ao criar evento.'); return; }
    setEventos((arr) => [{ ...(data as EventoLite), valor_total_num: data.valor_total_num != null ? Number(data.valor_total_num) : null }, ...arr]);
    setEvModal(false); toast.success('Evento criado e vinculado. Gerencie o pipeline em Leads.');
  }

  // ── AI (Pro+) ──
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiOut, setAiOut] = useState<{ action: string; text: string } | null>(null);
  async function runAI(action: 'summary' | 'next_action' | 'reactivation') {
    if (!draft) return;
    setAiLoading(action); setAiOut(null);
    try {
      const res = await fetch('/api/clientes/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ action, cliente_id: draft.id }) });
      const j = await res.json();
      if (j.code === 'NO_KEY') { toast.info(j.error); return; }
      if (j.error) { toast.error(j.error); return; }
      setAiOut({ action, text: j.text });
    } catch { toast.error('Falha ao chamar a IA.'); } finally { setAiLoading(null); }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-[120px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[300px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }
  if (notFound || !draft || !m) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/painel/clientes" className="text-sm font-semibold text-brand hover:underline">← Voltar para Clientes</Link>
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
          <p className="text-base font-semibold text-ink">Cliente não encontrado</p>
          <p className="mt-1 text-sm text-ink-muted">Ele pode ter sido removido ou pertence a outra conta.</p>
        </div>
      </div>
    );
  }

  const wa = waLink(draft.whatsapp || draft.telefone);
  const tel = telLink(draft.telefone || draft.whatsapp);
  const mail = mailLink(draft.email);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb + status de salvamento */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/painel/clientes" className="text-sm font-semibold text-brand hover:underline">← Clientes</Link>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${saude === 'saving' ? 'bg-amber-50 text-amber-700' : saude === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'text-ink-muted'}`}>
          {saude === 'saving' ? 'Salvando…' : saude === 'saved' ? 'Salvo ✓' : ''}
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand">{iniciais(draft.nome)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink sm:text-2xl">{draft.nome}</h1>
              <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[0.62rem] font-bold uppercase text-ink-muted">{draft.tipo === 'pj' ? 'PJ' : 'PF'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEG_BY[seg].cls}`}>{SEG_BY[seg].label}</span>
              <button onClick={() => updateDraft({ vip: !draft.vip })} title="Marcar VIP" className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${draft.vip ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>★ VIP</button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
              {draft.cidade && <span>{draft.cidade}{draft.estado ? `/${draft.estado}` : ''}</span>}
              {draft.origem && <span>· {ORIGEM_LABEL[draft.origem] || draft.origem}</span>}
              {draft.email && <span className="truncate">· {draft.email}</span>}
            </div>
            {/* Tags */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {(draft.tags || []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand">
                  {t}<button onClick={() => rmTag(t)} className="text-brand/60 hover:text-brand" aria-label={`Remover ${t}`}>✕</button>
                </span>
              ))}
              <TagAdder onAdd={addTag} />
            </div>
          </div>
          {/* Ações de contato */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">💬 WhatsApp</a>}
            {tel && <a href={tel} className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand" title="Ligar">📞</a>}
            {mail && <a href={mail} className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand" title="E-mail">✉️</a>}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric label="Valor gerado" value={formatMoneyShort(m.valorContratado)} tone="gold" />
        <Metric label="Eventos" value={String(m.nGanhos)} sub={m.nEventos > m.nGanhos ? `${m.nEventos} no total` : 'ganhos'} tone="ink" />
        <Metric label="Ticket médio" value={formatMoneyShort(m.ticket)} tone="azul" />
        <Metric label="Último contato" value={ultimoContato ? formatDate(ultimoContato, { style: 'short' }) : '—'} tone="ink" />
        <Metric label="Próximo evento" value={m.proximoEvento?.data_inicio ? formatDate(m.proximoEvento.data_inicio, { style: 'short' }) : '—'} tone="verde" />
        <Metric label="Última compra" value={m.diasDesdeUltima != null ? `${m.diasDesdeUltima}d` : '—'} sub={m.inativo ? 'inativo' : 'atrás'} tone={m.inativo ? 'vermelho' : 'ink'} />
      </div>

      {/* Abas */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
        {TABS.map((t) => {
          const n = t.v === 'eventos' ? m.nEventos : t.v === 'interacoes' ? interacoes.length : t.v === 'avaliacoes' ? avaliacoes.length : 0;
          return (
            <button key={t.v} onClick={() => setTab(t.v)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === t.v ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {t.label}{n > 0 && <span className="ml-1.5 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] text-ink-muted">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === 'visao' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            {/* Dados editáveis */}
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Dados do cliente</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nome"><input className={inp} value={draft.nome} onChange={(e) => updateDraft({ nome: e.target.value })} /></Campo>
                  <Campo label="Tipo"><select className={inp} value={draft.tipo} onChange={(e) => updateDraft({ tipo: e.target.value as 'pf' | 'pj' })}><option value="pf">Pessoa Física</option><option value="pj">Pessoa Jurídica</option></select></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label={draft.tipo === 'pj' ? 'CNPJ' : 'CPF'}><input className={inp} value={draft.doc || ''} onChange={(e) => updateDraft({ doc: e.target.value })} /></Campo>
                  <Campo label="E-mail"><input type="email" className={inp} value={draft.email || ''} onChange={(e) => updateDraft({ email: e.target.value })} /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Telefone"><input type="tel" className={inp} value={draft.telefone || ''} onChange={(e) => updateDraft({ telefone: e.target.value })} /></Campo>
                  <Campo label="WhatsApp"><input type="tel" className={inp} value={draft.whatsapp || ''} onChange={(e) => updateDraft({ whatsapp: e.target.value })} /></Campo>
                </div>
                <Campo label="Endereço"><input className={inp} value={draft.endereco || ''} onChange={(e) => updateDraft({ endereco: e.target.value })} /></Campo>
                <div className="grid grid-cols-[1fr_88px_1fr] gap-3">
                  <Campo label="Cidade"><input className={inp} value={draft.cidade || ''} onChange={(e) => updateDraft({ cidade: e.target.value })} /></Campo>
                  <Campo label="UF"><input className={inp} maxLength={2} value={draft.estado || ''} onChange={(e) => updateDraft({ estado: e.target.value })} /></Campo>
                  <Campo label="Aniversário"><input type="date" className={inp} value={draft.aniversario || ''} onChange={(e) => updateDraft({ aniversario: e.target.value })} /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Origem"><select className={inp} value={draft.origem || ''} onChange={(e) => updateDraft({ origem: e.target.value })}><option value="">—</option>{ORIGENS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}</select></Campo>
                  <Campo label="Segmento (manual)"><input className={inp} value={draft.segmento || ''} onChange={(e) => updateDraft({ segmento: e.target.value })} placeholder="Ex: casamentos premium" /></Campo>
                </div>
                <Campo label="Observações"><textarea rows={3} className={inp} value={draft.obs || ''} onChange={(e) => updateDraft({ obs: e.target.value })} /></Campo>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-black/[0.06] pt-4">
                <button onClick={() => setEvModal(true)} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Criar evento</button>
                <button onClick={excluir} className="ml-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Excluir cliente</button>
              </div>
            </div>

            {/* IA + destaques */}
            <div className="space-y-5">
              <AiPanel isPro={isPro} loading={aiLoading} out={aiOut} primeiroNome={draft.nome.split(' ')[0]} onRun={runAI} onCopy={(t) => { navigator.clipboard?.writeText(t); toast.success('Copiado!'); }} />
              {m.proximoEvento && (
                <div className="rounded-2xl bg-gradient-to-r from-ink to-[#2a2a2a] p-5 text-white shadow-card">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Próximo evento</span>
                  <p className="mt-1 text-lg font-bold">{m.proximoEvento.nome_evento || 'Evento'}</p>
                  <p className="text-sm text-white/70">{m.proximoEvento.tipo_evento || '—'} · {formatDateRange(m.proximoEvento.data_inicio, m.proximoEvento.data_fim)}</p>
                  {m.proximoEvento.valor_total_num ? <p className="mt-2 text-emerald-300 font-bold">{formatMoney(m.proximoEvento.valor_total_num)}</p> : null}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'eventos' && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Eventos do cliente</h3>
              <button onClick={() => setEvModal(true)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">+ Criar evento</button>
            </div>
            {eventosCli.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">Nenhum evento vinculado. Use <strong>+ Criar evento</strong> para iniciar uma proposta.</p>
            ) : (
              <div className="space-y-2">
                {[...eventosCli].sort((a, b) => (b.data_inicio || b.criado_em || '').localeCompare(a.data_inicio || a.criado_em || '')).map((e) => {
                  const g = grupoDe(e.status);
                  return (
                    <Link key={e.id} href={`/painel/leads?evento=${e.id}`} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 transition hover:border-brand/30 hover:bg-brand-50/30">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{e.nome_evento || 'Evento'}</p>
                        <p className="text-xs text-ink-muted">{e.tipo_evento || '—'} · {formatDateRange(e.data_inicio, e.data_fim) || 'sem data'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${GRUPO_CLS[g]}`}>{e.status}</span>
                      {e.valor_total_num ? <span className="shrink-0 text-sm font-bold text-ink">{formatMoneyShort(e.valor_total_num)}</span> : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'financeiro' && <FinanceiroTab metrics={m} parcelas={parcelas} eventosCli={eventosCli} now={now} />}

        {tab === 'interacoes' && <InteracoesTab interacoes={interacoes} eventosCli={eventosCli} onAdd={addInteracao} onRemove={rmInteracao} />}

        {tab === 'documentos' && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-ink-muted text-xl">📄</div>
            <p className="text-sm font-semibold text-ink">Documentos do cliente</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">Contratos e arquivos por cliente aparecerão aqui. As licenças do espaço ficam em <Link href="/painel/documentos" className="font-semibold text-brand underline">Documentos</Link>.</p>
          </div>
        )}

        {tab === 'avaliacoes' && (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-4 text-base font-bold text-ink">Avaliações & feedbacks</h3>
            {avaliacoes.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">Nenhuma avaliação encontrada para este cliente. As avaliações públicas ficam em <Link href="/painel/avaliacoes" className="font-semibold text-brand underline">Avaliações</Link>.</p>
            ) : (
              <div className="space-y-3">
                {avaliacoes.map((a) => (
                  <div key={String(a.id)} className="rounded-xl border border-black/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-500">{'★'.repeat(Math.round(a.nota || 0))}<span className="text-black/15">{'★'.repeat(5 - Math.round(a.nota || 0))}</span></span>
                      <span className="text-xs text-ink-muted">{a.data || (a.criado_em ? formatDate(a.criado_em, { style: 'short' }) : '')}</span>
                    </div>
                    {a.texto && <p className="mt-1.5 text-sm text-ink-soft">{a.texto}</p>}
                    {a.evento_tipo && <span className="mt-1 inline-block rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.65rem] text-ink-muted">{a.evento_tipo}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'campanhas' && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-ink-muted text-xl">📣</div>
            <p className="text-sm font-semibold text-ink">Campanhas recebidas</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">Quando este cliente entrar em uma campanha (e-mail/WhatsApp), o histórico de envios, aberturas e cliques aparece aqui.</p>
          </div>
        )}
      </div>

      {evModal && <NovoEventoModal nome={draft.nome} onClose={() => setEvModal(false)} onCreate={criarEvento} />}
    </div>
  );
}

// ── Aba Financeiro ──
function FinanceiroTab({ metrics, parcelas, eventosCli, now }: { metrics: ReturnType<typeof metricsCliente>; parcelas: ParcelaLite[]; eventosCli: EventoLite[]; now: Date }) {
  const ids = new Set(eventosCli.map((e) => e.id));
  const ps = parcelas.filter((p) => ids.has(p.evento_id)).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
  const hoje = ymd(now);
  const aVencer = ps.filter((p) => p.status !== 'pago' && p.status !== 'cancelado' && (!p.vencimento || p.vencimento >= hoje)).reduce((s, p) => s + p.valor, 0);
  const total = metrics.recebido + metrics.emAberto || 1;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Resumo financeiro</h3>
        <div className="grid grid-cols-3 gap-3">
          <Cell label="Recebido" value={formatMoneyShort(metrics.recebido)} tone="text-emerald-600" />
          <Cell label="Em aberto" value={formatMoneyShort(metrics.emAberto)} tone="text-amber-600" />
          <Cell label="Vencido" value={formatMoneyShort(metrics.vencido)} tone="text-red-600" />
        </div>
        <div className="mt-4 space-y-2.5">
          <Bar label="Recebido" value={metrics.recebido} total={total} cor="#10b981" />
          <Bar label="A vencer" value={aVencer} total={total} cor="#f59e0b" />
          <Bar label="Vencido" value={metrics.vencido} total={total} cor="#ef4444" />
        </div>
        <p className="mt-4 text-xs text-ink-muted">Valor contratado na vida: <strong className="text-ink">{formatMoney(metrics.valorContratado)}</strong>{metrics.valorContratado > 0 && <> · adimplência {formatPercent(metrics.recebido / metrics.valorContratado)}</>}</p>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Parcelas</h3>
          <Link href="/painel/recebiveis" className="text-xs font-semibold text-brand hover:underline">Recebíveis →</Link>
        </div>
        {ps.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Sem parcelas registradas.</p> : (
          <div className="space-y-1.5">
            {ps.map((p) => {
              const venc = p.status !== 'pago' && p.vencimento && p.vencimento < hoje;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-muted">{p.vencimento ? formatDate(p.vencimento, { style: 'short' }) : '—'}</span>
                  <span className="font-semibold text-ink-soft">{formatMoney(p.valor)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${p.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : venc ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{p.status === 'pago' ? 'Pago' : venc ? 'Atrasado' : 'A vencer'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba Interações (timeline) ──
function InteracoesTab({ interacoes, eventosCli, onAdd, onRemove }: { interacoes: Interacao[]; eventosCli: EventoLite[]; onAdd: (t: TipoInteracao, c: string, d: string) => void; onRemove: (id: string) => void }) {
  const [tipo, setTipo] = useState<TipoInteracao>('nota');
  const [conteudo, setConteudo] = useState('');
  const [data, setData] = useState(ymd(new Date()));
  // timeline: interações manuais + marcos automáticos dos eventos
  const auto = eventosCli.filter((e) => e.data_inicio).map((e) => ({ tipo: 'evento' as const, data: e.data_inicio!, texto: `${grupoDe(e.status) === 'finalizados' ? 'Evento realizado' : 'Evento'}: ${e.nome_evento || e.tipo_evento || 'Evento'}` }));
  const linha = [
    ...interacoes.map((i) => ({ tipo: i.tipo, data: i.data, texto: i.conteudo || '', id: i.id })),
    ...auto,
  ].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl bg-white p-5 shadow-card lg:h-fit">
        <h3 className="mb-3 text-base font-bold text-ink">Registrar interação</h3>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {INTERACOES.map((i) => <button key={i.v} onClick={() => setTipo(i.v)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${tipo === i.v ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>{i.icon} {i.label}</button>)}
          </div>
          <textarea rows={3} className={inp} value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="O que foi conversado / combinado?" />
          <input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} />
          <button onClick={() => { onAdd(tipo, conteudo, data ? data + 'T12:00:00' : new Date().toISOString()); setConteudo(''); }} disabled={!conteudo.trim()} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">Adicionar à timeline</button>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Timeline</h3>
        {linha.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Nenhuma interação registrada ainda.</p> : (
          <div className="space-y-3">
            {linha.map((item, i) => {
              const isEvento = item.tipo === 'evento';
              const meta = !isEvento ? INTERACAO_BY[item.tipo] : { icon: '🎉', label: 'Evento' };
              return (
                <div key={('id' in item ? item.id : `auto-${i}`)} className="group flex gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${isEvento ? 'bg-blue-50' : 'bg-brand-50'}`}>{meta?.icon}</span>
                  <div className="min-w-0 flex-1 border-b border-black/[0.05] pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-soft">{meta?.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-muted">{item.data ? formatDate(item.data, { style: 'short' }) : ''}</span>
                        {'id' in item && <button onClick={() => onRemove(item.id)} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>}
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">{item.texto}</p>
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

// ── Painel de IA (Pro+) ──
function AiPanel({ isPro, loading, out, primeiroNome, onRun, onCopy }: {
  isPro: boolean; loading: string | null; out: { action: string; text: string } | null; primeiroNome: string;
  onRun: (a: 'summary' | 'next_action' | 'reactivation') => void; onCopy: (t: string) => void;
}) {
  if (!isPro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-brand-50 p-5 shadow-card">
        <div className="flex items-center gap-2"><span className="text-lg">✨</span><h3 className="text-base font-bold text-ink">Assistente de IA</h3></div>
        <p className="mt-1 text-sm text-ink-soft">Resumo do cliente, próxima melhor ação e rascunho de reativação — exclusivo dos planos Pro e Ultra.</p>
        <Link href="/painel/planos" className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-amber-500 to-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90">⭐ Fazer upgrade</Link>
      </div>
    );
  }
  const texto = out ? out.text.replace(/\{\{\s*nome\s*\}\}/gi, primeiroNome) : '';
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2"><span className="text-lg">✨</span><h3 className="text-base font-bold text-ink">Assistente de IA</h3></div>
      <div className="grid grid-cols-1 gap-2">
        <AiBtn label="📋 Resumir cliente" busy={loading === 'summary'} onClick={() => onRun('summary')} />
        <AiBtn label="🎯 Próxima melhor ação" busy={loading === 'next_action'} onClick={() => onRun('next_action')} />
        <AiBtn label="💬 Rascunho de reativação" busy={loading === 'reactivation'} onClick={() => onRun('reactivation')} />
      </div>
      {out && (
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{texto}</p>
          <button onClick={() => onCopy(texto)} className="mt-2 text-xs font-semibold text-brand hover:underline">Copiar</button>
        </div>
      )}
    </div>
  );
}
function AiBtn({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={busy} className="rounded-xl border border-black/10 px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition hover:border-brand/30 hover:text-brand disabled:opacity-50">{busy ? 'Gerando…' : label}</button>;
}

// ── Modal novo evento ──
function NovoEventoModal({ nome, onClose, onCreate }: { nome: string; onClose: () => void; onCreate: (nomeEvento: string, tipo: string) => void }) {
  const TIPOS = ['Casamento', 'Aniversário', 'Corporativo', 'Formatura', 'Batizado', 'Outro'];
  const [nomeEvento, setNomeEvento] = useState('');
  const [tipo, setTipo] = useState(TIPOS[0]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-12 w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-1 font-display text-xl font-bold text-ink">Criar evento</h3>
        <p className="mb-5 text-sm text-ink-muted">Vinculado a <strong>{nome}</strong>. Os dados de contato são pré-preenchidos.</p>
        <div className="space-y-4">
          <Campo label="Nome do evento"><input className={inp} value={nomeEvento} onChange={(e) => setNomeEvento(e.target.value)} autoFocus placeholder={`Ex: Casamento ${nome.split(' ')[0]}`} /></Campo>
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Campo>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button onClick={() => onCreate(nomeEvento, tipo)} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600">Criar e vincular</button>
          <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Pequenos componentes ──
function TagAdder({ onAdd }: { onAdd: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-dashed border-black/20 px-2 py-0.5 text-xs font-medium text-ink-muted hover:border-brand/40 hover:text-brand">+ tag</button>;
  return (
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim()) onAdd(v); setV(''); setOpen(false); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(v); setV(''); } if (e.key === 'Escape') { setV(''); setOpen(false); } }}
      placeholder="nova tag" className="w-24 rounded-full border border-black/15 px-2 py-0.5 text-xs focus:border-brand focus:outline-none" />
  );
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>{children}</label>;
}
function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'ink' | 'gold' | 'azul' | 'verde' | 'vermelho' }) {
  const color = { ink: 'text-ink', gold: 'text-amber-600', azul: 'text-blue-600', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-card">
      <div className="text-[0.68rem] text-ink-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[0.62rem] text-ink-muted">{sub}</div>}
    </div>
  );
}
function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-xl bg-black/[0.02] p-3 text-center"><div className="text-[0.65rem] text-ink-muted">{label}</div><div className={`mt-1 text-base font-bold ${tone}`}>{value}</div></div>;
}
function Bar({ label, value, total, cor }: { label: string; value: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return <div><div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-soft">{label}</span><span className="font-semibold text-ink-muted">{formatMoneyShort(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} /></div></div>;
}
