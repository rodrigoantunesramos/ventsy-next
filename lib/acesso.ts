// Motor PURO de Segurança, Acesso & Credenciamento da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de verdade para: autorização de credencial por zona, validação de
// check-in/out (com anti-duplicidade), LOTAÇÃO EM TEMPO REAL por zona/total
// (presença líquida + pico) e leitura/normalização do QR. É consumida por:
//   • /painel/acesso     (credenciamento, portaria, lotação, listas, segurança)
//   • /api/acesso         (registro AUTORITATIVO de movimento — anti-duplicidade
//                          e bloqueio por capacidade, server-side)
//
// Modelo de lotação (modelo de torniquete, robusto e auditável):
//   cada movimento é +1 (entrada) / −1 (saída) numa ZONA. A ocupação atual de
//   uma zona é a soma líquida dos seus movimentos; o PICO é o máximo dessa soma
//   ao longo do tempo (varredura cronológica). O total do evento é a ocupação do
//   perímetro (zona `geral`); sem perímetro, cai para a soma das sub-zonas.
//   A anti-duplicidade (validarMovimento) mantém o log limpo de beeps repetidos,
//   então a soma líquida == "quem está dentro".
//
// Regras de ouro (espelham lib/equipamentos.ts / lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só dados crus. Formatação
//     fica em lib/format, chamada por quem consome.
//   • Determinístico e testável: o "agora" entra por parâmetro (nowMs). Nada de
//     relógio/aleatoriedade escondidos na lógica.

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Tipo de credencial — do pequeno (convidado) ao gigante (piloto/expositor). */
export type CredencialTipo =
  | 'convidado' | 'vip' | 'equipe' | 'organizacao' | 'seguranca' | 'fornecedor'
  | 'imprensa' | 'autoridade' | 'atleta' | 'expositor' | 'piloto' | 'artista'

/** Estado da credencial. `checkin`/`checkout` é denormalização da última posição
 *  no perímetro (o log é a verdade da lotação); `bloqueada` = lista de bloqueio. */
export type CredencialStatus = 'emitida' | 'checkin' | 'checkout' | 'bloqueada'
export type Direcao = 'entrada' | 'saida'

/** Zona com capacidade autorizada (espelha docs/sql/acesso.sql). `codigo` é o
 *  identificador estável referenciado por `credenciais.zonas[]`. */
