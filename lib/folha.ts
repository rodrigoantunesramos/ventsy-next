// Motor PURO de Folha / Encargos / Holerite (BR) — fonte ÚNICA de verdade.
// ─────────────────────────────────────────────────────────────────────────────
// Extraído de /painel/equipe para ser reutilizado por /painel/equipe E pelo hub
// /painel/rh (Funcionários · Folha & Benefícios · Desligamento) SEM duplicar a
// folha. Quem consome (UI) formata via lib/format — aqui só há números crus.
//
// Regras de ouro (espelham lib/pricing.ts, lib/equipamentos.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl — só dados crus e determinístico.
//   • Os percentuais de encargo são EDITÁVEIS pelo usuário (aba Encargos); as
//     tabelas de INSS/IRRF abaixo são DEFAULTS sensatos (confirme com contador).

// ── Vocabulário ──────────────────────────────────────────────────────────────
export type ContratoTipo = 'clt' | 'horista' | 'mei' | 'estagio'

export type ChargeSet = Record<string, number>
export type Charges = { clt: ChargeSet; horista: ChargeSet; estagio: ChargeSet }

// ── Catálogos compartilhados (rótulos PT; i18n: extrair p/ dicionário) ────────
export const CONTRATOS: { v: ContratoTipo; l: string }[] = [
  { v: 'clt', l: 'CLT' },
  { v: 'horista', l: 'Horista' },
  { v: 'mei', l: 'MEI/PJ' },
  { v: 'estagio', l: 'Estágio' },
]
export const CONTRATO_MAP = Object.fromEntries(CONTRATOS.map((c) => [c.v, c.l])) as Record<string, string>

export const STATUS_LIST: { v: string; l: string; c: string }[] = [
  { v: 'ativo', l: 'Ativo', c: 'bg-emerald-50 text-emerald-700' },
  { v: 'ferias', l: 'Férias', c: 'bg-blue-50 text-blue-700' },
  { v: 'afastado', l: 'Afastado', c: 'bg-amber-50 text-amber-700' },
]
export const STATUS_MAP = Object.fromEntries(STATUS_LIST.map((s) => [s.v, s])) as Record<string, (typeof STATUS_LIST)[number]>

// ── Encargos patronais (percentuais sobre o salário) ──────────────────────────
export const DEFAULT_CHARGES: Charges = {
  clt: {
    inss: 20, fgts: 8, rat: 2, terceiros: 5.8,
    ferias: 11.11, decimoTerceiro: 8.33,
    valeTransporte: 6, valeAlimentacao: 10, planoSaude: 8, outros: 0,
  },
  horista: { inss: 20, fgts: 8, rat: 2, terceiros: 5.8, outros: 0 },
  estagio: { outros: 0 },
}

export const CHARGE_LABELS: Record<string, string> = {
  inss: 'INSS Patronal', fgts: 'FGTS', rat: 'RAT (Risco)', terceiros: 'Terceiros (Sistema S)',
  ferias: 'Férias + 1/3', decimoTerceiro: '13º Salário',
  valeTransporte: 'Vale Transporte', valeAlimentacao: 'Vale Alimentação',
  planoSaude: 'Plano de Saúde', outros: 'Outros',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export const num = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(x) ? x : 0
}
const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100

/**
 * Custo TOTAL do empregador para um colaborador (salário + encargos patronais).
 * MEI/PJ e Estágio não geram custo patronal (responsáveis pelos próprios encargos).
 * Mantém exatamente o comportamento histórico de /painel/equipe.
 */
export function calcCusto(
  salario: number,
  contrato: string,
  charges: Charges,
): { salario: number; encargos: number; total: number } {
  const s = num(salario)
  if (contrato === 'mei' || contrato === 'estagio') return { salario: s, encargos: 0, total: s }
  const chargeSet = charges[contrato as keyof Charges] ?? charges.clt
  const encargos = Object.values(chargeSet).reduce((acc, p) => acc + s * (num(p) / 100), 0)
  return { salario: s, encargos: round2(encargos), total: round2(s + encargos) }
}

/** Soma dos percentuais de um conjunto de encargos (para o chip "% do salário"). */
export function totalPct(charges: ChargeSet): number {
  return round2(Object.values(charges).reduce((acc, p) => acc + num(p), 0))
}

// ── INSS / IRRF (empregado) — DEFAULTS configuráveis ──────────────────────────
// Tabelas progressivas mensais (valores de referência; ajuste com seu contador).
export type FaixaINSS = { ate: number; aliquota: number } // aliquota em fração (0.075)
export type FaixaIRRF = { ate: number; aliquota: number; deduzir: number }

