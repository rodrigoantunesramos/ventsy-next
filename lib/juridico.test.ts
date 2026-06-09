import { describe, it, expect } from 'vitest'
import {
  diaDe, addDiasYMD, diffDias,
  statusVigencia, vigenciaTone, FAIXAS_DIAS,
  categoriaContratoLabel, renovacaoLabel, STATUS_CONTRATO_JUR_META,
  tipoProcessoLabel, poloProcessoLabel, processoEmAberto, STATUS_PROCESSO_META,
  baseLegalLabel, titularTipoLabel, canalConsentimentoLabel,
  tipoSolicitacaoLabel, solicitacaoApagaDados, solicitacaoEncerrada,
  prazoSolicitacao, slaSolicitacao, PRAZO_LGPD_DIAS,
  consentimentoAtivo,
  retencaoVencimento, statusRetencao, acaoRetencaoLabel, gatilhoRetencaoLabel,
  tipoPoliticaLabel, TIPOS_POLITICA,
  consolidarContratos, resumoContratos, resumoProcessos, resumoLGPD, prazosProximos,
  isMissingTable,
  type JuridicoContrato, type ContratoClienteRef, type Processo, type Consentimento, type Solicitacao,
} from './juridico'

const HOJE = '2026-06-09'

// ── Fábricas enxutas ──────────────────────────────────────────────────────────
function jc(p: Partial<JuridicoContrato> = {}): JuridicoContrato {
  return {
    id: Math.random().toString(36).slice(2), categoria: 'fornecedor', titulo: 'Contrato', contraparte: 'ACME',
    numero: null, objeto: null, valor_num: 0, moeda: 'BRL', inicio: null, vigencia_fim: null,
    renovacao: 'manual', aviso_previo_dias: 30, status: 'vigente', responsavel: null,
    documento_url: null, fornecedor_id: null, obs: null, ...p,
  }
}
function cli(p: Partial<ContratoClienteRef> = {}): ContratoClienteRef {
  return {
    id: Math.random().toString(36).slice(2), numero: 'CTR-1', titulo: 'Locação', contraparte: 'João',
    status: 'assinado', vencimento: null, valor_num: 0, moeda: 'BRL', documento_url: null, ...p,
  }
}
function proc(p: Partial<Processo> = {}): Processo {
  return {
    id: Math.random().toString(36).slice(2), tipo: 'judicial', parte: 'Fulano', polo: 'reu', numero: null,
    vara_orgao: null, status: 'ativo', prazo: null, proximo_passo: null, valor_envolvido_num: 0,
    moeda: 'BRL', advogado: null, obs: null, ...p,
  }
}
function sol(p: Partial<Solicitacao> = {}): Solicitacao {
  return {
    id: Math.random().toString(36).slice(2), titular_nome: 'Maria', titular_contato: null, titular_tipo: 'cliente',
    titular_id: null, tipo: 'acesso', canal: 'portal', status: 'aberta', prazo: null, resposta: null,
    concluida_em: null, criado_em: HOJE, ...p,
  }
}

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('diaDe extrai YYYY-MM-DD de data e timestamp', () => {
    expect(diaDe('2026-06-09')).toBe('2026-06-09')
    expect(diaDe('2026-06-09T23:30:00Z')).toBe('2026-06-09')
    expect(diaDe('lixo')).toBeNull()
    expect(diaDe(null)).toBeNull()
  })
  it('addDiasYMD soma sem off-by-one (vira o mês/ano)', () => {
    expect(addDiasYMD('2026-06-09', 1)).toBe('2026-06-10')
    expect(addDiasYMD('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDiasYMD('2026-06-09', -9)).toBe('2026-05-31')
  })
  it('diffDias = ate − de (sinal correto)', () => {
    expect(diffDias('2026-06-09', '2026-06-19')).toBe(10)
    expect(diffDias('2026-06-19', '2026-06-09')).toBe(-10)
    expect(diffDias('2026-06-09', '2026-06-09')).toBe(0)
    expect(diffDias(null, '2026-06-09')).toBeNull()
  })
})

