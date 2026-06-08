import { describe, it, expect } from 'vitest'
import {
  regraVigente, regraAplica, escolherRegra, baseDoEvento, calcularValor,
  recebidoDoEvento, eventoApuravel, atribuicoesDoEvento, planejarApuracao,
  competenciaDe, grupoEvento, eventoFechado, eventoEstornavel,
  resumoPorStatus, totalAPagar, custoSobreReceita, MARGEM_PADRAO_PCT,
  type Regra, type EventoComissionavel, type ComissaoExistente, type ParcelaLite,
} from '@/lib/comissoes'

// ── Builders mínimos (defaults inócuos) ───────────────────────────────────────
function mkRegra(p: Partial<Regra>): Regra {
  return {
    id: p.id || 'rg1', beneficiario_tipo: p.beneficiario_tipo ?? 'parceiro',
    beneficiario_id: p.beneficiario_id ?? null, base: p.base ?? 'valor_evento',
    percentual: p.percentual ?? 10, valor_fixo_num: p.valor_fixo_num ?? null,
    condicao: p.condicao ?? {}, vigencia_inicio: p.vigencia_inicio ?? null,
    vigencia_fim: p.vigencia_fim ?? null, prioridade: p.prioridade ?? 0,
    ativo: p.ativo ?? true, nome: p.nome ?? null,
  }
}
function mkEvento(p: Partial<EventoComissionavel>): EventoComissionavel {
  return {
    id: p.id || 'ev1', tipo_evento: p.tipo_evento ?? 'Casamento', status: p.status ?? 'contratado',
    data_inicio: p.data_inicio ?? '2026-06-10', valor_total_num: p.valor_total_num ?? 10000,
    propriedade_id: p.propriedade_id ?? 1, vendedor_equipe_id: p.vendedor_equipe_id ?? null,
    parceiro_id: p.parceiro_id ?? null, indicado_por_id: p.indicado_por_id ?? null,
  }
}

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0) // 2026-06-15 (determinístico)

// ── Funil ──────────────────────────────────────────────────────────────────
describe('grupoEvento / eventoFechado / eventoEstornavel', () => {
  it('mapeia status para grupos', () => {
    expect(grupoEvento('negociacao')).toBe('negociando')
    expect(grupoEvento('contratado')).toBe('contratados')
    expect(grupoEvento('finalizado')).toBe('finalizados')
    expect(grupoEvento('perdido')).toBe('perdidos')
    expect(grupoEvento(null)).toBe('negociando')
  })
  it('fechado = contratado ou finalizado', () => {
    expect(eventoFechado('contratado')).toBe(true)
    expect(eventoFechado('finalizado')).toBe(true)
    expect(eventoFechado('negociacao')).toBe(false)
    expect(eventoFechado('perdido')).toBe(false)
  })
  it('estornável = perdido ou cancelado', () => {
    expect(eventoEstornavel('perdido')).toBe(true)
    expect(eventoEstornavel('cancelado')).toBe(true)
    expect(eventoEstornavel('contratado')).toBe(false)
  })
})

