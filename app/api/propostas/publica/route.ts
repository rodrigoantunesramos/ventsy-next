import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Acesso PÚBLICO da proposta (cliente SEM login) — resolvido pelo link_token via
// service-role (ignora RLS de propósito; o token É a credencial do link).
//   GET  ?token=…           → devolve a proposta para render + marca "vista"
//   POST { token, action }  → 'aceitar' (conversão ATÔMICA via RPC aceitar_proposta)
//                             'recusar' (status recusada + motivo)
// Sem dados sensíveis do dono no payload — só o necessário para exibir.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

const PROP_COLS =
  'id,usuario_id,evento_id,propriedade_id,numero,titulo,itens,subtotal_num,desconto_num,total_num,moeda,validade,condicoes_pagamento,observacoes,condicoes,status,link_token,criado_em,aceita_em,recusada_em';

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function montarResposta(token: string) {
  const { data: prop, error } = await admin.from('propostas').select(PROP_COLS).eq('link_token', token).maybeSingle();
  if (error || !prop) return null;

  const [{ data: empresa }, { data: evento }] = await Promise.all([
    admin.from('empresa_config').select('razao_social,fantasia,cnpj,logo_url,contatos,endereco').eq('usuario_id', prop.usuario_id).maybeSingle(),
    prop.evento_id
      ? admin.from('clientes_eventos').select('id,nome_evento,quem_contratou,documento,email,tipo_evento,data_inicio,data_fim').eq('id', prop.evento_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let propriedadeNome: string | null = null;
  if (prop.propriedade_id) {
    const { data: pr } = await admin.from('propriedades').select('nome').eq('id', prop.propriedade_id).maybeSingle();
    propriedadeNome = pr?.nome ?? null;
  }

  // Não vaza o usuario_id para o cliente.
  const publico: Record<string, unknown> = { ...prop };
  delete publico.usuario_id;
  return { proposta: publico, empresa: empresa ?? null, evento: evento ?? null, propriedadeNome };
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 });

  const { data: atual } = await admin.from('propostas').select('id,status,validade,aceita_em').eq('link_token', token).maybeSingle();
  if (!atual) return Response.json({ error: 'Proposta não encontrada.' }, { status: 404 });

  // Expira se passou da validade (sem decidir) — refletido no status devolvido.
  if (atual.status !== 'aceita' && atual.status !== 'recusada' && atual.validade && atual.validade < ymd(new Date())) {
    if (atual.status !== 'expirada') await admin.from('propostas').update({ status: 'expirada' }).eq('id', atual.id);
  } else if (atual.status === 'enviada') {
    // Tracking de "visualizada" (apenas na primeira transição enviada→vista).
    await admin.from('propostas').update({ status: 'vista', vista_em: new Date().toISOString() }).eq('id', atual.id);
  }

  const payload = await montarResposta(token);
  if (!payload) return Response.json({ error: 'Proposta não encontrada.' }, { status: 404 });
  return Response.json(payload);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '');
  const action = String(body.action || '');
  if (!token) return Response.json({ error: 'token obrigatório' }, { status: 400 });

  if (action === 'aceitar') {
    // Conversão atômica: proposta → contrato + parcelas + move o funil.
    const { data, error } = await admin.rpc('aceitar_proposta', { p_token: token });
    if (error) return Response.json({ ok: false, error: 'Falha ao processar o aceite.' }, { status: 500 });
    if (!data?.ok) return Response.json(data ?? { ok: false, error: 'not_found' }, { status: data?.error === 'expirada' ? 409 : 404 });
    return Response.json(data);
  }

  if (action === 'recusar') {
    const { data: atual } = await admin.from('propostas').select('id,status').eq('link_token', token).maybeSingle();
    if (!atual) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    if (atual.status === 'aceita') return Response.json({ ok: false, error: 'ja_aceita' }, { status: 409 });
    const { error } = await admin.from('propostas').update({
      status: 'recusada', recusada_em: new Date().toISOString(), motivo_recusa: (String(body.motivo || '').trim() || null),
    }).eq('id', atual.id);
    if (error) return Response.json({ ok: false, error: 'falha' }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Ação inválida.' }, { status: 400 });
}