// ── Vigência / vencimento ─────────────────────────────────────────────────────
describe('statusVigencia', () => {
  it('classifica vencido / a vencer / vigente / sem prazo', () => {
    expect(statusVigencia('2026-06-01', HOJE).status).toBe('vencido')   // 8 dias atrás
    expect(statusVigencia('2026-06-20', HOJE).status).toBe('a_vencer')  // +11 (≤30)
    expect(statusVigencia('2026-09-01', HOJE).status).toBe('vigente')   // +84 (>30)
    expect(statusVigencia(null, HOJE).status).toBe('sem_prazo')
  })
  it('respeita a janela avisoDias', () => {
    expect(statusVigencia('2026-08-01', HOJE, 30).status).toBe('vigente') // +53
    expect(statusVigencia('2026-08-01', HOJE, 60).status).toBe('a_vencer')
  })
  it('faixas de vencimento 30/60/90 + futuro', () => {
    expect(statusVigencia('2026-06-29', HOJE).faixa).toBe('30') // +20
    expect(statusVigencia('2026-07-20', HOJE).faixa).toBe('60') // +41
    expect(statusVigencia('2026-08-20', HOJE).faixa).toBe('90') // +72
    expect(statusVigencia('2026-12-01', HOJE).faixa).toBe('futuro')
    expect(statusVigencia('2026-06-01', HOJE).faixa).toBe('vencido')
  })
  it('faixa de borda: exatamente 30 dias ⇒ "30"; 31 ⇒ "60"', () => {
    expect(statusVigencia(addDiasYMD(HOJE, 30), HOJE).faixa).toBe('30')
    expect(statusVigencia(addDiasYMD(HOJE, 31), HOJE).faixa).toBe('60')
  })
  it('vigenciaTone mapeia para o tom semântico', () => {
    expect(vigenciaTone('vencido')).toBe('vermelho')
    expect(vigenciaTone('a_vencer')).toBe('amarelo')
    expect(vigenciaTone('vigente')).toBe('verde')
    expect(vigenciaTone('sem_prazo')).toBe('cinza')
  })
  it('FAIXAS_DIAS expõe 30/60/90', () => {
    expect([...FAIXAS_DIAS]).toEqual([30, 60, 90])
  })
})

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('rótulos com fallback', () => {
    expect(categoriaContratoLabel('nda')).toMatch(/NDA/)
    expect(categoriaContratoLabel('xpto')).toBe('Outro')
    expect(renovacaoLabel('automatica')).toMatch(/autom/i)
    expect(tipoProcessoLabel('notificacao')).toBe('Notificação')
    expect(poloProcessoLabel('reu')).toMatch(/passivo/i)
    expect(baseLegalLabel('obrigacao_legal')).toMatch(/Obriga/)
    expect(baseLegalLabel(undefined)).toBe('Consentimento')
    expect(titularTipoLabel('convidado')).toBe('Convidado')
    expect(canalConsentimentoLabel('ingresso')).toMatch(/ingresso/i)
    expect(tipoSolicitacaoLabel('portabilidade')).toBe('Portabilidade')
    expect(acaoRetencaoLabel('anonimizar')).toBe('Anonimizar')
    expect(gatilhoRetencaoLabel('apos_evento')).toMatch(/evento/i)
    expect(tipoPoliticaLabel('privacidade')).toMatch(/Privacidade/)
  })
  it('STATUS metas trazem label+tone', () => {
    expect(STATUS_CONTRATO_JUR_META.vigente.tone).toBe('verde')
    expect(STATUS_PROCESSO_META.ativo.tone).toBe('azul')
  })
  it('política de privacidade/termos apontam para rotas públicas', () => {
    expect(TIPOS_POLITICA.find((t) => t.key === 'privacidade')?.rotaPublica).toBe('/privacidade')
    expect(TIPOS_POLITICA.find((t) => t.key === 'termos')?.rotaPublica).toBe('/termos')
  })
})

// ── Processos ─────────────────────────────────────────────────────────────────
describe('processoEmAberto', () => {
  it('ativo/suspenso/acordo estão em aberto; encerrado/arquivado não', () => {
    expect(processoEmAberto('ativo')).toBe(true)
    expect(processoEmAberto('suspenso')).toBe(true)
    expect(processoEmAberto('acordo')).toBe(true)
    expect(processoEmAberto('encerrado')).toBe(false)
    expect(processoEmAberto('arquivado')).toBe(false)
  })
})

