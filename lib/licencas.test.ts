import { describe, it, expect } from 'vitest';
import {
  type Licenca,
  diasAte, addDiasYMD, diasLabel,
  statusPorValidade, statusEfetivo,
  resumoConformidade, vencendoEm, aVencerBuckets, vencidas, proximasRenovacoes,
  custoAnualLicencas, custoLicencasEvento, agruparPorPropriedade,
  prontidaoLicencasEvento,
  exigenciasParaEvento, gerarLicencasDoEvento, listarTemplates, templatePorChave,
  templateKeyParaTipo, faixaDePublico, tipoLabel, orgaoSugerido, statusMeta,
  isMissingTable,
} from './licencas';

const HOJE = '2026-06-09';

// Fábrica enxuta de licença (só o que a engine lê).
function lic(p: Partial<Licenca> = {}): Licenca {
  return {
    id: Math.random().toString(36).slice(2),
    propriedade_id: 1, escopo: 'permanente', evento_id: null,
    tipo: 'funcionamento', titulo: null, orgao: null, orgao_contato: null,
    numero: null, protocolo: null, emissao: null, validade: null,
    dias_aviso: 60, custo_num: null, status: 'vigente', obrigatorio: true,
    responsavel: null, documento_url: null, documento_nome: null, lancamento_id: null, obs: null,
    ...p,
  };
}

