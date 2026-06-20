import { describe, it, expect } from 'vitest'
import {
  MODULOS_PAINEL, MODULOS_CORE, PLANO_ORDEM, PLANOS_TIERS,
  moduloDaRota, moduloDef, moduloLabel, isCore, normalizarPlano,
  modulosDefaultDoPlano, resolverEntitlement, planoMinimoParaModulo,
} from '@/lib/modulos'

describe('catálogo', () => {
  it('tem chaves únicas', () => {
    const keys = MODULOS_PAINEL.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('núcleo inclui painel/configuracoes/planos', () => {
    expect(MODULOS_CORE).toEqual(expect.arrayContaining(['painel', 'configuracoes', 'planos']))
  })
  it('moduloDef/moduloLabel/isCore', () => {
    expect(moduloDef('reservas')?.grupo).toBe('Gestão')
    expect(moduloLabel('rh')).toBe('RH')
    expect(moduloLabel('inexistente')).toBe('inexistente')
    expect(isCore('planos')).toBe(true)
    expect(isCore('reservas')).toBe(false)
  })
})

describe('moduloDaRota', () => {
  it('mapeia a raiz e os segmentos', () => {
    expect(moduloDaRota('/painel')).toBe('painel')
    expect(moduloDaRota('/painel/reservas')).toBe('reservas')
    expect(moduloDaRota('/painel/minha-propriedade')).toBe('minha-propriedade')
    expect(moduloDaRota('/painel/reservas/123/editar')).toBe('reservas')
    expect(moduloDaRota('/painel/clientes?aba=ficha')).toBe('clientes')
  })
  it('ignora rotas fora do painel', () => {
    expect(moduloDaRota('/login')).toBeNull()
    expect(moduloDaRota('/painelzinho')).toBeNull()
    expect(moduloDaRota(null)).toBeNull()
  })
})

describe('normalizarPlano', () => {
  it('reconhece tiers e cai em basico', () => {
    expect(normalizarPlano('PRO')).toBe('pro')
    expect(normalizarPlano('ultra')).toBe('ultra')
    expect(normalizarPlano('desconhecido')).toBe('basico')
    expect(normalizarPlano(null)).toBe('basico')
  })
})

describe('modulosDefaultDoPlano', () => {
  it('é monotônico: básico ⊆ pro ⊆ ultra', () => {
    const b = new Set(modulosDefaultDoPlano('basico'))
    const p = new Set(modulosDefaultDoPlano('pro'))
    const u = new Set(modulosDefaultDoPlano('ultra'))
    for (const k of b) expect(p.has(k)).toBe(true)
    for (const k of p) expect(u.has(k)).toBe(true)
    expect(u.size).toBe(MODULOS_PAINEL.length) // ultra inclui tudo
    expect(b.size).toBeLessThan(p.size)
    expect(p.size).toBeLessThan(u.size)
  })
  it('básico inclui o núcleo', () => {
    const b = modulosDefaultDoPlano('basico')
    for (const k of MODULOS_CORE) expect(b).toContain(k)
  })
})

describe('resolverEntitlement', () => {
  it('une núcleo + plano + add-ons', () => {
    const ent = resolverEntitlement(['reservas'], ['rh'])
    expect(ent.has('reservas')).toBe(true)
    expect(ent.has('rh')).toBe(true)
    expect(ent.has('painel')).toBe(true) // núcleo sempre presente
    expect(ent.has('contabilidade')).toBe(false)
  })
  it('núcleo entra mesmo sem plano nem add-ons', () => {
    const ent = resolverEntitlement(null, null)
    for (const k of MODULOS_CORE) expect(ent.has(k)).toBe(true)
  })
})

describe('planoMinimoParaModulo', () => {
  it('usa o mapa de planos quando fornecido', () => {
    const mapa = { basico: ['reservas'], pro: ['reservas', 'rh'], ultra: ['reservas', 'rh', 'contabilidade'] }
    expect(planoMinimoParaModulo('reservas', mapa)).toBe('basico')
    expect(planoMinimoParaModulo('rh', mapa)).toBe('pro')
    expect(planoMinimoParaModulo('contabilidade', mapa)).toBe('ultra')
  })
  it('cai no default do catálogo sem mapa', () => {
    expect(planoMinimoParaModulo('reservas')).toBe('basico')
    expect(planoMinimoParaModulo('contabilidade')).toBe('pro')
    expect(planoMinimoParaModulo('inexistente')).toBeNull()
  })
})

describe('coerência de tiers', () => {
  it('todo módulo tem tier conhecido', () => {
    for (const m of MODULOS_PAINEL) {
      expect(PLANOS_TIERS).toContain(m.plano)
      expect(PLANO_ORDEM[m.plano]).toBeGreaterThanOrEqual(0)
    }
  })
})
