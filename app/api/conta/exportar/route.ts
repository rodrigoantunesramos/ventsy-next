import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { registrarAuditoria } from '@/lib/auditServer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// LGPD (art. 18, II e V — acesso e portabilidade) — exporta TODOS os dados do
// titular num único JSON. Cobertura curada por coluna de escopo REAL (confirmada
// no schema); cada fonte é isolada (tabela/coluna ausente é ignorada). NÃO inclui
// cofres de segredo (integracoes_segredos/_chaves/_webhooks, fiscal_provedores,
// host_mp) nem credenciais.
const FONTES: { t: string; col: string }[] = [
  // Perfil e conta
  { t: 'usuarios', col: 'id' },
  { t: 'empresa_config', col: 'usuario_id' },
  { t: 'usuarios_papeis', col: 'usuario_id' },
  { t: 'assinaturas', col: 'usuario_id' },
  { t: 'historico_assinaturas', col: 'usuario_id' },
  // Financeiro / fiscal
  { t: 'pagamentos', col: 'usuario_id' },
  { t: 'lancamentos', col: 'usuario_id' },
  { t: 'parcelas', col: 'usuario_id' },
  { t: 'metas_financeiras', col: 'usuario_id' },
  { t: 'notas_fiscais', col: 'usuario_id' },
  { t: 'faturas', col: 'usuario_id' },
  { t: 'contas_pagar', col: 'usuario_id' },
  { t: 'comissoes', col: 'usuario_id' },
  { t: 'parceiros', col: 'usuario_id' },
  // Espaços, reservas, documentos
  { t: 'propriedades', col: 'usuario_id' },
  { t: 'espacos', col: 'usuario_id' },
  { t: 'reservas', col: 'usuario_id' },
  { t: 'documentos', col: 'usuario_id' },
  // CRM, eventos, feedback (PII de terceiros sob a conta do titular)
  { t: 'clientes', col: 'usuario_id' },
  { t: 'clientes_interacoes', col: 'usuario_id' },
  { t: 'clientes_eventos', col: 'usuario_id' },
  { t: 'convidados', col: 'usuario_id' },
  { t: 'feedbacks', col: 'usuario_id' },
  { t: 'pesquisas_respostas', col: 'usuario_id' },
  // Comunicação
  { t: 'conversas', col: 'owner_id' },
  { t: 'mensagens', col: 'sender_id' },
  // Contratos e propostas
  { t: 'contratos', col: 'usuario_id' },
  { t: 'contratos_assinaturas', col: 'usuario_id' },
  { t: 'propostas', col: 'usuario_id' },
  // Fornecedores
  { t: 'fornecedores', col: 'usuario_id' },
  { t: 'fornecedores_contatos', col: 'usuario_id' },
  // Pessoas / RH
  { t: 'equipe', col: 'usuario_id' },
  { t: 'freelancers', col: 'usuario_id' },
  { t: 'escalas', col: 'usuario_id' },
  { t: 'ponto_registros', col: 'usuario_id' },
  { t: 'rh_vagas', col: 'usuario_id' },
  { t: 'rh_candidatos', col: 'usuario_id' },
  { t: 'rh_documentos', col: 'usuario_id' },
  { t: 'rh_ausencias', col: 'usuario_id' },
  // Seguros
  { t: 'seguros', col: 'usuario_id' },
  { t: 'sinistros', col: 'usuario_id' },
  // Ledger LGPD + diário + indicações
  { t: 'lgpd_consentimentos', col: 'usuario_id' },
  { t: 'lgpd_solicitacoes', col: 'usuario_id' },
  { t: 'diary_entries', col: 'user_id' },
  { t: 'indicacoes', col: 'indicador_id' },
]

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const dados: Record<string, unknown> = {}
  for (const { t, col } of FONTES) {
    try {
      const { data, error } = await admin.from(t).select('*').eq(col, user.id)
      if (!error) dados[t] = data ?? []
    } catch {
      /* tabela/coluna ausente — ignora */
    }
  }

  const bundle = {
    gerado_em: new Date().toISOString(),
    titular: { id: user.id, email: user.email },
    aviso: 'Exportação de dados pessoais (LGPD). Não inclui credenciais, chaves de integração nem segredos.',
    dados,
  }

  // Trilha de auditoria: exportar dados é uma ação sensível (LGPD).
  await registrarAuditoria({
    req, contaId: user.id, atorId: user.id, atorEmail: user.email,
    acao: 'exportar', entidade: 'dados_pessoais',
    descricao: 'Exportou todos os dados da conta (LGPD)',
    meta: { tabelas: Object.keys(dados).length },
  })

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventsy-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
