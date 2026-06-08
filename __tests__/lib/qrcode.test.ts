import { describe, it, expect } from 'vitest'
import {
  qrMatrix, withQuietZone, modulesToSvgPath,
  formatInfoBits, versionInfoBits, rsEncode, rsGeneratorPoly, gfMul, gfExp,
} from '@/lib/qrcode'

// O encoder não pode ser validado por câmera neste ambiente, então validamos as
// partes mais sujeitas a erro (aritmética GF / Reed–Solomon / BCH de formato e
// versão) CONTRA INVARIANTES MATEMÁTICOS e CONSTANTES PUBLICADAS da ISO 18004.

// Divisão polinomial em GF(2) — resto de `value` por `gen` (bit a bit).
function polyModGF2(value: number, gen: number): number {
  const genDeg = 31 - Math.clz32(gen)
  let v = value
  for (let i = 31 - Math.clz32(v); i >= genDeg; i = 31 - Math.clz32(v)) {
    if (v === 0) break
    v ^= gen << (i - genDeg)
  }
  return v
}

describe('GF(256) e Reed–Solomon', () => {
  it('gfExp/gfMul satisfazem o campo (α^255 = 1, multiplicação por log)', () => {
    expect(gfExp(0)).toBe(1)
    expect(gfExp(255)).toBe(1)            // ordem do gerador = 255
    expect(gfMul(0, 123)).toBe(0)
    expect(gfMul(1, 123)).toBe(123)
    expect(gfMul(gfExp(5), gfExp(100))).toBe(gfExp(105)) // α^a·α^b = α^(a+b)
  })

  it('rsGeneratorPoly tem grau n e coeficiente líder 1', () => {
    for (const n of [7, 10, 13, 26]) {
      const g = rsGeneratorPoly(n)
      expect(g).toHaveLength(n + 1)
      expect(g[0]).toBe(1)
    }
  })

  it('codeword (dados+EC) é divisível pelo gerador RS — síndromes nulas', () => {
    // Propriedade definidora de Reed–Solomon: avaliar o codeword completo em
    // α^0..α^(ecLen-1) deve dar 0. Valida toda a aritmética sem vetor externo.
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]
    const ecLen = 13
    const ec = rsEncode(data, ecLen)
    expect(ec).toHaveLength(ecLen)
    const full = [...data, ...ec]
    for (let s = 0; s < ecLen; s++) {
      const root = gfExp(s)
      // Horner em GF(256)
      let acc = 0
      for (const c of full) acc = gfMul(acc, root) ^ c
      expect(acc).toBe(0)
    }
  })
})

describe('Informação de formato (BCH 15,5)', () => {
  it('(M, máscara 0) = 0x5412 (constante publicada)', () => {
    expect(formatInfoBits('M', 0)).toBe(0x5412)
  })

  it('todas as 32 combinações: (bits XOR 0x5412) divisível por 0x537 e 5 bits de dados corretos', () => {
    const ecBits: Record<string, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }
    const seen = new Set<number>()
    for (const ec of ['L', 'M', 'Q', 'H'] as const) {
      for (let mask = 0; mask < 8; mask++) {
        const bits = formatInfoBits(ec, mask)
        expect(bits).toBeGreaterThanOrEqual(0)
        expect(bits).toBeLessThan(1 << 15)
        // o codeword sem o XOR padrão é múltiplo do gerador BCH 0x537
        expect(polyModGF2(bits ^ 0x5412, 0x537)).toBe(0)
        // os 5 bits de dados (após desfazer o XOR) = nível<<3 | máscara
        const data = ((bits ^ 0x5412) >>> 10) & 0x1f
        expect(data).toBe((ecBits[ec] << 3) | mask)
        seen.add(bits)
      }
    }
    expect(seen.size).toBe(32) // todas distintas
  })
})

describe('Informação de versão (BCH 18,6)', () => {
  it('v7 = 0x07C94 (constante publicada)', () => {
    expect(versionInfoBits(7)).toBe(0x07c94)
  })
  it('v7–v10: (bits) divisível por 0x1F25 e 6 bits superiores = versão', () => {
    for (let v = 7; v <= 10; v++) {
      const bits = versionInfoBits(v)
      expect(polyModGF2(bits, 0x1f25)).toBe(0)
      expect((bits >>> 12) & 0x3f).toBe(v)
    }
  })
})

describe('qrMatrix — estrutura', () => {
  it('escolhe versão pequena para token curto e dimensiona a matriz', () => {
    const qr = qrMatrix('VTS:1f3a9c', { ecLevel: 'M' })
    expect(qr.version).toBeGreaterThanOrEqual(1)
    expect(qr.version).toBeLessThanOrEqual(3)
    expect(qr.size).toBe(17 + qr.version * 4)
    expect(qr.modules).toHaveLength(qr.size)
    expect(qr.modules[0]).toHaveLength(qr.size)
  })

  it('coloca os padrões localizadores nos três cantos', () => {
    const qr = qrMatrix('CREDENCIAL-TESTE', { ecLevel: 'M' })
    const n = qr.size
    const m = qr.modules
    // canto do anel externo escuro, anel claro, centro escuro (TL, TR, BL)
    for (const [oy, ox] of [[0, 0], [0, n - 7], [n - 7, 0]] as [number, number][]) {
      expect(m[oy][ox]).toBe(true)            // canto externo
      expect(m[oy + 1][ox + 1]).toBe(false)   // anel claro
      expect(m[oy + 3][ox + 3]).toBe(true)    // centro
    }
  })

  it('módulo escuro fixo em (8, size-8)', () => {
    const qr = qrMatrix('x', { ecLevel: 'L' })
    expect(qr.modules[qr.size - 8][8]).toBe(true)
  })

  it('é determinístico (mesmo texto → mesma matriz) e sensível ao conteúdo', () => {
    const a = qrMatrix('token-AAAA')
    const b = qrMatrix('token-AAAA')
    const c = qrMatrix('token-BBBB')
    expect(a.modules).toEqual(b.modules)
    expect(a.modules).not.toEqual(c.modules)
  })

  it('lança quando o conteúdo excede a capacidade (v1–10)', () => {
    expect(() => qrMatrix('x'.repeat(400), { ecLevel: 'H' })).toThrow()
  })
})

describe('renderização auxiliar', () => {
  it('withQuietZone amplia a matriz simetricamente', () => {
    const qr = qrMatrix('abc')
    const wq = withQuietZone(qr, 4)
    expect(wq).toHaveLength(qr.size + 8)
    expect(wq[0]).toHaveLength(qr.size + 8)
    expect(wq[0][0]).toBe(false) // borda clara
  })
  it('modulesToSvgPath gera um segmento por módulo escuro', () => {
    const qr = qrMatrix('abc')
    const dark = qr.modules.flat().filter(Boolean).length
    const path = modulesToSvgPath(qr.modules)
    expect(path.match(/M/g)?.length).toBe(dark)
  })
})
