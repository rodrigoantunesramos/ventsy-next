import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail, emailConfigurado } from '@/lib/email'
import {
  canonicalAssinatura, sha256Hex, progressoAssinaturas,
  type Assinatura, type Contrato,
} from '@/lib/contracts'
import { formatMoney, formatDateTime } from '@/lib/format'

// Fluxo PÚBLICO de assinatura — sem sessão. Usa service-role (ignora RLS) e
// resolve o contrato SEMPRE pelo link_token (segredo do link). A trilha de
// auditoria (IP, user-agent, hash, timestamp) é capturada no SERVIDOR — nunca
// confiamos em valores vindos do cliente para isso.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// Estados em que o link de assinatura é válido.
const ABERTO = new Set(['enviado', 'assinado'])

type Ctx = { params: { token: string } }

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || ''
}

function maskEmail(e?: string | null): string {
  if (!e) return ''
  const [u, d] = e.split('@')
  if (!d) return ''
  const head = u.length <= 2 ? u[0] || '' : u.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`
}

// View pública (não vaza dados sensíveis do dono além do necessário p/ assinar).
function publicView(c: Contrato, assinaturas: Assinatura[], contratada: string) {
  return {
    numero: c.numero,
    titulo: c.titulo,
    conteudo_final: c.conteudo_final,
    valor: c.valor_num,
    moeda: c.moeda,
    status: c.status,
    contratada,
    assinaturas: [...assinaturas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((a) => ({
        id: a.id,
        signatario_nome: a.signatario_nome,
        papel: a.papel,
        ordem: a.ordem,
        obrigatorio: a.obrigatorio,
        assinou_em: a.assinou_em,
        metodo: a.metodo,
        email_mascara: maskEmail(a.email),
      })),
  }
}

async function load(token: string): Promise<{ contrato: Contrato; assinaturas: Assinatura[] } | null> {
  const { data: contrato } = await sb.from('contratos').select('*').eq('link_token', token).maybeSingle()
  if (!contrato) return null
  const { data: assinaturas } = await sb.from('contratos_assinaturas').select('*').eq('contrato_id', contrato.id)
  return { contrato, assinaturas: (assinaturas || []) as Assinatura[] }
}

async function nomeContratada(usuarioId: string): Promise<string> {
  const { data: emp } = await sb.from('empresa_config').select('razao_social,fantasia').eq('usuario_id', usuarioId).maybeSingle()
  if (emp?.razao_social || emp?.fantasia) return emp.razao_social || emp.fantasia
  const { data: u } = await sb.from('usuarios').select('nome').eq('id', usuarioId).maybeSingle()
  return u?.nome || 'Contratada'
}

// GET /api/contratos/[token] — view pública para o signatário conferir e assinar.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const found = await load(params.token)
  if (!found) return Response.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  if (!ABERTO.has(found.contrato.status)) {
    return Response.json({ error: 'Este contrato não está disponível para assinatura.', status: found.contrato.status }, { status: 410 })
  }
  const contratada = await nomeContratada(found.contrato.usuario_id)
  return Response.json({ data: publicView(found.contrato, found.assinaturas, contratada) })
}

// POST /api/contratos/[token] — registra a assinatura de UM signatário.
// Body: { signatario_id, nome?, doc?, email?, metodo, assinatura_img?, aceite:true }
export async function POST(req: NextRequest, { params }: Ctx) {
  const found = await load(params.token)
  if (!found) return Response.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  const { contrato } = found

  if (!ABERTO.has(contrato.status)) {
    return Response.json({ error: 'Este contrato não aceita mais assinaturas.' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const signatarioId = String(body.signatario_id || '')
  const aceite = body.aceite === true
  const metodo = ['clique', 'desenho', 'token_email'].includes(body.metodo) ? body.metodo : 'clique'
  if (!signatarioId) return Response.json({ error: 'Selecione quem está assinando.' }, { status: 400 })
  if (!aceite) return Response.json({ error: 'É necessário aceitar os termos para assinar.' }, { status: 400 })

  const alvo = found.assinaturas.find((a) => a.id === signatarioId)
  if (!alvo) return Response.json({ error: 'Signatário inválido.' }, { status: 404 })
  if (alvo.assinou_em) return Response.json({ error: 'Esta parte já assinou o contrato.' }, { status: 409 })

  const nome = (String(body.nome || '').trim() || alvo.signatario_nome).slice(0, 200)
  const doc = String(body.doc || alvo.signatario_doc || '').trim().slice(0, 60) || null
  const email = String(body.email || alvo.email || '').trim().slice(0, 200) || null
  const assinaturaImg = metodo === 'desenho' && typeof body.assinatura_img === 'string'
    ? body.assinatura_img.slice(0, 200_000) // limita o data URL do traço
    : null

  // ── Trilha de auditoria capturada no servidor ──────────────────────────────
  const quando = new Date().toISOString()
  const ip = clientIp(req)
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 400)
  const hash = await sha256Hex(canonicalAssinatura({
    contratoId: contrato.id, conteudo: contrato.conteudo_final, nome, doc, quando, ip,
  }))

  const { error: upErr } = await sb
    .from('contratos_assinaturas')
    .update({
      signatario_nome: nome, signatario_doc: doc, email,
      assinou_em: quando, ip, user_agent: userAgent, hash, metodo, assinatura_img: assinaturaImg,
    })
    .eq('id', alvo.id)
  if (upErr) return Response.json({ error: 'Não foi possível registrar a assinatura.' }, { status: 500 })

  // Recalcula o progresso e fecha o contrato quando todas as obrigatórias assinarem.
  const atualizadas: Assinatura[] = found.assinaturas.map((a) => (a.id === alvo.id ? { ...a, assinou_em: quando } : a))
  const prog = progressoAssinaturas(atualizadas)
  let novoStatus = contrato.status
  if (prog.completo && contrato.status !== 'assinado') {
    novoStatus = 'assinado'
    await sb.from('contratos').update({ status: 'assinado', assinado_em: quando }).eq('id', contrato.id)
    notificarConcluido(contrato, nome).catch(() => { /* e-mail é best-effort */ })
  }

  const contratada = await nomeContratada(contrato.usuario_id)
  const reload = await load(params.token)
  return Response.json({
    ok: true,
    status: novoStatus,
    data: reload ? publicView({ ...reload.contrato, status: novoStatus }, reload.assinaturas, contratada) : null,
  })
}

// Avisa o dono (e-mail) quando o contrato é totalmente assinado. Degrada sem SMTP.
async function notificarConcluido(contrato: Contrato, ultimo: string) {
  if (!emailConfigurado()) return
  const { data: u } = await sb.from('usuarios').select('email,nome').eq('id', contrato.usuario_id).maybeSingle()
  const to = u?.email
  if (!to) return
  const valor = formatMoney(contrato.valor_num, { currency: contrato.moeda })
  await sendEmail({
    to,
    subject: `✅ Contrato ${contrato.numero} assinado por todas as partes`,
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0d0d0d">
        <h2 style="color:#ff385c;font-style:italic">VENTSY</h2>
        <p>Olá${u?.nome ? ', ' + u.nome : ''}!</p>
        <p>O contrato <strong>${contrato.numero}</strong>${contrato.titulo ? ' — ' + contrato.titulo : ''} foi
        <strong>assinado por todas as partes</strong> (última assinatura: ${ultimo}).</p>
        <p>Valor: <strong>${valor}</strong> · Concluído em ${formatDateTime(new Date())}.</p>
        <p>Acesse o painel para baixar o PDF e o certificado de assinatura com a trilha de auditoria.</p>
      </div>`,
  })
}
