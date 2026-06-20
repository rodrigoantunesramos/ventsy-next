'use client';

// Metas & OKR — /painel/metas (grupo Conta).
// Define metas por ÁREA e PERÍODO e acompanha o REALIZADO automaticamente a
// partir dos módulos (Financeiro/CRM/Pesquisas/Avaliações), com projeção de
// fechamento (run-rate) e semáforo; OKRs por trimestre. Três abas:
//   • Quadro    — alvo × realizado por área, %, projeção, semáforo, alertas.
//   • OKRs      — objetivos do trimestre com KRs e progresso (auto onde há fonte).
//   • Histórico — atingimento ao longo do tempo por métrica e por responsável.
// REUSO: receita/lucro/adimplência vêm de `metas_financeiras` (sincronizado com
// /painel/financeiro); o resto vive em `metas`/`okrs` (docs/sql/metas.sql, RLS
// do dono). A matemática vive em lib/metas (motor puro, testado); sem rota de
// API (CRUD via RLS). i18n via lib/format — nada de "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type MetaRow, type OkrRow, type MetaFinanceira, type PropriedadeLite,
  type Granularidade, type Realizado,
  GRANS, periodoDeOffset, isMissingTable,
  SEL_META, SEL_OKR, mapMeta, mapOkr, mapProp, hojeYmd, computarRealizado,
} from './_lib';
import type { MetasBag } from './_components/shared';
import Quadro from './_components/Quadro';
import Okrs from './_components/Okrs';
import Historico from './_components/Historico';
import { IcoGoal, IcoRocket, IcoChart, IcoChevL, IcoChevR, IcoBuilding } from './_components/ui';
import { formatMonth } from '@/lib/format';

type Tab = 'quadro' | 'okrs' | 'historico';
const TABS: { v: Tab; label: string; icon: (p: { className?: string }) => JSX.Element }[] = [
  { v: 'quadro', label: 'Quadro de metas', icon: IcoGoal },
  { v: 'okrs', label: 'OKRs', icon: IcoRocket },
  { v: 'historico', label: 'Histórico', icon: IcoChart },
];
const SUBTITULO: Record<Tab, string> = {
  quadro: 'Metas por área e período — alvo × realizado automático, projeção de fechamento e semáforo.',
  okrs: 'Objetivos do trimestre com resultados-chave; progresso puxado das fontes onde a métrica existe.',
  historico: 'Atingimento ao longo do tempo, por métrica e por responsável.',
};

function rotuloPeriodo(gran: Granularidade, key: string): string {
  if (gran === 'ano') return key;
  if (gran === 'trimestre') { const m = /Q([1-4])$/.exec(key); return `T${m?.[1] ?? ''} ${key.slice(0, 4)}`; }
  return formatMonth(key);
}

