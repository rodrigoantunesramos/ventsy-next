import { describe, it, expect } from 'vitest';
import {
  type Feedback, type FeedbackAcao,
  CRITERIOS, NOTA_MIN_PROMOVER,
  normalizarCriterios, csat, pctSatisfeitos, distribuicaoNotas, notaPorCriterio,
  serieMensal, comparativoCsat, distribuicaoStatus, pctViraramAcao,
  tempoMedioResolucaoDias, acaoAtrasada, acoesAtrasadas, acoesPendentes,
  dentroPeriodo, notaPorChave, podePromover, isMissingTable, feedbacksToCSV, ymd, diffDias,
} from '@/lib/feedback';

// ── Fábricas ──────────────────────────────────────────────────────────────────
// Spread de `p` por último: respeita overrides explícitos com null (ex.: nota_geral: null).
function mkFb(p: Partial<Feedback> = {}): Feedback {
  return {
    id: 'f1', usuario_id: 'u1', cliente_id: null, evento_id: null, propriedade_id: null,
    autor_nome: 'Cliente', autor_contato: null, canal: 'formulario', nota_geral: 5,
    criterios: {}, comentario: null, pontos_positivos: null, pontos_negativos: null,
    permite_publicar: false, status: 'novo', resposta_privada: null, respondido_em: null,
    promovida_avaliacao_id: null, resolvido_em: null,
    criado_em: '2026-06-01T12:00:00Z', atualizado_em: '2026-06-01T12:00:00Z',
    ...p,
  };
}
function mkAcao(p: Partial<FeedbackAcao> = {}): FeedbackAcao {
  return {
    id: 'a1', feedback_id: 'f1', usuario_id: 'u1', descricao: 'Ação', responsavel: null,
    prazo: null, status: 'aberta', concluida_em: null, criado_em: '2026-06-01T12:00:00Z',
    ...p,
  };
}
const NOW = new Date('2026-06-08T12:00:00Z');

// ── Datas ─────────────────────────────────────────────────────────────────────
describe('datas', () => {
  it('ymd formata local sem off-by-one', () => {
    expect(ymd(new Date('2026-06-08T12:00:00Z'))).toMatch(/^2026-06-0[78]$/);
  });
  it('diffDias conta dias decorridos', () => {
    expect(diffDias('2026-06-01', new Date('2026-06-08T12:00:00'))).toBe(7);
    expect(diffDias('lixo', NOW)).toBe(0);
  });
});

// ── Normalização de critérios ──────────────────────────────────────────────────
describe('normalizarCriterios', () => {
  it('aceita objeto e descarta valores fora de 1–5', () => {
    expect(normalizarCriterios({ atendimento: 5, estrutura: 0, limpeza: 7, organizacao: 3 }))
      .toEqual({ atendimento: 5, organizacao: 3 });
  });
  it('parseia string JSON e arredonda', () => {
    expect(normalizarCriterios('{"atendimento":"4","x":"3.6"}')).toEqual({ atendimento: 4, x: 4 });
  });
  it('tolera lixo', () => {
    expect(normalizarCriterios(null)).toEqual({});
    expect(normalizarCriterios('not json')).toEqual({});
    expect(normalizarCriterios(42)).toEqual({});
  });
});

// ── CSAT / satisfação / distribuição ───────────────────────────────────────────
describe('csat e satisfação', () => {
  const list = [mkFb({ nota_geral: 5 }), mkFb({ nota_geral: 4 }), mkFb({ nota_geral: 2 }), mkFb({ nota_geral: null })];
  it('csat ignora feedbacks sem nota', () => {
    expect(csat(list)).toBeCloseTo((5 + 4 + 2) / 3, 5);
    expect(csat([])).toBe(0);
  });
  it('pctSatisfeitos = nota ≥ 4 sobre o total com nota', () => {
    expect(pctSatisfeitos(list)).toBeCloseTo(2 / 3, 5);
    expect(pctSatisfeitos([])).toBe(0);
  });
  it('distribuicaoNotas indexa 0=nota1 … 4=nota5', () => {
    const d = distribuicaoNotas([mkFb({ nota_geral: 5 }), mkFb({ nota_geral: 5 }), mkFb({ nota_geral: 2 }), mkFb({ nota_geral: null })]);
    expect(d).toEqual([0, 1, 0, 0, 2]);
  });
});

