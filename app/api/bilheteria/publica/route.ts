import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ocupadosPorCategoria } from '../_shared'
import { disponivel, statusCategoria, bilheteriaAVenda, validarCupom, type Categoria } from '@/lib/bilheteria'

// Acesso PÚBLICO da bilheteria (comprador SEM login) — resolvido pelo
// `pagina_token` via service-role (ignora RLS de propósito; o token É a
// credencial do link). Não vaza dados sensíveis do dono.
//   GET  ?token=…                    → bilheteria + categorias à venda + disponível
//   POST { token, action:'validar_cupom', codigo } → valida um cupom
//
// O checkout (criação de pedido + pagamento) é a rota /api/bilheteria/checkout.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 })

  const { data: bilh, error } = await admin.from('bilheteria_eventos').select('*').eq('pagina_token', token).maybeSingle()
  if (error || !bilh) return Response.json({ error: 'Bilheteria não encontrada.' }, { status: 404 })

  const { data: catsRaw } = await admin
    .from('ingressos_categorias')
    .select('*')
    .eq('bilheteria_id', bilh.id)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  const categorias = (catsRaw || []) as Categoria[]

  const nowMs = Date.now()
  const ocupados = await ocupadosPorCategoria(admin, categorias.map((c) => c.id))

  // Enrique cada categoria com disponibilidade (sem expor `vendido` cru/usuario).
  const catsPublic = categorias.map((c) => {
    const ocup = ocupados[c.id] || 0
    const st = statusCategoria(c, ocup, nowMs)
    const disp = disponivel(c, ocup)
    return {
      id: c.id, nome: c.nome, descricao: c.descricao, preco_num: Number(c.preco_num) || 0,
      lote: c.lote, lote_nome: c.lote_nome, ordem: c.ordem, max_por_pedido: c.max_por_pedido,
      meia: c.meia, meia_percent: c.meia_percent, por_pessoa: c.por_pessoa, kit: c.kit,
      quantidade: c.quantidade,
      disponivel: disp === Infinity ? null : disp,    // null = ilimitado
      aVenda: st.aVenda, motivo: st.motivo,
    }
  })

  // Evento ligado (nome/data) — opcional, só para a vitrine.
  let evento: { nome_evento: string | null; tipo_evento: string | null; data_inicio: string | null; data_fim: string | null } | null = null
  if (bilh.evento_id) {
    const { data: ev } = await admin.from('clientes_eventos').select('nome_evento,tipo_evento,data_inicio,data_fim').eq('id', bilh.evento_id).maybeSingle()
    evento = ev || null
  }

  const venda = bilheteriaAVenda(bilh, nowMs)

  return Response.json({
    bilheteria: {
      id: bilh.id, titulo: bilh.titulo, descricao: bilh.descricao, local_texto: bilh.local_texto,
      imagem_url: bilh.imagem_url, capacidade: bilh.capacidade, venda_inicio: bilh.venda_inicio,
      venda_fim: bilh.venda_fim, status: bilh.status, taxa_servico: Number(bilh.taxa_servico) || 0,
      moeda: bilh.moeda || 'BRL', campos_extras: bilh.campos_extras || [], pagina_token: bilh.pagina_token,
    },
    categorias: catsPublic,
    evento,
    aVenda: venda.aVenda,
    motivo: venda.motivo,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = String(body.token || '')
  const action = String(body.action || '')
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 })

  const { data: bilh } = await admin.from('bilheteria_eventos').select('id').eq('pagina_token', token).maybeSingle()
  if (!bilh) return Response.json({ error: 'Bilheteria não encontrada.' }, { status: 404 })

  if (action === 'validar_cupom') {
    const codigo = String(body.codigo || '').trim()
    if (!codigo) return Response.json({ ok: false, motivo: 'inexistente' })
    const { data: cupom } = await admin
      .from('bilheteria_cupons')
      .select('*')
      .eq('bilheteria_id', bilh.id)
      .ilike('codigo', codigo)
      .maybeSingle()
    const v = validarCupom(cupom, Date.now())
    if (!v.ok) return Response.json({ ok: false, motivo: v.motivo })
    return Response.json({ ok: true, cupom: { codigo: cupom.codigo, tipo: cupom.tipo, valor_num: Number(cupom.valor_num) || 0 } })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
