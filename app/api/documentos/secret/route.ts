import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

// `documentos` ainda não está nos tipos gerados (migration via MCP) — acesso
// não-tipado, igual ao supabaseAny usado no resto do módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

// Criptografia em repouso da senha do portal de um documento.
// - action 'encrypt': recebe { value } e devolve { cipher } (a gravação no banco
//   continua sendo feita pelo cliente, mas o texto puro nunca é persistido).
// - action 'reveal':  recebe { id }, confere a posse (usuario_id) e devolve { value }.
// A chave (DOCS_ENC_KEY) vive só no servidor — nunca chega ao navegador.

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  let body: { action?: string; value?: string; id?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.action === 'encrypt') {
    const value = typeof body.value === 'string' ? body.value : '';
    if (!value.trim()) return Response.json({ cipher: null });
    try {
      return Response.json({ cipher: encryptSecret(value) });
    } catch {
      return Response.json({ error: 'Falha ao criptografar' }, { status: 500 });
    }
  }

  if (body.action === 'reveal') {
    const id = Number(body.id);
    if (!id) return Response.json({ error: 'id ausente' }, { status: 400 });
    const { data, error } = await admin
      .from('documentos')
      .select('senha_portal')
      .eq('id', id)
      .eq('usuario_id', user.id) // posse: só o dono revela
      .maybeSingle();
    if (error) return Response.json({ error: 'Erro ao buscar' }, { status: 500 });
    if (!data) return Response.json({ error: 'Não encontrado' }, { status: 404 });
    try {
      return Response.json({ value: decryptSecret(data.senha_portal) });
    } catch {
      return Response.json({ error: 'Falha ao descriptografar' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Ação inválida' }, { status: 400 });
}