// ── LGPD — solicitações & SLA ─────────────────────────────────────────────────
describe('LGPD solicitações', () => {
  it('prazoSolicitacao = pedido + 15 dias (art. 19)', () => {
    expect(PRAZO_LGPD_DIAS).toBe(15)
    expect(prazoSolicitacao('2026-06-09')).toBe('2026-06-24')
    expect(prazoSolicitacao('2026-06-09', 10)).toBe('2026-06-19')
    expect(prazoSolicitacao(null)).toBeNull()
  })
  it('solicitacaoApagaDados só para exclusão/anonimização', () => {
    expect(solicitacaoApagaDados('exclusao')).toBe(true)
    expect(solicitacaoApagaDados('anonimizacao')).toBe(true)
    expect(solicitacaoApagaDados('acesso')).toBe(false)
    expect(solicitacaoApagaDados('portabilidade')).toBe(false)
  })
  it('solicitacaoEncerrada para concluida/recusada', () => {
    expect(solicitacaoEncerrada('concluida')).toBe(true)
    expect(solicitacaoEncerrada('recusada')).toBe(true)
    expect(solicitacaoEncerrada('aberta')).toBe(false)
  })
  it('slaSolicitacao: no prazo / a vencer / vencido / concluída', () => {
    expect(slaSolicitacao('2026-06-24', HOJE, 'aberta').status).toBe('no_prazo')      // +15
    expect(slaSolicitacao('2026-06-11', HOJE, 'aberta').status).toBe('a_vencer')      // +2 (≤3)
    expect(slaSolicitacao('2026-06-05', HOJE, 'aberta').status).toBe('vencido')       // -4
    expect(slaSolicitacao('2026-06-05', HOJE, 'concluida').status).toBe('concluida')  // encerrada não vence
  })
  it('slaSolicitacao sem prazo ⇒ no_prazo/azul (não quebra)', () => {
    const s = slaSolicitacao(null, HOJE, 'aberta')
    expect(s.status).toBe('no_prazo')
    expect(s.dias).toBeNull()
  })
})

// ── Consentimentos ────────────────────────────────────────────────────────────
describe('consentimentoAtivo', () => {
  it('ativo se não revogado', () => {
    expect(consentimentoAtivo({ revogado_em: null })).toBe(true)
    expect(consentimentoAtivo({ revogado_em: '2026-01-01' })).toBe(false)
  })
})

// ── Retenção ──────────────────────────────────────────────────────────────────
describe('retenção', () => {
  it('retencaoVencimento = marco + N meses', () => {
    expect(retencaoVencimento('2026-06-09', 6)).toBe('2026-12-09')
    expect(retencaoVencimento('2026-06-09', 12)).toBe('2027-06-09')
    expect(retencaoVencimento(null, 6)).toBeNull()
    expect(retencaoVencimento('2026-06-09', 0)).toBeNull()
  })
  it('statusRetencao marca vencido quando passou da data-limite', () => {
    const venc = statusRetencao('2024-01-01', 12, HOJE) // limite 2025-01-01 < hoje
    expect(venc.vencido).toBe(true)
    expect(venc.vence).toBe('2025-01-01')
    const ok = statusRetencao('2026-01-01', 12, HOJE)   // limite 2027-01-01 > hoje
    expect(ok.vencido).toBe(false)
  })
})

// ── Consolidação de contratos ─────────────────────────────────────────────────
describe('consolidarContratos', () => {
  it('une cliente (read-only) + jurídico (editável) com vigência calculada', () => {
    const out = consolidarContratos(
      [cli({ status: 'assinado', vencimento: '2026-06-20' })],
      [jc({ status: 'vigente', vigencia_fim: '2026-12-01' })],
      HOJE,
    )
    expect(out).toHaveLength(2)
    const c = out.find((x) => x.origem === 'cliente')!
    const j = out.find((x) => x.origem === 'juridico')!
    expect(c.editavel).toBe(false)
    expect(c.ativo).toBe(true)
    expect(c.vigencia.status).toBe('a_vencer')
    expect(j.editavel).toBe(true)
    expect(j.vigencia.status).toBe('vigente')
    expect(j.id.startsWith('jur:')).toBe(true)
  })
  it('contrato de cliente em rascunho/cancelado não conta como ativo', () => {
    const out = consolidarContratos(
      [cli({ status: 'rascunho' }), cli({ status: 'cancelado' })],
      [], HOJE,
    )
    expect(out.every((c) => !c.ativo)).toBe(true)
  })
  it('jurídico só é "ativo" quando status=vigente', () => {
    const out = consolidarContratos([], [jc({ status: 'encerrado', vigencia_fim: '2030-01-01' })], HOJE)
    expect(out[0].ativo).toBe(false)
  })
})

// ── Resumos / KPIs ────────────────────────────────────────────────────────────
describe('resumoContratos', () => {
  it('conta vigentes/a vencer/vencidos e separa valor por moeda', () => {
    const list = consolidarContratos(
      [cli({ status: 'assinado', vencimento: '2026-09-01', valor_num: 1000, moeda: 'BRL' })], // vigente
      [
        jc({ status: 'vigente', vigencia_fim: '2026-06-20', valor_num: 500, moeda: 'BRL' }),   // a vencer
        jc({ status: 'vigente', vigencia_fim: '2026-06-01', valor_num: 200, moeda: 'USD' }),   // vencido
        jc({ status: 'rascunho', vigencia_fim: '2026-09-01', valor_num: 999, moeda: 'BRL' }),  // não ativo
      ],
      HOJE,
    )
    const r = resumoContratos(list)
    expect(r.total).toBe(4)
    expect(r.ativos).toBe(3)
    expect(r.vigentes).toBe(1)
    expect(r.aVencer).toBe(1)
    expect(r.vencidos).toBe(1)
    expect(r.valorPorMoeda.BRL).toBe(1500) // 1000 + 500 (o rascunho de 999 não entra)
    expect(r.valorPorMoeda.USD).toBe(200)
    expect(r.faixa30).toBe(1) // o a-vencer em +11
  })
})

