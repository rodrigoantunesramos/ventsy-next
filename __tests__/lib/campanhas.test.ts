import { describe, it, expect } from 'vitest';
import {
  type Campanha, type ClienteAlvo, type Descadastro, type Envio, type SegmentoFiltro,
  CANAIS, TEMPLATES, VARIAVEIS, LIMITES_PLANO,
  interpolar, varsDoAlvo, contatoDoAlvo, chaveDescadastro, emailValido, soDigitos, waLink,
  segmentoVazio, matchSegmento, resolverPublico,
  limiteDoPlano, enviadasNoMes, limiteInfo, podeEnviarQtd,
  taxaEntrega, taxaAbertura, taxaClique, taxaFalha, funilCampanha, contarEnvios, agregado,
  serieEnviosMensal, melhorHorario, validarCampanha, campanhasToCSV, isMissingTable,
} from '@/lib/campanhas';

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkAlvo(p: Partial<ClienteAlvo> = {}): ClienteAlvo {
  return {
    id: 'c1', nome: 'Maria Silva', email: 'maria@ex.com', whatsapp: '11988887777', telefone: null,
    cidade: 'São Paulo', origem: 'site', tags: ['vip'], aniversario: '1990-06-15',
    segmento: 'fiel', tiposEvento: ['casamento'], inativo: false, nEventos: 2, vip: true,
    proximoEvento: 'Casamento', ...p,
  };
}
function mkCamp(p: Partial<Campanha> = {}): Campanha {
  return {
    id: 'k1', usuario_id: 'u1', nome: 'Campanha', canal: 'email', assunto: 'Oi', corpo: 'Olá {{nome}}',
    segmento: {}, agendada_para: null, status: 'enviada', enviada_em: '2026-06-05T12:00:00Z',
    n_total: 100, n_enviados: 100, n_entregues: 90, n_abertos: 45, n_clicados: 9, n_falhas: 10, n_descadastros: 2,
    criado_em: '2026-06-01T12:00:00Z', atualizado_em: '2026-06-01T12:00:00Z', ...p,
  };
}
function mkDesc(p: Partial<Descadastro> = {}): Descadastro {
  return { id: 'd1', usuario_id: 'u1', cliente_id: null, contato: 'maria@ex.com', canal: 'email', criado_em: '2026-06-01T12:00:00Z', ...p };
}
function mkEnvio(p: Partial<Envio> = {}): Envio {
  return {
    id: 'e1', campanha_id: 'k1', usuario_id: 'u1', cliente_id: null, contato: 'a@b.com', nome: 'A',
    vars: {}, status: 'enviado', enviado_em: '2026-06-05T10:00:00Z', aberto_em: null, clicado_em: null,
    erro: null, criado_em: '2026-06-05T09:00:00Z', ...p,
  };
}
const NOW = new Date('2026-06-08T12:00:00Z');

