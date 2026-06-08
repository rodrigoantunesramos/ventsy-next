// Motor PURO de Ativos & Bens (patrimônio) da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: DEPRECIAÇÃO LINEAR (mensal, acumulada, valor
// contábil atual, cronograma anual), valoração da carteira de patrimônio,
// status de garantia/seguro/manutenção e índice de decisão repor×consertar.
//
// É consumido por:
//   • /painel/ativos            (KPIs do patrimônio, gráficos — via _lib.ts)
//   • /painel/ativos/[id]       (ficha: depreciação + cronograma + decisão)
//   • /api/cron/depreciar-ativos (lançamento mensal no contábil — quando existir)
//
// Regras de ouro (espelham lib/pricing.ts, lib/reservas.ts, lib/comissoes.ts e
// lib/estoque.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     (moeda/data/percentual) fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio escondido na lógica. Datas tratadas em UTC ao meio-dia para fugir
//     de off-by-one de fuso.
//   • Dinheiro arredondado a centavos via round2 para evitar drift de float.

// ── Utilidades numéricas/data ────────────────────────────────────────────────
export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
export function round2(n: number): number {
  return Math.round(num(n) * 100) / 100
}
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Date no meio-dia UTC a partir de 'YYYY-MM-DD' (ignora hora se vier ISO). */
export function parseYmdUTC(ymd: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0))
  return Number.isNaN(d.getTime()) ? null : d
}
export function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
/** Soma `n` meses a uma data 'YYYY-MM-DD' (UTC). Retorna 'YYYY-MM-DD' ou null. */
export function addMesesYmd(ymd: string | null | undefined, n: number): string | null {
  const d = parseYmdUTC(ymd)
  if (!d) return null
  d.setUTCMonth(d.getUTCMonth() + Math.round(n))
  return ymdUTC(d)
}
/** Meses INTEIROS completos decorridos entre `de` (YMD) e o instante `ateMs`. */
export function mesesCompletos(de: string | null | undefined, ateMs: number): number {
  const a = parseYmdUTC(de)
  if (!a) return 0
  const b = new Date(ateMs)
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) m -= 1 // ainda não fechou o mês
  return m
}
/** Dias inteiros de `nowMs` até `dataYmd` (negativo = já passou; null se vazio). */
export function diasAte(dataYmd: string | null | undefined, nowMs: number): number | null {
  const alvo = parseYmdUTC(dataYmd)
  if (!alvo) return null
  const h = new Date(nowMs)
  const hojeUTC = Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate())
  const alvoUTC = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate())
  return Math.round((alvoUTC - hojeUTC) / 86_400_000)
}

// ── Depreciação ──────────────────────────────────────────────────────────────
export type MetodoDeprec = 'linear' | 'nenhum'

/** Subconjunto de um ativo necessário para depreciar (espelha public.ativos). */
export type AtivoDeprec = {
  data_aquisicao: string | null      // YYYY-MM-DD — início da depreciação
  valor_aquisicao_num: number | null // custo de aquisição
  valor_residual_num: number | null  // valor ao fim da vida útil (default 0)
  vida_util_meses: number | null     // 0/null = não deprecia (ex.: terreno)
  metodo_deprec?: MetodoDeprec | string | null // só 'linear' é calculado
  baixado_em?: string | null         // YYYY-MM-DD — congela a depreciação na baixa
}

export type Depreciacao = {
  base: number              // valor depreciável = aquisição − residual (>= 0)
  mensal: number            // depreciação por mês
  mesesVida: number         // vida útil em meses (>= 0)
  mesesDecorridos: number   // meses efetivamente depreciados [0, mesesVida]
  acumulada: number         // depreciação acumulada até agora (<= base)
  valorContabil: number     // aquisição − acumulada (>= residual)
  percentual: number        // fração depreciada [0, 1] (acumulada / base)
  totalmenteDepreciado: boolean
  deprecia: boolean         // false p/ método 'nenhum' ou vida/base zerada
  fimVidaUtil: string | null // YYYY-MM-DD (aquisição + vida útil)
}

/** Depreciação mensal (linear) — base depreciável dividida pela vida útil. */
export function depreciacaoMensal(a: AtivoDeprec): number {
  const metodo = (a.metodo_deprec ?? 'linear') as string
  const vida = Math.max(0, Math.trunc(num(a.vida_util_meses)))
  const base = Math.max(0, num(a.valor_aquisicao_num) - num(a.valor_residual_num))
  if (metodo === 'nenhum' || vida <= 0 || base <= 0) return 0
  return round2(base / vida)
}

/**
 * Calcula a depreciação de UM ativo no instante `nowMs`.
 * Se baixado, congela a contagem na data da baixa.
 */
