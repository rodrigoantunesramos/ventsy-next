import { describe, it, expect } from 'vitest'
import {
  num, round2, ymd, diasEntre, addMeses, proximaData,
  custoOS, custoPecas, osAberta, osAtrasada,
  planoDevido, planosDevidos, mttrDias, agruparPorStatus, kpisManutencao,
  chaveAtivo, custoPorAtivo, custoPorMes, pecasMaisUsadas,
  progressoChecklist, checklistCompleto,
  type OSCalc, type Peca, type ChecklistItem,
} from '@/lib/manutencao'

// "Agora" determinístico ancorado ao meio-dia LOCAL — casa com as datas só-data
// (abertura/conclusão/prazo), que o motor também ancora a T12:00:00 local.
const NOW = Date.parse('2026-06-15T12:00:00')
const HOJE = '2026-06-15'

const os = (o: Partial<OSCalc>): OSCalc => ({ tipo: 'corretiva', status: 'aberta', ...o })

// ── Utilidades numéricas/data ────────────────────────────────────────────────
describe('num / round2 / ymd', () => {
  it('num coage e protege contra NaN', () => {
    expect(num('12.5')).toBe(12.5)
    expect(num(null)).toBe(0)
    expect(num('abc')).toBe(0)
  })
  it('round2 arredonda a centavos', () => {
    expect(round2(1.236)).toBe(1.24)
    expect(round2(2.004)).toBe(2)
    expect(round2(10 / 3)).toBe(3.33)
  })
  it('ymd formata local', () => {
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('diasEntre', () => {
  it('conta dias inteiros entre datas só-data', () => {
    expect(diasEntre('2026-06-01', '2026-06-15')).toBe(14)
    expect(diasEntre('2026-06-15', '2026-06-01')).toBe(-14)
    expect(diasEntre('2026-06-15', '2026-06-15')).toBe(0)
  })
  it('retorna 0 para datas inválidas/ausentes', () => {
    expect(diasEntre(null, '2026-06-15')).toBe(0)
    expect(diasEntre('2026-06-15', undefined)).toBe(0)
  })
})

// ── Próxima data (agenda de preventivas) ─────────────────────────────────────
describe('addMeses / proximaData', () => {
  it('clampa no fim do mês (31/jan + 1 mês → fev)', () => {
    expect(ymd(addMeses(new Date(2026, 0, 31, 12), 1))).toBe('2026-02-28')
  })
  it('avança por cada periodicidade de calendário', () => {
    expect(proximaData('2026-06-15', 'diaria')).toBe('2026-06-16')
    expect(proximaData('2026-06-15', 'semanal')).toBe('2026-06-22')
    expect(proximaData('2026-06-15', 'quinzenal')).toBe('2026-06-29')
    expect(proximaData('2026-06-15', 'mensal')).toBe('2026-07-15')
    expect(proximaData('2026-06-15', 'bimestral')).toBe('2026-08-15')
    expect(proximaData('2026-06-15', 'trimestral')).toBe('2026-09-15')
    expect(proximaData('2026-06-15', 'semestral')).toBe('2026-12-15')
    expect(proximaData('2026-06-15', 'anual')).toBe('2027-06-15')
  })
  it('respeita o intervalo (a cada N períodos)', () => {
    expect(proximaData('2026-06-15', 'semanal', 2)).toBe('2026-06-29')
    expect(proximaData('2026-06-15', 'mensal', 3)).toBe('2026-09-15')
  })
  it('horas_uso não é calendarizada → null', () => {
    expect(proximaData('2026-06-15', 'horas_uso')).toBeNull()
  })
  it('data inválida → null', () => {
    expect(proximaData('xx', 'mensal')).toBeNull()
  })
})

// ── Custo da OS ──────────────────────────────────────────────────────────────
describe('custoOS / custoPecas', () => {
  it('custo total = mão de obra + peças', () => {
    expect(custoOS({ custo_mao_obra_num: 120, custo_pecas_num: 80 })).toBe(200)
    expect(custoOS({ custo_mao_obra_num: null, custo_pecas_num: 50 })).toBe(50)
  })
  it('custoPecas soma quantidade × custo (qtd ausente = 1)', () => {
    const pecas: Peca[] = [
      { descricao: 'Filtro', quantidade: 2, custo_num: 30 },
      { descricao: 'Gás', quantidade: 1, custo_num: 90 },
      { descricao: 'Vedação', custo_num: 10 } as Peca,
    ]
    expect(custoPecas(pecas)).toBe(160)
  })
})

// ── Ciclo de vida ────────────────────────────────────────────────────────────
describe('osAberta / osAtrasada', () => {
  it('aberta = não concluída nem cancelada', () => {
    expect(osAberta('aberta')).toBe(true)
    expect(osAberta('em_andamento')).toBe(true)
    expect(osAberta('concluida')).toBe(false)
    expect(osAberta('cancelada')).toBe(false)
  })
  it('atrasada = aberta e prazo no passado', () => {
    expect(osAtrasada({ status: 'aberta', prazo: '2026-06-10' }, HOJE)).toBe(true)
    expect(osAtrasada({ status: 'aberta', prazo: '2026-06-20' }, HOJE)).toBe(false)
    expect(osAtrasada({ status: 'concluida', prazo: '2026-06-10' }, HOJE)).toBe(false)
    expect(osAtrasada({ status: 'aberta', prazo: null }, HOJE)).toBe(false)
  })
})

// ── Planos devidos ───────────────────────────────────────────────────────────
describe('planoDevido / planosDevidos', () => {
  it('devido = ativo, calendarizado e vencido', () => {
    expect(planoDevido({ ativo: true, proxima_data: '2026-06-15', periodicidade: 'mensal' }, HOJE)).toBe(true)
    expect(planoDevido({ ativo: true, proxima_data: '2026-06-14', periodicidade: 'mensal' }, HOJE)).toBe(true)
    expect(planoDevido({ ativo: true, proxima_data: '2026-06-16', periodicidade: 'mensal' }, HOJE)).toBe(false)
  })
  it('inativo ou horas_uso nunca é devido', () => {
    expect(planoDevido({ ativo: false, proxima_data: '2026-01-01', periodicidade: 'mensal' }, HOJE)).toBe(false)
    expect(planoDevido({ ativo: true, proxima_data: '2026-01-01', periodicidade: 'horas_uso' }, HOJE)).toBe(false)
  })
  it('planosDevidos filtra a lista', () => {
    const planos = [
      { id: 'a', ativo: true, proxima_data: '2026-06-01', periodicidade: 'mensal' as const },
      { id: 'b', ativo: true, proxima_data: '2026-12-01', periodicidade: 'mensal' as const },
      { id: 'c', ativo: false, proxima_data: '2026-06-01', periodicidade: 'mensal' as const },
    ]
    expect(planosDevidos(planos, HOJE).map((p) => p.id)).toEqual(['a'])
  })
})

// ── MTTR ─────────────────────────────────────────────────────────────────────
describe('mttrDias', () => {
  it('média de dias abertura→conclusão só das corretivas concluídas', () => {
    const lista: OSCalc[] = [
      os({ tipo: 'corretiva', status: 'concluida', abertura: '2026-06-01', conclusao: '2026-06-05' }), // 4d
      os({ tipo: 'corretiva', status: 'concluida', abertura: '2026-06-01', conclusao: '2026-06-03' }), // 2d
      os({ tipo: 'preventiva', status: 'concluida', abertura: '2026-06-01', conclusao: '2026-06-20' }), // ignora (preventiva)
      os({ tipo: 'corretiva', status: 'em_andamento', abertura: '2026-06-01' }), // ignora (aberta)
    ]
    expect(mttrDias(lista)).toEqual({ dias: 3, n: 2 })
  })
  it('sem corretivas concluídas → zero', () => {
    expect(mttrDias([os({ status: 'aberta' })])).toEqual({ dias: 0, n: 0 })
  })
})

// ── Kanban ───────────────────────────────────────────────────────────────────
describe('agruparPorStatus', () => {
  it('distribui por coluna e mantém colunas vazias', () => {
    const g = agruparPorStatus([
      { status: 'aberta' as const }, { status: 'aberta' as const }, { status: 'concluida' as const },
    ])
    expect(g.aberta).toHaveLength(2)
    expect(g.concluida).toHaveLength(1)
    expect(g.cancelada).toEqual([])
  })
})

// ── KPIs ─────────────────────────────────────────────────────────────────────
describe('kpisManutencao', () => {
  it('agrega abertas, atrasadas, custo do mês e MTTR', () => {
    const lista: OSCalc[] = [
      os({ status: 'aberta', prazo: '2026-06-10', custo_mao_obra_num: 100, custo_pecas_num: 50 }), // aberta+atrasada, custoAberto 150
      os({ status: 'em_andamento', prazo: '2026-06-20', custo_mao_obra_num: 0, custo_pecas_num: 0 }), // aberta, emAndamento
      os({ status: 'aguardando_peca' }), // aberta, aguardandoPeca
      os({ tipo: 'corretiva', status: 'concluida', abertura: '2026-06-02', conclusao: '2026-06-06', custo_mao_obra_num: 200, custo_pecas_num: 0 }), // concluída no mês, 4d
      os({ status: 'cancelada', custo_mao_obra_num: 999 }), // ignora
    ]
    const k = kpisManutencao(lista, NOW)
    expect(k.abertas).toBe(3)
    expect(k.atrasadas).toBe(1)
    expect(k.emAndamento).toBe(1)
    expect(k.aguardandoPeca).toBe(1)
    expect(k.custoAberto).toBe(150)
    expect(k.concluidasMes).toBe(1)
    expect(k.custoMes).toBe(200)
    expect(k.mttr).toBe(4)
    expect(k.mttrN).toBe(1)
  })
})

// ── Custo por ativo/espaço ───────────────────────────────────────────────────
describe('chaveAtivo / custoPorAtivo', () => {
  it('prioriza ativo_id > ativo_nome > propriedade', () => {
    expect(chaveAtivo({ ativo_id: 'x', ativo_nome: 'Gerador', propriedade_id: 1 })).toBe('ativo:x')
    expect(chaveAtivo({ ativo_nome: 'Gerador', propriedade_id: 1 })).toBe('nome:gerador')
    expect(chaveAtivo({ propriedade_id: 7 })).toBe('prop:7')
    expect(chaveAtivo({})).toBe('sem')
  })
  it('soma custo por alvo, ignora canceladas e sem-alvo, ordena desc', () => {
    const lista: OSCalc[] = [
      os({ ativo_nome: 'Gerador', status: 'concluida', abertura: '2026-05-01', conclusao: '2026-05-02', custo_mao_obra_num: 300 }),
      os({ ativo_nome: 'Gerador', status: 'aberta', custo_mao_obra_num: 0, custo_pecas_num: 200 }),
      os({ ativo_nome: 'Ar-condicionado', status: 'aberta', custo_mao_obra_num: 100 }),
      os({ ativo_nome: 'Gerador', status: 'cancelada', custo_mao_obra_num: 999 }), // ignora
      os({ status: 'aberta', custo_mao_obra_num: 50 }), // sem alvo → ignora
    ]
    const r = custoPorAtivo(lista)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ ativo_nome: 'Gerador', custo: 500, n: 2, ultima: '2026-05-02' })
    expect(r[1]).toMatchObject({ ativo_nome: 'Ar-condicionado', custo: 100, n: 1 })
  })
})

// ── Custo por mês ────────────────────────────────────────────────────────────
describe('custoPorMes', () => {
  it('monta N buckets terminando no mês atual', () => {
    const lista: OSCalc[] = [
      os({ status: 'concluida', conclusao: '2026-06-10', custo_mao_obra_num: 100 }),
      os({ status: 'concluida', conclusao: '2026-05-10', custo_mao_obra_num: 50 }),
      os({ status: 'aberta', abertura: '2026-06-01', custo_mao_obra_num: 25 }),
      os({ status: 'cancelada', conclusao: '2026-06-01', custo_mao_obra_num: 999 }), // ignora
    ]
    const r = custoPorMes(lista, NOW, 3)
    expect(r).toHaveLength(3)
    expect(r.map((b) => b.mes)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(r[1].custo).toBe(50)
    expect(r[2].custo).toBe(125) // 100 (conclusão) + 25 (abertura)
  })
})

// ── Peças mais usadas ────────────────────────────────────────────────────────
describe('pecasMaisUsadas', () => {
  it('agrega por descrição (case-insensitive), soma qtd/custo, ordena por custo', () => {
    const lista = [
      { status: 'concluida' as const, pecas: [{ descricao: 'Filtro', quantidade: 2, custo_num: 30 }] },
      { status: 'aberta' as const, pecas: [{ descricao: 'filtro', quantidade: 1, custo_num: 30 }] },
      { status: 'aberta' as const, pecas: [{ descricao: 'Correia', quantidade: 1, custo_num: 200 }] },
      { status: 'cancelada' as const, pecas: [{ descricao: 'Filtro', quantidade: 9, custo_num: 30 }] }, // ignora
    ]
    const r = pecasMaisUsadas(lista)
    expect(r[0]).toMatchObject({ descricao: 'Correia', quantidade: 1, custo: 200 })
    expect(r[1]).toMatchObject({ descricao: 'Filtro', quantidade: 3, custo: 90, n: 2 })
  })
})

// ── Checklist ────────────────────────────────────────────────────────────────
describe('progressoChecklist / checklistCompleto', () => {
  const cl: ChecklistItem[] = [
    { item: 'Verificar gerador', ok: true },
    { item: 'Testar ar', ok: false },
    { item: 'Checar elétrica', ok: true },
  ]
  it('progresso conta feitos/total/pct', () => {
    expect(progressoChecklist(cl)).toEqual({ feitos: 2, total: 3, pct: 67 })
    expect(progressoChecklist([])).toEqual({ feitos: 0, total: 0, pct: 0 })
  })
  it('completo exige itens e todos marcados (gate pré-evento)', () => {
    expect(checklistCompleto(cl)).toBe(false)
    expect(checklistCompleto(cl.map((i) => ({ ...i, ok: true })))).toBe(true)
    expect(checklistCompleto([])).toBe(false)
  })
})
