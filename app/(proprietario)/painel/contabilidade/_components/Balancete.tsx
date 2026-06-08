'use client'

// Aba Balancete & Razão — saldos por conta (débito/crédito/saldo) agrupados por
// tipo, no regime/período escolhidos. Clicar numa conta abre o livro-razão
// (extrato cronológico com saldo corrente). Cálculo via engine pura.

import { Fragment, useMemo, useState } from 'react'
import { formatDate, formatMoney } from '@/lib/format'
import { livroRazao, montarBalancete, type Lancamento, type PlanoConta, type Regime, type ContaTipo } from '@/lib/contabilidade'
import { CONTA_TIPO_LABEL } from '../_lib'
import { IcoDownload, IcoScale, Section } from './ui'

type Range = { ini: string; fim: string }
type Props = { lancamentos: Lancamento[]; contas: PlanoConta[]; regime: Regime; atual: Range; periodoLabel: string }

const ORDEM_TIPO: ContaTipo[] = ['receita', 'despesa', 'ativo', 'passivo', 'patrimonio']

export default function Balancete({ lancamentos, contas, regime, atual, periodoLabel }: Props) {
  const [razao, setRazao] = useState<{ ref: string; nome: string } | null>(null)

  const bal = useMemo(() => montarBalancete(lancamentos, contas, regime, atual.ini, atual.fim), [lancamentos, contas, regime, atual])

  const grupos = useMemo(() => {
    const m = new Map<ContaTipo, typeof bal.linhas>()
    bal.linhas.forEach((l) => { (m.get(l.tipo) || m.set(l.tipo, []).get(l.tipo)!).push(l) })
    return ORDEM_TIPO.filter((t) => m.has(t)).map((t) => ({ tipo: t, linhas: m.get(t)! }))
  }, [bal])

  const razaoData = useMemo(() => (razao ? livroRazao(lancamentos, razao.ref, regime, atual.ini, atual.fim) : null), [razao, lancamentos, regime, atual])

  function exportarCSV() {
    const pv = (n: number) => String(n).replace('.', ',')
    const rows = bal.linhas.map((l) => [l.codigo, `"${l.conta}"`, CONTA_TIPO_LABEL[l.tipo], pv(l.debito), pv(l.credito), pv(l.saldo)].join(';'))
    const blob = new Blob(['﻿Código;Conta;Tipo;Débito;Crédito;Saldo\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `balancete-${atual.ini}_${atual.fim}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <Section
      title="Balancete"
      hint={`${regime === 'caixa' ? 'Regime de caixa' : 'Regime de competência'} · ${periodoLabel} · clique numa conta para o razão`}
      action={bal.linhas.length > 0 && <button onClick={exportarCSV} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-xs text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> CSV</button>}
    >
      {!bal.linhas.length ? (
        <p className="py-10 text-center text-sm text-ink-muted">Sem movimento contábil no período/regime selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="pb-2 font-semibold">Conta</th>
                <th className="pb-2 text-right font-semibold">Débito</th>
                <th className="pb-2 text-right font-semibold">Crédito</th>
                <th className="pb-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(({ tipo, linhas }) => (
                <Fragment key={tipo}>
                  <tr className="bg-black/[0.02]"><td colSpan={4} className="py-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted">{CONTA_TIPO_LABEL[tipo]}</td></tr>
                  {linhas.map((l) => (
                    <tr key={l.contaId} className="group cursor-pointer border-t border-black/[0.04] hover:bg-brand-50/40" onClick={() => setRazao({ ref: l.contaId, nome: l.conta })}>
                      <td className="py-2"><span className="font-mono text-xs text-ink-muted">{l.codigo}</span> <span className="font-medium text-ink-soft group-hover:text-brand">{l.conta}</span></td>
                      <td className="py-2 text-right text-ink-muted">{l.debito ? formatMoney(l.debito) : '—'}</td>
                      <td className="py-2 text-right text-ink-muted">{l.credito ? formatMoney(l.credito) : '—'}</td>
                      <td className={`py-2 text-right font-semibold ${l.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(l.saldo)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/[0.1] font-bold">
                <td className="py-2.5 text-ink">Totais</td>
                <td className="py-2.5 text-right text-ink">{formatMoney(bal.totalDebito)}</td>
                <td className="py-2.5 text-right text-ink">{formatMoney(bal.totalCredito)}</td>
                <td className={`py-2.5 text-right ${bal.totalCredito - bal.totalDebito >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(bal.totalCredito - bal.totalDebito)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Razão (drawer) */}
      {razao && razaoData && (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setRazao(null) }}>
          <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoScale /></span><div><h3 className="text-sm font-bold text-ink">Livro-razão</h3><p className="text-xs text-ink-muted">{razao.nome}</p></div></div>
              <button onClick={() => setRazao(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!razaoData.linhas.length ? <p className="py-10 text-center text-sm text-ink-muted">Sem lançamentos nesta conta no período.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">Data</th><th className="pb-2 font-semibold">Histórico</th><th className="pb-2 text-right font-semibold">Valor</th><th className="pb-2 text-right font-semibold">Saldo</th></tr></thead>
                  <tbody>
                    {razaoData.linhas.map((r) => (
                      <tr key={r.id} className="border-b border-black/[0.04]">
                        <td className="py-2 whitespace-nowrap text-ink-muted">{formatDate(r.data, { style: 'short' })}</td>
                        <td className="py-2 text-ink-soft">{r.descricao}</td>
                        <td className={`py-2 text-right font-medium ${r.credito ? 'text-emerald-600' : 'text-red-600'}`}>{r.credito ? '+' : '−'}{formatMoney(r.credito || r.debito)}</td>
                        <td className="py-2 text-right text-ink-muted">{formatMoney(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-black/[0.1] font-bold"><td colSpan={3} className="py-2.5 text-ink">Saldo final</td><td className={`py-2.5 text-right ${razaoData.saldoFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(razaoData.saldoFinal)}</td></tr></tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
