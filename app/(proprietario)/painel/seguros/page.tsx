'use client';

// Seguros & Apólices — /painel/seguros (grupo Conformidade).
// Gere as apólices que protegem a operação: patrimoniais do espaço, RC geral,
// por evento (RC/acidentes), frota e equipamentos. Quatro abas:
//   • Carteira  — KPIs, alertas de renovação, distribuição por escopo, apólices.
//   • Por evento — exigências por tipo de evento (semáforo), apólices vinculadas
//                  e o custo de seguro que recai sobre o evento (prêmio+rateio).
//   • Sinistros — abertura/acompanhamento de ocorrências, anexos, sinistralidade.
//   • Custos    — prêmio por escopo, custo por evento, sinistralidade por escopo.
// Fontes: tabelas `seguros` + `sinistros` (RLS dono; docs/sql/seguros.sql). A
// matemática (vigência, prêmio, sinistralidade, rateio, exigências) vive em
// lib/seguros (motor puro, testado). O CRUD é feito pelo client via RLS; a baixa
// do prêmio lança despesa em `lancamentos`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import {
  type Seguro, type Sinistro, type PropriedadeLite, type EventoLite,
  SEL_SEGURO, SEL_SINISTRO, SEL_PROP, SEL_EVENTO,
  mapSeguro, mapSinistro, mapProp, mapEvento, isMissingTable, hojeYmd,
} from './_lib';
import type { SegurosBag } from './_components/shared';
import Carteira from './_components/Carteira';
import SeguroEvento from './_components/SeguroEvento';
import Sinistros from './_components/Sinistros';
import Custos from './_components/Custos';
import { IcoShield, IcoCalendar, IcoBolt, IcoMoney } from './_components/ui';

type Tab = 'carteira' | 'evento' | 'sinistros' | 'custos';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'carteira', label: 'Carteira', icon: IcoShield },
  { v: 'evento', label: 'Por evento', icon: IcoCalendar },
  { v: 'sinistros', label: 'Sinistros', icon: IcoBolt },
  { v: 'custos', label: 'Custos', icon: IcoMoney },
];
const SUBTITULO: Record<Tab, string> = {
  carteira: 'Apólices patrimoniais, de RC, por evento, frota e equipamentos — com coberturas, vigência, prêmio e alertas de renovação.',
  evento: 'Vincule seguros a um evento, confira as exigências por tipo de evento e veja o custo de seguro que recai sobre ele.',
  sinistros: 'Abra e acompanhe ocorrências por apólice — valores, anexos, lições e o índice de sinistralidade.',
  custos: 'Para onde vai o prêmio: por escopo, por evento e a sinistralidade — com exportação.',
};

export default function SegurosPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [seguros, setSeguros] = useState<Seguro[]>([]);
  const [sinistros, setSinistros] = useState<Sinistro[]>([]);
  const [props, setProps] = useState<PropriedadeLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [tab, setTab] = useState<Tab>('carteira');

  const carregarDados = useCallback(async (uid: string) => {
    const [segRes, sinRes] = await Promise.all([
      sb.from('seguros').select(SEL_SEGURO).eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('sinistros').select(SEL_SINISTRO).eq('usuario_id', uid).order('data', { ascending: false }),
    ]);
    if (segRes.error && isMissingTable(segRes.error)) { setNeedsSetup(true); return false; }
    setSeguros(((segRes.data as unknown[]) || []).map(mapSeguro));
    setSinistros(((sinRes.data as unknown[]) || []).map(mapSinistro));
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      const uid = session.user.id;
      setUserId(uid);

      // Vínculos (não bloqueiam o setup — degrade para vazio).
      const [propRes, evRes, perfilRes] = await Promise.all([
        sb.from('propriedades').select(SEL_PROP).eq('usuario_id', uid),
        sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }).limit(500),
        sb.from('usuarios').select('nome').eq('id', uid).maybeSingle(),
      ]);
      setProps(((propRes.data as unknown[]) || []).map(mapProp));
      setEventos(((evRes.data as unknown[]) || []).map(mapEvento));
      setEmpresa((perfilRes.data as { nome?: string } | null)?.nome || '');

      await carregarDados(uid);

      // Aba inicial via ?tab=
      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);

      setLoading(false);
    })();
  }, [carregarDados]);

  const recarregar = useCallback(async () => {
    if (userId) await carregarDados(userId);
  }, [userId, carregarDados]);

  const bag: SegurosBag = useMemo(() => ({
    userId, hoje: hojeYmd(), empresa, seguros, sinistros, props, eventos,
    propsMap: new Map(props.map((p) => [p.id, p.nome])),
    eventosMap: new Map(eventos.map((e) => [e.id, e])),
    recarregar,
  }), [userId, empresa, seguros, sinistros, props, eventos, recarregar]);

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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoShield /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo Seguros</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
            Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/seguros.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">seguros</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sinistros</code> e liberar a carteira de apólices, seguro por evento, sinistros e custos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Header tab={tab} setTab={setTab} />
      <div className="mt-5">
        {tab === 'carteira' && <Carteira bag={bag} />}
        {tab === 'evento' && <SeguroEvento bag={bag} />}
        {tab === 'sinistros' && <Sinistros bag={bag} />}
        {tab === 'custos' && <Custos bag={bag} />}
      </div>
    </div>
  );
}

function Header({ tab, setTab, hideTabs }: { tab: Tab; setTab: (t: Tab) => void; hideTabs?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Seguros & Apólices</h1>
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
