import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { carregarDados, hojeUTC } from '@/app/api/automacoes/_engine';
import { pendenciasDoDia, eventoLabel, ymdOf } from '@/lib/automacoes';
import { formatMoney } from '@/lib/format';
import {
  detectarIntent, responderLocal, panoramaParaTexto,
  SUGESTOES_INICIAIS, type Panorama,
} from '@/lib/copilotIntents';

// Ventsy Copilot — assistente GLOBAL do painel.
// Estratégia HÍBRIDA: primeiro tenta uma resposta DETERMINÍSTICA (lib/copilotIntents)
// computada do PANORAMA real — instantânea, grátis e funciona mesmo SEM chave de
// IA. Só cai no LLM (generateText via AI Gateway, padrão do projeto) para
// perguntas abertas, sempre ancorado no mesmo panorama (sem inventar números).

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = process.env.COPILOT_AI_MODEL || 'anthropic/claude-haiku-4-5';
const GANHOS = new Set(['contratado', 'briefing', 'pronto', 'montagem', 'finalizado', 'pos']);
const brl = (n: number) => formatMoney(n, { maximumFractionDigits: 0 });
const dataBR = (d: string | null) => {
  const y = ymdOf(d);
  return y ? new Date(y + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

function addDias(ymd: string, n: number): string {
  const dt = new Date(ymd + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

async function montarPanorama(uid: string, hoje: string): Promise<Panorama> {
  const d = await carregarDados(uid);
  const pend = pendenciasDoDia(d, hoje, 30);

  const ganhos = d.eventos.filter((e) => e.status && GANHOS.has(e.status));
  const contratado = ganhos.reduce((s, e) => s + (Number(e.valor_total_num) || 0), 0);

  let recebido = 0, aberto = 0, aVencer30 = 0;
  const lim30 = addDias(hoje, 30);
  for (const p of d.parcelas) {
    const pago = (p.status || '') === 'pago' || !!p.pago_em;
    if (pago) { recebido += Number(p.valor) || 0; continue; }
    if ((p.status || '') === 'cancelado') continue;
    aberto += Number(p.valor) || 0;
    const venc = ymdOf(p.vencimento);
    if (venc && venc >= hoje && venc <= lim30) aVencer30 += Number(p.valor) || 0;
  }

  const proximosEventos = d.eventos
    .filter((e) => ymdOf(e.data_inicio) && ymdOf(e.data_inicio)! >= hoje)
    .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''))
    .slice(0, 8)
    .map((e) => ({
      titulo: eventoLabel(e), tipo: e.tipo_evento || '', data: dataBR(e.data_inicio),
      valor: Number(e.valor_total_num) || 0, status: e.status || '',
    }));

  // Enriquecimento (guardado): reservas futuras confirmadas + avaliação média.
  let reservasFuturas = 0;
  try {
    const { data } = await admin.from('reservas').select('status,data_inicio,inicio').eq('usuario_id', uid);
    const ok = new Set(['confirmada', 'aprovada', 'paga', 'reservado']);
    reservasFuturas = (data || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ok.has(String(r.status || '').toLowerCase()) && (ymdOf(r.data_inicio) || ymdOf(r.inicio) || '') >= hoje,
    ).length;
  } catch { /* tabela ausente → 0 */ }

  let avaliacao: number | null = null;
  try {
    const { data } = await admin.from('propriedades').select('avaliacao').eq('usuario_id', uid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vals = (data || []).map((p: any) => Number(p.avaliacao)).filter((v: number) => v > 0);
    if (vals.length) avaliacao = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  } catch { /* ignore */ }

  // Métricas analíticas (puras, do que já carregamos).
  const ticketMedio = ganhos.length ? contratado / ganhos.length : 0;
  const taxaConversao = d.eventos.length ? Math.round((ganhos.length / d.eventos.length) * 100) : 0;
  let topEv: { e: (typeof d.eventos)[number]; v: number } | null = null;
  for (const e of d.eventos) {
    const v = Number(e.valor_total_num) || 0;
    if (v > 0 && (!topEv || v > topEv.v)) topEv = { e, v };
  }
  const eventoMaisValioso = topEv
    ? { titulo: eventoLabel(topEv.e), tipo: topEv.e.tipo_evento || '', data: dataBR(topEv.e.data_inicio), valor: topEv.v, status: topEv.e.status || '' }
    : null;
  let inadimplenciaValor = 0, inadimplenciaQtd = 0;
  for (const p of d.parcelas) {
    const pago = (p.status || '') === 'pago' || !!p.pago_em;
    if (pago || (p.status || '') === 'cancelado') continue;
    const venc = ymdOf(p.vencimento);
    if (venc && venc < hoje) { inadimplenciaValor += Number(p.valor) || 0; inadimplenciaQtd++; }
  }
  const tipoMap = new Map<string, number>();
  for (const e of d.eventos) { const tp = (e.tipo_evento || '').trim(); if (tp) tipoMap.set(tp, (tipoMap.get(tp) || 0) + 1); }
  const tiposEvento = Array.from(tipoMap.entries()).map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n).slice(0, 6);

  return {
    hoje,
    contratado, recebido, aberto, aVencer30,
    eventosTotal: d.eventos.length, eventosGanhos: ganhos.length,
    contratosPendentes: d.contratos.filter((c) => (c.status || '') === 'enviado').length,
    parcelasAtrasadas: pend.filter((p) => p.tipo === 'parcela' && p.urgencia === 'critico').length,
    licencasVencendo: pend.filter((p) => p.tipo === 'licenca').length,
    clientes: d.clientes.length,
    reservasFuturas,
    avaliacao,
    ticketMedio, taxaConversao, inadimplenciaValor, inadimplenciaQtd,
    eventoMaisValioso, tiposEvento,
    proximosEventos,
    pendencias: pend.slice(0, 12).map((p) => ({ titulo: p.titulo, sub: p.sub, urgencia: p.urgencia, valor: p.valor_num, tipo: String(p.tipo) })),
  };
}

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: Msg[] = incoming
    .filter((m: unknown): m is Msg => {
      const r = (m as Msg)?.role;
      return (r === 'user' || r === 'assistant') && typeof (m as Msg).content === 'string';
    })
    .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  if (!messages.length) return Response.json({ error: 'Sem mensagem.' }, { status: 400 });

  const ultima = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const hoje = hojeUTC();

  let panorama: Panorama | null = null;
  try { panorama = await montarPanorama(user.id, hoje); } catch { panorama = null; }

  // 1) Resposta DETERMINÍSTICA (sem LLM) para perguntas comuns — instantânea,
  //    funciona sem chave de IA e já traz deep-links + follow-ups.
  const intent = panorama ? detectarIntent(ultima) : null;
  if (panorama && intent) {
    const r = responderLocal(intent, panorama, { money: brl });
    return Response.json({ text: r.texto, chips: r.chips, sugestoes: r.sugestoes, fonte: 'local' });
  }

  // 2) Pergunta aberta → LLM ancorado no panorama. Degrada sem chave (mas as
  //    perguntas diretas acima continuam respondendo).
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({
      code: 'NO_KEY',
      error: 'A IA aberta ainda não está ativada aqui — mas eu respondo perguntas diretas sobre o seu painel. Experimente uma das sugestões.',
      sugestoes: SUGESTOES_INICIAIS,
    });
  }

  const system = [
    'Você é o Ventsy Copilot, o assistente do painel de um gestor de espaços e eventos.',
    `Hoje é ${hoje} (formato YYYY-MM-DD).`,
    'Responda em português do Brasil, de forma concisa, prática e cordial.',
    'Use SOMENTE os dados do PANORAMA abaixo — NUNCA invente números, nomes, datas ou valores.',
    'Se a pergunta pedir algo fora do panorama, seja honesto e aponte o módulo do painel onde encontrar (ex.: /painel/recebiveis, /painel/clientes, /painel/calendario, /painel/contratos, /painel/relatorios).',
    'Quando útil, termine sugerindo a próxima ação. Texto limpo, sem markdown pesado.',
    '',
    'PANORAMA DO NEGÓCIO (dados reais do dono, gerados agora):',
    panorama ? panoramaParaTexto(panorama, { money: brl }) : '(indisponível)',
  ].join('\n');

  try {
    const { text } = await generateText({ model: MODEL, temperature: 0.3, system, messages });
    return Response.json({ text: text.trim(), fonte: 'ia', sugestoes: SUGESTOES_INICIAIS });
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA aberta. Mas eu respondo perguntas diretas sobre seu painel — tente uma das sugestões.', detail: String(e), sugestoes: SUGESTOES_INICIAIS },
      { status: 502 },
    );
  }
}
