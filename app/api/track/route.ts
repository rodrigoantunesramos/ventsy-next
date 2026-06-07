import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Registro de evento de analytics COM geolocalização por IP.
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
