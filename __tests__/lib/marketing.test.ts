import { describe, it, expect } from 'vitest';
import {
  type Canal, type Acao, type LeadLite,
  ORIGENS, ORIGEM_LABEL, TIPOS_ACAO, STATUS_ACAO, CANAL_TIPOS,
  normalizeOrigem, rankStatus, isGanho,
  mesesNoPeriodo, periodoRange, dentroDoPeriodo,
  funilAquisicao, metricasPorCanal, resumoMarketing, leadsPorOrigem, serieLeadsMensal,
  gradeDoMes, acoesPorDia, buildUTM, validarCanal, validarAcao, canaisToCSV, isMissingTable,
} from '@/lib/marketing';

// ── Fábricas ──────────────────────────────────────────────────────────────────
function mkLead(p: Partial<LeadLite> = {}): LeadLite {
  return { id: 'l1', origem: 'instagram', status: 'lead', valor: 0, data: '2026-06-05', ...p };
}
function mkCanal(p: Partial<Canal> = {}): Canal {
  return {
    id: 'c1', usuario_id: 'u1', nome: 'Instagram', origem_key: 'instagram', tipo: 'pago',
    custo_mensal_num: 300, ativo: true, criado_em: '2026-01-01T00:00:00Z', ...p,
  };
}
function mkAcao(p: Partial<Acao> = {}): Acao {
  return {
    id: 'a1', usuario_id: 'u1', canal_id: 'c1', titulo: 'Post', tipo: 'post', data: '2026-06-10',
    status: 'planejado', investimento_num: 0, resultado: {}, criado_em: '2026-06-01T00:00:00Z', ...p,
  };
}
const NOW = new Date('2026-06-15T12:00:00Z');

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogos', () => {
  it('origens canônicas com rótulo', () => {
    expect(ORIGENS).toContain('instagram');
    expect(ORIGENS).toContain('indicacao');
    for (const o of ORIGENS) expect(ORIGEM_LABEL[o]).toBeTruthy();
  });
  it('tipos de ação, status e tipos de canal existem', () => {
    expect(TIPOS_ACAO.map((t) => t.v)).toEqual(['post', 'anuncio', 'parceria', 'evento', 'email']);
    expect(STATUS_ACAO.map((s) => s.v)).toContain('publicado');
    expect(CANAL_TIPOS.map((t) => t.v)).toContain('pago');
  });
});

// ── Atribuição de origem ────────────────────────────────────────────────────────
describe('normalizeOrigem', () => {
  it('mapeia sinônimos de texto livre', () => {
    expect(normalizeOrigem('Indicação de amigo')).toBe('indicacao');
    expect(normalizeOrigem('vi no Instagram')).toBe('instagram');
    expect(normalizeOrigem('Google Ads')).toBe('google');
    expect(normalizeOrigem('WhatsApp')).toBe('whatsapp');
    expect(normalizeOrigem('feira de noivas')).toBe('evento');
    expect(normalizeOrigem('site oficial')).toBe('site');
    expect(normalizeOrigem('Facebook')).toBe('facebook');
  });
  it('passa chaves canônicas e cai em outro', () => {
    expect(normalizeOrigem('google')).toBe('google');
    expect(normalizeOrigem('')).toBe('outro');
    expect(normalizeOrigem(null)).toBe('outro');
    expect(normalizeOrigem('tv aberta')).toBe('outro');
  });
});

describe('rankStatus / isGanho', () => {
  it('mapeia status do CRM para a posição do funil', () => {
    expect(rankStatus('lead')).toBe(1);
    expect(rankStatus('visita')).toBe(2);
    expect(rankStatus('negociacao')).toBe(3);
    expect(rankStatus('contratado')).toBe(4);
    expect(rankStatus('finalizado')).toBe(4);
    expect(rankStatus('perdido')).toBe(1);     // entrou como lead, não progrediu
    expect(rankStatus('desconhecido')).toBe(1);
  });
  it('isGanho só para contratado+', () => {
    expect(isGanho('contratado')).toBe(true);
    expect(isGanho('finalizado')).toBe(true);
    expect(isGanho('negociacao')).toBe(false);
    expect(isGanho('perdido')).toBe(false);
  });
});

