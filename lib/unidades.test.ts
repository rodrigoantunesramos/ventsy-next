import { describe, it, expect } from 'vitest';
import {
  type PropriedadeLite, type LancamentoLite, type EventoLite, type UnidadeConfig, type Unidade, type UnidadeAcesso,
  diasAte, dentroDaJanela, janelaPreset,
  grupoFunil, eventoGanho, eventoEmNegociacao,
  configPadrao, montarUnidades, nomeUnidade,
  diasOcupados, metricasUnidade, metricasTodas, consolidar,
  ranking, benchmark, valorMetrica, royaltiesUnidade, naoAtribuidos,
  unidadesVisiveis, membroPodeVer,
  tipoGrupoMeta, isMissingTable,
} from './unidades';

const HOJE = '2026-06-09';

// ── Fábricas enxutas ──────────────────────────────────────────────────────────
function prop(p: Partial<PropriedadeLite> = {}): PropriedadeLite {
  return {
    id: 1, nome: 'Espaço Centro', cidade: 'São Paulo', estado: 'SP', categoria: 'Salão',
    tipo_propriedade: 'salao', capacidade: 200, avaliacao: 4.5, imagem_url: null, publicada: true, ...p,
  };
}
function cfg(p: Partial<UnidadeConfig> = {}): UnidadeConfig {
  return { ...configPadrao(1), ...p };
}
function lanc(p: Partial<LancamentoLite> = {}): LancamentoLite {
  return { prop_id: 1, tipo: 'receita', valor: 1000, data: '2026-06-01', ...p };
}
function evt(p: Partial<EventoLite> = {}): EventoLite {
  return { propriedade_id: 1, status: 'contratado', valor_total_num: 5000, data_inicio: '2026-06-05', data_fim: null, ...p };
}

describe('datas e janelas', () => {
  it('diasAte conta com sinal correto e é fuso-agnóstico', () => {
    expect(diasAte('2026-06-09', HOJE)).toBe(0);
    expect(diasAte('2026-06-19', HOJE)).toBe(10);
    expect(diasAte('2026-06-04', HOJE)).toBe(-5);
    expect(diasAte(null, HOJE)).toBeNull();
    expect(diasAte('lixo', HOJE)).toBeNull();
  });
  it('dentroDaJanela inclui as bordas', () => {
    expect(dentroDaJanela('2026-06-01', '2026-06-01', '2026-06-30')).toBe(true);
    expect(dentroDaJanela('2026-06-30', '2026-06-01', '2026-06-30')).toBe(true);
    expect(dentroDaJanela('2026-07-01', '2026-06-01', '2026-06-30')).toBe(false);
    expect(dentroDaJanela(null, '2026-06-01', '2026-06-30')).toBe(false);
  });
  it('janelaPreset monta de/ate e conta dias inclusivos', () => {
    expect(janelaPreset('mes', HOJE)).toMatchObject({ de: '2026-06-01', ate: '2026-06-09', dias: 9 });
    expect(janelaPreset('ano', HOJE)).toMatchObject({ de: '2026-01-01', ate: '2026-06-09' });
    const j12 = janelaPreset('12m', HOJE);
    expect(j12.ate).toBe(HOJE);
    expect(j12.de).toBe('2025-06-10'); // 12 meses corridos = 365/366 dias
    expect(j12.dias).toBe(365);
    expect(janelaPreset('tudo', HOJE).de).toBe('2000-01-01');
  });
});

describe('funil', () => {
  it('agrupa status e identifica ganhos/negociação', () => {
    expect(grupoFunil('contratado')).toBe('contratados');
    expect(grupoFunil('finalizado')).toBe('finalizados');
    expect(grupoFunil('lead')).toBe('negociando');
    expect(grupoFunil('perdido')).toBe('perdidos');
    expect(grupoFunil(null)).toBe('negociando');
    expect(eventoGanho('contratado')).toBe(true);
    expect(eventoGanho('finalizado')).toBe(true);
    expect(eventoGanho('lead')).toBe(false);
    expect(eventoGanho('perdido')).toBe(false);
    expect(eventoEmNegociacao('negociacao')).toBe(true);
    expect(eventoEmNegociacao('contratado')).toBe(false);
  });
});

