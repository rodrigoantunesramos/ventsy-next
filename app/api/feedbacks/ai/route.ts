import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { CRITERIO_LABEL } from '@/lib/feedback';

// IA de Feedbacks (/painel/feedbacks · Pro+) via Vercel AI Gateway ("provider/model").
//   mode 'temas'    → agrupa temas recorrentes nos feedbacks recentes + sugere ação
//   mode 'resumo'   → sumariza o mês (satisfação, recorrências, prioridade)
//   mode 'resposta' → rascunho de resposta PRIVADA e empática a um feedback (id)
// Escopa tudo por usuario_id (service-role). Degrada sem AI_GATEWAY_API_KEY.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.FEEDBACKS_AI_MODEL || 'anthropic/claude-haiku-4-5';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

type FbRow = {
  nota_geral: number | null; criterios: Record<string, number> | null;
  comentario: string | null; pontos_positivos: string | null; pontos_negativos: string | null;
  autor_nome: string | null; criado_em: string;
};

function linhaFeedback(f: FbRow): string {
  const crit = f.criterios && typeof f.criterios === 'object'
    ? Object.entries(f.criterios).map(([k, v]) => `${CRITERIO_LABEL[k] || k}: ${v}`).join(', ')
    : '';
  return [
    `- Nota ${f.nota_geral ?? '?'}/5`,
    crit ? `(${crit})` : '',
    f.comentario ? `Comentário: "${f.comentario.trim()}"` : '',
    f.pontos_positivos ? `Positivo: "${f.pontos_positivos.trim()}"` : '',
    f.pontos_negativos ? `A melhorar: "${f.pontos_negativos.trim()}"` : '',
  ].filter(Boolean).join(' ');
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'IA não configurada. Defina AI_GATEWAY_API_KEY no .env.local para ativar.',
    });
  }

  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode || 'temas');

  // ── Resposta privada a um feedback específico ─────────────────────────────
  if (mode === 'resposta') {
    const id = String(body.id || '').trim();
    if (!id) return Response.json({ error: 'id obrigatório.' }, { status: 400 });
    const { data: fb } = await admin
      .from('feedbacks')
      .select('usuario_id, nota_geral, criterios, comentario, pontos_positivos, pontos_negativos, autor_nome')
      .eq('id', id).maybeSingle();
    if (!fb) return Response.json({ error: 'Feedback não encontrado.' }, { status: 404 });
    if (fb.usuario_id !== user.id) return forbidden();

    const nota = Number(fb.nota_geral) || 0;
    const instr = nota >= 4
      ? 'Agradeça com sinceridade, cite um ponto específico elogiado e convide a voltar.'
      : nota === 3
        ? 'Agradeça o retorno honesto, valide o ponto levantado e diga o que será ajustado.'
        : 'Demonstre empatia genuína, assuma responsabilidade sem desculpas vazias, descreva uma providência concreta e ofereça um canal direto.';
    const prompt =
      'Você é o gestor de um espaço de eventos respondendo de forma PRIVADA (e-mail/WhatsApp) ao contratante que deixou um feedback interno. ' +
      'Escreva em português do Brasil, tom caloroso e profissional, 2 a 4 frases (~70 palavras). ' +
      'Seja específico ao conteúdo; não invente fatos, valores ou promessas; não use placeholders entre colchetes. ' +
      `Trate o cliente pelo nome quando fizer sentido (${fb.autor_nome || 'cliente'}).\n\n` +
      'FEEDBACK:\n' + linhaFeedback(fb as FbRow) + '\n\nINSTRUÇÃO: ' + instr + '\nResponda apenas com o texto da mensagem.';
    try {
      const { text } = await generateText({ model: MODEL, temperature: 0.7, prompt });
      return Response.json({ text: text.trim() });
    } catch (e) {
      return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
    }
  }

  // ── Temas recorrentes / resumo do período (sobre os feedbacks do dono) ────
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from('feedbacks')
    .select('nota_geral, criterios, comentario, pontos_positivos, pontos_negativos, autor_nome, criado_em')
    .eq('usuario_id', user.id).gte('criado_em', desde)
    .order('criado_em', { ascending: false }).limit(120);
  const lista = (rows || []) as FbRow[];
  if (!lista.length) {
    return Response.json({ text: 'Ainda não há feedbacks no período para analisar.' });
  }

  const dados = lista.map(linhaFeedback).join('\n');
  const prompt = mode === 'resumo'
    ? 'Você é um analista de experiência do cliente de um espaço de eventos. A partir dos feedbacks privados dos últimos 90 dias, ' +
      'escreva um RESUMO executivo em português do Brasil (até ~120 palavras): nível geral de satisfação, 2–3 recorrências, ' +
      'e a prioridade da vez. Não invente números além dos fornecidos.\n\nFEEDBACKS:\n' + dados
    : 'Você é um analista de experiência do cliente de um espaço de eventos. Agrupe os feedbacks privados abaixo em TEMAS recorrentes. ' +
      'Para cada tema, escreva uma linha no formato "- <tema> (<nº de menções>): <ação sugerida objetiva>". ' +
      'Liste no máximo 6 temas, dos mais frequentes/críticos aos menores. Português do Brasil. Não invente menções inexistentes.\n\nFEEDBACKS:\n' + dados;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.5, prompt });
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
  }
}