// ── Período ─────────────────────────────────────────────────────────────────────
describe('período', () => {
  it('meses por período', () => {
    expect(mesesNoPeriodo('mes')).toBe(1);
    expect(mesesNoPeriodo('trimestre')).toBe(3);
    expect(mesesNoPeriodo('ano')).toBe(12);
  });
  it('range do mês corrente', () => {
    expect(periodoRange('mes', NOW)).toEqual(['2026-06-01', '2026-06-30']);
    expect(periodoRange('ano', NOW)).toEqual(['2026-01-01', '2026-12-31']);
  });
  it('dentroDoPeriodo compara só a data', () => {
    expect(dentroDoPeriodo('2026-06-10T08:00:00Z', '2026-06-01', '2026-06-30')).toBe(true);
    expect(dentroDoPeriodo('2026-05-31', '2026-06-01', '2026-06-30')).toBe(false);
    expect(dentroDoPeriodo(null, '2026-06-01', '2026-06-30')).toBe(false);
  });
});

// ── Funil de aquisição ──────────────────────────────────────────────────────────
describe('funilAquisicao', () => {
  const leads = [
    mkLead({ status: 'lead' }),
    mkLead({ status: 'visita' }),
    mkLead({ status: 'negociacao' }),
    mkLead({ status: 'contratado' }),
    mkLead({ status: 'perdido' }),
  ];
  it('é cumulativo e percentual sobre o topo', () => {
    const f = funilAquisicao(leads);
    expect(f.etapas.map((e) => e.n)).toEqual([5, 3, 2, 1]);  // lead, qualif, proposta, fechado
    expect(f.etapas[0].pct).toBe(1);
    expect(f.etapas[3].pct).toBeCloseTo(0.2);
  });
  it('conversão da etapa anterior e gargalo (menor conversão)', () => {
    const f = funilAquisicao(leads);
    expect(f.etapas[1].convDoAnterior).toBeCloseTo(0.6);   // 3/5
    expect(f.etapas[3].convDoAnterior).toBeCloseTo(0.5);   // 1/2
    expect(f.gargalo).toMatchObject({ de: 'Em proposta', para: 'Fechados' });
    expect(f.gargalo!.conv).toBeCloseTo(0.5);
  });
  it('lida com lista vazia', () => {
    const f = funilAquisicao([]);
    expect(f.etapas.every((e) => e.n === 0)).toBe(true);
    expect(f.gargalo).toBeNull();
  });
});

