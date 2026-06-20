import { supabaseAdmin } from '@/lib/supabaseAdmin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Ativa (ou renova/concede) um módulo avulso (add-on) para um usuário. Server-only
// (service-role): chamado pelo checkout aprovado, pelo webhook do MP e pela
// concessão manual do admin. Espelha lib/assinatura.ativarAssinatura, mas por
// módulo e com upsert na PK (usuario_id, modulo_key).
export async function ativarModulo(opts: {
  usuario_id: string
  modulo_key: string
  meses?: number
  valor?: number
  metodo?: string | null
  mp_payment_id?: string | null
  origem?: 'avulso' | 'cortesia' | 'admin'
}) {
  const meses = opts.meses && opts.meses > 0 ? opts.meses : 1
  const inicio = new Date()
  const fim = new Date(inicio)
  fim.setMonth(fim.getMonth() + meses)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  await admin.from('usuarios_modulos').upsert(
    {
      usuario_id: opts.usuario_id,
      modulo_key: opts.modulo_key,
      status: 'ativo',
      origem: opts.origem || 'avulso',
      inicio: iso(inicio),
      fim: iso(fim),
      valor_pago: Number(opts.valor) || 0,
      metodo_pagamento: opts.metodo || null,
      gateway_ref: opts.mp_payment_id || null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,modulo_key' },
  )
}

// Cancela um add-on (concessão revogada pelo admin). Mantém a linha para trilha.
export async function cancelarModulo(usuario_id: string, modulo_key: string) {
  await admin
    .from('usuarios_modulos')
    .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
    .eq('usuario_id', usuario_id)
    .eq('modulo_key', modulo_key)
}

// Lê os add-ons ATIVOS e vigentes de um usuário (chaves). Vigência: sem `fim`
// (vitalício/cortesia) ou `fim` >= hoje.
export async function modulosAtivosDoUsuario(usuario_id: string): Promise<string[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data } = await admin
    .from('usuarios_modulos')
    .select('modulo_key, status, fim')
    .eq('usuario_id', usuario_id)
    .eq('status', 'ativo')
  return ((data ?? []) as Array<{ modulo_key: string; fim: string | null }>)
    .filter((r) => !r.fim || r.fim >= hoje)
    .map((r) => r.modulo_key)
}
