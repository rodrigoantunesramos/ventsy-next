// Motor PURO de Auditoria & Logs da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Trilha de "quem fez o quê e quando" nas entidades sensíveis (financeiro,
// contratos, preços, permissões), além de logins, exportações e exclusões.
// Aqui mora a parte determinística e testável do módulo: catálogos de ação/
// entidade, classificação de sensibilidade, REDAÇÃO de segredos (nunca logar
// senha/token/cartão em claro), cálculo do diff "antes → depois", filtros,
// agregação para os KPIs e a serialização para CSV.
//
// Consumido por:
//   • /painel/auditoria        (timeline, sensíveis, segurança, exportação)
//   • lib/auditServer.ts       (grava o log via service-role usando redigir())
//   • lib/audit.test.ts        (este motor é testado isoladamente)
//
// Regras de ouro (espelham lib/seguros.ts, lib/licencas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings
//     crus. A formatação (moeda/data/locale) fica em lib/format, chamada por
//     quem consome.
//   • Determinístico e testável: nada de relógio/fetch escondido. O "hoje" entra
//     SEMPRE por parâmetro (hojeYmd, formato 'YYYY-MM-DD').
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

import type { Json } from '@/types/supabase'
export { isMissingTable } from '@/lib/dbErrors'

// ── Tipos de domínio ─────────────────────────────────────────────────────────
export type AcaoAudit =
  | 'criar' | 'editar' | 'excluir'
  | 'login' | 'login_falha' | 'logout'
  | 'exportar' | 'permissao' | 'pagamento'
  | 'config' | 'acesso' | 'outro'

/** Forma mínima (estrutural) de uma linha de auditoria para o motor/UI. */
export type AuditLogLike = {
  acao: string
  entidade: string | null
  entidade_id: string | null
  ator_id: string | null
  ator_nome: string | null
  ator_email: string | null
  descricao: string | null
  sensivel: boolean
  sucesso: boolean
  ip: string | null
  user_agent: string | null
  criado_em: string
  antes?: Json | null
  depois?: Json | null
  meta?: Json | null
}

// ── Catálogo de ações (rótulo + chip + tom semântico + sensibilidade) ─────────
export const ACOES: { v: AcaoAudit; label: string; chip: string; cor: string; sensivel: boolean }[] = [
  { v: 'criar',       label: 'Criação',           chip: 'bg-emerald-50 text-emerald-700', cor: '#16a34a', sensivel: false },
  { v: 'editar',      label: 'Edição',            chip: 'bg-sky-50 text-sky-700',         cor: '#0284c7', sensivel: false },
  { v: 'excluir',     label: 'Exclusão',          chip: 'bg-red-50 text-red-700',         cor: '#dc2626', sensivel: true },
  { v: 'permissao',   label: 'Permissão / papel', chip: 'bg-amber-50 text-amber-700',     cor: '#d97706', sensivel: true },
  { v: 'pagamento',   label: 'Pagamento',         chip: 'bg-brand-50 text-brand',         cor: '#ff385c', sensivel: true },
  { v: 'exportar',    label: 'Exportação',        chip: 'bg-violet-50 text-violet-700',   cor: '#7c3aed', sensivel: true },
  { v: 'login',       label: 'Login',             chip: 'bg-slate-100 text-slate-600',    cor: '#475569', sensivel: false },
  { v: 'login_falha', label: 'Login falho',       chip: 'bg-red-50 text-red-700',         cor: '#dc2626', sensivel: true },
  { v: 'logout',      label: 'Logout',            chip: 'bg-slate-100 text-slate-500',    cor: '#64748b', sensivel: false },
  { v: 'config',      label: 'Configuração',      chip: 'bg-indigo-50 text-indigo-700',   cor: '#4f46e5', sensivel: false },
  { v: 'acesso',      label: 'Acesso / portaria', chip: 'bg-teal-50 text-teal-700',       cor: '#0d9488', sensivel: false },
  { v: 'outro',       label: 'Outro',             chip: 'bg-black/[0.04] text-ink-muted', cor: '#6b7280', sensivel: false },
]
export const ACAO_BY = Object.fromEntries(ACOES.map((a) => [a.v, a])) as Record<AcaoAudit, (typeof ACOES)[number]>
export const acaoLabel = (v: string | null): string => ACAO_BY[(v || 'outro') as AcaoAudit]?.label || v || '—'
export const acaoChip = (v: string | null): string => ACAO_BY[(v || 'outro') as AcaoAudit]?.chip || 'bg-black/[0.04] text-ink-muted'
export const acaoCor = (v: string | null): string => ACAO_BY[(v || 'outro') as AcaoAudit]?.cor || '#6b7280'

