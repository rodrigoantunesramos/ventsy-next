'use client';

// Campanhas (disparo em massa) · /painel/campanhas.
// Cria e dispara mensagens em massa para SEGMENTOS de clientes (e-mail/WhatsApp),
// com templates, agendamento e métricas. O público reaproveita a segmentação RFM
// de /painel/clientes (clientes/_lib) e é MATERIALIZADO em `campanhas_envios` ao
// enviar/agendar — a fila é processada de forma assíncrona (app/api/campanhas/enviar
// + cron) respeitando opt-out (`descadastros`) e o limite do plano. Rastreamento de
// abertura/clique via app/api/track. Motor puro em lib/campanhas. i18n via lib/format
// (sem "R$"). Premium: envio por e-mail é Pro+ (limite mensal por plano).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/supabase';
import { formatNumber, formatPercent, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Campanha, type Envio, type Descadastro, type ClienteAlvo, type Canal, type SegmentoFiltro,
  type StatusCampanha,
  STATUS_CAMPANHA, agregado, limiteInfo, serieEnviosMensal, resolverPublico, varsDoAlvo,
  taxaAbertura, taxaClique, campanhasToCSV, isMissingTable,
} from '@/lib/campanhas';
import {
  type Cliente, type EventoLite, type ParcelaLite,
  metricsCliente, eventosDoCliente, segmentar,
} from '../clientes/_lib';
import {
  Kpi, StatusChip, CanalBadge, LimiteBar, MiniEnvios,
  IcoMegaphone, IcoPlus, IcoSearch, IcoDownload, IcoSend, IcoEye, IcoEdit, IcoCopy, IcoTrash, IcoSparkles,
} from './_components/ui';
import { Builder, type CommitArgs } from './_components/Builder';
import { Metricas } from './_components/Metricas';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Normalização do banco → tipos da engine ───────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normCampanha(c: any): Campanha {
  const seg = c.segmento && typeof c.segmento === 'object' && !Array.isArray(c.segmento) ? c.segmento : {};
  return {
    id: String(c.id), usuario_id: c.usuario_id ?? '', nome: c.nome ?? '',
    canal: (c.canal ?? 'email') as Canal, assunto: c.assunto ?? null, corpo: c.corpo ?? '',
    segmento: seg as SegmentoFiltro, agendada_para: c.agendada_para ?? null,
    status: (c.status ?? 'rascunho') as StatusCampanha, enviada_em: c.enviada_em ?? null,
    n_total: Number(c.n_total) || 0, n_enviados: Number(c.n_enviados) || 0, n_entregues: Number(c.n_entregues) || 0,
    n_abertos: Number(c.n_abertos) || 0, n_clicados: Number(c.n_clicados) || 0, n_falhas: Number(c.n_falhas) || 0,
    n_descadastros: Number(c.n_descadastros) || 0, criado_em: c.criado_em ?? '', atualizado_em: c.atualizado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normEnvio(e: any): Envio {
  return {
    id: String(e.id), campanha_id: String(e.campanha_id), usuario_id: e.usuario_id ?? '',
    cliente_id: e.cliente_id ?? null, contato: e.contato ?? '', nome: e.nome ?? null,
    vars: (e.vars && typeof e.vars === 'object') ? e.vars : {}, status: e.status ?? 'fila',
    enviado_em: e.enviado_em ?? null, aberto_em: e.aberto_em ?? null, clicado_em: e.clicado_em ?? null,
    erro: e.erro ?? null, criado_em: e.criado_em ?? '',
  };
}
function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) { const v = obj?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
  return '';
}
function uniqSorted(xs: (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x && x.trim() !== '').map((x) => x.trim()))].sort();
}

