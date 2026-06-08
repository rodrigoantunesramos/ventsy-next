'use client'

// Aba Conciliação bancária — importa extrato (OFX/CSV), casa automaticamente
// com `lancamentos` por valor/sinal/data (engine pura), grava em
// conciliacao_extrato e marca os lançamentos conciliados. Permite conciliar
// manualmente os pendentes, ignorar e reverter. Saldo conciliado vs. contábil.

import { useMemo, useRef, useState } from 'react'
import { supabaseAny as sb } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { formatDate, formatMoney, formatMoneyShort } from '@/lib/format'
import {
  conciliarAuto, parseCSVExtrato, parseOFX, posicaoPorConta,
  type ContaBancaria, type ExtratoLinha, type Lancamento, type MatchConciliacao,
} from '@/lib/contabilidade'
import { btnPrimary, type ExtratoRow } from '../_lib'
import { IcoCheck, IcoLink, IcoUpload, KpiCard, Section } from './ui'

type Props = { userId: string; lancamentos: Lancamento[]; bancos: ContaBancaria[]; extrato: ExtratoRow[]; recarregar: () => Promise<void> }

const STATUS_CHIP: Record<string, string> = {
  conciliado: 'bg-emerald-50 text-emerald-700', pendente: 'bg-amber-50 text-amber-700', ignorado: 'bg-black/[0.05] text-ink-muted',
}
const STATUS_LABEL: Record<string, string> = { conciliado: 'Conciliado', pendente: 'Pendente', ignorado: 'Ignorado' }

