import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emailConfigurado } from '@/lib/email';
import { limiteDoPlano, enviadasNoMes, type Campanha } from '@/lib/campanhas';
import { processarCampanhaEmail } from '../../campanhas/_dispatch';

// Cron de Campanhas — processa a fila de forma assíncrona (a UI nunca bloqueia).
//   1) ATIVA campanhas agendadas cujo horário chegou (status agendada → enviando).
//   2) PROCESSA um lote das campanhas em "enviando" (e-mail), respeitando o limite
//      mensal do plano de cada dono; finaliza para "enviada" quando a fila zera.
//
// Segurança: exige CRON_SECRET (a Vercel injeta Authorization: Bearer <CRON_SECRET>;
// teste manual com ?secret=<CRON_SECRET>). Registre o agendamento no pg_cron do
// Supabase apontando para www.ventsy.com.br/api/cron/campanhas (padrão do projeto).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const MAX_CAMPANHAS = 25;  // por execução

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
  const qs = new URL(req.url).searchParams.get('secret') || '';
  return bearer === secret || qs === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 });

  const agora = new Date();
  const nowIso = agora.toISOString();

  // 1) Ativa agendadas (somente e-mail tem envio automático).
  const { data: ativadas } = await admin
    .from('campanhas').update({ status: 'enviando' })
    .eq('status', 'agendada').eq('canal', 'email').lte('agendada_para', nowIso)
    .select('id');
  const nAtivadas = (ativadas || []).length;

  if (!emailConfigurado()) {
    return Response.json({ ativadas: nAtivadas, processadas: 0, motivo: 'SMTP não configurado' });
  }

  // 2) Processa campanhas em andamento.
  const { data: emAndamento } = await admin
    .from('campanhas').select('id, usuario_id, nome, canal, assunto, corpo, status, enviada_em')
    .eq('status', 'enviando').eq('canal', 'email').limit(MAX_CAMPANHAS);
  const campanhas = (emAndamento || []) as { id: string; usuario_id: string; nome: string; canal: string; assunto: string | null; corpo: string; status: string; enviada_em: string | null }[];

  if (!campanhas.length) return Response.json({ ativadas: nAtivadas, processadas: 0 });

  // Limite mensal por dono: usado = Σ n_enviados das campanhas do dono no mês.
  const donoIds = Array.from(new Set(campanhas.map((c) => c.usuario_id)));
  const { data: assins } = await admin.from('assinaturas').select('usuario_id, plano_ativo, plano').in('usuario_id', donoIds);
  const planoDe = new Map<string, string>();
  ((assins || []) as { usuario_id: string; plano_ativo: string | null; plano: string | null }[])
    .forEach((a) => planoDe.set(a.usuario_id, (a.plano_ativo || a.plano || 'basico').toLowerCase()));
  const { data: todas } = await admin.from('campanhas').select('usuario_id, n_enviados, enviada_em, criado_em').in('usuario_id', donoIds);
  const usadoDe = new Map<string, number>();
  for (const uid of donoIds) {
    const minhas = ((todas || []) as (Campanha & { usuario_id: string })[]).filter((c) => c.usuario_id === uid);
    usadoDe.set(uid, enviadasNoMes(minhas as Campanha[], agora));
  }

  let processadas = 0, enviados = 0, falhas = 0;
  for (const c of campanhas) {
    const limite = limiteDoPlano(planoDe.get(c.usuario_id) || 'basico');
    const restante = Math.max(0, limite - (usadoDe.get(c.usuario_id) || 0));
    if (restante <= 0) continue;
    const r = await processarCampanhaEmail(c, restante);
    processadas++;
    enviados += r.enviados; falhas += r.falhas;
    usadoDe.set(c.usuario_id, (usadoDe.get(c.usuario_id) || 0) + r.enviados);  // consome a cota dentro da execução
  }

  return Response.json({ ativadas: nAtivadas, processadas, enviados, falhas });
}
