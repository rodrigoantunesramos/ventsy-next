import { describe, it, expect } from 'vitest'
import {
  normalizarPlaca, placaValidaBR, isIsento, calcularTarifa, permanenciaMs, duracaoPartes,
  estaNoPatio, ocupacaoPorSetor, ocupacaoTotal, lotacaoSetor, picoPatio, curvaFluxo,
  validarEntrada, resumoPatio, resumoReceita,
  parseHorarios, proximoHorario, resumoTransfer, proximoValet,
  setorTipoMeta, transferTipoMeta, acessoStatusMeta, valetStatusMeta,
  HORA, DIA, MINUTO,
  type AcessoVeicular, type Setor, type Transfer,
} from '@/lib/estacionamento'

const T0 = Date.UTC(2026, 5, 10, 12, 0, 0)
const iso = (ms: number) => new Date(ms).toISOString()

function mkSetor(p: Partial<Setor>): Setor {
  return {
    id: p.id || 's1', propriedade_id: p.propriedade_id ?? 1, nome: p.nome ?? 'Setor A',
    tipo: p.tipo ?? 'carro', capacidade: p.capacidade ?? 100, preco_num: p.preco_num ?? 20,
    cobranca: p.cobranca ?? 'fixo', cor: p.cor ?? null, ordem: p.ordem ?? 0, ativo: p.ativo ?? true, ...p,
  }
}
function mkAcesso(p: Partial<AcessoVeicular>): AcessoVeicular {
  return {
    id: p.id || Math.random().toString(36), evento_id: p.evento_id ?? 'e1', setor_id: p.setor_id ?? 's1',
    placa: p.placa ?? 'ABC1D23', tipo: p.tipo ?? 'carro', modelo: p.modelo ?? null, cor_veiculo: p.cor_veiculo ?? null,
    credencial_id: p.credencial_id ?? null, valet: p.valet ?? false, valet_status: p.valet_status ?? 'na',
    valet_local: p.valet_local ?? null, motorista: p.motorista ?? null, contato: p.contato ?? null,
    entrada: p.entrada ?? iso(T0), saida: p.saida ?? null, valor_num: p.valor_num ?? 0, pago: p.pago ?? false,
    metodo: p.metodo ?? null, status: p.status ?? 'no_patio', lancamento_id: p.lancamento_id ?? null, obs: p.obs ?? null, ...p,
  }
}
function mkTransfer(p: Partial<Transfer>): Transfer {
  return {
    id: p.id || 't1', evento_id: p.evento_id ?? 'e1', tipo: p.tipo ?? 'shuttle', rota: p.rota ?? 'Hotel ↔ Arena',
    horarios: p.horarios ?? ['08:00', '12:00'], capacidade: p.capacidade ?? 40, fornecedor_id: p.fornecedor_id ?? null,
    motorista: p.motorista ?? null, contato: p.contato ?? null, veiculo: p.veiculo ?? null,
    ponto_embarque: p.ponto_embarque ?? null, ativo: p.ativo ?? true, obs: p.obs ?? null, ...p,
  }
}

describe('placa — normalização e validação BR', () => {
  it('normaliza maiúsculas e remove símbolos/espaços', () => {
    expect(normalizarPlaca(' abc-1d23 ')).toBe('ABC1D23')
    expect(normalizarPlaca('rio2a18')).toBe('RIO2A18')
  })
  it('reconhece placa antiga e Mercosul; rejeita lixo', () => {
    expect(placaValidaBR('ABC1234')).toBe(true)   // antiga
    expect(placaValidaBR('ABC1D23')).toBe(true)   // Mercosul
    expect(placaValidaBR('ABC123')).toBe(false)
    expect(placaValidaBR('')).toBe(false)
  })
})

describe('isIsento (credenciado não paga)', () => {
  it('vínculo de credencial isenta', () => {
    expect(isIsento(mkSetor({ tipo: 'carro' }), { credencial_id: 'cred1' })).toBe(true)
  })
  it('setor de cortesia (credenciado) isenta', () => {
    expect(isIsento(mkSetor({ tipo: 'credenciado' }), { credencial_id: null })).toBe(true)
  })
  it('carro comum sem credencial paga', () => {
    expect(isIsento(mkSetor({ tipo: 'carro' }), { credencial_id: null })).toBe(false)
  })
})

