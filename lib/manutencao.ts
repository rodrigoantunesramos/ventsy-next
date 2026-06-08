// Motor PURO de Manutenção & Ordens de Serviço da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: custo da OS (mão de obra + peças), agenda de
// preventivas (próxima data por periodicidade), planos vencidos, atraso de OS,
// MTTR (tempo médio de reparo das corretivas), custo acumulado por ativo/espaço
// (decisão consertar × repor), custo por mês e progresso de checklist.
//
// É consumido por:
//   • /painel/manutencao            (KPIs, Kanban, custos — via _lib.ts)
//   • /api/cron/manutencao-preventiva (gera OS dos planos vencidos, autoritativo)
//
// Regras de ouro (espelham lib/pricing.ts, lib/reservas.ts, lib/estoque.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs / hoje).
//     Nada de relógio escondido na lógica.
//   • Dinheiro arredondado a centavos via round2 para evitar drift de float.

// ── Utilidades numéricas/data ────────────────────────────────────────────────
export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
export function round2(n: number): number {
  return Math.round(num(n) * 100) / 100
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** ms da data (só-data ancora ao meio-dia LOCAL — evita off-by-one de fuso). */
function ms(iso: string | null | undefined): number {
  if (!iso) return NaN
  const s = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso
  return Date.parse(s)
}
/** Dias inteiros de A até B (negativo se B antes de A). 0 se alguma for inválida. */
export function diasEntre(aISO: string | null | undefined, bISO: string | null | undefined): number {
  const a = ms(aISO), b = ms(bISO)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

// ── Tipos de domínio ─────────────────────────────────────────────────────────
export type OSTipo = 'preventiva' | 'corretiva' | 'inspecao' | 'melhoria'
export type OSStatus = 'aberta' | 'planejada' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada'
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type ResponsavelTipo = 'equipe' | 'fornecedor'
export type Periodicidade =
  | 'diaria' | 'semanal' | 'quinzenal' | 'mensal'
  | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'horas_uso'

export type ChecklistItem = { item: string; ok: boolean; obs?: string | null }
export type Peca = { descricao: string; quantidade: number; custo_num: number; produto_id?: string | null }

/** Mínimo necessário para os cálculos de custo/atraso/agrupamento de uma OS. */
export type OSCalc = {
  tipo: OSTipo
  status: OSStatus
  abertura?: string | null
  prazo?: string | null
  conclusao?: string | null
  custo_mao_obra_num?: number | null
  custo_pecas_num?: number | null
  ativo_id?: string | null
  ativo_nome?: string | null
  propriedade_id?: number | null
}

// Ordem das colunas do Kanban / do ciclo de vida de uma OS.
export const STATUS_ORDEM: OSStatus[] = [
  'aberta', 'planejada', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada',
]

// ── Custo da OS (mão de obra + peças) ────────────────────────────────────────
/** Custo total da OS = mão de obra + peças (espelha a coluna gerada no banco). */
export function custoOS(o: { custo_mao_obra_num?: number | null; custo_pecas_num?: number | null }): number {
  return round2(num(o.custo_mao_obra_num) + num(o.custo_pecas_num))
}
/** Soma das peças de uma OS (para preencher custo_pecas_num a partir da lista). */
export function custoPecas(pecas: Peca[]): number {
  return round2(pecas.reduce((s, p) => s + num(p.custo_num) * (p.quantidade != null ? num(p.quantidade) : 1), 0))
}

// ── Ciclo de vida: aberta / atrasada ─────────────────────────────────────────
/** OS "em aberto" = ainda não concluída nem cancelada. */
export function osAberta(status: OSStatus): boolean {
  return status !== 'concluida' && status !== 'cancelada'
}
/** Atrasada = em aberto e com prazo no passado (prazo < hoje). */
export function osAtrasada(o: { status: OSStatus; prazo?: string | null }, hoje: string): boolean {
  return osAberta(o.status) && !!o.prazo && o.prazo < hoje
}

// ── Agenda de preventivas: próxima data por periodicidade ────────────────────
export function addMeses(d: Date, n: number): Date {
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, 12, 0, 0)
  const ult = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, ult)) // 31/jan + 1 mês → 28/29 fev (clamp no fim do mês)
  return r
}
/**
 * Próxima data de uma rotina a partir de `iso` (YYYY-MM-DD), avançando `intervalo`
 * períodos. `horas_uso` é disparada por uso (não por calendário) → retorna null.
 * Retorna null para data inválida.
 */
