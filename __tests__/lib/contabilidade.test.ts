import { describe, it, expect } from 'vitest'
import {
  montarDRE,
  montarBalancete,
  livroRazao,
  lancamentosDoPeriodo,
  dataReconhecimento,
  entraNoRegime,
  dreLinhaDeCategoria,
  projecaoFluxo,
  posicaoPorConta,
  parseOFX,
  parseCSVExtrato,
  conciliarAuto,
  estimarImpostos,
  mesFechado,
  lancamentoBloqueado,
  serieMeses,
  diffDiasYmd,
  DEFAULT_IMPOSTOS,
  type Lancamento,
  type PlanoConta,
} from '@/lib/contabilidade'

// ── Fábricas (só os campos que a engine lê) ──────────────────────────────────
let _id = 0
const lanc = (over: Partial<Lancamento> = {}): Lancamento => ({
  id: ++_id,
  tipo: 'receita',
  categoria: null,
  valor: 1000,
  status: 'pago',
  data: '2026-06-10',
  ...over,
})
const conta = (over: Partial<PlanoConta> = {}): PlanoConta => ({
  id: `c${++_id}`,
  codigo: '3.1.01',
  nome: 'Conta',
  tipo: 'receita',
  dre_linha: 'receita_bruta',
  ...over,
})

// ── Regime caixa × competência ───────────────────────────────────────────────
describe('regime caixa × competência', () => {
  it('reconhece pela data de caixa no regime caixa', () => {
    const l = lanc({ data: '2026-06-10', competencia: '2026-05-01' })
    expect(dataReconhecimento(l, 'caixa')).toBe('2026-06-10')
    expect(dataReconhecimento(l, 'competencia')).toBe('2026-05-01')
  })

  it('competência cai para a data quando não há competência', () => {
    const l = lanc({ data: '2026-06-10', competencia: null })
    expect(dataReconhecimento(l, 'competencia')).toBe('2026-06-10')
  })

  it('caixa só considera pagos; competência considera pendentes', () => {
    expect(entraNoRegime(lanc({ status: 'pendente' }), 'caixa')).toBe(false)
    expect(entraNoRegime(lanc({ status: 'pendente' }), 'competencia')).toBe(true)
    expect(entraNoRegime(lanc({ status: 'cancelado' }), 'competencia')).toBe(false)
  })

  it('filtra por período usando a data do regime', () => {
    const ls = [
      lanc({ data: '2026-06-10', competencia: '2026-05-20' }),
      lanc({ data: '2026-06-15', competencia: '2026-06-15' }),
    ]
    expect(lancamentosDoPeriodo(ls, 'caixa', '2026-06-01', '2026-06-30')).toHaveLength(2)
    expect(lancamentosDoPeriodo(ls, 'competencia', '2026-06-01', '2026-06-30')).toHaveLength(1)
  })
})

// ── DRE em cascata ───────────────────────────────────────────────────────────
describe('DRE gerencial', () => {
  const contas = [
    conta({ id: 'rec', codigo: '3.1.01', nome: 'Locação', tipo: 'receita', dre_linha: 'receita_bruta' }),
    conta({ id: 'imp', codigo: '4.1.01', nome: 'Impostos', tipo: 'despesa', dre_linha: 'deducoes' }),
    conta({ id: 'buf', codigo: '5.1.01', nome: 'Buffet', tipo: 'despesa', dre_linha: 'custos_diretos' }),
    conta({ id: 'adm', codigo: '6.1.01', nome: 'Aluguel', tipo: 'despesa', dre_linha: 'despesas_operacionais' }),
  ]
  const ls = [
    lanc({ tipo: 'receita', valor: 10000, conta_id: 'rec' }),
    lanc({ tipo: 'despesa', valor: 1000, conta_id: 'imp' }),
    lanc({ tipo: 'despesa', valor: 3000, conta_id: 'buf' }),
    lanc({ tipo: 'despesa', valor: 2000, conta_id: 'adm' }),
  ]

  it('monta a cascata corretamente', () => {
    const dre = montarDRE(ls, contas, 'caixa', '2026-06-01', '2026-06-30')
    expect(dre.receitaBruta).toBe(10000)
    expect(dre.deducoes).toBe(1000)
    expect(dre.receitaLiquida).toBe(9000)
    expect(dre.custosDiretos).toBe(3000)
    expect(dre.margemContribuicao).toBe(6000)
    expect(dre.despesasOperacionais).toBe(2000)
    expect(dre.ebitda).toBe(4000)
    expect(dre.resultadoLiquido).toBe(4000)
    expect(dre.margemLiquida).toBeCloseTo(0.4, 5)
  })

  it('resultado = receitas − despesas (bate com os lançamentos)', () => {
    const dre = montarDRE(ls, contas, 'caixa', '2026-06-01', '2026-06-30')
    const receitas = ls.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const despesas = ls.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
    expect(dre.resultadoLiquido).toBe(receitas - despesas)
  })

  it('classifica lançamentos legados sem conta pela categoria', () => {
    expect(dreLinhaDeCategoria('receita', null)).toBe('receita_bruta')
    expect(dreLinhaDeCategoria('despesa', 'Impostos')).toBe('deducoes')
    expect(dreLinhaDeCategoria('despesa', 'Buffet / Catering')).toBe('custos_diretos')
    expect(dreLinhaDeCategoria('despesa', 'Marketing')).toBe('despesas_operacionais')
    const dre = montarDRE([lanc({ tipo: 'despesa', valor: 500, categoria: 'Impostos', conta_id: null })], [], 'caixa', '2026-06-01', '2026-06-30')
    expect(dre.deducoes).toBe(500)
  })

  it('segmenta por centro de custo', () => {
    const seg = [
      lanc({ tipo: 'receita', valor: 5000, conta_id: 'rec', centro_custo_id: 'A' }),
      lanc({ tipo: 'receita', valor: 3000, conta_id: 'rec', centro_custo_id: 'B' }),
    ]
    expect(montarDRE(seg, contas, 'caixa', '2026-06-01', '2026-06-30', 'A').receitaBruta).toBe(5000)
  })
})

