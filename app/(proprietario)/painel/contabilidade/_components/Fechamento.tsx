'use client'

// Aba Fechamento mensal — fecha/reabre o mês (o trigger SQL trava edição
// retroativa em `lancamentos`), com checklist de consistência e exportação do
// pacote contábil (DRE + balancete) em PDF e XLSX para o contador.

import { useMemo, useState } from 'react'
import { supabaseAny as sb } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatMoney, formatMoneyShort, formatMonth } from '@/lib/format'
import { montarBalancete, montarDRE, type Fechamento as Fech, type Lancamento, type PlanoConta, type Regime } from '@/lib/contabilidade'
import { DRE_LABELS, btnGhost, btnPrimary } from '../_lib'
import { IcoCheck, IcoDownload, IcoLockClosed, KpiCard, Section } from './ui'

type Props = {
  userId: string
  fechamentos: Fech[]
  lancamentos: Lancamento[]
  contas: PlanoConta[]
  regime: Regime
  hojeMes: string
  empresaNome: string
  recarregar: () => Promise<void>
}

function mesesAtras(hojeMes: string, n: number): string[] {
  const [y, m] = hojeMes.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const idx = (m - 1) - i
    const yy = y + Math.floor(idx / 12)
    const mm = ((idx % 12) + 12) % 12 + 1
    return `${yy}-${String(mm).padStart(2, '0')}`
  })
}