describe('resumoProcessos', () => {
  it('conta só os em aberto e separa valor por moeda', () => {
    const r = resumoProcessos([
      proc({ status: 'ativo', prazo: '2026-06-20', valor_envolvido_num: 5000, moeda: 'BRL' }),
      proc({ status: 'encerrado', valor_envolvido_num: 9000, moeda: 'BRL' }),
      proc({ status: 'suspenso', valor_envolvido_num: 1000, moeda: 'BRL' }),
    ])
    expect(r.total).toBe(3)
    expect(r.ativos).toBe(2)
    expect(r.comPrazo).toBe(1)
    expect(r.valorPorMoeda.BRL).toBe(6000) // 5000 + 1000 (encerrado fora)
  })
})

describe('resumoLGPD', () => {
  it('conta consentimentos ativos/revogados e solicitações em aberto/vencidas', () => {
    const r = resumoLGPD(
      [
        { id: '1', titular_tipo: 'cliente', titular_id: null, titular_nome: 'A', finalidade: null, base_legal: 'consentimento', canal: 'portal', concedido_em: HOJE, revogado_em: null, evidencia: null } as Consentimento,
        { id: '2', titular_tipo: 'lead', titular_id: null, titular_nome: 'B', finalidade: null, base_legal: 'consentimento', canal: 'site', concedido_em: HOJE, revogado_em: '2026-06-01', evidencia: null } as Consentimento,
      ],
      [
        sol({ status: 'aberta', prazo: '2026-06-05' }),  // vencida
        sol({ status: 'aberta', prazo: '2026-06-11' }),  // a vencer
        sol({ status: 'aberta', prazo: '2026-07-01' }),  // no prazo
        sol({ status: 'concluida', prazo: '2026-06-01' }), // encerrada (não conta)
      ],
      HOJE,
    )
    expect(r.consentAtivos).toBe(1)
    expect(r.consentRevogados).toBe(1)
    expect(r.solicAbertas).toBe(3)
    expect(r.solicVencidas).toBe(1)
    expect(r.solicAVencer).toBe(1)
  })
})

// ── Prazos próximos (timeline) ────────────────────────────────────────────────
describe('prazosProximos', () => {
  it('junta contratos+processos+solicitações, ordena por dias e inclui vencidos', () => {
    const contratos = consolidarContratos(
      [], [jc({ status: 'vigente', titulo: 'Buffet', vigencia_fim: '2026-06-20' })], HOJE,
    )
    const itens = prazosProximos(
      contratos,
      [proc({ status: 'ativo', proximo_passo: 'Audiência', prazo: '2026-06-12' })],
      [sol({ status: 'aberta', tipo: 'exclusao', prazo: '2026-06-05', titular_nome: 'Ana' })],
      HOJE,
    )
    expect(itens.map((i) => i.origem)).toEqual(['solicitacao', 'processo', 'contrato']) // -4, +3, +11
    expect(itens[0].vencido).toBe(true)
    expect(itens[0].titulo).toMatch(/Exclus|Ana/)
  })
  it('respeita a janela futura (janelaDias)', () => {
    const contratos = consolidarContratos([], [jc({ status: 'vigente', vigencia_fim: '2027-01-01' })], HOJE)
    expect(prazosProximos(contratos, [], [], HOJE, 30)).toHaveLength(0)
  })
  it('ignora itens sem data ou encerrados', () => {
    const contratos = consolidarContratos([], [jc({ status: 'encerrado', vigencia_fim: '2026-06-15' })], HOJE)
    const itens = prazosProximos(
      contratos,
      [proc({ status: 'encerrado', prazo: '2026-06-15' })],
      [sol({ status: 'concluida', prazo: '2026-06-15' })],
      HOJE,
    )
    expect(itens).toHaveLength(0)
  })
})

// ── needsSetup ────────────────────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece PGRST205 / 42P01 / mensagens de tabela ausente', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ message: 'Could not find the table in the schema cache' })).toBe(true)
    expect(isMissingTable({ message: 'relation does not exist' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
