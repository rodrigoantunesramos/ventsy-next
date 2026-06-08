'use client'

// Aba Plano de Contas — árvore editável agrupada, seed para locação de eventos,
// vínculo de lançamentos legados (por categoria) e import/export CSV.

import { useMemo, useState } from 'react'
import { supabaseAny as sb } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import type { DreLinha, Lancamento, PlanoConta } from '@/lib/contabilidade'
import {
  CONTA_TIPO_LABEL, DRE_LABELS, DRE_LINHAS, SEED_CONTAS, btnGhost, btnPrimary, inp,
} from '../_lib'
import { EmptyState, IcoEdit, IcoPlus, IcoTrash, IcoTree, Section } from './ui'

type Props = { userId: string; contas: PlanoConta[]; lancamentos: Lancamento[]; recarregar: () => Promise<void> }

const TIPO_CHIP: Record<string, string> = {
  receita: 'bg-emerald-50 text-emerald-700', despesa: 'bg-red-50 text-red-700',
  ativo: 'bg-blue-50 text-blue-700', passivo: 'bg-amber-50 text-amber-700', patrimonio: 'bg-violet-50 text-violet-700',
}
type Form = { id?: string; codigo: string; nome: string; tipo: PlanoConta['tipo']; grupo: string; dre_linha: DreLinha | ''; categoria_legada: string; ativo: boolean }
const novo = (): Form => ({ codigo: '', nome: '', tipo: 'despesa', grupo: '', dre_linha: 'despesas_operacionais', categoria_legada: '', ativo: true })