// ── Métricas por canal ──────────────────────────────────────────────────────────
describe('metricasPorCanal', () => {
  const canais = [
    mkCanal({ id: 'c1', origem_key: 'instagram', custo_mensal_num: 300, ativo: true }),
    mkCanal({ id: 'c2', nome: 'Google', origem_key: 'google', custo_mensal_num: 0, ativo: true }),
  ];
  const leads = [
    mkLead({ id: 'i1', origem: 'instagram', status: 'lead' }),
    mkLead({ id: 'i2', origem: 'instagram', status: 'visita' }),
    mkLead({ id: 'i3', origem: 'instagram', status: 'contratado', valor: 10000 }),
    mkLead({ id: 'g1', origem: 'google', status: 'lead' }),
    mkLead({ id: 'g2', origem: 'google', status: 'lead' }),
    mkLead({ id: 'r1', origem: 'indicacao', status: 'lead' }),
    mkLead({ id: 'r2', origem: 'indicacao', status: 'finalizado', valor: 5000 }),
  ];
  const acoes = [
    mkAcao({ id: 'a1', canal_id: 'c1', investimento_num: 200 }),  // instagram
    mkAcao({ id: 'a2', canal_id: null, investimento_num: 50 }),   // → outro
  ];

  it('atribui leads/receita e calcula CAC/CPL/ROI/conversão com proração', () => {
    const m = metricasPorCanal(canais, acoes, leads, 1);
    const insta = m.find((x) => x.origem_key === 'instagram')!;
    expect(insta.leads).toBe(3);
    expect(insta.qualificados).toBe(2);    // visita + contratado
    expect(insta.fechados).toBe(1);
    expect(insta.receita).toBe(10000);
    expect(insta.custoCanal).toBe(300);    // 300 * 1 mês
    expect(insta.investimentoAcoes).toBe(200);
    expect(insta.investimento).toBe(500);
    expect(insta.cpl!).toBeCloseTo(500 / 3);
    expect(insta.cac!).toBeCloseTo(500);
    expect(insta.conversao).toBeCloseTo(1 / 3);
    expect(insta.roi!).toBeCloseTo(20);    // 10000 / 500
    expect(insta.retorno).toBe(9500);
    expect(insta.configurado).toBe(true);
  });
  it('prorrateia o custo mensal pelo nº de meses do período', () => {
    const m = metricasPorCanal(canais, [], leads, 3);  // trimestre
    expect(m.find((x) => x.origem_key === 'instagram')!.custoCanal).toBe(900);
  });
  it('inclui origem do CRM sem canal e canal sem custo; ROI nulo quando investimento=0', () => {
    const m = metricasPorCanal(canais, acoes, leads, 1);
    const indic = m.find((x) => x.origem_key === 'indicacao')!;
    expect(indic.configurado).toBe(false);
    expect(indic.investimento).toBe(0);
    expect(indic.roi).toBeNull();          // receita 5000 / investimento 0 → n/d
    expect(indic.cac).toBe(0);             // 1 fechado sem custo → aquisição gratuita
    expect(indic.cpl).toBe(0);             // leads sem custo
    expect(indic.retorno).toBe(5000);
    const google = m.find((x) => x.origem_key === 'google')!;
    expect(google.investimento).toBe(0);
    expect(google.cpl).toBe(0);            // 2 leads sem custo → CPL gratuito
    expect(google.cac).toBeNull();         // nenhum fechado → CAC n/d
    expect(google.roi).toBeNull();         // sem receita e sem investimento → n/d
  });
  it('cria bucket "outro" para ações sem canal e ordena por receita desc', () => {
    const m = metricasPorCanal(canais, acoes, leads, 1);
    const outro = m.find((x) => x.origem_key === 'outro')!;
    expect(outro.investimento).toBe(50);
    expect(outro.roi).toBe(0);             // receita 0 / investimento 50 → 0 (não n/d)
    expect(m.map((x) => x.origem_key)).toEqual(['instagram', 'indicacao', 'google', 'outro']);
  });
});

// ── Resumo / distribuições ──────────────────────────────────────────────────────
describe('resumoMarketing e distribuições', () => {
  const canais = [mkCanal({ id: 'c1', origem_key: 'instagram', custo_mensal_num: 300 })];
  const leads = [
    mkLead({ origem: 'instagram', status: 'contratado', valor: 10000 }),
    mkLead({ origem: 'indicacao', status: 'finalizado', valor: 5000 }),
    mkLead({ origem: 'google', status: 'lead' }),
  ];
  const acoes = [mkAcao({ canal_id: 'c1', investimento_num: 200 })];
  it('soma a carteira e calcula CAC/ROI agregados', () => {
    const r = resumoMarketing(metricasPorCanal(canais, acoes, leads, 1));
    expect(r.leads).toBe(3);
    expect(r.fechados).toBe(2);
    expect(r.receita).toBe(15000);
    expect(r.investimento).toBe(500);      // 300 + 200
    expect(r.cac!).toBeCloseTo(250);       // 500 / 2
    expect(r.roi!).toBeCloseTo(30);        // 15000 / 500
    expect(r.conversao).toBeCloseTo(2 / 3);
  });
  it('leadsPorOrigem conta e ordena com rótulo/cor', () => {
    const d = leadsPorOrigem(leads);
    expect(d[0].n).toBeGreaterThanOrEqual(d[d.length - 1].n);
    expect(d.find((x) => x.origem === 'instagram')!.label).toBe('Instagram');
    expect(d.find((x) => x.origem === 'instagram')!.cor).toBeTruthy();
  });
  it('serieLeadsMensal preenche meses e soma no bucket certo', () => {
    const s = serieLeadsMensal([mkLead({ data: '2026-06-03' }), mkLead({ data: '2026-05-20' })], NOW, 6);
    expect(s).toHaveLength(6);
    expect(s[s.length - 1].ym).toBe('2026-06');
    expect(s[s.length - 1].n).toBe(1);
    expect(s[s.length - 2].n).toBe(1);
  });
});

