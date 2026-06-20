// Relatórios & BI — carga de dados + helpers da página /painel/relatorios.
// ─────────────────────────────────────────────────────────────────────────────
// Carrega UMA vez (janela ampla) as tabelas-fonte já existentes, escopadas por
// usuario_id, e normaliza para os tipos que a engine PURA lib/bi.ts consome. A
// página fatia por período/propriedade/tipo via useMemo — fonte única → números
// consistentes entre todos os dashboards. Tabelas-fonte ausentes degradam para
// lista vazia (o dashboard mostra "sem dados", nunca quebra). O needsSetup do
// MÓDULO trata só as tabelas próprias do BI (relatorios_salvos/_agendados).

import { supabase as sb } from '@/lib/supabase'
import { formatMoneyShort, formatPercent, formatNumber, formatDate } from '@/lib/format'
import {
  type EventoBI, type LancamentoBI, type ParcelaBI, type ReservaBI, type EspacoBI,
  type RespostaNpsBI, type AvaliacaoBI, type FeedbackBI, type BlocoOcupacao,
  type Dimensao, type Metrica, type Frequencia, type Range,
  isMissingTable, stageRank, toYMD, noRange,
  funilComercial, calcularOcupacao, revpas, receitaPorM2, receitaPorEvento, calcularNps, montarBlocosOcupacao,
} from '@/lib/bi'

// ── Tipos do construtor / agendamento (espelham docs/sql/relatorios.sql) ──────
export type ChartTipo = 'tabela' | 'barras' | 'rosca'
export type ConstrutorConfig = {
  dimensao: Dimensao
  metrica: Metrica
  chart: ChartTipo
  periodo?: string
  prop?: number | null
  tipo?: string | null
}
export type RelatorioSalvo = { id: string; nome: string; descricao: string | null; config: ConstrutorConfig; criado_em?: string }
export type RelatorioAgendado = {
  id: string
  nome: string
  relatorio_id: string | null
  dashboard: string | null
  formato: 'pdf' | 'excel' | 'csv'
  frequencia: Frequencia
  dia_semana: number | null
  dia_mes: number | null
  destinatarios: string[]
  ativo: boolean
  ultima_exec: string | null
  proxima_exec: string | null
}

// ── Tipos da página ──────────────────────────────────────────────────────────
export type Prop = { id: number; nome: string | null; categoria: string | null; capacidade: number | null }
export type LancRow = LancamentoBI & { prop_id: number | null }
export type ParcelaRow = ParcelaBI & { evento_id: string | null }
export type ReservaRow = ReservaBI

export type DadosBI = {
  propriedades: Prop[]
  espacos: EspacoBI[]
  eventos: EventoBI[]
  lancamentos: LancRow[]
  parcelas: ParcelaRow[]
  reservas: ReservaRow[]
  comProposta: Set<string>
  assinadoEm: Map<string, string>
  avaliacoes: AvaliacaoBI[]
  nps: RespostaNpsBI[]
  feedbacks: FeedbackBI[]
}

export const DADOS_VAZIO: DadosBI = {
  propriedades: [], espacos: [], eventos: [], lancamentos: [], parcelas: [],
  reservas: [], comProposta: new Set(), assinadoEm: new Map(), avaliacoes: [], nps: [], feedbacks: [],
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

// Carga tolerante: cada select pode falhar (tabela ausente/sem permissão) sem
// derrubar a página — retorna [] e o dashboard correspondente degrada.
async function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data } = await p; return (data || []) as T[] } catch { return [] }
}

