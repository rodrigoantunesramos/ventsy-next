'use client'

import { useEffect, useState } from 'react'

const SEGMENTOS = [
  { v: 'todos', label: 'Todos os usuários' },
  { v: 'ativos', label: 'Assinantes ativos' },
  { v: 'trial', label: 'Em trial' },
  { v: 'sem_plano', label: 'Sem plano ativo' },
  { v: 'incompletos', label: 'Cadastros incompletos' },
]

export default function AdminComunicacao() {
  const [segmento, setSegmento] = useState('todos')
  const [total, setTotal] = useState<number | null>(null)
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  useEffect(() => {
    setTotal(null)
    fetch(`/api/admin/comunicacao?segmento=${segmento}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j) => setTotal(j.total ?? 0))
      .catch(() => setTotal(null))
  }, [segmento])

  async function enviar() {
    if (!assunto.trim() || !mensagem.trim()) {
      alert('Preencha assunto e mensagem.')
      return
    }
    const seg = SEGMENTOS.find((s) => s.v === segmento)?.label
    if (!confirm(`Enviar para "${seg}" (${total ?? '?'} destinatários)?`)) return
    setEnviando(true)
    setResultado(null)
    try {
      const r = await fetch('/api/admin/comunicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, assunto, mensagem }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setResultado(j.error || 'Erro ao enviar.')
        return
      }
      if (j.skipped > 0 && j.enviados === 0) {
        setResultado(
          `E-mail (SMTP) não configurado — ${j.skipped} mensagem(ns) não enviada(s). Configure o SMTP para ativar o envio.`,
        )
      } else {
        const aviso = j.total > 300 ? ' (limitado a 300; use Campanhas para envios em massa)' : ''
        setResultado(`Enviados: ${j.enviados} · Falhas: ${j.falhas} · Ignorados: ${j.skipped}, de ${j.total} destinatário(s)${aviso}.`)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Comunicação</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">Envie um aviso por e-mail a um segmento de usuários.</p>

      <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#111118] p-6">
        <div>
          <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Segmento</div>
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
          >
            {SEGMENTOS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[0.72rem] text-[#5c5c78]">
            {total === null ? 'Calculando destinatários…' : `${total} destinatário(s) com e-mail.`}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Assunto</div>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
          />
        </div>

        <div>
          <div className="mb-1 text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">Mensagem</div>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={8}
            className="w-full resize-y rounded-lg border border-white/[0.08] bg-[#1a1a24] px-3.5 py-2 text-sm outline-none focus:border-[#ff385c]"
          />
        </div>

        <button
          onClick={enviar}
          disabled={enviando}
          className="rounded-lg bg-[#ff385c] px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar aviso'}
        </button>

        {resultado && (
          <div className="rounded-lg border border-white/[0.08] bg-[#0d0d13] px-4 py-3 text-sm text-[#a0a0b8]">{resultado}</div>
        )}
      </div>

      <div className="mt-6 text-[0.78rem] text-[#5c5c78]">
        Para campanhas grandes e segmentadas (RFM, agendamento, WhatsApp), use o módulo Campanhas do painel — este envio
        é direto e limitado a 300 destinatários por disparo.
      </div>
    </div>
  )
}
