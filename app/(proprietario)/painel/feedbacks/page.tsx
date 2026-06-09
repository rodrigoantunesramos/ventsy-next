'use client';

// Feedbacks (privados — cliente ↔ dono) · /painel/feedbacks.
// Canal PRIVADO de avaliação pós-evento, separado das avaliações públicas
// (/painel/avaliacoes). Serve para ouvir críticas com franqueza, tratar
// internamente (plano de ação/CAPA) e medir a satisfação real por evento.
// Fonte: novas tabelas `feedbacks` + `feedbacks_acoes` (RLS de dono) + contexto de
// `clientes_eventos`/`propriedades`. Coleta por link/QR público (token assinado) ou
// registro manual. Motor puro em lib/feedback (CSAT, critérios, tratativa).
// PILARES: KPIs de satisfação · radar por critério + evolução (SVG) · feed filtrável
//   com tratativa · coleta (link/QR/manual) · promover elogio a avaliação pública ·
//   IA (temas/resumo, Pro+). i18n via lib/format (sem "R$").

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Feedback, type FeedbackAcao, type EventoLite, type PropLite,
  type StatusFeedback, type StatusAcao, type CanalFeedback,
  CANAIS, STATUS_FEEDBACK,
  normalizarCriterios, csat, pctSatisfeitos, distribuicaoNotas, notaPorCriterio,
  serieMensal, comparativoCsat, distribuicaoStatus, pctViraramAcao,
  tempoMedioResolucaoDias, acoesAtrasadas, dentroPeriodo, notaPorChave,
  feedbacksToCSV, isMissingTable,
} from '@/lib/feedback';
import {
  Stars, MediaBar, Kpi, RadarCriterios, EvolucaoMensal,
  IcoStar, IcoDownload, IcoSearch, IcoAlert, IcoClock, IcoPlus, IcoSparkles, IcoChat,
} from './_components/ui';
import { FeedbackCard, type CardCallbacks } from './_components/FeedbackCard';
import { ColetarModal, type ManualPayload } from './_components/ColetarModal';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 10;
type StatusFiltro = 'todos' | StatusFeedback | 'atrasados';

