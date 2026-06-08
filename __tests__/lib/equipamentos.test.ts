import { describe, it, expect } from 'vitest'
import {
  toRange, overlap, ocupaAlocacao, alocacaoEncerrada, picoAlocado,
  disponibilidade, checarDisponibilidade, serieDiaria,
  custoSublocacao, receitaLocacao, margemLocacao, unidadesFora,
  addDaysYmd, catEquipLabel, alocStatusMeta,
  HORA, DIA, type Alocacao, type Equipamento,
} from '@/lib/equipamentos'

// Helpers: monta entidades mínimas com defaults inócuos.
function mkAloc(p: Partial<Alocacao>): Alocacao {
  return {
    id: p.id || 'a1', equipamento_id: p.equipamento_id ?? 'e1', evento_id: p.evento_id ?? null,
    reserva_id: p.reserva_id ?? null, quantidade: p.quantidade ?? 1,
    inicio: p.inicio ?? null, fim: p.fim ?? null, status: p.status ?? 'reservado',
    qtd_avaria: p.qtd_avaria ?? 0, custo_unit_num: p.custo_unit_num ?? 0, preco_unit_num: p.preco_unit_num ?? 0,
    obs: p.obs ?? null, ...p,
  }
}
function mkEquip(p: Partial<Equipamento>): Equipamento {
  return {
    id: p.id || 'e1', nome: p.nome ?? 'Cadeira', categoria: p.categoria ?? 'mobiliario', sku: p.sku ?? null,
    unidade: p.unidade ?? 'un', quantidade_total: p.quantidade_total ?? 100, proprio: p.proprio ?? true,
    fornecedor_id: p.fornecedor_id ?? null, custo_locacao_num: p.custo_locacao_num ?? 0, preco_locacao_num: p.preco_locacao_num ?? 0,
    descricao: p.descricao ?? null, foto_url: p.foto_url ?? null, ativo: p.ativo ?? true, obs: p.obs ?? null, ...p,
  }
}

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0) // referência fixa (determinístico)
const iso = (ms: number) => new Date(ms).toISOString()

describe('toRange', () => {
  it('usa inicio/fim (timestamptz) quando presentes', () => {
    expect(toRange(mkAloc({ inicio: iso(T0), fim: iso(T0 + 2 * HORA) }))).toEqual({ start: T0, end: T0 + 2 * HORA })
  })
  it('sem fim assume 1 dia', () => {
    const r = toRange(mkAloc({ inicio: iso(T0) }))!
    expect(r.end - r.start).toBe(DIA)
  })
  it('aceita faixa só-data YYYY-MM-DD (ancorada ao dia local)', () => {
    const r = toRange(mkAloc({ inicio: '2026-06-10', fim: '2026-06-12' }))!
    expect(r.end - r.start).toBe(2 * DIA)
  })
  it('retorna null sem inicio', () => {
    expect(toRange(mkAloc({ inicio: null }))).toBeNull()
  })
})

describe('overlap', () => {
  it('detecta sobreposição e ignora faixas que só se encostam', () => {
    expect(overlap(0, 10, 5, 15)).toBe(true)
    expect(overlap(0, 10, 10, 20)).toBe(false) // adjacentes não sobrepõem
  })
})

describe('status', () => {
  it('reservado/separado/em_uso ocupam estoque', () => {
    for (const s of ['reservado', 'separado', 'em_uso']) expect(ocupaAlocacao(s)).toBe(true)
  })
  it('devolvido/avariado/cancelado liberam estoque', () => {
    for (const s of ['devolvido', 'avariado', 'cancelado']) {
      expect(ocupaAlocacao(s)).toBe(false)
      expect(alocacaoEncerrada(s)).toBe(true)
    }
  })
  it('alocStatusMeta tem fallback para status desconhecido', () => {
    expect(alocStatusMeta('reservado').label).toBe('Reservado')
    expect(alocStatusMeta('xyz').label).toBe('xyz')
  })
})

