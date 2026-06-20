'use client';

// Pesquisas & NPS pós-evento · /painel/pesquisas.
// Mede satisfação de forma ESTRUTURADA: construtor de pesquisas (NPS · CSAT ·
// escala · múltipla · texto) disparadas após o evento + dashboard de NPS com
// evolução e segmentação. Complementa Feedbacks (qualitativo/tratativa); aqui o
// foco é MÉTRICA e TENDÊNCIA. Fonte: novas tabelas `pesquisas` +
// `pesquisas_respostas` (RLS de dono) + contexto de `clientes_eventos`/
// `propriedades`. Coleta por link/QR público (token assinado) ou disparo
// automático (cron/e-mail). Motor puro em lib/pesquisas (NPS, templates). i18n via
// lib/format (sem "R$").
// ABAS: Painel (NPS · evolução · segmentação · IA Pro+) · Pesquisas (construtor) ·
//   Respostas (feed filtrável · ação detrator→tratativa / promotor→avaliação).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Pesquisa, type RespostaPesquisa, type Pergunta, type EventoLite, type PropLite,
  type TipoPesquisa, type CategoriaNps,
  TIPOS_PESQUISA, TIPO_PESQUISA_BY, GATILHO_BY, CATEGORIAS_NPS,
  normalizarPerguntas, normalizarRespostas,
  npsScore, distribuicaoNps, pctCategoria, serieMensalNps, comparativoNps, npsPorChave,
  detratoresRecentes, dentroPeriodo, npsParaNota5, respostasToCSV, isMissingTable,
} from '@/lib/pesquisas';
import {
  Kpi, NpsGauge, BarraCategorias, EvolucaoNps, NpsBar,
  IcoPoll, IcoPlus, IcoSearch, IcoDownload, IcoSparkles, IcoEdit, IcoTrash, IcoLink, IcoAlert, IcoPower,
} from './_components/ui';
import { PesquisaBuilder, type SavePayload } from './_components/PesquisaBuilder';
import { DistribuirModal } from './_components/DistribuirModal';
import { RespostaCard, type RespostaCallbacks } from './_components/RespostaCard';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 10;
type Tab = 'painel' | 'pesquisas' | 'respostas';

