import { describe, it, expect } from 'vitest'
import {
  diasAte, duracaoDias, diasSobrepostos,
  statusVigencia, situacao, estaVigente,
  coberturaTotal, rateioPremioEvento, sinistralidade,
  resumoCarteira, janelasVencimento, aVencer,
  resumoSinistros,
  exigenciasPorTipoEvento, checarExigenciasEvento,
  normalizarCoberturas, normalizarAnexos, isMissingTable,
  ESCOPO_BY, SITUACAO_META, SINISTRO_STATUS_BY,
  type SeguroLike, type SinistroLike, type Cobertura,
} from '@/lib/seguros'

const HOJE = '2026-06-09'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkSeguro(p: Partial<SeguroLike> = {}): SeguroLike {
  return {
    escopo: p.escopo ?? 'patrimonial',
    status: p.status ?? 'ativa',
    premio_num: p.premio_num ?? 1200,
    vigencia_inicio: p.vigencia_inicio ?? '2026-01-01',
    vigencia_fim: p.vigencia_fim ?? '2026-12-31',
    coberturas: p.coberturas,
    evento_id: p.evento_id ?? null,
  }
}
function mkSinistro(p: Partial<SinistroLike> = {}): SinistroLike {
  return {
    status: p.status ?? 'aberto',
    valor_estimado_num: p.valor_estimado_num ?? 0,
    valor_indenizado_num: p.valor_indenizado_num ?? 0,
  }
}
const cob = (item: string, limite: number, franquia: number | null = null): Cobertura => ({ item, limite_num: limite, franquia_num: franquia })

// ── Datas ───────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('diasAte conta dias (positivo futuro, negativo passado)', () => {
    expect(diasAte('2026-06-09', HOJE)).toBe(0)
    expect(diasAte('2026-06-10', HOJE)).toBe(1)
    expect(diasAte('2026-06-08', HOJE)).toBe(-1)
    expect(diasAte('2026-07-09', HOJE)).toBe(30)
    expect(diasAte(null, HOJE)).toBeNull()
    expect(diasAte('lixo', HOJE)).toBeNull()
  })
  it('diasAte é agnóstico de fuso (sem off-by-one)', () => {
    // Timestamps completos devem cair no mesmo dia.
    expect(diasAte('2026-06-10T23:00:00', HOJE)).toBe(1)
  })
  it('duracaoDias é inclusiva', () => {
    expect(duracaoDias('2026-01-01', '2026-12-31')).toBe(365)
    expect(duracaoDias('2026-06-09', '2026-06-09')).toBe(1)
    expect(duracaoDias('2026-06-09', '2026-06-08')).toBeNull() // fim antes do início
    expect(duracaoDias('2026-06-09', null)).toBeNull()
  })
  it('diasSobrepostos calcula interseção inclusiva', () => {
    expect(diasSobrepostos('2026-01-01', '2026-12-31', '2026-06-01', '2026-06-03')).toBe(3)
    expect(diasSobrepostos('2026-01-01', '2026-03-31', '2026-06-01', '2026-06-03')).toBe(0) // sem overlap
    expect(diasSobrepostos('2026-06-01', '2026-06-10', '2026-06-05', '2026-06-20')).toBe(6) // 05..10
  })
})

