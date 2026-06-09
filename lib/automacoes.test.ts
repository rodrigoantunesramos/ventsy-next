import { describe, it, expect } from 'vitest';
import {
  type Automacao, type EventoLite, type ParcelaLite, type ContratoLite, type ClienteLite,
  type LicencaLite, type FeedbackLite, type DadosSelecao,
  addDiasYMD, diffDiasYMD, ymdOf, mmdd, diasDoGatilho, interpolar, dedupKey,
  selecionarDisparos, selecionarEventos, selecionarParcelas, selecionarContratos,
  selecionarAniversarios, selecionarLicencas, selecionarFeedbacks,
  validarAutomacao, resumoAutomacao, pendenciasDoDia, agregadoLog, contarNaoLidas,
  RECEITAS, receitaParaAutomacao, GATILHOS, waLink,
} from './automacoes';

const HOJE = '2026-06-09';

// Fábrica de automação com defaults sensatos.
function auto(p: Partial<Automacao>): Automacao {
  return {
    id: 'a1', usuario_id: 'u1', nome: 'Regra', gatilho: 'x_dias_antes_evento',
    condicao: {}, acao: 'notificar', acao_config: {}, ativo: true,
    ultima_exec: null, n_exec: 0, criado_em: HOJE, atualizado_em: HOJE, ...p,
  };
}
function ev(p: Partial<EventoLite>): EventoLite {
  return {
    id: 'e1', nome_evento: 'Casamento Ana', quem_contratou: 'Ana Souza', tipo_evento: 'casamento',
    status: 'confirmado', data_inicio: '2026-06-16', data_fim: '2026-06-16', valor_total_num: 10000,
    propriedade_id: 1, email: 'ana@x.com', telefone: '11999998888', criado_em: HOJE + 'T10:00:00Z', ...p,
  };
}
const dados = (p: Partial<DadosSelecao>): DadosSelecao => ({
  eventos: [], parcelas: [], contratos: [], clientes: [], licencas: [], feedbacks: [], ...p,
});

