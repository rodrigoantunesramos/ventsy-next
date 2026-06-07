'use client';

// Ficha do fornecedor (cadastro 360º) — /painel/fornecedores/[id].
// Raio-x de um parceiro: cabeçalho com contatos acionáveis + categoria +
// homologação + avaliação, métricas (gasto total/ano, nota, prazo) e abas:
// Visão geral (dados + condições + banco + homologação + IA Pro+) ·
// Histórico de compras (puxa de Contas a pagar / lançamentos) · Avaliações
// (qualidade/prazo/preço/atendimento, pós-evento) · Documentos (contrato,
// certidões, alvará — com alerta de vencimento) · Contatos. Edição com
// auto-save (mesmo padrão da ficha de Clientes). Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Fornecedor, type Contato, type Avaliacao, type FornDoc, type DespesaLite, type EventoLite,
  type CriterioKey, type Homologacao,
  CATEGORIAS, CAT_BY, catLabel, catCor, HOMOLOGACOES, HOMOLOG_BY, CRITERIOS, DOC_TIPOS, DOC_TIPO_LABEL,
  CHECKLIST_HOMOLOG, DOC_STATUS_META, docStatus, diasRestantes, diasLabel, formatBytes,
  notaDeCriterios, iniciais, waLink, telLink, mailLink, siteLink, ymd,
  uploadDoc, signedUrl, removeArquivo, isImagem, isPdf,
} from '../_lib';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
type Tab = 'visao' | 'compras' | 'avaliacoes' | 'documentos' | 'contatos';
const TABS: { v: Tab; label: string }[] = [
  { v: 'visao', label: 'Visão geral' }, { v: 'compras', label: 'Histórico de compras' },
  { v: 'avaliacoes', label: 'Avaliações' }, { v: 'documentos', label: 'Documentos' }, { v: 'contatos', label: 'Contatos' },
];

