import { describe, it, expect } from 'vitest'
import {
  hhmmToMin, minToHHMM, minToHoras, parseTs,
  minutosTrabalhados, minutosNoturnos, calcularRegistro,
  coberturaEscala, checarAlocacao,
  custoHoraDe, custoRegistroFixo, somaDiarias, custoPrevistoEscala, custoRealizadoEvento,
  saldoBancoMin, taxaNoShow,
  ocupaVaga, alocEncerrada, devePagar,
  funcaoLabel, turnoLabel, turnoJanela, alocStatusMeta,
  MINUTO, HORA, type EscalaAlocacao, type PontoRegistro,
} from '@/lib/ponto'

// ── Helpers ───────────────────────────────────────────────────────────────────
function mkAloc(p: Partial<EscalaAlocacao>): EscalaAlocacao {
  return {
    id: p.id || 'a1', escala_id: p.escala_id ?? 'e1', equipe_id: p.equipe_id ?? null,
    freelancer_id: p.freelancer_id ?? null, inicio_previsto: p.inicio_previsto ?? null,
    fim_previsto: p.fim_previsto ?? null, valor_diaria_num: p.valor_diaria_num ?? 0,
    status: p.status ?? 'convocado', pago: p.pago ?? false, conta_pagar_id: p.conta_pagar_id ?? null,
    obs: p.obs ?? null, ...p,
  }
}
// Instante local fixo (evita depender do fuso da máquina de teste).
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi, 0, 0).getTime()

describe('helpers de tempo', () => {
  it('hhmmToMin / minToHHMM são inversos', () => {
    expect(hhmmToMin('08:30')).toBe(510)
    expect(hhmmToMin('00:00')).toBe(0)
    expect(minToHHMM(510)).toBe('08:30')
    expect(minToHHMM(0)).toBe('00:00')
    expect(minToHHMM(605)).toBe('10:05')
  })
  it('hhmmToMin tolera lixo', () => {
    expect(hhmmToMin('')).toBe(0)
    expect(hhmmToMin(null)).toBe(0)
    expect(hhmmToMin('abc')).toBe(0)
  })
  it('minToHoras converte para decimal', () => {
    expect(minToHoras(90)).toBe(1.5)
    expect(minToHoras(0)).toBe(0)
  })
  it('parseTs aceita ISO e rejeita inválido', () => {
    expect(parseTs('2026-06-10T22:00:00')).toBe(Date.parse('2026-06-10T22:00:00'))
    expect(parseTs(null)).toBeNull()
    expect(parseTs('xyz')).toBeNull()
  })
})

describe('minutosTrabalhados', () => {
  it('mesmo dia', () => {
    expect(minutosTrabalhados(at(2026, 5, 10, 8), at(2026, 5, 10, 17))).toBe(9 * 60)
  })
  it('turno que vira a noite com data completa', () => {
    expect(minutosTrabalhados(at(2026, 5, 10, 20), at(2026, 5, 11, 4))).toBe(8 * 60)
  })
  it('saída <= entrada (só-hora) assume +1 dia', () => {
    expect(minutosTrabalhados(at(2026, 5, 10, 22), at(2026, 5, 10, 2))).toBe(4 * 60)
  })
})

describe('minutosNoturnos (janela 22:00→05:00)', () => {
  it('turno diurno não tem noturno', () => {
    expect(minutosNoturnos(at(2026, 5, 10, 8), at(2026, 5, 10, 17))).toBe(0)
  })
  it('conta apenas a fração dentro da janela', () => {
    // 20:00 → 02:00 = 6h, das quais 22:00→02:00 = 4h noturnas
    expect(minutosNoturnos(at(2026, 5, 10, 20), at(2026, 5, 11, 2))).toBe(4 * 60)
  })
  it('turno inteiramente noturno conta tudo', () => {
    // 23:00 → 04:00 = 5h, todas noturnas
    expect(minutosNoturnos(at(2026, 5, 10, 23), at(2026, 5, 11, 4))).toBe(5 * 60)
  })
  it('plantão longo soma duas janelas noturnas', () => {
    // 21:00 dia 10 → 06:00 dia 12 (33h): noite1 22→05 (7h) + noite2 22→05 (7h) = 14h
    expect(minutosNoturnos(at(2026, 5, 10, 21), at(2026, 5, 12, 6))).toBe(14 * 60)
  })
  it('janela máxima 22→05 é de 7h', () => {
    expect(minutosNoturnos(at(2026, 5, 10, 18), at(2026, 5, 11, 8))).toBe(7 * 60)
  })
})

