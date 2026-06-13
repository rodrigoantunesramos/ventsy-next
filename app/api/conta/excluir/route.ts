import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { registrarAuditoria } from '@/lib/auditServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// LGPD art. 18 — EXCLUSÃO da conta: anonimização IRREVERSÍVEL da PII do titular +
// bloqueio do login. Registros com obrigação legal de retenção (fiscais/contábeis:
// lancamentos/parcelas/notas_fiscais/pagamentos/contratos) são MANTIDOS, porém
// desidentificados — o vínculo é o usuario_id, cujo perfil em `usuarios` é
// anonimizado. Exige reautenticação por senha (step-up) antes de executar.

// Tabelas com PII do titular ou de terceiros sob a conta. Patches usam colunas
// confirmadas no schema; cada alvo é isolado (falha de um não aborta os demais).
type Alvo = { tabela: string; col: string; patch?: Record<string, unknown>; del?: boolean }

const ALVOS: Alvo[] = [
  { tabela: 'empresa_config', col: 'usuario_id', patch: { razao_social: null, fantasia: null, cnpj: null, ie: null, im: null, endereco: null, contatos: null, config_fiscal: null, logo_url: null } },
  { tabela: 'clientes', col: 'usuario_id', patch: { nome: 'Titular anonimizado', email: null, telefone: null, whatsapp: null, doc: null, endereco: null, aniversario: null, obs: null } },
  { tabela: 'clientes_eventos', col: 'usuario_id', patch: { quem_contratou: 'Anonimizado', email: null, telefones: null, documento: null } },
  { tabela: 'convidados', col: 'usuario_id', patch: { nome: 'Convidado anonimizado', email: null, telefone: null, observacao: null, restricao_alimentar: null } },
  { tabela: 'equipe', col: 'usuario_id', patch: { nome: 'Funcionario anonimizado', cpf: null, rg: null, nascimento: null, telefone: null, email: null, banco: null, dependentes: null, foto_url: null, obs: null } },
  { tabela: 'freelancers', col: 'usuario_id', patch: { nome: 'Freelancer anonimizado', contato: null, email: null, doc: null, chave_pix: null, obs: null } },
  { tabela: 'rh_candidatos', col: 'usuario_id', patch: { nome: 'Candidato anonimizado', email: null, telefone: null, curriculo_url: null, obs: null, ia_resumo: null } },
  { tabela: 'rh_documentos', col: 'usuario_id', patch: { nome: 'Documento removido', arquivo_url: null, obs: null } },
  { tabela: 'fornecedores_contatos', col: 'usuario_id', patch: { nome: 'Contato anonimizado', email: null, telefone: null, whatsapp: null, obs: null } },
  { tabela: 'diary_entries', col: 'user_id', del: true },
]

// Step-up: revalida a senha do titular num client anon efêmero (não persiste sessão).
async function senhaConfere(email: string | null, senha: string): Promise<boolean> {
  if (!email || !senha) return false
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await c.auth.signInWithPassword({ email, password: senha })
  return !error
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as { senha?: string; confirmacao?: string }
  if ((body.confirmacao || '').trim().toUpperCase() !== 'EXCLUIR') {
    return Response.json({ error: 'Envie confirmacao: "EXCLUIR".' }, { status: 400 })
  }
  if (!(await senhaConfere(user.email ?? null, body.senha || ''))) {
    return Response.json(
      { error: 'Senha incorreta. Por segurança, confirme sua senha para encerrar a conta.' },
      { status: 403 },
    )
  }

  const agora = new Date().toISOString()
  const detalhe: { tabela: string; acao: string; linhas: number; erro?: string }[] = []

  // 1) Anonimiza/zera PII nas tabelas do titular e de terceiros sob a conta.
  for (const a of ALVOS) {
    try {
      const q = a.del
        ? admin.from(a.tabela).delete().eq(a.col, user.id).select('id')
        : admin.from(a.tabela).update(a.patch).eq(a.col, user.id).select('id')
      const { data, error } = await q
      detalhe.push({ tabela: a.tabela, acao: a.del ? 'delete' : 'anonimizar', linhas: data?.length ?? 0, erro: error?.message })
    } catch (e) {
      detalhe.push({ tabela: a.tabela, acao: 'erro', linhas: 0, erro: String(e) })
    }
  }

  // 2) Anonimiza o próprio perfil e carimba o encerramento.
  const id8 = user.id.slice(0, 8)
  await admin.from('usuarios').update({
    nome: 'Conta encerrada', documento: null, tipo_doc: null, nascimento: null,
    telefone: null, usuario: `apagado_${id8}`,
    email: `apagado+${user.id}@anonimizado.invalid`, cadastro_completo: false,
  }).eq('id', user.id)
  await admin.from('empresa_config').upsert(
    { usuario_id: user.id, exclusao_solicitada_em: agora }, { onConflict: 'usuario_id' },
  )

  // 3) Bloqueia o login e remove o PII do Auth SEM deletar (preserva os registros
  //    de retenção vinculados ao usuario_id). O ban invalida as sessões existentes.
  let authBloqueado = true
  try {
    await admin.auth.admin.updateUserById(user.id, {
      email: `apagado+${user.id}@anonimizado.invalid`,
      ban_duration: '876000h',
      user_metadata: {},
    })
  } catch {
    authBloqueado = false
  }

  // 4) Ledger LGPD (best-effort) + trilha de auditoria (prova primária).
  try {
    await admin.from('lgpd_solicitacoes').insert({
      usuario_id: user.id, tipo: 'eliminacao', status: 'concluida',
      titular_nome: 'Titular da conta', concluida_em: agora,
      resposta: 'Conta anonimizada e login bloqueado a pedido do titular (LGPD art. 18, VI).',
    })
  } catch {
    /* schema de lgpd_solicitacoes pode divergir — a auditoria abaixo é a prova */
  }

  await registrarAuditoria({
    req, contaId: user.id, atorId: user.id, atorEmail: user.email,
    acao: 'config', entidade: 'conta', sensivel: true,
    descricao: 'Encerrou a conta: anonimização da PII + bloqueio de login (LGPD)',
    meta: { detalhe, authBloqueado, em: agora },
  })

  return Response.json({ ok: true, encerrada_em: agora, auth_bloqueado: authBloqueado })
}
