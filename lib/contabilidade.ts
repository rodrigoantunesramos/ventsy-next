// Motor contábil PURO e reutilizável da Ventsy.
// SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números crus.
// Determinístico e testável: nada de Date.now() interno — a "data de hoje"
// (projeções, séries) entra por parâmetro (hojeYmd).
//
// Camada contábil sobre o caixa do app. Reaproveita `lancamentos` (caixa
// realizado: receita/despesa) e `parcelas` (a receber) — NÃO os redefine.
// Cobre:
//   • regime caixa × competência (qual data reconhece o fato)
//   • DRE gerencial em cascata (receita→dedução→custo→margem→EBITDA→resultado)
//   • balancete (saldos por conta) e livro-razão (extrato por conta)
//   • fluxo de caixa: posição por conta bancária + projeção 12 meses
//   • conciliação bancária: parse OFX/CSV + matching automático
//   • estimativa de impostos por regime tributário (Simples/Presumido/…)
//   • trava de fechamento mensal (mês fechado = sem edição retroativa)

// ── Tipos do domínio ─────────────────────────────────────────────────────────
export type Regime = 'caixa' | 'competencia'
export type ContaTipo = 'receita' | 'despesa' | 'ativo' | 'passivo' | 'patrimonio'

/** Linhas do DRE gerencial (ordem da cascata). Contas de resultado mapeiam aqui. */
export type DreLinha =
  | 'receita_bruta'
  | 'deducoes'
  | 'custos_diretos'
  | 'despesas_operacionais'
  | 'receitas_financeiras'
  | 'despesas_financeiras'
  | 'depreciacao'

export type PlanoConta = {
  id: string
  codigo: string
  nome: string
  tipo: ContaTipo
  grupo?: string | null
  dre_linha?: DreLinha | null
  categoria_legada?: string | null
  ativo?: boolean | null
}

/** Lançamento de caixa, com as colunas contábeis estendidas (todas opcionais). */
export type Lancamento = {
  id: number
  tipo: 'receita' | 'despesa'
  categoria?: string | null
  descricao?: string | null
  valor: number
  status?: string | null
  data: string // YYYY-MM-DD — data de caixa
  competencia?: string | null // YYYY-MM-DD — fato gerador (regime competência)
  conta_id?: string | null // → plano_contas
  centro_custo_id?: string | null // → centros_custo
  conta_bancaria_id?: string | null // → contas_bancarias
  conciliado?: boolean | null
  tipo_evento?: string | null
}

export type ParcelaProj = {
  id: number
  valor: number
  vencimento?: string | null
  status?: string | null
}

export type ContaBancaria = {
  id: string
  nome: string
  banco?: string | null
  tipo?: string | null
  saldo_inicial_num?: number | null
}

export type Fechamento = { mes: string; status: string } // mes = 'YYYY-MM'

// ── Helpers numéricos / de data (puros) ──────────────────────────────────────
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
/** Arredonda a 2 casas (centavos) evitando lixo de ponto flutuante em somatórios. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
/** Mês (YYYY-MM) de uma data YYYY-MM-DD. */
export function mesDe(dataYmd: string): string {
  return (dataYmd || '').slice(0, 7)
}
function toUTC(ymd: string): number {
  const [y, m, d] = (ymd || '').split('-').map(Number)
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1)
}
/** Diferença em dias entre duas datas YYYY-MM-DD (a − b). Determinístico. */
export function diffDiasYmd(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000)
}
/** Série de meses 'YYYY-MM' a partir de um mês inicial. */
export function serieMeses(inicioMes: string, nMeses: number): string[] {
  const [y, m] = inicioMes.split('-').map(Number)
  return Array.from({ length: nMeses }, (_, i) => {
    const idx = (m - 1) + i
    const yy = y + Math.floor(idx / 12)
    const mm = (idx % 12) + 1
    return `${yy}-${String(mm).padStart(2, '0')}`
  })
}

// ── Regime: reconhecimento de receita/despesa ────────────────────────────────
/** Data em que o lançamento é reconhecido sob o regime escolhido. */
export function dataReconhecimento(l: Lancamento, regime: Regime): string {
  return regime === 'competencia' ? (l.competencia || l.data) : l.data
}
/**
 * No regime de CAIXA só entra o que foi efetivamente pago.
 * No de COMPETÊNCIA entra todo fato gerador (pago ou não), exceto cancelado.
 */