describe('montarUnidades / nomeUnidade', () => {
  it('casa propriedade com config, aplica padrão e ordena', () => {
    const props = [prop({ id: 2, nome: 'Beta' }), prop({ id: 1, nome: 'Alfa' })];
    const configs = [cfg({ propriedade_id: 1, ordem: 2 }), cfg({ propriedade_id: 2, ordem: 1 })];
    const us = montarUnidades(props, configs);
    expect(us.map((u) => u.prop.id)).toEqual([2, 1]); // ordem asc
    expect(us[1].cfg.propriedade_id).toBe(1);
  });
  it('propriedade sem config recebe config padrão (ativo=true)', () => {
    const us = montarUnidades([prop({ id: 9 })], []);
    expect(us[0].cfg.ativo).toBe(true);
    expect(us[0].cfg.propriedade_id).toBe(9);
  });
  it('nomeUnidade prioriza apelido > nome > fallback', () => {
    expect(nomeUnidade({ prop: prop({ nome: 'X' }), cfg: cfg({ apelido: 'Apelido' }) })).toBe('Apelido');
    expect(nomeUnidade({ prop: prop({ nome: 'X' }), cfg: cfg() })).toBe('X');
    expect(nomeUnidade({ prop: prop({ id: 7, nome: null }), cfg: cfg({ propriedade_id: 7 }) })).toBe('Unidade #7');
  });
});

describe('diasOcupados (união de intervalos)', () => {
  const J = { de: '2026-06-01', ate: '2026-06-30', dias: 30 };
  it('conta dias de um evento simples (1 dia se sem data_fim)', () => {
    expect(diasOcupados([evt({ data_inicio: '2026-06-05', data_fim: null })], J.de, J.ate)).toBe(1);
  });
  it('conta intervalo multi-dia inclusivo', () => {
    expect(diasOcupados([evt({ data_inicio: '2026-06-05', data_fim: '2026-06-07' })], J.de, J.ate)).toBe(3);
  });
  it('une sobreposições e não conta dia duas vezes', () => {
    const es = [evt({ data_inicio: '2026-06-05', data_fim: '2026-06-07' }), evt({ data_inicio: '2026-06-06', data_fim: '2026-06-08' })];
    expect(diasOcupados(es, J.de, J.ate)).toBe(4); // 5,6,7,8
  });
  it('clipa eventos que extrapolam a janela', () => {
    expect(diasOcupados([evt({ data_inicio: '2026-05-28', data_fim: '2026-06-02' })], J.de, J.ate)).toBe(2); // 1,2
  });
  it('ignora eventos não-ganhos e sem data', () => {
    const es = [evt({ status: 'lead', data_inicio: '2026-06-05' }), evt({ status: 'contratado', data_inicio: null })];
    expect(diasOcupados(es, J.de, J.ate)).toBe(0);
  });
});

describe('royaltiesUnidade', () => {
  it('% da receita + taxa fixa', () => {
    expect(royaltiesUnidade(10000, { royalties_pct: 5, taxa_fixa_num: 500 })).toBe(1000); // 500 + 500
    expect(royaltiesUnidade(10000, { royalties_pct: null, taxa_fixa_num: 300 })).toBe(300);
    expect(royaltiesUnidade(10000, { royalties_pct: 0, taxa_fixa_num: null })).toBe(0);
    expect(royaltiesUnidade(0, { royalties_pct: 5, taxa_fixa_num: null })).toBe(0);
  });
});