// ── Balancete & razão ────────────────────────────────────────────────────────
describe('balancete e razão', () => {
  const contas = [conta({ id: 'rec', codigo: '3.1.01', nome: 'Locação', tipo: 'receita' })]
  const ls = [
    lanc({ tipo: 'receita', valor: 8000, conta_id: 'rec', data: '2026-06-05' }),
    lanc({ tipo: 'despesa', valor: 2000, categoria: 'Limpeza', data: '2026-06-08' }),
  ]

  it('credita receita, debita despesa; saldo = crédito − débito', () => {
    const bal = montarBalancete(ls, contas, 'caixa', '2026-06-01', '2026-06-30')
    const rec = bal.linhas.find((x) => x.contaId === 'rec')!
    expect(rec.credito).toBe(8000)
    expect(rec.saldo).toBe(8000)
    expect(bal.totalCredito).toBe(8000)
    expect(bal.totalDebito).toBe(2000)
  })

  it('agrupa lançamentos sem conta numa pseudo-conta da categoria', () => {
    const bal = montarBalancete(ls, contas, 'caixa', '2026-06-01', '2026-06-30')
    expect(bal.linhas.find((x) => x.contaId === 'cat:Limpeza')?.debito).toBe(2000)
  })

  it('razão acumula saldo corrente em ordem de data', () => {
    const r = livroRazao(ls, 'rec', 'caixa', '2026-06-01', '2026-06-30')
    expect(r.linhas).toHaveLength(1)
    expect(r.saldoFinal).toBe(8000)
  })
})

// ── Fluxo de caixa ───────────────────────────────────────────────────────────
describe('fluxo de caixa', () => {
  it('projeta entradas (parcelas) e saídas (despesas em aberto) e acumula saldo', () => {
    const parcelas = [
      { id: 1, valor: 5000, vencimento: '2026-07-15', status: 'pendente' },
      { id: 2, valor: 3000, vencimento: '2026-08-10', status: 'pago' }, // ignorada (paga)
    ]
    const desp = [lanc({ tipo: 'despesa', valor: 2000, status: 'pendente', data: '2026-07-20' })]
    const fluxo = projecaoFluxo(parcelas, desp, '2026-07', 1000, 3)
    expect(fluxo[0].mes).toBe('2026-07')
    expect(fluxo[0].entradaProj).toBe(5000)
    expect(fluxo[0].saidaProj).toBe(2000)
    expect(fluxo[0].saldoAcum).toBe(1000 + 5000 - 2000)
    expect(fluxo[1].entradaProj).toBe(0)
  })

  it('posição por conta soma só lançamentos pagos e separa conciliados', () => {
    const contasBanco = [{ id: 'b1', nome: 'Banco', saldo_inicial_num: 1000 }]
    const ls = [
      lanc({ tipo: 'receita', valor: 5000, status: 'pago', conta_bancaria_id: 'b1', conciliado: true }),
      lanc({ tipo: 'despesa', valor: 1500, status: 'pago', conta_bancaria_id: 'b1', conciliado: false }),
      lanc({ tipo: 'receita', valor: 9999, status: 'pendente', conta_bancaria_id: 'b1' }), // ignorada
    ]
    const pos = posicaoPorConta(contasBanco, ls)
    const b1 = pos.contas.find((c) => c.contaId === 'b1')!
    expect(b1.entradas).toBe(5000)
    expect(b1.saidas).toBe(1500)
    expect(b1.saldoAtual).toBe(1000 + 5000 - 1500)
    expect(b1.conciliado).toBe(1000 + 5000) // só a receita conciliada
  })
})

