'use client';

// Produção & Run-of-show — /painel/producao.
// Transforma um evento CONTRATADO (clientes_eventos) num PROJETO EXECUTÁVEL:
// briefing estruturado, checklist de produção (Kanban por categoria, com
// responsável/prazo/DEPENDÊNCIA), cronograma operacional minuto-a-minuto
// (run-of-show, com "modo dia do evento") e o fechamento pós-evento. É o "dia D
// sob controle". Cinco abas: Briefing · Checklist · Run-of-show · Equipe &
// Fornecedores · Pós-evento.
//
// Fontes: `producao`, `producao_tarefas`, `runshow` (docs/sql/producao.sql),
// além de `clientes_eventos` (o evento) e — para a aba Equipe & Fornecedores —
// reuso de `equipe`, `fornecedores`, `escalas`/`escalas_alocacao`/`freelancers`
// (módulo Ponto). A prontidão/dependências/templates/conflitos vêm do motor puro
// lib/producao.ts; o "ensure 1:1 + aplicar template" e a CONCLUSÃO de tarefa
// (dependência) passam pela rota AUTORITATIVA /api/producao. Degrada para um
// setup-card até o SQL ser aplicado. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoLite, type ProducaoBag, type Producao, type Tarefa, type RunshowItem,
  type EquipeLite, type FornecedorLite, type EscalaLite, type AlocLite, type FreelancerLite,
  SEL_EVENTO, SEL_PROD, SEL_TAR, SEL_RUN,
  mapProducao, mapTarefa, mapRunshow, mapEquipe, mapFornecedor, mapEscala, mapAloc, mapFreelancer,
  ensureProducao, eventoLabel, isMissingTable, PRODUCAO_STATUS_META,
} from './_lib';
import {
  IcoDoc, IcoClipboard, IcoClock, IcoUsers, IcoFlag, IcoCalendar, EmptyState, btnPrimary,
} from './_components/ui';
import Briefing from './_components/Briefing';
import Checklist from './_components/Checklist';
import RunShow from './_components/RunShow';
import EquipeFornecedores from './_components/EquipeFornecedores';
import PosEvento from './_components/PosEvento';

type Tab = 'briefing' | 'checklist' | 'runshow' | 'equipe' | 'pos';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'briefing', label: 'Briefing', icon: IcoDoc },
  { v: 'checklist', label: 'Checklist', icon: IcoClipboard },
  { v: 'runshow', label: 'Run-of-show', icon: IcoClock },
  { v: 'equipe', label: 'Equipe & Fornecedores', icon: IcoUsers },
  { v: 'pos', label: 'Pós-evento', icon: IcoFlag },
];
const SUBTITULO: Record<Tab, string> = {
  briefing: 'Tudo o que a equipe precisa saber do evento: convidados, horários, contatos e do\'s & don\'ts.',
  checklist: 'Tarefas de produção por categoria, com responsável, prazo e dependências que travam a ordem.',
  runshow: 'Cronograma minuto-a-minuto do dia. Use o modo dia-do-evento para conduzir ao vivo.',
  equipe: 'Quem está alocado no evento (puxa Ponto/Escala), contatos e fornecedores.',
  pos: 'Encerramento: devolução de equipamentos, vistoria, feedback e lições aprendidas.',
};

