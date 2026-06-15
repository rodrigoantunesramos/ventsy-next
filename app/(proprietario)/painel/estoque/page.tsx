'use client';

// Estoque / Almoxarifado — /painel/estoque.
// Controle de insumos consumíveis (bebidas, alimentos, descartáveis, limpeza,
// papelaria, brindes): saldo em tempo real, mínimos (semáforo), lote/validade
// (FEFO) e baixa por consumo do evento. Cinco abas: Saldo · Movimentações ·
// Reposição · Validade · Inventário.
//
// Fontes: `produtos`, `estoque_mov`, `inventarios` (docs/sql/estoque.sql) e
// `clientes_eventos` (consumo por evento). Saldo e custo médio móvel são
// recalculados pela rota AUTORITATIVA /api/estoque (motor puro lib/estoque.ts).
// A página degrada para um setup-card até o SQL ser aplicado. i18n via
// lib/format; toast pelo ToastProvider do layout. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import type { MovTipo } from '@/lib/estoque';
import {
  type Produto, type EstoqueMov, type Inventario as Inv, type EventoLite,
  SEL_PRODUTO, SEL_MOV, SEL_INV, SEL_EVENTO, mapProduto, mapMov, mapInventario, isMissingTable,
} from './_lib';
import { IcoBox, IcoHistory, IcoCart, IcoLayers, IcoClipboard } from './_components/ui';
import Saldo from './_components/Saldo';
import Movimentacoes from './_components/Movimentacoes';
import Reposicao from './_components/Reposicao';
import Validade from './_components/Validade';
import Inventario from './_components/Inventario';
import MovModal from './_components/MovModal';

type Tab = 'saldo' | 'movimentacoes' | 'reposicao' | 'validade' | 'inventario';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'saldo', label: 'Saldo', icon: IcoBox },
  { v: 'movimentacoes', label: 'Movimentações', icon: IcoHistory },
  { v: 'reposicao', label: 'Reposição', icon: IcoCart },
  { v: 'validade', label: 'Validade', icon: IcoLayers },
  { v: 'inventario', label: 'Inventário', icon: IcoClipboard },
];

const SUBTITULO: Record<Tab, string> = {
  saldo: 'Saldo em tempo real, mínimos e valor do estoque a custo médio.',
  movimentacoes: 'Kardex de entradas, saídas, perdas, ajustes e consumo por evento.',
  reposicao: 'Itens no/abaixo do mínimo viram sugestão de compra.',
  validade: 'Lotes por vencimento (FEFO) e registro de perdas.',
  inventario: 'Contagem cíclica: contado × sistema, ajustes e acuracidade.',
};

export default function EstoquePage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<EstoqueMov[]>([]);
  const [inventarios, setInventarios] = useState<Inv[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [tab, setTab] = useState<Tab>('saldo');
  const [movModal, setMovModal] = useState<null | { produtoId?: string; tipo?: MovTipo }>(null);

  const carregar = useCallback(async (uid: string) => {
    const pRes = await sb.from('produtos').select(SEL_PRODUTO).eq('usuario_id', uid).order('nome');
    if (pRes.error) {
      if (isMissingTable(pRes.error)) { setNeedsSetup(true); setProdutos([]); setMovs([]); setInventarios([]); return; }
    } else {
      setNeedsSetup(false);
      setProdutos((pRes.data || []).map(mapProduto));
    }

    const [mRes, iRes, eRes] = await Promise.all([
      sb.from('estoque_mov').select(SEL_MOV).eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('inventarios').select(SEL_INV).eq('usuario_id', uid).order('data', { ascending: false }),
      sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }),
    ]);
    setMovs(mRes.error ? [] : (mRes.data || []).map(mapMov));
    setInventarios(iRes.error ? [] : (iRes.data || []).map(mapInventario));
    setEventos(eRes.error ? [] : (eRes.data || []) as EventoLite[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);
  const abrirMov = useCallback((opts?: { produtoId?: string; tipo?: MovTipo }) => setMovModal(opts || {}), []);

  const subtitulo = useMemo(() => SUBTITULO[tab], [tab]);

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
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Estoque / Almoxarifado</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitulo}</p>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5 border-b border-black/[0.06] pb-px">
            {TABS.map(({ v, label, icon: Ico }) => (
              <button key={v} onClick={() => setTab(v)}
                className={`inline-flex items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
                <Ico /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'saldo' && userId && <Saldo userId={userId} produtos={produtos} movs={movs} eventos={eventos} recarregar={recarregar} onMover={(id) => abrirMov({ produtoId: id })} />}
            {tab === 'movimentacoes' && <Movimentacoes produtos={produtos} movs={movs} eventos={eventos} recarregar={recarregar} onNovaMov={() => abrirMov()} />}
            {tab === 'reposicao' && <Reposicao produtos={produtos} onRepor={(id) => abrirMov({ produtoId: id, tipo: 'entrada' })} />}
            {tab === 'validade' && <Validade produtos={produtos} movs={movs} onPerda={(id) => abrirMov({ produtoId: id, tipo: 'perda' })} />}
            {tab === 'inventario' && userId && <Inventario userId={userId} produtos={produtos} inventarios={inventarios} recarregar={recarregar} />}
          </div>
        </>
      )}

      {movModal && userId && (
        <MovModal
          produtos={produtos}
          eventos={eventos}
          preselectProdutoId={movModal.produtoId}
          preselectTipo={movModal.tipo}
          onClose={() => setMovModal(null)}
          onDone={recarregar}
        />
      )}
    </div>
  );
}

// Empty-state quando as tabelas de estoque ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoBox /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Estoque</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/estoque.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">produtos</code>, <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">estoque_mov</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">inventarios</code> e liberar saldo, mínimos, validade e consumo por evento.
      </p>
    </div>
  );
}