// ── Nota por critério (eixos do radar) ──────────────────────────────────────────
describe('notaPorCriterio', () => {
  it('sempre devolve todos os CRITERIOS, média só dos presentes', () => {
    const list = [
      mkFb({ criterios: { atendimento: 5, estrutura: 3 } }),
      mkFb({ criterios: { atendimento: 3 } }),
    ];
    const r = notaPorCriterio(list);
    expect(r).toHaveLength(CRITERIOS.length);
    const at = r.find((x) => x.v === 'atendimento')!;
    expect(at.media).toBeCloseTo(4, 5);
    expect(at.n).toBe(2);
    const est = r.find((x) => x.v === 'estrutura')!;
    expect(est.media).toBe(3);
    expect(est.n).toBe(1);
    const limp = r.find((x) => x.v === 'limpeza')!;
    expect(limp).toMatchObject({ media: 0, n: 0 });
  });
});

// ── Séries e comparativo ────────────────────────────────────────────────────────
describe('serieMensal e comparativo', () => {
  it('serieMensal cobre os últimos n meses em ordem', () => {
    const s = serieMensal([mkFb({ nota_geral: 4, criado_em: '2026-06-02T10:00:00Z' })], NOW, 3);
    expect(s).toHaveLength(3);
    expect(s[2].ym).toBe('2026-06');
    expect(s[2].n).toBe(1);
    expect(s[2].media).toBe(4);
    expect(s[0].n).toBe(0);
  });
  it('comparativoCsat separa janela atual e anterior', () => {
    const list = [
      mkFb({ nota_geral: 5, criado_em: '2026-06-05T12:00:00Z' }), // dentro de 30d
      mkFb({ nota_geral: 3, criado_em: '2026-04-20T12:00:00Z' }), // janela anterior (30–60d)
    ];
    const c = comparativoCsat(list, 30, NOW);
    expect(c.nAtual).toBe(1);
    expect(c.atual).toBe(5);
    expect(c.nAnterior).toBe(1);
    expect(c.anterior).toBe(3);
  });
});

// ── Status / ações / resolução ──────────────────────────────────────────────────
describe('status, ações e resolução', () => {
  it('distribuicaoStatus conta por status', () => {
    const d = distribuicaoStatus([mkFb({ status: 'novo' }), mkFb({ status: 'resolvido' }), mkFb({ status: 'resolvido' })]);
    expect(d).toEqual({ novo: 1, em_tratativa: 0, resolvido: 2 });
  });
  it('pctViraramAcao = feedbacks com ≥1 ação / total', () => {
    const list = [mkFb({ id: 'f1' }), mkFb({ id: 'f2' })];
    const acoes = [mkAcao({ feedback_id: 'f1' })];
    expect(pctViraramAcao(list, acoes)).toBe(0.5);
    expect(pctViraramAcao([], acoes)).toBe(0);
  });
  it('tempoMedioResolucaoDias usa só resolvidos com carimbo', () => {
    const list = [
      mkFb({ status: 'resolvido', criado_em: '2026-06-01T00:00:00Z', resolvido_em: '2026-06-03T00:00:00Z' }),
      mkFb({ status: 'resolvido', criado_em: '2026-06-01T00:00:00Z', resolvido_em: '2026-06-05T00:00:00Z' }),
      mkFb({ status: 'novo' }),
    ];
    expect(tempoMedioResolucaoDias(list)).toBeCloseTo(3, 5); // (2 + 4) / 2
    expect(tempoMedioResolucaoDias([mkFb({ status: 'novo' })])).toBe(0);
  });
  it('acaoAtrasada: prazo passou e não concluída/cancelada', () => {
    expect(acaoAtrasada(mkAcao({ prazo: '2026-06-01' }), NOW)).toBe(true);
    expect(acaoAtrasada(mkAcao({ prazo: '2026-06-01', status: 'concluida' }), NOW)).toBe(false);
    expect(acaoAtrasada(mkAcao({ prazo: '2026-06-20' }), NOW)).toBe(false);
    expect(acaoAtrasada(mkAcao({ prazo: null }), NOW)).toBe(false);
  });
  it('acoesAtrasadas / acoesPendentes filtram corretamente', () => {
    const acoes = [mkAcao({ id: 'a1', prazo: '2026-06-01' }), mkAcao({ id: 'a2', status: 'concluida' }), mkAcao({ id: 'a3', status: 'em_andamento' })];
    expect(acoesAtrasadas(acoes, NOW).map((a) => a.id)).toEqual(['a1']);
    expect(acoesPendentes(acoes).map((a) => a.id)).toEqual(['a1', 'a3']);
  });
});

