import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// GET /api/conversas — conversas do usuário autenticado, nos DOIS papéis:
// como hóspede (user_id) e como anfitrião (owner_id). Cada item traz `papel` e,
// para o dono, a `contraparte` (o cliente) — já que a propriedade é dele mesmo.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('conversas')
    .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
    .or(`user_id.eq.${user.id},owner_id.eq.${user.id}`)
    .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return Response.json({ data: null, error })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista = (data || []) as Record<string, any>[]

  // Para as conversas em que sou o DONO, resolvo o nome do cliente (user_id).
  const clienteIds = [...new Set(
    lista.filter((c) => c.owner_id === user.id).map((c) => c.user_id).filter(Boolean),
  )]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomePorId = new Map<string, any>()
  if (clienteIds.length) {
    const { data: us } = await sb.from('usuarios').select('id, nome').in('id', clienteIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(us || []).forEach((u: any) => nomePorId.set(u.id, { id: u.id, nome: u.nome }))
  }

  const out = lista.map((c) => ({
    ...c,
    papel: c.owner_id === user.id ? 'dono' : 'cliente',
    contraparte: c.owner_id === user.id
      ? (nomePorId.get(c.user_id) ?? { id: c.user_id, nome: null })
      : null,
  }))

  return Response.json({ data: out, error: null })
}

// POST /api/conversas — iniciar ou obter conversa para o usuário autenticado.
// owner_id é derivado da propriedade no servidor — nunca confiado do cliente.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { propriedade_id } = await req.json()

  if (!propriedade_id) {
    return Response.json({ error: 'propriedade_id é obrigatório' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prop } = await (supabase as any)
    .from('propriedades')
    .select('usuario_id')
    .eq('id', propriedade_id)
    .maybeSingle()

  if (!prop) {
    return Response.json({ error: 'Propriedade não encontrada' }, { status: 404 })
  }

  // Verificar se já existe
  const { data: existing } = await supabase
    .from('conversas')
    .select('*')
    .eq('user_id', user.id)
    .eq('propriedade_id', propriedade_id)
    .maybeSingle()

  if (existing) return Response.json({ data: existing, error: null })

  const { data, error } = await supabase
    .from('conversas')
    .insert({ user_id: user.id, owner_id: prop.usuario_id, propriedade_id })
    .select()
    .single()

  return Response.json({ data, error })
}
