import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import { normalizarLeitura } from '@/lib/acesso'
import {
  validarEntrada, calcularTarifa, normalizarPlaca,
  type Setor,
} from '@/lib/estacionamento'

// Controle AUTORITATIVO de entrada/saída de veículos no pátio. Roda com
// service-role: valida que o setor/credencial são do dono e aplica o BLOQUEIO POR
// LOTAÇÃO do setor (recusa 409 salvo `force`), o cálculo da TARIFA (credenciado
// não paga; fixo/hora/diária) e a marcação de pagamento. O CRUD de setores/
// transfer e os ajustes de valet são feitos no client via RLS — só o movimento
// (que é sensível a corrida na capacidade) passa por aqui. Espelha /api/acesso.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

const ACESSO_SELECT =
  'id,usuario_id,evento_id,setor_id,placa,tipo,modelo,cor_veiculo,credencial_id,valet,valet_status,valet_local,motorista,contato,entrada,saida,valor_num,pago,metodo,status,lancamento_id,obs,criado_em,atualizado_em'

/** Ocupação líquida (veículos no pátio) de um setor, server-side. */
async function ocupacaoSetor(eventoId: string, setorId: string): Promise<number> {
  const { count } = await admin
    .from('estacionamento_acessos')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', eventoId).eq('setor_id', setorId).eq('status', 'no_patio')
  return count || 0
}

/** A placa já consta no pátio deste evento? (anti-duplo registro de entrada) */
async function placaNoPatio(eventoId: string, placa: string): Promise<boolean> {
  if (!placa) return false
  const { count } = await admin
    .from('estacionamento_acessos')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', eventoId).eq('placa', placa).eq('status', 'no_patio')
  return (count || 0) > 0
}

async function carregarSetor(setorId: string, userId: string): Promise<Setor | null> {
  const { data } = await admin.from('estacionamento_setores').select('*').eq('id', setorId).maybeSingle()
  if (!data || data.usuario_id !== userId) return null
  return data as Setor
}

// ── ENTRADA ────────────────────────────────────────────────────────────────────
async function registrarEntrada(req: NextRequest, body: Record<string, unknown>, userId: string) {
  const evento_id = body.evento_id ? String(body.evento_id) : ''
  const setor_id = body.setor_id ? String(body.setor_id) : ''
  const placa = normalizarPlaca(String(body.placa || ''))
  const force = body.force === true
  if (!evento_id) return badRequest('evento_id é obrigatório')
  if (!setor_id) return badRequest('setor_id é obrigatório')

  const setor = await carregarSetor(setor_id, userId)
  if (!setor) return forbidden()

  // Credencial (opcional) — por id ou por token lido (QR). Isenta a tarifa.
  let credencial_id: string | null = null
  if (body.credencial_id) {
    const { data } = await admin.from('credenciais').select('id,usuario_id').eq('id', String(body.credencial_id)).maybeSingle()
    if (data && data.usuario_id === userId) credencial_id = data.id
  } else if (body.token) {
    const token = normalizarLeitura(String(body.token))
    if (token) {
      const { data } = await admin.from('credenciais').select('id,usuario_id').eq('qr_token', token).maybeSingle()
      if (data && data.usuario_id === userId) credencial_id = data.id
    }
  }

  const ocup = await ocupacaoSetor(evento_id, setor_id)
  const jaNoPatio = await placaNoPatio(evento_id, placa)

  const decisao = validarEntrada({ placa, setor, ocupacaoSetor: ocup, jaNoPatio })
  if (!decisao.ok && decisao.bloqueante && !force) {
    return Response.json({
      error: 'entrada_recusada', motivo: decisao.motivo, aviso: decisao.aviso, bloqueante: true,
      ocupacao: { setor_id, atual: ocup, capacidade: setor.capacidade },
    }, { status: 409 })
  }

  const credenciado = !!credencial_id
  const valet = body.valet === true
  // Tarifa conhecida já na entrada quando é valor fixo (ou isento); por hora/
  // diária o valor é calculado na saída (depende da permanência).
  const agora = new Date().toISOString()
  const valor = setor.cobranca === 'fixo' ? calcularTarifa({ setor, credenciado }) : 0
  const querPagar = body.pago === true && valor > 0

  const { data: acesso, error } = await admin.from('estacionamento_acessos').insert({
    usuario_id: userId, evento_id, setor_id, placa,
    tipo: body.tipo ? String(body.tipo) : setor.tipo,
    modelo: body.modelo ? String(body.modelo).trim() || null : null,
    cor_veiculo: body.cor_veiculo ? String(body.cor_veiculo).trim() || null : null,
    credencial_id, valet,
    valet_status: valet ? 'recebido' : 'na',
    valet_local: body.valet_local ? String(body.valet_local).trim() || null : null,
    motorista: body.motorista ? String(body.motorista).trim() || null : null,
    contato: body.contato ? String(body.contato).trim() || null : null,
    entrada: agora, saida: null,
    valor_num: valor, pago: querPagar, metodo: querPagar ? (String(body.metodo || 'Dinheiro')) : null,
    status: 'no_patio',
    obs: body.obs ? String(body.obs).trim() || null : null,
  }).select(ACESSO_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    data: acesso, decisao,
    isento: credenciado || setor.tipo === 'credenciado',
    ocupacao: { setor_id, atual: ocup + 1, capacidade: setor.capacidade },
  })
}

