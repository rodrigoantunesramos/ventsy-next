'use client';

// Saúde, Segurança & Emergência (SST) — /painel/sst.
// Segurança de PESSOAS no evento: plano de emergência/evacuação/APH/incêndio,
// dimensionamento de recursos por público (ambulância, posto médico, brigada,
// bombeiro civil, segurança, extintores, desfibrilador) com cobertura que bloqueia
// a prontidão, EPIs e treinamentos/NRs com validade, simulados/inspeções e
// registro de ocorrências/acidentes com indicadores. Seis abas: Painel · Planos ·
// Dimensionamento · EPIs & NRs · Simulados · Ocorrências.
//
// Fontes: sst_planos, sst_recursos_evento, sst_ocorrencias, sst_epis,
// sst_treinamentos, sst_simulados (docs/sql/sst.sql) + clientes_eventos (evento),
// propriedades (espaço), equipe (brigadistas/treinamentos), fornecedores. A engine
// (dimensionamento, cobertura, indicadores, validade, templates) vive em lib/sst
// (pura, testada); o dimensionamento autoritativo passa por /api/sst. Degrada para
// um setup-card até o SQL ser aplicado. Sem "R$".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { type SstCtx, carregarCatalogos, isMissingTable } from './_lib';
import { Ico } from './_components/ui';
import Painel from './_components/Painel';
import Planos from './_components/Planos';
import Dimensionamento from './_components/Dimensionamento';
import EpisNrs from './_components/EpisNrs';
import Simulados from './_components/Simulados';
import Ocorrencias from './_components/Ocorrencias';

type Tab = 'painel' | 'planos' | 'dimensionamento' | 'episnrs' | 'simulados' | 'ocorrencias';
const TABS: { v: Tab; label: string; icon: string }[] = [
  { v: 'painel', label: 'Painel', icon: 'shield' },
  { v: 'planos', label: 'Planos', icon: 'doc' },
  { v: 'dimensionamento', label: 'Dimensionamento', icon: 'users' },
  { v: 'episnrs', label: 'EPIs & NRs', icon: 'helmet' },
  { v: 'simulados', label: 'Simulados', icon: 'clipboard' },
  { v: 'ocorrencias', label: 'Ocorrências', icon: 'alert' },
];
const SUBTITULO: Record<Tab, string> = {
  painel: 'Visão geral de segurança: prontidão dos eventos, validades de EPIs/NRs e indicadores de ocorrências.',
  planos: 'Planos de emergência, evacuação, APH e incêndio por espaço e por evento — rotas, pontos de encontro e contatos.',
  dimensionamento: 'Público × exigências: ambulância, posto médico, brigada, segurança, extintores e DEA. Faltas bloqueiam a prontidão.',
  episnrs: 'Controle de EPIs (CA e validade) e treinamentos obrigatórios / NRs da equipe.',
  simulados: 'Simulados de evacuação/incêndio/APH e inspeções de segurança, com periodicidade.',
  ocorrencias: 'Registro de acidentes, incidentes e atendimentos, com gravidade, CAT e indicadores.',
};

const HOJE = () => new Date().toISOString().slice(0, 10);

export default function SstPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [ctx, setCtx] = useState<SstCtx | null>(null);
  const [tab, setTab] = useState<Tab>('painel');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      // Probe SEM head:true — HEAD não traz corpo e o supabase-js não leria o
      // PGRST205 da tabela ausente (o setup-card nunca apareceria).
      const probe = await sb.from('sst_planos').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const cats = await carregarCatalogos(uid);
      setCtx({ userId: uid, hoje: HOJE(), ...cats });

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      setLoading(false);
    })();
  }, []);

  const onTab = useCallback((t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url.toString());
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><Ico name="shield" size={22} /></span>
          <div>
            <h1 className="text-xl font-bold text-ink sm:text-2xl">Saúde, Segurança & Emergência</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
          </div>
        </div>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : !ctx ? (
        <SetupCard sessaoExpirada />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon }) => (
              <button key={v} onClick={() => onTab(v)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico name={icon} size={16} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'painel' && <Painel ctx={ctx} onIr={onTab} />}
            {tab === 'planos' && <Planos ctx={ctx} toast={toast} />}
            {tab === 'dimensionamento' && <Dimensionamento ctx={ctx} toast={toast} />}
            {tab === 'episnrs' && <EpisNrs ctx={ctx} toast={toast} />}
            {tab === 'simulados' && <Simulados ctx={ctx} toast={toast} />}
            {tab === 'ocorrencias' && <Ocorrencias ctx={ctx} toast={toast} />}
          </div>
        </>
      )}
    </div>
  );
}

function SetupCard({ sessaoExpirada }: { sessaoExpirada?: boolean }) {
  if (sessaoExpirada) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h3 className="text-base font-bold text-ink">Sessão expirada</h3>
        <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">Faça login novamente para acessar o módulo de SST.</p>
        <a href="/login" className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Entrar</a>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Ico name="shield" size={24} /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo de SST</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/sst.sql</code> no Supabase (SQL Editor) para criar as tabelas
        {' '}<code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_planos</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_recursos_evento</code>,
        {' '}<code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_ocorrencias</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_epis</code>,
        {' '}<code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_treinamentos</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">sst_simulados</code>
        {' '}e liberar planos de emergência, dimensionamento por público, EPIs/NRs, simulados e ocorrências.
      </p>
    </div>
  );
}