/** Ações que pertencem à aba "Segurança" (autenticação/sessão). */
export const ACOES_SEGURANCA: AcaoAudit[] = ['login', 'login_falha', 'logout']

// ── Catálogo de entidades (chave estável → rótulo amigável) ───────────────────
// A chave é livre (a passada por quem registra); aqui mapeamos as conhecidas.
export const ENTIDADES: { key: string; label: string; sensivel: boolean }[] = [
  { key: 'lancamento',     label: 'Lançamento financeiro', sensivel: true },
  { key: 'parcela',        label: 'Parcela / recebível',   sensivel: true },
  { key: 'contrato',       label: 'Contrato',              sensivel: true },
  { key: 'proposta',       label: 'Proposta',              sensivel: true },
  { key: 'preco',          label: 'Preço / precificação',  sensivel: true },
  { key: 'permissao',      label: 'Permissão / papel',     sensivel: true },
  { key: 'pagamento',      label: 'Pagamento',             sensivel: true },
  { key: 'nota_fiscal',    label: 'Nota fiscal',           sensivel: true },
  { key: 'fatura',         label: 'Fatura',                sensivel: true },
  { key: 'seguro',         label: 'Seguro / apólice',      sensivel: true },
  { key: 'licenca',        label: 'Licença / alvará',      sensivel: true },
  { key: 'dados_pessoais', label: 'Dados pessoais (LGPD)', sensivel: true },
  { key: 'conta',          label: 'Conta',                 sensivel: true },
  { key: 'usuario',        label: 'Usuário / equipe',      sensivel: true },
  { key: 'integracao',     label: 'Integração',            sensivel: true },
  { key: 'cliente',        label: 'Cliente / evento',      sensivel: false },
  { key: 'evento',         label: 'Evento',                sensivel: false },
  { key: 'documento',      label: 'Documento',             sensivel: false },
  { key: 'reserva',        label: 'Reserva',               sensivel: false },
  { key: 'configuracao',   label: 'Configuração',          sensivel: false },
  { key: 'sessao',         label: 'Sessão / login',        sensivel: false },
]
export const ENTIDADE_BY = Object.fromEntries(ENTIDADES.map((e) => [e.key, e])) as Record<string, (typeof ENTIDADES)[number]>
export function entidadeLabel(v: string | null | undefined): string {
  if (!v) return '—'
  return ENTIDADE_BY[v]?.label || v.replace(/_/g, ' ')
}

// Padrão que casa entidades sensíveis pelo nome (fallback quando não catalogada).
const RE_ENTIDADE_SENSIVEL = /financ|lancamento|parcela|contrato|proposta|prec|permiss|papel|pagamento|nota|fatura|seguro|licenc|fiscal|dado|lgpd|conta|usuario|equipe|integrac|cartao|chave/i

/** Uma ação/entidade é "sensível" (merece destaque/alerta)? */
export function isSensivel(acao: string | null | undefined, entidade?: string | null): boolean {
  if (acao && ACAO_BY[acao as AcaoAudit]?.sensivel) return true
  if (entidade) {
    if (ENTIDADE_BY[entidade]?.sensivel) return true
    if (RE_ENTIDADE_SENSIVEL.test(entidade)) return true
  }
  return false
}