export function proximaData(iso: string, p: Periodicidade, intervalo = 1): string | null {
  const k = Math.max(1, Math.floor(num(intervalo)))
  const base = ms(iso)
  if (Number.isNaN(base)) return null
  const d = new Date(base)
  switch (p) {
    case 'diaria': d.setDate(d.getDate() + k); return ymd(d)
    case 'semanal': d.setDate(d.getDate() + 7 * k); return ymd(d)
    case 'quinzenal': d.setDate(d.getDate() + 14 * k); return ymd(d)
    case 'mensal': return ymd(addMeses(d, k))
    case 'bimestral': return ymd(addMeses(d, 2 * k))
    case 'trimestral': return ymd(addMeses(d, 3 * k))
    case 'semestral': return ymd(addMeses(d, 6 * k))
    case 'anual': return ymd(addMeses(d, 12 * k))
    case 'horas_uso': return null
  }
}

// ── Planos vencidos (geram OS automaticamente) ───────────────────────────────
export type PlanoCalc = { ativo?: boolean; proxima_data?: string | null; periodicidade: Periodicidade }
/** Plano "devido" = ativo, calendarizado e com próxima data já vencida (≤ hoje). */
export function planoDevido(p: PlanoCalc, hoje: string): boolean {
  if (p.ativo === false) return false
  if (p.periodicidade === 'horas_uso') return false // disparo por uso, não por data
  return !!p.proxima_data && p.proxima_data <= hoje
}
export function planosDevidos<T extends PlanoCalc>(planos: T[], hoje: string): T[] {
  return planos.filter((p) => planoDevido(p, hoje))
}

// ── MTTR — Mean Time To Repair (corretivas concluídas) ───────────────────────
/** Tempo médio (em dias) entre abertura e conclusão das CORRETIVAS concluídas. */
export function mttrDias(osList: OSCalc[]): { dias: number; n: number } {
  const fechadas = osList.filter(
    (o) => o.tipo === 'corretiva' && o.status === 'concluida' && o.abertura && o.conclusao,
  )
  if (!fechadas.length) return { dias: 0, n: 0 }
  const soma = fechadas.reduce((s, o) => s + Math.max(0, diasEntre(o.abertura, o.conclusao)), 0)
  return { dias: round2(soma / fechadas.length), n: fechadas.length }
}

// ── Agrupamento para o Kanban ────────────────────────────────────────────────
export function agruparPorStatus<T extends { status: OSStatus }>(osList: T[]): Record<OSStatus, T[]> {
  const g: Record<OSStatus, T[]> = {
    aberta: [], planejada: [], em_andamento: [], aguardando_peca: [], concluida: [], cancelada: [],
  }
  for (const o of osList) g[o.status].push(o)
  return g
}

// ── KPIs do painel ───────────────────────────────────────────────────────────
export type KpisManutencao = {
  abertas: number
  atrasadas: number
  emAndamento: number
  aguardandoPeca: number
  mttr: number
  mttrN: number
  custoMes: number
  concluidasMes: number
  custoAberto: number
}
export function kpisManutencao(osList: OSCalc[], nowMs: number): KpisManutencao {
  const hoje = ymd(new Date(nowMs))
  const mes = hoje.slice(0, 7)
  let abertas = 0, atrasadas = 0, emAndamento = 0, aguardandoPeca = 0
  let custoMes = 0, concluidasMes = 0, custoAberto = 0
  for (const o of osList) {
    if (osAberta(o.status)) { abertas++; custoAberto = round2(custoAberto + custoOS(o)) }
    if (o.status === 'em_andamento') emAndamento++
    if (o.status === 'aguardando_peca') aguardandoPeca++
    if (osAtrasada(o, hoje)) atrasadas++
    if (o.status === 'concluida' && (o.conclusao || '').slice(0, 7) === mes) {
      concluidasMes++
      custoMes = round2(custoMes + custoOS(o))
    }
  }
  const { dias, n } = mttrDias(osList)
  return { abertas, atrasadas, emAndamento, aguardandoPeca, mttr: dias, mttrN: n, custoMes, concluidasMes, custoAberto }
}

