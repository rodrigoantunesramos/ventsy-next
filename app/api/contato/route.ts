import { supabaseAdminAny } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'

// Recebe o formulário público "Fale Conosco": persiste em mensagens_contato e
// avisa o suporte por e-mail (best-effort). Público (sem auth).
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const nome = String(body.nome || '').trim()
  const email = String(body.email || '').trim()
  const mensagem = String(body.mensagem || '').trim()
  if (!nome || !email || !mensagem) {
    return Response.json({ error: 'Preencha nome, e-mail e mensagem.' }, { status: 400 })
  }

  const registro = {
    nome,
    email,
    telefone: String(body.telefone || '').trim() || null,
    assunto: String(body.assunto || '').trim() || null,
    perfil: String(body.perfil || '').trim() || null,
    mensagem,
  }

  const { error } = await supabaseAdminAny.from('mensagens_contato').insert(registro)
  if (error) return Response.json({ error: 'Não foi possível enviar. Tente novamente.' }, { status: 500 })

  // Avisa o suporte (best-effort — não bloqueia se o SMTP não estiver configurado).
  try {
    const corpo = mensagem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    await sendEmail({
      to: process.env.SMTP_USER || 'contato@ventsy.com.br',
      subject: `[Contato] ${registro.assunto || 'Nova mensagem'} — ${nome}`,
      html: `<p><b>Nome:</b> ${nome}</p><p><b>E-mail:</b> ${email}</p><p><b>Telefone:</b> ${registro.telefone || '—'}</p><p><b>Perfil:</b> ${registro.perfil || '—'}</p><p><b>Mensagem:</b><br>${corpo}</p>`,
    })
  } catch {
    /* e-mail é só notificação; a mensagem já foi persistida */
  }

  return Response.json({ ok: true })
}
