// Motor PURO de Estacionamento & Mobilidade da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: tarifa por setor (isenção de credenciado, cobrança
// fixa/por hora/diária), tempo de permanência, OCUPAÇÃO EM TEMPO REAL por setor ×
// capacidade (pico + curva de fluxo), receita de estacionamento (ticket médio,
// por setor, por método) e capacidade de transporte (transfer/shuttle/ônibus).
// É consumida por:
//   • /painel/estacionamento  (setores, pátio, valet, receita, mobilidade)
//   • /api/estacionamento      (entrada/saída AUTORITATIVA — bloqueio por lotação)
//   • /api/estacionamento/receita (fechamento da receita → lançamento no caixa)
//
// Modelo de pátio (espelha o "torniquete" de lib/acesso): um veículo ocupa uma
// vaga do setor entre a ENTRADA e a SAÍDA. A ocupação atual de um setor é o nº de
// veículos `no_patio`; o pico/curva vêm da varredura cronológica de entradas(+1)/
// saídas(−1). A receita realizada é a soma dos acessos PAGOS (credenciado = 0).
//
// Regras de ouro (espelham lib/acesso.ts / lib/equipamentos.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. Formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio/aleatoriedade escondidos na lógica.
//   • A matemática de lotação (presentes × capacidade, limiares 70/90/100%) é
//     genérica e já vive em lib/acesso — REUSAMOS em vez de duplicar. Mesma
//     reutilização que lib/logistica faz de lib/reservas.

import {
  nivelLotacao, LOTACAO_META, parseMs,
  type NivelLotacao, type Lotacao,
} from '@/lib/acesso'

// Re-exporta a primitiva de lotação para quem consome só este módulo.
export { nivelLotacao, LOTACAO_META }
export type { NivelLotacao, Lotacao }

// ── Tempo (puro) ──────────────────────────────────────────────────────────────
export const SEGUNDO = 1000
export const MINUTO = 60 * SEGUNDO
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Tipo de vaga/veículo do setor — do carro comum ao heliponto (air show). */
export type SetorTipo =
  | 'carro' | 'moto' | 'onibus' | 'caminhao' | 'van'
  | 'credenciado' | 'pcd' | 'idoso' | 'heliponto'

/** Modelo de cobrança do setor. `fixo` = valor único do evento; `hora`/`diaria`
 *  multiplicam pelo tempo de permanência (autódromo/feira de vários dias). */
export type Cobranca = 'fixo' | 'hora' | 'diaria'

/** Estado do acesso veicular. `no_patio` é a presença que conta para a lotação. */
export type AcessoStatus = 'reservado' | 'no_patio' | 'saiu'

/** Ciclo do valet. `na` = veículo sem valet. */
export type ValetStatus = 'na' | 'recebido' | 'estacionado' | 'solicitado' | 'entregue'

export type TransferTipo = 'shuttle' | 'van' | 'onibus' | 'transfer'

/** Setor de estacionamento (espelha `estacionamento_setores`). É infraestrutura
 *  física do espaço (propriedade), reutilizada entre eventos. */
