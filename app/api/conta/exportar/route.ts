import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// LGPD — exporta TODOS os dados do usuário num único JSON (service-role agrega
// tabelas escopadas por usuario_id). Não inclui segredos (ex.: integracoes.api_key).
const TABELAS = [
  'usuarios', 'empresa_config', 'assinaturas', 'historico_assinaturas',
  'propriedades', 'clientes', 'clientes_eventos', 'clientes_interacoes',
  'reservas', 'lancamentos', 'parcelas', 'metas_financeiras',
  'documentos', 'equipe', 'usuarios_papeis', 'avaliacoes_evento',
  'diary_entries', 'indicacoes', 'pagamentos',
] as const

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const dados: Record<string, unknown> = {}
  for (const tabela of TABELAS) {
    try {
      // 'usuarios' usa coluna id; as demais usam usuario_id.
      const col = tabela === 'usuarios' ? 'id' : 'usuario_id'
      const { data, error } = await admin.from(tabela).select('*').eq(col, user.id)
      if (!error) dados[tabela] = data ?? []
    } catch {
      /* tabela ausente — ignora */
    }
  }

  const bundle = {
    gerado_em: new Date().toISOString(),
    titular: { id: user.id, email: user.email },
    aviso: 'Exportação de dados pessoais (LGPD). Não inclui credenciais ou chaves de integração.',
    dados,
  }

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventsy-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
