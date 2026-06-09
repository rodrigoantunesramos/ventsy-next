import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyPesquisaToken } from '@/lib/pesquisaToken';
import {
  normalizarPerguntas, normalizarRespostas, extrairNps, extrairComentario, categoriaNps,
  type Pergunta,
} from '@/lib/pesquisas';

// Coleta PÚBLICA de pesquisa (cliente SEM login) — formulário /pesquisa/[token].
// Roda com service-role: o token carrega pesquisa_id (+ evento opcional) assinado
// por HMAC (lib/pesquisaToken), então o acesso é controlado AQUI, não por RLS.
//   GET  ?token=…   → modelo da pesquisa + contexto (evento/espaço/marca) p/ render
//   POST { token, respostas, … } → grava a resposta no painel do dono, calculando
//        nps/categoria/comentário a partir do modelo (fonte da verdade no servidor).
// Honeypot anti-bot simples. Nunca vaza usuario_id ao cliente.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

type PesquisaRow = {
  id: string; usuario_id: string; titulo: string; descricao: string | null;
  tipo: string; perguntas: unknown; ativo: boolean;
};
type EventoRow = {
  id: string; usuario_id: string; cliente_id: string | null; nome_evento: string | null;
  quem_contratou: string | null; tipo_evento: string | null; data_inicio: string | null; propriedade_id: number | null;
};

async function resolver(token: string): Promise<{ pesquisa: PesquisaRow; perguntas: Pergunta[]; evento: EventoRow | null } | null> {
  const parsed = verifyPesquisaToken(token);
  if (!parsed) return null;
  const { data: pq } = await admin
    .from('pesquisas').select('id, usuario_id, titulo, descricao, tipo, perguntas, ativo')
    .eq('id', parsed.pesquisaId).maybeSingle();
  if (!pq) return null;
  const pesquisa = pq as PesquisaRow;

  let evento: EventoRow | null = null;
  if (parsed.eventoId) {
    const { data: ev } = await admin
      .from('clientes_eventos')
      .select('id, usuario_id, cliente_id, nome_evento, quem_contratou, tipo_evento, data_inicio, propriedade_id')
      .eq('id', parsed.eventoId).maybeSingle();
    // só aceita o evento se for do mesmo dono da pesquisa
    if (ev && ev.usuario_id === pesquisa.usuario_id) evento = ev as EventoRow;
  }
  return { pesquisa, perguntas: normalizarPerguntas(pesquisa.perguntas), evento };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 });

  const r = await resolver(token);
  if (!r) return Response.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
  if (!r.pesquisa.ativo) return Response.json({ error: 'Esta pesquisa não está mais ativa.' }, { status: 410 });

  const ev = r.evento;
  const [{ data: prop }, { data: empresa }] = await Promise.all([
    ev?.propriedade_id != null
      ? admin.from('propriedades').select('nome, cidade, estado').eq('id', ev.propriedade_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('empresa_config').select('razao_social, fantasia, logo_url').eq('usuario_id', r.pesquisa.usuario_id).maybeSingle(),
  ]);

  // Payload mínimo p/ o formulário — sem usuario_id nem dados sensíveis do dono.
  return Response.json({
    pesquisa: { titulo: r.pesquisa.titulo, descricao: r.pesquisa.descricao, tipo: r.pesquisa.tipo, perguntas: r.perguntas },
    evento: ev ? { nome: ev.nome_evento, tipo: ev.tipo_evento, data: ev.data_inicio, contratante: ev.quem_contratou } : null,
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

  const r = await resolver(token);
  if (!r) return Response.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
  if (!r.pesquisa.ativo) return Response.json({ error: 'Esta pesquisa não está mais ativa.' }, { status: 410 });

  const respostas = normalizarRespostas(body.respostas);

  // Valida obrigatórias (servidor é a fonte da verdade).
  for (const q of r.perguntas) {
    if (!q.obrigatoria) continue;
    const v = respostas[q.id];
    const vazio = v == null || (typeof v === 'string' && !v.trim());
    if (vazio) return Response.json({ error: `Responda: "${q.titulo}".` }, { status: 400 });
  }

  // Deriva nps/categoria/comentário do MODELO (não confia no que o client mandar).
  const modelo = { perguntas: r.perguntas };
  const nps = extrairNps(respostas, modelo);
  const categoria = nps != null ? categoriaNps(nps) : null;
  const comentario = extrairComentario(respostas, modelo);

  const ev = r.evento;
  const { error } = await admin.from('pesquisas_respostas').insert({
    pesquisa_id: r.pesquisa.id,
    usuario_id: r.pesquisa.usuario_id,
    evento_id: ev?.id ?? null,
    cliente_id: ev?.cliente_id ?? null,
    propriedade_id: ev?.propriedade_id ?? null,
    autor_nome: String(body.autor_nome || ev?.quem_contratou || '').trim() || null,
    autor_contato: String(body.autor_contato || '').trim() || null,
    respostas,
    nps,
    categoria,
    comentario,
  });
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return Response.json({ error: 'Coleta de pesquisa indisponível no momento.' }, { status: 503 });
    }
    return Response.json({ error: 'Não foi possível registrar sua resposta. Tente novamente.' }, { status: 500 });
  }
  return Response.json({ ok: true, categoria });
}