export default function FornecedorFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const anoRef = useMemo(() => new Date().getFullYear(), []);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const isPro = plano === 'pro' || plano === 'ultra';

  const [despesas, setDespesas] = useState<DespesaLite[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [docs, setDocs] = useState<FornDoc[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [tab, setTab] = useState<Tab>('visao');

  // draft + auto-save
  const [draft, setDraft] = useState<Fornecedor | null>(null);
  const draftRef = useRef<Fornecedor | null>(null);
  const [saude, setSaude] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // modais
  const [compraModal, setCompraModal] = useState(false);
  const [avalModal, setAvalModal] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [contatoModal, setContatoModal] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const { data: f } = await sb.from('fornecedores').select('*').eq('id', id).eq('usuario_id', uid).maybeSingle();
    if (!f) { setNotFound(true); return; }
    const forn = {
      ...f, tags: Array.isArray(f.tags) ? f.tags : [], banco: f.banco && typeof f.banco === 'object' ? f.banco : {},
      avaliacao_media: Number(f.avaliacao_media) || 0, avaliacao_n: Number(f.avaliacao_n) || 0,
    } as Fornecedor;
    draftRef.current = forn; setDraft(forn);
    const [dRes, aRes, docRes, cRes, evRes] = await Promise.all([
      sb.from('lancamentos').select('id,fornecedor_id,categoria,descricao,valor,data,status,tipo_evento,metodo_pagamento').eq('usuario_id', uid).eq('fornecedor_id', id).eq('tipo', 'despesa').order('data', { ascending: false }),
      sb.from('fornecedores_avaliacoes').select('*').eq('usuario_id', uid).eq('fornecedor_id', id).order('data', { ascending: false }),
      sb.from('fornecedores_docs').select('*').eq('usuario_id', uid).eq('fornecedor_id', id).order('validade', { ascending: true }),
      sb.from('fornecedores_contatos').select('*').eq('usuario_id', uid).eq('fornecedor_id', id).order('principal', { ascending: false }),
      sb.from('clientes_eventos').select('id,nome_evento,tipo_evento,data_inicio').eq('usuario_id', uid).order('data_inicio', { ascending: false }).limit(200),
    ]);
    setDespesas(dRes.error ? [] : ((dRes.data || []) as DespesaLite[]).map((d) => ({ ...d, id: Number(d.id), valor: Number(d.valor) || 0 })));
    setAvaliacoes(aRes.error ? [] : ((aRes.data || []) as Avaliacao[]).map((a) => ({ ...a, nota: Number(a.nota) || 0, criterios: a.criterios && typeof a.criterios === 'object' ? a.criterios : {} })));
    setDocs(docRes.error ? [] : (docRes.data || []) as FornDoc[]);
    setContatos(cRes.error ? [] : (cRes.data || []) as Contato[]);
    setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
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

  // ── Métricas ──
  const gasto = useMemo(() => {
    const total = despesas.reduce((s, d) => s + d.valor, 0);
    const ytd = despesas.filter((d) => (d.data || '').slice(0, 4) === String(anoRef)).reduce((s, d) => s + d.valor, 0);
    const aberto = despesas.filter((d) => d.status !== 'pago').reduce((s, d) => s + d.valor, 0);
    return { total, ytd, aberto, n: despesas.length };
  }, [despesas, anoRef]);
  // Avaliação recalculada das avaliações carregadas (UI imediata; o trigger mantém
  // fornecedores.avaliacao_media para a Lista, que não carrega as avaliações).
  const aval = useMemo(() => {
    if (!avaliacoes.length) return { media: 0, n: 0, criterios: {} as Record<CriterioKey, number> };
    const media = avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length;
    const criterios = {} as Record<CriterioKey, number>;
    for (const k of CRITERIOS) {
      const vals = avaliacoes.map((a) => a.criterios[k.v]).filter((n): n is number => typeof n === 'number' && n > 0);
      if (vals.length) criterios[k.v] = vals.reduce((s, n) => s + n, 0) / vals.length;
    }
    return { media, n: avaliacoes.length, criterios };
  }, [avaliacoes]);
  const docsVencidos = useMemo(() => docs.filter((d) => docStatus(d.validade) === 'vencido').length, [docs]);
  const docsAvencer = useMemo(() => docs.filter((d) => docStatus(d.validade) === 'avencer').length, [docs]);

  // ── Auto-save ──
  function montar(d: Fornecedor) {
    return {
      tipo: d.tipo, nome: d.nome.trim() || 'Sem nome', fantasia: d.fantasia || null, doc: d.doc || null,
      categoria: d.categoria, contato: d.contato || null, email: d.email || null, telefone: d.telefone || null,
      whatsapp: d.whatsapp || null, site: d.site || null, endereco: d.endereco || null, cidade: d.cidade || null,
      estado: (d.estado || '').toUpperCase().slice(0, 2) || null, condicoes_pagamento: d.condicoes_pagamento || null,
      prazo_entrega_dias: d.prazo_entrega_dias ?? null, chave_pix: d.chave_pix || null, banco: d.banco || {},
      homologacao: d.homologacao, tags: d.tags || [], ativo: d.ativo, obs: d.obs || null,
    };
  }
  const persist = useCallback(async () => {
    const d = draftRef.current; if (!d || !userId) return;
    const { error } = await sb.from('fornecedores').update(montar(d)).eq('id', d.id).eq('usuario_id', userId);
    if (error) { setSaude('idle'); toast.error('Erro ao salvar.'); return; }
    setSaude('saved'); setTimeout(() => setSaude((s) => (s === 'saved' ? 'idle' : s)), 1400);
  }, [userId, toast]);
  function scheduleSave() { if (saveTimer.current) clearTimeout(saveTimer.current); setSaude('saving'); saveTimer.current = setTimeout(() => void persist(), 700); }
  function updateDraft(patch: Partial<Fornecedor>) { const nd = { ...(draftRef.current as Fornecedor), ...patch }; draftRef.current = nd; setDraft(nd); scheduleSave(); }
  function updateBanco(patch: Partial<Fornecedor['banco']>) { updateDraft({ banco: { ...(draftRef.current?.banco || {}), ...patch } }); }

  async function excluir() {
    if (!userId || !draft) return;
    if (!confirm(`Excluir o fornecedor "${draft.fantasia || draft.nome}"? Avaliações, documentos e contatos serão removidos. As despesas são desvinculadas, não apagadas.`)) return;
    const { error } = await sb.from('fornecedores').delete().eq('id', draft.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Fornecedor removido.'); router.push('/painel/fornecedores');
  }

  // ── Sub-entidades (mutação local imediata) ──
  async function addCompra(payload: { valor: number; data: string; categoria: string; descricao: string; status: string; metodo: string }) {
    if (!userId || !draft) return;
    const { data, error } = await sb.from('lancamentos').insert({
      usuario_id: userId, fornecedor_id: draft.id, tipo: 'despesa', categoria: payload.categoria || catLabel(draft.categoria),
      descricao: payload.descricao || null, valor: payload.valor, status: payload.status, data: payload.data,
      metodo_pagamento: payload.metodo || null,
    }).select().single();
    if (error || !data) { toast.error('Erro ao registrar compra.'); return; }
    setDespesas((arr) => [{ ...(data as DespesaLite), id: Number(data.id), valor: Number(data.valor) || 0 }, ...arr]);
    setCompraModal(false); toast.success('Compra registrada e lançada no Financeiro.');
  }
  async function rmCompra(lid: number) {
    if (!userId) return;
    const { error } = await sb.from('lancamentos').delete().eq('id', lid).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setDespesas((arr) => arr.filter((d) => d.id !== lid));
  }

  async function addAvaliacao(payload: { criterios: Partial<Record<CriterioKey, number>>; comentario: string; data: string; evento_id: string | null }) {
    if (!userId || !draft) return;
    const nota = notaDeCriterios(payload.criterios);
    const { data, error } = await sb.from('fornecedores_avaliacoes').insert({
      usuario_id: userId, fornecedor_id: draft.id, evento_id: payload.evento_id, nota,
      criterios: payload.criterios, comentario: payload.comentario || null, data: payload.data,
    }).select().single();
    if (error || !data) { toast.error('Erro ao registrar avaliação.'); return; }
    setAvaliacoes((arr) => [{ ...(data as Avaliacao), nota: Number(data.nota) || 0 }, ...arr]);
    setAvalModal(false); toast.success('Avaliação registrada.');
  }
  async function rmAvaliacao(aid: string) {
    if (!userId) return;
    const { error } = await sb.from('fornecedores_avaliacoes').delete().eq('id', aid).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setAvaliacoes((arr) => arr.filter((a) => a.id !== aid));
  }

  async function addDoc(row: Omit<FornDoc, 'id' | 'fornecedor_id' | 'usuario_id' | 'criado_em'>) {
    if (!userId || !draft) return;
    const { data, error } = await sb.from('fornecedores_docs').insert({ ...row, usuario_id: userId, fornecedor_id: draft.id }).select().single();
    if (error || !data) { toast.error('Erro ao salvar documento.'); return; }
    setDocs((arr) => [...arr, data as FornDoc].sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999')));
    setDocModal(false); toast.success('Documento adicionado.');
  }
  async function rmDoc(d: FornDoc) {
    if (!userId) return;
    if (d.arquivo_url) await removeArquivo(d.arquivo_url);
    const { error } = await sb.from('fornecedores_docs').delete().eq('id', d.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setDocs((arr) => arr.filter((x) => x.id !== d.id));
  }

  async function addContato(row: { nome: string; cargo: string; email: string; telefone: string; whatsapp: string; principal: boolean }) {
    if (!userId || !draft) return;
    const { data, error } = await sb.from('fornecedores_contatos').insert({
      usuario_id: userId, fornecedor_id: draft.id, nome: row.nome.trim(), cargo: row.cargo || null,
      email: row.email || null, telefone: row.telefone || null, whatsapp: row.whatsapp || null, principal: row.principal,
    }).select().single();
    if (error || !data) { toast.error('Erro ao salvar contato.'); return; }
    setContatos((arr) => [data as Contato, ...arr]);
    setContatoModal(false); toast.success('Contato adicionado.');
  }
  async function rmContato(cid: string) {
    if (!userId) return;
    const { error } = await sb.from('fornecedores_contatos').delete().eq('id', cid).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setContatos((arr) => arr.filter((c) => c.id !== cid));
  }

  // ── IA (Pro+) ──
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiOut, setAiOut] = useState<{ action: string; text: string } | null>(null);
  async function runAI(action: 'resumo' | 'negociacao' | 'risco') {
    if (!draft) return;
    setAiLoading(action); setAiOut(null);
    try {
      const res = await fetch('/api/fornecedores/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ action, fornecedor_id: draft.id }) });
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[300px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }
  if (notFound || !draft) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/painel/fornecedores" className="text-sm font-semibold text-brand hover:underline">← Voltar para Fornecedores</Link>
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
          <p className="text-base font-semibold text-ink">Fornecedor não encontrado</p>
          <p className="mt-1 text-sm text-ink-muted">Ele pode ter sido removido ou pertence a outra conta.</p>
        </div>
      </div>
    );
  }

  const wa = waLink(draft.whatsapp || draft.telefone);
  const tel = telLink(draft.telefone || draft.whatsapp);
  const mail = mailLink(draft.email);
  const site = siteLink(draft.site);
  const cor = catCor(draft.categoria);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb + status de salvamento */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/painel/fornecedores" className="text-sm font-semibold text-brand hover:underline">← Fornecedores</Link>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${saude === 'saving' ? 'bg-amber-50 text-amber-700' : saude === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'text-ink-muted'}`}>
          {saude === 'saving' ? 'Salvando…' : saude === 'saved' ? 'Salvo ✓' : ''}
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: cor }}>{iniciais(draft.fantasia || draft.nome)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink sm:text-2xl">{draft.fantasia || draft.nome}</h1>
              <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[0.62rem] font-bold uppercase text-ink-muted">{draft.tipo === 'pj' ? 'PJ' : 'PF'}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: cor }} />{catLabel(draft.categoria)}</span>
              {!draft.ativo && <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-semibold text-ink-muted">Inativo</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
              {draft.fantasia && <span>{draft.nome}</span>}
              {draft.cidade && <span>· {draft.cidade}{draft.estado ? `/${draft.estado}` : ''}</span>}
              {draft.contato && <span>· {draft.contato}</span>}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Stars media={aval.media} n={aval.n} />
              {/* Homologação (editável) */}
              <select value={draft.homologacao} onChange={(e) => updateDraft({ homologacao: e.target.value as Homologacao })} className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 ${HOMOLOG_BY[draft.homologacao].cls}`}>
                {HOMOLOGACOES.map((h) => <option key={h.v} value={h.v}>{h.label}</option>)}
              </select>
              {(docsVencidos > 0 || docsAvencer > 0) && (
                <button onClick={() => setTab('documentos')} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${docsVencidos ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {docsVencidos ? `${docsVencidos} doc(s) vencido(s)` : `${docsAvencer} doc(s) a vencer`}
                </button>
              )}
            </div>
          </div>
          {/* Ações de contato */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">💬 WhatsApp</a>}
            {tel && <a href={tel} className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand" title="Ligar">📞</a>}
            {mail && <a href={mail} className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand" title="E-mail">✉️</a>}
            {site && <a href={site} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 text-ink-soft hover:border-brand/30 hover:text-brand" title="Site">🌐</a>}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Gasto total" value={formatMoneyShort(gasto.total)} tone="gold" />
        <Metric label={`Gasto em ${anoRef}`} value={formatMoneyShort(gasto.ytd)} tone="ink" />
        <Metric label="Compras" value={formatNumber(gasto.n)} sub={gasto.aberto > 0 ? `${formatMoneyShort(gasto.aberto)} em aberto` : 'em dia'} tone={gasto.aberto > 0 ? 'vermelho' : 'verde'} />
        <Metric label="Avaliação" value={aval.n ? `${aval.media.toFixed(1)}★` : '—'} sub={aval.n ? `${aval.n} avaliação(ões)` : 'sem avaliação'} tone="azul" />
        <Metric label="Prazo de entrega" value={draft.prazo_entrega_dias != null ? `${draft.prazo_entrega_dias}d` : '—'} sub={draft.condicoes_pagamento || 'condições'} tone="ink" />
      </div>

      {/* Abas */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
        {TABS.map((t) => {
          const n = t.v === 'compras' ? gasto.n : t.v === 'avaliacoes' ? avaliacoes.length : t.v === 'documentos' ? docs.length : t.v === 'contatos' ? contatos.length : 0;
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
            <div className="space-y-5">
              {/* Dados */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-4 text-base font-bold text-ink">Dados do fornecedor</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label={draft.tipo === 'pj' ? 'Razão social' : 'Nome'}><input className={inp} value={draft.nome} onChange={(e) => updateDraft({ nome: e.target.value })} /></Campo>
                    <Campo label="Nome fantasia"><input className={inp} value={draft.fantasia || ''} onChange={(e) => updateDraft({ fantasia: e.target.value })} /></Campo>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_140px] gap-3">
                    <Campo label="Tipo"><select className={inp} value={draft.tipo} onChange={(e) => updateDraft({ tipo: e.target.value as 'pf' | 'pj' })}><option value="pj">Pessoa Jurídica</option><option value="pf">Pessoa Física</option></select></Campo>
                    <Campo label={draft.tipo === 'pj' ? 'CNPJ' : 'CPF'}><input className={inp} value={draft.doc || ''} onChange={(e) => updateDraft({ doc: e.target.value })} /></Campo>
                    <Campo label="Categoria"><select className={inp} value={draft.categoria} onChange={(e) => updateDraft({ categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></Campo>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Pessoa de contato"><input className={inp} value={draft.contato || ''} onChange={(e) => updateDraft({ contato: e.target.value })} /></Campo>
                    <Campo label="E-mail"><input type="email" className={inp} value={draft.email || ''} onChange={(e) => updateDraft({ email: e.target.value })} /></Campo>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Campo label="Telefone"><input type="tel" className={inp} value={draft.telefone || ''} onChange={(e) => updateDraft({ telefone: e.target.value })} /></Campo>
                    <Campo label="WhatsApp"><input type="tel" className={inp} value={draft.whatsapp || ''} onChange={(e) => updateDraft({ whatsapp: e.target.value })} /></Campo>
                    <Campo label="Site"><input className={inp} value={draft.site || ''} onChange={(e) => updateDraft({ site: e.target.value })} placeholder="exemplo.com.br" /></Campo>
                  </div>
                  <Campo label="Endereço"><input className={inp} value={draft.endereco || ''} onChange={(e) => updateDraft({ endereco: e.target.value })} /></Campo>
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <Campo label="Cidade"><input className={inp} value={draft.cidade || ''} onChange={(e) => updateDraft({ cidade: e.target.value })} /></Campo>
                    <Campo label="UF"><input className={inp} maxLength={2} value={draft.estado || ''} onChange={(e) => updateDraft({ estado: e.target.value })} /></Campo>
                  </div>
                  <Campo label="Observações"><textarea rows={3} className={inp} value={draft.obs || ''} onChange={(e) => updateDraft({ obs: e.target.value })} placeholder="Anotações internas sobre o fornecedor…" /></Campo>
                </div>
              </div>

              {/* Condições comerciais + banco */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-4 text-base font-bold text-ink">Condições comerciais & pagamento</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Condições de pagamento"><input className={inp} value={draft.condicoes_pagamento || ''} onChange={(e) => updateDraft({ condicoes_pagamento: e.target.value })} placeholder="Ex: 30/60/90 dias" /></Campo>
                    <Campo label="Prazo de entrega (dias)"><input type="number" min={0} className={inp} value={draft.prazo_entrega_dias ?? ''} onChange={(e) => updateDraft({ prazo_entrega_dias: e.target.value ? Number(e.target.value) : null })} /></Campo>
                  </div>
                  <Campo label="Chave Pix"><input className={inp} value={draft.chave_pix || ''} onChange={(e) => updateDraft({ chave_pix: e.target.value })} placeholder="CNPJ, e-mail, telefone ou aleatória" /></Campo>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Campo label="Banco"><input className={inp} value={draft.banco?.banco || ''} onChange={(e) => updateBanco({ banco: e.target.value })} /></Campo>
                    <Campo label="Agência"><input className={inp} value={draft.banco?.agencia || ''} onChange={(e) => updateBanco({ agencia: e.target.value })} /></Campo>
                    <Campo label="Conta"><input className={inp} value={draft.banco?.conta || ''} onChange={(e) => updateBanco({ conta: e.target.value })} /></Campo>
                    <Campo label="Titular"><input className={inp} value={draft.banco?.titular || ''} onChange={(e) => updateBanco({ titular: e.target.value })} /></Campo>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 border-t border-black/[0.06] pt-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft"><input type="checkbox" checked={draft.ativo} onChange={(e) => updateDraft({ ativo: e.target.checked })} className="h-4 w-4 accent-brand" /> Fornecedor ativo</label>
                  <button onClick={excluir} className="ml-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Excluir fornecedor</button>
                </div>
              </div>
            </div>

            {/* Sidebar: homologação + IA */}
            <div className="space-y-5">
              <HomologacaoCard docs={docs} status={draft.homologacao} onSetStatus={(h) => updateDraft({ homologacao: h })} />
              <AiPanel isPro={isPro} loading={aiLoading} out={aiOut} onRun={runAI} onCopy={(t) => { navigator.clipboard?.writeText(t); toast.success('Copiado!'); }} />
            </div>
          </div>
        )}

        {tab === 'compras' && <ComprasTab despesas={despesas} gasto={gasto} anoRef={anoRef} onNew={() => setCompraModal(true)} onRemove={rmCompra} />}

        {tab === 'avaliacoes' && <AvaliacoesTab avaliacoes={avaliacoes} aval={aval} eventos={eventos} onNew={() => setAvalModal(true)} onRemove={rmAvaliacao} />}

        {tab === 'documentos' && <DocumentosTab docs={docs} onNew={() => setDocModal(true)} onRemove={rmDoc} />}

        {tab === 'contatos' && <ContatosTab contatos={contatos} onNew={() => setContatoModal(true)} onRemove={rmContato} />}
      </div>

      {compraModal && <RegistrarCompraModal categoriaForn={draft.categoria} onClose={() => setCompraModal(false)} onSave={addCompra} />}
      {avalModal && <AvaliacaoModal eventos={eventos} onClose={() => setAvalModal(false)} onSave={addAvaliacao} />}
      {docModal && userId && <DocModal userId={userId} onClose={() => setDocModal(false)} onSave={addDoc} />}
      {contatoModal && <ContatoModal onClose={() => setContatoModal(false)} onSave={addContato} />}
    </div>
  );
}

// ── Aba: Histórico de compras (Contas a pagar) ──────────────────────────────────
function ComprasTab({ despesas, gasto, anoRef, onNew, onRemove }: { despesas: DespesaLite[]; gasto: { total: number; ytd: number; aberto: number; n: number }; anoRef: number; onNew: () => void; onRemove: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <div className="rounded-2xl bg-white p-5 shadow-card lg:h-fit">
        <h3 className="mb-4 text-base font-bold text-ink">Resumo de compras</h3>
        <div className="space-y-3">
          <Cell label="Gasto total (vida)" value={formatMoney(gasto.total)} tone="text-amber-600" />
          <Cell label={`Gasto em ${anoRef}`} value={formatMoney(gasto.ytd)} tone="text-ink" />
          <Cell label="Em aberto" value={formatMoney(gasto.aberto)} tone="text-red-600" />
        </div>
        <button onClick={onNew} className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Registrar compra</button>
        <p className="mt-3 text-xs text-ink-muted">Cada compra vira uma despesa em <Link href="/painel/financeiro" className="font-semibold text-brand underline">Financeiro</Link>, vinculada a este fornecedor.</p>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Compras, pedidos & contratos</h3>
        {despesas.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhuma compra registrada. Use <strong>+ Registrar compra</strong> ou vincule despesas a este fornecedor no Financeiro.</p>
        ) : (
          <div className="space-y-1.5">
            {despesas.map((d) => {
              const pago = d.status === 'pago';
              return (
                <div key={d.id} className="group flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{d.descricao || d.categoria || 'Compra'}</p>
                    <p className="text-xs text-ink-muted">{d.data ? formatDate(d.data, { style: 'short' }) : '—'}{d.categoria ? ` · ${d.categoria}` : ''}{d.metodo_pagamento ? ` · ${d.metodo_pagamento}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${pago ? 'bg-emerald-50 text-emerald-700' : d.status === 'atrasado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{pago ? 'Pago' : d.status === 'atrasado' ? 'Atrasado' : 'Pendente'}</span>
                  <span className="shrink-0 text-sm font-bold text-ink">{formatMoney(d.valor)}</span>
                  <button onClick={() => onRemove(d.id)} className="shrink-0 text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba: Avaliações ──────────────────────────────────────────────────────────────
function AvaliacoesTab({ avaliacoes, aval, eventos, onNew, onRemove }: { avaliacoes: Avaliacao[]; aval: { media: number; n: number; criterios: Partial<Record<CriterioKey, number>> }; eventos: EventoLite[]; onNew: () => void; onRemove: (id: string) => void }) {
  const evById = (eid: string | null) => eventos.find((e) => e.id === eid);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <div className="rounded-2xl bg-white p-5 shadow-card lg:h-fit">
        <h3 className="mb-3 text-base font-bold text-ink">Desempenho</h3>
        {aval.n === 0 ? (
          <p className="text-sm text-ink-muted">Ainda sem avaliações. Registre a primeira após um evento.</p>
        ) : (
          <>
            <div className="mb-4 flex items-end gap-2">
              <span className="text-3xl font-bold text-ink">{aval.media.toFixed(1)}</span>
              <span className="mb-1 text-amber-500">{'★'.repeat(Math.round(aval.media))}<span className="text-black/15">{'★'.repeat(5 - Math.round(aval.media))}</span></span>
              <span className="mb-1 text-xs text-ink-muted">· {aval.n}</span>
            </div>
            <div className="space-y-2.5">
              {CRITERIOS.map((c) => {
                const v = aval.criterios[c.v] || 0;
                return (
                  <div key={c.v}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-soft">{c.icon} {c.label}</span><span className="font-semibold text-ink-muted">{v ? v.toFixed(1) : '—'}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${(v / 5) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <button onClick={onNew} className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Avaliar pós-evento</button>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Histórico de avaliações</h3>
        {avaliacoes.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Avalie qualidade, prazo, preço e atendimento depois de cada evento para construir o histórico de desempenho.</p>
        ) : (
          <div className="space-y-3">
            {avaliacoes.map((a) => {
              const ev = evById(a.evento_id);
              return (
                <div key={a.id} className="group rounded-xl border border-black/[0.06] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-amber-500">{'★'.repeat(Math.round(a.nota))}<span className="text-black/15">{'★'.repeat(5 - Math.round(a.nota))}</span><span className="ml-1.5 text-xs font-semibold text-ink-soft">{a.nota.toFixed(1)}</span></span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted">{a.data ? formatDate(a.data, { style: 'short' }) : ''}</span>
                      <button onClick={() => onRemove(a.id)} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {CRITERIOS.map((c) => a.criterios[c.v] ? <span key={c.v} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.65rem] text-ink-muted">{c.icon} {c.label} {a.criterios[c.v]}</span> : null)}
                  </div>
                  {a.comentario && <p className="mt-2 text-sm text-ink-soft">{a.comentario}</p>}
                  {ev && <span className="mt-1.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[0.65rem] text-blue-700">🎉 {ev.nome_evento || ev.tipo_evento || 'Evento'}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba: Documentos ──────────────────────────────────────────────────────────────
function DocumentosTab({ docs, onNew, onRemove }: { docs: FornDoc[]; onNew: () => void; onRemove: (d: FornDoc) => void }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-ink">Documentos do fornecedor</h3>
        <button onClick={onNew} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">+ Adicionar documento</button>
      </div>
      {docs.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Anexe contrato, certidões (CND), alvará e seguro. Você é avisado quando algum estiver perto de vencer.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {docs.map((d) => <DocCard key={d.id} doc={d} onRemove={() => onRemove(d)} />)}
        </div>
      )}
    </div>
  );
}

function DocCard({ doc, onRemove }: { doc: FornDoc; onRemove: () => void }) {
  const toast = useToast();
  const status = docStatus(doc.validade);
  const meta = DOC_STATUS_META[status];
  const dias = diasRestantes(doc.validade);
  const [baixando, setBaixando] = useState(false);
  async function baixar() {
    if (!doc.arquivo_url) return;
    setBaixando(true);
    const url = await signedUrl(doc.arquivo_url);
    setBaixando(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Não foi possível abrir o arquivo.');
  }
  return (
    <div className="group rounded-xl border border-black/[0.06] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{doc.arquivo_tipo ? (isImagem(doc.arquivo_tipo) ? '🖼️' : isPdf(doc.arquivo_tipo) ? '📄' : '📎') : '📄'}</span>
            <span className="truncate font-semibold text-ink">{doc.nome}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">{DOC_TIPO_LABEL[doc.tipo] || doc.tipo}{doc.numero ? ` · ${doc.numero}` : ''}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-muted">{doc.validade ? <>Vence {formatDate(doc.validade, { style: 'short' })} · <span style={{ color: meta.cor }}>{diasLabel(dias)}</span></> : 'Sem vencimento'}</span>
        <div className="flex items-center gap-2">
          {doc.arquivo_url && <button onClick={baixar} disabled={baixando} className="font-semibold text-brand hover:underline disabled:opacity-50">{baixando ? '…' : 'Abrir'}</button>}
          {doc.arquivo_tamanho ? <span className="text-ink-muted">{formatBytes(doc.arquivo_tamanho)}</span> : null}
          <button onClick={onRemove} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Aba: Contatos ────────────────────────────────────────────────────────────────
function ContatosTab({ contatos, onNew, onRemove }: { contatos: Contato[]; onNew: () => void; onRemove: (id: string) => void }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-ink">Contatos</h3>
        <button onClick={onNew} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">+ Adicionar contato</button>
      </div>
      {contatos.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Cadastre as pessoas-chave do fornecedor (comercial, operacional, financeiro) para falar com a pessoa certa.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contatos.map((c) => {
            const wa = waLink(c.whatsapp || c.telefone); const tel = telLink(c.telefone || c.whatsapp); const mail = mailLink(c.email);
            return (
              <div key={c.id} className="group rounded-xl border border-black/[0.06] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="truncate font-semibold text-ink">{c.nome}</span>{c.principal && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-brand">principal</span>}</div>
                    {c.cargo && <p className="text-xs text-ink-muted">{c.cargo}</p>}
                  </div>
                  <button onClick={() => onRemove(c.id)} className="shrink-0 text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">💬 WhatsApp</a>}
                  {tel && <a href={tel} className="rounded-lg border border-black/10 px-2 py-1 text-ink-soft">📞 {c.telefone}</a>}
                  {mail && <a href={mail} className="truncate rounded-lg border border-black/10 px-2 py-1 text-ink-soft">✉️ {c.email}</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Card de homologação (checklist de documentos) ────────────────────────────────
function HomologacaoCard({ docs, status, onSetStatus }: { docs: FornDoc[]; status: Homologacao; onSetStatus: (h: Homologacao) => void }) {
  const tiposPresentes = useMemo(() => new Set(docs.filter((d) => docStatus(d.validade) !== 'vencido').map((d) => d.tipo)), [docs]);
  const obrig = CHECKLIST_HOMOLOG.filter((c) => c.obrigatorio);
  const obrigOk = obrig.every((c) => tiposPresentes.has(c.tipo));
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="mb-1 text-base font-bold text-ink">Homologação</h3>
      <p className="mb-3 text-xs text-ink-muted">Checklist de documentos para liberar o fornecedor.</p>
      <div className="space-y-2">
        {CHECKLIST_HOMOLOG.map((c) => {
          const ok = tiposPresentes.has(c.tipo);
          return (
            <div key={c.tipo} className="flex items-center gap-2 text-sm">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-black/[0.05] text-ink-muted'}`}>{ok ? '✓' : '○'}</span>
              <span className={ok ? 'text-ink-soft' : 'text-ink-muted'}>{c.label}</span>
              {c.obrigatorio && <span className="ml-auto text-[0.6rem] font-bold uppercase text-ink-muted">obrigatório</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-t border-black/[0.06] pt-3">
        {!obrigOk && status === 'homologado' && <p className="mb-2 text-xs text-amber-700">⚠️ Faltam documentos obrigatórios para manter homologado.</p>}
        <div className="flex gap-1.5">
          {HOMOLOGACOES.map((h) => <button key={h.v} onClick={() => onSetStatus(h.v)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${status === h.v ? h.cls : 'bg-black/[0.03] text-ink-muted hover:bg-black/[0.06]'}`}>{h.label}</button>)}
        </div>
      </div>
    </div>
  );
}

// ── Painel de IA (Pro+) ──────────────────────────────────────────────────────────
function AiPanel({ isPro, loading, out, onRun, onCopy }: {
  isPro: boolean; loading: string | null; out: { action: string; text: string } | null;
  onRun: (a: 'resumo' | 'negociacao' | 'risco') => void; onCopy: (t: string) => void;
}) {
  if (!isPro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-brand-50 p-5 shadow-card">
        <div className="flex items-center gap-2"><span className="text-lg">✨</span><h3 className="text-base font-bold text-ink">Assistente de IA</h3></div>
        <p className="mt-1 text-sm text-ink-soft">Raio-x do fornecedor, dicas de negociação e análise de risco/homologação — exclusivo dos planos Pro e Ultra.</p>
        <Link href="/painel/planos" className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-amber-500 to-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90">⭐ Fazer upgrade</Link>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2"><span className="text-lg">✨</span><h3 className="text-base font-bold text-ink">Assistente de IA</h3></div>
      <div className="grid grid-cols-1 gap-2">
        <AiBtn label="📋 Resumir fornecedor" busy={loading === 'resumo'} onClick={() => onRun('resumo')} />
        <AiBtn label="🤝 Dicas de negociação" busy={loading === 'negociacao'} onClick={() => onRun('negociacao')} />
        <AiBtn label="⚠️ Análise de risco" busy={loading === 'risco'} onClick={() => onRun('risco')} />
      </div>
      {out && (
        <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{out.text}</p>
          <button onClick={() => onCopy(out.text)} className="mt-2 text-xs font-semibold text-brand hover:underline">Copiar</button>
        </div>
      )}
    </div>
  );
}
function AiBtn({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={busy} className="rounded-xl border border-black/10 px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition hover:border-brand/30 hover:text-brand disabled:opacity-50">{busy ? 'Gerando…' : label}</button>;
}

// ── Modal: registrar compra (vira despesa em lançamentos) ───────────────────────
function RegistrarCompraModal({ categoriaForn, onClose, onSave }: { categoriaForn: string; onClose: () => void; onSave: (p: { valor: number; data: string; categoria: string; descricao: string; status: string; metodo: string }) => void }) {
  const CATS = ['Buffet / Catering', 'Decoração', 'Som / Iluminação', 'Estrutura', 'Locação', 'Segurança', 'Limpeza', 'Bebidas', 'Transporte', 'Outros'];
  const METODOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Dinheiro', 'Boleto'];
  const [valor, setValor] = useState(''); const [data, setData] = useState(ymd(new Date()));
  const [descricao, setDescricao] = useState(''); const [categoria, setCategoria] = useState(CAT_BY[categoriaForn]?.label || 'Outros');
  const [status, setStatus] = useState('pago'); const [metodo, setMetodo] = useState('Pix');
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);
  const n = Number(valor);
  return (
    <Modal onClose={onClose} title="Registrar compra">
      <p className="mb-4 text-sm text-ink-muted">Lança uma despesa vinculada a este fornecedor — aparece também no Financeiro.</p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Valor"><input type="number" min={0} step="0.01" inputMode="decimal" className={inp} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus placeholder="0,00" /></Campo>
          <Campo label="Data"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        </div>
        <Campo label="Descrição"><input className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Buffet casamento Maria — 120 pessoas" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Categoria"><select className={inp} value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Campo>
          <Campo label="Forma de pagamento"><select className={inp} value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m} value={m}>{m}</option>)}</select></Campo>
        </div>
        <Campo label="Status"><div className="flex gap-2">{(['pago', 'pendente', 'atrasado'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${status === s ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>{s}</button>)}</div></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onSave({ valor: n, data, categoria, descricao, status, metodo })} disabled={!n || n <= 0} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Registrar</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: avaliação pós-evento ─────────────────────────────────────────────────
function AvaliacaoModal({ eventos, onClose, onSave }: { eventos: EventoLite[]; onClose: () => void; onSave: (p: { criterios: Partial<Record<CriterioKey, number>>; comentario: string; data: string; evento_id: string | null }) => void }) {
  const [criterios, setCriterios] = useState<Partial<Record<CriterioKey, number>>>({ qualidade: 4, prazo: 4, preco: 4, atendimento: 4 });
  const [comentario, setComentario] = useState(''); const [data, setData] = useState(ymd(new Date())); const [eventoId, setEventoId] = useState('');
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);
  const nota = notaDeCriterios(criterios);
  return (
    <Modal onClose={onClose} title="Avaliar fornecedor">
      <p className="mb-4 text-sm text-ink-muted">Dê uma nota de 1 a 5 para cada critério. A nota geral é a média.</p>
      <div className="space-y-4">
        {CRITERIOS.map((c) => (
          <div key={c.v}>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-sm font-semibold text-ink-soft">{c.icon} {c.label}</span><span className="text-xs font-semibold text-ink-muted">{criterios[c.v] || 0}/5</span></div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setCriterios((cr) => ({ ...cr, [c.v]: n }))} className={`flex-1 rounded-lg py-2 text-lg transition ${(criterios[c.v] || 0) >= n ? 'bg-amber-100 text-amber-500' : 'bg-black/[0.04] text-black/15 hover:bg-black/[0.07]'}`}>★</button>)}
            </div>
          </div>
        ))}
        <div className="rounded-xl bg-black/[0.02] p-3 text-center"><span className="text-sm text-ink-muted">Nota geral: </span><span className="text-lg font-bold text-ink">{nota.toFixed(1)}★</span></div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Data"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo label="Evento (opcional)"><select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">—</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || e.tipo_evento || 'Evento'}{e.data_inicio ? ` · ${formatDate(e.data_inicio, { style: 'short' })}` : ''}</option>)}</select></Campo>
        </div>
        <Campo label="Comentário (opcional)"><textarea rows={3} className={inp} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="O que funcionou bem? O que pode melhorar?" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onSave({ criterios, comentario, data, evento_id: eventoId || null })} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Salvar avaliação</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: novo documento (upload) ──────────────────────────────────────────────
function DocModal({ userId, onClose, onSave }: { userId: string; onClose: () => void; onSave: (row: Omit<FornDoc, 'id' | 'fornecedor_id' | 'usuario_id' | 'criado_em'>) => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(''); const [tipo, setTipo] = useState('contrato'); const [numero, setNumero] = useState('');
  const [emissao, setEmissao] = useState(''); const [validade, setValidade] = useState(''); const [obs, setObs] = useState('');
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);

  async function salvar() {
    if (!nome.trim()) return;
    setBusy(true);
    let arquivo = { arquivo_url: null as string | null, arquivo_nome: null as string | null, arquivo_tipo: null as string | null, arquivo_tamanho: null as number | null };
    if (file) {
      try { arquivo = await uploadDoc(userId, file); }
      catch { setBusy(false); toast.error('Falha no upload do arquivo.'); return; }
    }
    onSave({ nome: nome.trim(), tipo, numero: numero.trim() || null, emissao: emissao || null, validade: validade || null, obs: obs.trim() || null, ...arquivo });
    setBusy(false);
  }

  return (
    <Modal onClose={onClose} title="Adicionar documento">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nome do documento"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Contrato 2026" /></Campo>
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{DOC_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
          <Campo label="Número"><input className={inp} value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
          <Campo label="Emissão"><input type="date" className={inp} value={emissao} onChange={(e) => setEmissao(e.target.value)} /></Campo>
          <Campo label="Validade"><input type="date" className={inp} value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 px-4 py-6 text-center transition hover:border-brand/40">
          <span className="text-xl">📎</span>
          <span className="text-sm font-semibold text-ink-soft">{file ? file.name : 'Anexar arquivo (PDF/imagem, opcional)'}</span>
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <Campo label="Observações"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={busy || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{busy ? 'Salvando…' : 'Adicionar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: novo contato ──────────────────────────────────────────────────────────
function ContatoModal({ onClose, onSave }: { onClose: () => void; onSave: (row: { nome: string; cargo: string; email: string; telefone: string; whatsapp: string; principal: boolean }) => void }) {
  const [nome, setNome] = useState(''); const [cargo, setCargo] = useState(''); const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState(''); const [whatsapp, setWhatsapp] = useState(''); const [principal, setPrincipal] = useState(false);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);
  return (
    <Modal onClose={onClose} title="Adicionar contato">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nome"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Joana Souza" /></Campo>
          <Campo label="Cargo / setor"><input className={inp} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Comercial" /></Campo>
        </div>
        <Campo label="E-mail"><input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Telefone"><input type="tel" className={inp} value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          <Campo label="WhatsApp"><input type="tel" className={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Campo>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft"><input type="checkbox" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} className="h-4 w-4 accent-brand" /> Contato principal</label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onSave({ nome, cargo, email, telefone, whatsapp, principal })} disabled={!nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Adicionar contato</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Pequenos componentes ──────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
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
      {sub && <div className="truncate text-[0.62rem] text-ink-muted">{sub}</div>}
    </div>
  );
}
function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2.5"><span className="text-xs text-ink-muted">{label}</span><span className={`text-sm font-bold ${tone}`}>{value}</span></div>;
}
function Stars({ media, n }: { media: number; n: number }) {
  if (!n) return <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-medium text-ink-muted">Sem avaliação</span>;
  const full = Math.round(media);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500">{'★'.repeat(full)}<span className="text-black/15">{'★'.repeat(5 - full)}</span></span>
      <span className="font-semibold text-ink-soft">{media.toFixed(1)}</span>
      <span className="text-xs text-ink-muted">({n})</span>
    </span>
  );
}
