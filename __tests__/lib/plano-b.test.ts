import { describe, it, expect } from 'vitest'
import {
  addDiasYMD, diaDe, horaParaMin, previsaoDisponivel,
  resumoVazio, mesclarResumo, parseOpenMeteo, condicaoDe,
  RISCOS, riscoMeta, riscoLabel, metricaLabel, metricaUnidade, gatilhoPadrao,
  nivelMeta, valorDaMetrica, cruzaLimiar, avaliarPlano, avaliarPlanos, nivelGeral, avaliacoesDisparadas,
  normalizarChecklist, progressoChecklist, checklistDoEvento,
  renderComunicado, comunicadoSeed,
  listarTemplates, templateKeyParaTipo, gerarPlanosDoTemplate,
  isMissingTable,
  type Plano, type ClimaResumo, type Gatilho,
} from '@/lib/plano-b'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkPlano(p: Partial<Plano> & { gatilho?: Partial<Gatilho> }): Plano {
  return {
    id: p.id || 'p1', evento_id: p.evento_id ?? 'e1', tipo_risco: p.tipo_risco ?? 'chuva',
    gatilho: { metrica: 'chuva_prob', operador: 'acima', atencao: 50, critico: 80, unidade: '%', ...(p.gatilho || {}) },
    acao: p.acao ?? 'acionar tenda', responsavel: p.responsavel ?? null, status: p.status ?? 'armado',
    comunicado_template: p.comunicado_template ?? null, checklist: p.checklist ?? [], ordem: p.ordem ?? 0,
  }
}
function mkResumo(p: Partial<ClimaResumo>): ClimaResumo {
  return { ...resumoVazio(), fonte: 'open-meteo', dia: '2026-06-10', ...p }
}

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('addDiasYMD soma/subtrai sem off-by-one', () => {
    expect(addDiasYMD('2026-06-10', 16)).toBe('2026-06-26')
    expect(addDiasYMD('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDiasYMD('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('diaDe extrai a parte YYYY-MM-DD', () => {
    expect(diaDe('2026-06-10T14:00')).toBe('2026-06-10')
    expect(diaDe('2026-06-10')).toBe('2026-06-10')
    expect(diaDe('lixo')).toBeNull()
    expect(diaDe(null)).toBeNull()
  })
  it('horaParaMin converte e tolera lixo', () => {
    expect(horaParaMin('18:30')).toBe(1110)
    expect(horaParaMin('00:00')).toBe(0)
    expect(horaParaMin('09:05:00')).toBe(545)
    expect(horaParaMin('abc')).toBeNull()
    expect(horaParaMin(null)).toBeNull()
  })
  it('previsaoDisponivel respeita o horizonte e o passado', () => {
    const hoje = '2026-06-08'
    expect(previsaoDisponivel('2026-06-10', hoje)).toBe(true)   // dentro
    expect(previsaoDisponivel('2026-06-08', hoje)).toBe(true)   // hoje
    expect(previsaoDisponivel('2026-06-07', hoje)).toBe(false)  // passado
    expect(previsaoDisponivel('2026-07-30', hoje)).toBe(false)  // > 16 dias
    expect(previsaoDisponivel(null, hoje)).toBe(false)
  })
})

// ── Resumo / merge ──────────────────────────────────────────────────────────
describe('resumo', () => {
  it('resumoVazio tem campos seguros', () => {
    const r = resumoVazio()
    expect(r.chuva_prob).toBeNull()
    expect(r.horas).toEqual([])
    expect(r.manual).toBe(false)
  })
  it('mesclarResumo coage números e marca manual por fonte', () => {
    const r = mesclarResumo({ fonte: 'manual', chuva_prob: '70' as never, vento: 40, dia: '2026-06-10T00:00' })
    expect(r.manual).toBe(true)
    expect(r.chuva_prob).toBe(70)
    expect(r.vento).toBe(40)
    expect(r.dia).toBe('2026-06-10')
  })
  it('mesclarResumo trata null/lixo', () => {
    expect(mesclarResumo(null).chuva_prob).toBeNull()
    expect(mesclarResumo(undefined).horas).toEqual([])
    expect(mesclarResumo({ horas: [{ hora: '12:00:00', temp: '25' as never }, { foo: 1 } as never] }).horas).toHaveLength(1)
  })
})

// ── parseOpenMeteo ────────────────────────────────────────────────────────────
describe('parseOpenMeteo', () => {
  const json = {
    daily: {
      time: ['2026-06-10'],
      weather_code: [61], temperature_2m_max: [31], temperature_2m_min: [18],
      precipitation_probability_max: [90], precipitation_sum: [12],
      wind_speed_10m_max: [44], wind_gusts_10m_max: [70], uv_index_max: [9],
      sunrise: ['2026-06-10T06:15'], sunset: ['2026-06-10T17:40'],
    },
    hourly: {
      time: ['2026-06-10T08:00', '2026-06-10T18:00', '2026-06-10T20:00', '2026-06-11T08:00'],
      temperature_2m: [22, 28, 26, 20],
      precipitation_probability: [10, 80, 60, 5],
      precipitation: [0, 4, 2, 0],
      wind_speed_10m: [12, 30, 25, 8],
      wind_gusts_10m: [20, 55, 40, 12],
      uv_index: [3, 7, 1, 2],
      visibility: [20000, 8000, 6000, 24000],
      weather_code: [2, 80, 61, 1],
    },
  }
  it('agrega o dia inteiro quando não há janela', () => {
    const r = parseOpenMeteo(json, '2026-06-10')
    expect(r.fonte).toBe('open-meteo')
    expect(r.horas).toHaveLength(3)              // só as horas do dia 10
    expect(r.chuva_prob).toBe(80)                // máx do dia
    expect(r.precipitacao).toBe(6)               // soma (4+2+0)
    expect(r.vento).toBe(30)                     // máx
    expect(r.rajada).toBe(55)
    expect(r.temp_max).toBe(28)
    expect(r.temp_min).toBe(22)
    expect(r.uv).toBe(7)
    expect(r.visibilidade).toBe(6000)            // mín
    expect(r.codigo).toBe(61)                    // do diário
    expect(r.nascer_sol).toBe('2026-06-10T06:15')
    expect(r.por_sol).toBe('2026-06-10T17:40')
  })
  it('agrega só a janela do evento quando informada', () => {
    const r = parseOpenMeteo(json, '2026-06-10', { inicio: '19:00', fim: '23:00' })
    // só a hora 20:00 entra na janela
    expect(r.chuva_prob).toBe(60)
    expect(r.temp_max).toBe(26)
    expect(r.visibilidade).toBe(6000)
    expect(r.horas).toHaveLength(3)              // horas do dia seguem completas p/ o gráfico
  })
  it('usa fallback do diário quando faltam horas', () => {
    const r = parseOpenMeteo({ daily: json.daily, hourly: { time: [] } }, '2026-06-10')
    expect(r.chuva_prob).toBe(90)                // precipitation_probability_max
    expect(r.vento).toBe(44)
    expect(r.temp_max).toBe(31)
  })
  it('é robusto a JSON vazio/ruim', () => {
    expect(parseOpenMeteo(null, '2026-06-10').dia).toBe('2026-06-10')
    expect(parseOpenMeteo({}, '2026-06-10').horas).toEqual([])
  })
})

// ── Condição (WMO) ────────────────────────────────────────────────────────────
describe('condicaoDe', () => {
  it('mapeia códigos conhecidos', () => {
    expect(condicaoDe(0).icone).toBe('sol')
    expect(condicaoDe(61).icone).toBe('chuva')
    expect(condicaoDe(95).icone).toBe('tempestade')
    expect(condicaoDe(45).icone).toBe('nevoa')
  })
  it('tem fallback p/ código desconhecido/null', () => {
    expect(condicaoDe(null).label).toBe('—')
    expect(condicaoDe(123).label).toBe('Indefinido')
  })
})

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogo de riscos', () => {
  it('todo risco tem gatilho padrão coerente com o operador', () => {
    for (const r of RISCOS) {
      const g = gatilhoPadrao(r.v)
      expect(g.metrica).toBe(r.metrica)
      if (g.operador === 'acima') expect(g.critico).toBeGreaterThan(g.atencao)
      else expect(g.critico).toBeLessThan(g.atencao)
    }
  })
  it('riscoMeta/label/metrica têm fallback', () => {
    expect(riscoLabel('chuva')).toBe('Chuva')
    expect(riscoMeta('inexistente').cor).toBe('#94a3b8')
    expect(metricaLabel('uv')).toBe('Índice UV')
    expect(metricaUnidade('vento')).toBe('km/h')
  })
})