export function entraNoRegime(l: Lancamento, regime: Regime): boolean {
  const st = (l.status || 'pago').toLowerCase()
  if (st === 'cancelado') return false
  if (regime === 'caixa') return st === 'pago'
  return true
}

/** Filtra lançamentos do período sob o regime, com filtro opcional de centro de custo. */
export function lancamentosDoPeriodo(
  lancs: Lancamento[],
  regime: Regime,
  ini: string,
  fim: string,
  centroCustoId?: string | null,
): Lancamento[] {
  return lancs.filter((l) => {
    if (!entraNoRegime(l, regime)) return false
    const d = dataReconhecimento(l, regime)
    if (d < ini || d > fim) return false
    if (centroCustoId && l.centro_custo_id !== centroCustoId) return false
    return true
  })
}

// ── Classificação contábil (conta → linha do DRE) ────────────────────────────
// Fallback para lançamentos legados sem conta_id, pela categoria do financeiro.
const FALLBACK_DESPESA: Record<string, DreLinha> = {
  Impostos: 'deducoes',
  'Buffet / Catering': 'custos_diretos',
  Decoração: 'custos_diretos',
  'Som / Iluminação': 'custos_diretos',
  Manutenção: 'despesas_operacionais',
  Limpeza: 'despesas_operacionais',
  Marketing: 'despesas_operacionais',
  'Aluguel de Espaço': 'despesas_operacionais',
  Outros: 'despesas_operacionais',
}

export function dreLinhaDeCategoria(tipo: 'receita' | 'despesa', categoria?: string | null): DreLinha {
  if (tipo === 'receita') return 'receita_bruta'
  return FALLBACK_DESPESA[categoria || ''] || 'despesas_operacionais'
}

/** Linha do DRE de um lançamento: conta vinculada > tipo da conta > fallback categoria. */
export function dreLinhaDoLancamento(l: Lancamento, contasById: Map<string, PlanoConta>): DreLinha {
  if (l.conta_id) {
    const c = contasById.get(l.conta_id)
    if (c?.dre_linha) return c.dre_linha
    if (c?.tipo === 'receita') return 'receita_bruta'
    if (c?.tipo === 'despesa') return 'despesas_operacionais'
  }
  return dreLinhaDeCategoria(l.tipo, l.categoria)
}

/** Identidade da conta de um lançamento para balancete/razão (conta real ou pseudo-conta da categoria). */
export function contaRefDoLancamento(l: Lancamento): string {
  if (l.conta_id) return l.conta_id
  return `cat:${l.categoria || (l.tipo === 'receita' ? 'Receitas' : 'Despesas')}`
}

// ── DRE gerencial em cascata ─────────────────────────────────────────────────
export type DRE = {
  linhas: Record<DreLinha, number>
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custosDiretos: number
  margemContribuicao: number
  despesasOperacionais: number
  ebitda: number
  receitasFinanceiras: number
  despesasFinanceiras: number
  resultadoFinanceiro: number
  depreciacao: number
  resultadoLiquido: number
  margemLiquida: number
  detalhePorConta: { linha: DreLinha; conta: string; valor: number }[]
}

const DRE_ZERO = (): Record<DreLinha, number> => ({
  receita_bruta: 0,
  deducoes: 0,
  custos_diretos: 0,
  despesas_operacionais: 0,
  receitas_financeiras: 0,
  despesas_financeiras: 0,
  depreciacao: 0,
})

