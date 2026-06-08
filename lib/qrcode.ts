// Codificador PURO de QR Code (Model 2) — SEM dependências externas.
// ─────────────────────────────────────────────────────────────────────────────
// Por que existe: o credenciamento (/painel/acesso) precisa imprimir um QR ÚNICO
// por credencial e lê-lo na portaria. Não há lib de QR no projeto, e gerar o QR
// por um serviço externo vazaria o token da credencial para fora do dispositivo
// (problema de privacidade + hostil a operação offline). Então geramos o QR
// localmente, em código puro e testável. É reutilizável por Bilheteria,
// Estacionamento e Expositores (que também emitem QR).
//
// Escopo deliberadamente enxuto, suficiente para tokens curtos (ASCII):
//   • Modo BYTE, versões 1–10 (auto), níveis de correção L/M/Q/H.
//   • Reed–Solomon sobre GF(256) (primitivo 0x11D), interleaving multi-bloco.
//   • Máscara escolhida pela penalidade padrão (8 máscaras) p/ leitura robusta.
//   • Info de formato (BCH 15,5) e de versão (BCH 18,6) conforme ISO/IEC 18004.
//
// Regras de ouro (espelham lib/acesso.ts / lib/reservas.ts): SEM React, SEM
// Supabase, SEM "R$"/Intl. Saída crua (matriz de módulos); a renderização (SVG)
// fica na UI. Determinístico: nenhuma fonte de aleatoriedade/relógio aqui.
//
// As partes mais sujeitas a erro (aritmética GF, gerador RS, BCH de formato/
// versão) são checadas contra constantes publicadas em __tests__/lib/qrcode.test.ts.

export type QrEcLevel = 'L' | 'M' | 'Q' | 'H'

export type QrMatrix = {
  size: number            // nº de módulos por lado (sem quiet zone)
  version: number         // 1–10
  ecLevel: QrEcLevel
  mask: number            // máscara aplicada (0–7)
  modules: boolean[][]    // [linha][coluna]; true = módulo escuro
}

// ── GF(256) — campo de Galois com primitivo 0x11D (gerador 2) ────────────────
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(function initGF() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

/** α^n no GF(256) (exportado para validação por síndrome nos testes). */
export function gfExp(n: number): number {
  return GF_EXP[((n % 255) + 255) % 255]
}

/** Polinômio gerador de Reed–Solomon de grau `degree` (coeficientes, grau→0). */
export function rsGeneratorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i])
    }
    poly = next
  }
  return poly
}

/** Codewords de correção de erro (Reed–Solomon) para um bloco de dados. */
export function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen)
  const buf = data.concat(new Array(ecLen).fill(0))
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i]
    if (factor !== 0) for (let j = 0; j < gen.length; j++) buf[i + j] ^= gfMul(gen[j], factor)
  }
  return buf.slice(data.length)
}

// ── Tabela de blocos por (versão, nível) — ISO/IEC 18004 Tabela 9, v1–10 ─────
// [ecCodewordsPorBloco, grupos:[ [qtdeBlocos, dataCodewordsPorBloco], ... ] ]
type BlocoSpec = [number, [number, number][]]
const EC_BLOCKS: Record<number, Record<QrEcLevel, BlocoSpec>> = {
  1:  { L: [7, [[1, 19]]],  M: [10, [[1, 16]]], Q: [13, [[1, 13]]], H: [17, [[1, 9]]] },
  2:  { L: [10, [[1, 34]]], M: [16, [[1, 28]]], Q: [22, [[1, 22]]], H: [28, [[1, 16]]] },
  3:  { L: [15, [[1, 55]]], M: [26, [[1, 44]]], Q: [18, [[2, 17]]], H: [22, [[2, 13]]] },
  4:  { L: [20, [[1, 80]]], M: [18, [[2, 32]]], Q: [26, [[2, 24]]], H: [16, [[4, 9]]] },
  5:  { L: [26, [[1, 108]]], M: [24, [[2, 43]]], Q: [18, [[2, 15], [2, 16]]], H: [22, [[2, 11], [2, 12]]] },
  6:  { L: [18, [[2, 68]]], M: [16, [[4, 27]]], Q: [24, [[4, 19]]], H: [28, [[4, 15]]] },
  7:  { L: [20, [[2, 78]]], M: [18, [[4, 31]]], Q: [18, [[2, 14], [4, 15]]], H: [26, [[4, 13], [1, 14]]] },
  8:  { L: [24, [[2, 97]]], M: [22, [[2, 38], [2, 39]]], Q: [22, [[4, 18], [2, 19]]], H: [26, [[4, 14], [2, 15]]] },
  9:  { L: [30, [[2, 116]]], M: [22, [[3, 36], [2, 37]]], Q: [20, [[4, 16], [4, 17]]], H: [24, [[4, 12], [4, 13]]] },
  10: { L: [18, [[2, 68], [2, 69]]], M: [26, [[4, 43], [1, 44]]], Q: [24, [[6, 19], [2, 20]]], H: [28, [[6, 15], [2, 16]]] },
}
const MAX_VERSION = 10

