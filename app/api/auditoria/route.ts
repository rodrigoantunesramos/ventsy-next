import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { registrarAuditoria, expurgarAuditoria } from '@/lib/auditServer'
import type { AcaoAudit } from '@/lib/audit'

// Rota da Auditoria (service-role). Despacha por `action`:
//   • registrar — grava eventos de CLIENTE que o servidor não vê de outra forma:
//       login (sucesso), logout e exportações feitas no navegador. Aceita também
//       login_falha SEM autenticação (não há sessão num login que falhou) —
//       nesse caso resolve a conta pelo e-mail e, se não existir, IGNORA em
//       silêncio (evita enumeração de e-mails e poluição da trilha).
//       As ações de negócio (criar/editar/excluir/pagamento/permissao) NÃO são
//       aceitas aqui — elas são gravadas no servidor, dentro da própria rota
//       sensível, via lib/auditServer (nunca confiando no client).
//   • expurgar — remove logs além da retenção (em dias). Exige autenticação.
//
// A leitura da trilha é feita pela página via RLS (o dono lê as próprias linhas).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }
const str = (v: unknown, max = 300): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

// Ações que o CLIENTE pode registrar por si (autenticação/sessão e export).
const ACOES_CLIENT = new Set<AcaoAudit>(['login', 'login_falha', 'logout', 'exportar'])

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  switch (action) {
    case 'registrar': return registrar(req, body)
    case 'expurgar':  return expurgar(req, body)
    default:          return badRequest('ação inválida')
  }
}

// ── Nome de exibição do ator (best-effort) ────────────────────────────────────
async function nomeDoUsuario(id: string): Promise<string | null> {
  try {
    const { data } = await admin.from('usuarios').select('nome').eq('id', id).maybeSingle()
    return (data?.nome as string) || null
  } catch { return null }
}

// ── registrar (eventos do cliente) ────────────────────────────────────────────
async function registrar(req: NextRequest, body: Record<string, unknown>) {
  const acao = String(body.acao || '') as AcaoAudit
  if (!ACOES_CLIENT.has(acao)) return badRequest('ação não permitida')

  // Login falho: não há sessão. Resolve a conta pelo e-mail tentado; se não
  // existir, devolve ok sem gravar (resposta uniforme = anti-enumeração).
  if (acao === 'login_falha') {
    const email = str(body.email, 200)
    if (!email) return Response.json({ ok: true })
    let alvo: { id: string; nome: string | null } | null = null
    try {
      const { data } = await admin.from('usuarios').select('id,nome').ilike('email', email).maybeSingle()
      if (data?.id) alvo = { id: data.id as string, nome: (data.nome as string) || null }
    } catch { /* tabela sem coluna email / ausente — ignora */ }
    if (!alvo) return Response.json({ ok: true })
    const id = await registrarAuditoria({
      req, contaId: alvo.id, atorId: alvo.id, atorNome: alvo.nome, atorEmail: email,
      acao: 'login_falha', entidade: 'sessao', sucesso: false, sensivel: true,
      descricao: 'Tentativa de login malsucedida',
    })
    return Response.json({ ok: true, id })
  }

  // login / logout / exportar — exigem sessão válida (identidade do servidor).
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const nome = await nomeDoUsuario(user.id)

  if (acao === 'exportar') {
    const entidade = str(body.entidade, 60) || 'dados_pessoais'
    const id = await registrarAuditoria({
      req, contaId: user.id, atorId: user.id, atorNome: nome, atorEmail: user.email,
      acao: 'exportar', entidade, entidadeId: str(body.entidade_id, 100),
      descricao: str(body.descricao, 300) || 'Exportação de dados',
      meta: { formato: str(body.formato, 20) || undefined, total: Number(body.total) || undefined },
    })
    return Response.json({ ok: true, id })
  }

  // login / logout
  const id = await registrarAuditoria({
    req, contaId: user.id, atorId: user.id, atorNome: nome, atorEmail: user.email,
    acao, entidade: 'sessao', sucesso: true, sensivel: false,
    descricao: acao === 'login' ? 'Login na conta' : 'Logout da conta',
  })
  return Response.json({ ok: true, id })
}

// ── expurgar (retenção) ───────────────────────────────────────────────────────
async function expurgar(req: NextRequest, body: Record<string, unknown>) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const dias = Math.max(1, Math.min(3650, Math.floor(Number(body.dias) || 0)))
  if (!dias) return badRequest('dias inválido')

  const removidos = await expurgarAuditoria(user.id, dias)
  // Meta-auditoria: o próprio expurgo é uma ação sensível registrada.
  const nome = await nomeDoUsuario(user.id)
  await registrarAuditoria({
    req, contaId: user.id, atorId: user.id, atorNome: nome, atorEmail: user.email,
    acao: 'config', entidade: 'auditoria', sensivel: true,
    descricao: `Expurgo de auditoria: ${removidos} registro(s) com mais de ${dias} dias`,
    meta: { dias, removidos },
  })
  return Response.json({ ok: true, removidos })
}
