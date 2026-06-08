'use client';

// Aba "Reposição" — itens no/abaixo do mínimo viram sugestão de compra.
//   • Faltante (p/ atingir o mínimo) e Sugerido (repor até 2× o mínimo)
//   • Investimento estimado a custo médio
//   • Exporta a lista de compra (CSV) e prepara a Requisição em Compras (quando
//     o módulo existir — degrada graciosamente por ora)
//   • "Repor" abre uma entrada já no produto

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatNumber } from '@/lib/format';
import { sugerirReposicao, precisaRepor, statusMinimo } from '@/lib/estoque';
import { type Produto, catLabel, localLabel, exportCSV, ymd } from '../_lib';
import { Kpi, EmptyState, IcoCart, IcoAlert, IcoDownload, IcoCheck } from './ui';

export default function Reposicao({ produtos, onRepor }: {
  produtos: Produto[];
  onRepor: (produtoId: string) => void;
}) {
  const itens = useMemo(() => {
    return produtos
      .filter((p) => precisaRepor(p))
      .map((p) => ({ p, rep: sugerirReposicao(p), zerado: statusMinimo(p) === 'zerado' }))
      .sort((a, b) => Number(b.zerado) - Number(a.zerado) || b.rep.custo_estimado - a.rep.custo_estimado);
  }, [produtos]);

  const totalEstimado = useMemo(() => itens.reduce((s, x) => s + x.rep.custo_estimado, 0), [itens]);
  const zerados = itens.filter((x) => x.zerado).length;

  function exportar() {
    const header = ['SKU', 'Produto', 'Categoria', 'Local', 'Saldo', 'Mínimo', 'Faltante', 'Sugerido comprar', 'Unidade', 'Custo médio', 'Investimento estimado'];
    const rows = itens.map(({ p, rep }) => [
      p.sku || '', p.nome, catLabel(p.categoria), localLabel(p.local), p.estoque_atual, p.estoque_minimo,
      rep.faltante, rep.sugerido, p.unidade, p.custo_medio_num, rep.custo_estimado,
    ]);
    exportCSV(`lista-de-compra-${ymd(new Date())}.csv`, header, rows);
  }

  if (produtos.length === 0) {
    return <EmptyState icon={<IcoCart />} title="Sem produtos para repor">Cadastre produtos e defina o estoque mínimo na aba Saldo para receber sugestões de compra.</EmptyState>;
  }
  if (itens.length === 0) {
    return (
      <EmptyState icon={<IcoCheck />} title="Tudo abastecido 🎉">
        Nenhum item no ou abaixo do mínimo. Defina o <b>estoque mínimo</b> dos produtos (aba Saldo) para ativar o ponto de reposição.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={exportar} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03]"><IcoDownload /> Lista de compra (CSV)</button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Kpi label="Itens a repor" value={formatNumber(itens.length)} tone="gold" icon={<IcoCart />} />
        <Kpi label="Zerados" value={formatNumber(zerados)} tone={zerados > 0 ? 'vermelho' : 'cinza'} icon={<IcoAlert />} hint="sem saldo" />
        <Kpi label="Investimento estimado" value={formatMoneyShort(totalEstimado)} tone="azul" hint="a custo médio" />
      </div>

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Sugestão de compra</h3>
        <p className="mb-4 text-xs text-ink-muted">Repor até 2× o mínimo (nível de segurança). A lista pode virar uma Requisição em <b>Compras</b> quando o módulo estiver disponível.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="pb-2 font-semibold">Produto</th>
                <th className="pb-2 text-right font-semibold">Saldo</th>
                <th className="pb-2 text-right font-semibold">Mínimo</th>
                <th className="hidden pb-2 text-right font-semibold sm:table-cell">Faltante</th>
                <th className="pb-2 text-right font-semibold">Comprar</th>
                <th className="hidden pb-2 text-right font-semibold md:table-cell">Estimado</th>
                <th className="w-20 pb-2" />
              </tr>
            </thead>
            <tbody>
              {itens.map(({ p, rep, zerado }) => (
                <tr key={p.id} className="group border-b border-black/[0.04] last:border-0">
                  <td className="py-2.5">
                    <p className="font-medium text-ink-soft">{p.nome}</p>
                    <p className="text-xs text-ink-muted">{catLabel(p.categoria)} · {localLabel(p.local)}</p>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${zerado ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{formatNumber(p.estoque_atual)} {p.unidade}</span>
                  </td>
                  <td className="py-2.5 text-right text-ink-muted">{formatNumber(p.estoque_minimo)}</td>
                  <td className="hidden py-2.5 text-right text-ink-muted sm:table-cell">{formatNumber(rep.faltante)}</td>
                  <td className="py-2.5 text-right font-bold text-ink-soft">{formatNumber(rep.sugerido)} {p.unidade}</td>
                  <td className="hidden py-2.5 text-right text-ink-muted md:table-cell">{formatMoney(rep.custo_estimado)}</td>
                  <td className="py-2.5 pl-2 text-right">
                    <button onClick={() => onRepor(p.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-emerald-700">Repor</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