export type Setor = {
  id: string
  usuario_id?: string
  propriedade_id: number | null
  nome: string
  tipo: SetorTipo | string
  capacidade: number                 // 0 = sem limite
  preco_num: number                  // tarifa base (na moeda do usuário; cru)
  cobranca: Cobranca | string
  cor: string | null
  ordem: number
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

/** Acesso veicular (espelha `estacionamento_acessos`) — base da lotação/receita. */
export type AcessoVeicular = {
  id: string
  usuario_id?: string
  evento_id: string | null
  setor_id: string | null
  placa: string
  tipo: SetorTipo | string
  modelo: string | null
  cor_veiculo: string | null
  credencial_id: string | null        // vínculo com /painel/acesso → isento
  valet: boolean
  valet_status: ValetStatus | string
  valet_local: string | null          // onde a chave/vaga está
  motorista: string | null
  contato: string | null
  entrada: string | null
  saida: string | null
  valor_num: number
  pago: boolean
  metodo: string | null
  status: AcessoStatus | string
  lancamento_id: number | null        // conciliação com o caixa (lancamentos)
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Transfer/mobilidade (espelha `transfer`). `horarios` é uma lista de "HH:MM". */
export type Transfer = {
  id: string
  usuario_id?: string
  evento_id: string | null
  tipo: TransferTipo | string
  rota: string
  horarios: string[]
  capacidade: number
  fornecedor_id: string | null
  motorista: string | null
  contato: string | null
  veiculo: string | null
  ponto_embarque: string | null       // liga com Layouts/Plantas
  ativo: boolean
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Metadados de tipo (rótulo PT + chip + hex). i18n: label é o default PT. ──
export type Meta = { label: string; chip: string; hex: string }

export const SETOR_TIPO_META: Record<string, Meta> = {
  carro:       { label: 'Carro',       chip: 'bg-sky-100 text-sky-700',       hex: '#0284c7' },
  moto:        { label: 'Moto',        chip: 'bg-violet-100 text-violet-700', hex: '#7c3aed' },
  van:         { label: 'Van',         chip: 'bg-cyan-100 text-cyan-700',     hex: '#0891b2' },
  onibus:      { label: 'Ônibus',      chip: 'bg-amber-100 text-amber-800',   hex: '#d97706' },
  caminhao:    { label: 'Caminhão',    chip: 'bg-orange-100 text-orange-700', hex: '#ea580c' },
  credenciado: { label: 'Credenciado', chip: 'bg-emerald-100 text-emerald-700', hex: '#059669' },
  pcd:         { label: 'PCD',         chip: 'bg-blue-100 text-blue-700',     hex: '#2563eb' },
  idoso:       { label: 'Idoso',       chip: 'bg-indigo-100 text-indigo-700', hex: '#4338ca' },
  heliponto:   { label: 'Heliponto',   chip: 'bg-pink-100 text-pink-700',     hex: '#db2777' },
}
const SETOR_FALLBACK: Meta = { label: '—', chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
export function setorTipoMeta(tipo: string): Meta {
  return SETOR_TIPO_META[tipo] || { ...SETOR_FALLBACK, label: tipo }
}
export const SETOR_TIPOS: { v: SetorTipo; label: string; hex: string }[] =
  (Object.keys(SETOR_TIPO_META) as SetorTipo[]).map((v) => ({ v, label: SETOR_TIPO_META[v].label, hex: SETOR_TIPO_META[v].hex }))

export const COBRANCA_META: Record<string, { label: string; sufixo: string }> = {
  fixo:   { label: 'Valor fixo',  sufixo: 'evento' },
  hora:   { label: 'Por hora',    sufixo: 'hora' },
  diaria: { label: 'Por diária',  sufixo: 'dia' },
}
export const COBRANCAS: { v: Cobranca; label: string }[] =
  (Object.keys(COBRANCA_META) as Cobranca[]).map((v) => ({ v, label: COBRANCA_META[v].label }))

export const TRANSFER_TIPO_META: Record<string, Meta> = {
  shuttle:  { label: 'Shuttle',  chip: 'bg-emerald-100 text-emerald-700', hex: '#059669' },
  van:      { label: 'Van',      chip: 'bg-cyan-100 text-cyan-700',       hex: '#0891b2' },
  onibus:   { label: 'Ônibus',   chip: 'bg-amber-100 text-amber-800',     hex: '#d97706' },
  transfer: { label: 'Transfer', chip: 'bg-violet-100 text-violet-700',   hex: '#7c3aed' },
}
export function transferTipoMeta(tipo: string): Meta {
  return TRANSFER_TIPO_META[tipo] || { ...SETOR_FALLBACK, label: tipo }
}
export const TRANSFER_TIPOS: { v: TransferTipo; label: string }[] =
  (Object.keys(TRANSFER_TIPO_META) as TransferTipo[]).map((v) => ({ v, label: TRANSFER_TIPO_META[v].label }))

export const ACESSO_STATUS_META: Record<string, Meta> = {
  reservado: { label: 'Reservado', chip: 'bg-slate-100 text-slate-600',     hex: '#94a3b8' },
  no_patio:  { label: 'No pátio',  chip: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
  saiu:      { label: 'Saiu',      chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
}
export function acessoStatusMeta(status: string): Meta {
  return ACESSO_STATUS_META[status] || { ...SETOR_FALLBACK, label: status }
}

export const VALET_STATUS_META: Record<string, Meta> = {
  recebido:   { label: 'Recebido',   chip: 'bg-sky-100 text-sky-700',         hex: '#0284c7' },
  estacionado:{ label: 'Estacionado',chip: 'bg-emerald-100 text-emerald-700', hex: '#059669' },
  solicitado: { label: 'Solicitado', chip: 'bg-amber-100 text-amber-800',     hex: '#d97706' },
  entregue:   { label: 'Entregue',   chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
  na:         { label: '—',          chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
}
export function valetStatusMeta(status: string): Meta {
  return VALET_STATUS_META[status] || { ...SETOR_FALLBACK, label: status }
}
/** Ordem do fluxo do valet (para "avançar etapa" na UI). */
export const VALET_FLUXO: ValetStatus[] = ['recebido', 'estacionado', 'solicitado', 'entregue']
export function proximoValet(atual: string): ValetStatus | null {
  const i = VALET_FLUXO.indexOf(atual as ValetStatus)
  return i < 0 || i >= VALET_FLUXO.length - 1 ? null : VALET_FLUXO[i + 1]
}

// ── Placa ──────────────────────────────────────────────────────────────────────
/** Normaliza para o token canônico: maiúsculas, sem espaços/hífens/símbolos. */
export function normalizarPlaca(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim()
}
const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/        // ABC1234
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/ // ABC1D23
/** Reconhece o padrão de placa brasileiro (antigo ou Mercosul). Tolerante: usado
 *  só como AVISO visual — outros veículos/internacionais não são bloqueados. */
export function placaValidaBR(placa: string): boolean {
  const p = normalizarPlaca(placa)
  return PLACA_ANTIGA.test(p) || PLACA_MERCOSUL.test(p)
}

// ── Tarifa & permanência ───────────────────────────────────────────────────────
/** O acesso é isento? Credenciado (vínculo com /painel/acesso) ou setor de
 *  cortesia (`credenciado`) não paga — critério de aceite do módulo. */
export function isIsento(setor: Pick<Setor, 'tipo'> | null | undefined, acesso: Pick<AcessoVeicular, 'credencial_id'> | { credencial_id: string | null }): boolean {
  if (acesso?.credencial_id) return true
  return setor?.tipo === 'credenciado'
}

export type TarifaCtx = {
  setor?: Pick<Setor, 'preco_num' | 'cobranca' | 'tipo'> | null
  credenciado?: boolean              // força isenção (vínculo de credencial)
  entrada?: string | null
  saida?: string | null
  nowMs?: number
}
/**
 * Tarifa do acesso, na moeda do usuário (valor cru, sem "R$"):
 *   • isento (credenciado/cortesia)     → 0
 *   • cobrança `fixo`                    → preço base do setor
 *   • cobrança `hora`/`diaria`           → unidades (arredondadas p/ cima, mín. 1)
 *                                          pela permanência × preço base
 */
export function calcularTarifa(ctx: TarifaCtx): number {
  const setor = ctx.setor
  if (!setor) return 0
  const isento = ctx.credenciado || setor.tipo === 'credenciado'
  if (isento) return 0
  const base = Math.max(0, Number(setor.preco_num) || 0)
  if (base === 0) return 0
  const cobranca = setor.cobranca || 'fixo'
  if (cobranca === 'fixo') return base

  const dur = permanenciaMs({ entrada: ctx.entrada ?? null, saida: ctx.saida ?? null }, ctx.nowMs)
  const unidadeMs = cobranca === 'diaria' ? DIA : HORA
  const unidades = Math.max(1, Math.ceil(dur / unidadeMs))
  return base * unidades
}

/** Permanência em ms: (saída ou agora) − entrada. 0 se não houver entrada. */
export function permanenciaMs(a: Pick<AcessoVeicular, 'entrada' | 'saida'>, nowMs?: number): number {
  const ent = parseMs(a.entrada)
  if (ent == null) return 0
  const fim = parseMs(a.saida) ?? (nowMs ?? Date.now())
  return Math.max(0, fim - ent)
}

/** Permanência decomposta em partes inteiras (para formatação i18n na UI). */
export function duracaoPartes(ms: number): { dias: number; horas: number; minutos: number } {
  const t = Math.max(0, Math.floor(ms))
  const dias = Math.floor(t / DIA)
  const horas = Math.floor((t % DIA) / HORA)
  const minutos = Math.floor((t % HORA) / MINUTO)
  return { dias, horas, minutos }
}

// ── Ocupação do pátio ────────────────────────────────────────────────────────
/** O veículo está ocupando uma vaga agora? (presença que conta na lotação) */
export function estaNoPatio(a: Pick<AcessoVeicular, 'status' | 'entrada' | 'saida'>): boolean {
  if (a.status === 'saiu') return false
  if (a.status === 'no_patio') return true
  return !!a.entrada && !a.saida
}

/** Ocupação atual (veículos no pátio) por setor. */
export function ocupacaoPorSetor(acessos: AcessoVeicular[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of acessos) {
    if (!estaNoPatio(a)) continue
    const k = a.setor_id || '—'
    out[k] = (out[k] || 0) + 1
  }
  return out
}

/** Total de veículos no pátio agora. */
export function ocupacaoTotal(acessos: AcessoVeicular[]): number {
  let n = 0
  for (const a of acessos) if (estaNoPatio(a)) n++
  return n
}

/** Nível de lotação de um setor vs. sua capacidade (reusa a engine de acesso). */
export function lotacaoSetor(ocupacao: number, capacidade: number | null | undefined): Lotacao {
  return nivelLotacao(ocupacao, capacidade)
}

// Eventos de fluxo (+1 na entrada / −1 na saída), ordenados no tempo.
function eventosFluxo(acessos: AcessoVeicular[]): { t: number; d: number }[] {
  const out: { t: number; d: number }[] = []
  for (const a of acessos) {
    const ent = parseMs(a.entrada)
    if (ent != null) out.push({ t: ent, d: 1 })
    const sai = parseMs(a.saida)
    if (sai != null) out.push({ t: sai, d: -1 })
  }
  return out.sort((a, b) => a.t - b.t)
}

export type Pico = { pico: number; picoEm: number | null }
/** Pico de veículos simultâneos no pátio (varredura cronológica). */
export function picoPatio(acessos: AcessoVeicular[]): Pico {
  let cur = 0, pico = 0, picoEm: number | null = null
  for (const e of eventosFluxo(acessos)) {
    cur += e.d
    if (cur > pico) { pico = cur; picoEm = e.t }
  }
  return { pico, picoEm }
}

export type CurvaPonto = { t: number; n: number }
/** Curva de ocupação do pátio ao longo do tempo (passos por movimento). */
export function curvaFluxo(acessos: AcessoVeicular[]): CurvaPonto[] {
  const out: CurvaPonto[] = []
  let cur = 0
  for (const e of eventosFluxo(acessos)) { cur += e.d; out.push({ t: e.t, n: Math.max(0, cur) }) }
  return out
}

// ── Validação de entrada (autoritativa) ───────────────────────────────────────
export type MotivoRecusa = 'lotacao' | 'ja_no_patio' | 'placa_vazia'
export type DecisaoEntrada = {
  ok: boolean
  motivo?: MotivoRecusa
  aviso?: string
  bloqueante: boolean         // recusar quando true e sem `force`
}
export type EntradaCtx = {
  placa: string
  setor?: Pick<Setor, 'capacidade'> | null
  ocupacaoSetor?: number      // ocupação atual do setor (antes da entrada)
  jaNoPatio?: boolean         // a mesma placa já consta no pátio deste evento
}
/**
 * Decide se um veículo pode entrar. Ordem: placa → setor lotado (recusa dura,
 * `force` libera) → placa repetida no pátio (apenas aviso).
 */
export function validarEntrada(ctx: EntradaCtx): DecisaoEntrada {
  if (!normalizarPlaca(ctx.placa)) {
    return { ok: false, motivo: 'placa_vazia', bloqueante: true, aviso: 'Informe a placa do veículo.' }
  }
  const cap = Math.max(0, Number(ctx.setor?.capacidade) || 0)
  const ocup = Math.max(0, Number(ctx.ocupacaoSetor) || 0)
  if (cap > 0 && ocup >= cap) {
    return { ok: false, motivo: 'lotacao', bloqueante: true, aviso: 'Setor na capacidade máxima.' }
  }
  if (ctx.jaNoPatio) {
    return { ok: false, motivo: 'ja_no_patio', bloqueante: false, aviso: 'Esta placa já consta no pátio.' }
  }
  return { ok: true, bloqueante: false }
}

// ── Agregações (KPIs/relatórios) ───────────────────────────────────────────────
export type ResumoPatio = {
  total: number               // total de acessos registrados
  noPatio: number             // veículos presentes agora
  saidos: number
  valetNoPatio: number        // veículos sob valet, ainda no pátio
  ocupacaoTotal: number       // = noPatio
  capacidadeTotal: number     // soma das capacidades dos setores ativos
  porTipo: Record<string, number>   // veículos no pátio por tipo
}
export function resumoPatio(acessos: AcessoVeicular[], setores: Setor[]): ResumoPatio {
  const porTipo: Record<string, number> = {}
  let noPatio = 0, saidos = 0, valetNoPatio = 0
  for (const a of acessos) {
    if (a.status === 'saiu') { saidos++; continue }
    if (estaNoPatio(a)) {
      noPatio++
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1
      if (a.valet) valetNoPatio++
    }
  }
  const capacidadeTotal = setores.reduce((s, x) => s + (x.ativo ? Math.max(0, Number(x.capacidade) || 0) : 0), 0)
  return { total: acessos.length, noPatio, saidos, valetNoPatio, ocupacaoTotal: noPatio, capacidadeTotal, porTipo }
}

export type ResumoReceita = {
  receita: number             // receita realizada (acessos pagos)
  pendente: number            // valor de acessos faturados mas não pagos
  naoLancado: number          // receita paga ainda não enviada ao caixa
  pagantes: number            // qtd de acessos com valor > 0
  pagos: number               // qtd de acessos pagos
  isentos: number             // qtd de credenciados (cortesia)
  ticketMedio: number         // receita / pagos (0 se nenhum)
  porSetor: Record<string, { receita: number; qtd: number }>
  porMetodo: Record<string, number>
}
/**
 * Receita de estacionamento. `receita` = soma dos acessos PAGOS (dinheiro
 * realizado); `naoLancado` = parte paga ainda não conciliada no caixa
 * (lancamento_id nulo) — o que o botão "lançar no financeiro" envia.
 */
export function resumoReceita(acessos: AcessoVeicular[]): ResumoReceita {
  const porSetor: Record<string, { receita: number; qtd: number }> = {}
  const porMetodo: Record<string, number> = {}
  let receita = 0, pendente = 0, naoLancado = 0, pagantes = 0, pagos = 0, isentos = 0
  for (const a of acessos) {
    const v = Math.max(0, Number(a.valor_num) || 0)
    if (a.credencial_id) isentos++
    if (v > 0) {
      pagantes++
      if (a.pago) {
        pagos++
        receita += v
        if (a.lancamento_id == null) naoLancado += v
        const k = a.setor_id || '—'
        const cur = porSetor[k] || { receita: 0, qtd: 0 }
        cur.receita += v; cur.qtd++
        porSetor[k] = cur
        const m = a.metodo || 'Outro'
        porMetodo[m] = (porMetodo[m] || 0) + v
      } else {
        pendente += v
      }
    }
  }
  return {
    receita, pendente, naoLancado, pagantes, pagos, isentos,
    ticketMedio: pagos ? receita / pagos : 0,
    porSetor, porMetodo,
  }
}

// ── Mobilidade (transfer) ──────────────────────────────────────────────────────
/** Normaliza horários vindos do banco (jsonb array) ou de texto colado. */
export function parseHorarios(v: unknown): string[] {
  let arr: string[] = []
  if (Array.isArray(v)) arr = v.map((x) => String(x))
  else if (typeof v === 'string') arr = v.split(/[\n,;]+/)
  return arr
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d{1,2}):?(\d{2})$/.exec(s)
      if (!m) return ''
      const h = Number(m[1]), min = Number(m[2])
      if (h > 23 || min > 59) return ''
      return `${m[1].padStart(2, '0')}:${m[2]}`
    })
    .filter(Boolean)
    .sort()
}

function horarioParaMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
/** Próximo horário a partir de `nowMin` (minutos desde a meia-noite). null se todos passaram. */
export function proximoHorario(horarios: string[], nowMin: number): string | null {
  let best: { min: number; v: string } | null = null
  for (const h of horarios) {
    const min = horarioParaMin(h)
    if (min == null || min < nowMin) continue
    if (!best || min < best.min) best = { min, v: h }
  }
  return best?.v ?? null
}

export type ResumoTransfer = {
  rotas: number               // rotas ativas
  lugares: number             // soma de capacidade das rotas ativas
  porTipo: Record<string, number>
}
export function resumoTransfer(transfers: Transfer[]): ResumoTransfer {
  const porTipo: Record<string, number> = {}
  let rotas = 0, lugares = 0
  for (const t of transfers) {
    if (!t.ativo) continue
    rotas++
    lugares += Math.max(0, Number(t.capacidade) || 0)
    porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1
  }
  return { rotas, lugares, porTipo }
}
