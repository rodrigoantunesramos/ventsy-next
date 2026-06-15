'use client';

// Terceiros (custo × retorno) — /painel/terceiros (grupo Inteligência).
// Enxerga cada serviço TERCEIRIZADO como um investimento: quanto custa × quanto
// devolve (receita atribuída, eventos atendidos, economia, SLA, satisfação) →
// ROI / índice de valor → decisão (manter · renegociar · trocar · internalizar).
// Complementa o cadastro OPERACIONAL de /painel/fornecedores (um terceiro pode
// apontar para um fornecedor) — aqui a visão é GERENCIAL. Quatro abas:
//   • Carteira   — KPIs, custo total terceirizado, % sobre a receita, lista por
//                  categoria com custo/vigência/SLA/status e o CRUD do terceiro.
//   • Custo×Retorno — ficha de um terceiro: custo × retorno no período, ROI,
//                  evolução, SLA/satisfação, medições e comparação "internalizar".
//   • Contratos  — vigência/renovação/rescisão, SLA & cumprimento, multas/glosas.
//   • Decisão    — ranking mantém/renegocia/troca/internaliza + alertas.
// Fontes: `terceiros` + `terceiros_resultados` (RLS dono; docs/sql/terceiros.sql).
// O custo realizado é puxado de `lancamentos` (Contas a pagar) pelo fornecedor;
// a receita de referência (% sobre receita) vem das receitas do caixa. A
// matemática vive em lib/terceiros (motor puro, testado). Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type Terceiro, type ResultadoTerceiro, type FornecedorLite,
  type EventoLite, type DespesaLite, type TerceiroAgg,
  SEL_TERCEIRO, SEL_RESULTADO, SEL_FORNECEDOR, SEL_DESPESA, SEL_EVENTO,
  mapTerceiro, mapResultado, mapFornecedor, mapDespesa, mapEvento,
  isMissingTable, hojeYmd, receitaMensalRef, eventosMensalRef, gastoPorFornecedor,
  agregarTerceiro, resumoCarteira,
} from './_lib';
import type { TerceirosBag } from './_components/shared';
import Carteira from './_components/Carteira';
import Ficha from './_components/Ficha';
import Contratos from './_components/Contratos';
import Decisao from './_components/Decisao';
import { IcoExchange, IcoScale, IcoSignature, IcoGauge } from './_components/ui';

type Tab = 'carteira' | 'ficha' | 'contratos' | 'decisao';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'carteira', label: 'Carteira', icon: IcoExchange },
  { v: 'ficha', label: 'Custo × Retorno', icon: IcoScale },
  { v: 'contratos', label: 'Contratos & SLA', icon: IcoSignature },
  { v: 'decisao', label: 'Decisão', icon: IcoGauge },
];
const SUBTITULO: Record<Tab, string> = {
  carteira: 'Cada terceirizado como um investimento: custo mensal/anual, % sobre a receita, vigência, SLA e status — por categoria.',
  ficha: 'Custo × retorno de um terceiro no período: ROI, evolução, eventos atendidos, economia, SLA e a alternativa de internalizar.',
  contratos: 'Vigência, renovação e rescisão, metas de SLA e cumprimento, multas e glosas — com o documento do contrato.',
  decisao: 'Ranking do que manter, renegociar, trocar ou internalizar — com alertas de contrato vencendo, custo subindo e SLA caindo.',
};

