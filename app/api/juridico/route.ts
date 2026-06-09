import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { isMissingTable } from '@/lib/juridico'

// Direitos do titular (LGPD) que precisam varrer/escrever em VÁRIAS tabelas com
// dados pessoais — por isso passam por service-role (controlado), não por RLS:
//   • POST { action:'exportar_titular', titular } — reúne (acesso/portabilidade)
//     todos os dados pessoais de um titular em clientes/clientes_eventos/convidados
//     + os registros de LGPD (consentimentos/solicitações). Só leitura.
//   • POST { action:'anonimizar_titular', titular, solicitacao_id? } — sobrescreve
//     os dados pessoais do titular nas tabelas OPERACIONAIS (clientes/eventos/
//     convidados) de forma irreversível ("exclusão/anonimização efetiva"),
//     preservando o ledger de conformidade e os registros exigidos por lei. Se
//     vier `solicitacao_id`, conclui a solicitação com trilha.
//
// A identidade é SEMPRE user.id (o escopo de toda query é `usuario_id = user.id`);
// nunca confiamos em ids vindos do corpo. O CRUD comum das tabelas do módulo é
// feito pelo client via RLS — esta rota existe só para o que cruza tabelas.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function badRequest(msg: string) { return Response.json({ error: msg }, { status: 400 }) }

type TitularQuery = { nome?: string; email?: string; doc?: string; tipo?: string; id?: string }
type Cond = { col: string; op: 'ilike' | 'eq'; val: string }

// Tabelas com dados pessoais + como casar o titular + o que limpar ao anonimizar.
type Alvo = {
  tabela: string
  rotulo: string
  // colunas de match por campo do titular
  nomeCol?: string
  emailCol?: string
  docCol?: string
  // patch de anonimização (null = limpa; string = placeholder). Ausente em alvos só-leitura.
  anon?: Record<string, unknown>
}

const ALVOS: Alvo[] = [
  {
    tabela: 'clientes', rotulo: 'Clientes', nomeCol: 'nome', emailCol: 'email', docCol: 'doc',
    anon: { nome: 'Titular anonimizado', email: null, telefone: null, whatsapp: null, doc: null, endereco: null, aniversario: null, obs: null },
  },
  {
    tabela: 'clientes_eventos', rotulo: 'Eventos / Leads', nomeCol: 'quem_contratou', emailCol: 'email', docCol: 'documento',
    anon: { quem_contratou: 'Titular anonimizado', email: null, telefones: null, documento: null },
  },
  {
    tabela: 'convidados', rotulo: 'Convidados', nomeCol: 'nome', emailCol: 'email',
    anon: { nome: 'Convidado anonimizado', email: null, telefone: null, observacao: null, restricao_alimentar: null },
  },
  // Ledger de LGPD — só leitura (entra na exportação; NÃO é sobrescrito).
  { tabela: 'lgpd_consentimentos', rotulo: 'Consentimentos (LGPD)', nomeCol: 'titular_nome' },
  { tabela: 'lgpd_solicitacoes', rotulo: 'Solicitações (LGPD)', nomeCol: 'titular_nome' },
]

/** Monta as condições de match (uma por coluna disponível) a partir da query. */
function condsDoAlvo(alvo: Alvo, t: TitularQuery): Cond[] {
  const conds: Cond[] = []
  if (t.nome && alvo.nomeCol) conds.push({ col: alvo.nomeCol, op: 'ilike', val: t.nome.trim() })
  if (t.email && alvo.emailCol) conds.push({ col: alvo.emailCol, op: 'ilike', val: t.email.trim() })
  if (t.doc && alvo.docCol) conds.push({ col: alvo.docCol, op: 'eq', val: t.doc.trim() })
  return conds
}

/** Busca as linhas de um alvo que casam com QUALQUER condição (merge único por id).
 *  Uma query por condição evita o escape frágil do `.or()` do PostgREST. */
async function linhasDoAlvo(alvo: Alvo, userId: string, conds: Cond[]): Promise<{ rows: Record<string, unknown>[]; missing: boolean }> {
  if (conds.length === 0) return { rows: [], missing: false }
  const seen = new Map<unknown, Record<string, unknown>>()
  let missing = false
  for (const c of conds) {
    let qb = admin.from(alvo.tabela).select('*').eq('usuario_id', userId)
    qb = c.op === 'eq' ? qb.eq(c.col, c.val) : qb.ilike(c.col, c.val)
    const { data, error } = await qb
    if (error) { if (isMissingTable(error)) missing = true; continue }
    for (const r of (data || []) as Record<string, unknown>[]) seen.set(r.id, r)
  }
  return { rows: [...seen.values()], missing }
}

/** Remove campos sensíveis/volumosos da exportação que não interessam ao titular. */
function limparExport(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  delete out.usuario_id
  return out
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  const titular = (body.titular || {}) as TitularQuery

  const temFiltro = !!((titular.nome && titular.nome.trim()) || (titular.email && titular.email.trim()) || (titular.doc && titular.doc.trim()))
  if (!temFiltro) return badRequest('Informe ao menos um identificador do titular (nome, e-mail ou documento).')

  if (action === 'exportar_titular') {
    const registros: { tabela: string; rotulo: string; itens: Record<string, unknown>[] }[] = []
    let total = 0
    for (const alvo of ALVOS) {
      const conds = condsDoAlvo(alvo, titular)
      const { rows } = await linhasDoAlvo(alvo, user.id, conds)
      const itens = rows.map(limparExport)
      registros.push({ tabela: alvo.tabela, rotulo: alvo.rotulo, itens })
      total += itens.length
    }
    return Response.json({ data: { titular, geradoEm: new Date().toISOString(), total, registros } })
  }

  if (action === 'anonimizar_titular') {
    const afetados: { tabela: string; linhas: number }[] = []
    let total = 0
    for (const alvo of ALVOS) {
      if (!alvo.anon) continue // ledger de LGPD não é sobrescrito
      const conds = condsDoAlvo(alvo, titular)
      const { rows } = await linhasDoAlvo(alvo, user.id, conds)
      const ids = rows.map((r) => r.id).filter((v) => v != null)
      if (ids.length === 0) { afetados.push({ tabela: alvo.tabela, linhas: 0 }); continue }
      const { error } = await admin.from(alvo.tabela).update(alvo.anon).in('id', ids).eq('usuario_id', user.id)
      const linhas = error ? 0 : ids.length
      afetados.push({ tabela: alvo.tabela, linhas })
      total += linhas
    }

    // Conclui a solicitação que originou a anonimização (com trilha), se houver.
    const solicitacaoId = body.solicitacao_id ? String(body.solicitacao_id) : null
    if (solicitacaoId) {
      const nota = `Dados anonimizados em ${total} registro(s) em ${new Date().toISOString().slice(0, 10)}.`
      await admin.from('lgpd_solicitacoes')
        .update({ status: 'concluida', concluida_em: new Date().toISOString(), resposta: nota })
        .eq('id', solicitacaoId).eq('usuario_id', user.id)
    }

    return Response.json({ data: { afetados, total } })
  }

  return badRequest('Ação inválida.')
}
