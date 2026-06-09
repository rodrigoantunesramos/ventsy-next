// SERVER-ONLY. Núcleo da Central de Integrações: federa STATUS e SEGREDOS de
// todos os serviços e SEMPRE devolve a saída MASCARADA ao client.
// ─────────────────────────────────────────────────────────────────────────────
// Federação (cada segredo no seu cofre nativo — nada é duplicado):
//   • mercadopago → host_mp            (OAuth; token nunca sai)
//   • nfse        → fiscal_provedores  (token do provedor)
//   • ia          → integracoes        (chave de IA BYOK)
//   • demais      → integracoes_segredos (cofre genérico)
// O STATUS unificado (último uso/erro, config pública) vive em
// integracoes_conexoes para TODOS. Importado por conexoes/testar/webhooks routes.
//
// ⚠️ Importa supabaseAdmin (service-role) — JAMAIS importar em 'use client'.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  getDef, CATALOGO, segredoPrincipal, mascararTail, PROVEDOR_NFSE_KEYS,
  type ConexaoStatusDTO, type Origem, type StatusConexao,
} from '@/lib/integracoes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>

const env = (k: string): string => (process.env[k] || '').trim()
const envTodos = (ks?: string[]): boolean => !!ks && ks.length > 0 && ks.every((k) => !!env(k))
const naoVazio = (v: unknown): boolean => v != null && String(v).trim().length > 0

/** Campos do def separados em (config não-secreta) × (segredos). */
function separarCampos(chave: string, valores: Dict): { config: Dict; segredos: Dict } {
  const def = getDef(chave)
  const config: Dict = {}, segredos: Dict = {}
  for (const c of def?.campos ?? []) {
    if (!(c.name in valores)) continue
    const v = valores[c.name]
    if (c.secret) { if (naoVazio(v)) segredos[c.name] = String(v).trim() }   // segredo vazio = manter o atual
    else config[c.name] = typeof v === 'string' ? v.trim() : v
  }
  return { config, segredos }
}

// ── Leitura de status (federada + mascarada) ─────────────────────────────────
type Fontes = {
  conexoes: Map<string, Dict>
  segredos: Map<string, Dict>
  hostMp: Dict | null
  fiscal: Dict | null
  ia: Dict | null
}

async function carregarFontes(userId: string): Promise<Fontes> {
  const [cx, sg, mp, fp, ai] = await Promise.all([
    admin.from('integracoes_conexoes').select('chave, status, config, conectado_em, ultimo_uso, ultimo_erro').eq('usuario_id', userId),
    admin.from('integracoes_segredos').select('chave, segredo').eq('usuario_id', userId),
    admin.from('host_mp').select('mp_user_id, mp_access_token, conectado').eq('usuario_id', userId).maybeSingle(),
    admin.from('fiscal_provedores').select('provedor, ambiente, endpoint, token, empresa_token, cnpj, ativo').eq('usuario_id', userId).maybeSingle(),
    admin.from('integracoes').select('provider, modelo, api_key').eq('usuario_id', userId).maybeSingle(),
  ])
  return {
    conexoes: new Map((cx.data || []).map((r: Dict) => [r.chave, r])),
    segredos: new Map((sg.data || []).map((r: Dict) => [r.chave, r])),
    hostMp: mp.data || null,
    fiscal: fp.data || null,
    ia: ai.data || null,
  }
}

