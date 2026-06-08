import { describe, it, expect } from 'vitest'
import {
  precoEstande, estandeOcupado, resumoMapa,
  podeTransicionarEstande, exigeExpositor,
  normalizarPosicao, boundsDosEstandes, autoLayout,
  resumoCota, cotaTemVaga, resumoPatrocinio, receitaPatrocinador,
  patrocinadoresVendidos, progressoEntregaveis, marcarEntregavel,
  receitaEvento, progressoMeta,
  estandeStatusMeta, expositorStatusMeta, estandeTipoLabel, COTA_PRESETS,
  type Estande, type Cota, type Patrocinador,
} from '@/lib/expositores'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkEstande(p: Partial<Estande>): Estande {
  return {
    id: p.id || 'e1', evento_id: p.evento_id ?? 'ev1', codigo: p.codigo ?? 'A1',
    tipo: p.tipo ?? 'standard', area_m2: p.area_m2 ?? 9, preco_num: p.preco_num ?? null,
    status: p.status ?? 'disponivel', expositor_id: p.expositor_id ?? null,
    posicao: p.posicao ?? null, cor: p.cor ?? null, ...p,
  }
}
function mkCota(p: Partial<Cota>): Cota {
  return {
    id: p.id || 'c1', evento_id: p.evento_id ?? 'ev1', nome: p.nome ?? 'Ouro',
    preco_num: p.preco_num ?? 10000, quantidade: p.quantidade ?? 2, cor: p.cor ?? null,
    ordem: p.ordem ?? 0, entregaveis: p.entregaveis ?? [], ...p,
  }
}
function mkPatro(p: Partial<Patrocinador>): Patrocinador {
  return {
    id: p.id || 'p1', evento_id: p.evento_id ?? 'ev1', cota_id: p.cota_id ?? 'c1',
    marca: p.marca ?? 'Marca', contato: p.contato ?? null, email: p.email ?? null,
    telefone: p.telefone ?? null, contrato_id: p.contrato_id ?? null, lancamento_id: p.lancamento_id ?? null,
    valor_num: p.valor_num ?? null, status: p.status ?? 'prospecto', entregaveis_status: p.entregaveis_status ?? {}, ...p,
  }
}

// ── Estandes: preço ───────────────────────────────────────────────────────────
describe('precoEstande', () => {
  it('usa preco_num fechado quando > 0', () => {
    expect(precoEstande({ preco_num: 5000, area_m2: 9 }, 800)).toBe(5000)
  })
  it('cai para area × precoM2 quando não há preço fechado', () => {
    expect(precoEstande({ preco_num: null, area_m2: 9 }, 800)).toBe(7200)
    expect(precoEstande({ preco_num: 0, area_m2: 12 }, 500)).toBe(6000)
  })
  it('zero quando não há base de cálculo', () => {
    expect(precoEstande({ preco_num: null, area_m2: null }, 0)).toBe(0)
  })
})

describe('estandeOcupado', () => {
  it('vendido e reservado ocupam; disponível/bloqueado não', () => {
    expect(estandeOcupado({ status: 'vendido' })).toBe(true)
    expect(estandeOcupado({ status: 'reservado' })).toBe(true)
    expect(estandeOcupado({ status: 'disponivel' })).toBe(false)
    expect(estandeOcupado({ status: 'bloqueado' })).toBe(false)
  })
})

