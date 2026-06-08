'use client';

// Clima & Plano B — /painel/plano-b.
// Reduz o risco de eventos ao ar livre: pega a PREVISÃO do tempo para a data/
// local do evento (lat/long da propriedade, via Open-Meteo), avalia GATILHOS de
// contingência (chuva/vento/calor/frio/tempestade/visibilidade/UV) e classifica o
// evento em verde/amarelo/vermelho, com checklist de contingência e comunicados
// para cliente/equipe/público. Quatro abas: Previsão · Gatilhos & Planos ·
// Contingência · Comunicação. Escala: corrida, air show, equestre, casamento no
// jardim, festa de igreja, exposição de carros.
//
// Fontes: `plano_contingencia`, `clima_snapshots` (docs/sql/plano-b.sql), além de
// `clientes_eventos` (o evento) e `propriedades` (lat/long do local). A engine de
// avaliação de risco + parse da previsão vive em lib/plano-b.ts (puro, testado); a
// BUSCA da previsão (Open-Meteo + cache) passa pela rota /api/plano-b. O CRUD de
// planos e a previsão MANUAL são via RLS. Degrada para um setup-card até o SQL ser
// aplicado, e para entrada manual quando não há API/coordenadas. Sem "R$".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoLite, type PropriedadeLite, type EquipeLite, type Plano, type ClimaResumo,
  type PlanoBBag, type PrevisaoMeta, type PrevisaoMotivo,
  SEL_EVENTO, SEL_PROP, SEL_PLANO,
  mapEvento, mapProp, mapPlano, mapEquipe, mapSnapshot,
  eventoLabel, isMissingTable, diaDe, previsaoDisponivel,
  avaliarPlanos, nivelGeral, avaliacoesDisparadas, nivelMeta, riscoMeta, condicaoDe,
  buscarPrevisao, lerSnapshot, salvarSnapshotManual,
} from './_lib';
import {
  CondIcon, EmptyState, IcoCloud, IcoAlert, IcoBolt, IcoMegafone, IcoList, IcoCalendar, IcoWind, btnPrimary,
} from './_components/ui';
import Forecast from './_components/Forecast';
import Planos from './_components/Planos';
import Contingencia from './_components/Contingencia';
import Comunicacao from './_components/Comunicacao';

type Tab = 'previsao' | 'planos' | 'contingencia' | 'comunicacao';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'previsao', label: 'Previsão', icon: IcoCloud },
  { v: 'planos', label: 'Gatilhos & Planos', icon: IcoBolt },
  { v: 'contingencia', label: 'Contingência', icon: IcoList },
  { v: 'comunicacao', label: 'Comunicação', icon: IcoMegafone },
];
const SUBTITULO: Record<Tab, string> = {
  previsao: 'O tempo previsto para a data e o local do evento — chuva, vento, temperatura, UV e visibilidade.',
  planos: 'Limiares por risco que acionam o plano B; o nível é calculado ao vivo contra a previsão.',
  contingencia: 'Itens a preparar para o plano B (lonas, escoamento, climatização, sinalização), com responsáveis.',
  comunicacao: 'Avise cliente, equipe e público quando o plano B mudar — com referência à política de remarcação.',
};

const HOJE = () => new Date().toISOString().slice(0, 10);