export type Zona = {
  id: string
  usuario_id?: string
  evento_id: string | null
  codigo: string
  nome: string
  capacidade: number | null            // 0/null = sem limite
  tipos_permitidos: string[]           // vazio = todas as credenciais podem
  cor: string | null
  ordem: number
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

/** Credencial (espelha a tabela `credenciais`). `zonas` guarda CÓDIGOS de zona;
 *  vazio = só perímetro; inclui `'todas'` = acesso total. */
export type Credencial = {
  id: string
  usuario_id?: string
  evento_id: string | null
  tipo: CredencialTipo | string
  nome: string
  doc: string | null
  empresa: string | null
  categoria_ingresso_id: string | null
  qr_token: string
  zonas: string[]
  status: CredencialStatus | string
  foto_url: string | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

/** Movimento de acesso (espelha `acesso_eventos_log`) — base da lotação. */
export type AcessoLog = {
  id: string
  usuario_id?: string
  evento_id: string | null
  credencial_id: string | null
  zona: string
  ponto: string | null
  direcao: Direcao | string
  criado_em: string
}

// Códigos reservados de zona.
export const ZONA_GERAL = 'geral'   // perímetro / total do evento
export const ZONA_TODAS = 'todas'   // sentinela em credenciais.zonas = acesso total

// ── Metadados de tipo (rótulo PT + chip + hex). i18n: label é o default PT. ──
export type TipoMeta = { label: string; chip: string; hex: string }
export const CRED_TIPO_META: Record<string, TipoMeta> = {
  convidado:   { label: 'Convidado',   chip: 'bg-slate-100 text-slate-700',   hex: '#64748b' },
  vip:         { label: 'VIP',         chip: 'bg-amber-100 text-amber-800',   hex: '#d97706' },
  equipe:      { label: 'Equipe',      chip: 'bg-blue-100 text-blue-700',     hex: '#2563eb' },
  organizacao: { label: 'Organização', chip: 'bg-violet-100 text-violet-700', hex: '#7c3aed' },
  seguranca:   { label: 'Segurança',   chip: 'bg-red-100 text-red-700',       hex: '#dc2626' },
  fornecedor:  { label: 'Fornecedor',  chip: 'bg-cyan-100 text-cyan-700',     hex: '#0891b2' },
  imprensa:    { label: 'Imprensa',    chip: 'bg-teal-100 text-teal-700',     hex: '#0d9488' },
  autoridade:  { label: 'Autoridade',  chip: 'bg-indigo-100 text-indigo-700', hex: '#4338ca' },
  atleta:      { label: 'Atleta',      chip: 'bg-green-100 text-green-700',    hex: '#16a34a' },
  expositor:   { label: 'Expositor',   chip: 'bg-orange-100 text-orange-700',  hex: '#ea580c' },
  piloto:      { label: 'Piloto',      chip: 'bg-sky-100 text-sky-700',       hex: '#0284c7' },
  artista:     { label: 'Artista',     chip: 'bg-pink-100 text-pink-700',     hex: '#db2777' },
}
const TIPO_FALLBACK: TipoMeta = { label: '—', chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
export function credTipoMeta(tipo: string): TipoMeta {
  return CRED_TIPO_META[tipo] || { ...TIPO_FALLBACK, label: tipo }
}
/** Tipos como lista (ordem estável p/ selects/filtros/legendas). */
export const CRED_TIPOS: { v: CredencialTipo; label: string; hex: string }[] =
  (Object.keys(CRED_TIPO_META) as CredencialTipo[]).map((v) => ({ v, label: CRED_TIPO_META[v].label, hex: CRED_TIPO_META[v].hex }))

export type StatusMeta = { label: string; chip: string; hex: string }
export const CRED_STATUS_META: Record<string, StatusMeta> = {
  emitida:   { label: 'Emitida',    chip: 'bg-slate-100 text-slate-600',     hex: '#94a3b8' },
  checkin:   { label: 'Presente',   chip: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
  checkout:  { label: 'Saiu',       chip: 'bg-gray-100 text-gray-500',       hex: '#9ca3af' },
  bloqueada: { label: 'Bloqueada',  chip: 'bg-red-100 text-red-700',         hex: '#ef4444' },
}
export function credStatusMeta(status: string): StatusMeta {
  return CRED_STATUS_META[status] || { label: status, chip: 'bg-gray-100 text-gray-600', hex: '#9ca3af' }
}

// ── Tempo (puro) ──────────────────────────────────────────────────────────────
export const SEGUNDO = 1000
export const MINUTO = 60 * SEGUNDO
export const HORA = 60 * MINUTO
export function parseMs(v: string | null | undefined): number | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

// ── QR: payload, leitura e exibição ───────────────────────────────────────────
const QR_PREFIX = 'VTS:'
/** String embutida no QR da credencial (prefixo identifica a origem Ventsy). */
export function gerarQrPayload(token: string): string {
  return QR_PREFIX + token
}
/**
 * Normaliza a leitura do coletor/câmera para o token canônico: remove o prefixo
 * Ventsy, espaços e quebras. Aceita também URLs (…/c/<token>) e o token cru.
 */
export function normalizarLeitura(raw: string): string {
  let s = (raw || '').trim()
  if (!s) return ''
  if (s.toUpperCase().startsWith(QR_PREFIX)) s = s.slice(QR_PREFIX.length)
  const m = /(?:[?&](?:t|token)=|\/c\/|\/cred\/)([^\s/?&#]+)/i.exec(s)
  if (m) s = m[1]
  return s.trim()
}
/** Sufixo legível p/ conferência visual rápida (não é segredo). */
export function tokenCurto(token: string): string {
  const s = (token || '').replace(/[^a-zA-Z0-9]/g, '')
  return s.length <= 6 ? s.toUpperCase() : s.slice(-6).toUpperCase()
}

// ── Autorização por zona ──────────────────────────────────────────────────────
/**
 * A credencial pode acessar `zonaCodigo`?
 *   • perímetro (`geral`): qualquer credencial não bloqueada passa;
 *   • `'todas'` em zonas: acesso total;
 *   • caso contrário: a zona precisa estar listada em `cred.zonas`.
 * (Bloqueio por status é tratado em validarMovimento, não aqui.)
 */
export function podeAcessarZona(cred: Pick<Credencial, 'zonas'>, zonaCodigo: string): boolean {
  if (zonaCodigo === ZONA_GERAL) return true
  const zonas = cred.zonas || []
  if (zonas.includes(ZONA_TODAS)) return true
  return zonas.includes(zonaCodigo)
}

/** A zona aceita este tipo de credencial? (vazio = todos). */
export function zonaAceitaTipo(zona: Pick<Zona, 'tipos_permitidos'>, tipo: string): boolean {
  const lista = zona.tipos_permitidos || []
  return lista.length === 0 || lista.includes(tipo)
}

// ── Lotação (núcleo) ──────────────────────────────────────────────────────────
function delta(direcao: string): number { return direcao === 'entrada' ? 1 : direcao === 'saida' ? -1 : 0 }

export type Ocupacao = {
  total: number                         // perímetro (geral) ou soma das zonas
  porZona: Record<string, number>       // presença líquida por código de zona
  porPonto: Record<string, number>      // saldo líquido por ponto de acesso
  entradas: number
  saidas: number
}
/**
 * Ocupação atual a partir do log. `total` = ocupação do perímetro (`geral`) se
 * houver movimentos nele; senão soma as zonas (uso só-sub-zonas). Valores podem
 * ficar negativos por erro de operação — a UI/`nivelLotacao` faz o clamp.
 */
export function calcularOcupacao(logs: AcessoLog[]): Ocupacao {
  const porZona: Record<string, number> = {}
  const porPonto: Record<string, number> = {}
  let entradas = 0, saidas = 0
  for (const l of logs) {
    const d = delta(l.direcao)
    if (d === 0) continue
    if (d > 0) entradas++; else saidas++
    porZona[l.zona] = (porZona[l.zona] || 0) + d
    const p = l.ponto || '—'
    porPonto[p] = (porPonto[p] || 0) + d
  }
  const total = ZONA_GERAL in porZona
    ? porZona[ZONA_GERAL]
    : Object.values(porZona).reduce((s, n) => s + n, 0)
  return { total, porZona, porPonto, entradas, saidas }
}

/** Logs que compõem o TOTAL do evento (perímetro `geral`, ou todos se não houver). */
function logsDoTotal(logs: AcessoLog[]): AcessoLog[] {
  const temGeral = logs.some((l) => l.zona === ZONA_GERAL)
  return temGeral ? logs.filter((l) => l.zona === ZONA_GERAL) : logs
}

export type Pico = { pico: number; picoEm: number | null }
/**
 * Pico de ocupação (máximo simultâneo) por varredura cronológica. Sem `zona`,
 * usa o perímetro (total). Determinístico: ordena por `criado_em`.
 */
export function picoOcupacao(logs: AcessoLog[], zona?: string): Pico {
  const arr = (zona ? logs.filter((l) => l.zona === zona) : logsDoTotal(logs))
    .map((l) => ({ t: parseMs(l.criado_em) ?? 0, d: delta(l.direcao) }))
    .filter((e) => e.d !== 0)
    .sort((a, b) => a.t - b.t)
  let cur = 0, pico = 0, picoEm: number | null = null
  for (const e of arr) {
    cur += e.d
    if (cur > pico) { pico = cur; picoEm = e.t }
  }
  return { pico, picoEm }
}

export type CurvaPonto = { t: number; n: number }
/** Curva de presença ao longo do tempo (passos por movimento) p/ o gráfico. */
export function curvaOcupacao(logs: AcessoLog[], zona?: string): CurvaPonto[] {
  const arr = (zona ? logs.filter((l) => l.zona === zona) : logsDoTotal(logs))
    .map((l) => ({ t: parseMs(l.criado_em) ?? 0, d: delta(l.direcao) }))
    .filter((e) => e.d !== 0)
    .sort((a, b) => a.t - b.t)
  const out: CurvaPonto[] = []
  let cur = 0
  for (const e of arr) { cur += e.d; out.push({ t: e.t, n: Math.max(0, cur) }) }
  return out
}

export type NivelLotacao = 'tranquilo' | 'atencao' | 'alerta' | 'lotado'
export type LotacaoMeta = { label: string; classe: string; barra: string; hex: string }
export const LOTACAO_META: Record<NivelLotacao, LotacaoMeta> = {
  tranquilo: { label: 'Tranquilo', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200', barra: 'bg-emerald-500', hex: '#10b981' },
  atencao:   { label: 'Atenção',   classe: 'bg-amber-50 text-amber-700 border-amber-200',     barra: 'bg-amber-500',   hex: '#f59e0b' },
  alerta:    { label: 'Alerta',    classe: 'bg-orange-50 text-orange-700 border-orange-200',   barra: 'bg-orange-500',  hex: '#f97316' },
  lotado:    { label: 'Lotado',    classe: 'bg-red-50 text-red-700 border-red-200',           barra: 'bg-red-500',     hex: '#ef4444' },
}

export type Lotacao = {
  presentes: number
  capacidade: number               // 0 = sem limite
  ratio: number                    // 0–1+ (presentes/capacidade); 0 se sem limite
  restante: number                 // vagas restantes (Infinity se sem limite)
  nivel: NivelLotacao
}
/** Nível de lotação de uma zona/total vs. capacidade autorizada (bombeiros). */
export function nivelLotacao(presentes: number, capacidade: number | null | undefined): Lotacao {
  const pres = Math.max(0, Math.round(presentes) || 0)
  const cap = Math.max(0, Math.round(Number(capacidade) || 0))
  if (cap <= 0) {
    return { presentes: pres, capacidade: 0, ratio: 0, restante: Infinity, nivel: 'tranquilo' }
  }
  const ratio = pres / cap
  const nivel: NivelLotacao = ratio >= 1 ? 'lotado' : ratio >= 0.9 ? 'alerta' : ratio >= 0.7 ? 'atencao' : 'tranquilo'
  return { presentes: pres, capacidade: cap, ratio, restante: Math.max(0, cap - pres), nivel }
}

// ── Validação de movimento (check-in/out) ─────────────────────────────────────
export type MotivoRecusa = 'bloqueada' | 'zona_negada' | 'duplicado' | 'ja_dentro' | 'ja_fora' | 'lotacao'
export type DecisaoMovimento = {
  ok: boolean
  motivo?: MotivoRecusa
  aviso?: string          // mensagem PT default (UI pode reescrever via i18n)
  bloqueante: boolean     // recusar quando true e sem `force`
}
export type ContextoMovimento = {
  direcao: Direcao
  zona: string
  cred: Pick<Credencial, 'status' | 'zonas'>
  ultimoMovimentoZona?: AcessoLog | null   // último log da credencial NESTA zona
  capacidadeZona?: number | null           // capacidade autorizada da zona
  ocupacaoZona?: number                    // ocupação atual da zona (antes do mov.)
  nowMs?: number
  debounceMs?: number                      // janela anti-duplo-beep (default 8s)
}

/**
 * Decide se um movimento pode ser registrado. Ordem: bloqueio → zona →
 * duplicidade (beep repetido) → coerência de estado (re-entrada/saída sem par)
 * → capacidade. `bloqueante` distingue recusa dura (precisa `force`) de aviso.
 */
export function validarMovimento(ctx: ContextoMovimento): DecisaoMovimento {
  const now = ctx.nowMs ?? Date.now()
  const debounce = ctx.debounceMs ?? 8 * SEGUNDO

  if (ctx.cred.status === 'bloqueada') {
    return { ok: false, motivo: 'bloqueada', bloqueante: true, aviso: 'Credencial na lista de bloqueio.' }
  }
  if (ctx.direcao === 'entrada' && !podeAcessarZona(ctx.cred, ctx.zona)) {
    return { ok: false, motivo: 'zona_negada', bloqueante: true, aviso: 'Credencial sem acesso a esta zona.' }
  }

  const ultimo = ctx.ultimoMovimentoZona || null
  const ultimoMs = ultimo ? parseMs(ultimo.criado_em) : null
  if (ultimo && ultimo.direcao === ctx.direcao) {
    if (ultimoMs != null && now - ultimoMs < debounce) {
      return { ok: false, motivo: 'duplicado', bloqueante: true, aviso: 'Leitura repetida — já registrada.' }
    }
    // mesma direção fora da janela: estado incoerente (aviso, não bloqueio duro)
    if (ctx.direcao === 'entrada') return { ok: false, motivo: 'ja_dentro', bloqueante: false, aviso: 'Já consta dentro desta zona.' }
    return { ok: false, motivo: 'ja_fora', bloqueante: false, aviso: 'Já consta fora desta zona.' }
  }

  if (ctx.direcao === 'entrada') {
    const cap = Math.max(0, Number(ctx.capacidadeZona) || 0)
    const ocup = Math.max(0, Number(ctx.ocupacaoZona) || 0)
    if (cap > 0 && ocup >= cap) {
      return { ok: false, motivo: 'lotacao', bloqueante: true, aviso: 'Zona na capacidade máxima autorizada.' }
    }
  }
  return { ok: true, bloqueante: false }
}

// ── Agregações de credenciais (KPIs/listas) ──────────────────────────────────
export type ResumoCredenciais = {
  total: number
  porTipo: Record<string, number>
  porStatus: Record<string, number>
  presentes: number          // status checkin
  emitidas: number
  bloqueadas: number
  taxaCheckin: number        // fração que já fez check-in pelo menos uma vez
}
export function resumoCredenciais(creds: Credencial[]): ResumoCredenciais {
  const porTipo: Record<string, number> = {}
  const porStatus: Record<string, number> = {}
  let presentes = 0, bloqueadas = 0, emitidas = 0, jaEntraram = 0
  for (const c of creds) {
    porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1
    porStatus[c.status] = (porStatus[c.status] || 0) + 1
    if (c.status === 'checkin') { presentes++; jaEntraram++ }
    else if (c.status === 'checkout') jaEntraram++
    else if (c.status === 'bloqueada') bloqueadas++
    else if (c.status === 'emitida') emitidas++
  }
  return {
    total: creds.length, porTipo, porStatus, presentes, emitidas, bloqueadas,
    taxaCheckin: creds.length ? jaEntraram / creds.length : 0,
  }
}

/** Último movimento (qualquer zona) de uma credencial — p/ feed/ficha. */
export function ultimoMovimento(logs: AcessoLog[], credencialId: string): AcessoLog | null {
  let best: AcessoLog | null = null
  let bestMs = -Infinity
  for (const l of logs) {
    if (l.credencial_id !== credencialId) continue
    const t = parseMs(l.criado_em) ?? 0
    if (t >= bestMs) { bestMs = t; best = l }
  }
  return best
}