// Janela de referência para custo realizado / receita / volume (12 meses).
function cutoff12mYmd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TerceirosPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [terceiros, setTerceiros] = useState<Terceiro[]>([]);
  const [resultados, setResultados] = useState<ResultadoTerceiro[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [despesas, setDespesas] = useState<DespesaLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [receitas, setReceitas] = useState<{ valor: number; data: string }[]>([]);
  const [tab, setTab] = useState<Tab>('carteira');
  const [fichaId, setFichaId] = useState<string | null>(null); // terceiro selecionado na ficha

  const hoje = useMemo(() => hojeYmd(), []);

  const carregarTerceiros = useCallback(async (uid: string) => {
    const [tRes, rRes] = await Promise.all([
      sb.from('terceiros').select(SEL_TERCEIRO).eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('terceiros_resultados').select(SEL_RESULTADO).eq('usuario_id', uid).order('competencia', { ascending: true }),
    ]);
    if (tRes.error && isMissingTable(tRes.error)) { setNeedsSetup(true); return false; }
    setTerceiros(((tRes.data as unknown[]) || []).map(mapTerceiro));
    setResultados(((rRes.data as unknown[]) || []).map(mapResultado));
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      const uid = session.user.id;
      setUserId(uid);
      const desde = cutoff12mYmd();

      // Vínculos e referências (não bloqueiam o setup — degrade para vazio).
      const [forRes, despRes, recRes, evRes, perfilRes] = await Promise.all([
        sb.from('fornecedores').select(SEL_FORNECEDOR).eq('usuario_id', uid).order('nome'),
        sb.from('lancamentos').select(SEL_DESPESA).eq('usuario_id', uid).eq('tipo', 'despesa').not('fornecedor_id', 'is', null).gte('data', desde),
        sb.from('lancamentos').select('valor,data').eq('usuario_id', uid).eq('tipo', 'receita').gte('data', desde),
        sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).gte('data_inicio', desde),
        sb.from('usuarios').select('nome').eq('id', uid).maybeSingle(),
      ]);
      setFornecedores(((forRes.data as unknown[]) || []).map(mapFornecedor));
      setDespesas(((despRes.data as unknown[]) || []).map(mapDespesa));
      setReceitas(((recRes.data as { valor: number; data: string }[]) || []).map((r) => ({ valor: Number(r.valor) || 0, data: r.data })));
      setEventos(((evRes.data as unknown[]) || []).map(mapEvento));
      setEmpresa((perfilRes.data as { nome?: string } | null)?.nome || '');

      await carregarTerceiros(uid);

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      const id = url.get('id');
      if (id) { setFichaId(id); if (!t) setTab('ficha'); }

      setLoading(false);
    })();
  }, [carregarTerceiros]);

  const recarregar = useCallback(async () => { if (userId) await carregarTerceiros(userId); }, [userId, carregarTerceiros]);

  // ── Agregações (motor puro): custo × retorno, ROI, SLA, decisão, alertas ──
  const resultadosByTerceiro = useMemo(() => {
    const m = new Map<string, ResultadoTerceiro[]>();
    for (const r of resultados) { const a = m.get(r.terceiro_id) || []; a.push(r); m.set(r.terceiro_id, a); }
    return m;
  }, [resultados]);

  const gastoForn = useMemo(() => gastoPorFornecedor(despesas), [despesas]);
  const receitaRef = useMemo(() => receitaMensalRef(receitas, 12), [receitas]);
  const eventosRef = useMemo(() => eventosMensalRef(eventos, 12), [eventos]);

  const aggs = useMemo<TerceiroAgg[]>(() => terceiros.map((t) => {
    const apMensal = t.fornecedor_id ? gastoForn.get(t.fornecedor_id)?.mensal ?? null : null;
    return agregarTerceiro(t, resultadosByTerceiro.get(t.id) || [], {
      hojeYmd: hoje,
      uso: { eventosMes: eventosRef, receitaMes: receitaRef, horasMes: null },
      custoRealizadoMensal: apMensal,
    });
  }), [terceiros, resultadosByTerceiro, gastoForn, receitaRef, eventosRef, hoje]);

  const resumo = useMemo(() => resumoCarteira(aggs, receitaRef), [aggs, receitaRef]);

  const bag: TerceirosBag = useMemo(() => ({
    userId, hoje, empresa,
    terceiros, resultadosByTerceiro, fornecedores,
    fornecedoresMap: new Map(fornecedores.map((f) => [f.id, f])),
    gastoForn, receitaMensalRef: receitaRef, eventosMensalRef: eventosRef,
    aggs, aggById: new Map(aggs.map((a) => [a.terceiro.id, a])), resumo,
    recarregar, recarregarResultados: recarregar,
  }), [userId, hoje, empresa, terceiros, resultadosByTerceiro, fornecedores, gastoForn, receitaRef, eventosRef, aggs, resumo, recarregar]);

  const irParaFicha = useCallback((id: string) => { setFichaId(id); setTab('ficha'); }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-5xl">
        <Header tab={tab} setTab={setTab} hideTabs />
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoExchange /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo Terceiros</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
            Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/terceiros.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">terceiros</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">terceiros_resultados</code> e liberar a carteira, a análise custo×retorno, contratos & SLA e o ranking de decisão.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Header tab={tab} setTab={setTab} />
      <div className="mt-5">
        {tab === 'carteira' && <Carteira bag={bag} onAbrirFicha={irParaFicha} />}
        {tab === 'ficha' && <Ficha bag={bag} fichaId={fichaId} setFichaId={setFichaId} />}
        {tab === 'contratos' && <Contratos bag={bag} onAbrirFicha={irParaFicha} />}
        {tab === 'decisao' && <Decisao bag={bag} onAbrirFicha={irParaFicha} />}
      </div>
    </div>
  );
}

function Header({ tab, setTab, hideTabs }: { tab: Tab; setTab: (t: Tab) => void; hideTabs?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Terceiros · custo × retorno</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>
      {!hideTabs && (
        <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
          {TABS.map(({ v, label, icon: Ico }) => (
            <button key={v} onClick={() => setTab(v)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
              <Ico /> {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
