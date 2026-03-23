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
    <div className="cl-modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cl-modal">
        <h3>📝 Avaliar espaço{propertyName ? ` — ${propertyName}` : ''}</h3>

        {/* Estrelas */}
        <div className="cl-form-grupo">
          <label>Sua nota *</label>
          <div style={{ marginTop: 4 }}>
            <RatingStars value={nota} onChange={setNota} size="lg" />
          </div>
        </div>

        {/* Tipo de evento */}
        <div className="cl-form-grupo">
          <label>Tipo de evento realizado</label>
          <select value={eventoTipo} onChange={e => setEventoTipo(e.target.value)}>
            <option value="">Selecione (opcional)</option>
            {TIPOS_EVENTO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Comentário */}
        <div className="cl-form-grupo">
          <label>Comentário (opcional)</label>
          <textarea
            rows={4}
            placeholder="Conte como foi sua experiência neste espaço..."
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={1000}
          />
          <div style={{ fontSize: '.72rem', color: '#bbb', textAlign: 'right', marginTop: 2 }}>
            {texto.length}/1000
          </div>
        </div>

        {error && (
          <div style={{ color: '#e53e3e', fontSize: '.84rem', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button className="cl-btn-primary" onClick={handleSubmit} disabled={saving || nota === 0}>
          {saving ? 'Enviando...' : '✅ Enviar avaliação'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button className="cl-btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
