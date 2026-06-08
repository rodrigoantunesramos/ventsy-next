import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  normalizarLeitura, validarMovimento, zonaAceitaTipo, ZONA_GERAL,
  type Credencial, type AcessoLog,
} from '@/lib/acesso'

// Registro AUTORITATIVO de movimento de acesso (check-in/out de uma credencial
// numa zona). É a camada sensível a corrida: roda com service-role, valida que a
// credencial é do dono e aplica BLOQUEIO, AUTORIZAÇÃO DE ZONA, ANTI-DUPLICIDADE
// e CAPACIDADE (lotação) — recusando (409) salvo `force`. O CRUD de credenciais/
// zonas/ocorrências é feito no client via RLS; só o movimento passa por aqui.
// Espelha /api/equipamentos e /api/reservas.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

/** Conta a ocupação líquida (entradas − saídas) de uma zona, server-side. */
async function ocupacaoZona(eventoId: string, zona: string): Promise<number> {
  const base = admin.from('acesso_eventos_log').select('id', { count: 'exact', head: true }).eq('evento_id', eventoId).eq('zona', zona)
  const [ent, sai] = await Promise.all([
    base.eq('direcao', 'entrada'),
    admin.from('acesso_eventos_log').select('id', { count: 'exact', head: true }).eq('evento_id', eventoId).eq('zona', zona).eq('direcao', 'saida'),
  ])
  return (ent.count || 0) - (sai.count || 0)
}

// POST /api/acesso — registra um movimento (entrada/saída) de uma credencial.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const direcao = body.direcao === 'saida' ? 'saida' : body.direcao === 'entrada' ? 'entrada' : null
  const zona = (body.zona ? String(body.zona) : ZONA_GERAL).trim() || ZONA_GERAL
  const ponto = body.ponto ? String(body.ponto).trim() || null : null
  const force = body.force === true
  if (!direcao) return badRequest('direcao deve ser entrada ou saida')

  // 1) Resolve a credencial por id ou por token lido (QR/coletor).
  let cred: Credencial | null = null
  if (body.credencial_id) {
    const { data } = await admin.from('credenciais').select('*').eq('id', String(body.credencial_id)).maybeSingle()
    cred = data as Credencial | null
  } else if (body.token) {
    const token = normalizarLeitura(String(body.token))
    if (!token) return badRequest('token vazio')
    const { data } = await admin.from('credenciais').select('*').eq('qr_token', token).maybeSingle()
    cred = data as Credencial | null
  } else {
    return badRequest('informe credencial_id ou token')
  }

  if (!cred) {
    return Response.json({ error: 'credencial_nao_encontrada', motivo: 'desconhecida', aviso: 'QR não reconhecido.' }, { status: 404 })
  }
  if (cred.usuario_id !== user.id) return forbidden()

  const eventoId = cred.evento_id
  if (!eventoId) return badRequest('credencial sem evento vinculado')

  // 2) Carrega capacidade/tipos da zona e o último movimento da credencial nela.
  const { data: zonaRow } = await admin.from('acesso_zonas')
    .select('capacidade,tipos_permitidos,nome').eq('usuario_id', user.id).eq('evento_id', eventoId).eq('codigo', zona).maybeSingle()

  // Gate por tipo (regra de acesso da zona) — só na entrada.
  if (direcao === 'entrada' && zonaRow && !zonaAceitaTipo(zonaRow, cred.tipo) && !force) {
    return Response.json({
      error: 'movimento_recusado', motivo: 'zona_negada', bloqueante: true,
      aviso: `Zona "${zonaRow.nome || zona}" não aceita credenciais do tipo ${cred.tipo}.`,
      credencial: { id: cred.id, nome: cred.nome, tipo: cred.tipo },
    }, { status: 409 })
  }

  const { data: ultimo } = await admin.from('acesso_eventos_log')
    .select('*').eq('credencial_id', cred.id).eq('zona', zona).order('criado_em', { ascending: false }).limit(1).maybeSingle()

  const ocupAntes = await ocupacaoZona(eventoId, zona)

  // 3) Decisão da engine (pura, testada).
  const decisao = validarMovimento({
    direcao, zona, cred,
    ultimoMovimentoZona: (ultimo as AcessoLog) || null,
    capacidadeZona: zonaRow?.capacidade ?? 0,
    ocupacaoZona: ocupAntes,
  })
  if (!decisao.ok && decisao.bloqueante && !force) {
    return Response.json({
      error: 'movimento_recusado', motivo: decisao.motivo, aviso: decisao.aviso, bloqueante: true,
      ocupacao: { zona, atual: ocupAntes, capacidade: zonaRow?.capacidade ?? 0 },
      credencial: { id: cred.id, nome: cred.nome, tipo: cred.tipo, status: cred.status },
    }, { status: 409 })
  }

  // 4) Registra o movimento.
  const { data: log, error } = await admin.from('acesso_eventos_log').insert({
    usuario_id: user.id, evento_id: eventoId, credencial_id: cred.id, zona, ponto, direcao,
  }).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 5) Denormaliza a posição no perímetro (status da credencial) — só no `geral`.
  let novoStatus = cred.status
  if (zona === ZONA_GERAL && cred.status !== 'bloqueada') {
    novoStatus = direcao === 'entrada' ? 'checkin' : 'checkout'
    if (novoStatus !== cred.status) {
      await admin.from('credenciais').update({ status: novoStatus }).eq('id', cred.id)
    }
  }

  const ocupDepois = ocupAntes + (direcao === 'entrada' ? 1 : -1)
  return Response.json({
    data: log,
    decisao,                                  // inclui aviso quando foi um soft-warning liberado
    ocupacao: { zona, atual: Math.max(0, ocupDepois), capacidade: zonaRow?.capacidade ?? 0 },
    credencial: { id: cred.id, nome: cred.nome, tipo: cred.tipo, status: novoStatus, zonas: cred.zonas },
  })
}
