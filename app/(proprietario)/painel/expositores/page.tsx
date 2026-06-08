'use client';

// Expositores & Patrocínios — /painel/expositores.
// Monetiza feiras, exposições e festivais com marcas: venda de ESTANDES (mapa
// visual clicável, metragem, preço por ponto ou por m²) e COTAS DE PATROCÍNIO
// (Master/Ouro/Prata/Bronze/Apoio) com entregáveis e CHECKLIST de entrega.
// Tudo por EVENTO (clientes_eventos). Quatro abas: Mapa · Expositores ·
// Patrocínio · Receita.
//
// Fontes: `expo_mapa`, `expositores`, `patrocinio_cotas`, `patrocinadores`
// (docs/sql/expositores.sql). A engine de receita/%-vendido/entregáveis/
// transições vem do motor puro lib/expositores.ts; a COMERCIALIZAÇÃO do estande
// e a RECEITA no financeiro do evento passam pela rota AUTORITATIVA
// /api/expositores. Degrada para um setup-card até o SQL ser aplicado. Sem "R$"
// hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoLite, type ExpoBag, type Estande, type Expositor, type Cota, type Patrocinador,
  SEL_EVENTO, SEL_ESTANDE, SEL_EXPOSITOR, SEL_COTA, SEL_PATRO,
  mapEstande, mapExpositor, mapCota, mapPatrocinador,
  eventoLabel, isMissingTable, lerPrecoM2,
} from './_lib';
import { EmptyState, btnPrimary, IcoMap, IcoBuilding, IcoHandshake, IcoChart, IcoCalendar } from './_components/ui';
import MapaEstandes from './_components/MapaEstandes';
import Expositores from './_components/Expositores';
import Patrocinio from './_components/Patrocinio';
import Receita from './_components/Receita';

type Tab = 'mapa' | 'expositores' | 'patrocinio' | 'receita';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'mapa', label: 'Mapa de estandes', icon: IcoMap },
  { v: 'expositores', label: 'Expositores', icon: IcoBuilding },
  { v: 'patrocinio', label: 'Patrocínio', icon: IcoHandshake },
  { v: 'receita', label: 'Receita', icon: IcoChart },
];
const SUBTITULO: Record<Tab, string> = {
  mapa: 'Planta comercial da feira: clique para vender, reservar ou bloquear cada estande.',
  expositores: 'As marcas/empresas da feira: contrato, fatura, credencial e necessidades técnicas.',
  patrocinio: 'Cotas com entregáveis e o checklist de contrapartidas por patrocinador.',
  receita: 'Estandes + patrocínio do evento, com meta de comercialização e composição.',
};

export default function ExpositoresPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('mapa');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [carregandoEvento, setCarregandoEvento] = useState(false);

  const [estandes, setEstandes] = useState<Estande[]>([]);
  const [expositores, setExpositores] = useState<Expositor[]>([]);
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [patrocinadores, setPatrocinadores] = useState<Patrocinador[]>([]);
  const [precoM2, setPrecoM2] = useState(0);

  // ── Boot: sessão + probe da tabela `expo_mapa` + lista de eventos ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe SEM head:true — uma requisição HEAD não traz corpo, então o
      // supabase-js não consegue ler o código PGRST205 da tabela ausente (o
      // setup-card nunca apareceria). Um GET normal devolve o erro parseável.
      const probe = await sb.from('expo_mapa').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const evRes = await sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid)
        .order('data_inicio', { ascending: false, nullsFirst: false });
      const evs = (evRes.data || []) as EventoLite[];
      setEventos(evs);

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

  // Carrega todas as entidades do evento.
  const carregarEvento = useCallback(async (evId: string, uid: string) => {
    const [esRes, exRes, coRes, paRes] = await Promise.all([
      sb.from('expo_mapa').select(SEL_ESTANDE).eq('usuario_id', uid).eq('evento_id', evId).order('codigo'),
      sb.from('expositores').select(SEL_EXPOSITOR).eq('usuario_id', uid).eq('evento_id', evId).order('empresa'),
      sb.from('patrocinio_cotas').select(SEL_COTA).eq('usuario_id', uid).eq('evento_id', evId).order('ordem'),
      sb.from('patrocinadores').select(SEL_PATRO).eq('usuario_id', uid).eq('evento_id', evId).order('marca'),
    ]);
    // Rede de segurança: se a tabela-âncora sumiu, mostra o setup-card em vez de
    // uma página "vazia" que falharia em silêncio em toda escrita.
    if (esRes.error && isMissingTable(esRes.error)) { setNeedsSetup(true); return; }
    setEstandes(esRes.error ? [] : (esRes.data || []).map(mapEstande));
    setExpositores(exRes.error ? [] : (exRes.data || []).map(mapExpositor));
    setCotas(coRes.error ? [] : (coRes.data || []).map(mapCota));
    setPatrocinadores(paRes.error ? [] : (paRes.data || []).map(mapPatrocinador));
  }, []);

  const selecionarEvento = useCallback(async (evId: string, uid: string) => {
    setCarregandoEvento(true);
    setEventoId(evId);
    setPrecoM2(lerPrecoM2(evId));
    try {
      await carregarEvento(evId, uid);
    } catch {
      toast.error('Não foi possível carregar o evento.');
    } finally {
      setCarregandoEvento(false);
    }
  }, [carregarEvento, toast]);

  const recarregar = useCallback(async () => {
    if (!eventoId || !userId) return;
    await carregarEvento(eventoId, userId);
  }, [eventoId, userId, carregarEvento]);

  const eventoAtual = useMemo(() => eventos.find((e) => e.id === eventoId) || null, [eventos, eventoId]);

  const bag = useMemo<ExpoBag | null>(() => {
    if (!userId || !eventoAtual) return null;
    return { userId, evento: eventoAtual, estandes, expositores, cotas, patrocinadores, precoM2, setPrecoM2, recarregar };
  }, [userId, eventoAtual, estandes, expositores, cotas, patrocinadores, precoM2, recarregar]);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Expositores & Patrocínios</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
        </div>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : eventos.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IcoCalendar />} title="Nenhum evento para comercializar ainda"
            cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
            A comercialização parte de um evento (a feira/expo). Cadastre um evento em <strong>Clientes</strong> ou <strong>Leads</strong> e ele aparece aqui para vender estandes e cotas.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Seletor de evento */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
            <div className="min-w-0 flex-1">
              <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Feira / evento</label>
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
                {tab === 'mapa' && <MapaEstandes bag={bag} />}
                {tab === 'expositores' && <Expositores bag={bag} />}
                {tab === 'patrocinio' && <Patrocinio bag={bag} />}
                {tab === 'receita' && <Receita bag={bag} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Expositores ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoMap /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Expositores & Patrocínios</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/expositores.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">expo_mapa</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">expositores</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">patrocinio_cotas</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">patrocinadores</code> e liberar o mapa de estandes, cotas, entregáveis e a receita.
      </p>
    </div>
  );
}
