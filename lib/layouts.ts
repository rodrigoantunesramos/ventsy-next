// Motor PURO de Layouts, Plantas & Capacidade da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Documenta e planeja o uso FÍSICO do espaço: plantas, SETUPS (auditório,
// banquete, escolar, U, coquetel, pista…) com CAPACIDADE POR ARRANJO, mapa de
// mesas/lugares e o posicionamento de palco/bar/estandes num canvas. Ajuda a
// VENDER (o cliente visualiza) e a OPERAR (a equipe monta). Escala do salão de
// festa ao pavilhão de feira.
//
// Consumido por:
//   • /painel/layouts   (biblioteca de plantas, editor de canvas, mapa de mesas)
//   • /api/layouts       (aplicar layout ao evento + publicar capacidade no
//                         Acesso — autoritativo, service-role)
//
// Regras de ouro (espelham lib/producao.ts, lib/reservas.ts, lib/acesso.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/dimensões cruas.
//     A formatação (moeda/locale/m²) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: nada de relógio/aleatório escondido; o que varia
//     entra por parâmetro (área, capacidade, dimensões do canvas).
//   • i18n: rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

// ── Canvas (espaço lógico da planta) ─────────────────────────────────────────
// As posições/tamanhos dos elementos são em UNIDADES LÓGICAS de um canvas com
// dimensões próprias (default 1000×700). A UI escala o canvas para a tela; a
// engine só lida com as unidades — assim o cálculo é estável em qualquer zoom.
export const CANVAS_PADRAO = { largura: 1000, altura: 700 } as const

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Tipo de arranjo da sala (setup). Espelha o CHECK do SQL. */
export type SetupKey =
  | 'banquete' | 'auditorio' | 'escolar' | 'coquetel'
  | 'formato_u' | 'espinha' | 'conselho' | 'cabare' | 'pista'

/** Tipo de um elemento posicionado na planta. */
export type ElementoTipo =
  | 'mesa_redonda' | 'mesa_retangular' | 'mesa_alta' | 'fileira'
  | 'palco' | 'pista' | 'bar' | 'buffet' | 'banheiro' | 'entrada' | 'estande' | 'area'

/** Elemento posicionado na planta (mesa, palco, bar…). Coordenadas em unidades lógicas. */
export type Elemento = {
  id: string
  tipo: ElementoTipo
  x: number          // canto superior-esquerdo (unidades lógicas)
  y: number
  w: number          // largura
  h: number          // altura
  rotacao: number    // graus (0/90/…)
  rotulo: string     // ex.: "Mesa 1", "Palco", "Bar"
  lugares: number    // assentos do elemento (0 p/ não-assento)
}

/** A planta completa: dimensões do canvas + os elementos. Guardada em `layouts.elementos` (jsonb). */
export type Planta = { largura: number; altura: number; itens: Elemento[] }

/** Convidado alocado a uma mesa (mapa de mesas por evento). */
export type Convidado = { nome: string; restricao?: string; grupo?: string }
/** Mapa de mesas: convidados por id de elemento + os ainda não alocados. Guardado em `evento_layout.mapa_mesas`. */
export type MapaMesas = { mesas: Record<string, Convidado[]>; naoAlocados: Convidado[] }

