import { describe, it, expect } from 'vitest'
import {
  creditoValido, resumoCarteira, saldoCreditos, podeResgatar, aplicarCredito,
  tipoCreditoLabel, type LancamentoCredito,
} from '@/lib/creditos'

const AGORA = new Date('2026-06-22T12:00:00Z')

describe('creditos', () => {
  it('considera válido quando não há expiração ou ela é futura', () => {
    expect(creditoValido({ valor: 10 }, AGORA)).toBe(true)
    expect(creditoValido({ valor: 10, expira_em: '2026-12-31' }, AGORA)).toBe(true)
    expect(creditoValido({ valor: 10, expira_em: '2026-01-01' }, AGORA)).toBe(false)
  })

  it('soma o saldo apenas de lançamentos válidos', () => {
    const l: LancamentoCredito[] = [
      { valor: 50, tipo: 'indicacao' },
      { valor: 30, tipo: 'boas_vindas' },
      { valor: -20, tipo: 'resgate' },
      { valor: 100, expira_em: '2026-01-01' }, // expirado → ignorado
    ]
    expect(saldoCreditos(l, AGORA)).toBe(60)
  })

  it('resume ganhos, usados e a expirar dentro da janela', () => {
    const l: LancamentoCredito[] = [
      { valor: 50 },
      { valor: 40, expira_em: '2026-07-01' }, // expira em ~9 dias → a expirar
      { valor: -10 },
    ]
    const r = resumoCarteira(l, AGORA, 30)
    expect(r.saldo).toBe(80)
    expect(r.totalGanho).toBe(90)
    expect(r.totalUsado).toBe(10)
    expect(r.aExpirar).toBe(40)
  })

  it('valida o resgate (mínimo, saldo e positividade)', () => {
    expect(podeResgatar(100, 50)).toBe(true)
    expect(podeResgatar(100, 5)).toBe(false)   // abaixo do mínimo
    expect(podeResgatar(100, 150)).toBe(false) // acima do saldo
    expect(podeResgatar(100, 0)).toBe(false)
  })

  it('aplica crédito sobre um total sem ficar negativo', () => {
    expect(aplicarCredito(200, 50)).toBe(150)
    expect(aplicarCredito(40, 100)).toBe(0)
  })

  it('rotula tipos conhecidos', () => {
    expect(tipoCreditoLabel('indicacao')).toBe('Indicação')
    expect(tipoCreditoLabel('xpto')).toBe('Crédito')
  })
})