describe('picoAlocado (sweep-line)', () => {
  it('soma unidades concorrentes no instante de maior pressão', () => {
    const al = [
      mkAloc({ id: 'a', quantidade: 30, inicio: iso(T0), fim: iso(T0 + 4 * HORA) }),
      mkAloc({ id: 'b', quantidade: 50, inicio: iso(T0 + 2 * HORA), fim: iso(T0 + 6 * HORA) }), // overlap 2h → pico 80
      mkAloc({ id: 'c', quantidade: 20, inicio: iso(T0 + 8 * HORA), fim: iso(T0 + 9 * HORA) }), // separada
    ]
    expect(picoAlocado(al, T0, T0 + DIA)).toBe(80)
  })
  it('faixas adjacentes (fim==início) não somam pico', () => {
    const al = [
      mkAloc({ id: 'a', quantidade: 60, inicio: iso(T0), fim: iso(T0 + 2 * HORA) }),
      mkAloc({ id: 'b', quantidade: 60, inicio: iso(T0 + 2 * HORA), fim: iso(T0 + 4 * HORA) }),
    ]
    expect(picoAlocado(al, T0, T0 + DIA)).toBe(60)
  })
  it('ignora alocações encerradas (devolvido/cancelado)', () => {
    const al = [
      mkAloc({ id: 'a', quantidade: 40, inicio: iso(T0), fim: iso(T0 + 4 * HORA), status: 'devolvido' }),
      mkAloc({ id: 'b', quantidade: 40, inicio: iso(T0), fim: iso(T0 + 4 * HORA), status: 'cancelado' }),
      mkAloc({ id: 'c', quantidade: 10, inicio: iso(T0), fim: iso(T0 + 4 * HORA), status: 'reservado' }),
    ]
    expect(picoAlocado(al, T0, T0 + DIA)).toBe(10)
  })
  it('recorta à janela consultada (fora do período não conta)', () => {
    const al = [mkAloc({ id: 'a', quantidade: 99, inicio: iso(T0 + 10 * DIA), fim: iso(T0 + 11 * DIA) })]
    expect(picoAlocado(al, T0, T0 + DIA)).toBe(0)
  })
  it('respeita ignoreId (mover/editar a própria alocação)', () => {
    const al = [mkAloc({ id: 'self', quantidade: 80, inicio: iso(T0), fim: iso(T0 + DIA) })]
    expect(picoAlocado(al, T0, T0 + DIA, { ignoreId: 'self' })).toBe(0)
  })
})

describe('disponibilidade', () => {
  it('disponível = total − pico, filtrando por equipamento', () => {
    const e = mkEquip({ id: 'e1', quantidade_total: 100 })
    const al = [
      mkAloc({ id: 'a', equipamento_id: 'e1', quantidade: 70, inicio: iso(T0), fim: iso(T0 + DIA) }),
      mkAloc({ id: 'x', equipamento_id: 'e2', quantidade: 999, inicio: iso(T0), fim: iso(T0 + DIA) }), // outro item
    ]
    expect(disponibilidade(e, al, T0, T0 + DIA)).toEqual({ total: 100, alocadoPico: 70, disponivel: 30 })
  })
  it('disponível negativo sinaliza superalocação', () => {
    const e = mkEquip({ id: 'e1', quantidade_total: 50 })
    const al = [mkAloc({ equipamento_id: 'e1', quantidade: 80, inicio: iso(T0), fim: iso(T0 + DIA) })]
    expect(disponibilidade(e, al, T0, T0 + DIA).disponivel).toBe(-30)
  })
})

describe('checarDisponibilidade (critério: bloqueia superalocação + sugere sublocação)', () => {
  const e = mkEquip({ id: 'e1', quantidade_total: 100 })
  const existentes = [mkAloc({ id: 'a', equipamento_id: 'e1', quantidade: 80, inicio: iso(T0), fim: iso(T0 + DIA) })]

  it('aprova quando cabe no disponível', () => {
    const c = checarDisponibilidade(e, existentes, { start: T0, end: T0 + DIA, quantidade: 20 })
    expect(c.ok).toBe(true)
    expect(c.faltam).toBe(0)
    expect(c.disponivel).toBe(20)
  })
  it('bloqueia e calcula quanto falta sublocar', () => {
    const c = checarDisponibilidade(e, existentes, { start: T0, end: T0 + DIA, quantidade: 50 })
    expect(c.ok).toBe(false)
    expect(c.faltam).toBe(30) // 50 pedidas − 20 disponíveis
  })
  it('período sem conflito libera o total', () => {
    const c = checarDisponibilidade(e, existentes, { start: T0 + 5 * DIA, end: T0 + 6 * DIA, quantidade: 100 })
    expect(c.ok).toBe(true)
  })
  it('ignoreId permite reeditar a própria alocação sem auto-bloqueio', () => {
    const c = checarDisponibilidade(e, existentes, { start: T0, end: T0 + DIA, quantidade: 90, ignoreId: 'a' })
    expect(c.ok).toBe(true)
  })
})

