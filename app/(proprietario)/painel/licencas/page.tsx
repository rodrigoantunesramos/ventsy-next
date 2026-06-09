'use client';

// Licenças, Alvarás & Compliance — /painel/licencas.
// Controla tudo que mantém a operação legal num só lugar: alvarás PERMANENTES do
// espaço (funcionamento, AVCB/bombeiros, sanitário, ambiental) e licenças POR
// EVENTO (autorização do evento, som/ruído, ECAD, sanitária para A&B, polícia,
// ambiental temporária, fechamento de via, NOTAM/ANAC) — com vencimento, órgão,
// custo, documentos e CHECKLIST por tipo/porte. Exigência obrigatória pendente
// bloqueia a prontidão do evento (liga com Produção); custo de licenças entra no
// caixa (contábil). Quatro abas: Painel · Permanentes · Por evento · Biblioteca.
//
// Fontes: `licencas` e `compliance_checklists` (docs/sql/licencas.sql), além de
// `propriedades` e `clientes_eventos`. A engine de status/semáforo/prontidão/
// templates vem do motor puro lib/licencas.ts; "aplicar checklist" e "lançar
// custo" passam pela rota AUTORITATIVA /api/licencas. Degrada para um setup-card
// até o SQL ser aplicado. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { isMissingTable, todayYMD } from '@/lib/licencas';
import {
  type LicencasCtx, type EventoLite, type PropriedadeLite, type ChecklistRow,
  SEL_LIC, SEL_EVENTO, SEL_PROP, SEL_CHECKLIST, mapLicenca, mapChecklist, propriedadeLabel, eventoLabel,
} from './_lib';
import {
  IcoGrid, IcoBuilding, IcoCalendar, IcoBook, IcoShield,
} from './_components/ui';
import Painel from './_components/Painel';
import Permanentes from './_components/Permanentes';
import PorEvento from './_components/PorEvento';
import Biblioteca from './_components/Biblioteca';
import type { Licenca } from '@/lib/licencas';

type Tab = 'painel' | 'permanentes' | 'evento' | 'biblioteca';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'painel', label: 'Painel', icon: IcoGrid },
  { v: 'permanentes', label: 'Alvarás permanentes', icon: IcoBuilding },
  { v: 'evento', label: 'Por evento', icon: IcoCalendar },
  { v: 'biblioteca', label: 'Biblioteca', icon: IcoBook },
];
const SUBTITULO: Record<Tab, string> = {
  painel: 'Semáforo de conformidade, vencimentos, custo anual e situação por propriedade.',
  permanentes: 'Alvarás do espaço (funcionamento, AVCB, sanitário, ambiental) com vencimento, órgão e documento.',
  evento: 'Exigências legais de cada evento por tipo/porte — com prontidão que libera ou bloqueia o evento.',
  biblioteca: 'Modelos de checklist por tipo de evento — ajuste as exigências ao seu município.',
};

export default function LicencasPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('painel');

  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [propriedades, setPropriedades] = useState<PropriedadeLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);

  const hoje = useMemo(() => todayYMD(), []);

  // ── Boot: sessão + probe da tabela `licencas` + cargas escopadas por usuario_id ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe SEM head:true — HEAD não traz corpo e o supabase-js não leria o
      // PGRST205 (o setup-card nunca apareceria). Ver feedback_needssetup_probe_head_bug.
      const probe = await sb.from('licencas').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const [licRes, propRes, evRes, chkRes] = await Promise.all([
        sb.from('licencas').select(SEL_LIC).eq('usuario_id', uid).order('validade', { ascending: true, nullsFirst: false }),
        sb.from('propriedades').select(SEL_PROP).eq('usuario_id', uid).order('nome'),
        sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
        sb.from('compliance_checklists').select(SEL_CHECKLIST).eq('usuario_id', uid).order('nome'),
      ]);
      setLicencas(licRes.error ? [] : (licRes.data || []).map(mapLicenca));
      setPropriedades(propRes.error ? [] : (propRes.data || []) as PropriedadeLite[]);
      setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
      setChecklists(chkRes.error ? [] : (chkRes.data || []).map(mapChecklist));

      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      setLoading(false);
    })();
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb.from('licencas').select(SEL_LIC).eq('usuario_id', userId)
      .order('validade', { ascending: true, nullsFirst: false });
    if (!error) setLicencas((data || []).map(mapLicenca));
  }, [userId]);

  const reloadChecklists = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb.from('compliance_checklists').select(SEL_CHECKLIST).eq('usuario_id', userId).order('nome');
    if (!error) setChecklists((data || []).map(mapChecklist));
  }, [userId]);

  const propById = useMemo(() => new Map(propriedades.map((p) => [p.id, p])), [propriedades]);
  const evById = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);

  const ctx = useMemo<LicencasCtx | null>(() => {
    if (!userId) return null;
    return {
      userId, hoje, licencas, propriedades, eventos, checklists,
      propNome: (id) => propriedadeLabel(id == null ? null : propById.get(id) || null),
      eventoNome: (id) => eventoLabel(id == null ? null : evById.get(id) || null),
      reload, reloadChecklists,
    };
  }, [userId, hoje, licencas, propriedades, eventos, checklists, propById, evById, reload, reloadChecklists]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Licenças, Alvarás & Compliance</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : (
        <>
          {/* Abas */}
          <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon: Ico }) => (
              <button key={v} onClick={() => setTab(v)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {ctx && (
              <>
                {tab === 'painel' && <Painel ctx={ctx} onNovo={() => setTab('permanentes')} />}
                {tab === 'permanentes' && <Permanentes ctx={ctx} />}
                {tab === 'evento' && <PorEvento ctx={ctx} />}
                {tab === 'biblioteca' && <Biblioteca ctx={ctx} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Licenças ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoShield /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Licenças & Compliance</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/licencas.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">licencas</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">compliance_checklists</code> e liberar o controle de alvarás permanentes, licenças por evento e a biblioteca de exigências.
      </p>
    </div>
  );
}