export default function CampanhasPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const [empresa, setEmpresa] = useState('');

  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaLite[]>([]);
  const [descadastros, setDescadastros] = useState<Descadastro[]>([]);

  // filtros da lista
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<StatusCampanha | ''>('');
  const [fCanal, setFCanal] = useState<Canal | ''>('');

  // modais
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [metrica, setMetrica] = useState<Campanha | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const [campRes, cliRes, evRes, pcRes, dcRes] = await Promise.all([
      sb.from('campanhas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('clientes').select('*').eq('usuario_id', uid),
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,criado_em').eq('usuario_id', uid),
      sb.from('parcelas').select('id,evento_id,valor,vencimento,status,pago_em').eq('usuario_id', uid),
      sb.from('descadastros').select('*').eq('usuario_id', uid),
    ]);
    if (isMissingTable(campRes.error)) { setNeedsSetup(true); setCampanhas([]); return; }
    setNeedsSetup(false);
    setCampanhas(((campRes.data || []) as unknown[]).map(normCampanha));
    setClientes(isMissingTable(cliRes.error) ? [] : ((cliRes.data || []) as Cliente[]).map((c) => ({ ...c, tags: Array.isArray(c.tags) ? c.tags : [] })));
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, id: String(e.id), valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setParcelas(((pcRes.data || []) as ParcelaLite[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor) })));
    setDescadastros(isMissingTable(dcRes.error) ? [] : ((dcRes.data || []) as unknown[]).map((d) => d as Descadastro));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const uid = session.user.id;
      setUserId(uid);
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', uid).maybeSingle();
        setPlano((a?.plano_ativo || 'basico').toString().toLowerCase());
      } catch { /* plano opcional */ }
      try {
        const { data: cfg } = await sb.from('empresa_config').select('*').eq('usuario_id', uid).maybeSingle();
        let nome = pick(cfg, ['nome_fantasia', 'nome_empresa', 'razao_social', 'nome', 'empresa']);
        if (!nome) { const { data: u } = await sb.from('usuarios').select('nome').eq('id', uid).maybeSingle(); nome = pick(u, ['nome']); }
        setEmpresa(nome);
      } catch { /* sem config */ }
      await carregar(uid);
      setLoading(false);
    })();
  }, [carregar, router]);

  // ── Público / alvos (RFM reaproveitada de clientes/_lib) ──
  const alvos = useMemo<ClienteAlvo[]>(() => {
    const base = clientes.map((c) => { const ev = eventosDoCliente(c, eventos); return { c, ev, m: metricsCliente(c, ev, parcelas, [], now) }; });
    const comp = base.filter((r) => r.m.nGanhos >= 1);
    const refValor = comp.length ? comp.reduce((s, r) => s + r.m.valorContratado, 0) / comp.length : 0;
    return base.map(({ c, ev, m }) => ({
      id: c.id, nome: c.nome, email: c.email, whatsapp: c.whatsapp, telefone: c.telefone,
      cidade: c.cidade, origem: c.origem, tags: c.tags || [], aniversario: c.aniversario,
      segmento: segmentar(c, m, now, refValor),
      tiposEvento: uniqSorted(ev.map((e) => e.tipo_evento)),
      inativo: m.inativo, nEventos: m.nEventos, vip: c.vip,
      proximoEvento: m.proximoEvento?.nome_evento || m.proximoEvento?.tipo_evento || ev.find((e) => e.tipo_evento)?.tipo_evento || null,
    }));
  }, [clientes, eventos, parcelas, now]);

  const origens = useMemo(() => uniqSorted(clientes.map((c) => c.origem)), [clientes]);
  const cidades = useMemo(() => uniqSorted(clientes.map((c) => c.cidade)), [clientes]);
  const tags = useMemo(() => uniqSorted(clientes.flatMap((c) => c.tags || [])), [clientes]);
  const tiposEvento = useMemo(() => uniqSorted(eventos.map((e) => e.tipo_evento)), [eventos]);

  // ── KPIs / limite / série ──
  const agg = useMemo(() => agregado(campanhas), [campanhas]);
  const limite = useMemo(() => limiteInfo(plano, campanhas, now), [plano, campanhas, now]);
  const serie = useMemo(() => serieEnviosMensal(campanhas, now, 6), [campanhas, now]);
  const podeEmail = limite.limite > 0;
  const isPro = podeEmail;

  // ── Lista filtrada ──
  const filtradas = useMemo(() => {
    let arr = campanhas;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((c) => c.nome.toLowerCase().includes(q));
    if (fStatus) arr = arr.filter((c) => c.status === fStatus);
    if (fCanal) arr = arr.filter((c) => c.canal === fCanal);
    return arr;
  }, [campanhas, busca, fStatus, fCanal]);
  const temFiltro = !!(busca || fStatus || fCanal);

  // ── Persistência da campanha (rascunho) — devolve o id (insert ou update) ──
  async function persistir(campos: CommitArgs['campos'], filtro: SegmentoFiltro): Promise<string | null> {
    const payload = {
      usuario_id: userId, nome: campos.nome, canal: campos.canal,
      assunto: campos.canal === 'email' ? campos.assunto : null, corpo: campos.corpo, segmento: filtro,
    };
    if (editing?.id) {
      const { error } = await sb.from('campanhas').update(payload as TablesUpdate<'campanhas'>).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar a campanha.'); return null; }
      return editing.id;
    }
    const { data, error } = await sb.from('campanhas').insert({ ...payload, status: 'rascunho' } as TablesInsert<'campanhas'>).select().single();
    if (error) { toast.error('Não foi possível criar a campanha.'); return null; }
    setEditing(normCampanha(data));
    return String(data.id);
  }

  // ── Materializa a fila (campanhas_envios) a partir do público resolvido ──
  async function materializar(campId: string, campos: CommitArgs['campos'], filtro: SegmentoFiltro): Promise<number> {
    const pub = resolverPublico(alvos, filtro, descadastros, campos.canal, now);
    let elig = pub.elegiveis;
    if (campos.canal === 'email') elig = elig.slice(0, limite.restante);  // respeita o limite do plano
    // limpa fila antiga p/ não duplicar em reenvio do rascunho
    await sb.from('campanhas_envios').delete().eq('campanha_id', campId).eq('status', 'fila');
    if (!elig.length) return 0;
    const rows = elig.map(({ alvo, contato }) => ({
      campanha_id: campId, usuario_id: userId, cliente_id: alvo.id, contato, nome: alvo.nome,
      vars: varsDoAlvo(alvo, empresa), status: 'fila',
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from('campanhas_envios').insert(rows.slice(i, i + 500) as TablesInsert<'campanhas_envios'>[]);
      if (error) { toast.error('Falha ao montar a fila de envio.'); break; }
    }
    return rows.length;
  }

  // ── Commit do Builder (rascunho / enviar / agendar / whatsapp) ──
  async function onCommit(a: CommitArgs): Promise<boolean> {
    const campId = await persistir(a.campos, a.filtro);
    if (!campId) return false;

    if (a.modo === 'rascunho') {
      await sb.from('campanhas').update({ status: editing?.status === 'enviada' ? 'enviada' : 'rascunho' }).eq('id', campId);
      toast.success('Rascunho salvo.');
      await carregar(userId!); return true;
    }

    const n = await materializar(campId, a.campos, a.filtro);
    if (n === 0) { toast.error('Nenhum destinatário elegível no público.'); return false; }
    await sb.from('campanhas').update({ n_total: n }).eq('id', campId);

    if (a.modo === 'agendar') {
      await sb.from('campanhas').update({ status: 'agendada', agendada_para: a.agendada_para }).eq('id', campId);
      toast.success(`Campanha agendada para ${formatDate(a.agendada_para)} (${formatNumber(n)} destinatários).`);
      await carregar(userId!); return true;
    }

    if (a.modo === 'whatsapp') {
      await sb.from('campanhas').update({ status: 'enviando' }).eq('id', campId);
      toast.success(`${formatNumber(n)} links de WhatsApp prontos — abra a campanha para enviar.`);
      await carregar(userId!);
      const { data } = await sb.from('campanhas').select('*').eq('id', campId).maybeSingle();
      if (data) setMetrica(normCampanha(data));
      return true;
    }

    // modo 'enviar' (e-mail) → API processa a fila (assíncrono)
    const res = await fetch('/api/campanhas/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: campId, empresa }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_SMTP') toast.error('Configure o e-mail (SMTP) para disparar campanhas.');
    else if (j.code === 'PLAN' || j.code === 'LIMIT') toast.info(j.error);
    else if (j.error) toast.error(j.error);
    else toast.success(j.restantes > 0 ? `Enviando para ${formatNumber(n)} cliente(s)… o restante segue em fila.` : `Campanha enviada para ${formatNumber(j.enviados ?? n)} cliente(s).`);
    await carregar(userId!); return true;
  }

  async function onTeste(campos: CommitArgs['campos'], email: string): Promise<void> {
    const campId = await persistir(campos, editing?.segmento || {});
    if (!campId) return;
    const res = await fetch('/api/campanhas/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id: campId, teste: email, empresa }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_SMTP') toast.error(j.error || 'SMTP não configurado.');
    else if (j.error) toast.error(j.error);
    else toast.success(`E-mail de teste enviado para ${email}.`);
  }

  async function onGerarIA(objetivo: string, canal: Canal): Promise<{ assunto: string; corpo: string } | null> {
    const res = await fetch('/api/campanhas/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ objetivo, canal }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_KEY') { toast.info(j.error); return null; }
    if (j.error) { toast.error(j.error); return null; }
    return { assunto: j.assunto || '', corpo: j.corpo || '' };
  }

  const loadEnvios = useCallback(async (campanhaId: string): Promise<Envio[]> => {
    const { data } = await sb.from('campanhas_envios').select('*').eq('campanha_id', campanhaId).order('criado_em', { ascending: true });
    return ((data || []) as unknown[]).map(normEnvio);
  }, []);

  async function onMarcarEnviados(campanhaId: string): Promise<boolean> {
    const agora = new Date().toISOString();
    const { error } = await sb.from('campanhas_envios').update({ status: 'enviado', enviado_em: agora }).eq('campanha_id', campanhaId).eq('status', 'fila');
    if (error) { toast.error('Falha ao marcar como enviados.'); return false; }
    const envs = await loadEnvios(campanhaId);
    const enviados = envs.filter((e) => e.status !== 'fila' && e.status !== 'falha' && e.status !== 'descadastrado').length;
    const fila = envs.filter((e) => e.status === 'fila').length;
    await sb.from('campanhas').update({ status: fila ? 'enviando' : 'enviada', enviada_em: agora, n_total: envs.length, n_enviados: enviados }).eq('id', campanhaId);
    toast.success('Marcados como enviados.');
    await carregar(userId!);
    return true;
  }

  function abrirNova() { setEditing(null); setBuilderOpen(true); }
  function abrirEdicao(c: Campanha) { setEditing(c); setBuilderOpen(true); }

  async function duplicar(c: Campanha) {
    const { error } = await sb.from('campanhas').insert({
      usuario_id: userId, nome: `${c.nome} (cópia)`, canal: c.canal, assunto: c.assunto, corpo: c.corpo,
      segmento: c.segmento, status: 'rascunho',
    } as TablesInsert<'campanhas'>);
    if (error) { toast.error('Falha ao duplicar.'); return; }
    toast.success('Campanha duplicada como rascunho.');
    await carregar(userId!);
  }

  async function excluir(c: Campanha) {
    if (!confirm(`Excluir a campanha "${c.nome}" e seu histórico de envios? Esta ação não pode ser desfeita.`)) return;
    setCampanhas((prev) => prev.filter((x) => x.id !== c.id));
    const { error } = await sb.from('campanhas').delete().eq('id', c.id);
    if (error) { toast.error('Falha ao excluir.'); await carregar(userId!); }
    else toast.success('Campanha excluída.');
  }

  function exportar() {
    const csv = campanhasToCSV(filtradas, (s) => formatDate(s, { style: 'short' }));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `campanhas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Campanhas</h1>
          <p className="mt-1 text-sm text-ink-muted">Mensagens em massa para segmentos de clientes por e-mail e WhatsApp. O público reaproveita os segmentos de <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          {filtradas.length > 0 && (
            <button onClick={exportar} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>
          )}
          {!needsSetup && (
            <button onClick={abrirNova} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova campanha</button>
          )}
        </div>
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoMegaphone size={22} /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Campanhas</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">As tabelas <code className="rounded bg-black/[0.06] px-1">campanhas</code>, <code className="rounded bg-black/[0.06] px-1">campanhas_envios</code> e <code className="rounded bg-black/[0.06] px-1">descadastros</code> ainda não existem neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/campanhas.sql</code> no Supabase para começar.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Campanhas" value={formatNumber(agg.total)} foot={<>{formatNumber(agg.enviadas)} enviada(s) · {formatNumber(agg.agendadas)} agendada(s)</>} />
            <Kpi label="Enviados (total)" value={formatNumber(agg.enviados)} foot={<>{formatNumber(agg.entregues)} entregues</>} />
            <Kpi label="Abertura média" value={agg.entregues || agg.enviados ? formatPercent(agg.aberturaMedia) : '—'} foot={<>{formatNumber(agg.abertos)} aberturas</>} />
            <Kpi label="Cliques (média)" value={agg.abertos || agg.enviados ? formatPercent(agg.cliqueMedio) : '—'} foot={<>{formatNumber(agg.clicados)} cliques</>} />
          </div>

          {/* Série + limite do plano */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-card lg:col-span-2">
              <h3 className="mb-1 text-sm font-bold text-ink">Envios e aberturas por mês</h3>
              <p className="mb-2 text-xs text-ink-muted"><span className="text-brand/40">▮</span> enviados &nbsp;<span className="text-amber-500">●</span> abertos</p>
              <MiniEnvios serie={serie} />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 text-sm font-bold text-ink">Plano</h3>
              {podeEmail ? (
                <>
                  <LimiteBar usado={limite.usado} limite={limite.limite} />
                  <p className="mt-3 text-xs text-ink-muted">Restam <strong className="text-ink-soft">{formatNumber(limite.restante)}</strong> e-mails este mês no seu plano.</p>
                </>
              ) : (
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-brand-50/40 p-4">
                  <p className="text-sm font-semibold text-ink">Envio por e-mail é Pro+</p>
                  <p className="mt-1 text-xs text-ink-muted">Monte campanhas e use o WhatsApp (links em lote) no plano atual. Para disparo de e-mail em massa e IA, faça upgrade.</p>
                  <Link href="/painel/planos" className="mt-3 inline-block rounded-lg bg-gradient-to-r from-amber-500 to-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Ver planos</Link>
                </div>
              )}
            </div>
          </div>

          {/* Filtros */}
          {campanhas.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campanha…" className={`${inp} pl-9`} />
              </div>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusCampanha | '')} className={selCls} aria-label="Filtrar por status">
                <option value="">Todos os status</option>
                {STATUS_CAMPANHA.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
              <select value={fCanal} onChange={(e) => setFCanal(e.target.value as Canal | '')} className={selCls} aria-label="Filtrar por canal">
                <option value="">Todos os canais</option>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {temFiltro && <button onClick={() => { setBusca(''); setFStatus(''); setFCanal(''); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
            </div>
          )}

          {/* Lista */}
          <div className="mt-4">
            {filtradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoMegaphone size={22} /></div>
                <h3 className="text-base font-bold text-ink">{campanhas.length ? 'Nenhuma campanha com esses filtros' : 'Crie sua primeira campanha'}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{campanhas.length ? 'Ajuste a busca ou os filtros acima.' : 'Reative clientes, parabenize aniversariantes ou anuncie datas — em poucos cliques, para o segmento certo.'}</p>
                {!campanhas.length && <button onClick={abrirNova} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova campanha</button>}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtradas.map((c) => (
                  <div key={c.id} className="group rounded-2xl bg-white p-4 shadow-card transition hover:shadow-pop">
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setMetrica(c)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-bold text-ink group-hover:text-brand">{c.nome}</h3>
                          <StatusChip status={c.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                          <CanalBadge canal={c.canal} />
                          <span>{formatNumber(c.n_total)} no público</span>
                          {c.canal === 'email'
                            ? <>
                                <span>Abertura: <strong className="text-ink-soft">{c.n_enviados ? formatPercent(taxaAbertura(c)) : '—'}</strong></span>
                                <span>Cliques: <strong className="text-ink-soft">{c.n_enviados ? formatPercent(taxaClique(c)) : '—'}</strong></span>
                              </>
                            : <span>{formatNumber(c.n_enviados)} enviados</span>}
                          {c.agendada_para && c.status === 'agendada' && <span>📅 {formatDate(c.agendada_para)}</span>}
                          {c.enviada_em && c.status === 'enviada' && <span>Enviada em {formatDate(c.enviada_em)}</span>}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setMetrica(c)} title="Métricas" aria-label="Ver métricas" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEye /></button>
                        {(c.status === 'rascunho' || c.status === 'agendada') && <button onClick={() => abrirEdicao(c)} title="Editar" aria-label="Editar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>}
                        <button onClick={() => duplicar(c)} title="Duplicar" aria-label="Duplicar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoCopy /></button>
                        <button onClick={() => excluir(c)} title="Excluir" aria-label="Excluir" className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* dica IA / clientes ausentes */}
          {clientes.length === 0 && (
            <p className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 text-sm text-ink-muted">
              Cadastre clientes em <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes</Link> para montar públicos segmentados (Campeão, Fiel, Inativos, Aniversariantes…).
            </p>
          )}
          {podeEmail && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted"><IcoSparkles /> Dica: deixe a IA escrever o assunto e o corpo a partir de um objetivo (no construtor).</p>
          )}
        </>
      )}

      {builderOpen && (
        <Builder
          inicial={editing} alvos={alvos} descadastros={descadastros} empresa={empresa} isPro={isPro}
          restanteEmail={limite.restante} podeEmail={podeEmail}
          origens={origens} cidades={cidades} tags={tags} tiposEvento={tiposEvento} now={now}
          onClose={() => { setBuilderOpen(false); setEditing(null); }}
          onCommit={onCommit} onTeste={onTeste} onGerarIA={onGerarIA}
        />
      )}
      {metrica && (
        <Metricas campanha={metrica} onClose={() => setMetrica(null)} loadEnvios={loadEnvios} onMarcarEnviados={onMarcarEnviados} />
      )}
    </div>
  );
}