export function depreciar(a: AtivoDeprec, nowMs: number): Depreciacao {
  const aquisicao = num(a.valor_aquisicao_num)
  const residual = clamp(num(a.valor_residual_num), 0, aquisicao)
  const vida = Math.max(0, Math.trunc(num(a.vida_util_meses)))
  const base = Math.max(0, aquisicao - residual)
  const metodo = (a.metodo_deprec ?? 'linear') as string
  const deprecia = metodo !== 'nenhum' && vida > 0 && base > 0
  const fimVidaUtil = a.data_aquisicao ? addMesesYmd(a.data_aquisicao, vida) : null

  if (!deprecia || !a.data_aquisicao) {
    return {
      base, mensal: 0, mesesVida: vida, mesesDecorridos: 0, acumulada: 0,
      valorContabil: round2(aquisicao), percentual: 0, totalmenteDepreciado: false,
      deprecia: false, fimVidaUtil,
    }
  }

  // A depreciação para na baixa (se houver) ou no "agora".
  const refMs = a.baixado_em ? (parseYmdUTC(a.baixado_em)?.getTime() ?? nowMs) : nowMs
  const decorridos = clamp(mesesCompletos(a.data_aquisicao, refMs), 0, vida)
  const mensal = round2(base / vida)
  const acumulada = round2(Math.min(base, mensal * decorridos))
  const valorContabil = round2(Math.max(residual, aquisicao - acumulada))
  return {
    base, mensal, mesesVida: vida, mesesDecorridos: decorridos, acumulada, valorContabil,
    percentual: base > 0 ? clamp(acumulada / base, 0, 1) : 0,
    totalmenteDepreciado: decorridos >= vida,
    deprecia: true, fimVidaUtil,
  }
}

export type LinhaAno = {
  ano: number             // 1, 2, 3… (ano de vida útil)
  meses: number           // meses depreciados neste ano (12 ou o resto no último)
  depreciacao: number     // depreciação do ano
  acumulada: number       // acumulada ao fim do ano
  valorContabil: number   // valor contábil ao fim do ano
}

/** Cronograma de depreciação agrupado por ano de vida útil (enxuto p/ a ficha). */
export function cronogramaAnual(a: AtivoDeprec): LinhaAno[] {
  const aquisicao = num(a.valor_aquisicao_num)
  const residual = clamp(num(a.valor_residual_num), 0, aquisicao)
  const vida = Math.max(0, Math.trunc(num(a.vida_util_meses)))
  const mensal = depreciacaoMensal(a)
  if (!mensal || !vida) return []
  const base = aquisicao - residual
  const anos = Math.ceil(vida / 12)
  const linhas: LinhaAno[] = []
  let acumulada = 0
  for (let ano = 1; ano <= anos; ano++) {
    const meses = Math.min(12, vida - (ano - 1) * 12)
    const dep = round2(Math.min(mensal * meses, base - acumulada))
    acumulada = round2(acumulada + dep)
    linhas.push({ ano, meses, depreciacao: dep, acumulada, valorContabil: round2(aquisicao - acumulada) })
  }
  return linhas
}

// ── Valoração da carteira (patrimônio) ───────────────────────────────────────
export type ResumoPatrimonio = {
  aquisicaoTotal: number      // soma do custo de aquisição (ativos em uso)
  depreciacaoAcumulada: number
  valorContabil: number       // valor contábil atual total
  qtd: number                 // ativos em uso (não baixados)
  baixados: number            // quantidade baixada
}

/** Agrega a depreciação de uma lista de ativos (ignora baixados no valor). */
export function resumoPatrimonio(ativos: AtivoDeprec[], nowMs: number): ResumoPatrimonio {
  let aquisicao = 0, acumulada = 0, contabil = 0, qtd = 0, baixados = 0
  for (const a of ativos) {
    if (a.baixado_em) { baixados++; continue }
    const d = depreciar(a, nowMs)
    aquisicao += num(a.valor_aquisicao_num)
    acumulada += d.acumulada
    contabil += d.valorContabil
    qtd++
  }
  return {
    aquisicaoTotal: round2(aquisicao),
    depreciacaoAcumulada: round2(acumulada),
    valorContabil: round2(contabil),
    qtd, baixados,
  }
}

// ── Garantia / Seguro (vencimentos) ──────────────────────────────────────────
export type VencStatus = 'sem' | 'vencido' | 'avencer' | 'emdia'

/** Classifica um vencimento (garantia/seguro) em relação ao "agora". */
export function statusVencimento(dataYmd: string | null | undefined, nowMs: number, diasAviso = 30): VencStatus {
  const dias = diasAte(dataYmd, nowMs)
  if (dias == null) return 'sem'
  if (dias < 0) return 'vencido'
  if (dias <= diasAviso) return 'avencer'
  return 'emdia'
}

// ── Manutenção (custo acumulado + decisão repor×consertar) ────────────────────
export type ManutLite = { status?: string | null; custo_num?: number | null }
const MANUT_ABERTA = new Set(['aberta', 'planejada', 'em_andamento', 'aguardando_peca'])

/** Custo total de manutenção (todas as ordens, qualquer status). */
export function custoManutencao(ms: ManutLite[]): number {
  return round2(ms.reduce((s, m) => s + num(m.custo_num), 0))
}
/** Nº de ordens de manutenção ainda abertas (não concluídas/canceladas). */
export function manutencaoAbertas(ms: ManutLite[]): number {
  return ms.filter((m) => MANUT_ABERTA.has(String(m.status || 'aberta'))).length
}
/**
 * Índice de manutenção = custo acumulado de manutenção / valor contábil atual.
 * Quanto maior, mais a manutenção "come" o valor do bem → sinal de substituição.
 * Retorna Infinity se o valor contábil for 0 e houver custo (totalmente depreciado
 * mas ainda gastando manutenção).
 */
export function indiceManutencao(custoAcumulado: number, valorContabil: number): number {
  const c = num(custoAcumulado), v = num(valorContabil)
  if (v <= 0) return c > 0 ? Infinity : 0
  return c / v
}
/** Recomenda substituir quando a manutenção acumulada passa o limiar do valor. */
export function sugereSubstituir(custoAcumulado: number, valorContabil: number, limiar = 0.6): boolean {
  return indiceManutencao(custoAcumulado, valorContabil) >= limiar
}
