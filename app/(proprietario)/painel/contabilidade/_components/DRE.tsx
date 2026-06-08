'use client'

// Aba DRE — Demonstrativo de Resultado gerencial em cascata, no regime e período
// escolhidos (controles globais), com comparativo do período anterior, análise
// vertical (% sobre receita bruta) e detalhe por conta. Cálculo via engine pura.

import { Fragment, useMemo, useState } from 'react'
import { formatMoney, formatPercent } from '@/lib/format'
import { montarDRE, type DreLinha, type Lancamento, type PlanoConta, type Regime } from '@/lib/contabilidade'
import { DRE_LABELS } from '../_lib'
import { IcoDownload, Section } from './ui'

type Range = { ini: string; fim: string }
type Props = {
  lancamentos: Lancamento[]
  contas: PlanoConta[]
  regime: Regime
  atual: Range
  anterior: Range
  periodoLabel: string
  centroCustoId: string | null
}

function variacao(a: number, b: number): number {
  if (b === 0) return a > 0 ? 100 : a < 0 ? -100 : 0
  return Math.round(((a - b) / Math.abs(b)) * 100)
}

export default function DRE({ lancamentos, contas, regime, atual, anterior, periodoLabel, centroCustoId }: Props) {
  const [comparar, setComparar] = useState(true)
  const [vertical, setVertical] = useState(true)
  const [aberto, setAberto] = useState<Record<string, boolean>>({})

  const dre = useMemo(() => montarDRE(lancamentos, contas, regime, atual.ini, atual.fim, centroCustoId), [lancamentos, contas, regime, atual, centroCustoId])
  const dreAnt = useMemo(() => montarDRE(lancamentos, contas, regime, anterior.ini, anterior.fim, centroCustoId), [lancamentos, contas, regime, anterior, centroCustoId])

  const detalhe = useMemo(() => {
    const m = new Map<DreLinha, { conta: string; valor: number }[]>()
    dre.detalhePorConta.forEach((d) => { (m.get(d.linha) || m.set(d.linha, []).get(d.linha)!).push({ conta: d.conta, valor: d.valor }) })
    return m
  }, [dre])

  const base = dre.receitaBruta || 1

  // Estrutura da cascata: linhas de grupo (g) e subtotais (s).
  type Row =
    | { kind: 'g'; linha: DreLinha; label: string; valor: number; anterior: number; sinal: '+' | '−' }
    | { kind: 's'; label: string; valor: number; anterior: number; forte?: boolean }
  const rows: Row[] = [
    { kind: 'g', linha: 'receita_bruta', label: DRE_LABELS.receita_bruta, valor: dre.receitaBruta, anterior: dreAnt.receitaBruta, sinal: '+' },
    { kind: 'g', linha: 'deducoes', label: DRE_LABELS.deducoes, valor: dre.deducoes, anterior: dreAnt.deducoes, sinal: '−' },
    { kind: 's', label: 'Receita líquida', valor: dre.receitaLiquida, anterior: dreAnt.receitaLiquida },
    { kind: 'g', linha: 'custos_diretos', label: DRE_LABELS.custos_diretos, valor: dre.custosDiretos, anterior: dreAnt.custosDiretos, sinal: '−' },
    { kind: 's', label: 'Margem de contribuição', valor: dre.margemContribuicao, anterior: dreAnt.margemContribuicao },
    { kind: 'g', linha: 'despesas_operacionais', label: DRE_LABELS.despesas_operacionais, valor: dre.despesasOperacionais, anterior: dreAnt.despesasOperacionais, sinal: '−' },
    { kind: 's', label: 'EBITDA', valor: dre.ebitda, anterior: dreAnt.ebitda },
    { kind: 'g', linha: 'receitas_financeiras', label: DRE_LABELS.receitas_financeiras, valor: dre.receitasFinanceiras, anterior: dreAnt.receitasFinanceiras, sinal: '+' },
    { kind: 'g', linha: 'despesas_financeiras', label: DRE_LABELS.despesas_financeiras, valor: dre.despesasFinanceiras, anterior: dreAnt.despesasFinanceiras, sinal: '−' },
    { kind: 'g', linha: 'depreciacao', label: DRE_LABELS.depreciacao, valor: dre.depreciacao, anterior: dreAnt.depreciacao, sinal: '−' },
    { kind: 's', label: 'Resultado líquido', valor: dre.resultadoLiquido, anterior: dreAnt.resultadoLiquido, forte: true },
  ]

  function exportarCSV() {
    const pv = (n: number) => String(n).replace('.', ',')
    const linhas = rows.map((r) => [r.label, pv(r.valor), comparar ? pv(r.anterior) : ''].filter((_, i) => i < (comparar ? 3 : 2)).join(';'))
    const header = comparar ? 'Linha;Período;Período anterior' : 'Linha;Período'
    const blob = new Blob(['﻿' + header + '\n' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dre-${regime}-${atual.ini}_${atual.fim}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <Section
      title="DRE gerencial"
      hint={`${regime === 'caixa' ? 'Regime de caixa' : 'Regime de competência'} · ${periodoLabel}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Toggle on={vertical} set={setVertical} label="% vertical" />
          <Toggle on={comparar} set={setComparar} label="Comparar" />
          <button onClick={exportarCSV} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-xs text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> CSV</button>
        </div>
      }
    >
      {dre.receitaBruta === 0 && dre.detalhePorConta.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Sem lançamentos no período/regime selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="pb-2 font-semibold">Linha</th>
                {vertical && <th className="pb-2 text-right font-semibold">AV%</th>}
                <th className="pb-2 text-right font-semibold">Período</th>
                {comparar && <th className="hidden pb-2 text-right font-semibold sm:table-cell">Anterior</th>}
                {comparar && <th className="pb-2 text-right font-semibold">Δ</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.kind === 's') {
                  const delta = variacao(r.valor, r.anterior)
                  return (
                    <tr key={i} className={`border-t border-black/[0.06] ${r.forte ? 'bg-black/[0.02]' : ''}`}>
                      <td className={`py-2.5 font-bold ${r.forte ? 'text-ink' : 'text-ink-soft'}`}>= {r.label}</td>
                      {vertical && <td className="py-2.5 text-right text-xs text-ink-muted">{formatPercent(r.valor / base)}</td>}
                      <td className={`py-2.5 text-right font-bold ${r.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(r.valor)}</td>
                      {comparar && <td className="hidden py-2.5 text-right text-ink-muted sm:table-cell">{formatMoney(r.anterior)}</td>}
                      {comparar && <td className={`py-2.5 text-right text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-ink-muted'}`}>{delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}{Math.abs(delta)}%</td>}
                    </tr>
                  )
                }
                const itens = detalhe.get(r.linha) || []
                const exp = aberto[r.linha]
                return (
                  <Fragment key={i}>
                    <tr className="border-t border-black/[0.04]">
                      <td className="py-2 text-ink-soft">
                        <button onClick={() => setAberto((a) => ({ ...a, [r.linha]: !a[r.linha] }))} disabled={!itens.length} className="inline-flex items-center gap-1.5 disabled:cursor-default">
                          {itens.length > 0 && <span className="text-[0.6rem] text-ink-muted">{exp ? '▾' : '▸'}</span>}
                          <span className="text-ink-muted">({r.sinal})</span> {r.label}
                        </button>
                      </td>
                      {vertical && <td className="py-2 text-right text-xs text-ink-muted">{formatPercent(r.valor / base)}</td>}
                      <td className={`py-2 text-right font-semibold ${r.sinal === '+' ? 'text-emerald-600' : 'text-red-600'}`}>{r.sinal === '−' && r.valor > 0 ? '−' : ''}{formatMoney(r.valor)}</td>
                      {comparar && <td className="hidden py-2 text-right text-ink-muted sm:table-cell">{formatMoney(r.anterior)}</td>}
                      {comparar && <td className="py-2 text-right text-xs text-ink-muted">{variacao(r.valor, r.anterior)}%</td>}
                    </tr>
                    {exp && itens.sort((a, b) => b.valor - a.valor).map((it, j) => (
                      <tr key={`${i}-${j}`} className="text-xs">
                        <td className="py-1 pl-7 text-ink-muted">{it.conta}</td>
                        {vertical && <td className="py-1 text-right text-ink-muted">{formatPercent(it.valor / base)}</td>}
                        <td className="py-1 text-right text-ink-muted">{formatMoney(it.valor)}</td>
                        {comparar && <td className="hidden sm:table-cell" />}
                        {comparar && <td />}
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-right text-xs text-ink-muted">Margem líquida: <span className="font-semibold text-ink-soft">{formatPercent(dre.margemLiquida)}</span></p>
        </div>
      )}
    </Section>
  )
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => set(!on)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${on ? 'border-brand/30 bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:bg-black/[0.03]'}`}>{label}</button>
  )
}