// ── Vigência / situação ───────────────────────────────────────────────────────
describe('vigência e situação', () => {
  it('statusVigencia classifica futura/vigente/a_vencer/vencida', () => {
    expect(statusVigencia('2026-07-01', '2026-08-01', HOJE)).toBe('futura')
    expect(statusVigencia('2026-01-01', '2026-12-31', HOJE)).toBe('vigente')
    expect(statusVigencia('2026-01-01', '2026-06-20', HOJE)).toBe('a_vencer') // 11 dias ≤ 30
    expect(statusVigencia('2025-01-01', '2026-06-08', HOJE)).toBe('vencida')
    expect(statusVigencia(null, null, HOJE)).toBe('sem_vigencia')
  })
  it('statusVigencia respeita o diasAviso customizado', () => {
    expect(statusVigencia('2026-01-01', '2026-08-01', HOJE, 90)).toBe('a_vencer') // 53 dias ≤ 90
    expect(statusVigencia('2026-01-01', '2026-08-01', HOJE, 30)).toBe('vigente')
  })
  it('situacao combina status administrativo com a vigência', () => {
    expect(situacao({ status: 'cancelada', vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31' }, HOJE)).toBe('cancelada')
    expect(situacao({ status: 'em_cotacao', vigencia_inicio: null, vigencia_fim: null }, HOJE)).toBe('em_cotacao')
    expect(situacao({ status: 'ativa', vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31' }, HOJE)).toBe('vigente')
    expect(situacao({ status: 'renovada', vigencia_inicio: '2025-01-01', vigencia_fim: '2026-06-08' }, HOJE)).toBe('vencida')
  })
  it('estaVigente é true só para vigente/a_vencer', () => {
    expect(estaVigente(mkSeguro({ vigencia_fim: '2026-12-31' }), HOJE)).toBe(true)
    expect(estaVigente(mkSeguro({ vigencia_fim: '2026-06-20' }), HOJE)).toBe(true) // a vencer
    expect(estaVigente(mkSeguro({ vigencia_fim: '2026-06-01' }), HOJE)).toBe(false) // vencida
    expect(estaVigente(mkSeguro({ status: 'cancelada' }), HOJE)).toBe(false)
  })
})

// ── Prêmio / cobertura / sinistralidade ───────────────────────────────────────
describe('prêmio, cobertura, sinistralidade', () => {
  it('coberturaTotal soma os limites', () => {
    expect(coberturaTotal([cob('Incêndio', 500000), cob('RC', 200000, 1000)])).toBe(700000)
    expect(coberturaTotal([])).toBe(0)
    expect(coberturaTotal(null)).toBe(0)
  })
  it('rateioPremioEvento devolve prêmio integral para escopo de evento', () => {
    const s = mkSeguro({ escopo: 'evento', premio_num: 800, vigencia_inicio: '2026-06-20', vigencia_fim: '2026-06-22' })
    expect(rateioPremioEvento(s, '2026-06-20', '2026-06-22')).toBe(800)
    const ac = mkSeguro({ escopo: 'acidentes', premio_num: 500 })
    expect(rateioPremioEvento(ac, '2026-06-20', '2026-06-22')).toBe(500)
  })
  it('rateioPremioEvento faz pro-rata diário para apólice anual', () => {
    const s = mkSeguro({ escopo: 'patrimonial', premio_num: 3650, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31' })
    // 365 dias de vigência, prêmio 3650 → 10/dia. Evento de 3 dias = 30.
    expect(rateioPremioEvento(s, '2026-06-20', '2026-06-22')).toBe(30)
  })
  it('rateioPremioEvento = 0 sem sobreposição; null se vigência sem fim', () => {
    const s = mkSeguro({ escopo: 'patrimonial', premio_num: 3650, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-03-31' })
    expect(rateioPremioEvento(s, '2026-06-20', '2026-06-22')).toBe(0)
    // Objeto literal: o factory usa ?? e trocaria null pelo default.
    const semFim: SeguroLike = { escopo: 'patrimonial', status: 'ativa', premio_num: 1200, vigencia_inicio: '2026-01-01', vigencia_fim: null, evento_id: null }
    expect(rateioPremioEvento(semFim, '2026-06-20', '2026-06-22')).toBeNull()
  })
  it('sinistralidade é indenizado ÷ prêmio (null sem prêmio)', () => {
    expect(sinistralidade(1000, 250)).toBe(0.25)
    expect(sinistralidade(0, 100)).toBeNull()
  })
})

// ── Carteira ──────────────────────────────────────────────────────────────────
describe('resumoCarteira', () => {
  const seguros = [
    mkSeguro({ escopo: 'patrimonial', premio_num: 1200, vigencia_fim: '2026-12-31', coberturas: [cob('Incêndio', 500000)] }),
    mkSeguro({ escopo: 'rc', premio_num: 800, vigencia_fim: '2026-06-20', coberturas: [cob('RC', 300000)] }), // a vencer
    mkSeguro({ escopo: 'evento', premio_num: 400, vigencia_inicio: '2025-01-01', vigencia_fim: '2026-06-01' }), // vencida
    mkSeguro({ escopo: 'frota', premio_num: 999, status: 'cancelada' }),
    mkSeguro({ escopo: 'equipamento', premio_num: 600, status: 'em_cotacao', vigencia_inicio: null, vigencia_fim: null }),
  ]
  const r = resumoCarteira(seguros, HOJE)
  it('conta situações corretamente', () => {
    expect(r.total).toBe(5)
    expect(r.vigentes).toBe(2)    // patrimonial + rc(a vencer conta como vigente)
    expect(r.aVencer).toBe(1)     // rc
    expect(r.vencidas).toBe(1)    // evento
    expect(r.canceladas).toBe(1)
    expect(r.emCotacao).toBe(1)
  })
  it('soma prêmio e cobertura só das ativas no risco', () => {
    expect(r.premioVigente).toBe(2000)          // 1200 + 800
    expect(r.coberturaVigente).toBe(800000)     // 500000 + 300000
  })
  it('agrupa por escopo ordenado por prêmio desc', () => {
    expect(r.porEscopo[0].escopo).toBe('patrimonial') // 1200 é o maior prêmio ativo
    const evento = r.porEscopo.find((e) => e.escopo === 'evento')!
    expect(evento.quantidade).toBe(1)
    expect(evento.premio).toBe(0) // vencida não soma prêmio
  })
})

describe('janelas de vencimento e a vencer', () => {
  const seguros = [
    mkSeguro({ vigencia_fim: '2026-06-01' }),  // vencida
    mkSeguro({ vigencia_fim: '2026-06-20' }),  // 11 dias
    mkSeguro({ vigencia_fim: '2026-07-20' }),  // 41 dias
    mkSeguro({ vigencia_fim: '2026-08-20' }),  // 72 dias
    mkSeguro({ vigencia_fim: '2026-12-31' }),  // >90
    mkSeguro({ vigencia_fim: '2026-06-15', status: 'cancelada' }), // ignorada
  ]
  it('janelasVencimento é cumulativo e ignora canceladas', () => {
    const j = janelasVencimento(seguros, HOJE)
    expect(j.vencidas).toBe(1)
    expect(j.ate30).toBe(1)   // 11d
    expect(j.ate60).toBe(2)   // 11d + 41d
    expect(j.ate90).toBe(3)   // 11d + 41d + 72d
  })
  it('aVencer filtra dentro da janela e ordena por data de fim', () => {
    const lista = aVencer(seguros, HOJE, 90)
    expect(lista.map((s) => s.vigencia_fim)).toEqual(['2026-06-01', '2026-06-20', '2026-07-20', '2026-08-20'])
  })
})

// ── Sinistros ──────────────────────────────────────────────────────────────────
describe('resumoSinistros', () => {
  it('conta abertos/pagos e soma valores', () => {
    const r = resumoSinistros([
      mkSinistro({ status: 'aberto', valor_estimado_num: 1000 }),
      mkSinistro({ status: 'em_analise', valor_estimado_num: 500, valor_indenizado_num: 0 }),
      mkSinistro({ status: 'pago', valor_estimado_num: 800, valor_indenizado_num: 700 }),
      mkSinistro({ status: 'negado' }),
    ])
    expect(r.total).toBe(4)
    expect(r.abertos).toBe(2)  // aberto + em_analise
    expect(r.pagos).toBe(1)
    expect(r.estimado).toBe(2300)
    expect(r.indenizado).toBe(700)
  })
})

// ── Exigências por tipo de evento ───────────────────────────────────────────────
describe('exigências de seguro por tipo de evento', () => {
  it('alto risco exige RC + acidentes', () => {
    for (const tipo of ['Automobilismo', 'Corrida de Rua', 'Prova Equestre', 'Air Show']) {
      const ex = exigenciasPorTipoEvento(tipo)
      expect(ex.map((e) => e.escopo).sort()).toEqual(['acidentes', 'evento'])
      expect(ex.every((e) => e.obrigatorio)).toBe(true)
    }
  })
  it('público em massa exige RC de evento (com acento)', () => {
    const ex = exigenciasPorTipoEvento('Exposição de Carros')
    expect(ex).toHaveLength(1)
    expect(ex[0].escopo).toBe('evento')
    expect(ex[0].obrigatorio).toBe(true)
  })
  it('evento social recomenda RC; vazio cai no recomendado', () => {
    expect(exigenciasPorTipoEvento('Casamento')[0].obrigatorio).toBe(false)
    expect(exigenciasPorTipoEvento(null)[0].obrigatorio).toBe(false)
    expect(exigenciasPorTipoEvento('')[0].escopo).toBe('evento')
  })
  it('checarExigenciasEvento marca cobertura por apólice vigente (rc cobre evento)', () => {
    const segurosDoEvento = [
      { ...mkSeguro({ escopo: 'rc', vigencia_fim: '2026-12-31' }), id: 'apolice-1' },
      { ...mkSeguro({ escopo: 'acidentes', vigencia_fim: '2026-06-01' }), id: 'apolice-2' }, // vencida
    ]
    const r = checarExigenciasEvento('Corrida de Rua', segurosDoEvento, HOJE)
    const rc = r.find((x) => x.exigencia.escopo === 'evento')!
    const ac = r.find((x) => x.exigencia.escopo === 'acidentes')!
    expect(rc.cobertaPor).toBe('apolice-1') // RC geral cobre RC de evento
    expect(rc.vigente).toBe(true)
    expect(ac.cobertaPor).toBe('apolice-2')
    expect(ac.vigente).toBe(false) // apólice vencida
  })
  it('checarExigenciasEvento reporta exigência descoberta', () => {
    const r = checarExigenciasEvento('Show', [], HOJE)
    expect(r[0].cobertaPor).toBeNull()
    expect(r[0].vigente).toBe(false)
  })
})

// ── Normalizadores e utilidades ─────────────────────────────────────────────────
describe('normalizadores e utilidades', () => {
  it('normalizarCoberturas coage números e descarta vazias', () => {
    const r = normalizarCoberturas([
      { item: 'Incêndio', limite_num: '500000', franquia_num: '1000' },
      { item: '', limite_num: 0 },               // descartada
      { item: 'RC', limite_num: 200000 },
      'lixo',
    ])
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ item: 'Incêndio', limite_num: 500000, franquia_num: 1000 })
    expect(r[1].franquia_num).toBeNull()
  })
  it('normalizarAnexos exige url e coage tamanho', () => {
    const r = normalizarAnexos([{ url: 'a/b.pdf', nome: 'apólice', tamanho: '2048' }, { nome: 'sem url' }])
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ url: 'a/b.pdf', nome: 'apólice', tipo: null, tamanho: 2048 })
  })
  it('isMissingTable detecta PGRST205 e 42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST116' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
  it('catálogos expõem metadados consistentes', () => {
    expect(ESCOPO_BY.patrimonial.label).toBe('Patrimonial')
    expect(SITUACAO_META.a_vencer.label).toBe('A vencer')
    expect(SINISTRO_STATUS_BY.pago.aberto).toBe(false)
  })
})
