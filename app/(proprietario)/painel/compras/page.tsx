'use client';

// Compras — /painel/compras.
// Processo completo de suprimentos: requisição → cotação → pedido → recebimento
// → financeiro. Aprovação por alçada, mapa comparativo entre fornecedores,
// pedido em PDF, conferência de recebimento que gera conta a pagar (e tenta dar
// entrada no estoque). Rastro requisição→pedido→recebimento→pagamento.
// PILARES (abas): Painel · Requisições · Cotações · Pedidos · Recebimentos.
// Fonte: requisicoes(+itens), cotacoes(+itens), pedidos_compra, recebimentos,
// fornecedores, clientes_eventos, centros_custo. Sem "R$" hardcoded — lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type Requisicao, type RequisicaoItem, type Cotacao, type CotacaoItem, type Pedido, type Recebimento,
  type FornecedorLite, type EventoLite, type CentroCustoLite, type ComprasBag, type Aba,
  mapRequisicao, mapReqItem, mapCotacao, mapCotacaoItem, mapPedido, mapRecebimento,
  isMissingTable, getAlcada, setAlcada as persistAlcada,
} from './_lib';
import { IcoCart, IcoDoc, IcoCompare, IcoTruck, IcoInbox } from './_components/ui';
import { SetupCard } from '@/components/ui/Estados';
import Painel from './_components/Painel';
import Requisicoes from './_components/Requisicoes';
import Cotacoes from './_components/Cotacoes';
import Pedidos from './_components/Pedidos';
import Recebimentos from './_components/Recebimentos';

const ABAS: { v: Aba; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { v: 'painel', label: 'Painel', icon: IcoCart },
  { v: 'requisicoes', label: 'Requisições', icon: IcoDoc },
  { v: 'cotacoes', label: 'Cotações', icon: IcoCompare },
  { v: 'pedidos', label: 'Pedidos', icon: IcoTruck },
  { v: 'recebimentos', label: 'Recebimentos', icon: IcoInbox },
];

export default function ComprasPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('painel');

  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [reqItens, setReqItens] = useState<RequisicaoItem[]>([]);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [cotacaoItens, setCotacaoItens] = useState<CotacaoItem[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoLite[]>([]);
  const [alcada, setAlcadaState] = useState(0);

  const carregar = useCallback(async (uid: string) => {
    // A tabela-raiz define needsSetup; as demais degradam para vazio.
    const reqRes = await sb.from('requisicoes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false });
    if (reqRes.error && isMissingTable(reqRes.error)) { setNeedsSetup(true); return; }
    setNeedsSetup(false);
    setRequisicoes(((reqRes.data || []) as unknown[]).map(mapRequisicao));

    const [riRes, cotRes, ciRes, pedRes, recRes] = await Promise.all([
      sb.from('requisicao_itens').select('*').eq('usuario_id', uid),
      sb.from('cotacoes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('cotacao_itens').select('*').eq('usuario_id', uid),
      sb.from('pedidos_compra').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('recebimentos').select('*').eq('usuario_id', uid).order('data', { ascending: false }),
    ]);
    setReqItens(riRes.error ? [] : ((riRes.data || []) as unknown[]).map(mapReqItem));
    setCotacoes(cotRes.error ? [] : ((cotRes.data || []) as unknown[]).map(mapCotacao));
    setCotacaoItens(ciRes.error ? [] : ((ciRes.data || []) as unknown[]).map(mapCotacaoItem));
    setPedidos(pedRes.error ? [] : ((pedRes.data || []) as unknown[]).map(mapPedido));
    setRecebimentos(recRes.error ? [] : ((recRes.data || []) as unknown[]).map(mapRecebimento));

    // Tabelas-âncora (opcionais): fornecedores, eventos, centros de custo.
    const [fRes, eRes, ccRes] = await Promise.all([
      sb.from('fornecedores').select('id,nome,fantasia,categoria,whatsapp,email,condicoes_pagamento,prazo_entrega_dias').eq('usuario_id', uid).eq('ativo', true),
      sb.from('clientes_eventos').select('id,nome_evento,tipo_evento,data_inicio').eq('usuario_id', uid).order('data_inicio', { ascending: false }).limit(500),
      sb.from('centros_custo').select('id,nome').eq('usuario_id', uid),
    ]);
    setFornecedores(fRes.error ? [] : ((fRes.data || []) as FornecedorLite[]));
    setEventos(eRes.error ? [] : ((eRes.data || []) as EventoLite[]));
    setCentrosCusto(ccRes.error ? [] : ((ccRes.data || []) as CentroCustoLite[]));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      setAlcadaState(getAlcada(session.user.id));
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);
  const setAlcadaLocal = useCallback((n: number) => {
    if (!userId) return;
    persistAlcada(userId, n);
    setAlcadaState(Math.max(0, n || 0));
  }, [userId]);

  const bag = useMemo<ComprasBag | null>(() => userId ? {
    userId, requisicoes, reqItens, cotacoes, cotacaoItens, pedidos, recebimentos,
    fornecedores, eventos, centrosCusto, alcada, setAlcadaLocal, recarregar,
  } : null, [userId, requisicoes, reqItens, cotacoes, cotacaoItens, pedidos, recebimentos, fornecedores, eventos, centrosCusto, alcada, setAlcadaLocal, recarregar]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Compras</h1>
          <p className="mt-1 text-sm text-ink-muted">Requisição → cotação → pedido → recebimento → financeiro, com aprovação por alçada e comparação entre fornecedores.</p>
        </div>
      </div>

      {needsSetup && <SetupCard sql="compras.sql">O módulo de Compras ainda não foi criado.</SetupCard>}

      {!needsSetup && bag && (
        <>
          {/* Abas */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {ABAS.map(({ v, label, icon: Ic }) => (
              <button
                key={v}
                onClick={() => setAba(v)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  aba === v ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'
                }`}
              >
                <Ic size={15} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {aba === 'painel' && <Painel bag={bag} onIr={setAba} />}
            {aba === 'requisicoes' && <Requisicoes bag={bag} />}
            {aba === 'cotacoes' && <Cotacoes bag={bag} />}
            {aba === 'pedidos' && <Pedidos bag={bag} />}
            {aba === 'recebimentos' && <Recebimentos bag={bag} />}
          </div>
        </>
      )}
    </div>
  );
}