// ── Avaliação de gatilhos ─────────────────────────────────────────────────────
describe('avaliação', () => {
  it('cruzaLimiar respeita o operador', () => {
    expect(cruzaLimiar(80, 'acima', 80)).toBe(true)
    expect(cruzaLimiar(79, 'acima', 80)).toBe(false)
    expect(cruzaLimiar(2000, 'abaixo', 2000)).toBe(true)
    expect(cruzaLimiar(2100, 'abaixo', 2000)).toBe(false)
  })
  it('valorDaMetrica lê o campo certo', () => {
    const r = mkResumo({ chuva_prob: 70, vento: 40, visibilidade: 1500 })
    expect(valorDaMetrica(r, 'chuva_prob')).toBe(70)
    expect(valorDaMetrica(r, 'vento')).toBe(40)
    expect(valorDaMetrica(r, 'visibilidade')).toBe(1500)
    expect(valorDaMetrica(null, 'chuva_prob')).toBeNull()
  })
  it('verde/amarelo/vermelho por limiar (operador acima)', () => {
    const plano = mkPlano({ gatilho: { atencao: 50, critico: 80 } })
    expect(avaliarPlano(plano, mkResumo({ chuva_prob: 30 })).nivel).toBe('verde')
    expect(avaliarPlano(plano, mkResumo({ chuva_prob: 60 })).nivel).toBe('amarelo')
    expect(avaliarPlano(plano, mkResumo({ chuva_prob: 90 })).nivel).toBe('vermelho')
  })
  it('operador abaixo (visibilidade/frio): crítico < atenção', () => {
    const plano = mkPlano({ tipo_risco: 'baixa_visibilidade', gatilho: { metrica: 'visibilidade', operador: 'abaixo', atencao: 5000, critico: 2000, unidade: 'm' } })
    expect(avaliarPlano(plano, mkResumo({ visibilidade: 8000 })).nivel).toBe('verde')
    expect(avaliarPlano(plano, mkResumo({ visibilidade: 4000 })).nivel).toBe('amarelo')
    expect(avaliarPlano(plano, mkResumo({ visibilidade: 1500 })).nivel).toBe('vermelho')
  })
  it('sem_dados quando a métrica não está na previsão', () => {
    const plano = mkPlano({ gatilho: { metrica: 'uv', operador: 'acima', atencao: 8, critico: 11, unidade: 'UV' } })
    expect(avaliarPlano(plano, mkResumo({ uv: null })).nivel).toBe('sem_dados')
    expect(avaliarPlano(plano, null).nivel).toBe('sem_dados')
  })
  it('nivelGeral pega o pior; descartados ficam de fora', () => {
    const planos = [
      mkPlano({ id: 'a', gatilho: { atencao: 50, critico: 80 } }),                         // chuva
      mkPlano({ id: 'b', tipo_risco: 'vento', gatilho: { metrica: 'vento', operador: 'acima', atencao: 35, critico: 50, unidade: 'km/h' } }),
      mkPlano({ id: 'c', status: 'descartado', gatilho: { metrica: 'temp_max', operador: 'acima', atencao: 10, critico: 12, unidade: '°C' } }),
    ]
    const r = mkResumo({ chuva_prob: 90, vento: 20, temp_max: 40 })
    const avals = avaliarPlanos(planos, r)
    expect(avals).toHaveLength(2)                       // descartado fora
    expect(nivelGeral(avals)).toBe('vermelho')          // chuva 90 ≥ 80
    expect(avaliacoesDisparadas(avals)[0].plano.id).toBe('a')
  })
  it('nivelGeral é sem_dados sem avaliações', () => {
    expect(nivelGeral([])).toBe('sem_dados')
    expect(nivelMeta('vermelho').peso).toBeGreaterThan(nivelMeta('amarelo').peso)
  })
})

