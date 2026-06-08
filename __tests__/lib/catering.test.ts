import { describe, it, expect } from 'vitest'
import {
  num, round2, clampFrac,
  custoInsumoPorPessoa, custoItemPorPessoa, custoCardapioPorPessoa, precoCardapioPorPessoa,
  foodCost, margemBruta, markup,
  dimensionar, custoDimensionado, linhasComProduto,
  custoBarPrevisto, receitaBarPrevista, consumoBarReal, resultadoBar,
  custoPorPessoa, compararCMV, resumoEvento,
  parseRestricoesTexto, agregarRestricoes, restricoesPresentes, coberturaRestricoes,
  type CardapioItem, type Cardapio, type FichaInsumo, type Drink,
} from '@/lib/catering'

// Helpers de construção enxutos para os testes.
const ficha = (nome: string, qtd: number, custo: number, perda = 0, produto_id: string | null = null): FichaInsumo =>
  ({ produto_id, nome, unidade: 'un', qtd_por_pessoa: qtd, custo_unit_num: custo, perda_pct: perda })
const item = (over: Partial<CardapioItem> = {}): CardapioItem => ({
  id: 'i1', nome: 'Item', categoria: 'principal', porcao_por_pessoa: 1, unidade: 'un',
  custo_num: 0, preco_num: 0, incluso: true, restricoes: [], ficha: [], ...over,
})
const drink = (over: Partial<Drink> = {}): Drink => ({
  id: 'd1', nome: 'Drink', categoria: 'coquetel', custo_num: 0, preco_num: 0, por_pessoa: 0, ...over,
})

// ── Utilidades ───────────────────────────────────────────────────────────────
describe('num / round2 / clampFrac', () => {
  it('num trata lixo como 0', () => {
    expect(num('x')).toBe(0)
    expect(num('3.5')).toBe(3.5)
    expect(num(null)).toBe(0)
  })
  it('round2 arredonda a centavos', () => {
    expect(round2(3.005)).toBe(3.01)
    expect(round2(2.999)).toBe(3)
  })
  it('clampFrac satura em [0, máx]', () => {
    expect(clampFrac(-1)).toBe(0)
    expect(clampFrac(0.3)).toBe(0.3)
    expect(clampFrac(2)).toBe(1)
    expect(clampFrac(5, 10)).toBe(5)
  })
})

// ── Custo do item (ficha técnica vs fallback) ────────────────────────────────
describe('custoInsumoPorPessoa', () => {
  it('multiplica qtd × custo e embute a perda', () => {
    expect(custoInsumoPorPessoa(ficha('Pão', 2, 0.5))).toBe(1)
    expect(custoInsumoPorPessoa(ficha('Queijo', 0.08, 100, 0.1))).toBe(8.8) // 0.08*100*1.1
  })
})
describe('custoItemPorPessoa', () => {
  it('soma a ficha técnica quando há insumos', () => {
    const i = item({ ficha: [ficha('A', 2, 1), ficha('B', 1, 3)] })
    expect(custoItemPorPessoa(i)).toBe(5)
  })
  it('cai no custo_num quando a ficha está vazia', () => {
    expect(custoItemPorPessoa(item({ custo_num: 7.5, ficha: [] }))).toBe(7.5)
  })
  it('ficha tem precedência sobre custo_num', () => {
    const i = item({ custo_num: 99, ficha: [ficha('A', 1, 2)] })
    expect(custoItemPorPessoa(i)).toBe(2)
  })
})

// ── Custo / preço do cardápio ────────────────────────────────────────────────
describe('custoCardapioPorPessoa / precoCardapioPorPessoa', () => {
  const c: Cardapio = {
    id: 'c1', nome: 'Jantar', tipo: 'jantar', preco_pessoa_num: 120,
    itens: [item({ ficha: [ficha('A', 1, 10)] }), item({ id: 'i2', ficha: [ficha('B', 2, 5)] })],
  }
  it('soma o custo de cada item por pessoa', () => {
    expect(custoCardapioPorPessoa(c)).toBe(20) // 10 + 10
  })
  it('preço usa o pacote quando definido', () => {
    expect(precoCardapioPorPessoa(c)).toBe(120)
  })
  it('sem pacote, soma os preços dos itens não inclusos', () => {
    const c2: Cardapio = { ...c, preco_pessoa_num: 0, itens: [
      item({ preco_num: 30, incluso: false }),
      item({ id: 'i2', preco_num: 20, incluso: true }), // incluso não soma
    ] }
    expect(precoCardapioPorPessoa(c2)).toBe(30)
  })
})

