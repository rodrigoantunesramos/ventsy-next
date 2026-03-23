'use client'

import { useState } from 'react'
import RatingStars from './RatingStars'
import type { ReviewFormData } from '@/types/client'

const TIPOS_EVENTO = [
  'Casamento', 'Aniversário', 'Festa Infantil', 'Debutante', 'Formatura',
  'Confraternização', 'Corporativo', 'Workshop', 'Show / Festival',
  'Batizado', 'Encontro Religioso', 'Provas Hípicas', 'Pescaria', 'Radical', 'Outro',
]

interface Props {
  propertyName?: string
  onSubmit: (data: ReviewFormData) => Promise<void>
  onClose: () => void
}

export default function ReviewForm({ propertyName, onSubmit, onClose }: Props) {
  const [nota,       setNota]       = useState(0)
  const [texto,      setTexto]      = useState('')
  const [eventoTipo, setEventoTipo] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const handleSubmit = async () => {
    if (nota === 0) { setError('Selecione uma nota de 1 a 5 estrelas.'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ nota, texto, evento_tipo: eventoTipo || undefined })
    } catch {
      setError('Erro ao enviar avaliação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-5"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[20px] p-7 w-full max-w-[480px] shadow-[0_20px_60px_rgba(0,0,0,.2)]">
        <h3 className="m-0 mb-5 text-[1.1rem] font-extrabold text-gray-900">
          📝 Avaliar espaço{propertyName ? ` — ${propertyName}` : ''}
        </h3>

        {/* Estrelas */}
        <div className="mb-4">
          <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Sua nota *</label>
          <RatingStars value={nota} onChange={setNota} size="lg" />
        </div>

        {/* Tipo de evento */}
        <div className="mb-4">
          <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Tipo de evento realizado</label>
          <select
            className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-xl text-[.88rem] font-[inherit] outline-none transition-colors focus:border-[#ff385c]"
            value={eventoTipo}
            onChange={e => setEventoTipo(e.target.value)}
          >
            <option value="">Selecione (opcional)</option>
            {TIPOS_EVENTO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Comentário */}
        <div className="mb-4">
          <label className="block text-[.82rem] font-semibold text-gray-600 mb-1.5">Comentário (opcional)</label>
          <textarea
            className="w-full px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-xl text-[.88rem] font-[inherit] outline-none transition-colors focus:border-[#ff385c] resize-y"
            rows={4}
            placeholder="Conte como foi sua experiência neste espaço..."
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={1000}
          />
          <div className="text-[.72rem] text-gray-300 text-right mt-0.5">{texto.length}/1000</div>
        </div>

        {error && (
          <div className="text-red-600 text-[.84rem] mb-3">{error}</div>
        )}

        <button
          className="w-full py-3 bg-[#ff385c] hover:bg-[#e0304f] text-white border-none rounded-xl text-[.95rem] font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default font-[inherit]"
          onClick={handleSubmit}
          disabled={saving || nota === 0}
        >
          {saving ? 'Enviando...' : '✅ Enviar avaliação'}
        </button>

        <div className="text-center mt-2">
          <button
            className="bg-transparent border-none text-gray-400 text-[.85rem] cursor-pointer p-2 font-[inherit] hover:text-gray-600 transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
