import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ── POST: analytics de propriedade · GET: rastreamento de campanhas ───────────
// GET (?c=<envio_id>&e=open|click|unsub[&u=<url>]) registra abertura (pixel 1x1),
// clique (302 → url) e descadastro (opt-out) dos e-mails de campanha. Entra pelo
// anônimo só por aqui (service-role) — `campanhas_envios`/`descadastros` não têm
// policy anon. Idempotente e à prova de falha: nunca quebra a experiência.
//
// POST: registro de evento de analytics COM geolocalização por IP.
// Substitui os inserts diretos do cliente em propriedade/[id].
//
// Cidade do visitante resolvida assim (melhor esforço, nunca bloqueia o insert):
//   1) headers de borda da Vercel (x-vercel-ip-city) — instantâneo quando na Vercel;
//   2) fallback: ipwho.is (HTTPS, grátis, sem chave) a partir do IP do x-forwarded-for.
// IPs locais/privados → cidade nula (degrada com elegância).

const TIPOS = new Set(['view', 'whatsapp', 'formulario']);

// Cache IP→cidade em memória para não repetir lookups do mesmo visitante.
const geoCache = new Map<string, { cidade: string | null; at: number }>();
const GEO_TTL = 60 * 60 * 1000; // 1h

function ipDoRequest(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || null;
}

function ehPrivado(ip: string): boolean {
  return (
    ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') ||
    ip.startsWith('192.168.') || ip.startsWith('172.16.') || ip.startsWith('::ffff:127.')
  );
}

async function resolverCidade(req: NextRequest): Promise<string | null> {
  // 1) Headers da Vercel (se deployado lá)
  const vCity = req.headers.get('x-vercel-ip-city');
  if (vCity) { try { return decodeURIComponent(vCity); } catch { return vCity; } }

  // 2) Geo por IP via ipwho.is
  const ip = ipDoRequest(req);
  if (!ip || ehPrivado(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL) return cached.cidade;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`https://ipwho.is/${ip}?fields=success,city`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    const cidade = j?.success && j?.city ? String(j.city) : null;
    geoCache.set(ip, { cidade, at: Date.now() });
    return cidade;
  } catch {
    geoCache.set(ip, { cidade: null, at: Date.now() });
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { propriedade_id?: string | number; evento_tipo?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }

  const propriedade_id = body.propriedade_id;
  const evento_tipo = String(body.evento_tipo || '');
  if (!propriedade_id || !TIPOS.has(evento_tipo)) {
    return Response.json({ ok: false, error: 'parâmetros inválidos' }, { status: 400 });
  }

  const cidade = await resolverCidade(req);

  try {
    await supabaseAdmin.from('analytics_eventos').insert({
      propriedade_id: String(propriedade_id),
      evento_tipo,
      cidade,
    });
  } catch { /* não falha a navegação do visitante */ }

  return Response.json({ ok: true });
}

// ── Rastreamento de campanhas (GET) ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

// GIF transparente 1x1 (pixel de abertura).
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Content-Length': String(PIXEL.length) },
  });
}

function paginaSimples(titulo: string, msg: string, status = 200): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
    <body style="margin:0;background:#f7f7f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
      <div style="max-width:420px;background:#fff;border-radius:18px;padding:36px 28px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;font-weight:700;color:#ff385c">VENTSY</div>
        <h1 style="font-size:18px;color:#111;margin:18px 0 8px">${titulo}</h1>
        <p style="font-size:14px;color:#666;margin:0;line-height:1.6">${msg}</p>
      </div>
    </body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// Incremento best-effort de um contador de rollup da campanha.
async function bump(campanhaId: string, campos: Record<string, number>) {
  try {
    const { data: c } = await admin.from('campanhas').select('n_entregues, n_abertos, n_clicados, n_descadastros').eq('id', campanhaId).maybeSingle();
    if (!c) return;
    const patch: Record<string, number> = {};
    for (const [k, inc] of Object.entries(campos)) patch[k] = (Number(c[k]) || 0) + inc;
    await admin.from('campanhas').update(patch).eq('id', campanhaId);
  } catch { /* contador é aproximado — o modal recalcula a partir dos envios */ }
}

