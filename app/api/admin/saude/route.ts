import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { emailConfigurado } from '@/lib/email'

// Saúde do sistema: integrações configuradas, catálogo de crons (com os órfãos
// sinalizados) e webhooks. O status de última execução real do pg_cron exige
// uma função no banco (cron.job_run_details) — fica para um incremento futuro.
export const dynamic = 'force-dynamic'

const CRONS = [
  { rota: 'expirar-holds', agenda: '*/15 * * * *', orfao: false },
  { rota: 'expirar-pedidos', agenda: '*/15 * * * *', orfao: false },
  { rota: 'manutencao-preventiva', agenda: '0 4 * * *', orfao: false },
  { rota: 'apurar-comissoes', agenda: '0 5 * * *', orfao: false },
  { rota: 'contas-vencidas', agenda: '0 6 * * *', orfao: false },
  { rota: 'rh-alertas', agenda: '0 7 * * *', orfao: false },
  { rota: 'clima-eventos', agenda: '0 8 * * *', orfao: false },
  { rota: 'weekly-report', agenda: '0 12 * * 1', orfao: false },
  { rota: 'campanhas', agenda: '*/15 * * * *', orfao: false },
  { rota: 'webhooks-retry', agenda: '*/15 * * * *', orfao: false },
  { rota: 'automacoes', agenda: '30 8 * * *', orfao: false },
  { rota: 'pesquisas-pos-evento', agenda: '0 9 * * *', orfao: false },
  { rota: 'relatorios-agendados', agenda: '0 10 * * *', orfao: false },
]

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'saude', 'ver')
  if (!ctx) return forbidden()

  let webhooks: { total: number | null } = { total: null }
  try {
    const { count } = await supabaseAdmin
      .from('integracoes_webhooks_log')
      .select('*', { count: 'exact', head: true })
    webhooks = { total: count ?? 0 }
  } catch {
    /* tabela ausente → sem dado */
  }

  const integracoes = {
    email_smtp: emailConfigurado(),
    ia_gateway: !!process.env.AI_GATEWAY_API_KEY,
    cron_secret: !!process.env.CRON_SECRET,
    service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    site_url: process.env.NEXT_PUBLIC_SITE_URL || null,
  }

  return Response.json({ crons: CRONS, webhooks, integracoes })
}
