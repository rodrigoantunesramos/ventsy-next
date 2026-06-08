// Motor PURO de Produção & Run-of-show da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Transforma um evento CONTRATADO (clientes_eventos) num PROJETO EXECUTÁVEL:
// briefing, checklist de produção (por categoria, com responsável/prazo/
// dependência), cronograma operacional minuto-a-minuto (run-of-show) e o
// fechamento pós-evento. É o "dia D sob controle". Escala do pequeno ao gigante:
// casamento (cerimônia→festa), corrida (largada/pelotões/premiação), feira
// (abertura/palestras/credenciamento), show (passagem de som/portões/headliner).
//
// Consumido por:
//   • /painel/producao   (briefing, checklist Kanban, run-show, equipe, pós)
//   • /api/producao       (ensure 1:1 do evento, aplicar template, concluir
//                          tarefa respeitando dependências — autoritativo)
//
// Regras de ouro (espelham lib/ponto.ts, lib/reservas.ts, lib/equipamentos.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/minutos
//     crus. A formatação (moeda/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: o "agora"/datas entram por parâmetro. Nada de
//     relógio escondido dentro da lógica.
//   • i18n: rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

// ── Tempo (puro, sem fuso) ───────────────────────────────────────────────────
export const MIN_DIA = 24 * 60