// ── Redação de segredos (NUNCA logar credenciais/dados sensíveis em claro) ────
const MASK = '••••••'
// Chaves cujo VALOR nunca deve ser gravado em claro no antes/depois/meta.
const RE_CHAVE_SECRETA = /senha|password|secret|token|cvv|cvc|card|cartao|chave|api[_-]?key|apikey|authorization|auth_token|access_token|refresh_token|service_role|client_secret|private|hash|salt|pix[_-]?key/i

/**
 * Redige (mascara) recursivamente quaisquer campos cujo NOME indique segredo,
 * preservando a estrutura para o diff. Limita a profundidade para não estourar
 * em objetos cíclicos/gigantes. Strings muito longas são truncadas.
 */
export function redigirSegredos(value: unknown, profundidade = 0): Json {
  if (value == null) return null
  if (profundidade > 6) return '[…]'
  const t = typeof value
  if (t === 'number' || t === 'boolean') return value as Json
  if (t === 'string') {
    const s = value as string
    return s.length > 2000 ? s.slice(0, 2000) + '…' : s
  }
  if (Array.isArray(value)) {
    return value.slice(0, 200).map((v) => redigirSegredos(v, profundidade + 1))
  }
  if (t === 'object') {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = RE_CHAVE_SECRETA.test(k) ? MASK : redigirSegredos(v, profundidade + 1)
    }
    return out
  }
  return String(value)
}

// ── Diff "antes → depois" ─────────────────────────────────────────────────────
export type CampoDiff = { campo: string; de: string; para: string }

// Campos técnicos que poluem o diff e não interessam à auditoria de negócio.
const IGNORAR_DIFF = new Set([
  'atualizado_em', 'criado_em', 'updated_at', 'created_at', 'atualizadoEm', 'criadoEm',
])

