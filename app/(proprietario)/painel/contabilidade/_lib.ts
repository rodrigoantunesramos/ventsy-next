// Dados, constantes e carga da página /painel/contabilidade.
// A LÓGICA de cálculo vive em lib/contabilidade.ts (engine pura, testada). Aqui
// ficam apenas os tipos de linha do banco, o seed do plano de contas para o
// nicho de locação de eventos, rótulos de UI e a função que busca tudo escopado
// por usuario_id (reaproveitando `lancamentos`/`parcelas`, sem duplicar o cockpit).

import { supabase as sb } from '@/lib/supabase'
import {
  DEFAULT_IMPOSTOS,
  type ConfigImpostos,
  type ContaBancaria,
  type DreLinha,
  type Fechamento,
  type Lancamento,
  type ParcelaProj,
  type PlanoConta,
  type Regime,
  type RegimeTributario,
} from '@/lib/contabilidade'

export type { Regime } from '@/lib/contabilidade'

// ── Tipos de linha (dados da página) ─────────────────────────────────────────
export type CentroCusto = { id: string; usuario_id?: string; nome: string; tipo: string; ref_id: string | null; ativo?: boolean }
export type ExtratoRow = {
  id: string
  conta_bancaria_id: string | null
  data: string
  descricao: string | null
  valor_num: number
  lancamento_id: number | null
  status: 'pendente' | 'conciliado' | 'ignorado'
}
export type Evento = { id: string; nome_evento: string | null; tipo_evento: string | null; propriedade_id: number | null }

export type DadosContabilidade = {
  needsSetup: boolean
  lancamentos: Lancamento[]
  contas: PlanoConta[]
  centros: CentroCusto[]
  bancos: ContaBancaria[]
  parcelas: ParcelaProj[]
  extrato: ExtratoRow[]
  fechamentos: Fechamento[]
  eventos: Evento[]
  configImpostos: ConfigImpostos
  empresaNome: string
}

// ── Rótulos (i18n: extrair quando o painel tiver dicionário) ─────────────────
export const DRE_LABELS: Record<DreLinha, string> = {
  receita_bruta: 'Receita bruta',
  deducoes: 'Deduções e impostos',
  custos_diretos: 'Custos diretos do evento',
  despesas_operacionais: 'Despesas operacionais',
  receitas_financeiras: 'Receitas financeiras',
  despesas_financeiras: 'Despesas financeiras',
  depreciacao: 'Depreciação e amortização',
}
export const DRE_LINHAS: { v: DreLinha; label: string; sinal: 1 | -1 }[] = [
  { v: 'receita_bruta', label: DRE_LABELS.receita_bruta, sinal: 1 },
  { v: 'deducoes', label: DRE_LABELS.deducoes, sinal: -1 },
  { v: 'custos_diretos', label: DRE_LABELS.custos_diretos, sinal: -1 },
  { v: 'despesas_operacionais', label: DRE_LABELS.despesas_operacionais, sinal: -1 },
  { v: 'receitas_financeiras', label: DRE_LABELS.receitas_financeiras, sinal: 1 },
  { v: 'despesas_financeiras', label: DRE_LABELS.despesas_financeiras, sinal: -1 },
  { v: 'depreciacao', label: DRE_LABELS.depreciacao, sinal: -1 },
]
export const CONTA_TIPO_LABEL: Record<string, string> = {
  receita: 'Receita', despesa: 'Despesa', ativo: 'Ativo', passivo: 'Passivo', patrimonio: 'Patrimônio',
}
export const CENTRO_TIPO_LABEL: Record<string, string> = {
  propriedade: 'Propriedade', evento: 'Evento', departamento: 'Departamento', projeto: 'Projeto',
}
export const REGIMES_TRIB: { v: RegimeTributario; label: string }[] = [
  { v: 'mei', label: 'MEI' },
  { v: 'simples', label: 'Simples Nacional' },
  { v: 'presumido', label: 'Lucro Presumido' },
  { v: 'real', label: 'Lucro Real' },
  { v: 'isento', label: 'Pessoa Física / Isento' },
]

