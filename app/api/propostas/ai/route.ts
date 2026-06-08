import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// IA das Propostas (/painel/propostas) via Vercel AI Gateway (string "provider/model").
// Ações: texto (redige observações/escopo), upsell (sugere pacotes/serviços),
// pagamento (sugere condição de pagamento). Pro+ (gating leve no servidor).
// Degrada sem AI_GATEWAY_API_KEY. Sem "R$" hardcoded — moeda formatada via Intl
// com a moeda recebida da proposta.
const MODEL = process.env.PROPOSTAS_AI_MODEL || 'anthropic/claude-haiku-4-5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const LOCALE_BY_MOEDA: Record<string, string> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'es-ES' };

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({ code: 'NO_KEY', error: 'IA não configurada. Defina AI_GATEWAY_API_KEY para ativar.' });
  }

  // Gating leve Pro+ (o cliente já oculta para o plano básico; aqui reforçamos).
  const { data: assin } = await sb.from('assinaturas').select('plano_ativo,plano').eq('usuario_id', user.id).maybeSingle();
  const plano = (assin?.plano_ativo || assin?.plano || 'basico').toString().toLowerCase();
  if (plano !== 'pro' && plano !== 'ultra') {
    return Response.json({ code: 'PRO_ONLY', error: 'Recurso disponível nos planos Pro e Ultra.' });
  }

  const body = await req.json();
  const action = String(body.action || '');
  const moeda = String(body.moeda || 'BRL');
  const locale = LOCALE_BY_MOEDA[moeda] || 'pt-BR';
  const money = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: moeda, maximumFractionDigits: 0 }).format(Number(n) || 0);
  const dt = (d: string | null) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d).toLocaleDateString(locale) : '—');

  const cliente = String(body.cliente || 'o cliente').trim();
  const tipoEvento = body.tipo_evento ? String(body.tipo_evento) : null;
  const data = body.data ? String(body.data) : null;
  const total = Number(body.total) || 0;
  const itens: { descricao: string; total: number }[] = Array.isArray(body.itens) ? body.itens : [];

  const ctx = [
    `Cliente/contratante: ${cliente}`,
    tipoEvento ? `Tipo de evento: ${tipoEvento}` : '',
    data ? `Data do evento: ${dt(data)}` : '',
    itens.length ? 'Itens do orçamento:\n' + itens.map((i) => `  - ${i.descricao}: ${money(i.total)}`).join('\n') : 'Sem itens detalhados.',
    `Valor total: ${money(total)}`,
  ].filter(Boolean).join('\n');

  const base =
    'Você é o assistente comercial de um gestor de espaços/serviços para eventos. ' +
    'Escreva em português do Brasil, tom profissional, caloroso e objetivo. ' +
    'Use SOMENTE os dados factuais abaixo; não invente itens, datas ou valores.\n\nDADOS DA PROPOSTA:\n' + ctx + '\n\n';

  const prompts: Record<string, { temperature: number; instr: string }> = {
    texto: { temperature: 0.6, instr: 'Redija o texto de apresentação/observações da proposta em 1 a 2 parágrafos curtos: agradeça o interesse, reforce o valor da experiência e do espaço, e convide a fechar. NÃO repita a lista de itens nem os valores. Não use saudação com data.' },
    upsell: { temperature: 0.7, instr: 'Sugira de 2 a 4 itens de upsell/cross-sell coerentes com o tipo de evento (ex.: decoração, buffet, som, hora extra, segurança), em formato de lista curta com um benefício cada. Não invente preços.' },
    pagamento: { temperature: 0.4, instr: 'Sugira UMA condição de pagamento equilibrada para este valor (entrada + parcelas), explicando em 2 a 3 frases por que ela reduz atrito e protege o caixa. Apresente também uma alternativa à vista com pequeno desconto sugerido em percentual (sem calcular o valor final).' },
  };
  const cfg = prompts[action];
  if (!cfg) return Response.json({ error: 'Ação inválida.' }, { status: 400 });

  try {
    const { text } = await generateText({ model: MODEL, temperature: cfg.temperature, prompt: base + cfg.instr });
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json({ error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) }, { status: 502 });
  }
}
