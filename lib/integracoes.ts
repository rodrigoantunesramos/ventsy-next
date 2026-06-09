// Motor PURO da Central de Integrações da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// /painel/integracoes é a camada onde o dono CONECTA serviços externos que as
// outras páginas consomem: gateway de pagamento (Mercado Pago), e-mail (SMTP),
// WhatsApp, NFS-e, calendário, meteorologia, assinatura digital, contabilidade e
// a chave de IA (BYOK). Este arquivo concentra o CONHECIMENTO ESTÁTICO e seguro
// de cada integração (catálogo, campos do formulário, onde é usada, eventos de
// webhook) + a matemática determinística (mascaramento, status, retry/backoff,
// validação). Nada aqui é segredo — só metadados — por isso roda no client e no
// servidor.
//
// Consumido por:
//   • /painel/integracoes               (catálogo, formulários, webhooks, chaves)
//   • app/api/integracoes/*             (validação + status + nomes de campos)
//   • lib/webhooksServer.ts             (corpo canônico + agenda de retentativa)
//   • __tests__/lib/integracoes         (este motor é testado isoladamente)
//
// Regras de ouro (espelham lib/seguros.ts, lib/fiscal.ts):
//   • SEM React, SEM Supabase, SEM segredos, SEM "R$"/Intl aqui — só dados/funções
//     puras. A formatação i18n fica em lib/format; os segredos vivem no servidor.
//   • Determinístico e testável: nada de relógio/fetch/crypto escondido. O "agora"
//     e os digests entram SEMPRE por parâmetro.
//   • i18n: os rótulos PT são o default do catálogo; a UI pode reescrevê-los.

import { PROVEDORES } from '@/lib/fiscal'

// ── Vocabulário ──────────────────────────────────────────────────────────────
export type Categoria =
  | 'pagamento' | 'comunicacao' | 'fiscal' | 'agenda' | 'dados' | 'assinatura' | 'contabilidade' | 'ia'

/** Como o dono conecta o serviço. */
export type ConectarTipo = 'oauth' | 'form' | 'keyless'

/** Onde o SEGREDO realmente mora no servidor (cada um com seu cofre/RLS). */
export type FonteSegredo = 'host_mp' | 'fiscal_provedores' | 'integracoes' | 'vault'

/** Status efetivo de uma conexão, exibido no catálogo e na saúde. */
export type StatusConexao = 'conectado' | 'desconectado' | 'erro'

/** De onde veio a credencial ativa (plataforma vs. dono vs. degrade keyless). */
export type Origem = 'usuario' | 'env' | 'keyless' | 'nenhum'

/** Um campo do formulário de conexão (metadado — nunca guarda valor). */
export type CampoIntegracao = {
  name: string
  label: string
  tipo?: 'text' | 'password' | 'email' | 'number' | 'select' | 'url'
  /** true → segredo: nunca volta ao client, só os últimos dígitos. */
  secret?: boolean
  /** O segredo que gera o `last4` exibido (um por integração). */
  principal?: boolean
  required?: boolean
  placeholder?: string
  hint?: string
  opcoes?: { v: string; label: string }[]
}

/** Definição de uma integração do catálogo (metadados públicos). */
export type IntegracaoDef = {
  chave: string
  nome: string
  categoria: Categoria
  conectar: ConectarTipo
  fonte: FonteSegredo
  descricao: string
  /** Páginas que consomem esta integração (acceptance: "aponta onde é usada"). */
  usadoEm: { label: string; href?: string }[]
  campos: CampoIntegracao[]
  /** Envs de PLATAFORMA que, se presentes no servidor, já habilitam/atendem. */
  envKeys?: string[]
  /** Funciona sem credencial do dono (degrade). Ex.: meteorologia (Open-Meteo). */
  keyless?: boolean
  docsUrl?: string
}

/** DTO MASCARADO devolvido ao client (jamais contém o segredo cru). */
export type ConexaoStatusDTO = {
  chave: string
  status: StatusConexao
  configurado: boolean
  origem: Origem
  last4: string
  /** Quais campos-segredo já estão preenchidos (para o form mostrar "•••• set"). */
  segredosDefinidos: string[]
  /** Config NÃO-secreta (ex.: smtp host/porta, provedor da NFS-e, modelo de IA). */
  config: Record<string, unknown>
  conectado_em: string | null
  ultimo_uso: string | null
  ultimo_erro: string | null
}

