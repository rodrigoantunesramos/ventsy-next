import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { sendEmail, emailConfigurado } from '@/lib/email'
import { progressoAssinaturas, type Assinatura, type Contrato } from '@/lib/contracts'
import { formatMoney } from '@/lib/format'

// Envio para assinatura (autor autenticado). Marca o contrato como 'enviado'
// (a partir daí a UI o trata como SNAPSHOT IMUTÁVEL), garante o link_token e
// dispara o e-mail com o link público para cada signatário. Reutilizada como
// "reenviar / lembrete". A identidade é SEMPRE o usuário do token.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

function appBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  const origin = req.headers.get('origin')
  if (origin) return origin.replace(/\/$/, '')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const contratoId = String(body.contrato_id || '')
  const lembrete = body.lembrete === true
  if (!contratoId) return Response.json({ error: 'contrato_id obrigatório.' }, { status: 400 })

  // Carrega o contrato — sempre escopado ao dono.
  const { data: contrato } = await sb
    .from('contratos').select('*').eq('id', contratoId).eq('usuario_id', user.id).maybeSingle()
  if (!contrato) return Response.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  const c = contrato as Contrato

  if (c.status === 'cancelado' || c.status === 'rescindido') {
    return Response.json({ error: 'Contrato cancelado/rescindido não pode ser enviado.' }, { status: 409 })
  }
  if (!c.conteudo_final?.trim()) {
    return Response.json({ error: 'Gere o conteúdo do contrato antes de enviar.' }, { status: 400 })
  }

  const { data: assinaturas } = await sb.from('contratos_assinaturas').select('*').eq('contrato_id', c.id)
  const signers = (assinaturas || []) as Assinatura[]
  if (signers.length === 0) {
    return Response.json({ error: 'Adicione ao menos um signatário antes de enviar.' }, { status: 400 })
  }

  // Garante token e marca como enviado (snapshot torna-se imutável na UI).
  const token = c.link_token || crypto.randomUUID()
  const patch: Record<string, unknown> = { link_token: token }
  if (c.status === 'rascunho') { patch.status = 'enviado'; patch.enviado_em = new Date().toISOString() }
  const { error: upErr } = await sb.from('contratos').update(patch).eq('id', c.id).eq('usuario_id', user.id)
  if (upErr) return Response.json({ error: 'Não foi possível atualizar o contrato.' }, { status: 500 })

  const link = `${appBaseUrl(req)}/contrato/${token}`

  // E-mail para signatários pendentes (com e-mail). Best-effort: degrada sem SMTP.
  let enviados = 0
  if (emailConfigurado()) {
    const pendentes = signers.filter((s) => !s.assinou_em && s.email)
    const valor = formatMoney(c.valor_num, { currency: c.moeda })
    for (const s of pendentes) {
      try {
        await sendEmail({
          to: s.email!,
          subject: `Assinatura do contrato ${c.numero}${lembrete ? ' (lembrete)' : ''}`,
          html: `
            <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0d0d0d">
              <h2 style="color:#ff385c;font-style:italic">VENTSY</h2>
              <p>Olá, ${s.signatario_nome}!</p>
              <p>Você foi convidado(a) a assinar o contrato <strong>${c.numero}</strong>${c.titulo ? ' — ' + c.titulo : ''}
              na qualidade de <strong>${s.papel}</strong>. Valor: <strong>${valor}</strong>.</p>
              <p style="margin:24px 0">
                <a href="${link}" style="background:#ff385c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">
                  Conferir e assinar
                </a>
              </p>
              <p style="font-size:13px;color:#6b7280">Ou copie o link: ${link}</p>
            </div>`,
        })
        enviados++
      } catch { /* segue para os demais signatários */ }
    }
  }

  const prog = progressoAssinaturas(signers)
  return Response.json({
    ok: true,
    link,
    token,
    emails_enviados: enviados,
    email_configurado: emailConfigurado(),
    progresso: prog,
  })
}
