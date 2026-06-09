// Helpers SERVER-ONLY do Portal do Cliente — usam service-role (supabaseAdmin).
// NUNCA importe em componentes 'use client'. Compartilhados entre a rota do
// cliente (app/api/portal/cliente) e o webhook do Mercado Pago
// (app/api/pagamentos/webhook), para a baixa de parcela ser idêntica nos dois.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { parcelaPaga } from '@/lib/portal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

/** YYYY-MM-DD no fuso local (sem off-by-one do toISOString em UTC). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Resolve o access token do Mercado Pago: do DONO (se ele conectou o MP via
 *  host_mp) ou da plataforma como fallback. `doDono=true` → o dinheiro cai na
 *  conta MP do próprio dono. */
export async function resolverTokenMpDono(donoId?: string | null): Promise<{ token?: string; doDono: boolean }> {
  if (donoId) {
    try {
      const { data: hm } = await admin
        .from('host_mp').select('mp_access_token, conectado').eq('usuario_id', donoId).maybeSingle()
      if (hm?.conectado && hm?.mp_access_token) return { token: hm.mp_access_token as string, doDono: true }
    } catch { /* host_mp pode não existir neste ambiente */ }
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  return { token: token || undefined, doDono: false }
}

export type BaixaResultado = { ok: boolean; jaPago?: boolean; motivo?: string }

/** Baixa uma parcela (IDEMPOTENTE): marca como paga + cria o lançamento de
 *  receita no financeiro do DONO + vincula `lancamento_id`. No-op se já paga.
 *  Espelha exatamente a baixa manual de Recebíveis
 *  (app/(proprietario)/painel/recebiveis) — por isso o pagamento pelo portal
 *  "cai no financeiro do dono". */
export async function baixarParcela(
  parcelaId: number | string,
  opts: { metodo?: string; pagoEm?: string } = {},
): Promise<BaixaResultado> {
  const { data: p } = await admin
    .from('parcelas')
    .select('id, usuario_id, evento_id, numero, descricao, valor, status, lancamento_id')
    .eq('id', parcelaId)
    .maybeSingle()
  if (!p) return { ok: false, motivo: 'nao_encontrada' }
  if (parcelaPaga(p.status) || p.lancamento_id) return { ok: true, jaPago: true }

  const { data: ev } = await admin
    .from('clientes_eventos').select('nome_evento, tipo_evento, propriedade_id').eq('id', p.evento_id).maybeSingle()

  const metodo = opts.metodo || 'Mercado Pago'
  const pagoEm = opts.pagoEm || ymd(new Date())
  const descricao = `${ev?.nome_evento || 'Evento'} — ${(p.descricao || `Parcela ${p.numero ?? ''}`).toString().trim()}`

  const { data: lanc, error: e1 } = await admin
    .from('lancamentos')
    .insert({
      usuario_id: p.usuario_id, tipo: 'receita', categoria: 'Aluguel de Espaço',
      descricao, tipo_evento: ev?.tipo_evento || null, valor: Number(p.valor) || 0, status: 'pago',
      data: pagoEm, metodo_pagamento: metodo, prop_id: ev?.propriedade_id ?? null,
      observacao: 'Pagamento via Portal do Cliente',
    })
    .select('id')
    .single()
  if (e1 || !lanc) return { ok: false, motivo: 'lancamento' }

  const { error: e2 } = await admin
    .from('parcelas')
    .update({ status: 'pago', pago_em: pagoEm, metodo_pagamento: metodo, lancamento_id: lanc.id })
    .eq('id', parcelaId)
  if (e2) {
    await admin.from('lancamentos').delete().eq('id', lanc.id) // desfaz p/ não duplicar receita
    return { ok: false, motivo: 'parcela' }
  }
  return { ok: true }
}
