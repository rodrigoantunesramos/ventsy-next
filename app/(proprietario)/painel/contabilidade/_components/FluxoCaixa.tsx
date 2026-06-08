'use client'

// Aba Fluxo de Caixa — posição consolidada por conta bancária (realizado, só
// lançamentos pagos) + projeção de 12 meses puxando `parcelas` (a receber) e
// despesas em aberto (a pagar). Cálculo via engine pura.

import { useMemo, useState } from 'react'
import { supabaseAny as sb } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatMoney, formatMoneyShort, formatMonth } from '@/lib/format'
import { posicaoPorConta, projecaoFluxo, type ContaBancaria, type Lancamento, type ParcelaProj } from '@/lib/contabilidade'
import { btnGhost, btnPrimary, inp } from '../_lib'
import { FluxoBarsChart, IcoCoins, IcoPlus, KpiCard, Section } from './ui'

type Props = { userId: string; lancamentos: Lancamento[]; parcelas: ParcelaProj[]; bancos: ContaBancaria[]; hojeMes: string; recarregar: () => Promise<void> }

const TIPOS_CONTA: { v: string; label: string }[] = [
  { v: 'corrente', label: 'Conta corrente' }, { v: 'poupanca', label: 'Poupança' }, { v: 'caixa', label: 'Caixa / dinheiro' }, { v: 'aplicacao', label: 'Aplicação' }, { v: 'outro', label: 'Outro' },
]
type Form = { id?: string; nome: string; banco: string; tipo: string; saldo_inicial_num: string }
const novo = (): Form => ({ nome: '', banco: '', tipo: 'corrente', saldo_inicial_num: '' })

export default function FluxoCaixa({ userId, lancamentos, parcelas, bancos, hojeMes, recarregar }: Props) {
  const toast = useToast()
  const [modal, setModal] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const pos = useMemo(() => posicaoPorConta(bancos, lancamentos), [bancos, lancamentos])
  const aReceber = useMemo(() => parcelas.filter((p) => { const s = (p.status || '').toLowerCase(); return s !== 'pago' && s !== 'cancelado' }).reduce((s, p) => s + p.valor, 0), [parcelas])
  const projecao = useMemo(() => projecaoFluxo(parcelas, lancamentos, hojeMes, pos.saldoAtual, 12), [parcelas, lancamentos, hojeMes, pos.saldoAtual])
  const saldoProjetado = projecao.length ? projecao[projecao.length - 1].saldoAcum : pos.saldoAtual
  const chart = useMemo(() => projecao.map((f) => ({ label: formatMonth(f.mes, { withYear: false }), entrada: f.entradaProj, saida: f.saidaProj, saldo: f.saldoAcum })), [projecao])

  async function salvar() {
    if (!modal) return
    if (!modal.nome.trim()) { toast.error('Informe o nome da conta.'); return }
    setSaving(true)
    const payload = { usuario_id: userId, nome: modal.nome.trim(), banco: modal.banco.trim() || null, tipo: modal.tipo, saldo_inicial_num: Number(modal.saldo_inicial_num) || 0 }
    const { error } = modal.id ? await sb.from('contas_bancarias').update(payload).eq('id', modal.id) : await sb.from('contas_bancarias').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar a conta.'); return }
    toast.success(modal.id ? 'Conta atualizada.' : 'Conta bancária criada.'); setModal(null); await recarregar()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo em caixa" value={formatMoneyShort(pos.saldoAtual)} sub="contas bancárias (realizado)" tone="azul" icon={<IcoCoins />} />
        <KpiCard label="Conciliado" value={formatMoneyShort(pos.conciliado)} sub="saldo conferido com extrato" tone="verde" />
        <KpiCard label="A receber" value={formatMoneyShort(aReceber)} sub="parcelas em aberto" tone="gold" />
        <KpiCard label="Saldo projetado" value={formatMoneyShort(saldoProjetado)} sub="em 12 meses" tone={saldoProjetado >= 0 ? 'verde' : 'vermelho'} />
      </div>

      <Section title="Posição por conta bancária" hint="Caixa realizado — apenas lançamentos pagos" action={<button onClick={() => setModal(novo())} className={btnPrimary}><IcoPlus /> Conta</button>}>
        {!pos.contas.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">Cadastre suas contas bancárias para acompanhar a posição de caixa e conciliar o extrato.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">Conta</th><th className="pb-2 text-right font-semibold">Saldo inicial</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Entradas</th><th className="hidden pb-2 text-right font-semibold sm:table-cell">Saídas</th><th className="pb-2 text-right font-semibold">Saldo atual</th></tr></thead>
              <tbody>
                {pos.contas.map((c) => (
                  <tr key={c.contaId ?? 'sem'} className="border-t border-black/[0.04]">
                    <td className="py-2.5 font-medium text-ink-soft">{c.nome}</td>
                    <td className="py-2.5 text-right text-ink-muted">{formatMoney(c.saldoInicial)}</td>
                    <td className="hidden py-2.5 text-right text-emerald-600 sm:table-cell">{c.entradas ? '+' + formatMoney(c.entradas) : '—'}</td>
                    <td className="hidden py-2.5 text-right text-red-600 sm:table-cell">{c.saidas ? '−' + formatMoney(c.saidas) : '—'}</td>
                    <td className={`py-2.5 text-right font-bold ${c.saldoAtual >= 0 ? 'text-ink' : 'text-red-600'}`}>{formatMoney(c.saldoAtual)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-black/[0.1] font-bold"><td className="py-2.5 text-ink">Consolidado</td><td className="py-2.5 text-right text-ink-muted">{formatMoney(pos.saldoInicial)}</td><td className="hidden py-2.5 text-right text-emerald-600 sm:table-cell">+{formatMoney(pos.entradas)}</td><td className="hidden py-2.5 text-right text-red-600 sm:table-cell">−{formatMoney(pos.saidas)}</td><td className={`py-2.5 text-right ${pos.saldoAtual >= 0 ? 'text-ink' : 'text-red-600'}`}>{formatMoney(pos.saldoAtual)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </Section>

      <Section title="Projeção de fluxo de caixa" hint="Próximos 12 meses · entradas (parcelas a receber) vs saídas (despesas em aberto), partindo do saldo atual">
        <FluxoBarsChart dados={chart} />
      </Section>

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal.id ? 'Editar conta' : 'Nova conta bancária'}</h3>
            <div className="space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome</span><input value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} className={inp} placeholder="Conta principal" autoFocus /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Banco</span><input value={modal.banco} onChange={(e) => setModal({ ...modal, banco: e.target.value })} className={inp} placeholder="ex.: Itaú" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span><select value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value })} className={inp}>{TIPOS_CONTA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Saldo inicial</span><input type="number" step="0.01" value={modal.saldo_inicial_num} onChange={(e) => setModal({ ...modal, saldo_inicial_num: e.target.value })} className={inp} placeholder="0,00" /></label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
