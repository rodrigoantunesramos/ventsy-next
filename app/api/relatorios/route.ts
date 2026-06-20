import { NextRequest } from 'next/server'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { todayYMD, proximaExecucao, isMissingTable, type Frequencia } from '@/lib/bi'
import type { Json } from '@/types/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// API de Relatórios & BI (service-role, autoritativa). Persiste os relatórios do
// CONSTRUTOR (relatorios_salvos) e os ENVIOS agendados (relatorios_agendados),
// sempre escopados ao autor do JWT (nunca confia em usuario_id do corpo). O
// cálculo dos números fica na engine/cliente; aqui só CRUD + cálculo da próxima
// execução (lib/bi.proximaExecucao). O cron usa rota própria.

const FREQS = new Set<Frequencia>(['diario', 'semanal', 'mensal'])
const FORMATOS = new Set(['pdf', 'excel', 'csv'])

// ── GET: lista relatórios salvos + agendados do dono ─────────────────────────
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const [salvosRes, agendRes] = await Promise.all([
    db.from('relatorios_salvos').select('id,nome,descricao,config,criado_em').eq('usuario_id', user.id).order('criado_em', { ascending: false }),
    db.from('relatorios_agendados').select('id,nome,relatorio_id,dashboard,formato,frequencia,dia_semana,dia_mes,destinatarios,ativo,ultima_exec,proxima_exec').eq('usuario_id', user.id).order('criado_em', { ascending: false }),
  ])
  if (salvosRes.error && isMissingTable(salvosRes.error)) return Response.json({ salvos: [], agendados: [], needsSetup: true })
  return Response.json({ salvos: salvosRes.data || [], agendados: agendRes.data || [] })
}

// ── POST: operações (op-based) ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }) }
  const op = String(body.op || '')

  try {
    switch (op) {
      case 'salvar_relatorio': {
        const nome = String(body.nome || '').trim()
        if (!nome) return Response.json({ error: 'Nome obrigatório.' }, { status: 400 })
        const config = ((body.config && typeof body.config === 'object') ? body.config : {}) as Json
        const { data, error } = await db.from('relatorios_salvos')
          .insert({ usuario_id: user.id, nome, descricao: body.descricao ? String(body.descricao) : null, config })
          .select('id,nome,descricao,config,criado_em').single()
        if (error) throw error
        return Response.json({ ok: true, relatorio: data })
      }
      case 'excluir_relatorio': {
        const id = String(body.id || '')
        if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
        const { error } = await db.from('relatorios_salvos').delete().eq('id', id).eq('usuario_id', user.id)
        if (error) throw error
        return Response.json({ ok: true })
      }
      case 'criar_agendado': {
        const nome = String(body.nome || '').trim() || 'Relatório agendado'
        const frequencia = (FREQS.has(body.frequencia as Frequencia) ? body.frequencia : 'semanal') as Frequencia
        const formato = FORMATOS.has(String(body.formato)) ? String(body.formato) : 'pdf'
        const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as unknown[]).map(String).filter((e) => /.+@.+\..+/.test(e)) : []
        if (destinatarios.length === 0) return Response.json({ error: 'Informe ao menos um e-mail válido.' }, { status: 400 })
        const dia_semana = body.dia_semana != null ? Math.max(0, Math.min(6, Number(body.dia_semana))) : null
        const dia_mes = body.dia_mes != null ? Math.max(1, Math.min(28, Number(body.dia_mes))) : null
        const proxima_exec = proximaExecucao(frequencia, todayYMD(), { diaSemana: dia_semana ?? 0, diaMes: dia_mes ?? 1 })
        const { data, error } = await db.from('relatorios_agendados')
          .insert({
            usuario_id: user.id, nome,
            relatorio_id: body.relatorio_id ? String(body.relatorio_id) : null,
            dashboard: body.dashboard ? String(body.dashboard) : null,
            formato, frequencia, dia_semana, dia_mes, destinatarios, ativo: true, proxima_exec,
          })
          .select('id,nome,relatorio_id,dashboard,formato,frequencia,dia_semana,dia_mes,destinatarios,ativo,ultima_exec,proxima_exec').single()
        if (error) throw error
        return Response.json({ ok: true, agendado: data })
      }
      case 'toggle_agendado': {
        const id = String(body.id || '')
        if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
        const { error } = await db.from('relatorios_agendados').update({ ativo: !!body.ativo }).eq('id', id).eq('usuario_id', user.id)
        if (error) throw error
        return Response.json({ ok: true })
      }
      case 'excluir_agendado': {
        const id = String(body.id || '')
        if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 })
        const { error } = await db.from('relatorios_agendados').delete().eq('id', id).eq('usuario_id', user.id)
        if (error) throw error
        return Response.json({ ok: true })
      }
      default:
        return Response.json({ error: 'Operação desconhecida.' }, { status: 400 })
    }
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (isMissingTable(err)) return Response.json({ error: 'Recurso não ativado. Rode docs/sql/relatorios.sql no Supabase.', code: 'NEEDS_SETUP' }, { status: 409 })
    return Response.json({ error: err.message || 'Falha na operação.' }, { status: 500 })
  }
}
