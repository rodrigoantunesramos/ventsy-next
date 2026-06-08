import { describe, it, expect } from 'vitest'
import {
  parseTempo, overlap, addDaysYmd, ymd,
  janelaRange, cronogramaFisico,
  chegadaRange, normalizeDoca, chegadaOcupaDoca, detectarChoqueDocas, chegadasEmChoque,
  docaLivre, proximaDocaLivre, ordenarChegadas, agruparPorDoca,
  progressoRecebimento, progressoChecklist,
  viagemRange, viagemAtiva, conflitosViagem, viagensEmConflito, veiculoOcupadoEm, veiculosDisponiveis,
  credencialVeiculo, contarPorStatus, janelasProximas,
  janelaTipoMeta, chegadaStatusMeta, frotaStatusMeta, viagemStatusMeta,
  HORA, DIA, MINUTO, DEFAULT_DESCARGA_MIN,
  type Janela, type Chegada, type Veiculo, type Viagem,
} from '@/lib/logistica'

// ── Helpers: entidades mínimas com defaults inócuos ──────────────────────────
function mkJanela(p: Partial<Janela>): Janela {
  return {
    id: p.id || 'j1', evento_id: p.evento_id ?? null, propriedade_id: p.propriedade_id ?? 1,
    espaco_id: p.espaco_id ?? null, reserva_id: p.reserva_id ?? null, tipo: p.tipo ?? 'montagem',
    titulo: p.titulo ?? null, inicio: p.inicio ?? null, fim: p.fim ?? null, obs: p.obs ?? null, ...p,
  }
}
function mkChegada(p: Partial<Chegada>): Chegada {
  return {
    id: p.id || 'c1', evento_id: p.evento_id ?? null, fornecedor_id: p.fornecedor_id ?? null,
    item: p.item ?? 'Estrutura', previsto: p.previsto ?? null, duracao_min: p.duracao_min ?? DEFAULT_DESCARGA_MIN,
    doca: p.doca ?? null, veiculo: p.veiculo ?? null, placa: p.placa ?? null, responsavel: p.responsavel ?? null,
    contato: p.contato ?? null, status: p.status ?? 'agendado', checklist: p.checklist ?? [], obs: p.obs ?? null, ...p,
  }
}
function mkVeiculo(p: Partial<Veiculo>): Veiculo {
  return {
    id: p.id || 'v1', tipo: p.tipo ?? 'caminhao', nome: p.nome ?? 'Caminhão 1', placa: p.placa ?? null,
    capacidade: p.capacidade ?? null, capacidade_unidade: p.capacidade_unidade ?? 'kg',
    motorista: p.motorista ?? null, motorista_contato: p.motorista_contato ?? null,
    status: p.status ?? 'disponivel', obs: p.obs ?? null, ...p,
  }
}
function mkViagem(p: Partial<Viagem>): Viagem {
  return {
    id: p.id || 't1', frota_id: p.frota_id ?? 'v1', evento_id: p.evento_id ?? null, origem: p.origem ?? null,
    destino: p.destino ?? null, partida: p.partida ?? null, retorno: p.retorno ?? null, carga: p.carga ?? null,
    status: p.status ?? 'planejada', obs: p.obs ?? null, ...p,
  }
}

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0) // referência fixa (determinístico)
const iso = (ms: number) => new Date(ms).toISOString()