describe('diasAte / addDiasYMD / diasLabel', () => {
  it('conta dias até a data (sinal correto, fuso-agnóstico)', () => {
    expect(diasAte('2026-06-09', HOJE)).toBe(0);
    expect(diasAte('2026-06-19', HOJE)).toBe(10);
    expect(diasAte('2026-06-04', HOJE)).toBe(-5);
    expect(diasAte(null, HOJE)).toBeNull();
    expect(diasAte('lixo', HOJE)).toBeNull();
  });
  it('addDiasYMD soma sem off-by-one de fuso', () => {
    expect(addDiasYMD('2026-06-09', 30)).toBe('2026-07-09');
    expect(addDiasYMD('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDiasYMD('2026-06-09', -10)).toBe('2026-05-30');
  });
  it('diasLabel descreve o prazo', () => {
    expect(diasLabel(null)).toMatch(/sem validade/i);
    expect(diasLabel(-3)).toMatch(/há 3 dias/i);
    expect(diasLabel(0)).toMatch(/hoje/i);
    expect(diasLabel(1)).toMatch(/amanhã/i);
    expect(diasLabel(12)).toMatch(/12 dias/);
  });
});

describe('statusPorValidade — fronteiras vigente/a_vencer/vencida', () => {
  it('classifica pela validade e janela de aviso', () => {
    expect(statusPorValidade(null, 60, HOJE)).toBe('sem_validade');
    expect(statusPorValidade('2026-06-04', 60, HOJE)).toBe('vencida');     // -5d
    expect(statusPorValidade('2026-06-09', 60, HOJE)).toBe('a_vencer');    // 0d ≤ 60
    expect(statusPorValidade('2026-08-01', 60, HOJE)).toBe('a_vencer');    // 53d ≤ 60
    expect(statusPorValidade('2026-09-01', 60, HOJE)).toBe('vigente');     // 84d > 60
  });
  it('respeita a antecedência custom (dias_aviso)', () => {
    expect(statusPorValidade('2026-06-29', 15, HOJE)).toBe('vigente');     // 20d > 15
    expect(statusPorValidade('2026-06-20', 15, HOJE)).toBe('a_vencer');    // 11d ≤ 15
  });
});

describe('statusEfetivo — estados manuais prevalecem', () => {
  it('em_processo e nao_aplicavel não são recalculados', () => {
    expect(statusEfetivo(lic({ status: 'em_processo', validade: '2025-01-01' }), HOJE)).toBe('em_processo');
    expect(statusEfetivo(lic({ status: 'nao_aplicavel', validade: '2025-01-01' }), HOJE)).toBe('nao_aplicavel');
  });
  it('vigente sem validade = vigente (permanente não vence)', () => {
    expect(statusEfetivo(lic({ status: 'vigente', validade: null }), HOJE)).toBe('vigente');
  });
  it('deriva da validade quando o estado não é manual', () => {
    expect(statusEfetivo(lic({ status: 'vigente', validade: '2026-06-01', dias_aviso: 60 }), HOJE)).toBe('vencida');
    expect(statusEfetivo(lic({ status: 'vigente', validade: '2026-07-01', dias_aviso: 60 }), HOJE)).toBe('a_vencer');
  });
});

describe('resumoConformidade — contagem + semáforo geral', () => {
  it('vermelho quando há vencida', () => {
    const r = resumoConformidade([
      lic({ status: 'vigente', validade: null }),
      lic({ status: 'vigente', validade: '2026-06-01' }), // vencida
    ], HOJE);
    expect(r.total).toBe(2);
    expect(r.vencida).toBe(1);
    expect(r.vigente).toBe(1);
    expect(r.geral).toBe('vermelho');
  });
  it('amarelo quando há a_vencer ou em_processo (sem vencidas)', () => {
    const r = resumoConformidade([
      lic({ status: 'vigente', validade: null }),
      lic({ status: 'em_processo' }),
    ], HOJE);
    expect(r.em_processo).toBe(1);
    expect(r.geral).toBe('amarelo');
  });
  it('verde quando tudo vigente; nao_aplicavel não puxa o farol', () => {
    const r = resumoConformidade([
      lic({ status: 'vigente', validade: null }),
      lic({ status: 'nao_aplicavel' }),
    ], HOJE);
    expect(r.geral).toBe('verde');
    expect(r.nao_aplicavel).toBe(1);
  });
});

describe('vencendoEm / aVencerBuckets / vencidas / proximasRenovacoes', () => {
  const base = [
    lic({ status: 'vigente', validade: '2026-06-20' }), // 11d
    lic({ status: 'vigente', validade: '2026-07-25' }), // 46d
    lic({ status: 'vigente', validade: '2026-08-30' }), // 82d
    lic({ status: 'vigente', validade: '2026-12-01' }), // 175d (fora)
    lic({ status: 'vigente', validade: '2026-06-01' }), // vencida
    lic({ status: 'em_processo', validade: '2026-06-15' }), // em processo (não conta como "a vencer")
  ];
  it('vencendoEm respeita a janela e exclui vencidas/em_processo', () => {
    expect(vencendoEm(base, 30, HOJE).length).toBe(1);   // só a de 11d
    expect(vencendoEm(base, 60, HOJE).length).toBe(2);   // 11d + 46d
    expect(vencendoEm(base, 90, HOJE).length).toBe(3);   // + 82d
  });
  it('aVencerBuckets cumulativos 30/60/90', () => {
    expect(aVencerBuckets(base, HOJE)).toEqual({ d30: 1, d60: 2, d90: 3 });
  });
  it('vencidas lista as expiradas', () => {
    expect(vencidas(base, HOJE).length).toBe(1);
  });
  it('proximasRenovacoes ordena por validade (vencidas primeiro)', () => {
    const px = proximasRenovacoes(base, HOJE);
    expect(px[0].validade).toBe('2026-06-01'); // a vencida tem a menor data
    // 1 vencida + 2 a vencer (a de 82d fica vigente pela própria janela de 60d).
    expect(px.length).toBe(3);
  });
});

describe('custos (números crus, sem moeda)', () => {
  it('custoAnualLicencas soma só permanentes', () => {
    const arr = [
      lic({ escopo: 'permanente', custo_num: 1200 }),
      lic({ escopo: 'permanente', custo_num: 800 }),
      lic({ escopo: 'evento', custo_num: 5000 }),
      lic({ escopo: 'permanente', custo_num: null }),
    ];
    expect(custoAnualLicencas(arr)).toBe(2000);
  });
  it('custoLicencasEvento soma o conjunto', () => {
    expect(custoLicencasEvento([lic({ custo_num: 300 }), lic({ custo_num: 150 }), lic({ custo_num: null })])).toBe(450);
  });
  it('agruparPorPropriedade separa por propriedade_id (null = sem)', () => {
    const m = agruparPorPropriedade([lic({ propriedade_id: 1 }), lic({ propriedade_id: 1 }), lic({ propriedade_id: null })]);
    expect(m.get(1)!.length).toBe(2);
    expect(m.get(null)!.length).toBe(1);
  });
});

describe('prontidaoLicencasEvento — bloqueio do evento (liga com Produção)', () => {
  it('bloqueia quando há exigência obrigatória em processo', () => {
    const evento = [
      lic({ escopo: 'evento', obrigatorio: true, status: 'vigente', validade: '2026-09-01' }),
      lic({ escopo: 'evento', obrigatorio: true, status: 'em_processo' }),
      lic({ escopo: 'evento', obrigatorio: false, status: 'em_processo' }), // opcional não bloqueia
    ];
    const p = prontidaoLicencasEvento(evento, HOJE);
    expect(p.obrigatorias).toBe(2);
    expect(p.atendidas).toBe(1);
    expect(p.pendentes.length).toBe(1);
    expect(p.bloqueia).toBe(true);
    expect(p.fracao).toBeCloseTo(0.5);
  });
  it('vencida obrigatória também bloqueia', () => {
    const p = prontidaoLicencasEvento([
      lic({ escopo: 'evento', obrigatorio: true, status: 'vigente', validade: '2026-06-01' }), // vencida
    ], HOJE);
    expect(p.bloqueia).toBe(true);
    expect(p.pendentes.length).toBe(1);
  });
  it('não bloqueia quando obrigatórias estão atendidas; nao_aplicavel é dispensada', () => {
    const p = prontidaoLicencasEvento([
      lic({ escopo: 'evento', obrigatorio: true, status: 'vigente', validade: null }),
      lic({ escopo: 'evento', obrigatorio: true, status: 'a_vencer', validade: '2026-06-20' }),
      lic({ escopo: 'evento', obrigatorio: true, status: 'nao_aplicavel' }),
    ], HOJE);
    expect(p.obrigatorias).toBe(2); // a nao_aplicavel sai da conta
    expect(p.bloqueia).toBe(false);
    expect(p.fracao).toBe(1);
  });
  it('sem obrigatórias → pronto (fracao 1)', () => {
    const p = prontidaoLicencasEvento([], HOJE);
    expect(p.bloqueia).toBe(false);
    expect(p.fracao).toBe(1);
  });
});

describe('biblioteca de exigências — filtro por porte', () => {
  it('exigenciasParaEvento mantém só o que vale para o público', () => {
    const show = templatePorChave('show').itens;
    const peq = exigenciasParaEvento(show, 100);
    const grd = exigenciasParaEvento(show, 6000);
    // policiamento (publicoMin 500) e ambiental (5000) entram só no grande.
    expect(peq.some((i) => i.tipo === 'policia')).toBe(false);
    expect(grd.some((i) => i.tipo === 'policia')).toBe(true);
    expect(grd.some((i) => i.tipo === 'ambiental')).toBe(true);
    expect(grd.length).toBeGreaterThan(peq.length);
  });
  it('gerarLicencasDoEvento devolve payload de domínio com obrigatório/órgão', () => {
    const itens = templatePorChave('corrida').itens;
    const ger = gerarLicencasDoEvento(itens, 1500);
    const via = ger.find((g) => g.tipo === 'via_publica');
    expect(via).toBeTruthy();
    expect(via!.obrigatorio).toBe(true);
    expect(via!.orgao).toBeTruthy();
    // todos têm título e dias_aviso > 0
    expect(ger.every((g) => g.titulo && g.dias_aviso > 0)).toBe(true);
  });
  it('listarTemplates expõe todos os tipos embutidos', () => {
    const keys = listarTemplates().map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['casamento', 'corporativo', 'show', 'corrida', 'feira', 'aniversario', 'generico']));
  });
});

