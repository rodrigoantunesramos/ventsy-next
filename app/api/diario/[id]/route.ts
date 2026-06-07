import { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';

const SELECT = '*, lead:clientes_eventos(id, nome_evento, quem_contratou, status)';

type DiaryUpdate = Database['public']['Tables']['diary_entries']['Update'];

async function canModify(userId: string, ownerId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.is_admin;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: existing } = await supabaseAdmin
    .from('diary_entries')
    .select('user_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return Response.json({ data: null, error: { message: 'Não encontrado' } }, { status: 404 });
  if (!(await canModify(user.id, existing.user_id))) return forbidden();

  // Whitelist — só estes campos podem ser alterados via API.
  const body = await req.json();
  const patch: DiaryUpdate = {};
  if (typeof body.content === 'string')   patch.content = body.content;
  if (Array.isArray(body.tags))           patch.tags = body.tags;
  if ('reminder_date' in body)            patch.reminder_date = body.reminder_date || null;
  if ('is_important' in body)             patch.is_important = !!body.is_important;
  if ('lead_id' in body)                  patch.lead_id = body.lead_id || null;

  // Trocar o vínculo exige posse do evento de destino.
  if (patch.lead_id) {
    const { data: lead } = await supabaseAdmin
      .from('clientes_eventos')
      .select('id')
      .eq('id', patch.lead_id)
      .eq('usuario_id', existing.user_id)
      .maybeSingle();
    if (!lead) return forbidden();
  }

  const { data, error } = await supabaseAdmin
    .from('diary_entries')
    .update(patch)
    .eq('id', params.id)
    .select(SELECT)
    .single();

  return Response.json({ data, error });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: existing } = await supabaseAdmin
    .from('diary_entries')
    .select('user_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return Response.json({ error: null });            // idempotente
  if (!(await canModify(user.id, existing.user_id))) return forbidden();

  const { error } = await supabaseAdmin
    .from('diary_entries')
    .delete()
    .eq('id', params.id);

  return Response.json({ error });
}