// ── Catálogo de SETUPS (densidade = m²/pessoa, já inclui circulação/serviço) ──
// As densidades seguem referências usuais de eventos (m² por pessoa, área útil):
// quanto MENOR a densidade, mais gente cabe. A capacidade por arranjo deriva daí.
export type SetupMeta = {
  key: SetupKey
  label: string
  densidade: number       // m² por pessoa
  descricao: string
  mesa?: ElementoTipo     // tipo de mesa do arranjo (p/ auto-gerar)
  lugaresPorMesa?: number // assentos por mesa do arranjo
}
export const SETUPS: SetupMeta[] = [
  { key: 'banquete',  label: 'Banquete (mesas redondas)', densidade: 1.8, descricao: 'Mesas redondas com serviço à mesa.', mesa: 'mesa_redonda', lugaresPorMesa: 8 },
  { key: 'cabare',    label: 'Cabaré (mesas voltadas ao palco)', densidade: 2.2, descricao: 'Mesas redondas voltadas para um palco.', mesa: 'mesa_redonda', lugaresPorMesa: 6 },
  { key: 'auditorio', label: 'Auditório (fileiras)', densidade: 1.1, descricao: 'Cadeiras em fileiras voltadas à frente.', mesa: 'fileira' },
  { key: 'escolar',   label: 'Escolar (mesas + cadeiras)', densidade: 2.0, descricao: 'Mesas com cadeiras voltadas à frente.', mesa: 'mesa_retangular', lugaresPorMesa: 2 },
  { key: 'formato_u', label: 'Formato U', densidade: 2.3, descricao: 'Mesas em U, voltadas para o centro.', mesa: 'mesa_retangular', lugaresPorMesa: 3 },
  { key: 'espinha',   label: 'Espinha de peixe', densidade: 2.0, descricao: 'Mesas em V/chevron voltadas à frente.', mesa: 'mesa_retangular', lugaresPorMesa: 3 },
  { key: 'conselho',  label: 'Conselho (boardroom)', densidade: 2.5, descricao: 'Uma grande mesa central de reunião.', mesa: 'mesa_retangular', lugaresPorMesa: 4 },
  { key: 'coquetel',  label: 'Coquetel (em pé)', densidade: 0.9, descricao: 'Recepção em pé, mesas altas e bar.', mesa: 'mesa_alta', lugaresPorMesa: 4 },
  { key: 'pista',     label: 'Pista / Show (livre)', densidade: 0.6, descricao: 'Área livre para público em pé.' },
]
const SETUP_BY = Object.fromEntries(SETUPS.map((s) => [s.key, s])) as Record<string, SetupMeta>
export function setupMeta(key: string | null | undefined): SetupMeta {
  return SETUP_BY[key || 'banquete'] || SETUP_BY.banquete
}
export function setupLabel(key: string | null | undefined): string { return setupMeta(key).label }

// ── Catálogo de ELEMENTOS (default de tamanho/assento/cor por tipo) ──────────
export type ElementoMeta = {
  label: string
  assento: boolean        // contribui com lugares?
  lugaresPadrao: number
  w: number; h: number    // tamanho default (unidades lógicas)
  cor: string             // hex p/ o canvas/thumbnail
  forma: 'circulo' | 'retangulo'
}
export const ELEMENTOS: Record<ElementoTipo, ElementoMeta> = {
  mesa_redonda:    { label: 'Mesa redonda',   assento: true,  lugaresPadrao: 8, w: 90,  h: 90,  cor: '#10b981', forma: 'circulo' },
  mesa_retangular: { label: 'Mesa retangular',assento: true,  lugaresPadrao: 6, w: 140, h: 70,  cor: '#0ea5e9', forma: 'retangulo' },
  mesa_alta:       { label: 'Mesa alta (bistrô)', assento: true, lugaresPadrao: 4, w: 60, h: 60, cor: '#14b8a6', forma: 'circulo' },
  fileira:         { label: 'Fileira de cadeiras', assento: true, lugaresPadrao: 10, w: 260, h: 36, cor: '#6366f1', forma: 'retangulo' },
  palco:           { label: 'Palco',          assento: false, lugaresPadrao: 0, w: 320, h: 90,  cor: '#a855f7', forma: 'retangulo' },
  pista:           { label: 'Pista',          assento: false, lugaresPadrao: 0, w: 240, h: 180, cor: '#f59e0b', forma: 'retangulo' },
  bar:             { label: 'Bar',            assento: false, lugaresPadrao: 0, w: 160, h: 50,  cor: '#ef4444', forma: 'retangulo' },
  buffet:          { label: 'Buffet',         assento: false, lugaresPadrao: 0, w: 200, h: 50,  cor: '#f97316', forma: 'retangulo' },
  banheiro:        { label: 'Banheiro',       assento: false, lugaresPadrao: 0, w: 90,  h: 70,  cor: '#64748b', forma: 'retangulo' },
  entrada:         { label: 'Entrada',        assento: false, lugaresPadrao: 0, w: 100, h: 40,  cor: '#0d9488', forma: 'retangulo' },
  estande:         { label: 'Estande',        assento: false, lugaresPadrao: 0, w: 120, h: 120, cor: '#8b5cf6', forma: 'retangulo' },
  area:            { label: 'Área / zona',    assento: false, lugaresPadrao: 0, w: 200, h: 150, cor: '#94a3b8', forma: 'retangulo' },
}
const ELEMENTO_TIPOS = Object.keys(ELEMENTOS) as ElementoTipo[]
export function elementoMeta(tipo: string | null | undefined): ElementoMeta {
  return ELEMENTOS[(tipo as ElementoTipo)] || ELEMENTOS.area
}
/** Lista de elementos disponíveis na paleta do editor (assentos primeiro). */
export function paletaElementos(): { tipo: ElementoTipo; meta: ElementoMeta }[] {
  return ELEMENTO_TIPOS.map((tipo) => ({ tipo, meta: ELEMENTOS[tipo] }))
}

