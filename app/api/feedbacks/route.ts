import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';
import { signEventToken } from '@/lib/feedbackToken';
import { NOTA_MIN_PROMOVER } from '@/lib/feedback';

// Rota AUTENTICADA do dono (/painel/feedbacks). Só faz o que precisa do servidor —
// o CRUD comum de feedbacks/ações roda via RLS direto no client (o dono é usuario_id).
//   POST { action:'gerar_link', evento_id }  → assina o token estável do link público
//                                              de coleta (segredo server-side).
//   POST { action:'promover', id }           → cria uma avaliação PÚBLICA verificada a
//                                              partir de um feedback elogioso (service-role,
//                                              pois o dono não é o autor da avaliação).
// A identidade é SEMPRE o JWT; a posse é checada por usuario_id (nunca o corpo).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

// Recalcula a média pública da propriedade (verificadas e não ocultas) — espelha
// app/api/avaliacoes para manter o número do anúncio coerente após a promoção.
async function recomputarMedia(propriedadeId: number) {
  const { data: todas } = await admin
    .from('avaliacoes').select('nota')
    .eq('propriedade_id', propriedadeId).eq('verificada', true).eq('oculta', false);
  const lista = (todas || []) as { nota: number }[];
  const media = lista.length
    ? parseFloat((lista.reduce((s, a) => s + a.nota, 0) / lista.length).toFixed(1))
    : 0;
  await supabase.from('propriedades').update({ avaliacao: media }).eq('id', propriedadeId);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  // ── Gera o link público de coleta de um evento do dono ────────────────────
  if (action === 'gerar_link') {
    const eventoId = String(body.evento_id || '').trim();
    if (!eventoId) return Response.json({ error: 'evento_id é obrigatório.' }, { status: 400 });

    const { data: ev, error } = await admin
      .from('clientes_eventos').select('id, usuario_id').eq('id', eventoId).maybeSingle();
    if (error) return Response.json({ error: 'Não foi possível validar o evento.' }, { status: 500 });
    if (!ev) return Response.json({ error: 'Evento não encontrado.' }, { status: 404 });
    if (ev.usuario_id !== user.id) return forbidden();

    const token = signEventToken(eventoId);
    return Response.json({ token, path: `/feedback/${token}` });
  }

  // ── Promove um feedback elogioso a avaliação pública verificada ───────────
  if (action === 'promover') {
    const id = String(body.id || '').trim();
    if (!id) return Response.json({ error: 'id do feedback é obrigatório.' }, { status: 400 });

    const { data: fb } = await admin
      .from('feedbacks')
      .select('id, usuario_id, evento_id, propriedade_id, autor_nome, nota_geral, comentario, pontos_positivos, permite_publicar, promovida_avaliacao_id')
      .eq('id', id).maybeSingle();
    if (!fb) return Response.json({ error: 'Feedback não encontrado.' }, { status: 404 });
    if (fb.usuario_id !== user.id) return forbidden();
    if (fb.promovida_avaliacao_id) return Response.json({ error: 'Este feedback já foi publicado.' }, { status: 409 });
    if (!fb.permite_publicar) return Response.json({ error: 'O cliente não autorizou tornar este feedback público.' }, { status: 403 });
    if (Number(fb.nota_geral) < NOTA_MIN_PROMOVER) {
      return Response.json({ error: `Só é possível publicar feedbacks com nota ${NOTA_MIN_PROMOVER} ou mais.` }, { status: 422 });
    }

    // Deriva a propriedade e o tipo de evento (a avaliação pública é por propriedade).
    let propriedadeId: number | null = fb.propriedade_id != null ? Number(fb.propriedade_id) : null;
    let eventoTipo: string | null = null;
    if (fb.evento_id) {
      const { data: ev } = await admin
        .from('clientes_eventos').select('propriedade_id, tipo_evento').eq('id', fb.evento_id).maybeSingle();
      if (ev) {
        if (propriedadeId == null && ev.propriedade_id != null) propriedadeId = Number(ev.propriedade_id);
        eventoTipo = ev.tipo_evento ?? null;
      }
    }
    if (propriedadeId == null) {
      return Response.json({ error: 'Feedback sem propriedade vinculada — não é possível publicar.' }, { status: 422 });
    }

    const texto = (fb.comentario || fb.pontos_positivos || '').toString().trim();
    const dataFormatada = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const { data: aval, error: avErr } = await admin
      .from('avaliacoes')
      .insert({
        user_id: null,                              // origem: feedback privado (cliente sem login)
        propriedade_id: propriedadeId,
        nota: Number(fb.nota_geral) || 5,
        texto,
        autor: fb.autor_nome || 'Cliente',
        verificada: true,                           // veio de um evento real do dono
        evento_tipo: eventoTipo,
        data: dataFormatada,
      })
      .select('id').single();
    if (avErr) return Response.json({ error: 'Falha ao publicar a avaliação.', detail: avErr.message }, { status: 500 });

    await admin.from('feedbacks').update({ promovida_avaliacao_id: aval.id }).eq('id', fb.id);
    await recomputarMedia(propriedadeId);

    return Response.json({ ok: true, avaliacao_id: aval.id });
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 });
}
