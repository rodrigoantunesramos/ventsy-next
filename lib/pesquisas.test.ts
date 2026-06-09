import { describe, it, expect } from 'vitest';
import {
  type RespostaPesquisa, type Pesquisa,
  categoriaNps, zonaNps, npsScore, distribuicaoNps, pctCategoria,
  serieMensalNps, comparativoNps, npsPorChave, detratoresRecentes,
  extrairNps, extrairComentario, perguntaNpsDe,
  normalizarPerguntas, normalizarRespostas, validarPesquisa, diasDisparo,
  npsParaNota5, templatePerguntas, isMissingTable, respostasToCSV,
  NPS_PROMOTOR_MIN, NPS_NEUTRO_MIN, GATILHO_PADRAO_DIAS,
} from './pesquisas';

// Fábrica enxuta de respostas (só o que as agregações leem).
function resp(nps: number | null, criado_em = '2026-06-01T12:00:00Z', extra: Partial<RespostaPesquisa> = {}): RespostaPesquisa {
  return {
    id: Math.random().toString(36).slice(2), pesquisa_id: 'p1', usuario_id: 'u1',
    evento_id: null, cliente_id: null, propriedade_id: null, autor_nome: null, autor_contato: null,
    respostas: {}, nps, categoria: nps != null ? categoriaNps(nps) : null, comentario: null, criado_em,
    ...extra,
  };
}

describe('categoriaNps — fronteiras 0–6 / 7–8 / 9–10', () => {
  it('classifica detrator/neutro/promotor nas bordas', () => {
    expect(categoriaNps(0)).toBe('detrator');
    expect(categoriaNps(6)).toBe('detrator');
    expect(categoriaNps(7)).toBe('neutro');
    expect(categoriaNps(8)).toBe('neutro');
    expect(categoriaNps(9)).toBe('promotor');
    expect(categoriaNps(10)).toBe('promotor');
    expect(NPS_PROMOTOR_MIN).toBe(9);
    expect(NPS_NEUTRO_MIN).toBe(7);
  });
  it('clampa valores fora da faixa e arredonda', () => {
    expect(categoriaNps(-3)).toBe('detrator');
    expect(categoriaNps(99)).toBe('promotor');
    expect(categoriaNps(8.6)).toBe('promotor'); // 9
  });
});

describe('npsScore = %promotores − %detratores', () => {
  it('todos promotores ⇒ 100', () => {
    expect(npsScore([resp(10), resp(9)])).toBe(100);
  });
  it('todos detratores ⇒ −100', () => {
    expect(npsScore([resp(0), resp(6)])).toBe(-100);
  });
  it('mistura clássica: 6 prom, 2 neutros, 2 detr ⇒ 40', () => {
    const list = [...Array(6)].map(() => resp(10)).concat([resp(7), resp(8)], [resp(3), resp(1)]);
    // (6 - 2) / 10 = 0.4 → 40
    expect(npsScore(list)).toBe(40);
  });
  it('lista vazia ⇒ 0 (sem divisão por zero)', () => {
    expect(npsScore([])).toBe(0);
  });
  it('ignora respostas sem NPS', () => {
    expect(npsScore([resp(10), resp(null)])).toBe(100);
  });
  it('arredonda para inteiro', () => {
    // 1 prom, 2 detr de 3 ⇒ (1-2)/3 = -0.333 → -33
    expect(npsScore([resp(9), resp(0), resp(1)])).toBe(-33);
  });
});

describe('distribuicaoNps / pctCategoria', () => {
  it('conta por categoria e total só com NPS', () => {
    const d = distribuicaoNps([resp(10), resp(7), resp(2), resp(null)]);
    expect(d).toEqual({ promotor: 1, neutro: 1, detrator: 1, total: 3 });
  });
  it('frações somam ~1', () => {
    const p = pctCategoria([resp(10), resp(7), resp(2)]);
    expect(p.promotor + p.neutro + p.detrator).toBeCloseTo(1, 5);
  });
  it('deriva categoria do nps quando a coluna vem nula', () => {
    const d = distribuicaoNps([resp(10, '2026-06-01', { categoria: null })]);
    expect(d.promotor).toBe(1);
  });
});

describe('serieMensalNps', () => {
  it('agrupa por mês e devolve n meses', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const list = [resp(10, '2026-06-02T12:00:00Z'), resp(0, '2026-05-10T12:00:00Z')];
    const s = serieMensalNps(list, now, 6);
    expect(s).toHaveLength(6);
    expect(s[s.length - 1].ym).toBe('2026-06');
    expect(s[s.length - 1].nps).toBe(100);
    expect(s[s.length - 2].nps).toBe(-100); // maio
  });
});

describe('comparativoNps — janela atual vs anterior', () => {
  it('compara dois períodos de mesmo tamanho', () => {
    const now = new Date('2026-06-30T12:00:00Z');
    const atual = resp(10, '2026-06-20T12:00:00Z');     // dentro dos últimos 30d
    const anterior = resp(0, '2026-05-20T12:00:00Z');   // 30–60d atrás
    const c = comparativoNps([atual, anterior], 30, now);
    expect(c.atual).toBe(100);
    expect(c.anterior).toBe(-100);
    expect(c.nAtual).toBe(1);
    expect(c.nAnterior).toBe(1);
  });
});

