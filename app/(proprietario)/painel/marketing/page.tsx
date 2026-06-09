'use client';

// Marketing (cockpit de aquisição) · /painel/marketing.
// Central de aquisição e presença: de onde vêm os leads, quanto custa cada canal,
// o que converte e a agenda de conteúdo/ações. Reúne, num só lugar:
//   • Visão — leads no período, CAC, conversão lead→contrato, ROI, CPL.
//   • Funil — visitante→lead→qualificado→proposta→fechado (puxa do CRM) + gargalo.
//   • Canais — tabela editável (custo, leads, conversão, ROI) + ranking.
//   • Agenda — calendário de conteúdo/ações (arrastar p/ reagendar) + campanhas.
//   • Conteúdo — UTM builder, QR de divulgação, gerador de post com IA (Pro+).
//   • Reputação — snapshot de avaliações (média/volume/distribuição).
//
// FONTES (somente leitura, exceto marketing_canais/marketing_acoes):
//   clientes_eventos (status + como_conheceu) ⊕ clientes.origem → atribuição/funil;
//   lancamentos (categoria 'Marketing') → gasto registrado no Financeiro;
//   avaliacoes (via propriedades do dono) → reputação; campanhas → agenda.
// Motor puro em lib/marketing. i18n via lib/format (sem "R$" hardcoded).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Canal, type Acao, type LeadLite, type CanalTipo, type Periodo, type TipoAcao, type StatusAcao,
  ORIGENS, ORIGEM_LABEL, ORIGEM_COR, CANAL_TIPOS,
  normalizeOrigem, periodoRange, mesesNoPeriodo, dentroDoPeriodo,
  funilAquisicao, metricasPorCanal, resumoMarketing, leadsPorOrigem, serieLeadsMensal,
  validarCanal, canaisToCSV, isMissingTable,
} from '@/lib/marketing';
import {
  Tabs, Kpi, Donut, FunilAquisicao, RankBar, MiniLeads, Stars, moedaSimbolo,
  IcoGrowth, IcoFunnel, IcoChannels, IcoCalendar, IcoContent, IcoStar,
  IcoPlus, IcoDownload, IcoEdit, IcoTrash, IcoX, IcoExternal, IcoTarget,
} from './_components/ui';
import { Agenda, type CampanhaCal } from './_components/Agenda';
import { Conteudo } from './_components/Conteudo';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

type Tab = 'visao' | 'funil' | 'canais' | 'agenda' | 'conteudo' | 'reputacao';
type Avaliacao = { nota: number; criado_em: string; evento_tipo: string | null; oculta?: boolean; verificada?: boolean };

