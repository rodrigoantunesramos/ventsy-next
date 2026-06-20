import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'

// Rota server-side: usa service-role (ignora RLS) para inserir avaliação e
// atualizar a média em propriedades (UPDATE bloqueado para anon sob RLS).
const supabase = supabaseAdmin

// Recalcula a média pública da propriedade considerando só avaliações
// verificadas e NÃO ocultas (a moderação do dono reflete no número público).
async function recomputarMedia(propriedadeId: number | string) {
  const { data: todas } = await supabase
    .from('avaliacoes')
    .select('nota')
    .eq('propriedade_id', Number(propriedadeId))
    .eq('verificada', true)
    .eq('oculta', false)
  const lista = (todas || []) as { nota: number }[]
  const media = lista.length
    ? parseFloat((lista.reduce((s, a) => s + a.nota, 0) / lista.length).toFixed(1))
    : 0
  await supabase.from('propriedades').update({ avaliacao: media }).eq('id', Number(propriedadeId))
}

// GET /api/avaliacoes?propriedade_id=xxx — avaliações de uma propriedade (público)
// GET /api/avaliacoes?user_id=xxx — avaliações do próprio usuário (requer auth)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const propriedadeId = searchParams.get('propriedade_id')
  const userId        = searchParams.get('user_id')

  // Avaliações verificadas de uma propriedade — público
  if (propriedadeId) {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('propriedade_id', Number(propriedadeId))
      .eq('verificada', true)
      .order('criado_em', { ascending: false })
    return Response.json({ data, error })
  }

  // Avaliações feitas pelo cliente — somente as próprias
  if (userId !== null) {
    const user = await getAuthUser(req)
    if (!user) return unauthorized()
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*, propriedade:propriedades(id,nome,cidade,estado,imagem_url)')
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
  const { data: existing } = await supabase
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

  const { data, error } = await supabase
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
    await recomputarMedia(propriedade_id)
  }

  return Response.json({ data, error })
}

// PATCH /api/avaliacoes — o DONO do espaço modera/responde uma avaliação.
// Ações (parciais): { id, resposta?, oculta?, destaque? }. A identidade é o JWT;
// a posse é verificada via propriedades.usuario_id (nunca confie no corpo).
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json()
  const id = Number(body.id)
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  // Carrega a avaliação e confirma que o espaço pertence ao usuário autenticado.
  const { data: aval } = await supabase
    .from('avaliacoes')
    .select('id, propriedade_id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!aval) return Response.json({ error: 'Avaliação não encontrada.' }, { status: 404 })

  const { data: prop } = await supabase
    .from('propriedades')
    .select('usuario_id')
    .eq('id', aval.propriedade_id as number)
    .maybeSingle()
  if (!prop || prop.usuario_id !== user.id) return forbidden()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {}
  if ('resposta' in body) {
    const r = (body.resposta ?? '').toString().trim()
    patch.resposta = r || null
    patch.respondido_em = r ? new Date().toISOString() : null
  }
  if ('oculta' in body) patch.oculta = !!body.oculta
  if ('destaque' in body) patch.destaque = !!body.destaque
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('avaliacoes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  // Ocultar/reexibir altera o número público — recalcular a média do espaço.
  if (!error && 'oculta' in body) {
    await recomputarMedia(aval.propriedade_id as number)
  }

  // Notifica o autor quando o dono responde a avaliação (fecha o loop de relacionamento).
  if (!error && 'resposta' in body && patch.resposta && aval.user_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notificacoes').insert({
        usuario_id: aval.user_id, tipo: 'avaliacao', titulo: 'O anfitrião respondeu sua avaliação',
        corpo: String(patch.resposta).slice(0, 140), link: '/client/avaliacoes',
        urgencia: 'info', origem: 'avaliacoes', lida: false,
      })
    } catch { /* best-effort: a resposta já foi salva */ }
  }

  return Response.json({ data, error })
}