export default function PlanoBPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('previsao');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [carregandoEvento, setCarregandoEvento] = useState(false);

  const [propriedade, setPropriedade] = useState<PropriedadeLite | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [resumo, setResumo] = useState<ClimaResumo | null>(null);
  const [meta, setMeta] = useState<PrevisaoMeta>({ motivo: null, local: null, carregando: false });
  const [equipe, setEquipe] = useState<EquipeLite[]>([]);

  const hoje = HOJE();

  // ── Boot: sessão + probe da tabela + eventos + catálogos ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const probe = await sb.from('plano_contingencia').select('id', { head: true, count: 'exact' }).limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      // Nome da empresa (p/ {empresa} nos comunicados) — defensivo.
      let nomeEmpresa = '';
      try {
        const { data: u } = await sb.from('usuarios').select('nome').eq('id', uid).maybeSingle();
        nomeEmpresa = u?.nome || '';
      } catch { /* opcional */ }
      try {
        const { data: cfg } = await sb.from('empresa_config').select('*').eq('usuario_id', uid).maybeSingle();
        nomeEmpresa = cfg?.nome_empresa || cfg?.nome || cfg?.razao_social || nomeEmpresa;
      } catch { /* opcional */ }
      setEmpresa(nomeEmpresa);

      const evRes = await sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid)
        .order('data_inicio', { ascending: false, nullsFirst: false });
      const evs = (evRes.data || []).map(mapEvento) as EventoLite[];
      setEventos(evs);

      const eqRes = await sb.from('equipe').select('id,nome,cargo').eq('usuario_id', uid).order('nome');
      setEquipe(eqRes.error ? [] : (eqRes.data || []).map(mapEquipe));

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      const ev = url.get('evento');
      const inicial = (ev && evs.some((e) => e.id === ev)) ? ev : evs[0]?.id || null;
      setLoading(false);
      if (inicial) await selecionarEvento(inicial, uid, evs);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seleciona evento: propriedade + planos + snapshot (auto-busca se possível) ──
  const selecionarEvento = useCallback(async (evId: string, uid: string, lista?: EventoLite[]) => {
    setCarregandoEvento(true);
    setEventoId(evId);
    setResumo(null);
    const ev = (lista || eventos).find((e) => e.id === evId) || null;
    try {
      // Propriedade (coordenadas + local).
      let prop: PropriedadeLite | null = null;
      if (ev?.propriedade_id != null) {
        const pRes = await sb.from('propriedades').select(SEL_PROP).eq('id', ev.propriedade_id).maybeSingle();
        prop = pRes.error || !pRes.data ? null : mapProp(pRes.data);
      }
      setPropriedade(prop);
      const local = prop ? [prop.nome, prop.cidade, prop.estado].filter(Boolean).join(' · ') || null : null;

      // Planos do evento.
      const plRes = await sb.from('plano_contingencia').select(SEL_PLANO).eq('usuario_id', uid).eq('evento_id', evId).order('ordem');
      setPlanos(plRes.error ? [] : (plRes.data || []).map(mapPlano));

      // Snapshot de previsão (cache).
      const snap = await lerSnapshot(evId);
      if (!snap.error && snap.data) {
        setResumo(mapSnapshot(snap.data));
        setMeta({ motivo: null, local, carregando: false });
      } else {
        // Sem cache: decide se dá p/ buscar automaticamente ou degrada.
        const dia = diaDe(ev?.data_inicio);
        let motivo: PrevisaoMotivo = null;
        if (!dia) motivo = 'sem_data';
        else if (!prop || prop.latitude == null || prop.longitude == null) motivo = 'sem_coordenadas';
        else if (!previsaoDisponivel(dia, HOJE())) motivo = 'fora_do_horizonte';
        if (motivo) {
          setMeta({ motivo, local, carregando: false });
        } else {
          setMeta({ motivo: null, local, carregando: true });
          const r = await buscarPrevisao(evId);
          setResumo(r.resumo);
          setMeta({ motivo: r.motivo, local: r.local || local, carregando: false });
        }
      }
    } finally {
      setCarregandoEvento(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos]);

  const recarregarPlanos = useCallback(async () => {
    if (!userId || !eventoId) return;
    const plRes = await sb.from('plano_contingencia').select(SEL_PLANO).eq('usuario_id', userId).eq('evento_id', eventoId).order('ordem');
    if (!plRes.error) setPlanos((plRes.data || []).map(mapPlano));
  }, [userId, eventoId]);

  const atualizarPrevisao = useCallback(async () => {
    if (!eventoId) return;
    setMeta((m) => ({ ...m, carregando: true }));
    const r = await buscarPrevisao(eventoId);
    setMeta((m) => ({ motivo: r.motivo, local: r.local || m.local, carregando: false }));
    if (r.resumo) { setResumo(r.resumo); toast.success('Previsão atualizada.'); }
    else if (r.motivo === 'falha_api') toast.error('Serviço de meteorologia indisponível. Tente novamente ou use a entrada manual.');
    else if (r.motivo === 'sem_coordenadas') toast.info('Propriedade sem coordenadas — informe a previsão manualmente.');
    else if (r.motivo === 'fora_do_horizonte') toast.info('Previsão disponível mais perto da data do evento.');
  }, [eventoId, toast]);

  const salvarManual = useCallback(async (novo: ClimaResumo): Promise<boolean> => {
    if (!userId || !eventoId) return false;
    const { error } = await salvarSnapshotManual(userId, eventoId, novo);
    if (error) return false;
    setResumo(novo);
    setMeta((m) => ({ ...m, motivo: null }));
    return true;
  }, [userId, eventoId]);

  const eventoAtual = useMemo(() => eventos.find((e) => e.id === eventoId) || null, [eventos, eventoId]);

  const bag = useMemo<PlanoBBag | null>(() => {
    if (!userId || !eventoAtual) return null;
    return {
      userId, hoje, empresa, evento: eventoAtual, propriedade, planos, resumo, meta, equipe,
      recarregarPlanos, atualizarPrevisao, salvarManual,
    };
  }, [userId, hoje, empresa, eventoAtual, propriedade, planos, resumo, meta, equipe, recarregarPlanos, atualizarPrevisao, salvarManual]);

  // Avaliação geral (semáforo) do evento.
  const avals = useMemo(() => avaliarPlanos(planos, resumo), [planos, resumo]);
  const nivel = useMemo(() => nivelGeral(avals), [avals]);
  const disparados = useMemo(() => avaliacoesDisparadas(avals), [avals]);

  const onTrocarEvento = (id: string) => {
    if (!userId || id === eventoId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('evento', id);
    window.history.replaceState(null, '', url.toString());
    selecionarEvento(id, userId);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Clima & Plano B</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : eventos.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IcoCalendar />} title="Nenhum evento para monitorar ainda"
            cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
            O Plano B parte de um evento ao ar livre. Cadastre um lead/evento em <strong>Clientes</strong> ou <strong>Leads</strong> (com data e propriedade) e ele aparece aqui para receber previsão, gatilhos e contingência.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Seletor de evento */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
            <div className="min-w-0 flex-1">
              <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
              <select value={eventoId || ''} onChange={(e) => onTrocarEvento(e.target.value)}
                className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
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

          {/* Banner de risco (semáforo do evento) */}
          <RiscoBanner nivel={nivel} disparados={disparados} resumo={resumo} carregando={meta.carregando} temPlanos={planos.length > 0} />

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
                <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
              </div>
            ) : (
              <>
                {tab === 'previsao' && <Forecast bag={bag} />}
                {tab === 'planos' && <Planos bag={bag} />}
                {tab === 'contingencia' && <Contingencia bag={bag} onIrPlanos={() => setTab('planos')} />}
                {tab === 'comunicacao' && <Comunicacao bag={bag} onIrPlanos={() => setTab('planos')} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Banner de risco do evento (verde/amarelo/vermelho) ────────────────────────
function RiscoBanner({ nivel, disparados, resumo, carregando, temPlanos }: {
  nivel: ReturnType<typeof nivelGeral>;
  disparados: ReturnType<typeof avaliacoesDisparadas>;
  resumo: ClimaResumo | null;
  carregando: boolean;
  temPlanos: boolean;
}) {
  const nm = nivelMeta(nivel);
  const cond = condicaoDe(resumo?.codigo ?? null);
  const headline = resumo
    ? [
        resumo.chuva_prob != null ? `chuva ${Math.round(resumo.chuva_prob)}%` : null,
        resumo.vento != null ? `vento ${Math.round(resumo.vento)} km/h` : null,
        resumo.temp_max != null ? `${Math.round(resumo.temp_max)}°` : null,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${nm.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${nm.dot} text-white`}>
            {nivel === 'vermelho' ? <IcoAlert /> : nivel === 'amarelo' ? <IcoWind /> : <CondIcon icone={cond.icone} size={22} />}
          </span>
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-ink">
              {carregando ? 'Avaliando…' : nm.label}
              {resumo && <span className="text-sm font-normal text-ink-muted">· {cond.label}</span>}
            </div>
            <div className="mt-0.5 text-[0.78rem] text-ink-muted">
              {!temPlanos
                ? 'Defina gatilhos em Gatilhos & Planos para ativar o semáforo de risco.'
                : nivel === 'sem_dados'
                  ? 'Sem previsão para avaliar os gatilhos — atualize ou informe manualmente.'
                  : headline || 'Previsão carregada.'}
            </div>
          </div>
        </div>
        {disparados.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {disparados.slice(0, 3).map((a) => {
              const m = nivelMeta(a.nivel);
              return (
                <span key={a.plano.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.chip}`}>
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} /> {riscoMeta(a.plano.tipo_risco).label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Empty-state quando as tabelas de Plano B ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoCloud /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Clima & Plano B</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/plano-b.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">plano_contingencia</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">clima_snapshots</code> e liberar previsão por evento, gatilhos de contingência e comunicados.
      </p>
    </div>
  );
}
