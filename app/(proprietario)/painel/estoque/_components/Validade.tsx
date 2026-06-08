'use client';

// Aba "Validade / Lote" — controle FEFO (First-Expire, First-Out).
//   • Lotes (entradas com validade) ordenados por vencimento
//   • Semáforo vencido / ≤7d / a vencer; alerta de perecíveis sem lote rastreado
//   • Registrar perda abre uma baixa do tipo "perda" no produto
// Obs.: o saldo é mantido no nível do produto; os lotes vêm das entradas.

import { useMemo, useState } from 'react';
import { formatNumber, formatDate } from '@/lib/format';
import { diasParaVencer, statusValidade, type StatusValidade } from '@/lib/estoque';
import { type Produto, type EstoqueMov, catLabel, localLabel, VAL_CLS, VAL_LABEL, exportCSV, ymd } from '../_lib';
import { Kpi, EmptyState, IcoClock, IcoAlert, IcoLayers, IcoDownload, IcoTrash } from './ui';

export default function Validade({ produtos, movs, onPerda }: {
  produtos: Produto[];
  movs: EstoqueMov[];
  onPerda: (produtoId: string) => void;
}) {
  const nowMs = Date.now();
  const [soAlertas, setSoAlertas] = useState(false);
  const prodById = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  // Lotes = entradas com validade. FEFO: ordena por validade ascendente.
  const lotes = useMemo(() => {
    return movs
      .filter((m) => m.tipo === 'entrada' && m.validade)
      .map((m) => ({ m, dias: diasParaVencer(m.validade, nowMs), st: statusValidade(m.validade, nowMs) }))
      .filter((x) => (soAlertas ? x.st !== 'ok' : true))
      .sort((a, b) => (a.m.validade || '').localeCompare(b.m.validade || ''));
  }, [movs, nowMs, soAlertas]);

  const kpis = useMemo(() => {
    const all = movs.filter((m) => m.tipo === 'entrada' && m.validade).map((m) => statusValidade(m.validade, nowMs));
    return {
      vencidos: all.filter((s) => s === 'vencido').length,
      criticos: all.filter((s) => s === 'critico').length,
      atencao: all.filter((s) => s === 'atencao').length,
    };
  }, [movs, nowMs]);

  // Perecíveis sem nenhum lote com validade rastreada (lembrete de cadastro).
  const pereciveisSemLote = useMemo(() => {
    const comLote = new Set(movs.filter((m) => m.tipo === 'entrada' && m.validade).map((m) => m.produto_id));
    return produtos.filter((p) => p.ativo && p.perecivel && p.estoque_atual > 0 && !comLote.has(p.id));
  }, [produtos, movs]);

  function exportar() {
    const header = ['Produto', 'Lote', 'Validade', 'Dias', 'Status', 'Qtd entrada', 'Unidade', 'Local'];
    const rows = lotes.map(({ m, dias, st }) => [
      prodById.get(m.produto_id)?.nome || '—', m.lote || '', m.validade || '', dias === Infinity ? '' : dias,
      VAL_LABEL[st], m.quantidade, prodById.get(m.produto_id)?.unidade || '', localLabel(m.local_origem || prodById.get(m.produto_id)?.local || null),
    ]);
    exportCSV(`estoque-validade-${ymd(new Date())}.csv`, header, rows);
  }

  const temPereciveis = produtos.some((p) => p.perecivel);
  if (!temPereciveis && lotes.length === 0) {
    return <EmptyState icon={<IcoLayers />} title="Sem itens perecíveis">Marque produtos como <b>perecíveis</b> (aba Saldo) e informe lote/validade nas entradas para ativar o controle FEFO.</EmptyState>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => setSoAlertas((v) => !v)} className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${soAlertas ? 'bg-amber-500 text-white' : 'border border-black/10 bg-white text-ink-soft hover:bg-black/[0.03]'}`}>Só alertas</button>
        <button onClick={exportar} disabled={lotes.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar</button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Kpi label="Vencidos" value={formatNumber(kpis.vencidos)} tone={kpis.vencidos > 0 ? 'vermelho' : 'cinza'} icon={<IcoAlert />} />
        <Kpi label="Vence em ≤7 dias" value={formatNumber(kpis.criticos)} tone={kpis.criticos > 0 ? 'gold' : 'cinza'} icon={<IcoClock />} />
        <Kpi label="A vencer (≤30d)" value={formatNumber(kpis.atencao)} tone={kpis.atencao > 0 ? 'gold' : 'cinza'} icon={<IcoClock />} />
      </div>

      {pereciveisSemLote.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>{pereciveisSemLote.length}</b> produto(s) perecível(is) com saldo, mas sem lote/validade rastreado: {pereciveisSemLote.slice(0, 5).map((p) => p.nome).join(', ')}{pereciveisSemLote.length > 5 ? '…' : ''}. Informe lote e validade nas próximas entradas.
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Lotes por vencimento (FEFO)</h3>
        {lotes.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhum lote {soAlertas ? 'em alerta' : 'com validade'} no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="hidden pb-2 font-semibold sm:table-cell">Lote</th>
                  <th className="pb-2 font-semibold">Validade</th>
                  <th className="pb-2 text-right font-semibold">Prazo</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="hidden pb-2 text-right font-semibold md:table-cell">Entrada</th>
                  <th className="w-20 pb-2" />
                </tr>
              </thead>
              <tbody>
                {lotes.map(({ m, dias, st }) => {
                  const p = prodById.get(m.produto_id);
                  return (
                    <tr key={m.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5">
                        <p className="font-medium text-ink-soft">{p?.nome || '—'}</p>
                        <p className="text-xs text-ink-muted">{p ? catLabel(p.categoria) : ''}</p>
                      </td>
                      <td className="hidden py-2.5 text-ink-muted sm:table-cell">{m.lote || '—'}</td>
                      <td className="py-2.5 text-ink-soft">{m.validade ? formatDate(m.validade, { style: 'short' }) : '—'}</td>
                      <td className={`py-2.5 text-right font-semibold ${st === 'vencido' ? 'text-red-600' : st === 'critico' ? 'text-orange-600' : st === 'atencao' ? 'text-amber-600' : 'text-ink-muted'}`}>
                        {dias === Infinity ? '—' : dias < 0 ? `${Math.abs(dias)}d atrás` : `${dias}d`}
                      </td>
                      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VAL_CLS[st as StatusValidade]}`}>{VAL_LABEL[st as StatusValidade]}</span></td>
                      <td className="hidden py-2.5 text-right text-ink-muted md:table-cell">{formatNumber(m.quantidade)} {p?.unidade || ''}</td>
                      <td className="py-2.5 pl-2 text-right">
                        <button onClick={() => onPerda(m.produto_id)} title="Registrar perda" className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-red-300 hover:text-red-600"><IcoTrash /> Perda</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