// ── Vigência + aplicação de regra ────────────────────────────────────────────
describe('regraVigente', () => {
  it('respeita início e fim', () => {
    const r = mkRegra({ vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31' })
    expect(regraVigente(r, '2026-06-15')).toBe(true)
    expect(regraVigente(r, '2025-12-31')).toBe(false)
    expect(regraVigente(r, '2027-01-01')).toBe(false)
  })
  it('sem datas é sempre vigente', () => {
    expect(regraVigente(mkRegra({}), '2000-01-01')).toBe(true)
  })
})

describe('regraAplica', () => {
  const ev = mkEvento({ tipo_evento: 'Casamento', propriedade_id: 7, valor_total_num: 20000 })
  it('casa tipo de beneficiário e id genérico/específico', () => {
    expect(regraAplica(mkRegra({ beneficiario_tipo: 'parceiro', beneficiario_id: null }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(true)
    expect(regraAplica(mkRegra({ beneficiario_id: 'p1' }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(true)
    expect(regraAplica(mkRegra({ beneficiario_id: 'p2' }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
    expect(regraAplica(mkRegra({ beneficiario_tipo: 'equipe' }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
  })
  it('respeita condições de tipo de evento, propriedade e faixa', () => {
    expect(regraAplica(mkRegra({ condicao: { tipo_evento: 'Aniversário' } }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
    expect(regraAplica(mkRegra({ condicao: { tipo_evento: 'Casamento' } }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(true)
    expect(regraAplica(mkRegra({ condicao: { propriedade_id: 99 } }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
    expect(regraAplica(mkRegra({ condicao: { faixa_min: 25000 } }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
    expect(regraAplica(mkRegra({ condicao: { faixa_min: 10000, faixa_max: 30000 } }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(true)
  })
  it('ignora regra inativa', () => {
    expect(regraAplica(mkRegra({ ativo: false }), 'parceiro', 'p1', ev, '2026-06-15')).toBe(false)
  })
})

describe('escolherRegra', () => {
  const ev = mkEvento({ tipo_evento: 'Casamento', valor_total_num: 20000 })
  it('prioridade vence', () => {
    const baixa = mkRegra({ id: 'a', prioridade: 0, percentual: 50 })
    const alta = mkRegra({ id: 'b', prioridade: 5, percentual: 1 })
    expect(escolherRegra([baixa, alta], 'parceiro', 'p1', ev, '2026-06-15')?.id).toBe('b')
  })
  it('na mesma prioridade, a mais específica vence', () => {
    const generica = mkRegra({ id: 'g', beneficiario_id: null })
    const especifica = mkRegra({ id: 's', beneficiario_id: 'p1' })
    expect(escolherRegra([generica, especifica], 'parceiro', 'p1', ev, '2026-06-15')?.id).toBe('s')
  })
  it('retorna null quando nada aplica', () => {
    expect(escolherRegra([mkRegra({ beneficiario_tipo: 'equipe' })], 'parceiro', 'p1', ev, '2026-06-15')).toBeNull()
  })
})

// ── Base + valor ──────────────────────────────────────────────────────────────
describe('baseDoEvento + calcularValor', () => {
  const ev = mkEvento({ valor_total_num: 10000 })
  it('valor_evento usa o valor contratado', () => {
    const r = mkRegra({ base: 'valor_evento', percentual: 10 })
    expect(baseDoEvento(ev, r)).toBe(10000)
    expect(calcularValor(r, 10000)).toBe(1000)
  })
  it('margem usa margem_pct (ou padrão)', () => {
    const r = mkRegra({ base: 'margem', percentual: 20, condicao: { margem_pct: 40 } })
    expect(baseDoEvento(ev, r)).toBe(4000)         // 40% de 10000
    expect(calcularValor(r, 4000)).toBe(800)        // 20% de 4000
    const rPad = mkRegra({ base: 'margem', percentual: 10 })
    expect(baseDoEvento(ev, rPad)).toBe(10000 * (MARGEM_PADRAO_PCT / 100))
  })
  it('fixo ignora base e usa valor_fixo_num', () => {
    const r = mkRegra({ base: 'fixo', valor_fixo_num: 500, percentual: 99 })
    expect(baseDoEvento(ev, r)).toBe(0)
    expect(calcularValor(r, 0)).toBe(500)
  })
})

// ── Recebimento ───────────────────────────────────────────────────────────────
describe('recebidoDoEvento + eventoApuravel', () => {
  const parcelas: ParcelaLite[] = [
    { evento_id: 'ev1', valor: 4000, status: 'pago' },
    { evento_id: 'ev1', valor: 6000, status: 'pendente' },
    { evento_id: 'ev2', valor: 1000, status: 'pago' },
  ]
  it('soma só as parcelas pagas do evento', () => {
    expect(recebidoDoEvento('ev1', parcelas)).toBe(4000)
    expect(recebidoDoEvento('ev2', parcelas)).toBe(1000)
  })
  it('apurável quando recebido >= contratado', () => {
    const ev = mkEvento({ id: 'ev1', valor_total_num: 10000 })
    expect(eventoApuravel(ev, parcelas)).toBe(false)
    const pagasTotal: ParcelaLite[] = [{ evento_id: 'ev1', valor: 10000, status: 'pago' }]
    expect(eventoApuravel(ev, pagasTotal)).toBe(true)
  })
  it('apurável quando finalizado mesmo sem parcelas', () => {
    const ev = mkEvento({ id: 'evX', status: 'finalizado', valor_total_num: 5000 })
    expect(eventoApuravel(ev, [])).toBe(true)
    const evContratado = mkEvento({ id: 'evY', status: 'contratado', valor_total_num: 5000 })
    expect(eventoApuravel(evContratado, [])).toBe(false)
  })
})

describe('atribuicoesDoEvento', () => {
  it('lista vendedor, parceiro e indicação presentes', () => {
    const ev = mkEvento({ vendedor_equipe_id: 3, parceiro_id: 'p1', indicado_por_id: 'c9' })
    expect(atribuicoesDoEvento(ev)).toEqual([
      { tipo: 'equipe', id: '3' }, { tipo: 'parceiro', id: 'p1' }, { tipo: 'cliente', id: 'c9' },
    ])
  })
  it('ignora atribuições ausentes', () => {
    expect(atribuicoesDoEvento(mkEvento({ parceiro_id: 'p1' }))).toEqual([{ tipo: 'parceiro', id: 'p1' }])
  })
})

describe('competenciaDe', () => {
  it('usa o mês da data do evento', () => {
    expect(competenciaDe('2026-03-22', NOW)).toBe('2026-03-01')
  })
  it('cai para o mês atual quando sem data', () => {
    expect(competenciaDe(null, NOW)).toBe('2026-06-01')
  })
})

// ── Planner ───────────────────────────────────────────────────────────────────
describe('planejarApuracao', () => {
  const regraParceiro = mkRegra({ id: 'rg-casamento', beneficiario_tipo: 'parceiro', base: 'valor_evento', percentual: 10 })

  it('insere comissão prevista para evento contratado com parceiro', () => {
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: 'p1', valor_total_num: 10000 })
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes: [], nowMs: NOW })
    expect(plano.inserir).toHaveLength(1)
    expect(plano.inserir[0]).toMatchObject({ beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', competencia: '2026-06-01' })
    expect(plano.atualizar).toHaveLength(0)
  })

  it('insere apurada quando o evento já foi recebido', () => {
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: 'p1', valor_total_num: 10000 })
    const parcelas: ParcelaLite[] = [{ evento_id: 'ev1', valor: 10000, status: 'pago' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas, regras: [regraParceiro], existentes: [], nowMs: NOW })
    expect(plano.inserir[0].status).toBe('apurada')
  })

  it('promove prevista → apurada quando recebe', () => {
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: 'p1', valor_total_num: 10000 })
    const parcelas: ParcelaLite[] = [{ evento_id: 'ev1', valor: 10000, status: 'pago' }]
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas, regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.inserir).toHaveLength(0)
    expect(plano.atualizar).toEqual([{ id: 'cx', status: 'apurada', valor_num: 1000, base_num: 10000, percentual: 10 }])
  })

  it('não duplica quando já existe e nada mudou', () => {
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: 'p1', valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.inserir).toHaveLength(0)
    expect(plano.atualizar).toHaveLength(0)
  })

  it('estorna (cancela) comissão não paga quando o evento é perdido', () => {
    const ev = mkEvento({ id: 'ev1', status: 'perdido', parceiro_id: 'p1', valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'apurada', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.atualizar).toEqual([{ id: 'cx', status: 'cancelada' }])
    expect(plano.inserir).toHaveLength(0)
  })

  it('não mexe em comissão paga (mesmo se evento perdido)', () => {
    const ev = mkEvento({ id: 'ev1', status: 'perdido', parceiro_id: 'p1', valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'paga', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.atualizar).toHaveLength(0)
    expect(plano.inserir).toHaveLength(0)
  })

  it('não toca em comissões manuais', () => {
    const ev = mkEvento({ id: 'ev1', status: 'perdido', parceiro_id: 'p1', valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cm', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', origem: 'manual' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.atualizar).toHaveLength(0)
  })

  it('cancela comissão órfã quando a atribuição é removida', () => {
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: null, valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.atualizar).toEqual([{ id: 'cx', status: 'cancelada' }])
  })

  it('múltiplas atribuições geram múltiplas comissões', () => {
    const regraEquipe = mkRegra({ id: 'rg-eq', beneficiario_tipo: 'equipe', base: 'valor_evento', percentual: 3 })
    const ev = mkEvento({ id: 'ev1', status: 'contratado', parceiro_id: 'p1', vendedor_equipe_id: 5, valor_total_num: 10000 })
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro, regraEquipe], existentes: [], nowMs: NOW })
    expect(plano.inserir).toHaveLength(2)
    const eq = plano.inserir.find((c) => c.beneficiario_tipo === 'equipe')!
    expect(eq.valor_num).toBe(300)
  })

  it('evento que regrediu para negociação cancela a prevista', () => {
    const ev = mkEvento({ id: 'ev1', status: 'negociacao', parceiro_id: 'p1', valor_total_num: 10000 })
    const existentes: ComissaoExistente[] = [{ id: 'cx', beneficiario_tipo: 'parceiro', beneficiario_id: 'p1', evento_id: 'ev1', valor_num: 1000, status: 'prevista', origem: 'auto' }]
    const plano = planejarApuracao({ eventos: [ev], parcelas: [], regras: [regraParceiro], existentes, nowMs: NOW })
    expect(plano.atualizar).toEqual([{ id: 'cx', status: 'cancelada' }])
    expect(plano.inserir).toHaveLength(0)
  })
})

// ── Agregações ────────────────────────────────────────────────────────────────
describe('resumoPorStatus / totalAPagar / custoSobreReceita', () => {
  it('soma por status', () => {
    const r = resumoPorStatus([
      { status: 'prevista', valor_num: 100 }, { status: 'apurada', valor_num: 50 },
      { status: 'paga', valor_num: 200 }, { status: 'paga', valor_num: 25 },
    ])
    expect(r.prevista).toBe(100)
    expect(r.paga).toBe(225)
    expect(totalAPagar(r)).toBe(150) // prevista + apurada + aprovada
  })
  it('custo sobre receita é fração protegida', () => {
    expect(custoSobreReceita(1000, 10000)).toBeCloseTo(0.1)
    expect(custoSobreReceita(1000, 0)).toBe(0)
  })
})
