// ─────────────────────────────────────────────────────────────────────────────
// VENTSY — Tipos da área do Cliente Final
// ─────────────────────────────────────────────────────────────────────────────

export interface PropertySummary {
  id: string
  nome: string
  cidade: string
  estado: string
  valor_base: number
  valor_hora: number
  avaliacao: number
  foto_capa: string
  imagem_url: string
  tipo_propriedade: string
  capacidade: string
  _plano?: 'basico' | 'pro' | 'ultra'
}

export interface Favorite {
  id: string
  user_id: string
  property_id: string
  created_at: string
  propriedade?: PropertySummary
}

export interface ClientReview {
  id: string
  user_id: string
  propriedade_id: string
  nota: number
  texto: string
  autor: string
  avatar?: string
  verificada: boolean
  evento_tipo?: string
  criado_em: string
  propriedade?: PropertySummary
}

export interface ReviewFormData {
  nota: number
  texto: string
  evento_tipo?: string
}

export interface Conversation {
  id: string
  user_id: string
  owner_id: string
  propriedade_id: string
  created_at: string
  ultima_mensagem?: string
  ultima_mensagem_em?: string
  propriedade?: PropertySummary
  owner_nome?: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  created_at: string
}