// ── Conciliação ──────────────────────────────────────────────────────────────
describe('conciliação bancária', () => {
  it('parseia OFX (SGML sem fechamento)', () => {
    const ofx = `OFXHEADER:100
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260610120000<TRNAMT>1500.00<MEMO>Recebimento evento
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260612<TRNAMT>-300.50<MEMO>Energia`
    const linhas = parseOFX(ofx)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ data: '2026-06-10', valor: 1500 })
    expect(linhas[1]).toMatchObject({ data: '2026-06-12', valor: -300.5 })
  })

  it('parseia CSV BR (delimitador ; e vírgula decimal)', () => {
    const csv = `Data;Histórico;Valor
10/06/2026;Recebimento;1.500,00
12/06/2026;Energia;-300,50`
    const linhas = parseCSVExtrato(csv)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ data: '2026-06-10', valor: 1500 })
    expect(linhas[1].valor).toBe(-300.5)
  })

  it('casa extrato com lançamentos por valor, sinal e data próxima', () => {
    const extrato = [
      { data: '2026-06-10', descricao: 'Evento', valor: 1500 },
      { data: '2026-06-12', descricao: 'Energia', valor: -300.5 },
      { data: '2026-06-20', descricao: 'Desconhecido', valor: -99 },
    ]
    const ls = [
      lanc({ tipo: 'receita', valor: 1500, data: '2026-06-10' }),
      lanc({ tipo: 'despesa', valor: 300.5, data: '2026-06-13' }),
    ]
    const matches = conciliarAuto(extrato, ls)
    expect(matches[0].lancamentoId).toBe(ls[0].id)
    expect(matches[1].lancamentoId).toBe(ls[1].id)
    expect(matches[2].lancamentoId).toBeNull() // sem correspondência
  })

  it('não casa o mesmo lançamento duas vezes', () => {
    const extrato = [
      { data: '2026-06-10', descricao: 'A', valor: 1000 },
      { data: '2026-06-10', descricao: 'B', valor: 1000 },
    ]
    const ls = [lanc({ tipo: 'receita', valor: 1000, data: '2026-06-10' })]
    const matches = conciliarAuto(extrato, ls)
    expect(matches.filter((m) => m.lancamentoId != null)).toHaveLength(1)
  })
})

// ── Impostos ─────────────────────────────────────────────────────────────────
describe('estimativa de impostos', () => {
  it('Simples: alíquota efetiva sobre a receita', () => {
    const r = estimarImpostos(10000, { ...DEFAULT_IMPOSTOS, regime: 'simples', aliquotaSimples: 6 })
    expect(r.total).toBe(600)
    expect(r.aliquotaEfetiva).toBeCloseTo(0.06, 5)
  })

  it('Presumido: ISS + PIS + COFINS + IRPJ/CSLL sobre base presumida', () => {
    const r = estimarImpostos(10000, { ...DEFAULT_IMPOSTOS, regime: 'presumido' })
    const iss = 500, pis = 65, cofins = 300, irpj = 10000 * 0.32 * 0.15, csll = 10000 * 0.32 * 0.09
    expect(r.total).toBeCloseTo(iss + pis + cofins + irpj + csll, 2)
  })

  it('MEI: valor fixo; isento: zero', () => {
    expect(estimarImpostos(50000, { ...DEFAULT_IMPOSTOS, regime: 'mei', dasMei: 75 }).total).toBe(75)
    expect(estimarImpostos(50000, { ...DEFAULT_IMPOSTOS, regime: 'isento' }).total).toBe(0)
  })
})

// ── Fechamento ───────────────────────────────────────────────────────────────
describe('fechamento mensal', () => {
  const fechs = [{ mes: '2026-05', status: 'fechado' }, { mes: '2026-06', status: 'aberto' }]
  it('detecta mês fechado', () => {
    expect(mesFechado('2026-05', fechs)).toBe(true)
    expect(mesFechado('2026-06', fechs)).toBe(false)
  })
  it('bloqueia edição retroativa pela data do regime', () => {
    const l = lanc({ data: '2026-06-01', competencia: '2026-05-30' })
    expect(lancamentoBloqueado(l, 'competencia', fechs)).toBe(true)
    expect(lancamentoBloqueado(l, 'caixa', fechs)).toBe(false)
  })
})

// ── Utilitários ──────────────────────────────────────────────────────────────
describe('utilitários de data', () => {
  it('serieMeses atravessa a virada de ano', () => {
    expect(serieMeses('2026-11', 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('diffDiasYmd', () => {
    expect(diffDiasYmd('2026-06-13', '2026-06-10')).toBe(3)
  })
})
