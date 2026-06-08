'use client';

// Catering, Buffet & Bar — /painel/catering.
// Gestão de alimentos & bebidas do evento: cardápios/pacotes com FICHA TÉCNICA
// (insumos → Estoque), dimensionamento por nº de convidados (gera requisição em
// Compras), restrições dos convidados, bar (open bar × consumação × cash bar) e
// o custo/CMV por prato/pessoa/evento com comparativo PREVISTO × REAL (o real vem
// do consumo baixado no Estoque). Quatro abas: Cardápios (global) · A&B do evento
// · Bar · Custo (CMV).
//
// Fontes: `cardapios`, `catering_evento`, `bar_evento` (docs/sql/catering.sql),
// além de `clientes_eventos` (evento) e `produtos` (Estoque — ficha técnica). O
// ensure 1:1, a requisição (Compras) e a baixa de consumo (Estoque) passam pela
// rota AUTORITATIVA /api/catering; o motor de custo/dimensionamento/CMV é o puro
// lib/catering.ts. Degrada para um setup-card até o SQL ser aplicado. i18n via
// lib/format; toast pelo ToastProvider do layout. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoLite, type Cardapio, type ProdutoLite, type CateringEvento, type BarEvento, type EventoBag,
  SEL_CARDAPIO, SEL_CAT, SEL_BAR, SEL_EVENTO, SEL_PRODUTO,
  mapCardapioRow, mapProduto, mapCateringEvento, mapBarEvento, isMissingTable, ensureCatering, eventoLabel, convidadosDoEvento,
} from './_lib';
import { IcoUtensils, IcoUsers, IcoWine, IcoChart, IcoCalendar, EmptyState, btnPrimary } from './_components/ui';
import Cardapios from './_components/Cardapios';
import AeBEvento from './_components/AeBEvento';
import Bar from './_components/Bar';
import Custo from './_components/Custo';

type Tab = 'cardapios' | 'aeb' | 'bar' | 'custo';
const TABS: { v: Tab; label: string; icon: () => JSX.Element; evento: boolean }[] = [
  { v: 'cardapios', label: 'Cardápios', icon: IcoUtensils, evento: false },
  { v: 'aeb', label: 'A&B do evento', icon: IcoUsers, evento: true },
  { v: 'bar', label: 'Bar', icon: IcoWine, evento: true },
  { v: 'custo', label: 'Custo (CMV)', icon: IcoChart, evento: true },
];
const SUBTITULO: Record<Tab, string> = {
  cardapios: 'Biblioteca de cardápios e pacotes com ficha técnica e custo por pessoa.',
  aeb: 'Dimensione o A&B por convidados, gere a requisição de compras e cheque as restrições.',
  bar: 'Open bar, consumação ou cash bar: cardápio de drinks, consumo e perdas.',
  custo: 'CMV de A&B por evento e por pessoa, food cost e previsto × real (consumo do Estoque).',
};