// ── Categorias (rótulo + tom + ícone) ────────────────────────────────────────
export const CATEGORIAS: Record<Categoria, { label: string; icon: string; chip: string; cor: string }> = {
  pagamento:     { label: 'Pagamento',     icon: 'wallet',   chip: 'bg-emerald-50 text-emerald-700', cor: '#16a34a' },
  comunicacao:   { label: 'Comunicação',   icon: 'chat',     chip: 'bg-sky-50 text-sky-700',         cor: '#0ea5e9' },
  fiscal:        { label: 'Fiscal',        icon: 'invoice',  chip: 'bg-indigo-50 text-indigo-700',   cor: '#6366f1' },
  agenda:        { label: 'Agenda',        icon: 'calendar', chip: 'bg-violet-50 text-violet-700',   cor: '#8b5cf6' },
  dados:         { label: 'Dados',         icon: 'cloud',    chip: 'bg-cyan-50 text-cyan-700',       cor: '#06b6d4' },
  assinatura:    { label: 'Assinatura',    icon: 'signature', chip: 'bg-amber-50 text-amber-700',    cor: '#d97706' },
  contabilidade: { label: 'Contabilidade', icon: 'ledger',   chip: 'bg-teal-50 text-teal-700',       cor: '#14b8a6' },
  ia:            { label: 'Inteligência',  icon: 'bolt',     chip: 'bg-brand-50 text-brand',         cor: '#ff385c' },
}

// ── Catálogo de integrações ──────────────────────────────────────────────────
// Cada uma declara seus campos (e quais são segredo) + onde é consumida. Os
// segredos vão para o cofre no servidor; o client só vê status/últimos dígitos.
const PROVEDOR_NFSE_OPCOES = PROVEDORES.map((p) => ({ v: p.v, label: p.label }))
/** Chaves de provedor de NFS-e válidas (espelha lib/fiscal.PROVEDORES). */
export const PROVEDOR_NFSE_KEYS = new Set(PROVEDORES.map((p) => p.v))

