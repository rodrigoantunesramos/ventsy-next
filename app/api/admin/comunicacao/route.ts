import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdminAny } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { registrarAcaoAdmin } from '@/lib/adminAudit'

// Envio de avisos por e-mail a um segmento. Direto e limitado (anti-timeout);
// para massa segmentada use o módulo Campanhas. Degrada se o SMTP não estiver
// configurado (sendEmail retorna skipped).
export const dynamic = 'force-dynamic'

const LIMITE = 300

async function destinatarios(segmento: string): Promise<Array<{ email: string; nome: string | null }>> {
  const admin = supabaseAdminAny

  if (segmento === 'incompletos') {
    const { data } = await admin.from('cadastros_incompletos').select('email, nome')
    return ((data ?? []) as Array<{ email?: string; nome?: string }>)
      .filter((d) => d.email)
      .map((d) => ({ email: d.email as string, nome: d.nome ?? null }))
  }

  const [{ data: usuarios }, { data: assinaturas }] = await Promise.all([
    admin.from('usuarios').select('id, nome, email'),
    admin.from('assinaturas').select('usuario_id, status'),
  ])
  const statusMap = new Map<string, string>()
  for (const a of (assinaturas ?? []) as Array<{ usuario_id: string; status?: string }>) {
    statusMap.set(a.usuario_id, a.status ?? '')
  }
  let lista = ((usuarios ?? []) as Array<{ id: string; nome?: string; email?: string }>).filter((u) => u.email)
  if (segmento === 'ativos') lista = lista.filter((u) => statusMap.get(u.id) === 'ativa')
  else if (segmento === 'trial') lista = lista.filter((u) => statusMap.get(u.id) === 'trial')
  else if (segmento === 'sem_plano') lista = lista.filter((u) => {
    const s = statusMap.get(u.id)
    return s !== 'ativa' && s !== 'trial'
  })
  return lista.map((u) => ({ email: u.email as string, nome: u.nome ?? null }))
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'comunicacao', 'ver')
  if (!ctx) return forbidden()
  const segmento = new URL(req.url).searchParams.get('segmento') || 'todos'
  const dests = await destinatarios(segmento)
  return Response.json({ total: dests.length })
}

function montarHtml(nome: string | null, mensagem: string): string {
  const corpo = mensagem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  return `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.6">
    <p>Olá${nome ? ' ' + nome : ''},</p>
    <div>${corpo}</div>
    <p style="color:#888;font-size:12px;margin-top:24px">Equipe Ventsy</p>
  </div>`
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'comunicacao', 'editar')
  if (!ctx) return forbidden()

  const body = (await req.json().catch(() => ({}))) as { segmento?: string; assunto?: string; mensagem?: string }
  const assunto = (body.assunto || '').trim()
  const mensagem = (body.mensagem || '').trim()
  if (!assunto || !mensagem) return Response.json({ error: 'Preencha assunto e mensagem.' }, { status: 400 })

  const dests = await destinatarios(body.segmento || 'todos')
  let enviados = 0
  let falhas = 0
  let skipped = 0
  for (const d of dests.slice(0, LIMITE)) {
    try {
      const r = await sendEmail({ to: d.email, subject: assunto, html: montarHtml(d.nome, mensagem) })
      if (r.skipped) skipped++
      else enviados++
    } catch {
      falhas++
    }
  }
  await registrarAcaoAdmin(ctx, 'comunicacao', 'enviar', body.segmento || 'todos', { assunto, enviados, total: dests.length })
  return Response.json({ enviados, falhas, skipped, total: dests.length })
}
