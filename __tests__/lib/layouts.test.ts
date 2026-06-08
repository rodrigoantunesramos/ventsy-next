import { describe, it, expect } from 'vitest'
import {
  CANVAS_PADRAO,
  SETUPS, setupMeta, setupLabel,
  ELEMENTOS, elementoMeta, paletaElementos,
  normalizarElemento, mesclarPlanta, mesclarMapa,
  isAssento, mesasDaPlanta, lugaresDosElementos, lugaresDaPlanta, clampElemento,
  capacidadePorSetup, capacidadesPorArea, densidade, nivelDensidade, checarCapacidade,
  gerarArranjo, ocupacaoMesas, distribuirConvidados, convidadosAnonimos,
  isMissingTable,
  type Elemento, type MapaMesas, type Convidado,
} from '@/lib/layouts'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkEl(p: Partial<Elemento>): Elemento {
  return {
    id: p.id || 'e1', tipo: p.tipo ?? 'mesa_redonda', x: p.x ?? 0, y: p.y ?? 0,
    w: p.w ?? 90, h: p.h ?? 90, rotacao: p.rotacao ?? 0, rotulo: p.rotulo ?? 'Mesa',
    lugares: p.lugares ?? 8, ...p,
  }
}
const g = (nome: string): Convidado => ({ nome })

// ── Catálogos ───────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('setupMeta cai no banquete para chave inválida', () => {
    expect(setupMeta('xpto').key).toBe('banquete')
    expect(setupMeta(null).key).toBe('banquete')
    expect(setupLabel('auditorio')).toMatch(/Auditório/)
  })
  it('todo setup tem densidade positiva', () => {
    for (const s of SETUPS) expect(s.densidade).toBeGreaterThan(0)
  })
  it('elementoMeta cai em "area" para tipo desconhecido', () => {
    expect(elementoMeta('zzz')).toBe(ELEMENTOS.area)
    expect(elementoMeta('mesa_redonda').assento).toBe(true)
    expect(elementoMeta('palco').assento).toBe(false)
  })
  it('paletaElementos lista todos os tipos', () => {
    expect(paletaElementos().length).toBe(Object.keys(ELEMENTOS).length)
  })
})

// ── Normalização defensiva ────────────────────────────────────────────────────
describe('normalização', () => {
  it('normalizarElemento herda defaults do tipo e zera lugares de não-assento', () => {
    const el = normalizarElemento({ tipo: 'palco', x: 10, y: 20, lugares: 9 })
    expect(el.lugares).toBe(0)
    expect(el.w).toBe(ELEMENTOS.palco.w)
    const mesa = normalizarElemento({ tipo: 'mesa_redonda' })
    expect(mesa.lugares).toBe(ELEMENTOS.mesa_redonda.lugaresPadrao)
  })
  it('normalizarElemento coage lixo para tipo "area"', () => {
    expect(normalizarElemento({ tipo: 'hack' }).tipo).toBe('area')
    expect(normalizarElemento(null).tipo).toBe('area')
  })
  it('mesclarPlanta aceita array puro, objeto e lixo', () => {
    expect(mesclarPlanta(null)).toEqual({ largura: CANVAS_PADRAO.largura, altura: CANVAS_PADRAO.altura, itens: [] })
    const fromArr = mesclarPlanta([{ tipo: 'mesa_redonda' }])
    expect(fromArr.itens.length).toBe(1)
    const fromObj = mesclarPlanta({ largura: 800, altura: 600, itens: [{ tipo: 'bar' }] })
    expect(fromObj.largura).toBe(800)
    expect(fromObj.itens[0].tipo).toBe('bar')
  })
  it('mesclarPlanta impõe mínimo de dimensões', () => {
    expect(mesclarPlanta({ largura: 5, altura: 5 }).largura).toBe(200)
  })
  it('mesclarMapa aceita strings, objetos e descarta vazios', () => {
    const m = mesclarMapa({ mesas: { e1: ['Ana', { nome: 'Bia', restricao: 'vegano' }, {}] }, naoAlocados: ['Caio'] })
    expect(m.mesas.e1).toEqual([{ nome: 'Ana' }, { nome: 'Bia', restricao: 'vegano' }])
    expect(m.naoAlocados).toEqual([{ nome: 'Caio' }])
  })
  it('mesclarMapa devolve estrutura vazia para lixo', () => {
    expect(mesclarMapa(null)).toEqual({ mesas: {}, naoAlocados: [] })
  })
})

