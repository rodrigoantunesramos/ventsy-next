// Motor PURO de Saúde, Segurança & Emergência (SST) da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Segurança de PESSOAS num evento: plano de emergência/evacuação/APH/incêndio,
// DIMENSIONAMENTO de recursos por público (ambulância, posto médico, brigadistas,
// bombeiro civil, segurança, extintores, desfibrilador), cobertura vs. exigido
// (faltas bloqueiam a prontidão), EPIs e treinamentos/NRs com validade, simulados
// e indicadores de ocorrências/acidentes. É consumida por:
//   • /painel/sst   (Painel, Planos, Dimensionamento, EPIs & NRs, Simulados, Ocorrências)
//   • /api/sst       (aplica o dimensionamento → recursos exigidos do evento, autoritativo)
//
// Regras de ouro (espelham lib/plano-b.ts, lib/acesso.ts, lib/equipamentos.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings crus.
//     A formatação (data/percentual/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: o "hoje"/"agora" entram por parâmetro. Nada de
//     relógio/aleatoriedade escondidos na lógica.
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.
//
// ⚠️ Os limiares de dimensionamento abaixo são ESTIMATIVAS DE PLANEJAMENTO,
//    configuráveis, inspiradas em práticas usuais (APH por público, brigada por
//    carga/risco — NBR 14276/IT-12, extintores por área — NBR 12693). NÃO
//    substituem a exigência do Corpo de Bombeiros / vigilância / ANVISA do
//    município, que varia por porte e tipo de evento. Servem para PLANEJAR.

export { isMissingTable } from '@/lib/dbErrors'

// ── Datas (puro, agnóstico de fuso) ───────────────────────────────────────────
/** Só a parte 'YYYY-MM-DD' de uma data/timestamp (null se inválida). */
export function diaDe(v: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((v || '').trim())
  return m ? m[1] : null
}
/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (ancorado ao meio-dia p/ evitar DST/UTC off-by-one). */
export function addDiasYMD(ymd: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + Math.round(Number(n) || 0))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Diferença em dias inteiros entre dois 'YYYY-MM-DD' (b − a). null se inválido. */
export function diffDiasYMD(a: string | null | undefined, b: string | null | undefined): number | null {
  const da = diaDe(a), db = diaDe(b)
  if (!da || !db) return null
  const ta = new Date(`${da}T12:00:00`).getTime()
  const tb = new Date(`${db}T12:00:00`).getTime()
  return Math.round((tb - ta) / 86_400_000)
}

// ── Vocabulário do domínio ────────────────────────────────────────────────────
/** Tipo de plano (espelha o CHECK do SQL). */
export type PlanoTipo = 'emergencia' | 'evacuacao' | 'aph' | 'incendio'
/** Estado de um plano de emergência. */
export type PlanoStatus = 'rascunho' | 'vigente' | 'revisao' | 'arquivado'

/** Recurso de segurança/saúde dimensionado por evento. */
export type RecursoTipo =
  | 'ambulancia' | 'uti_movel' | 'posto_medico' | 'medico' | 'enfermeiro' | 'socorrista'
  | 'brigadista' | 'bombeiro_civil' | 'seguranca' | 'extintor' | 'desfibrilador' | 'maca'
/** Estágio de contratação/alocação de um recurso. */
export type RecursoStatus = 'previsto' | 'contratado' | 'confirmado' | 'em_falta' | 'nao_aplicavel'

/** Natureza de uma ocorrência registrada. */
export type OcorrenciaTipo =
  | 'acidente' | 'incidente' | 'mal_estar' | 'queda' | 'incendio' | 'evacuacao'
  | 'briga' | 'furto' | 'intoxicacao' | 'outro'
/** Gravidade da ocorrência (alimenta indicadores e o gatilho de CAT). */
export type Gravidade = 'leve' | 'moderada' | 'grave' | 'fatal'

/** Tipo de simulado/inspeção registrado. */
export type SimuladoTipo = 'evacuacao' | 'incendio' | 'aph' | 'inspecao'

/** Risco de incêndio/carga de incêndio do espaço (dimensiona brigada/extintores). */
export type Risco = 'baixo' | 'medio' | 'alto'

// ── Catálogos (rótulo PT + chip + hex + ícone). i18n: label é o default PT. ────
export type Meta = { label: string; chip: string; hex: string; icone?: string }

