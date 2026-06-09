import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyEventToken } from '@/lib/feedbackToken';
import { normalizarCriterios } from '@/lib/feedback';

// Coleta PÚBLICA de feedback (cliente SEM login) — formulário /feedback/[token].
// Roda com service-role: o token carrega o evento_id assinado por HMAC
// (lib/feedbackToken), então o acesso é controlado AQUI, não por RLS.
//   GET  ?token=…   → contexto leve p/ render do formulário (evento, espaço, marca)
//   POST { token, … } → grava o feedback no painel do dono (canal 'formulario', 'novo')
// Honeypot anti-bot simples. Nunca vaza usuario_id ao cliente.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

async function resolverEvento(token: string) {
  const eventoId = verifyEventToken(token);
  if (!eventoId) return null;
  const { data: ev } = await admin
    .from('clientes_eventos')
    .select('id, usuario_id, cliente_id, nome_evento, quem_contratou, tipo_evento, data_inicio, propriedade_id')
    .eq('id', eventoId).maybeSingle();
  if (!ev) return null;
  return ev as {
    id: string; usuario_id: string; cliente_id: string | null; nome_evento: string | null;
    quem_contratou: string | null; tipo_evento: string | null; data_inicio: string | null; propriedade_id: number | null;
  };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 });

  const ev = await resolverEvento(token);
  if (!ev) return Response.json({ error: 'Link inválido ou expirado.' }, { status: 404 });

  const [{ data: prop }, { data: empresa }] = await Promise.all([
    ev.propriedade_id != null
      ? admin.from('propriedades').select('nome, cidade, estado').eq('id', ev.propriedade_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('empresa_config').select('razao_social, fantasia, logo_url').eq('usuario_id', ev.usuario_id).maybeSingle(),
  ]);

  // Payload mínimo p/ o formulário — sem usuario_id nem dados sensíveis do dono.
  return Response.json({
    evento: {
      nome: ev.nome_evento, tipo: ev.tipo_evento, data: ev.data_inicio,
      contratante: ev.quem_contratou,
    },
    espaco: prop ? { nome: prop.nome, cidade: prop.cidade, estado: prop.estado } : null,
    empresa: empresa ? { nome: empresa.fantasia || empresa.razao_social || null, logo: empresa.logo_url || null } : null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Honeypot: campo invisível preenchido ⇒ provável bot. Responde ok sem gravar.
  if (String(body.website || '').trim()) return Response.json({ ok: true });

  const token = String(body.token || '');
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 });

  const ev = await resolverEvento(token);
  if (!ev) return Response.json({ error: 'Link inválido ou expirado.' }, { status: 404 });

  const nota = Math.round(Number(body.nota_geral));
  if (!Number.isFinite(nota) || nota < 1 || nota > 5) {
    return Response.json({ error: 'Dê uma nota geral de 1 a 5.' }, { status: 400 });
  }
  const criterios = normalizarCriterios(body.criterios);

  const { error } = await admin.from('feedbacks').insert({
    usuario_id: ev.usuario_id,
    cliente_id: ev.cliente_id,
    evento_id: ev.id,
    propriedade_id: ev.propriedade_id,
    autor_nome: String(body.autor_nome || ev.quem_contratou || '').trim() || null,
    autor_contato: String(body.autor_contato || '').trim() || null,
    canal: 'formulario',
    nota_geral: nota,
    criterios,
    comentario: String(body.comentario || '').trim() || null,
    pontos_positivos: String(body.pontos_positivos || '').trim() || null,
    pontos_negativos: String(body.pontos_negativos || '').trim() || null,
    permite_publicar: !!body.permite_publicar,
    status: 'novo',
  });
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return Response.json({ error: 'Coleta de feedback indisponível no momento.' }, { status: 503 });
    }
    return Response.json({ error: 'Não foi possível registrar seu feedback. Tente novamente.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
