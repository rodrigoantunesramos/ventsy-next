// Motor fiscal PURO e reutilizável da Ventsy (Faturamento & Notas Fiscais).
// ─────────────────────────────────────────────────────────────────────────────
// Única fonte de verdade do cálculo de impostos de um documento fiscal
// (NFS-e / NF-e / recibo). Consumido por:
//   • /painel/faturamento        (emissão + painel)
//   • /api/faturamento/emitir     (cálculo AUTORITATIVO no servidor)
//
// Regras de ouro (iguais a lib/pricing.ts e lib/contabilidade.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números crus. Toda a
//     formatação fica em lib/format, chamada por quem consome o resultado.
//   • Determinístico e testável: nada de Date.now() interno.
//   • Config-driven: quais retenções incidem é decisão do dono/contador
//     (vem da config), o motor só aplica corretamente.
//
// Modelo (NFS-e de serviço / locação no Brasil):
//   base de cálculo = valor dos serviços − descontos
//   ISS             = base × alíquota ISS                (devido pelo prestador;
//                     pode ser RETIDO pelo tomador — então abate do líquido)
//   Retenções federais (IRRF/PIS/COFINS/CSLL/INSS): incidem quando o tomador é
//     PJ obrigado a reter; no Simples Nacional normalmente NÃO se aplicam
//     (exceto casos específicos). Por isso são TODAS opcionais (toggle + taxa).
//   valor líquido   = valor de face − (retenções federais + ISS retido)

// ── Vocabulário ──────────────────────────────────────────────────────────────
export type NotaTipo = 'nfse' | 'nfe' | 'recibo'
export type NotaStatus = 'rascunho' | 'emitida' | 'cancelada' | 'erro'
export type RegimeTributario = 'mei' | 'simples' | 'presumido' | 'real' | 'isento'
export type ProvedorFiscal = 'focusnfe' | 'enotas' | 'nfeio' | 'plugnotas' | 'manual'

/** Chaves das retenções que abatem o valor líquido (federais + ISS retido). */
export type RetencaoChave = 'irrf' | 'pis' | 'cofins' | 'csll' | 'inss' | 'iss_retido'

/** Configuração de retenções (toggles + alíquotas em %). Alíquotas têm padrão
 *  legal usual, mas são sobrescrevíveis pela config do dono/contador. */
export type RetencaoConfig = {
  iss_retido?: boolean
  irrf?: boolean
  pis?: boolean
  cofins?: boolean
  csll?: boolean
  inss?: boolean
  aliquota_irrf?: number
  aliquota_pis?: number
  aliquota_cofins?: number
  aliquota_csll?: number
  aliquota_inss?: number
}

/** Alíquotas federais padrão (percentuais) — referência usual; ajustável. */
export const ALIQUOTAS_PADRAO: Required<Pick<RetencaoConfig,
  'aliquota_irrf' | 'aliquota_pis' | 'aliquota_cofins' | 'aliquota_csll' | 'aliquota_inss'>> = {
  aliquota_irrf: 1.5,
  aliquota_pis: 0.65,
  aliquota_cofins: 3,
  aliquota_csll: 1,
  aliquota_inss: 11,
}

// ── Entrada / saída do cálculo ───────────────────────────────────────────────
export type FiscalInput = {
  valorServicos: number
  descontos?: number
  aliquotaIss: number        // % (ex.: 5)
  regime?: RegimeTributario
  retencoes?: RetencaoConfig
}

export type RetencaoLinha = {
  chave: RetencaoChave
  label: string
  aliquota: number           // %
  valor: number              // moeda (número cru)
}

export type ResultadoFiscal = {
  baseCalculo: number        // serviços − descontos (nunca negativo)
  aliquotaIss: number
  iss: number                // ISS devido (independe de ser retido)
  issRetido: number          // ISS que abate o líquido (0 se não retido)
  retencoes: RetencaoLinha[] // linhas que ABATEM o líquido (federais + ISS retido)
  totalRetencoes: number
  valorTotal: number         // valor de face da nota (= baseCalculo)
  valorLiquido: number       // valorTotal − totalRetencoes
}

// ── Helpers numéricos puros ──────────────────────────────────────────────────
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
/** Arredonda em 2 casas (centavos), evitando o erro de ponto-flutuante. */
export function round2(n: number): number {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100
}
const pct = (base: number, aliquota: number): number => round2(base * (num(aliquota) / 100))

/** Rótulo neutro de cada retenção (a UI pode i18n-izar). */
export const RETENCAO_LABEL: Record<RetencaoChave, string> = {
  irrf: 'IRRF',
  pis: 'PIS',
  cofins: 'COFINS',
  csll: 'CSLL',
  inss: 'INSS',
  iss_retido: 'ISS retido',
}

/**
 * Calcula impostos de um documento fiscal de serviço/locação.
 *
 * O Simples Nacional/MEI por padrão NÃO sofre retenção federal (IRRF/PIS/COFINS/
 * CSLL); por isso elas só entram se a config marcar explicitamente. O ISS pode
 * ser retido em qualquer regime (depende do município/tomador) — controlado por
 * `retencoes.iss_retido`. Tudo é, em última instância, dirigido pela config.
 */
