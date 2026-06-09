import { describe, it, expect } from 'vitest'
import {
  diaDe, addDiasYMD, diffDiasYMD,
  validadeStatus, validadeMeta,
  planoTipoMeta, planoStatusMeta, recursoMeta, recursoStatusMeta,
  ocorrenciaTipoMeta, gravidadeMeta, simuladoTipoMeta, riscoMeta, nrMeta, exigeCAT,
  STATUS_GARANTIDO,
  dimensionarPorPublico, coberturaRecursos, prontidaoEvento,
  indicadoresOcorrencias, nivelGeralSST,
  gerarConteudoPlano, normalizarConteudo, completudePlano, CONTATOS_EMERGENCIA,
  isMissingTable,
  type RecursoExigido, type RecursoEventoLite, type OcorrenciaLite,
} from '@/lib/sst'

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('diaDe extrai a parte YYYY-MM-DD', () => {
    expect(diaDe('2026-06-09T10:30:00Z')).toBe('2026-06-09')
    expect(diaDe('2026-06-09')).toBe('2026-06-09')
    expect(diaDe('lixo')).toBeNull()
    expect(diaDe(null)).toBeNull()
  })
  it('addDiasYMD soma/subtrai sem off-by-one', () => {
    expect(addDiasYMD('2026-06-09', 30)).toBe('2026-07-09')
    expect(addDiasYMD('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDiasYMD('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('diffDiasYMD calcula b − a', () => {
    expect(diffDiasYMD('2026-06-09', '2026-06-19')).toBe(10)
    expect(diffDiasYMD('2026-06-19', '2026-06-09')).toBe(-10)
    expect(diffDiasYMD('2026-06-09', null)).toBeNull()
  })
})

// ── Validade (semáforo) ───────────────────────────────────────────────────────
describe('validadeStatus', () => {
  const hoje = '2026-06-09'
  it('vencida quando a data já passou', () => {
    expect(validadeStatus('2026-06-01', hoje).nivel).toBe('vencida')
    expect(validadeStatus('2026-06-01', hoje).dias).toBe(-8)
  })
  it('a_vencer dentro da janela de aviso', () => {
    expect(validadeStatus('2026-06-20', hoje).nivel).toBe('a_vencer')
    expect(validadeStatus('2026-06-20', hoje, 5).nivel).toBe('vigente') // janela menor
  })
  it('vigente quando longe e sem_validade quando vazia', () => {
    expect(validadeStatus('2026-12-31', hoje).nivel).toBe('vigente')
    expect(validadeStatus(null, hoje).nivel).toBe('sem_validade')
    expect(validadeStatus(null, hoje).dias).toBeNull()
  })
  it('hoje conta como vencida (dias 0 não é negativo, mas ≤ aviso)', () => {
    expect(validadeStatus('2026-06-09', hoje).nivel).toBe('a_vencer')
    expect(validadeStatus('2026-06-09', hoje).dias).toBe(0)
  })
  it('validadeMeta entrega rótulo PT', () => {
    expect(validadeMeta('vencida').label).toBe('Vencida')
  })
})

// ── Catálogos / metas ─────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('metas conhecidas e fallback seguro', () => {
    expect(planoTipoMeta('incendio').label).toBe('Combate a incêndio')
    expect(planoTipoMeta('xpto').label).toBe('xpto')
    expect(planoStatusMeta('vigente').label).toBe('Vigente')
    expect(recursoMeta('ambulancia').unidade).toBe('viatura')
    expect(recursoMeta('ambulancia').grupo).toBe('saude')
    expect(recursoMeta('zzz').label).toBe('zzz')
    expect(recursoStatusMeta('confirmado').label).toBe('Confirmado')
    expect(ocorrenciaTipoMeta('briga').label).toBe('Briga / tumulto')
    expect(ocorrenciaTipoMeta('???').label).toBe('Outro')
    expect(simuladoTipoMeta('evacuacao').label).toContain('evacuação')
    expect(riscoMeta('alto').label).toBe('Risco alto')
  })
  it('gravidade tem peso ordenado e exigeCAT a partir de moderada', () => {
    expect(gravidadeMeta('leve').peso).toBeLessThan(gravidadeMeta('grave').peso)
    expect(gravidadeMeta('fatal').peso).toBeGreaterThan(gravidadeMeta('grave').peso)
    expect(exigeCAT('leve')).toBe(false)
    expect(exigeCAT('moderada')).toBe(true)
    expect(exigeCAT('grave')).toBe(true)
  })
  it('nrMeta conhece NRs e tem fallback', () => {
    expect(nrMeta('NR-35').label).toContain('altura')
    expect(nrMeta('brigada').meses).toBe(12)
    expect(nrMeta('inexistente').label).toBe('inexistente')
  })
  it('STATUS_GARANTIDO cobre contratado e confirmado', () => {
    expect(STATUS_GARANTIDO).toContain('contratado')
    expect(STATUS_GARANTIDO).toContain('confirmado')
    expect(STATUS_GARANTIDO).not.toContain('previsto')
  })
})

