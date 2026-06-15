'use client';

// Jurídico & LGPD — /painel/juridico.
// Central jurídica e de privacidade do espaço de eventos. Seis abas:
//   • Painel        — semáforo de prazos, KPIs e o feed de vencimentos próximos.
//   • Contratos     — visão CONSOLIDADA dos contratos de cliente (read-only, vindos
//                     de /painel/contratos) + os demais contratos (fornecedor/
//                     trabalho/parceria/serviço/NDA), com vigência e alertas.
//   • Processos     — judiciais/administrativos/notificações com prazo e advogado.
//   • Consentimentos— registro LGPD de consentimentos (base legal + finalidade + origem).
//   • Direitos      — fila de solicitações de titulares (acesso/correção/exclusão/…)
//                     com prazo legal (15d) e a trilha; exporta/anonimiza um titular.
//   • Políticas     — retenção/descarte por tipo de dado + documentos versionados
//                     (privacidade/termos), ligando com /privacidade e /termos.
//
// Fontes: juridico_contratos, juridico_processos, lgpd_consentimentos,
//   lgpd_solicitacoes, lgpd_retencao, lgpd_politicas (docs/sql/juridico.sql) + as
//   tabelas-âncora contratos/clientes/clientes_eventos/fornecedores. A engine de
//   vigência/prazos/SLA/retenção/KPIs vive em lib/juridico (pura, testada). A
//   exportação/anonimização de titular passa por /api/juridico (service-role).
//   CRUD via RLS. Degrada para um setup-card até o SQL ser aplicado. Sem "R$".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  type Tab, type JuridicoBag,
  type JuridicoContrato, type Processo, type Consentimento, type Solicitacao,
  type RegraRetencao, type Politica, type ContratoClienteRef, type FornecedorLite, type ClienteLite, type EventoLite,
  SEL_JC, SEL_PROC, SEL_CONSENT, SEL_SOLIC, SEL_RETEN, SEL_POL, SEL_CONTRATO_CLI,
  mapContratoJur, mapProcesso, mapConsentimento, mapSolicitacao, mapRetencao, mapPolitica,
  mapFornecedor, mapCliente, mapEvento, mapContratoCliente,
  isMissingTable,
  consolidarContratos, resumoContratos, resumoLGPD,
} from './_lib';
import {
  IcoScale, IcoDoc, IcoGavel, IcoUserCheck, IcoShield, IcoLock, IcoAlert,
} from './_components/ui';
import Painel from './_components/Painel';
import Contratos from './_components/Contratos';
import Processos from './_components/Processos';
import Consentimentos from './_components/Consentimentos';
import Direitos from './_components/Direitos';
import Politicas from './_components/Politicas';

const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'painel', label: 'Painel', icon: IcoScale },
  { v: 'contratos', label: 'Contratos', icon: IcoDoc },
  { v: 'processos', label: 'Processos', icon: IcoGavel },
  { v: 'consentimentos', label: 'Consentimentos', icon: IcoUserCheck },
  { v: 'direitos', label: 'Direitos do titular', icon: IcoShield },
  { v: 'politicas', label: 'Políticas', icon: IcoLock },
];
const SUBTITULO: Record<Tab, string> = {
  painel: 'Visão geral da conformidade jurídica e de privacidade — prazos, contratos, processos e LGPD num só lugar.',
  contratos: 'Todos os contratos vigentes (clientes, fornecedores, trabalho, parceria) com vencimento, renovação e alertas.',
  processos: 'Processos, notificações e acordos — com polo, prazo, valor envolvido e advogado responsável.',
  consentimentos: 'Registro de consentimentos LGPD: quem consentiu, para qual finalidade, com qual base legal e por qual canal.',
  direitos: 'Fila de solicitações de titulares (acesso, correção, exclusão, portabilidade) com prazo legal de 15 dias e trilha.',
  politicas: 'Política de retenção e descarte por tipo de dado + documentos versionados (privacidade, termos, cookies).',
};

const HOJE = () => new Date().toISOString().slice(0, 10);