describe('calcularRegistro', () => {
  it('jornada cheia sem extras', () => {
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 8), saidaMs: at(2026, 5, 10, 17), intervaloMin: 60, jornadaMin: 8 * 60 })
    expect(r.trabalhadoMin).toBe(8 * 60) // 9h − 1h de intervalo
    expect(r.extrasMin).toBe(0)
    expect(r.saldoMin).toBe(0)
    expect(r.noturnoMin).toBe(0)
  })
  it('horas extras acima da jornada', () => {
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 8), saidaMs: at(2026, 5, 10, 20), intervaloMin: 60, jornadaMin: 8 * 60 })
    expect(r.trabalhadoMin).toBe(11 * 60)
    expect(r.extrasMin).toBe(3 * 60)
    expect(r.saldoMin).toBe(3 * 60)
  })
  it('saldo negativo quando trabalha menos que a jornada (banco de horas)', () => {
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 8), saidaMs: at(2026, 5, 10, 12), jornadaMin: 8 * 60 })
    expect(r.saldoMin).toBe(-4 * 60)
    expect(r.extrasMin).toBe(0)
  })
  it('atraso respeita a tolerância', () => {
    const prev = at(2026, 5, 10, 8)
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 8, 20), saidaMs: at(2026, 5, 10, 17), previstoInicioMs: prev, toleranciaAtrasoMin: 10 })
    expect(r.atrasoMin).toBe(10) // 20 min de atraso − 10 de tolerância
  })
  it('sem atraso quando chega adiantado', () => {
    const prev = at(2026, 5, 10, 8)
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 7, 50), saidaMs: at(2026, 5, 10, 17), previstoInicioMs: prev })
    expect(r.atrasoMin).toBe(0)
  })
  it('ponto aberto (sem saída) só mede atraso', () => {
    const prev = at(2026, 5, 10, 18)
    const r = calcularRegistro({ entradaMs: at(2026, 5, 10, 18, 30), saidaMs: null, previstoInicioMs: prev })
    expect(r.trabalhadoMin).toBe(0)
    expect(r.atrasoMin).toBe(30)
  })
})

describe('coberturaEscala / checarAlocacao (sub/super-alocação)', () => {
  const necessario = 3
  it('escala vazia: faltam todas', () => {
    const c = coberturaEscala(necessario, [])
    expect(c.faltam).toBe(3)
    expect(c.completa).toBe(false)
  })
  it('conta apenas status que ocupam vaga', () => {
    const alocs = [
      mkAloc({ status: 'convocado' }), mkAloc({ status: 'confirmado' }), mkAloc({ status: 'presente' }),
      mkAloc({ status: 'falta' }), mkAloc({ status: 'cancelado' }),
    ]
    const c = coberturaEscala(necessario, alocs)
    expect(c.preenchidas).toBe(3) // convocado+confirmado+presente
    expect(c.faltas).toBe(1)
    expect(c.completa).toBe(true)
    expect(c.excedido).toBe(false)
  })
  it('detecta excedente (super-alocação)', () => {
    const alocs = [mkAloc({ status: 'confirmado' }), mkAloc({ status: 'confirmado' }), mkAloc({ status: 'confirmado' }), mkAloc({ status: 'presente' })]
    const c = coberturaEscala(necessario, alocs)
    expect(c.excedido).toBe(true)
    expect(c.excedente).toBe(1)
  })
  it('checarAlocacao bloqueia quando já completa', () => {
    const alocs = [mkAloc({ id: 'a', status: 'confirmado' }), mkAloc({ id: 'b', status: 'confirmado' }), mkAloc({ id: 'c', status: 'convocado' })]
    expect(checarAlocacao(necessario, alocs).ok).toBe(false)
  })
  it('checarAlocacao aprova quando há vaga', () => {
    const alocs = [mkAloc({ id: 'a', status: 'confirmado' })]
    expect(checarAlocacao(necessario, alocs).ok).toBe(true)
  })
  it('checarAlocacao ignora a própria alocação (reedição)', () => {
    const alocs = [mkAloc({ id: 'a', status: 'confirmado' }), mkAloc({ id: 'b', status: 'confirmado' }), mkAloc({ id: 'self', status: 'convocado' })]
    expect(checarAlocacao(necessario, alocs, { ignoreId: 'self' }).ok).toBe(true)
  })
  it('faltas/cancelados liberam vaga para reconvocar', () => {
    const alocs = [mkAloc({ id: 'a', status: 'falta' }), mkAloc({ id: 'b', status: 'cancelado' })]
    expect(checarAlocacao(necessario, alocs).ok).toBe(true)
    expect(coberturaEscala(necessario, alocs).faltam).toBe(3)
  })
})

