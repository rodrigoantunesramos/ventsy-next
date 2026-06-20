import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { verificarAssinaturaMP, verificarWebhookMP } from '@/lib/mpWebhook'

// Assina um manifest do mesmo jeito que o MP faria (HMAC-SHA256 → hex).
const SECRET = 'chave_secreta_de_teste_123'
const assinar = (manifest: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(manifest).digest('hex')

describe('verificarAssinaturaMP', () => {
  it("retorna 'sem_chave' quando MP_WEBHOOK_SECRET não está definida", () => {
    delete process.env.MP_WEBHOOK_SECRET
    expect(verificarAssinaturaMP({ xSignature: 'ts=1,v1=deadbeef', xRequestId: 'r', dataId: '1' })).toBe('sem_chave')
  })

  describe('com MP_WEBHOOK_SECRET definida', () => {
    beforeEach(() => { process.env.MP_WEBHOOK_SECRET = SECRET })
    afterEach(() => { delete process.env.MP_WEBHOOK_SECRET })

    it('aceita assinatura válida (manifest id;request-id;ts)', () => {
      const ts = '1700000000', dataId = '123456789', reqId = 'req-abc'
      const v1 = assinar(`id:${dataId};request-id:${reqId};ts:${ts};`)
      expect(verificarAssinaturaMP({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId })).toBe('valida')
    })

    it('rejeita v1 adulterado', () => {
      const ts = '1700000000', dataId = '123456789', reqId = 'req-abc'
      const v1 = assinar(`id:${dataId};request-id:${reqId};ts:${ts};`)
      const ruim = v1.slice(0, -1) + (v1.endsWith('a') ? 'b' : 'a')
      expect(verificarAssinaturaMP({ xSignature: `ts=${ts},v1=${ruim}`, xRequestId: reqId, dataId })).toBe('invalida')
    })

    it('rejeita quando o ts do header diverge do assinado', () => {
      const dataId = '123456789', reqId = 'req-abc'
      const v1 = assinar(`id:${dataId};request-id:${reqId};ts:1700000000;`)
      expect(verificarAssinaturaMP({ xSignature: `ts=1700009999,v1=${v1}`, xRequestId: reqId, dataId })).toBe('invalida')
    })

    it('rejeita quando outra chave assinou', () => {
      const ts = '1700000000', dataId = '123456789', reqId = 'req-abc'
      const v1 = assinar(`id:${dataId};request-id:${reqId};ts:${ts};`, 'outra_chave')
      expect(verificarAssinaturaMP({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId })).toBe('invalida')
    })

    it('normaliza data.id alfanumérico p/ minúsculo (regra do MP)', () => {
      const ts = '1700000000', reqId = 'req-1'
      const v1 = assinar(`id:abc123;request-id:${reqId};ts:${ts};`)
      expect(verificarAssinaturaMP({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: reqId, dataId: 'ABC123' })).toBe('valida')
    })

    it("header ausente ou sem v1 → 'invalida'", () => {
      expect(verificarAssinaturaMP({ xSignature: null, xRequestId: 'r', dataId: '1' })).toBe('invalida')
      expect(verificarAssinaturaMP({ xSignature: 'lixo', xRequestId: 'r', dataId: '1' })).toBe('invalida')
      expect(verificarAssinaturaMP({ xSignature: 'ts=1', xRequestId: 'r', dataId: '1' })).toBe('invalida')
    })

    it("v1 não-hex não derruba (retorna 'invalida')", () => {
      expect(verificarAssinaturaMP({ xSignature: 'ts=1,v1=zzz', xRequestId: 'r', dataId: '1' })).toBe('invalida')
    })
  })
})

describe('verificarWebhookMP (Request)', () => {
  afterEach(() => { delete process.env.MP_WEBHOOK_SECRET })

  it('lê data.id da query e os headers do Request (ignora ?u=)', () => {
    process.env.MP_WEBHOOK_SECRET = SECRET
    const ts = '1700000000', dataId = '999', reqId = 'rid-9'
    const v1 = assinar(`id:${dataId};request-id:${reqId};ts:${ts};`)
    const req = new Request(`https://www.ventsy.com.br/api/pagamentos/webhook?data.id=${dataId}&type=payment&u=dono`, {
      method: 'POST',
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId },
    })
    expect(verificarWebhookMP(req)).toBe('valida')
  })
})
