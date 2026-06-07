import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized, forbidden } from '@/lib/apiAuth';

// Embute o evento/cliente vinculado (relação muitos-para-um via lead_id).
const SELECT = '*, lead:clientes_eventos(id, nome_evento, quem_contratou, status)';

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.is_admin;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const search    = searchParams.get('q');
  const tag       = searchParams.get('tag');
  const leadId    = searchParams.get('lead_id');
  const wantAdmin = searchParams.get('admin') === 'true';

  let query = supabaseAdmin
    .from('diary_entries')
    .select(SELECT)
    .order('created_at', { ascending: false });

  if (wantAdmin) {
    if (!(await isAdmin(user.id))) return forbidden();
    // admin: vê todas as anotações da plataforma — sem filtro por usuário.
  } else {
    query = query.eq('user_id', user.id);
  }

  if (search) query = query.ilike('content', `%${search}%`);
  if (tag)    query = query.contains('tags', [tag]);
  if (leadId) query = query.eq('lead_id', leadId);

  const { data, error } = await query;
  return Response.json({ data, error });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json();
  const content = typeof body.content === 'string' ? body.content : '';
  if (!content.trim()) {
    return Response.json({ data: null, error: { message: 'Conteúdo obrigatório' } }, { status: 400 });
  }

  const leadId: string | null = body.lead_id || null;
  // Só permite vincular a um evento que pertence ao próprio usuário.
  if (leadId) {
    const { data: lead } = await supabaseAdmin
      .from('clientes_eventos')
      .select('id')
      .eq('id', leadId)
      .eq('usuario_id', user.id)
      .maybeSingle();
    if (!lead) return forbidden();
  }

  const { data, error } = await supabaseAdmin
    .from('diary_entries')
    .insert({
      user_id:       user.id,                      // identidade do token, nunca do corpo
      content,
      tags:          Array.isArray(body.tags) ? body.tags : [],
      reminder_date: body.reminder_date || null,
      is_important:  !!body.is_important,
      lead_id:       leadId,
    })
    .select(SELECT)
    .single();

  return Response.json({ data, error });
}
