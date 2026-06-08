import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Recebe a candidatura PÚBLICA de uma vaga (página /vagas/[slug]). Roda com
// service-role: resolve o dono pela vaga (slug + status aberta) e insere o
// candidato no funil (etapa 'triagem', fonte 'site'). Honeypot anti-bot simples.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Honeypot: campo invisível preenchido ⇒ provável bot. Responde 200 sem gravar.
  if (String(body.website || '').trim()) return Response.json({ ok: true });

  const slug = String(body.slug || '').trim();
  const nome = String(body.nome || '').trim();
  if (!slug || !nome) return Response.json({ error: 'Nome e vaga são obrigatórios.' }, { status: 400 });

  const { data: vaga, error: vErr } = await admin.from('rh_vagas').select('id,usuario_id,status').eq('slug', slug).maybeSingle();
  if (vErr) return Response.json({ error: 'Indisponível.' }, { status: 500 });
  if (!vaga || vaga.status !== 'aberta') return Response.json({ error: 'Vaga não encontrada ou encerrada.' }, { status: 404 });

  const { error } = await admin.from('rh_candidatos').insert({
    usuario_id: vaga.usuario_id,
    vaga_id: vaga.id,
    nome,
    email: String(body.email || '').trim() || null,
    telefone: String(body.telefone || '').trim() || null,
    curriculo_url: String(body.curriculo_url || '').trim() || null,
    obs: String(body.mensagem || '').trim() || null,
    fonte: 'site',
    etapa: 'triagem',
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
