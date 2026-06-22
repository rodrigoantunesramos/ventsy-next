import { describe, it, expect } from 'vitest'
import {
  gerarChecklist, progressoChecklist, progressoPorCategoria, resumoOrcamento,
  categoriaLabel, categoriaEmoji,
} from '@/lib/planejador'

describe('planejador — checklist', () => {
  it('gera base comum para tipo desconhecido', () => {
    const c = gerarChecklist('algo aleatório')
    expect(c.length).toBeGreaterThanOrEqual(10)
    expect(c.some((t) => /Reservar o espaço/i.test(t.titulo))).toBe(true)
  })

  it('acrescenta itens específicos de casamento', () => {
    const c = gerarChecklist('Casamento')
    expect(c.some((t) => /fotógrafo/i.test(t.titulo))).toBe(true)
    expect(c.length).toBeGreaterThan(gerarChecklist('xpto').length)
  })

  it('acrescenta itens específicos de evento corporativo', () => {
    const c = gerarChecklist('Evento Corporativo')
    expect(c.some((t) => /Credenciamento/i.test(t.titulo))).toBe(true)
  })

  it('mede o progresso da checklist', () => {
    const p = progressoChecklist([
      { concluida: true }, { concluida: true }, { concluida: false }, { concluida: false },
    ])
    expect(p.total).toBe(4)
    expect(p.concluidas).toBe(2)
    expect(p.pendentes).toBe(2)
    expect(p.fracao).toBe(0.5)
  })

  it('progresso por categoria separa corretamente', () => {
    const por = progressoPorCategoria([
      { categoria: 'local', concluida: true },
      { categoria: 'local', concluida: false },
      { categoria: 'convidados', concluida: true },
    ])
    expect(por.local.total).toBe(2)
    expect(por.local.concluidas).toBe(1)
    expect(por.convidados.fracao).toBe(1)
  })
})

describe('planejador — orçamento', () => {
  it('consolida previsto, real, pago e saldo', () => {
    const r = resumoOrcamento([
      { valor_previsto: 1000, valor_real: 1200, pago: true },
      { valor_previsto: 500, valor_real: null, pago: false },
      { valor_previsto: 300, valor_real: 250, pago: false },
    ])
    expect(r.previsto).toBe(1800)
    expect(r.real).toBe(1450)
    expect(r.pago).toBe(1200)            // só o item pago (real)
    expect(r.aPagar).toBe(750)           // 500 (previsto, sem real) + 250 (real)
    expect(r.saldo).toBe(350)            // 1800 - 1450
  })

  it('rotula categorias', () => {
    expect(categoriaLabel('gastronomia')).toBe('Gastronomia')
    expect(categoriaLabel('inexistente')).toBe('Geral')
    expect(categoriaEmoji('local')).toBe('📍')
  })
})