export const INSS_FAIXAS: FaixaINSS[] = [
  { ate: 1412.0, aliquota: 0.075 },
  { ate: 2666.68, aliquota: 0.09 },
  { ate: 4000.03, aliquota: 0.12 },
  { ate: 7786.02, aliquota: 0.14 }, // teto de contribuição
]
export const IRRF_FAIXAS: FaixaIRRF[] = [
  { ate: 2259.2, aliquota: 0, deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deduzir: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 662.77 },
  { ate: Infinity, aliquota: 0.275, deduzir: 896.0 },
]
export const DEDUCAO_DEPENDENTE = 189.59

/** INSS progressivo do empregado (contribuição por faixa, respeitando o teto). */
export function calcularINSS(base: number, faixas: FaixaINSS[] = INSS_FAIXAS): number {
  let restante = num(base)
  let anterior = 0
  let total = 0
  for (const f of faixas) {
    if (restante <= 0) break
    const tributavel = Math.min(num(base), f.ate) - anterior
    if (tributavel > 0) total += tributavel * f.aliquota
    anterior = f.ate
    if (num(base) <= f.ate) break
  }
  return round2(total)
}

/** IRRF mensal pela tabela progressiva (dedução por dependente). */
export function calcularIRRF(
  base: number,
  dependentes = 0,
  faixas: FaixaIRRF[] = IRRF_FAIXAS,
  deducaoDependente = DEDUCAO_DEPENDENTE,
): number {
  const tributavel = Math.max(0, num(base) - num(dependentes) * deducaoDependente)
  const faixa = faixas.find((f) => tributavel <= f.ate) ?? faixas[faixas.length - 1]
  return round2(Math.max(0, tributavel * faixa.aliquota - faixa.deduzir))
}

// ── Holerite (proventos × descontos → líquido) ────────────────────────────────
export type LinhaHolerite = { label: string; valor: number; tipo: 'provento' | 'desconto' }
export type HoleriteInput = {
  salario: number
  contrato: ContratoTipo | string
  dependentes?: number
  charges?: Charges
  proventosExtras?: { label: string; valor: number }[] // HE, adicional noturno, comissão…
  descontosExtras?: { label: string; valor: number }[] // adiantamento, faltas, plano…
  vtDescontoPct?: number // desconto de VT do empregado (até 6% do salário)
}
export type Holerite = {
  linhas: LinhaHolerite[]
  totalProventos: number
  totalDescontos: number
  inss: number
  irrf: number
  fgts: number // depósito do empregador (não reduz o líquido)
  liquido: number
  custoEmpregador: number
}

/**
 * Monta um holerite estimado. Para CLT/Horista aplica INSS+IRRF do empregado e
 * deposita FGTS (8%); MEI/Estágio não têm esses descontos (recebem a base +
 * extras − descontos informados). Sempre uma ESTIMATIVA — confirme com contador.
 */
export function calcularHolerite(inp: HoleriteInput): Holerite {
  const charges = inp.charges ?? DEFAULT_CHARGES
  const salario = num(inp.salario)
  const proventosExtras = inp.proventosExtras ?? []
  const descontosExtras = inp.descontosExtras ?? []

  const linhas: LinhaHolerite[] = [{ label: 'Salário base', valor: salario, tipo: 'provento' }]
  for (const p of proventosExtras) if (num(p.valor) !== 0) linhas.push({ label: p.label, valor: num(p.valor), tipo: 'provento' })

  const totalProventos = round2(linhas.filter((l) => l.tipo === 'provento').reduce((s, l) => s + l.valor, 0))

  const isCLT = inp.contrato === 'clt' || inp.contrato === 'horista'
  let inss = 0
  let irrf = 0
  let fgts = 0
  if (isCLT) {
    inss = calcularINSS(totalProventos)
    irrf = calcularIRRF(totalProventos - inss, num(inp.dependentes))
    fgts = round2(totalProventos * (num(charges[inp.contrato as keyof Charges]?.fgts) / 100 || 0.08))
    linhas.push({ label: 'INSS', valor: inss, tipo: 'desconto' })
    if (irrf > 0) linhas.push({ label: 'IRRF', valor: irrf, tipo: 'desconto' })
  }
  if (inp.vtDescontoPct && inp.vtDescontoPct > 0) {
    const vt = round2(salario * (Math.min(inp.vtDescontoPct, 6) / 100))
    linhas.push({ label: 'Vale-transporte', valor: vt, tipo: 'desconto' })
  }
  for (const d of descontosExtras) if (num(d.valor) !== 0) linhas.push({ label: d.label, valor: num(d.valor), tipo: 'desconto' })

  const totalDescontos = round2(linhas.filter((l) => l.tipo === 'desconto').reduce((s, l) => s + l.valor, 0))
  const liquido = round2(totalProventos - totalDescontos)
  const custoEmpregador = calcCusto(salario, String(inp.contrato), charges).total

  return { linhas, totalProventos, totalDescontos, inss, irrf, fgts, liquido, custoEmpregador }
}