export default function MetasPage() {
  const [hoje] = useState(() => hojeYmd());
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState('');
  const [props, setProps] = useState<PropriedadeLite[]>([]);
  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [metasFin, setMetasFin] = useState<MetaFinanceira[]>([]);
  const [okrs, setOkrs] = useState<OkrRow[]>([]);
  const [tab, setTab] = useState<Tab>('quadro');

  const [gran, setGran] = useState<Granularidade>('mes');
  const [offset, setOffset] = useState(0);
  const [propriedadeId, setPropriedadeId] = useState<number | null>(null);
  const [realizado, setRealizado] = useState<Realizado>({});
  const [realizadoLoading, setRealizadoLoading] = useState(true);

  const periodo = useMemo(() => periodoDeOffset(gran, offset, hoje), [gran, offset, hoje]);

  // Carrega metas/okrs/metas_financeiras (não o realizado).
  const carregar = useCallback(async (uid: string): Promise<boolean> => {
    const [metasRes, okrsRes, finRes] = await Promise.all([
      sb.from('metas').select(SEL_META).eq('usuario_id', uid).order('periodo', { ascending: false }),
      sb.from('okrs').select(SEL_OKR).eq('usuario_id', uid).order('trimestre', { ascending: false }),
      sb.from('metas_financeiras').select('metrica,periodo,alvo').eq('usuario_id', uid),
    ]);
    if (metasRes.error && isMissingTable(metasRes.error)) { setNeedsSetup(true); return false; }
    setNeedsSetup(false);
    setMetas(((metasRes.data as unknown[]) || []).map(mapMeta));
    setOkrs(((okrsRes.data as unknown[]) || []).map(mapOkr));
    setMetasFin(((finRes.data as unknown[]) || []).map((r) => {
      const x = r as { metrica: string; periodo: string; alvo: number };
      return { metrica: x.metrica, periodo: x.periodo, alvo: Number(x.alvo) || 0 };
    }));
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      const uid = session.user.id;
      setUserId(uid);
      const propRes = await sb.from('propriedades').select('id,nome').eq('usuario_id', uid);
      setProps(((propRes.data as unknown[]) || []).map(mapProp));
      await carregar(uid);
      setLoading(false);
    })();
  }, [carregar]);

  // Recalcula o realizado quando o período/escopo (ou as fontes) mudam.
  useEffect(() => {
    if (!userId || needsSetup) return;
    let vivo = true;
    setRealizadoLoading(true);
    const propIds = props.map((p) => p.id);
    computarRealizado(userId, periodo, propriedadeId, props.length, propIds)
      .then((r) => { if (vivo) { setRealizado(r); setRealizadoLoading(false); } })
      .catch(() => { if (vivo) { setRealizado({}); setRealizadoLoading(false); } });
    return () => { vivo = false; };
  }, [userId, needsSetup, periodo, propriedadeId, props]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);
  const definirPeriodo = useCallback((g: Granularidade, o: number) => { setGran(g); setOffset(o); }, []);
  const definirPropriedade = useCallback((id: number | null) => setPropriedadeId(id), []);

  const bag: MetasBag = useMemo(() => ({
    userId, hoje, periodo, gran, offset, propriedadeId, props,
    propsMap: new Map(props.map((p) => [p.id, p.nome])),
    metas, metasFin, okrs, realizado, realizadoLoading,
    recarregar, definirPeriodo, definirPropriedade,
  }), [userId, hoje, periodo, gran, offset, propriedadeId, props, metas, metasFin, okrs, realizado, realizadoLoading, recarregar, definirPeriodo, definirPropriedade]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Metas & OKR</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO.quadro}</p>
        </div>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoGoal /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo Metas</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
            Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/metas.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">metas</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">okrs</code> e liberar o quadro de metas, OKRs e o histórico. As metas financeiras (receita/lucro/adimplência) reaproveitam a tabela já existente.
          </p>
        </div>
      </div>
    );
  }

  const showPeriodo = tab !== 'okrs';

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Metas & OKR</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.length > 1 && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-2.5 py-2 text-sm">
              <span className="text-ink-muted"><IcoBuilding /></span>
              <select value={propriedadeId ?? ''} onChange={(e) => definirPropriedade(e.target.value ? Number(e.target.value) : null)} className="bg-transparent text-sm focus:outline-none">
                <option value="">Todos os espaços</option>
                {props.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
        {TABS.map(({ v, label, icon: Ico }) => (
          <button key={v} onClick={() => setTab(v)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
            <Ico /> {label}
          </button>
        ))}
      </div>

      {/* Seletor de período (Quadro/Histórico) */}
      {showPeriodo && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full bg-black/[0.04] p-0.5">
            {GRANS.map((g) => (
              <button key={g.v} onClick={() => definirPeriodo(g.v, 0)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${gran === g.v ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink-soft'}`}>{g.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setOffset((o) => o - 1)} aria-label="Período anterior" className="rounded-lg border border-black/10 p-2 hover:bg-black/[0.03]"><IcoChevL /></button>
            <span className="min-w-[110px] text-center text-sm font-bold capitalize text-ink">{rotuloPeriodo(gran, periodo.key)}</span>
            <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} aria-label="Próximo período" className="rounded-lg border border-black/10 p-2 hover:bg-black/[0.03] disabled:opacity-40"><IcoChevR /></button>
            {offset !== 0 && <button onClick={() => setOffset(0)} className="ml-1 text-xs font-semibold text-brand hover:underline">hoje</button>}
          </div>
        </div>
      )}

      <div className="mt-5">
        {tab === 'quadro' && <Quadro bag={bag} />}
        {tab === 'okrs' && <Okrs bag={bag} />}
        {tab === 'historico' && <Historico bag={bag} />}
      </div>
    </div>
  );
}