// ── Dimensionamento por público ───────────────────────────────────────────────
describe('dimensionarPorPublico', () => {
  const tipos = (r: RecursoExigido[]) => r.map((x) => x.tipo)
  const qtd = (r: RecursoExigido[], t: string) => r.find((x) => x.tipo === t)?.quantidade ?? 0

  it('público zero/negativo não exige nada', () => {
    expect(dimensionarPorPublico({ publico: 0 })).toEqual([])
    expect(dimensionarPorPublico({ publico: -5 })).toEqual([])
  })

  it('evento pequeno (300) só exige brigada, extintores e segurança', () => {
    const r = dimensionarPorPublico({ publico: 300 })
    expect(tipos(r)).toContain('brigadista')
    expect(tipos(r)).toContain('extintor')
    expect(tipos(r)).toContain('seguranca')
    expect(tipos(r)).not.toContain('ambulancia') // < 1000
    expect(tipos(r)).not.toContain('posto_medico') // < 500
  })

  it('a partir de 500 surge posto médico, socorrista e maca', () => {
    const r = dimensionarPorPublico({ publico: 500 })
    expect(tipos(r)).toContain('posto_medico')
    expect(tipos(r)).toContain('socorrista')
    expect(tipos(r)).toContain('maca')
    expect(qtd(r, 'socorrista')).toBeGreaterThanOrEqual(2) // mínimo 2
  })

  it('a partir de 1000 surgem ambulância e desfibrilador (e escalam)', () => {
    const r = dimensionarPorPublico({ publico: 1000 })
    expect(qtd(r, 'ambulancia')).toBe(1)
    expect(qtd(r, 'desfibrilador')).toBe(1)
    const r6 = dimensionarPorPublico({ publico: 6000 })
    expect(qtd(r6, 'ambulancia')).toBe(2) // 1 a cada 5.000 → ceil(6000/5000)=2
  })

  it('grandes públicos acionam UTI móvel e bombeiro civil', () => {
    const r = dimensionarPorPublico({ publico: 25_000 })
    expect(tipos(r)).toContain('uti_movel')
    expect(tipos(r)).toContain('bombeiro_civil')
    expect(qtd(r, 'bombeiro_civil')).toBeGreaterThanOrEqual(2) // ceil(25000/10000)=3
  })

  it('risco alto aumenta brigada e extintores vs. risco baixo', () => {
    const baixo = dimensionarPorPublico({ publico: 5000, areaM2: 3000, risco: 'baixo' })
    const alto = dimensionarPorPublico({ publico: 5000, areaM2: 3000, risco: 'alto' })
    expect(qtd(alto, 'brigadista')).toBeGreaterThan(qtd(baixo, 'brigadista'))
    expect(qtd(alto, 'extintor')).toBeGreaterThan(qtd(baixo, 'extintor'))
  })

  it('álcool reforça socorristas e segurança', () => {
    const sem = dimensionarPorPublico({ publico: 5000 })
    const com = dimensionarPorPublico({ publico: 5000, alcool: true })
    expect(qtd(com, 'seguranca')).toBeGreaterThan(qtd(sem, 'seguranca'))
    expect(qtd(com, 'socorrista')).toBeGreaterThanOrEqual(qtd(sem, 'socorrista'))
  })

  it('palco adiciona ao menos 1 brigadista', () => {
    const sem = dimensionarPorPublico({ publico: 2000 })
    const com = dimensionarPorPublico({ publico: 2000, palco: true })
    expect(qtd(com, 'brigadista')).toBe(qtd(sem, 'brigadista') + 1)
  })

  it('extintor usa área informada quando há; mínimo 2 sempre', () => {
    const r = dimensionarPorPublico({ publico: 5000, areaM2: 2000, risco: 'medio' })
    expect(qtd(r, 'extintor')).toBe(Math.max(2, Math.ceil(2000 / 200))) // 10
    const min = dimensionarPorPublico({ publico: 300, areaM2: 50 })
    expect(qtd(min, 'extintor')).toBe(2)
  })

  it('cada exigência traz uma base explicativa e flag obrigatório', () => {
    const r = dimensionarPorPublico({ publico: 3000 })
    for (const item of r) {
      expect(item.base.length).toBeGreaterThan(0)
      expect(typeof item.obrigatorio).toBe('boolean')
    }
    expect(r.find((x) => x.tipo === 'ambulancia')?.obrigatorio).toBe(true)
  })

  it('ordena saúde → incêndio → segurança', () => {
    const r = dimensionarPorPublico({ publico: 10_000 })
    const grupos = r.map((x) => recursoMeta(x.tipo).grupo)
    const idxSaude = grupos.lastIndexOf('saude')
    const idxSeg = grupos.indexOf('seguranca')
    expect(idxSaude).toBeLessThan(idxSeg)
  })
})

