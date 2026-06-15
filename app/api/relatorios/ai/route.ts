import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// IA do BI (Pro+) — "explique este resultado". Recebe os KPIs já calculados no
// cliente (engine pura lib/bi.ts) e devolve uma leitura em linguagem natural. Não
// recalcula nada nem acessa dados sensíveis além do plano do usuário. Degrade
// gracioso: sem AI_GATEWAY_API_KEY → NO_KEY; fora do plano → NEED_PRO.

const MODEL = process.env.RELATORIOS_AI_MODEL || 'anthropic/claude-haiku-4-5'

function isPremium(plano: string | null | undefined): boolean {
  const p = (plano || 'basico').toLowerCase()
  return p === 'pro' || p === 'ultra'
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  // Gate Pro+ (checagem no servidor, não confia só no client).
  try {
    const { data: a } = await db.from('assinaturas').select('plano_ativo').eq('usuario_id', user.id).maybeSingle()
    if (!isPremium(a?.plano_ativo)) return Response.json({ code: 'NEED_PRO' })
  } catch { /* sem assinatura → trata como não-premium abaixo */ return Response.json({ code: 'NEED_PRO' }) }

  if (!process.env.AI_GATEWAY_API_KEY) return Response.json({ code: 'NO_KEY' })

  let body: { dashboard?: string; periodo?: string; kpis?: [string, string][] }
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const kpis = Array.isArray(body.kpis) ? body.kpis.filter((x) => Array.isArray(x) && x.length === 2) : []
  if (kpis.length === 0) return Response.json({ error: 'Sem indicadores para analisar.' }, { status: 400 })

  const linhasKpi = kpis.map(([k, v]) => `- ${k}: ${v}`).join('\n')
  const prompt = `Você é um analista de BI de uma empresa de LOCAÇÃO DE ESPAÇOS PARA EVENTOS no Brasil.
Explique, em português claro e objetivo, o que estes indicadores dizem sobre o desempenho do negócio no período. Seja prático: 1 parágrafo curto de leitura geral, depois 3 a 5 bullets com destaques (o que está bom, o que merece atenção) e 1 ou 2 recomendações acionáveis. Não invente números além dos fornecidos. Não use "R$" se o valor já vier formatado.

Dashboard: ${body.dashboard || 'Geral'}
Período: ${body.periodo || '—'}

Indicadores:
${linhasKpi}`

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.5, prompt })
    return Response.json({ text: text.trim() })
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) }, { status: 502 })
  }
}