/** Total de data codewords disponíveis numa (versão, nível). */
function dataCodewordCount(version: number, ec: QrEcLevel): number {
  const [, groups] = EC_BLOCKS[version][ec]
  return groups.reduce((s, [count, perBlock]) => s + count * perBlock, 0)
}

// Centros dos padrões de alinhamento por versão (v1 não tem) — ISO Tabela E.1.
const ALIGN_POS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
}

// ── Bits utilitários ──────────────────────────────────────────────────────────
function getBit(x: number, i: number): boolean { return ((x >>> i) & 1) !== 0 }

function pushBits(arr: number[], value: number, len: number): void {
  for (let i = len - 1; i >= 0; i--) arr.push((value >>> i) & 1)
}

// ── Etapa 1: bitstream de dados (modo byte) ──────────────────────────────────
function textToBytes(text: string): number[] {
  // UTF-8 — tokens são ASCII, mas garantimos correção p/ acentos eventuais.
  const out: number[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) { out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)) }
    else if (cp < 0x10000) { out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)) }
    else { out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)) }
  }
  return out
}

function chooseVersion(byteLen: number, ec: QrEcLevel): number {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v < 10 ? 8 : 16
    const needBits = 4 + countBits + 8 * byteLen
    if (needBits <= dataCodewordCount(v, ec) * 8) return v
  }
  throw new Error(`QR: conteúdo grande demais (${byteLen} bytes) para versões 1–${MAX_VERSION}`)
}

function buildCodewords(bytes: number[], version: number, ec: QrEcLevel): number[] {
  const capacity = dataCodewordCount(version, ec)
  const countBits = version < 10 ? 8 : 16
  const bits: number[] = []
  pushBits(bits, 0b0100, 4)          // indicador de modo: byte
  pushBits(bits, bytes.length, countBits)
  for (const b of bytes) pushBits(bits, b, 8)
  // terminador (até 4 zeros, sem estourar a capacidade)
  const capBits = capacity * 8
  pushBits(bits, 0, Math.min(4, capBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  // bytes de preenchimento alternados (0xEC, 0x11)
  const cw: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
    cw.push(byte)
  }
  for (let i = 0; cw.length < capacity; i++) cw.push(i % 2 === 0 ? 0xec : 0x11)
  return cw
}

/** Divide em blocos, gera RS por bloco e faz o interleaving (dados + EC). */
function interleave(dataCw: number[], version: number, ec: QrEcLevel): number[] {
  const [ecPerBlock, groups] = EC_BLOCKS[version][ec]
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let pos = 0
  for (const [count, perBlock] of groups) {
    for (let b = 0; b < count; b++) {
      const block = dataCw.slice(pos, pos + perBlock)
      pos += perBlock
      dataBlocks.push(block)
      ecBlocks.push(rsEncode(block, ecPerBlock))
    }
  }
  const out: number[] = []
  const maxData = Math.max(...dataBlocks.map((b) => b.length))
  for (let i = 0; i < maxData; i++) for (const block of dataBlocks) if (i < block.length) out.push(block[i])
  for (let i = 0; i < ecPerBlock; i++) for (const block of ecBlocks) out.push(block[i])
  return out
}

// ── Etapa 2: matriz e padrões de função ──────────────────────────────────────
type Grid = { size: number; modules: boolean[][]; func: boolean[][] }

function newGrid(size: number): Grid {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    func: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  }
}

function setFn(g: Grid, x: number, y: number, dark: boolean): void {
  g.modules[y][x] = dark
  g.func[y][x] = true
}

function placeFinder(g: Grid, cx: number, cy: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || x >= g.size || y < 0 || y >= g.size) continue
      const inner = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
      // anel externo (dist 2 ou 4) escuro, centro 3x3 escuro, resto claro
      setFn(g, x, y, inner === 2 ? false : inner <= 3)
    }
  }
}

