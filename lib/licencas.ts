// Motor PURO de Licenças, Alvarás & Compliance da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Controla TUDO que mantém a operação legal:
//   • alvarás PERMANENTES do espaço (funcionamento, AVCB/bombeiros, sanitário,
//     ambiental) — com vencimento, órgão, custo e documento;
//   • licenças POR EVENTO (autorização de evento, som/ruído, ECAD, vigilância
//     sanitária para A&B, policiamento, licença ambiental temporária, fechamento
//     de via para corrida, NOTAM/ANAC para aéreo) — geradas a partir de um
//     CHECKLIST por tipo/porte de evento e acompanhadas item a item.
//
// Consumido por:
//   • /painel/licencas  (painel de conformidade, permanentes, por evento, biblioteca)
//   • /api/licencas      (aplicar checklist → gera as exigências do evento;
//                         lançar custo no caixa — autoritativo, service-role)
//
// Regras de ouro (espelham lib/producao.ts, lib/reservas.ts, lib/ponto.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números, datas (YYYY-MM-DD)
//     e flags. A formatação (moeda/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: o "hoje" entra por parâmetro (hojeYMD). Nada de
//     relógio escondido dentro da lógica de status/semáforo/prontidão.
//   • i18n: rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

export { isMissingTable } from '@/lib/dbErrors'

// ── Datas (puras, sem fuso — só-data ancorada à meia-noite local) ────────────
function pad2(n: number): string { return String(n).padStart(2, '0') }

/** Data de hoje como 'YYYY-MM-DD' no horário local (helper p/ a UI passar à engine). */
export function todayYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Dias de `hojeYMD` até `ymd` (negativo = no passado). null se `ymd` ausente. */
export function diasAte(ymd: string | null | undefined, hojeYMD: string): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const alvo = Date.parse(`${ymd}T00:00:00`)
  const hoje = Date.parse(`${hojeYMD}T00:00:00`)
  if (Number.isNaN(alvo) || Number.isNaN(hoje)) return null
  return Math.round((alvo - hoje) / 86_400_000)
}

