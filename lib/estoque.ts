// Motor PURO de estoque/almoxarifado da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: saldo a partir do Kardex, CUSTO MÉDIO MÓVEL,
// semáforo de mínimo, validade/lote (FEFO), sugestão de reposição, valoração do
// estoque e consumo por evento (custo direto do evento).
//
// É consumido por:
//   • /api/estoque                 (movimentação AUTORITATIVA: recalcula saldo +
//                                    custo médio e grava em produtos, service-role)
//   • /painel/estoque              (KPIs, kardex, FEFO, reposição — via _lib.ts)
//
// Regras de ouro (espelham lib/pricing.ts, lib/reservas.ts e lib/comissoes.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio escondido na lógica.
//   • Dinheiro arredondado a centavos via round2 para evitar drift de float.

// ── Utilidades numéricas/data ────────────────────────────────────────────────
export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
export function round2(n: number): number {
  return Math.round((num(n)) * 100) / 100
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Tipos de domínio ─────────────────────────────────────────────────────────
export type MovTipo = 'entrada' | 'saida' | 'ajuste' | 'perda' | 'transferencia'

/** Mínimo necessário para o cálculo de saldo/custo de uma movimentação. */
export type MovCalc = {
  tipo: MovTipo
  quantidade: number
  custo_unit_num?: number | null // só relevante na ENTRADA (custo de aquisição)
}

/** Estado derivado de um produto após aplicar movimentações em ordem. */
export type EstadoEstoque = { saldo: number; custo_medio_num: number }

/** Resultado de aplicar UMA movimentação: novo estado + custo efetivo da linha. */
export type ResultadoMov = {
  estado: EstadoEstoque
  custo_unit_efetivo: number // entrada: custo informado; demais: custo médio vigente
  custo_total: number        // valor (assinado) do movimento, p/ Kardex/consumo
}

export type NivelEstoque = 'zerado' | 'baixo' | 'ok'
export type StatusValidade = 'vencido' | 'critico' | 'atencao' | 'ok'

// ── Núcleo: efeito no saldo e custo médio móvel ──────────────────────────────
/**
 * Delta (assinado) que a movimentação aplica ao saldo:
 *   entrada → +q · saida/perda → −q · ajuste → q (já é o delta) · transferência → 0
 * (transferência move entre locais; não altera o saldo total do produto.)
 */
export function efeitoSaldo(tipo: MovTipo, quantidade: number): number {
  const q = num(quantidade)
  switch (tipo) {
    case 'entrada': return Math.abs(q)
    case 'saida':
    case 'perda': return -Math.abs(q)
    case 'ajuste': return q            // já assinado (contado − sistema)
    case 'transferencia': return 0
  }
}

/**
 * Aplica uma movimentação a um estado, retornando o próximo estado. Só a ENTRADA
 * altera o custo médio (média ponderada com o saldo anterior); saída/perda/ajuste
 * valoram pelo custo médio vigente; transferência é neutra.
 */
export function aplicarUma(estado: EstadoEstoque, mov: MovCalc): ResultadoMov {
  const saldo = num(estado.saldo)
  const custoMedio = num(estado.custo_medio_num)
  const q = num(mov.quantidade)

  if (mov.tipo === 'entrada') {
    const cu = num(mov.custo_unit_num)
    const qEnt = Math.abs(q)
    const novoSaldo = saldo + qEnt
    // média ponderada quando havia saldo positivo; senão a entrada define o custo
    // (saldo ≤ 0 não tem valor real a ponderar).
    const novoCusto = saldo > 0 && novoSaldo > 0 ? round2((saldo * custoMedio + qEnt * cu) / novoSaldo) : cu
    return { estado: { saldo: novoSaldo, custo_medio_num: novoCusto }, custo_unit_efetivo: cu, custo_total: round2(qEnt * cu) }
  }

  const delta = efeitoSaldo(mov.tipo, q)
  return {
    estado: { saldo: saldo + delta, custo_medio_num: custoMedio },
    custo_unit_efetivo: custoMedio,
    custo_total: round2(Math.abs(delta) * custoMedio * (delta < 0 ? -1 : 1)),
  }
}

/** Estado final após aplicar a lista de movimentações JÁ em ordem cronológica. */
export function recalcular(movs: MovCalc[]): EstadoEstoque {
  let estado: EstadoEstoque = { saldo: 0, custo_medio_num: 0 }
  for (const m of movs) estado = aplicarUma(estado, m).estado
  return { saldo: round2(estado.saldo), custo_medio_num: round2(estado.custo_medio_num) }
}

/** Comparador cronológico estável (por `criado_em`); use antes de recalcular. */
export function ordenarCronologico<T extends { criado_em?: string | null }>(movs: T[]): T[] {
  return [...movs].sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''))
}

/**
 * Kardex: percorre as movimentações (em ordem cronológica) devolvendo cada uma
 * com o saldo e o custo médio APÓS aplicá-la — pronto para o extrato por produto.
 */