const URL_OK = /^https?:\/\//i;

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const c = (sp.get('c') || '').trim();
  const e = (sp.get('e') || '').trim();
  const u = sp.get('u') || '';

  // Clique sem envio resolvível → ainda redireciona com segurança.
  if (e === 'click' && (!c || c === 'preview')) {
    return URL_OK.test(u) ? Response.redirect(u, 302) : paginaSimples('Link inválido', 'Este link não pôde ser aberto.', 400);
  }
  if (e === 'open' && (!c || c === 'preview')) return pixelResponse();
  if (e === 'unsub' && (!c || c === 'preview')) return paginaSimples('Preferência registrada', 'Você não receberá mais estas mensagens.');

  // Resolve o envio.
  let envio: { id: string; usuario_id: string; campanha_id: string; cliente_id: string | null; contato: string; status: string; aberto_em: string | null } | null = null;
  try {
    const { data } = await admin
      .from('campanhas_envios').select('id, usuario_id, campanha_id, cliente_id, contato, status, aberto_em').eq('id', c).maybeSingle();
    envio = data || null;
  } catch { /* tabela ausente / erro → degrada abaixo */ }

  const agora = new Date().toISOString();

  // ── Abertura (pixel) ────────────────────────────────────────────────────────
  if (e === 'open') {
    if (envio && (envio.status === 'enviado' || envio.status === 'entregue')) {
      try {
        await admin.from('campanhas_envios').update({ status: 'aberto', aberto_em: agora }).eq('id', envio.id);
        await bump(envio.campanha_id, envio.status === 'enviado' ? { n_entregues: 1, n_abertos: 1 } : { n_abertos: 1 });
      } catch { /* best-effort */ }
    }
    return pixelResponse();
  }

  // ── Clique (redirect) ───────────────────────────────────────────────────────
  if (e === 'click') {
    if (envio && envio.status !== 'clicado' && envio.status !== 'descadastrado' && envio.status !== 'falha') {
      try {
        await admin.from('campanhas_envios').update({ status: 'clicado', clicado_em: agora, aberto_em: envio.aberto_em || agora }).eq('id', envio.id);
        const inc: Record<string, number> = { n_clicados: 1 };
        if (envio.status === 'enviado') { inc.n_entregues = 1; inc.n_abertos = 1; }
        else if (envio.status === 'entregue') { inc.n_abertos = 1; }
        await bump(envio.campanha_id, inc);
      } catch { /* best-effort */ }
    }
    return URL_OK.test(u) ? Response.redirect(u, 302) : paginaSimples('Obrigado!', 'Pode fechar esta janela.');
  }

  // ── Descadastro (opt-out) ───────────────────────────────────────────────────
  if (e === 'unsub') {
    if (envio) {
      try {
        const { data: camp } = await admin.from('campanhas').select('canal').eq('id', envio.campanha_id).maybeSingle();
        const canal = camp?.canal || 'email';
        await admin.from('descadastros').upsert(
          { usuario_id: envio.usuario_id, cliente_id: envio.cliente_id, contato: envio.contato, canal },
          { onConflict: 'usuario_id,contato,canal', ignoreDuplicates: true },
        );
        if (envio.status !== 'descadastrado') {
          await admin.from('campanhas_envios').update({ status: 'descadastrado' }).eq('id', envio.id);
          await bump(envio.campanha_id, { n_descadastros: 1 });
        }
      } catch { /* best-effort */ }
    }
    return paginaSimples('Preferência registrada', 'Pronto! Você não receberá mais estas mensagens. Se mudar de ideia, é só falar com a empresa.');
  }

  return paginaSimples('Parâmetro inválido', 'Requisição não reconhecida.', 400);
}
