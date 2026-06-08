'use client';

// Aba "Painel" — visão executiva de Compras: gasto por categoria/evento/
// fornecedor, economia obtida (estimado × comprado), lead time médio e o funil
// do processo (requisição → cotação → pedido → recebimento) com atalhos.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatPercent } from '@/lib/format';
import {
  type ComprasBag, type Aba,
  CATEGORIAS, catLabel, catCor, fornNomeDe, calcularEconomia, mediaLeadTime,
} from '../_lib';
import { Kpi, Donut, Empty, IcoCart, IcoWallet, IcoTrend, IcoClock, IcoTruck, IcoCompare, IcoDoc, IcoInbox, IcoArrow } from './ui';

export default function Painel({ bag, onIr }: { bag: ComprasBag; onIr: (aba: Aba) => void }) {
  const { requisicoes, cotacoes, pedidos, recebimentos, fornecedores, eventos } = bag;

  const reqById = useMemo(() => new Map(requisicoes.map((r) => [r.id, r])), [requisicoes]);
  const fornById = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const eventoNome = useMemo(() => new Map(eventos.map((e) => [e.id, e.nome_evento || e.tipo_evento || 'Evento'])), [eventos]);
  const pedidosValidos = useMemo(() => pedidos.filter((p) => p.status !== 'cancelado'), [pedidos]);

  // ── KPIs principais ──
  const kpis = useMemo(() => {
    const comprado = pedidosValidos.reduce((s, p) => s + p.valor_total, 0);
    const reqsComPedido = new Set(pedidosValidos.map((p) => p.requisicao_id).filter(Boolean) as string[]);
    const estimado = [...reqsComPedido].reduce((s, id) => s + (reqById.get(id)?.valor_estimado || 0), 0);
    const eco = calcularEconomia(estimado, comprado);
    const lead = mediaLeadTime(recebimentos.map((r) => ({ inicio: (pedidos.find((p) => p.id === r.pedido_id)?.criado_em || '').slice(0, 10), fim: r.data })));
    const pendentes = pedidosValidos.filter((p) => p.status === 'emitido' || p.status === 'parcial').length;
    return { comprado, eco, lead, pendentes };
  }, [pedidosValidos, reqById, recebimentos, pedidos]);

  // ── Funil do processo ──
  const funil = useMemo(() => ({
    requisicoes: requisicoes.filter((r) => r.status === 'aberta').length,
    cotacoes: requisicoes.filter((r) => r.status === 'em_cotacao').length,
    pedidos: pedidosValidos.filter((p) => p.status === 'emitido' || p.status === 'parcial').length,
    recebimentos: recebimentos.length,
  }), [requisicoes, pedidosValidos, recebimentos]);

  // ── Gasto por categoria (do fornecedor) ──
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pedidosValidos) {
      const cat = fornById.get(p.fornecedor_id || '')?.categoria || 'outro';
      m.set(cat, (m.get(cat) || 0) + p.valor_total);
    }
    return CATEGORIAS.map((c) => ({ label: c.label, value: m.get(c.v) || 0, cor: c.cor })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }, [pedidosValidos, fornById]);

  // ── Gasto por fornecedor (top) ──
  const porFornecedor = useMemo(() => {
    const m = new Map<string, { nome: string; cat: string; total: number; n: number }>();
    for (const p of pedidosValidos) {
      const key = p.fornecedor_id || `snap:${p.fornecedor_nome}`;
      const nome = fornNomeDe(fornById.get(p.fornecedor_id || '')) || p.fornecedor_nome || 'Fornecedor';
      const cat = fornById.get(p.fornecedor_id || '')?.categoria || 'outro';
      const e = m.get(key) || { nome, cat, total: 0, n: 0 };
      e.total += p.valor_total; e.n++; m.set(key, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [pedidosValidos, fornById]);

  // ── Gasto por evento (top) ──
  const porEvento = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pedidosValidos) {
      const evId = p.requisicao_id ? reqById.get(p.requisicao_id)?.evento_id : null;
      if (!evId) continue;
      m.set(evId, (m.get(evId) || 0) + p.valor_total);
    }
    return [...m.entries()].map(([id, total]) => ({ nome: eventoNome.get(id) || 'Evento', total })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [pedidosValidos, reqById, eventoNome]);

  const totalForn = porFornecedor.reduce((s, f) => s + f.total, 0) || 1;
  const maxEvento = porEvento[0]?.total || 1;

  const semDados = requisicoes.length === 0 && pedidos.length === 0;

  return (
    <div>
      {/* Funil do processo (atalhos) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FunilCard icon={<IcoDoc />} label="Requisições abertas" value={funil.requisicoes} onClick={() => onIr('requisicoes')} />
        <FunilCard icon={<IcoCompare />} label="Em cotação" value={funil.cotacoes} onClick={() => onIr('cotacoes')} />
        <FunilCard icon={<IcoTruck />} label="Pedidos abertos" value={funil.pedidos} onClick={() => onIr('pedidos')} />
        <FunilCard icon={<IcoInbox />} label="Recebimentos" value={funil.recebimentos} onClick={() => onIr('recebimentos')} />
      </div>

      {semDados ? (
        <div className="mt-5">
          <Empty
            icon={<IcoCart size={30} />}
            title="Seu processo de compras começa aqui"
            action={<button onClick={() => onIr('requisicoes')} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><IcoArrow /> Criar primeira requisição</button>}
          >
            Crie uma requisição, cote entre fornecedores, emita o pedido e dê entrada no recebimento — que gera a conta a pagar e atualiza o estoque. Tudo rastreado de ponta a ponta.
          </Empty>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Comprado" value={formatMoneyShort(kpis.comprado)} sub="em pedidos" tone="roxo" icon={<IcoWallet />} />
            <Kpi
              label="Economia obtida"
              value={kpis.eco.valor >= 0 ? formatMoneyShort(kpis.eco.valor) : `-${formatMoneyShort(Math.abs(kpis.eco.valor))}`}
              sub={kpis.eco.valor >= 0 ? `${formatPercent(kpis.eco.pct)} vs. estimado` : `${formatPercent(Math.abs(kpis.eco.pct))} acima do estimado`}
              tone={kpis.eco.valor >= 0 ? 'verde' : 'vermelho'} icon={<IcoTrend />}
            />
            <Kpi label="Lead time médio" value={kpis.lead != null ? `${kpis.lead} d` : '—'} sub="pedido → recebimento" tone="azul" icon={<IcoClock />} />
            <Kpi label="Pedidos pendentes" value={String(kpis.pendentes)} sub="a receber" tone={kpis.pendentes ? 'gold' : 'ink'} icon={<IcoTruck />} />
          </div>

          {/* Categoria + Fornecedores */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Gasto por categoria</h3>
              {porCategoria.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-center"><p className="text-sm text-ink-muted">Emita pedidos para ver a distribuição.</p></div>
              ) : <Donut data={porCategoria} money={(n) => formatMoneyShort(n)} />}
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Top fornecedores por gasto</h3>
              {porFornecedor.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">Sem pedidos ainda.</p>
              ) : (
                <div className="space-y-2.5">
                  {porFornecedor.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: catCor(f.cat) }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{f.nome}</span>
                          <span className="shrink-0 text-sm font-bold text-ink">{formatMoney(f.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(4, (f.total / totalForn) * 100)}%`, background: catCor(f.cat) }} />
                        </div>
                        <div className="mt-0.5 text-[0.66rem] text-ink-muted">{catLabel(f.cat)} · {f.n} pedido(s)</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gasto por evento */}
          {porEvento.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Gasto por evento</h3>
              <div className="space-y-2.5">
                {porEvento.map((e, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{e.nome}</span>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-black/[0.05] sm:w-56">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (e.total / maxEvento) * 100)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-bold text-ink">{formatMoney(e.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cotações pendentes de escolha */}
          {(() => {
            const semEscolha = requisicoes.filter((r) => r.status === 'em_cotacao' && cotacoes.some((c) => c.requisicao_id === r.id) && !cotacoes.some((c) => c.requisicao_id === r.id && c.escolhida));
            if (semEscolha.length === 0) return null;
            return (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-sm text-violet-800"><strong>{semEscolha.length}</strong> requisição(ões) com cotações aguardando escolha do vencedor.</p>
                <button onClick={() => onIr('cotacoes')} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"><IcoCompare /> Comparar cotações</button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function FunilCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition hover:ring-2 hover:ring-brand/20">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">{icon}</span>
      <div className="min-w-0">
        <div className="text-xl font-bold text-ink">{value}</div>
        <div className="truncate text-[0.7rem] text-ink-muted">{label}</div>
      </div>
    </button>
  );
}