// ── SAÍDA ──────────────────────────────────────────────────────────────────────
async function registrarSaida(body: Record<string, unknown>, userId: string) {
  const evento_id = body.evento_id ? String(body.evento_id) : ''
  let acesso: Record<string, unknown> | null = null

  if (body.acesso_id) {
    const { data } = await admin.from('estacionamento_acessos').select('*').eq('id', String(body.acesso_id)).maybeSingle()
    acesso = data || null
  } else if (body.placa && evento_id) {
    const placa = normalizarPlaca(String(body.placa))
    const { data } = await admin.from('estacionamento_acessos').select('*')
      .eq('evento_id', evento_id).eq('placa', placa).eq('status', 'no_patio')
      .order('entrada', { ascending: false }).limit(1).maybeSingle()
    acesso = data || null
  } else {
    return badRequest('informe acesso_id ou placa + evento_id')
  }

  if (!acesso) return Response.json({ error: 'acesso_nao_encontrado', aviso: 'Veículo não está no pátio.' }, { status: 404 })
  if (acesso.usuario_id !== userId) return forbidden()
  if (acesso.status === 'saiu') return Response.json({ data: acesso, already: true })

  const setor = acesso.setor_id ? await carregarSetor(String(acesso.setor_id), userId) : null
  const agora = new Date().toISOString()
  const credenciado = !!acesso.credencial_id
  // Recalcula a tarifa final (por hora/diária depende da permanência).
  const valor = setor
    ? calcularTarifa({ setor, credenciado, entrada: acesso.entrada as string, saida: agora })
    : Number(acesso.valor_num) || 0

  const querPagar = body.pago === true ? true : Boolean(acesso.pago)
  const metodo = body.pago === true ? String(body.metodo || acesso.metodo || 'Dinheiro') : (acesso.metodo as string | null)

  const { data: atualizado, error } = await admin.from('estacionamento_acessos').update({
    saida: agora, status: 'saiu', valor_num: valor,
    pago: querPagar && valor > 0, metodo: querPagar && valor > 0 ? metodo : (acesso.metodo as string | null),
    valet_status: acesso.valet ? 'entregue' : (acesso.valet_status as string),
  }).eq('id', acesso.id).select(ACESSO_SELECT).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ data: atualizado, valor })
}

// POST /api/estacionamento — registra entrada OU saída de um veículo.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const acao = body.acao === 'saida' ? 'saida' : body.acao === 'entrada' ? 'entrada' : null
  if (!acao) return badRequest('acao deve ser entrada ou saida')

  return acao === 'entrada' ? registrarEntrada(req, body, user.id) : registrarSaida(body, user.id)
}
