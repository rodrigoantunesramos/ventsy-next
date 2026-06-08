import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  type TemplateKey, type Tarefa,
  templateKeyParaTipo, gerarTarefasDoTemplate, gerarRunshowDoTemplate,
  briefingSeedDeEvento, mesclarBriefing, podeConcluir, criaCiclo,
} from '@/lib/producao'

// Operações AUTORITATIVAS de Produção & Run-of-show:
//   • POST  — get-or-create da `producao` (1:1 com o evento, race-safe via
//             UNIQUE(evento_id)) e, opcionalmente, APLICAR TEMPLATE: gera a
//             checklist + o run-show a partir do tipo do evento, resolvendo as
//             dependências entre tarefas (por título, único no template).
//   • PATCH — atualiza uma tarefa; ao CONCLUIR, exige que a dependência já
//             esteja concluída (409 dependencia_pendente, salvo `force`); ao
//             redefinir `depende_de`, barra ciclos.
// O briefing e o CRUD de tarefas/run-show fora da conclusão são feitos pelo
// client via RLS. Espelha /api/ponto (service-role + getAuthUser).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_PROD = 'id,usuario_id,evento_id,status,briefing,observacoes,criado_em,atualizado_em'
const SEL_TAR = 'id,usuario_id,producao_id,titulo,categoria,responsavel,responsavel_id,responsavel_nome,prazo,status,prioridade,depende_de,obs,anexos,ordem,criado_em,atualizado_em'
const SEL_RUN = 'id,usuario_id,producao_id,data,horario,duracao_min,atividade,area,responsavel,recurso,obs,concluido,ordem,criado_em,atualizado_em'

const STATUS_TAREFA = new Set(['pendente', 'fazendo', 'concluida', 'cancelada'])
const PRIORIDADES = new Set(['baixa', 'normal', 'alta', 'critica'])

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }
function ymd(v: unknown): string | null {
  const s = typeof v === 'string' ? v : ''
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : null
}

// ── Evento (dono + campos p/ semear briefing/template) ───────────────────────
const SEL_EVENTO =
  'id,usuario_id,tipo_evento,data_inicio,horario_montagem,horario_inicio,horario_fim,horario_desmontagem,qtd_adultos,qtd_criancas,restricoes_alimentares,contato_emergencia,layout_mesas,necessidades_tecnicas,observacoes'
type EventoRow = {
  id: string; usuario_id: string; tipo_evento: string | null; data_inicio: string | null
  horario_inicio: string | null
  [k: string]: unknown
}
async function carregarEvento(id: string, userId: string): Promise<EventoRow | null> {
  const { data } = await admin.from('clientes_eventos').select(SEL_EVENTO).eq('id', id).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as EventoRow
}

// ── POST: ensure produção + (opcional) aplicar template ──────────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const evento_id = String(body.evento_id || '')
  if (!evento_id) return badRequest('evento_id é obrigatório')

  const evento = await carregarEvento(evento_id, user.id)
  if (!evento) return forbidden()

  // get-or-create (race-safe: UNIQUE(evento_id) + re-select no conflito 23505).
  let producao = await selectProducao(evento_id, user.id)
  if (!producao) {
    const briefing = briefingSeedDeEvento(evento, null)
    const ins = await admin.from('producao')
      .insert({ usuario_id: user.id, evento_id, status: 'planejamento', briefing })
      .select(SEL_PROD).single()
    if (ins.error) {
      if (ins.error.code === '23505') producao = await selectProducao(evento_id, user.id)
      else return Response.json({ error: ins.error.message }, { status: 500 })
    } else {
      producao = ins.data
    }
  }
  if (!producao) return Response.json({ error: 'falha ao criar produção' }, { status: 500 })

  // Aplicar template (gera checklist + run-show). Só se ainda não houver tarefas
  // (evita duplicar), salvo `force`.
  let geradas: { tarefas: number; runshow: number } | undefined
  if (body.aplicar_template) {
    const { count } = await admin.from('producao_tarefas')
      .select('id', { count: 'exact', head: true }).eq('producao_id', producao.id)
    const jaTem = (count || 0) > 0
    if (jaTem && body.force !== true) {
      return Response.json({ error: 'template_ja_aplicado', producao }, { status: 409 })
    }
    const key: TemplateKey = (body.template && typeof body.template === 'string')
      ? body.template as TemplateKey
      : templateKeyParaTipo(evento.tipo_evento)
    const dataEvento = ymd(evento.data_inicio)
    const briefing = mesclarBriefing(producao.briefing)
    const inicio = briefing.horarios.inicio || ymdHora(evento.horario_inicio) || '18:00'
    geradas = await aplicarTemplate(user.id, producao.id, key, dataEvento, inicio)
  }

  const [tarefas, runshow] = await Promise.all([
    admin.from('producao_tarefas').select(SEL_TAR).eq('producao_id', producao.id).order('ordem'),
    admin.from('runshow').select(SEL_RUN).eq('producao_id', producao.id).order('ordem'),
  ])
  return Response.json({
    data: { producao, tarefas: tarefas.data || [], runshow: runshow.data || [] },
    geradas,
  })
}