// ── Normalização (tolera jsonb/strings vindos do banco) ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normPesquisa(p: any): Pesquisa {
  return {
    id: String(p.id), usuario_id: p.usuario_id ?? '', titulo: p.titulo ?? 'Pesquisa',
    descricao: p.descricao ?? null, tipo: (p.tipo ?? 'nps') as TipoPesquisa,
    perguntas: normalizarPerguntas(p.perguntas), gatilho: (p.gatilho ?? 'manual'),
    dias_apos: p.dias_apos != null ? Number(p.dias_apos) : null, ativo: p.ativo ?? true,
    criado_em: p.criado_em ?? '', atualizado_em: p.atualizado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normResposta(r: any): RespostaPesquisa {
  return {
    id: String(r.id), pesquisa_id: String(r.pesquisa_id), usuario_id: r.usuario_id ?? '',
    evento_id: r.evento_id ?? null, cliente_id: r.cliente_id ?? null,
    propriedade_id: r.propriedade_id != null ? Number(r.propriedade_id) : null,
    autor_nome: r.autor_nome ?? null, autor_contato: r.autor_contato ?? null,
    respostas: normalizarRespostas(r.respostas),
    nps: r.nps != null ? Number(r.nps) : null,
    categoria: (r.categoria ?? null) as CategoriaNps | null,
    comentario: r.comentario ?? null, criado_em: r.criado_em ?? '',
  };
}

export default function PesquisasPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const isPro = plano === 'pro' || plano === 'ultra';
  const [feedbacksOk, setFeedbacksOk] = useState(false);

  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [respostas, setRespostas] = useState<RespostaPesquisa[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [props, setProps] = useState<PropLite[]>([]);

  const [tab, setTab] = useState<Tab>('painel');

  // filtros (respostas)
  const [busca, setBusca] = useState('');
  const [fPesquisa, setFPesquisa] = useState<string>('');
  const [fProp, setFProp] = useState<number | ''>('');
  const [fCategoria, setFCategoria] = useState<CategoriaNps | ''>('');
  const [fPeriodo, setFPeriodo] = useState(0);
  const [page, setPage] = useState(0);

  // modais / IA
  const [builder, setBuilder] = useState<{ open: boolean; pesquisa: Pesquisa | null }>({ open: false, pesquisa: null });
  const [distribuir, setDistribuir] = useState<Pesquisa | null>(null);
  const [iaTexto, setIaTexto] = useState('');
  const [iaBusy, setIaBusy] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const [pqRes, rpRes, evRes, prRes, fbRes] = await Promise.all([
      sb.from('pesquisas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('pesquisas_respostas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,email,propriedade_id,criado_em').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('propriedades').select('id,nome,cidade,estado').eq('usuario_id', uid).order('id'),
      sb.from('feedbacks').select('id').eq('usuario_id', uid).limit(1),
    ]);
    if (isMissingTable(pqRes.error)) { setNeedsSetup(true); setPesquisas([]); setRespostas([]); return; }
    setNeedsSetup(false);
    setPesquisas(((pqRes.data || []) as unknown[]).map(normPesquisa));
    setRespostas(((rpRes.data || []) as unknown[]).map(normResposta));
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, id: String(e.id), propriedade_id: e.propriedade_id != null ? Number(e.propriedade_id) : null })));
    setProps(((prRes.data || []) as PropLite[]).map((p) => ({ ...p, id: Number(p.id) })));
    setFeedbacksOk(!isMissingTable(fbRes.error));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      setUserId(session.user.id);
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle();
        setPlano((a?.plano_ativo || 'basico').toString().toLowerCase());
      } catch { /* plano opcional */ }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar, router]);

  useEffect(() => { setPage(0); }, [busca, fPesquisa, fProp, fCategoria, fPeriodo, tab]);

  // ── Mapas de apoio ──
  const propNome = useMemo(() => new Map(props.map((p) => [p.id, p.nome || `Espaço #${p.id}`])), [props]);
  const eventoNome = useMemo(() => {
    const m = new Map<string, string>();
    eventos.forEach((e) => m.set(e.id, e.nome_evento || e.tipo_evento || e.quem_contratou || 'Evento'));
    return m;
  }, [eventos]);
  const eventoTipo = useMemo(() => new Map(eventos.map((e) => [e.id, e.tipo_evento])), [eventos]);
  const pesquisaById = useMemo(() => new Map(pesquisas.map((p) => [p.id, p])), [pesquisas]);
  const respostasByPesquisa = useMemo(() => {
    const m = new Map<string, RespostaPesquisa[]>();
    respostas.forEach((r) => { if (!m.has(r.pesquisa_id)) m.set(r.pesquisa_id, []); m.get(r.pesquisa_id)!.push(r); });
    return m;
  }, [respostas]);

  // ── KPIs / dashboard (NPS sobre todas as respostas) ──
  const dash = useMemo(() => {
    const dist = distribuicaoNps(respostas);
    const cmp = comparativoNps(respostas, fPeriodo || 90, now);
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      nps: npsScore(respostas), dist, pct: pctCategoria(respostas),
      total: dist.total, respTotal: respostas.length,
      noMes: respostas.filter((r) => (r.criado_em || '').slice(0, 7) === mesAtual).length,
      cmp, delta: cmp.nAtual && cmp.nAnterior ? cmp.atual - cmp.anterior : 0,
    };
  }, [respostas, fPeriodo, now]);
  const serie = useMemo(() => serieMensalNps(respostas, now, 6), [respostas, now]);
  const porProp = useMemo(() => npsPorChave(respostas, (r) => (r.propriedade_id != null ? propNome.get(r.propriedade_id) || '—' : '—')), [respostas, propNome]);
  const porTipo = useMemo(() => npsPorChave(respostas, (r) => (r.evento_id ? eventoTipo.get(r.evento_id) ?? null : null)), [respostas, eventoTipo]);
  const detratores = useMemo(() => detratoresRecentes(respostas, now, 30), [respostas, now]);
  const pesquisasAtivas = useMemo(() => pesquisas.filter((p) => p.ativo).length, [pesquisas]);

  // ── Feed de respostas filtrado ──
  const filtradas = useMemo(() => {
    let arr = respostas;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((r) => `${r.autor_nome || ''} ${r.comentario || ''}`.toLowerCase().includes(q));
    if (fPesquisa) arr = arr.filter((r) => r.pesquisa_id === fPesquisa);
    if (fProp !== '') arr = arr.filter((r) => r.propriedade_id === fProp);
    if (fCategoria) arr = arr.filter((r) => r.categoria === fCategoria);
    if (fPeriodo) arr = arr.filter((r) => dentroPeriodo(r, fPeriodo, now));
    return arr;
  }, [respostas, busca, fPesquisa, fProp, fCategoria, fPeriodo, now]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = filtradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fPesquisa || fProp !== '' || fCategoria || fPeriodo);

  // ── Mutações ──
  const salvarPesquisa = useCallback(async (p: SavePayload): Promise<boolean> => {
    const row = {
      usuario_id: userId, titulo: p.titulo, descricao: p.descricao, tipo: p.tipo,
      perguntas: p.perguntas, gatilho: p.gatilho, dias_apos: p.dias_apos, ativo: p.ativo,
    } as TablesInsert<'pesquisas'>;
    if (p.id) {
      const { data, error } = await sb.from('pesquisas').update(row).eq('id', p.id).select().single();
      if (error) { toast.error('Falha ao salvar a pesquisa.'); return false; }
      setPesquisas((prev) => prev.map((x) => (x.id === p.id ? normPesquisa(data) : x)));
      toast.success('Pesquisa atualizada.');
    } else {
      const { data, error } = await sb.from('pesquisas').insert(row).select().single();
      if (error) { toast.error('Falha ao criar a pesquisa.'); return false; }
      setPesquisas((prev) => [normPesquisa(data), ...prev]);
      toast.success('Pesquisa criada.');
    }
    return true;
  }, [userId, toast]);

  const toggleAtivo = useCallback(async (p: Pesquisa) => {
    setPesquisas((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: !x.ativo } : x)));
    const { error } = await sb.from('pesquisas').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) { toast.error('Falha ao atualizar.'); carregar(userId!); }
  }, [toast, carregar, userId]);

  const excluirPesquisa = useCallback(async (p: Pesquisa) => {
    if (!confirm(`Excluir "${p.titulo}" e todas as suas respostas? Esta ação não pode ser desfeita.`)) return;
    setPesquisas((prev) => prev.filter((x) => x.id !== p.id));
    setRespostas((prev) => prev.filter((x) => x.pesquisa_id !== p.id));
    const { error } = await sb.from('pesquisas').delete().eq('id', p.id);
    if (error) { toast.error('Falha ao excluir.'); carregar(userId!); }
    else toast.success('Pesquisa excluída.');
  }, [toast, carregar, userId]);

  const excluirResposta = useCallback(async (r: RespostaPesquisa) => {
    if (!confirm('Excluir esta resposta?')) return;
    setRespostas((prev) => prev.filter((x) => x.id !== r.id));
    const { error } = await sb.from('pesquisas_respostas').delete().eq('id', r.id);
    if (error) { toast.error('Falha ao excluir.'); carregar(userId!); }
  }, [toast, carregar, userId]);

  const gerarLink = useCallback(async (pesquisaId: string, eventoId: string | null): Promise<string | null> => {
    const res = await fetch('/api/pesquisas', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'gerar_link', pesquisa_id: pesquisaId, evento_id: eventoId }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.error) { toast.error(j.error); return null; }
    return (j.path as string) || null;
  }, [toast]);

  // detrator → cria um feedback (tratativa) no módulo Feedbacks (RLS de dono)
  const abrirTratativa = useCallback(async (r: RespostaPesquisa) => {
    if (!feedbacksOk) { toast.info('Ative o módulo Feedbacks (rode docs/sql/feedbacks.sql) para abrir tratativas.'); return; }
    const { error } = await sb.from('feedbacks').insert({
      usuario_id: userId, cliente_id: r.cliente_id, evento_id: r.evento_id, propriedade_id: r.propriedade_id,
      autor_nome: r.autor_nome, autor_contato: r.autor_contato, canal: 'formulario',
      nota_geral: r.nps != null ? npsParaNota5(r.nps) : null,
      criterios: {}, comentario: r.comentario, permite_publicar: false, status: 'novo',
    } as TablesInsert<'feedbacks'>);
    if (error) {
      if (isMissingTable(error)) { setFeedbacksOk(false); toast.info('Módulo Feedbacks indisponível.'); }
      else toast.error('Falha ao abrir a tratativa.');
      return;
    }
    toast.success('Tratativa aberta em Feedbacks.');
  }, [feedbacksOk, userId, toast]);

  // promotor → copia um convite para avaliação pública (link da propriedade)
  const convidarAvaliacao = useCallback(async (r: RespostaPesquisa) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = r.propriedade_id != null ? `${origin}/propriedade/${r.propriedade_id}` : origin;
    const nome = r.autor_nome ? `${r.autor_nome}, ` : '';
    const msg = `Olá ${nome}que bom que você teve uma ótima experiência! 💜 Poderia deixar uma avaliação pública? Ajuda muito: ${url}`;
    try { await navigator.clipboard.writeText(msg); toast.success('Convite copiado — é só colar no WhatsApp/e-mail.'); }
    catch { toast.info(url); }
  }, [toast]);

  const rodarIA = useCallback(async (mode: 'temas' | 'resumo') => {
    setIaBusy(true); setIaTexto('');
    const res = await fetch('/api/pesquisas/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ mode }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    setIaBusy(false);
    if (j.code === 'NO_KEY') { toast.info(j.error); return; }
    if (j.error) { toast.error(j.error); return; }
    setIaTexto(j.text || '');
  }, [toast]);

  const gerarPerguntasIA = useCallback(async (objetivo: string, tipo: TipoPesquisa): Promise<Omit<Pergunta, 'id'>[] | null> => {
    const res = await fetch('/api/pesquisas/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ mode: 'perguntas', objetivo, tipo }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_KEY') { toast.info(j.error); return null; }
    if (j.error) { toast.error(j.error); return null; }
    return (j.perguntas as Omit<Pergunta, 'id'>[]) || null;
  }, [toast]);

  const respCb: RespostaCallbacks = useMemo(() => ({
    onAbrirTratativa: abrirTratativa, onConvidarAvaliacao: convidarAvaliacao, onDelete: excluirResposta,
  }), [abrirTratativa, convidarAvaliacao, excluirResposta]);

  function exportar() {
    const csv = respostasToCSV(filtradas, {
      pesquisaTitulo: (id) => pesquisaById.get(id)?.titulo || '',
      propNome: (id) => (id != null ? propNome.get(id) || '' : ''),
      eventoNome: (id) => (id ? eventoNome.get(id) || '' : ''),
      fmtDate: (s) => formatDate(s, { style: 'short' }),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pesquisas-respostas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Pesquisas & NPS</h1>
          <p className="mt-1 text-sm text-ink-muted">Meça satisfação e lealdade com pesquisas pós-evento e acompanhe a evolução do NPS. Para tratativa qualitativa, use <Link href="/painel/feedbacks" className="font-semibold text-brand underline">Feedbacks</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'respostas' && filtradas.length > 0 && (
            <button onClick={exportar} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">
              <IcoDownload /> Exportar
            </button>
          )}
          {!needsSetup && (
            <button onClick={() => setBuilder({ open: true, pesquisa: null })} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              <IcoPlus /> Nova pesquisa
            </button>
          )}
        </div>
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoPoll size={22} /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Pesquisas</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">As tabelas <code className="rounded bg-black/[0.06] px-1">pesquisas</code> e <code className="rounded bg-black/[0.06] px-1">pesquisas_respostas</code> ainda não existem neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/pesquisas.sql</code> no Supabase para começar a medir NPS.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* Abas */}
          <div className="mt-5 inline-flex rounded-xl border border-black/10 bg-white p-0.5 text-sm">
            {([['painel', 'Painel'], ['pesquisas', 'Pesquisas'], ['respostas', 'Respostas']] as [Tab, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)} className={`rounded-lg px-3.5 py-1.5 font-semibold ${tab === v ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'}`}>
                {label}{v === 'respostas' && respostas.length > 0 ? ` (${formatNumber(respostas.length)})` : ''}
              </button>
            ))}
          </div>

          {/* ───────── Painel (NPS) ───────── */}
          {tab === 'painel' && (
            <div className="mt-5">
              {/* Alertas */}
              {(detratores.length > 0 || dash.delta < -5) && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {detratores.length > 0 && (
                    <button onClick={() => { setTab('respostas'); setFCategoria('detrator'); }} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                      <IcoAlert /> {formatNumber(detratores.length)} detrator(es) nos últimos 30 dias — precisa de atenção
                    </button>
                  )}
                  {dash.delta < -5 && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                      <IcoAlert /> NPS caiu {formatNumber(Math.abs(dash.delta))} pontos vs. período anterior.
                    </span>
                  )}
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="NPS atual" value={dash.total ? formatNumber(dash.nps) : '—'} delta={dash.cmp.nAnterior ? dash.delta : undefined} foot={<span className="text-xs text-ink-muted">{formatNumber(dash.total)} com nota</span>} />
                <Kpi label="Respostas" value={formatNumber(dash.respTotal)} foot={<span className="text-xs text-ink-muted">{formatNumber(dash.noMes)} no mês</span>} />
                <Kpi label="Promotores" value={dash.total ? formatPercent(dash.pct.promotor) : '—'} accent="text-emerald-600" foot={<span className="text-xs text-ink-muted">{formatNumber(dash.dist.promotor)} resposta(s)</span>} />
                <Kpi label="Detratores" value={dash.total ? formatPercent(dash.pct.detrator) : '—'} accent="text-red-600" foot={<span className="text-xs text-ink-muted">{formatNumber(pesquisasAtivas)} pesquisa(s) ativa(s)</span>} />
              </div>

              {respostas.length > 0 ? (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                      <h3 className="mb-1 text-sm font-bold text-ink">Net Promoter Score</h3>
                      <NpsGauge score={dash.nps} total={dash.total} />
                    </div>
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                      <h3 className="mb-3 text-sm font-bold text-ink">Composição</h3>
                      <BarraCategorias dist={dash.dist} />
                    </div>
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                      <h3 className="mb-1 text-sm font-bold text-ink">Evolução do NPS</h3>
                      <p className="mb-2 text-xs text-ink-muted"><span className="text-brand">●</span> score &nbsp;<span className="text-brand/40">▮</span> volume</p>
                      <EvolucaoNps serie={serie} />
                    </div>
                  </div>

                  {(porProp.length > 1 || porTipo.length > 1) && (
                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {porProp.length > 0 && (
                        <div className="rounded-2xl bg-white p-5 shadow-card">
                          <h3 className="mb-3 text-sm font-bold text-ink">NPS por propriedade</h3>
                          <div className="space-y-2.5">{porProp.slice(0, 6).map((r) => <NpsBar key={r.chave} label={r.chave} score={r.nps} n={r.n} />)}</div>
                        </div>
                      )}
                      {porTipo.length > 0 && (
                        <div className="rounded-2xl bg-white p-5 shadow-card">
                          <h3 className="mb-3 text-sm font-bold text-ink">NPS por tipo de evento</h3>
                          <div className="space-y-2.5">{porTipo.slice(0, 6).map((r) => <NpsBar key={r.chave} label={r.chave} score={r.nps} n={r.n} />)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* IA */}
                  <div className="mt-4 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50/60 to-white p-5 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoSparkles /> Inteligência de pesquisas</h3>
                      {isPro ? (
                        <div className="flex gap-2">
                          <button onClick={() => rodarIA('temas')} disabled={iaBusy} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">Temas dos comentários</button>
                          <button onClick={() => rodarIA('resumo')} disabled={iaBusy} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">Resumo do NPS</button>
                        </div>
                      ) : (
                        <Link href="/painel/planos" className="rounded-lg bg-gradient-to-r from-amber-500 to-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Desbloquear no Pro+</Link>
                      )}
                    </div>
                    {iaBusy && <p className="mt-3 text-sm text-ink-muted">Analisando respostas…</p>}
                    {iaTexto && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{iaTexto}</p>}
                    {!iaBusy && !iaTexto && <p className="mt-2 text-xs text-ink-muted">Agrupe temas dos comentários e gere um resumo do NPS{isPro ? '.' : ' (Pro+).'}</p>}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoPoll size={22} /></div>
                  <h3 className="text-base font-bold text-ink">Ainda sem respostas</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{pesquisas.length ? 'Distribua uma pesquisa por link/QR ou ative o disparo automático pós-evento.' : 'Crie sua primeira pesquisa para começar a medir o NPS.'}</p>
                  <button onClick={() => (pesquisas.length ? setTab('pesquisas') : setBuilder({ open: true, pesquisa: null }))} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> {pesquisas.length ? 'Ver pesquisas' : 'Nova pesquisa'}</button>
                </div>
              )}
            </div>
          )}

          {/* ───────── Pesquisas (construtor) ───────── */}
          {tab === 'pesquisas' && (
            <div className="mt-5 space-y-3">
              {pesquisas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoPoll size={22} /></div>
                  <h3 className="text-base font-bold text-ink">Nenhuma pesquisa ainda</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Comece por um modelo de NPS pronto e ajuste as perguntas como quiser.</p>
                  <button onClick={() => setBuilder({ open: true, pesquisa: null })} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova pesquisa</button>
                </div>
              ) : (
                pesquisas.map((p) => {
                  const rs = respostasByPesquisa.get(p.id) || [];
                  const nps = npsScore(rs);
                  return (
                    <div key={p.id} className="rounded-2xl bg-white p-4 shadow-card">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-ink">{p.titulo}</h3>
                            <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">{TIPO_PESQUISA_BY[p.tipo]?.label || p.tipo}</span>
                            <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-xs font-medium text-ink-muted">{GATILHO_BY[p.gatilho]?.label}{p.gatilho === 'dias_apos' && p.dias_apos ? ` (${p.dias_apos}d)` : ''}</span>
                            {!p.ativo && <span className="rounded-lg bg-black/[0.05] px-2 py-0.5 text-xs font-medium text-ink-muted">Inativa</span>}
                          </div>
                          <p className="mt-1 text-xs text-ink-muted">{formatNumber(p.perguntas.length)} pergunta(s) · {formatNumber(rs.length)} resposta(s){rs.length ? ` · NPS ${formatNumber(nps)}` : ''} · criada {formatDate(p.criado_em, { style: 'short' })}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <button onClick={() => setDistribuir(p)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold hover:border-brand/30 hover:text-brand"><IcoLink /> Distribuir</button>
                          <button onClick={() => setBuilder({ open: true, pesquisa: p })} className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:border-brand/30 hover:text-brand" aria-label="Editar"><IcoEdit /></button>
                          <button onClick={() => toggleAtivo(p)} className={`rounded-lg border p-1.5 ${p.ativo ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-black/10 text-ink-muted hover:text-ink'}`} aria-label={p.ativo ? 'Desativar' : 'Ativar'} title={p.ativo ? 'Ativa' : 'Inativa'}><IcoPower /></button>
                          <button onClick={() => excluirPesquisa(p)} className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Excluir"><IcoTrash /></button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ───────── Respostas (feed) ───────── */}
          {tab === 'respostas' && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por autor ou comentário…" className={`${inp} pl-9`} />
                </div>
                <select value={fPesquisa} onChange={(e) => setFPesquisa(e.target.value)} className={selCls} aria-label="Filtrar por pesquisa">
                  <option value="">Todas as pesquisas</option>
                  {pesquisas.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
                <select value={fProp} onChange={(e) => setFProp(e.target.value ? Number(e.target.value) : '')} className={selCls} aria-label="Filtrar por propriedade">
                  <option value="">Todas as propriedades</option>
                  {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
                </select>
                <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value as CategoriaNps | '')} className={selCls} aria-label="Filtrar por categoria">
                  <option value="">Todas as categorias</option>
                  {CATEGORIAS_NPS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
                <select value={fPeriodo} onChange={(e) => setFPeriodo(Number(e.target.value))} className={selCls} aria-label="Filtrar por período">
                  <option value={0}>Todo o período</option>
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias</option>
                  <option value={365}>12 meses</option>
                </select>
                {temFiltro && <button onClick={() => { setBusca(''); setFPesquisa(''); setFProp(''); setFCategoria(''); setFPeriodo(0); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
              </div>

              <div className="mt-4 space-y-3">
                {filtradas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoPoll size={22} /></div>
                    <h3 className="text-base font-bold text-ink">{respostas.length ? 'Nenhuma resposta com esses filtros' : 'Ainda sem respostas'}</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{respostas.length ? 'Ajuste a busca ou os filtros acima.' : 'Distribua uma pesquisa por link/QR ou ative o disparo automático pós-evento.'}</p>
                  </div>
                ) : (
                  pageItems.map((r) => (
                    <RespostaCard
                      key={r.id} r={r}
                      perguntas={pesquisaById.get(r.pesquisa_id)?.perguntas || []}
                      pesquisaTitulo={pesquisaById.get(r.pesquisa_id)?.titulo || ''}
                      propNome={(r.propriedade_id != null && propNome.get(r.propriedade_id)) || ''}
                      eventoNome={(r.evento_id && eventoNome.get(r.evento_id)) || ''}
                      podeTratativa={r.categoria === 'detrator'}
                      podeAvaliar={r.categoria === 'promotor' && r.propriedade_id != null}
                      cb={respCb}
                    />
                  ))
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
                  <span className="text-sm text-ink-muted">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {builder.open && (
        <PesquisaBuilder
          pesquisa={builder.pesquisa} isPro={isPro}
          onClose={() => setBuilder({ open: false, pesquisa: null })}
          onSave={salvarPesquisa} onGerarPerguntasIA={gerarPerguntasIA}
        />
      )}
      {distribuir && (
        <DistribuirModal pesquisa={distribuir} eventos={eventos} onClose={() => setDistribuir(null)} onGerarLink={gerarLink} />
      )}
    </div>
  );
}