// ── Resumo do mapa: contagem, área, % e receita ──────────────────────────────
describe('resumoMapa', () => {
  const estandes = [
    mkEstande({ id: '1', status: 'vendido', area_m2: 10, preco_num: 5000 }),
    mkEstande({ id: '2', status: 'vendido', area_m2: 10, preco_num: 5000 }),
    mkEstande({ id: '3', status: 'reservado', area_m2: 10, preco_num: 5000 }),
    mkEstande({ id: '4', status: 'disponivel', area_m2: 10, preco_num: 5000 }),
    mkEstande({ id: '5', status: 'bloqueado', area_m2: 10, preco_num: 5000 }),
  ]
  const r = resumoMapa(estandes)

  it('conta por status', () => {
    expect(r.total).toBe(5)
    expect(r.vendidos).toBe(2)
    expect(r.reservados).toBe(1)
    expect(r.disponiveis).toBe(1)
    expect(r.bloqueados).toBe(1)
  })
  it('% vendido EXCLUI bloqueados do denominador (comercializáveis = 4)', () => {
    expect(r.pctVendidoContagem).toBeCloseTo(2 / 4) // 0.5
    expect(r.pctVendidoArea).toBeCloseTo(20 / 40)   // 20 vendida de 40 comercializável
  })
  it('separa receita realizada, reservada e disponível', () => {
    expect(r.receitaVendida).toBe(10000)
    expect(r.receitaReservada).toBe(5000)
    expect(r.receitaDisponivel).toBe(5000)
  })
  it('área total inclui bloqueados; área vendida só os vendidos', () => {
    expect(r.areaTotal).toBe(50)
    expect(r.areaVendida).toBe(20)
  })
  it('mapa vazio não divide por zero', () => {
    const z = resumoMapa([])
    expect(z.pctVendidoContagem).toBe(0)
    expect(z.pctVendidoArea).toBe(0)
  })
  it('usa precoM2 quando o estande não tem preço fechado', () => {
    const semPreco = [mkEstande({ status: 'vendido', area_m2: 9, preco_num: null })]
    expect(resumoMapa(semPreco, 1000).receitaVendida).toBe(9000)
  })
})

// ── Transições do estande ─────────────────────────────────────────────────────
describe('podeTransicionarEstande', () => {
  it('disponível → vendido/reservado/bloqueado', () => {
    expect(podeTransicionarEstande('disponivel', 'vendido')).toBe(true)
    expect(podeTransicionarEstande('disponivel', 'reservado')).toBe(true)
    expect(podeTransicionarEstande('disponivel', 'bloqueado')).toBe(true)
  })
  it('bloqueado só volta para disponível', () => {
    expect(podeTransicionarEstande('bloqueado', 'disponivel')).toBe(true)
    expect(podeTransicionarEstande('bloqueado', 'vendido')).toBe(false)
  })
  it('mesmo status é sempre permitido (idempotente)', () => {
    expect(podeTransicionarEstande('vendido', 'vendido')).toBe(true)
  })
  it('exigeExpositor só p/ vendido e reservado', () => {
    expect(exigeExpositor('vendido')).toBe(true)
    expect(exigeExpositor('reservado')).toBe(true)
    expect(exigeExpositor('disponivel')).toBe(false)
    expect(exigeExpositor('bloqueado')).toBe(false)
  })
})

