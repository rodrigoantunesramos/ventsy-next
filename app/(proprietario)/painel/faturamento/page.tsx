'use client';

// Faturamento & Notas Fiscais — /painel/faturamento.
// Emite e controla documentos fiscais (NFS-e municipal de locação, NF-e de
// produto e RECIBO numerado), gera cobranças com link de pagamento e fecha a
// conciliação nota↔recebimento↔contábil. Fontes de dados:
//   • notas_fiscais / faturas  → documentos e cobranças (RLS por dono)
//   • parcelas (Recebíveis) + clientes_eventos (CRM) → o que faturar/cobrar
//   • empresa_config.config_fiscal → regime/ISS/código de serviço do emitente
// Numeração e ISS/retenções são AUTORITATIVOS no servidor (/api/faturamento/*,
// motor puro lib/fiscal.ts). Degrade sem provedor: emissão manual / recibo PDF.
// i18n via lib/format — nenhum "R$" hardcoded (o símbolo do input vem do locale).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate, type Currency } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  calcularImpostos, TIPO_LABEL, STATUS_META, PROVEDORES, RETENCAO_LABEL,
  type NotaTipo, type NotaStatus, type RetencaoChave, type RetencaoConfig,
} from '@/lib/fiscal';
import {
  coerceNota, coerceFatura, ymd, moedaSimbolo, faturaEfetiva, FATURA_META, MEIO_LABEL,
  tomadorDoEvento, exportNotasCSV, inp,
  type NotaFiscal, type Fatura, type Evento, type Parcela, type ProvedorStatus, type FaturaStatus,
} from './_lib';
import { buildNotaPDF, type EmpresaPdf } from './_pdf';
import { SetupCard } from '@/components/ui/Estados';

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PALETTE = ['#10b981', '#1a73e8', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8'];
const PAGE_SIZE = 12;
const RETENCOES: { k: RetencaoChave; hint: string }[] = [
  { k: 'iss_retido', hint: 'ISS retido pelo tomador' },
  { k: 'irrf', hint: 'IR na fonte (1,5%)' },
  { k: 'pis', hint: 'PIS (0,65%)' },
  { k: 'cofins', hint: 'COFINS (3%)' },
  { k: 'csll', hint: 'CSLL (1%)' },
  { k: 'inss', hint: 'INSS (11%)' },
];
const MEIOS: { v: 'pix' | 'boleto' | 'cartao' | 'link'; label: string }[] = [
  { v: 'link', label: 'Link (Pix/cartão/boleto)' },
  { v: 'pix', label: 'Pix' },
  { v: 'boleto', label: 'Boleto' },
  { v: 'cartao', label: 'Cartão' },
];

type EmpresaInfo = EmpresaPdf & { moeda: Currency; config_fiscal: { iss?: string; codigo_servico?: string; regime?: string } };
type FiltroTipo = 'todos' | NotaTipo;
type FiltroStatus = 'todos' | NotaStatus;

export default function FaturamentoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [provedor, setProvedor] = useState<ProvedorStatus | null>(null);

  const [fTipo, setFTipo] = useState<FiltroTipo>('todos');
  const [fStatus, setFStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const [loteBusy, setLoteBusy] = useState(false);

  const hoje = ymd(new Date());
  const moeda = empresa?.moeda || 'BRL';

  // ── Carga ──
  const carregar = useCallback(async (uid: string) => {
    const [nRes, fRes, eRes, pRes, cRes] = await Promise.all([
      sb.from('notas_fiscais').select('*').eq('usuario_id', uid).order('numero_seq', { ascending: false }),
      sb.from('faturas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,documento,email,tipo_evento,status,data_inicio,valor_total_num,propriedade_id,cliente_id').eq('usuario_id', uid).order('data_inicio', { nullsFirst: false }),
      sb.from('parcelas').select('id,evento_id,numero,descricao,valor,vencimento,status,pago_em,nota_id').eq('usuario_id', uid),
      sb.from('empresa_config').select('fantasia,razao_social,cnpj,im,contatos,endereco,moeda,config_fiscal').eq('usuario_id', uid).maybeSingle(),
    ]);

    if (nRes.error && (nRes.error.code === '42P01' || nRes.error.code === 'PGRST205')) { setNeedsSetup(true); setNotas([]); return; }
    setNeedsSetup(false);

    setNotas(((nRes.data || []) as NotaFiscal[]).map(coerceNota));
    setFaturas(((fRes.data || []) as Fatura[]).map(coerceFatura));
    setEventos(((eRes.data || []) as Evento[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setParcelas(((pRes.data || []) as Parcela[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor) })));
    if (cRes.data) {
      const cf = (cRes.data.config_fiscal || {}) as EmpresaInfo['config_fiscal'];
      setEmpresa({
        fantasia: cRes.data.fantasia, razao_social: cRes.data.razao_social, cnpj: cRes.data.cnpj, im: cRes.data.im,
        contatos: cRes.data.contatos as EmpresaPdf['contatos'], endereco: cRes.data.endereco as EmpresaPdf['endereco'],
        moeda: (cRes.data.moeda || 'BRL') as Currency, config_fiscal: cf,
      });
    }
  }, []);

  const carregarProvedor = useCallback(async () => {
    try {
      const r = await fetch('/api/faturamento/provedor', { headers: { ...(await authHeaders()) } });
      if (r.ok) setProvedor(await r.json());
    } catch { /* silencioso — degrade para recibo */ }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await Promise.all([carregar(session.user.id), carregarProvedor()]);
      setLoading(false);
    })();
  }, [carregar, carregarProvedor]);

  useEffect(() => { setPage(0); }, [fTipo, fStatus, busca]);

  const eventoById = useCallback((id: string | null) => (id ? eventos.find((e) => e.id === id) : undefined), [eventos]);
  const eventoNome = useCallback((id: string | null) => eventoById(id)?.nome_evento || '', [eventoById]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const mesAtual = hoje.slice(0, 7);
    let faturadoMes = 0, issMes = 0;
    notas.forEach((no) => {
      if (no.status !== 'emitida' || !no.emitida_em || no.emitida_em.slice(0, 7) !== mesAtual) return;
      faturadoMes += no.valor_total_num;
      const issRet = (no.retencoes?.linhas || []).find((l) => l.chave === 'iss_retido')?.valor || 0;
      issMes += Math.max(0, no.iss_num - issRet); // ISS próprio (não retido) = a recolher
    });
    const pagasSemNota = parcelas.filter((p) => p.status === 'pago' && !p.nota_id);
    const aFaturar = pagasSemNota.reduce((s, p) => s + p.valor, 0);
    const inadimplencia = faturas.filter((f) => faturaEfetiva(f, hoje) === 'vencida').reduce((s, f) => s + f.valor_num, 0);
    return { faturadoMes, issMes, aFaturar, aFaturarN: pagasSemNota.length, inadimplencia };
  }, [notas, parcelas, faturas, hoje]);

  // ── Série mensal (faturado emitido, 6m) ──
  const serie = useMemo(() => {
    const now = new Date();
    const base = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_PT[d.getMonth()], valor: 0 };
    });
    notas.forEach((no) => {
      if (no.status !== 'emitida' || !no.emitida_em) return;
      const slot = base.find((b) => b.key === no.emitida_em!.slice(0, 7));
      if (slot) slot.valor += no.valor_total_num;
    });
    return base;
  }, [notas]);

  // ── Distribuição por tipo (emitidas) ──
  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    notas.filter((no) => no.status === 'emitida').forEach((no) => m.set(TIPO_LABEL[no.tipo], (m.get(TIPO_LABEL[no.tipo]) || 0) + no.valor_total_num));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notas]);

  const statusCount = useMemo(() => {
    const m: Record<NotaStatus, number> = { rascunho: 0, emitida: 0, cancelada: 0, erro: 0 };
    notas.forEach((no) => { m[no.status] = (m[no.status] || 0) + 1; });
    return m;
  }, [notas]);

  // ── Filtro/paginação das notas ──
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas.filter((no) => {
      if (fTipo !== 'todos' && no.tipo !== fTipo) return false;
      if (fStatus !== 'todos' && no.status !== fStatus) return false;
      if (q) {
        const hay = `${no.numero} ${no.tomador_nome || ''} ${eventoNome(no.evento_id)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notas, fTipo, fStatus, busca, eventoNome]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = filtradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Parcelas pagas ainda não faturadas (lote + a faturar).
  const pagasSemNota = useMemo(() => parcelas.filter((p) => p.status === 'pago' && !p.nota_id), [parcelas]);

  // Faturas em aberto ordenadas por vencimento.
  const faturasView = useMemo(
    () => [...faturas].sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999')),
    [faturas],
  );

  // ── Helper de API ──
  async function postJSON(path: string, body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string; [k: string]: unknown }> {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, ...j };
  }

  // ── Modais ──
  const [emitOpen, setEmitOpen] = useState(false);
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [provOpen, setProvOpen] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const provedorConfigurado = !!provedor?.configured;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Faturamento & Notas Fiscais</h1>
          <p className="mt-1 text-sm text-ink-muted">Emita NFS-e, NF-e e recibos, cobre com link de pagamento e concilie com o caixa. Recebíveis ficam em <Link href="/painel/recebiveis" className="font-semibold text-brand underline">Recebíveis</Link>.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setProvOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-medium text-ink-soft hover:border-brand/30 hover:text-brand"><IcoPlug /> Provedor</button>
          {notas.length > 0 && <button onClick={() => exportNotasCSV(filtradas, eventoNome)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Lote (CSV)</button>}
          <button onClick={() => setCobrarOpen(true)} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">+ Cobrança</button>
          <button onClick={() => setEmitOpen(true)} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Emitir</button>
        </div>
      </div>

      {needsSetup && <SetupCard sql="faturamento.sql">As tabelas de faturamento ainda não existem.</SetupCard>}

      {/* Banner provedor */}
      <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${provedorConfigurado ? 'border-emerald-200 bg-emerald-50/60' : 'border-blue-200 bg-blue-50/60'}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${provedorConfigurado ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}><IcoPlug /></span>
        <div className="min-w-0 flex-1">
          {provedorConfigurado ? (
            <p className="text-sm text-emerald-800"><strong>Emissão automática ativa</strong> via {PROVEDORES.find((p) => p.v === provedor?.provedor)?.label || provedor?.provedor} ({provedor?.ambiente === 'producao' ? 'produção' : 'homologação'}). NFS-e/NF-e saem direto pelo provedor.</p>
          ) : (
            <p className="text-sm text-blue-800"><strong>Modo manual / recibo.</strong> Sem provedor conectado, o sistema gera <strong>recibos numerados</strong> e registra NFS-e para emissão manual. Conecte um provedor para emitir NFS-e automaticamente.</p>
          )}
        </div>
        {!provedorConfigurado && <button onClick={() => setProvOpen(true)} className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Conectar provedor</button>}
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Faturado no mês" value={formatMoneyShort(kpis.faturadoMes, { currency: moeda })} sub={`${statusCount.emitida} emitida(s)`} tone="verde" icon={<IcoDoc />} />
        <Kpi label="A faturar" value={formatMoneyShort(kpis.aFaturar, { currency: moeda })} sub={`${kpis.aFaturarN} recebimento(s) sem nota`} tone="azul" icon={<IcoPending />} />
        <Kpi label="ISS a recolher (mês)" value={formatMoneyShort(kpis.issMes, { currency: moeda })} sub="ISS próprio das notas" tone="gold" icon={<IcoTax />} />
        <Kpi label="Inadimplência" value={formatMoneyShort(kpis.inadimplencia, { currency: moeda })} sub="cobranças vencidas" tone="vermelho" icon={<IcoAlert />} />
      </div>

      {/* Gráficos */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Faturamento emitido</h3>
          <BarsChart dados={serie} moeda={moeda} />
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Por documento</h3>
          {porTipo.length === 0 ? <div className="flex h-[180px] items-center justify-center"><p className="text-sm text-ink-muted">Sem notas emitidas ainda.</p></div> : <Donut data={porTipo} moeda={moeda} />}
        </div>
      </div>

      {/* Lote: parcelas pagas sem nota */}
      {pagasSemNota.length > 0 && (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-white p-5 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">Recebimentos a faturar</h3>
              <p className="text-xs text-ink-muted">{pagasSemNota.length} parcela(s) paga(s) sem documento fiscal · {formatMoney(kpis.aFaturar, { currency: moeda })}</p>
            </div>
            <button onClick={emitirLote} disabled={loteBusy} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {loteBusy ? 'Emitindo…' : `Emitir ${provedorConfigurado ? 'NFS-e' : 'recibos'} em lote`}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pagasSemNota.slice(0, 8).map((p) => {
              const ev = eventoById(p.evento_id);
              return <span key={p.id} className="rounded-lg border border-black/[0.06] bg-black/[0.015] px-2.5 py-1 text-xs text-ink-soft">{ev?.nome_evento || 'Evento'} · {formatMoneyShort(p.valor, { currency: moeda })}</span>;
            })}
            {pagasSemNota.length > 8 && <span className="px-2 py-1 text-xs text-ink-muted">+{pagasSemNota.length - 8}</span>}
          </div>
        </div>
      )}

      {/* Cobranças */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Cobranças</h3>
          <button onClick={() => setCobrarOpen(true)} className="text-xs font-semibold text-brand hover:underline">+ Nova cobrança</button>
        </div>
        {faturasView.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhuma cobrança ainda. Gere um link de pagamento (Pix/cartão/boleto) para receber mais rápido.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Descrição</th>
                  <th className="hidden pb-2 font-semibold sm:table-cell">Vencimento</th>
                  <th className="pb-2 font-semibold">Meio</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                  <th className="w-40 pb-2" />
                </tr>
              </thead>
              <tbody>
                {faturasView.map((f) => {
                  const ef = faturaEfetiva(f, hoje);
                  const ev = eventoById(f.evento_id);
                  return (
                    <tr key={f.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5">
                        <p className="font-medium text-ink-soft">{f.descricao || 'Cobrança'}</p>
                        {ev?.nome_evento && <p className="text-xs text-ink-muted">{ev.nome_evento}</p>}
                      </td>
                      <td className="hidden py-2.5 text-ink-muted sm:table-cell">{f.vencimento ? formatDate(f.vencimento, { style: 'short' }) : '—'}</td>
                      <td className="py-2.5 text-ink-muted">{f.meio ? MEIO_LABEL[f.meio] : '—'}</td>
                      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FATURA_META[ef].cls}`}>{FATURA_META[ef].label}</span></td>
                      <td className="py-2.5 text-right font-bold text-ink-soft">{formatMoney(f.valor_num, { currency: moeda })}</td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-1">
                          {ef !== 'paga' && ef !== 'cancelada' && (f.link_pagamento
                            ? <button onClick={() => copiar(f.link_pagamento!)} title="Copiar link" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-brand/30 hover:text-brand">Link</button>
                            : <button onClick={() => gerarLink(f)} title="Gerar link de pagamento" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-brand/30 hover:text-brand">Gerar link</button>)}
                          {ef === 'paga'
                            ? <button onClick={() => estornarFatura(f)} className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-amber-300 hover:text-amber-700">Estornar</button>
                            : ef !== 'cancelada' && <button onClick={() => baixarFatura(f)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-emerald-700">Marcar pago</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notas */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Documentos fiscais</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº/tomador…" className="w-40 rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-48" />
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value as FiltroTipo)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
              <option value="todos">Todos os tipos</option>
              <option value="nfse">NFS-e</option><option value="nfe">NF-e</option><option value="recibo">Recibo</option>
            </select>
            <div className="flex gap-1">
              {(['todos', 'emitida', 'cancelada', 'erro'] as FiltroStatus[]).map((s) => (
                <button key={s} onClick={() => setFStatus(s)} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${fStatus === s ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>
                  {s === 'todos' ? 'Todos' : STATUS_META[s as NotaStatus].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {filtradas.length === 0 ? (
          notas.length === 0
            ? <EmptyNotas onEmitir={() => setEmitOpen(true)} />
            : <p className="py-12 text-center text-sm text-ink-muted">Nenhum documento corresponde ao filtro.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Número</th>
                    <th className="pb-2 font-semibold">Tomador</th>
                    <th className="hidden pb-2 font-semibold md:table-cell">Emitida</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Total</th>
                    <th className="w-28 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((no) => (
                    <tr key={no.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-muted">{TIPO_LABEL[no.tipo]}</span>
                          <span className="font-semibold text-ink-soft">{no.numero}</span>
                        </span>
                      </td>
                      <td className="py-2.5">
                        <p className="font-medium text-ink-soft">{no.tomador_nome || '—'}</p>
                        {no.evento_id && <p className="text-xs text-ink-muted">{eventoNome(no.evento_id)}</p>}
                      </td>
                      <td className="hidden py-2.5 text-ink-muted md:table-cell">{no.emitida_em ? formatDate(no.emitida_em, { style: 'short' }) : '—'}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[no.status].cls}`} title={no.provedor_msg || ''}>{STATUS_META[no.status].label}</span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-ink-soft">{formatMoney(no.valor_total_num, { currency: moeda })}</td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {no.pdf_url
                            ? <a href={no.pdf_url} target="_blank" rel="noopener noreferrer" title="PDF do provedor" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoDownload /></a>
                            : <button onClick={() => baixarPDF(no)} title="Baixar PDF/recibo" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoDownload /></button>}
                          {no.status !== 'cancelada' && <button onClick={() => cancelarNota(no)} title="Cancelar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoBan /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                <span>{filtradas.length} documentos · página {page + 1} de {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {emitOpen && <EmitirModal {...{ eventos, parcelas, empresa, provedorConfigurado, moeda, onClose: () => setEmitOpen(false), onDone: afterEmit }} />}
      {cobrarOpen && <CobrarModal {...{ eventos, parcelas, moeda, postJSON, onClose: () => setCobrarOpen(false), onDone: afterMutate }} />}
      {provOpen && <ProvedorModal {...{ provedor, onClose: () => setProvOpen(false), onDone: async () => { setProvOpen(false); await carregarProvedor(); } }} />}
    </div>
  );

  // ── Ações (definidas no escopo do componente p/ acessar estado) ──
  async function afterEmit(nota: NotaFiscal) {
    if (userId) await carregar(userId);
    // Recibo / emissão manual → oferece o PDF imediatamente.
    if (nota.tipo === 'recibo' || nota.provedor === 'manual') await baixarPDF(nota);
    toast.success(nota.status === 'erro' ? 'Registrada com erro do provedor — confira os detalhes.' : `${TIPO_LABEL[nota.tipo]} ${nota.numero} emitida!`);
  }
  async function afterMutate() { if (userId) await carregar(userId); }

  async function baixarPDF(no: NotaFiscal) {
    try {
      const doc = await buildNotaPDF({ nota: no, empresa, moeda, eventoNome: eventoNome(no.evento_id) || null });
      doc.save(`${no.tipo}-${no.numero}.pdf`);
    } catch { toast.error('Não foi possível gerar o PDF.'); }
  }

  async function cancelarNota(no: NotaFiscal) {
    if (!window.confirm(`Cancelar ${TIPO_LABEL[no.tipo]} ${no.numero}?`)) return;
    const r = await postJSON('/api/faturamento/emitir', { action: 'cancelar', id: no.id });
    if (!r.ok) { toast.error(r.error || 'Erro ao cancelar.'); return; }
    toast.success('Documento cancelado.');
    await afterMutate();
  }

  async function gerarLink(f: Fatura) {
    const r = await postJSON('/api/faturamento/cobranca', { fatura_id: f.id, meio: f.meio || 'link' });
    if (!r.ok) { toast.error(r.error || 'Erro ao gerar o link.'); return; }
    const link = (r as { link?: string }).link;
    if (link) { await copiar(link); toast.success('Link de pagamento gerado e copiado!'); }
    else toast.info((r as { warning?: string }).warning || 'Cobrança salva, mas sem link (conecte o Mercado Pago).');
    await afterMutate();
  }
  async function baixarFatura(f: Fatura) {
    const r = await postJSON('/api/faturamento/baixar', { fatura_id: f.id });
    if (!r.ok) { toast.error(r.error || 'Erro ao baixar.'); return; }
    toast.success('Cobrança quitada e lançada no caixa!');
    await afterMutate();
  }
  async function estornarFatura(f: Fatura) {
    const r = await postJSON('/api/faturamento/baixar', { fatura_id: f.id, action: 'estornar' });
    if (!r.ok) { toast.error(r.error || 'Erro ao estornar.'); return; }
    toast.info('Cobrança estornada.');
    await afterMutate();
  }
  async function copiar(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('Link copiado!'); }
    catch { window.prompt('Copie o link:', text); }
  }

  async function emitirLote() {
    if (!provedorConfigurado && !window.confirm(`Emitir ${pagasSemNota.length} recibo(s) para os recebimentos sem nota?`)) return;
    setLoteBusy(true);
    const tipo: NotaTipo = provedorConfigurado ? 'nfse' : 'recibo';
    let ok = 0;
    for (const p of pagasSemNota) {
      const ev = eventoById(p.evento_id);
      const tom = tomadorDoEvento(ev);
      const r = await postJSON('/api/faturamento/emitir', {
        tipo, evento_id: p.evento_id, parcela_id: p.id, cliente_id: ev?.cliente_id || null,
        tomador_nome: tom.nome, tomador_doc: tom.doc, tomador_email: tom.email,
        valor_servicos: p.valor, aliquota_iss: empresa?.config_fiscal?.iss || 0,
        discriminacao: `Locação de espaço — ${ev?.nome_evento || ''} (${p.descricao || `parcela ${p.numero ?? ''}`.trim()})`,
      });
      if (r.ok) ok++;
    }
    setLoteBusy(false);
    toast.success(`${ok} documento(s) emitido(s) em lote.`);
    await afterMutate();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Modal de emissão
// ════════════════════════════════════════════════════════════════════════════
function EmitirModal({ eventos, parcelas, empresa, provedorConfigurado, moeda, onClose, onDone }: {
  eventos: Evento[]; parcelas: Parcela[]; empresa: EmpresaInfo | null; provedorConfigurado: boolean; moeda: Currency;
  onClose: () => void; onDone: (n: NotaFiscal) => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<NotaTipo>('recibo');
  const [eventoId, setEventoId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [nome, setNome] = useState('');
  const [docTom, setDocTom] = useState('');
  const [email, setEmail] = useState('');
  const [valor, setValor] = useState('');
  const [desconto, setDesconto] = useState('');
  const [iss, setIss] = useState(empresa?.config_fiscal?.iss || '');
  const [codigo, setCodigo] = useState(empresa?.config_fiscal?.codigo_servico || '');
  const [discrim, setDiscrim] = useState('');
  const [ret, setRet] = useState<Record<RetencaoChave, boolean>>({ iss_retido: false, irrf: false, pis: false, cofins: false, csll: false, inss: false });
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const sym = moedaSimbolo();
  const parcelasDoEvento = useMemo(() => parcelas.filter((p) => p.evento_id === eventoId && p.status !== 'cancelado'), [parcelas, eventoId]);

  function pickEvento(id: string) {
    setEventoId(id); setParcelaId('');
    const ev = eventos.find((e) => e.id === id);
    const t = tomadorDoEvento(ev);
    setNome(t.nome); setDocTom(t.doc); setEmail(t.email);
    if (ev?.valor_total_num && !valor) setValor(String(ev.valor_total_num));
  }
  function pickParcela(id: string) {
    setParcelaId(id);
    const p = parcelas.find((x) => String(x.id) === id);
    if (p) setValor(String(p.valor));
  }

  const retConfig: RetencaoConfig = ret;
  const calc = useMemo(() => calcularImpostos({ valorServicos: Number(valor) || 0, descontos: Number(desconto) || 0, aliquotaIss: Number(iss) || 0, retencoes: retConfig }), [valor, desconto, iss, retConfig]);

  async function emitir() {
    if (!(Number(valor) > 0)) { toast.error('Informe o valor dos serviços.'); return; }
    setSaving(true);
    const r = await fetch('/api/faturamento/emitir', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        tipo, evento_id: eventoId || null, parcela_id: parcelaId || null,
        cliente_id: eventos.find((e) => e.id === eventoId)?.cliente_id || null,
        tomador_nome: nome, tomador_doc: docTom, tomador_email: email,
        valor_servicos: Number(valor), descontos: Number(desconto) || 0,
        aliquota_iss: iss === '' ? null : Number(iss), retencoes: retConfig,
        codigo_servico: codigo, discriminacao: discrim,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { toast.error(j.error || 'Erro ao emitir.'); return; }
    onClose();
    onDone(coerceNota(j.data as NotaFiscal));
  }

  return (
    <Modal onClose={onClose} title="Emitir documento fiscal" wide>
      {/* Tipo */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(['recibo', 'nfse', 'nfe'] as NotaTipo[]).map((t) => (
          <button key={t} onClick={() => setTipo(t)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${tipo === t ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand/30'}`}>
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>
      {tipo !== 'recibo' && !provedorConfigurado && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Sem provedor conectado: a {TIPO_LABEL[tipo]} será <strong>registrada para emissão manual</strong> (transmita no portal). Conecte um provedor para emissão automática.</p>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={eventoId} onChange={(e) => pickEvento(e.target.value)} className={inp}>
              <option value="">—</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || 'Evento'} — {e.quem_contratou || ''}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Parcela <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={parcelaId} onChange={(e) => pickParcela(e.target.value)} className={inp} disabled={!eventoId}>
              <option value="">—</option>
              {parcelasDoEvento.map((p) => <option key={p.id} value={String(p.id)}>{p.descricao || `Parcela ${p.numero ?? ''}`} — {formatMoney(p.valor, { currency: moeda })}</option>)}
            </select>
          </label>
        </div>

        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tomador / cliente</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Nome / razão social" />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">CPF/CNPJ</span><input value={docTom} onChange={(e) => setDocTom(e.target.value)} className={inp} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></label>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Serviços ({sym})</span><input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inp} placeholder="0,00" autoFocus /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descontos ({sym})</span><input type="number" min={0} step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} className={inp} placeholder="0,00" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">ISS (%)</span><input type="number" min={0} max={100} step="0.01" value={iss} onChange={(e) => setIss(e.target.value)} className={inp} placeholder="ex.: 5" /></label>
        </div>

        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Discriminação</span>
          <textarea value={discrim} onChange={(e) => setDiscrim(e.target.value)} rows={2} className={inp} placeholder="Descrição dos serviços prestados…" />
        </label>

        {/* Retenções */}
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
          <button type="button" onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-ink-soft">
            <span>Retenções e código de serviço</span><span className="text-ink-muted">{advanced ? '−' : '+'}</span>
          </button>
          {advanced && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RETENCOES.map(({ k, hint }) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-2.5 py-2 text-xs" title={hint}>
                    <input type="checkbox" checked={ret[k]} onChange={(e) => setRet((r) => ({ ...r, [k]: e.target.checked }))} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
                    <span className="font-medium text-ink-soft">{RETENCAO_LABEL[k]}</span>
                  </label>
                ))}
              </div>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Código de serviço (LC 116)</span><input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inp} /></label>
            </div>
          )}
        </div>

        {/* Preview de valores */}
        <div className="rounded-xl bg-ink p-4 text-white">
          <div className="grid grid-cols-2 gap-y-1.5 text-sm sm:grid-cols-4">
            <Prev label="ISS" value={formatMoney(calc.iss, { currency: moeda })} />
            <Prev label="Retenções" value={formatMoney(calc.totalRetencoes, { currency: moeda })} />
            <Prev label="Total" value={formatMoney(calc.valorTotal, { currency: moeda })} strong />
            <Prev label="Líquido" value={formatMoney(calc.valorLiquido, { currency: moeda })} green />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={emitir} disabled={saving || !(Number(valor) > 0)} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Emitindo…' : `Emitir ${TIPO_LABEL[tipo]}`}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Modal de cobrança
// ════════════════════════════════════════════════════════════════════════════
function CobrarModal({ eventos, parcelas, moeda, postJSON, onClose, onDone }: {
  eventos: Evento[]; parcelas: Parcela[]; moeda: Currency;
  postJSON: (p: string, b: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; [k: string]: unknown }>;
  onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [eventoId, setEventoId] = useState('');
  const [parcelaId, setParcelaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [meio, setMeio] = useState<'pix' | 'boleto' | 'cartao' | 'link'>('link');
  const [saving, setSaving] = useState(false);
  const sym = moedaSimbolo();
  const parcelasDoEvento = useMemo(() => parcelas.filter((p) => p.evento_id === eventoId && p.status !== 'cancelado' && p.status !== 'pago'), [parcelas, eventoId]);

  function pickParcela(id: string) {
    setParcelaId(id);
    const p = parcelas.find((x) => String(x.id) === id);
    if (p) { setValor(String(p.valor)); if (p.vencimento) setVencimento(p.vencimento); if (!descricao) setDescricao(p.descricao || `Parcela ${p.numero ?? ''}`.trim()); }
  }

  async function criar() {
    if (!(Number(valor) > 0)) { toast.error('Informe o valor.'); return; }
    setSaving(true);
    const ev = eventos.find((e) => e.id === eventoId);
    const r = await postJSON('/api/faturamento/cobranca', {
      evento_id: eventoId || null, parcela_id: parcelaId || null, cliente_id: ev?.cliente_id || null,
      descricao: descricao || (ev?.nome_evento ? `Cobrança — ${ev.nome_evento}` : 'Cobrança'),
      valor: Number(valor), vencimento: vencimento || null, meio,
    });
    setSaving(false);
    if (!r.ok) { toast.error(r.error || 'Erro ao criar a cobrança.'); return; }
    const link = (r as { link?: string }).link;
    if (link) { try { await navigator.clipboard.writeText(link); } catch { /* */ } toast.success('Cobrança criada e link copiado!'); }
    else toast.info((r as { warning?: string }).warning || 'Cobrança criada. Conecte o Mercado Pago para gerar o link.');
    onClose();
    onDone();
  }

  return (
    <Modal onClose={onClose} title="Nova cobrança">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setParcelaId(''); }} className={inp}>
              <option value="">—</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || 'Evento'} — {e.quem_contratou || ''}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Parcela <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={parcelaId} onChange={(e) => pickParcela(e.target.value)} className={inp} disabled={!eventoId}>
              <option value="">—</option>
              {parcelasDoEvento.map((p) => <option key={p.id} value={String(p.id)}>{p.descricao || `Parcela ${p.numero ?? ''}`} — {formatMoney(p.valor, { currency: moeda })}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descrição</span><input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inp} placeholder="Ex: Entrada do casamento Silva" /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor ({sym})</span><input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inp} placeholder="0,00" autoFocus /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Vencimento</span><input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inp} /></label>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Meio de pagamento</span>
          <select value={meio} onChange={(e) => setMeio(e.target.value as typeof meio)} className={inp}>
            {MEIOS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
        </label>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Gera um link de pagamento (Mercado Pago). Ao pagar, a parcela é baixada e a receita lançada no caixa automaticamente.</p>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={criar} disabled={saving || !(Number(valor) > 0)} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Criando…' : 'Criar cobrança'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Modal do provedor fiscal
// ════════════════════════════════════════════════════════════════════════════
function ProvedorModal({ provedor, onClose, onDone }: { provedor: ProvedorStatus | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [prov, setProv] = useState(provedor?.provedor || 'manual');
  const [ambiente, setAmbiente] = useState(provedor?.ambiente || 'homologacao');
  const [endpoint, setEndpoint] = useState(provedor?.endpoint || '');
  const [token, setToken] = useState('');
  const [cnpj, setCnpj] = useState(provedor?.cnpj || '');
  const [saving, setSaving] = useState(false);
  const generico = PROVEDORES.find((p) => p.v === prov)?.generico;

  async function salvar() {
    setSaving(true);
    const r = await fetch('/api/faturamento/provedor', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ provedor: prov, ambiente, endpoint, token, cnpj, ativo: true }),
    });
    setSaving(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast.error(j.error || 'Erro ao salvar.'); return; }
    toast.success('Provedor salvo.');
    onDone();
  }
  async function remover() {
    if (!window.confirm('Remover a configuração do provedor?')) return;
    await fetch('/api/faturamento/provedor', { method: 'DELETE', headers: { ...(await authHeaders()) } });
    toast.info('Provedor removido.');
    onDone();
  }

  return (
    <Modal onClose={onClose} title="Provedor de emissão fiscal">
      <p className="mb-4 text-sm text-ink-muted">Conecte um provedor de NFS-e/NF-e para emissão automática. Sem provedor, a Ventsy gera recibos numerados e registra notas para emissão manual. As credenciais ficam protegidas no servidor (nunca no navegador).</p>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Provedor</span>
            <select value={prov} onChange={(e) => setProv(e.target.value)} className={inp}>
              {PROVEDORES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Ambiente</span>
            <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className={inp}>
              <option value="homologacao">Homologação (teste)</option><option value="producao">Produção</option>
            </select>
          </label>
        </div>
        {generico && (
          <>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Endpoint da API</span><input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className={inp} placeholder="https://api.provedor.com/v1/nfse" /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Token / API key {provedor?.has_token && <span className="font-normal text-ink-muted">(••••{provedor.last4} salvo — deixe em branco p/ manter)</span>}</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inp} placeholder="••••••••" /></label>
          </>
        )}
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">CNPJ do emitente</span><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={inp} placeholder="00.000.000/0000-00" /></label>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Confirme regime, CNAE, código de serviço e alíquota de ISS na aba Fiscal de <Link href="/painel/configuracoes" className="font-semibold underline">Configurações</Link>.</p>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar provedor'}</button>
        {provedor?.has_token && <button onClick={remover} className="rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-ink-muted hover:border-red-300 hover:text-red-600">Remover</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Fechar</button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-componentes
// ════════════════════════════════════════════════════════════════════════════
function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className={`relative my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-pop`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: 'verde' | 'vermelho' | 'gold' | 'azul'; icon: ReactNode }) {
  const color = { verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600' }[tone];
  const iconBg = { verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2"><span className="text-xs text-ink-muted">{label}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span></div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[0.68rem] font-medium text-ink-muted">{sub}</div>}
    </div>
  );
}

function Prev({ label, value, strong, green }: { label: string; value: string; strong?: boolean; green?: boolean }) {
  return <div><div className="text-[0.62rem] uppercase tracking-wide text-white/50">{label}</div><div className={`mt-0.5 font-bold ${green ? 'text-emerald-300' : 'text-white'} ${strong ? 'text-base' : 'text-sm'}`}>{value}</div></div>;
}

function BarsChart({ dados, moeda }: { dados: { label: string; valor: number }[]; moeda: Currency }) {
  const W = 520, H = 200, PAD = { t: 20, r: 12, b: 34, l: 56 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const slotW = innerW / dados.length, barW = slotW * 0.5;
  if (dados.every((d) => d.valor === 0)) return <div className="flex h-[180px] items-center justify-center"><p className="text-sm text-ink-muted">Sem notas emitidas nos últimos meses.</p></div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-label="Faturamento emitido por mês">
      {[0, 0.5, 1].map((f, i) => { const v = max * f, y = PAD.t + innerH * (1 - f); return <g key={i}><line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f3f4f6" strokeWidth="1" /><text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{v === 0 ? '0' : formatMoneyShort(v, { currency: moeda })}</text></g>; })}
      {dados.map((d, i) => { const x = PAD.l + i * slotW + (slotW - barW) / 2, h = (d.valor / max) * innerH, y = PAD.t + innerH - h; return <g key={i}>{d.valor > 0 && <rect x={x} y={y} width={barW} height={h} rx="3" fill="#ff385c" opacity="0.85" />}<text x={PAD.l + i * slotW + slotW / 2} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#9ca3af">{d.label}</text></g>; })}
    </svg>
  );
}

function Donut({ data, moeda }: { data: [string, number][]; moeda: Currency }) {
  const total = data.reduce((s, [, v]) => s + v, 0) || 1, r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {data.map(([cat, val], i) => { const len = (val / total) * C; const el = <circle key={cat} cx="64" cy="64" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data.map(([cat, val], i) => <div key={cat} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="min-w-0 flex-1 truncate text-ink-soft">{cat}</span><span className="shrink-0 font-semibold text-ink-muted">{formatMoneyShort(val, { currency: moeda })}</span></div>)}
      </div>
    </div>
  );
}

function EmptyNotas({ onEmitir }: { onEmitir: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoDoc /></div>
      <p className="mb-1 text-sm font-semibold text-ink">Nenhum documento fiscal ainda</p>
      <p className="mb-5 text-xs text-ink-muted">Emita uma NFS-e, NF-e ou um recibo numerado a partir de um evento, contrato ou recebimento.</p>
      <button onClick={onEmitir} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ Emitir documento</button>
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 2) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoDoc = () => svg(<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6" />, 16);
const IcoPending = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const IcoTax = () => svg(<path d="M9 7h6M9 12h6M9 17h3M5 3h14a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Z" />, 16);
const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 14);
const IcoBan = () => svg(<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>, 14);
const IcoPlug = () => svg(<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0Zm5 9v5" />, 15);