export default function PlanoContas({ userId, contas, lancamentos, recarregar }: Props) {
  const toast = useToast()
  const [modal, setModal] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // Conta usada por lançamentos não pode ser excluída sem perder o vínculo — só avisamos.
  const usoPorConta = useMemo(() => {
    const m = new Map<string, number>()
    lancamentos.forEach((l) => { if (l.conta_id) m.set(l.conta_id, (m.get(l.conta_id) || 0) + 1) })
    return m
  }, [lancamentos])

  const naoVinculados = useMemo(
    () => lancamentos.filter((l) => !l.conta_id && l.categoria && contas.some((c) => c.categoria_legada === l.categoria)).length,
    [lancamentos, contas],
  )

  const grupos = useMemo(() => {
    const m = new Map<string, PlanoConta[]>()
    contas.forEach((c) => { const k = c.grupo || CONTA_TIPO_LABEL[c.tipo] || 'Outras'; (m.get(k) || m.set(k, []).get(k)!).push(c) })
    return [...m.entries()].map(([grupo, arr]) => ({ grupo, contas: arr.sort((a, b) => a.codigo.localeCompare(b.codigo)) }))
  }, [contas])

  async function seed() {
    setBusy(true)
    const rows = SEED_CONTAS.map((c) => ({ usuario_id: userId, ...c }))
    const { error } = await sb.from('plano_contas').insert(rows)
    setBusy(false)
    if (error) { toast.error('Não foi possível criar o plano padrão.'); return }
    toast.success(`Plano de contas criado (${rows.length} contas).`)
    await recarregar()
  }

  async function autoVincular() {
    const byCat = new Map<string, string>()
    contas.forEach((c) => { if (c.categoria_legada) byCat.set(c.categoria_legada, c.id) })
    const grupos = new Map<string, number[]>()
    lancamentos.forEach((l) => {
      if (l.conta_id || !l.categoria) return
      const cid = byCat.get(l.categoria)
      if (!cid) return
      ;(grupos.get(cid) || grupos.set(cid, []).get(cid)!).push(l.id)
    })
    if (!grupos.size) { toast.info('Nenhum lançamento pendente para vincular.'); return }
    setBusy(true)
    let total = 0, falhou = false
    for (const [cid, ids] of grupos) {
      const { error } = await sb.from('lancamentos').update({ conta_id: cid }).in('id', ids)
      if (error) falhou = true; else total += ids.length
    }
    setBusy(false)
    if (falhou && !total) { toast.error('Não foi possível vincular (verifique meses fechados).'); return }
    toast.success(`${total} lançamento(s) vinculado(s) ao plano de contas.`)
    await recarregar()
  }

  async function salvar() {
    if (!modal) return
    if (!modal.codigo.trim() || !modal.nome.trim()) { toast.error('Informe código e nome da conta.'); return }
    setSaving(true)
    const ehResultado = modal.tipo === 'receita' || modal.tipo === 'despesa'
    const payload = {
      usuario_id: userId, codigo: modal.codigo.trim(), nome: modal.nome.trim(), tipo: modal.tipo,
      grupo: modal.grupo.trim() || null, dre_linha: ehResultado && modal.dre_linha ? modal.dre_linha : null,
      categoria_legada: modal.categoria_legada.trim() || null, ativo: modal.ativo,
    }
    const { error } = modal.id
      ? await sb.from('plano_contas').update(payload).eq('id', modal.id)
      : await sb.from('plano_contas').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar a conta (código duplicado?).'); return }
    toast.success(modal.id ? 'Conta atualizada.' : 'Conta criada.')
    setModal(null)
    await recarregar()
  }

  async function excluir(c: PlanoConta) {
    if (confirmDel !== c.id) { setConfirmDel(c.id); setTimeout(() => setConfirmDel((x) => (x === c.id ? null : x)), 3000); return }
    const { error } = await sb.from('plano_contas').delete().eq('id', c.id)
    if (error) { toast.error('Erro ao excluir.'); return }
    toast.success('Conta removida.'); setConfirmDel(null); await recarregar()
  }

  function exportarCSV() {
    const header = 'codigo,nome,tipo,grupo,dre_linha,categoria_legada,ativo\n'
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
    const rows = contas.map((c) => [c.codigo, esc(c.nome), c.tipo, esc(c.grupo || ''), c.dre_linha || '', esc(c.categoria_legada || ''), c.ativo ? '1' : '0'].join(',')).join('\n')
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plano-de-contas.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  async function importarCSV(file: File) {
    const text = await file.text()
    const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (linhas.length < 2) { toast.error('CSV vazio ou sem linhas.'); return }
    const rows: Record<string, unknown>[] = []
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
      if (!cols[0] || !cols[1]) continue
      const tipo = ['receita', 'despesa', 'ativo', 'passivo', 'patrimonio'].includes(cols[2]) ? cols[2] : 'despesa'
      rows.push({ usuario_id: userId, codigo: cols[0], nome: cols[1], tipo, grupo: cols[3] || null, dre_linha: cols[4] || null, categoria_legada: cols[5] || null, ativo: cols[6] !== '0' })
    }
    if (!rows.length) { toast.error('Nenhuma conta válida no CSV.'); return }
    setBusy(true)
    const { error } = await sb.from('plano_contas').upsert(rows, { onConflict: 'usuario_id,codigo' })
    setBusy(false)
    if (error) { toast.error('Erro ao importar.'); return }
    toast.success(`${rows.length} conta(s) importada(s).`); await recarregar()
  }

  if (!contas.length) {
    return (
      <Section>
        <EmptyState
          icon={<IcoTree />}
          title="Monte seu plano de contas"
          msg="Comece com um plano padrão pensado para locação de eventos (receitas de locação, custos diretos, despesas operacionais, impostos) — depois é só ajustar."
          action={<button onClick={seed} disabled={busy} className={btnPrimary}><IcoPlus /> {busy ? 'Criando…' : 'Criar plano padrão'}</button>}
        />
      </Section>
    )
  }

  return (
    <Section
      title="Plano de contas"
      hint={`${contas.length} contas`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {naoVinculados > 0 && <button onClick={autoVincular} disabled={busy} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Vincular {naoVinculados} lançamento(s)</button>}
          <label className={`${btnGhost} cursor-pointer`}>Importar<input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importarCSV(f); e.target.value = '' }} /></label>
          <button onClick={exportarCSV} className={btnGhost}>Exportar</button>
          <button onClick={() => setModal(novo())} className={btnPrimary}><IcoPlus /> Conta</button>
        </div>
      }
    >
      <div className="space-y-5">
        {grupos.map(({ grupo, contas: arr }) => (
          <div key={grupo}>
            <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted">{grupo}</h4>
            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              {arr.map((c, i) => (
                <div key={c.id} className={`group flex items-center gap-3 px-3 py-2.5 text-sm ${i ? 'border-t border-black/[0.05]' : ''} ${c.ativo === false ? 'opacity-50' : ''}`}>
                  <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">{c.codigo}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-soft">{c.nome}</span>
                  {c.dre_linha && <span className="hidden shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.65rem] text-ink-muted sm:inline">{DRE_LABELS[c.dre_linha]}</span>}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${TIPO_CHIP[c.tipo]}`}>{CONTA_TIPO_LABEL[c.tipo]}</span>
                  {usoPorConta.get(c.id) ? <span className="hidden w-14 shrink-0 text-right text-[0.65rem] text-ink-muted md:inline">{usoPorConta.get(c.id)} lanç.</span> : <span className="hidden w-14 shrink-0 md:inline" />}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setModal({ id: c.id, codigo: c.codigo, nome: c.nome, tipo: c.tipo, grupo: c.grupo || '', dre_linha: c.dre_linha || '', categoria_legada: c.categoria_legada || '', ativo: c.ativo !== false })} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => excluir(c)} title={confirmDel === c.id ? 'Confirmar' : 'Excluir'} className={`rounded px-1.5 py-1 text-xs font-bold ${confirmDel === c.id ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}>{confirmDel === c.id ? 'Confirmar?' : <IcoTrash />}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal.id ? 'Editar conta' : 'Nova conta'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Código</span><input value={modal.codigo} onChange={(e) => setModal({ ...modal, codigo: e.target.value })} className={inp} placeholder="3.1.01" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome</span><input value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} className={inp} placeholder="Locação de espaço" autoFocus /></label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span><select value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value as PlanoConta['tipo'] })} className={inp}>{Object.entries(CONTA_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Grupo</span><input value={modal.grupo} onChange={(e) => setModal({ ...modal, grupo: e.target.value })} className={inp} placeholder="Receitas" /></label>
              </div>
              {(modal.tipo === 'receita' || modal.tipo === 'despesa') && (
                <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Linha do DRE</span><select value={modal.dre_linha} onChange={(e) => setModal({ ...modal, dre_linha: e.target.value as DreLinha | '' })} className={inp}><option value="">—</option>{DRE_LINHAS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}</select></label>
              )}
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Categoria legada <span className="font-normal text-ink-muted">(auto-vínculo)</span></span><input value={modal.categoria_legada} onChange={(e) => setModal({ ...modal, categoria_legada: e.target.value })} className={inp} placeholder="ex.: Buffet / Catering" /></label>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={modal.ativo} onChange={(e) => setModal({ ...modal, ativo: e.target.checked })} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" /><span className="text-sm font-medium text-ink-soft">Conta ativa</span></label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