/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (ancorado ao meio-dia p/ evitar DST/UTC off-by-one). */
export function addDiasYMD(ymd: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + Math.round(Number(n) || 0))
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Rótulo técnico de prazo (sem locale): "vencida há 3 dias" / "vence hoje" / "em 12 dias". */
export function diasLabel(dias: number | null): string {
  if (dias == null) return 'Sem validade'
  if (dias < 0) return `Vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  return `Vence em ${dias} dias`
}

// ── Vocabulário do domínio ───────────────────────────────────────────────────
/** Onde a licença se aplica: ao ESPAÇO (permanente) ou a um EVENTO. */
export type Escopo = 'permanente' | 'evento'

/** Tipo de licença/alvará (espelha o CHECK do SQL). */
export type TipoLicenca =
  | 'funcionamento' | 'avcb_bombeiros' | 'sanitaria' | 'ambiental'
  | 'ruido_som' | 'ecad' | 'evento_publico' | 'policia'
  | 'via_publica' | 'anac' | 'outro'

/** Estado de uma licença. `vigente|a_vencer|vencida` derivam da validade;
 *  `em_processo|nao_aplicavel` são estados manuais (a engine os respeita). */
export type LicencaStatus = 'vigente' | 'a_vencer' | 'vencida' | 'em_processo' | 'nao_aplicavel'

/** Nível do semáforo de conformidade. */
export type SemaforoNivel = 'verde' | 'amarelo' | 'vermelho'

// ── Tipo da linha (espelha docs/sql/licencas.sql) ────────────────────────────
export type Licenca = {
  id: string
  usuario_id?: string
  propriedade_id: number | null
  escopo: Escopo | string
  evento_id: string | null
  tipo: TipoLicenca | string
  titulo: string | null            // rótulo livre (default = label do tipo)
  orgao: string | null
  orgao_contato: string | null     // telefone/e-mail/endereço do órgão (seção Documentos & protocolos)
  numero: string | null            // número da licença emitida
  protocolo: string | null         // número do protocolo (processo em andamento)
  emissao: string | null           // 'YYYY-MM-DD'
  validade: string | null          // 'YYYY-MM-DD' (null = permanente sem vencimento)
  dias_aviso: number               // antecedência do alerta "a vencer"
  custo_num: number | null         // custo da licença (taxa/DAM) — sem "R$" aqui
  status: LicencaStatus | string
  obrigatorio: boolean             // exigência obrigatória (bloqueia prontidão do evento)
  responsavel: string | null
  documento_url: string | null     // caminho no Storage (bucket `documentos`)
  documento_nome: string | null
  lancamento_id: number | null     // despesa lançada no caixa (custo → contábil)
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Catálogo de tipos (rótulos PT default; órgão sugerido; cor; aviso padrão) ─
export type TipoMeta = { v: TipoLicenca; label: string; orgao: string; cor: string; diasAviso: number }
export const TIPOS: TipoMeta[] = [
  { v: 'funcionamento',  label: 'Alvará de funcionamento',  orgao: 'Prefeitura Municipal',         cor: '#0ea5e9', diasAviso: 60 },
  { v: 'avcb_bombeiros', label: 'AVCB / Bombeiros',          orgao: 'Corpo de Bombeiros',           cor: '#ef4444', diasAviso: 90 },
  { v: 'sanitaria',      label: 'Licença sanitária',         orgao: 'Vigilância Sanitária',         cor: '#10b981', diasAviso: 60 },
  { v: 'ambiental',      label: 'Licença ambiental',         orgao: 'Órgão ambiental',              cor: '#22c55e', diasAviso: 120 },
  { v: 'ruido_som',      label: 'Som / ruído',               orgao: 'Prefeitura / Meio ambiente',   cor: '#f59e0b', diasAviso: 30 },
  { v: 'ecad',           label: 'ECAD (direitos musicais)',  orgao: 'ECAD',                         cor: '#a855f7', diasAviso: 15 },
  { v: 'evento_publico', label: 'Autorização de evento',     orgao: 'Prefeitura Municipal',         cor: '#ff385c', diasAviso: 30 },
  { v: 'policia',        label: 'Policiamento / segurança',  orgao: 'Polícia Militar',              cor: '#6366f1', diasAviso: 30 },
  { v: 'via_publica',    label: 'Fechamento de via',         orgao: 'Prefeitura / órgão de trânsito', cor: '#f97316', diasAviso: 30 },
  { v: 'anac',           label: 'NOTAM / ANAC (aéreo)',      orgao: 'ANAC / DECEA',                 cor: '#0284c7', diasAviso: 45 },
  { v: 'outro',          label: 'Outro',                     orgao: '',                             cor: '#94a3b8', diasAviso: 60 },
]
const TIPO_BY = Object.fromEntries(TIPOS.map((t) => [t.v, t])) as Record<string, TipoMeta>
export function tipoMeta(v: string | null | undefined): TipoMeta {
  return TIPO_BY[v || 'outro'] || { v: 'outro', label: v || 'Outro', orgao: '', cor: '#94a3b8', diasAviso: 60 }
}
export function tipoLabel(v: string | null | undefined): string { return tipoMeta(v).label }
export function orgaoSugerido(v: string | null | undefined): string { return tipoMeta(v).orgao }

// ── Catálogo de status (chip/cor/nível do semáforo) ──────────────────────────
export type StatusMeta = { label: string; chip: string; dot: string; nivel: SemaforoNivel | 'neutro'; ordem: number }
export const STATUS_META: Record<LicencaStatus, StatusMeta> = {
  vencida:       { label: 'Vencida',       chip: 'bg-red-50 text-red-700',         dot: 'bg-red-500',     nivel: 'vermelho', ordem: 0 },
  a_vencer:      { label: 'A vencer',      chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   nivel: 'amarelo',  ordem: 1 },
  em_processo:   { label: 'Em processo',   chip: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-400',     nivel: 'amarelo',  ordem: 2 },
  vigente:       { label: 'Vigente',       chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', nivel: 'verde',    ordem: 3 },
  nao_aplicavel: { label: 'Não aplicável', chip: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-300',    nivel: 'neutro',   ordem: 4 },
}
export function statusMeta(v: string): StatusMeta {
  return STATUS_META[v as LicencaStatus] || { label: v, chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300', nivel: 'neutro', ordem: 9 }
}

export const ESCOPO_META: Record<Escopo, { label: string; chip: string }> = {
  permanente: { label: 'Permanente', chip: 'bg-blue-50 text-blue-700' },
  evento:     { label: 'Por evento', chip: 'bg-violet-50 text-violet-700' },
}

// ── Status efetivo ───────────────────────────────────────────────────────────
/** Status só pela validade (ignora o estado manual). 'sem_validade' = não vence. */
export function statusPorValidade(
  validade: string | null | undefined, diasAviso: number, hojeYMD: string,
): 'vigente' | 'a_vencer' | 'vencida' | 'sem_validade' {
  if (!validade) return 'sem_validade'
  const d = diasAte(validade, hojeYMD)
  if (d == null) return 'sem_validade'
  if (d < 0) return 'vencida'
  if (d <= Math.max(0, diasAviso || 0)) return 'a_vencer'
  return 'vigente'
}

/**
 * Status EFETIVO da licença para o painel: os estados manuais `em_processo` e
 * `nao_aplicavel` prevalecem (a licença ainda não foi obtida / não se aplica);
 * caso contrário deriva da validade. Permanente sem validade = vigente.
 */
export function statusEfetivo(
  l: Pick<Licenca, 'status' | 'validade' | 'dias_aviso'>, hojeYMD: string,
): LicencaStatus {
  if (l.status === 'em_processo' || l.status === 'nao_aplicavel') return l.status
  const s = statusPorValidade(l.validade, l.dias_aviso ?? 60, hojeYMD)
  return s === 'sem_validade' ? 'vigente' : s
}

// ── Painel de conformidade ───────────────────────────────────────────────────
export type ResumoConformidade = {
  total: number
  vigente: number
  a_vencer: number
  vencida: number
  em_processo: number
  nao_aplicavel: number
  geral: SemaforoNivel
}
/**
 * Conta as licenças por status efetivo e define o semáforo GERAL:
 * vermelho se houver ao menos uma vencida; amarelo se houver a_vencer ou
 * em_processo; verde caso contrário. `nao_aplicavel` não puxa o farol.
 */
export function resumoConformidade(licencas: Licenca[], hojeYMD: string): ResumoConformidade {
  const r: ResumoConformidade = {
    total: 0, vigente: 0, a_vencer: 0, vencida: 0, em_processo: 0, nao_aplicavel: 0, geral: 'verde',
  }
  for (const l of licencas) {
    const s = statusEfetivo(l, hojeYMD)
    r.total++
    r[s]++
  }
  r.geral = r.vencida > 0 ? 'vermelho' : (r.a_vencer > 0 || r.em_processo > 0) ? 'amarelo' : 'verde'
  return r
}

/** Licenças que vencem dentro de N dias (≥0 e ≤N), ordenadas pela validade. */
export function vencendoEm(licencas: Licenca[], dias: number, hojeYMD: string): Licenca[] {
  return licencas
    .filter((l) => l.status !== 'nao_aplicavel')
    .map((l) => ({ l, d: diasAte(l.validade, hojeYMD) }))
    .filter((x) => x.d != null && x.d >= 0 && x.d <= dias && statusEfetivo(x.l, hojeYMD) !== 'em_processo')
    .sort((a, b) => (a.d! - b.d!))
    .map((x) => x.l)
}

/** Buckets cumulativos 30/60/90 dias (contagem) — alertas de renovação. */
export function aVencerBuckets(licencas: Licenca[], hojeYMD: string): { d30: number; d60: number; d90: number } {
  return {
    d30: vencendoEm(licencas, 30, hojeYMD).length,
    d60: vencendoEm(licencas, 60, hojeYMD).length,
    d90: vencendoEm(licencas, 90, hojeYMD).length,
  }
}

/** Licenças vencidas (bloqueante) — ordenadas da mais antiga para a mais recente. */
export function vencidas(licencas: Licenca[], hojeYMD: string): Licenca[] {
  return licencas
    .filter((l) => statusEfetivo(l, hojeYMD) === 'vencida')
    .sort((a, b) => (a.validade || '').localeCompare(b.validade || ''))
}

/** Próximas renovações (vencidas + a vencer), ordenadas pela validade. Para o painel. */
export function proximasRenovacoes(licencas: Licenca[], hojeYMD: string, limite = 8): Licenca[] {
  return licencas
    .filter((l) => {
      const s = statusEfetivo(l, hojeYMD)
      return s === 'vencida' || s === 'a_vencer'
    })
    .sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999'))
    .slice(0, limite)
}

/**
 * Custo ANUAL de licenças permanentes (soma de custo_num das permanentes).
 * Número cru — a formatação de moeda é responsabilidade de quem exibe (lib/format).
 */
export function custoAnualLicencas(licencas: Licenca[]): number {
  return licencas
    .filter((l) => l.escopo === 'permanente')
    .reduce((s, l) => s + (Number(l.custo_num) || 0), 0)
}

/** Custo de licenças de UM evento (soma de custo_num das do evento). */
export function custoLicencasEvento(licencasEvento: Licenca[]): number {
  return licencasEvento.reduce((s, l) => s + (Number(l.custo_num) || 0), 0)
}

/** Agrupa licenças por propriedade (id → lista). `null` = sem propriedade. */
export function agruparPorPropriedade(licencas: Licenca[]): Map<number | null, Licenca[]> {
  const m = new Map<number | null, Licenca[]>()
  for (const l of licencas) {
    const k = l.propriedade_id ?? null
    const arr = m.get(k) || []
    arr.push(l)
    m.set(k, arr)
  }
  return m
}

// ── Prontidão de licenças do evento (liga com Produção) ──────────────────────
export type ProntidaoLicencas = {
  obrigatorias: number      // exigências obrigatórias que CONTAM (exclui nao_aplicavel)
  atendidas: number         // obrigatórias já vigentes/a_vencer (válidas)
  pendentes: Licenca[]      // obrigatórias em processo ou vencidas → bloqueiam
  total: number             // todas as licenças do evento
  fracao: number            // atendidas / obrigatorias (0..1)
  bloqueia: boolean         // há exigência obrigatória pendente → trava "evento pronto"
}
/**
 * Prontidão de licenciamento de um evento. Uma exigência OBRIGATÓRIA conta a não
 * ser que esteja marcada como `nao_aplicavel` (dispensada). Está ATENDIDA quando
 * vigente ou a_vencer (existe e ainda válida); fica PENDENTE quando em_processo
 * ou vencida. Se houver qualquer obrigatória pendente, bloqueia a prontidão do
 * evento (critério de aceite — liga com /painel/producao).
 */
export function prontidaoLicencasEvento(licencasEvento: Licenca[], hojeYMD: string): ProntidaoLicencas {
  let obrigatorias = 0, atendidas = 0
  const pendentes: Licenca[] = []
  for (const l of licencasEvento) {
    const s = statusEfetivo(l, hojeYMD)
    if (!l.obrigatorio || s === 'nao_aplicavel') continue
    obrigatorias++
    if (s === 'vigente' || s === 'a_vencer') atendidas++
    else pendentes.push(l) // em_processo | vencida
  }
  return {
    obrigatorias, atendidas, pendentes, total: licencasEvento.length,
    fracao: obrigatorias > 0 ? atendidas / obrigatorias : 1,
    bloqueia: pendentes.length > 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE EXIGÊNCIAS — checklist por tipo/porte de evento.
// Cada exigência declara o público mínimo a partir do qual passa a valer
// (`publicoMin`) e se é obrigatória. `exigenciasParaEvento` filtra pelo público
// estimado do evento. Os templates são o DEFAULT editável — o usuário pode salvar
// versões próprias em `compliance_checklists` (varia por município).
// ─────────────────────────────────────────────────────────────────────────────
export type ExigenciaTemplate = {
  tipo: TipoLicenca
  titulo: string
  obrigatorio: boolean
  publicoMin: number        // passa a valer quando público estimado ≥ este valor
  orgao: string
  dias_aviso: number
  descricao: string
}
export type TemplateKey = 'casamento' | 'corporativo' | 'show' | 'corrida' | 'feira' | 'aniversario' | 'generico'
export type ChecklistTemplate = { key: TemplateKey; nome: string; itens: ExigenciaTemplate[] }

// Exigências reutilizadas entre templates (montadas com pequenas variações).
function ex(
  tipo: TipoLicenca, titulo: string, publicoMin: number, obrigatorio: boolean, descricao: string, orgao?: string,
): ExigenciaTemplate {
  const m = tipoMeta(tipo)
  return { tipo, titulo, publicoMin, obrigatorio, orgao: orgao || m.orgao, dias_aviso: m.diasAviso, descricao }
}

const EX_AUTORIZACAO = (min: number, obr: boolean) =>
  ex('evento_publico', 'Autorização / alvará do evento', min, obr, 'Autoriza a realização do evento no município (porte e local).')
const EX_BOMBEIROS = (min: number, obr: boolean) =>
  ex('avcb_bombeiros', 'Laudo / vistoria dos Bombeiros do evento', min, obr, 'Plano de segurança contra incêndio e pânico dimensionado para o público.')
const EX_RUIDO = (min: number, obr: boolean) =>
  ex('ruido_som', 'Licença de som / ruído', min, obr, 'Autorização de emissão sonora dentro dos limites e horários permitidos.')
const EX_ECAD = (min: number, obr: boolean) =>
  ex('ecad', 'Autorização ECAD (música)', min, obr, 'Recolhimento de direitos autorais por execução musical (ao vivo ou mecânica).')
const EX_SANITARIA = (min: number, obr: boolean) =>
  ex('sanitaria', 'Vigilância sanitária (A&B)', min, obr, 'Obrigatória quando há produção/venda de alimentos e bebidas.')
const EX_POLICIA = (min: number, obr: boolean) =>
  ex('policia', 'Policiamento / segurança privada', min, obr, 'Dimensionamento de segurança e, acima de certo porte, apoio da Polícia Militar.')
const EX_AMBIENTAL = (min: number, obr: boolean) =>
  ex('ambiental', 'Licença ambiental temporária', min, obr, 'Controle de ruído, resíduos e impacto para eventos de grande porte ou ao ar livre.')

const TEMPLATES: Record<TemplateKey, ChecklistTemplate> = {
  casamento: {
    key: 'casamento', nome: 'Casamento',
    itens: [
      EX_AUTORIZACAO(200, true),
      EX_RUIDO(0, true),
      EX_ECAD(0, true),
      EX_SANITARIA(0, true),
      EX_BOMBEIROS(250, false),
      EX_POLICIA(400, false),
    ],
  },
  corporativo: {
    key: 'corporativo', nome: 'Corporativo / Congresso',
    itens: [
      EX_AUTORIZACAO(150, true),
      EX_SANITARIA(0, true),
      EX_BOMBEIROS(250, true),
      EX_ECAD(0, false),
      EX_POLICIA(500, false),
      EX_AMBIENTAL(3000, false),
    ],
  },
  show: {
    key: 'show', nome: 'Show / Festival',
    itens: [
      EX_AUTORIZACAO(0, true),
      EX_BOMBEIROS(0, true),
      EX_RUIDO(0, true),
      EX_ECAD(0, true),
      EX_POLICIA(500, true),
      EX_SANITARIA(0, true),
      EX_AMBIENTAL(5000, false),
    ],
  },
  corrida: {
    key: 'corrida', nome: 'Corrida / Esportivo',
    itens: [
      EX_AUTORIZACAO(0, true),
      ex('via_publica', 'Autorização de fechamento de via', 0, true, 'Interdição do percurso junto à Prefeitura / órgão de trânsito (CET/DETRAN).'),
      EX_POLICIA(0, true),
      EX_AMBIENTAL(2000, false),
      EX_ECAD(0, false),
    ],
  },
  feira: {
    key: 'feira', nome: 'Feira / Exposição',
    itens: [
      EX_AUTORIZACAO(150, true),
      EX_SANITARIA(0, true),
      EX_BOMBEIROS(250, true),
      EX_POLICIA(800, false),
      EX_AMBIENTAL(3000, false),
    ],
  },
  aniversario: {
    key: 'aniversario', nome: 'Aniversário / Festa',
    itens: [
      EX_RUIDO(0, true),
      EX_ECAD(0, true),
      EX_AUTORIZACAO(200, false),
      EX_SANITARIA(0, false),
    ],
  },
  generico: {
    key: 'generico', nome: 'Evento (genérico)',
    itens: [
      EX_AUTORIZACAO(100, true),
      EX_RUIDO(0, true),
      EX_ECAD(0, false),
      EX_SANITARIA(0, false),
      EX_BOMBEIROS(500, false),
    ],
  },
}

/** Lista de templates embutidos (p/ a Biblioteca e o seletor "aplicar checklist"). */
export function listarTemplates(): ChecklistTemplate[] {
  return Object.values(TEMPLATES)
}
/** Um template embutido pela chave (fallback genérico). */
export function templatePorChave(key: string | null | undefined): ChecklistTemplate {
  return TEMPLATES[(key || '') as TemplateKey] || TEMPLATES.generico
}

/** Mapeia o `tipo_evento` livre do CRM para a chave de template mais próxima. */
export function templateKeyParaTipo(tipo: string | null | undefined): TemplateKey {
  const t = (tipo || '').toLowerCase()
  if (/casa|wedding|noiv|matr/.test(t)) return 'casamento'
  if (/corp|congress|empres|conven|workshop|palestra|semin/.test(t)) return 'corporativo'
  if (/show|festiv|music|balad|dj/.test(t)) return 'show'
  if (/corrid|maraton|run|ciclis|espor|atlet/.test(t)) return 'corrida'
  if (/feir|expo|exposi|estand/.test(t)) return 'feira'
  if (/anivers|festa|debut|15\s*anos|infantil|formatura/.test(t)) return 'aniversario'
  return 'generico'
}

/**
 * Filtra as exigências de um conjunto pelo PÚBLICO estimado do evento: mantém as
 * que valem a partir daquele porte (publicoMin ≤ público). Determinístico.
 */
export function exigenciasParaEvento(itens: ExigenciaTemplate[], publico: number): ExigenciaTemplate[] {
  const p = Math.max(0, Number(publico) || 0)
  return itens.filter((i) => p >= (Number(i.publicoMin) || 0))
}

// ── Faixas de público (rótulos p/ a UI) ──────────────────────────────────────
export const FAIXAS_PUBLICO: { min: number; label: string }[] = [
  { min: 0,    label: 'Até 100' },
  { min: 100,  label: '100 a 500' },
  { min: 500,  label: '500 a 2.000' },
  { min: 2000, label: '2.000 a 5.000' },
  { min: 5000, label: 'Acima de 5.000' },
]
/** Rótulo da faixa de público correspondente a um número (sem locale). */
export function faixaDePublico(n: number): string {
  let out = FAIXAS_PUBLICO[0].label
  for (const f of FAIXAS_PUBLICO) if ((Number(n) || 0) >= f.min) out = f.label
  return out
}

// ── Saída concreta da geração (a /api/licencas grava) ────────────────────────
export type LicencaGerada = {
  tipo: TipoLicenca
  titulo: string
  obrigatorio: boolean
  orgao: string
  dias_aviso: number
  obs: string
}
/**
 * Converte as exigências aplicáveis a um evento em linhas a inserir. O status
 * inicial é `em_processo` (ainda a obter) — definido pela API. Aqui só o payload
 * de domínio (sem usuario_id/evento_id/validade, que a API completa).
 */
export function gerarLicencasDoEvento(itens: ExigenciaTemplate[], publico: number): LicencaGerada[] {
  return exigenciasParaEvento(itens, publico).map((i) => ({
    tipo: i.tipo,
    titulo: i.titulo,
    obrigatorio: !!i.obrigatorio,
    orgao: i.orgao || orgaoSugerido(i.tipo),
    dias_aviso: Number(i.dias_aviso) || tipoMeta(i.tipo).diasAviso,
    obs: i.descricao || '',
  }))
}
