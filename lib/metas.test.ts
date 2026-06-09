import { describe, it, expect } from 'vitest';
import {
  type Okr,
  todayYMD, diasAte,
  periodoDeOffset, parsePeriodoKey, fracaoDecorrida, periodoEncerrado,
  areaMeta, metricaMeta, metricasDaArea, AREAS, METRICAS,
  avaliarMeta, resumoQuadro,
  progressoKR, progressoOkr, normalizarKRs,
  isMissingTable,
} from './metas';

const HOJE = '2026-06-09'; // terça, mês 06 (Q2), 30 dias em junho

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('todayYMD formata o local', () => {
    expect(todayYMD(new Date(2026, 5, 9))).toBe('2026-06-09');
    expect(todayYMD(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
  it('diasAte conta com sinal correto e fuso-agnóstico', () => {
    expect(diasAte('2026-06-09', HOJE)).toBe(0);
    expect(diasAte('2026-06-19', HOJE)).toBe(10);
    expect(diasAte('2026-06-04', HOJE)).toBe(-5);
    expect(diasAte(null, HOJE)).toBeNull();
    expect(diasAte('lixo', HOJE)).toBeNull();
  });
});

// ── Período ─────────────────────────────────────────────────────────────────
describe('periodoDeOffset', () => {
  it('mês atual e anteriores/seguintes (com viradas de ano)', () => {
    expect(periodoDeOffset('mes', 0, HOJE)).toMatchObject({ key: '2026-06', ini: '2026-06-01', fim: '2026-06-30' });
    expect(periodoDeOffset('mes', -1, HOJE)).toMatchObject({ key: '2026-05', ini: '2026-05-01', fim: '2026-05-31' });
    expect(periodoDeOffset('mes', -6, HOJE)).toMatchObject({ key: '2025-12', ini: '2025-12-01', fim: '2025-12-31' });
    expect(periodoDeOffset('mes', 1, HOJE)).toMatchObject({ key: '2026-07', fim: '2026-07-31' });
  });
  it('fevereiro respeita ano bissexto', () => {
    // 2026-06 -4 meses = 2026-02 (não bissexto → 28)
    expect(periodoDeOffset('mes', -4, HOJE)).toMatchObject({ key: '2026-02', fim: '2026-02-28' });
    // a partir de 2024-06: -4 = 2024-02 (bissexto → 29)
    expect(periodoDeOffset('mes', -4, '2024-06-09')).toMatchObject({ key: '2024-02', fim: '2024-02-29' });
  });
  it('trimestre atual, anterior e virada de ano', () => {
    expect(periodoDeOffset('trimestre', 0, HOJE)).toMatchObject({ key: '2026-Q2', ini: '2026-04-01', fim: '2026-06-30' });
    expect(periodoDeOffset('trimestre', -1, HOJE)).toMatchObject({ key: '2026-Q1', ini: '2026-01-01', fim: '2026-03-31' });
    expect(periodoDeOffset('trimestre', -2, HOJE)).toMatchObject({ key: '2025-Q4', ini: '2025-10-01', fim: '2025-12-31' });
    expect(periodoDeOffset('trimestre', 1, HOJE)).toMatchObject({ key: '2026-Q3', ini: '2026-07-01', fim: '2026-09-30' });
  });
  it('ano atual e anterior', () => {
    expect(periodoDeOffset('ano', 0, HOJE)).toMatchObject({ key: '2026', ini: '2026-01-01', fim: '2026-12-31' });
    expect(periodoDeOffset('ano', -1, HOJE)).toMatchObject({ key: '2025', ini: '2025-01-01', fim: '2025-12-31' });
  });
});

describe('parsePeriodoKey — ida e volta', () => {
  it('reconstrói as três granularidades', () => {
    expect(parsePeriodoKey('2026')).toMatchObject({ gran: 'ano', ini: '2026-01-01', fim: '2026-12-31' });
    expect(parsePeriodoKey('2026-Q2')).toMatchObject({ gran: 'trimestre', ini: '2026-04-01', fim: '2026-06-30' });
    expect(parsePeriodoKey('2026-06')).toMatchObject({ gran: 'mes', ini: '2026-06-01', fim: '2026-06-30' });
  });
  it('casa com a chave de periodoDeOffset', () => {
    for (const gran of ['mes', 'trimestre', 'ano'] as const) {
      const p = periodoDeOffset(gran, -1, HOJE);
      expect(parsePeriodoKey(p.key)).toMatchObject({ ini: p.ini, fim: p.fim });
    }
  });
  it('rejeita chave inválida', () => {
    expect(parsePeriodoKey('lixo')).toBeNull();
    expect(parsePeriodoKey('2026-13')).toBeNull();
    expect(parsePeriodoKey('')).toBeNull();
  });
});

describe('fracaoDecorrida / periodoEncerrado', () => {
  const junho = periodoDeOffset('mes', 0, HOJE); // 2026-06, 30 dias
  it('mede a fração já decorrida (inclusiva por dia)', () => {
    // 9 de junho = 9 dias decorridos de 30
    expect(fracaoDecorrida(junho, HOJE)).toBeCloseTo(9 / 30, 5);
  });
  it('0 antes do início, 1 depois do fim', () => {
    expect(fracaoDecorrida(junho, '2026-05-01')).toBe(0);
    expect(fracaoDecorrida(junho, '2026-07-15')).toBe(1);
    expect(fracaoDecorrida(junho, '2026-06-30')).toBe(1); // último dia → completo
  });
  it('periodoEncerrado só após o fim', () => {
    expect(periodoEncerrado(junho, HOJE)).toBe(false);
    expect(periodoEncerrado(junho, '2026-07-01')).toBe(true);
    expect(periodoEncerrado(periodoDeOffset('mes', -1, HOJE), HOJE)).toBe(true);
  });
});

// ── Catálogos ─────────────────────────────────────────────────────────────────
describe('catálogos de área e métrica', () => {
  it('áreas têm rótulo e cor', () => {
    expect(AREAS).toHaveLength(5);
    expect(areaMeta('financeiro').label).toBe('Financeiro');
    expect(areaMeta('inexistente').cor).toBe('#94a3b8');
  });
  it('métricas-núcleo do Financeiro reusam metas_financeiras', () => {
    expect(metricaMeta('receita').store).toBe('metas_financeiras');
    expect(metricaMeta('lucro').store).toBe('metas_financeiras');
    expect(metricaMeta('adimplencia').store).toBe('metas_financeiras');
    // o resto vai para a tabela metas
    expect(metricaMeta('eventos').store).toBe('metas');
    expect(metricaMeta('nps').store).toBe('metas');
  });
  it('sentido e unidade coerentes (teto = menor melhor)', () => {
    expect(metricaMeta('despesa').sentido).toBe('menor_melhor');
    expect(metricaMeta('cac').sentido).toBe('menor_melhor');
    expect(metricaMeta('receita').sentido).toBe('maior_melhor');
    expect(metricaMeta('nps').unidade).toBe('nps');
    expect(metricaMeta('avaliacao').unidade).toBe('nota');
  });
  it('métrica desconhecida cai em fallback manual', () => {
    const m = metricaMeta('zzz');
    expect(m.auto).toBe(false);
    expect(m.store).toBe('metas');
  });
  it('metricasDaArea filtra corretamente', () => {
    const com = metricasDaArea('comercial');
    expect(com.length).toBeGreaterThan(0);
    expect(com.every((m) => m.area === 'comercial')).toBe(true);
    expect(METRICAS.every((m) => AREAS.some((a) => a.v === m.area))).toBe(true);
  });
});

// ── avaliarMeta: maior_melhor ─────────────────────────────────────────────────
describe('avaliarMeta — maior_melhor (piso)', () => {
  it('meta batida = verde + atingida', () => {
    const a = avaliarMeta(10000, 12000, 'maior_melhor', 0.5);
    expect(a.atingida).toBe(true);
    expect(a.semaforo).toBe('verde');
    expect(a.emRisco).toBe(false);
    expect(a.pct).toBeCloseTo(1.2, 5);
  });
  it('run-rate projeta o fechamento (meio do período no ritmo certo)', () => {
    // 50% do período, metade do alvo → projeção bate o alvo → verde, sem risco
    const a = avaliarMeta(10000, 5000, 'maior_melhor', 0.5);
    expect(a.projecao).toBeCloseTo(10000, 5);
    expect(a.projPct).toBeCloseTo(1, 5);
    expect(a.emRisco).toBe(false);
    expect(a.semaforo).toBe('verde');
  });
  it('ritmo fraco no meio do período = em risco', () => {
    // 50% decorrido mas só 20% do alvo → projeção 40% → vermelho + em risco
    const a = avaliarMeta(10000, 2000, 'maior_melhor', 0.5);
    expect(a.projPct).toBeCloseTo(0.4, 5);
    expect(a.emRisco).toBe(true);
    expect(a.semaforo).toBe('vermelho');
  });
  it('ritmo intermediário = amarelo', () => {
    // 50% decorrido, 40% do alvo → projeção 80% → amarelo
    const a = avaliarMeta(10000, 4000, 'maior_melhor', 0.5);
    expect(a.projPct).toBeCloseTo(0.8, 5);
    expect(a.semaforo).toBe('amarelo');
    expect(a.emRisco).toBe(true);
  });
  it('período encerrado avalia pelo realizado, sem risco e sem projeção mágica', () => {
    const a = avaliarMeta(10000, 7000, 'maior_melhor', 1);
    expect(a.emRisco).toBe(false);       // não há mais o que projetar
    expect(a.semaforo).toBe('amarelo');  // 70% atingido
    expect(a.projecao).toBeCloseTo(7000, 5);
  });
  it('alvo zero não quebra', () => {
    expect(avaliarMeta(0, 0, 'maior_melhor', 0.5).pct).toBe(0);
    expect(avaliarMeta(0, 100, 'maior_melhor', 0.5).pct).toBe(1);
  });
});

// ── avaliarMeta: menor_melhor (teto) ──────────────────────────────────────────
describe('avaliarMeta — menor_melhor (teto)', () => {
  it('dentro do teto e projetando ficar dentro = verde', () => {
    // teto 10000, gastou 4000 em 50% → projeção 8000 ≤ 10000 → verde
    const a = avaliarMeta(10000, 4000, 'menor_melhor', 0.5);
    expect(a.projecao).toBeCloseTo(8000, 5);
    expect(a.emRisco).toBe(false);
    expect(a.atingida).toBe(true); // realizado atual ainda ≤ teto
    expect(a.semaforo).toBe('verde');
  });
  it('projeção estoura o teto = em risco + vermelho', () => {
    // teto 10000, gastou 8000 em 50% → projeção 16000 > teto → em risco
    const a = avaliarMeta(10000, 8000, 'menor_melhor', 0.5);
    expect(a.projecao).toBeCloseTo(16000, 5);
    expect(a.emRisco).toBe(true);
    expect(a.semaforo).toBe('vermelho');
  });
  it('período encerrado: avalia se ficou sob o teto', () => {
    expect(avaliarMeta(10000, 9000, 'menor_melhor', 1)).toMatchObject({ atingida: true, semaforo: 'verde', emRisco: false });
    expect(avaliarMeta(10000, 12000, 'menor_melhor', 1)).toMatchObject({ atingida: false, semaforo: 'vermelho' });
  });
});

// ── resumoQuadro ──────────────────────────────────────────────────────────────
describe('resumoQuadro', () => {
  it('conta semáforos, atingidas, em risco e média de atingimento', () => {
    const avs = [
      avaliarMeta(100, 120, 'maior_melhor', 0.5), // verde, atingida, pct cap 1
      avaliarMeta(100, 20, 'maior_melhor', 0.5),  // projPct .4 → vermelho + risco
      avaliarMeta(100, 20, 'maior_melhor', 0.5),  // idem
    ];
    const r = resumoQuadro(avs);
    expect(r.total).toBe(3);
    expect(r.verde).toBe(1);
    expect(r.vermelho).toBe(2);
    expect(r.atingidas).toBe(1);
    expect(r.emRisco).toBe(2);
    expect(r.atingimentoMedio).toBeCloseTo((1 + 0.2 + 0.2) / 3, 5);
  });
  it('quadro vazio é seguro', () => {
    expect(resumoQuadro([])).toMatchObject({ total: 0, atingimentoMedio: 0 });
  });
});

// ── OKRs ──────────────────────────────────────────────────────────────────────
describe('progressoKR', () => {
  it('progride do baseline ao alvo (subindo)', () => {
    expect(progressoKR({ inicial: 0, alvo: 100, atual: 50 })).toBeCloseTo(0.5, 5);
    expect(progressoKR({ inicial: 20, alvo: 120, atual: 70 })).toBeCloseTo(0.5, 5);
  });
  it('progride com alvo abaixo do baseline (descendo, ex.: reduzir churn)', () => {
    expect(progressoKR({ inicial: 100, alvo: 0, atual: 75 })).toBeCloseTo(0.25, 5);
    expect(progressoKR({ inicial: 100, alvo: 0, atual: 0 })).toBe(1);
  });
  it('limita a 0..1 e trata span zero', () => {
    expect(progressoKR({ inicial: 0, alvo: 100, atual: 200 })).toBe(1);
    expect(progressoKR({ inicial: 0, alvo: 100, atual: -5 })).toBe(0);
    expect(progressoKR({ inicial: 50, alvo: 50, atual: 50 })).toBe(1);
    expect(progressoKR({ inicial: 50, alvo: 50, atual: 10 })).toBe(0);
  });
});

describe('progressoOkr', () => {
  const okr: Okr = {
    objetivo: 'Ser referência regional',
    trimestre: '2026-Q2',
    krs: [
      { id: 'k1', titulo: 'Eventos', unidade: 'numero', inicial: 0, alvo: 10, atual: 10, metrica: 'eventos' },
      { id: 'k2', titulo: 'NPS', unidade: 'nps', inicial: 0, alvo: 80, atual: 40, metrica: 'nps' },
    ],
  };
  it('média dos KRs + status', () => {
    const p = progressoOkr(okr);
    expect(p.total).toBe(2);
    expect(p.concluidos).toBe(1);
    expect(p.progresso).toBeCloseTo(0.75, 5); // (1 + 0.5)/2
    expect(p.status).toBe('no_caminho');
  });
  it('status escala com o progresso', () => {
    expect(progressoOkr({ objetivo: '', trimestre: '2026-Q2', krs: [{ id: 'a', titulo: '', unidade: 'numero', inicial: 0, alvo: 100, atual: 100, metrica: null }] }).status).toBe('concluido');
    expect(progressoOkr({ objetivo: '', trimestre: '2026-Q2', krs: [{ id: 'a', titulo: '', unidade: 'numero', inicial: 0, alvo: 100, atual: 20, metrica: null }] }).status).toBe('em_risco');
  });
  it('OKR sem KRs não quebra', () => {
    expect(progressoOkr({ objetivo: '', trimestre: '2026-Q2', krs: [] })).toMatchObject({ progresso: 0, status: 'em_risco', total: 0 });
  });
});

describe('normalizarKRs', () => {
  it('coage o jsonb em KR[] consistente', () => {
    const krs = normalizarKRs([
      { titulo: 'A', unidade: 'moeda', inicial: '10', alvo: '100', atual: '55' },
      { titulo: 'B', unidade: 'lixo' },
      'nao-objeto',
    ]);
    expect(krs).toHaveLength(3);
    expect(krs[0]).toMatchObject({ titulo: 'A', unidade: 'moeda', inicial: 10, alvo: 100, atual: 55 });
    expect(krs[1].unidade).toBe('numero'); // unidade inválida → numero
    expect(krs[0].id).toBeTruthy();
  });
  it('entrada não-array vira []', () => {
    expect(normalizarKRs(null)).toEqual([]);
    expect(normalizarKRs({})).toEqual([]);
  });
});

// ── isMissingTable ────────────────────────────────────────────────────────────
describe('isMissingTable', () => {
  it('reconhece os códigos REST/PG de tabela ausente', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
