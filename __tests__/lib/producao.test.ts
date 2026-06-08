import { describe, it, expect } from 'vitest'
import {
  hhmmToMin, minToHHMM, somarHorario, addDiasYMD, duracaoLabel,
  briefingVazio, mesclarBriefing, briefingSeedDeEvento,
  categoriaLabel, categoriaCor, responsavelLabel, tarefaStatusMeta,
  tarefaConcluida, tarefaAberta,
  dependenciaPendente, podeConcluir, criaCiclo,
  prontidao, tarefasCriticas, agruparPorStatus, agruparPorCategoria,
  ordenarRunshow, fimMin, duracaoTotalMin, progressoRunshow, conflitosRunshow,
  templateKeyParaTipo, listarTemplates, gerarTarefasDoTemplate, gerarRunshowDoTemplate,
  isMissingTable,
  type Tarefa, type RunshowItem,
} from '@/lib/producao'

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkTarefa(p: Partial<Tarefa>): Tarefa {
  return {
    id: p.id || 't1', producao_id: p.producao_id ?? 'p1', titulo: p.titulo ?? 'Tarefa',
    categoria: p.categoria ?? 'logistica', responsavel: p.responsavel ?? 'producao',
    responsavel_id: p.responsavel_id ?? null, responsavel_nome: p.responsavel_nome ?? null,
    prazo: p.prazo ?? null, status: p.status ?? 'pendente', prioridade: p.prioridade ?? 'normal',
    depende_de: p.depende_de ?? null, obs: p.obs ?? null, anexos: p.anexos ?? [], ordem: p.ordem ?? 0,
    ...p,
  }
}
function mkRun(p: Partial<RunshowItem>): RunshowItem {
  return {
    id: p.id || 'r1', producao_id: p.producao_id ?? 'p1', data: p.data ?? '2026-06-10',
    horario: p.horario ?? '18:00', duracao_min: p.duracao_min ?? 30, atividade: p.atividade ?? 'Atividade',
    area: p.area ?? null, responsavel: p.responsavel ?? null, recurso: p.recurso ?? null,
    obs: p.obs ?? null, concluido: p.concluido ?? false, ordem: p.ordem ?? 0, ...p,
  }
}
const byId = (ts: Tarefa[]) => new Map(ts.map((t) => [t.id, t]))