// ── Normalização (tolera jsonb/strings vindos do banco) ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normFeedback(f: any): Feedback {
  return {
    id: String(f.id),
    usuario_id: f.usuario_id ?? '',
    cliente_id: f.cliente_id ?? null,
    evento_id: f.evento_id ?? null,
    propriedade_id: f.propriedade_id != null ? Number(f.propriedade_id) : null,
    autor_nome: f.autor_nome ?? null,
    autor_contato: f.autor_contato ?? null,
    canal: (f.canal ?? 'formulario') as CanalFeedback,
    nota_geral: f.nota_geral != null ? Number(f.nota_geral) : null,
    criterios: normalizarCriterios(f.criterios),
    comentario: f.comentario ?? null,
    pontos_positivos: f.pontos_positivos ?? null,
    pontos_negativos: f.pontos_negativos ?? null,
    permite_publicar: !!f.permite_publicar,
    status: (f.status ?? 'novo') as StatusFeedback,
    resposta_privada: f.resposta_privada ?? null,
    respondido_em: f.respondido_em ?? null,
    promovida_avaliacao_id: f.promovida_avaliacao_id != null ? Number(f.promovida_avaliacao_id) : null,
    resolvido_em: f.resolvido_em ?? null,
    criado_em: f.criado_em ?? '',
    atualizado_em: f.atualizado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normAcao(a: any): FeedbackAcao {
  return {
    id: String(a.id), feedback_id: String(a.feedback_id), usuario_id: a.usuario_id ?? '',
    descricao: a.descricao ?? '', responsavel: a.responsavel ?? null, prazo: a.prazo ?? null,
    status: (a.status ?? 'aberta') as StatusAcao, concluida_em: a.concluida_em ?? null, criado_em: a.criado_em ?? '',
  };
}

export default function FeedbacksPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const isPro = plano === 'pro' || plano === 'ultra';

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [acoes, setAcoes] = useState<FeedbackAcao[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [props, setProps] = useState<PropLite[]>([]);

  // filtros
  const [busca, setBusca] = useState('');
  const [fProp, setFProp] = useState<number | ''>('');
  const [fStatus, setFStatus] = useState<StatusFiltro>('todos');
  const [fCanal, setFCanal] = useState<CanalFeedback | ''>('');
  const [fPeriodo, setFPeriodo] = useState(0);
  const [page, setPage] = useState(0);

  // modais / IA
  const [coletar, setColetar] = useState(false);
  const [iaTexto, setIaTexto] = useState('');
  const [iaBusy, setIaBusy] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const [fbRes, acRes, evRes, prRes] = await Promise.all([
      sb.from('feedbacks').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('feedbacks_acoes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,propriedade_id,criado_em').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('propriedades').select('id,nome,cidade,estado').eq('usuario_id', uid).order('id'),
    ]);
    if (isMissingTable(fbRes.error)) { setNeedsSetup(true); setFeedbacks([]); setAcoes([]); return; }
    setNeedsSetup(false);
    setFeedbacks(((fbRes.data || []) as unknown[]).map(normFeedback));
    setAcoes(((acRes.data || []) as unknown[]).map(normAcao));
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, id: String(e.id), propriedade_id: e.propriedade_id != null ? Number(e.propriedade_id) : null })));
    setProps(((prRes.data || []) as PropLite[]).map((p) => ({ ...p, id: Number(p.id) })));
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

  useEffect(() => { setPage(0); }, [busca, fProp, fStatus, fCanal, fPeriodo]);

  // ── Mapas de apoio ──
  const propNome = useMemo(() => new Map(props.map((p) => [p.id, p.nome || `Espaço #${p.id}`])), [props]);
  const eventoNome = useMemo(() => {
    const m = new Map<string, string>();
    eventos.forEach((e) => m.set(e.id, e.nome_evento || e.tipo_evento || e.quem_contratou || 'Evento'));
    return m;
  }, [eventos]);
  const acoesByFb = useMemo(() => {
    const m = new Map<string, FeedbackAcao[]>();
    acoes.forEach((a) => { if (!m.has(a.feedback_id)) m.set(a.feedback_id, []); m.get(a.feedback_id)!.push(a); });
    return m;
  }, [acoes]);

  // ── KPIs / gráficos ──
  const kpis = useMemo(() => {
    const cmp = comparativoCsat(feedbacks, fPeriodo || 90, now);
    const distSt = distribuicaoStatus(feedbacks);
    const resolvidos = distSt.resolvido;
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      csat: csat(feedbacks),
      satisfeitos: pctSatisfeitos(feedbacks),
      total: feedbacks.length,
      novosMes: feedbacks.filter((f) => (f.criado_em || '').slice(0, 7) === mesAtual).length,
      distSt,
      pctResolvidos: feedbacks.length ? resolvidos / feedbacks.length : 0,
      viraramAcao: pctViraramAcao(feedbacks, acoes),
      tempoResolucao: tempoMedioResolucaoDias(feedbacks),
      delta: cmp.nAtual && cmp.nAnterior ? cmp.atual - cmp.anterior : 0,
      cmp,
    };
  }, [feedbacks, acoes, fPeriodo, now]);

  const porCriterio = useMemo(() => notaPorCriterio(feedbacks), [feedbacks]);
  const serie = useMemo(() => serieMensal(feedbacks, now, 6), [feedbacks, now]);
  const dist = useMemo(() => distribuicaoNotas(feedbacks), [feedbacks]);
  const eventoTipo = useMemo(() => new Map(eventos.map((e) => [e.id, e.tipo_evento])), [eventos]);
  const porProp = useMemo(() => notaPorChave(feedbacks, (f) => (f.propriedade_id != null ? propNome.get(f.propriedade_id) || '—' : '—')), [feedbacks, propNome]);
  const porTipo = useMemo(() => notaPorChave(feedbacks, (f) => (f.evento_id ? eventoTipo.get(f.evento_id) ?? null : null)), [feedbacks, eventoTipo]);

  const atrasadas = useMemo(() => acoesAtrasadas(acoes, now), [acoes, now]);
  const novosParados = useMemo(
    () => feedbacks.filter((f) => f.status === 'novo' && f.criado_em && (now.getTime() - Date.parse(f.criado_em)) / 86_400_000 >= 3).length,
    [feedbacks, now],
  );

  // ── Feed filtrado ──
  const filtrados = useMemo(() => {
    let arr = feedbacks;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((f) => `${f.autor_nome || ''} ${f.comentario || ''} ${f.pontos_positivos || ''} ${f.pontos_negativos || ''}`.toLowerCase().includes(q));
    if (fProp !== '') arr = arr.filter((f) => f.propriedade_id === fProp);
    if (fCanal) arr = arr.filter((f) => f.canal === fCanal);
    if (fPeriodo) arr = arr.filter((f) => dentroPeriodo(f, fPeriodo, now));
    if (fStatus === 'atrasados') { const ids = new Set(atrasadas.map((a) => a.feedback_id)); arr = arr.filter((f) => ids.has(f.id)); }
    else if (fStatus !== 'todos') arr = arr.filter((f) => f.status === fStatus);
    return arr;
  }, [feedbacks, busca, fProp, fCanal, fPeriodo, fStatus, atrasadas, now]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fProp !== '' || fStatus !== 'todos' || fCanal || fPeriodo);

  // ── Mutações (CRUD via RLS de dono; promover/IA/link via API) ──
  const setStatus = useCallback(async (f: Feedback, status: StatusFeedback) => {
    const patch: Record<string, unknown> = { status };
    patch.resolvido_em = status === 'resolvido' ? (f.resolvido_em || new Date().toISOString()) : null;
    setFeedbacks((prev) => prev.map((x) => (x.id === f.id ? { ...x, status, resolvido_em: patch.resolvido_em as string | null } : x)));
    const { error } = await sb.from('feedbacks').update(patch).eq('id', f.id);
    if (error) { toast.error('Não foi possível atualizar o status.'); carregar(userId!); }
  }, [toast, carregar, userId]);

  const salvarResposta = useCallback(async (f: Feedback, texto: string): Promise<boolean> => {
    const respondido_em = texto ? new Date().toISOString() : null;
    const { error } = await sb.from('feedbacks').update({ resposta_privada: texto || null, respondido_em }).eq('id', f.id);
    if (error) { toast.error('Falha ao salvar a resposta.'); return false; }
    setFeedbacks((prev) => prev.map((x) => (x.id === f.id ? { ...x, resposta_privada: texto || null, respondido_em } : x)));
    toast.success(texto ? 'Resposta privada salva.' : 'Resposta removida.');
    return true;
  }, [toast]);

  const promover = useCallback(async (f: Feedback) => {
    const res = await fetch('/api/feedbacks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'promover', id: f.id }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.error) { toast.error(j.error); return; }
    setFeedbacks((prev) => prev.map((x) => (x.id === f.id ? { ...x, promovida_avaliacao_id: j.avaliacao_id } : x)));
    toast.success('Feedback publicado como avaliação verificada.');
  }, [toast]);

  const sugerirResposta = useCallback(async (f: Feedback): Promise<string | null> => {
    const res = await fetch('/api/feedbacks/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ mode: 'resposta', id: f.id }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_KEY') { toast.info(j.error); return null; }
    if (j.error) { toast.error(j.error); return null; }
    return (j.text as string) || null;
  }, [toast]);

  const addAcao = useCallback(async (feedbackId: string, a: { descricao: string; responsavel: string; prazo: string }): Promise<boolean> => {
    const { data, error } = await sb.from('feedbacks_acoes').insert({
      feedback_id: feedbackId, usuario_id: userId, descricao: a.descricao.trim(),
      responsavel: a.responsavel.trim() || null, prazo: a.prazo || null, status: 'aberta',
    }).select().single();
    if (error) { toast.error('Falha ao adicionar a ação.'); return false; }
    setAcoes((prev) => [...prev, normAcao(data)]);
    // primeiro plano de ação ⇒ move o feedback para "em tratativa" (se ainda "novo")
    const fb = feedbacks.find((f) => f.id === feedbackId);
    if (fb && fb.status === 'novo') setStatus(fb, 'em_tratativa');
    return true;
  }, [userId, toast, feedbacks, setStatus]);

  const setAcaoStatus = useCallback(async (a: FeedbackAcao, status: StatusAcao) => {
    const concluida_em = status === 'concluida' ? (a.concluida_em || new Date().toISOString()) : null;
    setAcoes((prev) => prev.map((x) => (x.id === a.id ? { ...x, status, concluida_em } : x)));
    const { error } = await sb.from('feedbacks_acoes').update({ status, concluida_em }).eq('id', a.id);
    if (error) { toast.error('Falha ao atualizar a ação.'); carregar(userId!); }
  }, [toast, carregar, userId]);

  const delAcao = useCallback(async (a: FeedbackAcao) => {
    setAcoes((prev) => prev.filter((x) => x.id !== a.id));
    const { error } = await sb.from('feedbacks_acoes').delete().eq('id', a.id);
    if (error) { toast.error('Falha ao remover a ação.'); carregar(userId!); }
  }, [toast, carregar, userId]);

  const delFeedback = useCallback(async (f: Feedback) => {
    if (!confirm('Excluir este feedback e todo o seu plano de ação? Esta ação não pode ser desfeita.')) return;
    setFeedbacks((prev) => prev.filter((x) => x.id !== f.id));
    setAcoes((prev) => prev.filter((x) => x.feedback_id !== f.id));
    const { error } = await sb.from('feedbacks').delete().eq('id', f.id);
    if (error) { toast.error('Falha ao excluir.'); carregar(userId!); }
    else toast.success('Feedback excluído.');
  }, [toast, carregar, userId]);

  const gerarLink = useCallback(async (eventoId: string): Promise<string | null> => {
    const res = await fetch('/api/feedbacks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ action: 'gerar_link', evento_id: eventoId }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.error) { toast.error(j.error); return null; }
    return (j.path as string) || null;
  }, [toast]);

  const registrarManual = useCallback(async (p: ManualPayload): Promise<boolean> => {
    const { data, error } = await sb.from('feedbacks').insert({
      usuario_id: userId, evento_id: p.evento_id, propriedade_id: p.propriedade_id, cliente_id: p.cliente_id,
      autor_nome: p.autor_nome || null, autor_contato: p.autor_contato || null, canal: p.canal,
      nota_geral: p.nota_geral, criterios: normalizarCriterios(p.criterios),
      comentario: p.comentario || null, pontos_positivos: p.pontos_positivos || null,
      pontos_negativos: p.pontos_negativos || null, permite_publicar: p.permite_publicar, status: 'novo',
    }).select().single();
    if (error) { toast.error('Falha ao registrar o feedback.'); return false; }
    setFeedbacks((prev) => [normFeedback(data), ...prev]);
    toast.success('Feedback registrado.');
    return true;
  }, [userId, toast]);

  const rodarIA = useCallback(async (mode: 'temas' | 'resumo') => {
    setIaBusy(true); setIaTexto('');
    const res = await fetch('/api/feedbacks/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ mode }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    setIaBusy(false);
    if (j.code === 'NO_KEY') { toast.info(j.error); return; }
    if (j.error) { toast.error(j.error); return; }
    setIaTexto(j.text || '');
  }, [toast]);

  const cb: CardCallbacks = useMemo(() => ({
    onSetStatus: setStatus, onPromover: promover, onSalvarResposta: salvarResposta,
    onSugerirResposta: sugerirResposta, onAddAcao: addAcao, onSetAcaoStatus: setAcaoStatus,
    onDelAcao: delAcao, onDelete: delFeedback,
  }), [setStatus, promover, salvarResposta, sugerirResposta, addAcao, setAcaoStatus, delAcao, delFeedback]);

  function exportar() {
    const csv = feedbacksToCSV(filtrados, {
      propNome: (id) => (id != null ? propNome.get(id) || '' : ''),
      eventoNome: (id) => (id ? eventoNome.get(id) || '' : ''),
      fmtDate: (s) => formatDate(s, { style: 'short' }),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `feedbacks-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Feedbacks</h1>
          <p className="mt-1 text-sm text-ink-muted">Avaliação privada pós-evento — ouça com franqueza, trate internamente e meça a satisfação real. As avaliações públicas ficam em <Link href="/painel/avaliacoes" className="font-semibold text-brand underline">Avaliações</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          {filtrados.length > 0 && (
            <button onClick={exportar} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">
              <IcoDownload /> Exportar
            </button>
          )}
          {!needsSetup && (
            <button onClick={() => setColetar(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              <IcoPlus /> Coletar feedback
            </button>
          )}
        </div>
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoChat size={22} /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Feedbacks</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">As tabelas <code className="rounded bg-black/[0.06] px-1">feedbacks</code> e <code className="rounded bg-black/[0.06] px-1">feedbacks_acoes</code> ainda não existem neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/feedbacks.sql</code> no Supabase para começar a coletar e tratar feedbacks.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* Alertas */}
          {(atrasadas.length > 0 || novosParados > 0 || kpis.delta < -0.1) && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {atrasadas.length > 0 && (
                <button onClick={() => setFStatus('atrasados')} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                  <IcoClock /> {atrasadas.length} ação(ões) atrasada(s)
                </button>
              )}
              {novosParados > 0 && (
                <button onClick={() => setFStatus('novo')} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
                  <IcoAlert /> {novosParados} feedback(s) novo(s) sem tratativa há +3 dias
                </button>
              )}
              {kpis.delta < -0.1 && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  <IcoAlert /> CSAT caiu {formatNumber(Math.abs(kpis.delta), { maximumFractionDigits: 1 })} ponto(s) vs. período anterior.
                </span>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="CSAT médio" value={feedbacks.length ? formatNumber(kpis.csat, { maximumFractionDigits: 1 }) : '—'} foot={<Stars value={kpis.csat} size={14} />} delta={kpis.cmp.nAnterior ? kpis.delta : undefined} />
            <Kpi label="Satisfação (nota ≥ 4)" value={feedbacks.length ? formatPercent(kpis.satisfeitos) : '—'} foot={<span className="text-xs text-ink-muted">{formatNumber(kpis.total)} feedback(s) · {formatNumber(kpis.novosMes)} no mês</span>} />
            <Kpi label="Resolvidos" value={feedbacks.length ? formatPercent(kpis.pctResolvidos) : '—'} foot={<span className="text-xs text-ink-muted">{formatNumber(kpis.distSt.novo + kpis.distSt.em_tratativa)} em aberto</span>} />
            <Kpi label="Tempo médio resolução" value={kpis.tempoResolucao ? `${formatNumber(kpis.tempoResolucao, { maximumFractionDigits: 1 })}d` : '—'} foot={<span className="text-xs text-ink-muted">{formatPercent(kpis.viraramAcao)} viraram ação</span>} />
          </div>

          {feedbacks.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Radar de critérios */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-1 text-sm font-bold text-ink">Notas por critério</h3>
                  <RadarCriterios data={porCriterio} />
                </div>
                {/* Evolução */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-1 text-sm font-bold text-ink">Evolução do CSAT</h3>
                  <p className="mb-2 text-xs text-ink-muted"><span className="text-amber-500">●</span> média &nbsp;<span className="text-brand/40">▮</span> volume</p>
                  <EvolucaoMensal serie={serie} />
                </div>
                {/* Distribuição de notas */}
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">Distribuição das notas</h3>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const c = dist[n - 1]; const pct = feedbacks.length ? c / feedbacks.length : 0;
                      return (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="flex w-7 items-center gap-0.5 text-ink-muted">{n}<IcoStar size={11} /></span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${pct * 100}%` }} /></div>
                          <span className="w-10 text-right tabular-nums text-ink-muted">{formatNumber(c)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Status */}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/[0.05] pt-3">
                    {STATUS_FEEDBACK.map((s) => (
                      <span key={s.v} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${s.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}: {formatNumber(kpis.distSt[s.v])}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nota por propriedade e tipo */}
              {(porProp.length > 1 || porTipo.length > 1) && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {porProp.length > 0 && (
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                      <h3 className="mb-3 text-sm font-bold text-ink">CSAT por propriedade</h3>
                      <div className="space-y-2.5">{porProp.slice(0, 6).map((r) => <MediaBar key={r.chave} label={r.chave} value={r.media} n={r.n} />)}</div>
                    </div>
                  )}
                  {porTipo.length > 0 && (
                    <div className="rounded-2xl bg-white p-5 shadow-card">
                      <h3 className="mb-3 text-sm font-bold text-ink">CSAT por tipo de evento</h3>
                      <div className="space-y-2.5">{porTipo.slice(0, 6).map((r) => <MediaBar key={r.chave} label={r.chave} value={r.media} n={r.n} />)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* IA: temas / resumo */}
              <div className="mt-4 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50/60 to-white p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoSparkles /> Inteligência de feedbacks</h3>
                  {isPro ? (
                    <div className="flex gap-2">
                      <button onClick={() => rodarIA('temas')} disabled={iaBusy} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">Temas recorrentes</button>
                      <button onClick={() => rodarIA('resumo')} disabled={iaBusy} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">Resumo do período</button>
                    </div>
                  ) : (
                    <Link href="/painel/planos" className="rounded-lg bg-gradient-to-r from-amber-500 to-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Desbloquear no Pro+</Link>
                  )}
                </div>
                {iaBusy && <p className="mt-3 text-sm text-ink-muted">Analisando feedbacks…</p>}
                {iaTexto && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{iaTexto}</p>}
                {!iaBusy && !iaTexto && <p className="mt-2 text-xs text-ink-muted">Agrupe temas recorrentes e gere um resumo do período com IA{isPro ? '.' : ' (Pro+).'}</p>}
              </div>
            </>
          )}

          {/* Filtros */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por autor ou comentário…" className={`${inp} pl-9`} />
            </div>
            <select value={fProp} onChange={(e) => setFProp(e.target.value ? Number(e.target.value) : '')} className={selCls} aria-label="Filtrar por propriedade">
              <option value="">Todas as propriedades</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusFiltro)} className={selCls} aria-label="Filtrar por status">
              <option value="todos">Todos os status</option>
              {STATUS_FEEDBACK.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              <option value="atrasados">Com ação atrasada</option>
            </select>
            <select value={fCanal} onChange={(e) => setFCanal(e.target.value as CanalFeedback | '')} className={selCls} aria-label="Filtrar por canal">
              <option value="">Todos os canais</option>
              {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
            <select value={fPeriodo} onChange={(e) => setFPeriodo(Number(e.target.value))} className={selCls} aria-label="Filtrar por período">
              <option value={0}>Todo o período</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={365}>12 meses</option>
            </select>
            {temFiltro && <button onClick={() => { setBusca(''); setFProp(''); setFStatus('todos'); setFCanal(''); setFPeriodo(0); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
          </div>

          {/* Feed */}
          <div className="mt-4 space-y-3">
            {filtrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoChat size={22} /></div>
                <h3 className="text-base font-bold text-ink">{feedbacks.length ? 'Nenhum feedback com esses filtros' : 'Ainda sem feedbacks'}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                  {feedbacks.length
                    ? 'Ajuste a busca ou os filtros acima.'
                    : 'Envie um link/QR de feedback ao contratante após o evento, ou registre um retorno recebido por outro canal.'}
                </p>
                {!feedbacks.length && <button onClick={() => setColetar(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Coletar feedback</button>}
              </div>
            ) : (
              pageItems.map((f) => (
                <FeedbackCard
                  key={f.id} f={f} acoes={acoesByFb.get(f.id) || []}
                  propNome={(f.propriedade_id != null && propNome.get(f.propriedade_id)) || ''}
                  eventoNome={(f.evento_id && eventoNome.get(f.evento_id)) || ''}
                  isPro={isPro} now={now} cb={cb}
                />
              ))
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
              <span className="text-sm text-ink-muted">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {coletar && (
        <ColetarModal eventos={eventos} onClose={() => setColetar(false)} onGerarLink={gerarLink} onRegistrarManual={registrarManual} />
      )}
    </div>
  );
}