function placeAlignment(g: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy))
      setFn(g, cx + dx, cy + dy, ring !== 1) // borda + centro escuros, anel interno claro
    }
  }
}

function placeFunctionPatterns(g: Grid, version: number): void {
  const n = g.size
  // padrões localizadores (3 cantos) + separadores (já cobertos pela faixa -1..7)
  placeFinder(g, 0, 0)
  placeFinder(g, n - 7, 0)
  placeFinder(g, 0, n - 7)
  // timing patterns
  for (let i = 8; i < n - 8; i++) {
    const dark = i % 2 === 0
    setFn(g, i, 6, dark)
    setFn(g, 6, i, dark)
  }
  // padrões de alinhamento (pulando os que colidem com localizadores)
  const pos = ALIGN_POS[version]
  for (const cy of pos) {
    for (const cx of pos) {
      const nearFinder =
        (cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9)
      if (!nearFinder) placeAlignment(g, cx, cy)
    }
  }
  // módulo escuro fixo
  setFn(g, 8, n - 8, true)
  // reserva das áreas de informação de formato/versão (preenchidas depois)
  reserveFormatAreas(g, version)
}

function reserveFormatAreas(g: Grid, version: number): void {
  const n = g.size
  for (let i = 0; i < 9; i++) { if (!g.func[i][8]) g.func[i][8] = true; if (!g.func[8][i]) g.func[8][i] = true }
  for (let i = 0; i < 8; i++) { g.func[8][n - 1 - i] = true; g.func[n - 1 - i][8] = true }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      g.func[n - 11 + j][i] = true
      g.func[i][n - 11 + j] = true
    }
  }
}

// ── Etapa 3: colocação dos dados (zigue-zague) ───────────────────────────────
function placeData(g: Grid, bits: number[]): void {
  const n = g.size
  let i = 0
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // pula a coluna de timing
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? n - 1 - vert : vert
        if (!g.func[y][x] && i < bits.length) {
          g.modules[y][x] = bits[i] === 1
          i++
        }
      }
    }
  }
}

// ── Etapa 4: máscaras ─────────────────────────────────────────────────────────
function maskCondition(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0
    case 1: return y % 2 === 0
    case 2: return x % 3 === 0
    case 3: return (x + y) % 3 === 0
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default: return false
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.func[y][x] && maskCondition(mask, x, y)) g.modules[y][x] = !g.modules[y][x]
    }
  }
}

// ── Info de formato (BCH 15,5) e de versão (BCH 18,6) ────────────────────────
const EC_FORMAT_BITS: Record<QrEcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }

/** 15 bits de informação de formato (nível EC + máscara), já com XOR padrão. */
export function formatInfoBits(ec: QrEcLevel, mask: number): number {
  const data = (EC_FORMAT_BITS[ec] << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

/** 18 bits de informação de versão (apenas v≥7). */
export function versionInfoBits(version: number): number {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  return (version << 12) | rem
}

function drawFormat(g: Grid, ec: QrEcLevel, mask: number): void {
  const bits = formatInfoBits(ec, mask)
  const n = g.size
  for (let i = 0; i < 6; i++) setFn(g, 8, i, getBit(bits, i))
  setFn(g, 8, 7, getBit(bits, 6))
  setFn(g, 8, 8, getBit(bits, 7))
  setFn(g, 7, 8, getBit(bits, 8))
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, getBit(bits, i))
  for (let i = 0; i < 8; i++) setFn(g, n - 1 - i, 8, getBit(bits, i))
  for (let i = 8; i < 15; i++) setFn(g, 8, n - 15 + i, getBit(bits, i))
  setFn(g, 8, n - 8, true)
}

function drawVersion(g: Grid, version: number): void {
  if (version < 7) return
  const bits = versionInfoBits(version)
  const n = g.size
  for (let i = 0; i < 18; i++) {
    const bit = getBit(bits, i)
    const a = n - 11 + (i % 3)
    const b = Math.floor(i / 3)
    setFn(g, b, a, bit)
    setFn(g, a, b, bit)
  }
}

// ── Penalidade (escolha da máscara) — ISO 18004 §8.8.2 ───────────────────────
function penalty(g: Grid): number {
  const n = g.size
  const m = g.modules
  let score = 0
  // Regra 1: corridas ≥5 na mesma cor (linhas e colunas)
  for (let y = 0; y < n; y++) {
    let runColor = m[y][0], run = 1
    for (let x = 1; x < n; x++) {
      if (m[y][x] === runColor) { run++ } else { if (run >= 5) score += 3 + (run - 5); runColor = m[y][x]; run = 1 }
    }
    if (run >= 5) score += 3 + (run - 5)
  }
  for (let x = 0; x < n; x++) {
    let runColor = m[0][x], run = 1
    for (let y = 1; y < n; y++) {
      if (m[y][x] === runColor) { run++ } else { if (run >= 5) score += 3 + (run - 5); runColor = m[y][x]; run = 1 }
    }
    if (run >= 5) score += 3 + (run - 5)
  }
  // Regra 2: blocos 2x2 de mesma cor
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = m[y][x]
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3
    }
  }
  // Regra 3: padrões tipo localizador (1:1:3:1:1 com 4 claros)
  const p1 = [true, false, true, true, true, false, true, false, false, false, false]
  const p2 = [false, false, false, false, true, false, true, true, true, false, true]
  const matches = (get: (k: number) => boolean, len: number, start: number, pat: boolean[]) => {
    for (let k = 0; k < 11; k++) if (get(start + k) !== pat[k]) return false
    return true
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x <= n - 11; x++) {
      const get = (k: number) => m[y][k]
      if (matches(get, n, x, p1) || matches(get, n, x, p2)) score += 40
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y <= n - 11; y++) {
      const get = (k: number) => m[k][x]
      if (matches(get, n, y, p1) || matches(get, n, y, p2)) score += 40
    }
  }
  // Regra 4: desvio da proporção 50% de módulos escuros
  let dark = 0
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) dark++
  const ratio = (dark * 100) / (n * n)
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10
  return score
}

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * Gera a matriz de módulos de um QR para `text` (modo byte). Escolhe a menor
 * versão (1–10) que comporta o conteúdo e a máscara de menor penalidade.
 * Lança se o texto não couber até a versão 10 (não ocorre com tokens curtos).
 */