/** Resolve {configurado, origem, last4, config pública, segredosDefinidos}. */
function resolverCredencial(chave: string, f: Fontes): {
  configurado: boolean; origem: Origem; last4: string; config: Dict; segredosDefinidos: string[]
} {
  const def = getDef(chave)
  const cfgConexao = (f.conexoes.get(chave)?.config as Dict) || {}

  switch (def?.fonte) {
    case 'host_mp': {
      const r = f.hostMp
      const ok = !!(r && r.conectado && r.mp_access_token)
      return {
        configurado: ok, origem: ok ? 'usuario' : 'nenhum',
        last4: mascararTail(r?.mp_access_token), segredosDefinidos: ok ? ['access_token'] : [],
        config: { mp_user_id: r?.mp_user_id || null, oauth_disponivel: envTodos(def.envKeys) },
      }
    }
    case 'fiscal_provedores': {
      const r = f.fiscal
      const ok = !!(r && r.ativo && r.token && r.provedor && r.provedor !== 'manual')
      const seg: string[] = []
      if (naoVazio(r?.token)) seg.push('token')
      if (naoVazio(r?.empresa_token)) seg.push('empresa_token')
      return {
        configurado: ok, origem: ok ? 'usuario' : 'nenhum', last4: mascararTail(r?.token),
        segredosDefinidos: seg,
        config: { provedor: r?.provedor || 'manual', ambiente: r?.ambiente || 'homologacao', cnpj: r?.cnpj || '', endpoint: r?.endpoint || '' },
      }
    }
    case 'integracoes': {
      const r = f.ia
      const ok = naoVazio(r?.api_key)
      return {
        configurado: ok, origem: ok ? 'usuario' : 'nenhum', last4: mascararTail(r?.api_key),
        segredosDefinidos: ok ? ['api_key'] : [],
        config: { provider: r?.provider || 'openai', modelo: r?.modelo || '' },
      }
    }
    default: {
      // Cofre genérico (vault): segredos + config pública de integracoes_conexoes.
      const seg = (f.segredos.get(chave)?.segredo as Dict) || {}
      const segredosDefinidos = (def?.campos ?? []).filter((c) => c.secret && naoVazio(seg[c.name])).map((c) => c.name)
      const principal = segredoPrincipal(chave)?.name
      const { configurado, origem } = regraConfigurado(chave, { seg, config: cfgConexao, def })
      return {
        configurado, origem,
        last4: principal ? mascararTail(seg[principal]) : '',
        segredosDefinidos, config: cfgConexao,
      }
    }
  }
}

/** Regra "está configurado?" por serviço do cofre genérico (usuário > env > keyless). */
function regraConfigurado(chave: string, ctx: { seg: Dict; config: Dict; def: ReturnType<typeof getDef> }): { configurado: boolean; origem: Origem } {
  const { seg, config, def } = ctx
  const temPrincipal = (() => { const p = segredoPrincipal(chave)?.name; return p ? naoVazio(seg[p]) : false })()
  switch (chave) {
    case 'smtp':
      if (naoVazio(seg.senha) && naoVazio(config.host) && naoVazio(config.usuario)) return { configurado: true, origem: 'usuario' }
      if (envTodos(def?.envKeys)) return { configurado: true, origem: 'env' }
      return { configurado: false, origem: 'nenhum' }
    case 'whatsapp':
      if (naoVazio(seg.token) && naoVazio(config.phone_number_id)) return { configurado: true, origem: 'usuario' }
      if (envTodos(def?.envKeys)) return { configurado: true, origem: 'env' }
      return { configurado: false, origem: 'nenhum' }
    case 'google_calendar':
      if (naoVazio(config.ical_url) || naoVazio(seg.api_key)) return { configurado: true, origem: 'usuario' }
      return { configurado: false, origem: 'nenhum' }
    case 'meteorologia':
      if (temPrincipal) return { configurado: true, origem: 'usuario' }
      if (envTodos(def?.envKeys)) return { configurado: true, origem: 'env' }
      return { configurado: true, origem: 'keyless' }   // Open-Meteo: sempre disponível
    case 'zapsign':
      return temPrincipal ? { configurado: true, origem: 'usuario' } : { configurado: false, origem: 'nenhum' }
    case 'contabilidade':
      return naoVazio(config.contador_email) ? { configurado: true, origem: 'usuario' } : { configurado: false, origem: 'nenhum' }
    default:
      return temPrincipal ? { configurado: true, origem: 'usuario' } : { configurado: false, origem: 'nenhum' }
  }
}

function montarDTO(chave: string, f: Fontes): ConexaoStatusDTO {
  const cx = f.conexoes.get(chave)
  const cred = resolverCredencial(chave, f)
  const statusSalvo = cx?.status as StatusConexao | undefined
  const status: StatusConexao = statusSalvo === 'erro' ? 'erro' : cred.configurado ? 'conectado' : 'desconectado'
  return {
    chave, status, configurado: cred.configurado, origem: cred.origem, last4: cred.last4,
    segredosDefinidos: cred.segredosDefinidos, config: cred.config,
    conectado_em: cx?.conectado_em || null, ultimo_uso: cx?.ultimo_uso || null,
    ultimo_erro: status === 'erro' ? cx?.ultimo_erro || null : null,
  }
}

