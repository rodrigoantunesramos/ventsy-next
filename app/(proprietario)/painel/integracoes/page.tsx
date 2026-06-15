'use client';

// Integrações — /painel/integracoes (grupo Conta).
// Central onde o dono CONECTA serviços externos que as outras páginas consomem:
// pagamento (Mercado Pago), e-mail (SMTP), WhatsApp, NFS-e, calendário,
// meteorologia, assinatura digital, contabilidade e a chave de IA (BYOK); além de
// WEBHOOKS de saída (assinados + retentativa) e CHAVES de API próprias.
//   • Catálogo      — cards conectar/testar/desconectar, com status e "usado em".
//   • Webhooks      — assina eventos do sistema e entrega numa URL (HMAC + log).
//   • Chaves de API — gera tokens do dono para integrações próprias.
// SEGURANÇA: todo segredo trafega só servidor↔cofre (RLS sem policy). O client
// recebe status MASCARADO via /api/integracoes/*. Tabelas: docs/sql/integracoes.sql.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { CATALOGO, isMissingTable } from '@/lib/integracoes';
import {
  carregarConexoes, carregarWebhooks, carregarChaves,
  type ConexaoStatusDTO, type Webhook, type WebhookLog, type ApiKey,
} from './_lib';
import Catalogo from './_components/Catalogo';
import Webhooks from './_components/Webhooks';
import Chaves from './_components/Chaves';
import { Ico } from './_components/ui';

type Tab = 'catalogo' | 'webhooks' | 'chaves';
const TABS: { v: Tab; label: string; icon: string }[] = [
  { v: 'catalogo', label: 'Catálogo', icon: 'plug' },
  { v: 'webhooks', label: 'Webhooks', icon: 'webhook' },
  { v: 'chaves', label: 'Chaves de API', icon: 'key' },
];
const SUBTITULO: Record<Tab, string> = {
  catalogo: 'Conecte e teste os serviços externos que o sistema usa — pagamento, e-mail, WhatsApp, NFS-e, agenda, clima, assinatura, contabilidade e IA.',
  webhooks: 'Assine eventos do sistema e entregue-os, assinados, numa URL sua — com log de entregas e retentativa automática.',
  chaves: 'Gere chaves de API do dono para conectar automações próprias (Zapier, Make, n8n) com escopos e limite.',
};

export default function IntegracoesPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState('');
  const [tab, setTab] = useState<Tab>('catalogo');

  const [conexoes, setConexoes] = useState<Record<string, ConexaoStatusDTO>>({});
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [log, setLog] = useState<WebhookLog[]>([]);
  const [chaves, setChaves] = useState<ApiKey[]>([]);

  const recarregarConexoes = useCallback(async () => {
    const arr = await carregarConexoes();
    setConexoes(Object.fromEntries(arr.map((c) => [c.chave, c])));
  }, []);
  const recarregarWebhooks = useCallback(async () => {
    const { webhooks: w, log: l } = await carregarWebhooks();
    setWebhooks(w); setLog(l);
  }, []);
  const recarregarChaves = useCallback(async () => { setChaves(await carregarChaves()); }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      setUserId(session.user.id);

      // Probe de setup (NÃO usar head:true — HEAD sem corpo mascara PGRST205).
      const probe = await sb.from('integracoes_conexoes').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      await Promise.all([
        recarregarConexoes().catch(() => {}),
        recarregarWebhooks().catch(() => {}),
        recarregarChaves().catch(() => {}),
      ]);

      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      setLoading(false);
    })();
  }, [recarregarConexoes, recarregarWebhooks, recarregarChaves]);

  const kpis = useMemo(() => {
    const lista = Object.values(conexoes);
    return {
      conectadas: lista.filter((c) => c.status === 'conectado').length,
      erros: lista.filter((c) => c.status === 'erro').length,
      disponiveis: CATALOGO.length,
      webhooksAtivos: webhooks.filter((w) => w.ativo).length,
    };
  }, [conexoes, webhooks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-black/[0.06]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-black/[0.05]" />)}
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="mx-auto max-w-6xl">
        <Header tab={tab} setTab={setTab} hideTabs />
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Ico name="plug" /></div>
          <h3 className="text-base font-bold text-ink">Ative a Central de Integrações</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
            Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/integracoes.sql</code> no Supabase (SQL Editor) para criar as tabelas do catálogo, dos webhooks e das chaves de API — e liberar conexões, testes e webhooks de saída.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Header tab={tab} setTab={setTab} />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Conectadas" valor={kpis.conectadas} icon="check" tom="bg-emerald-50 text-emerald-700" />
        <Kpi label="Com erro" valor={kpis.erros} icon="warn" tom={kpis.erros > 0 ? 'bg-red-50 text-red-700' : 'bg-black/[0.04] text-ink-muted'} />
        <Kpi label="Disponíveis" valor={kpis.disponiveis} icon="plug" tom="bg-brand-50 text-brand" />
        <Kpi label="Webhooks ativos" valor={kpis.webhooksAtivos} icon="webhook" tom="bg-sky-50 text-sky-700" />
      </div>

      <div className="mt-6">
        {tab === 'catalogo' && <Catalogo conexoes={conexoes} recarregar={recarregarConexoes} />}
        {tab === 'webhooks' && <Webhooks webhooks={webhooks} log={log} recarregar={recarregarWebhooks} />}
        {tab === 'chaves' && <Chaves chaves={chaves} recarregar={recarregarChaves} />}
      </div>
    </div>
  );
}

function Header({ tab, setTab, hideTabs }: { tab: Tab; setTab: (t: Tab) => void; hideTabs?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Integrações</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>
      {!hideTabs && (
        <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
          {TABS.map(({ v, label, icon }) => (
            <button key={v} onClick={() => setTab(v)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
              <Ico name={icon} className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Kpi({ label, valor, icon, tom }: { label: string; valor: number; icon: string; tom: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tom}`}><Ico name={icon} className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{valor}</div>
    </div>
  );
}