async function selectProducao(evento_id: string, userId: string) {
  const { data } = await admin.from('producao').select(SEL_PROD)
    .eq('evento_id', evento_id).eq('usuario_id', userId).maybeSingle()
  return data || null
}
function ymdHora(v: unknown): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(typeof v === 'string' ? v : '')
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/**
 * Gera e grava a checklist + run-show de um template. Insere as tarefas SEM
 * dependência, depois resolve `depende_de` mapeando TÍTULO→id (título é único no
 * template) e atualiza só as que dependem de outra.
 */
async function aplicarTemplate(
  userId: string, producaoId: string, key: TemplateKey, dataEvento: string | null, inicio: string,
): Promise<{ tarefas: number; runshow: number }> {
  const tpl = gerarTarefasDoTemplate(key, dataEvento)
  const rows = tpl.map((t) => ({
    usuario_id: userId, producao_id: producaoId, titulo: t.titulo, categoria: t.categoria,
    responsavel: t.responsavel, prazo: t.prazo, prioridade: t.prioridade, ordem: t.ordem,
  }))
  const { data: inseridas } = await admin.from('producao_tarefas').insert(rows).select('id,titulo')
  const idPorTitulo = new Map<string, string>((inseridas || []).map((r: { id: string; titulo: string }) => [r.titulo, r.id]))
  // Resolve dependências (título → id) e aplica.
  await Promise.all(tpl.filter((t) => t.dependeTitulo).map((t) => {
    const id = idPorTitulo.get(t.titulo)
    const depId = t.dependeTitulo ? idPorTitulo.get(t.dependeTitulo) : null
    if (!id || !depId) return Promise.resolve()
    return admin.from('producao_tarefas').update({ depende_de: depId }).eq('id', id)
  }))

  const runs = gerarRunshowDoTemplate(key, inicio, dataEvento).map((r) => ({
    usuario_id: userId, producao_id: producaoId, data: r.data, horario: r.horario,
    duracao_min: r.duracao_min, atividade: r.atividade, area: r.area, recurso: r.recurso,
    responsavel: r.responsavel, ordem: r.ordem,
  }))
  if (runs.length) await admin.from('runshow').insert(runs)
  return { tarefas: rows.length, runshow: runs.length }
}

// ── PATCH: atualizar tarefa (conclusão respeita dependência; sem ciclos) ─────
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const id = String(body.tarefa_id || body.id || '')
  if (!id) return badRequest('tarefa_id é obrigatório')

  const { data: atual } = await admin.from('producao_tarefas').select(SEL_TAR).eq('id', id).maybeSingle()
  if (!atual) return Response.json({ error: 'tarefa não encontrada' }, { status: 404 })
  if (atual.usuario_id !== user.id) return forbidden()

  const force = body.force === true
  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUS_TAREFA.has(status)) return badRequest('status inválido')
    // Ao CONCLUIR, a dependência (se houver) precisa estar concluída.
    if (status === 'concluida' && atual.status !== 'concluida' && !force) {
      const irmas = await tarefasDaProducao(atual.producao_id)
      const byId = new Map<string, Pick<Tarefa, 'status'>>(irmas.map((t) => [t.id, { status: t.status }]))
      if (!podeConcluir({ depende_de: atual.depende_de }, byId)) {
        const dep = atual.depende_de ? irmas.find((t) => t.id === atual.depende_de) : null
        return Response.json({ error: 'dependencia_pendente', dependencia: dep?.titulo || null }, { status: 409 })
      }
    }
    patch.status = status
  }

  if (body.depende_de !== undefined) {
    const dep = body.depende_de ? String(body.depende_de) : null
    if (dep) {
      const irmas = await tarefasDaProducao(atual.producao_id)
      const byId = new Map(irmas.map((t) => [t.id, { id: t.id, depende_de: t.depende_de }]))
      // Garante que a dependência é da MESMA produção e não cria ciclo.
      if (!byId.has(dep)) return badRequest('dependência inválida')
      if (criaCiclo(id, dep, byId)) return Response.json({ error: 'dependencia_ciclo' }, { status: 409 })
    }
    patch.depende_de = dep
  }

  if (body.titulo !== undefined) {
    const titulo = String(body.titulo).trim()
    if (!titulo) return badRequest('título é obrigatório')
    patch.titulo = titulo
  }
  if (body.categoria !== undefined) patch.categoria = String(body.categoria)
  if (body.responsavel !== undefined) patch.responsavel = String(body.responsavel)
  if (body.responsavel_id !== undefined) patch.responsavel_id = body.responsavel_id ? String(body.responsavel_id) : null
  if (body.responsavel_nome !== undefined) patch.responsavel_nome = body.responsavel_nome ? String(body.responsavel_nome) : null
  if (body.prazo !== undefined) patch.prazo = ymd(body.prazo)
  if (body.prioridade !== undefined) {
    const p = String(body.prioridade)
    if (!PRIORIDADES.has(p)) return badRequest('prioridade inválida')
    patch.prioridade = p
  }
  if (body.obs !== undefined) patch.obs = (body.obs || '').toString().trim() || null
  if (body.ordem !== undefined) patch.ordem = Math.max(0, Math.floor(Number(body.ordem) || 0))

  if (Object.keys(patch).length === 0) return badRequest('nada para atualizar')

  const { data, error } = await admin.from('producao_tarefas').update(patch).eq('id', id).select(SEL_TAR).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

async function tarefasDaProducao(producaoId: string): Promise<Tarefa[]> {
  const { data } = await admin.from('producao_tarefas').select('id,titulo,status,depende_de').eq('producao_id', producaoId)
  return (data || []) as Tarefa[]
}
