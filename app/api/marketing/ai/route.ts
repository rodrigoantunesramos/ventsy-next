import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// IA de Marketing (/painel/marketing · aba Conteúdo · Pro+) via Vercel AI Gateway
// ("provider/model"). A partir de um TEMA + rede social + tom + formato, redige
// legenda, texto longo ou ideias de conteúdo prontas para publicar. Degrada sem
// AI_GATEWAY_API_KEY (code 'NO_KEY'). NÃO inventa valores monetários ("R$"),
// datas, descontos ou promessas que o gestor não fez.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.MARKETING_AI_MODEL || process.env.CAMPANHAS_AI_MODEL || 'anthropic/claude-haiku-4-5';

const FORMATOS: Record<string, string> = {
  legenda: 'Escreva UMA legenda curta e envolvente (2 a 4 frases) para um post, terminando com um convite à ação e 4 a 6 hashtags relevantes em uma linha.',
  post: 'Escreva um texto mais longo (2 a 4 parágrafos curtos) para a rede indicada, com início que prende a atenção e um convite à ação no fim.',
  ideias: 'Liste 5 ideias de conteúdo (uma por linha, começando com "•"), cada uma com um ângulo diferente (bastidores, prova social, dica, oferta de valor, autoridade).',
};

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para gerar conteúdo.',
    });
  }

  const body = await req.json().catch(() => ({}));
  const tema = String(body.tema || '').trim();
  const rede = String(body.rede || 'Instagram').trim();
  const tom = String(body.tom || 'caloroso e profissional').trim();
  const empresa = String(body.empresa || '').trim();
  const formatoKey = (FORMATOS[String(body.formato)] ? String(body.formato) : 'legenda');
  if (!tema) return Response.json({ error: 'Descreva o tema do conteúdo.' }, { status: 400 });

  const prompt =
    `Você é redator de marketing de ${empresa ? `"${empresa}", ` : ''}um espaço/produtora de eventos, escrevendo para ${rede} em português do Brasil. ` +
    `Tom: ${tom}. Tema/objetivo: ${tema}.\n\n` +
    `${FORMATOS[formatoKey]}\n\n` +
    `Regras: não invente preços, valores monetários, datas específicas, descontos numéricos nem promessas que o gestor não fez. ` +
    `Não use placeholders entre colchetes. Seja específico ao tema, concreto e pronto para publicar. Responda apenas com o conteúdo, sem títulos ou explicações.`;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.8, prompt });
    const texto = (text || '').trim();
    if (!texto) return Response.json({ error: 'A IA não retornou conteúdo. Tente reescrever o tema.' }, { status: 502 });
    return Response.json({ texto });
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
  }
}