// ── Lugares / utilidades ──────────────────────────────────────────────────────
describe('lugares e utilidades', () => {
  it('isAssento e mesasDaPlanta filtram corretamente', () => {
    const itens = [mkEl({ id: 'm', tipo: 'mesa_redonda' }), mkEl({ id: 'p', tipo: 'palco', lugares: 0 })]
    expect(isAssento(itens[0])).toBe(true)
    expect(isAssento(itens[1])).toBe(false)
    expect(mesasDaPlanta(itens).map((m) => m.id)).toEqual(['m'])
  })
  it('lugaresDosElementos soma só assentos', () => {
    const itens = [mkEl({ tipo: 'mesa_redonda', lugares: 8 }), mkEl({ tipo: 'mesa_retangular', lugares: 6 }), mkEl({ tipo: 'bar', lugares: 0 })]
    expect(lugaresDosElementos(itens)).toBe(14)
    expect(lugaresDaPlanta({ largura: 1000, altura: 700, itens })).toBe(14)
  })
  it('clampElemento mantém o elemento dentro do canvas', () => {
    const el = clampElemento(mkEl({ x: -50, y: 9999, w: 90, h: 90 }), { largura: 1000, altura: 700 })
    expect(el.x).toBe(0)
    expect(el.y).toBe(700 - 90)
  })
})

// ── Capacidade por arranjo ────────────────────────────────────────────────────
describe('capacidade por setup', () => {
  it('capacidadePorSetup = floor(área / densidade)', () => {
    expect(capacidadePorSetup(180, 'banquete')).toBe(100)   // 180 / 1.8
    expect(capacidadePorSetup(180, 'auditorio')).toBe(163)  // floor(180 / 1.1)
    expect(capacidadePorSetup(180, 'coquetel')).toBe(200)   // 180 / 0.9
  })
  it('capacidadePorSetup é 0 para área inválida', () => {
    expect(capacidadePorSetup(0, 'banquete')).toBe(0)
    expect(capacidadePorSetup(null, 'banquete')).toBe(0)
    expect(capacidadePorSetup(-5, 'banquete')).toBe(0)
  })
  it('coquetel cabe mais gente que banquete na mesma área', () => {
    const aud = capacidadePorSetup(200, 'coquetel')
    const ban = capacidadePorSetup(200, 'banquete')
    expect(aud).toBeGreaterThan(ban)
  })
  it('capacidadesPorArea cobre todos os setups', () => {
    const rows = capacidadesPorArea(200)
    expect(rows.length).toBe(SETUPS.length)
    expect(rows.every((r) => r.capacidade > 0)).toBe(true)
  })
  it('densidade = área / pessoas, 0 sem pessoas', () => {
    expect(densidade(180, 90)).toBe(2)
    expect(densidade(180, 0)).toBe(0)
    expect(densidade(0, 10)).toBe(0)
  })
  it('nivelDensidade classifica por faixas', () => {
    expect(nivelDensidade(2)).toBe('confortavel')
    expect(nivelDensidade(1.2)).toBe('adequado')
    expect(nivelDensidade(0.7)).toBe('apertado')
    expect(nivelDensidade(0.4)).toBe('critico')
    expect(nivelDensidade(0)).toBe('indefinido')
  })
})

describe('checarCapacidade', () => {
  it('excedido quando lugares passam da capacidade autorizada', () => {
    const c = checarCapacidade({ lugares: 120, capacidade: 100, areaM2: 200, setup: 'banquete' })
    expect(c.nivel).toBe('excedido')
    expect(c.folga).toBe(-20)
  })
  it('atenção quando dentro da autorizada mas acima do recomendado pela área', () => {
    // área 90 → recomendado banquete = 50; 60 lugares, capacidade autorizada 200
    const c = checarCapacidade({ lugares: 60, capacidade: 200, areaM2: 90, setup: 'banquete' })
    expect(c.nivel).toBe('atencao')
    expect(c.recomendadoArea).toBe(50)
  })
  it('ok quando confortável', () => {
    const c = checarCapacidade({ lugares: 40, capacidade: 100, areaM2: 200, setup: 'banquete' })
    expect(c.nivel).toBe('ok')
    expect(c.folga).toBe(60)
  })
  it('sem capacidade autorizada → folga null, nunca excedido por capacidade', () => {
    const c = checarCapacidade({ lugares: 999, areaM2: 200, setup: 'banquete' })
    expect(c.capacidade).toBeNull()
    expect(c.folga).toBeNull()
    expect(c.nivel).toBe('atencao') // ainda acima do recomendado pela área
  })
})