describe('mapeamentos & rótulos', () => {
  it('templateKeyParaTipo casa o tipo livre do CRM', () => {
    expect(templateKeyParaTipo('Casamento ao ar livre')).toBe('casamento');
    expect(templateKeyParaTipo('Show de rock')).toBe('show');
    expect(templateKeyParaTipo('Corrida de rua 10k')).toBe('corrida');
    expect(templateKeyParaTipo('Feira de negócios')).toBe('feira');
    expect(templateKeyParaTipo('algo aleatório')).toBe('generico');
  });
  it('faixaDePublico rotula o porte', () => {
    expect(faixaDePublico(50)).toMatch(/até 100/i);
    expect(faixaDePublico(300)).toMatch(/100 a 500/);
    expect(faixaDePublico(8000)).toMatch(/acima de 5/i);
  });
  it('tipoLabel / orgaoSugerido / statusMeta cobrem o catálogo', () => {
    expect(tipoLabel('avcb_bombeiros')).toMatch(/bombeiros/i);
    expect(orgaoSugerido('ecad')).toMatch(/ecad/i);
    expect(statusMeta('vencida').nivel).toBe('vermelho');
    expect(statusMeta('vigente').nivel).toBe('verde');
  });
});

describe('isMissingTable', () => {
  it('reconhece os códigos de tabela ausente', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'Could not find the table in schema cache' })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