// ── Tempo / utilidades ───────────────────────────────────────────────────────
describe('tempo', () => {
  it('parseTempo aceita ISO e YYYY-MM-DD', () => {
    expect(parseTempo(iso(T0))).toBe(T0)
    expect(parseTempo(null)).toBeNull()
    expect(parseTempo('lixo')).toBeNull()
    expect(parseTempo('2026-06-10')).toBe(new Date(2026, 5, 10).getTime())
  })
  it('overlap ignora faixas adjacentes e respeita buffer', () => {
    expect(overlap(0, 10, 5, 15)).toBe(true)
    expect(overlap(0, 10, 10, 20)).toBe(false)         // encostam
    expect(overlap(0, 10, 12, 20, 0)).toBe(false)
    expect(overlap(0, 10, 12, 20, 3 * 1)).toBe(true)   // buffer aproxima
  })
  it('addDaysYmd e ymd', () => {
    expect(addDaysYmd('2026-06-10', 5)).toBe('2026-06-15')
    expect(addDaysYmd('2026-06-30', 1)).toBe('2026-07-01')
    expect(ymd(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

// ── Cronograma físico ──────────────────────────────────────────────────────────
describe('cronogramaFisico (montagem → evento → desmontagem)', () => {
  const evento = { inicio: iso(T0 + 2 * DIA), fim: iso(T0 + 2 * DIA + 6 * HORA) }
  const janelas = [
    mkJanela({ id: 'm', tipo: 'montagem', inicio: iso(T0), fim: iso(T0 + 8 * HORA) }),
    mkJanela({ id: 'd', tipo: 'desmontagem', inicio: iso(T0 + 3 * DIA), fim: iso(T0 + 3 * DIA + 4 * HORA) }),
  ]

  it('ordena as fases por início e insere a fase do evento', () => {
    const c = cronogramaFisico(evento, janelas)
    expect(c.fases.map((f) => f.tipo)).toEqual(['montagem', 'evento', 'desmontagem'])
    expect(c.fases[1].janelaId).toBeNull()      // a fase do evento não é janela
    expect(c.fases[0].janelaId).toBe('m')
  })
  it('span cobre da primeira montagem à última desmontagem', () => {
    const c = cronogramaFisico(evento, janelas)
    expect(c.inicio).toBe(T0)
    expect(c.fim).toBe(T0 + 3 * DIA + 4 * HORA)
    expect(c.duracaoTotalMin).toBe(Math.round((c.fim! - c.inicio!) / MINUTO))
  })
  it('funciona sem evento (só janelas) e sem janelas (só evento)', () => {
    expect(cronogramaFisico(null, janelas).fases).toHaveLength(2)
    const soEvento = cronogramaFisico(evento, [])
    expect(soEvento.fases).toHaveLength(1)
    expect(soEvento.fases[0].tipo).toBe('evento')
  })
  it('vazio quando não há nada datável', () => {
    const c = cronogramaFisico(null, [mkJanela({ inicio: null })])
    expect(c.fases).toHaveLength(0)
    expect(c.inicio).toBeNull()
  })
  it('janelaRange: sem fim assume +1h', () => {
    expect(janelaRange(mkJanela({ inicio: iso(T0) }))).toEqual({ start: T0, end: T0 + HORA })
    expect(janelaRange(mkJanela({ inicio: null }))).toBeNull()
  })
})

// ── Choque de docas ────────────────────────────────────────────────────────────
describe('detectarChoqueDocas (carga/descarga)', () => {
  it('detecta duas chegadas na mesma doca em horários sobrepostos', () => {
    const ch = [
      mkChegada({ id: 'a', doca: 'Doca 1', previsto: iso(T0), duracao_min: 60 }),
      mkChegada({ id: 'b', doca: 'doca 1', previsto: iso(T0 + 30 * MINUTO), duracao_min: 60 }), // case-insensitive
      mkChegada({ id: 'c', doca: 'Doca 2', previsto: iso(T0), duracao_min: 60 }),               // outra doca
    ]
    const choques = detectarChoqueDocas(ch)
    expect(choques).toHaveLength(1)
    expect(choques[0].doca).toBe('Doca 1')
    expect(chegadasEmChoque(ch)).toEqual(new Set(['a', 'b']))
  })
  it('faixas adjacentes na mesma doca não chocam', () => {
    const ch = [
      mkChegada({ id: 'a', doca: 'D1', previsto: iso(T0), duracao_min: 60 }),
      mkChegada({ id: 'b', doca: 'D1', previsto: iso(T0 + 60 * MINUTO), duracao_min: 60 }),
    ]
    expect(detectarChoqueDocas(ch)).toHaveLength(0)
  })
  it('ignora chegadas que já saíram, canceladas ou sem doca', () => {
    const ch = [
      mkChegada({ id: 'a', doca: 'D1', previsto: iso(T0), duracao_min: 60, status: 'saiu' }),
      mkChegada({ id: 'b', doca: 'D1', previsto: iso(T0), duracao_min: 60, status: 'cancelado' }),
      mkChegada({ id: 'c', doca: 'D1', previsto: iso(T0), duracao_min: 60 }),
      mkChegada({ id: 'd', doca: null, previsto: iso(T0), duracao_min: 60 }),
    ]
    expect(detectarChoqueDocas(ch)).toHaveLength(0)
  })
  it('chegadaOcupaDoca / normalizeDoca', () => {
    expect(chegadaOcupaDoca('agendado')).toBe(true)
    expect(chegadaOcupaDoca('saiu')).toBe(false)
    expect(normalizeDoca(' Doca A ')).toBe('doca a')
  })
  it('chegadaRange usa duração padrão quando ausente', () => {
    const r = chegadaRange(mkChegada({ previsto: iso(T0), duracao_min: 0 }))!
    expect(r.end - r.start).toBe(DEFAULT_DESCARGA_MIN * MINUTO)
  })
})

describe('docaLivre / proximaDocaLivre / ordenação', () => {
  const ch = [mkChegada({ id: 'a', doca: 'D1', previsto: iso(T0), duracao_min: 60 })]
  it('docaLivre detecta ocupação e respeita ignoreId', () => {
    expect(docaLivre(ch, 'D1', { start: T0 + 10 * MINUTO, end: T0 + 20 * MINUTO })).toBe(false)
    expect(docaLivre(ch, 'D1', { start: T0 + 2 * HORA, end: T0 + 3 * HORA })).toBe(true)
    expect(docaLivre(ch, 'D1', { start: T0, end: T0 + HORA }, 'a')).toBe(true) // ignora a própria
  })
  it('proximaDocaLivre sugere a primeira doca sem choque', () => {
    expect(proximaDocaLivre(ch, ['D1', 'D2'], { start: T0, end: T0 + HORA })).toBe('D2')
    expect(proximaDocaLivre(ch, ['D1'], { start: T0, end: T0 + HORA })).toBeNull()
  })
  it('ordenarChegadas: por previsto, sem-previsto e canceladas ao fim', () => {
    const lista = [
      mkChegada({ id: 'late', previsto: iso(T0 + HORA) }),
      mkChegada({ id: 'canc', previsto: iso(T0 - HORA), status: 'cancelado' }),
      mkChegada({ id: 'early', previsto: iso(T0) }),
      mkChegada({ id: 'none', previsto: null }),
    ]
    expect(ordenarChegadas(lista).map((c) => c.id)).toEqual(['early', 'late', 'none', 'canc'])
  })
  it('agruparPorDoca agrupa pelo rótulo cru', () => {
    const m = agruparPorDoca([mkChegada({ id: 'a', doca: 'D1' }), mkChegada({ id: 'b', doca: 'D1' }), mkChegada({ id: 'c', doca: null })])
    expect(m.get('D1')).toHaveLength(2)
    expect(m.get('')).toHaveLength(1)
  })
})

describe('progresso de recebimento', () => {
  it('conta recebidos / em andamento / pendentes e ignora cancelados', () => {
    const ch = [
      mkChegada({ id: 'a', status: 'agendado' }),
      mkChegada({ id: 'b', status: 'descarregando' }),
      mkChegada({ id: 'c', status: 'montado' }),
      mkChegada({ id: 'd', status: 'saiu' }),
      mkChegada({ id: 'e', status: 'cancelado' }),
    ]
    const p = progressoRecebimento(ch)
    expect(p).toMatchObject({ total: 4, recebidos: 2, emAndamento: 1, pendentes: 1 })
    expect(p.percent).toBeCloseTo(0.5)
  })
  it('progressoChecklist é fração de itens marcados', () => {
    expect(progressoChecklist([{ label: 'x', ok: true }, { label: 'y', ok: false }])).toBe(0.5)
    expect(progressoChecklist([])).toBe(0)
  })
})

// ── Frota ──────────────────────────────────────────────────────────────────────
describe('frota: conflito e disponibilidade', () => {
  it('viagemRange usa duração padrão sem retorno', () => {
    const r = viagemRange(mkViagem({ partida: iso(T0) }))!
    expect(r.end - r.start).toBe(120 * MINUTO)
  })
  it('conflitosViagem: mesmo veículo não pode estar em duas viagens', () => {
    const vs = [
      mkViagem({ id: 't1', frota_id: 'v1', partida: iso(T0), retorno: iso(T0 + 3 * HORA) }),
      mkViagem({ id: 't2', frota_id: 'v1', partida: iso(T0 + HORA), retorno: iso(T0 + 4 * HORA) }), // choca
      mkViagem({ id: 't3', frota_id: 'v2', partida: iso(T0), retorno: iso(T0 + 3 * HORA) }),          // outro veículo
      mkViagem({ id: 't4', frota_id: 'v1', partida: iso(T0 + 5 * HORA), retorno: iso(T0 + 6 * HORA), status: 'cancelada' }),
    ]
    expect(conflitosViagem(vs)).toHaveLength(1)
    expect(viagensEmConflito(vs)).toEqual(new Set(['t1', 't2']))
  })
  it('veiculoOcupadoEm reflete a viagem ativa', () => {
    const vs = [mkViagem({ frota_id: 'v1', partida: iso(T0), retorno: iso(T0 + 2 * HORA) })]
    expect(veiculoOcupadoEm(vs, 'v1', T0 + HORA)).toBe(true)
    expect(veiculoOcupadoEm(vs, 'v1', T0 + 3 * HORA)).toBe(false)
    expect(veiculoOcupadoEm(vs, 'v2', T0 + HORA)).toBe(false)
  })
  it('veiculosDisponiveis exclui manutenção/inativo e os ocupados no período', () => {
    const veiculos = [
      mkVeiculo({ id: 'v1' }),
      mkVeiculo({ id: 'v2', status: 'manutencao' }),
      mkVeiculo({ id: 'v3' }),
    ]
    const viagens = [mkViagem({ frota_id: 'v1', partida: iso(T0), retorno: iso(T0 + 4 * HORA) })]
    const livres = veiculosDisponiveis(veiculos, viagens, { start: T0 + HORA, end: T0 + 2 * HORA })
    expect(livres.map((v) => v.id)).toEqual(['v3']) // v1 ocupado, v2 em manutenção
  })
  it('viagemAtiva ignora apenas canceladas', () => {
    expect(viagemAtiva('planejada')).toBe(true)
    expect(viagemAtiva('concluida')).toBe(true)
    expect(viagemAtiva('cancelada')).toBe(false)
  })
})

// ── Credencial + agregações + metadados ──────────────────────────────────────
describe('credencial / agregações / metadados', () => {
  it('credencialVeiculo é estável e formatada', () => {
    const a = credencialVeiculo({ id: 'abc-123' })
    expect(a).toMatch(/^LOG-[0-9A-Z]{6}$/)
    expect(credencialVeiculo({ id: 'abc-123' })).toBe(a) // determinístico
    expect(credencialVeiculo({ id: 'outro-id' })).not.toBe(a)
  })
  it('contarPorStatus agrupa', () => {
    expect(contarPorStatus([{ status: 'x' }, { status: 'x' }, { status: 'y' }])).toEqual({ x: 2, y: 1 })
  })
  it('janelasProximas filtra a janela futura dentro do horizonte', () => {
    const js = [
      mkJanela({ id: 'ontem', inicio: iso(T0 - 2 * DIA), fim: iso(T0 - 2 * DIA + HORA) }),
      mkJanela({ id: 'amanha', inicio: iso(T0 + 1 * DIA), fim: iso(T0 + 1 * DIA + HORA) }),
      mkJanela({ id: 'mes', inicio: iso(T0 + 20 * DIA), fim: iso(T0 + 20 * DIA + HORA) }),
    ]
    expect(janelasProximas(js, 7, T0).map((j) => j.id)).toEqual(['amanha'])
  })
  it('metadados de status têm fallback', () => {
    expect(janelaTipoMeta('montagem').label).toBe('Montagem')
    expect(janelaTipoMeta('zzz').label).toBe('zzz')
    expect(chegadaStatusMeta('descarregando').label).toBe('Descarregando')
    expect(frotaStatusMeta('em_viagem').label).toBe('Em viagem')
    expect(viagemStatusMeta('em_curso').label).toBe('Em curso')
  })
})