// ── Helpers de data ───────────────────────────────────────────────────────────
describe('helpers de data', () => {
  it('ymdOf extrai YYYY-MM-DD de date e timestamp', () => {
    expect(ymdOf('2026-06-09')).toBe('2026-06-09');
    expect(ymdOf('2026-06-09T23:30:00Z')).toBe('2026-06-09');
    expect(ymdOf(null)).toBeNull();
    expect(ymdOf('')).toBeNull();
  });
  it('addDiasYMD soma/subtrai dias atravessando mês', () => {
    expect(addDiasYMD('2026-06-09', 7)).toBe('2026-06-16');
    expect(addDiasYMD('2026-06-09', -1)).toBe('2026-06-08');
    expect(addDiasYMD('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDiasYMD('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDiasYMD calcula a diferença assinada', () => {
    expect(diffDiasYMD('2026-06-09', '2026-06-16')).toBe(7);
    expect(diffDiasYMD('2026-06-16', '2026-06-09')).toBe(-7);
    expect(diffDiasYMD('2026-06-09', '2026-06-09')).toBe(0);
  });
  it('mmdd ignora o ano', () => {
    expect(mmdd('1990-06-09')).toBe('06-09');
    expect(mmdd('2026-06-09T12:00:00')).toBe('06-09');
  });
});

// ── diasDoGatilho ─────────────────────────────────────────────────────────────
describe('diasDoGatilho', () => {
  it('usa a condição quando presente', () => {
    expect(diasDoGatilho(auto({ gatilho: 'parcela_vence', condicao: { dias: 5 } }))).toBe(5);
  });
  it('cai no default do catálogo', () => {
    expect(diasDoGatilho(auto({ gatilho: 'parcela_vence', condicao: {} }))).toBe(3);
    expect(diasDoGatilho(auto({ gatilho: 'licenca_a_vencer', condicao: {} }))).toBe(30);
  });
  it('clampa negativos a zero', () => {
    expect(diasDoGatilho(auto({ condicao: { dias: -4 } }))).toBe(0);
  });
});

// ── Interpolação ──────────────────────────────────────────────────────────────
describe('interpolar', () => {
  it('substitui variáveis tolerando espaço e caso', () => {
    expect(interpolar('Oi {{cliente}}, {{ EVENTO }} em {{dias}}d', { cliente: 'Ana', evento: 'Festa', dias: '3' }))
      .toBe('Oi Ana, Festa em 3d');
  });
  it('variável ausente vira vazio, nunca deixa {{x}} cru', () => {
    expect(interpolar('Olá {{cliente}}{{falta}}', { cliente: 'Ana' })).toBe('Olá Ana');
  });
  it('template vazio → string vazia', () => {
    expect(interpolar('', { a: 'b' })).toBe('');
    expect(interpolar(null, {})).toBe('');
  });
});

// ── Seletor: eventos ──────────────────────────────────────────────────────────
describe('selecionarEventos', () => {
  it('x_dias_antes_evento dispara exatamente N dias antes', () => {
    const a = auto({ gatilho: 'x_dias_antes_evento', condicao: { dias: 7 } });
    const r = selecionarEventos([ev({ data_inicio: '2026-06-16' })], a, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].alvo_id).toBe('e1');
    expect(r[0].vars.dias).toBe('7');
    expect(r[0].vars.cliente).toBe('Ana');
  });
  it('não dispara em outras datas', () => {
    const a = auto({ gatilho: 'x_dias_antes_evento', condicao: { dias: 7 } });
    expect(selecionarEventos([ev({ data_inicio: '2026-06-17' })], a, HOJE)).toHaveLength(0);
  });
  it('x_dias_apos_evento usa data_fim e dispara N dias depois', () => {
    const a = auto({ gatilho: 'x_dias_apos_evento', condicao: { dias: 1 } });
    const r = selecionarEventos([ev({ data_inicio: '2026-06-07', data_fim: '2026-06-08' })], a, HOJE);
    expect(r).toHaveLength(1);
  });
  it('evento_criado dispara para eventos criados hoje', () => {
    const a = auto({ gatilho: 'evento_criado', condicao: {} });
    const r = selecionarEventos([ev({ criado_em: HOJE + 'T08:00:00Z' }), ev({ id: 'e2', criado_em: '2026-06-01T08:00:00Z' })], a, HOJE);
    expect(r.map((d) => d.alvo_id)).toEqual(['e1']);
  });
  it('condição filtra por tipo de evento, propriedade e valor mínimo', () => {
    const a = auto({ gatilho: 'x_dias_antes_evento', condicao: { dias: 7, tipos_evento: ['corporativo'], propriedade_id: 1, valor_min: 5000 } });
    expect(selecionarEventos([ev({ data_inicio: '2026-06-16', tipo_evento: 'casamento' })], a, HOJE)).toHaveLength(0);
    const a2 = auto({ gatilho: 'x_dias_antes_evento', condicao: { dias: 7, tipos_evento: ['casamento'], valor_min: 20000 } });
    expect(selecionarEventos([ev({ data_inicio: '2026-06-16', valor_total_num: 10000 })], a2, HOJE)).toHaveLength(0);
    const a3 = auto({ gatilho: 'x_dias_antes_evento', condicao: { dias: 7, tipos_evento: ['casamento'], valor_min: 5000 } });
    expect(selecionarEventos([ev({ data_inicio: '2026-06-16' })], a3, HOJE)).toHaveLength(1);
  });
});

// ── Seletor: parcelas ─────────────────────────────────────────────────────────
describe('selecionarParcelas', () => {
  const byId = new Map([['e1', ev({})]]);
  function parc(p: Partial<ParcelaLite>): ParcelaLite {
    return { id: 'p1', evento_id: 'e1', valor: 2500, vencimento: '2026-06-12', status: 'pendente', pago_em: null, ...p };
  }
  it('parcela_vence dispara N dias antes do vencimento e ignora pagas', () => {
    const a = auto({ gatilho: 'parcela_vence', condicao: { dias: 3 } });
    expect(selecionarParcelas([parc({ vencimento: '2026-06-12' })], byId, a, HOJE)).toHaveLength(1);
    expect(selecionarParcelas([parc({ vencimento: '2026-06-12', status: 'pago' })], byId, a, HOJE)).toHaveLength(0);
    expect(selecionarParcelas([parc({ vencimento: '2026-06-12', pago_em: '2026-06-01' })], byId, a, HOJE)).toHaveLength(0);
  });
  it('parcela_atrasa dispara N dias após o vencimento', () => {
    const a = auto({ gatilho: 'parcela_atrasa', condicao: { dias: 1 } });
    const r = selecionarParcelas([parc({ vencimento: '2026-06-08' })], byId, a, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].valor_num).toBe(2500);
    expect(r[0].contato_email).toBe('ana@x.com');
  });
  it('respeita valor_min na própria parcela', () => {
    const a = auto({ gatilho: 'parcela_vence', condicao: { dias: 3, valor_min: 3000 } });
    expect(selecionarParcelas([parc({ valor: 2500 })], byId, a, HOJE)).toHaveLength(0);
  });
});

