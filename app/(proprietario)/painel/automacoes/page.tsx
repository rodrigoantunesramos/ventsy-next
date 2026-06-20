'use client';

// Automações & Notificações — /painel/automacoes.
// O "tecido conectivo" do painel: regras gatilho → condição → ação ("se isto,
// então aquilo") que costuram Cobrança, Contratos, Feedback, Licenças e CRM, +
// a central de notificações/lembretes (o sino do topo). Cinco abas:
//   Painel (pendências do dia + KPIs) · Automações (regras) · Receitas (1 clique)
//   · Notificações (caixa + preferências) · Histórico (log de execução).
//
// Fontes: `automacoes`, `automacoes_log`, `notificacoes` (docs/sql/automacoes.sql).
// A lógica de domínio é o motor PURO lib/automacoes.ts; o disparo temporal é o
// cron /api/cron/automacoes e o "testar/rodar agora" é /api/automacoes (ambos
// service-role). CRUD/leitura via RLS. Degrada para setup-card até o SQL rodar.
// Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { isMissingTable, type Automacao, type Notificacao, type AutomacaoLog, type DadosSelecao } from '@/lib/automacoes';
import {
  type AutomacoesCtx, SEL_AUTO, SEL_NOTIF, SEL_LOG,
  normAutomacao, normNotificacao, normLog, carregarFontes,
} from './_lib';
import { IcoBolt, IcoList, IcoSparkle, IcoBell, IcoHistory } from './_components/ui';
import Painel from './_components/Painel';
import Automacoes from './_components/Automacoes';
import Receitas from './_components/Receitas';
import Notificacoes from './_components/Notificacoes';
import Historico from './_components/Historico';

type Tab = 'painel' | 'automacoes' | 'receitas' | 'notificacoes' | 'historico';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'painel', label: 'Painel', icon: () => <IcoBolt /> },
  { v: 'automacoes', label: 'Automações', icon: () => <IcoList /> },
  { v: 'receitas', label: 'Receitas', icon: () => <IcoSparkle /> },
  { v: 'notificacoes', label: 'Notificações', icon: () => <IcoBell /> },
  { v: 'historico', label: 'Histórico', icon: () => <IcoHistory /> },
];
const SUBTITULO: Record<Tab, string> = {
  painel: 'Suas pendências do dia e o pulso das automações que trabalham por você.',
  automacoes: 'Regras "se isto → então aquilo" que costuram cobrança, contratos, feedback e licenças.',
  receitas: 'Automações prontas para os casos mais comuns — ative em 1 clique.',
  notificacoes: 'A caixa do sino: avisos e lembretes, com suas preferências.',
  historico: 'Tudo o que cada automação disparou, com canal e resultado.',
};

function ymdLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function uniq(xs: (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x && x.trim() !== '').map((x) => x.trim()))].sort();
}