// ── Mapa: posição, bounds e auto-layout ──────────────────────────────────────
describe('mapa — posição e layout', () => {
  it('normalizarPosicao aplica defaults seguros (w/h ≥ 1, x/y ≥ 0)', () => {
    expect(normalizarPosicao(null)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(normalizarPosicao({ x: 3, y: 2 })).toEqual({ x: 3, y: 2, w: 1, h: 1 })
    expect(normalizarPosicao({ x: -1, y: -5, w: 0, h: 2 })).toEqual({ x: 0, y: 0, w: 1, h: 2 })
  })
  it('boundsDosEstandes cobre o estande mais distante, respeitando mínimos', () => {
    const es = [mkEstande({ posicao: { x: 9, y: 4, w: 2, h: 1 } })]
    expect(boundsDosEstandes(es, 8, 6)).toEqual({ cols: 11, rows: 6 })
  })
  it('autoLayout posiciona só os sem posição, sem colidir com os fixos', () => {
    const es = [
      mkEstande({ id: 'fix', posicao: { x: 0, y: 0, w: 1, h: 1 } }),
      mkEstande({ id: 'a', posicao: null }),
      mkEstande({ id: 'b', posicao: null }),
    ]
    const layout = autoLayout(es, 2)
    expect(layout.map((l) => l.id)).toEqual(['a', 'b'])
    // (0,0) está ocupado pelo fixo → 'a' vai p/ (1,0), 'b' p/ (0,1)
    expect(layout[0].posicao).toEqual({ x: 1, y: 0, w: 1, h: 1 })
    expect(layout[1].posicao).toEqual({ x: 0, y: 1, w: 1, h: 1 })
  })
})

// ── Patrocínio: cotas e pipeline ──────────────────────────────────────────────
describe('resumoCota', () => {
  it('conta só confirmados/faturados como vendidos; calcula vagas e esgotamento', () => {
    const cota = mkCota({ id: 'c1', quantidade: 2, preco_num: 10000 })
    const patros = [
      mkPatro({ id: 'p1', cota_id: 'c1', status: 'confirmado' }),
      mkPatro({ id: 'p2', cota_id: 'c1', status: 'proposta' }),   // não conta
      mkPatro({ id: 'p3', cota_id: 'c1', status: 'faturado' }),
    ]
    const r = resumoCota(cota, patros)
    expect(r.vendidas).toBe(2)
    expect(r.disponiveis).toBe(0)
    expect(r.esgotada).toBe(true)
    expect(r.receita).toBe(20000)
  })
  it('cota ilimitada (quantidade null) nunca esgota', () => {
    const cota = mkCota({ quantidade: null })
    const r = resumoCota(cota, [mkPatro({ status: 'confirmado' })])
    expect(r.disponiveis).toBeNull()
    expect(r.esgotada).toBe(false)
    expect(cotaTemVaga(cota, [])).toBe(true)
  })
  it('usa valor_num do patrocinador quando informado, senão o preço da cota', () => {
    const cota = mkCota({ preco_num: 10000 })
    const r = resumoCota(cota, [mkPatro({ status: 'confirmado', valor_num: 12500 })])
    expect(r.receita).toBe(12500)
  })
})

describe('resumoPatrocinio', () => {
  it('agrega vagas, vendas, receita realizada/pipeline/potencial', () => {
    const cotas = [
      mkCota({ id: 'master', nome: 'Master', preco_num: 50000, quantidade: 1 }),
      mkCota({ id: 'ouro', nome: 'Ouro', preco_num: 20000, quantidade: 3 }),
    ]
    const patros = [
      mkPatro({ id: 'a', cota_id: 'master', status: 'confirmado' }), // realizado 50k, esgota master
      mkPatro({ id: 'b', cota_id: 'ouro', status: 'faturado' }),     // realizado 20k
      mkPatro({ id: 'c', cota_id: 'ouro', status: 'proposta' }),     // pipeline 20k
    ]
    const r = resumoPatrocinio(cotas, patros)
    expect(r.cotas).toBe(2)
    expect(r.vagasTotais).toBe(4)
    expect(r.vendidas).toBe(2)
    expect(r.receitaRealizada).toBe(70000)
    expect(r.receitaPipeline).toBe(20000)
    // master esgotada (0 vagas), ouro 2 vagas abertas × 20k = 40k
    expect(r.receitaPotencialMapa).toBe(40000)
  })
  it('vagasTotais vira null se alguma cota é ilimitada', () => {
    const r = resumoPatrocinio([mkCota({ quantidade: null })], [])
    expect(r.vagasTotais).toBeNull()
  })
})

describe('patrocinadoresVendidos / receitaPatrocinador', () => {
  it('filtra confirmados e faturados', () => {
    const lista = [
      mkPatro({ id: '1', status: 'confirmado' }),
      mkPatro({ id: '2', status: 'cancelado' }),
      mkPatro({ id: '3', status: 'faturado' }),
    ]
    expect(patrocinadoresVendidos(lista).map((p) => p.id)).toEqual(['1', '3'])
  })
  it('receitaPatrocinador cai para o preço da cota sem valor próprio', () => {
    const cotas = [mkCota({ id: 'c1', preco_num: 8000 })]
    expect(receitaPatrocinador(mkPatro({ cota_id: 'c1', valor_num: null }), cotas)).toBe(8000)
    expect(receitaPatrocinador(mkPatro({ cota_id: 'c1', valor_num: 9000 }), cotas)).toBe(9000)
  })
})

// ── Entregáveis (checklist) ───────────────────────────────────────────────────
describe('progressoEntregaveis', () => {
  const cota = mkCota({
    entregaveis: [
      { chave: 'logo', nome: 'Logo no palco' },
      { chave: 'posts', nome: 'Posts', qtd: 4 },
      { chave: 'estande', nome: 'Estande' },
    ],
  })
  it('conta entregues e lista pendentes', () => {
    const p = mkPatro({ entregaveis_status: { logo: { entregue: true }, posts: { entregue: false } } })
    const r = progressoEntregaveis(cota, p)
    expect(r.total).toBe(3)
    expect(r.entregues).toBe(1)
    expect(r.pct).toBeCloseTo(1 / 3)
    expect(r.pendentes.map((e) => e.chave)).toEqual(['posts', 'estande'])
  })
  it('cota sem entregáveis → total 0, pct 0 (sem divisão por zero)', () => {
    const r = progressoEntregaveis(mkCota({ entregaveis: [] }), mkPatro({}))
    expect(r).toMatchObject({ total: 0, entregues: 0, pct: 0 })
  })
  it('cota ausente é tolerada', () => {
    expect(progressoEntregaveis(null, mkPatro({})).total).toBe(0)
  })
})

describe('marcarEntregavel', () => {
  it('cria a entrada e preserva as demais (imutável)', () => {
    const base = { logo: { entregue: true } }
    const next = marcarEntregavel(base, 'posts', { entregue: true, data: '2026-06-01' })
    expect(next).toEqual({ logo: { entregue: true }, posts: { entregue: true, data: '2026-06-01' } })
    expect(base).toEqual({ logo: { entregue: true } }) // não mutou
  })
  it('faz merge no item existente', () => {
    const next = marcarEntregavel({ posts: { entregue: false } }, 'posts', { obs: 'agendado' })
    expect(next.posts).toEqual({ entregue: false, obs: 'agendado' })
  })
})

// ── Receita consolidada do evento + metas ────────────────────────────────────
describe('receitaEvento', () => {
  it('soma estandes + patrocínio em realizado/forecast/potencial', () => {
    const estandes = [
      mkEstande({ status: 'vendido', preco_num: 5000 }),
      mkEstande({ status: 'reservado', preco_num: 5000 }),
      mkEstande({ status: 'disponivel', preco_num: 5000 }),
    ]
    const cotas = [mkCota({ id: 'c1', preco_num: 10000, quantidade: 2 })]
    const patros = [
      mkPatro({ cota_id: 'c1', status: 'confirmado' }), // realizado 10k
      mkPatro({ cota_id: 'c1', status: 'proposta' }),   // pipeline 10k
    ]
    const r = receitaEvento(estandes, cotas, patros)
    expect(r.realizado).toBe(15000)          // 5k estande + 10k patrocínio
    expect(r.forecast).toBe(30000)           // + 5k reservado + 10k pipeline
    // potencial: 5k+5k+5k estandes + 10k realizado + 10k pipeline + (cota cheia → 0 vagas) 0
    expect(r.potencialTotal).toBe(35000)
  })
})

describe('progressoMeta', () => {
  it('fração clampada [0,1]', () => {
    expect(progressoMeta(50, 100)).toBe(0.5)
    expect(progressoMeta(150, 100)).toBe(1)
    expect(progressoMeta(50, 0)).toBe(0)
    expect(progressoMeta(50, null)).toBe(0)
  })
})

// ── Metadados / catálogos ─────────────────────────────────────────────────────
describe('metadados', () => {
  it('estandeStatusMeta traz label + chip + hex; desconhecido degrada', () => {
    expect(estandeStatusMeta('vendido').label).toBe('Vendido')
    expect(estandeStatusMeta('vendido').hex).toMatch(/^#/)
    expect(estandeStatusMeta('xpto').label).toBe('xpto')
  })
  it('expositorStatusMeta cobre o funil', () => {
    expect(expositorStatusMeta('confirmado').label).toBe('Confirmado')
  })
  it('estandeTipoLabel mapeia conhecidos e ecoa desconhecidos', () => {
    expect(estandeTipoLabel('ilha')).toBe('Ilha')
    expect(estandeTipoLabel('zzz')).toBe('zzz')
  })
  it('COTA_PRESETS tem nomes e entregáveis padrão', () => {
    expect(COTA_PRESETS.map((c) => c.nome)).toContain('Master')
    expect(COTA_PRESETS[0].entregaveis.length).toBeGreaterThan(0)
  })
})