// ── Auto-arranjo ──────────────────────────────────────────────────────────────
describe('gerarArranjo', () => {
  it('banquete gera mesas suficientes p/ a capacidade-alvo', () => {
    const p = gerarArranjo('banquete', { capacidade: 80 })
    const mesas = mesasDaPlanta(p.itens)
    expect(mesas.length).toBe(10)                 // 80 / 8
    expect(lugaresDaPlanta(p)).toBeGreaterThanOrEqual(80)
    expect(mesas.every((m) => m.tipo === 'mesa_redonda')).toBe(true)
  })
  it('todos os elementos do arranjo ficam dentro do canvas', () => {
    const canvas = { largura: 1000, altura: 700 }
    for (const s of SETUPS) {
      const p = gerarArranjo(s.key, { capacidade: 60, canvas })
      for (const el of p.itens) {
        expect(el.x).toBeGreaterThanOrEqual(0)
        expect(el.y).toBeGreaterThanOrEqual(0)
        expect(el.x + el.w).toBeLessThanOrEqual(canvas.largura + 1)
      }
    }
  })
  it('auditório gera fileiras + um palco', () => {
    const p = gerarArranjo('auditorio', { capacidade: 100 })
    expect(p.itens.some((e) => e.tipo === 'palco')).toBe(true)
    expect(p.itens.some((e) => e.tipo === 'fileira')).toBe(true)
    expect(lugaresDaPlanta(p)).toBeGreaterThanOrEqual(100)
  })
  it('pista não tem assentos formais mas tem palco', () => {
    const p = gerarArranjo('pista', { areaM2: 300 })
    expect(lugaresDaPlanta(p)).toBe(0)
    expect(p.itens.some((e) => e.tipo === 'palco')).toBe(true)
  })
  it('usa a área quando não há capacidade-alvo', () => {
    const p = gerarArranjo('banquete', { areaM2: 180 }) // recomendado 100 → 13 mesas
    expect(lugaresDaPlanta(p)).toBeGreaterThanOrEqual(100)
  })
  it('é determinístico (mesma entrada, mesma saída)', () => {
    expect(gerarArranjo('escolar', { capacidade: 40 })).toEqual(gerarArranjo('escolar', { capacidade: 40 }))
  })
})

// ── Mapa de mesas ─────────────────────────────────────────────────────────────
describe('ocupacaoMesas & distribuição', () => {
  const itens = [
    mkEl({ id: 'm1', tipo: 'mesa_redonda', lugares: 8 }),
    mkEl({ id: 'm2', tipo: 'mesa_redonda', lugares: 8 }),
    mkEl({ id: 'palco', tipo: 'palco', lugares: 0 }),
  ]
  it('distribuirConvidados preenche na ordem e transborda para naoAlocados', () => {
    const convidados = Array.from({ length: 20 }, (_, i) => g(`C${i + 1}`))
    const mapa = distribuirConvidados(itens, convidados)
    expect(mapa.mesas.m1.length).toBe(8)
    expect(mapa.mesas.m2.length).toBe(8)
    expect(mapa.naoAlocados.length).toBe(4)
  })
  it('ocupacaoMesas soma ocupação, livres e excedentes', () => {
    const mapa: MapaMesas = { mesas: { m1: Array.from({ length: 9 }, (_, i) => g(`A${i}`)), m2: [g('x')] }, naoAlocados: [g('z')] }
    const r = ocupacaoMesas(itens, mapa)
    expect(r.mesas.find((m) => m.id === 'm1')!.excedido).toBe(true)
    expect(r.totais.lugares).toBe(16)
    expect(r.totais.alocados).toBe(10)
    expect(r.totais.naoAlocados).toBe(1)
    expect(r.totais.mesasExcedidas).toBe(1)
  })
  it('convidados em mesa removida contam como não alocados', () => {
    const mapa: MapaMesas = { mesas: { fantasma: [g('a'), g('b')] }, naoAlocados: [] }
    const r = ocupacaoMesas(itens, mapa)
    expect(r.totais.naoAlocados).toBe(2)
    expect(r.totais.alocados).toBe(0)
  })
  it('convidadosAnonimos gera N nomes sequenciais', () => {
    expect(convidadosAnonimos(3)).toEqual([{ nome: 'Convidado 1' }, { nome: 'Convidado 2' }, { nome: 'Convidado 3' }])
    expect(convidadosAnonimos(0)).toEqual([])
  })
})

// ── isMissingTable ────────────────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece PGRST205 / 42P01 / mensagens', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
