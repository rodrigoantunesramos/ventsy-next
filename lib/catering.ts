// Motor PURO de Catering, Buffet & Bar da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: custo de prato/cardápio por pessoa a partir da
// FICHA TÉCNICA (insumos → Estoque), DIMENSIONAMENTO por nº de convidados (gera a
// lista de compras/requisição), bar (open bar × consumação × cash bar) com
// consumo e perdas, e o CMV/food cost por evento — incluindo o comparativo
// PREVISTO × REAL (o real vem do consumo baixado no Estoque).
//
// É consumido por:
//   • /painel/catering   (cardápios, A&B por evento, bar, custo — via _lib.ts)
//   • /api/catering        (ensure 1:1 do evento, gerar requisição em Compras a
//                           partir do dimensionamento, baixar Estoque pelo
//                           consumo — autoritativo, service-role)
//
// Regras de ouro (espelham lib/estoque.ts, lib/producao.ts, lib/pricing.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas crus. A
//     formatação (moeda/locale) fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: nada de relógio/aleatório escondido na lógica.
//   • Dinheiro arredondado a centavos via round2 para evitar drift de float.

// ── Utilidades numéricas ─────────────────────────────────────────────────────
export function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
export function round2(n: number): number {
  return Math.round(num(n) * 100) / 100
}
/** Fração saneada para [0, máx]; trata lixo/negativos. (perda, fatores). */
export function clampFrac(v: unknown, max = 1): number {
  const n = num(v)
  if (n < 0) return 0
  return n > max ? max : n
}

// ── Vocabulário do domínio (espelha o CHECK do SQL) ──────────────────────────
/** Tipo de cardápio/pacote de A&B. */
export type CardapioTipo =
  | 'coquetel' | 'jantar' | 'almoco' | 'buffet' | 'coffee' | 'brunch'
  | 'churrasco' | 'lanche' | 'open_bar' | 'outro'

/** Categoria de um item dentro do cardápio (para agrupar a ficha). */
export type ItemCategoria =
  | 'entrada' | 'principal' | 'acompanhamento' | 'sobremesa'
  | 'aperitivo' | 'estacao' | 'bebida' | 'outro'

/** Restrições alimentares dos convidados (puxadas do Portal/CRM). */
export type Restricao =
  | 'vegetariano' | 'vegano' | 'sem_gluten' | 'sem_lactose'
  | 'zero_alcool' | 'kosher' | 'halal' | 'infantil' | 'diabetico'

/** Modelo de bar do evento. */
export type BarTipo = 'open_bar' | 'consumacao' | 'cash_bar' | 'sem_bar'

// ── Tipos das linhas/estruturas (espelham docs/sql/catering.sql) ─────────────
/**
 * Linha da ficha técnica: um INSUMO consumido por pessoa. `produto_id` liga ao
 * Estoque (produtos); quando null o insumo é "avulso" (não controlado em estoque
 * — entra na requisição como descrição). `perda_pct` (0..1) é a quebra esperada
 * que o dimensionamento compra a mais.
 */
export type FichaInsumo = {
  produto_id: string | null
  nome: string
  unidade: string
  qtd_por_pessoa: number
  custo_unit_num: number
  perda_pct: number
}

/** Prato/item do cardápio. Custo vem da ficha; se vazia, usa `custo_num`. */
export type CardapioItem = {
  id: string
  nome: string
  categoria: ItemCategoria
  porcao_por_pessoa: number   // informativo (ex.: 0.15 = 150 g/pessoa)
  unidade: string
  custo_num: number           // custo/pessoa do item (fallback sem ficha)
  preco_num: number           // preço/pessoa se vendido à parte (0 se incluso)
  incluso: boolean            // incluso no preço do pacote (preco_pessoa)
  restricoes: Restricao[]     // restrições que ESTE item atende
  ficha: FichaInsumo[]
}

/** Cardápio/pacote (global, reutilizável entre eventos). */
export type Cardapio = {
  id: string
  nome: string
  tipo: CardapioTipo
  itens: CardapioItem[]
  preco_pessoa_num: number    // preço de venda por pessoa do PACOTE
}

