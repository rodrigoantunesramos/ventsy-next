import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { CATEGORIA_NPS_BY, TIPOS_PERGUNTA, type TipoPergunta } from '@/lib/pesquisas';

// IA de Pesquisas (/painel/pesquisas · Pro+) via Vercel AI Gateway ("provider/model").
//   mode 'temas'     → nuvem de temas recorrentes nos comentários + sugestão de ação
//   mode 'resumo'    → resumo executivo do NPS do período (nível, recorrências, foco)
//   mode 'perguntas' → gera um conjunto de perguntas p/ o construtor (a partir do objetivo)
// Escopa tudo por usuario_id (service-role). Degrada sem AI_GATEWAY_API_KEY.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.PESQUISAS_AI_MODEL || 'anthropic/claude-haiku-4-5';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

type RespRow = { nps: number | null; categoria: string | null; comentario: string | null; criado_em: string };

function linha(r: RespRow): string {
  const cat = r.categoria ? CATEGORIA_NPS_BY[r.categoria]?.label || r.categoria : '';
  return [
    r.nps != null ? `NPS ${r.nps}/10` : 'sem nota',
    cat ? `(${cat})` : '',
    r.comentario ? `— "${r.comentario.trim()}"` : '',
  ].filter(Boolean).join(' ');
}

const TIPOS_VALIDOS = new Set(TIPOS_PERGUNTA.map((t) => t.v));

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

  // ── Gera perguntas para o construtor (não depende de respostas) ───────────
  if (mode === 'perguntas') {
    const objetivo = String(body.objetivo || '').trim().slice(0, 400);
    const tipo = String(body.tipo || 'nps');
    const prompt =
      'Você ajuda um gestor de espaço de eventos a montar uma pesquisa pós-evento. ' +
      `Tipo de pesquisa: ${tipo}. Objetivo do gestor: "${objetivo || 'medir satisfação e NPS'}". ` +
      'Gere de 3 a 5 perguntas claras e curtas, em português do Brasil. Inclua sempre 1 pergunta NPS (0–10). ' +
      'Responda APENAS com um array JSON, sem texto ao redor, no formato: ' +
      '[{"tipo":"nps|csat|escala|multipla|texto","titulo":"...","opcoes":["a","b"],"obrigatoria":true}]. ' +
      'Use "opcoes" só quando tipo="multipla".';
    try {
      const { text } = await generateText({ model: MODEL, temperature: 0.6, prompt });
      const m = text.match(/\[[\s\S]*\]/);
      const arr = m ? JSON.parse(m[0]) : [];
      const perguntas = (Array.isArray(arr) ? arr : [])
        .map((q: Record<string, unknown>) => {
          const t = String(q.tipo || 'texto') as TipoPergunta;
          if (!TIPOS_VALIDOS.has(t)) return null;
          const out: { tipo: TipoPergunta; titulo: string; opcoes?: string[]; obrigatoria: boolean } = {
            tipo: t, titulo: String(q.titulo || '').trim().slice(0, 240) || 'Pergunta', obrigatoria: !!q.obrigatoria,
          };
          if (t === 'multipla') {
            const ops = Array.isArray(q.opcoes) ? q.opcoes.map((x) => String(x).trim()).filter(Boolean) : [];
            out.opcoes = ops.length >= 2 ? ops.slice(0, 8) : ['Opção 1', 'Opção 2'];
          }
          return out;
        })
        .filter(Boolean)
        .slice(0, 6);
      if (!perguntas.length) return Response.json({ error: 'A IA não retornou perguntas válidas. Tente outro objetivo.' }, { status: 422 });
      return Response.json({ perguntas });
    } catch (e) {
      return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
    }
  }

  // ── Temas / resumo (sobre as respostas do dono) ───────────────────────────
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from('pesquisas_respostas')
    .select('nps, categoria, comentario, criado_em')
    .eq('usuario_id', user.id).gte('criado_em', desde)
    .order('criado_em', { ascending: false }).limit(200);
  const lista = (rows || []) as RespRow[];
  const comComentario = lista.filter((r) => r.comentario && r.comentario.trim());

  if (mode === 'temas' && !comComentario.length) {
    return Response.json({ text: 'Ainda não há comentários no período para agrupar em temas.' });
  }
  if (!lista.length) {
    return Response.json({ text: 'Ainda não há respostas no período para analisar.' });
  }

  const dados = (mode === 'temas' ? comComentario : lista).map(linha).join('\n');
  const prompt = mode === 'resumo'
    ? 'Você é um analista de experiência do cliente de um espaço de eventos. A partir das respostas de NPS dos últimos 90 dias, ' +
      'escreva um RESUMO executivo em português do Brasil (até ~120 palavras): nível geral de lealdade (NPS), 2–3 recorrências ' +
      'nos comentários, e a prioridade da vez. Não invente números além dos fornecidos.\n\nRESPOSTAS:\n' + dados
    : 'Você é um analista de experiência do cliente de um espaço de eventos. Agrupe os comentários abaixo em TEMAS recorrentes. ' +
      'Para cada tema, escreva uma linha no formato "- <tema> (<nº de menções>): <ação sugerida objetiva>". ' +
      'Liste no máximo 6 temas, dos mais frequentes/críticos aos menores. Português do Brasil. Não invente menções inexistentes.\n\nCOMENTÁRIOS:\n' + dados;

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.5, prompt });
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo.', detail: String(e) }, { status: 502 });
  }
}