export function montarDRE(
  lancs: Lancamento[],
  contas: PlanoConta[],
  regime: Regime,
  ini: string,
  fim: string,
  centroCustoId?: string | null,
): DRE {
  const contasById = new Map(contas.map((c) => [c.id, c]))
  const periodo = lancamentosDoPeriodo(lancs, regime, ini, fim, centroCustoId)
  const linhas = DRE_ZERO()
  const porConta = new Map<string, { linha: DreLinha; conta: string; valor: number }>()

  for (const l of periodo) {
    const linha = dreLinhaDoLancamento(l, contasById)
    const v = num(l.valor)
    linhas[linha] += v
    const nome = (l.conta_id && contasById.get(l.conta_id)?.nome) || l.categoria || (l.tipo === 'receita' ? 'Receitas' : 'Despesas')
    const key = `${linha}|${nome}`
    const cur = porConta.get(key) || { linha, conta: nome, valor: 0 }
    cur.valor += v
    porConta.set(key, cur)
  }

  const receitaBruta = round2(linhas.receita_bruta)
  const deducoes = round2(linhas.deducoes)
  const receitaLiquida = round2(receitaBruta - deducoes)
  const custosDiretos = round2(linhas.custos_diretos)
  const margemContribuicao = round2(receitaLiquida - custosDiretos)
  const despesasOperacionais = round2(linhas.despesas_operacionais)
  const ebitda = round2(margemContribuicao - despesasOperacionais)
  const receitasFinanceiras = round2(linhas.receitas_financeiras)
  const despesasFinanceiras = round2(linhas.despesas_financeiras)
  const resultadoFinanceiro = round2(receitasFinanceiras - despesasFinanceiras)
  const depreciacao = round2(linhas.depreciacao)
  const resultadoLiquido = round2(ebitda + resultadoFinanceiro - depreciacao)
  const margemLiquida = receitaBruta > 0 ? resultadoLiquido / receitaBruta : 0

  return {
    linhas,
    receitaBruta,
    deducoes,
    receitaLiquida,
    custosDiretos,
    margemContribuicao,
    despesasOperacionais,
    ebitda,
    receitasFinanceiras,
    despesasFinanceiras,
    resultadoFinanceiro,
    depreciacao,
    resultadoLiquido,
    margemLiquida,
    detalhePorConta: [...porConta.values()].sort((a, b) => b.valor - a.valor),
  }
}

// ── Balancete (saldos por conta) ─────────────────────────────────────────────
export type LinhaBalancete = {
  contaId: string
  codigo: string
  conta: string
  tipo: ContaTipo
  grupo: string | null
  debito: number
  credito: number
  saldo: number
}

export function montarBalancete(
  lancs: Lancamento[],
  contas: PlanoConta[],
  regime: Regime,
  ini: string,
  fim: string,
  centroCustoId?: string | null,
): { linhas: LinhaBalancete[]; totalDebito: number; totalCredito: number } {
  const contasById = new Map(contas.map((c) => [c.id, c]))
  const periodo = lancamentosDoPeriodo(lancs, regime, ini, fim, centroCustoId)
  const acc = new Map<string, LinhaBalancete>()

  for (const l of periodo) {
    const ref = contaRefDoLancamento(l)
    const c = l.conta_id ? contasById.get(l.conta_id) : undefined
    const cur =
      acc.get(ref) ||
      ({
        contaId: ref,
        codigo: c?.codigo || '—',
        conta: c?.nome || l.categoria || (l.tipo === 'receita' ? 'Receitas (não classificado)' : 'Despesas (não classificado)'),
        tipo: (c?.tipo as ContaTipo) || l.tipo,
        grupo: c?.grupo ?? null,
        debito: 0,
        credito: 0,
        saldo: 0,
      } as LinhaBalancete)
    const v = num(l.valor)
    // Convenção gerencial: receita credita, despesa debita.
    if (l.tipo === 'receita') cur.credito += v
    else cur.debito += v
    acc.set(ref, cur)
  }

  const linhas = [...acc.values()]
    .map((x) => ({ ...x, debito: round2(x.debito), credito: round2(x.credito), saldo: round2(x.credito - x.debito) }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.conta.localeCompare(b.conta))
  const totalDebito = round2(linhas.reduce((s, x) => s + x.debito, 0))
  const totalCredito = round2(linhas.reduce((s, x) => s + x.credito, 0))
  return { linhas, totalDebito, totalCredito }
}

// ── Livro-razão (extrato cronológico de uma conta) ───────────────────────────
export type LinhaRazao = { id: number; data: string; descricao: string; debito: number; credito: number; saldo: number }

export function livroRazao(
  lancs: Lancamento[],
  contaRef: string,
  regime: Regime,
  ini: string,
  fim: string,
): { linhas: LinhaRazao[]; saldoFinal: number } {
  const periodo = lancamentosDoPeriodo(lancs, regime, ini, fim)
    .filter((l) => contaRefDoLancamento(l) === contaRef)
    .sort((a, b) => dataReconhecimento(a, regime).localeCompare(dataReconhecimento(b, regime)) || a.id - b.id)
  let saldo = 0
  const linhas = periodo.map((l) => {
    const v = num(l.valor)
    const debito = l.tipo === 'despesa' ? v : 0
    const credito = l.tipo === 'receita' ? v : 0
    saldo += credito - debito
    return {
      id: l.id,
      data: dataReconhecimento(l, regime),
      descricao: l.descricao || l.categoria || '—',
      debito: round2(debito),
      credito: round2(credito),
      saldo: round2(saldo),
    }
  })
  return { linhas, saldoFinal: round2(saldo) }
}

// ── Fluxo de caixa: posição por conta bancária + projeção ────────────────────
export type PosicaoConta = {
  contaId: string | null
  nome: string
  saldoInicial: number
  entradas: number
  saidas: number
  saldoAtual: number
  conciliado: number
}

/** Posição de caixa por conta bancária (apenas lançamentos pagos = caixa realizado). */
export function posicaoPorConta(
  contas: ContaBancaria[],
  lancs: Lancamento[],
): { contas: PosicaoConta[]; saldoInicial: number; entradas: number; saidas: number; saldoAtual: number; conciliado: number } {
  const pagos = lancs.filter((l) => (l.status || 'pago').toLowerCase() === 'pago')
  const linhaDe = (contaId: string | null, nome: string, saldoInicial: number): PosicaoConta => {
    const ls = pagos.filter((l) => (l.conta_bancaria_id ?? null) === contaId)
    const entradas = round2(ls.filter((l) => l.tipo === 'receita').reduce((s, l) => s + num(l.valor), 0))
    const saidas = round2(ls.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + num(l.valor), 0))
    const conciliado = round2(
      ls.filter((l) => l.conciliado).reduce((s, l) => s + (l.tipo === 'receita' ? num(l.valor) : -num(l.valor)), 0),
    )
    return { contaId, nome, saldoInicial, entradas, saidas, saldoAtual: round2(saldoInicial + entradas - saidas), conciliado: round2(saldoInicial + conciliado) }
  }

  const linhas = contas.map((c) => linhaDe(c.id, c.nome, num(c.saldo_inicial_num)))
  // Lançamentos pagos sem conta bancária vinculada.
  const semConta = pagos.filter((l) => !l.conta_bancaria_id)
  if (semConta.length) linhas.push(linhaDe(null, 'Sem conta vinculada', 0))

  const sum = (k: keyof Pick<PosicaoConta, 'saldoInicial' | 'entradas' | 'saidas' | 'saldoAtual' | 'conciliado'>) =>
    round2(linhas.reduce((s, x) => s + x[k], 0))
  return {
    contas: linhas,
    saldoInicial: sum('saldoInicial'),
    entradas: sum('entradas'),
    saidas: sum('saidas'),
    saldoAtual: sum('saldoAtual'),
    conciliado: sum('conciliado'),
  }
}

