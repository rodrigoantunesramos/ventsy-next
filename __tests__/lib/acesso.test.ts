import { describe, it, expect } from 'vitest'
import {
  podeAcessarZona, zonaAceitaTipo, calcularOcupacao, picoOcupacao, curvaOcupacao,
  nivelLotacao, validarMovimento, resumoCredenciais, ultimoMovimento,
  gerarQrPayload, normalizarLeitura, tokenCurto, credTipoMeta, credStatusMeta,
  ZONA_GERAL, ZONA_TODAS, SEGUNDO, MINUTO,
  type AcessoLog, type Credencial,
} from '@/lib/acesso'

const T0 = Date.UTC(2026, 5, 10, 18, 0, 0)
const iso = (ms: number) => new Date(ms).toISOString()

function mkCred(p: Partial<Credencial>): Credencial {
  return {
    id: p.id || 'c1', evento_id: p.evento_id ?? 'e1', tipo: p.tipo ?? 'convidado',
    nome: p.nome ?? 'Fulano', doc: p.doc ?? null, empresa: p.empresa ?? null,
    categoria_ingresso_id: p.categoria_ingresso_id ?? null, qr_token: p.qr_token ?? 'tok-c1',
    zonas: p.zonas ?? [], status: p.status ?? 'emitida', foto_url: p.foto_url ?? null, obs: p.obs ?? null, ...p,
  }
}
function mkLog(p: Partial<AcessoLog>): AcessoLog {
  return {
    id: p.id || Math.random().toString(36), evento_id: p.evento_id ?? 'e1', credencial_id: p.credencial_id ?? 'c1',
    zona: p.zona ?? ZONA_GERAL, ponto: p.ponto ?? 'portao_a', direcao: p.direcao ?? 'entrada',
    criado_em: p.criado_em ?? iso(T0), ...p,
  }
}

describe('QR — payload / leitura / exibição', () => {
  it('gera e normaliza o payload (round-trip)', () => {
    expect(normalizarLeitura(gerarQrPayload('abc123'))).toBe('abc123')
  })
  it('normaliza token cru, com espaços, e dentro de URL', () => {
    expect(normalizarLeitura('  abc123  ')).toBe('abc123')
    expect(normalizarLeitura('VTS:XYZ')).toBe('XYZ')
    expect(normalizarLeitura('https://ventsy.app/c/tok987?x=1')).toBe('tok987')
    expect(normalizarLeitura('https://x.com/cred/AB-CD?token=zzz')).toBe('AB-CD')
  })
  it('tokenCurto mostra os últimos 6 alfanuméricos em maiúsculas', () => {
    expect(tokenCurto('550e8400-e29b-41d4-a716-4466554400ff')).toBe('4400FF')
    expect(tokenCurto('ab12')).toBe('AB12')
  })
})

describe('autorização por zona', () => {
  it('perímetro (geral) liberado a qualquer credencial', () => {
    expect(podeAcessarZona(mkCred({ zonas: [] }), ZONA_GERAL)).toBe(true)
  })
  it('sub-zona exige listagem; vazio não basta', () => {
    expect(podeAcessarZona(mkCred({ zonas: [] }), 'camarote')).toBe(false)
    expect(podeAcessarZona(mkCred({ zonas: ['camarote'] }), 'camarote')).toBe(true)
  })
  it('sentinela "todas" libera qualquer zona', () => {
    expect(podeAcessarZona(mkCred({ zonas: [ZONA_TODAS] }), 'palco')).toBe(true)
  })
  it('zonaAceitaTipo: vazio aceita todos; lista restringe', () => {
    expect(zonaAceitaTipo({ tipos_permitidos: [] }, 'convidado')).toBe(true)
    expect(zonaAceitaTipo({ tipos_permitidos: ['vip'] }, 'convidado')).toBe(false)
    expect(zonaAceitaTipo({ tipos_permitidos: ['vip'] }, 'vip')).toBe(true)
  })
})