// ── Normalização defensiva (jsonb → Planta / MapaMesas) ──────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any, d = 0): number => { const x = Number(v); return Number.isFinite(x) ? x : d }
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Coage um item cru (jsonb) em Elemento, herdando defaults do tipo. */
export function normalizarElemento(raw: any, i = 0): Elemento {
  const tipo: ElementoTipo = ELEMENTOS[raw?.tipo as ElementoTipo] ? raw.tipo : 'area'
  const meta = ELEMENTOS[tipo]
  return {
    id: String(raw?.id || `el_${i}`),
    tipo,
    x: num(raw?.x, 0),
    y: num(raw?.y, 0),
    w: Math.max(8, num(raw?.w, meta.w)),
    h: Math.max(8, num(raw?.h, meta.h)),
    rotacao: num(raw?.rotacao, 0),
    rotulo: String(raw?.rotulo ?? meta.label),
    lugares: meta.assento ? Math.max(0, Math.round(num(raw?.lugares, meta.lugaresPadrao))) : 0,
  }
}

/** Coage o jsonb de `layouts.elementos` numa Planta válida (aceita array ou {itens}). */
export function mesclarPlanta(raw: any): Planta {
  const fonte = Array.isArray(raw) ? { itens: raw } : (raw && typeof raw === 'object' ? raw : {})
  const largura = Math.max(200, num(fonte.largura, CANVAS_PADRAO.largura))
  const altura = Math.max(200, num(fonte.altura, CANVAS_PADRAO.altura))
  const itens = Array.isArray(fonte.itens) ? fonte.itens.map((r: any, i: number) => normalizarElemento(r, i)) : []
  return { largura, altura, itens }
}

