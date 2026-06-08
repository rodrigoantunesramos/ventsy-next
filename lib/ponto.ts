// Motor PURO de Ponto & Escala da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para o trabalho de PESSOAS em eventos: escalar turnos
// por função, registrar ponto (entrada/saída), apurar horas/extras/adicional
// noturno/atraso, banco de horas e o CUSTO DE MÃO DE OBRA por evento (que entra
// no custo direto do evento). Cobre fixos (tabela `equipe`) e freelancers
// (tabela `freelancers`). É consumido por:
//   • /painel/ponto      (escala, convocação, ponto, apuração, painel)
//   • /api/ponto         (alocação AUTORITATIVA: bloqueia super-alocação por vaga)
//
// Regras de ouro (espelham lib/equipamentos.ts, lib/reservas.ts, lib/estoque.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/minutos crus. A
//     formatação (moeda/locale) fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora"/datas entram por parâmetro. Nada de
//     relógio escondido dentro da lógica.

// ── Tempo (puro) ─────────────────────────────────────────────────────────────
export const MINUTO = 60_000
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA
/** Jornada-base mensal usada para derivar custo/hora de salário fixo (CLT BR). */
export const JORNADA_MENSAL_H = 220
/** Janela do adicional noturno (CLT): 22:00 → 05:00 (em minutos do dia). */
export const NOTURNO_INICIO_MIN = 22 * 60
export const NOTURNO_FIM_MIN = 5 * 60