// ── Cobertura & prontidão ─────────────────────────────────────────────────────
describe('coberturaRecursos / prontidaoEvento', () => {
  const exigidos = [
    { tipo: 'ambulancia', quantidade: 2, obrigatorio: true },
    { tipo: 'brigadista', quantidade: 8, obrigatorio: true },
    { tipo: 'maca', quantidade: 1, obrigatorio: false },
  ]

  it('soma só status garantidos como cobertura', () => {
    const alocados: RecursoEventoLite[] = [
      { tipo: 'ambulancia', quantidade: 1, status: 'confirmado' },
      { tipo: 'ambulancia', quantidade: 1, status: 'previsto' },   // não garante
      { tipo: 'brigadista', quantidade: 8, status: 'contratado' },
    ]
    const cob = coberturaRecursos(exigidos, alocados)
    const amb = cob.itens.find((i) => i.tipo === 'ambulancia')!
    expect(amb.garantido).toBe(1)
    expect(amb.previsto).toBe(1)
    expect(amb.falta).toBe(1)
    expect(amb.ok).toBe(false)
    const brig = cob.itens.find((i) => i.tipo === 'brigadista')!
    expect(brig.ok).toBe(true)
  })

  it('obrigatório pendente bloqueia prontidão; não-obrigatório só avisa', () => {
    const alocados: RecursoEventoLite[] = [
      { tipo: 'ambulancia', quantidade: 2, status: 'confirmado' },
      { tipo: 'brigadista', quantidade: 8, status: 'confirmado' },
      // maca (não obrigatório) sem alocação → aviso, não bloqueio
    ]
    const cob = coberturaRecursos(exigidos, alocados)
    const pront = prontidaoEvento(cob)
    expect(pront.pronto).toBe(true)
    expect(pront.avisos.map((a) => a.tipo)).toContain('maca')

    const cob2 = coberturaRecursos(exigidos, [{ tipo: 'brigadista', quantidade: 8, status: 'confirmado' }])
    const pront2 = prontidaoEvento(cob2)
    expect(pront2.pronto).toBe(false)
    expect(pront2.bloqueios.map((b) => b.tipo)).toContain('ambulancia')
  })

  it('status nao_aplicavel é ignorado', () => {
    const cob = coberturaRecursos(
      [{ tipo: 'desfibrilador', quantidade: 1, obrigatorio: true }],
      [{ tipo: 'desfibrilador', quantidade: 5, status: 'nao_aplicavel' }],
    )
    expect(cob.itens[0].garantido).toBe(0)
    expect(cob.itens[0].falta).toBe(1)
  })

  it('recurso alocado sem exigência aparece coberto (extra)', () => {
    const cob = coberturaRecursos([], [{ tipo: 'medico', quantidade: 1, status: 'confirmado' }])
    const it = cob.itens.find((i) => i.tipo === 'medico')!
    expect(it.exigido).toBe(0)
    expect(it.ok).toBe(true)
    expect(it.falta).toBe(0)
  })

  it('exigência salva na linha conta mesmo sem dimensionamento', () => {
    const cob = coberturaRecursos([], [{ tipo: 'extintor', exigido: 6, quantidade: 2, status: 'confirmado' }])
    const it = cob.itens.find((i) => i.tipo === 'extintor')!
    expect(it.exigido).toBe(6)
    expect(it.falta).toBe(4)
  })

  it('coberturaPct é 1 quando não há exigência e fração quando há', () => {
    expect(coberturaRecursos([], []).coberturaPct).toBe(1)
    const cob = coberturaRecursos(
      [{ tipo: 'brigadista', quantidade: 10, obrigatorio: true }],
      [{ tipo: 'brigadista', quantidade: 5, status: 'confirmado' }],
    )
    expect(cob.coberturaPct).toBeCloseTo(0.5, 5)
  })
})

