import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId  = searchParams.get('user_id');
  const search  = searchParams.get('q');
  const tag     = searchParams.get('tag');
  const isAdmin = searchParams.get('admin') === 'true';

  let query = supabase
    .from('diary_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin && userId) {
    query = query.eq('user_id', userId);
  }

  if (search) {
    query = query.ilike('content', `%${search}%`);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;
  return Response.json({ data, error });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_id, content, tags, reminder_date, is_important } = body;

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id,
      content,
      tags:          tags          ?? [],
      reminder_date: reminder_date || null,
      is_important:  is_important  ?? false,
    })
    .select()
    .single();

  return Response.json({ data, error });
}
