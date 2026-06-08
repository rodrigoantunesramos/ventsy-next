import { describe, it, expect } from 'vitest'
import {
  toRange, overlap, mesmoEspaco, holdExpirado, ocupaSlot, detectarConflitos,
  minutosOcupados, taxaOcupacao, icsEscape, icsFold, toICSDate, buildICS, holdExpiraEm,
  HORA, DIA, type Reserva,
} from '@/lib/reservas'

// Helper: monta uma reserva mínima com defaults inócuos.
function mk(p: Partial<Reserva>): Reserva {
  return {
    id: p.id || 'r1', propriedade_id: p.propriedade_id ?? 1, espaco_id: p.espaco_id ?? null,
    titulo: p.titulo ?? null, status: p.status ?? 'confirmada',
    inicio: p.inicio ?? null, fim: p.fim ?? null, hold_expira_em: p.hold_expira_em ?? null,
    cor: p.cor ?? null, ...p,
  }
}

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0) // referência fixa (determinístico)
const iso = (ms: number) => new Date(ms).toISOString()

describe('toRange', () => {
  it('usa inicio/fim quando presentes', () => {
    const r = mk({ inicio: iso(T0), fim: iso(T0 + 2 * HORA) })
    expect(toRange(r)).toEqual({ start: T0, end: T0 + 2 * HORA })
  })
  it('assume 1h quando há inicio sem fim', () => {
    const r = mk({ inicio: iso(T0) })
    expect(toRange(r)).toEqual({ start: T0, end: T0 + HORA })
  })
  it('cai para data_inicio (dia inteiro) no legado de marketplace', () => {
    const r = mk({ inicio: null, data_inicio: '2026-06-10' })
    const range = toRange(r)!
    expect(range.end - range.start).toBe(DIA)
  })
  it('diaria com data_fim é inclusiva (fim+1 dia)', () => {
    const r = mk({ inicio: null, modo: 'diaria', data_inicio: '2026-06-10', data_fim: '2026-06-11' })
    const range = toRange(r)!
    expect(range.end - range.start).toBe(2 * DIA)
  })
  it('retorna null sem datas', () => {
    expect(toRange(mk({}))).toBeNull()
  })
})

describe('overlap + buffer', () => {
  it('detecta sobreposição simples', () => {
    expect(overlap(0, 10, 5, 15)).toBe(true)
    expect(overlap(0, 10, 10, 20)).toBe(false) // encostadas, sem buffer
  })
  it('o buffer separa eventos adjacentes', () => {
    expect(overlap(0, 10, 10, 20, 5)).toBe(true)  // exige 5 de folga → conflita
    expect(overlap(0, 10, 16, 26, 5)).toBe(false) // folga suficiente
  })
})

describe('mesmoEspaco', () => {
  it('propriedade inteira (null) conflita com qualquer sub-espaço', () => {
    expect(mesmoEspaco(null, 3)).toBe(true)
    expect(mesmoEspaco(3, null)).toBe(true)
    expect(mesmoEspaco(null, null)).toBe(true)
  })
  it('sub-espaços distintos não são o mesmo', () => {
    expect(mesmoEspaco(3, 4)).toBe(false)
    expect(mesmoEspaco(3, 3)).toBe(true)
  })
})

describe('holdExpirado / ocupaSlot', () => {
  it('hold vencido não ocupa', () => {
    const r = mk({ status: 'hold', hold_expira_em: iso(T0 - HORA) })
    expect(holdExpirado(r, T0)).toBe(true)
    expect(ocupaSlot(r, T0)).toBe(false)
  })
  it('hold ainda válido ocupa', () => {
    const r = mk({ status: 'hold', hold_expira_em: iso(T0 + HORA) })
    expect(holdExpirado(r, T0)).toBe(false)
    expect(ocupaSlot(r, T0)).toBe(true)
  })
  it('cancelada/recusada/avaliada nunca ocupam', () => {
    for (const status of ['cancelada', 'recusada', 'avaliada']) {
      expect(ocupaSlot(mk({ status }), T0)).toBe(false)
    }
  })
})

