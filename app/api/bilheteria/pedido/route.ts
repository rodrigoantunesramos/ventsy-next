import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarQrPayload } from '@/lib/bilheteria'

// Status PÚBLICO de um pedido — usado pela página de confirmação após o checkout
// (o comprador volta do Mercado Pago com ?pedido=<id>). Resolvido pelo id UUID
// (não-adivinhável). Devolve só o necessário para mostrar o andamento e, quando
// pago, os ingressos com o QR. Não vaza usuario_id nem dados internos.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const { data: pedido } = await admin
    .from('pedidos_ingresso')
    .select('id, bilheteria_id, comprador_nome, comprador_email, subtotal_num, desconto_num, taxa_num, total_num, moeda, status, canal, criado_em, pago_em')
    .eq('id', id)
    .maybeSingle()
  if (!pedido) return Response.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const [{ data: bilh }, { data: ingRaw }] = await Promise.all([
    admin.from('bilheteria_eventos').select('titulo, local_texto, moeda').eq('id', pedido.bilheteria_id).maybeSingle(),
    admin.from('ingressos').select('id, categoria_id, comprador_nome, qr_token, valor_num, meia, status').eq('pedido_id', id).order('criado_em', { ascending: true }),
  ])

  const ingressos = (ingRaw || []) as Array<{ id: string; categoria_id: string; comprador_nome: string | null; qr_token: string; valor_num: number; meia: boolean; status: string }>
  const catIds = Array.from(new Set(ingressos.map((i) => i.categoria_id)))
  const catNome = new Map<string, string>()
  if (catIds.length) {
    const { data: cats } = await admin.from('ingressos_categorias').select('id, nome, lote_nome').in('id', catIds)
    for (const c of (cats || []) as { id: string; nome: string; lote_nome: string | null }[]) catNome.set(c.id, c.nome)
  }

  // O QR só é entregue para ingressos pagos/check-in (não vaza ingresso pendente).
  const ingressosPublic = ingressos.map((i) => ({
    id: i.id,
    categoria: catNome.get(i.categoria_id) || '—',
    titular: i.comprador_nome,
    valor_num: Number(i.valor_num) || 0,
    meia: i.meia,
    status: i.status,
    qr: i.status === 'pago' || i.status === 'checkin' ? gerarQrPayload(i.qr_token) : null,
  }))

  return Response.json({
    pedido: {
      id: pedido.id, status: pedido.status, canal: pedido.canal, comprador_nome: pedido.comprador_nome,
      subtotal_num: Number(pedido.subtotal_num) || 0, desconto_num: Number(pedido.desconto_num) || 0,
      taxa_num: Number(pedido.taxa_num) || 0, total_num: Number(pedido.total_num) || 0,
      moeda: pedido.moeda || bilh?.moeda || 'BRL', criado_em: pedido.criado_em, pago_em: pedido.pago_em,
    },
    bilheteria: { titulo: bilh?.titulo || 'Evento', local_texto: bilh?.local_texto || null },
    ingressos: ingressosPublic,
  })
}
