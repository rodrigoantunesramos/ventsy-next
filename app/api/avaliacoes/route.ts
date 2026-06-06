import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// Rota server-side: usa service-role (ignora RLS) para inserir avaliação e
// atualizar a média em propriedades (UPDATE bloqueado para anon sob RLS).
const supabase = supabaseAdmin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabaseAdmin as any

// GET /api/avaliacoes?propriedade_id=xxx — avaliações de uma propriedade (público)
// GET /api/avaliacoes?user_id=xxx — avaliações do próprio usuário (requer auth)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const propriedadeId = searchParams.get('propriedade_id')
  const userId        = searchParams.get('user_id')

  // Avaliações verificadas de uma propriedade — público
  if (propriedadeId) {
    const { data, error } = await supabaseAny
      .from('avaliacoes')
      .select('*')
      .eq('propriedade_id', propriedadeId)
      .eq('verificada', true)
      .order('criado_em', { ascending: false })
    return Response.json({ data, error })
  }

  // Avaliações feitas pelo cliente — somente as próprias
  if (userId !== null) {
    const user = await getAuthUser(req)
    if (!user) return unauthorized()
    const { data, error } = await supabaseAny
      .from('avaliacoes')
      .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false })
    return Response.json({ data, error })
  }

  return Response.json({ error: 'user_id ou propriedade_id obrigatório' }, { status: 400 })
}

// POST /api/avaliacoes — cliente autenticado envia nova avaliação.
// O autor é SEMPRE o usuário autenticado — user_id do cliente é ignorado.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json()
  const { propriedade_id, nota, texto, autor, avatar, evento_tipo } = body
  const user_id = user.id

  if (!propriedade_id || !nota) {
    return Response.json(
      { error: 'propriedade_id e nota são obrigatórios' },
      { status: 400 },
    )
  }

  if (nota < 1 || nota > 5) {
    return Response.json({ error: 'Nota deve ser entre 1 e 5' }, { status: 400 })
  }

  // Verificar se o usuário já avaliou esta propriedade
  const { data: existing } = await supabaseAny
    .from('avaliacoes')
    .select('id')
    .eq('user_id', user_id)
    .eq('propriedade_id', propriedade_id)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'Você já avaliou este espaço.' }, { status: 409 })
  }

  // Formatar data em português para compatibilidade com campo legado
  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  const { data, error } = await supabaseAny
    .from('avaliacoes')
    .insert({
      user_id,
      propriedade_id,
      nota,
      texto:       texto || '',
      autor:       autor || 'Usuário Ventsy',
      avatar:      avatar || '',
      verificada:  true,   // Cliente autenticado = verificado
      evento_tipo: evento_tipo || null,
      data:        dataFormatada,
    })
    .select()
    .single()

  if (!error) {
    // Recalcular média da propriedade
    const { data: todas } = await supabaseAny
      .from('avaliacoes')
      .select('nota')
      .eq('propriedade_id', propriedade_id)
      .eq('verificada', true)

    if (todas && todas.length > 0) {
      const media = todas.reduce((s: number, a: any) => s + a.nota, 0) / todas.length
      await supabase
        .from('propriedades')
        .update({ avaliacao: parseFloat(media.toFixed(1)) })
        .eq('id', Number(propriedade_id))
    }
  }

  return Response.json({ data, error })
}
