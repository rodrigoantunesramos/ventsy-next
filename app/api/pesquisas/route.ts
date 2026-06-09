import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { signPesquisaToken } from '@/lib/pesquisaToken';

// Rota AUTENTICADA do dono (/painel/pesquisas). Só faz o que precisa do servidor —
// o CRUD de pesquisas/respostas roda via RLS direto no client (o dono é usuario_id).
//   POST { action:'gerar_link', pesquisa_id, evento_id? }
//        → assina o token estável do link público (segredo server-side). O evento
//          é opcional: link genérico (sem evento) ou link por evento (segmentação).
// A identidade é SEMPRE o JWT; a posse é checada por usuario_id (nunca o corpo).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  if (action === 'gerar_link') {
    const pesquisaId = String(body.pesquisa_id || '').trim();
    if (!pesquisaId) return Response.json({ error: 'pesquisa_id é obrigatório.' }, { status: 400 });

    const { data: pq, error } = await admin
      .from('pesquisas').select('id, usuario_id, ativo').eq('id', pesquisaId).maybeSingle();
    if (error) return Response.json({ error: 'Não foi possível validar a pesquisa.' }, { status: 500 });
    if (!pq) return Response.json({ error: 'Pesquisa não encontrada.' }, { status: 404 });
    if (pq.usuario_id !== user.id) return forbidden();

    // Evento opcional — quando informado, valida posse e que pertence à pesquisa do dono.
    const eventoId = String(body.evento_id || '').trim() || null;
    if (eventoId) {
      const { data: ev } = await admin
        .from('clientes_eventos').select('id, usuario_id').eq('id', eventoId).maybeSingle();
      if (!ev) return Response.json({ error: 'Evento não encontrado.' }, { status: 404 });
      if (ev.usuario_id !== user.id) return forbidden();
    }

    const token = signPesquisaToken(pesquisaId, eventoId);
    return Response.json({ token, path: `/pesquisa/${token}` });
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 });
}
