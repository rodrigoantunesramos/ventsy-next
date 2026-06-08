'use client'

// Aba Visão Geral — resumo contábil do período/regime: resultado, mini-DRE,
// composição de despesas e pendências (sem conta, a conciliar, meses abertos).
// Complementa o cockpit do Financeiro (caixa) com a leitura contábil — não o
// duplica. Atalhos levam às abas detalhadas.

import { useMemo } from 'react'
import { formatMoney, formatMoneyShort, formatPercent } from '@/lib/format'
import { montarDRE, posicaoPorConta, type DreLinha } from '@/lib/contabilidade'
import type { DadosContabilidade, Regime } from '../_lib'
import { DRE_LABELS, PALETTE } from '../_lib'
import { Bar, IcoChart, IcoScale, IcoLink, IcoLockClosed, KpiCard, Section } from './ui'

type Range = { ini: string; fim: string }
type Props = { dados: DadosContabilidade; regime: Regime; atual: Range; anterior: Range; periodoLabel: string; hojeMes: string; goTo: (aba: string) => void }

export default function VisaoGeral({ dados, regime, atual, anterior, periodoLabel, hojeMes, goTo }: Props) {
  const { lancamentos, contas, bancos, parcelas, fechamentos, extrato } = dados
  const dre = useMemo(() => montarDRE(lancamentos, contas, regime, atual.ini, atual.fim), [lancamentos, contas, regime, atual])
  const dreAnt = useMemo(() => montarDRE(lancamentos, contas, regime, anterior.ini, anterior.fim), [lancamentos, contas, regime, anterior])
  const pos = useMemo(() => posicaoPorConta(bancos, lancamentos), [bancos, lancamentos])

  const semConta = useMemo(() => lancamentos.filter((l) => !l.conta_id).length, [lancamentos])
  const aReceber = useMemo(() => parcelas.filter((p) => { const s = (p.status || '').toLowerCase(); return s !== 'pago' && s !== 'cancelado' }).reduce((s, p) => s + p.valor, 0), [parcelas])
  const fechados = fechamentos.filter((f) => (f.status || '').toLowerCase() === 'fechado').length
  const pendConcil = extrato.filter((e) => e.status === 'pendente').length
  const difConcil = pos.saldoAtual - pos.conciliado

  const despesas = useMemo(() => {
    const linhas: DreLinha[] = ['deducoes', 'custos_diretos', 'despesas_operacionais', 'despesas_financeiras', 'depreciacao']
    const arr = linhas.map((k) => ({ label: DRE_LABELS[k], valor: dre.linhas[k] })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor)
    const total = arr.reduce((s, x) => s + x.valor, 0) || 1
    return { arr, total }
  }, [dre])

  const variacao = dreAnt.resultadoLiquido === 0 ? (dre.resultadoLiquido > 0 ? 100 : 0) : Math.round(((dre.resultadoLiquido - dreAnt.resultadoLiquido) / Math.abs(dreAnt.resultadoLiquido)) * 100)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Resultado líquido" value={formatMoneyShort(dre.resultadoLiquido)} sub={`${variacao >= 0 ? '↑' : '↓'} ${Math.abs(variacao)}% vs anterior`} tone={dre.resultadoLiquido >= 0 ? 'gold' : 'vermelho'} icon={<IcoChart />} />
        <KpiCard label="Receita líquida" value={formatMoneyShort(dre.receitaLiquida)} sub={`bruta ${formatMoneyShort(dre.receitaBruta)}`} tone="verde" />
        <KpiCard label="Margem líquida" value={formatPercent(dre.margemLiquida)} sub={`EBITDA ${formatMoneyShort(dre.ebitda)}`} tone="azul" />
        <KpiCard label="Saldo em caixa" value={formatMoneyShort(pos.saldoAtual)} sub={`a receber ${formatMoneyShort(aReceber)}`} tone="ink" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="DRE resumido" hint={`${regime === 'caixa' ? 'Regime de caixa' : 'Regime de competência'} · ${periodoLabel}`} action={<button onClick={() => goTo('dre')} className="text-xs font-semibold text-brand hover:underline">Ver DRE →</button>}>
          <div className="space-y-1.5 text-sm">
            <Linha label="Receita bruta" valor={dre.receitaBruta} />
            <Linha label="(−) Deduções" valor={-dre.deducoes} muted />
            <Linha label="= Receita líquida" valor={dre.receitaLiquida} forte />
            <Linha label="(−) Custos diretos" valor={-dre.custosDiretos} muted />
            <Linha label="= Margem de contribuição" valor={dre.margemContribuicao} forte />
            <Linha label="(−) Despesas operacionais" valor={-dre.despesasOperacionais} muted />
            <Linha label="= EBITDA" valor={dre.ebitda} forte />
            {(dre.resultadoFinanceiro !== 0 || dre.depreciacao !== 0) && <Linha label="(+/−) Financeiro e depreciação" valor={dre.resultadoFinanceiro - dre.depreciacao} muted />}
            <div className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2.5">
              <span className="font-bold text-ink">Resultado líquido</span>
              <span className={`text-base font-bold ${dre.resultadoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(dre.resultadoLiquido)} <span className="text-xs font-medium text-ink-muted">({formatPercent(dre.margemLiquida)})</span></span>
            </div>
          </div>
        </Section>

        <Section title="Composição de despesas" hint="Por linha do DRE" action={<button onClick={() => goTo('balancete')} className="text-xs font-semibold text-brand hover:underline">Balancete →</button>}>
          {!despesas.arr.length ? (
            <p className="py-10 text-center text-sm text-ink-muted">Sem despesas no período/regime.</p>
          ) : (
            <div className="space-y-3">
              {despesas.arr.map((d, i) => <Bar key={d.label} label={d.label} value={d.valor} total={despesas.total} cor={PALETTE[(i + 1) % PALETTE.length]} right={`${formatMoneyShort(d.valor)} · ${Math.round((d.valor / despesas.total) * 100)}%`} />)}
            </div>
          )}
        </Section>
      </div>

      <Section title="Pendências contábeis" hint="O que falta para um fechamento limpo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Pend onClick={() => goTo('plano')} icon={<IcoScale />} tone={semConta > 0 ? 'gold' : 'verde'} valor={semConta > 0 ? `${semConta}` : '✓'} label="Lançamentos sem conta" hint={semConta > 0 ? 'vincular ao plano de contas' : 'tudo classificado'} />
          <Pend onClick={() => goTo('conciliacao')} icon={<IcoLink />} tone={Math.abs(difConcil) > 0.01 || pendConcil > 0 ? 'gold' : 'verde'} valor={Math.abs(difConcil) > 0.01 ? formatMoneyShort(difConcil) : pendConcil > 0 ? `${pendConcil}` : '✓'} label="A conciliar" hint={pendConcil > 0 ? `${pendConcil} linha(s) pendente(s)` : 'extrato em dia'} />
          <Pend onClick={() => goTo('fechamento')} icon={<IcoLockClosed />} tone="azul" valor={`${fechados}`} label="Meses fechados" hint="ver fechamentos" />
        </div>
      </Section>
    </div>
  )
}

function Linha({ label, valor, muted, forte }: { label: string; valor: number; muted?: boolean; forte?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${forte ? 'border-t border-black/[0.06] pt-1.5' : ''}`}>
      <span className={`${forte ? 'font-semibold text-ink-soft' : muted ? 'text-xs text-ink-muted' : 'text-ink-soft'}`}>{label}</span>
      <span className={`${forte ? 'font-bold text-ink' : muted ? 'text-xs text-ink-muted' : 'font-medium text-ink-soft'}`}>{formatMoney(valor)}</span>
    </div>
  )
}

function Pend({ onClick, icon, tone, valor, label, hint }: { onClick: () => void; icon: React.ReactNode; tone: 'verde' | 'gold' | 'azul'; valor: string; label: string; hint: string }) {
  const cls = { verde: 'text-emerald-600 bg-emerald-50', gold: 'text-amber-600 bg-amber-50', azul: 'text-blue-600 bg-blue-50' }[tone]
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 text-left transition hover:border-brand/20 hover:bg-brand-50/30">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cls}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold text-ink">{valor}</div>
        <div className="truncate text-xs font-medium text-ink-soft">{label}</div>
        <div className="truncate text-[0.65rem] text-ink-muted">{hint}</div>
      </div>
    </button>
  )
}