export const CATALOGO: IntegracaoDef[] = [
  {
    chave: 'mercadopago',
    nome: 'Mercado Pago',
    categoria: 'pagamento',
    conectar: 'oauth',
    fonte: 'host_mp',
    descricao: 'Receba por Pix, cartão e boleto. Conecta sua conta por login seguro (OAuth) — a Ventsy nunca vê sua senha.',
    usadoEm: [
      { label: 'Reservas', href: '/painel/reservas' },
      { label: 'Faturamento', href: '/painel/faturamento' },
      { label: 'Portal do Cliente', href: '/painel/portal' },
      { label: 'Bilheteria', href: '/painel/bilheteria' },
    ],
    campos: [],
    envKeys: ['MP_CLIENT_ID', 'MP_CLIENT_SECRET'],
    docsUrl: 'https://www.mercadopago.com.br/developers',
  },
  {
    chave: 'smtp',
    nome: 'E-mail (SMTP)',
    categoria: 'comunicacao',
    conectar: 'form',
    fonte: 'vault',
    descricao: 'Envie e-mails transacionais e campanhas pelo seu próprio servidor SMTP (use uma senha de app, nunca a senha da conta).',
    usadoEm: [
      { label: 'Campanhas', href: '/painel/campanhas' },
      { label: 'Pesquisas & NPS', href: '/painel/pesquisas' },
      { label: 'Notificações', href: '/painel/configuracoes' },
    ],
    campos: [
      { name: 'host', label: 'Servidor (host)', placeholder: 'smtp.seudominio.com', required: true },
      { name: 'porta', label: 'Porta', tipo: 'number', placeholder: '465', required: true },
      { name: 'usuario', label: 'Usuário', placeholder: 'envios@seudominio.com', required: true },
      { name: 'senha', label: 'Senha de app', tipo: 'password', secret: true, principal: true, required: true },
      { name: 'remetente', label: 'Remetente exibido', placeholder: 'Sua Empresa <envios@seudominio.com>' },
    ],
    envKeys: ['SMTP_USER', 'SMTP_PASS'],
  },
  {
    chave: 'whatsapp',
    nome: 'WhatsApp',
    categoria: 'comunicacao',
    conectar: 'form',
    fonte: 'vault',
    descricao: 'Dispare confirmações e campanhas pela API Cloud do WhatsApp. Sem token, o sistema usa o link wa.me (degrade).',
    usadoEm: [
      { label: 'Campanhas', href: '/painel/campanhas' },
      { label: 'Convocação', href: '/painel/ponto' },
      { label: 'Portal do Cliente', href: '/painel/portal' },
    ],
    campos: [
      { name: 'phone_number_id', label: 'Phone Number ID', required: true, hint: 'Do painel Meta for Developers.' },
      { name: 'business_id', label: 'Business Account ID' },
      { name: 'token', label: 'Token de acesso', tipo: 'password', secret: true, principal: true, required: true },
    ],
    envKeys: ['WHATSAPP_TOKEN'],
    keyless: true,
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
  },
  {
    chave: 'nfse',
    nome: 'NFS-e',
    categoria: 'fiscal',
    conectar: 'form',
    fonte: 'fiscal_provedores',
    descricao: 'Emita notas fiscais de serviço automaticamente via provedor. Sem provedor, a emissão é manual (recibo em PDF).',
    usadoEm: [
      { label: 'Faturamento', href: '/painel/faturamento' },
      { label: 'Contabilidade', href: '/painel/contabilidade' },
    ],
    campos: [
      { name: 'provedor', label: 'Provedor', tipo: 'select', opcoes: PROVEDOR_NFSE_OPCOES, required: true },
      { name: 'ambiente', label: 'Ambiente', tipo: 'select', opcoes: [{ v: 'homologacao', label: 'Homologação (teste)' }, { v: 'producao', label: 'Produção' }], required: true },
      { name: 'cnpj', label: 'CNPJ emitente', placeholder: '00.000.000/0000-00' },
      { name: 'token', label: 'Token do provedor', tipo: 'password', secret: true, principal: true },
      { name: 'empresa_token', label: 'Token da empresa', tipo: 'password', secret: true },
      { name: 'endpoint', label: 'Endpoint (opcional)', tipo: 'url' },
    ],
  },
  {
    chave: 'google_calendar',
    nome: 'Calendário (iCal/Google)',
    categoria: 'agenda',
    conectar: 'form',
    fonte: 'vault',
    descricao: 'Espelhe reservas e eventos num calendário externo via link iCal ou chave de API. Mantém a agenda sincronizada.',
    usadoEm: [
      { label: 'Reservas', href: '/painel/reservas' },
      { label: 'Calendário', href: '/painel/calendario' },
    ],
    campos: [
      { name: 'calendar_id', label: 'ID do calendário', placeholder: 'agenda@group.calendar.google.com' },
      { name: 'ical_url', label: 'Link iCal (publicar)', tipo: 'url', placeholder: 'https://…/basic.ics' },
      { name: 'api_key', label: 'Chave de API (opcional)', tipo: 'password', secret: true, principal: true },
    ],
    keyless: true,
  },
  {
    chave: 'meteorologia',
    nome: 'Meteorologia',
    categoria: 'dados',
    conectar: 'keyless',
    fonte: 'vault',
    descricao: 'Previsão do tempo por evento ao ar livre. Já funciona sem chave (Open-Meteo); informe uma chave OpenWeather para mais precisão.',
    usadoEm: [
      { label: 'Clima & Plano B', href: '/painel/plano-b' },
    ],
    campos: [
      { name: 'api_key', label: 'Chave OpenWeather (opcional)', tipo: 'password', secret: true, principal: true },
    ],
    envKeys: ['OPENWEATHER_API_KEY'],
    keyless: true,
    docsUrl: 'https://open-meteo.com',
  },
  {
    chave: 'zapsign',
    nome: 'Assinatura digital',
    categoria: 'assinatura',
    conectar: 'form',
    fonte: 'vault',
    descricao: 'Envie contratos para assinatura eletrônica com validade jurídica e receba o documento assinado de volta.',
    usadoEm: [
      { label: 'Contratos', href: '/painel/contratos' },
      { label: 'Jurídico & LGPD', href: '/painel/juridico' },
    ],
    campos: [
      { name: 'ambiente', label: 'Ambiente', tipo: 'select', opcoes: [{ v: 'producao', label: 'Produção' }, { v: 'sandbox', label: 'Sandbox (teste)' }], required: true },
      { name: 'api_token', label: 'API Token', tipo: 'password', secret: true, principal: true, required: true },
    ],
    docsUrl: 'https://docs.zapsign.com.br',
  },
  {
    chave: 'contabilidade',
    nome: 'Contabilidade',
    categoria: 'contabilidade',
    conectar: 'form',
    fonte: 'vault',
    descricao: 'Compartilhe lançamentos e relatórios com seu contador automaticamente, no formato que o escritório usa.',
    usadoEm: [
      { label: 'Contabilidade', href: '/painel/contabilidade' },
      { label: 'Financeiro', href: '/painel/financeiro' },
    ],
    campos: [
      { name: 'contador_email', label: 'E-mail do contador', tipo: 'email', required: true },
      { name: 'formato', label: 'Formato de exportação', tipo: 'select', opcoes: [{ v: 'ofx', label: 'OFX' }, { v: 'csv', label: 'CSV' }, { v: 'sped', label: 'SPED' }] },
      { name: 'api_token', label: 'Token do sistema contábil (opcional)', tipo: 'password', secret: true, principal: true },
    ],
  },
  {
    chave: 'ia',
    nome: 'Inteligência Artificial',
    categoria: 'ia',
    conectar: 'form',
    fonte: 'integracoes',
    descricao: 'Sua própria chave de IA (BYOK) para gerar textos, organizar fotos, resumir feedbacks e sugerir preços.',
    usadoEm: [
      { label: 'Fotos', href: '/painel/fotos' },
      { label: 'Campanhas', href: '/painel/campanhas' },
      { label: 'Precificação', href: '/painel/precificacao' },
    ],
    campos: [
      { name: 'provider', label: 'Provedor', tipo: 'select', opcoes: [{ v: 'openai', label: 'OpenAI' }, { v: 'anthropic', label: 'Anthropic' }, { v: 'google', label: 'Google' }], required: true },
      { name: 'modelo', label: 'Modelo', placeholder: 'ex.: gpt-4o-mini' },
      { name: 'api_key', label: 'Chave de API', tipo: 'password', secret: true, principal: true, required: true },
    ],
  },
]

