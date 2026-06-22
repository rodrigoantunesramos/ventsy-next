import { describe, it, expect } from 'vitest';
import { detectarIntent, responderLocal, panoramaParaTexto, type Panorama } from './copilotIntents';

const money = (n: number) => `R$ ${n}`;
const fmt = { money };

const P: Panorama = {
  hoje: '2026-06-22',
  contratado: 100000, recebido: 60000, aberto: 40000, aVencer30: 15000,
  eventosTotal: 12, eventosGanhos: 7,
  contratosPendentes: 2, parcelasAtrasadas: 1, licencasVencendo: 1,
  clientes: 30, reservasFuturas: 4, avaliacao: 4.8,
  ticketMedio: 14285, taxaConversao: 58, inadimplenciaValor: 7290, inadimplenciaQtd: 1,
  eventoMaisValioso: { titulo: 'Casamento Zara', tipo: 'casamento', data: '23/06/2026', valor: 24300, status: 'contratado' },
  tiposEvento: [{ tipo: 'casamento', n: 5 }, { tipo: 'corporativo', n: 3 }],
  proximosEventos: [{ titulo: 'Casamento Zara', tipo: 'casamento', data: '23/06/2026', valor: 24300, status: 'contratado' }],
  pendencias: [{ titulo: 'Casamento Zara', sub: 'Vence em 1 dia(s)', urgencia: 'alerta', valor: 7290, tipo: 'parcela' }],
};
const VAZIO: Panorama = {
  ...P, contratosPendentes: 0, parcelasAtrasadas: 0, reservasFuturas: 0,
  avaliacao: null, proximosEventos: [], pendencias: [],
  inadimplenciaValor: 0, inadimplenciaQtd: 0, eventoMaisValioso: null, tiposEvento: [],
};

describe('detectarIntent', () => {
  it('reconhece resumo (inclui "como está meu mês")', () => {
    expect(detectarIntent('Como está meu mês?')).toBe('resumo');
    expect(detectarIntent('me dá um resumo')).toBe('resumo');
  });
  it('reconhece faturamento sem confundir com clientes', () => {
    expect(detectarIntent('quanto eu faturei?')).toBe('faturamento');
    expect(detectarIntent('quanto tenho a receber?')).toBe('faturamento');
    expect(detectarIntent('quantos clientes eu tenho?')).toBe('clientes');
  });
  it('reconhece as demais intenções', () => {
    expect(detectarIntent('o que precisa da minha atenção hoje?')).toBe('pendencias');
    expect(detectarIntent('quais são meus próximos eventos?')).toBe('agenda');
    expect(detectarIntent('quem está com contrato pendente?')).toBe('contratos');
    expect(detectarIntent('qual minha avaliação?')).toBe('avaliacao');
    expect(detectarIntent('tenho reservas confirmadas?')).toBe('reservas');
  });
  it('devolve null para pergunta aberta (vai pro LLM)', () => {
    expect(detectarIntent('escreva um poema sobre festas')).toBeNull();
    expect(detectarIntent('')).toBeNull();
  });
});

describe('responderLocal', () => {
  it('faturamento traz números formatados + chip de painel', () => {
    const r = responderLocal('faturamento', P, fmt);
    expect(r.texto).toContain('R$ 100000');
    expect(r.texto).toContain('em atraso');
    expect(r.chips.length).toBeGreaterThan(0);
    expect(r.chips[0].href).toMatch(/^\/painel\//);
  });
  it('pendencias lista quando há e felicita quando vazio', () => {
    expect(responderLocal('pendencias', P, fmt).texto).toContain('Casamento Zara');
    expect(responderLocal('pendencias', VAZIO, fmt).texto).toMatch(/Tudo em dia/);
  });
  it('agenda avisa quando não há eventos', () => {
    expect(responderLocal('agenda', P, fmt).texto).toContain('Casamento Zara');
    expect(responderLocal('agenda', VAZIO, fmt).texto).toMatch(/não tem eventos/);
  });
  it('avaliacao formata a nota ou avisa ausência', () => {
    expect(responderLocal('avaliacao', P, fmt).texto).toContain('4.8');
    expect(responderLocal('avaliacao', VAZIO, fmt).texto).toMatch(/ainda não tem/);
  });
  it('contratos: plural vs zero', () => {
    expect(responderLocal('contratos', P, fmt).texto).toContain('2 contrato');
    expect(responderLocal('contratos', VAZIO, fmt).texto).toMatch(/Nenhum contrato/);
  });
  it('resumo combina financeiro + pendência + próximo evento', () => {
    const r = responderLocal('resumo', P, fmt);
    expect(r.texto).toContain('R$ 60000');
    expect(r.texto).toContain('Casamento Zara');
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

describe('intents analíticos', () => {
  it('detecta as novas intenções', () => {
    expect(detectarIntent('qual meu ticket médio?')).toBe('ticket');
    expect(detectarIntent('qual a taxa de conversão do funil?')).toBe('conversao');
    expect(detectarIntent('qual meu evento mais valioso?')).toBe('evento_top');
    expect(detectarIntent('quanto me devem?')).toBe('inadimplencia');
    expect(detectarIntent('que tipo de evento eu mais faço?')).toBe('tipos');
  });
  it('não confunde os analíticos com os básicos', () => {
    expect(detectarIntent('quanto tenho a receber?')).toBe('faturamento');
    expect(detectarIntent('quantos clientes eu tenho?')).toBe('clientes');
    expect(detectarIntent('quais são meus próximos eventos?')).toBe('agenda');
  });
  it('ticket médio e conversão trazem os números', () => {
    expect(responderLocal('ticket', P, fmt).texto).toContain('R$ 14285');
    expect(responderLocal('conversao', P, fmt).texto).toContain('58%');
  });
  it('evento mais valioso e mix por tipo', () => {
    expect(responderLocal('evento_top', P, fmt).texto).toContain('Casamento Zara');
    expect(responderLocal('tipos', P, fmt).texto).toContain('casamento');
  });
  it('inadimplência: valor quando há, elogio quando zero', () => {
    expect(responderLocal('inadimplencia', P, fmt).texto).toContain('em atraso');
    expect(responderLocal('inadimplencia', VAZIO, fmt).texto).toMatch(/Nenhuma parcela em atraso/);
  });
});

describe('panoramaParaTexto', () => {
  it('inclui os blocos-chave para o LLM', () => {
    const t = panoramaParaTexto(P, fmt);
    expect(t).toContain('Financeiro');
    expect(t).toContain('Próximos eventos');
    expect(t).toContain('Casamento Zara');
  });
});
