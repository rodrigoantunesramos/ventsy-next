// Motor PURO de Terceiros (custo × retorno) da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Enxerga cada serviço TERCEIRIZADO como um investimento: quanto custa
// (mensal/por evento/percentual/hora) × quanto devolve (receita atribuída,
// eventos atendidos, economia gerada, SLA cumprido, satisfação interna) → ROI /
// índice de valor. A partir disso recomenda a DECISÃO (manter · renegociar ·
// trocar · internalizar), gera alertas (contrato vencendo, custo subindo, SLA
// caindo) e mede o % terceirizado sobre a receita. Complementa o cadastro
// OPERACIONAL de /painel/fornecedores (um terceiro pode apontar para um
// fornecedor) — aqui a visão é GERENCIAL.
//
// Consumido por:
//   • /painel/terceiros  (Carteira · Custo×Retorno · Contratos & SLA · Decisão)
//   • lib/terceiros.test (este motor é testado isoladamente)
//
// Regras de ouro (espelham lib/seguros.ts, lib/licencas.ts, lib/comissoes.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números, datas
//     ('YYYY-MM-DD'), competências ('YYYY-MM') e flags. A formatação
//     (moeda/percentual/locale) fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "hoje" entra SEMPRE por parâmetro (hojeYmd).
//     Nada de relógio/fetch escondido dentro da lógica.
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

// ── Datas e competências (agnósticas de fuso) ────────────────────────────────
function pad2(n: number): string { return String(n).padStart(2, '0') }

/** Data de hoje como 'YYYY-MM-DD' no horário local (helper p/ a UI passar à engine). */
export function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Competência (mês) de hoje como 'YYYY-MM'. */
export function competenciaAtual(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** Dias de `hojeYmd` até `ymd` (negativo = no passado). null se `ymd` ausente/invalida. */
export function diasAte(ymd: string | null | undefined, hojeYmd: string): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null
  const alvo = Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`)
  const hoje = Date.parse(`${hojeYmd.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(alvo) || Number.isNaN(hoje)) return null
  return Math.round((alvo - hoje) / 86_400_000)
}

