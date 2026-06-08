import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Leitura PÚBLICA de uma vaga aberta pelo slug (página /vagas/[slug]). Roda com
// service-role (o candidato não está autenticado) e expõe apenas campos públicos
// de vagas com status 'aberta'. Sem RLS para anon — o acesso é controlado aqui.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return Response.json({ error: 'slug é obrigatório' }, { status: 400 });

  const { data, error } = await admin
    .from('rh_vagas')
    .select('id,titulo,slug,departamento,tipo_contrato,salario_min,salario_max,descricao,requisitos,beneficios,local,status')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return Response.json({ error: 'indisponível' }, { status: 404 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.status !== 'aberta') return Response.json({ error: 'Vaga não encontrada ou encerrada.' }, { status: 404 });

  // Não expõe usuario_id nem contagens internas.
  const { ...vaga } = data;
  return Response.json({ vaga });
}