/** Bebida do cardápio de bar. */
export type Drink = {
  id: string
  nome: string
  categoria: string           // coquetel | cerveja | vinho | destilado | nao_alcoolico | ...
  custo_num: number           // custo por dose/unidade
  preco_num: number           // preço de venda (consumação/cash bar)
  por_pessoa: number          // consumo estimado por convidado (dimensionamento)
}
/** Consumo real de um drink (unidades servidas + perdas). */
export type ConsumoDrink = { drink_id: string; quantidade: number; perda: number }

// ── Custo do item por pessoa ─────────────────────────────────────────────────
/** Custo da ficha técnica de UM insumo, por pessoa (já com a perda embutida). */
export function custoInsumoPorPessoa(f: FichaInsumo): number {
  return round2(num(f.qtd_por_pessoa) * num(f.custo_unit_num) * (1 + clampFrac(f.perda_pct)))
}
/**
 * Custo do item por pessoa: soma da ficha técnica quando há insumos; caso
 * contrário cai no `custo_num` informado direto no item.
 */
export function custoItemPorPessoa(item: Pick<CardapioItem, 'ficha' | 'custo_num'>): number {
  if (item.ficha && item.ficha.length > 0) {
    return round2(item.ficha.reduce((s, f) => s + custoInsumoPorPessoa(f), 0))
  }
  return round2(num(item.custo_num))
}

// ── Custo / preço do cardápio por pessoa ─────────────────────────────────────
/** Custo do cardápio por pessoa = Σ custo de cada item por pessoa. */
export function custoCardapioPorPessoa(c: Pick<Cardapio, 'itens'>): number {
  return round2((c.itens || []).reduce((s, it) => s + custoItemPorPessoa(it), 0))
}
/**
 * Preço do cardápio por pessoa: usa o preço do PACOTE (preco_pessoa_num) quando
 * definido; senão soma os preços dos itens vendidos à parte (não inclusos).
 */
export function precoCardapioPorPessoa(c: Pick<Cardapio, 'itens' | 'preco_pessoa_num'>): number {
  const pacote = num(c.preco_pessoa_num)
  if (pacote > 0) return round2(pacote)
  return round2((c.itens || []).reduce((s, it) => s + (it.incluso ? 0 : num(it.preco_num)), 0))
}

// ── Food cost / margem / markup ──────────────────────────────────────────────
/** Food cost (fração): custo ÷ preço. 0 quando não há preço. */
export function foodCost(custo: number, preco: number): number {
  const p = num(preco)
  return p > 0 ? round4(num(custo) / p) : 0
}
/** Margem bruta (fração): (preço − custo) ÷ preço. */
export function margemBruta(custo: number, preco: number): number {
  const p = num(preco)
  return p > 0 ? round4((p - num(custo)) / p) : 0
}
/** Markup (multiplicador): preço ÷ custo. 0 quando não há custo. */
export function markup(custo: number, preco: number): number {
  const c = num(custo)
  return c > 0 ? round4(num(preco) / c) : 0
}
function round4(n: number): number {
  return Math.round(num(n) * 10000) / 10000
}

// ── Dimensionamento (lista de compras / requisição) ──────────────────────────
/** Linha agregada do dimensionamento para `convidados` pessoas. */
export type LinhaDimensionada = {
  produto_id: string | null
  nome: string
  unidade: string
  qtd_por_pessoa: number      // já com perda embutida
  qtd_total: number           // qtd_por_pessoa × convidados × fator
  custo_unit_num: number
  custo_total_num: number
}
/**
 * Percorre TODA a ficha técnica do cardápio e agrega por insumo
 * (produto_id quando houver; senão por nome+unidade), devolvendo a quantidade
 * total a comprar/separar para `convidados` pessoas. `fator` aplica um ajuste
 * global (ex.: 1.1 = +10% de folga). Ordena por custo total desc.
 */
