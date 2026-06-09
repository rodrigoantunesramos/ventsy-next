import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { CANAL_BY, VARIAVEIS, type Canal } from '@/lib/campanhas';

// IA de Campanhas (/painel/campanhas · Pro+) via Vercel AI Gateway ("provider/model").
// A partir de um OBJETIVO + canal + tom, redige assunto e corpo prontos para envio,
// usando as variáveis suportadas ({{nome}}, {{evento}}, {{empresa}}). Degrada sem
// AI_GATEWAY_API_KEY (code 'NO_KEY'). Não inventa valores monetários ("R$").

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.CAMPANHAS_AI_MODEL || 'anthropic/claude-haiku-4-5';

function parseSaida(text: string, canal: Canal): { assunto: string; corpo: string } {
  const t = (text || '').trim();
  const m = t.match(/ASSUNTO:\s*([\s\S]*?)\n\s*CORPO:\s*([\s\S]*)$/i);
  if (m) return { assunto: m[1].trim(), corpo: m[2].trim() };
  // Sem marcadores: 1ª linha vira assunto (e-mail), o resto vira corpo.
  const linhas = t.split('\n');
  if (canal === 'email' && linhas.length > 1) {
    return { assunto: linhas[0].replace(/^assunto:\s*/i, '').trim(), corpo: linhas.slice(1).join('\n').trim() };
  }
  return { assunto: '', corpo: t };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para gerar campanhas.',
    });
  }

  const body = await req.json().catch(() => ({}));
  const objetivo = String(body.objetivo || '').trim();
  const canal = (CANAL_BY[body.canal as Canal] ? body.canal : 'email') as Canal;
  const tom = String(body.tom || 'caloroso e profissional').trim();
  const publico = String(body.publico || '').trim();
  if (!objetivo) return Response.json({ error: 'Descreva o objetivo da campanha.' }, { status: 400 });

  const vars = VARIAVEIS.map((v) => `{{${v.k}}}`).join(', ');
  const formato = canal === 'email'
    ? 'Responda EXATAMENTE neste formato:\nASSUNTO: <linha de assunto curta e atraente>\nCORPO: <mensagem com 2 a 4 parágrafos curtos>'
    : 'Responda EXATAMENTE neste formato:\nCORPO: <mensagem curta de WhatsApp, 2 a 4 frases, com emoji moderado>';
  const prompt =
    `Você é redator de marketing de um espaço/produtora de eventos, escrevendo uma campanha de ${CANAL_BY[canal].label} em português do Brasil. ` +
    `Tom: ${tom}. ${publico ? `Público-alvo: ${publico}. ` : ''}` +
    `Objetivo da campanha: ${objetivo}.\n\n` +
    `Use, quando fizer sentido, as variáveis de personalização (serão substituídas automaticamente): ${vars}. ` +
    `Não invente valores monetários, datas específicas, descontos numéricos nem promessas que o gestor não fez. ` +
    `Não use placeholders entre colchetes. Seja específico ao objetivo e convide a uma ação clara.\n\n` +
    formato;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.7, prompt });
    const out = parseSaida(text, canal);
    if (!out.corpo) return Response.json({ error: 'A IA não retornou um corpo válido. Tente reescrever o objetivo.' }, { status: 502 });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
  }
}