describe('calcularTarifa', () => {
  it('isento → 0', () => {
    expect(calcularTarifa({ setor: mkSetor({ preco_num: 30 }), credenciado: true })).toBe(0)
    expect(calcularTarifa({ setor: mkSetor({ tipo: 'credenciado', preco_num: 30 }) })).toBe(0)
  })
  it('fixo → preço base independente do tempo', () => {
    expect(calcularTarifa({ setor: mkSetor({ cobranca: 'fixo', preco_num: 25 }), entrada: iso(T0), saida: iso(T0 + 5 * HORA) })).toBe(25)
  })
  it('por hora → arredonda para cima, mínimo 1h', () => {
    expect(calcularTarifa({ setor: mkSetor({ cobranca: 'hora', preco_num: 10 }), entrada: iso(T0), saida: iso(T0 + 90 * MINUTO) })).toBe(20)
    expect(calcularTarifa({ setor: mkSetor({ cobranca: 'hora', preco_num: 10 }), entrada: iso(T0), saida: iso(T0 + 10 * MINUTO) })).toBe(10)
  })
  it('por diária → arredonda para cima, mínimo 1 dia', () => {
    expect(calcularTarifa({ setor: mkSetor({ cobranca: 'diaria', preco_num: 50 }), entrada: iso(T0), saida: iso(T0 + 25 * HORA) })).toBe(100)
  })
  it('usa nowMs quando ainda no pátio (sem saída)', () => {
    expect(calcularTarifa({ setor: mkSetor({ cobranca: 'hora', preco_num: 10 }), entrada: iso(T0), saida: null, nowMs: T0 + 2 * HORA })).toBe(20)
  })
  it('preço 0 ou setor ausente → 0', () => {
    expect(calcularTarifa({ setor: mkSetor({ preco_num: 0 }) })).toBe(0)
    expect(calcularTarifa({ setor: null })).toBe(0)
  })
})

describe('permanência', () => {
  it('mede (saída ou agora) − entrada', () => {
    expect(permanenciaMs({ entrada: iso(T0), saida: iso(T0 + 3 * HORA) })).toBe(3 * HORA)
    expect(permanenciaMs({ entrada: iso(T0), saida: null }, T0 + HORA)).toBe(HORA)
    expect(permanenciaMs({ entrada: null, saida: null }, T0)).toBe(0)
  })
  it('duracaoPartes decompõe em dias/horas/minutos', () => {
    const p = duracaoPartes(DIA + 2 * HORA + 30 * MINUTO)
    expect(p).toEqual({ dias: 1, horas: 2, minutos: 30 })
  })
})

describe('ocupação do pátio', () => {
  const acessos = [
    mkAcesso({ id: 'a', setor_id: 's1', status: 'no_patio' }),
    mkAcesso({ id: 'b', setor_id: 's1', status: 'no_patio' }),
    mkAcesso({ id: 'c', setor_id: 's2', status: 'no_patio' }),
    mkAcesso({ id: 'd', setor_id: 's1', status: 'saiu', saida: iso(T0 + HORA) }),
  ]
  it('estaNoPatio respeita status e par entrada/saída', () => {
    expect(estaNoPatio({ status: 'no_patio', entrada: iso(T0), saida: null })).toBe(true)
    expect(estaNoPatio({ status: 'saiu', entrada: iso(T0), saida: iso(T0 + HORA) })).toBe(false)
    expect(estaNoPatio({ status: 'reservado', entrada: iso(T0), saida: null })).toBe(true)
  })
  it('conta por setor e total', () => {
    expect(ocupacaoPorSetor(acessos)).toEqual({ s1: 2, s2: 1 })
    expect(ocupacaoTotal(acessos)).toBe(3)
  })
  it('lotacaoSetor reusa os limiares de acesso (70/90/100%)', () => {
    expect(lotacaoSetor(70, 100).nivel).toBe('atencao')
    expect(lotacaoSetor(100, 100).nivel).toBe('lotado')
    expect(lotacaoSetor(10, 0).restante).toBe(Infinity)
  })
})

describe('picoPatio / curvaFluxo', () => {
  const acessos = [
    mkAcesso({ id: '1', entrada: iso(T0), saida: iso(T0 + 4 * HORA) }),
    mkAcesso({ id: '2', entrada: iso(T0 + HORA), saida: iso(T0 + 2 * HORA) }),
    mkAcesso({ id: '3', entrada: iso(T0 + 90 * MINUTO), saida: null }),
  ]
  it('encontra o pico simultâneo e o instante', () => {
    const p = picoPatio(acessos)
    expect(p.pico).toBe(3)                 // T0+90min: #1, #2, #3 juntos
    expect(p.picoEm).toBe(T0 + 90 * MINUTO)
  })
  it('curva sobe e desce nos movimentos', () => {
    const c = curvaFluxo(acessos)
    expect(c.map((x) => x.n)).toEqual([1, 2, 3, 2, 1])
  })
})

describe('validarEntrada', () => {
  it('placa vazia é recusa dura', () => {
    const d = validarEntrada({ placa: '  ', setor: mkSetor({}), ocupacaoSetor: 0 })
    expect(d.ok).toBe(false); expect(d.motivo).toBe('placa_vazia'); expect(d.bloqueante).toBe(true)
  })
  it('setor lotado é recusa dura (force libera)', () => {
    const d = validarEntrada({ placa: 'ABC1D23', setor: mkSetor({ capacidade: 50 }), ocupacaoSetor: 50 })
    expect(d.motivo).toBe('lotacao'); expect(d.bloqueante).toBe(true)
  })
  it('placa já no pátio é aviso (não bloqueante)', () => {
    const d = validarEntrada({ placa: 'ABC1D23', setor: mkSetor({ capacidade: 50 }), ocupacaoSetor: 10, jaNoPatio: true })
    expect(d.motivo).toBe('ja_no_patio'); expect(d.bloqueante).toBe(false)
  })
  it('setor sem limite e placa nova → aprovado', () => {
    expect(validarEntrada({ placa: 'ABC1D23', setor: mkSetor({ capacidade: 0 }), ocupacaoSetor: 999 }).ok).toBe(true)
  })
})