export const CATALOGO_BY = Object.fromEntries(CATALOGO.map((d) => [d.chave, d])) as Record<string, IntegracaoDef>
export const getDef = (chave: string): IntegracaoDef | undefined => CATALOGO_BY[chave]
export const CHAVES_VALIDAS = new Set(CATALOGO.map((d) => d.chave))
/** O campo-segredo que vira `last4` numa integração (ou undefined se não tem). */
export const segredoPrincipal = (chave: string): CampoIntegracao | undefined =>
  getDef(chave)?.campos.find((c) => c.secret && c.principal) ?? getDef(chave)?.campos.find((c) => c.secret)

// ── Status (chip + rótulo) ───────────────────────────────────────────────────
export const STATUS_META: Record<StatusConexao, { label: string; chip: string; cor: string }> = {
  conectado:     { label: 'Conectado',    chip: 'bg-emerald-50 text-emerald-700', cor: '#16a34a' },
  desconectado:  { label: 'Desconectado', chip: 'bg-black/[0.04] text-ink-muted', cor: '#6b7280' },
  erro:          { label: 'Com erro',     chip: 'bg-red-50 text-red-700',         cor: '#dc2626' },
}

export const ORIGEM_LABEL: Record<Origem, string> = {
  usuario: 'Sua credencial',
  env: 'Configurado na plataforma',
  keyless: 'Sem chave (degrade)',
  nenhum: '—',
}

// ── Mascaramento ─────────────────────────────────────────────────────────────
/** Últimos `n` caracteres de um segredo (para exibir "•••• 1234"). Vazio se curto. */
export function mascararTail(secret: string | null | undefined, n = 4): string {
  const s = String(secret ?? '')
  return s.length >= n ? s.slice(-n) : ''
}

/** Prefixo legível de uma API key própria (ex.: "vsk_live_ab12…7c9d"). */
export function mascararChave(prefixo: string, last4: string): string {
  return `${prefixo}…${last4}`
}

// ── Validação do formulário de conexão (pura) ────────────────────────────────
/**
 * Campos obrigatórios faltando para conectar `chave`. Um campo-segredo conta como
 * preenchido se veio no formulário OU já existe no cofre (`jaTem`). Devolve os
 * RÓTULOS faltantes (vazio = pronto para salvar).
 */
export function validarConexao(
  chave: string,
  valores: Record<string, string>,
  jaTem: Set<string> = new Set(),
): string[] {
  const def = getDef(chave)
  if (!def) return ['Integração desconhecida']
  const faltam: string[] = []
  for (const c of def.campos) {
    if (!c.required) continue
    const preenchido = (valores[c.name] ?? '').toString().trim().length > 0 || (c.secret && jaTem.has(c.name))
    if (!preenchido) faltam.push(c.label)
  }
  return faltam
}

