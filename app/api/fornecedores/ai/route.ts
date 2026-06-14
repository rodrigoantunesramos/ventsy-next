import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// IA de Fornecedores (/painel/fornecedores) via Vercel AI Gateway ("provider/model").
// Ações: resumo (raio-x do fornecedor), negociacao (dicas de negociação),
// risco (análise de risco/homologação). Degrada sem AI_GATEWAY_API_KEY.
const MODEL = process.env.FORNECEDORES_AI_MODEL || 'anthropic/claude-haiku-4-5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
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
  const fornecedorId = String(body.fornecedor_id || '');
  if (!fornecedorId) return Response.json({ error: 'fornecedor_id obrigatório.' }, { status: 400 });

  // ── Carrega o fornecedor + histórico (sempre escopado ao dono) ──────────────
  // Colunas explícitas (sem chave_pix/banco): dados bancários/PIX nem carregam nesta rota de IA.
  const { data: forn } = await sb
    .from('fornecedores')
    .select('id,nome,fantasia,tipo,categoria,cidade,estado,homologacao,condicoes_pagamento,prazo_entrega_dias,obs')
    .eq('id', fornecedorId).eq('usuario_id', user.id).maybeSingle();
  if (!forn) return Response.json({ error: 'Fornecedor não encontrado.' }, { status: 404 });

  const [{ data: desp }, { data: avals }, { data: docs }] = await Promise.all([
    sb.from('lancamentos').select('valor,data,status,descricao,categoria')
      .eq('usuario_id', user.id).eq('fornecedor_id', fornecedorId).eq('tipo', 'despesa'),
    sb.from('fornecedores_avaliacoes').select('nota,criterios,comentario,data')
      .eq('usuario_id', user.id).eq('fornecedor_id', fornecedorId).order('data', { ascending: false }).limit(10),
    sb.from('fornecedores_docs').select('nome,tipo,validade')
      .eq('usuario_id', user.id).eq('fornecedor_id', fornecedorId),
  ]);

  const despesas = (desp || []) as { valor: number; data: string | null; status: string; descricao: string | null; categoria: string | null }[];
  const ano = new Date().getFullYear();
  const total = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const ytd = despesas.filter((d) => (d.data || '').slice(0, 4) === String(ano)).reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const aberto = despesas.filter((d) => d.status !== 'pago').reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const avaliacoes = (avals || []) as { nota: number; criterios: Record<string, number>; comentario: string | null; data: string | null }[];
  const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + (Number(a.nota) || 0), 0) / avaliacoes.length : 0;
  const criterioMedia = (k: string) => {
    const vs = avaliacoes.map((a) => a.criterios?.[k]).filter((n): n is number => typeof n === 'number' && n > 0);
    return vs.length ? (vs.reduce((s, n) => s + n, 0) / vs.length).toFixed(1) : '—';
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const documentos = (docs || []) as { nome: string; tipo: string; validade: string | null }[];
  const vencidos = documentos.filter((d) => d.validade && d.validade < hoje);

  // ── Monta o contexto factual ────────────────────────────────────────────────
  const ctx = [
    `Fornecedor: ${forn.fantasia || forn.nome} (${forn.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'})`,
    `Categoria: ${forn.categoria}`,
    forn.cidade ? `Cidade: ${forn.cidade}${forn.estado ? '/' + forn.estado : ''}` : '',
    `Homologação: ${forn.homologacao}`,
    forn.condicoes_pagamento ? `Condições de pagamento: ${forn.condicoes_pagamento}` : '',
    forn.prazo_entrega_dias != null ? `Prazo de entrega: ${forn.prazo_entrega_dias} dias` : '',
    `Gasto total (vida): ${brl(total)} · Gasto em ${ano}: ${brl(ytd)} · Em aberto: ${brl(aberto)} · ${despesas.length} compra(s)`,
    avaliacoes.length
      ? `Avaliação média: ${media.toFixed(1)}/5 em ${avaliacoes.length} avaliação(ões) — Qualidade ${criterioMedia('qualidade')}, Prazo ${criterioMedia('prazo')}, Preço ${criterioMedia('preco')}, Atendimento ${criterioMedia('atendimento')}`
      : 'Sem avaliações registradas',
    avaliacoes.filter((a) => a.comentario).length
      ? 'Comentários recentes:\n' + avaliacoes.filter((a) => a.comentario).slice(0, 5).map((a) => `  - (${dt(a.data)}, nota ${a.nota}) ${a.comentario}`).join('\n')
      : '',
    `Documentos: ${documentos.length} no total${vencidos.length ? ` · ${vencidos.length} VENCIDO(S): ${vencidos.map((d) => d.nome).join(', ')}` : ' · nenhum vencido'}`,
    forn.obs ? `Observações do dono: ${forn.obs}` : '',
  ].filter(Boolean).join('\n');

  const base =
    'Você é o assistente de suprimentos de um gestor de espaços/serviços de eventos. ' +
    'Use SOMENTE os dados factuais abaixo, em português do Brasil, tom profissional e objetivo. ' +
    'Não invente fatos, valores ou documentos.\n\nDADOS DO FORNECEDOR:\n' + ctx + '\n\n';

  const prompts: Record<string, { temperature: number; instr: string }> = {
    resumo: { temperature: 0.4, instr: 'Escreva um resumo (raio-x) do fornecedor em UM parágrafo de 3 a 5 frases: o que fornece, quanto já foi gasto, desempenho nas avaliações e situação de homologação/documentos.' },
    negociacao: { temperature: 0.6, instr: 'Sugira 3 a 4 pontos de negociação acionáveis com este fornecedor (prazo, preço, condições, contrapartidas), baseados no histórico de gasto e desempenho. Use bullets curtos.' },
    risco: { temperature: 0.4, instr: 'Faça uma breve análise de risco em 2 a 4 frases: documentos vencidos, avaliação baixa, dependência/concentração de gasto ou contas em aberto. Se houver documento vencido, priorize alertar. Encerre com uma recomendação de homologação (homologar / manter em análise / bloquear).' },
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
