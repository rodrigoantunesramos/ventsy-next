import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';

// IA de Avaliações (/painel/avaliacoes) via Vercel AI Gateway (string "provider/model").
// Gera um RASCUNHO de resposta pública do dono à avaliação: elogio → agradecer;
// crítica → empatia + solução. Tom configurável. Degrada sem AI_GATEWAY_API_KEY.
const MODEL = process.env.AVALIACOES_AI_MODEL || 'anthropic/claude-haiku-4-5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const TONS: Record<string, string> = {
  cordial: 'cordial e acolhedor',
  profissional: 'profissional e objetivo',
  caloroso: 'caloroso e pessoal',
};

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para ativar.',
    });
  }

  const body = await req.json();
  const id = Number(body.id);
  const tom = TONS[String(body.tom || 'cordial')] || TONS.cordial;
  if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 });

  // Carrega a avaliação e confirma posse via propriedades.usuario_id.
  const { data: aval } = await sb
    .from('avaliacoes')
    .select('id, propriedade_id, nota, texto, autor, evento_tipo')
    .eq('id', id)
    .maybeSingle();
  if (!aval) return Response.json({ error: 'Avaliação não encontrada.' }, { status: 404 });

  const { data: prop } = await sb
    .from('propriedades')
    .select('usuario_id, nome, nome_responsavel')
    .eq('id', aval.propriedade_id)
    .maybeSingle();
  if (!prop || prop.usuario_id !== user.id) return forbidden();

  const nota = Number(aval.nota) || 0;
  const teor = nota >= 4 ? 'elogio (nota alta)' : nota === 3 ? 'avaliação mista' : 'crítica (nota baixa)';

  const ctx = [
    `Espaço: ${prop.nome || 'nosso espaço'}`,
    prop.nome_responsavel ? `Responsável que assina: ${prop.nome_responsavel}` : '',
    `Autor da avaliação: ${aval.autor || 'cliente'}`,
    aval.evento_tipo ? `Tipo de evento: ${aval.evento_tipo}` : '',
    `Nota: ${nota} de 5 estrelas (${teor})`,
    `Texto da avaliação: "${(aval.texto || '').trim() || '(sem texto)'}"`,
  ].filter(Boolean).join('\n');

  const instr =
    nota >= 4
      ? 'Agradeça com sinceridade, reforce um ponto específico citado e convide a voltar.'
      : nota === 3
        ? 'Agradeça o retorno, valide o ponto levantado e mostre como vai melhorar.'
        : 'Demonstre empatia genuína, assuma responsabilidade sem desculpas vazias, ofereça uma solução concreta e um canal para resolver.';

  const prompt =
    'Você é o gestor de um espaço/serviço de eventos respondendo PUBLICAMENTE a uma avaliação. ' +
    `Escreva em português do Brasil, tom ${tom}, em 2 a 4 frases (no máximo ~60 palavras). ` +
    'Seja específico ao conteúdo, nunca genérico; não invente fatos, valores ou promessas; ' +
    'não use placeholders entre colchetes. Trate o autor pelo nome quando fizer sentido.\n\n' +
    'DADOS DA AVALIAÇÃO:\n' + ctx + '\n\nINSTRUÇÃO: ' + instr + '\nResponda apenas com o texto da resposta.';

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.7, prompt });
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) },
      { status: 502 },
    );
  }
}
