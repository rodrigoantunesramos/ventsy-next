import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth'
import {
  calcularImpostos, proximaSequencia, formatarNumero,
  type NotaTipo, type RetencaoConfig, type RegimeTributario,
} from '@/lib/fiscal'

// Emissão e cancelamento de documentos fiscais — AUTORITATIVO no servidor:
//   • numeração sequencial por dono (sem corrida no cliente);
//   • cálculo de ISS/retenções pelo motor puro lib/fiscal (a UI só sugere);
//   • despacho ao PROVEDOR quando configurado (adaptador genérico) e DEGRADE
//     para emissão manual assistida (NFS-e/NF-e registrada) ou RECIBO numerado.
// O dono lê as notas direto (RLS); estas mutações passam por service-role para
// numeração confiável e para usar a credencial-segredo do provedor.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const TIPOS = new Set<NotaTipo>(['nfse', 'nfe', 'recibo'])

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 })
}

// ── Adaptador genérico de provedor (POST JSON + Bearer) ──────────────────────
// Provedores como Focus NFe / eNotas / NFe.io / PlugNotas aceitam um POST JSON
// autenticado por token. Os contratos divergem nos detalhes, então tratamos a
// resposta de forma tolerante: 2xx com algum id ⇒ emitida; senão ⇒ erro. Sem
// `endpoint`/`token` o chamador NÃO invoca isto (degrada para manual/recibo).
type DispatchResult = { ok: boolean; provedor_id?: string; xml_url?: string; pdf_url?: string; msg?: string }
async function dispatchProvedor(
  prov: { provedor: string; endpoint: string; token: string; ambiente: string },
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  try {
    const resp = await fetch(prov.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${prov.token}` },
      body: JSON.stringify({ ambiente: prov.ambiente, ...payload }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null
    try { data = await resp.json() } catch { /* corpo não-JSON */ }
    if (!resp.ok) {
      const msg = (data && (data.message || data.erro || data.error)) || `HTTP ${resp.status}`
      return { ok: false, msg: String(msg).slice(0, 500) }
    }
    const provedor_id = data?.id || data?.ref || data?.protocolo || data?.referencia || undefined
    const xml_url = data?.xml_url || data?.caminho_xml_nota_fiscal || data?.xml || undefined
    const pdf_url = data?.pdf_url || data?.caminho_danfse || data?.url_danfse || data?.pdf || undefined
    return { ok: true, provedor_id: provedor_id ? String(provedor_id) : undefined, xml_url, pdf_url, msg: data?.status }
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : 'Falha de rede ao despachar ao provedor' }
  }
}

// ── POST — emite (ou cancela, com { action: 'cancelar', id }) ────────────────
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  if (body.action === 'cancelar') return cancelar(user.id, body)

  const tipo: NotaTipo = TIPOS.has(body.tipo) ? body.tipo : 'recibo'
  const valorServicos = Number(body.valor_servicos)
  if (!(valorServicos > 0)) return badRequest('valor_servicos deve ser maior que zero')

  // Config do emitente (regime, código de serviço, ISS, numeração).
  const { data: cfg } = await admin
    .from('empresa_config')
    .select('config_fiscal, preferencias, moeda')
    .eq('usuario_id', user.id)
    .maybeSingle()
  const fiscal = cfg?.config_fiscal || {}
  const numeracao = cfg?.preferencias?.numeracao || {}

  const aliquotaIss = body.aliquota_iss != null && body.aliquota_iss !== ''
    ? Number(body.aliquota_iss)
    : Number(fiscal.iss) || 0
  const retConfig: RetencaoConfig = body.retencoes && typeof body.retencoes === 'object' ? body.retencoes : {}
  const regime = (body.regime || fiscal.regime || 'simples').toString() as RegimeTributario

  // Cálculo AUTORITATIVO dos impostos.
  const calc = calcularImpostos({
    valorServicos,
    descontos: Number(body.descontos) || 0,
    aliquotaIss,
    regime,
    retencoes: retConfig,
  })

  // Próxima sequência por dono (piso: o "próximo número" configurado).
  const { data: ultima } = await admin
    .from('notas_fiscais')
    .select('numero_seq')
    .eq('usuario_id', user.id)
    .order('numero_seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  const inicioCfg = Number(numeracao.nota_proximo) || 0
  const seq = proximaSequencia(Number(ultima?.numero_seq) || 0, inicioCfg)
  const prefixo = tipo === 'recibo' ? 'RC-' : (numeracao.nota_prefixo || 'NF-')
  const numero = formatarNumero(seq, prefixo)

  const codigoServico = (body.codigo_servico || fiscal.codigo_servico || '').toString().trim() || null
  const discriminacao = (body.discriminacao || '').toString().trim() || null

  // Decide a via de emissão e o status resultante.
  let status: 'emitida' | 'erro' = 'emitida'
  let provedor = 'recibo'
  let provedor_id: string | null = null
  let provedor_msg: string | null = null
  let xml_url: string | null = null
  let pdf_url: string | null = null

  if (tipo !== 'recibo') {
    const { data: prov } = await admin
      .from('fiscal_provedores')
      .select('provedor, ambiente, endpoint, token, ativo')
      .eq('usuario_id', user.id)
      .maybeSingle()
    const podeDespachar = prov && prov.ativo && prov.endpoint && prov.token && prov.provedor !== 'manual'
    if (podeDespachar) {
      const r = await dispatchProvedor(prov, {
        tipo,
        servicos: { valor: calc.valorTotal, descontos: Number(body.descontos) || 0, aliquota_iss: aliquotaIss, iss: calc.iss, codigo_servico: codigoServico, discriminacao },
        tomador: { nome: body.tomador_nome || null, documento: body.tomador_doc || null, email: body.tomador_email || null },
        numero, serie: body.serie || null,
      })
      provedor = prov.provedor
      if (r.ok) {
        provedor_id = r.provedor_id || null
        xml_url = r.xml_url || null
        pdf_url = r.pdf_url || null
        provedor_msg = r.msg || null
      } else {
        status = 'erro'
        provedor_msg = r.msg || 'Falha na emissão pelo provedor'
      }
    } else {
      // Degrade: emissão MANUAL assistida (nota registrada; o dono transmite no
      // portal do município/provedor). Continua válida como registro fiscal.
      provedor = 'manual'
      provedor_msg = 'Emissão manual: registre/transmita no portal do provedor ou da prefeitura.'
    }
  }

  const agora = new Date().toISOString()
  const row = {
    usuario_id: user.id,
    tipo,
    numero_seq: seq,
    numero,
    serie: (body.serie || '').toString().trim() || null,
    cliente_id: body.cliente_id || null,
    evento_id: body.evento_id || null,
    contrato_id: body.contrato_id || null,
    parcela_id: body.parcela_id != null && body.parcela_id !== '' ? Number(body.parcela_id) : null,
    tomador_nome: (body.tomador_nome || '').toString().trim() || null,
    tomador_doc: (body.tomador_doc || '').toString().trim() || null,
    tomador_email: (body.tomador_email || '').toString().trim() || null,
    valor_servicos_num: valorServicos,
    descontos_num: Number(body.descontos) || 0,
    aliquota_iss: aliquotaIss,
    iss_num: calc.iss,
    retencoes: { linhas: calc.retencoes, config: retConfig },
    total_retencoes_num: calc.totalRetencoes,
    valor_liquido_num: calc.valorLiquido,
    valor_total_num: calc.valorTotal,
    codigo_servico: codigoServico,
    discriminacao,
    regime,
    status,
    emitida_em: status === 'emitida' ? agora : null,
    provedor,
    provedor_id,
    provedor_msg,
    xml_url,
    pdf_url,
  }

  const { data: nota, error } = await admin.from('notas_fiscais').insert(row).select('*').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Marca a parcela como faturada (mão dupla com notas_fiscais.parcela_id).
  if (row.parcela_id && status === 'emitida') {
    await admin.from('parcelas').update({ nota_id: nota.id }).eq('id', row.parcela_id).eq('usuario_id', user.id)
  }

  return Response.json({ data: nota })
}

// ── Cancelamento ─────────────────────────────────────────────────────────────
async function cancelar(userId: string, body: { id?: string; motivo?: string }) {
  const id = String(body.id || '')
  if (!id) return badRequest('id é obrigatório')

  const { data: nota } = await admin.from('notas_fiscais').select('*').eq('id', id).maybeSingle()
  if (!nota) return Response.json({ error: 'Nota não encontrada' }, { status: 404 })
  if (nota.usuario_id !== userId) return forbidden()
  if (nota.status === 'cancelada') return Response.json({ data: nota })

  // Best-effort: cancelar no provedor, se houver despacho real.
  let provedor_msg = nota.provedor_msg
  if (nota.provedor_id && nota.provedor && !['manual', 'recibo'].includes(nota.provedor)) {
    const { data: prov } = await admin
      .from('fiscal_provedores')
      .select('endpoint, token')
      .eq('usuario_id', userId)
      .maybeSingle()
    if (prov?.endpoint && prov?.token) {
      try {
        await fetch(`${prov.endpoint.replace(/\/$/, '')}/${encodeURIComponent(nota.provedor_id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${prov.token}` },
        })
      } catch { provedor_msg = 'Nota cancelada localmente; verifique o cancelamento no provedor.' }
    }
  }

  const { data: upd, error } = await admin
    .from('notas_fiscais')
    .update({
      status: 'cancelada',
      cancelada_em: new Date().toISOString(),
      motivo_cancelamento: (body.motivo || '').toString().trim() || null,
      provedor_msg,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Desvincula a parcela (volta a ser "faturável").
  if (nota.parcela_id) await admin.from('parcelas').update({ nota_id: null }).eq('id', nota.parcela_id).eq('nota_id', id)

  return Response.json({ data: upd })
}