// ── Catálogos ──────────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('canais e variáveis existem', () => {
    expect(CANAIS.map((c) => c.v)).toEqual(['email', 'whatsapp', 'sms']);
    expect(VARIAVEIS.map((v) => v.k)).toContain('nome');
    expect(VARIAVEIS.map((v) => v.k)).toContain('evento');
  });
  it('templates têm assunto e corpo com variáveis', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(6);
    for (const t of TEMPLATES) {
      expect(t.assunto.length).toBeGreaterThan(0);
      expect(t.corpo).toContain('{{');
    }
  });
  it('limites por plano: basico não envia, ultra > pro', () => {
    expect(LIMITES_PLANO.basico).toBe(0);
    expect(LIMITES_PLANO.ultra).toBeGreaterThan(LIMITES_PLANO.pro);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────────
describe('helpers', () => {
  it('soDigitos e emailValido', () => {
    expect(soDigitos('(11) 98888-7777')).toBe('11988887777');
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido('a@b')).toBe(false);
    expect(emailValido(null)).toBe(false);
  });
  it('waLink prefixa 55 em números BR e codifica o texto', () => {
    expect(waLink('11988887777')).toBe('https://wa.me/5511988887777');
    expect(waLink('5511988887777', 'oi tudo bem')).toBe('https://wa.me/5511988887777?text=oi%20tudo%20bem');
    expect(waLink('')).toBeNull();
  });
  it('isMissingTable reconhece PGRST205/42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: 'OTHER' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

// ── Interpolação ─────────────────────────────────────────────────────────────────
describe('interpolar', () => {
  it('substitui variáveis, tolera espaços/maiúsculas e some com as não-resolvidas', () => {
    expect(interpolar('Olá {{nome}}, seu {{ Evento }} na {{empresa}}!', { nome: 'Ana', evento: 'Casamento', empresa: 'Villa' }))
      .toBe('Olá Ana, seu Casamento na Villa!');
    expect(interpolar('Oi {{nome}} {{faltante}}', { nome: 'Ana' })).toBe('Oi Ana ');
    expect(interpolar(null, {})).toBe('');
  });
  it('varsDoAlvo usa o primeiro nome e o próximo evento', () => {
    const v = varsDoAlvo(mkAlvo({ nome: 'Maria Silva', proximoEvento: 'Aniversário' }), 'Villa');
    expect(v).toEqual({ nome: 'Maria', evento: 'Aniversário', empresa: 'Villa' });
  });
});

// ── Contato / opt-out ────────────────────────────────────────────────────────────
describe('contato e opt-out', () => {
  it('contatoDoAlvo respeita o canal', () => {
    const a = mkAlvo({ email: 'M@Ex.com', whatsapp: '(11) 98888-7777' });
    expect(contatoDoAlvo(a, 'email')).toBe('m@ex.com');
    expect(contatoDoAlvo(a, 'whatsapp')).toBe('11988887777');
    expect(contatoDoAlvo(mkAlvo({ email: null }), 'email')).toBeNull();
    expect(contatoDoAlvo(mkAlvo({ whatsapp: null, telefone: null }), 'whatsapp')).toBeNull();
  });
  it('chaveDescadastro normaliza por canal', () => {
    expect(chaveDescadastro('M@Ex.com', 'email')).toBe('email:m@ex.com');
    expect(chaveDescadastro('(11) 98888-7777', 'whatsapp')).toBe('whatsapp:11988887777');
  });
});

// ── Segmentação ──────────────────────────────────────────────────────────────────
describe('matchSegmento', () => {
  it('segmento vazio casa com todos', () => {
    expect(segmentoVazio({})).toBe(true);
    expect(matchSegmento(mkAlvo(), {}, NOW)).toBe(true);
  });
  it('filtra por rótulo RFM (OR dentro da lista)', () => {
    const f: SegmentoFiltro = { segmentos: ['campeao', 'fiel'] };
    expect(matchSegmento(mkAlvo({ segmento: 'fiel' }), f, NOW)).toBe(true);
    expect(matchSegmento(mkAlvo({ segmento: 'perdido' }), f, NOW)).toBe(false);
  });
  it('combina dimensões com AND', () => {
    const f: SegmentoFiltro = { origens: ['site'], cidades: ['são paulo'] };
    expect(matchSegmento(mkAlvo({ origem: 'site', cidade: 'São Paulo' }), f, NOW)).toBe(true);
    expect(matchSegmento(mkAlvo({ origem: 'site', cidade: 'Rio' }), f, NOW)).toBe(false);
  });
  it('tags e tiposEvento usam interseção', () => {
    expect(matchSegmento(mkAlvo({ tags: ['ouro', 'vip'] }), { tags: ['vip'] }, NOW)).toBe(true);
    expect(matchSegmento(mkAlvo({ tiposEvento: ['corporativo'] }), { tiposEvento: ['casamento'] }, NOW)).toBe(false);
  });
  it('vip, inativo90 e aniversariantesMes', () => {
    expect(matchSegmento(mkAlvo({ vip: false }), { vip: true }, NOW)).toBe(false);
    expect(matchSegmento(mkAlvo({ inativo: true }), { inativo90: true }, NOW)).toBe(true);
    expect(matchSegmento(mkAlvo({ aniversario: '1990-06-15' }), { aniversariantesMes: true }, NOW)).toBe(true);
    expect(matchSegmento(mkAlvo({ aniversario: '1990-12-15' }), { aniversariantesMes: true }, NOW)).toBe(false);
    expect(matchSegmento(mkAlvo({ aniversario: null }), { aniversariantesMes: true }, NOW)).toBe(false);
  });
});

// ── Resolução do público ─────────────────────────────────────────────────────────
describe('resolverPublico', () => {
  const alvos = [
    mkAlvo({ id: 'a', email: 'a@ex.com', segmento: 'fiel' }),
    mkAlvo({ id: 'b', email: 'b@ex.com', segmento: 'campeao' }),
    mkAlvo({ id: 'c', email: null, whatsapp: null, telefone: null, segmento: 'fiel' }),  // sem contato
    mkAlvo({ id: 'd', email: 'd@ex.com', segmento: 'perdido' }),                          // fora do filtro
  ];
  it('conta elegíveis, sem-contato e opt-out, respeitando o filtro', () => {
    const f: SegmentoFiltro = { segmentos: ['fiel', 'campeao'] };
    const desc = [mkDesc({ contato: 'b@ex.com' })];
    const r = resolverPublico(alvos, f, desc, 'email', NOW);
    expect(r.totalNoSegmento).toBe(3);            // a, b, c (d é perdido → fora)
    expect(r.elegiveis.map((e) => e.alvo.id)).toEqual(['a']);  // b opt-out, c sem contato
    expect(r.semContato).toBe(1);
    expect(r.descadastrados).toBe(1);
  });
  it('opt-out é por canal: descadastro de e-mail não bloqueia WhatsApp', () => {
    const f: SegmentoFiltro = { segmentos: ['fiel'] };
    const desc = [mkDesc({ contato: 'a@ex.com', canal: 'email' })];
    const r = resolverPublico([mkAlvo({ id: 'a', email: 'a@ex.com', whatsapp: '11988887777', segmento: 'fiel' })], f, desc, 'whatsapp', NOW);
    expect(r.elegiveis).toHaveLength(1);
  });
});

// ── Limites de plano ─────────────────────────────────────────────────────────────
describe('limite de plano', () => {
  it('limiteDoPlano é tolerante a caixa e desconhecidos', () => {
    expect(limiteDoPlano('PRO')).toBe(LIMITES_PLANO.pro);
    expect(limiteDoPlano('inexistente')).toBe(0);
    expect(limiteDoPlano(null)).toBe(0);
  });
  it('enviadasNoMes soma apenas o mês corrente', () => {
    const cs = [
      mkCamp({ n_enviados: 50, enviada_em: '2026-06-03T10:00:00Z' }),
      mkCamp({ n_enviados: 30, enviada_em: '2026-05-20T10:00:00Z' }),  // mês anterior
      mkCamp({ n_enviados: 20, enviada_em: null, criado_em: '2026-06-07T10:00:00Z' }),
    ];
    expect(enviadasNoMes(cs, NOW)).toBe(70);
  });
  it('podeEnviarQtd respeita o restante do mês', () => {
    const cs = [mkCamp({ n_enviados: 1950, enviada_em: '2026-06-03T10:00:00Z' })];
    const info = limiteInfo('pro', cs, NOW);
    expect(info.restante).toBe(50);
    expect(podeEnviarQtd('pro', cs, NOW, 40)).toMatchObject({ ok: true, permitido: 40 });
    expect(podeEnviarQtd('pro', cs, NOW, 80)).toMatchObject({ ok: false, permitido: 50, restante: 50 });
    expect(podeEnviarQtd('basico', [], NOW, 1)).toMatchObject({ ok: false, limite: 0 });
  });
});

// ── Métricas ─────────────────────────────────────────────────────────────────────
describe('métricas', () => {
  it('taxas guardam divisão por zero', () => {
    const c = mkCamp({ n_enviados: 100, n_entregues: 90, n_abertos: 45, n_clicados: 9, n_falhas: 10 });
    expect(taxaEntrega(c)).toBeCloseTo(0.9);
    expect(taxaAbertura(c)).toBeCloseTo(0.5);   // 45/90
    expect(taxaClique(c)).toBeCloseTo(0.2);     // 9/45
    expect(taxaFalha(c)).toBeCloseTo(0.1);      // 10/100
    expect(taxaAbertura(mkCamp({ n_enviados: 0, n_entregues: 0, n_abertos: 0 }))).toBe(0);
  });
  it('funilCampanha é monotônico e percentual sobre enviados', () => {
    const f = funilCampanha(mkCamp({ n_enviados: 100, n_entregues: 90, n_abertos: 45, n_clicados: 9 }));
    expect(f.map((e) => e.n)).toEqual([100, 90, 45, 9]);
    expect(f[0].pct).toBe(1);
    expect(f[2].pct).toBeCloseTo(0.45);
  });
  it('contarEnvios respeita a hierarquia de status', () => {
    const c = contarEnvios([
      { status: 'clicado' }, { status: 'aberto' }, { status: 'entregue' },
      { status: 'enviado' }, { status: 'falha' }, { status: 'descadastrado' }, { status: 'fila' },
    ]);
    expect(c).toMatchObject({ total: 7, enviados: 4, entregues: 3, abertos: 2, clicados: 1, falhas: 1, descadastros: 1, fila: 1 });
  });
  it('agregado soma a carteira', () => {
    const a = agregado([mkCamp({ n_enviados: 100, n_entregues: 90, n_abertos: 45, n_clicados: 9 }), mkCamp({ status: 'agendada', n_enviados: 0, n_entregues: 0, n_abertos: 0, n_clicados: 0 })]);
    expect(a.total).toBe(2);
    expect(a.enviadas).toBe(1);
    expect(a.agendadas).toBe(1);
    expect(a.enviados).toBe(100);
    expect(a.aberturaMedia).toBeCloseTo(0.5);
  });
  it('serieEnviosMensal preenche os meses e soma no bucket certo', () => {
    const s = serieEnviosMensal([mkCamp({ n_enviados: 100, n_abertos: 40, enviada_em: '2026-06-02T10:00:00Z' })], NOW, 6);
    expect(s).toHaveLength(6);
    expect(s[s.length - 1].ym).toBe('2026-06');
    expect(s[s.length - 1].enviados).toBe(100);
  });
  it('melhorHorario encontra a hora com mais aberturas', () => {
    const envios = [
      mkEnvio({ aberto_em: '2026-06-05T09:30:00' }),
      mkEnvio({ aberto_em: '2026-06-05T09:45:00' }),
      mkEnvio({ aberto_em: '2026-06-05T20:00:00' }),
      mkEnvio({ aberto_em: null }),
    ];
    expect(melhorHorario(envios)).toEqual({ hora: 9, n: 2 });
    expect(melhorHorario([mkEnvio({ aberto_em: null })])).toBeNull();
  });
});

// ── Validação + CSV ──────────────────────────────────────────────────────────────
describe('validação e export', () => {
  it('validarCampanha cobra nome, assunto (e-mail) e corpo', () => {
    expect(validarCampanha({ nome: '', canal: 'email', assunto: '', corpo: '' })).toHaveLength(3);
    expect(validarCampanha({ nome: 'X', canal: 'whatsapp', assunto: null, corpo: 'oi' })).toEqual([]);
    expect(validarCampanha({ nome: 'X', canal: 'email', assunto: '', corpo: 'oi' })).toHaveLength(1);
  });
  it('campanhasToCSV inclui cabeçalho e linhas', () => {
    const csv = campanhasToCSV([mkCamp({ nome: 'Promo "Junho"' })], (s) => s || '');
    const linhas = csv.split('\n');
    expect(linhas[0]).toContain('Nome');
    expect(linhas[1]).toContain('"Promo ""Junho"""');  // escape de aspas
    expect(linhas[1]).toContain('E-mail');
  });
});
