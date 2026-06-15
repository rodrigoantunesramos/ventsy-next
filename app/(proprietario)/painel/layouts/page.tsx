'use client';

// Layouts, Plantas & Capacidade — /painel/layouts.
// Documenta e planeja o uso FÍSICO do espaço em três frentes (abas):
//   • Biblioteca — plantas/arranjos salvos por espaço, com capacidade por setup
//     e uma calculadora "mesma sala em vários arranjos".
//   • Editor — canvas SVG: arrasta mesas/palco/bar/estandes, gera arranjo por
//     setup e calcula a capacidade ao vivo (lugares × área × autorizada).
//   • Mapa de mesas — por evento: aplica um layout, aloca convidados, exporta
//     para a recepção e PUBLICA a capacidade no Acesso (lotação).
//
// Fontes: `layouts`, `evento_layout` (docs/sql/layouts.sql), além de
// `propriedades`/`espacos` (espaço físico) e `clientes_eventos` (o evento). A
// capacidade/arranjo/ocupação vêm do motor puro lib/layouts.ts; o "aplicar ao
// evento" e o "publicar no Acesso" passam pela rota AUTORITATIVA /api/layouts; o
// CRUD de layouts e a edição do mapa são via RLS. Degrada para um setup-card até
// o SQL ser aplicado. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type Layout, type PropLite, type EspacoLite, type EventoLite,
  SEL_LAYOUT, SEL_EVENTO, CANVAS_PADRAO,
  mapLayout, mapProp, mapEspaco, mapEvento, isMissingTable,
} from './_lib';
import {
  EmptyState, btnPrimary, IcoLayout, IcoTable, IcoMap,
} from './_components/ui';
import Biblioteca from './_components/Biblioteca';
import Editor from './_components/Editor';
import MapaMesas from './_components/MapaMesas';

type Tab = 'biblioteca' | 'editor' | 'mapa';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'biblioteca', label: 'Biblioteca', icon: IcoLayout },
  { v: 'editor', label: 'Editor', icon: IcoTable },
  { v: 'mapa', label: 'Mapa de mesas', icon: IcoMap },
];
const SUBTITULO: Record<Tab, string> = {
  biblioteca: 'Plantas e arranjos por espaço, com capacidade por setup. A mesma sala rende públicos diferentes.',
  editor: 'Desenhe o arranjo no canvas: arraste os elementos e veja a capacidade e a densidade ao vivo.',
  mapa: 'Aloque os convidados do evento nas mesas, exporte para a recepção e publique a lotação no Acesso.',
};

function layoutNovo(propId: number | null): Layout {
  return {
    id: '', propriedade_id: propId, espaco_id: null, nome: '', tipo_setup: 'banquete',
    capacidade: null, area_m2: null, planta_url: null,
    planta: { largura: CANVAS_PADRAO.largura, altura: CANVAS_PADRAO.altura, itens: [] }, obs: null,
  };
}

export default function LayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('biblioteca');

  const [propriedades, setPropriedades] = useState<PropLite[]>([]);
  const [espacos, setEspacos] = useState<EspacoLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);

  const [layoutAtivo, setLayoutAtivo] = useState<Layout | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [eventoInicial, setEventoInicial] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Probe: a tabela-âncora `layouts` existe? Usamos um select normal (com
      // corpo de resposta) — o `head:true` não traz corpo de erro e mascara o
      // PGRST205 de tabela inexistente, deixando o setup-card só aparecer no 1º
      // write. Este probe detecta de cara.
      const probe = await sb.from('layouts').select('id').limit(1);
      if (probe.error && isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      const [lyRes, prRes, esRes, evRes] = await Promise.all([
        sb.from('layouts').select(SEL_LAYOUT).eq('usuario_id', uid).order('atualizado_em', { ascending: false }),
        sb.from('propriedades').select('id,nome,cidade').eq('usuario_id', uid).order('id'),
        sb.from('espacos').select('id,propriedade_id,nome,tipo,capacidade,area_m2').eq('usuario_id', uid).order('ordem'),
        sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
      ]);
      setLayouts(lyRes.error ? [] : (lyRes.data || []).map(mapLayout));
      setPropriedades(prRes.error ? [] : (prRes.data || []).map(mapProp));
      setEspacos(esRes.error ? [] : (esRes.data || []).map(mapEspaco));
      setEventos(evRes.error ? [] : (evRes.data || []).map(mapEvento));

      const url = new URLSearchParams(window.location.search);
      const t = url.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      setEventoInicial(url.get('evento'));
      setLoading(false);
    })();
  }, []);

  const propIdPadrao = useMemo(() => propriedades[0]?.id ?? null, [propriedades]);

  const novoLayout = useCallback(() => {
    setLayoutAtivo(layoutNovo(propIdPadrao));
    setEditorKey((k) => k + 1);
    setTab('editor');
  }, [propIdPadrao]);

  const editarLayout = useCallback((l: Layout) => {
    setLayoutAtivo(l);
    setEditorKey((k) => k + 1);
    setTab('editor');
  }, []);

  const onSaved = useCallback((l: Layout) => {
    setLayouts((list) => {
      const i = list.findIndex((x) => x.id === l.id);
      if (i === -1) return [l, ...list];
      const copy = [...list]; copy[i] = l; return copy;
    });
    setLayoutAtivo(l);
  }, []);

  const onExcluido = useCallback((id: string) => {
    setLayouts((list) => list.filter((x) => x.id !== id));
    setLayoutAtivo((cur) => (cur && cur.id === id ? null : cur));
  }, []);

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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Layouts, Plantas & Capacidade</h1>
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
            {tab === 'biblioteca' && (
              <Biblioteca
                propriedades={propriedades} espacos={espacos} layouts={layouts}
                onNovo={novoLayout} onEditar={editarLayout} onExcluido={onExcluido}
              />
            )}
            {tab === 'editor' && userId && (
              layoutAtivo ? (
                <Editor
                  key={`ed-${editorKey}`}
                  userId={userId} propriedades={propriedades} espacos={espacos}
                  layout={layoutAtivo} onSaved={onSaved} onVoltar={() => setTab('biblioteca')}
                  onSetupMissing={() => setNeedsSetup(true)}
                />
              ) : (
                <EmptyState icon={<IcoTable />} title="Nenhum layout aberto" cta={<button onClick={novoLayout} className={btnPrimary}>Novo layout</button>}>
                  Crie um layout novo ou escolha um da <strong>Biblioteca</strong> para editar no canvas.
                </EmptyState>
              )
            )}
            {tab === 'mapa' && userId && (
              <MapaMesas
                userId={userId} eventos={eventos} layouts={layouts} propriedades={propriedades}
                initialEventoId={eventoInicial} onSetupMissing={() => setNeedsSetup(true)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de Layouts ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoLayout /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Layouts</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/layouts.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">layouts</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">evento_layout</code> e liberar a biblioteca de plantas, o editor de canvas e o mapa de mesas.
      </p>
    </div>
  );
}
