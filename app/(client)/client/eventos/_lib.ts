// Helpers da área do contratante (Portal do Cliente).
import { authHeaders } from '@/lib/supabase'

// Chama a rota op-based do cliente com o JWT anexado. Único ponto de acesso do
// contratante aos dados do evento (o servidor valida o acesso via portal_acessos).
export async function portalClienteApi(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetch('/api/portal/cliente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((json as { error?: string }).error || 'Falha na operação.') as Error & { code?: string; status?: number }
    err.code = (json as { code?: string }).code
    err.status = res.status
    throw err
  }
  return json as Record<string, unknown>
}

export type EventoResumo = {
  acesso_id: string
  evento_id: string
  nome_evento: string | null
  tipo_evento: string | null
  data_inicio: string | null
  data_fim: string | null
  status: string | null
  propriedade: { nome: string | null; cidade: string | null; estado: string | null } | null
  portal_ativo: boolean
}

export type ParcelaCli = {
  id: number
  numero: number | null
  descricao: string | null
  valor: number
  vencimento: string | null
  status: string | null
  pago_em: string | null
  metodo_pagamento: string | null
}

export type ContratoCli = {
  id: string
  numero: string | null
  titulo: string | null
  status: string | null
  link_token: string | null
  assinado_em: string | null
  valor_num: number | null
  moeda: string | null
} | null

export type ConvidadoCli = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  status: string
  acompanhantes: number
  mesa: string | null
  restricao_alimentar: string | null
  observacao: string | null
  origem: string
}