describe('metricasUnidade', () => {
  const J = janelaPreset('mes', HOJE); // 2026-06-01..2026-06-09
  it('soma receita/despesa/margem e calcula margem%', () => {
    const lancs = [
      lanc({ tipo: 'receita', valor: 10000, data: '2026-06-02' }),
      lanc({ tipo: 'despesa', valor: 4000, data: '2026-06-03' }),
      lanc({ tipo: 'receita', valor: 9999, data: '2026-05-31' }), // fora da janela
    ];
    const m = metricasUnidade({ prop: prop(), cfg: cfg() }, lancs, [], J);
    expect(m.receita).toBe(10000);
    expect(m.despesa).toBe(4000);
    expect(m.margem).toBe(6000);
    expect(m.margemPct).toBeCloseTo(0.6, 5);
  });
  it('separa eventos ganhos × pipeline e calcula ticket/ocupação/avaliação', () => {
    const eventos = [
      evt({ status: 'contratado', valor_total_num: 5000, data_inicio: '2026-06-05', data_fim: '2026-06-06' }),
      evt({ status: 'finalizado', valor_total_num: 3000, data_inicio: '2026-06-08' }),
      evt({ status: 'lead', valor_total_num: 7000, data_inicio: '2026-06-07' }), // pipeline
      evt({ status: 'contratado', valor_total_num: 9999, data_inicio: '2026-07-01' }), // fora da janela
    ];
    const m = metricasUnidade({ prop: prop({ avaliacao: 4.8 }), cfg: cfg() }, [], eventos, J);
    expect(m.eventos).toBe(2);
    expect(m.eventosTotais).toBe(3);
    expect(m.valorContratado).toBe(8000);
    expect(m.pipeline).toBe(7000);
    expect(m.ticket).toBe(4000);
    expect(m.diasOcupados).toBe(3); // 5,6 + 8
    expect(m.diasDisponiveis).toBe(9);
    expect(m.ocupacao).toBeCloseTo(3 / 9, 5);
    expect(m.avaliacao).toBe(4.8);
  });
  it('meta e atingimento; royalties pela config', () => {
    const lancs = [lanc({ tipo: 'receita', valor: 8000, data: '2026-06-02' })];
    const m = metricasUnidade({ prop: prop(), cfg: cfg({ meta_receita_num: 10000, royalties_pct: 10, taxa_fixa_num: 0 }) }, lancs, [], J);
    expect(m.metaReceita).toBe(10000);
    expect(m.atingimento).toBeCloseTo(0.8, 5);
    expect(m.royalties).toBe(800);
  });
  it('sem receita: margemPct e atingimento nulos, ticket 0', () => {
    const m = metricasUnidade({ prop: prop({ avaliacao: null }), cfg: cfg({ meta_receita_num: 5000 }) }, [], [], J);
    expect(m.margemPct).toBeNull();
    expect(m.atingimento).toBe(0); // receita 0 / meta = 0 (não null, pois há meta>0)
    expect(m.ticket).toBe(0);
    expect(m.avaliacao).toBeNull();
  });
});

describe('metricasTodas + consolidar', () => {
  const J = janelaPreset('mes', HOJE);
  const props = [prop({ id: 1, avaliacao: 4.0 }), prop({ id: 2, nome: 'Filial', avaliacao: 5.0 })];
  const unidades: Unidade[] = montarUnidades(props, [cfg({ propriedade_id: 1 }), cfg({ propriedade_id: 2 })]);
  const lancs = [
    lanc({ prop_id: 1, tipo: 'receita', valor: 10000, data: '2026-06-02' }),
    lanc({ prop_id: 1, tipo: 'despesa', valor: 3000, data: '2026-06-02' }),
    lanc({ prop_id: 2, tipo: 'receita', valor: 20000, data: '2026-06-02' }),
    lanc({ prop_id: null, tipo: 'receita', valor: 1234, data: '2026-06-02' }), // não atribuído
  ];
  const eventos = [
    evt({ propriedade_id: 1, status: 'contratado', valor_total_num: 5000, data_inicio: '2026-06-05' }),
    evt({ propriedade_id: 2, status: 'finalizado', valor_total_num: 8000, data_inicio: '2026-06-06', data_fim: '2026-06-07' }),
  ];

  it('atribui linhas por propriedade', () => {
    const ms = metricasTodas(unidades, lancs, eventos, J);
    expect(ms.get(1)!.receita).toBe(10000);
    expect(ms.get(1)!.despesa).toBe(3000);
    expect(ms.get(2)!.receita).toBe(20000);
    expect(ms.get(1)!.diasOcupados).toBe(1);
    expect(ms.get(2)!.diasOcupados).toBe(2);
  });
  it('consolida soma e médias ponderadas', () => {
    const ms = [...metricasTodas(unidades, lancs, eventos, J).values()];
    const c = consolidar(ms);
    expect(c.unidades).toBe(2);
    expect(c.receita).toBe(30000);
    expect(c.despesa).toBe(3000);
    expect(c.margem).toBe(27000);
    expect(c.eventos).toBe(2);
    expect(c.valorContratado).toBe(13000);
    expect(c.ticket).toBe(6500);
    expect(c.diasOcupados).toBe(3);
    expect(c.diasDisponiveis).toBe(18); // 9 + 9
    expect(c.ocupacao).toBeCloseTo(3 / 18, 5);
    expect(c.avaliacao).toBeCloseTo(4.5, 5); // média de 4 e 5
  });
  it('naoAtribuidos soma só linhas sem prop_id na janela', () => {
    expect(naoAtribuidos(lancs, J)).toEqual({ receita: 1234, despesa: 0 });
  });
});

