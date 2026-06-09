import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { sendEmail, emailConfigurado } from '@/lib/email'
import { MODULO_KEYS, type ModulosMap, type ModuloKey } from '@/lib/portal'

// Rota AUTENTICADA do DONO (/painel/portal). Faz só o que precisa do servidor:
// gerir a config do portal e os convites/acessos dos contratantes (token + e-mail).
// O lado do contratante NÃO usa esta rota — ele entra por /api/portal/cliente.
//   POST { action:'salvar_config', ativo, cor, boas_vindas, modulos }
//   POST { action:'convidar', evento_id, email?, modulos?, boas_vindas? }
//   POST { action:'reenviar', acesso_id }
//   POST { action:'config_evento', acesso_id, modulos?, boas_vindas? }
//   POST { action:'revogar'|'reativar'|'remover', acesso_id }
// A identidade é SEMPRE o JWT; a posse é checada por usuario_id (nunca o corpo).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function siteUrl(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin || 'https://ventsy.com.br').replace(/\/$/, '')
}
function linkConvite(req: NextRequest, token: string): string {
  return `${siteUrl(req)}/client/eventos?convite=${token}`
}
function gerarToken(): string {
  return randomBytes(24).toString('hex')
}

// Mantém só chaves de módulo válidas com valor booleano (descarta lixo do corpo).
function sanitizeModulos(input: unknown): ModulosMap | null {
  if (!input || typeof input !== 'object') return null
  const src = input as Record<string, unknown>
  const out: ModulosMap = {}
  for (const k of MODULO_KEYS) {
    if (typeof src[k] === 'boolean') out[k as ModuloKey] = src[k] as boolean
  }
  return Object.keys(out).length ? out : null
}

function emailValido(e: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)
}