export default function ProducaoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('checklist');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [carregandoEvento, setCarregandoEvento] = useState(false);

  const [producao, setProducao] = useState<Producao | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [runshow, setRunshow] = useState<RunshowItem[]>([]);

  // Reuso de outros módulos (podem vir vazios se as tabelas não existirem).
  const [equipe, setEquipe] = useState<EquipeLite[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [escalas, setEscalas] = useState<EscalaLite[]>([]);
  const [alocacoes, setAlocacoes] = useState<AlocLite[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerLite[]>([]);

  // ── Boot: sessão + lista de eventos + probe da tabela `producao` ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe: a tabela-âncora `producao` existe?
      const probe = await sb.from('producao').select('id', { head: true, count: 'exact' }).limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const evRes = await sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid)
        .order('data_inicio', { ascending: false, nullsFirst: false });
      const evs = (evRes.data || []) as EventoLite[];
      setEventos(evs);

      // Catálogos globais reusados (defensivos).
      const [eqRes, foRes, frRes] = await Promise.all([
        sb.from('equipe').select('id,nome,cargo,departamento').eq('usuario_id', uid).order('nome'),
        sb.from('fornecedores').select('id,nome,fantasia,categoria,whatsapp,email').eq('usuario_id', uid).order('nome'),
        sb.from('freelancers').select('id,nome,funcao,contato').eq('usuario_id', uid).order('nome'),
      ]);
      setEquipe(eqRes.error ? [] : (eqRes.data || []).map(mapEquipe));
      setFornecedores(foRes.error ? [] : (foRes.data || []).map(mapFornecedor));
      setFreelancers(frRes.error ? [] : (frRes.data || []).map(mapFreelancer));

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      const ev = url.get('evento');
      const inicial = (ev && evs.some((e) => e.id === ev)) ? ev : evs[0]?.id || null;
      setLoading(false);
      if (inicial) await selecionarEvento(inicial, uid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seleciona um evento: ensure produção (1:1) + carrega tudo dele ──
  const selecionarEvento = useCallback(async (evId: string, uid: string) => {
    setCarregandoEvento(true);
    setEventoId(evId);
    try {
      const r = await ensureProducao(evId);
      if (!r.ok) {
        if (r.status === 500 && isMissingTable({ message: r.error })) { setNeedsSetup(true); return; }
        toast.error(r.error || 'Não foi possível abrir a produção do evento.');
        setProducao(null); setTarefas([]); setRunshow([]);
        return;
      }
      setProducao(mapProducao(r.data.producao));
      setTarefas((r.data.tarefas || []).map(mapTarefa));
      setRunshow((r.data.runshow || []).map(mapRunshow));

      // Escalas/alocações do evento (módulo Ponto) — para a aba Equipe.
      const esRes = await sb.from('escalas').select('id,evento_id,data,turno,funcao,necessario').eq('usuario_id', uid).eq('evento_id', evId);
      const esc: EscalaLite[] = esRes.error ? [] : (esRes.data || []).map(mapEscala);
      setEscalas(esc);
      if (esc.length) {
        const alRes = await sb.from('escalas_alocacao').select('id,escala_id,equipe_id,freelancer_id,status').in('escala_id', esc.map((e) => e.id));
        setAlocacoes(alRes.error ? [] : (alRes.data || []).map(mapAloc));
      } else {
        setAlocacoes([]);
      }
    } finally {
      setCarregandoEvento(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Recarrega apenas os dados da produção atual (após CRUD via RLS), sem re-ensure.
  const recarregar = useCallback(async () => {
    if (!producao) return;
    const [pRes, tRes, rRes] = await Promise.all([
      sb.from('producao').select(SEL_PROD).eq('id', producao.id).single(),
      sb.from('producao_tarefas').select(SEL_TAR).eq('producao_id', producao.id).order('ordem'),
      sb.from('runshow').select(SEL_RUN).eq('producao_id', producao.id).order('ordem'),
    ]);
    if (!pRes.error && pRes.data) setProducao(mapProducao(pRes.data));
    if (!tRes.error) setTarefas((tRes.data || []).map(mapTarefa));
    if (!rRes.error) setRunshow((rRes.data || []).map(mapRunshow));
  }, [producao]);

  const eventoAtual = useMemo(() => eventos.find((e) => e.id === eventoId) || null, [eventos, eventoId]);

  const bag = useMemo<ProducaoBag | null>(() => {
    if (!userId || !eventoAtual || !producao) return null;
    return {
      userId, evento: eventoAtual, producao, tarefas, runshow,
      tarefaById: new Map(tarefas.map((t) => [t.id, t])),
      equipe, fornecedores, escalas, alocacoes, freelancers, recarregar,
    };
  }, [userId, eventoAtual, producao, tarefas, runshow, equipe, fornecedores, escalas, alocacoes, freelancers, recarregar]);

  const onTrocarEvento = (id: string) => {
    if (!userId || id === eventoId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('evento', id);
    window.history.replaceState(null, '', url.toString());
    selecionarEvento(id, userId);
  };

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Produção & Run-of-show</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
        {producao && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRODUCAO_STATUS_META[producao.status]?.chip || 'bg-gray-100 text-gray-600'}`}>
            {PRODUCAO_STATUS_META[producao.status]?.label || producao.status}
          </span>
        )}
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : eventos.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IcoCalendar />} title="Nenhum evento para produzir ainda"
            cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
            A produção parte de um evento contratado. Cadastre um lead/evento em <strong>Clientes</strong> ou <strong>Leads</strong> e ele aparece aqui para virar um projeto executável.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Seletor de evento */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
            <div className="min-w-0 flex-1">
              <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
              <select
                value={eventoId || ''}
                onChange={(e) => onTrocarEvento(e.target.value)}
                className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none"
              >
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {eventoAtual?.data_inicio && (
              <div className="hidden shrink-0 text-right sm:block">
                <div className="text-[0.7rem] text-ink-muted">Data do evento</div>
                <div className="text-sm font-bold text-ink">{formatDate(eventoAtual.data_inicio, { style: 'long' })}</div>
              </div>
            )}
          </div>

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
            {carregandoEvento || !bag ? (
              <div className="space-y-3">
                <div className="h-[120px] animate-pulse rounded-2xl bg-black/[0.05]" />
                <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
              </div>
            ) : (
              <>
                {tab === 'briefing' && <Briefing bag={bag} />}
                {tab === 'checklist' && <Checklist bag={bag} />}
                {tab === 'runshow' && <RunShow bag={bag} />}
                {tab === 'equipe' && <EquipeFornecedores bag={bag} onIrChecklist={() => setTab('checklist')} />}
                {tab === 'pos' && <PosEvento bag={bag} onIrChecklist={() => setTab('checklist')} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Produção ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoClipboard /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Produção</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/producao.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">producao</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">producao_tarefas</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">runshow</code> e liberar briefing, checklist, cronograma minuto-a-minuto e pós-evento por evento.
      </p>
    </div>
  );
}