// ── Seletor: contratos ────────────────────────────────────────────────────────
describe('selecionarContratos', () => {
  const byId = new Map([['e1', ev({})]]);
  function ctr(p: Partial<ContratoLite>): ContratoLite {
    return { id: 'c1', evento_id: 'e1', cliente_id: null, titulo: 'Contrato 2026/014', numero: '2026/014', status: 'enviado', criado_em: '2026-06-07T10:00:00Z', atualizado_em: '2026-06-07T10:00:00Z', ...p };
  }
  it('dispara para enviado há N dias sem assinatura', () => {
    const a = auto({ gatilho: 'contrato_nao_assinado', condicao: { dias: 2 } });
    const r = selecionarContratos([ctr({})], byId, a, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].vars.titulo).toBe('Contrato 2026/014');
  });
  it('ignora assinados ou rascunhos', () => {
    const a = auto({ gatilho: 'contrato_nao_assinado', condicao: { dias: 2 } });
    expect(selecionarContratos([ctr({ status: 'assinado' })], byId, a, HOJE)).toHaveLength(0);
    expect(selecionarContratos([ctr({ status: 'rascunho' })], byId, a, HOJE)).toHaveLength(0);
  });
});

// ── Seletor: aniversários ─────────────────────────────────────────────────────
describe('selecionarAniversarios', () => {
  function cli(p: Partial<ClienteLite>): ClienteLite {
    return { id: 'cl1', nome: 'Ana Souza', email: 'ana@x.com', whatsapp: '11999998888', telefone: null, aniversario: '1990-06-09', ...p };
  }
  it('dispara quando o MM-DD bate (ignora o ano)', () => {
    const a = auto({ gatilho: 'aniversario_cliente', condicao: { dias: 0 } });
    const r = selecionarAniversarios([cli({ aniversario: '1985-06-09' })], a, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].contato_whatsapp).toBe('11999998888');
  });
  it('suporta antecedência (dias > 0)', () => {
    const a = auto({ gatilho: 'aniversario_cliente', condicao: { dias: 7 } });
    expect(selecionarAniversarios([cli({ aniversario: '1985-06-16' })], a, HOJE)).toHaveLength(1);
  });
  it('não dispara em outro dia', () => {
    const a = auto({ gatilho: 'aniversario_cliente', condicao: { dias: 0 } });
    expect(selecionarAniversarios([cli({ aniversario: '1985-06-10' })], a, HOJE)).toHaveLength(0);
  });
});

// ── Seletor: licenças ─────────────────────────────────────────────────────────
describe('selecionarLicencas', () => {
  function lic(p: Partial<LicencaLite>): LicencaLite {
    return { id: 'l1', titulo: 'AVCB Bombeiros', tipo: 'avcb_bombeiros', validade: '2026-07-09', status: 'vigente', dias_aviso: 30, propriedade_id: 1, evento_id: null, ...p };
  }
  it('dispara N dias antes da validade', () => {
    const a = auto({ gatilho: 'licenca_a_vencer', condicao: { dias: 30 } });
    expect(selecionarLicencas([lic({ validade: '2026-07-09' })], a, HOJE)).toHaveLength(1);
  });
  it('ignora status não aplicável/cancelada', () => {
    const a = auto({ gatilho: 'licenca_a_vencer', condicao: { dias: 30 } });
    expect(selecionarLicencas([lic({ validade: '2026-07-09', status: 'nao_aplicavel' })], a, HOJE)).toHaveLength(0);
  });
  it('respeita a propriedade da condição', () => {
    const a = auto({ gatilho: 'licenca_a_vencer', condicao: { dias: 30, propriedade_id: 2 } });
    expect(selecionarLicencas([lic({ validade: '2026-07-09', propriedade_id: 1 })], a, HOJE)).toHaveLength(0);
  });
});

