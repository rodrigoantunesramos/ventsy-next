import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { limiteDoPlano, enviadasNoMes, type Campanha } from '@/lib/campanhas';
import { processarCampanhaEmail, enviarTeste } from '../_dispatch';

// Disparo de uma campanha (/painel/campanhas) — AUTENTICADO + service-role.
//   POST { id, teste }     → envia um e-mail de teste para `teste` (sem tocar na fila)
//   POST { id }            → inicia o envio: valida plano/opt-out e processa o 1º lote
//                            da fila (`campanhas_envios`); o cron retoma o restante.
// A identidade é SEMPRE o JWT; a posse é checada por usuario_id (nunca o corpo).
// WhatsApp/SMS degradam para envio manual (links wa.me no painel) → code 'MANUAL'.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return Response.json({ error: 'id da campanha é obrigatório.' }, { status: 400 });

  const { data: camp, error } = await admin
    .from('campanhas').select('id, usuario_id, nome, canal, assunto, corpo, status, enviada_em').eq('id', id).maybeSingle();
  if (error) return Response.json({ error: 'Não foi possível carregar a campanha.' }, { status: 500 });
  if (!camp) return Response.json({ error: 'Campanha não encontrada.' }, { status: 404 });
  if (camp.usuario_id !== user.id) return forbidden();

  // ── Teste ─────────────────────────────────────────────────────────────────
  if (body.teste) {
    const destino = String(body.teste).trim();
    if (!destino.includes('@')) return Response.json({ error: 'Informe um e-mail de teste válido.' }, { status: 400 });
    const r = await enviarTeste(camp, destino, String(body.empresa || ''));
    if (!r.ok) return Response.json({ code: r.code, error: r.error }, { status: r.code === 'NO_SMTP' || r.code === 'MANUAL' ? 200 : 502 });
    return Response.json({ ok: true });
  }

  // ── WhatsApp/SMS: envio manual (degrade) ────────────────────────────────────
  if (camp.canal !== 'email') {
    return Response.json({ code: 'MANUAL', message: 'Canal sem provedor de API — use os links de WhatsApp gerados no painel.' });
  }

  // ── Limite do plano (mês corrente) ──────────────────────────────────────────
  const { data: assin } = await admin.from('assinaturas').select('plano_ativo, plano').eq('usuario_id', user.id).maybeSingle();
  const plano = (assin?.plano_ativo || assin?.plano || 'basico').toString().toLowerCase();
  const limite = limiteDoPlano(plano);
  if (limite <= 0) {
    return Response.json({ code: 'PLAN', error: 'Envio em massa por e-mail está disponível a partir do plano Pro.' }, { status: 200 });
  }
  const { data: minhas } = await admin.from('campanhas').select('n_enviados, enviada_em, criado_em').eq('usuario_id', user.id);
  const usado = enviadasNoMes((minhas || []) as Campanha[], new Date());
  const restante = Math.max(0, limite - usado);
  if (restante <= 0) {
    return Response.json({ code: 'LIMIT', error: `Limite mensal do plano atingido (${limite} envios).`, limite, restante: 0 }, { status: 200 });
  }

  // Fila pendente desta campanha.
  const { count: filaCount } = await admin
    .from('campanhas_envios').select('id', { count: 'exact', head: true }).eq('campanha_id', id).eq('status', 'fila');
  if (!filaCount) {
    return Response.json({ code: 'EMPTY', error: 'Não há destinatários na fila desta campanha.' }, { status: 200 });
  }

  // Marca como "enviando" e processa o primeiro lote (o cron retoma o restante).
  await admin.from('campanhas').update({ status: 'enviando' }).eq('id', id);
  const res = await processarCampanhaEmail(camp, restante);
  if (res.code === 'NO_SMTP') {
    return Response.json({ code: 'NO_SMTP', error: 'SMTP não configurado. Defina SMTP_USER/SMTP_PASS para enviar e-mails.' }, { status: 200 });
  }
  return Response.json({
    ok: true,
    enviados: res.enviados, falhas: res.falhas, descadastrados: res.descadastrados,
    restantes: res.restantes,
    status: res.restantes > 0 ? 'enviando' : 'enviada',
  });
}
