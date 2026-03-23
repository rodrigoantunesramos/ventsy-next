import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Retorna mapa usuario_id -> plano_ativo para assinaturas ativas.
 * Usado para exibir o plano da PROPRIEDADE (dono), independente de quem está vendo.
 * Service role bypassa RLS para funcionar com usuários deslogados.
 * Query ?usuario_id=xxx retorna apenas o plano daquele usuário.
 */
export async function GET(req: NextRequest) {
  if (!SUPA_URL || !SUPA_KEY) return NextResponse.json({ planos: {} })

  const supabase = createClient(SUPA_URL, SUPA_KEY)
  const usuarioId = req.nextUrl.searchParams.get('usuario_id')

  let query = supabase
    .from('assinaturas')
    .select('usuario_id, plano_ativo, status')
    .in('status', ['ativa', 'trial'])
  if (usuarioId) query = query.eq('usuario_id', usuarioId)
  const { data, error } = await query

  if (error) return NextResponse.json(usuarioId ? { plano: 'basico' } : { planos: {} })

  const planos: Record<string, string> = {}
  ;(data || []).forEach((a: { usuario_id: string; plano_ativo: string }) => {
    const p = (a.plano_ativo || 'basico').toLowerCase()
    if (['basico', 'pro', 'ultra'].includes(p)) planos[a.usuario_id] = p
  })

  if (usuarioId) return NextResponse.json({ plano: planos[usuarioId] || 'basico' })
  return NextResponse.json({ planos })
}
