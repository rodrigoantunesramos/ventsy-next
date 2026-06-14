import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PLATAFORMA_CONFIG } from '@/lib/plataformaConfig'

// Leitura das configurações globais — SERVER-ONLY (usa service-role). Faz merge
// dos defaults do catálogo com os valores salvos em public.plataforma_config.
// Tolerante a tabela ausente (retorna os defaults).
export async function lerPlataformaConfig(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const def of PLATAFORMA_CONFIG) out[def.chave] = def.padrao
  try {
    const { data } = await supabaseAdmin.from('plataforma_config').select('chave, valor')
    for (const row of data ?? []) {
      out[row.chave] = row.valor
    }
  } catch {
    // tabela ainda não criada → defaults
  }
  return out
}

// Helper de conveniência para ler uma config específica (com fallback ao default).
export async function getConfig<T = unknown>(chave: string): Promise<T> {
  const all = await lerPlataformaConfig()
  return all[chave] as T
}