export type FluxoMes = {
  mes: string
  entradaProj: number
  saidaProj: number
  saldoMes: number
  saldoAcum: number
}

function pagaOuCancelada(status?: string | null): boolean {
  const s = (status || '').toLowerCase()
  return s === 'pago' || s === 'cancelado'
}

/** Projeção de fluxo de caixa: parcelas a receber (entradas) e despesas em aberto (saídas). */
export function projecaoFluxo(
  parcelas: ParcelaProj[],
  lancs: Lancamento[],
  hojeMes: string,
  saldoBase: number,
  nMeses = 12,
): FluxoMes[] {
  const meses = serieMeses(hojeMes, nMeses)
  const idx = new Map(meses.map((m, i) => [m, i]))
  const ent = new Array(nMeses).fill(0)
  const sai = new Array(nMeses).fill(0)

  for (const p of parcelas) {
    if (pagaOuCancelada(p.status) || !p.vencimento) continue
    const i = idx.get(mesDe(p.vencimento))
    if (i != null) ent[i] += num(p.valor)
  }
  for (const l of lancs) {
    if (l.tipo !== 'despesa') continue
    if ((l.status || '').toLowerCase() === 'pago') continue
    const i = idx.get(mesDe(l.data))
    if (i != null) sai[i] += num(l.valor)
  }

  let acum = saldoBase
  return meses.map((mes, i) => {
    const entradaProj = round2(ent[i])
    const saidaProj = round2(sai[i])
    const saldoMes = round2(entradaProj - saidaProj)
    acum = round2(acum + saldoMes)
    return { mes, entradaProj, saidaProj, saldoMes, saldoAcum: acum }
  })
}

// ── Conciliação bancária: parse de extrato + matching ────────────────────────
export type ExtratoLinha = { data: string; descricao: string; valor: number } // valor com sinal: + entrada, − saída