describe('npsPorChave', () => {
  it('agrupa por chave, ordena por volume e descarta grupos sem NPS', () => {
    const list = [
      resp(10, '2026-06-01', { propriedade_id: 1 }),
      resp(0, '2026-06-01', { propriedade_id: 1 }),
      resp(9, '2026-06-01', { propriedade_id: 2 }),
    ];
    const r = npsPorChave(list, (x) => (x.propriedade_id != null ? `P${x.propriedade_id}` : null));
    expect(r[0].chave).toBe('P1'); // maior volume primeiro
    expect(r[0].nps).toBe(0);      // (1-1)/2
    expect(r[1].chave).toBe('P2');
    expect(r[1].nps).toBe(100);
  });
});

describe('detratoresRecentes', () => {
  it('pega só detratores dentro da janela', () => {
    const now = new Date('2026-06-30T12:00:00Z');
    const list = [
      resp(2, '2026-06-25T12:00:00Z'),   // detrator recente
      resp(3, '2026-01-01T12:00:00Z'),   // detrator antigo (fora de 30d)
      resp(10, '2026-06-25T12:00:00Z'),  // promotor
    ];
    expect(detratoresRecentes(list, now, 30)).toHaveLength(1);
  });
});

describe('extrairNps / extrairComentario / perguntaNpsDe', () => {
  const pesquisa = { perguntas: templatePerguntas('nps') } as Pesquisa;
  it('lê a nota da 1ª pergunta NPS', () => {
    const npsQ = perguntaNpsDe(pesquisa)!;
    expect(extrairNps({ [npsQ.id]: 9 }, pesquisa)).toBe(9);
  });
  it('rejeita nota fora de 0–10', () => {
    const npsQ = perguntaNpsDe(pesquisa)!;
    expect(extrairNps({ [npsQ.id]: 11 }, pesquisa)).toBeNull();
    expect(extrairNps({ [npsQ.id]: -1 }, pesquisa)).toBeNull();
  });
  it('extrai o 1º texto não-vazio como comentário', () => {
    const txtQ = pesquisa.perguntas.find((q) => q.tipo === 'texto')!;
    expect(extrairComentario({ [txtQ.id]: '  ótimo  ' }, pesquisa)).toBe('ótimo');
  });
});

describe('normalização', () => {
  it('normalizarPerguntas tolera string JSON e descarta tipos inválidos', () => {
    const raw = JSON.stringify([
      { id: 'a', tipo: 'nps', titulo: 'N' },
      { id: 'b', tipo: 'inexistente', titulo: 'X' },
      { id: 'c', tipo: 'multipla', titulo: 'M' }, // sem opções → recebe default
    ]);
    const out = normalizarPerguntas(raw);
    expect(out).toHaveLength(2);
    expect(out[1].opcoes?.length).toBeGreaterThanOrEqual(2);
  });
  it('normalizarRespostas tolera string e objeto', () => {
    expect(normalizarRespostas('{"q":3}')).toEqual({ q: 3 });
    expect(normalizarRespostas({ q: 1 })).toEqual({ q: 1 });
    expect(normalizarRespostas('lixo')).toEqual({});
    expect(normalizarRespostas([1, 2])).toEqual({});
  });
});

describe('validarPesquisa', () => {
  const base = { titulo: 'T', perguntas: templatePerguntas('nps'), gatilho: 'manual' as const, dias_apos: null };
  it('aprova uma pesquisa válida', () => {
    expect(validarPesquisa(base)).toBeNull();
  });
  it('exige título e pelo menos uma pergunta', () => {
    expect(validarPesquisa({ ...base, titulo: '  ' })).toMatch(/título/i);
    expect(validarPesquisa({ ...base, perguntas: [] })).toMatch(/pergunta/i);
  });
  it('múltipla precisa de 2+ opções', () => {
    const perguntas = [{ id: 'q', tipo: 'multipla' as const, titulo: 'M', opcoes: ['só uma'] }];
    expect(validarPesquisa({ ...base, perguntas })).toMatch(/opç/i);
  });
  it('dias_apos exige número válido', () => {
    expect(validarPesquisa({ ...base, gatilho: 'dias_apos', dias_apos: 0 })).toMatch(/dias/i);
  });
});

describe('diasDisparo / npsParaNota5 / zonaNps', () => {
  it('manual não dispara; pos_evento usa padrão; dias_apos usa o valor', () => {
    expect(diasDisparo({ gatilho: 'manual', dias_apos: null })).toBeNull();
    expect(diasDisparo({ gatilho: 'pos_evento', dias_apos: null })).toBe(GATILHO_PADRAO_DIAS);
    expect(diasDisparo({ gatilho: 'dias_apos', dias_apos: 7 })).toBe(7);
  });
  it('mapeia NPS 0–10 → nota 1–5', () => {
    expect(npsParaNota5(0)).toBe(1);
    expect(npsParaNota5(10)).toBe(5);
    expect(npsParaNota5(5)).toBeGreaterThanOrEqual(2);
  });
  it('zonaNps cobre as bandas', () => {
    expect(zonaNps(80).label).toBe('Excelente');
    expect(zonaNps(60).label).toBe('Ótimo');
    expect(zonaNps(10).label).toBe('Razoável');
    expect(zonaNps(-20).label).toBe('Crítico');
  });
});

describe('isMissingTable / respostasToCSV', () => {
  it('detecta PGRST205 e 42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: 'XYZ' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
  it('gera CSV com cabeçalho e linhas', () => {
    const csv = respostasToCSV([resp(10, '2026-06-01', { autor_nome: 'Ana', comentario: 'top' })], {
      pesquisaTitulo: () => 'NPS', propNome: () => 'Salão', eventoNome: () => 'Festa', fmtDate: (s) => s,
    });
    const linhas = csv.split('\n');
    expect(linhas[0]).toContain('NPS');
    expect(linhas[1]).toContain('Ana');
    expect(linhas[1]).toContain('10');
  });
});