export default function AutomacoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');
  const [empresa, setEmpresa] = useState('');
  const [tab, setTab] = useState<Tab>('painel');

  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [logs, setLogs] = useState<AutomacaoLog[]>([]);
  const [dados, setDados] = useState<DadosSelecao>({ eventos: [], parcelas: [], contratos: [], clientes: [], licencas: [], feedbacks: [] });
  const [propriedades, setPropriedades] = useState<{ id: number; nome: string }[]>([]);

  const hoje = useMemo(() => ymdLocal(), []);

  const reloadAutomacoes = useCallback(async () => {
    if (!userId) return;
    const { data } = await sb.from('automacoes').select(SEL_AUTO).eq('usuario_id', userId).order('criado_em', { ascending: false });
    setAutomacoes(((data || []) as unknown[]).map(normAutomacao));
  }, [userId]);
  const reloadNotificacoes = useCallback(async () => {
    if (!userId) return;
    const { data } = await sb.from('notificacoes').select(SEL_NOTIF).eq('usuario_id', userId).order('criado_em', { ascending: false }).limit(200);
    setNotificacoes(((data || []) as unknown[]).map(normNotificacao));
  }, [userId]);
  const reloadLogs = useCallback(async () => {
    if (!userId) return;
    const { data } = await sb.from('automacoes_log').select(SEL_LOG).eq('usuario_id', userId).order('criado_em', { ascending: false }).limit(500);
    setLogs(((data || []) as unknown[]).map(normLog));
  }, [userId]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe SEM head:true (ver feedback_needssetup_probe_head_bug).
      const probe = await sb.from('automacoes').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', uid).maybeSingle();
        setPlano((a?.plano_ativo || 'basico').toString().toLowerCase());
      } catch { /* opcional */ }
      try {
        const { data: cfg } = await sb.from('empresa_config').select('fantasia, razao_social').eq('usuario_id', uid).maybeSingle();
        let nome = (cfg?.fantasia || cfg?.razao_social || '').toString().trim();
        if (!nome) { const { data: u } = await sb.from('usuarios').select('nome').eq('id', uid).maybeSingle(); nome = (u?.nome || '').toString().trim(); }
        setEmpresa(nome);
      } catch { /* opcional */ }

      const [autRes, notRes, logRes, fontes, propRes] = await Promise.all([
        sb.from('automacoes').select(SEL_AUTO).eq('usuario_id', uid).order('criado_em', { ascending: false }),
        sb.from('notificacoes').select(SEL_NOTIF).eq('usuario_id', uid).order('criado_em', { ascending: false }).limit(200),
        sb.from('automacoes_log').select(SEL_LOG).eq('usuario_id', uid).order('criado_em', { ascending: false }).limit(500),
        carregarFontes(uid),
        sb.from('propriedades').select('id,nome').eq('usuario_id', uid).order('nome'),
      ]);
      setAutomacoes(((autRes.data || []) as unknown[]).map(normAutomacao));
      setNotificacoes(((notRes.data || []) as unknown[]).map(normNotificacao));
      setLogs(((logRes.data || []) as unknown[]).map(normLog));
      setDados(fontes);
      setPropriedades(((propRes.data || []) as { id: number; nome: string | null }[]).map((p) => ({ id: Number(p.id), nome: p.nome || `Propriedade #${p.id}` })));

      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      setLoading(false);
    })();
  }, [router]);

  const tiposEvento = useMemo(() => uniq(dados.eventos.map((e) => e.tipo_evento)), [dados.eventos]);
  const statusEvento = useMemo(() => uniq(dados.eventos.map((e) => e.status)), [dados.eventos]);

  const ctx = useMemo<AutomacoesCtx | null>(() => {
    if (!userId) return null;
    return {
      userId, plano, empresa, automacoes, notificacoes, logs, dados, propriedades, tiposEvento, statusEvento, hoje,
      reloadAutomacoes, reloadNotificacoes, reloadLogs,
    };
  }, [userId, plano, empresa, automacoes, notificacoes, logs, dados, propriedades, tiposEvento, statusEvento, hoje, reloadAutomacoes, reloadNotificacoes, reloadLogs]);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Automações & Notificações</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon: Ico }) => (
              <button key={v} onClick={() => setTab(v)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico /> {label}
                {v === 'notificacoes' && notificacoes.some((n) => !n.lida) && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-brand" />}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {ctx && (
              <>
                {tab === 'painel' && <Painel ctx={ctx} onIrParaReceitas={() => setTab('receitas')} />}
                {tab === 'automacoes' && <Automacoes ctx={ctx} />}
                {tab === 'receitas' && <Receitas ctx={ctx} onAtivada={async () => { await reloadAutomacoes(); setTab('automacoes'); }} />}
                {tab === 'notificacoes' && <Notificacoes ctx={ctx} />}
                {tab === 'historico' && <Historico ctx={ctx} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoBolt size={22} /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Automações & Notificações</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/automacoes.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">automacoes</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">automacoes_log</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">notificacoes</code> e liberar as regras "se isto → então aquilo" + a central de notificações.
      </p>
    </div>
  );
}
