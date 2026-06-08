import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { VAR_DEFS } from '@/lib/contracts'

// IA de Contratos (/painel/contratos) via Vercel AI Gateway (string "provider/model").
// Ações: 'template' (rascunho de corpo de modelo p/ um tipo de evento) e
// 'clausula' (rascunho de uma cláusula a partir de instrução). Degrada sem
// AI_GATEWAY_API_KEY. O texto gerado USA as variáveis {{...}} do catálogo.
const MODEL = process.env.CONTRATOS_AI_MODEL || 'anthropic/claude-haiku-4-5'

const TOKENS = VAR_DEFS.map((v) => `{{${v.token}}}`).join(', ')

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para ativar.',
    })
  }

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  const tipo = String(body.tipo_evento || '').slice(0, 60)
  const instrucao = String(body.instrucao || '').slice(0, 600)

  const base =
    'Você é um assistente jurídico de um gestor de espaços/serviços para eventos no Brasil. ' +
    'Redija em português do Brasil, tom formal e claro, pronto para uso. ' +
    'Quando fizer sentido, use estas VARIÁVEIS literais (serão substituídas depois): ' + TOKENS + '. ' +
    'Não invente valores nem dados — use as variáveis no lugar. Não inclua comentários, só o texto final.\n\n'

  let instr = ''
  if (action === 'template') {
    instr =
      `Escreva o CORPO de um modelo de CONTRATO DE LOCAÇÃO DE ESPAÇO para evento do tipo "${tipo || 'genérico'}". ` +
      'Use markdown-lite: "# TÍTULO" para o título, "## N. Cláusula" para cada cláusula numerada, ' +
      'parágrafos em texto normal e "- " para listas. Inclua: qualificação das partes (contratante/contratada), ' +
      'objeto, valor e pagamento, obrigações, cancelamento, multa, uso de imagem/LGPD e foro. ' +
      'Seja conciso (no máximo ~500 palavras).'
  } else if (action === 'clausula') {
    instr = `Escreva UMA cláusula contratual sobre: "${instrucao || 'condições gerais'}". ` +
      'Devolva apenas o texto da cláusula (sem o número/título), em 2 a 5 frases.'
  } else {
    return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.5, prompt: base + instr })
    return Response.json({ text: text.trim() })
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) },
      { status: 502 },
    )
  }
}