export function calcularImpostos(input: FiscalInput): ResultadoFiscal {
  const servicos = Math.max(0, num(input.valorServicos))
  const descontos = Math.max(0, num(input.descontos))
  const baseCalculo = Math.max(0, round2(servicos - descontos))
  const aliquotaIss = num(input.aliquotaIss)
  const r = input.retencoes || {}

  const iss = pct(baseCalculo, aliquotaIss)
  const issRetido = r.iss_retido ? iss : 0

  const linhas: RetencaoLinha[] = []
  const add = (chave: RetencaoChave, on: boolean | undefined, aliquota: number) => {
    if (!on) return
    const valor = chave === 'iss_retido' ? issRetido : pct(baseCalculo, aliquota)
    if (valor <= 0) return
    linhas.push({ chave, label: RETENCAO_LABEL[chave], aliquota, valor })
  }

  // Federais (opcionais — tipicamente fora do Simples; entram só se marcadas).
  add('irrf', r.irrf, r.aliquota_irrf ?? ALIQUOTAS_PADRAO.aliquota_irrf)
  add('pis', r.pis, r.aliquota_pis ?? ALIQUOTAS_PADRAO.aliquota_pis)
  add('cofins', r.cofins, r.aliquota_cofins ?? ALIQUOTAS_PADRAO.aliquota_cofins)
  add('csll', r.csll, r.aliquota_csll ?? ALIQUOTAS_PADRAO.aliquota_csll)
  add('inss', r.inss, r.aliquota_inss ?? ALIQUOTAS_PADRAO.aliquota_inss)
  // ISS retido (qualquer regime — depende do município/tomador).
  add('iss_retido', r.iss_retido, aliquotaIss)

  const totalRetencoes = round2(linhas.reduce((s, l) => s + l.valor, 0))
  const valorTotal = baseCalculo
  const valorLiquido = Math.max(0, round2(valorTotal - totalRetencoes))

  return {
    baseCalculo,
    aliquotaIss,
    iss,
    issRetido,
    retencoes: linhas,
    totalRetencoes,
    valorTotal,
    valorLiquido,
  }
}

// ── Numeração ────────────────────────────────────────────────────────────────
/** Próxima sequência inteira, respeitando o "próximo número" configurado como
 *  piso (ex.: o dono configurou começar em 100). */
export function proximaSequencia(maiorAtual: number, inicioConfigurado?: number): number {
  const piso = Math.max(0, Math.floor(num(inicioConfigurado))) // 0 = sem piso
  const base = Math.max(Math.floor(num(maiorAtual)), piso > 0 ? piso - 1 : 0)
  return base + 1
}

/** Rótulo do número da nota: prefixo + sequência zero-paddeada. Ex.: 'NF-0001'. */
export function formatarNumero(seq: number, prefixo = 'NF-', largura = 4): string {
  const s = String(Math.max(0, Math.floor(num(seq)))).padStart(Math.max(1, largura), '0')
  return `${prefixo || ''}${s}`
}

// ── Catálogo de provedores (metadados — sem segredo) ─────────────────────────
export type ProvedorMeta = {
  v: ProvedorFiscal
  label: string
  site: string
  /** Aceita o adaptador genérico (POST JSON + Bearer no `endpoint`)? */
  generico: boolean
}
export const PROVEDORES: ProvedorMeta[] = [
  { v: 'focusnfe', label: 'Focus NFe', site: 'https://focusnfe.com.br', generico: true },
  { v: 'enotas', label: 'eNotas', site: 'https://enotas.com.br', generico: true },
  { v: 'nfeio', label: 'NFe.io', site: 'https://nfe.io', generico: true },
  { v: 'plugnotas', label: 'PlugNotas', site: 'https://plugnotas.com.br', generico: true },
  { v: 'manual', label: 'Emissão manual (sem provedor)', site: '', generico: false },
]
export const PROVEDOR_BY = Object.fromEntries(PROVEDORES.map((p) => [p.v, p])) as Record<ProvedorFiscal, ProvedorMeta>

// ── Metadados de tipo / status (rótulos + classes de chip) ──────────────────
export const TIPO_LABEL: Record<NotaTipo, string> = {
  nfse: 'NFS-e',
  nfe: 'NF-e',
  recibo: 'Recibo',
}
export const STATUS_META: Record<NotaStatus, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-black/[0.05] text-ink-muted' },
  emitida: { label: 'Emitida', cls: 'bg-emerald-50 text-emerald-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
  erro: { label: 'Erro', cls: 'bg-red-50 text-red-700' },
}

// ── Tabela ainda não criada (migration pendente) ─────────────────────────────
// REST (PostgREST) devolve PGRST205; Postgres cru, 42P01 — tratamos ambos.
export { isMissingTable } from '@/lib/dbErrors'