// ── Período / por chave / promoção ──────────────────────────────────────────────
describe('período, agrupamento e promoção', () => {
  it('dentroPeriodo respeita a janela (0 = tudo)', () => {
    expect(dentroPeriodo(mkFb({ criado_em: '2026-06-07T12:00:00Z' }), 30, NOW)).toBe(true);
    expect(dentroPeriodo(mkFb({ criado_em: '2026-01-01T12:00:00Z' }), 30, NOW)).toBe(false);
    expect(dentroPeriodo(mkFb({ criado_em: '2020-01-01T12:00:00Z' }), 0, NOW)).toBe(true);
  });
  it('notaPorChave agrupa e ordena por volume', () => {
    const list = [
      mkFb({ propriedade_id: 1, nota_geral: 4 }), mkFb({ propriedade_id: 1, nota_geral: 2 }),
      mkFb({ propriedade_id: 2, nota_geral: 5 }),
    ];
    const r = notaPorChave(list, (f) => (f.propriedade_id != null ? `P${f.propriedade_id}` : null));
    expect(r[0]).toMatchObject({ chave: 'P1', n: 2, media: 3 });
    expect(r[1]).toMatchObject({ chave: 'P2', n: 1, media: 5 });
  });
  it('podePromover exige autorização, nota alta e não-promovido', () => {
    expect(podePromover(mkFb({ permite_publicar: true, nota_geral: NOTA_MIN_PROMOVER }))).toBe(true);
    expect(podePromover(mkFb({ permite_publicar: false, nota_geral: 5 }))).toBe(false);
    expect(podePromover(mkFb({ permite_publicar: true, nota_geral: 3 }))).toBe(false);
    expect(podePromover(mkFb({ permite_publicar: true, nota_geral: 5, promovida_avaliacao_id: 9 }))).toBe(false);
  });
});

// ── Infra ───────────────────────────────────────────────────────────────────────
describe('infra', () => {
  it('isMissingTable detecta PGRST205 e 42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
  it('feedbacksToCSV gera cabeçalho com critérios e linha por feedback', () => {
    const csv = feedbacksToCSV([mkFb({ nota_geral: 5, criterios: { atendimento: 4 }, comentario: 'ótimo "show"', evento_id: 'e1', propriedade_id: 1 })], {
      propNome: () => 'Salão A', eventoNome: () => 'Casamento', fmtDate: () => '01/06/2026',
    });
    const linhas = csv.split('\n');
    expect(linhas[0]).toContain('Atendimento');
    expect(linhas[0]).toContain('Nota geral');
    expect(linhas[1]).toContain('Salão A');
    expect(linhas[1]).toContain('Casamento');
    expect(linhas[1]).toContain('""show""'); // aspas escapadas
  });
});