export default function JuridicoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState('');
  const [tab, setTab] = useState<Tab>('painel');

  const [contratosJur, setContratosJur] = useState<JuridicoContrato[]>([]);
  const [contratosCliente, setContratosCliente] = useState<ContratoClienteRef[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [retencao, setRetencao] = useState<RegraRetencao[]>([]);
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);

  const hoje = HOJE();

  const carregar = useCallback(async (uid: string) => {
    // Catálogos auxiliares p/ resolver contraparte e sugerir titulares.
    const [cliRes, evRes, fornRes] = await Promise.all([
      sb.from('clientes').select('id,nome,email').eq('usuario_id', uid).order('nome'),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,cliente_id').eq('usuario_id', uid),
      sb.from('fornecedores').select('id,nome').eq('usuario_id', uid).order('nome'),
    ]);
    const cli = (cliRes.error ? [] : (cliRes.data || []).map(mapCliente)) as ClienteLite[];
    const evs: EventoLite[] = evRes.error ? [] : (evRes.data || []).map(mapEvento);
    setClientes(cli);
    setFornecedores(fornRes.error ? [] : (fornRes.data || []).map(mapFornecedor));

    const nomePorCliente = new Map<string, string>(cli.filter((c) => c.nome).map((c) => [c.id, c.nome as string]));
    const rotuloPorEvento = new Map<string, string>(
      evs.map((e) => [e.id, e.nome_evento || e.quem_contratou || 'Evento']),
    );

    // Tabelas do módulo + contratos de cliente (read-only, guardado).
    const [jcRes, procRes, conRes, solRes, retRes, polRes, ctrRes] = await Promise.all([
      sb.from('juridico_contratos').select(SEL_JC).eq('usuario_id', uid).order('vigencia_fim', { ascending: true, nullsFirst: false }),
      sb.from('juridico_processos').select(SEL_PROC).eq('usuario_id', uid).order('prazo', { ascending: true, nullsFirst: false }),
      sb.from('lgpd_consentimentos').select(SEL_CONSENT).eq('usuario_id', uid).order('concedido_em', { ascending: false }),
      sb.from('lgpd_solicitacoes').select(SEL_SOLIC).eq('usuario_id', uid).order('prazo', { ascending: true, nullsFirst: false }),
      sb.from('lgpd_retencao').select(SEL_RETEN).eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('lgpd_politicas').select(SEL_POL).eq('usuario_id', uid).order('tipo'),
      sb.from('contratos').select(SEL_CONTRATO_CLI).eq('usuario_id', uid),
    ]);

    // A tabela-âncora do módulo decide o setup-card.
    if (isMissingTable(jcRes.error)) { setNeedsSetup(true); return; }
    setNeedsSetup(false);

    setContratosJur((jcRes.data || []).map(mapContratoJur));
    setProcessos(procRes.error ? [] : (procRes.data || []).map(mapProcesso));
    setConsentimentos(conRes.error ? [] : (conRes.data || []).map(mapConsentimento));
    setSolicitacoes(solRes.error ? [] : (solRes.data || []).map(mapSolicitacao));
    setRetencao(retRes.error ? [] : (retRes.data || []).map(mapRetencao));
    setPoliticas(polRes.error ? [] : (polRes.data || []).map(mapPolitica));
    // contratos de cliente são opcionais (módulo Contratos pode não estar ativo).
    setContratosCliente(ctrRes.error ? [] : (ctrRes.data || []).map((r: unknown) => mapContratoCliente(r, nomePorCliente, rotuloPorEvento)));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe SEM head:true (HEAD não traz corpo → PGRST205 ilegível → setup-card some).
      const probe = await sb.from('juridico_contratos').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      let nome = '';
      try {
        const { data: u } = await sb.from('usuarios').select('nome').eq('id', uid).maybeSingle();
        nome = u?.nome || '';
      } catch { /* opcional */ }
      try {
        const { data: cfg } = await sb.from('empresa_config').select('*').eq('usuario_id', uid).maybeSingle();
        nome = cfg?.fantasia || cfg?.razao_social || nome;
      } catch { /* opcional */ }
      setEmpresa(nome);

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);

      await carregar(uid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    if (userId) await carregar(userId);
  }, [userId, carregar]);

  const goTab = useCallback((t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const bag = useMemo<JuridicoBag | null>(() => {
    if (!userId) return null;
    return {
      userId, hoje, empresa,
      contratosCliente, contratosJur, processos, consentimentos, solicitacoes, retencao, politicas,
      fornecedores, clientes, reload, goTab,
    };
  }, [userId, hoje, empresa, contratosCliente, contratosJur, processos, consentimentos, solicitacoes, retencao, politicas, fornecedores, clientes, reload, goTab]);

  // Semáforo do header (resumo de pendências que exigem ação).
  const alerta = useMemo(() => {
    const cons = consolidarContratos(contratosCliente, contratosJur, hoje);
    const rc = resumoContratos(cons);
    const rl = resumoLGPD(consentimentos, solicitacoes, hoje);
    const vencidos = rc.vencidos + rl.solicVencidas;
    const aVencer = rc.aVencer + rl.solicAVencer;
    return { vencidos, aVencer };
  }, [contratosCliente, contratosJur, consentimentos, solicitacoes, hoje]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Jurídico & LGPD</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
        {!needsSetup && (alerta.vencidos > 0 || alerta.aVencer > 0) && (
          <button onClick={() => goTab('painel')}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${alerta.vencidos > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            <IcoAlert />
            {alerta.vencidos > 0 ? `${alerta.vencidos} vencido(s)` : `${alerta.aVencer} a vencer`}
          </button>
        )}
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : !bag ? null : (
        <>
          {/* Abas */}
          <div className="mt-4 flex flex-wrap gap-1.5 overflow-x-auto border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon: Ico }) => (
              <button key={v} onClick={() => goTab(v)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'painel' && <Painel bag={bag} />}
            {tab === 'contratos' && <Contratos bag={bag} />}
            {tab === 'processos' && <Processos bag={bag} />}
            {tab === 'consentimentos' && <Consentimentos bag={bag} />}
            {tab === 'direitos' && <Direitos bag={bag} />}
            {tab === 'politicas' && <Politicas bag={bag} />}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas do módulo ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoScale /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Jurídico & LGPD</h3>
      <p className="mx-auto mt-1 max-w-xl text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/juridico.sql</code> no Supabase (SQL Editor) para criar as tabelas de contratos, processos e LGPD (consentimentos, solicitações, retenção e políticas) e liberar o repositório jurídico, os alertas de prazo e o atendimento a titulares.
      </p>
    </div>
  );
}