describe('serieDiaria', () => {
  it('produz um ponto por dia com pico e disponível', () => {
    const e = mkEquip({ id: 'e1', quantidade_total: 10 })
    const al = [mkAloc({ equipamento_id: 'e1', quantidade: 4, inicio: '2026-06-10', fim: '2026-06-12' })]
    const serie = serieDiaria(e, al, Date.parse('2026-06-10T00:00:00'), Date.parse('2026-06-13T00:00:00'))
    expect(serie).toHaveLength(3)
    expect(serie[0]).toMatchObject({ alocado: 4, disponivel: 6, superalocado: false })
    expect(serie[2].alocado).toBe(0) // dia 12 já liberado (fim exclusivo)
  })
  it('marca superalocado quando o pico passa do total', () => {
    const e = mkEquip({ id: 'e1', quantidade_total: 3 })
    const al = [mkAloc({ equipamento_id: 'e1', quantidade: 5, inicio: '2026-06-10', fim: '2026-06-11' })]
    const serie = serieDiaria(e, al, Date.parse('2026-06-10T00:00:00'), Date.parse('2026-06-11T00:00:00'))
    expect(serie[0].superalocado).toBe(true)
  })
})

describe('custo / receita / margem', () => {
  const al = [
    mkAloc({ id: 'a', quantidade: 10, custo_unit_num: 5, preco_unit_num: 12 }),
    mkAloc({ id: 'b', quantidade: 2, custo_unit_num: 100, preco_unit_num: 250 }),
    mkAloc({ id: 'c', quantidade: 99, custo_unit_num: 9, preco_unit_num: 9, status: 'cancelado' }), // ignorada
  ]
  it('custoSublocacao soma custo_unit × qtd (ignora cancelado)', () => {
    expect(custoSublocacao(al)).toBe(10 * 5 + 2 * 100)
  })
  it('receitaLocacao soma preco_unit × qtd (ignora cancelado)', () => {
    expect(receitaLocacao(al)).toBe(10 * 12 + 2 * 250)
  })
  it('margemLocacao = receita − custo', () => {
    expect(margemLocacao(al)).toBe((10 * 12 + 2 * 250) - (10 * 5 + 2 * 100))
  })
})

describe('unidadesFora (agora)', () => {
  it('conta apenas alocações ocupando o instante atual', () => {
    const al = [
      mkAloc({ id: 'a', quantidade: 5, inicio: iso(T0 - HORA), fim: iso(T0 + HORA) }),   // dentro
      mkAloc({ id: 'b', quantidade: 9, inicio: iso(T0 + DIA), fim: iso(T0 + 2 * DIA) }),  // futuro
      mkAloc({ id: 'c', quantidade: 7, inicio: iso(T0 - HORA), fim: iso(T0 + HORA), status: 'devolvido' }), // liberada
    ]
    expect(unidadesFora(al, T0)).toBe(5)
  })
})

describe('helpers diversos', () => {
  it('addDaysYmd soma dias mantendo o formato', () => {
    expect(addDaysYmd('2026-06-10', 5)).toBe('2026-06-15')
    expect(addDaysYmd('2026-06-30', 1)).toBe('2026-07-01')
  })
  it('catEquipLabel resolve rótulo e cai para outro', () => {
    expect(catEquipLabel('som_luz')).toBe('Som & Luz')
    expect(catEquipLabel(null)).toBe('Outro')
  })
})