/** Carrega o dataset completo do BI (janela ampla) escopado ao dono. */
export async function carregarBI(uid: string): Promise<DadosBI> {
  // Fase 1 — propriedades/espaços (precisamos dos ids p/ escopar avaliações).
  const [propsRaw, espacosRaw] = await Promise.all([
    safe<{ id: number; nome: string | null; categoria: string | null; capacidade: number | null }>(
      sb.from('propriedades').select('id,nome,categoria,capacidade').eq('usuario_id', uid).order('id')),
    safe<{ id: number; propriedade_id: number | null; nome: string | null; capacidade: number | null; area_m2: number | null }>(
      sb.from('espacos').select('id,propriedade_id,nome,capacidade,area_m2').eq('usuario_id', uid).order('id')),
  ])
  const propriedades: Prop[] = propsRaw.map((p) => ({ id: Number(p.id), nome: p.nome, categoria: p.categoria, capacidade: num(p.capacidade) }))
  const espacos: EspacoBI[] = espacosRaw.map((e) => ({ id: Number(e.id), propriedade_id: e.propriedade_id, nome: e.nome, capacidade: num(e.capacidade), area_m2: num(e.area_m2) }))
  const propIds = propriedades.map((p) => p.id)

  // Fase 2 — o resto em paralelo.
  const [eventosRaw, lancRaw, parcRaw, resRaw, propostasRaw, contratosRaw, avalRaw, npsRaw, fbRaw] = await Promise.all([
    safe<EventoBI>(sb.from('clientes_eventos')
      .select('id,nome_evento,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,qtd_adultos,qtd_criancas,quem_contratou,cliente_id,como_conheceu,criado_em')
      .eq('usuario_id', uid)),
    safe<LancRow>(sb.from('lancamentos').select('tipo,valor,data,categoria,tipo_evento,status,prop_id').eq('usuario_id', uid)),
    safe<ParcelaRow>(sb.from('parcelas').select('evento_id,valor,vencimento,status,pago_em').eq('usuario_id', uid)),
    safe<ReservaRow>(sb.from('reservas').select('espaco_id,propriedade_id,status,inicio,fim,data_inicio,data_fim').eq('usuario_id', uid).limit(8000)),
    safe<{ evento_id: string | null; status: string | null }>(sb.from('propostas').select('evento_id,status').eq('usuario_id', uid)),
    safe<{ evento_id: string | null; status: string | null; assinado_em: string | null }>(sb.from('contratos').select('evento_id,status,assinado_em').eq('usuario_id', uid)),
    propIds.length ? safe<AvaliacaoBI>(sb.from('avaliacoes').select('nota,propriedade_id,criado_em').in('propriedade_id', propIds)) : Promise.resolve([] as AvaliacaoBI[]),
    safe<RespostaNpsBI>(sb.from('pesquisas_respostas').select('nps,criado_em').eq('usuario_id', uid)),
    safe<FeedbackBI>(sb.from('feedbacks').select('nota_geral,criado_em').eq('usuario_id', uid)),
  ])

  const eventos: EventoBI[] = eventosRaw.map((e) => ({ ...e, valor_total_num: num(e.valor_total_num) }))
  const lancamentos: LancRow[] = lancRaw.map((l) => ({ ...l, valor: Number(l.valor) || 0 }))
  const parcelas: ParcelaRow[] = parcRaw.map((p) => ({ ...p, valor: Number(p.valor) || 0 }))

  const comProposta = new Set<string>()
  propostasRaw.forEach((p) => { if (p.evento_id && (p.status || '').toLowerCase() !== 'rascunho') comProposta.add(p.evento_id) })
  const assinadoEm = new Map<string, string>()
  contratosRaw.forEach((c) => { if (c.evento_id && (c.status || '').toLowerCase() === 'assinado') assinadoEm.set(c.evento_id, c.assinado_em || '') })

  return { propriedades, espacos, eventos, lancamentos, parcelas, reservas: resRaw, comProposta, assinadoEm, avaliacoes: avalRaw, nps: npsRaw, feedbacks: fbRaw }
}

/**
 * Aplica os filtros globais (propriedade + tipo de evento) a TODAS as fontes de
 * forma consistente — inclusive parcelas (escopadas via evento_id → propriedade/
 * tipo). avaliacoes seguem o filtro de propriedade; NPS/feedbacks são da conta
 * (sem vínculo de propriedade/tipo no recorte carregado). NÃO aplica período —
 * cada dashboard fatia por data com o campo certo.
 */
export function filtrarDados(d: DadosBI, propFiltro: number | null, tipoFiltro: string | null): DadosBI {
  const tipoOk = (t: string | null | undefined) => !tipoFiltro || (t || '').trim() === tipoFiltro
  const propOkEvt = (p: number | null | undefined) => propFiltro == null || p === propFiltro

  const eventos = d.eventos.filter((e) => propOkEvt(e.propriedade_id) && tipoOk(e.tipo_evento))
  const eventoMeta = new Map(d.eventos.map((e) => [e.id, { prop: e.propriedade_id ?? null, tipo: (e.tipo_evento || '').trim() }]))

  return {
    ...d,
    eventos,
    lancamentos: d.lancamentos.filter((l) => (propFiltro == null || l.prop_id === propFiltro) && tipoOk(l.tipo_evento)),
    reservas: propFiltro == null ? d.reservas : d.reservas.filter((r) => r.propriedade_id === propFiltro),
    parcelas: (propFiltro == null && !tipoFiltro) ? d.parcelas : d.parcelas.filter((p) => {
      const meta = p.evento_id ? eventoMeta.get(p.evento_id) : null
      if (!meta) return false // sem evento vinculado → fora do recorte por propriedade/tipo
      return propOkEvt(meta.prop) && tipoOk(meta.tipo)
    }),
    avaliacoes: d.avaliacoes, // já escopadas às propriedades do dono na carga
  }
}