/** 'HH:MM' → minutos desde a meia-noite. Tolerante a lixo (→ 0). */
export function hhmmToMin(hhmm: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!m) return 0
  return Math.min(MIN_DIA, Number(m[1]) * 60 + Number(m[2]))
}
/** minutos-do-dia → 'HH:MM' (rótulo técnico de horário, não formatação locale). */
export function minToHHMM(min: number): string {
  const t = ((Math.round(Number(min) || 0) % MIN_DIA) + MIN_DIA) % MIN_DIA
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
/** Soma minutos a um 'HH:MM', devolvendo o horário e o delta de DIAS (overflow). */
export function somarHorario(hhmm: string, deltaMin: number): { horario: string; diaDelta: number } {
  const abs = hhmmToMin(hhmm) + Math.round(Number(deltaMin) || 0)
  return { horario: minToHHMM(abs), diaDelta: Math.floor(abs / MIN_DIA) }
}
/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (ancorado ao meio-dia p/ evitar DST/UTC off-by-one). */
export function addDiasYMD(ymd: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + Math.round(Number(n) || 0))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Rótulo técnico de duração em minutos → "1h30" / "45min" / "2h". */
export function duracaoLabel(min: number): string {
  const t = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(t / 60)
  const m = t % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Estágio da produção do evento (1:1 com o evento). */
export type ProducaoStatus = 'planejamento' | 'pronto' | 'em_execucao' | 'encerrado'

/** Categoria/frente de uma tarefa de produção (espelha o CHECK do SQL). */
export type Categoria =
  | 'comercial' | 'logistica' | 'AeB' | 'tecnico' | 'seguranca'
  | 'limpeza' | 'decoracao' | 'cerimonia' | 'pos' | 'outro'

/** Quem responde pela tarefa. */
export type ResponsavelTipo = 'producao' | 'equipe' | 'fornecedor' | 'cliente'

/** Estado de uma tarefa no Kanban da checklist. */
export type TarefaStatus = 'pendente' | 'fazendo' | 'concluida' | 'cancelada'

/** Prioridade — alta/crítica não-concluída vira "pendência crítica". */
export type Prioridade = 'baixa' | 'normal' | 'alta' | 'critica'

// ── Tipos das linhas (espelham docs/sql/producao.sql) ────────────────────────
export type Producao = {
  id: string
  usuario_id?: string
  evento_id: string
  status: ProducaoStatus | string
  briefing: Briefing
  observacoes: string | null
  criado_em?: string
  atualizado_em?: string
}

export type Tarefa = {
  id: string
  usuario_id?: string
  producao_id: string
  titulo: string
  categoria: Categoria | string
  responsavel: ResponsavelTipo | string
  responsavel_id: string | null   // equipe.id / fornecedor.id (texto livre p/ flexibilidade)
  responsavel_nome: string | null  // snapshot do nome (quando informado)
  prazo: string | null             // 'YYYY-MM-DD'
  status: TarefaStatus | string
  prioridade: Prioridade | string
  depende_de: string | null        // id de outra tarefa (única dependência)
  obs: string | null
  anexos: AnexoRef[]
  ordem: number
  criado_em?: string
  atualizado_em?: string
}
export type AnexoRef = { nome: string; url: string }

export type RunshowItem = {
  id: string
  usuario_id?: string
  producao_id: string
  data: string | null              // 'YYYY-MM-DD' (multi-dia: feira/festival)
  horario: string                  // 'HH:MM'
  duracao_min: number
  atividade: string
  area: string | null              // palco/pista/recepção/cozinha…
  responsavel: string | null       // texto livre (nome/função)
  recurso: string | null           // som/luz/palco/projeção…
  obs: string | null
  concluido: boolean               // marcado no "modo dia do evento"
  ordem: number
  criado_em?: string
  atualizado_em?: string
}

// ── Briefing (jsonb estruturado, com seed a partir de clientes_eventos) ──────
export type ContatoChave = { nome: string; papel: string; telefone: string }
export type Briefing = {
  convidados: number | null
  horarios: { montagem: string; inicio: string; fim: string; desmontagem: string }
  local: string
  contatosChave: ContatoChave[]
  contatosEmergencia: string
  cardapio: string
  layout: string
  restricoes: string
  dos: string                      // do's (o que fazer)
  donts: string                    // don'ts (o que evitar)
  observacoes: string
  licoesAprendidas: string         // preenchido no pós-evento
}

/** Briefing vazio — base segura p/ render e merge (nunca undefined nos campos). */
export function briefingVazio(): Briefing {
  return {
    convidados: null,
    horarios: { montagem: '', inicio: '', fim: '', desmontagem: '' },
    local: '',
    contatosChave: [],
    contatosEmergencia: '',
    cardapio: '',
    layout: '',
    restricoes: '',
    dos: '',
    donts: '',
    observacoes: '',
    licoesAprendidas: '',
  }
}

/** Mescla um briefing parcial (vindo do banco) sobre a base vazia — defensivo. */
export function mesclarBriefing(parcial: Partial<Briefing> | null | undefined): Briefing {
  const base = briefingVazio()
  if (!parcial || typeof parcial !== 'object') return base
  const p = parcial as Briefing
  return {
    convidados: p.convidados != null && Number.isFinite(Number(p.convidados)) ? Number(p.convidados) : null,
    horarios: { ...base.horarios, ...(p.horarios || {}) },
    local: p.local || '',
    contatosChave: Array.isArray(p.contatosChave)
      ? p.contatosChave.filter((c) => c && (c.nome || c.papel || c.telefone))
          .map((c) => ({ nome: c.nome || '', papel: c.papel || '', telefone: c.telefone || '' }))
      : [],
    contatosEmergencia: p.contatosEmergencia || '',
    cardapio: p.cardapio || '',
    layout: p.layout || '',
    restricoes: p.restricoes || '',
    dos: p.dos || '',
    donts: p.donts || '',
    observacoes: p.observacoes || '',
    licoesAprendidas: p.licoesAprendidas || '',
  }
}

/** Campos brutos de um evento (clientes_eventos) usados para semear o briefing. */
export type EventoBriefingSeed = {
  qtd_adultos?: number | null
  qtd_criancas?: number | null
  horario_montagem?: string | null
  horario_inicio?: string | null
  horario_fim?: string | null
  horario_desmontagem?: string | null
  restricoes_alimentares?: string | null
  contato_emergencia?: string | null
  layout_mesas?: string | null
  necessidades_tecnicas?: string | null
  observacoes?: string | null
}
/** Normaliza 'HH:MM'/'HH:MM:SS'/lixo → 'HH:MM' ou ''. */
function horaCurta(v: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((v || '').trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}
/**
 * Pré-preenche um briefing a partir dos campos que o evento já tem em
 * clientes_eventos (horários, convidados, restrições, contato de emergência,
 * layout, necessidades técnicas). Só preenche o que está vazio no atual.
 */
export function briefingSeedDeEvento(ev: EventoBriefingSeed | null | undefined, atual?: Briefing | null): Briefing {
  const b = mesclarBriefing(atual)
  if (!ev) return b
  const adultos = Number(ev.qtd_adultos) || 0
  const criancas = Number(ev.qtd_criancas) || 0
  if (b.convidados == null && adultos + criancas > 0) b.convidados = adultos + criancas
  if (!b.horarios.montagem) b.horarios.montagem = horaCurta(ev.horario_montagem)
  if (!b.horarios.inicio) b.horarios.inicio = horaCurta(ev.horario_inicio)
  if (!b.horarios.fim) b.horarios.fim = horaCurta(ev.horario_fim)
  if (!b.horarios.desmontagem) b.horarios.desmontagem = horaCurta(ev.horario_desmontagem)
  if (!b.restricoes) b.restricoes = (ev.restricoes_alimentares || '').trim()
  if (!b.contatosEmergencia) b.contatosEmergencia = (ev.contato_emergencia || '').trim()
  if (!b.layout) b.layout = (ev.layout_mesas || '').trim()
  if (!b.observacoes) {
    const tec = (ev.necessidades_tecnicas || '').trim()
    b.observacoes = tec ? `Necessidades técnicas: ${tec}` : (ev.observacoes || '').trim()
  }
  return b
}

// ── Catálogos (rótulos PT default; cores p/ chips e timeline) ─────────────────
export const CATEGORIAS: { v: Categoria; label: string; cor: string }[] = [
  { v: 'comercial',  label: 'Comercial',  cor: '#ff385c' },
  { v: 'logistica',  label: 'Logística',  cor: '#f97316' },
  { v: 'AeB',        label: 'A&B',        cor: '#10b981' },
  { v: 'tecnico',    label: 'Técnico',    cor: '#6366f1' },
  { v: 'seguranca',  label: 'Segurança',  cor: '#ef4444' },
  { v: 'limpeza',    label: 'Limpeza',    cor: '#14b8a6' },
  { v: 'decoracao',  label: 'Decoração',  cor: '#a855f7' },
  { v: 'cerimonia',  label: 'Cerimônia',  cor: '#8b5cf6' },
  { v: 'pos',        label: 'Pós-evento', cor: '#0ea5e9' },
  { v: 'outro',      label: 'Outro',      cor: '#94a3b8' },
]
const CAT_BY = Object.fromEntries(CATEGORIAS.map((c) => [c.v, c])) as Record<string, (typeof CATEGORIAS)[number]>
export function categoriaLabel(v: string | null): string { return CAT_BY[v || 'outro']?.label || v || '—' }
export function categoriaCor(v: string | null): string { return CAT_BY[v || 'outro']?.cor || '#94a3b8' }

export const RESPONSAVEIS: { v: ResponsavelTipo; label: string }[] = [
  { v: 'producao',   label: 'Produção' },
  { v: 'equipe',     label: 'Equipe' },
  { v: 'fornecedor', label: 'Fornecedor' },
  { v: 'cliente',    label: 'Cliente' },
]
const RESP_BY = Object.fromEntries(RESPONSAVEIS.map((r) => [r.v, r])) as Record<string, (typeof RESPONSAVEIS)[number]>
export function responsavelLabel(v: string | null): string { return RESP_BY[v || 'producao']?.label || v || '—' }

export type StatusMeta = { label: string; chip: string; dot: string; ordem: number }
export const TAREFA_STATUS_META: Record<string, StatusMeta> = {
  pendente:  { label: 'Pendente',   chip: 'bg-gray-100 text-gray-600',      dot: 'bg-gray-300',    ordem: 0 },
  fazendo:   { label: 'Fazendo',    chip: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-400',     ordem: 1 },
  concluida: { label: 'Concluída',  chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', ordem: 2 },
  cancelada: { label: 'Cancelada',  chip: 'bg-red-50 text-red-700',         dot: 'bg-red-300',     ordem: 3 },
}
export function tarefaStatusMeta(v: string): StatusMeta {
  return TAREFA_STATUS_META[v] || { label: v, chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300', ordem: 9 }
}
/** Colunas do Kanban (ordem de exibição). */
export const KANBAN_COLS: TarefaStatus[] = ['pendente', 'fazendo', 'concluida']

export const PRODUCAO_STATUS_META: Record<string, { label: string; chip: string }> = {
  planejamento: { label: 'Planejamento', chip: 'bg-amber-50 text-amber-700' },
  pronto:       { label: 'Pronto',       chip: 'bg-emerald-50 text-emerald-700' },
  em_execucao:  { label: 'Em execução',  chip: 'bg-sky-50 text-sky-700' },
  encerrado:    { label: 'Encerrado',    chip: 'bg-gray-100 text-gray-600' },
}

export const PRIORIDADE_META: Record<string, { label: string; chip: string; peso: number }> = {
  baixa:   { label: 'Baixa',   chip: 'bg-gray-100 text-gray-500',   peso: 0 },
  normal:  { label: 'Normal',  chip: 'bg-blue-50 text-blue-700',    peso: 1 },
  alta:    { label: 'Alta',    chip: 'bg-amber-50 text-amber-700',  peso: 2 },
  critica: { label: 'Crítica', chip: 'bg-red-50 text-red-700',      peso: 3 },
}

// ── Predicados de status ─────────────────────────────────────────────────────
export function tarefaConcluida(t: Pick<Tarefa, 'status'>): boolean { return t.status === 'concluida' }
export function tarefaAberta(t: Pick<Tarefa, 'status'>): boolean { return t.status !== 'concluida' && t.status !== 'cancelada' }

// ── Dependências (bloqueiam a ordem de execução) ─────────────────────────────
/** A tarefa tem uma dependência ainda NÃO concluída? (→ não pode iniciar/concluir) */
export function dependenciaPendente(
  t: Pick<Tarefa, 'depende_de'>,
  byId: Map<string, Pick<Tarefa, 'status'>>,
): boolean {
  if (!t.depende_de) return false
  const dep = byId.get(t.depende_de)
  if (!dep) return false        // dependência removida → não bloqueia
  return dep.status !== 'concluida'
}
/** Pode CONCLUIR a tarefa? Só se a dependência (se houver) já estiver concluída. */
export function podeConcluir(
  t: Pick<Tarefa, 'depende_de'>,
  byId: Map<string, Pick<Tarefa, 'status'>>,
): boolean {
  return !dependenciaPendente(t, byId)
}
/**
 * Definir `dependeDe` em `tarefaId` criaria um CICLO? Percorre a cadeia de
 * dependências a partir do alvo; se voltar à tarefa, é ciclo. Também barra
 * auto-dependência. Determinístico, O(n) com guarda de visita.
 */
export function criaCiclo(
  tarefaId: string,
  dependeDe: string | null,
  byId: Map<string, Pick<Tarefa, 'id' | 'depende_de'>>,
): boolean {
  if (!dependeDe) return false
  if (dependeDe === tarefaId) return true
  const visit = new Set<string>()
  let cur: string | null = dependeDe
  while (cur) {
    if (cur === tarefaId) return true
    if (visit.has(cur)) break       // já há ciclo pré-existente em outro ramo
    visit.add(cur)
    cur = byId.get(cur)?.depende_de ?? null
  }
  return false
}

// ── Prontidão da checklist (% de prontidão + pendências críticas) ────────────
export type Prontidao = {
  total: number          // tarefas que contam (exclui canceladas)
  concluidas: number
  fazendo: number
  pendentes: number
  fracao: number         // concluidas / total (0..1)
  criticasAbertas: number
  atrasadas: number
}
/**
 * Resumo de prontidão de uma checklist. `hojeYMD` (injetado) define o que está
 * ATRASADO (prazo < hoje e não concluída). Pendência crítica = aberta com
 * prioridade alta/crítica OU atrasada.
 */
export function prontidao(tarefas: Tarefa[], hojeYMD?: string): Prontidao {
  let total = 0, concluidas = 0, fazendo = 0, pendentes = 0, criticasAbertas = 0, atrasadas = 0
  for (const t of tarefas) {
    if (t.status === 'cancelada') continue
    total++
    if (t.status === 'concluida') { concluidas++; continue }
    if (t.status === 'fazendo') fazendo++; else pendentes++
    const atrasada = !!(hojeYMD && t.prazo && t.prazo < hojeYMD)
    if (atrasada) atrasadas++
    const altaPrio = t.prioridade === 'alta' || t.prioridade === 'critica'
    if (altaPrio || atrasada) criticasAbertas++
  }
  return { total, concluidas, fazendo, pendentes, fracao: total > 0 ? concluidas / total : 0, criticasAbertas, atrasadas }
}

/** Tarefas que precisam de atenção: abertas, ordenadas por (atraso, prioridade, prazo). */
export function tarefasCriticas(tarefas: Tarefa[], hojeYMD?: string): Tarefa[] {
  const pesoPrio = (p: string) => PRIORIDADE_META[p]?.peso ?? 1
  return tarefas
    .filter((t) => tarefaAberta(t))
    .map((t) => ({ t, atrasada: !!(hojeYMD && t.prazo && t.prazo < hojeYMD) }))
    .filter((x) => x.atrasada || x.t.prioridade === 'alta' || x.t.prioridade === 'critica')
    .sort((a, b) =>
      Number(b.atrasada) - Number(a.atrasada) ||
      pesoPrio(b.t.prioridade) - pesoPrio(a.t.prioridade) ||
      (a.t.prazo || '9999').localeCompare(b.t.prazo || '9999'))
    .map((x) => x.t)
}

// ── Agrupamentos da checklist ────────────────────────────────────────────────
export function agruparPorStatus(tarefas: Tarefa[]): Record<string, Tarefa[]> {
  const out: Record<string, Tarefa[]> = { pendente: [], fazendo: [], concluida: [], cancelada: [] }
  for (const t of [...tarefas].sort((a, b) => a.ordem - b.ordem)) (out[t.status] ||= []).push(t)
  return out
}
export function agruparPorCategoria(tarefas: Tarefa[]): { categoria: string; tarefas: Tarefa[] }[] {
  const m = new Map<string, Tarefa[]>()
  for (const t of tarefas) { const arr = m.get(t.categoria) || []; arr.push(t); m.set(t.categoria, arr) }
  const ordenadas: string[] = CATEGORIAS.map((c) => c.v as string).filter((v) => m.has(v))
  const extras: string[] = [...m.keys()].filter((k) => !CAT_BY[k])
  return [...ordenadas, ...extras].map((categoria) => ({
    categoria, tarefas: (m.get(categoria) || []).sort((a, b) => a.ordem - b.ordem),
  }))
}

// ── Run-of-show (cronograma operacional) ─────────────────────────────────────
/** Ordena por (data, horário, ordem) — a sequência de execução do dia. */
export function ordenarRunshow(items: RunshowItem[]): RunshowItem[] {
  return [...items].sort((a, b) =>
    (a.data || '').localeCompare(b.data || '') ||
    hhmmToMin(a.horario) - hhmmToMin(b.horario) ||
    a.ordem - b.ordem)
}
/** Minuto-do-dia do FIM de um item (início + duração), sem normalizar overflow. */
export function fimMin(item: Pick<RunshowItem, 'horario' | 'duracao_min'>): number {
  return hhmmToMin(item.horario) + Math.max(0, Number(item.duracao_min) || 0)
}
/** Soma das durações (minutos) de um conjunto de itens. */
export function duracaoTotalMin(items: Pick<RunshowItem, 'duracao_min'>[]): number {
  return items.reduce((s, i) => s + Math.max(0, Number(i.duracao_min) || 0), 0)
}
/** Progresso do run-show (itens concluídos / total) — alimenta o modo dia-do-evento. */
export function progressoRunshow(items: Pick<RunshowItem, 'concluido'>[]): { feitos: number; total: number; fracao: number } {
  const total = items.length
  const feitos = items.reduce((s, i) => s + (i.concluido ? 1 : 0), 0)
  return { feitos, total, fracao: total > 0 ? feitos / total : 0 }
}
/**
 * Conflitos de cronograma: pares de itens na MESMA área (e mesmo dia) cujos
 * intervalos [início, fim) se sobrepõem. Itens sem área não conflitam (recurso
 * compartilhado indefinido). Critério de aceite: a timeline aponta choques.
 */
export function conflitosRunshow(items: RunshowItem[]): { a: RunshowItem; b: RunshowItem }[] {
  const out: { a: RunshowItem; b: RunshowItem }[] = []
  const ord = ordenarRunshow(items.filter((i) => (i.area || '').trim()))
  for (let i = 0; i < ord.length; i++) {
    for (let j = i + 1; j < ord.length; j++) {
      const a = ord[i], b = ord[j]
      if ((a.data || '') !== (b.data || '')) continue
      if ((a.area || '').trim().toLowerCase() !== (b.area || '').trim().toLowerCase()) continue
      if (hhmmToMin(b.horario) < fimMin(a)) out.push({ a, b })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES por tipo de evento — geram checklist + run-show prontos.
// Cada template tem TAREFAS (prazo relativo à data do evento, em dias; negativo =
// antes) e itens de RUN-SHOW (offset em minutos relativo ao início; negativo =
// antes da abertura). Dependências por `chave` interna (resolvidas na geração).
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateKey = 'casamento' | 'corporativo' | 'show' | 'corrida' | 'feira' | 'aniversario' | 'generico'

type TplTarefa = {
  chave: string
  titulo: string
  categoria: Categoria
  responsavel: ResponsavelTipo
  prazoOffsetDias: number
  prioridade?: Prioridade
  depende?: string           // chave de outra TplTarefa
}
type TplRunshow = {
  offsetMin: number
  duracaoMin: number
  atividade: string
  area?: string
  recurso?: string
  responsavel?: string
}
type Template = { key: TemplateKey; nome: string; tarefas: TplTarefa[]; runshow: TplRunshow[] }

// Blocos reutilizados por vários templates (montagem, encerramento, pós).
const TAR_MONTAGEM: TplTarefa[] = [
  { chave: 'briefing',   titulo: 'Fechar briefing com o cliente',          categoria: 'comercial',  responsavel: 'producao',   prazoOffsetDias: -14, prioridade: 'alta' },
  { chave: 'fornec',     titulo: 'Confirmar fornecedores e ordens de serviço', categoria: 'logistica', responsavel: 'producao', prazoOffsetDias: -7, prioridade: 'alta', depende: 'briefing' },
  { chave: 'escala',     titulo: 'Definir equipe e escala do dia',         categoria: 'logistica',  responsavel: 'producao',   prazoOffsetDias: -5, depende: 'briefing' },
  { chave: 'montagem',   titulo: 'Montagem da estrutura',                  categoria: 'logistica',  responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta', depende: 'fornec' },
  { chave: 'checktec',   titulo: 'Checagem técnica (som/luz/energia)',     categoria: 'tecnico',    responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta', depende: 'montagem' },
]
const TAR_POS: TplTarefa[] = [
  { chave: 'desmontagem', titulo: 'Desmontagem e devolução de equipamentos', categoria: 'pos', responsavel: 'fornecedor', prazoOffsetDias: 1 },
  { chave: 'limpeza_pos', titulo: 'Limpeza final e vistoria do espaço',      categoria: 'limpeza', responsavel: 'equipe',  prazoOffsetDias: 1 },
  { chave: 'feedback',    titulo: 'Coletar feedback e lições aprendidas',    categoria: 'pos', responsavel: 'producao',     prazoOffsetDias: 2 },
  { chave: 'acerto',      titulo: 'Acerto financeiro do evento',             categoria: 'comercial', responsavel: 'producao', prazoOffsetDias: 3 },
]

const TEMPLATES: Record<TemplateKey, Template> = {
  casamento: {
    key: 'casamento', nome: 'Casamento',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'decor',   titulo: 'Montagem da decoração e cerimonial', categoria: 'decoracao', responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'montagem' },
      { chave: 'buffet',  titulo: 'Buffet: mise en place e bar',        categoria: 'AeB',       responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'montagem' },
      { chave: 'seg',     titulo: 'Briefing de segurança e brigada',    categoria: 'seguranca', responsavel: 'equipe',     prazoOffsetDias: 0 },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -120, duracaoMin: 90, atividade: 'Recepção da equipe e checagem final', area: 'Geral', responsavel: 'Coordenação' },
      { offsetMin: -30,  duracaoMin: 30, atividade: 'Abertura dos portões / recepção dos convidados', area: 'Recepção', responsavel: 'Recepção' },
      { offsetMin: 0,    duracaoMin: 40, atividade: 'Cerimônia', area: 'Cerimônia', recurso: 'Som', responsavel: 'Cerimonialista' },
      { offsetMin: 45,   duracaoMin: 60, atividade: 'Coquetel de recepção', area: 'Bar', recurso: 'Bar', responsavel: 'Buffet' },
      { offsetMin: 105,  duracaoMin: 20, atividade: 'Entrada dos noivos / primeira dança', area: 'Pista', recurso: 'Som/Luz', responsavel: 'DJ' },
      { offsetMin: 125,  duracaoMin: 75, atividade: 'Jantar', area: 'Salão', recurso: 'Buffet', responsavel: 'Buffet' },
      { offsetMin: 200,  duracaoMin: 30, atividade: 'Cortar o bolo e brinde', area: 'Salão', responsavel: 'Cerimonialista' },
      { offsetMin: 230,  duracaoMin: 180, atividade: 'Pista / balada', area: 'Pista', recurso: 'Som/Luz', responsavel: 'DJ' },
      { offsetMin: 410,  duracaoMin: 30, atividade: 'Encerramento e saída dos convidados', area: 'Geral', responsavel: 'Coordenação' },
    ],
  },
  corporativo: {
    key: 'corporativo', nome: 'Corporativo / Congresso',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'credenc', titulo: 'Montar credenciamento e listas',     categoria: 'logistica', responsavel: 'equipe',     prazoOffsetDias: 0, depende: 'montagem' },
      { chave: 'av',      titulo: 'Passagem de slides e AV com palestrantes', categoria: 'tecnico', responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'checktec' },
      { chave: 'coffee',  titulo: 'Coffee break / catering',            categoria: 'AeB',       responsavel: 'fornecedor', prazoOffsetDias: 0 },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -90, duracaoMin: 60, atividade: 'Abertura do credenciamento', area: 'Credenciamento', responsavel: 'Recepção' },
      { offsetMin: 0,   duracaoMin: 15, atividade: 'Abertura oficial', area: 'Auditório', recurso: 'Som/Projeção', responsavel: 'Mestre de cerimônias' },
      { offsetMin: 15,  duracaoMin: 60, atividade: 'Palestra principal (keynote)', area: 'Auditório', recurso: 'Projeção', responsavel: 'Palestrante' },
      { offsetMin: 75,  duracaoMin: 30, atividade: 'Coffee break', area: 'Foyer', recurso: 'Catering', responsavel: 'Buffet' },
      { offsetMin: 105, duracaoMin: 90, atividade: 'Painéis / palestras paralelas', area: 'Salas', recurso: 'Projeção' },
      { offsetMin: 195, duracaoMin: 60, atividade: 'Almoço / networking', area: 'Restaurante', recurso: 'Catering', responsavel: 'Buffet' },
      { offsetMin: 255, duracaoMin: 90, atividade: 'Sessão da tarde', area: 'Auditório', recurso: 'Projeção' },
      { offsetMin: 345, duracaoMin: 20, atividade: 'Encerramento e agradecimentos', area: 'Auditório', recurso: 'Som', responsavel: 'Mestre de cerimônias' },
    ],
  },
  show: {
    key: 'show', nome: 'Show / Festival',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'palco',   titulo: 'Montagem de palco e backline',       categoria: 'tecnico',   responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta', depende: 'montagem' },
      { chave: 'passsom', titulo: 'Passagem de som das atrações',       categoria: 'tecnico',   responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta', depende: 'palco' },
      { chave: 'portoes', titulo: 'Plano de portões e controle de acesso', categoria: 'seguranca', responsavel: 'equipe',  prazoOffsetDias: 0, prioridade: 'alta' },
      { chave: 'bar',     titulo: 'Bares e pontos de venda',            categoria: 'AeB',       responsavel: 'fornecedor', prazoOffsetDias: 0 },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -240, duracaoMin: 120, atividade: 'Passagem de som', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Técnico de palco' },
      { offsetMin: -60,  duracaoMin: 60,  atividade: 'Abertura dos portões', area: 'Portões', responsavel: 'Segurança' },
      { offsetMin: 0,    duracaoMin: 45,  atividade: 'Atração de abertura', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Palco' },
      { offsetMin: 45,   duracaoMin: 30,  atividade: 'Virada de palco', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Técnico de palco' },
      { offsetMin: 75,   duracaoMin: 60,  atividade: 'Atração intermediária', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Palco' },
      { offsetMin: 135,  duracaoMin: 30,  atividade: 'Virada de palco', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Técnico de palco' },
      { offsetMin: 165,  duracaoMin: 90,  atividade: 'Headliner', area: 'Palco', recurso: 'Som/Luz', responsavel: 'Palco' },
      { offsetMin: 255,  duracaoMin: 45,  atividade: 'Esvaziamento e encerramento', area: 'Geral', responsavel: 'Segurança' },
    ],
  },
  corrida: {
    key: 'corrida', nome: 'Corrida / Esportivo',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'percurso', titulo: 'Sinalização e isolamento do percurso', categoria: 'logistica', responsavel: 'equipe', prazoOffsetDias: 0, prioridade: 'alta', depende: 'montagem' },
      { chave: 'kit',      titulo: 'Entrega de kits e numeração',         categoria: 'logistica', responsavel: 'equipe',     prazoOffsetDias: -1 },
      { chave: 'hidrata',  titulo: 'Postos de hidratação e apoio médico', categoria: 'seguranca', responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta' },
      { chave: 'cronom',   titulo: 'Cronometragem e largada',             categoria: 'tecnico',   responsavel: 'fornecedor', prazoOffsetDias: 0, prioridade: 'alta' },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -90, duracaoMin: 60, atividade: 'Concentração e aquecimento', area: 'Largada', responsavel: 'Coordenação' },
      { offsetMin: -15, duracaoMin: 15, atividade: 'Alinhamento dos pelotões', area: 'Largada', responsavel: 'Coordenação' },
      { offsetMin: 0,   duracaoMin: 5,  atividade: 'Largada', area: 'Largada', recurso: 'Som', responsavel: 'Cronometragem' },
      { offsetMin: 5,   duracaoMin: 115, atividade: 'Prova em percurso', area: 'Percurso', responsavel: 'Apoio' },
      { offsetMin: 40,  duracaoMin: 90, atividade: 'Chegada dos atletas', area: 'Chegada', recurso: 'Som', responsavel: 'Cronometragem' },
      { offsetMin: 150, duracaoMin: 40, atividade: 'Premiação', area: 'Palco', recurso: 'Som', responsavel: 'Coordenação' },
      { offsetMin: 190, duracaoMin: 30, atividade: 'Encerramento', area: 'Geral', responsavel: 'Coordenação' },
    ],
  },
  feira: {
    key: 'feira', nome: 'Feira / Exposição',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'estandes', titulo: 'Montagem de estandes e expositores', categoria: 'logistica', responsavel: 'fornecedor', prazoOffsetDias: -1, prioridade: 'alta', depende: 'montagem' },
      { chave: 'credenc',  titulo: 'Credenciamento de visitantes',       categoria: 'logistica', responsavel: 'equipe',     prazoOffsetDias: 0 },
      { chave: 'praca',    titulo: 'Praça de alimentação',               categoria: 'AeB',       responsavel: 'fornecedor', prazoOffsetDias: 0 },
      { chave: 'limpcont', titulo: 'Limpeza contínua das áreas comuns',  categoria: 'limpeza',   responsavel: 'equipe',     prazoOffsetDias: 0 },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -120, duracaoMin: 90, atividade: 'Liberação dos expositores e checagem', area: 'Pavilhão', responsavel: 'Coordenação' },
      { offsetMin: -30,  duracaoMin: 30, atividade: 'Abertura do credenciamento', area: 'Credenciamento', responsavel: 'Recepção' },
      { offsetMin: 0,    duracaoMin: 20, atividade: 'Abertura oficial da feira', area: 'Palco', recurso: 'Som', responsavel: 'Organização' },
      { offsetMin: 20,   duracaoMin: 220, atividade: 'Visitação', area: 'Pavilhão', responsavel: 'Expositores' },
      { offsetMin: 120,  duracaoMin: 60, atividade: 'Palestra / programação do palco', area: 'Palco', recurso: 'Projeção' },
      { offsetMin: 480,  duracaoMin: 30, atividade: 'Encerramento do dia', area: 'Geral', responsavel: 'Coordenação' },
    ],
  },
  aniversario: {
    key: 'aniversario', nome: 'Aniversário / Festa',
    tarefas: [
      { chave: 'briefing', titulo: 'Fechar briefing com o cliente',     categoria: 'comercial', responsavel: 'producao',   prazoOffsetDias: -7, prioridade: 'alta' },
      { chave: 'fornec',   titulo: 'Confirmar fornecedores',            categoria: 'logistica', responsavel: 'producao',   prazoOffsetDias: -3, depende: 'briefing' },
      { chave: 'montagem', titulo: 'Montagem e decoração',              categoria: 'decoracao', responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'fornec' },
      { chave: 'buffet',   titulo: 'Buffet e bar',                      categoria: 'AeB',       responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'montagem' },
      { chave: 'checktec', titulo: 'Checagem de som e iluminação',      categoria: 'tecnico',   responsavel: 'fornecedor', prazoOffsetDias: 0, depende: 'montagem' },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -90, duracaoMin: 60, atividade: 'Montagem final e checagem', area: 'Geral', responsavel: 'Coordenação' },
      { offsetMin: 0,   duracaoMin: 60, atividade: 'Recepção dos convidados', area: 'Recepção', recurso: 'Som', responsavel: 'Recepção' },
      { offsetMin: 60,  duracaoMin: 30, atividade: 'Entrada do aniversariante', area: 'Salão', recurso: 'Som/Luz', responsavel: 'DJ' },
      { offsetMin: 90,  duracaoMin: 60, atividade: 'Jantar / buffet', area: 'Salão', recurso: 'Buffet', responsavel: 'Buffet' },
      { offsetMin: 150, duracaoMin: 30, atividade: 'Parabéns e bolo', area: 'Salão', responsavel: 'Cerimonial' },
      { offsetMin: 180, duracaoMin: 150, atividade: 'Pista', area: 'Pista', recurso: 'Som/Luz', responsavel: 'DJ' },
      { offsetMin: 330, duracaoMin: 30, atividade: 'Encerramento', area: 'Geral', responsavel: 'Coordenação' },
    ],
  },
  generico: {
    key: 'generico', nome: 'Evento (genérico)',
    tarefas: [
      ...TAR_MONTAGEM,
      { chave: 'limpeza', titulo: 'Limpeza pré-evento', categoria: 'limpeza', responsavel: 'equipe', prazoOffsetDias: 0 },
      ...TAR_POS,
    ],
    runshow: [
      { offsetMin: -90, duracaoMin: 90, atividade: 'Montagem final e checagem', area: 'Geral', responsavel: 'Coordenação' },
      { offsetMin: -15, duracaoMin: 15, atividade: 'Abertura / recepção', area: 'Recepção', responsavel: 'Recepção' },
      { offsetMin: 0,   duracaoMin: 30, atividade: 'Abertura oficial', area: 'Principal', recurso: 'Som', responsavel: 'Coordenação' },
      { offsetMin: 30,  duracaoMin: 180, atividade: 'Programação principal', area: 'Principal', recurso: 'Som/Luz' },
      { offsetMin: 210, duracaoMin: 30, atividade: 'Encerramento', area: 'Geral', responsavel: 'Coordenação' },
    ],
  },
}

/** Lista de templates disponíveis (p/ a UI escolher manualmente). */
export function listarTemplates(): { key: TemplateKey; nome: string }[] {
  return Object.values(TEMPLATES).map((t) => ({ key: t.key, nome: t.nome }))
}

/** Mapeia o `tipo_evento` livre do CRM para a chave de template mais próxima. */
export function templateKeyParaTipo(tipo: string | null | undefined): TemplateKey {
  const t = (tipo || '').toLowerCase()
  if (/casa|wedding|noiv|matr/.test(t)) return 'casamento'
  if (/corp|congress|empres|conven|workshop|palestra|semin/.test(t)) return 'corporativo'
  if (/show|festiv|music|balad|dj/.test(t)) return 'show'
  if (/corrid|maraton|run|ciclis|espor|atlet/.test(t)) return 'corrida'
  if (/feir|expo|exposi|estand|congress/.test(t)) return 'feira'
  if (/anivers|festa|debut|15\s*anos|infantil|formatura/.test(t)) return 'aniversario'
  return 'generico'
}

// Saídas concretas da geração (a /api/producao grava; depende_de resolvido por título).
export type TarefaGerada = {
  titulo: string
  categoria: Categoria
  responsavel: ResponsavelTipo
  prazo: string | null
  prioridade: Prioridade
  dependeTitulo: string | null
  ordem: number
}
export type RunshowGerado = {
  data: string | null
  horario: string
  duracao_min: number
  atividade: string
  area: string | null
  recurso: string | null
  responsavel: string | null
  ordem: number
}

/**
 * Gera as TAREFAS concretas de um template, com `prazo` calculado a partir da
 * data do evento e a dependência expressa pelo TÍTULO da tarefa-pai (estável e
 * único dentro do template → a API resolve título→id após inserir).
 */
export function gerarTarefasDoTemplate(key: TemplateKey, eventoDataYMD: string | null): TarefaGerada[] {
  const tpl = TEMPLATES[key] || TEMPLATES.generico
  const tituloPorChave = new Map(tpl.tarefas.map((t) => [t.chave, t.titulo]))
  return tpl.tarefas.map((t, i) => ({
    titulo: t.titulo,
    categoria: t.categoria,
    responsavel: t.responsavel,
    prazo: eventoDataYMD ? addDiasYMD(eventoDataYMD, t.prazoOffsetDias) : null,
    prioridade: t.prioridade || 'normal',
    dependeTitulo: t.depende ? tituloPorChave.get(t.depende) || null : null,
    ordem: i,
  }))
}

/**
 * Gera os ITENS de RUN-SHOW de um template, com horário/data a partir do
 * horário de início do evento (overflow de dia tratado). `eventoDataYMD` é o
 * dia-base; itens antes da abertura ou após a meia-noite ajustam a data.
 */
export function gerarRunshowDoTemplate(
  key: TemplateKey,
  inicioHHMM: string,
  eventoDataYMD: string | null,
): RunshowGerado[] {
  const tpl = TEMPLATES[key] || TEMPLATES.generico
  const start = inicioHHMM && /^\d{1,2}:\d{2}/.test(inicioHHMM) ? inicioHHMM : '18:00'
  return tpl.runshow.map((r, i) => {
    const { horario, diaDelta } = somarHorario(start, r.offsetMin)
    return {
      data: eventoDataYMD ? addDiasYMD(eventoDataYMD, diaDelta) : null,
      horario,
      duracao_min: r.duracaoMin,
      atividade: r.atividade,
      area: r.area || null,
      recurso: r.recurso || null,
      responsavel: r.responsavel || null,
      ordem: i,
    }
  })
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}