/** Status mascarado de TODAS as integrações do catálogo (para o client). */
export async function lerStatusTodas(userId: string): Promise<ConexaoStatusDTO[]> {
  const f = await carregarFontes(userId)
  return CATALOGO.map((d) => montarDTO(d.chave, f))
}

export async function lerStatusUma(userId: string, chave: string): Promise<ConexaoStatusDTO | null> {
  if (!getDef(chave)) return null
  const f = await carregarFontes(userId)
  return montarDTO(chave, f)
}

// ── Escrita (conectar/salvar) ────────────────────────────────────────────────
const nowIso = () => new Date().toISOString()

async function upsertConexao(userId: string, chave: string, patch: Dict): Promise<void> {
  await admin.from('integracoes_conexoes').upsert(
    { usuario_id: userId, chave, ...patch, atualizado_em: nowIso() },
    { onConflict: 'usuario_id,chave' },
  )
}

/** Conecta/salva uma integração. Retorna {ok} ou {error}. */
export async function salvarConexao(userId: string, chave: string, valores: Dict): Promise<{ ok: true } | { error: string; status?: number }> {
  const def = getDef(chave)
  if (!def) return { error: 'Integração desconhecida', status: 400 }
  if (def.conectar === 'oauth') return { error: 'Esta integração conecta por login seguro (OAuth), não por formulário.', status: 400 }

  if (def.fonte === 'fiscal_provedores') {
    const provedor = PROVEDOR_NFSE_KEYS.has(valores.provedor) ? valores.provedor : 'manual'
    const ambiente = valores.ambiente === 'producao' ? 'producao' : 'homologacao'
    const row: Dict = {
      usuario_id: userId, provedor, ambiente,
      endpoint: naoVazio(valores.endpoint) ? String(valores.endpoint).trim() : null,
      cnpj: naoVazio(valores.cnpj) ? String(valores.cnpj).trim() : null,
      ativo: true, atualizado_em: nowIso(),
    }
    if (naoVazio(valores.token)) row.token = String(valores.token).trim()                 // vazio = manter
    if (naoVazio(valores.empresa_token)) row.empresa_token = String(valores.empresa_token).trim()
    const { error } = await admin.from('fiscal_provedores').upsert(row, { onConflict: 'usuario_id' })
    if (error) return { error: error.message, status: 500 }
  } else if (def.fonte === 'integracoes') {
    const row: Dict = {
      usuario_id: userId,
      provider: naoVazio(valores.provider) ? String(valores.provider).trim() : 'openai',
      modelo: naoVazio(valores.modelo) ? String(valores.modelo).trim() : null,
      atualizado_em: nowIso(),
    }
    if (naoVazio(valores.api_key)) row.api_key = String(valores.api_key).trim()            // vazio = manter
    const { error } = await admin.from('integracoes').upsert(row, { onConflict: 'usuario_id' })
    if (error) return { error: error.message, status: 500 }
  } else {
    // Cofre genérico: config pública em conexoes; segredos no vault (merge).
    const { config, segredos } = separarCampos(chave, valores)
    if (Object.keys(segredos).length > 0) {
      const { data: atual } = await admin.from('integracoes_segredos').select('segredo').eq('usuario_id', userId).eq('chave', chave).maybeSingle()
      const merged = { ...((atual?.segredo as Dict) || {}), ...segredos }
      const { error } = await admin.from('integracoes_segredos').upsert(
        { usuario_id: userId, chave, segredo: merged, atualizado_em: nowIso() },
        { onConflict: 'usuario_id,chave' },
      )
      if (error) return { error: error.message, status: 500 }
    }
    await upsertConexao(userId, chave, { config })
  }

  // Recalcula o status e marca conectado_em na primeira conexão bem-sucedida.
  const dto = await lerStatusUma(userId, chave)
  const jaTinha = (await admin.from('integracoes_conexoes').select('conectado_em').eq('usuario_id', userId).eq('chave', chave).maybeSingle()).data?.conectado_em
  await upsertConexao(userId, chave, {
    status: dto?.configurado ? 'conectado' : 'desconectado',
    ultimo_erro: null,
    conectado_em: dto?.configurado ? (jaTinha || nowIso()) : null,
  })
  return { ok: true }
}

