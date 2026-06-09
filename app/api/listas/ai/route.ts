import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// IA das Listas Oficiais (/painel/listas) via Vercel AI Gateway (string "provider/model").
// Sugere uma DESCRIÇÃO atraente para a lista e/ou IDEIAS de itens (categorias de
// lugares/fornecedores a incluir), a partir do título/categoria/cidade. É um
// rascunho — o curador edita. Degrada (NO_KEY) sem AI_GATEWAY_API_KEY.

export const runtime = 'nodejs';

const MODEL = process.env.LISTAS_AI_MODEL || 'anthropic/claude-haiku-4-5';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para ativar as sugestões.',
    });
  }

  const body = await req.json().catch(() => ({}));
  const modo = String(body.modo || 'descricao') === 'itens' ? 'itens' : 'descricao';
  const titulo = String(body.titulo || '').trim();
  const categoria = String(body.categoria || '').trim();
  const cidade = String(body.cidade || '').trim();
  const itens = Array.isArray(body.itens)
    ? body.itens.map((s: unknown) => String(s || '').trim()).filter(Boolean).slice(0, 30)
    : [];

  if (!titulo) return Response.json({ error: 'Informe ao menos o título da lista.' }, { status: 400 });

  const ctx = [
    `Título da lista: "${titulo}"`,
    categoria ? `Categoria: ${categoria}` : '',
    cidade ? `Cidade/região: ${cidade}` : '',
    itens.length ? `Itens já incluídos: ${itens.join('; ')}` : '',
  ].filter(Boolean).join('\n');

  const prompt =
    modo === 'descricao'
      ? 'Você ajuda um curador a escrever a descrição de uma LISTA pública de recomendações de ' +
        'lugares/fornecedores para eventos (estilo guia da comunidade). Escreva em português do Brasil, ' +
        'tom acolhedor e útil, 2 a 3 frases (máx. ~55 palavras). Diga para quem é a lista e o que a torna ' +
        'especial. Não invente nomes específicos, valores ou promessas; não use placeholders entre colchetes.\n\n' +
        'DADOS:\n' + ctx + '\n\nResponda apenas com o texto da descrição.'
      : 'Você ajuda um curador a montar uma LISTA pública de recomendações de lugares/fornecedores para eventos. ' +
        'Sugira de 5 a 8 IDEIAS de itens (tipos de espaço ou categorias de fornecedor) que combinam com o tema, ' +
        'sem inventar nomes de empresas reais. Português do Brasil. ' +
        'Responda APENAS com uma linha por ideia, no formato "Nome curto — por que entra na lista" (sem numeração).\n\n' +
        'DADOS:\n' + ctx;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.7, prompt });
    if (modo === 'itens') {
      const sugestoes = text
        .split('\n')
        .map((l) => l.replace(/^[\s\-*•\d.()]+/, '').trim())
        .filter(Boolean)
        .slice(0, 8);
      return Response.json({ sugestoes });
    }
    return Response.json({ descricao: text.trim() });
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) },
      { status: 502 },
    );
  }
}