export type KardexLinha<T> = T & { saldo_apos: number; custo_medio_apos: number; custo_unit_efetivo: number; custo_total: number }
export function kardex<T extends MovCalc>(movsCronologicas: T[]): KardexLinha<T>[] {
  let estado: EstadoEstoque = { saldo: 0, custo_medio_num: 0 }
  const linhas: KardexLinha<T>[] = []
  for (const m of movsCronologicas) {
    const r = aplicarUma(estado, m)
    estado = r.estado
    linhas.push({ ...m, saldo_apos: round2(estado.saldo), custo_medio_apos: round2(estado.custo_medio_num), custo_unit_efetivo: r.custo_unit_efetivo, custo_total: r.custo_total })
  }
  return linhas
}

// ── Semáforo de mínimo ───────────────────────────────────────────────────────
/** zerado: sem saldo · baixo: saldo ≤ mínimo (ponto de reposição) · ok: acima. */
export function statusMinimo(p: { estoque_atual: number; estoque_minimo: number }): NivelEstoque {
  const atual = num(p.estoque_atual)
  const min = num(p.estoque_minimo)
  if (atual <= 0) return 'zerado'
  if (min > 0 && atual <= min) return 'baixo'
  return 'ok'
}

// ── Validade / FEFO ──────────────────────────────────────────────────────────
/** Dias inteiros até a validade (negativo = vencido). Datas só-data ancoram meio-dia. */
export function diasParaVencer(validade: string | null | undefined, nowMs: number): number {
  if (!validade) return Infinity
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(validade) ? validade + 'T12:00:00' : validade
  const t = Date.parse(alvo)
  if (Number.isNaN(t)) return Infinity
  return Math.floor((t - nowMs) / 86_400_000)
}
/** vencido <0 · crítico ≤7d · atenção ≤ avisoDias · ok além. */
export function statusValidade(validade: string | null | undefined, nowMs: number, avisoDias = 30): StatusValidade {
  const d = diasParaVencer(validade, nowMs)
  if (d < 0) return 'vencido'
  if (d <= 7) return 'critico'
  if (d <= avisoDias) return 'atencao'
  return 'ok'
}

// ── Valoração do estoque (custo médio) ───────────────────────────────────────
export function valorProduto(p: { estoque_atual: number; custo_medio_num: number }): number {
  return round2(num(p.estoque_atual) * num(p.custo_medio_num))
}
export function valorEstoque(produtos: { estoque_atual: number; custo_medio_num: number }[]): number {
  return round2(produtos.reduce((s, p) => s + num(p.estoque_atual) * num(p.custo_medio_num), 0))
}

// ── Sugestão de reposição (itens no/abaixo do mínimo) ────────────────────────
export type Reposicao = { faltante: number; sugerido: number; custo_estimado: number }
/**
 * Para um produto, calcula o quanto falta para o mínimo (`faltante`) e a
 * quantidade sugerida de compra para repor até `fator`× o mínimo (nível de
 * reposição), nunca menos que o faltante. `custo_estimado` usa o custo médio.
 */
export function sugerirReposicao(p: { estoque_atual: number; estoque_minimo: number; custo_medio_num: number }, fator = 2): Reposicao {
  const atual = num(p.estoque_atual)
  const min = num(p.estoque_minimo)
  if (min <= 0) return { faltante: 0, sugerido: 0, custo_estimado: 0 }
  const faltante = round2(Math.max(min - atual, 0))
  const sugerido = round2(Math.max(min * fator - atual, faltante))
  return { faltante, sugerido, custo_estimado: round2(sugerido * num(p.custo_medio_num)) }
}
/** Precisa repor? (saldo no/abaixo do mínimo, com mínimo definido e produto ativo) */
export function precisaRepor(p: { estoque_atual: number; estoque_minimo: number; ativo?: boolean }): boolean {
  if (p.ativo === false) return false
  return num(p.estoque_minimo) > 0 && num(p.estoque_atual) <= num(p.estoque_minimo)
}

// ── Consumo por evento (custo direto do evento) ──────────────────────────────
export type ConsumoEvento = { evento_id: string; custo_total: number; quantidade: number; n: number }
/**
 * Agrega as SAÍDAS vinculadas a eventos: custo total (Σ custo_total_num) e nº de
 * baixas por evento. É o que alimenta o custo direto do evento na Contabilidade.
 * Ordenado por custo desc.
 */
export function consumoPorEvento(
  movs: { tipo: MovTipo; evento_id: string | null; quantidade: number; custo_total_num: number }[],
): ConsumoEvento[] {
  const mapa = new Map<string, ConsumoEvento>()
  for (const m of movs) {
    if (m.tipo !== 'saida' || !m.evento_id) continue
    const cur = mapa.get(m.evento_id) || { evento_id: m.evento_id, custo_total: 0, quantidade: 0, n: 0 }
    cur.custo_total = round2(cur.custo_total + Math.abs(num(m.custo_total_num)))
    cur.quantidade = round2(cur.quantidade + Math.abs(num(m.quantidade)))
    cur.n += 1
    mapa.set(m.evento_id, cur)
  }
  return [...mapa.values()].sort((a, b) => b.custo_total - a.custo_total)
}

// ── Catálogos (rótulos PT; usados por _lib/UI — i18n: extrair p/ dicionário) ──
export const MOV_LABEL: Record<MovTipo, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  perda: 'Perda',
  transferencia: 'Transferência',
}
