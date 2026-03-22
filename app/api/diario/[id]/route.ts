import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  const { data, error } = await supabase
    .from('diary_entries')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  return Response.json({ data, error });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', params.id);

  return Response.json({ error });
}
