import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emailConfigurado, sendEmail } from '@/lib/email';
import { signPesquisaToken } from '@/lib/pesquisaToken';
import { diasDisparo, ymd, type Gatilho } from '@/lib/pesquisas';

// Cron de Pesquisas — disparo AUTOMÁTICO pós-evento (best-effort, via e-mail).
//   Para cada pesquisa ATIVA com gatilho 'pos_evento'/'dias_apos', encontra os
//   eventos do dono que ocorreram há exatamente N dias (janela de 1 dia ⇒ envio
//   único, sem tabela de envios) e que têm e-mail, e manda o link público assinado.
//   Evita duplicar checando se já existe resposta daquele (pesquisa, evento).
//
// Segurança: exige CRON_SECRET (a Vercel injeta Authorization: Bearer <CRON_SECRET>;
// teste manual com ?secret=<CRON_SECRET>). Registre no pg_cron do Supabase apontando
// para www.ventsy.com.br/api/cron/pesquisas-pos-evento (padrão do projeto).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const MAX_PESQUISAS = 50;
const MAX_EMAILS = 200;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
  return bearer === secret;
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br').replace(/\/$/, '');
}

function addDias(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

type PesquisaRow = { id: string; usuario_id: string; titulo: string; gatilho: Gatilho; dias_apos: number | null };
type EventoRow = { id: string; nome_evento: string | null; quem_contratou: string | null; email: string | null };

function emailHtml(titulo: string, nomeEvento: string | null, contratante: string | null, link: string): string {
  const ola = contratante ? `Olá, ${contratante}!` : 'Olá!';
  const sobre = nomeEvento ? `sobre <strong>${nomeEvento}</strong> ` : '';
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <p style="font-size:16px">${ola}</p>
    <p style="font-size:15px;line-height:1.6">Sua opinião ${sobre}vale muito para nós. Leva menos de 1 minuto e nos ajuda a melhorar de verdade.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#ff385c;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block">${titulo}</a>
    </p>
    <p style="font-size:12px;color:#6b7280">Se o botão não abrir, copie e cole este link no navegador:<br>${link}</p>
  </div>`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 });

  // Ativa só com e-mail configurado (o disparo automático é por e-mail).
  if (!emailConfigurado()) {
    return Response.json({ enviados: 0, motivo: 'SMTP não configurado' });
  }

  const { data: pesquisas } = await admin
    .from('pesquisas')
    .select('id, usuario_id, titulo, gatilho, dias_apos')
    .eq('ativo', true).in('gatilho', ['pos_evento', 'dias_apos'])
    .limit(MAX_PESQUISAS);
  const lista = (pesquisas || []) as PesquisaRow[];
  if (!lista.length) return Response.json({ enviados: 0, pesquisas: 0 });

  const hoje = new Date();
  let enviados = 0, falhas = 0, considerados = 0;

  for (const pq of lista) {
    if (enviados >= MAX_EMAILS) break;
    const n = diasDisparo(pq);
    if (!n) continue;
    // Janela de 1 dia: eventos cuja data_inicio é exatamente N dias atrás ⇒ envio único.
    const alvo = addDias(hoje, -n);
    const ini = ymd(alvo);
    const fim = ymd(addDias(alvo, 1));

    const { data: eventos } = await admin
      .from('clientes_eventos')
      .select('id, nome_evento, quem_contratou, email')
      .eq('usuario_id', pq.usuario_id)
      .gte('data_inicio', ini).lt('data_inicio', fim)
      .not('email', 'is', null)
      .limit(MAX_EMAILS);
    const evs = (eventos || []) as EventoRow[];

    for (const ev of evs) {
      if (enviados >= MAX_EMAILS) break;
      const to = (ev.email || '').trim();
      if (!to) continue;
      considerados++;

      // Não reenvia se já respondeu este (pesquisa, evento).
      const { data: jaResp } = await admin
        .from('pesquisas_respostas').select('id')
        .eq('pesquisa_id', pq.id).eq('evento_id', ev.id).limit(1);
      if ((jaResp || []).length) continue;

      const link = `${baseUrl()}/pesquisa/${signPesquisaToken(pq.id, ev.id)}`;
      try {
        const r = await sendEmail({ to, subject: pq.titulo, html: emailHtml(pq.titulo, ev.nome_evento, ev.quem_contratou, link) });
        if (r.ok) enviados++; else falhas++;
      } catch { falhas++; }
    }
  }

  return Response.json({ pesquisas: lista.length, considerados, enviados, falhas });
}