/** 'HH:MM' → minutos desde a meia-noite. Tolerante a lixo (→ 0). */
export function hhmmToMin(hhmm: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!m) return 0
  return Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2]))
}
/** minutos → 'HH:MM' (não é formatação de locale — é um rótulo técnico de duração). */
export function minToHHMM(min: number): string {
  const t = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(t / 60)
  return `${String(h).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
/** Horas decimais a partir de minutos (ex.: 90 → 1.5). Para custo/relatório. */
export function minToHoras(min: number): number {
  return (Number(min) || 0) / 60
}
/** ISO/timestamptz ou 'YYYY-MM-DDTHH:MM' → ms epoch; null se inválido. */
export function parseTs(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

/**
 * Minutos trabalhados entre entrada e saída (em ms). Se a saída for menor ou
 * igual à entrada — caso de turno que VIRA A NOITE registrado só com hora —,
 * assume +1 dia. Quando ambos têm data completa (timestamptz) isso não dispara.
 */
export function minutosTrabalhados(entradaMs: number, saidaMs: number): number {
  if (!Number.isFinite(entradaMs) || !Number.isFinite(saidaMs)) return 0
  let dur = saidaMs - entradaMs
  if (dur <= 0) dur += DIA
  return Math.round(dur / MINUTO)
}

/**
 * Minutos do intervalo [entrada, saída) que caem na JANELA NOTURNA recorrente
 * (22:00 → 05:00 por padrão, atravessando a meia-noite). Resolve por interseção
 * com cada janela noturna diária que toca o turno — funciona para turnos que
 * viram a noite e para plantões longos. Datas ancoradas ao dia LOCAL (espelha
 * startOfDayLocal do resto do app).
 */
export function minutosNoturnos(
  entradaMs: number,
  saidaMs: number,
  opts: { inicioMin?: number; fimMin?: number } = {},
): number {
  if (!(saidaMs > entradaMs)) return 0
  const ini = opts.inicioMin ?? NOTURNO_INICIO_MIN
  const fim = opts.fimMin ?? NOTURNO_FIM_MIN
  // Duração de uma janela 22:00→05:00 (do dia seguinte): (24h−22h)+5h = 7h.
  const janelaLen = (24 * 60 - ini) + fim
  const d0 = new Date(entradaMs)
  d0.setHours(0, 0, 0, 0)
  const diaZero = d0.getTime()
  const spanDias = Math.ceil((saidaMs - entradaMs) / DIA) + 2
  let total = 0
  for (let k = -1; k <= spanDias; k++) {
    const ws = diaZero + k * DIA + ini * MINUTO
    const we = ws + janelaLen * MINUTO
    const ov = Math.min(saidaMs, we) - Math.max(entradaMs, ws)
    if (ov > 0) total += ov
  }
  return Math.round(total / MINUTO)
}

export type RegistroCalc = {
  trabalhadoMin: number // líquido (já descontado o intervalo)
  extrasMin: number     // acima da jornada do turno
  noturnoMin: number    // dentro da janela noturna (bruto)
  atrasoMin: number     // atraso vs. previsto (além da tolerância)
  saldoMin: number      // trabalhado − jornada (alimenta o banco de horas; pode ser < 0)
}
/**
 * Apura um registro de ponto a partir dos instantes de entrada/saída e da
 * configuração do turno. Tudo em minutos, determinístico. É o que a /api/ponto
 * grava em `ponto_registros` (e o que a UI exibe).
 */
export function calcularRegistro(input: {
  entradaMs: number
  saidaMs: number | null
  intervaloMin?: number
  jornadaMin?: number
  previstoInicioMs?: number | null
  toleranciaAtrasoMin?: number
}): RegistroCalc {
  const jornadaMin = Math.max(0, input.jornadaMin ?? 0)
  const intervaloMin = Math.max(0, input.intervaloMin ?? 0)
  const tol = Math.max(0, input.toleranciaAtrasoMin ?? 0)

  if (input.saidaMs == null) {
    // Ponto ainda aberto (só check-in): só dá para medir o atraso.
    const atrasoMin = input.previstoInicioMs != null
      ? Math.max(0, Math.round((input.entradaMs - input.previstoInicioMs) / MINUTO) - tol)
      : 0
    return { trabalhadoMin: 0, extrasMin: 0, noturnoMin: 0, atrasoMin, saldoMin: 0 }
  }

  const bruto = minutosTrabalhados(input.entradaMs, input.saidaMs)
  const trabalhadoMin = Math.max(0, bruto - intervaloMin)
  const extrasMin = jornadaMin > 0 ? Math.max(0, trabalhadoMin - jornadaMin) : 0
  const noturnoMin = minutosNoturnos(input.entradaMs, input.saidaMs)
  const atrasoMin = input.previstoInicioMs != null
    ? Math.max(0, Math.round((input.entradaMs - input.previstoInicioMs) / MINUTO) - tol)
    : 0
  const saldoMin = jornadaMin > 0 ? trabalhadoMin - jornadaMin : 0
  return { trabalhadoMin, extrasMin, noturnoMin, atrasoMin, saldoMin }
}

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Função exercida no evento (espelha o CHECK de docs/sql/ponto.sql). */
export type FuncaoEvento =
  | 'garcom' | 'seguranca' | 'recepcao' | 'montador' | 'manobrista'
  | 'brigadista' | 'limpeza' | 'coordenacao' | 'cozinha' | 'bar' | 'dj' | 'outro'

/** Status do ciclo de uma alocação (convocar → confirmar → presença). */
export type AlocStatus = 'convocado' | 'confirmado' | 'presente' | 'falta' | 'cancelado'

/** Status de uma escala (a necessidade de vagas de um turno/função). */
export type EscalaStatus = 'planejada' | 'publicada' | 'concluida' | 'cancelada'

/** Turno do dia (janela-padrão editável por alocação). */
export type Turno = 'manha' | 'tarde' | 'noite' | 'madrugada' | 'integral'

/** Origem do registro de ponto. */
export type PontoOrigem = 'app' | 'qr' | 'manual' | 'biometria'

// ── Tipos das linhas (espelham docs/sql/ponto.sql) ───────────────────────────
export type Freelancer = {
  id: string
  usuario_id?: string
  nome: string
  funcao: FuncaoEvento | string
  contato: string | null
  email: string | null
  valor_diaria_num: number
  avaliacao: number | null // 0–5
  doc: string | null
  chave_pix: string | null
  ativo: boolean
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

export type Escala = {
  id: string
  usuario_id?: string
  evento_id: string | null
  reserva_id: string | null
  propriedade_id: string | null
  data: string                // 'YYYY-MM-DD'
  turno: Turno | string
  funcao: FuncaoEvento | string
  necessario: number          // vagas necessárias
  valor_diaria_ref_num: number // diária de referência da vaga
  status: EscalaStatus | string
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

export type EscalaAlocacao = {
  id: string
  usuario_id?: string
  escala_id: string
  equipe_id: number | null     // fixo (equipe.id é bigint)
  freelancer_id: string | null // freelancer (uuid)
  inicio_previsto: string | null
  fim_previsto: string | null
  valor_diaria_num: number     // fotografia da diária no momento da convocação
  status: AlocStatus | string
  pago: boolean
  conta_pagar_id: string | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

export type PontoRegistro = {
  id: string
  usuario_id?: string
  alocacao_id: string | null
  equipe_id: number | null
  freelancer_id: string | null
  evento_id: string | null
  data: string
  entrada: string | null
  saida: string | null
  intervalo_min: number
  jornada_min: number
  trabalhado_min: number
  extras_min: number
  noturno_min: number
  atraso_min: number
  saldo_min: number
  origem: PontoOrigem | string
  local: string | null
  obs: string | null
  criado_em?: string
}

// ── Catálogos (rótulos PT default; i18n: a UI pode reescrever) ────────────────
export const FUNCOES: { v: FuncaoEvento; label: string; cor: string }[] = [
  { v: 'garcom',      label: 'Garçom',      cor: '#ff385c' },
  { v: 'seguranca',   label: 'Segurança',   cor: '#1a73e8' },
  { v: 'recepcao',    label: 'Recepção',    cor: '#8b5cf6' },
  { v: 'montador',    label: 'Montador',    cor: '#f97316' },
  { v: 'manobrista',  label: 'Manobrista',  cor: '#0ea5e9' },
  { v: 'brigadista',  label: 'Brigadista',  cor: '#ef4444' },
  { v: 'limpeza',     label: 'Limpeza',     cor: '#14b8a6' },
  { v: 'coordenacao', label: 'Coordenação', cor: '#a855f7' },
  { v: 'cozinha',     label: 'Cozinha',     cor: '#eab308' },
  { v: 'bar',         label: 'Bar',         cor: '#10b981' },
  { v: 'dj',          label: 'DJ / Som',    cor: '#6366f1' },
  { v: 'outro',       label: 'Outro',       cor: '#94a3b8' },
]
const FUNC_BY = Object.fromEntries(FUNCOES.map((f) => [f.v, f])) as Record<string, (typeof FUNCOES)[number]>
export function funcaoLabel(v: string | null): string { return FUNC_BY[v || 'outro']?.label || v || '—' }
export function funcaoCor(v: string | null): string { return FUNC_BY[v || 'outro']?.cor || '#94a3b8' }

/** Janela-padrão de cada turno (HH:MM). É só uma sugestão pré-preenchida. */
export const TURNOS: { v: Turno; label: string; inicio: string; fim: string }[] = [
  { v: 'manha',     label: 'Manhã',     inicio: '06:00', fim: '12:00' },
  { v: 'tarde',     label: 'Tarde',     inicio: '12:00', fim: '18:00' },
  { v: 'noite',     label: 'Noite',     inicio: '18:00', fim: '23:59' },
  { v: 'madrugada', label: 'Madrugada', inicio: '23:00', fim: '05:00' },
  { v: 'integral',  label: 'Integral',  inicio: '08:00', fim: '18:00' },
]
const TURNO_BY = Object.fromEntries(TURNOS.map((t) => [t.v, t])) as Record<string, (typeof TURNOS)[number]>
export function turnoLabel(v: string | null): string { return TURNO_BY[v || '']?.label || v || '—' }
export function turnoJanela(v: string | null): { inicio: string; fim: string } {
  const t = TURNO_BY[v || '']
  return { inicio: t?.inicio || '', fim: t?.fim || '' }
}

export type AlocStatusMeta = { label: string; chip: string; dot: string; ordem: number }
export const ALOC_STATUS_META: Record<string, AlocStatusMeta> = {
  convocado:  { label: 'Convocado',  chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-400',   ordem: 0 },
  confirmado: { label: 'Confirmado', chip: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-400',     ordem: 1 },
  presente:   { label: 'Presente',   chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', ordem: 2 },
  falta:      { label: 'Falta',      chip: 'bg-red-50 text-red-700',         dot: 'bg-red-400',     ordem: 3 },
  cancelado:  { label: 'Cancelado',  chip: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-300',    ordem: 4 },
}
export function alocStatusMeta(status: string): AlocStatusMeta {
  return ALOC_STATUS_META[status] || { label: status, chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300', ordem: 9 }
}

export const ESCALA_STATUS_META: Record<string, { label: string; chip: string }> = {
  planejada: { label: 'Planejada', chip: 'bg-gray-100 text-gray-600' },
  publicada: { label: 'Publicada', chip: 'bg-blue-50 text-blue-700' },
  concluida: { label: 'Concluída', chip: 'bg-emerald-50 text-emerald-700' },
  cancelada: { label: 'Cancelada', chip: 'bg-red-50 text-red-700' },
}

// ── Predicados de status ─────────────────────────────────────────────────────
const OCUPA = new Set<string>(['convocado', 'confirmado', 'presente'])
/** A alocação OCUPA uma vaga da escala? (conta para cobertura e custo previsto.) */
export function ocupaVaga(status: string): boolean { return OCUPA.has(status) }
/** Status terminal (saiu do ciclo: faltou ou foi cancelada). */
export function alocEncerrada(status: string): boolean { return status === 'falta' || status === 'cancelado' }
/** A diária deve ser PAGA? Só quem efetivamente compareceu (presente). */
export function devePagar(a: Pick<EscalaAlocacao, 'status' | 'pago'>): boolean {
  return a.status === 'presente' && !a.pago
}

// ── Cobertura da escala (núcleo: bloqueia sub/super-alocação por função) ──────
export type Cobertura = {
  necessario: number
  preenchidas: number  // alocações que ocupam vaga (convocado/confirmado/presente)
  convocados: number
  confirmados: number
  presentes: number
  faltas: number
  faltam: number       // vagas em aberto (max(0, necessario − preenchidas))
  excedente: number    // alocações além do necessário (max(0, preenchidas − necessario))
  completa: boolean
  excedido: boolean
}
/**
 * Resumo de cobertura de UMA escala dado o conjunto de alocações dela. Critério
 * de aceite: a escala impede sub/super-alocação por função — `faltam` mostra o
 * que falta convocar; `excedido` sinaliza passar do necessário.
 */
export function coberturaEscala(necessario: number, alocacoes: Pick<EscalaAlocacao, 'status'>[]): Cobertura {
  const need = Math.max(0, Math.floor(Number(necessario) || 0))
  let convocados = 0, confirmados = 0, presentes = 0, faltas = 0
  for (const a of alocacoes) {
    if (a.status === 'convocado') convocados++
    else if (a.status === 'confirmado') confirmados++
    else if (a.status === 'presente') presentes++
    else if (a.status === 'falta') faltas++
  }
  const preenchidas = convocados + confirmados + presentes
  const faltam = Math.max(0, need - preenchidas)
  const excedente = Math.max(0, preenchidas - need)
  return {
    necessario: need, preenchidas, convocados, confirmados, presentes, faltas,
    faltam, excedente, completa: preenchidas >= need, excedido: preenchidas > need,
  }
}

export type Checagem = { ok: boolean; preenchidas: number; necessario: number; excedente: number }
/**
 * Checa se cabe MAIS uma alocação na escala (sem estourar o necessário).
 * `ignoreId` ignora uma alocação existente (reedição). É a checagem que a
 * /api/ponto aplica antes de convocar (recusa com 409, salvo `force`).
 */
export function checarAlocacao(
  necessario: number,
  alocacoes: Pick<EscalaAlocacao, 'id' | 'status'>[],
  opts: { ignoreId?: string } = {},
): Checagem {
  const considera = opts.ignoreId ? alocacoes.filter((a) => a.id !== opts.ignoreId) : alocacoes
  const c = coberturaEscala(necessario, considera)
  // cabe se ainda há vaga aberta (preenchidas < necessario)
  const ok = c.preenchidas < c.necessario
  return { ok, preenchidas: c.preenchidas, necessario: c.necessario, excedente: c.excedente }
}

// ── Custo de mão de obra ─────────────────────────────────────────────────────
/** Custo/hora de um salário fixo mensal (CLT/horista), via jornada mensal. */
export function custoHoraDe(salarioMensal: number, jornadaMensalH = JORNADA_MENSAL_H): number {
  const s = Number(salarioMensal) || 0
  return jornadaMensalH > 0 ? s / jornadaMensalH : 0
}

/**
 * Custo de UM registro de ponto de pessoa FIXA: horas normais ao custo/hora,
 * extras com fator (1.5×) e adicional noturno (20% sobre os minutos noturnos).
 * Tudo em números crus — a moeda é aplicada por lib/format na UI.
 */
export function custoRegistroFixo(
  reg: Pick<RegistroCalc, 'trabalhadoMin' | 'extrasMin' | 'noturnoMin'>,
  custoHora: number,
  opts: { fatorHE?: number; adicionalNoturno?: number } = {},
): number {
  const fatorHE = opts.fatorHE ?? 1.5
  const adNoturno = opts.adicionalNoturno ?? 0.2
  const ch = Number(custoHora) || 0
  const normaisMin = Math.max(0, reg.trabalhadoMin - reg.extrasMin)
  const base = minToHoras(normaisMin) * ch
  const he = minToHoras(reg.extrasMin) * ch * fatorHE
  const adic = minToHoras(reg.noturnoMin) * ch * adNoturno
  return base + he + adic
}

/** Soma das diárias de freelancers num conjunto de alocações, por filtro de status. */
export function somaDiarias(
  alocacoes: Pick<EscalaAlocacao, 'status' | 'valor_diaria_num'>[],
  aceitar: (status: string) => boolean = ocupaVaga,
): number {
  return alocacoes.reduce((s, a) => (aceitar(a.status) ? s + (Number(a.valor_diaria_num) || 0) : s), 0)
}

/** Custo PREVISTO de uma escala = soma das diárias das vagas ocupadas. */
export function custoPrevistoEscala(alocacoes: Pick<EscalaAlocacao, 'status' | 'valor_diaria_num'>[]): number {
  return somaDiarias(alocacoes, ocupaVaga)
}

export type CustoEvento = { freelancers: number; fixos: number; total: number; pessoas: number; horas: number }
/**
 * CUSTO DE MÃO DE OBRA REALIZADO de um evento — alimenta o custo direto do
 * evento (Contabilidade) e a margem. Soma:
 *   • freelancers: diárias de quem compareceu (status presente);
 *   • fixos: custo dos registros de ponto já calculado pela UI/engine.
 * Recebe valores já preparados (puro/agnóstico de origem).
 */
export function custoRealizadoEvento(input: {
  diariasFreela: number[]      // diárias de freelancers presentes
  custosFixos: number[]        // custoRegistroFixo de cada registro de fixos
  horasFixosMin?: number[]     // minutos trabalhados (p/ KPI de horas)
}): CustoEvento {
  const freelancers = input.diariasFreela.reduce((s, v) => s + (Number(v) || 0), 0)
  const fixos = input.custosFixos.reduce((s, v) => s + (Number(v) || 0), 0)
  const horas = (input.horasFixosMin || []).reduce((s, v) => s + minToHoras(Number(v) || 0), 0)
  const pessoas = input.diariasFreela.length + input.custosFixos.length
  return { freelancers, fixos, total: freelancers + fixos, pessoas, horas }
}

// ── Banco de horas ───────────────────────────────────────────────────────────
/** Saldo do banco de horas (minutos) = Σ(saldoMin dos registros). +crédito / −débito. */
export function saldoBancoMin(registros: Pick<PontoRegistro, 'saldo_min'>[]): number {
  return registros.reduce((s, r) => s + (Number(r.saldo_min) || 0), 0)
}

// ── No-show (freelancers) ────────────────────────────────────────────────────
/** Taxa de falta (no-show) de um conjunto de alocações: faltas / (faltas+presentes). */
export function taxaNoShow(alocacoes: Pick<EscalaAlocacao, 'status'>[]): number {
  let faltas = 0, presentes = 0
  for (const a of alocacoes) {
    if (a.status === 'falta') faltas++
    else if (a.status === 'presente') presentes++
  }
  const base = faltas + presentes
  return base > 0 ? faltas / base : 0
}
