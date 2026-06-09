import { describe, it, expect } from 'vitest'
import {
  MODULOS_PORTAL, MODULO_KEYS,
  parseData, diasAte,
  parcelaPaga, parcelaCancelada, parcelaEmAberto,
  modulosVisiveis, modulosVisiveisLista, boasVindasEfetiva,
  resumoFinanceiro, contratoAssinado, contratoPendente,
  notificacoesEvento, rsvpResumo, eventoJaOcorreu, isMissingTable,
  type ParcelaLite, type ConvidadoLite,
} from '@/lib/portal'

const NOW = new Date('2026-06-09T12:00:00')

function mkParcela(p: Partial<ParcelaLite> = {}): ParcelaLite {
  return { id: 1, numero: 1, descricao: null, valor: 1000, vencimento: '2026-07-01', status: 'pendente', pago_em: null, ...p }
}

// ── Datas ───────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('parseData ancora datas só-data ao meio-dia (sem off-by-one)', () => {
    const d = parseData('2026-06-09')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(9)
  })
  it('parseData retorna null para vazio/inválido', () => {
    expect(parseData('')).toBeNull()
    expect(parseData(null)).toBeNull()
    expect(parseData('lixo')).toBeNull()
  })
  it('diasAte conta dias inteiros (futuro positivo, passado negativo)', () => {
    expect(diasAte('2026-06-16', NOW)).toBe(7)
    expect(diasAte('2026-06-09', NOW)).toBe(0)
    expect(diasAte('2026-06-02', NOW)).toBe(-7)
    expect(diasAte(null, NOW)).toBeNull()
  })
})

// ── Status de parcela ─────────────────────────────────────────────────────────
describe('status de parcela', () => {
  it('reconhece variações de pago', () => {
    expect(parcelaPaga('pago')).toBe(true)
    expect(parcelaPaga('paga')).toBe(true)
    expect(parcelaPaga('PENDENTE')).toBe(false)
    expect(parcelaPaga(null)).toBe(false)
  })
  it('reconhece cancelada', () => {
    expect(parcelaCancelada('cancelada')).toBe(true)
    expect(parcelaCancelada('pendente')).toBe(false)
  })
  it('em aberto = nem paga nem cancelada', () => {
    expect(parcelaEmAberto(mkParcela({ status: 'pendente' }))).toBe(true)
    expect(parcelaEmAberto(mkParcela({ status: 'pago' }))).toBe(false)
    expect(parcelaEmAberto(mkParcela({ status: 'cancelada' }))).toBe(false)
  })
})

// ── Módulos visíveis ──────────────────────────────────────────────────────────
describe('módulos visíveis', () => {
  it('catálogo cobre todas as chaves declaradas', () => {
    expect(MODULOS_PORTAL.length).toBe(MODULO_KEYS.length)
    expect(MODULO_KEYS).toContain('resumo')
    expect(MODULO_KEYS).toContain('financeiro')
  })
  it('default: todos visíveis quando não há config', () => {
    const vis = modulosVisiveis(null, null)
    expect(Object.values(vis).every(Boolean)).toBe(true)
  })
  it('resumo é fixo: não pode ser desligado', () => {
    const vis = modulosVisiveis({ modulos: { resumo: false } }, { modulos: { resumo: false } })
    expect(vis.resumo).toBe(true)
  })
  it('config global desliga módulo', () => {
    const vis = modulosVisiveis({ modulos: { financeiro: false } }, null)
    expect(vis.financeiro).toBe(false)
    expect(vis.contrato).toBe(true)
  })
  it('override do acesso vence a config global', () => {
    const cfg = { modulos: { financeiro: false, convidados: false } }
    const acesso = { modulos: { financeiro: true } } // re-liga só financeiro p/ este evento
    const vis = modulosVisiveis(cfg, acesso)
    expect(vis.financeiro).toBe(true)
    expect(vis.convidados).toBe(false)
  })
  it('lista filtrada respeita a visibilidade e a ordem', () => {
    const lista = modulosVisiveisLista({ modulos: { financeiro: false } }, null)
    const keys = lista.map((m) => m.key)
    expect(keys[0]).toBe('resumo')
    expect(keys).not.toContain('financeiro')
  })
  it('boasVindasEfetiva: override do evento > global > vazio', () => {
    expect(boasVindasEfetiva({ boas_vindas: 'global' }, { boas_vindas: 'evento' })).toBe('evento')
    expect(boasVindasEfetiva({ boas_vindas: 'global' }, { boas_vindas: '  ' })).toBe('global')
    expect(boasVindasEfetiva(null, null)).toBe('')
  })
})

