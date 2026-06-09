import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { dimensionarPorPublico, type Risco, type RecursoExigido } from '@/lib/sst'

// Operações AUTORITATIVAS de SST (service-role, ignora RLS — identidade sempre user.id).
//   • POST { op:'aplicar_dimensionamento', evento_id, publico, area_m2?, risco?,
//     alcool?, palco? } — calcula os recursos EXIGIDOS por público (lib/sst, puro)
//     e sincroniza as linhas `sst_recursos_evento` de origem='dimensionamento' de
//     forma IDEMPOTENTE: atualiza exigido/obrigatório/base das que já existem
//     (preservando quantidade/status/fornecedor que o usuário ajustou), insere as
//     novas e remove as que deixaram de ser exigidas. As linhas origem='manual'
//     nunca são tocadas. Retorna todas as linhas do evento.
//
// O CRUD comum (planos, ocorrências, EPIs, treinamentos, simulados e edição de
// recursos) é feito pelo client via RLS. Espelha /api/plano-b e /api/producao.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const SEL_RECURSO = 'id,usuario_id,evento_id,tipo,exigido,quantidade,obrigatorio,status,origem,fornecedor_id,base,obs,criado_em,atualizado_em'

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }

async function eventoDoUsuario(eventoId: string, userId: string): Promise<boolean> {
  const { data } = await admin.from('clientes_eventos').select('id,usuario_id').eq('id', eventoId).maybeSingle()
  return !!data && data.usuario_id === userId
}

async function listarRecursos(userId: string, eventoId: string) {
  const { data } = await admin.from('sst_recursos_evento').select(SEL_RECURSO)
    .eq('usuario_id', userId).eq('evento_id', eventoId).order('criado_em')
  return data || []
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const op = String(body.op || '')

  if (op !== 'aplicar_dimensionamento') return badRequest('Operação inválida')

  const evento_id = String(body.evento_id || '')
  if (!evento_id) return badRequest('evento_id é obrigatório')
  const publico = Math.max(0, Math.round(Number(body.publico) || 0))
  if (publico <= 0) return badRequest('Informe o público estimado (> 0)')

  if (!(await eventoDoUsuario(evento_id, user.id))) return forbidden()

  // Recursos exigidos (puro, determinístico).
  const exigidos: RecursoExigido[] = dimensionarPorPublico({
    publico,
    areaM2: body.area_m2 != null ? Number(body.area_m2) : null,
    risco: (['baixo', 'medio', 'alto'].includes(body.risco) ? body.risco : 'medio') as Risco,
    alcool: !!body.alcool,
    palco: !!body.palco,
  })
  const exigPorTipo = new Map(exigidos.map((e) => [e.tipo, e]))

  // Linhas de dimensionamento já existentes (preservar quantidade/status do usuário).
  const existentes = await listarRecursos(user.id, evento_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dimExistentes = existentes.filter((r: any) => r.origem === 'dimensionamento')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porTipoExistente = new Map<string, any>(dimExistentes.map((r: any) => [r.tipo, r]))

  // 1) upsert (insert/update) dos exigidos.
  for (const e of exigidos) {
    const atual = porTipoExistente.get(e.tipo)
    if (atual) {
      await admin.from('sst_recursos_evento').update({
        exigido: e.quantidade, obrigatorio: e.obrigatorio, base: e.base,
      }).eq('id', atual.id)
    } else {
      await admin.from('sst_recursos_evento').insert({
        usuario_id: user.id, evento_id, tipo: e.tipo,
        exigido: e.quantidade, quantidade: 0, obrigatorio: e.obrigatorio,
        status: 'previsto', origem: 'dimensionamento', base: e.base,
      })
    }
  }

  // 2) remove linhas de dimensionamento que deixaram de ser exigidas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aRemover = dimExistentes.filter((r: any) => !exigPorTipo.has(r.tipo)).map((r: any) => r.id)
  if (aRemover.length) await admin.from('sst_recursos_evento').delete().in('id', aRemover)

  const recursos = await listarRecursos(user.id, evento_id)
  return Response.json({ data: { recursos, exigidos } })
}