// ── Checklist ─────────────────────────────────────────────────────────────────
describe('checklist', () => {
  it('normalizarChecklist limpa itens', () => {
    const c = normalizarChecklist([{ label: 'Lonas', ok: true }, { label: '', ok: false }, 'x', { label: 'Escoamento', responsavel: 'João' }])
    expect(c).toHaveLength(2)
    expect(c[0]).toEqual({ label: 'Lonas', responsavel: null, ok: true })
    expect(c[1].responsavel).toBe('João')
  })
  it('progressoChecklist é fração', () => {
    expect(progressoChecklist([])).toBe(0)
    expect(progressoChecklist([{ label: 'a', responsavel: null, ok: true }, { label: 'b', responsavel: null, ok: false }])).toBe(0.5)
  })
  it('checklistDoEvento achata e ignora descartados', () => {
    const planos = [
      mkPlano({ id: 'a', checklist: [{ label: 'Tenda', responsavel: null, ok: false }, { label: 'Pisos', responsavel: null, ok: true }] }),
      mkPlano({ id: 'b', status: 'descartado', checklist: [{ label: 'X', responsavel: null, ok: false }] }),
    ]
    const flat = checklistDoEvento(planos)
    expect(flat).toHaveLength(2)
    expect(flat[0]).toMatchObject({ planoId: 'a', indice: 0 })
  })
})

