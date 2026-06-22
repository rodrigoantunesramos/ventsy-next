import { describe, it, expect } from 'vitest'
import {
  linkIndicacao, kpisIndicacoes, mensagemConvite, statusIndicacaoLabel,
  type IndicacaoCliente,
} from '@/lib/indique'

describe('indique', () => {
  it('monta o link de convite para o cadastro com o código', () => {
    expect(linkIndicacao('https://www.ventsy.com.br', 'ANA1234')).toBe(
      'https://www.ventsy.com.br/cadastro?ref=ANA1234',
    )
    // remove barra final duplicada
    expect(linkIndicacao('https://x.com/', 'ABC')).toBe('https://x.com/cadastro?ref=ABC')
  })

  it('consolida KPIs por status', () => {
    const lista: IndicacaoCliente[] = [
      { status: 'pendente' },
      { status: 'cadastrado' },
      { status: 'convertido', recompensa_creditos: 50, recompensa_paga: true },
      { status: 'convertido', recompensa_creditos: 50, recompensa_paga: false }, // não paga
    ]
    const k = kpisIndicacoes(lista)
    expect(k.indicados).toBe(4)
    expect(k.cadastrados).toBe(3)   // cadastrado + 2 convertidos
    expect(k.convertidos).toBe(2)
    expect(k.creditosGanhos).toBe(50) // só a paga
  })

  it('gera mensagem de convite com o link', () => {
    const msg = mensagemConvite('https://x.com/cadastro?ref=ABC')
    expect(msg).toContain('https://x.com/cadastro?ref=ABC')
    expect(msg.toLowerCase()).toContain('ventsy')
  })

  it('rotula status', () => {
    expect(statusIndicacaoLabel('convertido')).toBe('Recompensa liberada')
    expect(statusIndicacaoLabel('pendente')).toBe('Convite enviado')
    expect(statusIndicacaoLabel(undefined)).toBe('Convite enviado')
  })
})
