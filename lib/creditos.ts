// Motor puro da Carteira Ventsy (créditos do cliente). Sem I/O e sem formatação
// de moeda — só números crus e decisões determinísticas (recebe `agora` por
// parâmetro). A UI usa lib/format (formatMoney) com o locale do usuário.
//
// Um crédito é um lançamento no razão (creditos_cliente): valor positivo soma ao
// saldo, negativo (resgate/uso) subtrai. Créditos podem expirar.

export type TipoCredito =
  | 'indicacao'
  | 'boas_vindas'
  | 'cupom'
  | 'reembolso'
  | 'ajuste'
  | 'resgate'

export type LancamentoCredito = {
  id?: string
  tipo?: TipoCredito | string | null
  valor: number | null
  descricao?: string | null
  evento_id?: string | null
  referencia?: string | null
  expira_em?: string | null
  criado_em?: string | null
}

export const TIPO_CREDITO_LABEL: Record<TipoCredito, string> = {
  indicacao: 'Indicação',
  boas_vindas: 'Boas-vindas',
  cupom: 'Cupom',
  reembolso: 'Reembolso',
  ajuste: 'Ajuste',
  resgate: 'Resgate',
}

export function tipoCreditoLabel(tipo?: string | null): string {
  return TIPO_CREDITO_LABEL[(tipo as TipoCredito)] ?? 'Crédito'
}

function parseTs(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Um lançamento ainda é válido (conta no saldo) se não tem expiração ou ela é futura. */
export function creditoValido(l: LancamentoCredito, agora: Date): boolean {
  const exp = parseTs(l.expira_em)
  return !exp || exp.getTime() > agora.getTime()
}

export type ResumoCarteira = {
  saldo: number       // soma dos lançamentos válidos
  totalGanho: number  // soma dos positivos válidos
  totalUsado: number  // soma do |negativos| válidos
  aExpirar: number    // créditos positivos que expiram dentro de `janelaDias`
}

/** Consolida o razão num resumo de carteira. `janelaDias` = janela de "a expirar". */
export function resumoCarteira(
  lancamentos: LancamentoCredito[],
  agora: Date,
  janelaDias = 30,
): ResumoCarteira {
  let saldo = 0
  let totalGanho = 0
  let totalUsado = 0
  let aExpirar = 0
  const limite = agora.getTime() + janelaDias * 86_400_000

  for (const l of lancamentos) {
    if (!creditoValido(l, agora)) continue
    const v = Number(l.valor) || 0
    saldo += v
    if (v > 0) {
      totalGanho += v
      const exp = parseTs(l.expira_em)
      if (exp && exp.getTime() <= limite) aExpirar += v
    } else if (v < 0) {
      totalUsado += -v
    }
  }
  return {
    saldo: round2(saldo),
    totalGanho: round2(totalGanho),
    totalUsado: round2(totalUsado),
    aExpirar: round2(aExpirar),
  }
}

/** Saldo simples (atalho de resumoCarteira). */
export function saldoCreditos(lancamentos: LancamentoCredito[], agora: Date): number {
  return resumoCarteira(lancamentos, agora).saldo
}

/** Pode resgatar `valor` se há saldo suficiente e respeita o mínimo. */
export function podeResgatar(saldo: number, valor: number, minimo = 10): boolean {
  return valor >= minimo && valor <= saldo && valor > 0
}

/** Desconto efetivo de um valor de crédito sobre um total (nunca abaixo de 0). */
export function aplicarCredito(total: number, credito: number): number {
  return round2(Math.max(0, total - Math.max(0, credito)))
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