describe('ranking & benchmark', () => {
  const base = (id: number, receita: number, ocup: number | null) => ({
    propriedade_id: id, receita, despesa: 0, margem: receita, margemPct: null,
    eventos: 0, eventosTotais: 0, valorContratado: 0, pipeline: 0, ticket: 0,
    diasOcupados: 0, diasDisponiveis: 30, ocupacao: ocup, avaliacao: null,
    royalties: 0, metaReceita: null, atingimento: null,
  });
  const ms = [base(1, 100, 0.2), base(2, 300, 0.9), base(3, 200, null)];
  it('ranking desc por receita', () => {
    expect(ranking(ms, 'receita').map((m) => m.propriedade_id)).toEqual([2, 3, 1]);
  });
  it('valorMetrica trata null como 0', () => {
    expect(valorMetrica(base(9, 0, null), 'ocupacao')).toBe(0);
  });
  it('benchmark calcula min/max/media e melhor/pior', () => {
    const b = benchmark(ms, 'receita');
    expect(b.min).toBe(100);
    expect(b.max).toBe(300);
    expect(b.media).toBe(200);
    expect(b.total).toBe(600);
    expect(b.melhorId).toBe(2);
    expect(b.piorId).toBe(1);
  });
  it('benchmark vazio é seguro', () => {
    expect(benchmark([], 'receita')).toMatchObject({ min: 0, max: 0, media: 0, melhorId: null });
  });
});

describe('unidadesVisiveis (acesso por unidade)', () => {
  const todas = [1, 2, 3];
  const acessos: UnidadeAcesso[] = [
    { membro_id: 10, propriedade_id: 1 },
    { membro_id: 10, propriedade_id: 2 },
  ];
  it('dono vê todas', () => {
    expect([...unidadesVisiveis(acessos, todas, { dono: true })].sort()).toEqual([1, 2, 3]);
  });
  it('membro com acessos vê só os concedidos', () => {
    expect([...unidadesVisiveis(acessos, todas, { membroId: 10 })].sort()).toEqual([1, 2]);
    expect(membroPodeVer(acessos, todas, 3, { membroId: 10 })).toBe(false);
    expect(membroPodeVer(acessos, todas, 1, { membroId: 10 })).toBe(true);
  });
  it('membro sem nenhuma linha de acesso vê todas (restrição é opt-in)', () => {
    expect([...unidadesVisiveis(acessos, todas, { membroId: 99 })].sort()).toEqual([1, 2, 3]);
  });
});

describe('catálogos e utilidades', () => {
  it('tipoGrupoMeta retorna meta conhecida e fallback', () => {
    expect(tipoGrupoMeta('franquia').label).toBe('Franquia');
    expect(tipoGrupoMeta('zzz').v).toBe('rede');
  });
  it('isMissingTable detecta códigos e mensagens', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
