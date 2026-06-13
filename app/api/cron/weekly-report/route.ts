import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, emailConfigurado } from '@/lib/email';
import { formatMoney, formatNumber } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Digest semanal de desempenho — disparado por Vercel Cron (ver vercel.json).
//
// Segurança: exige CRON_SECRET. A Vercel injeta `Authorization: Bearer <CRON_SECRET>`
// automaticamente; para testar manualmente use ?secret=<CRON_SECRET>.
//
// Envio real só acontece com WEEKLY_REPORT_ENABLED=true E SMTP configurado.
// Caso contrário roda em dry-run (calcula e retorna o resumo, sem enviar).
// Force dry-run a qualquer momento com ?dry=1.

const SEMANA = 7 * 24 * 60 * 60 * 1000;
const CONTATO = new Set(['whatsapp', 'formulario']);

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
  return bearer === secret;
}

type Stats = { views: number; viewsPrev: number; contatos: number; reservas: number; pipeline: number };

function renderEmail(nome: string, propNome: string, s: Stats): string {
  const delta = s.viewsPrev > 0 ? Math.round(((s.views - s.viewsPrev) / s.viewsPrev) * 100) : null;
  const deltaTxt = delta != null && delta !== 0
    ? `<span style="color:${delta > 0 ? '#16a34a' : '#dc2626'};font-weight:700">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}%</span> vs. semana anterior`
    : 'na última semana';
  const card = (label: string, valor: string) => `
    <td style="padding:14px 10px;text-align:center;background:#fff;border:1px solid #eee;border-radius:12px">
      <div style="font-size:22px;font-weight:800;color:#111">${valor}</div>
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">${label}</div>
    </td>`;
  const url = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br') + '/painel/relatorios';

  return `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:26px;font-weight:700;color:#ff385c">VENTSY</div>
      <div style="background:#fff;border-radius:18px;padding:26px;margin-top:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <h1 style="font-size:18px;color:#111;margin:0 0 4px">Olá, ${nome}! 👋</h1>
        <p style="font-size:14px;color:#555;margin:0 0 2px">Resumo da semana do seu anúncio <strong>${propNome}</strong>.</p>
        <p style="font-size:13px;color:#888;margin:0 0 18px">Suas visualizações: ${deltaTxt}.</p>
        <table width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate">
          <tr>${card('Visualizações', formatNumber(s.views))}${card('Contatos', formatNumber(s.contatos))}</tr>
          <tr>${card('Reservas', formatNumber(s.reservas))}${card('Pipeline', s.pipeline > 0 ? formatMoney(s.pipeline) : '—')}</tr>
        </table>
        <a href="${url}" style="display:block;text-align:center;margin-top:22px;background:#ff385c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px;border-radius:999px">Ver relatório completo →</a>
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">
        Você recebe este resumo por ser anfitrião na Ventsy.
      </p>
    </div>
  </body></html>`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 });

  const dryParam = new URL(req.url).searchParams.get('dry') === '1';
  const podeEnviar = process.env.WEEKLY_REPORT_ENABLED === 'true' && emailConfigurado();
  const dryRun = dryParam || !podeEnviar;

  const now = Date.now();
  const ini7 = new Date(now - SEMANA).toISOString();
  const ini14 = new Date(now - 2 * SEMANA).toISOString();

  // Propriedades + donos
  const { data: props } = await supabaseAdmin.from('propriedades').select('id,nome,usuario_id');
  const lista = (props || []) as { id: number | string; nome: string | null; usuario_id: string | null }[];
  if (lista.length === 0) return Response.json({ dryRun, total: 0, enviados: 0, pulados: 0 });

  const donoIds = Array.from(new Set(lista.map((p) => p.usuario_id).filter(Boolean))) as string[];
  const { data: usuarios } = await supabaseAdmin.from('usuarios').select('id,nome,email').in('id', donoIds);
  const donoDe = new Map<string, { nome: string | null; email: string | null }>();
  (usuarios || []).forEach((u: { id: string; nome: string | null; email: string | null }) => donoDe.set(u.id, { nome: u.nome, email: u.email }));

  // Eventos (14 dias) + reservas (7 dias)
  const { data: evs } = await supabaseAdmin
    .from('analytics_eventos').select('propriedade_id,evento_tipo,created_at').gte('created_at', ini14).limit(100000);
  // `reservas` ainda não está no schema tipado — usa cliente sem tipos.
  const { data: res } = await (supabaseAdmin as unknown as { from: (t: string) => any })
    .from('reservas').select('propriedade_id,valor_estimado,created_at').gte('created_at', ini7).limit(20000);

  const stats = new Map<string, Stats>();
  const get = (pid: string) => {
    if (!stats.has(pid)) stats.set(pid, { views: 0, viewsPrev: 0, contatos: 0, reservas: 0, pipeline: 0 });
    return stats.get(pid)!;
  };
  (evs || []).forEach((e: { propriedade_id: string; evento_tipo: string; created_at: string | null }) => {
    if (!e.created_at) return;
    const recente = new Date(e.created_at).toISOString() >= ini7;
    const s = get(String(e.propriedade_id));
    if (e.evento_tipo === 'view') { if (recente) s.views++; else s.viewsPrev++; }
    else if (CONTATO.has(e.evento_tipo) && recente) s.contatos++;
  });
  (res || []).forEach((r: { propriedade_id: string; valor_estimado: number | null }) => {
    const s = get(String(r.propriedade_id));
    s.reservas++; s.pipeline += Number(r.valor_estimado) || 0;
  });

  let enviados = 0, pulados = 0, semAtividade = 0, semEmail = 0;
  const erros: string[] = [];

  for (const p of lista) {
    const s = get(String(p.id));
    if (s.views + s.viewsPrev + s.contatos + s.reservas === 0) { semAtividade++; pulados++; continue; }
    const dono = p.usuario_id ? donoDe.get(p.usuario_id) : null;
    if (!dono?.email) { semEmail++; pulados++; continue; }

    if (dryRun) { pulados++; continue; }
    try {
      const r = await sendEmail({
        to: dono.email,
        subject: `📊 Seu resumo semanal — ${p.nome || 'seu anúncio'} na Ventsy`,
        html: renderEmail((dono.nome || '').split(' ')[0] || 'anfitrião', p.nome || 'seu espaço', s),
      });
      if (r.ok) enviados++; else pulados++;
    } catch (e) { erros.push(`${p.id}: ${(e as Error).message}`); pulados++; }
  }

  return Response.json({
    dryRun,
    motivo: dryRun ? (dryParam ? 'forçado ?dry=1' : !emailConfigurado() ? 'SMTP não configurado' : 'WEEKLY_REPORT_ENABLED!=true') : undefined,
    total: lista.length,
    enviados,
    pulados,
    detalhe: { semAtividade, semEmail },
    erros: erros.slice(0, 10),
  });
}