// ── Food cost / margem / markup ──────────────────────────────────────────────
describe('foodCost / margemBruta / markup', () => {
  it('food cost = custo ÷ preço', () => {
    expect(foodCost(30, 120)).toBe(0.25)
    expect(foodCost(30, 0)).toBe(0)
  })
  it('margem = (preço − custo) ÷ preço', () => {
    expect(margemBruta(30, 120)).toBe(0.75)
    expect(margemBruta(30, 0)).toBe(0)
  })
  it('markup = preço ÷ custo', () => {
    expect(markup(30, 120)).toBe(4)
    expect(markup(0, 120)).toBe(0)
  })
})

// ── Dimensionamento (lista de compras/requisição) ────────────────────────────
describe('dimensionar', () => {
  const c: Cardapio = {
    id: 'c1', nome: 'Buffet', tipo: 'buffet', preco_pessoa_num: 0,
    itens: [
      item({ id: 'i1', ficha: [ficha('Carne', 0.2, 50, 0, 'p-carne'), ficha('Gelo', 0.25, 1.5, 0.2, 'p-gelo')] }),
      item({ id: 'i2', ficha: [ficha('Carne', 0.1, 50, 0, 'p-carne')] }), // mesmo produto → agrega
    ],
  }
  it('agrega por produto e multiplica por convidados', () => {
    const linhas = dimensionar(c, 100)
    const carne = linhas.find((l) => l.produto_id === 'p-carne')!
    expect(carne.qtd_por_pessoa).toBe(0.3)      // 0.2 + 0.1
    expect(carne.qtd_total).toBe(30)            // 0.3 * 100
    expect(carne.custo_total_num).toBe(1500)    // 30 * 50
  })
  it('embute a perda na quantidade comprada', () => {
    const linhas = dimensionar(c, 100)
    const gelo = linhas.find((l) => l.produto_id === 'p-gelo')!
    expect(gelo.qtd_por_pessoa).toBe(0.3)       // 0.25 * 1.2
    expect(gelo.qtd_total).toBe(30)
  })
  it('aplica o fator de ajuste global', () => {
    const linhas = dimensionar(c, 100, 1.1)
    const carne = linhas.find((l) => l.produto_id === 'p-carne')!
    expect(carne.qtd_total).toBe(33)            // 0.3 * 100 * 1.1
  })
  it('ordena por custo total desc', () => {
    const linhas = dimensionar(c, 100)
    expect(linhas[0].produto_id).toBe('p-carne')
  })
  it('convidados 0 → quantidades 0', () => {
    expect(dimensionar(c, 0).every((l) => l.qtd_total === 0)).toBe(true)
  })
  it('agrega itens avulsos (sem produto_id) por nome+unidade', () => {
    const c2: Cardapio = { ...c, itens: [
      item({ ficha: [ficha('Guardanapo', 4, 0.05)] }),
      item({ id: 'i2', ficha: [ficha('Guardanapo', 2, 0.05)] }),
    ] }
    const linhas = dimensionar(c2, 10)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].qtd_total).toBe(60)        // (4+2) * 10
  })
})
describe('custoDimensionado / linhasComProduto', () => {
  const c: Cardapio = {
    id: 'c1', nome: 'X', tipo: 'buffet', preco_pessoa_num: 0,
    itens: [item({ ficha: [ficha('Carne', 0.2, 50, 0, 'p1'), ficha('Avulso', 1, 2)] })],
  }
  it('soma o custo total previsto', () => {
    expect(custoDimensionado(dimensionar(c, 10))).toBe(120) // 0.2*10*50 + 1*10*2
  })
  it('linhasComProduto filtra só o que baixa Estoque', () => {
    const linhas = dimensionar(c, 10)
    expect(linhasComProduto(linhas).map((l) => l.produto_id)).toEqual(['p1'])
  })
})