/** Rótulo técnico de prazo (sem locale): "venceu há 3 dias" / "vence hoje" / "em 12 dias". */
export function diasLabel(dias: number | null): string {
  if (dias == null) return 'Sem prazo'
  if (dias < 0) return `Venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  return `Vence em ${dias} dias`
}

/** 'YYYY-MM' válida? */
export function ehCompetencia(v: string | null | undefined): boolean {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

/** Compara competências 'YYYY-MM' (ordenável lexicograficamente). -1/0/1. */
export function compCompetencia(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Nº de meses (inclusivo) entre duas competências 'YYYY-MM'. null se inválidas. */
export function mesesEntre(de: string, ate: string): number | null {
  if (!ehCompetencia(de) || !ehCompetencia(ate)) return null
  const [ay, am] = de.split('-').map(Number)
  const [by, bm] = ate.split('-').map(Number)
  const diff = (by - ay) * 12 + (bm - am)
  return diff >= 0 ? diff + 1 : null
}

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Como o custo do terceiro é cobrado. */
export type ModeloCusto = 'mensal' | 'por_evento' | 'percentual' | 'hora'

/** Categoria do serviço terceirizado (espelha o CHECK do SQL). */
export type CategoriaTerceiro =
  | 'seguranca' | 'limpeza' | 'contabilidade' | 'marketing' | 'ti'
  | 'manutencao' | 'juridico' | 'buffet' | 'valet' | 'transporte' | 'rh' | 'outro'

/** Estado da relação de terceirização. */
export type StatusTerceiro = 'ativo' | 'em_avaliacao' | 'suspenso' | 'encerrado'

/** Decisão gerencial sugerida. */
export type Decisao = 'manter' | 'renegociar' | 'trocar' | 'internalizar'

/** Nível do semáforo (reusado em SLA, valor e farol da carteira). */
export type Nivel = 'verde' | 'amarelo' | 'vermelho' | 'neutro'

// ── SLA (acordo de nível de serviço) ─────────────────────────────────────────
/** Uma meta de SLA descrita (o que se mede e o alvo textual). */
export type MetaSLA = { nome: string; alvo: string }
/** Bloco de SLA do contrato: alvo agregado (%) + metas descritivas. */
export type SLA = { alvo_pct: number | null; metas: MetaSLA[] }

// ── Tipos das linhas (espelham docs/sql/terceiros.sql) ───────────────────────
export type Terceiro = {
  id: string
  usuario_id?: string
  fornecedor_id: string | null      // → fornecedores (opcional)
  servico: string
  categoria: CategoriaTerceiro | string
  modelo_custo: ModeloCusto | string
  custo_num: number                 // valor UNITÁRIO do modelo (mensal/por evento/%/hora)
  custo_interno_mensal_num: number | null  // estimativa de internalizar (/mês) — p/ comparar
  responsavel: string | null        // responsável interno pela relação
  contrato_id: string | null        // forward-compat (sem FK)
  documento_url: string | null      // contrato no bucket `documentos`
  documento_nome: string | null
  vigencia_inicio: string | null    // 'YYYY-MM-DD'
  vigencia_fim: string | null       // 'YYYY-MM-DD' (null = sem termo)
  renovacao_automatica: boolean
  aviso_previo_dias: number         // antecedência p/ avisar renovação/rescisão
  multa_rescisao: string | null     // cláusula de multa/glosa (texto livre)
  sla: SLA
  status: StatusTerceiro | string
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Medição periódica (uma por competência) do custo × retorno do terceiro. */
export type ResultadoTerceiro = {
  id: string
  usuario_id?: string
  terceiro_id: string
  competencia: string               // 'YYYY-MM'
  custo_num: number                 // custo REALIZADO no mês
  receita_atribuida_num: number     // receita que o terceiro ajudou a gerar
  eventos_atendidos: number
  economia_num: number              // economia/ganho gerado (não-receita)
  sla_cumprido_pct: number | null   // 0..100 (null = não medido)
  satisfacao: number | null         // 1..5 (null = não medido)
  obs: string | null
  criado_em?: string
}

// ── Catálogos (rótulos PT default; i18n: a UI pode reescrever) ────────────────
export type CategoriaMeta = { v: CategoriaTerceiro; label: string; cor: string }
export const CATEGORIAS: CategoriaMeta[] = [
  { v: 'seguranca',     label: 'Segurança',      cor: '#6366f1' },
  { v: 'limpeza',       label: 'Limpeza',        cor: '#14b8a6' },
  { v: 'contabilidade', label: 'Contabilidade',  cor: '#0ea5e9' },
  { v: 'marketing',     label: 'Marketing',      cor: '#ec4899' },
  { v: 'ti',            label: 'TI / Software',  cor: '#8b5cf6' },
  { v: 'manutencao',    label: 'Manutenção',     cor: '#f97316' },
  { v: 'juridico',      label: 'Jurídico',       cor: '#0d9488' },
  { v: 'buffet',        label: 'Buffet / A&B',   cor: '#ff385c' },
  { v: 'valet',         label: 'Valet',          cor: '#64748b' },
  { v: 'transporte',    label: 'Transporte',     cor: '#0284c7' },
  { v: 'rh',            label: 'RH / Pessoal',   cor: '#22c55e' },
  { v: 'outro',         label: 'Outro',          cor: '#94a3b8' },
]
const CAT_BY = Object.fromEntries(CATEGORIAS.map((c) => [c.v, c])) as Record<string, CategoriaMeta>
export function categoriaMeta(v: string | null | undefined): CategoriaMeta {
  return CAT_BY[v || 'outro'] || { v: 'outro', label: v || 'Outro', cor: '#94a3b8' }
}
export const categoriaLabel = (v: string | null | undefined): string => categoriaMeta(v).label
export const categoriaCor = (v: string | null | undefined): string => categoriaMeta(v).cor

export type ModeloMeta = { v: ModeloCusto; label: string; unidade: string; periodico: boolean }
export const MODELOS_CUSTO: ModeloMeta[] = [
  // periodico = o valor já é por mês (não precisa de uso p/ mensalizar).
  { v: 'mensal',     label: 'Mensal (fee fixo)',  unidade: '/mês',     periodico: true },
  { v: 'por_evento', label: 'Por evento',          unidade: '/evento',  periodico: false },
  { v: 'percentual', label: '% da receita',        unidade: '% receita', periodico: false },
  { v: 'hora',       label: 'Por hora',            unidade: '/hora',    periodico: false },
]
const MOD_BY = Object.fromEntries(MODELOS_CUSTO.map((m) => [m.v, m])) as Record<string, ModeloMeta>
export function modeloMeta(v: string | null | undefined): ModeloMeta {
  return MOD_BY[v || 'mensal'] || { v: 'mensal', label: v || 'Mensal', unidade: '/mês', periodico: true }
}
export const modeloLabel = (v: string | null | undefined): string => modeloMeta(v).label
export const modeloUnidade = (v: string | null | undefined): string => modeloMeta(v).unidade

export type StatusMeta = { v: StatusTerceiro; label: string; chip: string; dot: string; ativo: boolean }
export const STATUS_TERCEIRO: StatusMeta[] = [
  { v: 'ativo',        label: 'Ativo',        chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', ativo: true },
  { v: 'em_avaliacao', label: 'Em avaliação', chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   ativo: true },
  { v: 'suspenso',     label: 'Suspenso',     chip: 'bg-orange-50 text-orange-700',   dot: 'bg-orange-500',  ativo: false },
  { v: 'encerrado',    label: 'Encerrado',    chip: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-300',    ativo: false },
]
const STATUS_BY = Object.fromEntries(STATUS_TERCEIRO.map((s) => [s.v, s])) as Record<string, StatusMeta>
export function statusMeta(v: string | null | undefined): StatusMeta {
  return STATUS_BY[v || 'ativo'] || { v: 'ativo', label: v || '—', chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300', ativo: false }
}

export type DecisaoMeta = { v: Decisao; label: string; verbo: string; chip: string; cor: string; nivel: Nivel; severidade: number }
export const DECISOES: DecisaoMeta[] = [
  { v: 'manter',       label: 'Manter',       verbo: 'Manter',       chip: 'bg-emerald-50 text-emerald-700', cor: '#16a34a', nivel: 'verde',    severidade: 0 },
  { v: 'renegociar',   label: 'Renegociar',   verbo: 'Renegociar',   chip: 'bg-amber-50 text-amber-700',     cor: '#d97706', nivel: 'amarelo',  severidade: 1 },
  { v: 'internalizar', label: 'Internalizar', verbo: 'Internalizar', chip: 'bg-violet-50 text-violet-700',   cor: '#7c3aed', nivel: 'amarelo',  severidade: 2 },
  { v: 'trocar',       label: 'Trocar',       verbo: 'Trocar',       chip: 'bg-red-50 text-red-700',         cor: '#dc2626', nivel: 'vermelho', severidade: 3 },
]
const DEC_BY = Object.fromEntries(DECISOES.map((d) => [d.v, d])) as Record<Decisao, DecisaoMeta>
export function decisaoMeta(v: Decisao): DecisaoMeta { return DEC_BY[v] }

// ── Coerção numérica defensiva ───────────────────────────────────────────────
const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const x = Number(v); return Number.isFinite(x) ? x : null
}

// ── Vigência do contrato ─────────────────────────────────────────────────────
export type VigenciaStatus = 'sem_termo' | 'futura' | 'vigente' | 'a_vencer' | 'vencida'
/**
 * Situação do contrato pela vigência. `a_vencer` usa o aviso prévio do contrato
 * (antecedência para renovar/rescindir). Sem `vigencia_fim` = 'sem_termo'.
 */
export function statusVigencia(
  t: Pick<Terceiro, 'vigencia_inicio' | 'vigencia_fim' | 'aviso_previo_dias'>,
  hojeYmd: string,
): VigenciaStatus {
  const iniDias = diasAte(t.vigencia_inicio, hojeYmd)
  const fimDias = diasAte(t.vigencia_fim, hojeYmd)
  if (iniDias != null && iniDias > 0) return 'futura'
  if (t.vigencia_fim == null) return 'sem_termo'
  if (fimDias == null) return 'sem_termo'
  if (fimDias < 0) return 'vencida'
  if (fimDias <= Math.max(0, t.aviso_previo_dias || 0)) return 'a_vencer'
  return 'vigente'
}

// ── Mensalização do custo de contrato (estimativa a partir do modelo) ─────────
/** Uso médio mensal estimado (para converter modelos não-mensais em /mês). */
export type UsoMensal = { eventosMes?: number | null; horasMes?: number | null; receitaMes?: number | null }
/**
 * Converte o custo unitário do modelo em um custo MENSAL estimado:
 *   • mensal     → custo_num
 *   • por_evento → custo_num × eventos/mês
 *   • hora       → custo_num × horas/mês
 *   • percentual → (custo_num/100) × receita/mês
 * Retorna null quando falta o `uso` necessário (a UI mostra "—"/"medir").
 */
export function mensalizarCusto(modelo: string, custoNum: number, uso: UsoMensal = {}): number | null {
  const c = num(custoNum)
  switch (modelo) {
    case 'mensal': return c
    case 'por_evento': return uso.eventosMes == null ? null : c * num(uso.eventosMes)
    case 'hora': return uso.horasMes == null ? null : c * num(uso.horasMes)
    case 'percentual': return uso.receitaMes == null ? null : (c / 100) * num(uso.receitaMes)
    default: return c
  }
}
/** Custo anual estimado = mensal × 12 (null se não dá para mensalizar). */
export function anualizarCusto(modelo: string, custoNum: number, uso: UsoMensal = {}): number | null {
  const m = mensalizarCusto(modelo, custoNum, uso)
  return m == null ? null : m * 12
}

// ── Janela de competências + agregação dos resultados ────────────────────────
/** Resultados ordenados por competência asc, opcionalmente limitados às `meses` mais recentes. */
export function resultadosNaJanela(
  resultados: ResultadoTerceiro[], meses?: number,
): ResultadoTerceiro[] {
  const ord = [...resultados]
    .filter((r) => ehCompetencia(r.competencia))
    .sort((a, b) => compCompetencia(a.competencia, b.competencia))
  if (!meses || meses <= 0 || ord.length <= meses) return ord
  return ord.slice(ord.length - meses)
}

/** Custo REALIZADO somado (truth medido) sobre um conjunto de resultados. */
export function custoRealizado(resultados: ResultadoTerceiro[]): number {
  return resultados.reduce((s, r) => s + num(r.custo_num), 0)
}
/** Retorno = receita atribuída + economia gerada (sobre um conjunto de resultados). */
export function retornoTotal(resultados: ResultadoTerceiro[]): number {
  return resultados.reduce((s, r) => s + num(r.receita_atribuida_num) + num(r.economia_num), 0)
}

/** Índice de valor = retorno ÷ custo (ex.: 3 = devolve 3× o que custa). null sem custo. */
export function indiceValor(retorno: number, custo: number): number | null {
  const c = num(custo)
  if (c <= 0) return null
  return num(retorno) / c
}
/** ROI = (retorno − custo) ÷ custo (ex.: 2 = +200%). null sem custo. */
export function roi(retorno: number, custo: number): number | null {
  const c = num(custo)
  if (c <= 0) return null
  return (num(retorno) - c) / c
}

/** Média (ignora null) de um campo numérico dos resultados. null se nenhum. */
function mediaDe(resultados: ResultadoTerceiro[], campo: 'sla_cumprido_pct' | 'satisfacao'): number | null {
  const vals = resultados.map((r) => r[campo]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!vals.length) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

// ── Tendência de custo ───────────────────────────────────────────────────────
export type Tendencia = { direcao: 'subindo' | 'estavel' | 'caindo'; variacao: number | null }
/**
 * Tendência do custo realizado: compara a média da metade mais recente com a da
 * metade mais antiga das competências. `variacao` é a fração de variação
 * (0.2 = +20%). Precisa de ≥2 competências com custo; senão direcao 'estavel'.
 */
export function tendenciaCusto(resultados: ResultadoTerceiro[]): Tendencia {
  const ord = resultadosNaJanela(resultados).filter((r) => num(r.custo_num) > 0)
  if (ord.length < 2) return { direcao: 'estavel', variacao: null }
  const meio = Math.floor(ord.length / 2)
  const antigos = ord.slice(0, meio)
  const recentes = ord.slice(ord.length - meio)
  const mAntigo = custoRealizado(antigos) / antigos.length
  const mRecente = custoRealizado(recentes) / recentes.length
  if (mAntigo <= 0) return { direcao: 'estavel', variacao: null }
  const variacao = (mRecente - mAntigo) / mAntigo
  const direcao = variacao > 0.05 ? 'subindo' : variacao < -0.05 ? 'caindo' : 'estavel'
  return { direcao, variacao }
}

// ── SLA: alvo, cumprimento e semáforo ────────────────────────────────────────
/** Alvo agregado do SLA (%) declarado no contrato. null se não definido. */
export function slaAlvo(sla: SLA | null | undefined): number | null {
  return sla && sla.alvo_pct != null && Number.isFinite(sla.alvo_pct) ? sla.alvo_pct : null
}
/**
 * Semáforo do SLA: compara o cumprido (%) com o alvo (%). Sem alvo ou sem
 * medição → 'neutro'. ≥ alvo → verde; dentro de 10pp abaixo → amarelo; senão
 * vermelho.
 */
export function slaNivel(cumpridoPct: number | null, alvoPct: number | null): Nivel {
  if (cumpridoPct == null || alvoPct == null) return 'neutro'
  if (cumpridoPct >= alvoPct) return 'verde'
  if (cumpridoPct >= alvoPct - 10) return 'amarelo'
  return 'vermelho'
}

// ── Decisão gerencial (manter/renegociar/trocar/internalizar) ────────────────
export type EntradaDecisao = {
  indiceValor: number | null          // retorno ÷ custo no período
  slaCumpridoPct: number | null
  slaAlvoPct: number | null
  tendencia: Tendencia
  custoMensal: number | null          // custo mensal (medido ou estimado)
  custoInternoMensal: number | null   // estimativa de internalizar (null = sem)
}
export type RecomendacaoDecisao = { decisao: Decisao; motivo: string; severidade: number }
/**
 * Recomenda a decisão a partir de valor (ROI), SLA, tendência de custo e a
 * alternativa de internalizar. Determinístico, em ordem de prioridade. A
 * severidade (0 manter → 3 trocar) ordena o ranking de ação.
 */
export function recomendarDecisao(e: EntradaDecisao): RecomendacaoDecisao {
  const valorRuim = e.indiceValor != null && e.indiceValor < 1          // custa mais do que devolve
  const valorOtimo = e.indiceValor != null && e.indiceValor >= 2
  const slaMedido = e.slaCumpridoPct != null && e.slaAlvoPct != null
  const slaAbaixo = slaMedido && (e.slaCumpridoPct as number) < (e.slaAlvoPct as number)
  const slaCritico = slaMedido && (e.slaCumpridoPct as number) < (e.slaAlvoPct as number) - 15
  const custoSubindo = e.tendencia.direcao === 'subindo' && (e.tendencia.variacao ?? 0) >= 0.1
  const internalizarVantajoso =
    e.custoInternoMensal != null && e.custoMensal != null && e.custoMensal > 0 &&
    e.custoInternoMensal <= e.custoMensal * 0.85

  // 1) Serviço crítico e caro → trocar.
  if (slaCritico && valorRuim) {
    return { decisao: 'trocar', motivo: 'SLA muito abaixo da meta e custo maior que o retorno.', severidade: 3 }
  }
  // 2) Trazer para dentro sai claramente mais barato (e há problema de valor/SLA) → internalizar.
  if (internalizarVantajoso && (valorRuim || slaAbaixo)) {
    return { decisao: 'internalizar', motivo: 'Internalizar custaria menos que o terceirizado atual.', severidade: 2 }
  }
  // 3) Custo em alta → renegociar.
  if (custoSubindo) {
    return { decisao: 'renegociar', motivo: 'Custo em tendência de alta no período.', severidade: 1 }
  }
  // 4) Retorno abaixo do custo → renegociar.
  if (valorRuim) {
    return { decisao: 'renegociar', motivo: 'Retorno medido abaixo do custo.', severidade: 1 }
  }
  // 5) SLA abaixo da meta → renegociar.
  if (slaAbaixo) {
    return { decisao: 'renegociar', motivo: 'SLA abaixo da meta contratada.', severidade: 1 }
  }
  // 6) Tudo dentro do esperado → manter.
  return {
    decisao: 'manter',
    motivo: valorOtimo ? 'Ótimo retorno sobre o custo e SLA em dia.' : 'Dentro do esperado.',
    severidade: 0,
  }
}

// ── Alertas ──────────────────────────────────────────────────────────────────
export type TipoAlerta = 'contrato_vencendo' | 'contrato_vencido' | 'custo_subindo' | 'sla_baixo' | 'valor_baixo' | 'sem_medicao'
export type Alerta = { tipo: TipoAlerta; nivel: Nivel; label: string }
/**
 * Alertas acionáveis de um terceiro. Considera contrato (sem renovação
 * automática), tendência de custo, SLA abaixo da meta, valor < 1 e ausência de
 * medições para calcular ROI.
 */
export function alertasTerceiro(
  t: Pick<Terceiro, 'vigencia_fim' | 'aviso_previo_dias' | 'renovacao_automatica' | 'status'>,
  agg: { indiceValor: number | null; slaCumpridoPct: number | null; slaAlvoPct: number | null; tendencia: Tendencia; temMedicao: boolean },
  hojeYmd: string,
): Alerta[] {
  const out: Alerta[] = []
  const fimDias = diasAte(t.vigencia_fim, hojeYmd)
  const aviso = Math.max(0, t.aviso_previo_dias || 0) || 60
  if (t.status !== 'encerrado' && fimDias != null) {
    if (fimDias < 0 && !t.renovacao_automatica) {
      out.push({ tipo: 'contrato_vencido', nivel: 'vermelho', label: `Contrato vencido há ${Math.abs(fimDias)} dia(s).` })
    } else if (fimDias >= 0 && fimDias <= aviso && !t.renovacao_automatica) {
      out.push({ tipo: 'contrato_vencendo', nivel: 'amarelo', label: `Contrato vence em ${fimDias} dia(s) — decida renovar ou encerrar.` })
    }
  }
  if (agg.tendencia.direcao === 'subindo' && (agg.tendencia.variacao ?? 0) >= 0.1) {
    out.push({ tipo: 'custo_subindo', nivel: 'amarelo', label: 'Custo subindo no período medido.' })
  }
  const slaN = slaNivel(agg.slaCumpridoPct, agg.slaAlvoPct)
  if (slaN === 'vermelho') out.push({ tipo: 'sla_baixo', nivel: 'vermelho', label: 'SLA bem abaixo da meta.' })
  else if (slaN === 'amarelo') out.push({ tipo: 'sla_baixo', nivel: 'amarelo', label: 'SLA abaixo da meta.' })
  if (agg.indiceValor != null && agg.indiceValor < 1) {
    out.push({ tipo: 'valor_baixo', nivel: 'vermelho', label: 'Custa mais do que devolve.' })
  }
  if (!agg.temMedicao && t.status !== 'encerrado') {
    out.push({ tipo: 'sem_medicao', nivel: 'neutro', label: 'Sem medições — registre custo×retorno para avaliar.' })
  }
  return out
}

// ── Agregação de UM terceiro (a peça central, reusada por todas as abas) ──────
export type ContextoAgg = {
  hojeYmd: string
  janelaMeses?: number                // default 12
  uso?: UsoMensal                     // p/ mensalizar modelos não-mensais
  custoRealizadoMensal?: number | null // custo mensal puxado de Contas a pagar (por fornecedor)
  custoInternoMensal?: number | null  // estimativa p/ comparar "internalizar"
}
export type TerceiroAgg = {
  terceiro: Terceiro
  // Período medido:
  meses: number                       // nº de competências com medição na janela
  temMedicao: boolean
  custoMedido: number                 // Σ custo realizado na janela
  retorno: number                     // Σ receita atribuída + economia
  eventos: number                     // Σ eventos atendidos
  // Custo normalizado:
  custoMensalMedido: number | null    // média mensal medida
  custoMensal: number | null          // medido ?? estimado do contrato
  custoAnual: number | null           // custoMensal × 12
  // Valor:
  indiceValor: number | null          // retorno ÷ custoMedido
  roi: number | null                  // (retorno − custoMedido) ÷ custoMedido
  // SLA / satisfação:
  slaCumpridoPct: number | null
  slaAlvoPct: number | null
  slaNivel: Nivel
  satisfacao: number | null
  // Análise:
  tendencia: Tendencia
  vigencia: VigenciaStatus
  recomendacao: RecomendacaoDecisao
  alertas: Alerta[]
}
/** Agrega um terceiro + suas medições num retrato completo (custo, retorno, ROI, SLA, decisão, alertas). */
export function agregarTerceiro(
  terceiro: Terceiro, resultados: ResultadoTerceiro[], ctx: ContextoAgg,
): TerceiroAgg {
  const janela = resultadosNaJanela(resultados, ctx.janelaMeses ?? 12)
  const comCusto = janela.filter((r) => num(r.custo_num) > 0)
  const meses = janela.length
  const temMedicao = meses > 0
  const custoMedido = custoRealizado(janela)
  const retorno = retornoTotal(janela)
  const eventos = janela.reduce((s, r) => s + Math.max(0, Math.round(num(r.eventos_atendidos))), 0)

  const custoMensalMedido = comCusto.length > 0 ? custoMedido / comCusto.length : null
  const custoEstimado = mensalizarCusto(terceiro.modelo_custo, terceiro.custo_num, ctx.uso || {})
  // Prioridade: medição própria → custo realizado de Contas a pagar → estimativa do contrato.
  const custoMensal = custoMensalMedido ?? ctx.custoRealizadoMensal ?? custoEstimado
  const custoAnual = custoMensal == null ? null : custoMensal * 12

  const iv = indiceValor(retorno, custoMedido)
  const r = roi(retorno, custoMedido)
  const slaCumpridoPct = mediaDe(janela, 'sla_cumprido_pct')
  const slaAlvoPct = slaAlvo(terceiro.sla)
  const tendencia = tendenciaCusto(janela)
  const vigencia = statusVigencia(terceiro, ctx.hojeYmd)

  // Estimativa de internalizar: a do contexto (what-if) prevalece; senão a do cadastro.
  const custoInternoMensal = ctx.custoInternoMensal !== undefined ? ctx.custoInternoMensal : (terceiro.custo_interno_mensal_num ?? null)
  const recomendacao = recomendarDecisao({
    indiceValor: iv, slaCumpridoPct, slaAlvoPct, tendencia, custoMensal, custoInternoMensal,
  })
  const alertas = alertasTerceiro(terceiro, { indiceValor: iv, slaCumpridoPct, slaAlvoPct, tendencia, temMedicao }, ctx.hojeYmd)

  return {
    terceiro, meses, temMedicao, custoMedido, retorno, eventos,
    custoMensalMedido, custoMensal, custoAnual,
    indiceValor: iv, roi: r,
    slaCumpridoPct, slaAlvoPct, slaNivel: slaNivel(slaCumpridoPct, slaAlvoPct), satisfacao: mediaDe(janela, 'satisfacao'),
    tendencia, vigencia, recomendacao, alertas,
  }
}

// ── Série de evolução (custo × retorno por competência) p/ o gráfico ─────────
export type PontoEvolucao = { competencia: string; custo: number; retorno: number; roi: number | null; sla: number | null }
export function serieEvolucao(resultados: ResultadoTerceiro[]): PontoEvolucao[] {
  return resultadosNaJanela(resultados).map((r) => {
    const ret = num(r.receita_atribuida_num) + num(r.economia_num)
    return { competencia: r.competencia, custo: num(r.custo_num), retorno: ret, roi: roi(ret, num(r.custo_num)), sla: r.sla_cumprido_pct }
  })
}

// ── Comparação com internalizar ──────────────────────────────────────────────
export type Internalizacao = { economiaMensal: number; favoravel: boolean; fracao: number | null }
/**
 * Compara o custo mensal terceirizado com a estimativa de internalizar.
 * `economiaMensal` > 0 = terceirizar é mais barato (mantém fora). `favoravel`
 * = internalizar compensa (custo interno < terceirizado). `fracao` = quanto o
 * interno representa do terceirizado.
 */
export function compararInternalizar(custoTerceirizadoMensal: number, custoInternoMensal: number): Internalizacao {
  const fora = num(custoTerceirizadoMensal)
  const dentro = num(custoInternoMensal)
  return {
    economiaMensal: fora - dentro,         // positivo = terceirizar economiza
    favoravel: dentro < fora,              // internalizar compensa
    fracao: fora > 0 ? dentro / fora : null,
  }
}

// ── Resumo da carteira (KPIs + por categoria + farol) ────────────────────────
export type ResumoCategoria = { categoria: string; quantidade: number; custoMensal: number }
export type ResumoCarteira = {
  total: number
  ativos: number
  custoMensal: number               // Σ custo mensal (medido ou estimado) dos não-encerrados
  custoAnual: number
  percentualReceita: number | null  // custoMensal ÷ receita mensal de referência
  slaMedio: number | null           // média ponderada simples dos SLA cumpridos
  indiceValorMedio: number | null   // retorno total ÷ custo medido total
  retornoTotal: number
  custoMedidoTotal: number
  porCategoria: ResumoCategoria[]
  decisoes: Record<Decisao, number>
  alertasCriticos: number           // nº de terceiros com alerta vermelho
  farol: Nivel
}
/**
 * Resumo da carteira a partir das agregações já calculadas. Considera apenas os
 * terceiros não-encerrados para custo/% sobre receita. `receitaMensalRef` é a
 * receita mensal de referência (do Financeiro) para o % terceirizado.
 */
export function resumoCarteira(aggs: TerceiroAgg[], receitaMensalRef: number | null): ResumoCarteira {
  const r: ResumoCarteira = {
    total: aggs.length, ativos: 0, custoMensal: 0, custoAnual: 0, percentualReceita: null,
    slaMedio: null, indiceValorMedio: null, retornoTotal: 0, custoMedidoTotal: 0,
    porCategoria: [], decisoes: { manter: 0, renegociar: 0, trocar: 0, internalizar: 0 },
    alertasCriticos: 0, farol: 'verde',
  }
  const porCat = new Map<string, ResumoCategoria>()
  const slas: number[] = []
  for (const a of aggs) {
    const t = a.terceiro
    const encerrado = t.status === 'encerrado'
    if (statusMeta(t.status).ativo) r.ativos++
    r.decisoes[a.recomendacao.decisao]++
    if (a.alertas.some((x) => x.nivel === 'vermelho')) r.alertasCriticos++
    r.retornoTotal += a.retorno
    r.custoMedidoTotal += a.custoMedido
    if (a.slaCumpridoPct != null) slas.push(a.slaCumpridoPct)
    if (!encerrado) {
      const cm = a.custoMensal ?? 0
      r.custoMensal += cm
      const cat = porCat.get(String(t.categoria)) || { categoria: String(t.categoria), quantidade: 0, custoMensal: 0 }
      cat.quantidade++
      cat.custoMensal += cm
      porCat.set(String(t.categoria), cat)
    }
  }
  r.custoAnual = r.custoMensal * 12
  r.percentualReceita = receitaMensalRef && receitaMensalRef > 0 ? r.custoMensal / receitaMensalRef : null
  r.slaMedio = slas.length ? slas.reduce((s, v) => s + v, 0) / slas.length : null
  r.indiceValorMedio = indiceValor(r.retornoTotal, r.custoMedidoTotal)
  r.porCategoria = Array.from(porCat.values()).sort((a, b) => b.custoMensal - a.custoMensal || b.quantidade - a.quantidade)
  r.farol = r.decisoes.trocar > 0 || r.alertasCriticos > 0 ? 'vermelho'
    : (r.decisoes.renegociar > 0 || r.decisoes.internalizar > 0) ? 'amarelo' : 'verde'
  return r
}

/** Ranking de decisão: ação mais urgente primeiro; empate pelo maior custo mensal. */
export function rankearDecisao(aggs: TerceiroAgg[]): TerceiroAgg[] {
  return [...aggs].sort((a, b) =>
    b.recomendacao.severidade - a.recomendacao.severidade ||
    (b.custoMensal ?? 0) - (a.custoMensal ?? 0))
}

/** % terceirizado sobre a receita (helper isolado, p/ KPIs). null sem receita. */
export function percentualSobreReceita(custo: number, receita: number | null): number | null {
  return receita && receita > 0 ? num(custo) / receita : null
}

// ── Normalizadores (coerção defensiva do jsonb / linhas do banco) ─────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizarSla(v: any): SLA {
  const alvo_pct = v && v.alvo_pct != null && Number.isFinite(Number(v.alvo_pct)) ? Number(v.alvo_pct) : null
  const metas = Array.isArray(v?.metas)
    ? v.metas.map((m: any) => ({ nome: String(m?.nome ?? '').trim(), alvo: String(m?.alvo ?? '').trim() })).filter((m: MetaSLA) => m.nome || m.alvo)
    : []
  return { alvo_pct, metas }
}
export function normalizarResultado(r: any): ResultadoTerceiro {
  return {
    id: String(r.id),
    usuario_id: r.usuario_id,
    terceiro_id: String(r.terceiro_id),
    competencia: String(r.competencia ?? ''),
    custo_num: num(r.custo_num),
    receita_atribuida_num: num(r.receita_atribuida_num),
    eventos_atendidos: Math.max(0, Math.round(num(r.eventos_atendidos))),
    economia_num: num(r.economia_num),
    sla_cumprido_pct: numOrNull(r.sla_cumprido_pct),
    satisfacao: numOrNull(r.satisfacao),
    obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined,
  }
}
export function normalizarTerceiro(r: any): Terceiro {
  return {
    id: String(r.id),
    usuario_id: r.usuario_id,
    fornecedor_id: r.fornecedor_id ?? null,
    servico: String(r.servico ?? '').trim() || 'Serviço',
    categoria: r.categoria ?? 'outro',
    modelo_custo: r.modelo_custo ?? 'mensal',
    custo_num: num(r.custo_num),
    custo_interno_mensal_num: numOrNull(r.custo_interno_mensal_num),
    responsavel: r.responsavel ?? null,
    contrato_id: r.contrato_id ?? null,
    documento_url: r.documento_url ?? null,
    documento_nome: r.documento_nome ?? null,
    vigencia_inicio: r.vigencia_inicio ?? null,
    vigencia_fim: r.vigencia_fim ?? null,
    renovacao_automatica: !!r.renovacao_automatica,
    aviso_previo_dias: r.aviso_previo_dias == null ? 30 : Math.max(0, Math.round(num(r.aviso_previo_dias))),
    multa_rescisao: r.multa_rescisao ?? null,
    sla: normalizarSla(r.sla),
    status: r.status ?? 'ativo',
    obs: r.obs ?? null,
    criado_em: r.criado_em ?? undefined,
    atualizado_em: r.atualizado_em ?? undefined,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}