export default function Fechamento({ userId, fechamentos, lancamentos, contas, regime, hojeMes, empresaNome, recarregar }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [checklist, setChecklist] = useState<string | null>(null)

  const fechMap = useMemo(() => new Map(fechamentos.map((f) => [f.mes, (f.status || '').toLowerCase()])), [fechamentos])

  const meses = useMemo(() => mesesAtras(hojeMes, 12).map((mes) => {
    const ini = `${mes}-01`
    const [y, m] = mes.split('-').map(Number)
    const fim = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const dre = montarDRE(lancamentos, contas, regime, ini, fim)
    const semConta = lancamentos.filter((l) => { const d = (regime === 'competencia' ? l.competencia || l.data : l.data); return d >= ini && d <= fim && !l.conta_id }).length
    const naoConc = lancamentos.filter((l) => { const d = l.data; return d >= ini && d <= fim && (l.status || 'pago') === 'pago' && !l.conciliado }).length
    return { mes, ini, fim, dre, semConta, naoConc, fechado: fechMap.get(mes) === 'fechado' }
  }), [hojeMes, lancamentos, contas, regime, fechMap])

  const resultadoYTD = useMemo(() => {
    const ano = hojeMes.slice(0, 4)
    return montarDRE(lancamentos, contas, regime, `${ano}-01-01`, `${ano}-12-31`).resultadoLiquido
  }, [hojeMes, lancamentos, contas, regime])
  const nFechados = meses.filter((m) => m.fechado).length

  async function fechar(mes: string) {
    setBusy(true)
    const { error } = await sb.from('fechamentos').upsert({ usuario_id: userId, mes, status: 'fechado', fechado_em: new Date().toISOString() }, { onConflict: 'usuario_id,mes' })
    setBusy(false)
    if (error) { toast.error('Erro ao fechar o mês.'); return }
    toast.success(`${formatMonth(mes)} fechado. Edição retroativa bloqueada.`); setChecklist(null); await recarregar()
  }
  async function reabrir(mes: string) {
    setBusy(true)
    const { error } = await sb.from('fechamentos').upsert({ usuario_id: userId, mes, status: 'aberto' }, { onConflict: 'usuario_id,mes' })
    setBusy(false)
    if (error) { toast.error('Erro ao reabrir.'); return }
    toast.success(`${formatMonth(mes)} reaberto para edição.`); await recarregar()
  }

  async function exportarPDF(mes: string, ini: string, fim: string) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const dre = montarDRE(lancamentos, contas, regime, ini, fim)
    const bal = montarBalancete(lancamentos, contas, regime, ini, fim)
    let y = 16
    doc.setFontSize(16); doc.text(empresaNome || 'Ventsy', 14, y); y += 7
    doc.setFontSize(11); doc.setTextColor(120)
    doc.text(`Pacote contábil — ${formatMonth(mes)} · regime ${regime === 'caixa' ? 'de caixa' : 'de competência'}`, 14, y); y += 10
    doc.setTextColor(20); doc.setFontSize(13); doc.text('DRE gerencial', 14, y); y += 7
    const linhasDre: [string, number][] = [
      ['Receita bruta', dre.receitaBruta], ['(−) Deduções e impostos', -dre.deducoes], ['= Receita líquida', dre.receitaLiquida],
      ['(−) Custos diretos', -dre.custosDiretos], ['= Margem de contribuição', dre.margemContribuicao],
      ['(−) Despesas operacionais', -dre.despesasOperacionais], ['= EBITDA', dre.ebitda],
      ['(+/−) Resultado financeiro', dre.resultadoFinanceiro], ['(−) Depreciação', -dre.depreciacao], ['= Resultado líquido', dre.resultadoLiquido],
    ]
    doc.setFontSize(10)
    linhasDre.forEach(([label, val]) => { doc.setTextColor(label.startsWith('=') ? 20 : 90); doc.text(label, 14, y); doc.text(formatMoney(val), 196, y, { align: 'right' }); y += 6 })
    y += 6; doc.setTextColor(20); doc.setFontSize(13); doc.text('Balancete', 14, y); y += 7; doc.setFontSize(9)
    bal.linhas.forEach((l) => { if (y > 280) { doc.addPage(); y = 16 } doc.setTextColor(90); doc.text(`${l.codigo}  ${l.conta}`.slice(0, 60), 14, y); doc.text(formatMoney(l.saldo), 196, y, { align: 'right' }); y += 5 })
    doc.save(`fechamento-${mes}.pdf`)
  }

  async function exportarXLSX(mes: string, ini: string, fim: string) {
    const XLSX = await import('xlsx')
    const dre = montarDRE(lancamentos, contas, regime, ini, fim)
    const bal = montarBalancete(lancamentos, contas, regime, ini, fim)
    const dreSheet = [
      ['DRE', formatMonth(mes), regime],
      ['Receita bruta', dre.receitaBruta], ['Deduções', dre.deducoes], ['Receita líquida', dre.receitaLiquida],
      ['Custos diretos', dre.custosDiretos], ['Margem de contribuição', dre.margemContribuicao],
      ['Despesas operacionais', dre.despesasOperacionais], ['EBITDA', dre.ebitda],
      ['Resultado financeiro', dre.resultadoFinanceiro], ['Depreciação', dre.depreciacao], ['Resultado líquido', dre.resultadoLiquido],
    ]
    const balSheet = [['Código', 'Conta', 'Tipo', 'Débito', 'Crédito', 'Saldo'], ...bal.linhas.map((l) => [l.codigo, l.conta, l.tipo, l.debito, l.credito, l.saldo])]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dreSheet), 'DRE')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(balSheet), 'Balancete')
    XLSX.writeFile(wb, `fechamento-${mes}.xlsx`)
  }

  const alvo = meses.find((m) => m.mes === checklist)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Meses fechados" value={`${nFechados}/12`} sub="últimos 12 meses" tone="azul" icon={<IcoLockClosed />} />
        <KpiCard label="Resultado no ano" value={formatMoneyShort(resultadoYTD)} sub={`acumulado ${hojeMes.slice(0, 4)}`} tone={resultadoYTD >= 0 ? 'verde' : 'vermelho'} />
        <KpiCard label="Regime" value={regime === 'caixa' ? 'Caixa' : 'Competência'} sub="usado no fechamento" tone="ink" />
        <KpiCard label="Pendências" value={String(meses.filter((m) => !m.fechado && (m.semConta > 0 || m.naoConc > 0)).length)} sub="meses com alertas" tone="gold" />
      </div>

      <Section title="Fechamento mensal" hint="Fechar trava a edição retroativa de lançamentos do mês. Exporte o pacote para o contador.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">Mês</th><th className="pb-2 text-right font-semibold">Receita</th><th className="pb-2 text-right font-semibold">Resultado</th><th className="hidden pb-2 font-semibold sm:table-cell">Consistência</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 text-right font-semibold">Ações</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-b border-black/[0.04]">
                  <td className="py-2.5 font-medium capitalize text-ink-soft">{formatMonth(m.mes)}</td>
                  <td className="py-2.5 text-right text-ink-muted">{formatMoney(m.dre.receitaBruta)}</td>
                  <td className={`py-2.5 text-right font-semibold ${m.dre.resultadoLiquido >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(m.dre.resultadoLiquido)}</td>
                  <td className="hidden py-2.5 text-xs sm:table-cell">{m.semConta === 0 && m.naoConc === 0 ? <span className="text-emerald-600">✓ ok</span> : <span className="text-amber-600">{m.semConta > 0 ? `${m.semConta} sem conta` : ''}{m.semConta > 0 && m.naoConc > 0 ? ' · ' : ''}{m.naoConc > 0 ? `${m.naoConc} não conciliado` : ''}</span>}</td>
                  <td className="py-2.5">{m.fechado ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700"><IcoCheck /> Fechado</span> : <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-semibold text-ink-muted">Aberto</span>}</td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => exportarPDF(m.mes, m.ini, m.fim)} title="Exportar PDF" className="rounded-lg border border-black/10 px-2 py-1 text-xs text-ink-muted hover:border-brand/30 hover:text-brand">PDF</button>
                      <button onClick={() => exportarXLSX(m.mes, m.ini, m.fim)} title="Exportar XLSX" className="rounded-lg border border-black/10 px-2 py-1 text-xs text-ink-muted hover:border-brand/30 hover:text-brand">XLSX</button>
                      {m.fechado ? <button onClick={() => reabrir(m.mes)} disabled={busy} className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50">Reabrir</button> : <button onClick={() => setChecklist(m.mes)} className="rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-soft">Fechar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {alvo && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setChecklist(null) }}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setChecklist(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-1 font-display text-xl font-bold text-ink capitalize">Fechar {formatMonth(alvo.mes)}</h3>
            <p className="mb-4 text-sm text-ink-muted">Confira antes de travar o mês. Você poderá reabrir depois, se necessário.</p>
            <ul className="mb-5 space-y-2 text-sm">
              <Check ok label="Resultado do mês" valor={formatMoney(alvo.dre.resultadoLiquido)} />
              <Check ok={alvo.semConta === 0} label="Lançamentos classificados" valor={alvo.semConta === 0 ? 'Todos com conta' : `${alvo.semConta} sem conta`} />
              <Check ok={alvo.naoConc === 0} label="Conciliação bancária" valor={alvo.naoConc === 0 ? 'Tudo conciliado' : `${alvo.naoConc} pendente(s)`} />
            </ul>
            <div className="flex items-center gap-3">
              <button onClick={() => fechar(alvo.mes)} disabled={busy} className={btnPrimary}><IcoLockClosed /> {busy ? 'Fechando…' : 'Fechar mês'}</button>
              <button onClick={() => { exportarPDF(alvo.mes, alvo.ini, alvo.fim) }} className={btnGhost}><IcoDownload /> Pacote PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Check({ ok, label, valor }: { ok: boolean; label: string; valor: string }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2">
      <span className="flex items-center gap-2 text-ink-soft"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ok ? '✓' : '!'}</span>{label}</span>
      <span className={`text-xs font-medium ${ok ? 'text-ink-muted' : 'text-amber-600'}`}>{valor}</span>
    </li>
  )
}