// ── Tempo ─────────────────────────────────────────────────────────────────────
describe('helpers de tempo', () => {
  it('hhmmToMin / minToHHMM são inversos', () => {
    expect(hhmmToMin('18:30')).toBe(1110)
    expect(hhmmToMin('00:00')).toBe(0)
    expect(minToHHMM(1110)).toBe('18:30')
    expect(minToHHMM(0)).toBe('00:00')
  })
  it('hhmmToMin tolera lixo', () => {
    expect(hhmmToMin('')).toBe(0)
    expect(hhmmToMin(null)).toBe(0)
    expect(hhmmToMin('abc')).toBe(0)
  })
  it('minToHHMM normaliza overflow e negativo (volta ao dia)', () => {
    expect(minToHHMM(24 * 60)).toBe('00:00')
    expect(minToHHMM(25 * 60)).toBe('01:00')
    expect(minToHHMM(-60)).toBe('23:00')
  })
  it('somarHorario devolve horário e delta de dias', () => {
    expect(somarHorario('22:00', 180)).toEqual({ horario: '01:00', diaDelta: 1 })
    expect(somarHorario('00:30', -60)).toEqual({ horario: '23:30', diaDelta: -1 })
    expect(somarHorario('18:00', 90)).toEqual({ horario: '19:30', diaDelta: 0 })
  })
  it('addDiasYMD soma/subtrai dias sem off-by-one', () => {
    expect(addDiasYMD('2026-06-10', 1)).toBe('2026-06-11')
    expect(addDiasYMD('2026-06-10', -14)).toBe('2026-05-27')
    expect(addDiasYMD('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDiasYMD('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('duracaoLabel formata horas/minutos', () => {
    expect(duracaoLabel(45)).toBe('45min')
    expect(duracaoLabel(60)).toBe('1h')
    expect(duracaoLabel(90)).toBe('1h30')
    expect(duracaoLabel(0)).toBe('0min')
  })
})

// ── Briefing ────────────────────────────────────────────────────────────────
describe('briefing', () => {
  it('briefingVazio tem todos os campos seguros', () => {
    const b = briefingVazio()
    expect(b.convidados).toBeNull()
    expect(b.contatosChave).toEqual([])
    expect(b.horarios.inicio).toBe('')
  })
  it('mesclarBriefing preenche defaults e filtra contatos vazios', () => {
    const b = mesclarBriefing({ convidados: 120, contatosChave: [{ nome: '', papel: '', telefone: '' }, { nome: 'Ana', papel: 'Cerimonial', telefone: '9' }] } as never)
    expect(b.convidados).toBe(120)
    expect(b.contatosChave).toHaveLength(1)
    expect(b.horarios.inicio).toBe('')
  })
  it('mesclarBriefing trata null/lixo', () => {
    expect(mesclarBriefing(null).convidados).toBeNull()
    expect(mesclarBriefing(undefined).cardapio).toBe('')
  })
  it('briefingSeedDeEvento puxa horários/convidados/restrições do evento', () => {
    const b = briefingSeedDeEvento({
      qtd_adultos: 100, qtd_criancas: 20, horario_inicio: '19:00:00', horario_montagem: '14:00',
      restricoes_alimentares: '2 veganos', contato_emergencia: 'Bombeiros 193',
      necessidades_tecnicas: 'Gerador',
    })
    expect(b.convidados).toBe(120)
    expect(b.horarios.inicio).toBe('19:00')
    expect(b.horarios.montagem).toBe('14:00')
    expect(b.restricoes).toBe('2 veganos')
    expect(b.contatosEmergencia).toBe('Bombeiros 193')
    expect(b.observacoes).toContain('Gerador')
  })
  it('briefingSeedDeEvento não sobrescreve o que já foi preenchido', () => {
    const atual = mesclarBriefing({ convidados: 50, horarios: { montagem: '', inicio: '20:00', fim: '', desmontagem: '' } } as never)
    const b = briefingSeedDeEvento({ qtd_adultos: 100, horario_inicio: '19:00' }, atual)
    expect(b.convidados).toBe(50)        // mantém
    expect(b.horarios.inicio).toBe('20:00') // mantém
  })
})

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('labels e cores resolvem com fallback', () => {
    expect(categoriaLabel('AeB')).toBe('A&B')
    expect(categoriaLabel('inexistente')).toBe('inexistente')
    expect(categoriaCor('seguranca')).toMatch(/^#/)
    expect(responsavelLabel('fornecedor')).toBe('Fornecedor')
    expect(tarefaStatusMeta('concluida').label).toBe('Concluída')
    expect(tarefaStatusMeta('xpto').label).toBe('xpto')
  })
})

// ── Predicados ────────────────────────────────────────────────────────────────
describe('predicados de status', () => {
  it('concluída/aberta', () => {
    expect(tarefaConcluida(mkTarefa({ status: 'concluida' }))).toBe(true)
    expect(tarefaAberta(mkTarefa({ status: 'pendente' }))).toBe(true)
    expect(tarefaAberta(mkTarefa({ status: 'concluida' }))).toBe(false)
    expect(tarefaAberta(mkTarefa({ status: 'cancelada' }))).toBe(false)
  })
})

// ── Dependências ──────────────────────────────────────────────────────────────
describe('dependências', () => {
  it('dependenciaPendente só quando a pai não está concluída', () => {
    const pai = mkTarefa({ id: 'pai', status: 'pendente' })
    const filha = mkTarefa({ id: 'f', depende_de: 'pai' })
    expect(dependenciaPendente(filha, byId([pai, filha]))).toBe(true)
    const paiOk = mkTarefa({ id: 'pai', status: 'concluida' })
    expect(dependenciaPendente(filha, byId([paiOk, filha]))).toBe(false)
  })
  it('sem dependência ou dependência removida → não bloqueia', () => {
    expect(dependenciaPendente(mkTarefa({ depende_de: null }), new Map())).toBe(false)
    expect(dependenciaPendente(mkTarefa({ depende_de: 'sumiu' }), new Map())).toBe(false)
  })
  it('podeConcluir respeita a dependência', () => {
    const pai = mkTarefa({ id: 'pai', status: 'fazendo' })
    const filha = mkTarefa({ id: 'f', depende_de: 'pai' })
    expect(podeConcluir(filha, byId([pai, filha]))).toBe(false)
    expect(podeConcluir(mkTarefa({ id: 'f', depende_de: 'pai' }), byId([mkTarefa({ id: 'pai', status: 'concluida' }), filha]))).toBe(true)
  })
  it('criaCiclo detecta auto-dependência e ciclos', () => {
    const a = mkTarefa({ id: 'a', depende_de: null })
    const b = mkTarefa({ id: 'b', depende_de: 'a' })
    const c = mkTarefa({ id: 'c', depende_de: 'b' })
    const m = byId([a, b, c])
    expect(criaCiclo('a', 'a', m)).toBe(true)        // auto
    expect(criaCiclo('a', 'c', m)).toBe(true)        // a→c→b→a fecharia ciclo
    expect(criaCiclo('a', 'b', m)).toBe(true)        // a→b→a
    expect(criaCiclo('c', 'a', m)).toBe(false)       // c→a já é a ordem natural
    expect(criaCiclo('x', null, m)).toBe(false)
  })
})

// ── Prontidão ─────────────────────────────────────────────────────────────────
describe('prontidão', () => {
  const tarefas = [
    mkTarefa({ id: '1', status: 'concluida' }),
    mkTarefa({ id: '2', status: 'fazendo' }),
    mkTarefa({ id: '3', status: 'pendente', prioridade: 'alta' }),
    mkTarefa({ id: '4', status: 'pendente', prazo: '2026-06-01' }), // atrasada vs hoje
    mkTarefa({ id: '5', status: 'cancelada' }),                     // não conta
  ]
  it('conta concluídas/abertas e ignora canceladas', () => {
    const p = prontidao(tarefas, '2026-06-08')
    expect(p.total).toBe(4)
    expect(p.concluidas).toBe(1)
    expect(p.fazendo).toBe(1)
    expect(p.pendentes).toBe(2)
    expect(p.fracao).toBeCloseTo(0.25)
  })
  it('marca críticas (alta prioridade ou atrasada) e atrasadas', () => {
    const p = prontidao(tarefas, '2026-06-08')
    expect(p.atrasadas).toBe(1)         // tarefa 4
    expect(p.criticasAbertas).toBe(2)   // 3 (alta) + 4 (atrasada)
  })
  it('lista de críticas prioriza atraso e prioridade', () => {
    const crit = tarefasCriticas(tarefas, '2026-06-08')
    expect(crit[0].id).toBe('4')        // atrasada vem primeiro
    expect(crit.map((t) => t.id)).toEqual(['4', '3'])
  })
  it('vazio é seguro', () => {
    expect(prontidao([]).fracao).toBe(0)
  })
})

// ── Agrupamentos ──────────────────────────────────────────────────────────────
describe('agrupamentos', () => {
  it('agruparPorStatus respeita ordem dentro da coluna', () => {
    const g = agruparPorStatus([mkTarefa({ id: 'b', ordem: 2 }), mkTarefa({ id: 'a', ordem: 1 })])
    expect(g.pendente.map((t) => t.id)).toEqual(['a', 'b'])
    expect(g.concluida).toEqual([])
  })
  it('agruparPorCategoria segue a ordem do catálogo', () => {
    const g = agruparPorCategoria([mkTarefa({ categoria: 'AeB' }), mkTarefa({ categoria: 'comercial' })])
    expect(g.map((x) => x.categoria)).toEqual(['comercial', 'AeB'])
  })
})

// ── Run-show ──────────────────────────────────────────────────────────────────
describe('run-show', () => {
  it('ordena por data, horário e ordem', () => {
    const items = [
      mkRun({ id: 'c', data: '2026-06-11', horario: '09:00' }),
      mkRun({ id: 'a', data: '2026-06-10', horario: '18:00' }),
      mkRun({ id: 'b', data: '2026-06-10', horario: '20:00' }),
    ]
    expect(ordenarRunshow(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
  it('fimMin e duracaoTotalMin', () => {
    expect(fimMin(mkRun({ horario: '18:00', duracao_min: 90 }))).toBe(18 * 60 + 90)
    expect(duracaoTotalMin([mkRun({ duracao_min: 30 }), mkRun({ duracao_min: 45 })])).toBe(75)
  })
  it('progressoRunshow', () => {
    const p = progressoRunshow([mkRun({ concluido: true }), mkRun({ concluido: false }), mkRun({ concluido: true })])
    expect(p).toEqual({ feitos: 2, total: 3, fracao: 2 / 3 })
    expect(progressoRunshow([]).fracao).toBe(0)
  })
  it('conflitosRunshow aponta sobreposição na mesma área/dia', () => {
    const items = [
      mkRun({ id: 'a', area: 'Palco', horario: '18:00', duracao_min: 60 }),
      mkRun({ id: 'b', area: 'Palco', horario: '18:30', duracao_min: 30 }), // sobrepõe a
      mkRun({ id: 'c', area: 'Bar', horario: '18:15', duracao_min: 30 }),   // outra área
      mkRun({ id: 'd', area: 'Palco', horario: '19:00', duracao_min: 30 }), // encosta, não sobrepõe
    ]
    const conf = conflitosRunshow(items)
    expect(conf).toHaveLength(1)
    expect([conf[0].a.id, conf[0].b.id].sort()).toEqual(['a', 'b'])
  })
  it('itens sem área não conflitam', () => {
    expect(conflitosRunshow([mkRun({ id: 'a', area: null, horario: '18:00', duracao_min: 60 }), mkRun({ id: 'b', area: null, horario: '18:10', duracao_min: 10 })])).toEqual([])
  })
})

// ── Templates ─────────────────────────────────────────────────────────────────
describe('templates', () => {
  it('templateKeyParaTipo mapeia tipos livres', () => {
    expect(templateKeyParaTipo('Casamento')).toBe('casamento')
    expect(templateKeyParaTipo('festa de 15 anos')).toBe('aniversario')
    expect(templateKeyParaTipo('Congresso corporativo')).toBe('corporativo')
    expect(templateKeyParaTipo('Show de rock')).toBe('show')
    expect(templateKeyParaTipo('Corrida de rua 5k')).toBe('corrida')
    expect(templateKeyParaTipo('Feira agro')).toBe('feira')
    expect(templateKeyParaTipo('qualquer coisa')).toBe('generico')
    expect(templateKeyParaTipo(null)).toBe('generico')
  })
  it('listarTemplates expõe todas as chaves', () => {
    const ks = listarTemplates().map((t) => t.key)
    expect(ks).toContain('casamento')
    expect(ks).toContain('generico')
    expect(ks.length).toBeGreaterThanOrEqual(7)
  })
  it('gerarTarefasDoTemplate calcula prazos e resolve dependência por título', () => {
    const ts = gerarTarefasDoTemplate('casamento', '2026-06-10')
    expect(ts.length).toBeGreaterThan(5)
    const briefing = ts.find((t) => t.titulo.includes('briefing'))!
    expect(briefing.prazo).toBe(addDiasYMD('2026-06-10', -14))
    const montagem = ts.find((t) => t.titulo === 'Montagem da estrutura')!
    expect(montagem.dependeTitulo).toBe('Confirmar fornecedores e ordens de serviço')
    expect(montagem.prazo).toBe('2026-06-10')
    // ordem é sequencial e estável
    expect(ts.map((t) => t.ordem)).toEqual(ts.map((_, i) => i))
  })
  it('gerarTarefasDoTemplate sem data deixa prazo nulo', () => {
    expect(gerarTarefasDoTemplate('generico', null).every((t) => t.prazo === null)).toBe(true)
  })
  it('gerarRunshowDoTemplate ancora no horário de início e trata virada de dia', () => {
    const rs = gerarRunshowDoTemplate('casamento', '19:00', '2026-06-10')
    const cerimonia = rs.find((r) => r.atividade === 'Cerimônia')!
    expect(cerimonia.horario).toBe('19:00')   // offset 0
    expect(cerimonia.data).toBe('2026-06-10')
    const recepcaoEquipe = rs[0]
    expect(recepcaoEquipe.horario).toBe('17:00') // offset -120
    // a balada que passa da meia-noite cai no dia seguinte
    const vira = rs.find((r) => hhmmToMin(r.horario) < hhmmToMin('19:00') && r.data === '2026-06-11')
    expect(vira).toBeTruthy()
  })
  it('gerarRunshowDoTemplate usa 18:00 quando o início é inválido', () => {
    const rs = gerarRunshowDoTemplate('generico', '', '2026-06-10')
    const abertura = rs.find((r) => r.atividade === 'Abertura oficial')!
    expect(abertura.horario).toBe('18:00')
  })
})

// ── Util ──────────────────────────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece PGRST205/42P01 e mensagens de schema', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