// ── Bar ──────────────────────────────────────────────────────────────────────
describe('custoBarPrevisto / receitaBarPrevista', () => {
  const drinks = [
    drink({ id: 'd1', por_pessoa: 2, custo_num: 3, preco_num: 12 }),
    drink({ id: 'd2', por_pessoa: 1, custo_num: 5, preco_num: 18 }),
  ]
  it('custo previsto = Σ por_pessoa × custo × convidados', () => {
    expect(custoBarPrevisto(drinks, 100)).toBe(1100) // (2*3 + 1*5) * 100
  })
  it('open bar não fatura por consumo', () => {
    expect(receitaBarPrevista(drinks, 100, 'open_bar')).toBe(0)
  })
  it('consumação/cash bar faturam por dose', () => {
    expect(receitaBarPrevista(drinks, 100, 'consumacao')).toBe(4200) // (2*12 + 1*18) * 100
  })
})
describe('consumoBarReal', () => {
  const drinks = [drink({ id: 'd1', custo_num: 3, preco_num: 12 }), drink({ id: 'd2', custo_num: 5, preco_num: 18 })]
  it('custo conta servido + perda; receita só o servido', () => {
    const r = consumoBarReal(drinks, [{ drink_id: 'd1', quantidade: 10, perda: 2 }, { drink_id: 'd2', quantidade: 4, perda: 0 }])
    expect(r.custo_num).toBe(56)     // (10+2)*3 + 4*5
    expect(r.receita_num).toBe(192)  // 10*12 + 4*18
    expect(r.perdas_num).toBe(6)     // 2*3
    expect(r.unidades).toBe(14)
  })
  it('ignora drink_id desconhecido', () => {
    expect(consumoBarReal(drinks, [{ drink_id: 'zzz', quantidade: 9, perda: 9 }]).custo_num).toBe(0)
  })
})
describe('resultadoBar', () => {
  const drinks = [drink({ id: 'd1', por_pessoa: 2, custo_num: 3, preco_num: 12 })]
  it('sem consumo usa o previsto', () => {
    const r = resultadoBar({ tipo: 'consumacao', drinks, convidados: 100 })
    expect(r.custoPrevisto).toBe(600)
    expect(r.custoReal).toBe(0)
    expect(r.custoPorPessoa).toBe(6) // previsto / 100
  })
  it('com consumo usa o real e calcula por pessoa', () => {
    const r = resultadoBar({ tipo: 'consumacao', drinks, convidados: 100, consumo: [{ drink_id: 'd1', quantidade: 150, perda: 10 }] })
    expect(r.custoReal).toBe(480)    // 160*3
    expect(r.receitaReal).toBe(1800) // 150*12
    expect(r.custoPorPessoa).toBe(4.8)
  })
  it('open bar não gera receita mesmo com consumo lançado', () => {
    const r = resultadoBar({ tipo: 'open_bar', drinks, convidados: 100, consumo: [{ drink_id: 'd1', quantidade: 150, perda: 0 }] })
    expect(r.receitaReal).toBe(0)
  })
})

// ── CMV previsto × real ──────────────────────────────────────────────────────
describe('custoPorPessoa / compararCMV', () => {
  it('custo por pessoa divide pelo nº de convidados', () => {
    expect(custoPorPessoa(1500, 100)).toBe(15)
    expect(custoPorPessoa(1500, 0)).toBe(0)
  })
  it('compara previsto × real e calcula food cost de cada', () => {
    const r = compararCMV({ custoPrevisto: 1000, custoReal: 1200, receita: 4000 })
    expect(r.variacao_num).toBe(200)
    expect(r.variacao_pct).toBe(0.2)
    expect(r.foodCostPrevisto).toBe(0.25)
    expect(r.foodCostReal).toBe(0.3)
  })
  it('previsto 0 → variação_pct 0 (sem divisão por zero)', () => {
    expect(compararCMV({ custoPrevisto: 0, custoReal: 50, receita: 0 }).variacao_pct).toBe(0)
  })
})