// ── Seletor: feedbacks ────────────────────────────────────────────────────────
describe('selecionarFeedbacks', () => {
  const byId = new Map([['e1', ev({})]]);
  function fb(p: Partial<FeedbackLite>): FeedbackLite {
    return { id: 'f1', evento_id: 'e1', cliente_id: null, autor_nome: 'Ana Souza', nota_geral: 2, criado_em: HOJE + 'T09:00:00Z', ...p };
  }
  it('dispara para nota ≤ limiar criada hoje', () => {
    const a = auto({ gatilho: 'feedback_negativo', condicao: { nota_max: 2 } });
    const r = selecionarFeedbacks([fb({ nota_geral: 2 })], byId, a, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].vars.nota).toBe('2');
  });
  it('ignora nota alta e feedbacks antigos', () => {
    const a = auto({ gatilho: 'feedback_negativo', condicao: { nota_max: 2 } });
    expect(selecionarFeedbacks([fb({ nota_geral: 5 })], byId, a, HOJE)).toHaveLength(0);
    expect(selecionarFeedbacks([fb({ criado_em: '2026-06-01T09:00:00Z' })], byId, a, HOJE)).toHaveLength(0);
  });
  it('usa default nota_max=2 quando não definido', () => {
    const a = auto({ gatilho: 'feedback_negativo', condicao: {} });
    expect(selecionarFeedbacks([fb({ nota_geral: 3 })], byId, a, HOJE)).toHaveLength(0);
    expect(selecionarFeedbacks([fb({ nota_geral: 1 })], byId, a, HOJE)).toHaveLength(1);
  });
});

// ── Roteamento ────────────────────────────────────────────────────────────────
describe('selecionarDisparos roteia por gatilho', () => {
  it('parcela_vence só olha parcelas', () => {
    const a = auto({ gatilho: 'parcela_vence', condicao: { dias: 3 } });
    const d = dados({
      eventos: [ev({})],
      parcelas: [{ id: 'p1', evento_id: 'e1', valor: 1000, vencimento: '2026-06-12', status: 'pendente', pago_em: null }],
    });
    const r = selecionarDisparos(a, d, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].alvo_tipo).toBe('parcela');
  });
  it('gatilho desconhecido devolve vazio', () => {
    const a = auto({ gatilho: 'inexistente' as Automacao['gatilho'] });
    expect(selecionarDisparos(a, dados({}), HOJE)).toHaveLength(0);
  });
});

// ── Dedup ─────────────────────────────────────────────────────────────────────
describe('dedupKey', () => {
  it('é estável por (automação, alvo, dia)', () => {
    expect(dedupKey('a1', 'p9', HOJE)).toBe('a1|p9|2026-06-09');
    expect(dedupKey('a1', 'p9', HOJE)).toBe(dedupKey('a1', 'p9', HOJE));
    expect(dedupKey('a1', 'p9', '2026-06-10')).not.toBe(dedupKey('a1', 'p9', HOJE));
  });
});

// ── Validação ─────────────────────────────────────────────────────────────────
describe('validarAutomacao', () => {
  it('exige nome', () => {
    expect(validarAutomacao(auto({ nome: '' }))).toContain('Dê um nome à automação.');
  });
  it('mover_funil exige status destino', () => {
    const errs = validarAutomacao(auto({ acao: 'mover_funil', acao_config: {} }));
    expect(errs.some((e) => e.includes('status de destino'))).toBe(true);
  });
  it('enviar_email exige mensagem', () => {
    const errs = validarAutomacao(auto({ acao: 'enviar_email', acao_config: { destinatario: 'cliente' } }));
    expect(errs.some((e) => e.includes('mensagem'))).toBe(true);
  });
  it('automação válida não acumula erros', () => {
    expect(validarAutomacao(auto({ nome: 'Ok', acao: 'notificar', acao_config: { mensagem: 'oi' } }))).toEqual([]);
  });
});