async function enviarEmailConvite(opts: {
  to: string; nomeDono: string; nomeEvento: string; link: string
}): Promise<boolean> {
  if (!emailConfigurado()) return false
  const { to, nomeDono, nomeEvento, link } = opts
  await sendEmail({
    to,
    subject: `Acompanhe seu evento${nomeEvento ? ` — ${nomeEvento}` : ''} na Ventsy`,
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0d0d0d">
        <h2 style="color:#ff385c;font-style:italic;margin:0 0 12px">VENTSY</h2>
        <p>Olá!</p>
        <p>${nomeDono || 'O organizador'} convidou você para acompanhar
        ${nomeEvento ? `<strong>${nomeEvento}</strong>` : 'o seu evento'} pelo Portal do Cliente.</p>
        <p>No portal você vê o resumo do evento, parcelas e pagamentos, contrato, lista de
        convidados e pode conversar diretamente com o organizador.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#ff385c;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">
            Acessar meu evento
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280">Se o botão não funcionar, copie e cole este link no navegador:<br>${link}</p>
        <p style="font-size:13px;color:#6b7280">Faça login (ou crie sua conta) com este mesmo e-mail para ver o evento.</p>
      </div>`,
  })
  return true
}

// Confirma que o evento existe e pertence ao dono autenticado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function eventoDoDono(eventoId: string, donoId: string): Promise<{ erro: Response | null; ev: any }> {
  const { data: ev } = await admin
    .from('clientes_eventos')
    .select('id, usuario_id, nome_evento, quem_contratou, email')
    .eq('id', eventoId)
    .maybeSingle()
  if (!ev) return { erro: Response.json({ error: 'Evento não encontrado.' }, { status: 404 }), ev: null }
  if (ev.usuario_id !== donoId) return { erro: forbidden(), ev: null }
  return { erro: null, ev }
}

// Carrega um acesso e confirma a posse pelo dono.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function acessoDoDono(acessoId: string, donoId: string): Promise<{ erro: Response | null; ac: any }> {
  const { data: ac } = await admin.from('portal_acessos').select('*').eq('id', acessoId).maybeSingle()
  if (!ac) return { erro: Response.json({ error: 'Acesso não encontrado.' }, { status: 404 }), ac: null }
  if (ac.usuario_id !== donoId) return { erro: forbidden(), ac: null }
  return { erro: null, ac }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  // ── Config global do portal (1 linha por dono) ─────────────────────────────
  if (action === 'salvar_config') {
    const payload: Record<string, unknown> = { usuario_id: user.id, atualizado_em: new Date().toISOString() }
    if (typeof body.ativo === 'boolean') payload.ativo = body.ativo
    if (typeof body.cor === 'string') payload.cor = body.cor.slice(0, 16)
    if (typeof body.boas_vindas === 'string') payload.boas_vindas = body.boas_vindas.slice(0, 1000)
    const mods = sanitizeModulos(body.modulos)
    if (mods) payload.modulos = mods
    const { data, error } = await admin
      .from('portal_config')
      .upsert(payload, { onConflict: 'usuario_id' })
      .select('*')
      .single()
    if (error) return Response.json({ error: 'Não foi possível salvar a configuração.', detail: error.message }, { status: 500 })
    return Response.json({ ok: true, config: data })
  }

  // ── Convidar contratante para um evento ────────────────────────────────────
  if (action === 'convidar') {
    const eventoId = String(body.evento_id || '').trim()
    if (!eventoId) return Response.json({ error: 'evento_id é obrigatório.' }, { status: 400 })
    const { ev, erro } = await eventoDoDono(eventoId, user.id)
    if (erro) return erro

    const email = String(body.email || ev.email || '').trim().toLowerCase()
    if (!email || !emailValido(email)) {
      return Response.json({ error: 'Informe um e-mail válido do contratante para convidar.' }, { status: 422 })
    }

    const mods = sanitizeModulos(body.modulos)
    const boasVindas = typeof body.boas_vindas === 'string' ? body.boas_vindas.slice(0, 1000) : null

    // Já existe acesso para este (evento, e-mail)? Mantém o token/vínculo e atualiza.
    const { data: existente } = await admin
      .from('portal_acessos').select('*').eq('evento_id', eventoId).eq('email', email).maybeSingle()

    let acesso = existente
    if (existente) {
      const upd: Record<string, unknown> = {}
      if (existente.status === 'revogado') upd.status = existente.user_id ? 'ativo' : 'convidado'
      if (mods !== null) upd.modulos = mods
      if (body.boas_vindas !== undefined) upd.boas_vindas = boasVindas
      if (Object.keys(upd).length) {
        const { data } = await admin.from('portal_acessos').update(upd).eq('id', existente.id).select('*').single()
        acesso = data || existente
      }
    } else {
      const { data, error } = await admin
        .from('portal_acessos')
        .insert({
          usuario_id: user.id, evento_id: eventoId, email, token: gerarToken(),
          status: 'convidado', modulos: mods, boas_vindas: boasVindas,
        })
        .select('*')
        .single()
      if (error) return Response.json({ error: 'Não foi possível criar o convite.', detail: error.message }, { status: 500 })
      acesso = data
    }

    const link = linkConvite(req, acesso.token)
    let donoNome = ''
    try {
      const { data: u } = await admin.from('usuarios').select('nome').eq('id', user.id).maybeSingle()
      donoNome = u?.nome || ''
    } catch { /* opcional */ }
    const enviado = await enviarEmailConvite({ to: email, nomeDono: donoNome, nomeEvento: ev.nome_evento || '', link }).catch(() => false)

    return Response.json({ ok: true, acesso, link, email_enviado: enviado })
  }

  // ── Reenviar o e-mail de convite ───────────────────────────────────────────
  if (action === 'reenviar') {
    const { ac, erro } = await acessoDoDono(String(body.acesso_id || ''), user.id)
    if (erro) return erro
    const { data: ev } = await admin.from('clientes_eventos').select('nome_evento').eq('id', ac.evento_id).maybeSingle()
    const link = linkConvite(req, ac.token)
    let donoNome = ''
    try {
      const { data: u } = await admin.from('usuarios').select('nome').eq('id', user.id).maybeSingle()
      donoNome = u?.nome || ''
    } catch { /* opcional */ }
    const enviado = await enviarEmailConvite({ to: ac.email, nomeDono: donoNome, nomeEvento: ev?.nome_evento || '', link }).catch(() => false)
    return Response.json({ ok: true, link, email_enviado: enviado })
  }

  // ── Override de módulos / boas-vindas por evento ───────────────────────────
  if (action === 'config_evento') {
    const { ac, erro } = await acessoDoDono(String(body.acesso_id || ''), user.id)
    if (erro) return erro
    const upd: Record<string, unknown> = {}
    if (body.modulos !== undefined) upd.modulos = sanitizeModulos(body.modulos) // null = volta a herdar o global
    if (body.boas_vindas !== undefined) upd.boas_vindas = typeof body.boas_vindas === 'string' ? body.boas_vindas.slice(0, 1000) : null
    if (!Object.keys(upd).length) return Response.json({ ok: true, acesso: ac })
    const { data, error } = await admin.from('portal_acessos').update(upd).eq('id', ac.id).select('*').single()
    if (error) return Response.json({ error: 'Não foi possível salvar.', detail: error.message }, { status: 500 })
    return Response.json({ ok: true, acesso: data })
  }

  // ── Revogar / reativar / remover acesso ────────────────────────────────────
  if (action === 'revogar' || action === 'reativar' || action === 'remover') {
    const { ac, erro } = await acessoDoDono(String(body.acesso_id || ''), user.id)
    if (erro) return erro
    if (action === 'remover') {
      await admin.from('portal_acessos').delete().eq('id', ac.id)
      return Response.json({ ok: true, removido: true })
    }
    const status = action === 'revogar' ? 'revogado' : (ac.user_id ? 'ativo' : 'convidado')
    const { data, error } = await admin.from('portal_acessos').update({ status }).eq('id', ac.id).select('*').single()
    if (error) return Response.json({ error: 'Não foi possível atualizar o acesso.' }, { status: 500 })
    return Response.json({ ok: true, acesso: data })
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 })
}