function ofxData(raw: string): string {
  const m = (raw || '').match(/(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}
function ofxField(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'))
  return m ? m[1].trim() : ''
}

/** Parser tolerante de OFX (suporta SGML sem tags de fechamento e XML). */
export function parseOFX(text: string): ExtratoLinha[] {
  if (!text) return []
  const parts = text.split(/<STMTTRN>/i).slice(1)
  const out: ExtratoLinha[] = []
  for (const part of parts) {
    const block = part.split(/<\/STMTTRN>/i)[0]
    const data = ofxData(ofxField(block, 'DTPOSTED'))
    const valor = num(ofxField(block, 'TRNAMT'))
    const descricao = (ofxField(block, 'MEMO') || ofxField(block, 'NAME') || ofxField(block, 'TRNTYPE') || '').trim()
    if (!data && !valor) continue
    out.push({ data, descricao, valor: round2(valor) })
  }
  return out
}

function parseValorBR(raw: string): number {
  const s0 = (raw || '').trim()
  // Sinal por marcadores: parênteses, prefixo "-", sufixo "300,50-" ou "D" (débito).
  const neg = /^\(.*\)$/.test(s0) || /^-/.test(s0) || /\d\s*-\s*$/.test(s0) || (/\bD\b/i.test(s0) && !/\bC\b/i.test(s0))
  let s = s0.replace(/[^\d.,]/g, '') // descarta sinais/letras; a magnitude vem do número
  // Decimal BR (1.234,56) → 1234.56 ; decimal US (1,234.56) → 1234.56
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const mag = Math.abs(parseFloat(s) || 0)
  return round2(neg ? -mag : mag)
}
function parseDataFlex(raw: string): string {
  const s = (raw || '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return ''
}

/** Parser tolerante de extrato CSV: detecta delimitador e colunas (data, valor, descrição). */
export function parseCSVExtrato(text: string): ExtratoLinha[] {
  if (!text) return []
  const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!linhas.length) return []
  const delim = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ','
  const out: ExtratoLinha[] = []
  for (const linha of linhas) {
    const cols = linha.split(delim).map((c) => c.replace(/^"|"$/g, '').trim())
    const data = cols.map(parseDataFlex).find(Boolean) || ''
    if (!data) continue // pula cabeçalho / linhas sem data
    // valor = última coluna numérica plausível
    let valor = 0
    for (let i = cols.length - 1; i >= 0; i--) {
      if (cols[i] === data) continue
      if (/\d/.test(cols[i]) && /[.,]\d{2}\b|^\d+$|\d-$|^-\d/.test(cols[i].replace(/\s/g, ''))) {
        const v = parseValorBR(cols[i])
        if (v !== 0) { valor = v; break }
      }
    }
    const descricao = cols.filter((c) => c !== data && parseValorBR(c) === 0).join(' ').trim() || cols.filter((c) => c !== data).join(' ').trim()
    out.push({ data, descricao, valor })
  }
  return out
}

export type MatchConciliacao = { extrato: ExtratoLinha; extratoIdx: number; lancamentoId: number | null; score: number }

/**
 * Casa cada linha do extrato com um lançamento por valor (±centavos), sinal
 * (entrada→receita, saída→despesa) e data próxima (±toleranciaDias). Um
 * lançamento só casa uma vez. score = proximidade da data (1 = mesmo dia).
 */
export function conciliarAuto(
  extrato: ExtratoLinha[],
  lancs: Lancamento[],
  opts: { toleranciaDias?: number; jaUsados?: Iterable<number> } = {},
): MatchConciliacao[] {
  const tol = opts.toleranciaDias ?? 3
  const usados = new Set<number>(opts.jaUsados ?? [])
  return extrato.map((ex, extratoIdx) => {
    const tipoAlvo = ex.valor >= 0 ? 'receita' : 'despesa'
    const alvo = Math.abs(ex.valor)
    let best: { id: number; score: number } | null = null
    for (const l of lancs) {
      if (usados.has(l.id) || l.tipo !== tipoAlvo) continue
      if (Math.abs(num(l.valor) - alvo) > 0.01) continue
      const dd = Math.abs(diffDiasYmd(l.data, ex.data))
      if (dd > tol) continue
      const score = 1 - dd / (tol + 1)
      if (!best || score > best.score) best = { id: l.id, score }
    }
    if (best) usados.add(best.id)
    return { extrato: ex, extratoIdx, lancamentoId: best?.id ?? null, score: round2(best?.score ?? 0) }
  })
}

// ── Impostos (estimativa por regime) ─────────────────────────────────────────
export type RegimeTributario = 'mei' | 'simples' | 'presumido' | 'real' | 'isento'
export type ConfigImpostos = {
  regime: RegimeTributario
  iss: number // % ISS sobre serviço
  aliquotaSimples: number // % alíquota efetiva do Simples
  dasMei: number // R$ fixo mensal do MEI (cru, sem moeda)
  pis: number // %
  cofins: number // %
  irpj: number // %
  csll: number // %
  presumidoBaseIRPJ: number // % presunção p/ IRPJ
  presumidoBaseCSLL: number // % presunção p/ CSLL
}

export const DEFAULT_IMPOSTOS: ConfigImpostos = {
  regime: 'simples',
  iss: 5,
  aliquotaSimples: 6,
  dasMei: 75,
  pis: 0.65,
  cofins: 3,
  irpj: 15,
  csll: 9,
  presumidoBaseIRPJ: 32,
  presumidoBaseCSLL: 32,
}

export type ImpostoLinha = { nome: string; base: number; aliquota: number; valor: number }

/**
 * Estima a carga tributária do período sobre a receita bruta (e o lucro, p/
 * Lucro Real). Valores CRUS — a UI formata via lib/format. Aproximação
 * gerencial; o número fiscal exato depende de anexo/fator-r/créditos.
 */
export function estimarImpostos(
  receitaBruta: number,
  cfg: ConfigImpostos,
  lucro = 0,
): { linhas: ImpostoLinha[]; total: number; aliquotaEfetiva: number } {
  const rb = Math.max(0, num(receitaBruta))
  const pct = (base: number, aliq: number) => round2(base * (num(aliq) / 100))
  const linhas: ImpostoLinha[] = []

  if (cfg.regime === 'isento') {
    // sem tributação estimada
  } else if (cfg.regime === 'mei') {
    linhas.push({ nome: 'DAS-MEI (fixo)', base: 0, aliquota: 0, valor: round2(num(cfg.dasMei)) })
  } else if (cfg.regime === 'simples') {
    linhas.push({ nome: 'Simples Nacional (DAS)', base: rb, aliquota: cfg.aliquotaSimples, valor: pct(rb, cfg.aliquotaSimples) })
  } else if (cfg.regime === 'presumido') {
    linhas.push({ nome: 'ISS', base: rb, aliquota: cfg.iss, valor: pct(rb, cfg.iss) })
    linhas.push({ nome: 'PIS', base: rb, aliquota: cfg.pis, valor: pct(rb, cfg.pis) })
    linhas.push({ nome: 'COFINS', base: rb, aliquota: cfg.cofins, valor: pct(rb, cfg.cofins) })
    const baseIRPJ = round2(rb * (num(cfg.presumidoBaseIRPJ) / 100))
    const baseCSLL = round2(rb * (num(cfg.presumidoBaseCSLL) / 100))
    linhas.push({ nome: 'IRPJ', base: baseIRPJ, aliquota: cfg.irpj, valor: pct(baseIRPJ, cfg.irpj) })
    linhas.push({ nome: 'CSLL', base: baseCSLL, aliquota: cfg.csll, valor: pct(baseCSLL, cfg.csll) })
  } else {
    // Lucro Real (aprox.): tributos sobre faturamento + IRPJ/CSLL sobre o lucro.
    linhas.push({ nome: 'ISS', base: rb, aliquota: cfg.iss, valor: pct(rb, cfg.iss) })
    linhas.push({ nome: 'PIS', base: rb, aliquota: cfg.pis, valor: pct(rb, cfg.pis) })
    linhas.push({ nome: 'COFINS', base: rb, aliquota: cfg.cofins, valor: pct(rb, cfg.cofins) })
    const base = Math.max(0, num(lucro))
    linhas.push({ nome: 'IRPJ', base, aliquota: cfg.irpj, valor: pct(base, cfg.irpj) })
    linhas.push({ nome: 'CSLL', base, aliquota: cfg.csll, valor: pct(base, cfg.csll) })
  }

  const total = round2(linhas.reduce((s, x) => s + x.valor, 0))
  return { linhas, total, aliquotaEfetiva: rb > 0 ? total / rb : 0 }
}

// ── Fechamento mensal ────────────────────────────────────────────────────────
/** O mês (YYYY-MM) está travado para edição? */
export function mesFechado(mes: string, fechamentos: Fechamento[]): boolean {
  return fechamentos.some((f) => f.mes === mes && (f.status || '').toLowerCase() === 'fechado')
}
/** Edição de um lançamento está bloqueada pelo fechamento (sob o regime)? */
export function lancamentoBloqueado(l: Lancamento, regime: Regime, fechamentos: Fechamento[]): boolean {
  return mesFechado(mesDe(dataReconhecimento(l, regime)), fechamentos)
}