// ── Resumo ────────────────────────────────────────────────────────────────────
describe('resumoAutomacao', () => {
  it('monta "se/então" com dias e ação', () => {
    const r = resumoAutomacao(auto({ gatilho: 'parcela_vence', condicao: { dias: 3 }, acao: 'enviar_email', acao_config: { destinatario: 'cliente' } }));
    expect(r.se).toContain('Parcela a vencer');
    expect(r.se).toContain('3');
    expect(r.entao).toBe('E-mail ao cliente');
  });
});

// ── Pendências do dia ─────────────────────────────────────────────────────────
describe('pendenciasDoDia', () => {
  it('lista parcela atrasada como crítica e ordena pela urgência temporal', () => {
    const d = dados({
      eventos: [ev({})],
      parcelas: [
        { id: 'p1', evento_id: 'e1', valor: 1000, vencimento: '2026-06-05', status: 'pendente', pago_em: null }, // atrasada
        { id: 'p2', evento_id: 'e1', valor: 2000, vencimento: '2026-06-11', status: 'pendente', pago_em: null }, // futura
      ],
    });
    const r = pendenciasDoDia(d, HOJE, 7);
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r[0].urgencia).toBe('critico');     // a atrasada vem primeiro
    expect(r[0].tipo).toBe('parcela');
  });
  it('inclui evento próximo e contrato pendente há ≥2 dias', () => {
    const d = dados({
      eventos: [ev({ data_inicio: '2026-06-10' })],
      contratos: [{ id: 'c1', evento_id: 'e1', cliente_id: null, titulo: 'Contrato X', numero: '1', status: 'enviado', criado_em: '2026-06-05T10:00:00Z', atualizado_em: '2026-06-05T10:00:00Z' }],
    });
    const r = pendenciasDoDia(d, HOJE, 7);
    expect(r.some((p) => p.tipo === 'evento')).toBe(true);
    expect(r.some((p) => p.tipo === 'contrato')).toBe(true);
  });
});

// ── Agregados ─────────────────────────────────────────────────────────────────
describe('agregadoLog e contarNaoLidas', () => {
  it('conta sucesso/falha e por canal', () => {
    const base = { id: 'x', usuario_id: 'u', automacao_id: 'a', gatilho: 'g', acao: 'notificar', alvo_tipo: null, alvo_id: null, alvo_label: null, dedup_key: 'k', detalhe: null, criado_em: HOJE };
    const r = agregadoLog([
      { ...base, canal: 'app', sucesso: true },
      { ...base, canal: 'email', sucesso: false },
      { ...base, canal: 'app', sucesso: true },
    ]);
    expect(r.total).toBe(3);
    expect(r.sucesso).toBe(2);
    expect(r.falha).toBe(1);
    expect(r.porCanal.app).toBe(2);
  });
  it('contarNaoLidas ignora as lidas', () => {
    const base = { id: 'n', usuario_id: 'u', tipo: 'parcela', titulo: 't', corpo: null, link: null, urgencia: 'info' as const, origem: null, criado_em: HOJE };
    expect(contarNaoLidas([{ ...base, lida: false }, { ...base, lida: true }, { ...base, lida: false }])).toBe(2);
  });
});

// ── Receitas ──────────────────────────────────────────────────────────────────
describe('RECEITAS', () => {
  it('toda receita usa um gatilho do catálogo e ação conhecida', () => {
    const gat = new Set(GATILHOS.map((g) => g.v));
    for (const r of RECEITAS) {
      expect(gat.has(r.gatilho)).toBe(true);
      expect(['notificar', 'enviar_email', 'enviar_whatsapp', 'criar_tarefa', 'mover_funil']).toContain(r.acao);
    }
  });
  it('receitaParaAutomacao já vem ativa e sem erros de validação', () => {
    for (const r of RECEITAS) {
      const a = receitaParaAutomacao(r);
      expect(a.ativo).toBe(true);
      expect(validarAutomacao({ nome: a.nome, gatilho: a.gatilho, acao: a.acao, acao_config: a.acao_config })).toEqual([]);
    }
  });
});

// ── waLink ────────────────────────────────────────────────────────────────────
describe('waLink', () => {
  it('prefixa 55 em número BR e codifica o texto', () => {
    expect(waLink('11999998888', 'Oi, tudo bem?')).toBe('https://wa.me/5511999998888?text=Oi%2C%20tudo%20bem%3F');
    expect(waLink('', 'x')).toBeNull();
  });
});
