import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { type Automacao, type Gatilho, type Acao, GATILHO_BY, ACAO_BY } from '@/lib/automacoes';
import { executarAutomacoes, previaAutomacao, hojeUTC } from './_engine';

// Operações manuais de Automações (service-role). Despacha por `action`:
//   • previa     — dry-run SEM dedup: descreve os alvos que casariam HOJE com a
//                  regra (aceita regra AINDA NÃO salva, vinda do construtor).
//   • testar     — executa UMA automação salva agora, de verdade (deduplicado por
//                  dia: não dispara em cima do que o cron já fez).
//   • processar  — roda TODAS as automações ativas do dono agora ("rodar agora").
// O CRUD das automações e a leitura/baixa de notificações ficam no client via RLS.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const SEL = 'id,usuario_id,nome,gatilho,condicao,acao,acao_config,ativo,ultima_exec,n_exec,criado_em,atualizado_em';

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normAutomacao(r: any): Automacao {
  const cond = r.condicao && typeof r.condicao === 'object' && !Array.isArray(r.condicao) ? r.condicao : {};
  const cfg = r.acao_config && typeof r.acao_config === 'object' && !Array.isArray(r.acao_config) ? r.acao_config : {};
  return {
    id: String(r.id), usuario_id: r.usuario_id ?? '', nome: r.nome ?? '',
    gatilho: (r.gatilho ?? 'evento_criado') as Gatilho, condicao: cond,
    acao: (r.acao ?? 'notificar') as Acao, acao_config: cfg, ativo: r.ativo !== false,
    ultima_exec: r.ultima_exec ?? null, n_exec: Number(r.n_exec) || 0,
    criado_em: r.criado_em ?? '', atualizado_em: r.atualizado_em ?? '',
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  switch (action) {
    case 'previa':    return previa(user.id, body);
    case 'testar':    return testar(user.id, body);
    case 'processar': return processar(user.id);
    default:          return badRequest('ação inválida');
  }
}

// ── previa: aceita regra inline (do construtor), valida o gatilho/ação ────────
async function previa(uid: string, body: Record<string, unknown>) {
  const raw = (body.automacao || {}) as Record<string, unknown>;
  const gatilho = String(raw.gatilho || '') as Gatilho;
  const acao = String(raw.acao || 'notificar') as Acao;
  if (!GATILHO_BY[gatilho]) return badRequest('gatilho inválido');
  if (!ACAO_BY[acao]) return badRequest('ação inválida');
  const a: Automacao = normAutomacao({
    id: raw.id || 'preview', usuario_id: uid, nome: raw.nome || 'Prévia',
    gatilho, condicao: raw.condicao || {}, acao, acao_config: raw.acao_config || {}, ativo: true, n_exec: 0,
  });
  const r = await previaAutomacao(uid, a, hojeUTC());
  return Response.json(r);
}

// ── testar: executa uma automação salva agora ────────────────────────────────
async function testar(uid: string, body: Record<string, unknown>) {
  const id = String(body.id || '');
  if (!id) return badRequest('id é obrigatório');
  const { data } = await admin.from('automacoes').select(SEL).eq('id', id).maybeSingle();
  if (!data) return badRequest('automação não encontrada');
  if (data.usuario_id !== uid) return forbidden();
  // Força execução ainda que esteja inativa (é um teste sob demanda).
  const a = { ...normAutomacao(data), ativo: true };
  const r = await executarAutomacoes(uid, [a], hojeUTC());
  return Response.json(r);
}

// ── processar: roda todas as automações ativas do dono ───────────────────────
async function processar(uid: string) {
  const { data, error } = await admin.from('automacoes').select(SEL).eq('usuario_id', uid).eq('ativo', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const automacoes = ((data || []) as unknown[]).map(normAutomacao);
  const r = await executarAutomacoes(uid, automacoes, hojeUTC());
  return Response.json(r);
}