export default function CateringPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('cardapios');

  const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [produtos, setProdutos] = useState<ProdutoLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);

  const [eventoId, setEventoId] = useState<string | null>(null);
  const [carregandoEvento, setCarregandoEvento] = useState(false);
  const [catering, setCatering] = useState<CateringEvento | null>(null);
  const [bar, setBar] = useState<BarEvento | null>(null);

  // ── Boot: sessão + probe `cardapios` + catálogos globais ──
  const recarregarCardapios = useCallback(async (uid: string) => {
    const cRes = await sb.from('cardapios').select(SEL_CARDAPIO).eq('usuario_id', uid).order('nome');
    setCardapios(cRes.error ? [] : (cRes.data || []).map(mapCardapioRow));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      const probe = await sb.from('cardapios').select('id', { head: true, count: 'exact' }).limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const [cRes, pRes, eRes] = await Promise.all([
        sb.from('cardapios').select(SEL_CARDAPIO).eq('usuario_id', uid).order('nome'),
        sb.from('produtos').select(SEL_PRODUTO).eq('usuario_id', uid).order('nome'),
        sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
      ]);
      setCardapios(cRes.error ? [] : (cRes.data || []).map(mapCardapioRow));
      setProdutos(pRes.error ? [] : (pRes.data || []).map(mapProduto));
      setEventos(eRes.error ? [] : (eRes.data || []) as EventoLite[]);

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      const ev = url.get('evento');
      const evs = (eRes.data || []) as EventoLite[];
      if (ev && evs.some((e) => e.id === ev)) setEventoId(ev);
      else if (evs.length) setEventoId(evs[0].id);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Seleciona um evento: ensure catering_evento + bar_evento (1:1) ──
  const selecionarEvento = useCallback(async (evId: string, uid: string) => {
    setCarregandoEvento(true);
    try {
      const r = await ensureCatering(evId);
      if (!r.ok) {
        // O probe de boot já trata "tabela ausente" (needsSetup); aqui é erro pontual.
        toast.error(r.error || 'Não foi possível abrir o A&B do evento.');
        setCatering(null); setBar(null);
        return;
      }
      setCatering(mapCateringEvento(r.data.catering));
      setBar(r.data.bar ? mapBarEvento(r.data.bar) : null);
    } finally {
      setCarregandoEvento(false);
    }
  }, [toast]);

  // Carrega o evento selecionado quando entra numa aba por evento.
  useEffect(() => {
    if (!userId || loading) return;
    const tabEvento = TABS.find((t) => t.v === tab)?.evento;
    if (tabEvento && eventoId && (!catering || catering.evento_id !== eventoId)) {
      selecionarEvento(eventoId, userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, eventoId, userId, loading]);

  // Recarrega só o evento atual (após CRUD via RLS), sem re-ensure.
  const recarregarEvento = useCallback(async () => {
    if (!userId || !eventoId) return;
    const [cRes, bRes] = await Promise.all([
      sb.from('catering_evento').select(SEL_CAT).eq('evento_id', eventoId).eq('usuario_id', userId).maybeSingle(),
      sb.from('bar_evento').select(SEL_BAR).eq('evento_id', eventoId).eq('usuario_id', userId).maybeSingle(),
    ]);
    if (!cRes.error && cRes.data) setCatering(mapCateringEvento(cRes.data));
    if (!bRes.error && bRes.data) setBar(mapBarEvento(bRes.data));
  }, [userId, eventoId]);

  const eventoAtual = useMemo(() => eventos.find((e) => e.id === eventoId) || null, [eventos, eventoId]);

  const bag = useMemo<EventoBag | null>(() => {
    if (!userId || !eventoAtual || !catering) return null;
    return { userId, evento: eventoAtual, catering, bar, cardapios, produtos, recarregar: recarregarEvento };
  }, [userId, eventoAtual, catering, bar, cardapios, produtos, recarregarEvento]);

  const onTrocarEvento = (id: string) => {
    if (!userId || id === eventoId) return;
    setEventoId(id);
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

  const tabAtual = TABS.find((t) => t.v === tab)!;

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Catering, Buffet & Bar</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{SUBTITULO[tab]}</p>
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
            {tab === 'cardapios' ? (
              userId && <Cardapios userId={userId} cardapios={cardapios} produtos={produtos} recarregar={() => recarregarCardapios(userId)} />
            ) : eventos.length === 0 ? (
              <EmptyState icon={<IcoCalendar />} title="Nenhum evento ainda"
                cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
                O A&B parte de um evento contratado. Cadastre um lead/evento em <strong>Clientes</strong> ou <strong>Leads</strong> e ele aparece aqui para dimensionar o catering.
              </EmptyState>
            ) : (
              <>
                {/* Seletor de evento */}
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
                  <div className="min-w-0 flex-1">
                    <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
                    <select value={eventoId || ''} onChange={(e) => onTrocarEvento(e.target.value)}
                      className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
                      {eventos.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}{convidadosDoEvento(ev) ? ` · ${convidadosDoEvento(ev)} conv.` : ''}
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

                {carregandoEvento || !bag ? (
                  <div className="space-y-3">
                    <div className="h-[120px] animate-pulse rounded-2xl bg-black/[0.05]" />
                    <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
                  </div>
                ) : (
                  <>
                    {tab === 'aeb' && <AeBEvento bag={bag} onIrCardapios={() => setTab('cardapios')} />}
                    {tab === 'bar' && <Bar bag={bag} />}
                    {tab === 'custo' && <Custo bag={bag} onIrCardapios={() => setTab('cardapios')} />}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Catering ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoUtensils /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Catering</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/catering.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">cardapios</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">catering_evento</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">bar_evento</code> e liberar cardápios, dimensionamento, bar e CMV por evento.
      </p>
    </div>
  );
}