// ── Indicadores de ocorrências ────────────────────────────────────────────────
describe('indicadoresOcorrencias', () => {
  const now = Date.parse('2026-06-09T12:00:00Z')
  const ocs: OcorrenciaLite[] = [
    { tipo: 'mal_estar', gravidade: 'leve', data: '2026-06-01T10:00:00Z', cat_emitida: false },
    { tipo: 'queda', gravidade: 'moderada', data: '2026-06-05T10:00:00Z', cat_emitida: false },
    { tipo: 'acidente', gravidade: 'grave', data: '2026-06-07T10:00:00Z', cat_emitida: true },
    { tipo: 'acidente', gravidade: 'fatal', data: '2026-06-08T10:00:00Z', cat_emitida: false },
  ]
  it('conta totais, graves, fatais e CAT pendentes', () => {
    const ind = indicadoresOcorrencias(ocs, now)
    expect(ind.total).toBe(4)
    expect(ind.graves).toBe(2)       // grave + fatal
    expect(ind.fatais).toBe(1)
    expect(ind.catPendentes).toBe(2) // moderada s/ cat + fatal s/ cat (leve não exige)
    expect(ind.porGravidade.grave).toBe(1)
    expect(ind.porTipo.acidente).toBe(2)
  })
  it('dias desde a última ocorrência usa nowMs (determinístico)', () => {
    const ind = indicadoresOcorrencias(ocs, now)
    expect(ind.ultimaData).toBe('2026-06-08T10:00:00Z')
    expect(ind.diasDesdeUltima).toBe(1)
  })
  it('lista vazia → zeros e null', () => {
    const ind = indicadoresOcorrencias([], now)
    expect(ind.total).toBe(0)
    expect(ind.diasDesdeUltima).toBeNull()
    expect(ind.ultimaData).toBeNull()
  })
})

// ── Semáforo geral ────────────────────────────────────────────────────────────
describe('nivelGeralSST', () => {
  it('ok quando nada pendente', () => {
    expect(nivelGeralSST({})).toBe('ok')
    expect(nivelGeralSST({ validadesAVencer: 0 })).toBe('ok')
  })
  it('atencao só com validades a vencer', () => {
    expect(nivelGeralSST({ validadesAVencer: 3 })).toBe('atencao')
  })
  it('critico com obrigatório pendente, grave, vencida ou CAT pendente', () => {
    expect(nivelGeralSST({ obrigatoriosPendentes: 1 })).toBe('critico')
    expect(nivelGeralSST({ ocorrenciasGraves: 1 })).toBe('critico')
    expect(nivelGeralSST({ validadesVencidas: 1 })).toBe('critico')
    expect(nivelGeralSST({ catPendentes: 1, validadesAVencer: 9 })).toBe('critico')
  })
})

// ── Planos: template, normalização, completude ────────────────────────────────
describe('planos', () => {
  it('gerarConteudoPlano traz procedimentos e contatos de emergência', () => {
    const c = gerarConteudoPlano('evacuacao')
    expect(c.procedimentos.length).toBeGreaterThan(0)
    expect(c.contatos.map((x) => x.telefone)).toContain('192')
    expect(c.contatos.length).toBe(CONTATOS_EMERGENCIA.length)
    expect(c.rotas).toEqual([]) // o usuário detalha depois
  })
  it('tipos diferentes têm procedimentos diferentes', () => {
    expect(gerarConteudoPlano('incendio').procedimentos[0]).not.toBe(gerarConteudoPlano('aph').procedimentos[0])
  })
  it('normalizarConteudo é defensivo com lixo', () => {
    const c = normalizarConteudo({ rotas: ['Saída A', '', 42], pontos_encontro: 'x', contatos: [{ nome: 'Posto', telefone: '199' }, null] })
    expect(c.rotas).toEqual(['Saída A', '42'])
    expect(c.pontos_encontro).toEqual([]) // não-array vira vazio
    expect(c.contatos).toEqual([{ nome: 'Posto', telefone: '199' }])
  })
  it('normalizarConteudo aceita null', () => {
    expect(normalizarConteudo(null)).toEqual({ rotas: [], pontos_encontro: [], recursos: [], procedimentos: [], contatos: [] })
  })
  it('completudePlano mede preenchimento 0–1', () => {
    expect(completudePlano(normalizarConteudo(null))).toBe(0)
    expect(completudePlano(gerarConteudoPlano('emergencia'))).toBeCloseTo(0.4, 5) // procedimentos + contatos = 2/5
    const cheio = { rotas: ['a'], pontos_encontro: ['b'], recursos: ['c'], procedimentos: ['d'], contatos: [{ nome: 'x', telefone: '1' }] }
    expect(completudePlano(cheio)).toBe(1)
  })
})

// ── Detecção de tabela ausente ────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece PGRST205 / 42P01 / mensagens de schema', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