describe('resumoPatio', () => {
  it('agrega presentes/saídos/valet e capacidade total', () => {
    const setores = [mkSetor({ id: 's1', capacidade: 100 }), mkSetor({ id: 's2', capacidade: 50, ativo: false })]
    const acessos = [
      mkAcesso({ status: 'no_patio', tipo: 'carro', valet: true }),
      mkAcesso({ status: 'no_patio', tipo: 'moto' }),
      mkAcesso({ status: 'saiu', saida: iso(T0 + HORA) }),
    ]
    const r = resumoPatio(acessos, setores)
    expect(r.noPatio).toBe(2)
    expect(r.saidos).toBe(1)
    expect(r.valetNoPatio).toBe(1)
    expect(r.capacidadeTotal).toBe(100)   // setor inativo não conta
    expect(r.porTipo).toEqual({ carro: 1, moto: 1 })
  })
})

describe('resumoReceita (ticket médio + conciliação)', () => {
  it('soma só pagos; separa pendente, isentos e não-lançado', () => {
    const acessos = [
      mkAcesso({ valor_num: 20, pago: true, metodo: 'Pix', setor_id: 's1', lancamento_id: null }),
      mkAcesso({ valor_num: 40, pago: true, metodo: 'Cartão', setor_id: 's1', lancamento_id: 99 }),
      mkAcesso({ valor_num: 30, pago: false, setor_id: 's2' }),          // pendente
      mkAcesso({ valor_num: 0, credencial_id: 'cred1' }),                // isento
    ]
    const r = resumoReceita(acessos)
    expect(r.receita).toBe(60)            // 20 + 40 pagos
    expect(r.pendente).toBe(30)
    expect(r.naoLancado).toBe(20)         // só o que ainda não foi ao caixa
    expect(r.pagos).toBe(2)
    expect(r.isentos).toBe(1)
    expect(r.ticketMedio).toBe(30)        // 60 / 2
    expect(r.porSetor['s1']).toEqual({ receita: 60, qtd: 2 })
    expect(r.porMetodo).toEqual({ Pix: 20, 'Cartão': 40 })
  })
  it('sem pagantes → ticket médio 0', () => {
    expect(resumoReceita([mkAcesso({ valor_num: 0 })]).ticketMedio).toBe(0)
  })
})

describe('mobilidade (transfer)', () => {
  it('parseHorarios normaliza array/jsonb e texto colado', () => {
    expect(parseHorarios(['8:00', '12:30'])).toEqual(['08:00', '12:30'])
    expect(parseHorarios('14:00, 9:15\n18:45')).toEqual(['09:15', '14:00', '18:45'])
    expect(parseHorarios('lixo, 25:99')).toEqual([])
  })
  it('proximoHorario acha o próximo a partir de agora', () => {
    const hs = ['08:00', '12:00', '18:00']
    expect(proximoHorario(hs, 10 * 60)).toBe('12:00')      // 10:00 → 12:00
    expect(proximoHorario(hs, 19 * 60)).toBeNull()         // depois do último
  })
  it('resumoTransfer soma lugares de rotas ativas', () => {
    const ts = [
      mkTransfer({ tipo: 'shuttle', capacidade: 40, ativo: true }),
      mkTransfer({ tipo: 'onibus', capacidade: 50, ativo: true }),
      mkTransfer({ tipo: 'van', capacidade: 15, ativo: false }),
    ]
    const r = resumoTransfer(ts)
    expect(r.rotas).toBe(2)
    expect(r.lugares).toBe(90)
    expect(r.porTipo).toEqual({ shuttle: 1, onibus: 1 })
  })
})

describe('fluxo do valet / metadados', () => {
  it('proximoValet avança a etapa e para no fim', () => {
    expect(proximoValet('recebido')).toBe('estacionado')
    expect(proximoValet('solicitado')).toBe('entregue')
    expect(proximoValet('entregue')).toBeNull()
    expect(proximoValet('na')).toBeNull()
  })
  it('metadados têm fallback', () => {
    expect(setorTipoMeta('carro').label).toBe('Carro')
    expect(setorTipoMeta('zzz').label).toBe('zzz')
    expect(transferTipoMeta('shuttle').label).toBe('Shuttle')
    expect(acessoStatusMeta('no_patio').label).toBe('No pátio')
    expect(valetStatusMeta('estacionado').label).toBe('Estacionado')
  })
})
