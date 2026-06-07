import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';

// Benchmark de conversão da plataforma (view → contato) — calculado com a
// service_role (ignora RLS), então enxerga TODAS as propriedades. Devolve a
// média geral e, se informada, a média da categoria do anunciante.
//
// Cache em memória (10 min) para não reprocessar a cada abertura do relatório.

type Benchmark = { plataforma: number | null; categoria: number | null; categoriaLabel: string | null };

let cache: { at: number; payload: Omit<Benchmark, 'categoria' | 'categoriaLabel'> & { porCategoria: Record<string, number> } } | null = null;
const TTL = 10 * 60 * 1000;

const CONTATO = new Set(['whatsapp', 'formulario']);

async function computar() {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Eventos de 90 dias (toda a plataforma)
  const { data: evs } = await supabaseAdmin
    .from('analytics_eventos')
    .select('evento_tipo,propriedade_id')
    .gte('created_at', since.toISOString())
    .limit(100000);

  // Mapa propriedade → categoria
  const { data: props } = await supabaseAdmin
    .from('propriedades')
    .select('id,categoria')
    .limit(100000);

  const catDe = new Map<string, string>();
  (props || []).forEach((p: { id: number | string; categoria: string | null }) => {
    catDe.set(String(p.id), (p.categoria || '').trim() || 'Outros');
  });

  let vGlobal = 0, cGlobal = 0;
  const vCat: Record<string, number> = {};
  const cCat: Record<string, number> = {};

  (evs || []).forEach((e: { evento_tipo: string; propriedade_id: string }) => {
    const cat = catDe.get(String(e.propriedade_id)) || 'Outros';
    if (e.evento_tipo === 'view') { vGlobal++; vCat[cat] = (vCat[cat] || 0) + 1; }
    else if (CONTATO.has(e.evento_tipo)) { cGlobal++; cCat[cat] = (cCat[cat] || 0) + 1; }
  });

  const porCategoria: Record<string, number> = {};
  Object.keys(vCat).forEach((cat) => {
    if (vCat[cat] > 0) porCategoria[cat] = ((cCat[cat] || 0) / vCat[cat]) * 100;
  });

  return { plataforma: vGlobal > 0 ? (cGlobal / vGlobal) * 100 : null, porCategoria };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const categoria = (new URL(req.url).searchParams.get('categoria') || '').trim();

  try {
    if (!cache || Date.now() - cache.at > TTL) {
      cache = { at: Date.now(), payload: await computar() };
    }
    const { plataforma, porCategoria } = cache.payload;
    const catKey = categoria || null;
    const categoriaConv = catKey && porCategoria[catKey] != null ? porCategoria[catKey] : null;

    const out: Benchmark = {
      plataforma,
      categoria: categoriaConv,
      categoriaLabel: catKey,
    };
    return Response.json(out);
  } catch (e) {
    return Response.json({ plataforma: null, categoria: null, categoriaLabel: null }, { status: 200 });
  }
}
