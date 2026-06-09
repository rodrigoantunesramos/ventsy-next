// Escrita da trilha de auditoria — SERVER-ONLY (usa service-role).
// ─────────────────────────────────────────────────────────────────────────────
// `registrarAuditoria()` é o helper central chamado pelas rotas de API
// SENSÍVEIS (financeiro, contratos, preços, permissões, exclusões, exportações)
// e pelo fluxo de login. Grava uma linha em `auditoria_log` via supabaseAdmin.
//
// Princípios:
//   • NUNCA lança nem bloqueia a operação principal — auditar é secundário; se
//     a tabela não existe (migration não rodada) ou a escrita falha, apenas
//     ignora silenciosamente (best-effort, fire-and-forget seguro).
//   • Segredos NUNCA em claro: antes/depois/meta passam por redigirSegredos().
//   • A sensibilidade é derivada (isSensivel) quando não informada.
//   • A identidade do ator vem SEMPRE do servidor (user validado), nunca do body.
//
// A parte pura (catálogos, redação, diff, classificação) vive em lib/audit.ts.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { type AcaoAudit, isSensivel, redigirSegredos } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// ── Origem da requisição (IP + user-agent) ────────────────────────────────────
type ReqLike = { headers: { get(name: string): string | null } }

/** Extrai IP (1º de x-forwarded-for) e user-agent dos headers da requisição. */
export function extrairOrigem(req: ReqLike | null | undefined): { ip: string | null; userAgent: string | null } {
  if (!req) return { ip: null, userAgent: null }
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ip = (fwd.split(',')[0] || '').trim() || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null
  return { ip, userAgent }
}

// ── Registro ──────────────────────────────────────────────────────────────────
export type RegistroAuditoria = {
  req?: ReqLike | null              // p/ extrair ip/user-agent automaticamente
  contaId?: string | null          // dono da conta (default = atorId)
  atorId?: string | null           // membro que executou a ação
  atorNome?: string | null
  atorEmail?: string | null
  acao: AcaoAudit
  entidade?: string | null
  entidadeId?: string | number | null
  descricao?: string | null
  antes?: unknown
  depois?: unknown
  meta?: Record<string, unknown> | null
  sensivel?: boolean               // override; senão deriva de ação/entidade
  sucesso?: boolean                // default true
  ip?: string | null               // override do auto-detectado
  userAgent?: string | null        // override do auto-detectado
}

/**
 * Grava uma linha de auditoria. Best-effort: resolve a tudo internamente e
 * NUNCA propaga erro. Retorna o id gravado (ou null). Pode ser chamada sem
 * await (fire-and-forget) — porém aguardá-la garante a ordem em export imediato.
 */
export async function registrarAuditoria(p: RegistroAuditoria): Promise<string | number | null> {
  try {
    const contaId = p.contaId ?? p.atorId
    if (!contaId) return null // sem dono não há onde escopar a trilha

    const origem = extrairOrigem(p.req)
    const linha = {
      usuario_id: contaId,
      ator_id: p.atorId ?? null,
      ator_nome: p.atorNome ?? null,
      ator_email: p.atorEmail ?? null,
      acao: p.acao,
      entidade: p.entidade ?? null,
      entidade_id: p.entidadeId == null ? null : String(p.entidadeId),
      descricao: p.descricao ?? null,
      antes: p.antes == null ? null : redigirSegredos(p.antes),
      depois: p.depois == null ? null : redigirSegredos(p.depois),
      meta: p.meta == null ? null : redigirSegredos(p.meta),
      sensivel: p.sensivel ?? isSensivel(p.acao, p.entidade),
      sucesso: p.sucesso ?? true,
      ip: p.ip ?? origem.ip,
      user_agent: p.userAgent ?? origem.userAgent,
    }

    const { data, error } = await admin.from('auditoria_log').insert(linha).select('id').single()
    if (error) return null
    return (data?.id as string | number) ?? null
  } catch {
    // Tabela ausente, env faltando, rede — auditar nunca derruba a operação.
    return null
  }
}

/** Expurga logs anteriores a `dias` (retenção). Devolve quantos foram removidos. */
export async function expurgarAuditoria(contaId: string, dias: number): Promise<number> {
  if (!contaId || !Number.isFinite(dias) || dias <= 0) return 0
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString()
  try {
    const { data, error } = await admin
      .from('auditoria_log')
      .delete()
      .eq('usuario_id', contaId)
      .lt('criado_em', limite)
      .select('id')
    if (error) return 0
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}