function valorStr(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

/**
 * Compara dois snapshots (objetos planos do banco) e devolve os campos que
 * mudaram. Robusto a null/arrays/objetos; ignora campos técnicos. Não formata
 * moeda — os valores saem crus (a UI decide a formatação).
 */
export function calcularDiff(antes: unknown, depois: unknown): CampoDiff[] {
  const a = (antes && typeof antes === 'object' && !Array.isArray(antes)) ? (antes as Record<string, unknown>) : {}
  const b = (depois && typeof depois === 'object' && !Array.isArray(depois)) ? (depois as Record<string, unknown>) : {}
  const chaves = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
  const out: CampoDiff[] = []
  for (const campo of chaves) {
    if (IGNORAR_DIFF.has(campo)) continue
    const de = valorStr(a[campo])
    const para = valorStr(b[campo])
    if (de !== para) out.push({ campo, de, para })
  }
  return out
}

/** Há um diff exibível (edição com antes e depois)? */
export function temDiff(log: Pick<AuditLogLike, 'antes' | 'depois'>): boolean {
  return calcularDiff(log.antes, log.depois).length > 0
}

// ── Datas (agnósticas de fuso; comparação lexicográfica de ISO) ───────────────
/** Parte só-data ('YYYY-MM-DD') de um timestamp/ISO. '' se inválido. */
export function diaDe(criadoEm: string | null | undefined): string {
  const s = String(criadoEm || '')
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : ''
}

/** Soma `dias` (pode ser negativo) a um 'YYYY-MM-DD' e devolve 'YYYY-MM-DD'. */
export function addDiasYMD(hojeYmd: string, dias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(hojeYmd)
  if (!m) return hojeYmd
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  d.setUTCDate(d.getUTCDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

// ── Filtros (puros) ───────────────────────────────────────────────────────────
export type FiltrosAudit = {
  acao?: string       // '' = todas
  entidade?: string   // '' = todas
  ator?: string       // ator_id; '' = todos
  sensivel?: boolean  // true = só sensíveis
  seguranca?: boolean // true = só login/logout/login_falha
  busca?: string      // texto livre (descrição/entidade/ator/ip)
  de?: string         // 'YYYY-MM-DD' inclusivo
  ate?: string        // 'YYYY-MM-DD' inclusivo
}

export function filtrarLogs<T extends AuditLogLike>(logs: T[], f: FiltrosAudit): T[] {
  const q = (f.busca || '').trim().toLowerCase()
  return logs.filter((l) => {
    if (f.acao && l.acao !== f.acao) return false
    if (f.entidade && (l.entidade || '') !== f.entidade) return false
    if (f.ator && (l.ator_id || '') !== f.ator) return false
    if (f.sensivel && !l.sensivel) return false
    if (f.seguranca && !ACOES_SEGURANCA.includes(l.acao as AcaoAudit)) return false
    if (f.de && diaDe(l.criado_em) < f.de) return false
    if (f.ate && diaDe(l.criado_em) > f.ate) return false
    if (q) {
      const alvo = [
        l.descricao, l.entidade, l.entidade_id, l.ator_nome, l.ator_email, l.ip, acaoLabel(l.acao),
      ].filter(Boolean).join(' ').toLowerCase()
      if (!alvo.includes(q)) return false
    }
    return true
  })
}

// ── Agregação para KPIs ───────────────────────────────────────────────────────
export type ResumoAuditoria = {
  total: number
  sensiveis: number
  exclusoes: number
  exportacoes: number
  permissoes: number
  pagamentos: number
  logins: number
  loginsFalha: number
  atores: number              // atores distintos
  porAcao: { acao: AcaoAudit; label: string; cor: string; n: number }[]
}

export function resumoAuditoria(logs: AuditLogLike[]): ResumoAuditoria {
  const r: ResumoAuditoria = {
    total: logs.length, sensiveis: 0, exclusoes: 0, exportacoes: 0, permissoes: 0,
    pagamentos: 0, logins: 0, loginsFalha: 0, atores: 0, porAcao: [],
  }
  const porAcao = new Map<string, number>()
  const atores = new Set<string>()
  for (const l of logs) {
    if (l.sensivel) r.sensiveis++
    if (l.acao === 'excluir') r.exclusoes++
    else if (l.acao === 'exportar') r.exportacoes++
    else if (l.acao === 'permissao') r.permissoes++
    else if (l.acao === 'pagamento') r.pagamentos++
    else if (l.acao === 'login') r.logins++
    else if (l.acao === 'login_falha') r.loginsFalha++
    if (l.ator_id) atores.add(l.ator_id)
    porAcao.set(l.acao, (porAcao.get(l.acao) || 0) + 1)
  }
  r.atores = atores.size
  r.porAcao = Array.from(porAcao.entries())
    .map(([acao, n]) => ({ acao: acao as AcaoAudit, label: acaoLabel(acao), cor: acaoCor(acao), n }))
    .sort((a, b) => b.n - a.n)
  return r
}

/** Série diária de atividade nos últimos `dias` (para o sparkline da timeline). */
export function atividadePorDia(logs: AuditLogLike[], hojeYmd: string, dias = 30): { dia: string; n: number }[] {
  const serie: { dia: string; n: number }[] = []
  const idx = new Map<string, number>()
  for (let i = dias - 1; i >= 0; i--) {
    const dia = addDiasYMD(hojeYmd, -i)
    idx.set(dia, serie.length)
    serie.push({ dia, n: 0 })
  }
  for (const l of logs) {
    const pos = idx.get(diaDe(l.criado_em))
    if (pos != null) serie[pos].n++
  }
  return serie
}

// ── Detecção de logins suspeitos (heurística leve, sem geoip) ─────────────────
/**
 * Marca como "suspeito" um login bem-sucedido cujo IP nunca apareceu antes para
 * aquele ator OU que ocorre logo após ≥ `limiarFalhas` falhas recentes. Puro:
 * recebe a lista e devolve os ids (índices) suspeitos. A UI destaca.
 */
export function loginsSuspeitos(
  logs: (AuditLogLike & { id: string | number })[],
  opts: { limiarFalhas?: number } = {},
): Set<string | number> {
  const limiar = opts.limiarFalhas ?? 3
  const suspeitos = new Set<string | number>()
  // Ordena do mais antigo para o mais novo para construir o histórico de IPs.
  const ordenado = [...logs].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  const ipsPorAtor = new Map<string, Set<string>>()
  const falhasRecentes = new Map<string, number>()
  for (const l of ordenado) {
    const ator = l.ator_id || l.ator_email || ''
    if (l.acao === 'login_falha') {
      falhasRecentes.set(ator, (falhasRecentes.get(ator) || 0) + 1)
      continue
    }
    if (l.acao !== 'login' || !l.sucesso) continue
    const ips = ipsPorAtor.get(ator) || new Set<string>()
    const ipNovo = !!l.ip && ips.size > 0 && !ips.has(l.ip)
    const aposFalhas = (falhasRecentes.get(ator) || 0) >= limiar
    if (ipNovo || aposFalhas) suspeitos.add(l.id)
    if (l.ip) ips.add(l.ip)
    ipsPorAtor.set(ator, ips)
    falhasRecentes.set(ator, 0) // login OK zera a contagem de falhas
  }
  return suspeitos
}

// ── Resumo curto do user-agent (sem libs) ─────────────────────────────────────
export function resumirUserAgent(ua: string | null | undefined): string {
  const s = String(ua || '')
  if (!s) return '—'
  const so =
    /Windows/i.test(s) ? 'Windows' :
    /Android/i.test(s) ? 'Android' :
    /iPhone|iPad|iOS/i.test(s) ? 'iOS' :
    /Mac OS X|Macintosh/i.test(s) ? 'macOS' :
    /Linux/i.test(s) ? 'Linux' : ''
  const nav =
    /Edg\//i.test(s) ? 'Edge' :
    /OPR\/|Opera/i.test(s) ? 'Opera' :
    /Chrome\//i.test(s) ? 'Chrome' :
    /Firefox\//i.test(s) ? 'Firefox' :
    /Safari\//i.test(s) ? 'Safari' : ''
  const r = [nav, so].filter(Boolean).join(' · ')
  return r || s.slice(0, 40)
}

// ── Serialização para CSV (export de auditoria externa) ───────────────────────
const csvEsc = (s: unknown): string => `"${String(s ?? '').replace(/"/g, '""')}"`

/**
 * Gera o conteúdo CSV (string) da trilha. Datas saem em ISO cru (auditável,
 * sem locale). A UI cuida do download (Blob). Resume o diff numa coluna.
 */
export function logsParaCSV(logs: AuditLogLike[]): string {
  const header = [
    'Data/hora (ISO)', 'Ator', 'E-mail', 'Ação', 'Entidade', 'ID alvo',
    'Sucesso', 'Sensível', 'IP', 'Dispositivo', 'Descrição', 'Alterações',
  ].map(csvEsc).join(',')
  const linhas = logs.map((l) => {
    const diff = calcularDiff(l.antes, l.depois)
      .map((d) => `${d.campo}: ${d.de} → ${d.para}`).join(' | ')
    return [
      l.criado_em, l.ator_nome || '', l.ator_email || '', acaoLabel(l.acao),
      entidadeLabel(l.entidade), l.entidade_id || '',
      l.sucesso ? 'sim' : 'não', l.sensivel ? 'sim' : 'não',
      l.ip || '', resumirUserAgent(l.user_agent), l.descricao || '', diff,
    ].map(csvEsc).join(',')
  })
  return [header, ...linhas].join('\r\n')
}