describe('custo de mão de obra', () => {
  it('custoHoraDe deriva da jornada mensal', () => {
    expect(custoHoraDe(2200, 220)).toBe(10)
    expect(custoHoraDe(0)).toBe(0)
  })
  it('custoRegistroFixo: normais + extras 1.5× + adicional noturno 20%', () => {
    // 8h normais + 2h extras + 3h noturnas, custo/hora 10
    const reg = { trabalhadoMin: 10 * 60, extrasMin: 2 * 60, noturnoMin: 3 * 60 }
    // normais 8h×10 = 80 ; extras 2h×10×1.5 = 30 ; noturno 3h×10×0.2 = 6 → 116
    expect(custoRegistroFixo(reg, 10)).toBeCloseTo(116, 5)
  })
  it('somaDiarias / custoPrevistoEscala ignoram falta e cancelado', () => {
    const alocs = [
      mkAloc({ status: 'confirmado', valor_diaria_num: 150 }),
      mkAloc({ status: 'presente', valor_diaria_num: 150 }),
      mkAloc({ status: 'falta', valor_diaria_num: 150 }),
      mkAloc({ status: 'cancelado', valor_diaria_num: 999 }),
    ]
    expect(custoPrevistoEscala(alocs)).toBe(300)
    expect(somaDiarias(alocs, (s) => s === 'presente')).toBe(150)
  })
  it('custoRealizadoEvento agrega freelancers + fixos', () => {
    const r = custoRealizadoEvento({ diariasFreela: [150, 200], custosFixos: [116, 80], horasFixosMin: [600, 480] })
    expect(r.freelancers).toBe(350)
    expect(r.fixos).toBe(196)
    expect(r.total).toBe(546)
    expect(r.pessoas).toBe(4)
    expect(r.horas).toBe(18) // 10h + 8h
  })
})

describe('banco de horas e no-show', () => {
  it('saldoBancoMin soma saldos (crédito − débito)', () => {
    const regs = [{ saldo_min: 120 }, { saldo_min: -30 }, { saldo_min: 60 }] as PontoRegistro[]
    expect(saldoBancoMin(regs)).toBe(150)
  })
  it('taxaNoShow = faltas / (faltas + presentes)', () => {
    const alocs = [mkAloc({ status: 'falta' }), mkAloc({ status: 'presente' }), mkAloc({ status: 'presente' }), mkAloc({ status: 'confirmado' })]
    expect(taxaNoShow(alocs)).toBeCloseTo(1 / 3, 5)
  })
  it('taxaNoShow = 0 sem presença registrada', () => {
    expect(taxaNoShow([mkAloc({ status: 'convocado' })])).toBe(0)
  })
})

describe('predicados e catálogos', () => {
  it('ocupaVaga / alocEncerrada / devePagar', () => {
    expect(ocupaVaga('confirmado')).toBe(true)
    expect(ocupaVaga('falta')).toBe(false)
    expect(alocEncerrada('cancelado')).toBe(true)
    expect(devePagar({ status: 'presente', pago: false })).toBe(true)
    expect(devePagar({ status: 'presente', pago: true })).toBe(false)
    expect(devePagar({ status: 'falta', pago: false })).toBe(false)
  })
  it('rótulos com fallback', () => {
    expect(funcaoLabel('garcom')).toBe('Garçom')
    expect(funcaoLabel(null)).toBe('Outro') // null cai no default 'outro' (espelha catEquipLabel)
    expect(funcaoLabel('zzz')).toBe('zzz')
    expect(turnoLabel('noite')).toBe('Noite')
    expect(turnoJanela('manha')).toEqual({ inicio: '06:00', fim: '12:00' })
    expect(alocStatusMeta('presente').label).toBe('Presente')
    expect(alocStatusMeta('???').label).toBe('???')
  })
  it('constantes de tempo', () => {
    expect(MINUTO).toBe(60_000)
    expect(HORA).toBe(60 * MINUTO)
  })
})
