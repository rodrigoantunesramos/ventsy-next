import { supabaseAdmin } from '@/lib/supabaseAdmin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

// Ativa (ou renova) a assinatura de um anfitrião: desativa as anteriores ativas
// e cria uma nova linha 'ativa' com o período. Server-only (service-role).
export async function ativarAssinatura(opts: {
  usuario_id: string
  plano: string
  meses: number
  valor: number
  metodo?: string
  mp_payment_id?: string
}) {
  const inicio = new Date()
  const fim = new Date(inicio)
  fim.setMonth(fim.getMonth() + (opts.meses || 1))
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  await admin
    .from('assinaturas')
    .update({ status: 'inativa', atualizado_em: new Date().toISOString() })
    .eq('usuario_id', opts.usuario_id)
    .in('status', ['ativa', 'trial'])

  await admin.from('assinaturas').insert({
    usuario_id: opts.usuario_id,
    plano_ativo: opts.plano,
    status: 'ativa',
    inicio_periodo: iso(inicio),
    fim_periodo: iso(fim),
    valor_pago: opts.valor,
    moeda: 'BRL',
    metodo_pagamento: opts.metodo || null,
    gateway_ref: opts.mp_payment_id || null,
  })
}