function norm(s: string | null | undefined): string { return (s || '').trim().toLowerCase(); }
function pick(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) { const v = obj?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
  return '';
}
function fmtRoi(roi: number | null): string { return roi == null ? '—' : `${formatNumber(roi, { maximumFractionDigits: 1 })}×`; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normCanal(c: any): Canal {
  return {
    id: String(c.id), usuario_id: c.usuario_id ?? '', nome: c.nome ?? '', origem_key: c.origem_key || 'outro',
    tipo: (c.tipo || 'outro') as CanalTipo, custo_mensal_num: Number(c.custo_mensal_num) || 0,
    ativo: c.ativo !== false, criado_em: c.criado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normAcao(a: any): Acao {
  return {
    id: String(a.id), usuario_id: a.usuario_id ?? '', canal_id: a.canal_id ? String(a.canal_id) : null,
    titulo: a.titulo ?? '', tipo: (a.tipo || 'post') as TipoAcao, data: (a.data || '').slice(0, 10),
    status: (a.status || 'planejado') as StatusAcao, investimento_num: Number(a.investimento_num) || 0,
    resultado: (a.resultado && typeof a.resultado === 'object') ? a.resultado : {}, criado_em: a.criado_em ?? '',
  };
}

type CanalForm = { id: string | null; nome: string; origem_key: string; tipo: CanalTipo; custo_mensal: string; ativo: boolean };

export default function MarketingPage() {
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const [empresa, setEmpresa] = useState('');

  const [tab, setTab] = useState<Tab>('visao');
  const [periodo, setPeriodo] = useState<Periodo>('mes');

  const [canais, setCanais] = useState<Canal[]>([]);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [leadsAll, setLeadsAll] = useState<LeadLite[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaCal[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [lancMkt, setLancMkt] = useState<{ valor: number; data: string }[]>([]);

  const [canalModal, setCanalModal] = useState<CanalForm | null>(null);
  const [canalErros, setCanalErros] = useState<string[]>([]);
  const [savingCanal, setSavingCanal] = useState(false);

  const isPro = plano === 'pro' || plano === 'ultra';

  const carregar = useCallback(async (uid: string) => {
    const [canaisRes, acoesRes, evRes, cliRes, campRes, propRes, lancRes] = await Promise.all([
      sb.from('marketing_canais').select('*').eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('marketing_acoes').select('*').eq('usuario_id', uid),
      sb.from('clientes_eventos').select('id,status,valor_total_num,como_conheceu,cliente_id,quem_contratou,criado_em').eq('usuario_id', uid),
      sb.from('clientes').select('id,nome,origem').eq('usuario_id', uid),
      sb.from('campanhas').select('id,nome,status,agendada_para,enviada_em').eq('usuario_id', uid),
      sb.from('propriedades').select('id').eq('usuario_id', uid),
      sb.from('lancamentos').select('valor,data,categoria,tipo').eq('usuario_id', uid).eq('tipo', 'despesa'),
    ]);

    if (isMissingTable(canaisRes.error)) { setNeedsSetup(true); setCanais([]); setAcoes([]); return; }
    setNeedsSetup(false);
    setCanais(((canaisRes.data || []) as unknown[]).map(normCanal));
    setAcoes(isMissingTable(acoesRes.error) ? [] : ((acoesRes.data || []) as unknown[]).map(normAcao));

    // ── Atribuição de origem: como_conheceu do evento → fallback clientes.origem ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientes = (isMissingTable(cliRes.error) ? [] : (cliRes.data || [])) as any[];
    const cliById = new Map(clientes.map((c) => [String(c.id), c]));
    const cliByNome = new Map(clientes.map((c) => [norm(c.nome), c]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = ((evRes.data || []) as any[]);
    setLeadsAll(ev.map((e) => {
      let origemRaw: string | null | undefined = e.como_conheceu;
      if (!origemRaw) {
        const c = e.cliente_id ? cliById.get(String(e.cliente_id)) : cliByNome.get(norm(e.quem_contratou));
        origemRaw = c?.origem;
      }
      return { id: String(e.id), origem: normalizeOrigem(origemRaw), status: e.status ?? 'lead', valor: Number(e.valor_total_num) || 0, data: e.criado_em ?? null };
    }));

    // ── Campanhas → itens do calendário (somente leitura) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const camps = (isMissingTable(campRes.error) ? [] : (campRes.data || [])) as any[];
    const calItems: CampanhaCal[] = [];
    for (const c of camps) {
      if (c.agendada_para && c.status === 'agendada') calItems.push({ id: `${c.id}-a`, nome: c.nome || 'Campanha', data: String(c.agendada_para).slice(0, 10), tipo: 'agendada' });
      else if (c.enviada_em && c.status === 'enviada') calItems.push({ id: `${c.id}-e`, nome: c.nome || 'Campanha', data: String(c.enviada_em).slice(0, 10), tipo: 'enviada' });
    }
    setCampanhas(calItems);

    // ── Avaliações (via propriedades do dono) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propIds = (isMissingTable(propRes.error) ? [] : (propRes.data || [])).map((p: any) => p.id);
    if (propIds.length) {
      const { data: avals, error: avErr } = await sb.from('avaliacoes').select('nota,criado_em,evento_tipo,propriedade_id,oculta,verificada').in('propriedade_id', propIds);
      setAvaliacoes(isMissingTable(avErr) ? [] : ((avals || []) as Avaliacao[]).map((a) => ({ ...a, nota: Number(a.nota) || 0 })));
    } else setAvaliacoes([]);

    // ── Gasto de marketing lançado no Financeiro ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lanc = (isMissingTable(lancRes.error) ? [] : (lancRes.data || [])) as any[];
    setLancMkt(lanc.filter((l) => norm(l.categoria) === 'marketing').map((l) => ({ valor: Number(l.valor) || 0, data: (l.data || '').slice(0, 10) })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const uid = session.user.id;
      setUserId(uid);
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo, plano').eq('usuario_id', uid).maybeSingle();
        setPlano((a?.plano_ativo || a?.plano || 'basico').toString().toLowerCase());
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

  // ── Derivados do período ──
  const [ini, fim] = useMemo(() => periodoRange(periodo, now), [periodo, now]);
  const leads = useMemo(() => leadsAll.filter((l) => dentroDoPeriodo(l.data, ini, fim)), [leadsAll, ini, fim]);
  const acoesPeriodo = useMemo(() => acoes.filter((a) => dentroDoPeriodo(a.data, ini, fim)), [acoes, ini, fim]);
  const metrics = useMemo(() => metricasPorCanal(canais, acoesPeriodo, leads, mesesNoPeriodo(periodo)), [canais, acoesPeriodo, leads, periodo]);
  const resumo = useMemo(() => resumoMarketing(metrics), [metrics]);
  const funil = useMemo(() => funilAquisicao(leads), [leads]);
  const donut = useMemo(() => leadsPorOrigem(leads), [leads]);
  const serie = useMemo(() => serieLeadsMensal(leadsAll, now, 6), [leadsAll, now]);
  const gastoFinanceiro = useMemo(() => lancMkt.filter((l) => dentroDoPeriodo(l.data, ini, fim)).reduce((s, l) => s + l.valor, 0), [lancMkt, ini, fim]);
  const maxReceitaCanal = useMemo(() => Math.max(1, ...metrics.map((m) => m.receita)), [metrics]);

  const rep = useMemo(() => {
    const vis = avaliacoes.filter((a) => !a.oculta);
    const volume = vis.length;
    const media = volume ? vis.reduce((s, a) => s + a.nota, 0) / volume : 0;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, q: vis.filter((a) => Math.round(a.nota) === n).length }));
    const verificadas = volume ? vis.filter((a) => a.verificada).length / volume : 0;
    const noPeriodo = vis.filter((a) => dentroDoPeriodo(a.criado_em, ini, fim)).length;
    return { volume, media, dist, verificadas, noPeriodo };
  }, [avaliacoes, ini, fim]);

  // ── Handlers: canais ──
  function abrirNovoCanal() { setCanalErros([]); setCanalModal({ id: null, nome: '', origem_key: 'instagram', tipo: 'pago', custo_mensal: '', ativo: true }); }
  function abrirEdicaoCanal(c: Canal) { setCanalErros([]); setCanalModal({ id: c.id, nome: c.nome, origem_key: c.origem_key, tipo: c.tipo, custo_mensal: c.custo_mensal_num ? String(c.custo_mensal_num) : '', ativo: c.ativo }); }

  async function salvarCanal() {
    if (!canalModal || !userId) return;
    const custo = Number(canalModal.custo_mensal) || 0;
    const errs = validarCanal({ nome: canalModal.nome, custo_mensal_num: custo });
    if (errs.length) { setCanalErros(errs); return; }
    setSavingCanal(true);
    const payload = { usuario_id: userId, nome: canalModal.nome.trim(), origem_key: canalModal.origem_key, tipo: canalModal.tipo, custo_mensal_num: custo, ativo: canalModal.ativo };
    const { error } = canalModal.id
      ? await sb.from('marketing_canais').update(payload).eq('id', canalModal.id)
      : await sb.from('marketing_canais').insert(payload);
    setSavingCanal(false);
    if (error) { toast.error('Não foi possível salvar o canal.'); return; }
    toast.success(canalModal.id ? 'Canal atualizado.' : 'Canal adicionado.');
    setCanalModal(null);
    await carregar(userId);
  }

  async function excluirCanal(c: Canal) {
    if (!confirm(`Excluir o canal "${c.nome}"? As ações ligadas a ele ficam sem canal.`)) return;
    setCanais((prev) => prev.filter((x) => x.id !== c.id));
    const { error } = await sb.from('marketing_canais').delete().eq('id', c.id);
    if (error) { toast.error('Falha ao excluir.'); await carregar(userId!); } else toast.success('Canal excluído.');
  }

  // ── Handlers: ações (usados pela Agenda) ──
  const onSaveAcao = useCallback(async (p: {
    id: string | null; titulo: string; tipo: TipoAcao; canal_id: string | null; data: string;
    status: StatusAcao; investimento_num: number; resultado: Record<string, number | string>;
  }): Promise<boolean> => {
    if (!userId) return false;
    const payload = { usuario_id: userId, canal_id: p.canal_id, titulo: p.titulo, tipo: p.tipo, data: p.data, status: p.status, investimento_num: p.investimento_num, resultado: p.resultado };
    const { error } = p.id
      ? await sb.from('marketing_acoes').update(payload).eq('id', p.id)
      : await sb.from('marketing_acoes').insert(payload);
    if (error) { toast.error('Não foi possível salvar a ação.'); return false; }
    toast.success(p.id ? 'Ação atualizada.' : 'Ação criada.');
    await carregar(userId);
    return true;
  }, [userId, carregar, toast]);

  const onDeleteAcao = useCallback(async (id: string) => {
    if (!userId) return;
    setAcoes((prev) => prev.filter((a) => a.id !== id));
    const { error } = await sb.from('marketing_acoes').delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir a ação.'); await carregar(userId); } else toast.success('Ação excluída.');
  }, [userId, carregar, toast]);

  const onMoveAcao = useCallback(async (id: string, data: string) => {
    if (!userId) return;
    setAcoes((prev) => prev.map((a) => (a.id === id ? { ...a, data } : a)));  // otimista
    const { error } = await sb.from('marketing_acoes').update({ data }).eq('id', id);
    if (error) { toast.error('Não foi possível reagendar.'); await carregar(userId); } else toast.success('Ação reagendada.');
  }, [userId, carregar, toast]);

  const onGerarIA = useCallback(async (args: { formato: string; tema: string; rede: string; tom: string }): Promise<string | null> => {
    const res = await fetch('/api/marketing/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ ...args, empresa }),
    });
    const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
    if (j.code === 'NO_KEY') { toast.info(j.error); return null; }
    if (j.error) { toast.error(j.error); return null; }
    return j.texto || '';
  }, [empresa, toast]);

  function exportarCanais() {
    const csv = canaisToCSV(metrics, (n) => formatMoney(n), (f) => formatPercent(f));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `marketing-canais-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
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

  const TABS: { v: Tab; label: string; icon: ReactNode }[] = [
    { v: 'visao', label: 'Visão', icon: <IcoGrowth /> },
    { v: 'funil', label: 'Funil', icon: <IcoFunnel /> },
    { v: 'canais', label: 'Canais', icon: <IcoChannels /> },
    { v: 'agenda', label: 'Agenda', icon: <IcoCalendar /> },
    { v: 'conteudo', label: 'Conteúdo', icon: <IcoContent /> },
    { v: 'reputacao', label: 'Reputação', icon: <IcoStar /> },
  ];

  const periodoTag = { mes: 'no mês', trimestre: 'no trimestre', ano: 'no ano' }[periodo];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Marketing</h1>
          <p className="mt-1 text-sm text-ink-muted">Cockpit de aquisição: de onde vêm os leads, o custo por canal, o que converte e a agenda de conteúdo. Origem puxada de <Link href="/painel/clientes" className="font-semibold text-brand underline">Clientes</Link> e <Link href="/painel/leads" className="font-semibold text-brand underline">Leads</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={selCls} aria-label="Período">
            <option value="mes">Este mês</option><option value="trimestre">Trimestre</option><option value="ano">Este ano</option>
          </select>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoTarget size={22} /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Marketing</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">As tabelas <code className="rounded bg-black/[0.06] px-1">marketing_canais</code> e <code className="rounded bg-black/[0.06] px-1">marketing_acoes</code> ainda não existem neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/marketing.sql</code> no Supabase para começar.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {/* ───────── VISÃO ───────── */}
          {tab === 'visao' && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label={`Leads ${periodoTag}`} value={formatNumber(resumo.leads)} foot={<>{formatNumber(resumo.fechados)} fechado(s)</>} tone="brand" />
                <Kpi label="Conversão lead→contrato" value={resumo.leads ? formatPercent(resumo.conversao) : '—'} foot="do lead ao fechamento" tone="verde" />
                <Kpi label="CAC médio" value={resumo.cac == null ? '—' : formatMoneyShort(resumo.cac)} foot="custo por cliente" tone="azul" />
                <Kpi label="ROI de marketing" value={fmtRoi(resumo.roi)} foot={<>retorno {formatMoneyShort(resumo.retorno)}</>} tone="gold" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Investimento" value={formatMoneyShort(resumo.investimento)} foot="canais + ações" />
                <Kpi label="Receita atribuída" value={formatMoneyShort(resumo.receita)} foot="de leads fechados" />
                <Kpi label="CPL" value={resumo.cpl == null ? '—' : formatMoneyShort(resumo.cpl)} foot="custo por lead" />
                <Kpi label="Gasto no Financeiro" value={formatMoneyShort(gastoFinanceiro)} foot={<>categoria Marketing</>} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-card lg:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">Leads por mês</h3>
                    <span className="text-xs text-ink-muted">últimos 6 meses</span>
                  </div>
                  {serie.some((s) => s.n > 0) ? <MiniLeads serie={serie} /> : <div className="flex h-[160px] items-center justify-center text-sm text-ink-muted">Sem leads registrados ainda.</div>}
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">Origem dos leads {periodoTag}</h3>
                  {donut.length ? <Donut data={donut} centerValue={formatNumber(resumo.leads)} centerLabel="leads" /> : <div className="flex h-[128px] items-center justify-center text-sm text-ink-muted">Sem leads no período.</div>}
                </div>
              </div>

              {/* Top canais por receita */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Principais canais</h3>
                  <button onClick={() => setTab('canais')} className="text-xs font-semibold text-brand hover:underline">Ver todos →</button>
                </div>
                {metrics.some((m) => m.leads > 0 || m.investimento > 0) ? (
                  <div className="space-y-3">
                    {metrics.slice(0, 5).map((m) => (
                      <RankBar
                        key={m.origem_key}
                        label={<span className="font-medium text-ink-soft">{m.nome}</span>}
                        value={m.receita} total={maxReceitaCanal} cor={ORIGEM_COR[m.origem_key] || ORIGEM_COR.outro}
                        right={<span className="shrink-0 text-ink-muted">{formatNumber(m.leads)} leads · ROI {fmtRoi(m.roi)}</span>}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyHint
                    titulo="Configure seus canais"
                    texto="Cadastre os canais (Instagram, Google, Indicação…) com o custo mensal para ver CAC, CPL e ROI."
                    cta={<button onClick={() => setTab('canais')} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Adicionar canal</button>}
                  />
                )}
              </div>
            </div>
          )}

          {/* ───────── FUNIL ───────── */}
          {tab === 'funil' && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-1 text-sm font-bold text-ink">Funil de aquisição {periodoTag}</h3>
                <p className="mb-4 text-xs text-ink-muted">Do CRM (status dos leads em <Link href="/painel/leads" className="font-medium text-brand underline">Leads</Link>). Cada etapa é cumulativa.</p>
                {leads.length ? <FunilAquisicao funil={funil} /> : <div className="flex h-[200px] items-center justify-center text-sm text-ink-muted">Sem leads no período selecionado.</div>}
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-ink to-[#2a2a2a] p-5 text-white shadow-card">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/60">Gargalo do funil</span>
                  {funil.gargalo ? (
                    <>
                      <div className="mt-2 text-lg font-bold">{funil.gargalo.de} → {funil.gargalo.para}</div>
                      <div className="mt-1 text-sm text-white/70">Só {formatPercent(funil.gargalo.conv)} avançam nesta etapa. É aqui que você mais perde oportunidades.</div>
                    </>
                  ) : <div className="mt-2 text-sm text-white/70">Sem dados suficientes para apontar um gargalo.</div>}
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h4 className="mb-3 text-sm font-bold text-ink">Conversão por etapa</h4>
                  <div className="space-y-2 text-sm">
                    {funil.etapas.map((e) => (
                      <div key={e.key} className="flex items-center justify-between">
                        <span className="text-ink-soft">{e.label}</span>
                        <span className="font-semibold text-ink">{formatNumber(e.n)} <span className="font-normal text-ink-muted">({formatPercent(e.pct)})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───────── CANAIS ───────── */}
          {tab === 'canais' && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink-muted">Custo, leads, conversão e ROI por canal {periodoTag}. Edite o custo mensal de cada canal.</p>
                <div className="flex items-center gap-2">
                  {metrics.length > 0 && <button onClick={exportarCanais} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
                  <button onClick={abrirNovoCanal} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo canal</button>
                </div>
              </div>

              {metrics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoChannels /></div>
                  <h3 className="text-base font-bold text-ink">Nenhum canal ainda</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Cadastre seus canais de aquisição para acompanhar custo, conversão e retorno.</p>
                  <button onClick={abrirNovoCanal} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo canal</button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                        <th className="px-4 py-3 font-semibold">Canal</th>
                        <th className="px-3 py-3 text-right font-semibold">Leads</th>
                        <th className="px-3 py-3 text-right font-semibold">Fechados</th>
                        <th className="px-3 py-3 text-right font-semibold">Conversão</th>
                        <th className="px-3 py-3 text-right font-semibold">Investimento</th>
                        <th className="px-3 py-3 text-right font-semibold">Receita</th>
                        <th className="px-3 py-3 text-right font-semibold">CPL</th>
                        <th className="px-3 py-3 text-right font-semibold">CAC</th>
                        <th className="px-3 py-3 text-right font-semibold">ROI</th>
                        <th className="w-20 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m) => {
                        const canal = canais.find((c) => c.origem_key === m.origem_key && m.configurado);
                        return (
                          <tr key={m.origem_key} className="group border-b border-black/[0.04] last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ORIGEM_COR[m.origem_key] || ORIGEM_COR.outro }} />
                                <span className="font-semibold text-ink">{m.nome}</span>
                                {!m.configurado && <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink-muted" title="Origem vinda do CRM, sem canal cadastrado">do CRM</span>}
                                {m.configurado && !m.ativo && <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink-muted">inativo</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{formatNumber(m.leads)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{formatNumber(m.fechados)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{m.leads ? formatPercent(m.conversao) : '—'}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{formatMoneyShort(m.investimento)}</td>
                            <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-600">{formatMoneyShort(m.receita)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{m.cpl == null ? '—' : formatMoneyShort(m.cpl)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{m.cac == null ? '—' : formatMoneyShort(m.cac)}</td>
                            <td className={`px-3 py-3 text-right tabular-nums font-semibold ${m.roi == null ? 'text-ink-muted' : m.roi >= 1 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtRoi(m.roi)}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                                {canal ? (
                                  <>
                                    <button onClick={() => abrirEdicaoCanal(canal)} title="Editar" aria-label="Editar canal" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                                    <button onClick={() => excluirCanal(canal)} title="Excluir" aria-label="Excluir canal" className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                                  </>
                                ) : (
                                  <button onClick={() => { setCanalErros([]); setCanalModal({ id: null, nome: ORIGEM_LABEL[m.origem_key] || m.nome, origem_key: m.origem_key, tipo: 'organico', custo_mensal: '', ativo: true }); }} title="Cadastrar canal" aria-label="Cadastrar canal" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoPlus size={14} /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-ink-muted">CAC = investimento ÷ fechados · CPL = investimento ÷ leads · ROI = receita atribuída ÷ investimento. Origens marcadas <span className="font-medium">do CRM</span> não têm canal/custo cadastrado.</p>
            </div>
          )}

          {/* ───────── AGENDA ───────── */}
          {tab === 'agenda' && (
            <Agenda acoes={acoes} canais={canais} campanhas={campanhas} now={now} onSave={onSaveAcao} onDelete={onDeleteAcao} onMove={onMoveAcao} />
          )}

          {/* ───────── CONTEÚDO ───────── */}
          {tab === 'conteudo' && (
            <Conteudo empresa={empresa} siteUrl="https://www.ventsy.com.br" isPro={isPro} onGerarIA={onGerarIA} />
          )}

          {/* ───────── REPUTAÇÃO ───────── */}
          {tab === 'reputacao' && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-3 text-sm font-bold text-ink">Reputação</h3>
                {rep.volume ? (
                  <>
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-bold text-ink">{formatNumber(rep.media, { maximumFractionDigits: 1 })}</span>
                      <div className="pb-1"><Stars nota={rep.media} size={16} /><div className="mt-0.5 text-xs text-ink-muted">{formatNumber(rep.volume)} avaliação(ões)</div></div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      {rep.dist.map((d) => (
                        <div key={d.n} className="flex items-center gap-2 text-xs">
                          <span className="w-3 text-ink-muted">{d.n}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${rep.volume ? (d.q / rep.volume) * 100 : 0}%` }} /></div>
                          <span className="w-6 text-right tabular-nums text-ink-muted">{d.q}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-ink-muted">{formatPercent(rep.verificadas)} verificadas · {formatNumber(rep.noPeriodo)} {periodoTag}</div>
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-ink-muted">Ainda sem avaliações públicas.</p>
                )}
                <Link href="/painel/avaliacoes" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Gerenciar avaliações <IcoExternal /></Link>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <h3 className="mb-3 text-sm font-bold text-ink">Prova social no marketing</h3>
                <p className="text-sm text-ink-muted">Avaliações são o ativo de marketing que mais converte. Use suas melhores notas em posts e anúncios, e responda às críticas para proteger a reputação.</p>
                <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-brand">●</span> Transforme avaliações 5★ em depoimentos para o Instagram.</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-brand">●</span> Peça avaliação após cada evento (Feedbacks → promover a público).</li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-brand">●</span> Use o QR de divulgação (aba Conteúdo) no balcão para captar avaliações.</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/painel/feedbacks" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-ink-soft hover:border-brand/30 hover:text-brand">Feedbacks</Link>
                  <Link href="/painel/campanhas" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-ink-soft hover:border-brand/30 hover:text-brand">Campanhas</Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de canal */}
      {canalModal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setCanalModal(null)}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setCanalModal(null)} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]"><IcoX /></button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{canalModal.id ? 'Editar canal' : 'Novo canal'}</h3>
            <div className="space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome</span><input value={canalModal.nome} onChange={(e) => setCanalModal({ ...canalModal, nome: e.target.value })} className={inp} autoFocus placeholder="Ex: Instagram Ads" /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Origem (atribuição)</span>
                  <select value={canalModal.origem_key} onChange={(e) => setCanalModal({ ...canalModal, origem_key: e.target.value })} className={inp}>
                    {ORIGENS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}
                  </select>
                </label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span>
                  <select value={canalModal.tipo} onChange={(e) => setCanalModal({ ...canalModal, tipo: e.target.value as CanalTipo })} className={inp}>
                    {CANAL_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Custo mensal</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{moedaSimbolo()}</span>
                  <input type="number" min={0} step="0.01" value={canalModal.custo_mensal} onChange={(e) => setCanalModal({ ...canalModal, custo_mensal: e.target.value })} className={`${inp} pl-10`} placeholder="0,00" />
                </div>
                <span className="mt-1 block text-xs text-ink-muted">Custo fixo recorrente (ex.: verba de mídia). Investimentos pontuais entram nas ações.</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={canalModal.ativo} onChange={(e) => setCanalModal({ ...canalModal, ativo: e.target.checked })} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" /><span className="text-sm font-semibold text-ink-soft">Canal ativo</span></label>
              {canalErros.length > 0 && <ul className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{canalErros.map((e) => <li key={e}>• {e}</li>)}</ul>}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvarCanal} disabled={savingCanal} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{savingCanal ? 'Salvando…' : canalModal.id ? 'Salvar' : 'Adicionar canal'}</button>
              <button onClick={() => setCanalModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component local ──
function EmptyHint({ titulo, texto, cta }: { titulo: string; texto: string; cta?: ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">{texto}</p>
      {cta}
    </div>
  );
}