/** Coage o jsonb de `evento_layout.mapa_mesas` num MapaMesas válido. */
export function mesclarMapa(raw: any): MapaMesas {
  const src = raw && typeof raw === 'object' ? raw : {}
  const mesas: Record<string, Convidado[]> = {}
  const mesasSrc = src.mesas && typeof src.mesas === 'object' ? src.mesas : {}
  for (const k of Object.keys(mesasSrc)) mesas[k] = normalizarConvidados(mesasSrc[k])
  return { mesas, naoAlocados: normalizarConvidados(src.naoAlocados) }
}
function normalizarConvidados(raw: any): Convidado[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c: any) => (typeof c === 'string' ? { nome: c } : c))
    .filter((c: any) => c && (c.nome || c.restricao))
    .map((c: any) => ({
      nome: String(c.nome || '').trim() || 'Convidado',
      ...(c.restricao ? { restricao: String(c.restricao) } : {}),
      ...(c.grupo ? { grupo: String(c.grupo) } : {}),
    }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Predicados / utilidades de elementos ─────────────────────────────────────
/** Elemento que carrega assentos (mesa/fileira). */
export function isAssento(el: Pick<Elemento, 'tipo'>): boolean { return ELEMENTOS[el.tipo as ElementoTipo]?.assento === true }
/** Só as mesas/fileiras (alocáveis no mapa de mesas), na ordem natural. */
export function mesasDaPlanta(itens: Elemento[]): Elemento[] { return itens.filter(isAssento) }

/** Soma de assentos de um conjunto de elementos (lugares totais do arranjo). */
export function lugaresDosElementos(itens: Elemento[]): number {
  return itens.reduce((s, el) => s + (isAssento(el) ? Math.max(0, el.lugares) : 0), 0)
}
/** Assentos da planta inteira. */
export function lugaresDaPlanta(p: Planta): number { return lugaresDosElementos(p.itens) }

/** Mantém o elemento dentro dos limites do canvas (move; não redimensiona). */
export function clampElemento(el: Elemento, canvas: { largura: number; altura: number }): Elemento {
  const w = Math.min(el.w, canvas.largura)
  const h = Math.min(el.h, canvas.altura)
  return { ...el, x: clampNum(el.x, 0, canvas.largura - w), y: clampNum(el.y, 0, canvas.altura - h) }
}

// ── Capacidade por arranjo (a partir da área útil) ───────────────────────────
/** Capacidade teórica de um setup numa área (m²): floor(área / densidade). 0 se inválido. */
export function capacidadePorSetup(areaM2: number | null | undefined, key: string): number {
  const a = Number(areaM2)
  if (!Number.isFinite(a) || a <= 0) return 0
  return Math.floor(a / setupMeta(key).densidade)
}
/** Capacidade de TODOS os setups numa área — alimenta a tabela "mesma sala, vários arranjos". */
export function capacidadesPorArea(areaM2: number | null | undefined): { key: SetupKey; label: string; capacidade: number }[] {
  return SETUPS.map((s) => ({ key: s.key, label: s.label, capacidade: capacidadePorSetup(areaM2, s.key) }))
}
/** Densidade real (m² por pessoa) dada a área e o nº de pessoas. 0 se sem pessoas. */
export function densidade(areaM2: number | null | undefined, pessoas: number | null | undefined): number {
  const a = Number(areaM2), p = Number(pessoas)
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(p) || p <= 0) return 0
  return a / p
}

/** Nível de conforto a partir da densidade (m²/pessoa). */
export type NivelDensidade = 'confortavel' | 'adequado' | 'apertado' | 'critico' | 'indefinido'
export function nivelDensidade(densidadeM2: number): NivelDensidade {
  if (!densidadeM2 || densidadeM2 <= 0) return 'indefinido'
  if (densidadeM2 >= 1.5) return 'confortavel'
  if (densidadeM2 >= 1.0) return 'adequado'
  if (densidadeM2 >= 0.6) return 'apertado'
  return 'critico'
}

/**
 * Avalia o arranjo contra a capacidade AUTORIZADA e contra a área disponível.
 * Critério de aceite: a capacidade por setup deve "conversar" com a folga real.
 *   • excedido — assentos acima da capacidade autorizada (compliance/segurança).
 *   • atencao  — dentro da autorizada, mas acima do recomendado pela área (aperto).
 *   • ok       — confortável.
 */
export type CapacidadeCheck = {
  lugares: number
  capacidade: number | null     // autorizada (licença/Acesso); null = não definida
  recomendadoArea: number       // máx. recomendado pela área no setup (0 se sem área)
  densidadeReal: number         // m²/pessoa considerando os lugares
  nivel: 'ok' | 'atencao' | 'excedido'
  nivelDensidade: NivelDensidade
  folga: number | null          // capacidade - lugares (null se sem capacidade)
}
export function checarCapacidade(p: {
  lugares: number
  capacidade?: number | null
  areaM2?: number | null
  setup: string
}): CapacidadeCheck {
  const lugares = Math.max(0, Math.round(Number(p.lugares) || 0))
  const capacidade = p.capacidade != null && Number.isFinite(Number(p.capacidade)) ? Math.max(0, Math.round(Number(p.capacidade))) : null
  const recomendadoArea = capacidadePorSetup(p.areaM2, p.setup)
  const densidadeReal = densidade(p.areaM2, lugares)
  let nivel: CapacidadeCheck['nivel'] = 'ok'
  if (capacidade != null && lugares > capacidade) nivel = 'excedido'
  else if (recomendadoArea > 0 && lugares > recomendadoArea) nivel = 'atencao'
  return {
    lugares, capacidade, recomendadoArea, densidadeReal,
    nivel, nivelDensidade: nivelDensidade(densidadeReal),
    folga: capacidade != null ? capacidade - lugares : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ARRANJO — gera os elementos de um setup a partir da área/capacidade.
// Determinístico: a quantidade vem da capacidade-alvo (ou da área), e o
// posicionamento é uma grade que cabe no canvas. É o "calcula capacidade" do
// editor — o usuário ajusta depois arrastando.
// ─────────────────────────────────────────────────────────────────────────────
export type ArranjoOpts = {
  areaM2?: number | null
  capacidade?: number | null         // alvo de lugares; default = capacidade por área
  canvas?: { largura: number; altura: number }
}

/** Gera uma Planta pronta para o setup. Reserva uma faixa de palco quando faz sentido. */
export function gerarArranjo(setup: string, opts: ArranjoOpts = {}): Planta {
  const meta = setupMeta(setup)
  const canvas = { largura: opts.canvas?.largura || CANVAS_PADRAO.largura, altura: opts.canvas?.altura || CANVAS_PADRAO.altura }
  const alvo = Math.max(0, Math.round(Number(opts.capacidade) || capacidadePorSetup(opts.areaM2, meta.key) || 0))
  const itens: Elemento[] = []
  let seq = 0
  const push = (e: Omit<Elemento, 'id'>) => { itens.push({ id: `el_${++seq}`, ...e }) }
  const novo = (tipo: ElementoTipo, over: Partial<Elemento>): Omit<Elemento, 'id'> => {
    const m = ELEMENTOS[tipo]
    return { tipo, x: 0, y: 0, w: m.w, h: m.h, rotacao: 0, rotulo: m.label, lugares: m.assento ? m.lugaresPadrao : 0, ...over }
  }

  // Faixa de palco/frente no topo (auditório/escolar/cabaré/U/espinha).
  const comPalco = ['auditorio', 'escolar', 'cabare', 'formato_u', 'espinha'].includes(meta.key)
  const margem = 30
  const topo = comPalco ? 130 : margem
  if (comPalco) {
    const pw = Math.min(ELEMENTOS.palco.w, canvas.largura - margem * 2)
    push(novo('palco', { x: (canvas.largura - pw) / 2, y: margem, w: pw, h: 80 }))
  }

  if (meta.key === 'auditorio') {
    // Fileiras de cadeiras: largura → cadeiras/fileira; nº de fileiras → alvo.
    const corredor = 60
    const larguraUtil = canvas.largura - margem * 2 - corredor
    const cadeiraW = 24
    const porFileira = Math.max(4, Math.floor(larguraUtil / cadeiraW))
    const nFileiras = Math.max(1, Math.ceil((alvo || porFileira * 6) / porFileira))
    const gapY = 24, hFil = ELEMENTOS.fileira.h
    let restante = alvo || porFileira * nFileiras
    for (let r = 0; r < nFileiras; r++) {
      const lug = Math.min(porFileira, restante); restante -= lug
      const w = lug * cadeiraW
      push(novo('fileira', { x: (canvas.largura - w) / 2, y: topo + r * (hFil + gapY), w, h: hFil, rotulo: `Fileira ${r + 1}`, lugares: lug }))
      if (restante <= 0) break
    }
    return { ...canvas, itens }
  }

  if (meta.key === 'formato_u') {
    // Mesas em U: lado esquerdo (desce), base (atravessa), lado direito (sobe).
    const tw = ELEMENTOS.mesa_retangular.w, th = ELEMENTOS.mesa_retangular.h
    const lugMesa = meta.lugaresPorMesa || 3
    const nMesas = Math.max(3, Math.ceil((alvo || 18) / lugMesa))
    const porLado = Math.max(1, Math.floor((nMesas - 1) / 2))
    let col = 0
    for (let i = 0; i < porLado; i++) push(novo('mesa_retangular', { x: margem, y: topo + i * (th + 20), w: th, h: tw, rotacao: 90, rotulo: `Mesa ${++col}`, lugares: lugMesa }))
    const baseY = topo + porLado * (th + 20)
    const nBase = Math.max(1, nMesas - porLado * 2)
    for (let i = 0; i < nBase; i++) push(novo('mesa_retangular', { x: margem + th + 30 + i * (tw + 20), y: baseY, w: tw, h: th, rotulo: `Mesa ${++col}`, lugares: lugMesa }))
    for (let i = 0; i < porLado; i++) push(novo('mesa_retangular', { x: canvas.largura - margem - th, y: topo + (porLado - 1 - i) * (th + 20), w: th, h: tw, rotacao: 90, rotulo: `Mesa ${++col}`, lugares: lugMesa }))
    return { ...canvas, itens }
  }

  if (meta.key === 'coquetel') {
    // Mesas altas espalhadas + bar + pista livre (a maioria fica em pé).
    const mesasAltas = Math.max(2, Math.min(12, Math.ceil((alvo || 40) / 12)))
    push(novo('bar', { x: canvas.largura - ELEMENTOS.bar.w - margem, y: margem, w: ELEMENTOS.bar.w, h: ELEMENTOS.bar.h }))
    const cols = Math.ceil(Math.sqrt(mesasAltas))
    const mw = ELEMENTOS.mesa_alta.w, gap = 80
    for (let i = 0; i < mesasAltas; i++) {
      const r = Math.floor(i / cols), c = i % cols
      push(novo('mesa_alta', { x: margem + c * (mw + gap), y: 120 + r * (mw + gap), rotulo: `Bistrô ${i + 1}`, lugares: ELEMENTOS.mesa_alta.lugaresPadrao }))
    }
    return { ...canvas, itens }
  }

  if (meta.key === 'pista') {
    // Área livre + palco + bar — sem assentos formais.
    const pw = Math.min(ELEMENTOS.palco.w, canvas.largura - margem * 2)
    push(novo('palco', { x: (canvas.largura - pw) / 2, y: margem, w: pw, h: 90 }))
    push(novo('pista', { x: (canvas.largura - ELEMENTOS.pista.w) / 2, y: 160, w: ELEMENTOS.pista.w, h: ELEMENTOS.pista.h, rotulo: 'Pista' }))
    push(novo('bar', { x: margem, y: canvas.altura - ELEMENTOS.bar.h - margem, w: ELEMENTOS.bar.w, h: ELEMENTOS.bar.h }))
    return { ...canvas, itens }
  }

  // Grade de mesas (banquete/cabaré/escolar/espinha/conselho e fallback).
  const mesaTipo: ElementoTipo = meta.mesa || 'mesa_redonda'
  const m = ELEMENTOS[mesaTipo]
  const lugMesa = meta.lugaresPorMesa || m.lugaresPadrao
  const nMesas = Math.max(1, Math.ceil((alvo || lugMesa * 6) / lugMesa))
  const larguraUtil = canvas.largura - margem * 2
  const cols = Math.max(1, Math.min(nMesas, Math.floor(larguraUtil / (m.w + 40)) || 1))
  const rows = Math.ceil(nMesas / cols)
  const gapX = cols > 1 ? (larguraUtil - cols * m.w) / (cols - 1) : 0
  const alturaUtil = canvas.altura - topo - margem
  const gapY = rows > 1 ? Math.max(30, (alturaUtil - rows * m.h) / (rows - 1)) : 0
  for (let i = 0; i < nMesas; i++) {
    const r = Math.floor(i / cols), c = i % cols
    const x = margem + c * (m.w + gapX)
    const y = topo + r * (m.h + gapY)
    push(novo(mesaTipo, { x, y, rotulo: `Mesa ${i + 1}`, lugares: lugMesa }))
  }
  return { ...canvas, itens }
}

// ── Mapa de mesas (alocação de convidados) ───────────────────────────────────
export type OcupacaoMesa = {
  id: string
  rotulo: string
  lugares: number
  ocupados: number
  livres: number
  excedido: boolean
}
export type OcupacaoResumo = {
  mesas: OcupacaoMesa[]
  totais: { lugares: number; alocados: number; naoAlocados: number; livres: number; mesasExcedidas: number }
}
/**
 * Ocupação por mesa a partir da planta + mapa. Considera apenas elementos com
 * assento; convidados em mesas inexistentes contam como não alocados.
 */
export function ocupacaoMesas(itens: Elemento[], mapa: MapaMesas): OcupacaoResumo {
  const mesas = mesasDaPlanta(itens)
  const idsValidos = new Set(mesas.map((m) => m.id))
  const out: OcupacaoMesa[] = []
  let lugaresTot = 0, alocados = 0, mesasExcedidas = 0
  for (const m of mesas) {
    const ocupados = (mapa.mesas[m.id] || []).length
    const excedido = ocupados > m.lugares
    lugaresTot += m.lugares
    alocados += ocupados
    if (excedido) mesasExcedidas++
    out.push({ id: m.id, rotulo: m.rotulo, lugares: m.lugares, ocupados, livres: Math.max(0, m.lugares - ocupados), excedido })
  }
  // Convidados em mesas removidas viram "não alocados" também.
  let orfaos = 0
  for (const k of Object.keys(mapa.mesas)) if (!idsValidos.has(k)) orfaos += (mapa.mesas[k] || []).length
  const naoAlocados = mapa.naoAlocados.length + orfaos
  return {
    mesas: out,
    totais: {
      lugares: lugaresTot, alocados, naoAlocados,
      livres: Math.max(0, lugaresTot - alocados), mesasExcedidas,
    },
  }
}

/**
 * Distribui uma lista de convidados nas mesas (assentos), preenchendo na ordem
 * natural; o excedente vai para `naoAlocados`. Determinístico — base do botão
 * "auto-distribuir". Preserva mesas existentes vazias.
 */
export function distribuirConvidados(itens: Elemento[], convidados: Convidado[]): MapaMesas {
  const mesas = mesasDaPlanta(itens)
  const out: MapaMesas = { mesas: {}, naoAlocados: [] }
  let i = 0
  for (const m of mesas) {
    out.mesas[m.id] = []
    while (out.mesas[m.id].length < m.lugares && i < convidados.length) out.mesas[m.id].push(convidados[i++])
  }
  while (i < convidados.length) out.naoAlocados.push(convidados[i++])
  return out
}

/** Gera N convidados anônimos ("Convidado 1..N") — semente a partir do nº do evento. */
export function convidadosAnonimos(n: number): Convidado[] {
  const q = Math.max(0, Math.round(Number(n) || 0))
  return Array.from({ length: q }, (_, i) => ({ nome: `Convidado ${i + 1}` }))
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export { isMissingTable } from '@/lib/dbErrors'