export const PALETTE = ['#ff385c', '#10b981', '#f59e0b', '#1a73e8', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#94a3b8']

// Classes de UI repetidas (espelham o design system do contexto-base).
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const btnPrimary = 'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50'
export const btnGhost = 'inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50'

// ── Seed do plano de contas (locação de eventos) ─────────────────────────────
type SeedConta = { codigo: string; nome: string; tipo: PlanoConta['tipo']; dre_linha: DreLinha | null; grupo: string; categoria_legada?: string }
export const SEED_CONTAS: SeedConta[] = [
  // Receitas
  { codigo: '3.1.01', nome: 'Locação de espaço', tipo: 'receita', dre_linha: 'receita_bruta', grupo: 'Receitas', categoria_legada: 'Aluguel de Espaço' },
  { codigo: '3.1.02', nome: 'Pacotes e serviços', tipo: 'receita', dre_linha: 'receita_bruta', grupo: 'Receitas' },
  { codigo: '3.1.03', nome: 'Buffet / Catering (repasse)', tipo: 'receita', dre_linha: 'receita_bruta', grupo: 'Receitas' },
  { codigo: '3.1.04', nome: 'Taxas e adicionais', tipo: 'receita', dre_linha: 'receita_bruta', grupo: 'Receitas' },
  { codigo: '3.2.01', nome: 'Receitas financeiras', tipo: 'receita', dre_linha: 'receitas_financeiras', grupo: 'Resultado financeiro' },
  // Deduções
  { codigo: '4.1.01', nome: 'Impostos sobre vendas', tipo: 'despesa', dre_linha: 'deducoes', grupo: 'Deduções', categoria_legada: 'Impostos' },
  { codigo: '4.1.02', nome: 'Descontos concedidos', tipo: 'despesa', dre_linha: 'deducoes', grupo: 'Deduções' },
  { codigo: '4.1.03', nome: 'Cancelamentos e devoluções', tipo: 'despesa', dre_linha: 'deducoes', grupo: 'Deduções' },
  // Custos diretos
  { codigo: '5.1.01', nome: 'Buffet e alimentação', tipo: 'despesa', dre_linha: 'custos_diretos', grupo: 'Custos diretos', categoria_legada: 'Buffet / Catering' },
  { codigo: '5.1.02', nome: 'Decoração', tipo: 'despesa', dre_linha: 'custos_diretos', grupo: 'Custos diretos', categoria_legada: 'Decoração' },
  { codigo: '5.1.03', nome: 'Som e iluminação', tipo: 'despesa', dre_linha: 'custos_diretos', grupo: 'Custos diretos', categoria_legada: 'Som / Iluminação' },
  { codigo: '5.1.04', nome: 'Equipe do evento (freelas)', tipo: 'despesa', dre_linha: 'custos_diretos', grupo: 'Custos diretos' },
  { codigo: '5.1.05', nome: 'Locações de terceiros', tipo: 'despesa', dre_linha: 'custos_diretos', grupo: 'Custos diretos' },
  // Despesas operacionais
  { codigo: '6.1.01', nome: 'Folha e encargos', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.1.02', nome: 'Pró-labore', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.2.01', nome: 'Aluguel', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.2.02', nome: 'Energia elétrica', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.2.03', nome: 'Água e saneamento', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.2.04', nome: 'Internet e telefonia', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.2.05', nome: 'Manutenção e conservação', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais', categoria_legada: 'Manutenção' },
  { codigo: '6.2.06', nome: 'Limpeza', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais', categoria_legada: 'Limpeza' },
  { codigo: '6.3.01', nome: 'Marketing e publicidade', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais', categoria_legada: 'Marketing' },
  { codigo: '6.3.02', nome: 'Software e assinaturas', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais' },
  { codigo: '6.4.01', nome: 'Despesas administrativas', tipo: 'despesa', dre_linha: 'despesas_operacionais', grupo: 'Despesas operacionais', categoria_legada: 'Outros' },
  { codigo: '6.5.01', nome: 'Despesas financeiras (juros/tarifas)', tipo: 'despesa', dre_linha: 'despesas_financeiras', grupo: 'Resultado financeiro' },
  { codigo: '6.6.01', nome: 'Depreciação e amortização', tipo: 'despesa', dre_linha: 'depreciacao', grupo: 'Resultado financeiro' },
  // Patrimoniais (balancete / balanço)
  { codigo: '1.1.01', nome: 'Caixa e equivalentes', tipo: 'ativo', dre_linha: null, grupo: 'Ativo' },
  { codigo: '1.1.02', nome: 'Contas a receber', tipo: 'ativo', dre_linha: null, grupo: 'Ativo' },
  { codigo: '2.1.01', nome: 'Contas a pagar', tipo: 'passivo', dre_linha: null, grupo: 'Passivo' },
  { codigo: '2.1.02', nome: 'Impostos a recolher', tipo: 'passivo', dre_linha: null, grupo: 'Passivo' },
  { codigo: '2.3.01', nome: 'Capital social', tipo: 'patrimonio', dre_linha: null, grupo: 'Patrimônio líquido' },
]

// ── Períodos ─────────────────────────────────────────────────────────────────
export type PeriodoTipo = 'mes' | 'trimestre' | 'ano'
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Intervalo [ini,fim] de um período ancorado num mês de referência (anchorYmd = 'YYYY-MM-01'). */
export function periodoRange(tipo: PeriodoTipo, anchor: Date): { ini: string; fim: string } {
  const y = anchor.getFullYear(), m = anchor.getMonth()
  if (tipo === 'ano') return { ini: `${y}-01-01`, fim: `${y}-12-31` }
  if (tipo === 'trimestre') {
    const q = Math.floor(m / 3) * 3
    return { ini: ymd(new Date(y, q, 1)), fim: ymd(new Date(y, q + 3, 0)) }
  }
  return { ini: ymd(new Date(y, m, 1)), fim: ymd(new Date(y, m + 1, 0)) }
}
/** Período equivalente anterior (para comparativo horizontal). */
export function periodoAnterior(tipo: PeriodoTipo, anchor: Date): { ini: string; fim: string } {
  const y = anchor.getFullYear(), m = anchor.getMonth()
  if (tipo === 'ano') return periodoRange('ano', new Date(y - 1, 0, 1))
  if (tipo === 'trimestre') return periodoRange('trimestre', new Date(y, m - 3, 1))
  return periodoRange('mes', new Date(y, m - 1, 1))
}

// ── Plano premium (Pro+) ─────────────────────────────────────────────────────
export function isPremium(plano: string | null | undefined): boolean {
  const p = (plano || 'basico').toLowerCase()
  return p === 'pro' || p === 'ultra'
}

// ── Carga ────────────────────────────────────────────────────────────────────
const SETUP_CODES = ['42P01', 'PGRST205']
const num = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0)

function lerConfigImpostos(configFiscal: Record<string, unknown> | null | undefined): ConfigImpostos {
  const cf = configFiscal || {}
  const contabil = (cf.contabil as Partial<ConfigImpostos>) || {}
  const regimeRaw = String(cf.regime || 'simples').toLowerCase()
  const regime = (['mei', 'simples', 'presumido', 'real', 'isento'].includes(regimeRaw) ? regimeRaw : 'simples') as RegimeTributario
  return {
    ...DEFAULT_IMPOSTOS,
    regime,
    iss: cf.iss != null && String(cf.iss) !== '' ? num(cf.iss) : DEFAULT_IMPOSTOS.iss,
    ...contabil,
  }
}

const VAZIO: Omit<DadosContabilidade, 'needsSetup' | 'configImpostos' | 'empresaNome'> = {
  lancamentos: [], contas: [], centros: [], bancos: [], parcelas: [], extrato: [], fechamentos: [], eventos: [],
}

export async function carregarContabilidade(uid: string): Promise<DadosContabilidade> {
  // Sonda: plano_contas existe? (todas as tabelas vêm da mesma migration)
  const probe = await sb.from('plano_contas').select('id').limit(1)
  const cfgRes = await sb.from('empresa_config').select('config_fiscal,razao_social,fantasia').eq('usuario_id', uid).maybeSingle()
  const configImpostos = lerConfigImpostos(cfgRes.data?.config_fiscal as Record<string, unknown> | null | undefined)
  const empresaNome = cfgRes.data?.fantasia || cfgRes.data?.razao_social || 'Ventsy'

  if (probe.error && SETUP_CODES.includes(probe.error.code)) {
    return { needsSetup: true, ...VAZIO, configImpostos, empresaNome }
  }

  const [lancRes, contasRes, centrosRes, bancosRes, parcRes, extratoRes, fechRes, eventosRes] = await Promise.all([
    sb.from('lancamentos')
      .select('id,tipo,categoria,descricao,valor,status,data,competencia,conta_id,centro_custo_id,conta_bancaria_id,conciliado,tipo_evento')
      .eq('usuario_id', uid).order('data', { ascending: false }),
    sb.from('plano_contas').select('id,codigo,nome,tipo,grupo,dre_linha,categoria_legada,ativo').eq('usuario_id', uid).order('codigo'),
    sb.from('centros_custo').select('id,nome,tipo,ref_id,ativo').eq('usuario_id', uid).order('nome'),
    sb.from('contas_bancarias').select('id,nome,banco,tipo,saldo_inicial_num,ativo').eq('usuario_id', uid).order('nome'),
    sb.from('parcelas').select('id,valor,vencimento,status').eq('usuario_id', uid),
    sb.from('conciliacao_extrato').select('id,conta_bancaria_id,data,descricao,valor_num,lancamento_id,status').eq('usuario_id', uid).order('data', { ascending: false }),
    sb.from('fechamentos').select('mes,status').eq('usuario_id', uid),
    sb.from('clientes_eventos').select('id,nome_evento,tipo_evento,propriedade_id').eq('usuario_id', uid),
  ])

  return {
    needsSetup: false,
    configImpostos,
    empresaNome,
    lancamentos: (lancRes.data || []).map((r: Record<string, unknown>) => ({
      ...r, id: Number(r.id), valor: num(r.valor), conciliado: !!r.conciliado,
    })) as Lancamento[],
    contas: (contasRes.data || []) as PlanoConta[],
    centros: (centrosRes.data || []) as CentroCusto[],
    bancos: (bancosRes.data || []).map((r: Record<string, unknown>) => ({ ...r, saldo_inicial_num: num(r.saldo_inicial_num) })) as ContaBancaria[],
    parcelas: (parcRes.data || []).map((r: Record<string, unknown>) => ({ ...r, id: Number(r.id), valor: num(r.valor) })) as ParcelaProj[],
    extrato: (extratoRes.data || []).map((r: Record<string, unknown>) => ({ ...r, valor_num: num(r.valor_num), lancamento_id: r.lancamento_id != null ? Number(r.lancamento_id) : null })) as ExtratoRow[],
    fechamentos: (fechRes.data || []) as Fechamento[],
    eventos: (eventosRes.data || []) as Evento[],
  }
}

/** Persiste a config de impostos dentro de empresa_config.config_fiscal.contabil (sem colidir com a aba Fiscal). */
export async function salvarConfigImpostos(uid: string, cfg: ConfigImpostos): Promise<{ error: unknown }> {
  const cur = await sb.from('empresa_config').select('config_fiscal').eq('usuario_id', uid).maybeSingle()
  const base = (cur.data?.config_fiscal as Record<string, unknown>) || {}
  const config_fiscal = { ...base, regime: cfg.regime, iss: String(cfg.iss), contabil: cfg }
  const { error } = await sb.from('empresa_config').upsert({ usuario_id: uid, config_fiscal }, { onConflict: 'usuario_id' })
  return { error }
}
