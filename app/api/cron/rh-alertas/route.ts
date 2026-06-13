import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Alertas diários de RH (ver vercel.json) — disparado por Cron.
// Mantém o status de validade dos documentos coerente (writer-agnostic): marca
// como 'vencido' os documentos cuja validade já passou e reverte para 'valido'
// os que foram renovados (validade futura). Assim o semáforo de Documentos e os
// alertas do hub ficam corretos sem depender de quem abrir a página.
//
// Idempotente. Segurança: exige CRON_SECRET (Bearer ou ?secret=). Simulação: ?dry=1.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
  return bearer === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const hoje = new Date().toISOString().slice(0, 10);

  // Sonda: tabela existe?
  const probe = await admin.from('rh_documentos').select('id').limit(1);
  if (probe.error?.code === 'PGRST205' || probe.error?.code === '42P01') {
    return Response.json({ skipped: 'rh_documentos ausente' });
  }

  if (dry) {
    const venc = await admin.from('rh_documentos').select('id').lt('validade', hoje).eq('status', 'valido');
    const renov = await admin.from('rh_documentos').select('id').gte('validade', hoje).eq('status', 'vencido');
    return Response.json({ dry: true, hoje, marcaria_vencidos: venc.data?.length || 0, reverteria: renov.data?.length || 0 });
  }

  // Marca vencidos (validade passada e ainda marcado como válido).
  const venc = await admin.from('rh_documentos').update({ status: 'vencido' }).lt('validade', hoje).eq('status', 'valido').select('id');
  // Reverte renovados (validade futura mas marcado vencido).
  const renov = await admin.from('rh_documentos').update({ status: 'valido' }).gte('validade', hoje).eq('status', 'vencido').select('id');

  return Response.json({ hoje, marcados_vencidos: venc.data?.length || 0, revertidos: renov.data?.length || 0 });
}