/** Lista de tipos de evento distintos (p/ o seletor de filtro). */
export function tiposDeEvento(d: DadosBI): string[] {
  const s = new Set<string>()
  d.eventos.forEach((e) => { const t = (e.tipo_evento || '').trim(); if (t) s.add(t) })
  return [...s].sort((a, b) => a.localeCompare(b))
}

/** Probe das tabelas próprias do BI (construtor/agendados). select('id') — NUNCA head:true. */
export async function checarSetup(): Promise<boolean> {
  try {
    const { error } = await sb.from('relatorios_salvos').select('id').limit(1)
    return !!(error && isMissingTable(error))
  } catch { return false }
}

// ── Gating premium (Pro+) ────────────────────────────────────────────────────
export function isPremium(plano: string | null | undefined): boolean {
  const p = (plano || 'basico').toLowerCase()
  return p === 'pro' || p === 'ultra'
}

// ── Reservas/eventos → blocos de ocupação (delega à engine pura) ─────────────
/** Blocos de ocupação do dono (reservas que ocupam + eventos contratados). */
export function blocosOcupacao(d: DadosBI, propFiltro: number | null): { blocos: BlocoOcupacao[]; nEspacos: number; areaTotal: number } {
  return montarBlocosOcupacao(d.reservas, d.eventos, d.espacos, d.propriedades, propFiltro)
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAÇÃO — CSV (manual), Excel (xlsx) e PDF (jsPDF). Estrutura genérica usada
// por dashboards e pelo construtor.
// ─────────────────────────────────────────────────────────────────────────────
export type RelatorioExport = {
  titulo: string
  subtitulo?: string
  kpis?: [string, string][]
  colunas: string[]
  linhas: (string | number)[][]
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

function slug(s: string): string {
  return (s || 'relatorio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'relatorio'
}

export function exportarCSV(rel: RelatorioExport) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = rel.colunas.map(esc).join(',')
  const body = rel.linhas.map((r) => r.map(esc).join(',')).join('\n')
  baixar(new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' }), `${slug(rel.titulo)}.csv`)
}

export async function exportarExcel(rel: RelatorioExport) {
  const XLSX = await import('xlsx')
  const aoa: (string | number)[][] = []
  aoa.push([rel.titulo])
  if (rel.subtitulo) aoa.push([rel.subtitulo])
  if (rel.kpis?.length) { aoa.push([]); rel.kpis.forEach(([k, v]) => aoa.push([k, v])) }
  aoa.push([]); aoa.push(rel.colunas); rel.linhas.forEach((r) => aoa.push(r))
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, `${slug(rel.titulo)}.xlsx`)
}

export async function exportarPDF(rel: RelatorioExport) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56
  doc.setFontSize(20); doc.setTextColor('#ff385c'); doc.text('VENTSY', M, y)
  doc.setFontSize(13); doc.setTextColor('#222'); doc.text(rel.titulo, M, y + 22)
  if (rel.subtitulo) { doc.setFontSize(9.5); doc.setTextColor('#888'); doc.text(rel.subtitulo, M, y + 38) }
  y += 70

  if (rel.kpis?.length) {
    doc.setDrawColor('#eee')
    rel.kpis.forEach(([k, v]) => {
      doc.setFontSize(10); doc.setTextColor('#888'); doc.text(k, M, y)
      doc.setFontSize(12); doc.setTextColor('#111'); doc.text(String(v), 360, y)
      doc.line(M, y + 7, 547, y + 7); y += 26
      if (y > 760) { doc.addPage(); y = 56 }
    })
    y += 8
  }

  // Tabela simples (cabeçalho + linhas), com quebra de página.
  const colW = (547 - M) / Math.max(1, rel.colunas.length)
  doc.setFillColor('#f3f4f6'); doc.rect(M, y - 12, 547 - M, 20, 'F')
  doc.setFontSize(9); doc.setTextColor('#374151')
  rel.colunas.forEach((c, i) => doc.text(String(c).slice(0, 22), M + 6 + i * colW, y + 2))
  y += 18
  doc.setTextColor('#111')
  rel.linhas.slice(0, 400).forEach((row, ri) => {
    if (ri % 2 === 1) { doc.setFillColor('#fafafa'); doc.rect(M, y - 11, 547 - M, 18, 'F') }
    row.forEach((cell, i) => doc.text(String(cell ?? '').slice(0, 24), M + 6 + i * colW, y + 1))
    y += 17
    if (y > 780) { doc.addPage(); y = 56 }
  })

  doc.setFontSize(8); doc.setTextColor('#aaa')
  doc.text(`Gerado pela Ventsy · ${new Date().toLocaleDateString('pt-BR')} · ventsy.com.br`, M, 812)
  doc.save(`${slug(rel.titulo)}.pdf`)
}

// CSS compartilhado (espelha o resto do painel)
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const PALETTE = ['#ff385c', '#10b981', '#f59e0b', '#1a73e8', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#94a3b8']
export const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Rótulo curto de 'YYYY-MM' (sem depender de locale na engine). */
export function rotuloMes(yyyymm: string): string {
  const m = Number(yyyymm.slice(5, 7))
  return `${MESES_PT[m - 1] || yyyymm} ${yyyymm.slice(2, 4)}`
}

/** Nome de uma propriedade pelo id (para rótulos e exportação). */
export function nomePropriedade(d: DadosBI, id: number | null | undefined): string {
  if (id == null) return 'Sem propriedade'
  return d.propriedades.find((p) => p.id === id)?.nome || `Espaço #${id}`
}

/**
 * KPIs de resumo executivo (formatados) — alimentam a exportação do dashboard e
 * o digest do cron. Cruza os módulos via engine pura (caixa, ocupação/RevPAS,
 * funil, NPS).
 */
export function resumoExecutivoKPIs(d: DadosBI, range: Range, hojeYMD: string): [string, string][] {
  let receita = 0, despesa = 0
  for (const l of d.lancamentos) { if (!noRange(l.data, range)) continue; if (l.tipo === 'receita') receita += l.valor; else if (l.tipo === 'despesa') despesa += l.valor }
  const lucro = receita - despesa
  const { blocos, nEspacos, areaTotal } = blocosOcupacao(d, null)
  const oc = calcularOcupacao(blocos, nEspacos, range)
  const dias = Math.max(1, oc.spaceDaysDisponiveis / Math.max(1, nEspacos))
  const eventosContratados = d.eventos.filter((e) => stageRank(e.status) >= 2 && noRange(e.data_inicio, range)).length
  const f = funilComercial(d.eventos.filter((e) => noRange(e.criado_em || e.data_inicio, range)), { comProposta: d.comProposta, assinadoEm: d.assinadoEm })
  const nps = calcularNps(d.nps.filter((r: { criado_em?: string | null }) => noRange(r.criado_em, range)))
  const rM2 = receitaPorM2(receita, areaTotal)
  return [
    ['Receita', formatMoneyShort(receita)],
    ['Despesas', formatMoneyShort(despesa)],
    ['Lucro líquido', formatMoneyShort(lucro)],
    ['Margem', receita > 0 ? formatPercent(lucro / receita) : '—'],
    ['Taxa de ocupação', formatPercent(oc.taxa)],
    ['RevPAS', formatMoneyShort(revpas(receita, nEspacos, dias))],
    ['Receita por m²', rM2 != null ? formatMoneyShort(rM2) : '—'],
    ['Receita por evento', formatMoneyShort(receitaPorEvento(receita, eventosContratados))],
    ['Leads', formatNumber(f.leads)],
    ['Contratos', formatNumber(f.contratos)],
    ['Conversão geral', formatPercent(f.convGeral)],
    ['NPS', nps.total ? String(nps.score) : '—'],
  ]
}

/** Tabela de eventos do período (colunas + linhas) para exportação. */
export function eventosTabela(d: DadosBI, range: Range): { colunas: string[]; linhas: (string | number)[][] } {
  const colunas = ['Evento', 'Tipo', 'Propriedade', 'Estágio', 'Data', 'Valor', 'Público']
  const linhas = d.eventos
    .filter((e) => noRange(e.data_inicio || e.criado_em, range))
    .sort((a, b) => (toYMD(a.data_inicio) || '').localeCompare(toYMD(b.data_inicio) || ''))
    .map((e) => [
      e.nome_evento || '—',
      e.tipo_evento || '—',
      nomePropriedade(d, e.propriedade_id),
      e.status || '—',
      e.data_inicio ? formatDate(e.data_inicio, { style: 'short' }) : '—',
      formatMoneyShort(Number(e.valor_total_num) || 0),
      (Number(e.qtd_adultos) || 0) + (Number(e.qtd_criancas) || 0),
    ] as (string | number)[])
  return { colunas, linhas }
}
