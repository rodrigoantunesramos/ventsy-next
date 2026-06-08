import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  planejarApuracao, nomeBeneficiarioServer,
  type Regra, type EventoComissionavel, type ComissaoExistente, type ParcelaLite,
} from '@/lib/comissoes'

// Apuração automática de comissões — disparada por Vercel Cron (ver vercel.json).
// Reconcilia, para cada dono, o que as regras + atribuições dos eventos implicam
// com as comissões persistidas: cria as previstas, promove a apurada quando o
// evento foi recebido, e estorna (cancela) quando o evento é perdido/cancelado
// ou perde a atribuição. NÃO mexe em comissões manuais nem em pagas. A mesma
// lógica roda no botão "Sincronizar" da página (lib/comissoes.planejarApuracao).
//
// Segurança: exige CRON_SECRET (a Vercel injeta Authorization: Bearer <secret>).
// Teste manual: ?secret=<CRON_SECRET>. Simule sem gravar com ?dry=1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  const qs = new URL(req.url).searchParams.get('secret') || ''
  return bearer === secret || qs === secret
}

const SETUP_FALTANDO = new Set(['42P01', 'PGRST205'])

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const nowMs = Date.now()

  // Usuários a processar: quem tem regras e/ou comissões.
  const [regrasAll, comissoesUsers] = await Promise.all([
    admin.from('comissoes_regras').select('usuario_id'),
    admin.from('comissoes').select('usuario_id'),
  ])
  if (regrasAll.error && SETUP_FALTANDO.has(regrasAll.error.code)) {
    return Response.json({ skipped: 'migration comissoes ausente' })
  }
  const userIds = new Set<string>()
  for (const r of regrasAll.data || []) userIds.add(r.usuario_id)
  for (const r of comissoesUsers.data || []) userIds.add(r.usuario_id)

  let inseridas = 0, atualizadas = 0, usuarios = 0, erros = 0

  for (const uid of userIds) {
    try {
      const [rRes, evRes, parcRes, cRes, eqRes, pRes, clRes] = await Promise.all([
        admin.from('comissoes_regras').select('*').eq('usuario_id', uid).eq('ativo', true),
        admin.from('clientes_eventos').select('id,tipo_evento,status,data_inicio,valor_total_num,propriedade_id,vendedor_equipe_id,parceiro_id,indicado_por_id').eq('usuario_id', uid),
        admin.from('parcelas').select('evento_id,valor,status').eq('usuario_id', uid),
        admin.from('comissoes').select('id,beneficiario_tipo,beneficiario_id,evento_id,valor_num,status,origem').eq('usuario_id', uid),
        admin.from('equipe').select('id,nome').eq('usuario_id', uid),
        admin.from('parceiros').select('id,nome').eq('usuario_id', uid),
        admin.from('clientes').select('id,nome').eq('usuario_id', uid),
      ])

      const regras: Regra[] = (rRes.data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string, beneficiario_tipo: r.beneficiario_tipo as Regra['beneficiario_tipo'],
        beneficiario_id: (r.beneficiario_id as string) ?? null, base: r.base as Regra['base'],
        percentual: r.percentual != null ? Number(r.percentual) : null,
        valor_fixo_num: r.valor_fixo_num != null ? Number(r.valor_fixo_num) : null,
        condicao: (r.condicao && typeof r.condicao === 'object' ? r.condicao : {}) as Regra['condicao'],
        vigencia_inicio: (r.vigencia_inicio as string) ?? null, vigencia_fim: (r.vigencia_fim as string) ?? null,
        prioridade: Number(r.prioridade) || 0, ativo: !!r.ativo,
      }))
      const eventos: EventoComissionavel[] = (evRes.data || []).map((e: Record<string, unknown>) => ({
        id: e.id as string, tipo_evento: (e.tipo_evento as string) ?? null, status: (e.status as string) ?? null,
        data_inicio: (e.data_inicio as string) ?? null,
        valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null,
        propriedade_id: e.propriedade_id != null ? Number(e.propriedade_id) : null,
        vendedor_equipe_id: e.vendedor_equipe_id != null ? Number(e.vendedor_equipe_id) : null,
        parceiro_id: (e.parceiro_id as string) ?? null, indicado_por_id: (e.indicado_por_id as string) ?? null,
      }))
      const parcelas: ParcelaLite[] = (parcRes.data || []).map((p: Record<string, unknown>) => ({
        evento_id: p.evento_id as string, valor: Number(p.valor) || 0, status: p.status as string,
      }))
      const existentes: ComissaoExistente[] = (cRes.data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string, beneficiario_tipo: c.beneficiario_tipo as ComissaoExistente['beneficiario_tipo'],
        beneficiario_id: (c.beneficiario_id as string) ?? null, evento_id: (c.evento_id as string) ?? null,
        valor_num: Number(c.valor_num) || 0, status: c.status as ComissaoExistente['status'], origem: c.origem as string,
      }))

      const plano = planejarApuracao({ eventos, parcelas, regras, existentes, nowMs })
      if (plano.inserir.length === 0 && plano.atualizar.length === 0) continue
      usuarios++

      const maps = {
        equipe: new Map<string, string>((eqRes.data || []).map((e: Record<string, unknown>) => [String(e.id), e.nome as string])),
        parceiros: new Map<string, string>((pRes.data || []).map((p: Record<string, unknown>) => [p.id as string, p.nome as string])),
        clientes: new Map<string, string>((clRes.data || []).map((c: Record<string, unknown>) => [c.id as string, c.nome as string])),
      }

      if (dry) { inseridas += plano.inserir.length; atualizadas += plano.atualizar.length; continue }

      if (plano.inserir.length) {
        const rows = plano.inserir.map((n) => ({
          usuario_id: uid, regra_id: n.regra_id, beneficiario_tipo: n.beneficiario_tipo, beneficiario_id: n.beneficiario_id,
          beneficiario_nome: nomeBeneficiarioServer(n.beneficiario_tipo, n.beneficiario_id, maps),
          evento_id: n.evento_id, base_num: n.base_num, percentual: n.percentual, valor_num: n.valor_num,
          status: n.status, competencia: n.competencia, origem: 'auto',
          apurada_em: n.status === 'apurada' ? new Date(nowMs).toISOString() : null,
        }))
        const { error } = await admin.from('comissoes').insert(rows)
        if (error) throw error
        inseridas += rows.length
      }
      for (const u of plano.atualizar) {
        const patch: Record<string, unknown> = {}
        if (u.status !== undefined) { patch.status = u.status; if (u.status === 'apurada') patch.apurada_em = new Date(nowMs).toISOString() }
        if (u.valor_num !== undefined) patch.valor_num = u.valor_num
        if (u.base_num !== undefined) patch.base_num = u.base_num
        if (u.percentual !== undefined) patch.percentual = u.percentual
        const { error } = await admin.from('comissoes').update(patch).eq('id', u.id).eq('usuario_id', uid)
        if (error) throw error
        atualizadas++
      }
    } catch {
      erros++
    }
  }

  return Response.json({ dry, usuarios, inseridas, atualizadas, erros })
}