// ── Comunicação ───────────────────────────────────────────────────────────────
describe('comunicação', () => {
  it('renderComunicado substitui variáveis e ignora ausentes', () => {
    const out = renderComunicado('Evento {evento} em {data}. Ação: {acao}. {inexistente}', { evento: 'Festa', data: '10/06', acao: 'acionar tenda' })
    expect(out).toBe('Evento Festa em 10/06. Ação: acionar tenda. ')
  })
  it('comunicadoSeed usa o rótulo do risco', () => {
    expect(comunicadoSeed('chuva')).toContain('chuva')
    expect(comunicadoSeed('vento')).toContain('{evento}')
  })
})

// ── Templates ─────────────────────────────────────────────────────────────────
describe('templates de planos', () => {
  it('templateKeyParaTipo mapeia tipos de evento', () => {
    expect(templateKeyParaTipo('Corrida de rua 10k')).toBe('corrida')
    expect(templateKeyParaTipo('Air Show 2026')).toBe('airshow')
    expect(templateKeyParaTipo('Vaquejada')).toBe('equestre')
    expect(templateKeyParaTipo('Casamento no jardim')).toBe('casamento')
    expect(templateKeyParaTipo('Festival de música')).toBe('show')
    expect(templateKeyParaTipo('qualquer outra coisa')).toBe('generico')
    expect(templateKeyParaTipo(null)).toBe('generico')
  })
  it('listarTemplates lista todos', () => {
    expect(listarTemplates().map((t) => t.key)).toContain('corrida')
    expect(listarTemplates()).toHaveLength(6)
  })
  it('gerarPlanosDoTemplate produz planos válidos e avaliáveis', () => {
    const seeds = gerarPlanosDoTemplate('casamento')
    expect(seeds.length).toBeGreaterThan(0)
    const chuva = seeds.find((s) => s.tipo_risco === 'chuva')!
    expect(chuva.gatilho.metrica).toBe('chuva_prob')
    expect(chuva.checklist.length).toBeGreaterThan(0)
    expect(chuva.comunicado_template).toContain('{evento}')
    // o seed gera plano avaliável de ponta a ponta
    const plano = mkPlano({ tipo_risco: chuva.tipo_risco, gatilho: chuva.gatilho })
    expect(avaliarPlano(plano, mkResumo({ chuva_prob: 95 })).nivel).toBe('vermelho')
  })
  it('corrida prioriza calor/uv; airshow inclui visibilidade', () => {
    expect(gerarPlanosDoTemplate('corrida').some((s) => s.tipo_risco === 'uv')).toBe(true)
    expect(gerarPlanosDoTemplate('airshow').some((s) => s.tipo_risco === 'baixa_visibilidade')).toBe(true)
  })
})

// ── Setup ─────────────────────────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece PGRST205/42P01 e mensagens', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table' })).toBe(true)
    expect(isMissingTable(null)).toBe(false)
    expect(isMissingTable({ code: '23505' })).toBe(false)
  })
})