/** Desconecta: apaga o segredo no cofre nativo e zera o status. */
export async function desconectar(userId: string, chave: string): Promise<{ ok: true } | { error: string }> {
  const def = getDef(chave)
  if (!def) return { error: 'Integração desconhecida' }
  if (def.fonte === 'host_mp') {
    await admin.from('host_mp').update({ conectado: false, mp_access_token: null, mp_refresh_token: null, mp_public_key: null, atualizado_em: nowIso() }).eq('usuario_id', userId)
  } else if (def.fonte === 'fiscal_provedores') {
    await admin.from('fiscal_provedores').delete().eq('usuario_id', userId)
  } else if (def.fonte === 'integracoes') {
    await admin.from('integracoes').delete().eq('usuario_id', userId)
  } else {
    await admin.from('integracoes_segredos').delete().eq('usuario_id', userId).eq('chave', chave)
  }
  await admin.from('integracoes_conexoes').upsert(
    { usuario_id: userId, chave, status: 'desconectado', config: {}, conectado_em: null, ultimo_erro: null, atualizado_em: nowIso() },
    { onConflict: 'usuario_id,chave' },
  )
  return { ok: true }
}

/** Marca o resultado de um teste/uso (status + último uso/erro). */
export async function marcarStatus(userId: string, chave: string, status: StatusConexao, opts: { erro?: string | null; uso?: boolean } = {}): Promise<void> {
  const patch: Dict = { status }
  if (status === 'erro') patch.ultimo_erro = opts.erro || 'Falha na conexão'
  else patch.ultimo_erro = null
  if (opts.uso) patch.ultimo_uso = nowIso()
  await upsertConexao(userId, chave, patch)
}

// ── Credenciais efetivas (SERVER-ONLY — para testar/usar a integração) ───────
/** Lê a credencial REAL (usuário > env), nunca exposta ao client. */
export async function credenciaisEfetivas(userId: string, chave: string): Promise<{ valores: Dict; origem: Origem }> {
  const def = getDef(chave)
  if (!def) return { valores: {}, origem: 'nenhum' }

  if (def.fonte === 'host_mp') {
    const { data } = await admin.from('host_mp').select('mp_access_token, conectado').eq('usuario_id', userId).maybeSingle()
    return data?.conectado && data?.mp_access_token ? { valores: { access_token: data.mp_access_token }, origem: 'usuario' } : { valores: {}, origem: 'nenhum' }
  }
  if (def.fonte === 'fiscal_provedores') {
    const { data } = await admin.from('fiscal_provedores').select('provedor, ambiente, endpoint, token, empresa_token, ativo').eq('usuario_id', userId).maybeSingle()
    return data?.token ? { valores: data, origem: 'usuario' } : { valores: {}, origem: 'nenhum' }
  }
  if (def.fonte === 'integracoes') {
    const { data } = await admin.from('integracoes').select('provider, modelo, api_key').eq('usuario_id', userId).maybeSingle()
    return data?.api_key ? { valores: data, origem: 'usuario' } : { valores: {}, origem: 'nenhum' }
  }
  // Cofre genérico: junta config pública + segredos; cai para env quando aplicável.
  const [{ data: cx }, { data: sg }] = await Promise.all([
    admin.from('integracoes_conexoes').select('config').eq('usuario_id', userId).eq('chave', chave).maybeSingle(),
    admin.from('integracoes_segredos').select('segredo').eq('usuario_id', userId).eq('chave', chave).maybeSingle(),
  ])
  const valores: Dict = { ...((cx?.config as Dict) || {}), ...((sg?.segredo as Dict) || {}) }
  const principal = segredoPrincipal(chave)?.name
  if (principal && naoVazio(valores[principal])) return { valores, origem: 'usuario' }
  // Fallback de env por serviço (mantém o teste fiel ao que o sistema realmente usa).
  if (chave === 'smtp' && envTodos(def.envKeys)) return { valores: { ...valores, host: env('SMTP_HOST') || 'smtp.zoho.com', usuario: env('SMTP_USER'), senha: env('SMTP_PASS') }, origem: 'env' }
  if (chave === 'whatsapp' && envTodos(def.envKeys)) return { valores: { ...valores, token: env('WHATSAPP_TOKEN') }, origem: 'env' }
  if (chave === 'meteorologia') return { valores, origem: envTodos(def.envKeys) ? 'env' : 'keyless' }
  return { valores, origem: 'nenhum' }
}