describe('calcularOcupacao', () => {
  it('soma líquida por zona e ponto; total = perímetro', () => {
    const logs = [
      mkLog({ direcao: 'entrada', zona: ZONA_GERAL, ponto: 'portao_a' }),
      mkLog({ direcao: 'entrada', zona: ZONA_GERAL, ponto: 'portao_b' }),
      mkLog({ direcao: 'entrada', zona: 'camarote', ponto: 'portao_c' }),
      mkLog({ direcao: 'saida', zona: ZONA_GERAL, ponto: 'portao_a' }),
    ]
    const o = calcularOcupacao(logs)
    expect(o.total).toBe(1)               // 2 entradas − 1 saída no perímetro
    expect(o.porZona[ZONA_GERAL]).toBe(1)
    expect(o.porZona['camarote']).toBe(1)
    expect(o.porPonto['portao_a']).toBe(0)
    expect(o.entradas).toBe(3)
    expect(o.saidas).toBe(1)
  })
  it('sem perímetro, total cai para a soma das sub-zonas', () => {
    const logs = [
      mkLog({ direcao: 'entrada', zona: 'pista' }),
      mkLog({ direcao: 'entrada', zona: 'arquibancada' }),
    ]
    expect(calcularOcupacao(logs).total).toBe(2)
  })
})

describe('picoOcupacao / curvaOcupacao', () => {
  const logs = [
    mkLog({ id: '1', direcao: 'entrada', criado_em: iso(T0) }),
    mkLog({ id: '2', direcao: 'entrada', criado_em: iso(T0 + MINUTO) }),
    mkLog({ id: '3', direcao: 'entrada', criado_em: iso(T0 + 2 * MINUTO) }),
    mkLog({ id: '4', direcao: 'saida', criado_em: iso(T0 + 3 * MINUTO) }),
    mkLog({ id: '5', direcao: 'saida', criado_em: iso(T0 + 4 * MINUTO) }),
  ]
  it('encontra o pico e o instante em que ocorreu', () => {
    const p = picoOcupacao(logs)
    expect(p.pico).toBe(3)
    expect(p.picoEm).toBe(T0 + 2 * MINUTO)
  })
  it('curva é monotônica nos passos e termina na ocupação atual', () => {
    const c = curvaOcupacao(logs)
    expect(c.map((x) => x.n)).toEqual([1, 2, 3, 2, 1])
  })
})

describe('nivelLotacao (compliance de capacidade)', () => {
  it('sem capacidade definida → tranquilo e vagas infinitas', () => {
    const l = nivelLotacao(500, 0)
    expect(l.nivel).toBe('tranquilo')
    expect(l.restante).toBe(Infinity)
  })
  it('limiares: 70% atenção, 90% alerta, 100% lotado', () => {
    expect(nivelLotacao(69, 100).nivel).toBe('tranquilo')
    expect(nivelLotacao(70, 100).nivel).toBe('atencao')
    expect(nivelLotacao(90, 100).nivel).toBe('alerta')
    expect(nivelLotacao(100, 100).nivel).toBe('lotado')
    expect(nivelLotacao(130, 100).nivel).toBe('lotado')
  })
  it('clampa presentes negativos e calcula restante', () => {
    const l = nivelLotacao(40, 100)
    expect(l.restante).toBe(60)
    expect(nivelLotacao(-5, 100).presentes).toBe(0)
  })
})