// ── Webhooks: catálogo de eventos + corpo canônico + retry ───────────────────
export type WebhookEventoDef = { v: string; label: string; grupo: string }
export const EVENTOS_WEBHOOK: WebhookEventoDef[] = [
  { v: 'reserva.criada',      label: 'Reserva criada',        grupo: 'Reservas' },
  { v: 'reserva.confirmada',  label: 'Reserva confirmada',    grupo: 'Reservas' },
  { v: 'reserva.cancelada',   label: 'Reserva cancelada',     grupo: 'Reservas' },
  { v: 'pagamento.aprovado',  label: 'Pagamento aprovado',    grupo: 'Financeiro' },
  { v: 'pagamento.estornado', label: 'Pagamento estornado',   grupo: 'Financeiro' },
  { v: 'fatura.emitida',      label: 'Nota/fatura emitida',   grupo: 'Financeiro' },
  { v: 'proposta.aceita',     label: 'Proposta aceita',       grupo: 'Comercial' },
  { v: 'contrato.assinado',   label: 'Contrato assinado',     grupo: 'Comercial' },
  { v: 'lead.novo',           label: 'Novo lead',             grupo: 'Comercial' },
  { v: 'evento.concluido',    label: 'Evento concluído',      grupo: 'Operações' },
  { v: 'avaliacao.recebida',  label: 'Avaliação recebida',    grupo: 'Operações' },
]
export const EVENTOS_WEBHOOK_SET = new Set(EVENTOS_WEBHOOK.map((e) => e.v))
export const eventoWebhookLabel = (v: string): string => EVENTOS_WEBHOOK.find((e) => e.v === v)?.label || v

/** Corpo canônico de um webhook — o MESMO objeto que é assinado e entregue. */
export type CorpoWebhook = { id: string; evento: string; criado_em: string; dados: unknown }
export function corpoWebhook(id: string, evento: string, criadoEmIso: string, dados: unknown): CorpoWebhook {
  return { id, evento, criado_em: criadoEmIso, dados: dados ?? {} }
}

/** Header de assinatura a partir do digest hex (o HMAC é calculado no servidor). */
export const HEADER_ASSINATURA = 'x-ventsy-signature'
export const formatarAssinatura = (digestHex: string): string => `sha256=${digestHex}`

/** Agenda de retentativa (segundos até a próxima) por nº da tentativa que falhou.
 *  1→1min, 2→5min, 3→30min, 4→2h, 5→6h. Acima disso, desiste (null). */
const BACKOFF_SEGUNDOS = [60, 300, 1800, 7200, 21600]
export const MAX_TENTATIVAS_WEBHOOK = BACKOFF_SEGUNDOS.length
export function proximaTentativaSegundos(tentativa: number): number | null {
  if (!Number.isFinite(tentativa) || tentativa < 1) return BACKOFF_SEGUNDOS[0]
  return tentativa <= BACKOFF_SEGUNDOS.length ? BACKOFF_SEGUNDOS[tentativa - 1] : null
}

/** Deve retentar? Rede caída (0), 429 ou 5xx são transitórios; 4xx não. */
export function deveRetentar(httpStatus: number, tentativa: number, max = MAX_TENTATIVAS_WEBHOOK): boolean {
  if (tentativa >= max) return false
  if (httpStatus === 0 || httpStatus === 429) return true
  return httpStatus >= 500 && httpStatus < 600
}

/** Entrega bem-sucedida? 2xx. */
export const entregaOk = (httpStatus: number): boolean => httpStatus >= 200 && httpStatus < 300

// ── API keys próprias (escopos) ──────────────────────────────────────────────
export const PREFIXO_API_KEY = 'vsk'
export const ESCOPOS_API: { v: string; label: string; descricao: string }[] = [
  { v: 'leitura',  label: 'Leitura',  descricao: 'Consultar reservas, eventos, financeiro e clientes.' },
  { v: 'escrita',  label: 'Escrita',  descricao: 'Criar e atualizar registros (reservas, leads, lançamentos).' },
  { v: 'webhooks', label: 'Webhooks', descricao: 'Gerenciar assinaturas de webhooks de saída.' },
]
export const ESCOPOS_API_SET = new Set(ESCOPOS_API.map((e) => e.v))

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
// PGRST205 = REST não achou a tabela; 42P01 = undefined_table (SQL direto).
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01'
}