// ── Resumo do evento (cardápio + bar) ────────────────────────────────────────
describe('resumoEvento', () => {
  const cardapio: Cardapio = {
    id: 'c1', nome: 'Jantar', tipo: 'jantar', preco_pessoa_num: 120,
    itens: [item({ ficha: [ficha('A', 1, 10)] })],
  }
  it('consolida custo e receita de cardápio + bar', () => {
    const bar = resultadoBar({ tipo: 'consumacao', drinks: [drink({ por_pessoa: 1, custo_num: 4, preco_num: 15 })], convidados: 100 })
    const r = resumoEvento({ cardapio, convidados: 100, bar })
    expect(r.custoCardapio).toBe(1000)  // 10 * 100
    expect(r.custoBar).toBe(400)        // 4 * 100
    expect(r.custoTotal).toBe(1400)
    expect(r.receitaCardapio).toBe(12000) // 120 * 100
    expect(r.receitaBar).toBe(1500)       // 15 * 100
    expect(r.custoPorPessoa).toBe(14)
  })
  it('custo real do cardápio sobrepõe o previsto', () => {
    const r = resumoEvento({ cardapio, convidados: 100, custoCardapioReal: 1234 })
    expect(r.custoCardapio).toBe(1234)
  })
  it('sem cardápio nem bar → zeros', () => {
    const r = resumoEvento({ cardapio: null, convidados: 50 })
    expect(r.custoTotal).toBe(0)
    expect(r.receitaTotal).toBe(0)
  })
})

// ── Restrições ───────────────────────────────────────────────────────────────
describe('parseRestricoesTexto', () => {
  it('detecta restrições no texto livre do CRM', () => {
    expect(parseRestricoesTexto('2 veganos, 1 sem glúten e uma criança')).toEqual(['vegano', 'sem_gluten', 'infantil'])
  })
  it('texto vazio → nenhuma', () => {
    expect(parseRestricoesTexto('')).toEqual([])
    expect(parseRestricoesTexto(null)).toEqual([])
  })
})
describe('agregarRestricoes / restricoesPresentes', () => {
  it('soma duplicatas por restrição', () => {
    expect(agregarRestricoes([
      { restricao: 'vegano', quantidade: 2 },
      { restricao: 'vegano', quantidade: 3 },
      { restricao: 'sem_gluten', quantidade: 1 },
    ])).toEqual({ vegano: 5, sem_gluten: 1 })
  })
  it('presentes = só os com quantidade > 0, em ordem do catálogo', () => {
    expect(restricoesPresentes([
      { restricao: 'infantil', quantidade: 0 },
      { restricao: 'sem_gluten', quantidade: 2 },
      { restricao: 'vegano', quantidade: 1 },
    ])).toEqual(['vegano', 'sem_gluten'])
  })
})
describe('coberturaRestricoes', () => {
  const cardapio: Cardapio = {
    id: 'c1', nome: 'X', tipo: 'buffet', preco_pessoa_num: 0,
    itens: [
      item({ id: 'i1', nome: 'Salada vegana', restricoes: ['vegano', 'vegetariano'] }),
      item({ id: 'i2', nome: 'Bolo', restricoes: ['vegetariano'] }),
    ],
  }
  it('marca atendida quando há ≥1 item que cobre a restrição', () => {
    const cob = coberturaRestricoes(cardapio, [{ restricao: 'vegano', quantidade: 2 }, { restricao: 'sem_gluten', quantidade: 1 }])
    const vegano = cob.find((c) => c.restricao === 'vegano')!
    const semGluten = cob.find((c) => c.restricao === 'sem_gluten')!
    expect(vegano.atendida).toBe(true)
    expect(vegano.itens).toEqual(['Salada vegana'])
    expect(semGluten.atendida).toBe(false)
    expect(semGluten.itens).toEqual([])
  })
})