export function qrMatrix(text: string, opts: { ecLevel?: QrEcLevel } = {}): QrMatrix {
  const ec = opts.ecLevel ?? 'M'
  const bytes = textToBytes(text)
  const version = chooseVersion(bytes.length, ec)
  const size = 17 + version * 4

  const dataCw = buildCodewords(bytes, version, ec)
  const finalCw = interleave(dataCw, version, ec)
  const bits: number[] = []
  for (const cw of finalCw) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1)

  const g = newGrid(size)
  placeFunctionPatterns(g, version)
  drawVersion(g, version)
  placeData(g, bits)

  // escolhe a melhor máscara
  let best = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(g, mask)
    drawFormat(g, ec, mask)
    const s = penalty(g)
    if (s < bestScore) { bestScore = s; best = mask }
    applyMask(g, mask) // desfaz (máscara é XOR)
  }
  applyMask(g, best)
  drawFormat(g, ec, best)

  return { size, version, ecLevel: ec, mask: best, modules: g.modules }
}

/** Retorna uma cópia da matriz com `quiet` módulos de borda clara ao redor. */
export function withQuietZone(qr: QrMatrix, quiet = 4): boolean[][] {
  const n = qr.size
  const out = Array.from({ length: n + quiet * 2 }, () => new Array<boolean>(n + quiet * 2).fill(false))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y + quiet][x + quiet] = qr.modules[y][x]
  return out
}

/**
 * Caminho SVG (atributo `d`) que desenha todos os módulos escuros como quadrados
 * 1×1 (coordenadas em módulos). Renderize num <svg viewBox="0 0 lado lado">.
 * Mais leve que um <rect> por módulo. Inclui quiet zone se passada a matriz dela.
 */
export function modulesToSvgPath(modules: boolean[][]): string {
  const parts: string[] = []
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules[y].length; x++) {
      if (modules[y][x]) parts.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  return parts.join('')
}

/**
 * SVG completo (string) de um QR — para janelas de impressão (crachás) onde não
 * dá para usar JSX. Puro: só monta texto. A UI React usa qrMatrix + path direto.
 */
export function qrSvgString(
  text: string,
  opts: { ecLevel?: QrEcLevel; size?: number; quiet?: number; bg?: string; fg?: string } = {},
): string {
  const qr = qrMatrix(text, { ecLevel: opts.ecLevel ?? 'M' })
  const mods = withQuietZone(qr, opts.quiet ?? 4)
  const dim = mods.length
  const path = modulesToSvgPath(mods)
  const size = opts.size ?? 160
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${opts.bg ?? '#fff'}"/><path d="${path}" fill="${opts.fg ?? '#000'}"/></svg>`
}