describe('detectarConflitos (critérios de aceite)', () => {
  const base = { propriedade_id: 1, start: T0, end: T0 + 2 * HORA }

  it('MESMO espaço sobreposto → conflito', () => {
    const existentes = [mk({ id: 'a', espaco_id: 5, inicio: iso(T0 + HORA), fim: iso(T0 + 3 * HORA), status: 'confirmada' })]
    const c = detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0 })
    expect(c.map((r) => r.id)).toEqual(['a'])
  })

  it('espaços DIFERENTES no mesmo horário → SEM conflito (simultâneo permitido)', () => {
    const existentes = [mk({ id: 'a', espaco_id: 6, inicio: iso(T0), fim: iso(T0 + 2 * HORA), status: 'confirmada' })]
    const c = detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0 })
    expect(c).toHaveLength(0)
  })

  it('propriedade inteira (null) conflita com sub-espaço ocupado', () => {
    const existentes = [mk({ id: 'a', espaco_id: 6, inicio: iso(T0), fim: iso(T0 + 2 * HORA), status: 'confirmada' })]
    const c = detectarConflitos({ ...base, espaco_id: null }, existentes, { nowMs: T0 })
    expect(c.map((r) => r.id)).toEqual(['a'])
  })

  it('ignora a própria reserva ao mover (ignoreId)', () => {
    const existentes = [mk({ id: 'self', espaco_id: 5, inicio: iso(T0), fim: iso(T0 + 2 * HORA) })]
    const c = detectarConflitos({ ...base, espaco_id: 5, ignoreId: 'self' }, existentes, { nowMs: T0 })
    expect(c).toHaveLength(0)
  })

  it('respeita o buffer de montagem', () => {
    // reserva existente termina exatamente quando a nova começa
    const existentes = [mk({ id: 'a', espaco_id: 5, inicio: iso(T0 - 2 * HORA), fim: iso(T0), status: 'confirmada' })]
    expect(detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0 })).toHaveLength(0)
    expect(detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0, bufferMin: 60 })).toHaveLength(1)
  })

  it('hold vencido não bloqueia uma nova reserva', () => {
    const existentes = [mk({ id: 'velho', espaco_id: 5, inicio: iso(T0), fim: iso(T0 + 2 * HORA), status: 'hold', hold_expira_em: iso(T0 - HORA) })]
    expect(detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0 })).toHaveLength(0)
  })

  it('outra propriedade nunca conflita', () => {
    const existentes = [mk({ id: 'a', propriedade_id: 99, espaco_id: 5, inicio: iso(T0), fim: iso(T0 + 2 * HORA) })]
    expect(detectarConflitos({ ...base, espaco_id: 5 }, existentes, { nowMs: T0 })).toHaveLength(0)
  })
})

describe('ocupação', () => {
  it('minutosOcupados une sobreposições (sem dupla contagem)', () => {
    const reservas = [
      mk({ id: 'a', inicio: iso(T0), fim: iso(T0 + 2 * HORA) }),
      mk({ id: 'b', inicio: iso(T0 + HORA), fim: iso(T0 + 3 * HORA) }),
    ]
    expect(minutosOcupados(reservas, T0, T0 + DIA, T0)).toBe(180) // 12:00→15:00 = 3h
  })
  it('taxaOcupacao normaliza por horas úteis/dia', () => {
    const reservas = [mk({ id: 'a', inicio: iso(T0), fim: iso(T0 + 6 * HORA) })]
    expect(taxaOcupacao(reservas, T0, T0 + DIA, 12, T0)).toBeCloseTo(0.5, 5) // 6h de 12h
  })
})

describe('iCal', () => {
  it('escapa caracteres especiais', () => {
    expect(icsEscape('Festa; com, vírgula\nlinha')).toBe('Festa\\; com\\, vírgula\\nlinha')
  })
  it('dobra linhas longas em <=75 octetos', () => {
    const folded = icsFold('X'.repeat(200))
    folded.split('\r\n').forEach((l) => expect(l.length).toBeLessThanOrEqual(75))
  })
  it('toICSDate produz UTC compacto', () => {
    expect(toICSDate('2026-06-10T12:00:00.000Z')).toBe('20260610T120000Z')
  })
  it('buildICS gera um VCALENDAR válido com VEVENT', () => {
    const ics = buildICS({
      calName: 'Agenda Ventsy',
      dtstamp: '2026-06-01T00:00:00Z',
      eventos: [{ uid: 'r1@ventsy', start: iso(T0), end: iso(T0 + 2 * HORA), summary: 'Casamento; Arena', status: 'confirmada' }],
    })
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:r1@ventsy')
    expect(ics).toContain('SUMMARY:Casamento\\; Arena')
    expect(ics).toContain('STATUS:CONFIRMED')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.includes('\r\n')).toBe(true) // CRLF
  })
  it('hold vira TENTATIVE no iCal', () => {
    const ics = buildICS({ calName: 'x', dtstamp: 0, eventos: [{ uid: 'h', start: iso(T0), end: iso(T0 + HORA), summary: 'Hold', status: 'hold' }] })
    expect(ics).toContain('STATUS:TENTATIVE')
  })
})

describe('holdExpiraEm', () => {
  it('soma horas ao agora', () => {
    expect(holdExpiraEm(48, T0)).toBe(iso(T0 + 48 * HORA))
  })
})
