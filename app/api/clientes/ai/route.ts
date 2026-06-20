import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { formatMoney } from '@/lib/format';

// IA do CRM 360º (/painel/clientes) via Vercel AI Gateway (string "provider/model").
// Ações: summary (raio-x do cliente), next_action (próxima melhor ação),
// reactivation (rascunho de mensagem de reativação). Degrada sem AI_GATEWAY_API_KEY.
const MODEL = process.env.CLIENTES_AI_MODEL || 'anthropic/claude-haiku-4-5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const GANHOS = new Set(['contratado', 'briefing', 'pronto', 'montagem', 'finalizado', 'pos']);
const brlInt = (n: number) => formatMoney(n, { maximumFractionDigits: 0 });
const dt = (d: string | null) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '—');

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
  const action = String(body.action || '');
  const clienteId = String(body.cliente_id || '');
  if (!clienteId) return Response.json({ error: 'cliente_id obrigatório.' }, { status: 400 });

  // ── Carrega o cliente + histórico (sempre escopado ao dono) ─────────────────
  const { data: cliente } = await sb
    .from('clientes').select('*').eq('id', clienteId).eq('usuario_id', user.id).maybeSingle();
  if (!cliente) return Response.json({ error: 'Cliente não encontrado.' }, { status: 404 });

  const nome = String(cliente.nome || '').trim();
  const [{ data: evVinc }, { data: evOrf }, { data: inter }] = await Promise.all([
    sb.from('clientes_eventos').select('id,nome_evento,tipo_evento,status,data_inicio,valor_total_num')
      .eq('usuario_id', user.id).eq('cliente_id', clienteId),
    sb.from('clientes_eventos').select('id,nome_evento,tipo_evento,status,data_inicio,valor_total_num')
      .eq('usuario_id', user.id).is('cliente_id', null).ilike('quem_contratou', nome),
    sb.from('clientes_interacoes').select('tipo,conteudo,data')
      .eq('usuario_id', user.id).eq('cliente_id', clienteId).order('data', { ascending: false }).limit(12),
  ]);

  const eventos = [...(evVinc || []), ...(evOrf || [])];
  const ganhos = eventos.filter((e: any) => GANHOS.has(e.status));
  const valorContratado = ganhos.reduce((s: number, e: any) => s + (Number(e.valor_total_num) || 0), 0);

  const ids = eventos.map((e: any) => e.id);
  let recebido = 0, emAberto = 0;
  if (ids.length) {
    const { data: ps } = await sb.from('parcelas').select('valor,status,evento_id').eq('usuario_id', user.id).in('evento_id', ids);
    for (const p of ps || []) {
      if (p.status === 'pago') recebido += Number(p.valor) || 0;
      else if (p.status !== 'cancelado') emAberto += Number(p.valor) || 0;
    }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const futuros = ganhos.filter((e: any) => e.data_inicio && e.data_inicio >= hoje)
    .sort((a: any, b: any) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));
  const passados = ganhos.filter((e: any) => e.data_inicio && e.data_inicio < hoje)
    .sort((a: any, b: any) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));

  // ── Monta o contexto factual para o modelo ──────────────────────────────────
  const ctx = [
    `Cliente: ${nome} (${cliente.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'})`,
    cliente.cidade ? `Cidade: ${cliente.cidade}${cliente.estado ? '/' + cliente.estado : ''}` : '',
    cliente.origem ? `Origem: ${cliente.origem}` : '',
    (cliente.tags || []).length ? `Tags: ${(cliente.tags || []).join(', ')}` : '',
    cliente.segmento ? `Segmento (dono): ${cliente.segmento}` : '',
    `Eventos ganhos: ${ganhos.length} de ${eventos.length} no total`,
    `Valor contratado (vida): ${brlInt(valorContratado)} · Recebido: ${brlInt(recebido)} · Em aberto: ${brlInt(emAberto)}`,
    passados.length ? `Último evento realizado: ${passados[0].tipo_evento || 'Evento'} em ${dt(passados[0].data_inicio)}` : 'Nenhum evento realizado ainda',
    futuros.length ? `Próximo evento: ${futuros[0].tipo_evento || 'Evento'} em ${dt(futuros[0].data_inicio)}` : 'Nenhum evento futuro agendado',
    eventos.length ? 'Eventos:\n' + eventos.map((e: any) => `  - ${e.tipo_evento || 'Evento'} "${e.nome_evento || ''}" · ${e.status} · ${dt(e.data_inicio)} · ${brlInt(Number(e.valor_total_num) || 0)}`).join('\n') : '',
    (inter || []).length ? 'Interações recentes:\n' + (inter || []).map((i: any) => `  - (${dt(i.data)}) [${i.tipo}] ${i.conteudo || ''}`).join('\n') : '',
  ].filter(Boolean).join('\n');

  const base =
    'Você é o assistente de relacionamento de um gestor de espaços/serviços de eventos. ' +
    'Use SOMENTE os dados factuais abaixo, em português do Brasil, tom profissional e cordial. ' +
    'Não invente fatos nem valores.\n\nDADOS DO CLIENTE:\n' + ctx + '\n\n';

  const prompts: Record<string, { temperature: number; instr: string }> = {
    summary: { temperature: 0.4, instr: 'Escreva um resumo (raio-x) do cliente em UM parágrafo de 3 a 5 frases: quem é, valor gerado, comportamento e situação atual do relacionamento.' },
    next_action: { temperature: 0.5, instr: 'Sugira a PRÓXIMA MELHOR AÇÃO comercial para este cliente em 2 a 3 frases objetivas e acionáveis (o que fazer e por quê). Se houver parcela em aberto ou inatividade, priorize.' },
    reactivation: { temperature: 0.7, instr: 'Escreva um rascunho curto (4 a 6 linhas) de mensagem de reativação para WhatsApp/e-mail, calorosa e personalizada com o histórico, terminando com uma chamada para conversar sobre um novo evento. Use {{nome}} se quiser personalizar o cumprimento.' },
  };
  const cfg = prompts[action];
  if (!cfg) return Response.json({ error: 'Ação inválida.' }, { status: 400 });

  try {
    const { text } = await generateText({ model: MODEL, temperature: cfg.temperature, prompt: base + cfg.instr });
    return Response.json({ text: text.trim() });
  } catch (e) {
    return Response.json(
      { error: 'Falha na IA. Verifique a chave e o modelo configurados.', detail: String(e) },
      { status: 502 },
    );
  }
}
