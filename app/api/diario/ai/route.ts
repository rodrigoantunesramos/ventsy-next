import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// Modelo via Vercel AI Gateway (string "provider/model"). Configurável por env.
const MODEL = process.env.DIARIO_AI_MODEL || 'openai/gpt-4o-mini';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  // Degrada com elegância quando a IA não está configurada.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para ativar.',
    });
  }

  const body = await req.json();
  const action = String(body.action || '');

  try {
    // ── Sugerir tags a partir do texto ──────────────────────────────────────
    if (action === 'tags') {
      const content = String(body.content || '').slice(0, 4000);
      if (!content.trim()) return Response.json({ tags: [] });

      const { text } = await generateText({
        model: MODEL,
        temperature: 0.2,
        prompt:
          'Extraia de 3 a 6 tags curtas (1 a 2 palavras, minúsculas, sem "#") que ' +
          'categorizem esta anotação de CRM de um espaço de eventos. Responda SOMENTE ' +
          'com as tags separadas por vírgula, sem nenhum texto extra.\n\n' +
          `Anotação:\n"""${content}"""`,
      });

      const tags = text
        .split(',')
        .map(t => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 6);
      return Response.json({ tags });
    }

    // ── Resumir relacionamento (por evento) + sugerir follow-up ──────────────
    if (action === 'summary') {
      const leadId = String(body.lead_id || '');
      let q = supabaseAdmin
        .from('diary_entries')
        .select('content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (leadId) q = q.eq('lead_id', leadId);

      const { data: rows } = await q;
      if (!rows?.length) return Response.json({ summary: 'Sem anotações para resumir.' });

      const corpus = rows
        .map(r => `- (${new Date(r.created_at).toLocaleDateString('pt-BR')}) ${r.content}`)
        .join('\n')
        .slice(0, 8000);

      const { text } = await generateText({
        model: MODEL,
        temperature: 0.4,
        prompt:
          'Você é o assistente de um gestor de espaço de eventos. Com base no histórico ' +
          'de anotações abaixo, escreva um resumo objetivo do relacionamento com o cliente ' +
          '(3 a 5 frases) e termine com UMA sugestão prática de próximo follow-up. ' +
          'Escreva em português do Brasil.\n\n' +
          `Histórico:\n${corpus}`,
      });

      return Response.json({ summary: text.trim() });
    }

    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) },
      { status: 502 },
    );
  }
}
