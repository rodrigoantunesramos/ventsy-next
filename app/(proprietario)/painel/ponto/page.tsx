'use client';

// Ponto & Escala — /painel/ponto.
// Escalar equipe FIXA (tabela `equipe`) + FREELANCERS para cada evento,
// registrar ponto (entrada/saída), apurar horas/extras/adicional noturno/banco
// de horas e o CUSTO DE MÃO DE OBRA por evento (alimenta o custo direto do
// evento → Contabilidade e margem). Cinco abas: Painel · Escala · Freelancers ·
// Ponto · Apuração.
//
// Fontes: `escalas`, `escalas_alocacao`, `freelancers`, `ponto_registros`
// (docs/sql/ponto.sql), além de `clientes_eventos` (eventos) e `equipe` (fixos).
// A cobertura/custo/horas vêm do motor puro lib/ponto.ts; a ALOCAÇÃO (sensível a
// super-alocação) passa pela rota AUTORITATIVA /api/ponto. A página degrada para
// um setup-card até o SQL ser aplicado. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import {
  type PontoBag, type Escala, type EscalaAlocacao, type Freelancer, type PontoRegistro, type EventoLite, type EquipeLite,
  SEL_FREELANCER, SEL_ESCALA, SEL_ALOC, SEL_PONTO, SEL_EVENTO, SEL_EQUIPE,
  mapFreelancer, mapEscala, mapAloc, mapPonto, mapEquipe, isMissingTable,
} from './_lib';
import { IcoGrid, IcoCalendar, IcoUser, IcoClock, IcoList } from './_components/ui';
import Painel from './_components/Painel';
import EscalaTab from './_components/Escala';
import Freelancers from './_components/Freelancers';
import Ponto from './_components/Ponto';
import Apuracao from './_components/Apuracao';

type Tab = 'painel' | 'escala' | 'freelancers' | 'ponto' | 'apuracao';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'painel', label: 'Painel', icon: IcoGrid },
  { v: 'escala', label: 'Escala', icon: IcoCalendar },
  { v: 'freelancers', label: 'Freelancers', icon: IcoUser },
  { v: 'ponto', label: 'Ponto', icon: IcoClock },
  { v: 'apuracao', label: 'Apuração', icon: IcoList },
];
const SUBTITULO: Record<Tab, string> = {
  painel: 'Cobertura das escalas, custo de pessoal, no-show e ranking.',
  escala: 'Planeje funções × turnos por evento e convoque equipe e freelancers.',
  freelancers: 'Banco reutilizável de diaristas por função, diária e avaliação.',
  ponto: 'Registro de entrada/saída com horas, extras, adicional noturno e atraso.',
  apuracao: 'Banco de horas, custo de mão de obra por evento e fechamento de diárias.',
};

export default function PontoPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('painel');

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [alocacoes, setAlocacoes] = useState<EscalaAlocacao[]>([]);
  const [registros, setRegistros] = useState<PontoRegistro[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [equipe, setEquipe] = useState<EquipeLite[]>([]);

  const carregar = useCallback(async (uid: string) => {
    // A tabela `escalas` é a âncora do módulo: se faltar, mostra o setup-card.
    const sRes = await sb.from('escalas').select(SEL_ESCALA).eq('usuario_id', uid).order('data', { ascending: false });
    if (sRes.error) {
      if (isMissingTable(sRes.error)) { setNeedsSetup(true); setEscalas([]); setAlocacoes([]); setFreelancers([]); setRegistros([]); return; }
    } else {
      setNeedsSetup(false);
      setEscalas((sRes.data || []).map(mapEscala));
    }

    const [fRes, aRes, pRes, evRes, eqRes] = await Promise.all([
      sb.from('freelancers').select(SEL_FREELANCER).eq('usuario_id', uid).order('nome'),
      sb.from('escalas_alocacao').select(SEL_ALOC).eq('usuario_id', uid),
      sb.from('ponto_registros').select(SEL_PONTO).eq('usuario_id', uid).order('data', { ascending: false }),
      sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
      sb.from('equipe').select(SEL_EQUIPE).eq('usuario_id', uid).order('nome'),
    ]);
    setFreelancers(fRes.error ? [] : (fRes.data || []).map(mapFreelancer));
    setAlocacoes(aRes.error ? [] : (aRes.data || []).map(mapAloc));
    setRegistros(pRes.error ? [] : (pRes.data || []).map(mapPonto));
    setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
    setEquipe(eqRes.error ? [] : (eqRes.data || []).map(mapEquipe));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);

  // Mapas derivados memoizados (compartilhados pelas abas via bag).
  const bag = useMemo<PontoBag | null>(() => {
    if (!userId) return null;
    const equipeById = new Map(equipe.map((e) => [e.id, e]));
    const freelaById = new Map(freelancers.map((f) => [f.id, f]));
    const eventoById = new Map(eventos.map((e) => [e.id, e]));
    const alocsPorEscala = new Map<string, EscalaAlocacao[]>();
    for (const a of alocacoes) { const arr = alocsPorEscala.get(a.escala_id) || []; arr.push(a); alocsPorEscala.set(a.escala_id, arr); }
    return { userId, escalas, alocacoes, freelancers, registros, eventos, equipe, equipeById, freelaById, eventoById, alocsPorEscala, recarregar };
  }, [userId, escalas, alocacoes, freelancers, registros, eventos, equipe, recarregar]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Ponto & Escala</h1>
        <p className="mt-1 text-sm text-ink-muted">{SUBTITULO[tab]}</p>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : bag && (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5 border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon: Ico }) => (
              <button key={v} onClick={() => setTab(v)}
                className={`inline-flex items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'painel' && <Painel bag={bag} onIrEscala={() => setTab('escala')} />}
            {tab === 'escala' && <EscalaTab bag={bag} />}
            {tab === 'freelancers' && <Freelancers bag={bag} />}
            {tab === 'ponto' && <Ponto bag={bag} />}
            {tab === 'apuracao' && <Apuracao bag={bag} />}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Ponto & Escala ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoClock /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Ponto & Escala</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/ponto.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">escalas</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">escalas_alocacao</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">freelancers</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">ponto_registros</code> e liberar escala por evento, ponto, banco de horas e custo de mão de obra.
      </p>
    </div>
  );
}
