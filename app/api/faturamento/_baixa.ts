// Baixa de fatura — lógica AUTORITATIVA de quitação, compartilhada pela rota
// manual (/api/faturamento/baixar) e pelo webhook do Mercado Pago. Mantém a
// conciliação nota↔recebimento↔contábil:
//   fatura paga  →  cria lançamento de receita (caixa)  →  baixa a parcela
//                   vinculada (se houver), reusando o mesmo lançamento.
//
// Não é uma rota (prefixo "_"): é um módulo server-only usado pelas rotas.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

export type BaixaResult =
  | { ok: true; already?: boolean; lancamento_id?: number | null }
  | { ok: false; error: string }

/** Quita uma fatura: gera lançamento de receita e baixa a parcela vinculada. */
export async function baixarFatura(
  admin: Admin,
  opts: { faturaId: string; userId?: string; data?: string; metodo?: string },
): Promise<BaixaResult> {
  const { data: fatura } = await admin.from('faturas').select('*').eq('id', opts.faturaId).maybeSingle()
  if (!fatura) return { ok: false, error: 'Fatura não encontrada' }
  if (opts.userId && fatura.usuario_id !== opts.userId) return { ok: false, error: 'Acesso negado' }
  if (fatura.status === 'paga') return { ok: true, already: true, lancamento_id: fatura.lancamento_id ?? null }
  if (fatura.status === 'cancelada') return { ok: false, error: 'Fatura cancelada' }

  const dataCaixa = (opts.data || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const metodo = opts.metodo || 'Pix'

  // Contexto do evento (para rótulo/centro de custo do lançamento).
  let evento: { nome_evento?: string | null; tipo_evento?: string | null; propriedade_id?: number | null } | null = null
  if (fatura.evento_id) {
    const { data } = await admin
      .from('clientes_eventos')
      .select('nome_evento,tipo_evento,propriedade_id')
      .eq('id', fatura.evento_id)
      .maybeSingle()
    evento = data || null
  }

  // 1) Lançamento de receita no caixa.
  const { data: lanc, error: e1 } = await admin
    .from('lancamentos')
    .insert({
      usuario_id: fatura.usuario_id,
      tipo: 'receita',
      categoria: 'Aluguel de Espaço',
      descricao: `${evento?.nome_evento || 'Cobrança'} — ${fatura.descricao || 'Fatura'}`,
      tipo_evento: evento?.tipo_evento || null,
      valor: Number(fatura.valor_num) || 0,
      status: 'pago',
      data: dataCaixa,
      metodo_pagamento: metodo,
      prop_id: evento?.propriedade_id ?? null,
      observacao: 'Baixa de fatura (Faturamento)',
    })
    .select('id')
    .single()
  if (e1 || !lanc) return { ok: false, error: 'Falha ao lançar a receita no caixa' }

  // 2) Marca a fatura como paga.
  const { error: e2 } = await admin
    .from('faturas')
    .update({ status: 'paga', pago_em: new Date().toISOString(), lancamento_id: lanc.id })
    .eq('id', fatura.id)
  if (e2) {
    await admin.from('lancamentos').delete().eq('id', lanc.id) // rollback best-effort
    return { ok: false, error: 'Falha ao baixar a fatura' }
  }

  // 3) Baixa a parcela vinculada (se ainda em aberto), reusando o lançamento.
  if (fatura.parcela_id) {
    const { data: parcela } = await admin
      .from('parcelas')
      .select('id,status')
      .eq('id', fatura.parcela_id)
      .maybeSingle()
    if (parcela && parcela.status !== 'pago' && parcela.status !== 'cancelado') {
      await admin
        .from('parcelas')
        .update({ status: 'pago', pago_em: dataCaixa, metodo_pagamento: metodo, lancamento_id: lanc.id })
        .eq('id', fatura.parcela_id)
    }
  }

  return { ok: true, lancamento_id: lanc.id }
}

/** Estorna a baixa: apaga o lançamento, volta a fatura para 'aberta' e
 *  re-abre a parcela vinculada (se foi baixada por esta fatura). */
export async function estornarFatura(
  admin: Admin,
  opts: { faturaId: string; userId?: string },
): Promise<BaixaResult> {
  const { data: fatura } = await admin.from('faturas').select('*').eq('id', opts.faturaId).maybeSingle()
  if (!fatura) return { ok: false, error: 'Fatura não encontrada' }
  if (opts.userId && fatura.usuario_id !== opts.userId) return { ok: false, error: 'Acesso negado' }
  if (fatura.status !== 'paga') return { ok: true, already: true }

  if (fatura.lancamento_id) {
    // Re-abre a parcela que apontava para este lançamento.
    if (fatura.parcela_id) {
      await admin
        .from('parcelas')
        .update({ status: 'pendente', pago_em: null, lancamento_id: null })
        .eq('id', fatura.parcela_id)
        .eq('lancamento_id', fatura.lancamento_id)
    }
    await admin.from('lancamentos').delete().eq('id', fatura.lancamento_id)
  }
  const { error } = await admin
    .from('faturas')
    .update({ status: 'aberta', pago_em: null, lancamento_id: null })
    .eq('id', fatura.id)
  if (error) return { ok: false, error: 'Falha ao estornar a fatura' }
  return { ok: true }
}
