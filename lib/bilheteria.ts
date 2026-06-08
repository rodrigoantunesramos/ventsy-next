// Motor PURO de Ingressos & Bilheteria da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para a parte sem efeitos colaterais da bilheteria:
//   • PREÇO de um pedido: lotes, meia-entrada, cupom (percentual/fixo) e taxa de
//     serviço — somados na ordem certa, com arredondamento monetário estável.
//   • DISPONIBILIDADE por categoria/lote (esgota por quantidade) considerando o
//     que já foi pago + reservas ativas (não vaza assento por reserva pendente).
//   • AGREGAÇÕES de venda (receita, ingressos, ticket médio, conversão, por
//     categoria/lote/canal) e a CURVA de vendas para o gráfico.
//   • QR do ingresso (mesmo payload `VTS:` do credenciamento, p/ o check-in da
//     bilheteria e da Portaria de /painel/acesso lerem o mesmo código).
//
// É consumida por:
//   • /painel/bilheteria          (configuração, vendas, check-in, financeiro)
//   • app/(public)/ingressos/[token] (página pública de venda)
//   • /api/bilheteria/*           (checkout/ webhook/ check-in AUTORITATIVOS)
//
// Regras de ouro (espelham lib/acesso.ts / lib/reservas.ts / lib/pricing.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. A formatação
//     de moeda/data fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio/aleatoriedade escondidos na lógica de negócio.

import { gerarQrPayload, normalizarLeitura, tokenCurto } from './acesso'

// Reexporta os helpers de QR — o ingresso usa o MESMO payload das credenciais,
// então o leitor da Portaria (/painel/acesso) e o check-in da bilheteria
// reconhecem o mesmo código. Mantém um único ponto de verdade do formato do QR.
export { gerarQrPayload, normalizarLeitura, tokenCurto }

