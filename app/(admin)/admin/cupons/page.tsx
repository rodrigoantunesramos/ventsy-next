'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'

type Cupom = {
  id: string
  codigo: string
  descricao: string | null
  tipo: string
  valor: number
  plano: string
  limite: number | null
  usos_atual: number
  validade: string | null
  ativo: boolean
  expirado: boolean
}

const FORM_VAZIO = { codigo: '', valor: '', tipo: 'percent', plano: 'todos', limite: '', validade: '', descricao: '' }
const inp =
  'mb-3 w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]'

export default function AdminCupons() {
  const [rows, setRows] = useState<Cupom[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState({ ...FORM_VAZIO })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch('/api/admin/cupons')
      if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
      const j = await r.json()
      setRows(j.cupons ?? [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function acao(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch('/api/admin/cupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert(j.error || 'Erro ao executar a ação.')
      return false
    }
    return true
  }

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!form.codigo || !form.valor) {
      alert('Informe código e valor.')
      return
    }
    setSalvando(true)
    const ok = await acao({
      action: 'criar',
      codigo: form.codigo,
      valor: Number(form.valor),
      tipo: form.tipo,
      plano: form.plano,
      limite: form.limite ? Number(form.limite) : null,
      validade: form.validade || null,
      descricao: form.descricao,
    })
    setSalvando(false)
    if (ok) {
      setForm({ ...FORM_VAZIO })
      carregar()
    }
  }

  async function excluir(c: Cupom) {
    if (confirm(`Excluir cupom ${c.codigo}?`) && (await acao({ action: 'excluir', id: c.id }))) carregar()
  }

  const set = (campo: keyof typeof FORM_VAZIO) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <div className="max-w-6xl p-8">
      <h1 className="text-2xl font-bold">Cupons &amp; Créditos</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">Crie e gerencie cupons de desconto para os planos.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
        <form onSubmit={criar} className="h-fit rounded-2xl border border-white/[0.07] bg-[#111118] p-6">
          <div className="mb-4 font-bold">Novo cupom</div>
          <Label>Código</Label>
          <input value={form.codigo} onChange={set('codigo')} placeholder="VENTSY30" className={`${inp} uppercase tracking-widest`} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor</Label>
              <input type="number" value={form.valor} onChange={set('valor')} placeholder="30" className={inp} />
            </div>
            <div>
              <Label>Tipo</Label>
              <select value={form.tipo} onChange={set('tipo')} className={inp}>
                <option value="percent">% Percentual</option>
                <option value="fixo">R$ Fixo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plano</Label>
              <select value={form.plano} onChange={set('plano')} className={inp}>
                <option value="todos">Todos</option>
                <option value="pro">Pro</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
            <div>
              <Label>Limite de usos</Label>
              <input type="number" value={form.limite} onChange={set('limite')} placeholder="∞" className={inp} />
            </div>
          </div>
          <Label>Validade</Label>
          <input type="date" value={form.validade} onChange={set('validade')} className={inp} />
          <Label>Descrição (interna)</Label>
          <input value={form.descricao} onChange={set('descricao')} placeholder="Ex.: lançamento abril" className={inp} />
          <button
            type="submit"
            disabled={salvando}
            className="mt-2 w-full rounded-lg bg-[#ff385c] px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {salvando ? 'Criando…' : 'Criar cupom'}
          </button>
        </form>

        <div>
          {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
          {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}
          {!loading && !erro && rows.length === 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-10 text-center text-[#5c5c78]">
              Nenhum cupom criado ainda.
            </div>
          )}
          <div className="space-y-3">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#111118] p-4">
                <div>
                  <div className="font-bold tracking-widest">{c.codigo}</div>
                  <div className="text-[0.75rem] text-[#a0a0b8]">
                    {c.tipo === 'percent' ? `${c.valor}% off` : `R$ ${c.valor} off`} ·{' '}
                    {c.plano === 'todos' ? 'Todos' : c.plano} ·{' '}
                    {c.validade ? new Date(c.validade).toLocaleDateString('pt-BR') : '∞'} · {c.usos_atual}/{c.limite ?? '∞'} usos
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[0.72rem] ${
                      c.expirado || !c.ativo ? 'bg-[#ff385c]/15 text-[#ff385c]' : 'bg-[#3ddc84]/15 text-[#3ddc84]'
                    }`}
                  >
                    {c.expirado ? 'Expirado' : c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <button onClick={() => excluir(c)} className="text-[0.75rem] text-[#ff385c] hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">{children}</div>
}
