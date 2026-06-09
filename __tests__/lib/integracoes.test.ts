import { describe, it, expect } from 'vitest'
import {
  CATALOGO, CATALOGO_BY, getDef, CHAVES_VALIDAS, segredoPrincipal,
  mascararTail, mascararChave,
  validarConexao,
  EVENTOS_WEBHOOK, EVENTOS_WEBHOOK_SET, eventoWebhookLabel,
  corpoWebhook, formatarAssinatura, HEADER_ASSINATURA,
  proximaTentativaSegundos, deveRetentar, entregaOk, MAX_TENTATIVAS_WEBHOOK,
  ESCOPOS_API_SET, PREFIXO_API_KEY,
  isMissingTable,
  CATEGORIAS, STATUS_META,
} from '@/lib/integracoes'

// ── Integridade do catálogo ──────────────────────────────────────────────────
describe('catálogo', () => {
  it('toda integração tem chave única e categoria conhecida', () => {
    const chaves = CATALOGO.map((d) => d.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
    for (const d of CATALOGO) expect(CATEGORIAS[d.categoria]).toBeTruthy()
  })

  it('cobre os serviços pedidos na spec', () => {
    for (const c of ['mercadopago', 'smtp', 'whatsapp', 'nfse', 'google_calendar', 'meteorologia', 'contabilidade', 'ia']) {
      expect(CHAVES_VALIDAS.has(c)).toBe(true)
    }
  })

  it('toda integração com campo-segredo elege exatamente um principal (last4)', () => {
    for (const d of CATALOGO) {
      const secrets = d.campos.filter((c) => c.secret)
      if (secrets.length === 0) continue
      const principais = secrets.filter((c) => c.principal)
      expect(principais.length, `${d.chave} deve ter 1 principal`).toBe(1)
      expect(segredoPrincipal(d.chave)?.name).toBe(principais[0].name)
    }
  })

  it('campos de select trazem opções', () => {
    for (const d of CATALOGO) {
      for (const c of d.campos) {
        if (c.tipo === 'select') expect((c.opcoes?.length ?? 0) > 0).toBe(true)
      }
    }
  })

  it('getDef / CATALOGO_BY resolvem pela chave', () => {
    expect(getDef('smtp')?.nome).toBe('E-mail (SMTP)')
    expect(CATALOGO_BY['ia'].fonte).toBe('integracoes')
    expect(getDef('inexistente')).toBeUndefined()
  })
})

// ── Mascaramento ─────────────────────────────────────────────────────────────
describe('mascararTail', () => {
  it('devolve os últimos 4 dígitos', () => {
    expect(mascararTail('APP_USR-123456789abcd')).toBe('abcd')
    expect(mascararTail('abcd')).toBe('abcd')
  })
  it('não vaza segredos curtos demais', () => {
    expect(mascararTail('abc')).toBe('')
    expect(mascararTail('')).toBe('')
    expect(mascararTail(null)).toBe('')
    expect(mascararTail(undefined)).toBe('')
  })
  it('mascararChave formata prefixo…last4', () => {
    expect(mascararChave('vsk_live_ab12', '7c9d')).toBe('vsk_live_ab12…7c9d')
  })
})

// ── Validação do formulário ──────────────────────────────────────────────────
describe('validarConexao', () => {
  it('acusa segredo obrigatório faltando', () => {
    const faltam = validarConexao('zapsign', { ambiente: 'producao' })
    expect(faltam).toContain('API Token')
  })
  it('aceita segredo já existente no cofre (não reexige)', () => {
    const faltam = validarConexao('zapsign', { ambiente: 'producao' }, new Set(['api_token']))
    expect(faltam).toHaveLength(0)
  })
  it('exige campos não-secretos obrigatórios (smtp)', () => {
    const faltam = validarConexao('smtp', { host: 'smtp.x.com', porta: '465', senha: 'app-pass' })
    expect(faltam).toContain('Usuário')
  })
  it('integração sem campos obrigatórios valida vazio (meteorologia keyless)', () => {
    expect(validarConexao('meteorologia', {})).toHaveLength(0)
  })
  it('chave desconhecida é inválida', () => {
    expect(validarConexao('foo', {})).toEqual(['Integração desconhecida'])
  })
})

// ── Webhooks: eventos ────────────────────────────────────────────────────────
describe('eventos de webhook', () => {
  it('rótulo e set conferem', () => {
    expect(EVENTOS_WEBHOOK.length).toBeGreaterThan(0)
    expect(EVENTOS_WEBHOOK_SET.has('pagamento.aprovado')).toBe(true)
    expect(eventoWebhookLabel('contrato.assinado')).toBe('Contrato assinado')
    expect(eventoWebhookLabel('x.desconhecido')).toBe('x.desconhecido')
  })
})

// ── Webhooks: corpo canônico + assinatura ────────────────────────────────────
describe('corpo canônico do webhook', () => {
  it('monta {id, evento, criado_em, dados} de forma determinística', () => {
    const c = corpoWebhook('dlv_1', 'reserva.criada', '2026-06-09T12:00:00.000Z', { reserva_id: 7 })
    expect(c).toEqual({ id: 'dlv_1', evento: 'reserva.criada', criado_em: '2026-06-09T12:00:00.000Z', dados: { reserva_id: 7 } })
    // mesmo input → mesmo JSON (assinável de forma estável)
    expect(JSON.stringify(c)).toBe(JSON.stringify(corpoWebhook('dlv_1', 'reserva.criada', '2026-06-09T12:00:00.000Z', { reserva_id: 7 })))
  })
  it('dados nulos viram objeto vazio', () => {
    expect(corpoWebhook('x', 'y', 'z', null).dados).toEqual({})
  })
  it('formata o header de assinatura', () => {
    expect(formatarAssinatura('deadbeef')).toBe('sha256=deadbeef')
    expect(HEADER_ASSINATURA).toBe('x-ventsy-signature')
  })
})

// ── Webhooks: retry/backoff ──────────────────────────────────────────────────
describe('retentativa de webhook', () => {
  it('segue a agenda de backoff e desiste após o máximo', () => {
    expect(proximaTentativaSegundos(1)).toBe(60)
    expect(proximaTentativaSegundos(2)).toBe(300)
    expect(proximaTentativaSegundos(5)).toBe(21600)
    expect(proximaTentativaSegundos(MAX_TENTATIVAS_WEBHOOK + 1)).toBeNull()
  })
  it('tentativa inválida cai no primeiro passo', () => {
    expect(proximaTentativaSegundos(0)).toBe(60)
  })
  it('retenta em erro transitório (5xx/429/rede), nunca em 4xx', () => {
    expect(deveRetentar(500, 1)).toBe(true)
    expect(deveRetentar(429, 1)).toBe(true)
    expect(deveRetentar(0, 1)).toBe(true)
    expect(deveRetentar(404, 1)).toBe(false)
    expect(deveRetentar(401, 1)).toBe(false)
  })
  it('para de retentar ao atingir o máximo', () => {
    expect(deveRetentar(500, MAX_TENTATIVAS_WEBHOOK)).toBe(false)
  })
  it('entregaOk é 2xx', () => {
    expect(entregaOk(200)).toBe(true)
    expect(entregaOk(204)).toBe(true)
    expect(entregaOk(302)).toBe(false)
    expect(entregaOk(500)).toBe(false)
  })
})

// ── API keys ─────────────────────────────────────────────────────────────────
describe('api keys', () => {
  it('escopos válidos e prefixo', () => {
    expect(PREFIXO_API_KEY).toBe('vsk')
    expect(ESCOPOS_API_SET.has('leitura')).toBe(true)
    expect(ESCOPOS_API_SET.has('admin')).toBe(false)
  })
})

// ── Diversos ─────────────────────────────────────────────────────────────────
describe('helpers', () => {
  it('STATUS_META cobre os três estados', () => {
    expect(STATUS_META.conectado.chip).toContain('emerald')
    expect(STATUS_META.erro.chip).toContain('red')
    expect(STATUS_META.desconectado).toBeTruthy()
  })
  it('isMissingTable reconhece PGRST205 e 42P01', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})
