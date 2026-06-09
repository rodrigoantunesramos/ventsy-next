// Tipos e helpers da página do dono /painel/portal.
import { authHeaders } from '@/lib/supabase'
import type { ModulosMap } from '@/lib/portal'

export type PortalConfig = {
  usuario_id: string
  ativo: boolean
  cor: string
  boas_vindas: string | null
  modulos: ModulosMap
}

export type Acesso = {
  id: string
  usuario_id: string
  evento_id: string
  email: string
  token: string
  user_id: string | null
  status: 'convidado' | 'ativo' | 'revogado'
  modulos: ModulosMap | null
  boas_vindas: string | null
  criado_em: string
  aceito_em: string | null
  ultimo_acesso_em: string | null
}

export type EventoRow = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  email: string | null
  tipo_evento: string | null
  data_inicio: string | null
  status: string | null
  propriedade_id: number | null
  valor_total_num: number | null
}

export type ConvidadoRow = { id: string; evento_id: string; status: string | null }

// Chama a rota op-based do dono com o JWT anexado.
export async function portalApi(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action, ...payload }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Falha na operação.')
  return json as Record<string, unknown>
}

// Link de convite que o contratante usa para entrar (resolvido no client).
export function linkConvite(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ventsy.com.br'
  return `${origin}/client/eventos?convite=${token}`
}

export const STATUS_LABEL: Record<string, string> = {
  convidado: 'Convite enviado',
  ativo: 'Acesso ativo',
  revogado: 'Revogado',
}

export const STATUS_CHIP: Record<string, string> = {
  convidado: 'bg-amber-50 text-amber-700',
  ativo: 'bg-emerald-50 text-emerald-700',
  revogado: 'bg-red-50 text-red-700',
}
