import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isMissingTable, type Automacao, type Gatilho, type Acao } from '@/lib/automacoes';
import { executarAutomacoes, hojeUTC } from '../../automacoes/_engine';

// Cron de Automações — processador TEMPORAL diário das regras "se isto, então
// aquilo". Varre TODAS as automações ativas (de todos os donos), agrupa por dono
// e executa via o núcleo compartilhado (app/api/automacoes/_engine): seleciona os
// alvos que disparam HOJE, deduplica por dia (automacoes_log) e executa a ação
// (in-app/e-mail/WhatsApp/mover-funil). É a FONTE DE VERDADE dos disparos por data.
//
// Segurança: exige CRON_SECRET (a Vercel injeta Authorization: Bearer <CRON_SECRET>;
// teste manual com ?secret=<CRON_SECRET>). Simulação: ?dry=1 (conta sem executar).
// Registre o agendamento no pg_cron do Supabase apontando para
// www.ventsy.com.br/api/cron/automacoes (ver docs/sql/automacoes.sql).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const MAX_AUTOMACOES = 2000;     // por execução (todos os donos)
const SEL = 'id,usuario_id,nome,gatilho,condicao,acao,acao_config,ativo,ultima_exec,n_exec,criado_em,atualizado_em';

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
  return bearer === secret;
}

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

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const hoje = hojeUTC();

  const { data, error } = await admin.from('automacoes').select(SEL).eq('ativo', true).limit(MAX_AUTOMACOES);
  if (error) {
    if (isMissingTable(error)) return Response.json({ skipped: 'tabela automacoes ausente (rode docs/sql/automacoes.sql)' });
    return Response.json({ error: error.message }, { status: 500 });
  }
  const todas = ((data || []) as unknown[]).map(normAutomacao);
  if (!todas.length) return Response.json({ dry, hoje, donos: 0, executados: 0 });

  // Agrupa por dono — cada dono carrega seus dados uma vez no _engine.
  const porDono = new Map<string, Automacao[]>();
  for (const a of todas) {
    const arr = porDono.get(a.usuario_id) || [];
    arr.push(a);
    porDono.set(a.usuario_id, arr);
  }

  let executados = 0, alvos = 0, pulados = 0, falhas = 0;
  for (const [uid, lista] of porDono) {
    try {
      const r = await executarAutomacoes(uid, lista, hoje, { dry });
      executados += r.executados; alvos += r.alvos; pulados += r.pulados; falhas += r.falhas;
    } catch (e) {
      falhas++;
      // não interrompe os demais donos
      console.error('automacoes cron: dono', uid, String((e as Error).message));
    }
  }

  return Response.json({ dry, hoje, donos: porDono.size, automacoes: todas.length, alvos, executados, pulados, falhas });
}