describe('validarMovimento (anti-duplicidade + capacidade)', () => {
  const base = { direcao: 'entrada' as const, zona: ZONA_GERAL, nowMs: T0 + 10 * MINUTO }

  it('bloqueada é recusa dura', () => {
    const d = validarMovimento({ ...base, cred: mkCred({ status: 'bloqueada' }) })
    expect(d.ok).toBe(false); expect(d.motivo).toBe('bloqueada'); expect(d.bloqueante).toBe(true)
  })
  it('zona não autorizada na entrada é recusa dura', () => {
    const d = validarMovimento({ ...base, zona: 'camarote', cred: mkCred({ zonas: [] }) })
    expect(d.motivo).toBe('zona_negada'); expect(d.bloqueante).toBe(true)
  })
  it('leitura repetida dentro da janela = duplicado (bloqueante)', () => {
    const d = validarMovimento({
      ...base, cred: mkCred({}),
      ultimoMovimentoZona: mkLog({ direcao: 'entrada', criado_em: iso(T0 + 10 * MINUTO - 3 * SEGUNDO) }),
    })
    expect(d.motivo).toBe('duplicado'); expect(d.bloqueante).toBe(true)
  })
  it('mesma direção fora da janela = aviso ja_dentro (não bloqueante)', () => {
    const d = validarMovimento({
      ...base, cred: mkCred({}),
      ultimoMovimentoZona: mkLog({ direcao: 'entrada', criado_em: iso(T0) }),
    })
    expect(d.motivo).toBe('ja_dentro'); expect(d.bloqueante).toBe(false)
  })
  it('saída sem estar dentro = aviso ja_fora', () => {
    const d = validarMovimento({
      ...base, direcao: 'saida', cred: mkCred({}),
      ultimoMovimentoZona: mkLog({ direcao: 'saida', criado_em: iso(T0) }),
    })
    expect(d.motivo).toBe('ja_fora'); expect(d.bloqueante).toBe(false)
  })
  it('entrada na capacidade máxima = lotacao (bloqueante, força pode liberar)', () => {
    const d = validarMovimento({ ...base, cred: mkCred({}), capacidadeZona: 100, ocupacaoZona: 100 })
    expect(d.motivo).toBe('lotacao'); expect(d.bloqueante).toBe(true)
  })
  it('entrada normal aprovada', () => {
    const d = validarMovimento({ ...base, cred: mkCred({ zonas: ['camarote'] }), zona: 'camarote', capacidadeZona: 50, ocupacaoZona: 10 })
    expect(d.ok).toBe(true); expect(d.bloqueante).toBe(false)
  })
  it('saída logo após entrada (par normal) é aprovada', () => {
    const d = validarMovimento({
      ...base, direcao: 'saida', cred: mkCred({}),
      ultimoMovimentoZona: mkLog({ direcao: 'entrada', criado_em: iso(T0 + 5 * MINUTO) }),
    })
    expect(d.ok).toBe(true)
  })
})

describe('resumoCredenciais / ultimoMovimento / metadados', () => {
  it('agrega totais por tipo/status e taxa de check-in', () => {
    const creds = [
      mkCred({ id: 'a', tipo: 'vip', status: 'checkin' }),
      mkCred({ id: 'b', tipo: 'convidado', status: 'checkout' }),
      mkCred({ id: 'c', tipo: 'convidado', status: 'emitida' }),
      mkCred({ id: 'd', tipo: 'equipe', status: 'bloqueada' }),
    ]
    const r = resumoCredenciais(creds)
    expect(r.total).toBe(4)
    expect(r.presentes).toBe(1)
    expect(r.bloqueadas).toBe(1)
    expect(r.porTipo['convidado']).toBe(2)
    expect(r.taxaCheckin).toBeCloseTo(2 / 4) // checkin + checkout já entraram
  })
  it('ultimoMovimento pega o log mais recente da credencial', () => {
    const logs = [
      mkLog({ id: '1', credencial_id: 'c1', direcao: 'entrada', criado_em: iso(T0) }),
      mkLog({ id: '2', credencial_id: 'c1', direcao: 'saida', criado_em: iso(T0 + MINUTO) }),
      mkLog({ id: '3', credencial_id: 'c2', direcao: 'entrada', criado_em: iso(T0 + 2 * MINUTO) }),
    ]
    expect(ultimoMovimento(logs, 'c1')?.id).toBe('2')
    expect(ultimoMovimento(logs, 'cX')).toBeNull()
  })
  it('metadados têm fallback', () => {
    expect(credTipoMeta('vip').label).toBe('VIP')
    expect(credTipoMeta('zzz').label).toBe('zzz')
    expect(credStatusMeta('checkin').label).toBe('Presente')
  })
})