// ── Calendário ──────────────────────────────────────────────────────────────────
describe('calendário', () => {
  it('gradeDoMes tem 42 células, começa no domingo e marca o mês corrente', () => {
    const g = gradeDoMes(2026, 5);  // junho/2026 (30 dias)
    expect(g).toHaveLength(42);
    expect(new Date(g[0].ymd + 'T12:00:00').getDay()).toBe(0);  // domingo
    expect(g.filter((c) => c.mesAtual)).toHaveLength(30);
    expect(g.find((c) => c.ymd === '2026-06-01')!.mesAtual).toBe(true);
  });
  it('acoesPorDia agrupa por data', () => {
    const m = acoesPorDia([mkAcao({ id: 'a1', data: '2026-06-10' }), mkAcao({ id: 'a2', data: '2026-06-10' }), mkAcao({ id: 'a3', data: '2026-06-11' })]);
    expect(m.get('2026-06-10')).toHaveLength(2);
    expect(m.get('2026-06-11')).toHaveLength(1);
  });
});

// ── UTM builder ─────────────────────────────────────────────────────────────────
describe('buildUTM', () => {
  it('adiciona utm_source/medium normalizados', () => {
    expect(buildUTM('https://x.com/p', { source: 'Instagram', medium: 'Social Post' }))
      .toBe('https://x.com/p?utm_source=instagram&utm_medium=social_post');
  });
  it('preserva params não-utm e substitui utm antigas', () => {
    expect(buildUTM('https://x.com?ref=abc', { source: 'a', medium: 'b' }))
      .toBe('https://x.com?ref=abc&utm_source=a&utm_medium=b');
    expect(buildUTM('https://x.com?utm_source=old&x=1', { source: 'new', medium: 'm' }))
      .toBe('https://x.com?x=1&utm_source=new&utm_medium=m');
  });
  it('codifica campaign e preserva o hash; base vazia → vazio', () => {
    expect(buildUTM('https://x.com/p', { source: 'a', medium: 'b', campaign: 'Verão 2026' }))
      .toBe('https://x.com/p?utm_source=a&utm_medium=b&utm_campaign=Ver%C3%A3o%202026');
    expect(buildUTM('https://x.com/p#sec', { source: 'a', medium: 'b' }))
      .toBe('https://x.com/p?utm_source=a&utm_medium=b#sec');
    expect(buildUTM('', { source: 'a', medium: 'b' })).toBe('');
  });
});

// ── Validação + CSV + util ──────────────────────────────────────────────────────
describe('validação, CSV e util', () => {
  it('validarCanal e validarAcao', () => {
    expect(validarCanal({ nome: '', custo_mensal_num: 0 })).toHaveLength(1);
    expect(validarCanal({ nome: 'Instagram', custo_mensal_num: -1 })).toHaveLength(1);
    expect(validarCanal({ nome: 'Instagram', custo_mensal_num: 300 })).toEqual([]);
    expect(validarAcao({ titulo: '', data: '', investimento_num: 0 })).toHaveLength(2);
    expect(validarAcao({ titulo: 'Post', data: '2026-06-10', investimento_num: 0 })).toEqual([]);
  });
  it('canaisToCSV inclui cabeçalho, n/d e escape', () => {
    const m = metricasPorCanal([mkCanal({ nome: 'Insta "Oficial"', origem_key: 'instagram', custo_mensal_num: 0 })], [], [mkLead({ origem: 'instagram', status: 'lead' })], 1);
    const csv = canaisToCSV(m, (n) => `R$ ${n}`, (f) => `${Math.round(f * 100)}%`);
    const linhas = csv.split('\n');
    expect(linhas[0]).toContain('Canal');
    expect(linhas[0]).toContain('ROI');
    expect(linhas[1]).toContain('"Insta ""Oficial"""');  // escape de aspas
    expect(linhas[1]).toContain('—');                     // CPL/CAC/ROI n/d (investimento 0)
  });
  it('isMissingTable reconhece PGRST205/42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: 'X' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