// ── Resumo financeiro ─────────────────────────────────────────────────────────
describe('resumo financeiro', () => {
  it('soma pago/aberto/total e ignora canceladas', () => {
    const r = resumoFinanceiro([
      mkParcela({ id: 1, valor: 1000, status: 'pago' }),
      mkParcela({ id: 2, valor: 500, status: 'pendente', vencimento: '2026-07-01' }),
      mkParcela({ id: 3, valor: 999, status: 'cancelada' }),
    ], NOW)
    expect(r.total).toBe(1500)
    expect(r.pago).toBe(1000)
    expect(r.aberto).toBe(500)
    expect(r.qtdParcelas).toBe(2)
    expect(r.progresso).toBeCloseTo(1000 / 1500)
  })
  it('detecta vencido e escolhe a próxima parcela em aberto', () => {
    const r = resumoFinanceiro([
      mkParcela({ id: 1, valor: 300, status: 'pendente', vencimento: '2026-05-01' }), // vencida
      mkParcela({ id: 2, valor: 700, status: 'pendente', vencimento: '2026-08-01' }),
    ], NOW)
    expect(r.vencido).toBe(300)
    expect(r.qtdVencido).toBe(1)
    expect(r.proxima?.id).toBe(1) // menor vencimento entre as em aberto
  })
  it('sem parcelas → progresso 0', () => {
    expect(resumoFinanceiro([], NOW).progresso).toBe(0)
  })
})

// ── Contrato ──────────────────────────────────────────────────────────────────
describe('contrato', () => {
  it('assinado por status ou por assinado_em', () => {
    expect(contratoAssinado({ status: 'assinado' })).toBe(true)
    expect(contratoAssinado({ status: 'enviado', assinado_em: '2026-06-01' })).toBe(true)
    expect(contratoAssinado({ status: 'enviado' })).toBe(false)
    expect(contratoAssinado(null)).toBe(false)
  })
  it('pendente = enviado e não assinado', () => {
    expect(contratoPendente({ status: 'enviado' })).toBe(true)
    expect(contratoPendente({ status: 'assinado' })).toBe(false)
    expect(contratoPendente({ status: 'rascunho' })).toBe(false)
    expect(contratoPendente(null)).toBe(false)
  })
})

// ── Notificações ──────────────────────────────────────────────────────────────
describe('notificações do evento', () => {
  it('parcela vencida (urgent) vem antes de evento próximo (info)', () => {
    const ns = notificacoesEvento({
      evento: { data_inicio: '2026-06-12' },
      parcelas: [mkParcela({ status: 'pendente', vencimento: '2026-06-01' })],
      contrato: { status: 'assinado' },
      agora: NOW,
    })
    expect(ns[0].tipo).toBe('parcela')
    expect(ns[0].nivel).toBe('urgent')
    expect(ns.some((n) => n.tipo === 'evento' && n.nivel === 'info')).toBe(true)
  })
  it('contrato pendente gera aviso warn', () => {
    const ns = notificacoesEvento({
      evento: { data_inicio: '2026-12-31' },
      parcelas: [],
      contrato: { status: 'enviado' },
      agora: NOW,
    })
    expect(ns.some((n) => n.tipo === 'contrato' && n.nivel === 'warn')).toBe(true)
  })
  it('parcela paga não gera notificação', () => {
    const ns = notificacoesEvento({
      evento: { data_inicio: '2026-12-31' },
      parcelas: [mkParcela({ status: 'pago', vencimento: '2026-06-01' })],
      contrato: { status: 'assinado' },
      agora: NOW,
    })
    expect(ns.length).toBe(0)
  })
  it('evento hoje tem título próprio', () => {
    const ns = notificacoesEvento({ evento: { data_inicio: '2026-06-09' }, parcelas: [], contrato: null, agora: NOW })
    expect(ns.find((n) => n.tipo === 'evento')?.titulo).toMatch(/hoje/i)
  })
})

// ── RSVP ──────────────────────────────────────────────────────────────────────
describe('rsvp', () => {
  function mk(status: string, acomp = 0): ConvidadoLite { return { status, acompanhantes: acomp } }
  it('conta por status e soma pessoas (confirmados/checkin + acompanhantes)', () => {
    const r = rsvpResumo([
      mk('confirmado', 2), // 3 pessoas
      mk('checkin', 1),    // 2 pessoas
      mk('recusado'),
      mk('convidado'),
    ])
    expect(r.total).toBe(4)
    expect(r.confirmados).toBe(1)
    expect(r.checkin).toBe(1)
    expect(r.recusados).toBe(1)
    expect(r.pendentes).toBe(1)
    expect(r.pessoas).toBe(5)
  })
  it('status ausente conta como pendente', () => {
    const r = rsvpResumo([{ acompanhantes: 0 }])
    expect(r.pendentes).toBe(1)
  })
})

// ── Evento / erros ──────────────────────────────────────────────────────────────
describe('evento e erros', () => {
  it('eventoJaOcorreu usa data_fim quando há, senão data_inicio', () => {
    expect(eventoJaOcorreu({ data_inicio: '2026-06-01', data_fim: '2026-06-02' }, NOW)).toBe(true)
    expect(eventoJaOcorreu({ data_inicio: '2026-12-31' }, NOW)).toBe(false)
  })
  it('isMissingTable cobre 42P01 e PGRST205', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
