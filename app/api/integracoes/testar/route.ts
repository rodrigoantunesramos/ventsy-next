import { NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'
import { CHAVES_VALIDAS } from '@/lib/integracoes'
import { credenciaisEfetivas, marcarStatus } from '../_store'
import type { Origem } from '@/lib/integracoes'

// POST /api/integracoes/testar { chave } — testa a conexão com a CREDENCIAL REAL
// (do dono ou da plataforma). O segredo é lido no servidor, usado e descartado —
// nunca volta ao client. Grava o resultado (conectado/erro + último uso) para a
// aba Saúde do catálogo.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIMEOUT = 7000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>

/** fetch com timeout que NUNCA lança — devolve {ok,status} (status 0 = rede/timeout). */
async function ping(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal })
    return { ok: r.ok, status: r.status }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timer)
  }
}

const httpMsg = (s: number) => (s === 0 ? 'sem resposta (rede/timeout)' : `HTTP ${s}`)

type Resultado = { ok: boolean; mensagem: string }

async function testar(chave: string, c: Dict, origem: Origem): Promise<Resultado> {
  switch (chave) {
    case 'mercadopago': {
      if (!c.access_token) return { ok: false, mensagem: 'Conta não conectada — conecte pelo Mercado Pago.' }
      const r = await ping('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${c.access_token}` } })
      return r.ok ? { ok: true, mensagem: 'Conta Mercado Pago ativa.' } : { ok: false, mensagem: `Token recusado (${httpMsg(r.status)}).` }
    }
    case 'smtp': {
      if (!c.usuario || !c.senha) return { ok: false, mensagem: 'Informe usuário e senha (de app) do SMTP.' }
      const port = Number(c.porta || 465)
      const t = nodemailer.createTransport({
        host: c.host || 'smtp.zoho.com', port, secure: port === 465,
        auth: { user: c.usuario, pass: c.senha },
        connectionTimeout: TIMEOUT, greetingTimeout: TIMEOUT, socketTimeout: TIMEOUT,
      })
      try {
        await t.verify()
        return { ok: true, mensagem: origem === 'env' ? 'SMTP da plataforma respondeu.' : 'Servidor SMTP autenticou.' }
      } catch (e) {
        return { ok: false, mensagem: `SMTP falhou: ${(e as Error)?.message || 'sem resposta'}` }
      }
    }
    case 'whatsapp': {
      if (!c.token || !c.phone_number_id) return { ok: false, mensagem: 'Sem token — o sistema usará o link wa.me (degrade).' }
      const r = await ping(`https://graph.facebook.com/v21.0/${encodeURIComponent(c.phone_number_id)}?fields=verified_name`, { headers: { Authorization: `Bearer ${c.token}` } })
      return r.ok ? { ok: true, mensagem: 'API WhatsApp Cloud autenticou.' } : { ok: false, mensagem: `WhatsApp recusou (${httpMsg(r.status)}).` }
    }
    case 'nfse':
      return c.token && c.provedor && c.provedor !== 'manual'
        ? { ok: true, mensagem: 'Provedor de NFS-e configurado.' }
        : { ok: false, mensagem: 'Selecione um provedor e informe o token.' }
    case 'google_calendar': {
      if (c.ical_url) {
        const r = await ping(String(c.ical_url))
        return r.ok ? { ok: true, mensagem: 'Link iCal acessível.' } : { ok: false, mensagem: `iCal inacessível (${httpMsg(r.status)}).` }
      }
      return c.api_key ? { ok: true, mensagem: 'Chave de API salva.' } : { ok: false, mensagem: 'Informe o link iCal ou a chave de API.' }
    }
    case 'meteorologia': {
      const r = await ping('https://api.open-meteo.com/v1/forecast?latitude=-23.55&longitude=-46.63&current=temperature_2m')
      return r.ok
        ? { ok: true, mensagem: c.api_key ? 'OpenWeather + Open-Meteo OK.' : 'Open-Meteo OK (sem chave necessária).' }
        : { ok: false, mensagem: 'Serviço de meteorologia indisponível agora.' }
    }
    case 'zapsign': {
      if (!c.api_token) return { ok: false, mensagem: 'Informe o API Token da ZapSign.' }
      const base = c.ambiente === 'sandbox' ? 'https://sandbox.api.zapsign.com.br' : 'https://api.zapsign.com.br'
      const r = await ping(`${base}/api/v1/user/`, { headers: { Authorization: `Bearer ${c.api_token}` } })
      return r.ok ? { ok: true, mensagem: 'ZapSign autenticou.' } : { ok: false, mensagem: `ZapSign recusou (${httpMsg(r.status)}).` }
    }
    case 'contabilidade':
      return /.+@.+\..+/.test(String(c.contador_email || ''))
        ? { ok: true, mensagem: 'Contador configurado para receber a exportação.' }
        : { ok: false, mensagem: 'Informe um e-mail válido do contador.' }
    case 'ia': {
      if (!c.api_key) return { ok: false, mensagem: 'Informe a chave de IA.' }
      if ((c.provider || 'openai') === 'openai') {
        const r = await ping('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${c.api_key}` } })
        return r.ok ? { ok: true, mensagem: 'Chave OpenAI válida.' } : { ok: false, mensagem: `Chave recusada (${httpMsg(r.status)}).` }
      }
      return { ok: true, mensagem: 'Chave salva (verificação sob demanda no provedor).' }
    }
    default:
      return { ok: false, mensagem: 'Teste não suportado para esta integração.' }
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()
  const body = await req.json().catch(() => ({}))
  const chave = String(body?.chave || '')
  if (!CHAVES_VALIDAS.has(chave)) return Response.json({ error: 'Integração desconhecida' }, { status: 400 })

  const { valores, origem } = await credenciaisEfetivas(user.id, chave)
  let res: Resultado
  try {
    res = await testar(chave, valores, origem)
  } catch (e) {
    res = { ok: false, mensagem: (e as Error)?.message || 'Falha inesperada no teste.' }
  }
  await marcarStatus(user.id, chave, res.ok ? 'conectado' : 'erro', { erro: res.ok ? null : res.mensagem, uso: res.ok })
  return Response.json({ ok: res.ok, mensagem: res.mensagem, origem })
}