export const PLANO_TIPO_META: Record<PlanoTipo, Meta> = {
  emergencia: { label: 'Plano de emergência', chip: 'bg-red-50 text-red-700',       hex: '#ef4444', icone: 'alert' },
  evacuacao:  { label: 'Evacuação',           chip: 'bg-amber-50 text-amber-700',   hex: '#f59e0b', icone: 'exit'  },
  aph:        { label: 'APH / Resgate',       chip: 'bg-rose-50 text-rose-700',     hex: '#e11d48', icone: 'cross' },
  incendio:   { label: 'Combate a incêndio',  chip: 'bg-orange-50 text-orange-700', hex: '#f97316', icone: 'flame' },
}
export function planoTipoMeta(t: string): Meta {
  return PLANO_TIPO_META[t as PlanoTipo] || { label: t || '—', chip: 'bg-slate-100 text-slate-600', hex: '#94a3b8' }
}
export const PLANO_TIPOS: { v: PlanoTipo; label: string }[] =
  (Object.keys(PLANO_TIPO_META) as PlanoTipo[]).map((v) => ({ v, label: PLANO_TIPO_META[v].label }))

export const PLANO_STATUS_META: Record<PlanoStatus, Meta> = {
  rascunho:  { label: 'Rascunho',  chip: 'bg-slate-100 text-slate-600',     hex: '#94a3b8' },
  vigente:   { label: 'Vigente',   chip: 'bg-emerald-50 text-emerald-700',  hex: '#10b981' },
  revisao:   { label: 'Em revisão',chip: 'bg-amber-50 text-amber-700',      hex: '#f59e0b' },
  arquivado: { label: 'Arquivado', chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
}
export function planoStatusMeta(s: string): Meta {
  return PLANO_STATUS_META[s as PlanoStatus] || PLANO_STATUS_META.rascunho
}

/** Metadados de recurso + unidade. `obrigatorioBase` = entra como bloqueante quando exigido. */
export type RecursoMeta = Meta & { unidade: string; grupo: 'saude' | 'incendio' | 'seguranca' }
export const RECURSO_META: Record<RecursoTipo, RecursoMeta> = {
  posto_medico:  { label: 'Posto médico',         unidade: 'posto',   grupo: 'saude',     chip: 'bg-rose-50 text-rose-700',       hex: '#e11d48', icone: 'cross' },
  ambulancia:    { label: 'Ambulância (USB)',     unidade: 'viatura', grupo: 'saude',     chip: 'bg-red-50 text-red-700',         hex: '#ef4444', icone: 'ambulance' },
  uti_movel:     { label: 'UTI móvel (USA)',      unidade: 'viatura', grupo: 'saude',     chip: 'bg-red-100 text-red-800',        hex: '#dc2626', icone: 'ambulance' },
  medico:        { label: 'Médico',               unidade: 'profissional', grupo: 'saude',chip: 'bg-rose-50 text-rose-700',       hex: '#e11d48', icone: 'cross' },
  enfermeiro:    { label: 'Enfermeiro(a)',        unidade: 'profissional', grupo: 'saude',chip: 'bg-pink-50 text-pink-700',       hex: '#db2777', icone: 'cross' },
  socorrista:    { label: 'Socorrista / APH',     unidade: 'profissional', grupo: 'saude',chip: 'bg-rose-50 text-rose-700',       hex: '#f43f5e', icone: 'cross' },
  desfibrilador: { label: 'Desfibrilador (DEA)',  unidade: 'aparelho',grupo: 'saude',     chip: 'bg-sky-50 text-sky-700',         hex: '#0ea5e9', icone: 'heart' },
  maca:          { label: 'Maca',                 unidade: 'unidade', grupo: 'saude',     chip: 'bg-slate-100 text-slate-600',    hex: '#64748b', icone: 'cross' },
  brigadista:    { label: 'Brigadista',           unidade: 'pessoa',  grupo: 'incendio',  chip: 'bg-orange-50 text-orange-700',   hex: '#f97316', icone: 'flame' },
  bombeiro_civil:{ label: 'Bombeiro civil',       unidade: 'pessoa',  grupo: 'incendio',  chip: 'bg-amber-50 text-amber-700',     hex: '#f59e0b', icone: 'flame' },
  extintor:      { label: 'Extintor',             unidade: 'unidade', grupo: 'incendio',  chip: 'bg-red-50 text-red-700',         hex: '#ef4444', icone: 'flame' },
  seguranca:     { label: 'Segurança / controle', unidade: 'pessoa',  grupo: 'seguranca', chip: 'bg-indigo-50 text-indigo-700',   hex: '#4f46e5', icone: 'shield' },
}
export function recursoMeta(t: string): RecursoMeta {
  return RECURSO_META[t as RecursoTipo] || { label: t || '—', unidade: 'un', grupo: 'seguranca', chip: 'bg-slate-100 text-slate-600', hex: '#94a3b8' }
}
export const RECURSO_TIPOS: { v: RecursoTipo; label: string; grupo: RecursoMeta['grupo'] }[] =
  (Object.keys(RECURSO_META) as RecursoTipo[]).map((v) => ({ v, label: RECURSO_META[v].label, grupo: RECURSO_META[v].grupo }))

export const RECURSO_STATUS_META: Record<RecursoStatus, Meta> = {
  previsto:      { label: 'Previsto',       chip: 'bg-slate-100 text-slate-600',    hex: '#94a3b8' },
  contratado:    { label: 'Contratado',     chip: 'bg-sky-50 text-sky-700',         hex: '#0ea5e9' },
  confirmado:    { label: 'Confirmado',     chip: 'bg-emerald-50 text-emerald-700', hex: '#10b981' },
  em_falta:      { label: 'Em falta',       chip: 'bg-red-50 text-red-700',         hex: '#ef4444' },
  nao_aplicavel: { label: 'Não se aplica',  chip: 'bg-gray-100 text-gray-500',      hex: '#9ca3af' },
}
export function recursoStatusMeta(s: string): Meta {
  return RECURSO_STATUS_META[s as RecursoStatus] || RECURSO_STATUS_META.previsto
}
/** Status que contam como recurso GARANTIDO (cobre o exigido). */
export const STATUS_GARANTIDO: RecursoStatus[] = ['contratado', 'confirmado']

export const OCORRENCIA_TIPO_META: Record<OcorrenciaTipo, Meta> = {
  acidente:    { label: 'Acidente',          chip: 'bg-red-50 text-red-700',       hex: '#ef4444' },
  incidente:   { label: 'Incidente',         chip: 'bg-amber-50 text-amber-700',   hex: '#f59e0b' },
  mal_estar:   { label: 'Mal-estar',         chip: 'bg-rose-50 text-rose-700',     hex: '#e11d48' },
  queda:       { label: 'Queda',             chip: 'bg-orange-50 text-orange-700', hex: '#f97316' },
  incendio:    { label: 'Princípio de incêndio', chip: 'bg-orange-50 text-orange-700', hex: '#ea580c' },
  evacuacao:   { label: 'Evacuação',         chip: 'bg-amber-50 text-amber-700',   hex: '#d97706' },
  briga:       { label: 'Briga / tumulto',   chip: 'bg-red-50 text-red-700',       hex: '#dc2626' },
  furto:       { label: 'Furto / roubo',     chip: 'bg-indigo-50 text-indigo-700', hex: '#4f46e5' },
  intoxicacao: { label: 'Intoxicação',       chip: 'bg-lime-50 text-lime-700',     hex: '#65a30d' },
  outro:       { label: 'Outro',             chip: 'bg-slate-100 text-slate-600',  hex: '#64748b' },
}
export function ocorrenciaTipoMeta(t: string): Meta {
  return OCORRENCIA_TIPO_META[t as OcorrenciaTipo] || OCORRENCIA_TIPO_META.outro
}
export const OCORRENCIA_TIPOS: { v: OcorrenciaTipo; label: string }[] =
  (Object.keys(OCORRENCIA_TIPO_META) as OcorrenciaTipo[]).map((v) => ({ v, label: OCORRENCIA_TIPO_META[v].label }))

export type GravidadeMeta = Meta & { peso: number }
export const GRAVIDADE_META: Record<Gravidade, GravidadeMeta> = {
  leve:     { label: 'Leve',     chip: 'bg-emerald-50 text-emerald-700', hex: '#10b981', peso: 1 },
  moderada: { label: 'Moderada', chip: 'bg-amber-50 text-amber-700',     hex: '#f59e0b', peso: 2 },
  grave:    { label: 'Grave',    chip: 'bg-red-50 text-red-700',         hex: '#ef4444', peso: 3 },
  fatal:    { label: 'Fatal',    chip: 'bg-red-100 text-red-800',        hex: '#b91c1c', peso: 4 },
}
export function gravidadeMeta(g: string): GravidadeMeta {
  return GRAVIDADE_META[g as Gravidade] || GRAVIDADE_META.leve
}
export const GRAVIDADES: { v: Gravidade; label: string; peso: number }[] =
  (Object.keys(GRAVIDADE_META) as Gravidade[]).map((v) => ({ v, label: GRAVIDADE_META[v].label, peso: GRAVIDADE_META[v].peso }))
/** Acima desta gravidade, abre CAT (Comunicação de Acidente de Trabalho) por padrão. */
export function exigeCAT(g: string): boolean {
  return gravidadeMeta(g).peso >= GRAVIDADE_META.moderada.peso
}

export const SIMULADO_TIPO_META: Record<SimuladoTipo, Meta> = {
  evacuacao: { label: 'Simulado de evacuação', chip: 'bg-amber-50 text-amber-700',   hex: '#f59e0b', icone: 'exit' },
  incendio:  { label: 'Simulado de incêndio',  chip: 'bg-orange-50 text-orange-700', hex: '#f97316', icone: 'flame' },
  aph:       { label: 'Simulado de APH',       chip: 'bg-rose-50 text-rose-700',     hex: '#e11d48', icone: 'cross' },
  inspecao:  { label: 'Inspeção de segurança', chip: 'bg-sky-50 text-sky-700',       hex: '#0ea5e9', icone: 'check' },
}
export function simuladoTipoMeta(t: string): Meta {
  return SIMULADO_TIPO_META[t as SimuladoTipo] || SIMULADO_TIPO_META.inspecao
}
export const SIMULADO_TIPOS: { v: SimuladoTipo; label: string }[] =
  (Object.keys(SIMULADO_TIPO_META) as SimuladoTipo[]).map((v) => ({ v, label: SIMULADO_TIPO_META[v].label }))

export const RISCO_META: Record<Risco, Meta & { fatorBrigada: number; m2PorExtintor: number }> = {
  baixo: { label: 'Risco baixo', chip: 'bg-emerald-50 text-emerald-700', hex: '#10b981', fatorBrigada: 0.6, m2PorExtintor: 250 },
  medio: { label: 'Risco médio', chip: 'bg-amber-50 text-amber-700',     hex: '#f59e0b', fatorBrigada: 1.0, m2PorExtintor: 200 },
  alto:  { label: 'Risco alto',  chip: 'bg-red-50 text-red-700',         hex: '#ef4444', fatorBrigada: 1.6, m2PorExtintor: 150 },
}
export function riscoMeta(r: string): Meta { return RISCO_META[r as Risco] || RISCO_META.medio }
export const RISCOS: { v: Risco; label: string }[] =
  (Object.keys(RISCO_META) as Risco[]).map((v) => ({ v, label: RISCO_META[v].label }))

// ── Catálogo de NRs / treinamentos obrigatórios (validade típica em meses) ─────
export type NRMeta = { codigo: string; label: string; meses: number }
export const NR_CATALOGO: NRMeta[] = [
  { codigo: 'NR-06',   label: 'EPI — Equipamento de Proteção Individual', meses: 0 },
  { codigo: 'NR-23',   label: 'Proteção contra incêndios',                meses: 12 },
  { codigo: 'brigada', label: 'Brigada de incêndio (NBR 14276)',          meses: 12 },
  { codigo: 'aph',     label: 'Primeiros socorros / APH',                 meses: 24 },
  { codigo: 'NR-35',   label: 'Trabalho em altura',                       meses: 24 },
  { codigo: 'NR-10',   label: 'Segurança em instalações elétricas',       meses: 24 },
  { codigo: 'NR-12',   label: 'Segurança em máquinas e equipamentos',     meses: 24 },
  { codigo: 'NR-33',   label: 'Espaço confinado',                         meses: 12 },
  { codigo: 'NR-20',   label: 'Inflamáveis e combustíveis',               meses: 12 },
  { codigo: 'outro',   label: 'Outro treinamento',                        meses: 0 },
]
const NR_BY = Object.fromEntries(NR_CATALOGO.map((n) => [n.codigo, n])) as Record<string, NRMeta>
export function nrMeta(codigo: string): NRMeta {
  return NR_BY[codigo] || { codigo, label: codigo || '—', meses: 0 }
}

// ── Validade (semáforo reusado por planos, EPIs, treinamentos/NRs) ────────────
export type ValidadeNivel = 'vigente' | 'a_vencer' | 'vencida' | 'sem_validade'
export type ValidadeMeta = { label: string; chip: string; dot: string; hex: string }
export const VALIDADE_META: Record<ValidadeNivel, ValidadeMeta> = {
  vigente:     { label: 'Vigente',     chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', hex: '#10b981' },
  a_vencer:    { label: 'A vencer',    chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   hex: '#f59e0b' },
  vencida:     { label: 'Vencida',     chip: 'bg-red-50 text-red-700',         dot: 'bg-red-500',     hex: '#ef4444' },
  sem_validade:{ label: 'Sem validade',chip: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-300',   hex: '#94a3b8' },
}
export type ValidadeInfo = { nivel: ValidadeNivel; dias: number | null }
/**
 * Classifica uma data de validade vs. `hoje` (ambos 'YYYY-MM-DD'):
 * vencida (≤ hoje), a_vencer (dentro de `avisoDias`), vigente (além), ou
 * sem_validade (sem data). `dias` = dias até vencer (negativo se vencida).
 */
export function validadeStatus(validade: string | null | undefined, hoje: string, avisoDias = 30): ValidadeInfo {
  const v = diaDe(validade)
  if (!v) return { nivel: 'sem_validade', dias: null }
  const dias = diffDiasYMD(hoje, v)
  if (dias == null) return { nivel: 'sem_validade', dias: null }
  if (dias < 0) return { nivel: 'vencida', dias }
  if (dias <= avisoDias) return { nivel: 'a_vencer', dias }
  return { nivel: 'vigente', dias }
}
export function validadeMeta(n: ValidadeNivel): ValidadeMeta { return VALIDADE_META[n] }

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONAMENTO por público — o coração do módulo.
// Público (× área, risco, álcool, palco) → recursos de saúde/incêndio/segurança
// EXIGIDOS. Saída transparente: cada item traz a `base` (de onde veio o número).
// ─────────────────────────────────────────────────────────────────────────────
export type DimensionamentoCtx = {
  publico: number
  areaM2?: number | null
  risco?: Risco
  outdoor?: boolean
  alcool?: boolean          // venda/consumo de bebida → reforço de saúde e segurança
  palco?: boolean           // palco/estrutura/pirotecnia → reforço de incêndio
  duracaoHoras?: number | null
}
export type RecursoExigido = {
  tipo: RecursoTipo
  quantidade: number
  obrigatorio: boolean
  base: string              // explicação curta (PT default; i18n na UI)
}

const teto = (n: number) => Math.max(0, Math.ceil(n))

/**
 * Dimensiona os recursos exigidos para um evento a partir do público (e área/
 * risco/álcool/palco). Retorna só os recursos com quantidade > 0, ordenados por
 * grupo (saúde → incêndio → segurança). ESTIMATIVA de planejamento — ver o aviso
 * no topo do arquivo. Determinístico e puro.
 */
export function dimensionarPorPublico(ctx: DimensionamentoCtx): RecursoExigido[] {
  const pub = Math.max(0, Math.round(Number(ctx.publico) || 0))
  if (pub <= 0) return []
  const risco = (ctx.risco && RISCO_META[ctx.risco]) ? ctx.risco : 'medio'
  const rm = RISCO_META[risco]
  const alcool = !!ctx.alcool
  // Área: usa a informada; senão estima por densidade (~2 pessoas/m²).
  const area = ctx.areaM2 && ctx.areaM2 > 0 ? Math.round(ctx.areaM2) : Math.round(pub / 2)
  const areaEstimada = !(ctx.areaM2 && ctx.areaM2 > 0)

  const out: RecursoExigido[] = []
  const push = (tipo: RecursoTipo, quantidade: number, obrigatorio: boolean, base: string) => {
    if (quantidade > 0) out.push({ tipo, quantidade, obrigatorio, base })
  }

  // ── Saúde / APH ──
  // Posto médico: a partir de 500 pessoas; +1 a cada 10.000.
  if (pub >= 500) push('posto_medico', teto(pub / 10_000), pub >= 1000, `1 posto a cada 10.000 (público ${pub}).`)
  // Ambulância básica (USB): a partir de 1.000; +1 a cada 5.000.
  if (pub >= 1000) push('ambulancia', teto(pub / 5000), true, `1 ambulância (USB) a cada 5.000 (público ${pub}).`)
  // UTI móvel (USA): grandes públicos, a partir de 20.000; +1 a cada 30.000.
  if (pub >= 20_000) push('uti_movel', teto(pub / 30_000), true, `1 UTI móvel a cada 30.000 acima de 20.000 (público ${pub}).`)
  // Médico in loco: a partir de 2.000; +1 a cada 15.000.
  if (pub >= 2000) push('medico', teto(pub / 15_000), pub >= 5000, `1 médico a cada 15.000 (público ${pub}).`)
  // Socorristas / APH: a partir de 500; ~1 a cada 2.000 (mín. 2). Reforço com álcool.
  if (pub >= 500) {
    const baseSoc = Math.max(2, teto(pub / 2000))
    push('socorrista', alcool ? teto(baseSoc * 1.2) : baseSoc, true,
      `~1 socorrista a cada 2.000 (mín. 2)${alcool ? ' +20% por consumo de bebida' : ''}.`)
  }
  // Desfibrilador (DEA): a partir de 1.000; +1 a cada 10.000.
  if (pub >= 1000) push('desfibrilador', teto(pub / 10_000), pub >= 2000, `1 DEA a cada 10.000 (público ${pub}).`)
  // Maca: acompanha a capacidade de atendimento (1 a cada 5.000, mín. 1 desde 500).
  if (pub >= 500) push('maca', Math.max(1, teto(pub / 5000)), false, `1 maca a cada 5.000 (público ${pub}).`)

  // ── Incêndio ──
  // Brigada: proporcional ao público × fator de risco (~1 a cada 250 ajustado), mín. 2.
  const brig = Math.max(2, teto((pub / 250) * rm.fatorBrigada) + (ctx.palco ? 1 : 0))
  push('brigadista', brig, true,
    `~1 brigadista a cada 250 ajustado por ${rm.label.toLowerCase()}${ctx.palco ? ' +1 por palco/estrutura' : ''} (mín. 2).`)
  // Bombeiro civil profissional: a partir de 5.000; +1 a cada 10.000.
  if (pub >= 5000) push('bombeiro_civil', teto(pub / 10_000), pub >= 10_000, `1 bombeiro civil a cada 10.000 (público ${pub}).`)
  // Extintores: por área / fator de risco (mín. 2).
  push('extintor', Math.max(2, teto(area / rm.m2PorExtintor)), true,
    `1 extintor a cada ${rm.m2PorExtintor} m²${areaEstimada ? ' (área estimada pelo público)' : ''} (mín. 2).`)

  // ── Segurança / controle de acesso ──
  // ~1 a cada 250 pessoas (mín. 2); +20% com venda de bebida.
  if (pub >= 250) {
    const seg = Math.max(2, teto(pub / 250))
    push('seguranca', alcool ? teto(seg * 1.2) : seg, pub >= 1000,
      `~1 segurança a cada 250 (mín. 2)${alcool ? ' +20% por consumo de bebida' : ''}.`)
  }

  const ordemGrupo: Record<RecursoMeta['grupo'], number> = { saude: 0, incendio: 1, seguranca: 2 }
  return out.sort((a, b) => ordemGrupo[recursoMeta(a.tipo).grupo] - ordemGrupo[recursoMeta(b.tipo).grupo])
}

// ── Cobertura: exigido (dimensionamento) × alocado (recursos do evento) ────────
/** Linha mínima de recurso do evento que a cobertura lê. */
export type RecursoEventoLite = { tipo: RecursoTipo | string; exigido?: number | null; quantidade?: number | null; status?: string | null }

export type CoberturaItem = {
  tipo: RecursoTipo | string
  exigido: number
  garantido: number          // soma das quantidades com status garantido
  previsto: number           // soma das quantidades com status não garantido (mas planejado)
  falta: number              // max(0, exigido − garantido)
  obrigatorio: boolean
  ratio: number              // garantido/exigido (1 se exigido 0)
  ok: boolean                // garantido ≥ exigido
}
export type Cobertura = {
  itens: CoberturaItem[]
  coberturaPct: number        // fração 0–1 (média ponderada por exigido)
  faltam: CoberturaItem[]     // itens com falta > 0
  obrigatoriosPendentes: CoberturaItem[]   // faltam E obrigatórios → bloqueiam prontidão
}

/**
 * Cruza os recursos EXIGIDOS (do dimensionamento) com os ALOCADOS (linhas do
 * evento). Por tipo: exigido = max(exigido dimensionado, exigido salvo);
 * garantido = soma das quantidades com status garantido (contratado/confirmado).
 * Considera tipos que existem só de um lado (exigido sem alocação, ou recurso
 * extra alocado sem exigência).
 */
export function coberturaRecursos(
  exigidos: { tipo: RecursoTipo | string; quantidade: number; obrigatorio?: boolean }[],
  alocados: RecursoEventoLite[],
): Cobertura {
  const tipos = new Set<string>()
  const exigPorTipo: Record<string, { qtd: number; obrig: boolean }> = {}
  for (const e of exigidos) {
    tipos.add(e.tipo)
    const cur = exigPorTipo[e.tipo] || { qtd: 0, obrig: false }
    exigPorTipo[e.tipo] = { qtd: cur.qtd + Math.max(0, e.quantidade || 0), obrig: cur.obrig || !!e.obrigatorio }
  }
  const garPorTipo: Record<string, number> = {}
  const prevPorTipo: Record<string, number> = {}
  const exigSalvoPorTipo: Record<string, number> = {}
  for (const a of alocados) {
    if (a.status === 'nao_aplicavel') continue
    tipos.add(a.tipo)
    const q = Math.max(0, Number(a.quantidade) || 0)
    if (STATUS_GARANTIDO.includes(a.status as RecursoStatus)) garPorTipo[a.tipo] = (garPorTipo[a.tipo] || 0) + q
    else prevPorTipo[a.tipo] = (prevPorTipo[a.tipo] || 0) + q
    exigSalvoPorTipo[a.tipo] = (exigSalvoPorTipo[a.tipo] || 0) + Math.max(0, Number(a.exigido) || 0)
  }

  const itens: CoberturaItem[] = []
  for (const tipo of tipos) {
    const exigDim = exigPorTipo[tipo]?.qtd || 0
    const exigSalvo = exigSalvoPorTipo[tipo] || 0
    const exigido = Math.max(exigDim, exigSalvo)
    const garantido = garPorTipo[tipo] || 0
    const previsto = prevPorTipo[tipo] || 0
    const falta = Math.max(0, exigido - garantido)
    const obrigatorio = !!exigPorTipo[tipo]?.obrig
    itens.push({
      tipo, exigido, garantido, previsto, falta, obrigatorio,
      ratio: exigido > 0 ? garantido / exigido : 1,
      ok: garantido >= exigido,
    })
  }
  itens.sort((a, b) => {
    if (a.obrigatorio !== b.obrigatorio) return a.obrigatorio ? -1 : 1
    return b.falta - a.falta
  })

  const totExig = itens.reduce((s, i) => s + i.exigido, 0)
  const totGar = itens.reduce((s, i) => s + Math.min(i.garantido, i.exigido), 0)
  return {
    itens,
    coberturaPct: totExig > 0 ? totGar / totExig : 1,
    faltam: itens.filter((i) => i.falta > 0),
    obrigatoriosPendentes: itens.filter((i) => i.falta > 0 && i.obrigatorio),
  }
}

// ── Prontidão do evento (recursos faltantes bloqueiam) ────────────────────────
export type Prontidao = {
  pronto: boolean
  bloqueios: CoberturaItem[]    // obrigatórios pendentes
  avisos: CoberturaItem[]       // não-obrigatórios pendentes
  coberturaPct: number
}
/** O evento está pronto quanto à SST? Bloqueia quando há obrigatório pendente. */
export function prontidaoEvento(cob: Cobertura): Prontidao {
  return {
    pronto: cob.obrigatoriosPendentes.length === 0,
    bloqueios: cob.obrigatoriosPendentes,
    avisos: cob.faltam.filter((i) => !i.obrigatorio),
    coberturaPct: cob.coberturaPct,
  }
}

// ── Indicadores de ocorrências ────────────────────────────────────────────────
export type OcorrenciaLite = { tipo?: string | null; gravidade?: string | null; data?: string | null; cat_emitida?: boolean | null }
export type IndicadoresOcorrencias = {
  total: number
  porGravidade: Record<string, number>
  porTipo: Record<string, number>
  graves: number                 // gravidade ≥ grave
  fatais: number
  catPendentes: number           // exigem CAT mas não emitida
  diasDesdeUltima: number | null // dias desde a ocorrência mais recente (usa nowMs)
  ultimaData: string | null
}
/**
 * Agrega ocorrências em indicadores. `nowMs` (default Date.now) só é usado para
 * "dias desde a última" — passe-o nos testes para determinismo.
 */
export function indicadoresOcorrencias(ocorrencias: OcorrenciaLite[], nowMs: number = Date.now()): IndicadoresOcorrencias {
  const porGravidade: Record<string, number> = {}
  const porTipo: Record<string, number> = {}
  let graves = 0, fatais = 0, catPendentes = 0
  let ultimaMs = -Infinity, ultimaData: string | null = null
  for (const o of ocorrencias) {
    const g = o.gravidade || 'leve'
    const t = o.tipo || 'outro'
    porGravidade[g] = (porGravidade[g] || 0) + 1
    porTipo[t] = (porTipo[t] || 0) + 1
    const peso = gravidadeMeta(g).peso
    if (peso >= GRAVIDADE_META.grave.peso) graves++
    if (peso >= GRAVIDADE_META.fatal.peso) fatais++
    if (exigeCAT(g) && !o.cat_emitida) catPendentes++
    const ms = o.data ? Date.parse(o.data) : NaN
    if (!Number.isNaN(ms) && ms > ultimaMs) { ultimaMs = ms; ultimaData = o.data || null }
  }
  const diasDesdeUltima = ultimaMs > -Infinity ? Math.max(0, Math.floor((nowMs - ultimaMs) / 86_400_000)) : null
  return { total: ocorrencias.length, porGravidade, porTipo, graves, fatais, catPendentes, diasDesdeUltima, ultimaData }
}

// ── Semáforo geral de SST (combina prontidão + ocorrências + validades) ───────
export type NivelSST = 'ok' | 'atencao' | 'critico'
export type NivelMeta = { label: string; chip: string; dot: string; ring: string; hex: string; peso: number }
export const NIVEL_SST_META: Record<NivelSST, NivelMeta> = {
  ok:      { label: 'Sob controle', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50', hex: '#10b981', peso: 1 },
  atencao: { label: 'Atenção',      chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   ring: 'border-amber-200 bg-amber-50',     hex: '#f59e0b', peso: 2 },
  critico: { label: 'Crítico',      chip: 'bg-red-50 text-red-700',         dot: 'bg-red-500',     ring: 'border-red-200 bg-red-50',         hex: '#ef4444', peso: 3 },
}
export function nivelSSTMeta(n: NivelSST): NivelMeta { return NIVEL_SST_META[n] }
export type SinaisSST = {
  obrigatoriosPendentes?: number
  ocorrenciasGraves?: number
  validadesVencidas?: number
  validadesAVencer?: number
  catPendentes?: number
}
/** Pior nível entre os sinais — alimenta o banner do Painel. */
export function nivelGeralSST(s: SinaisSST): NivelSST {
  if ((s.obrigatoriosPendentes || 0) > 0 || (s.ocorrenciasGraves || 0) > 0 || (s.validadesVencidas || 0) > 0 || (s.catPendentes || 0) > 0) {
    return 'critico'
  }
  if ((s.validadesAVencer || 0) > 0) return 'atencao'
  return 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES de plano de emergência — geram um `conteudo` jsonb base por tipo.
// O usuário edita rotas/pontos no Editor; aqui entregamos uma espinha pronta com
// procedimentos e contatos de emergência (SAMU 192, Bombeiros 193, Polícia 190).
// ─────────────────────────────────────────────────────────────────────────────
export type Contato = { nome: string; telefone: string }
export type PlanoConteudo = {
  rotas: string[]                 // rotas de fuga (descrição/legenda; o mapa fino vem de Layouts)
  pontos_encontro: string[]       // pontos de encontro seguros
  recursos: string[]              // recursos do plano (extintores, hidrantes, saídas)
  procedimentos: string[]         // passo-a-passo do acionamento
  contatos: Contato[]             // telefones de emergência
}
/** Contatos de emergência padrão do Brasil (a UI pode adicionar locais). */
export const CONTATOS_EMERGENCIA: Contato[] = [
  { nome: 'SAMU', telefone: '192' },
  { nome: 'Corpo de Bombeiros', telefone: '193' },
  { nome: 'Polícia Militar', telefone: '190' },
  { nome: 'Defesa Civil', telefone: '199' },
]
const PROCEDIMENTOS: Record<PlanoTipo, string[]> = {
  emergencia: [
    'Identificar a emergência e acionar o responsável de segurança (coordenador).',
    'Avaliar a necessidade de evacuação parcial ou total.',
    'Acionar a brigada e os serviços externos (SAMU/Bombeiros) se necessário.',
    'Comunicar o público com mensagem calma e objetiva pelo som/telões.',
    'Registrar a ocorrência e preservar a área até a liberação.',
  ],
  evacuacao: [
    'Acionar o alarme de evacuação e interromper apresentações/atividades.',
    'Brigadistas assumem as rotas de fuga e liberam as saídas de emergência.',
    'Conduzir o público aos pontos de encontro pela rota mais próxima e segura.',
    'Priorizar pessoas com mobilidade reduzida (PcD, idosos, crianças).',
    'Conferir a evacuação por setor e reportar ao coordenador (cabeça de pista).',
  ],
  aph: [
    'Isolar e avaliar a cena (segurança do socorrista primeiro).',
    'Acionar o posto médico / ambulância e o SAMU (192) se for grave.',
    'Prestar primeiros socorros conforme protocolo (SBV, uso de DEA se indicado).',
    'Encaminhar/transportar a vítima e comunicar a família quando aplicável.',
    'Registrar o atendimento e avaliar emissão de CAT.',
  ],
  incendio: [
    'Acionar o alarme e o Corpo de Bombeiros (193).',
    'Brigada combate o princípio de incêndio com extintor adequado (se seguro).',
    'Cortar energia/gás do setor afetado, se possível.',
    'Iniciar evacuação pelas rotas de fuga em direção aos pontos de encontro.',
    'Receber e orientar o Corpo de Bombeiros na chegada.',
  ],
}
/** Espinha de conteúdo para um plano do tipo informado (o usuário detalha depois). */
export function gerarConteudoPlano(tipo: PlanoTipo): PlanoConteudo {
  return {
    rotas: [],
    pontos_encontro: [],
    recursos: [],
    procedimentos: [...(PROCEDIMENTOS[tipo] || PROCEDIMENTOS.emergencia)],
    contatos: CONTATOS_EMERGENCIA.map((c) => ({ ...c })),
  }
}
/** Normaliza um `conteudo` jsonb cru do banco para o shape seguro (defensivo). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizarConteudo(raw: any): PlanoConteudo {
  const arrStr = (v: any): string[] => Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []
  const contatos: Contato[] = Array.isArray(raw?.contatos)
    ? raw.contatos.filter((c: any) => c && (c.nome || c.telefone)).map((c: any) => ({ nome: String(c.nome || '').trim(), telefone: String(c.telefone || '').trim() }))
    : []
  return {
    rotas: arrStr(raw?.rotas),
    pontos_encontro: arrStr(raw?.pontos_encontro),
    recursos: arrStr(raw?.recursos),
    procedimentos: arrStr(raw?.procedimentos),
    contatos,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Completude de um plano (0–1) — quão preenchido está (p/ barra de progresso). */
export function completudePlano(c: PlanoConteudo): number {
  const checks = [c.rotas.length > 0, c.pontos_encontro.length > 0, c.recursos.length > 0, c.procedimentos.length > 0, c.contatos.length > 0]
  return checks.filter(Boolean).length / checks.length
}