// ── Arredondamento monetário ─────────────────────────────────────────────────
/** Arredonda para 2 casas de forma estável (evita 0.1+0.2 != 0.3). */
export function money(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ── Vocabulário do domínio (espelha docs/sql/bilheteria.sql) ─────────────────
/** Estado da bilheteria (a "loja" de um evento). */
export type BilheteriaStatus = 'rascunho' | 'publicado' | 'encerrado'

/** A bilheteria de um evento — a vitrine + janela de venda. */
export type BilheteriaEvento = {
  id: string
  usuario_id?: string
  evento_id: string | null
  propriedade_id: number | null
  titulo: string
  descricao: string | null
  local_texto: string | null
  imagem_url: string | null
  capacidade: number | null            // 0/null = sem teto global (vale a soma das categorias)
  venda_inicio: string | null          // timestamptz
  venda_fim: string | null
  pagina_token: string                 // token público da página de venda
  status: BilheteriaStatus | string
  taxa_servico: number                 // fração 0..1 somada ao comprador
  moeda: string                        // BRL | USD | EUR
  campos_extras: CampoExtra[] | null   // perguntas adicionais (camiseta, carro, ANAC…)
  criado_em?: string
  atualizado_em?: string
}

/** Campo extra coletado por ingresso (corrida: camiseta; expo: modelo do carro). */
export type CampoExtra = {
  chave: string
  label: string
  tipo: 'texto' | 'opcoes' | 'numero'
  opcoes?: string[]
  obrigatorio?: boolean
}

/** Categoria/lote de ingresso. Cada linha É um (categoria × lote) com preço e
 *  quantidade próprios — é assim que o preço "sobe por lote". */
export type Categoria = {
  id: string
  usuario_id?: string
  bilheteria_id: string
  nome: string                         // 'Pista' | 'Camarote' | 'Inscrição 5k' | 'Mesa' …
  descricao: string | null
  preco_num: number
  quantidade: number                   // 0 = ilimitado
  vendido: number                      // denormalizado (trigger): pagos + check-in
  lote: number                         // 1,2,3… (onda)
  lote_nome: string | null             // '1º lote', 'Lote promocional'…
  ordem: number
  max_por_pedido: number               // 0 = sem limite por pedido
  meia: boolean                        // permite meia-entrada nesta categoria
  meia_percent: number                 // fração do preço na meia (default 0.5)
  por_pessoa: boolean                  // exige titular por ingresso (nome/doc)
  kit: Record<string, unknown> | null  // corrida: { camiseta:[...], inclui:[...] }
  venda_inicio: string | null
  venda_fim: string | null
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

/** Cupom de desconto (tabela `bilheteria_cupons`, separada do `cupons` global). */
export type Cupom = {
  id: string
  usuario_id?: string
  bilheteria_id: string
  codigo: string
  tipo: 'percentual' | 'fixo'
  valor_num: number                    // percentual: 0..100; fixo: valor na moeda
  limite: number                       // 0 = ilimitado
  usados: number
  validade: string | null              // YYYY-MM-DD (inclusive)
  ativo: boolean
  criado_em?: string
}

export type PedidoStatus = 'pendente' | 'pago' | 'cancelado' | 'reembolsado' | 'expirado'
export type CanalVenda = 'online' | 'manual' | 'cortesia'

/** Pedido (cesta de compra) — agrupa ingressos e carrega o pagamento (MP). */
export type Pedido = {
  id: string
  usuario_id?: string
  bilheteria_id: string
  comprador_nome: string
  comprador_email: string | null
  comprador_doc: string | null
  telefone: string | null
  subtotal_num: number
  desconto_num: number
  taxa_num: number
  total_num: number
  moeda: string
  cupom_id: string | null
  cupom_codigo: string | null
  status: PedidoStatus | string
  canal: CanalVenda | string
  mp_payment_id: string | null
  mp_preference_id: string | null
  mp_status: string | null
  pago_em: string | null
  criado_em: string
  atualizado_em?: string
}

export type IngressoStatus = 'reservado' | 'pago' | 'cancelado' | 'checkin'

/** Ingresso individual — 1 entrada, 1 QR. */
export type Ingresso = {
  id: string
  usuario_id?: string
  bilheteria_id: string
  pedido_id: string
  categoria_id: string
  comprador_nome: string | null
  comprador_doc: string | null
  email: string | null
  qr_token: string
  valor_num: number
  meia: boolean
  extras: Record<string, string> | null
  status: IngressoStatus | string
  credencial_id: string | null
  checkin_em: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Metadados de status (rótulo PT default + chip). i18n: label é o default. ──
export type ChipMeta = { label: string; chip: string; hex: string }

export const PEDIDO_STATUS_META: Record<string, ChipMeta> = {
  pendente:    { label: 'Pendente',    chip: 'bg-amber-50 text-amber-700',     hex: '#f59e0b' },
  pago:        { label: 'Pago',        chip: 'bg-emerald-50 text-emerald-700', hex: '#10b981' },
  cancelado:   { label: 'Cancelado',   chip: 'bg-gray-100 text-gray-500',      hex: '#9ca3af' },
  reembolsado: { label: 'Reembolsado', chip: 'bg-red-50 text-red-700',         hex: '#ef4444' },
  expirado:    { label: 'Expirado',    chip: 'bg-gray-100 text-gray-500',      hex: '#9ca3af' },
}
export function pedidoStatusMeta(s: string): ChipMeta {
  return PEDIDO_STATUS_META[s] || { label: s, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}

export const INGRESSO_STATUS_META: Record<string, ChipMeta> = {
  reservado: { label: 'Reservado', chip: 'bg-amber-50 text-amber-700',     hex: '#f59e0b' },
  pago:      { label: 'Válido',    chip: 'bg-emerald-50 text-emerald-700', hex: '#10b981' },
  checkin:   { label: 'Check-in',  chip: 'bg-blue-50 text-blue-700',       hex: '#3b82f6' },
  cancelado: { label: 'Cancelado', chip: 'bg-gray-100 text-gray-500',      hex: '#9ca3af' },
}
export function ingressoStatusMeta(s: string): ChipMeta {
  return INGRESSO_STATUS_META[s] || { label: s, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}

export const CANAL_META: Record<string, ChipMeta> = {
  online:   { label: 'Online',   chip: 'bg-sky-50 text-sky-700',         hex: '#0ea5e9' },
  manual:   { label: 'Manual',   chip: 'bg-violet-50 text-violet-700',   hex: '#7c3aed' },
  cortesia: { label: 'Cortesia', chip: 'bg-amber-50 text-amber-700',     hex: '#d97706' },
}
export function canalMeta(c: string): ChipMeta {
  return CANAL_META[c] || { label: c, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}

// ── Tempo (puro) ──────────────────────────────────────────────────────────────
export const SEGUNDO = 1000
export const MINUTO = 60 * SEGUNDO
export const HORA = 60 * MINUTO
export function parseMs(v: string | null | undefined): number | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}
/** Data-only (YYYY-MM-DD) → ms no FIM do dia local-ish (validade inclusiva). */
function fimDoDiaMs(ymd: string): number | null {
  const t = Date.parse(`${ymd}T23:59:59`)
  return Number.isNaN(t) ? null : t
}

// ── Disponibilidade / lotes ──────────────────────────────────────────────────
/**
 * Vagas restantes de uma categoria. `ocupados` = pagos + reservas ATIVAS (ainda
 * dentro da janela de hold) — assim uma reserva pendente segura o assento sem
 * inflar o "vendido" para sempre. `quantidade` 0 = ilimitado → Infinity.
 */
export function disponivel(cat: Pick<Categoria, 'quantidade'>, ocupados: number): number {
  const q = Math.max(0, Math.floor(num(cat.quantidade)))
  if (q <= 0) return Infinity
  return Math.max(0, q - Math.max(0, Math.floor(num(ocupados))))
}

export function esgotado(cat: Pick<Categoria, 'quantidade'>, ocupados: number): boolean {
  return disponivel(cat, ocupados) <= 0
}

export type MotivoIndisponivel = 'inativa' | 'fora_janela' | 'esgotado' | null
/**
 * A categoria está à venda agora? Checa ativo + janela (venda_inicio/fim) +
 * lotação. Retorna o motivo do bloqueio (ou null se à venda).
 */
export function statusCategoria(
  cat: Pick<Categoria, 'ativo' | 'venda_inicio' | 'venda_fim' | 'quantidade'>,
  ocupados: number,
  nowMs: number,
): { aVenda: boolean; motivo: MotivoIndisponivel } {
  if (!cat.ativo) return { aVenda: false, motivo: 'inativa' }
  const ini = parseMs(cat.venda_inicio)
  const fim = parseMs(cat.venda_fim)
  if (ini != null && nowMs < ini) return { aVenda: false, motivo: 'fora_janela' }
  if (fim != null && nowMs > fim) return { aVenda: false, motivo: 'fora_janela' }
  if (esgotado(cat, ocupados)) return { aVenda: false, motivo: 'esgotado' }
  return { aVenda: true, motivo: null }
}

/** A bilheteria está vendendo agora? (status publicado + janela global). */
export function bilheteriaAVenda(
  b: Pick<BilheteriaEvento, 'status' | 'venda_inicio' | 'venda_fim'>,
  nowMs: number,
): { aVenda: boolean; motivo: 'rascunho' | 'encerrada' | 'nao_iniciada' | 'encerrada_data' | null } {
  if (b.status === 'rascunho') return { aVenda: false, motivo: 'rascunho' }
  if (b.status === 'encerrado') return { aVenda: false, motivo: 'encerrada' }
  const ini = parseMs(b.venda_inicio)
  const fim = parseMs(b.venda_fim)
  if (ini != null && nowMs < ini) return { aVenda: false, motivo: 'nao_iniciada' }
  if (fim != null && nowMs > fim) return { aVenda: false, motivo: 'encerrada_data' }
  return { aVenda: true, motivo: null }
}

// ── Preço (meia, cupom, taxa de serviço) ─────────────────────────────────────
/** Preço unitário de um ingresso da categoria (aplica meia se pedida e permitida). */
export function precoUnitario(
  cat: Pick<Categoria, 'preco_num' | 'meia' | 'meia_percent'>,
  opts: { meia?: boolean } = {},
): number {
  const base = Math.max(0, num(cat.preco_num))
  if (opts.meia && cat.meia) {
    const f = cat.meia_percent > 0 && cat.meia_percent <= 1 ? cat.meia_percent : 0.5
    return money(base * f)
  }
  return money(base)
}

export type MotivoCupom = 'inexistente' | 'inativo' | 'expirado' | 'esgotado' | null
export type ValidacaoCupom = { ok: boolean; motivo: MotivoCupom }
/** Valida um cupom para uso (ativo, dentro da validade, com limite disponível). */
export function validarCupom(cupom: Cupom | null | undefined, nowMs: number): ValidacaoCupom {
  if (!cupom) return { ok: false, motivo: 'inexistente' }
  if (!cupom.ativo) return { ok: false, motivo: 'inativo' }
  if (cupom.validade) {
    const fim = fimDoDiaMs(cupom.validade)
    if (fim != null && nowMs > fim) return { ok: false, motivo: 'expirado' }
  }
  if (cupom.limite > 0 && cupom.usados >= cupom.limite) return { ok: false, motivo: 'esgotado' }
  return { ok: true, motivo: null }
}

/** Desconto (≥0, nunca maior que o subtotal) de um cupom já validado. */
export function descontoCupom(subtotal: number, cupom: Pick<Cupom, 'tipo' | 'valor_num'> | null): number {
  if (!cupom) return 0
  const sub = Math.max(0, num(subtotal))
  if (cupom.tipo === 'percentual') {
    const pct = Math.min(100, Math.max(0, num(cupom.valor_num)))
    return money(Math.min(sub, sub * (pct / 100)))
  }
  return money(Math.min(sub, Math.max(0, num(cupom.valor_num))))
}

export type ItemPedido = { categoria: Categoria; qtd: number; meia?: boolean }
export type LinhaPedido = {
  categoria_id: string
  nome: string
  lote: number
  qtd: number
  meia: boolean
  unitario: number
  total: number
}
export type Cotacao = {
  linhas: LinhaPedido[]
  itens: number                 // total de ingressos
  subtotal: number
  desconto: number
  taxa: number                  // taxa de serviço sobre (subtotal − desconto)
  total: number
  moeda: string
}

/**
 * Cota um pedido: soma os itens (com meia onde pedida), aplica o cupom sobre o
 * subtotal e a taxa de serviço sobre o líquido. Ordem: subtotal → desconto →
 * taxa → total. NÃO valida disponibilidade nem se o cupom existe — isso é do
 * checkout (server). É a mesma conta no preview público e na confirmação server.
 */
export function cotarPedido(
  itens: ItemPedido[],
  cupom: Pick<Cupom, 'tipo' | 'valor_num'> | null,
  taxaServico: number,
  moeda = 'BRL',
): Cotacao {
  const linhas: LinhaPedido[] = []
  let subtotal = 0
  let qtdTotal = 0
  for (const it of itens) {
    const qtd = Math.max(0, Math.floor(num(it.qtd)))
    if (qtd <= 0) continue
    const meia = !!it.meia && !!it.categoria.meia
    const unitario = precoUnitario(it.categoria, { meia })
    const total = money(unitario * qtd)
    subtotal = money(subtotal + total)
    qtdTotal += qtd
    linhas.push({ categoria_id: it.categoria.id, nome: it.categoria.nome, lote: it.categoria.lote, qtd, meia, unitario, total })
  }
  const desconto = descontoCupom(subtotal, cupom)
  const liquido = Math.max(0, money(subtotal - desconto))
  const taxaFrac = Math.min(1, Math.max(0, num(taxaServico)))
  const taxa = money(liquido * taxaFrac)
  const total = money(liquido + taxa)
  return { linhas, itens: qtdTotal, subtotal, desconto, taxa, total, moeda }
}

// ── Validação de itens vs. limites (server e cliente) ────────────────────────
export type ProblemaItem = {
  categoria_id: string
  motivo: 'esgotado' | 'fora_janela' | 'inativa' | 'excede_disponivel' | 'excede_max_pedido'
  disponivel?: number
}
/**
 * Confere os itens de um carrinho contra disponibilidade/janela/limite por
 * pedido. `ocupadosPorCategoria` é o nº já vendido+reservado-ativo (vem do
 * server). Retorna a lista de problemas (vazia = pode seguir para o checkout).
 */
export function validarItens(
  itens: ItemPedido[],
  ocupadosPorCategoria: Record<string, number>,
  nowMs: number,
): ProblemaItem[] {
  const problemas: ProblemaItem[] = []
  for (const it of itens) {
    const qtd = Math.max(0, Math.floor(num(it.qtd)))
    if (qtd <= 0) continue
    const cat = it.categoria
    const ocup = num(ocupadosPorCategoria[cat.id])
    const st = statusCategoria(cat, ocup, nowMs)
    if (!st.aVenda) {
      problemas.push({ categoria_id: cat.id, motivo: st.motivo === 'esgotado' ? 'esgotado' : st.motivo === 'inativa' ? 'inativa' : 'fora_janela' })
      continue
    }
    const disp = disponivel(cat, ocup)
    if (qtd > disp) { problemas.push({ categoria_id: cat.id, motivo: 'excede_disponivel', disponivel: disp === Infinity ? undefined : disp }); continue }
    if (cat.max_por_pedido > 0 && qtd > cat.max_por_pedido) {
      problemas.push({ categoria_id: cat.id, motivo: 'excede_max_pedido', disponivel: cat.max_por_pedido })
    }
  }
  return problemas
}

// ── Agregações de venda (KPIs / gráficos / financeiro) ───────────────────────
export type ResumoVendas = {
  receita: number                 // total dos pedidos PAGOS (inclui taxa)
  receitaTaxa: number             // parte da taxa de serviço nos pagos
  receitaLiquida: number          // receita − taxa
  descontos: number               // desconto concedido em pagos
  pedidosPagos: number
  pedidosPendentes: number
  ingressosVendidos: number       // ingressos pagos + checkin
  ingressosCheckin: number
  ticketMedio: number             // receita / pedidosPagos
  conversao: number               // pedidosPagos / (pagos+pendentes+cancelados…)
}
/** KPIs financeiros e de volume a partir dos pedidos e ingressos do evento. */
export function resumoVendas(pedidos: Pedido[], ingressos: Ingresso[]): ResumoVendas {
  let receita = 0, receitaTaxa = 0, descontos = 0, pagos = 0, pendentes = 0
  for (const p of pedidos) {
    if (p.status === 'pago') {
      pagos++
      receita = money(receita + num(p.total_num))
      receitaTaxa = money(receitaTaxa + num(p.taxa_num))
      descontos = money(descontos + num(p.desconto_num))
    } else if (p.status === 'pendente') pendentes++
  }
  let vendidos = 0, checkin = 0
  for (const i of ingressos) {
    if (i.status === 'pago' || i.status === 'checkin') vendidos++
    if (i.status === 'checkin') checkin++
  }
  const totalPedidos = pedidos.length
  return {
    receita,
    receitaTaxa,
    receitaLiquida: money(receita - receitaTaxa),
    descontos,
    pedidosPagos: pagos,
    pedidosPendentes: pendentes,
    ingressosVendidos: vendidos,
    ingressosCheckin: checkin,
    ticketMedio: pagos > 0 ? money(receita / pagos) : 0,
    conversao: totalPedidos > 0 ? pagos / totalPedidos : 0,
  }
}

export type VendaCategoria = { categoria_id: string; nome: string; lote: number; vendidos: number; receita: number; cor?: string }
/** Vendas agregadas por categoria/lote (para a tabela e o gráfico de barras). */
export function vendasPorCategoria(categorias: Categoria[], ingressos: Ingresso[]): VendaCategoria[] {
  const byId = new Map(categorias.map((c) => [c.id, c]))
  const acc = new Map<string, VendaCategoria>()
  for (const c of categorias) acc.set(c.id, { categoria_id: c.id, nome: c.nome, lote: c.lote, vendidos: 0, receita: 0 })
  for (const i of ingressos) {
    if (i.status !== 'pago' && i.status !== 'checkin') continue
    const cat = byId.get(i.categoria_id)
    const key = cat?.id || i.categoria_id
    const cur = acc.get(key) || { categoria_id: key, nome: cat?.nome || '—', lote: cat?.lote || 1, vendidos: 0, receita: 0 }
    cur.vendidos += 1
    cur.receita = money(cur.receita + num(i.valor_num))
    acc.set(key, cur)
  }
  return Array.from(acc.values()).sort((a, b) => b.receita - a.receita)
}

/** Receita paga por canal (online/manual/cortesia) — para o donut. */
export function vendasPorCanal(pedidos: Pedido[]): { canal: string; pedidos: number; receita: number }[] {
  const acc = new Map<string, { canal: string; pedidos: number; receita: number }>()
  for (const p of pedidos) {
    if (p.status !== 'pago') continue
    const cur = acc.get(p.canal) || { canal: p.canal, pedidos: 0, receita: 0 }
    cur.pedidos += 1
    cur.receita = money(cur.receita + num(p.total_num))
    acc.set(p.canal, cur)
  }
  return Array.from(acc.values()).sort((a, b) => b.receita - a.receita)
}

export type PontoCurva = { t: number; receita: number; ingressos: number }
/**
 * Curva acumulada de receita/ingressos ao longo do tempo (por pedido pago,
 * ordenado por pago_em/criado_em) — alimenta o sparkline de vendas.
 */
export function curvaVendas(pedidos: Pedido[]): PontoCurva[] {
  const pagos = pedidos
    .filter((p) => p.status === 'pago')
    .map((p) => ({ t: parseMs(p.pago_em) ?? parseMs(p.criado_em) ?? 0, total: num(p.total_num) }))
    .filter((e) => e.t > 0)
    .sort((a, b) => a.t - b.t)
  const out: PontoCurva[] = []
  let receita = 0, ingressos = 0
  for (const e of pagos) {
    receita = money(receita + e.total)
    ingressos += 1
    out.push({ t: e.t, receita, ingressos })
  }
  return out
}

// ── Mapa de lotação (vendido × capacidade) ───────────────────────────────────
export type Lotacao = {
  vendidos: number
  capacidade: number              // soma das quantidades das categorias (0 = ilimitado)
  capacidadeEvento: number        // teto global da bilheteria (0 = sem teto)
  ratio: number                   // 0..1+ vs. capacidade efetiva
  restante: number                // Infinity se sem teto
}
/**
 * Lotação do evento: ingressos vendidos vs. capacidade. A capacidade efetiva é o
 * teto global da bilheteria, se houver; senão a soma das quantidades das
 * categorias (ilimitada se alguma for ilimitada).
 */
export function lotacaoEvento(b: Pick<BilheteriaEvento, 'capacidade'>, categorias: Categoria[], ingressos: Ingresso[]): Lotacao {
  const vendidos = ingressos.filter((i) => i.status === 'pago' || i.status === 'checkin').length
  const somaCategorias = categorias.reduce((s, c) => (c.quantidade > 0 ? s + c.quantidade : s), 0)
  const algumIlimitado = categorias.some((c) => !(c.quantidade > 0))
  const tetoEvento = Math.max(0, num(b.capacidade))
  const capacidade = tetoEvento > 0 ? tetoEvento : (algumIlimitado ? 0 : somaCategorias)
  const ratio = capacidade > 0 ? vendidos / capacidade : 0
  return {
    vendidos,
    capacidade: somaCategorias,
    capacidadeEvento: tetoEvento,
    ratio,
    restante: capacidade > 0 ? Math.max(0, capacidade - vendidos) : Infinity,
  }
}

// ── Conciliação Mercado Pago ─────────────────────────────────────────────────
export type ConciliacaoMP = {
  conciliados: number             // pedidos pagos COM mp_payment_id
  manuais: number                 // pagos sem mp (cortesia/manual)
  pendentesMp: number             // pendentes com preferência criada (aguardando)
  valorConciliado: number
}
/** Quadro simples de conciliação: o que veio do MP × o que foi manual. */
export function conciliacaoMP(pedidos: Pedido[]): ConciliacaoMP {
  let conciliados = 0, manuais = 0, pendentesMp = 0, valor = 0
  for (const p of pedidos) {
    if (p.status === 'pago') {
      if (p.mp_payment_id) { conciliados++; valor = money(valor + num(p.total_num)) }
      else manuais++
    } else if (p.status === 'pendente' && (p.mp_preference_id || p.mp_payment_id)) {
      pendentesMp++
    }
  }
  return { conciliados, manuais, pendentesMp, valorConciliado: valor }
}