export function dimensionar(
  c: Pick<Cardapio, 'itens'>,
  convidados: number,
  fator = 1,
): LinhaDimensionada[] {
  const n = Math.max(0, num(convidados))
  const f = num(fator) > 0 ? num(fator) : 1
  const mapa = new Map<string, LinhaDimensionada>()
  for (const item of c.itens || []) {
    for (const ins of item.ficha || []) {
      const key = ins.produto_id ? `p:${ins.produto_id}` : `n:${(ins.nome || '').toLowerCase()}|${ins.unidade || ''}`
      const porPessoa = num(ins.qtd_por_pessoa) * (1 + clampFrac(ins.perda_pct))
      const qtd = porPessoa * n * f
      const cur = mapa.get(key)
      if (cur) {
        cur.qtd_por_pessoa = round4(cur.qtd_por_pessoa + porPessoa)
        cur.qtd_total = round4(cur.qtd_total + qtd)
        cur.custo_total_num = round2(cur.custo_total_num + qtd * num(ins.custo_unit_num))
      } else {
        mapa.set(key, {
          produto_id: ins.produto_id || null,
          nome: ins.nome || 'Insumo',
          unidade: ins.unidade || 'un',
          qtd_por_pessoa: round4(porPessoa),
          qtd_total: round4(qtd),
          custo_unit_num: round2(ins.custo_unit_num),
          custo_total_num: round2(qtd * num(ins.custo_unit_num)),
        })
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.custo_total_num - a.custo_total_num)
}
/** Custo total previsto do dimensionamento (Σ custo_total). */
export function custoDimensionado(linhas: LinhaDimensionada[]): number {
  return round2(linhas.reduce((s, l) => s + num(l.custo_total_num), 0))
}
/** Só as linhas que baixam Estoque (têm produto_id) — usadas na CONSUMAÇÃO. */
export function linhasComProduto(linhas: LinhaDimensionada[]): LinhaDimensionada[] {
  return linhas.filter((l) => !!l.produto_id)
}

// ── Bar (open bar × consumação × cash bar) ───────────────────────────────────
/** Custo previsto do bar para `convidados` (Σ por_pessoa × custo × convidados). */
export function custoBarPrevisto(drinks: Drink[], convidados: number): number {
  const n = Math.max(0, num(convidados))
  return round2((drinks || []).reduce((s, d) => s + num(d.por_pessoa) * n * num(d.custo_num), 0))
}
/**
 * Receita prevista do bar. Open bar/sem bar não vendem por consumo (a receita
 * está no pacote do cardápio) → 0. Consumação/cash bar faturam por dose.
 */
export function receitaBarPrevista(drinks: Drink[], convidados: number, tipo: BarTipo): number {
  if (tipo === 'open_bar' || tipo === 'sem_bar') return 0
  const n = Math.max(0, num(convidados))
  return round2((drinks || []).reduce((s, d) => s + num(d.por_pessoa) * n * num(d.preco_num), 0))
}
/** Agrega o consumo REAL informado (servido + perdas) sobre o cardápio de bar. */
export function consumoBarReal(
  drinks: Drink[],
  consumo: ConsumoDrink[],
): { custo_num: number; receita_num: number; perdas_num: number; unidades: number } {
  const byId = new Map((drinks || []).map((d) => [d.id, d]))
  let custo = 0, receita = 0, perdas = 0, unidades = 0
  for (const c of consumo || []) {
    const d = byId.get(c.drink_id)
    if (!d) continue
    const servido = Math.max(0, num(c.quantidade))
    const perda = Math.max(0, num(c.perda))
    custo += (servido + perda) * num(d.custo_num)
    receita += servido * num(d.preco_num)
    perdas += perda * num(d.custo_num)
    unidades += servido
  }
  return { custo_num: round2(custo), receita_num: round2(receita), perdas_num: round2(perdas), unidades: round2(unidades) }
}
/** Resultado consolidado do bar (previsto, real quando há consumo, por pessoa). */
export type ResultadoBar = {
  custoPrevisto: number
  receitaPrevista: number
  custoReal: number
  receitaReal: number
  perdas: number
  custoPorPessoa: number
  margem: number
}
export function resultadoBar(args: {
  tipo: BarTipo
  drinks: Drink[]
  convidados: number
  consumo?: ConsumoDrink[]
}): ResultadoBar {
  const { tipo, drinks, convidados } = args
  const temConsumo = (args.consumo || []).length > 0
  const real = consumoBarReal(drinks, args.consumo || [])
  const custoPrevisto = custoBarPrevisto(drinks, convidados)
  const receitaPrevista = receitaBarPrevista(drinks, convidados, tipo)
  const custoReal = temConsumo ? real.custo_num : 0
  // Open bar/sem bar não geram receita por consumo, mesmo com consumo lançado.
  const receitaReal = temConsumo && tipo !== 'open_bar' && tipo !== 'sem_bar' ? real.receita_num : 0
  const custoBase = temConsumo ? custoReal : custoPrevisto
  const receitaBase = temConsumo ? receitaReal : receitaPrevista
  return {
    custoPrevisto, receitaPrevista, custoReal, receitaReal,
    perdas: temConsumo ? real.perdas_num : 0,
    custoPorPessoa: custoPorPessoa(custoBase, convidados),
    margem: margemBruta(custoBase, receitaBase),
  }
}

// ── CMV / custo por pessoa / previsto × real ─────────────────────────────────
/** Custo por pessoa = total ÷ convidados (0 quando não há convidados). */
export function custoPorPessoa(custoTotal: number, convidados: number): number {
  const n = num(convidados)
  return n > 0 ? round2(num(custoTotal) / n) : 0
}
export type CmvComparativo = {
  previsto_num: number
  real_num: number
  variacao_num: number       // real − previsto (positivo = estourou o previsto)
  variacao_pct: number       // fração sobre o previsto
  foodCostPrevisto: number   // previsto ÷ receita (fração)
  foodCostReal: number       // real ÷ receita (fração)
}
/** Compara o CMV previsto (dimensionamento) com o real (consumo do Estoque). */
export function compararCMV(args: { custoPrevisto: number; custoReal: number; receita: number }): CmvComparativo {
  const previsto = round2(args.custoPrevisto)
  const real = round2(args.custoReal)
  const variacao = round2(real - previsto)
  return {
    previsto_num: previsto,
    real_num: real,
    variacao_num: variacao,
    variacao_pct: previsto > 0 ? round4(variacao / previsto) : 0,
    foodCostPrevisto: foodCost(previsto, args.receita),
    foodCostReal: foodCost(real, args.receita),
  }
}

// ── Resumo de A&B do evento (headline da aba Custo) ──────────────────────────
export type ResumoAeB = {
  convidados: number
  custoCardapio: number
  custoBar: number
  custoTotal: number
  custoPorPessoa: number
  receitaCardapio: number
  receitaBar: number
  receitaTotal: number
  margem: number
  foodCost: number
}
/**
 * Consolida cardápio + bar para o evento. `custoReal`/`receitaBarReal`, quando
 * passados, sobrepõem o previsto (ex.: depois de baixar o consumo no Estoque).
 */
export function resumoEvento(args: {
  cardapio: Pick<Cardapio, 'itens' | 'preco_pessoa_num'> | null
  convidados: number
  fator?: number
  bar?: ResultadoBar | null
  custoCardapioReal?: number | null
}): ResumoAeB {
  const conv = Math.max(0, num(args.convidados))
  const fator = num(args.fator) > 0 ? num(args.fator) : 1
  const custoCardapioPrev = args.cardapio
    ? round2(custoCardapioPorPessoa(args.cardapio) * conv * fator)
    : 0
  const custoCardapio = args.custoCardapioReal != null ? round2(args.custoCardapioReal) : custoCardapioPrev
  const receitaCardapio = args.cardapio ? round2(precoCardapioPorPessoa(args.cardapio) * conv) : 0
  const custoBar = args.bar ? (args.bar.custoReal || args.bar.custoPrevisto) : 0
  const receitaBar = args.bar ? (args.bar.receitaReal || args.bar.receitaPrevista) : 0
  const custoTotal = round2(custoCardapio + custoBar)
  const receitaTotal = round2(receitaCardapio + receitaBar)
  return {
    convidados: conv,
    custoCardapio, custoBar, custoTotal,
    custoPorPessoa: custoPorPessoa(custoTotal, conv),
    receitaCardapio, receitaBar, receitaTotal,
    margem: margemBruta(custoTotal, receitaTotal),
    foodCost: foodCost(custoTotal, receitaTotal),
  }
}

// ── Restrições alimentares ───────────────────────────────────────────────────
/** Linha estruturada de restrição (quantos convidados) — guardada por evento. */
export type RestricaoLinha = { restricao: Restricao; quantidade: number }

const RESTRICAO_KEYS: Restricao[] = [
  'vegetariano', 'vegano', 'sem_gluten', 'sem_lactose', 'zero_alcool', 'kosher', 'halal', 'infantil', 'diabetico',
]
const RESTRICAO_REGEX: Record<Restricao, RegExp> = {
  vegano: /\bveganos?\b/i,
  vegetariano: /\bvegetarianos?\b|\bvegg?ie\b/i,
  sem_gluten: /gl[úu]ten|cel[íi]acos?|gluten[-\s]?free/i,
  sem_lactose: /lactose|sem\s+leite|intoler[âa]ncia/i,
  zero_alcool: /sem\s+[áa]lcool|zero\s+[áa]lcool|n[ãa]o\s+alc[oó]olico|gestante/i,
  kosher: /kosher|cas?her/i,
  halal: /halal/i,
  infantil: /infantil|crian[çc]as?|kids/i,
  diabetico: /diab[ée]ticos?|diabetes|sem\s+a[çc][úu]car/i,
}
/**
 * Detecta restrições mencionadas num texto livre (o campo do CRM/Portal
 * `restricoes_alimentares`). Retorna as chaves achadas, em ordem do catálogo.
 */
export function parseRestricoesTexto(texto: string | null | undefined): Restricao[] {
  const t = (texto || '').toString()
  if (!t.trim()) return []
  return RESTRICAO_KEYS.filter((k) => RESTRICAO_REGEX[k].test(t))
}
/** Soma as linhas por restrição (consolida duplicatas). */
export function agregarRestricoes(linhas: RestricaoLinha[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const l of linhas || []) {
    if (!l || !l.restricao) continue
    acc[l.restricao] = round2((acc[l.restricao] || 0) + Math.max(0, num(l.quantidade)))
  }
  return acc
}
/** Restrições presentes (quantidade > 0), em ordem do catálogo. */
export function restricoesPresentes(linhas: RestricaoLinha[]): Restricao[] {
  const agg = agregarRestricoes(linhas)
  return RESTRICAO_KEYS.filter((k) => (agg[k] || 0) > 0)
}
/** Cobertura: para cada restrição presente, quais itens do cardápio a atendem. */
export type CoberturaRestricao = { restricao: Restricao; quantidade: number; atendida: boolean; itens: string[] }
export function coberturaRestricoes(
  c: Pick<Cardapio, 'itens'> | null,
  linhas: RestricaoLinha[],
): CoberturaRestricao[] {
  const agg = agregarRestricoes(linhas)
  const itens = c?.itens || []
  return restricoesPresentes(linhas).map((r) => {
    const atende = itens.filter((it) => (it.restricoes || []).includes(r)).map((it) => it.nome)
    return { restricao: r, quantidade: agg[r] || 0, atendida: atende.length > 0, itens: atende }
  })
}

// ── Catálogos (rótulos PT default; i18n: extrair p/ dicionário) ──────────────
export const CARDAPIO_TIPOS: { v: CardapioTipo; label: string }[] = [
  { v: 'coquetel',  label: 'Coquetel' },
  { v: 'jantar',    label: 'Jantar' },
  { v: 'almoco',    label: 'Almoço' },
  { v: 'buffet',    label: 'Buffet' },
  { v: 'coffee',    label: 'Coffee break' },
  { v: 'brunch',    label: 'Brunch' },
  { v: 'churrasco', label: 'Churrasco' },
  { v: 'lanche',    label: 'Lanche' },
  { v: 'open_bar',  label: 'Open bar' },
  { v: 'outro',     label: 'Outro' },
]
export const ITEM_CATEGORIAS: { v: ItemCategoria; label: string; cor: string }[] = [
  { v: 'entrada',        label: 'Entrada',       cor: '#0ea5e9' },
  { v: 'principal',      label: 'Prato principal', cor: '#f97316' },
  { v: 'acompanhamento', label: 'Acompanhamento', cor: '#14b8a6' },
  { v: 'sobremesa',      label: 'Sobremesa',     cor: '#ec4899' },
  { v: 'aperitivo',      label: 'Aperitivo',     cor: '#8b5cf6' },
  { v: 'estacao',        label: 'Estação',       cor: '#6366f1' },
  { v: 'bebida',         label: 'Bebida',        cor: '#22c55e' },
  { v: 'outro',          label: 'Outro',         cor: '#94a3b8' },
]
export const RESTRICOES: { v: Restricao; label: string; cor: string }[] = [
  { v: 'vegetariano', label: 'Vegetariano',  cor: '#22c55e' },
  { v: 'vegano',      label: 'Vegano',       cor: '#16a34a' },
  { v: 'sem_gluten',  label: 'Sem glúten',   cor: '#f59e0b' },
  { v: 'sem_lactose', label: 'Sem lactose',  cor: '#eab308' },
  { v: 'zero_alcool', label: 'Sem álcool',   cor: '#0ea5e9' },
  { v: 'kosher',      label: 'Kosher',       cor: '#6366f1' },
  { v: 'halal',       label: 'Halal',        cor: '#8b5cf6' },
  { v: 'infantil',    label: 'Infantil',     cor: '#ec4899' },
  { v: 'diabetico',   label: 'Diabético',    cor: '#ef4444' },
]
export const BAR_TIPOS: { v: BarTipo; label: string; desc: string }[] = [
  { v: 'open_bar',    label: 'Open bar',    desc: 'Consumo livre incluso no pacote.' },
  { v: 'consumacao',  label: 'Consumação',  desc: 'Ficha de consumação; fatura por dose.' },
  { v: 'cash_bar',    label: 'Cash bar',    desc: 'Convidado paga cada item.' },
  { v: 'sem_bar',     label: 'Sem bar',     desc: 'Evento sem serviço de bar.' },
]
export const DRINK_CATEGORIAS: { v: string; label: string }[] = [
  { v: 'coquetel',      label: 'Coquetel' },
  { v: 'cerveja',       label: 'Cerveja' },
  { v: 'vinho',         label: 'Vinho' },
  { v: 'destilado',     label: 'Destilado' },
  { v: 'nao_alcoolico', label: 'Não alcoólico' },
  { v: 'outro',         label: 'Outro' },
]

const TIPO_LABEL = Object.fromEntries(CARDAPIO_TIPOS.map((t) => [t.v, t.label]))
const ITEMCAT = Object.fromEntries(ITEM_CATEGORIAS.map((c) => [c.v, c]))
const RESTR = Object.fromEntries(RESTRICOES.map((r) => [r.v, r]))
const BARTIPO_LABEL = Object.fromEntries(BAR_TIPOS.map((b) => [b.v, b.label]))
export const cardapioTipoLabel = (v: string | null): string => TIPO_LABEL[v || 'outro'] || v || '—'
export const itemCategoriaLabel = (v: string | null): string => ITEMCAT[v || 'outro']?.label || v || '—'
export const itemCategoriaCor = (v: string | null): string => ITEMCAT[v || 'outro']?.cor || '#94a3b8'
export const restricaoLabel = (v: string | null): string => RESTR[v || '']?.label || v || '—'
export const restricaoCor = (v: string | null): string => RESTR[v || '']?.cor || '#94a3b8'
export const barTipoLabel = (v: string | null): string => BARTIPO_LABEL[v || 'sem_bar'] || v || '—'

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01'
}

// ── Templates de cardápio (semente rápida; ficha já liga insumos do Estoque) ─
// `produto_id` fica null nos templates (o usuário casa com os produtos depois);
// custos são estimativas iniciais editáveis. i18n: rótulos PT default.
export type TemplateCardapio = Omit<Cardapio, 'id'> & { descricao: string }
const ins = (nome: string, unidade: string, qtd: number, custo: number, perda = 0): FichaInsumo =>
  ({ produto_id: null, nome, unidade, qtd_por_pessoa: qtd, custo_unit_num: custo, perda_pct: perda })
let _tid = 0
const it = (
  nome: string, categoria: ItemCategoria, unidade: string, porcao: number,
  ficha: FichaInsumo[], restricoes: Restricao[] = [], preco = 0, incluso = true,
): CardapioItem => ({
  id: `tpl-${++_tid}`, nome, categoria, porcao_por_pessoa: porcao, unidade,
  custo_num: 0, preco_num: preco, incluso, restricoes, ficha,
})
export const TEMPLATES_CARDAPIO: TemplateCardapio[] = [
  {
    nome: 'Coquetel volante', tipo: 'coquetel', preco_pessoa_num: 0,
    descricao: 'Finger foods + estação; descartáveis e gelo na ficha.',
    itens: [
      it('Canapés sortidos', 'aperitivo', 'un', 6, [ins('Pão/base canapé', 'un', 6, 0.8), ins('Recheios variados', 'g', 90, 0.04)], ['vegetariano']),
      it('Mini quiches', 'aperitivo', 'un', 3, [ins('Massa de quiche', 'un', 3, 1.2), ins('Recheio', 'g', 60, 0.05)]),
      it('Estação de queijos', 'estacao', 'g', 80, [ins('Queijos sortidos', 'g', 80, 0.18, 0.1), ins('Geleias/acompanhamentos', 'g', 20, 0.05)], ['vegetariano']),
      it('Descartáveis & gelo', 'outro', 'un', 1, [ins('Guardanapo', 'un', 4, 0.05), ins('Copo descartável', 'un', 3, 0.12), ins('Gelo', 'kg', 0.25, 1.5, 0.2)]),
    ],
  },
  {
    nome: 'Jantar empratado', tipo: 'jantar', preco_pessoa_num: 0,
    descricao: 'Entrada, principal, sobremesa — porções por pessoa.',
    itens: [
      it('Entrada (salada)', 'entrada', 'g', 120, [ins('Folhas e vegetais', 'g', 120, 0.02, 0.1)], ['vegetariano', 'vegano', 'sem_gluten']),
      it('Prato principal', 'principal', 'g', 350, [ins('Proteína', 'g', 200, 0.06, 0.1), ins('Guarnição', 'g', 150, 0.02)]),
      it('Sobremesa', 'sobremesa', 'un', 1, [ins('Sobremesa empratada', 'un', 1, 4.5)], ['vegetariano']),
      it('Pão & couvert', 'acompanhamento', 'un', 2, [ins('Pão', 'un', 2, 0.6), ins('Manteiga/pasta', 'g', 20, 0.03)], ['vegetariano']),
    ],
  },
  {
    nome: 'Churrasco', tipo: 'churrasco', preco_pessoa_num: 0,
    descricao: 'Carnes por pessoa + acompanhamentos, carvão e descartáveis.',
    itens: [
      it('Carnes assadas', 'principal', 'g', 400, [ins('Carnes variadas', 'g', 400, 0.04, 0.15), ins('Carvão', 'kg', 0.1, 6), ins('Sal grosso', 'g', 15, 0.01)]),
      it('Acompanhamentos', 'acompanhamento', 'g', 250, [ins('Arroz/farofa/vinagrete', 'g', 250, 0.015)], ['vegetariano']),
      it('Pão de alho', 'aperitivo', 'un', 2, [ins('Pão de alho', 'un', 2, 1.1)], ['vegetariano']),
      it('Descartáveis & gelo', 'outro', 'un', 1, [ins('Prato descartável', 'un', 2, 0.25), ins('Talher descartável', 'un', 2, 0.18), ins('Gelo', 'kg', 0.3, 1.5, 0.2)]),
    ],
  },
  {
    nome: 'Coffee break', tipo: 'coffee', preco_pessoa_num: 0,
    descricao: 'Café, sucos e salgados para congresso/treinamento.',
    itens: [
      it('Café & chá', 'bebida', 'ml', 200, [ins('Café coado', 'ml', 150, 0.004), ins('Chá', 'ml', 50, 0.003)], ['vegano', 'sem_gluten']),
      it('Sucos', 'bebida', 'ml', 200, [ins('Suco', 'ml', 200, 0.006)], ['vegano', 'sem_gluten']),
      it('Salgados assados', 'aperitivo', 'un', 4, [ins('Mini salgados', 'un', 4, 0.9, 0.05)]),
      it('Bolos & frutas', 'sobremesa', 'g', 120, [ins('Bolo', 'g', 80, 0.02), ins('Frutas', 'g', 40, 0.012)], ['vegetariano']),
    ],
  },
]