export default function Conciliacao({ userId, lancamentos, bancos, extrato, recarregar }: Props) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [contaSel, setContaSel] = useState<string>(bancos[0]?.id ?? '')
  const [preview, setPreview] = useState<ExtratoLinha[] | null>(null)
  const [matches, setMatches] = useState<MatchConciliacao[]>([])
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState<ExtratoRow | null>(null)

  // Lançamentos já amarrados a alguma linha do extrato (não recasar).
  const jaUsados = useMemo(() => extrato.map((e) => e.lancamento_id).filter((x): x is number => x != null), [extrato])
  const lancById = useMemo(() => new Map(lancamentos.map((l) => [l.id, l])), [lancamentos])
  const pos = useMemo(() => posicaoPorConta(bancos, lancamentos), [bancos, lancamentos])

  async function onFile(file: File) {
    const text = await file.text()
    const ehOfx = /\.ofx$/i.test(file.name) || /<OFX>|<STMTTRN>/i.test(text)
    const linhas = ehOfx ? parseOFX(text) : parseCSVExtrato(text)
    if (!linhas.length) { toast.error('Não foi possível ler transações do arquivo.'); return }
    const m = conciliarAuto(linhas, lancamentos, { jaUsados })
    setPreview(linhas); setMatches(m)
    const casados = m.filter((x) => x.lancamentoId != null).length
    toast.info(`${linhas.length} transações lidas · ${casados} casadas automaticamente.`)
  }

  async function importar() {
    if (!preview) return
    setBusy(true)
    const rows = preview.map((ex, i) => ({
      usuario_id: userId, conta_bancaria_id: contaSel || null, data: ex.data, descricao: ex.descricao,
      valor_num: ex.valor, lancamento_id: matches[i]?.lancamentoId ?? null,
      status: matches[i]?.lancamentoId ? 'conciliado' : 'pendente',
    }))
    const { error } = await sb.from('conciliacao_extrato').insert(rows)
    if (!error) {
      const ids = rows.filter((r) => r.lancamento_id).map((r) => r.lancamento_id)
      if (ids.length) await sb.from('lancamentos').update({ conciliado: true }).in('id', ids)
    }
    setBusy(false)
    if (error) { toast.error('Erro ao importar o extrato.'); return }
    toast.success('Extrato importado e conciliado.'); setPreview(null); setMatches([]); await recarregar()
  }

  async function setStatus(row: ExtratoRow, status: 'ignorado' | 'pendente', lancamentoId: number | null = row.lancamento_id) {
    const { error } = await sb.from('conciliacao_extrato').update({ status, lancamento_id: lancamentoId }).eq('id', row.id)
    if (error) { toast.error('Erro ao atualizar.'); return }
    await recarregar()
  }

  async function reverter(row: ExtratoRow) {
    const { error } = await sb.from('conciliacao_extrato').delete().eq('id', row.id)
    if (!error && row.lancamento_id) await sb.from('lancamentos').update({ conciliado: false }).eq('id', row.lancamento_id)
    if (error) { toast.error('Erro ao reverter.'); return }
    toast.success('Linha removida do extrato.'); await recarregar()
  }

  async function conciliarManual(row: ExtratoRow, lancId: number) {
    const { error } = await sb.from('conciliacao_extrato').update({ status: 'conciliado', lancamento_id: lancId }).eq('id', row.id)
    if (!error) await sb.from('lancamentos').update({ conciliado: true }).eq('id', lancId)
    if (error) { toast.error('Erro ao conciliar.'); return }
    toast.success('Conciliado.'); setManual(null); await recarregar()
  }

  // Candidatos para conciliação manual: mesmo sinal, valor próximo, ainda livres.
  const candidatos = useMemo(() => {
    if (!manual) return []
    const tipo = manual.valor_num >= 0 ? 'receita' : 'despesa'
    const alvo = Math.abs(manual.valor_num)
    return lancamentos
      .filter((l) => l.tipo === tipo && !jaUsados.includes(l.id) && !l.conciliado)
      .map((l) => ({ l, d: Math.abs(Math.abs(l.valor) - alvo) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8)
      .map((x) => x.l)
  }, [manual, lancamentos, jaUsados])

  const casadosPreview = matches.filter((m) => m.lancamentoId != null).length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo contábil" value={formatMoneyShort(pos.saldoAtual)} sub="livro (lançamentos pagos)" tone="azul" />
        <KpiCard label="Saldo conciliado" value={formatMoneyShort(pos.conciliado)} sub="conferido com extrato" tone="verde" />
        <KpiCard label="Diferença" value={formatMoneyShort(pos.saldoAtual - pos.conciliado)} sub="a conciliar" tone={Math.abs(pos.saldoAtual - pos.conciliado) < 0.01 ? 'verde' : 'gold'} />
        <KpiCard label="Linhas pendentes" value={String(extrato.filter((e) => e.status === 'pendente').length)} sub="sem correspondência" tone="ink" />
      </div>

      <Section title="Importar extrato" hint="Arquivo OFX (do internet banking) ou CSV (data, descrição, valor)">
        <div className="flex flex-wrap items-end gap-3">
          {bancos.length > 0 && (
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Conta bancária</span>
              <select value={contaSel} onChange={(e) => setContaSel(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none">
                <option value="">— sem vínculo —</option>{bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </label>
          )}
          <button onClick={() => fileRef.current?.click()} className={btnPrimary}><IcoUpload /> Selecionar arquivo</button>
          <input ref={fileRef} type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        </div>

        {preview && (
          <div className="mt-4 rounded-xl border border-black/[0.06]">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">Pré-visualização · {casadosPreview}/{preview.length} casadas</span>
              <div className="flex gap-2">
                <button onClick={() => { setPreview(null); setMatches([]) }} className="text-xs font-medium text-ink-muted hover:text-ink">Cancelar</button>
                <button onClick={importar} disabled={busy} className={btnPrimary}>{busy ? 'Importando…' : 'Importar e conciliar'}</button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="px-4 py-2 font-semibold">Data</th><th className="py-2 font-semibold">Descrição</th><th className="py-2 text-right font-semibold">Valor</th><th className="px-4 py-2 font-semibold">Correspondência</th></tr></thead>
                <tbody>
                  {preview.map((ex, i) => {
                    const m = matches[i]; const lanc = m?.lancamentoId ? lancById.get(m.lancamentoId) : null
                    return (
                      <tr key={i} className="border-b border-black/[0.04]">
                        <td className="whitespace-nowrap px-4 py-2 text-ink-muted">{formatDate(ex.data, { style: 'short' })}</td>
                        <td className="py-2 text-ink-soft">{ex.descricao || '—'}</td>
                        <td className={`py-2 text-right font-medium ${ex.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{ex.valor >= 0 ? '+' : '−'}{formatMoney(ex.valor)}</td>
                        <td className="px-4 py-2">{lanc ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><IcoCheck /> {lanc.descricao || lanc.categoria || 'Lançamento'}</span> : <span className="text-xs text-amber-600">sem correspondência</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title="Extrato importado" hint={`${extrato.length} linha(s)`}>
        {!extrato.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhuma linha de extrato importada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">Data</th><th className="pb-2 font-semibold">Descrição</th><th className="pb-2 text-right font-semibold">Valor</th><th className="pb-2 font-semibold">Status</th><th className="pb-2" /></tr></thead>
              <tbody>
                {extrato.map((row) => {
                  const lanc = row.lancamento_id ? lancById.get(row.lancamento_id) : null
                  return (
                    <tr key={row.id} className="group border-b border-black/[0.04]">
                      <td className="whitespace-nowrap py-2 text-ink-muted">{formatDate(row.data, { style: 'short' })}</td>
                      <td className="py-2 text-ink-soft">{row.descricao || '—'}{lanc && <span className="ml-1 text-xs text-ink-muted">→ {lanc.descricao || lanc.categoria}</span>}</td>
                      <td className={`py-2 text-right font-medium ${row.valor_num >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.valor_num >= 0 ? '+' : '−'}{formatMoney(row.valor_num)}</td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${STATUS_CHIP[row.status]}`}>{STATUS_LABEL[row.status]}</span></td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          {row.status === 'pendente' && <button onClick={() => setManual(row)} className="rounded-lg border border-black/10 px-2 py-1 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoLink /></button>}
                          {row.status === 'pendente' && <button onClick={() => setStatus(row, 'ignorado')} className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink">Ignorar</button>}
                          <button onClick={() => reverter(row)} className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-red-600">Remover</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {manual && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setManual(null) }}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setManual(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-1 font-display text-xl font-bold text-ink">Conciliar manualmente</h3>
            <p className="mb-4 text-sm text-ink-muted">{manual.descricao} · <span className={manual.valor_num >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatMoney(manual.valor_num)}</span></p>
            {!candidatos.length ? <p className="py-6 text-center text-sm text-ink-muted">Nenhum lançamento livre compatível. Lance no Financeiro e tente de novo.</p> : (
              <div className="space-y-1.5">
                {candidatos.map((l) => (
                  <button key={l.id} onClick={() => conciliarManual(manual, l.id)} className="flex w-full items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2.5 text-left text-sm hover:border-brand/30 hover:bg-brand-50/40">
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium text-ink-soft">{l.descricao || l.categoria || 'Lançamento'}</span> <span className="text-xs text-ink-muted">{formatDate(l.data, { style: 'short' })}</span></span>
                    <span className={`ml-2 shrink-0 font-semibold ${l.tipo === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(l.valor)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
