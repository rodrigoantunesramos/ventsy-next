// Motor PURO de RH da Ventsy (ciclo de pessoas além da folha).
// ─────────────────────────────────────────────────────────────────────────────
// Cobre o que NÃO é folha (folha vive em lib/folha.ts, reaproveitada aqui e em
// /painel/equipe): direito/saldo/VENCIMENTO de férias (passivo trabalhista),
// status de validade de documentos/ASO, turnover & headcount, avos de 13º/férias
// e o cálculo (estimado) de rescisão por motivo. Consumido por /painel/rh.
//
// Regras de ouro (espelham lib/folha.ts, lib/equipamentos.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl — só dados crus, determinístico.
//   • O "hoje" entra SEMPRE por parâmetro (string YYYY-MM-DD). Nada de relógio
//     escondido na lógica → testável.
//   • Valores monetários de rescisão são ESTIMATIVAS (confirme com contador).

import { num } from '@/lib/folha'

export { num }
const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100

// ── Datas (date-only, ancoradas ao meio-dia local p/ evitar off-by-one UTC) ───
export function parseYmd(ymd: string | null | undefined): Date | null {
  if (!ymd) return null
  const s = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T12:00:00` : ymd
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd)!
  d.setDate(d.getDate() + n)
  return toYmd(d)
}
export function addMonths(ymd: string, n: number): string {
  const d = parseYmd(ymd)!
  d.setMonth(d.getMonth() + n)
  return toYmd(d)
}
/** Dias-corridos entre duas datas (b − a). Negativo se b < a. */
export function diffDays(a: string, b: string): number {
  const da = parseYmd(a)
  const db = parseYmd(b)
  if (!da || !db) return 0
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}
/** Meses COMPLETOS entre admissão e hoje (aniversário mensal já cumprido). */
export function diffMesesCompletos(a: string, b: string): number {
  const da = parseYmd(a)
  const db = parseYmd(b)
  if (!da || !db || db < da) return 0
  let meses = (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth())
  if (db.getDate() < da.getDate()) meses -= 1
  return Math.max(0, meses)
}

// ── Tempo de casa ─────────────────────────────────────────────────────────────
export function tempoCasaLabel(admissao: string | null, hoje: string): string {
  if (!admissao) return '—'
  const meses = diffMesesCompletos(admissao, hoje)
  if (meses < 1) return 'Novo'
  if (meses < 12) return `${meses}m`
  const a = Math.floor(meses / 12)
  const m = meses % 12
  return m ? `${a}a ${m}m` : `${a}a`
}

// ── Avos (regra dos 15 dias) p/ 13º e férias proporcionais ────────────────────
/** Nº de meses entre [inicio, fim] em que se trabalhou ≥15 dias (0..12+). */
export function avos(inicio: string, fim: string): number {
  const di = parseYmd(inicio)
  const df = parseYmd(fim)
  if (!di || !df || df < di) return 0
  let count = 0
  const cur = new Date(di.getFullYear(), di.getMonth(), 1, 12)
  const last = new Date(df.getFullYear(), df.getMonth(), 1, 12)
  while (cur <= last) {
    const ano = cur.getFullYear()
    const mes = cur.getMonth()
    const fimMes = new Date(ano, mes + 1, 0).getDate()
    const ini = ano === di.getFullYear() && mes === di.getMonth() ? di.getDate() : 1
    const fimD = ano === df.getFullYear() && mes === df.getMonth() ? df.getDate() : fimMes
    if (fimD - ini + 1 >= 15) count += 1
    cur.setMonth(cur.getMonth() + 1)
  }
  return count
}

// ── Férias ────────────────────────────────────────────────────────────────────
export type AusenciaLite = {
  tipo: string
  inicio: string | null
  fim: string | null
  dias: number
  status: string
}

/** Períodos aquisitivos COMPLETOS (cada 12 meses → direito a 30 dias). */
export function periodosAquisitivos(admissao: string | null, hoje: string): number {
  if (!admissao) return 0
  return Math.floor(diffMesesCompletos(admissao, hoje) / 12)
}
/** Dias de férias a que tem direito (períodos completos × 30). */
export function direitoFeriasDias(admissao: string | null, hoje: string): number {
  return periodosAquisitivos(admissao, hoje) * 30
}
/** Soma de dias de férias já gozados (ausências tipo 'ferias' status 'gozada'). */
export function diasFeriasGozados(ausencias: AusenciaLite[]): number {
  return ausencias.filter((a) => a.tipo === 'ferias' && a.status === 'gozada').reduce((s, a) => s + num(a.dias), 0)
}
/** Dias de férias agendados/pendentes (solicitada|aprovada), ainda não gozados. */
export function diasFeriasAgendados(ausencias: AusenciaLite[]): number {
  return ausencias
    .filter((a) => a.tipo === 'ferias' && (a.status === 'solicitada' || a.status === 'aprovada'))
    .reduce((s, a) => s + num(a.dias), 0)
}
/** Saldo de férias disponível = direito − gozados − agendados (pode ser 0). */
export function saldoFeriasDias(admissao: string | null, hoje: string, ausencias: AusenciaLite[]): number {
  return Math.max(0, direitoFeriasDias(admissao, hoje) - diasFeriasGozados(ausencias) - diasFeriasAgendados(ausencias))
}
/**
 * Data-limite (período concessivo) do período aquisitivo mais antigo ainda não
 * usufruído. Após essa data o saldo vira PASSIVO (férias vencidas → dobra).
 * Retorna null quando não há saldo devido (em dia).
 */
export function vencimentoFerias(admissao: string | null, hoje: string, ausencias: AusenciaLite[]): string | null {
  if (!admissao) return null
  const completos = periodosAquisitivos(admissao, hoje)
  const gozadosPeriodos = Math.floor(diasFeriasGozados(ausencias) / 30)
  if (completos - gozadosPeriodos <= 0) return null
  // O período não usufruído mais antigo termina (aquisitivo) em:
  const fimAquisitivo = addMonths(admissao, 12 * (gozadosPeriodos + 1))
  // Concessivo = +12 meses: limite legal para conceder sem dobra.
  return addMonths(fimAquisitivo, 12)
}
/** Há férias VENCIDAS (passivo)? Saldo devido cujo concessivo já passou. */
export function feriasVencidas(admissao: string | null, hoje: string, ausencias: AusenciaLite[]): boolean {
  const venc = vencimentoFerias(admissao, hoje, ausencias)
  return !!venc && diffDays(venc, hoje) > 0
}

// ── Validade de documentos / ASO ──────────────────────────────────────────────
export type StatusValidade = 'sem_validade' | 'ok' | 'atencao' | 'critico' | 'vencido'
/** Dias até vencer (negativo = já vencido). null se sem validade. */
export function diasAteVencer(validade: string | null, hoje: string): number | null {
  if (!validade) return null
  return diffDays(hoje, validade)
}
/** Semáforo de validade: vencido <0 ≤ crítico(≤7) ≤ atenção(≤diasAviso) ≤ ok. */
export function statusValidade(validade: string | null, hoje: string, diasAviso = 30): StatusValidade {
  if (!validade) return 'sem_validade'
  const d = diffDays(hoje, validade)
  if (d < 0) return 'vencido'
  if (d <= 7) return 'critico'
  if (d <= diasAviso) return 'atencao'
  return 'ok'
}

// ── Headcount & turnover ──────────────────────────────────────────────────────
export type FuncionarioLite = {
  status: string
  desligado_em?: string | null
  admissao?: string | null
  departamento?: string | null
  contrato?: string | null
  nascimento?: string | null
}
/** Ativo = não desligado e status diferente de 'afastado' opcionalmente. */
export function ativos<T extends FuncionarioLite>(equipe: T[]): T[] {
  return equipe.filter((e) => !e.desligado_em)
}
/** Contagem por chave (departamento, contrato…), ignorando vazios. */
export function contarPor<T>(items: T[], keyFn: (x: T) => string | null | undefined): { chave: string; total: number }[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = keyFn(it)
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([chave, total]) => ({ chave, total })).sort((a, b) => b.total - a.total)
}
/**
 * Turnover do período = desligamentos / headcount médio.
 * headcountMedio = (inicio + fim) / 2 (fórmula clássica). Fração 0..1.
 */
export function turnover(desligados: number, headcountInicio: number, headcountFim: number): number {
  const medio = (num(headcountInicio) + num(headcountFim)) / 2
  if (medio <= 0) return 0
  return round2(num(desligados) / medio)
}
/** Admitidos em [ini, fim] (inclusive). */
export function admitidosNoPeriodo<T extends FuncionarioLite>(equipe: T[], ini: string, fim: string): T[] {
  return equipe.filter((e) => e.admissao && diffDays(ini, e.admissao) >= 0 && diffDays(e.admissao, fim) >= 0)
}
/** Desligados em [ini, fim] (inclusive). */
export function desligadosNoPeriodo<T extends FuncionarioLite>(equipe: T[], ini: string, fim: string): T[] {
  return equipe.filter((e) => e.desligado_em && diffDays(ini, e.desligado_em) >= 0 && diffDays(e.desligado_em, fim) >= 0)
}
/** Aniversariantes de um mês (1..12), a partir de `nascimento` (YYYY-MM-DD). */
export function aniversariantesDoMes<T extends FuncionarioLite>(equipe: T[], mes: number): T[] {
  return equipe.filter((e) => {
    const d = parseYmd(e.nascimento ?? null)
    return d && d.getMonth() + 1 === mes && !e.desligado_em
  })
}

// ── Rescisão (estimativa por motivo) ──────────────────────────────────────────
export type MotivoDesligamento = 'sem_justa_causa' | 'pedido_demissao' | 'justa_causa' | 'acordo' | 'fim_contrato'

export const MOTIVOS_DESLIGAMENTO: { v: MotivoDesligamento; label: string }[] = [
  { v: 'sem_justa_causa', label: 'Dispensa sem justa causa' },
  { v: 'pedido_demissao', label: 'Pedido de demissão' },
  { v: 'acordo', label: 'Acordo (art. 484-A)' },
  { v: 'fim_contrato', label: 'Fim de contrato/experiência' },
  { v: 'justa_causa', label: 'Dispensa por justa causa' },
]

// Política por motivo: o que entra na conta.
type Politica = { avisoFator: number; multaFgts: number; decimo: boolean; feriasProp: boolean; feriasVenc: boolean }
const POLITICAS: Record<MotivoDesligamento, Politica> = {
  sem_justa_causa: { avisoFator: 1, multaFgts: 0.4, decimo: true, feriasProp: true, feriasVenc: true },
  acordo: { avisoFator: 0.5, multaFgts: 0.2, decimo: true, feriasProp: true, feriasVenc: true },
  pedido_demissao: { avisoFator: 0, multaFgts: 0, decimo: true, feriasProp: true, feriasVenc: true },
  fim_contrato: { avisoFator: 0, multaFgts: 0, decimo: true, feriasProp: true, feriasVenc: true },
  justa_causa: { avisoFator: 0, multaFgts: 0, decimo: false, feriasProp: false, feriasVenc: true },
}

export type RescisaoInput = {
  salario: number
  admissao: string
  desligamento: string
  motivo: MotivoDesligamento
  saldoFeriasVencidasDias?: number // dias de períodos vencidos (de saldoFeriasDias)
  fgtsDepositado?: number // saldo de FGTS p/ multa; se ausente, estima 8%×meses×salário
}
export type VerbaRescisoria = { label: string; valor: number }
export type Rescisao = { verbas: VerbaRescisoria[]; total: number; avisoDias: number }

/** Dias de aviso prévio indenizado: 30 + 3 por ano completo, teto 90 (Lei 12.506). */
export function diasAvisoPrevio(admissao: string, desligamento: string): number {
  const anos = Math.floor(diffMesesCompletos(admissao, desligamento) / 12)
  return Math.min(90, 30 + anos * 3)
}

/** Rescisão estimada. Verbas conforme o motivo. NÃO substitui o TRCT do contador. */
export function calcularRescisao(inp: RescisaoInput): Rescisao {
  const salario = num(inp.salario)
  const pol = POLITICAS[inp.motivo] ?? POLITICAS.sem_justa_causa
  const diario = salario / 30
  const verbas: VerbaRescisoria[] = []

  // 1) Saldo de salário (dias trabalhados no mês do desligamento).
  const df = parseYmd(inp.desligamento)!
  const diasNoMes = df.getDate()
  verbas.push({ label: 'Saldo de salário', valor: round2(diario * diasNoMes) })

  // 2) Aviso prévio indenizado.
  const avisoDias = diasAvisoPrevio(inp.admissao, inp.desligamento)
  if (pol.avisoFator > 0) verbas.push({ label: 'Aviso prévio indenizado', valor: round2(diario * avisoDias * pol.avisoFator) })

  // 3) 13º proporcional (avos no ano do desligamento).
  if (pol.decimo) {
    const ano = df.getFullYear()
    const iniAno = `${ano}-01-01`
    const ini = diffDays(inp.admissao, iniAno) >= 0 ? inp.admissao : iniAno
    const m = avos(ini, inp.desligamento)
    if (m > 0) verbas.push({ label: '13º proporcional', valor: round2((salario / 12) * m) })
  }

  // 4) Férias proporcionais + 1/3 (avos do período aquisitivo corrente).
  if (pol.feriasProp) {
    const completos = periodosAquisitivos(inp.admissao, inp.desligamento)
    const inicioPeriodo = addMonths(inp.admissao, 12 * completos)
    const m = Math.min(12, avos(inicioPeriodo, inp.desligamento))
    if (m > 0) verbas.push({ label: 'Férias proporcionais + 1/3', valor: round2((salario / 12) * m * (4 / 3)) })
  }

  // 5) Férias vencidas + 1/3 (passivo já existente).
  if (pol.feriasVenc && num(inp.saldoFeriasVencidasDias) > 0) {
    verbas.push({ label: 'Férias vencidas + 1/3', valor: round2(diario * num(inp.saldoFeriasVencidasDias) * (4 / 3)) })
  }

  // 6) Multa FGTS (sobre o saldo depositado; estima 8% se não informado).
  if (pol.multaFgts > 0) {
    const meses = diffMesesCompletos(inp.admissao, inp.desligamento)
    const fgts = num(inp.fgtsDepositado) > 0 ? num(inp.fgtsDepositado) : round2(salario * 0.08 * meses)
    verbas.push({ label: `Multa FGTS (${Math.round(pol.multaFgts * 100)}%)`, valor: round2(fgts * pol.multaFgts) })
  }

  const total = round2(verbas.reduce((s, v) => s + v.valor, 0))
  return { verbas, total, avisoDias }
}

// ── Recrutamento (Kanban) ─────────────────────────────────────────────────────
export type EtapaCandidato = 'triagem' | 'entrevista' | 'teste' | 'proposta' | 'contratado' | 'reprovado'
export const ETAPAS: { v: EtapaCandidato; label: string }[] = [
  { v: 'triagem', label: 'Triagem' },
  { v: 'entrevista', label: 'Entrevista' },
  { v: 'teste', label: 'Teste' },
  { v: 'proposta', label: 'Proposta' },
  { v: 'contratado', label: 'Contratado' },
  { v: 'reprovado', label: 'Reprovado' },
]
/** Etapas que compõem o funil "ativo" (exclui contratado/reprovado). */
export const ETAPAS_FUNIL: EtapaCandidato[] = ['triagem', 'entrevista', 'teste', 'proposta']
export function proximaEtapa(etapa: EtapaCandidato): EtapaCandidato {
  const i = ETAPAS_FUNIL.indexOf(etapa)
  if (i >= 0 && i < ETAPAS_FUNIL.length - 1) return ETAPAS_FUNIL[i + 1]
  return etapa === 'proposta' ? 'contratado' : etapa
}
/** Taxa de conversão do funil = contratados / total de candidatos (0..1). */
export function taxaConversao(etapasCount: Record<string, number>): number {
  const total = Object.values(etapasCount).reduce((s, n) => s + num(n), 0)
  if (total <= 0) return 0
  return round2(num(etapasCount.contratado) / total)
}
