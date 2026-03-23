import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/avaliacoes?user_id=xxx — avaliações feitas pelo cliente
// GET /api/avaliacoes?propriedade_id=xxx — avaliações de uma propriedade (verificadas)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId       = searchParams.get('user_id')
  const propriedadeId = searchParams.get('propriedade_id')

  if (userId) {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*, propriedade:propriedades(id,nome,cidade,estado,foto_capa,imagem_url)')
      .eq('user_id', userId)
      .order('criado_em', { ascending: false })
    return Response.json({ data, error })
  }

  if (propriedadeId) {
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('propriedade_id', propriedadeId)
      .eq('verificada', true)
      .order('criado_em', { ascending: false })
    return Response.json({ data, error })
  }

  return Response.json({ error: 'user_id ou propriedade_id obrigatório' }, { status: 400 })
}

// POST /api/avaliacoes — cliente envia nova avaliação
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { user_id, propriedade_id, nota, texto, autor, avatar, evento_tipo } = body

  if (!user_id || !propriedade_id || !nota) {
    return Response.json(
      { error: 'user_id, propriedade_id e nota são obrigatórios' },
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
      verificada:  true,   // Cliente cadastrado = verificado
      evento_tipo: evento_tipo || null,
      data:        dataFormatada,
    })
    .select()
    .single()

  if (!error) {
    // Recalcular média da propriedade
    const { data: todas } = await supabase
      .from('avaliacoes')
      .select('nota')
      .eq('propriedade_id', propriedade_id)
      .eq('verificada', true)

    if (todas && todas.length > 0) {
      const media = todas.reduce((s: number, a: any) => s + a.nota, 0) / todas.length
      await supabase
        .from('propriedades')
        .update({ avaliacao: parseFloat(media.toFixed(1)) })
        .eq('id', propriedade_id)
    }
  }

  return Response.json({ data, error })
}
