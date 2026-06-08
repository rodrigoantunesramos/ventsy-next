import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// Triagem/resumo de currículo do RH (/painel/rh/recrutamento) via Vercel AI
// Gateway (string "provider/model"). Degrada com um resumo-modelo quando
// AI_GATEWAY_API_KEY está ausente — assim a UI nunca quebra.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.RH_AI_MODEL || 'anthropic/claude-haiku-4-5';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome || '').trim();
  const curriculo = String(body.curriculo || '').trim();
  const vagaTitulo = String(body.vagaTitulo || '').trim();
  const requisitos = String(body.requisitos || '').trim();
  if (!nome) return Response.json({ error: 'nome é obrigatório' }, { status: 400 });

  // Fallback determinístico sem IA.
  if (!process.env.AI_GATEWAY_API_KEY) {
    const partes = [
      `${nome}${vagaTitulo ? ` — candidato(a) à vaga de ${vagaTitulo}` : ''}.`,
      curriculo ? `Currículo recebido (${curriculo.length} caracteres).` : 'Sem currículo anexado.',
      requisitos ? `Avaliar aderência aos requisitos: ${requisitos}.` : 'Defina os requisitos da vaga para uma triagem mais rica.',
      'Configure AI_GATEWAY_API_KEY para resumos automáticos por IA.',
    ];
    return Response.json({ resumo: partes.join(' ') });
  }

  const prompt =
    'Você é um analista de RH de uma empresa de eventos. Faça uma TRIAGEM objetiva do candidato em português do Brasil, ' +
    'em 3 a 4 frases: aderência aos requisitos, pontos fortes, pontos de atenção e uma recomendação (avançar/avaliar/descartar). ' +
    'Use SOMENTE as informações fornecidas; não invente experiências.\n\n' +
    `VAGA: ${vagaTitulo || '(não informada)'}\n` +
    `REQUISITOS: ${requisitos || '(não informados)'}\n` +
    `CANDIDATO: ${nome}\n` +
    `CURRÍCULO/NOTAS:\n${curriculo || '(não informado)'}\n`;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.4, prompt });
    return Response.json({ resumo: text.trim() });
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
  }
}