// ── Custo acumulado por ativo/espaço (consertar × repor) ─────────────────────
/** Chave de agrupamento por alvo: ativo (id ou nome) ou, na falta, o espaço. */
export function chaveAtivo(o: { ativo_id?: string | null; ativo_nome?: string | null; propriedade_id?: number | null }): string {
  if (o.ativo_id) return 'ativo:' + o.ativo_id
  if (o.ativo_nome && o.ativo_nome.trim()) return 'nome:' + o.ativo_nome.trim().toLowerCase()
  if (o.propriedade_id != null) return 'prop:' + o.propriedade_id
  return 'sem'
}
export type CustoAtivo = {
  chave: string
  ativo_id: string | null
  ativo_nome: string | null
  propriedade_id: number | null
  custo: number
  n: number
  ultima: string | null
}
/** Custo total e nº de OS por ativo/espaço (ignora canceladas). Ordenado desc. */
export function custoPorAtivo(osList: OSCalc[]): CustoAtivo[] {
  const m = new Map<string, CustoAtivo>()
  for (const o of osList) {
    if (o.status === 'cancelada') continue
    const chave = chaveAtivo(o)
    if (chave === 'sem') continue
    const cur = m.get(chave) || {
      chave, ativo_id: o.ativo_id ?? null, ativo_nome: o.ativo_nome ?? null,
      propriedade_id: o.propriedade_id ?? null, custo: 0, n: 0, ultima: null,
    }
    cur.custo = round2(cur.custo + custoOS(o))
    cur.n += 1
    const d = o.conclusao || o.abertura || null
    if (d && (!cur.ultima || d > cur.ultima)) cur.ultima = d
    m.set(chave, cur)
  }
  return [...m.values()].sort((a, b) => b.custo - a.custo)
}

// ── Custo por mês (últimos N meses, base na conclusão/abertura) ───────────────
export type CustoMes = { mes: string; custo: number; n: number }
export function custoPorMes(osList: OSCalc[], nowMs: number, meses = 6): CustoMes[] {
  const now = new Date(nowMs)
  const buckets: CustoMes[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, custo: 0, n: 0 })
  }
  const idx = new Map(buckets.map((b, i) => [b.mes, i]))
  for (const o of osList) {
    if (o.status === 'cancelada') continue
    const ref = (o.conclusao || o.abertura || '').slice(0, 7)
    const i = idx.get(ref)
    if (i == null) continue
    buckets[i].custo = round2(buckets[i].custo + custoOS(o))
    buckets[i].n += 1
  }
  return buckets
}

// ── Peças mais usadas (agregado das OS não canceladas) ───────────────────────
export type PecaUso = { descricao: string; quantidade: number; custo: number; n: number }
export function pecasMaisUsadas(
  osList: { status: OSStatus; pecas?: Peca[] | null }[],
): PecaUso[] {
  const m = new Map<string, PecaUso>()
  for (const o of osList) {
    if (o.status === 'cancelada' || !Array.isArray(o.pecas)) continue
    for (const p of o.pecas) {
      const chave = (p.descricao || '').trim().toLowerCase()
      if (!chave) continue
      const cur = m.get(chave) || { descricao: p.descricao.trim(), quantidade: 0, custo: 0, n: 0 }
      cur.quantidade = round2(cur.quantidade + (p.quantidade != null ? num(p.quantidade) : 1))
      cur.custo = round2(cur.custo + num(p.custo_num) * (p.quantidade != null ? num(p.quantidade) : 1))
      cur.n += 1
      m.set(chave, cur)
    }
  }
  return [...m.values()].sort((a, b) => b.custo - a.custo)
}

// ── Checklist (inspeção / pré-evento) ────────────────────────────────────────
export function progressoChecklist(items: ChecklistItem[]): { feitos: number; total: number; pct: number } {
  const total = items.length
  const feitos = items.filter((i) => i.ok).length
  return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 }
}
/** Checklist completo = tem itens E todos marcados (gate do "concluir" pré-evento). */
export function checklistCompleto(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.ok)
}
