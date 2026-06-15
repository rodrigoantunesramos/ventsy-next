// Motor PURO do módulo Jurídico & LGPD da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Central jurídica e de privacidade do espaço de eventos:
//   • Contratos & prazos — consolida os contratos de clientes (tabela `contratos`,
//     gerida em /painel/contratos) com os demais contratos (fornecedor/trabalho/
//     parceria/serviço/NDA…) em `juridico_contratos`, e calcula vigência/alertas.
//   • Processos & notificações — judiciais/administrativos/notificações com prazo.
//   • LGPD — registro de CONSENTIMENTOS (base legal + finalidade + origem),
//     fila de SOLICITAÇÕES de titulares (acesso/correção/exclusão/portabilidade)
//     com o PRAZO LEGAL da LGPD (art. 19: 15 dias) e a política de RETENÇÃO/descarte.
//
// Consumido por:
//   • /painel/juridico  (page.tsx + abas em _components/*)
//   • /api/juridico      (exporta/anonimiza os dados de um titular — service-role)
//
// Regras de ouro (espelham lib/plano-b.ts, lib/producao.ts, lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings crus.
//     A formatação (moeda/data/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: nada de relógio/fetch escondido. O "hoje" entra
//     SEMPRE por parâmetro ('YYYY-MM-DD'), nunca `new Date()` dentro da lógica.
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

export { isMissingTable } from '@/lib/dbErrors'

// ── Datas (puro, agnóstico de fuso) ───────────────────────────────────────────
/** Só a parte 'YYYY-MM-DD' de uma data/timestamp (null se inválida). */
export function diaDe(v: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((v || '').trim())
  return m ? m[1] : null
}
/** Date → 'YYYY-MM-DD' local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (ancorado ao meio-dia: sem off-by-one de DST/UTC). */
export function addDiasYMD(ymdStr: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymdStr || '')) return ymdStr
  const d = new Date(`${ymdStr}T12:00:00`)
  d.setDate(d.getDate() + Math.round(Number(n) || 0))
  return ymd(d)
}
/** Diferença em dias inteiros: (ate − de). Positivo = `ate` no futuro. null se inválido. */
export function diffDias(de: string | null | undefined, ate: string | null | undefined): number | null {
  const a = diaDe(de)
  const b = diaDe(ate)
  if (!a || !b) return null
  const da = new Date(`${a}T12:00:00`).getTime()
  const db = new Date(`${b}T12:00:00`).getTime()
  return Math.round((db - da) / 86_400_000)
}

// ── Tom semântico (resolvido em classes pela UI) ──────────────────────────────
export type Tone = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza' | 'gold' | 'roxo'

// ── Vigência / vencimento (contratos, licenças, prazos) ───────────────────────
export type StatusVigencia = 'vigente' | 'a_vencer' | 'vencido' | 'sem_prazo'
export type FaixaVencimento = 'vencido' | '30' | '60' | '90' | 'futuro' | 'sem_prazo'
/** Janelas de alerta de vencimento, em dias (30/60/90). */
export const FAIXAS_DIAS = [30, 60, 90] as const

export type Vigencia = { status: StatusVigencia; dias: number | null; faixa: FaixaVencimento }

/** Classifica um vencimento contra `hoje`. `avisoDias` = janela do "a vencer". */
export function statusVigencia(
  vencimento: string | null | undefined,
  hoje: string,
  avisoDias = 30,
): Vigencia {
  const dias = diffDias(hoje, vencimento)
  if (dias == null) return { status: 'sem_prazo', dias: null, faixa: 'sem_prazo' }
  if (dias < 0) return { status: 'vencido', dias, faixa: 'vencido' }
  const faixa: FaixaVencimento = dias <= 30 ? '30' : dias <= 60 ? '60' : dias <= 90 ? '90' : 'futuro'
  const status: StatusVigencia = dias <= Math.max(0, avisoDias) ? 'a_vencer' : 'vigente'
  return { status, dias, faixa }
}
export function vigenciaTone(s: StatusVigencia): Tone {
  return s === 'vencido' ? 'vermelho' : s === 'a_vencer' ? 'amarelo' : s === 'vigente' ? 'verde' : 'cinza'
}

// ── Catálogo: contratos ───────────────────────────────────────────────────────
export type CategoriaContrato =
  | 'cliente' | 'fornecedor' | 'trabalho' | 'parceria' | 'locacao' | 'servico' | 'nda' | 'seguro' | 'outro'
export type RenovacaoTipo = 'manual' | 'automatica' | 'nao_renova'
/** Ciclo de vida persistido do contrato jurídico (a_vencer/vencido são DERIVADOS da data). */
export type StatusContratoJur = 'rascunho' | 'vigente' | 'rescindido' | 'encerrado'

export const CATEGORIAS_CONTRATO: { key: CategoriaContrato; label: string; icone?: string }[] = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'parceria', label: 'Parceria' },
  { key: 'locacao', label: 'Locação' },
  { key: 'servico', label: 'Prestação de serviço' },
  { key: 'nda', label: 'Confidencialidade (NDA)' },
  { key: 'seguro', label: 'Seguro' },
  { key: 'outro', label: 'Outro' },
]
export function categoriaContratoLabel(k: string | null | undefined): string {
  return CATEGORIAS_CONTRATO.find((c) => c.key === k)?.label || 'Outro'
}
export const RENOVACOES: { key: RenovacaoTipo; label: string }[] = [
  { key: 'manual', label: 'Renovação manual' },
  { key: 'automatica', label: 'Renovação automática' },
  { key: 'nao_renova', label: 'Não renova' },
]
export function renovacaoLabel(k: string | null | undefined): string {
  return RENOVACOES.find((r) => r.key === k)?.label || 'Renovação manual'
}
export const STATUS_CONTRATO_JUR_META: Record<StatusContratoJur, { label: string; tone: Tone }> = {
  rascunho: { label: 'Rascunho', tone: 'cinza' },
  vigente: { label: 'Vigente', tone: 'verde' },
  rescindido: { label: 'Rescindido', tone: 'vermelho' },
  encerrado: { label: 'Encerrado', tone: 'cinza' },
}

// ── Catálogo: processos & notificações ────────────────────────────────────────
export type TipoProcesso = 'judicial' | 'administrativo' | 'notificacao' | 'acordo' | 'arbitragem' | 'outro'
export type PoloProcesso = 'autor' | 'reu' | 'terceiro' | 'interessado'
export type StatusProcesso = 'ativo' | 'suspenso' | 'acordo' | 'encerrado' | 'arquivado'

export const TIPOS_PROCESSO: { key: TipoProcesso; label: string }[] = [
  { key: 'judicial', label: 'Judicial' },
  { key: 'administrativo', label: 'Administrativo' },
  { key: 'notificacao', label: 'Notificação' },
  { key: 'acordo', label: 'Acordo' },
  { key: 'arbitragem', label: 'Arbitragem' },
  { key: 'outro', label: 'Outro' },
]
export function tipoProcessoLabel(k: string | null | undefined): string {
  return TIPOS_PROCESSO.find((t) => t.key === k)?.label || 'Outro'
}
export const POLOS_PROCESSO: { key: PoloProcesso; label: string }[] = [
  { key: 'autor', label: 'Autor (polo ativo)' },
  { key: 'reu', label: 'Réu (polo passivo)' },
  { key: 'terceiro', label: 'Terceiro' },
  { key: 'interessado', label: 'Interessado' },
]
export function poloProcessoLabel(k: string | null | undefined): string {
  return POLOS_PROCESSO.find((p) => p.key === k)?.label || '—'
}
export const STATUS_PROCESSO_META: Record<StatusProcesso, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'azul' },
  suspenso: { label: 'Suspenso', tone: 'amarelo' },
  acordo: { label: 'Em acordo', tone: 'roxo' },
  encerrado: { label: 'Encerrado', tone: 'verde' },
  arquivado: { label: 'Arquivado', tone: 'cinza' },
}
/** Um processo "em aberto" (ainda demanda acompanhamento). */
export function processoEmAberto(status: string | null | undefined): boolean {
  return status === 'ativo' || status === 'suspenso' || status === 'acordo'
}

// ── Catálogo: LGPD — base legal (LGPD art. 7º e 11) ───────────────────────────
export type BaseLegal =
  | 'consentimento' | 'contrato' | 'obrigacao_legal' | 'legitimo_interesse'
  | 'exercicio_direitos' | 'protecao_vida' | 'tutela_saude' | 'protecao_credito' | 'politicas_publicas'
export const BASES_LEGAIS: { key: BaseLegal; label: string }[] = [
  { key: 'consentimento', label: 'Consentimento' },
  { key: 'contrato', label: 'Execução de contrato' },
  { key: 'obrigacao_legal', label: 'Obrigação legal/regulatória' },
  { key: 'legitimo_interesse', label: 'Legítimo interesse' },
  { key: 'exercicio_direitos', label: 'Exercício de direitos em processo' },
  { key: 'protecao_vida', label: 'Proteção da vida' },
  { key: 'tutela_saude', label: 'Tutela da saúde' },
  { key: 'protecao_credito', label: 'Proteção ao crédito' },
  { key: 'politicas_publicas', label: 'Políticas públicas' },
]
export function baseLegalLabel(k: string | null | undefined): string {
  return BASES_LEGAIS.find((b) => b.key === k)?.label || 'Consentimento'
}

export type TitularTipo = 'cliente' | 'convidado' | 'funcionario' | 'lead' | 'fornecedor' | 'outro'
export const TITULAR_TIPOS: { key: TitularTipo; label: string }[] = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'convidado', label: 'Convidado' },
  { key: 'funcionario', label: 'Funcionário' },
  { key: 'lead', label: 'Lead' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'outro', label: 'Outro' },
]
export function titularTipoLabel(k: string | null | undefined): string {
  return TITULAR_TIPOS.find((t) => t.key === k)?.label || 'Outro'
}

export type CanalConsentimento =
  | 'formulario' | 'ingresso' | 'portal' | 'site' | 'contrato' | 'whatsapp' | 'presencial' | 'lead' | 'outro'
export const CANAIS_CONSENTIMENTO: { key: CanalConsentimento; label: string }[] = [
  { key: 'formulario', label: 'Formulário' },
  { key: 'ingresso', label: 'Compra de ingresso' },
  { key: 'portal', label: 'Portal do cliente' },
  { key: 'site', label: 'Site' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'presencial', label: 'Presencial' },
  { key: 'lead', label: 'Captação de lead' },
  { key: 'outro', label: 'Outro' },
]
export function canalConsentimentoLabel(k: string | null | undefined): string {
  return CANAIS_CONSENTIMENTO.find((c) => c.key === k)?.label || 'Outro'
}

// ── Catálogo: LGPD — direitos do titular (solicitações) ───────────────────────
export type TipoSolicitacao =
  | 'acesso' | 'correcao' | 'exclusao' | 'portabilidade' | 'anonimizacao'
  | 'revogacao' | 'oposicao' | 'informacao'
export const TIPOS_SOLICITACAO: { key: TipoSolicitacao; label: string; descricao: string }[] = [
  { key: 'acesso', label: 'Acesso aos dados', descricao: 'Confirmação e cópia dos dados pessoais tratados.' },
  { key: 'correcao', label: 'Correção', descricao: 'Correção de dados incompletos, inexatos ou desatualizados.' },
  { key: 'exclusao', label: 'Exclusão/Eliminação', descricao: 'Eliminação dos dados tratados com base no consentimento.' },
  { key: 'portabilidade', label: 'Portabilidade', descricao: 'Transferência dos dados a outro fornecedor.' },
  { key: 'anonimizacao', label: 'Anonimização', descricao: 'Anonimização de dados desnecessários ou excessivos.' },
  { key: 'revogacao', label: 'Revogação de consentimento', descricao: 'Revogação do consentimento antes concedido.' },
  { key: 'oposicao', label: 'Oposição', descricao: 'Oposição a tratamento feito sem consentimento.' },
  { key: 'informacao', label: 'Informação de compartilhamento', descricao: 'Com quem os dados foram compartilhados.' },
]
export function tipoSolicitacaoLabel(k: string | null | undefined): string {
  return TIPOS_SOLICITACAO.find((t) => t.key === k)?.label || 'Acesso aos dados'
}
/** Pedidos que, ao serem atendidos, removem a identificabilidade do titular. */
export function solicitacaoApagaDados(tipo: string | null | undefined): boolean {
  return tipo === 'exclusao' || tipo === 'anonimizacao'
}

export type StatusSolicitacao = 'aberta' | 'em_andamento' | 'concluida' | 'recusada'
export const STATUS_SOLICITACAO_META: Record<StatusSolicitacao, { label: string; tone: Tone }> = {
  aberta: { label: 'Aberta', tone: 'azul' },
  em_andamento: { label: 'Em andamento', tone: 'amarelo' },
  concluida: { label: 'Concluída', tone: 'verde' },
  recusada: { label: 'Recusada', tone: 'cinza' },
}
export function solicitacaoEncerrada(status: string | null | undefined): boolean {
  return status === 'concluida' || status === 'recusada'
}

/** LGPD art. 19: o controlador deve responder em até 15 dias. */
export const PRAZO_LGPD_DIAS = 15
/** Prazo legal de resposta = data do pedido + 15 dias (configurável). */
export function prazoSolicitacao(criadoEm: string | null | undefined, dias = PRAZO_LGPD_DIAS): string | null {
  const d = diaDe(criadoEm)
  return d ? addDiasYMD(d, dias) : null
}

export type SlaStatus = 'no_prazo' | 'a_vencer' | 'vencido' | 'concluida'
export type Sla = { dias: number | null; status: SlaStatus; tone: Tone }
/** SLA de uma solicitação: dias restantes até o prazo legal e o estado. */
export function slaSolicitacao(
  prazo: string | null | undefined,
  hoje: string,
  status: string | null | undefined,
  alertaDias = 3,
): Sla {
  if (solicitacaoEncerrada(status)) return { dias: diffDias(hoje, prazo), status: 'concluida', tone: 'verde' }
  const dias = diffDias(hoje, prazo)
  if (dias == null) return { dias: null, status: 'no_prazo', tone: 'azul' }
  if (dias < 0) return { dias, status: 'vencido', tone: 'vermelho' }
  if (dias <= alertaDias) return { dias, status: 'a_vencer', tone: 'amarelo' }
  return { dias, status: 'no_prazo', tone: 'azul' }
}

// ── Consentimentos ────────────────────────────────────────────────────────────
/** Consentimento ativo = concedido e ainda não revogado. */
export function consentimentoAtivo(c: { revogado_em?: string | null }): boolean {
  return !c.revogado_em
}

// ── Política de retenção / descarte ───────────────────────────────────────────
export type AcaoRetencao = 'excluir' | 'anonimizar' | 'arquivar'
export type GatilhoRetencao = 'coleta' | 'apos_evento' | 'fim_contrato' | 'fim_relacao' | 'fim_processo'
export const ACOES_RETENCAO: { key: AcaoRetencao; label: string }[] = [
  { key: 'anonimizar', label: 'Anonimizar' },
  { key: 'excluir', label: 'Excluir' },
  { key: 'arquivar', label: 'Arquivar (acesso restrito)' },
]
export function acaoRetencaoLabel(k: string | null | undefined): string {
  return ACOES_RETENCAO.find((a) => a.key === k)?.label || 'Anonimizar'
}
export const GATILHOS_RETENCAO: { key: GatilhoRetencao; label: string }[] = [
  { key: 'coleta', label: 'A partir da coleta' },
  { key: 'apos_evento', label: 'Após o evento' },
  { key: 'fim_contrato', label: 'Após o fim do contrato' },
  { key: 'fim_relacao', label: 'Após o fim da relação' },
  { key: 'fim_processo', label: 'Após o fim do processo' },
]
export function gatilhoRetencaoLabel(k: string | null | undefined): string {
  return GATILHOS_RETENCAO.find((g) => g.key === k)?.label || 'A partir da coleta'
}
/** Data-limite de retenção = marco + N meses (null se faltar marco/meses). */
export function retencaoVencimento(marco: string | null | undefined, meses: number | null | undefined): string | null {
  const d = diaDe(marco)
  const m = Number(meses)
  if (!d || !Number.isFinite(m) || m <= 0) return null
  const base = new Date(`${d}T12:00:00`)
  base.setMonth(base.getMonth() + Math.round(m))
  return ymd(base)
}
/** Status do descarte de um registro segundo a regra de retenção. */
export function statusRetencao(
  marco: string | null | undefined,
  meses: number | null | undefined,
  hoje: string,
): { vence: string | null; dias: number | null; vencido: boolean } {
  const vence = retencaoVencimento(marco, meses)
  const dias = diffDias(hoje, vence)
  return { vence, dias, vencido: dias != null && dias < 0 }
}

// ── Políticas versionadas (privacidade/termos/cookies) ────────────────────────
export type TipoPolitica = 'privacidade' | 'termos' | 'cookies' | 'retencao' | 'seguranca' | 'outro'
export const TIPOS_POLITICA: { key: TipoPolitica; label: string; rotaPublica?: string }[] = [
  { key: 'privacidade', label: 'Política de Privacidade', rotaPublica: '/privacidade' },
  { key: 'termos', label: 'Termos de Uso', rotaPublica: '/termos' },
  { key: 'cookies', label: 'Política de Cookies' },
  { key: 'retencao', label: 'Política de Retenção' },
  { key: 'seguranca', label: 'Política de Segurança da Informação' },
  { key: 'outro', label: 'Outro documento' },
]
export function tipoPoliticaLabel(k: string | null | undefined): string {
  return TIPOS_POLITICA.find((t) => t.key === k)?.label || 'Outro documento'
}

// ── Entidades (shape de domínio; o _lib mapeia as linhas cruas p/ cá) ──────────
export type JuridicoContrato = {
  id: string
  usuario_id?: string
  categoria: CategoriaContrato
  titulo: string | null
  contraparte: string | null
  numero: string | null
  objeto: string | null
  valor_num: number
  moeda: string
  inicio: string | null
  vigencia_fim: string | null
  renovacao: RenovacaoTipo
  aviso_previo_dias: number
  status: StatusContratoJur
  responsavel: string | null
  documento_url: string | null
  fornecedor_id: number | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}
/** Subconjunto do contrato de CLIENTE (tabela `contratos`) p/ a visão consolidada. */
export type ContratoClienteRef = {
  id: string
  numero: string | null
  titulo: string | null
  contraparte: string | null
  status: string | null
  vencimento: string | null
  valor_num: number
  moeda: string
  documento_url: string | null
}
export type Processo = {
  id: string
  usuario_id?: string
  tipo: TipoProcesso
  parte: string | null
  polo: PoloProcesso
  numero: string | null
  vara_orgao: string | null
  status: StatusProcesso
  prazo: string | null
  proximo_passo: string | null
  valor_envolvido_num: number
  moeda: string
  advogado: string | null
  obs: string | null
  criado_em?: string
  atualizado_em?: string
}
export type Consentimento = {
  id: string
  titular_tipo: TitularTipo
  titular_id: string | null
  titular_nome: string | null
  finalidade: string | null
  base_legal: BaseLegal
  canal: CanalConsentimento
  concedido_em: string | null
  revogado_em: string | null
  evidencia: string | null
  criado_em?: string
}
export type Solicitacao = {
  id: string
  titular_nome: string | null
  titular_contato: string | null
  titular_tipo: TitularTipo
  titular_id: string | null
  tipo: TipoSolicitacao
  canal: CanalConsentimento
  status: StatusSolicitacao
  prazo: string | null
  resposta: string | null
  concluida_em: string | null
  criado_em?: string
  atualizado_em?: string
}

// ── Consolidação de contratos (cliente + jurídico) ────────────────────────────
export type ContratoConsolidado = {
  id: string
  origem: 'cliente' | 'juridico'
  categoria: CategoriaContrato
  categoriaLabel: string
  titulo: string
  contraparte: string
  numero: string | null
  valor_num: number
  moeda: string
  vencimento: string | null
  statusLabel: string
  tone: Tone
  ativo: boolean
  vigencia: Vigencia
  editavel: boolean
  documento_url: string | null
}

/** Mapeia o status do contrato de CLIENTE (rascunho/enviado/assinado/cancelado/
 *  rescindido) para o rótulo/tom e se está "ativo" (conta na vigência). */
function statusClienteMeta(status: string | null): { label: string; tone: Tone; ativo: boolean } {
  switch (status) {
    case 'assinado': return { label: 'Assinado', tone: 'verde', ativo: true }
    case 'enviado': return { label: 'Enviado', tone: 'amarelo', ativo: false }
    case 'cancelado': return { label: 'Cancelado', tone: 'cinza', ativo: false }
    case 'rescindido': return { label: 'Rescindido', tone: 'vermelho', ativo: false }
    default: return { label: 'Rascunho', tone: 'cinza', ativo: false }
  }
}

/** Unifica contratos de cliente (read-only) e jurídicos numa lista só, já com
 *  vigência calculada. `avisoDias` define a janela "a vencer". */
export function consolidarContratos(
  clientes: ContratoClienteRef[],
  juridicos: JuridicoContrato[],
  hoje: string,
  avisoDias = 30,
): ContratoConsolidado[] {
  const a: ContratoConsolidado[] = clientes.map((c) => {
    const meta = statusClienteMeta(c.status)
    return {
      id: `cli:${c.id}`,
      origem: 'cliente',
      categoria: 'cliente',
      categoriaLabel: 'Cliente',
      titulo: c.titulo || c.numero || 'Contrato de cliente',
      contraparte: c.contraparte || '—',
      numero: c.numero,
      valor_num: Number(c.valor_num) || 0,
      moeda: c.moeda || 'BRL',
      vencimento: c.vencimento,
      statusLabel: meta.label,
      tone: meta.tone,
      ativo: meta.ativo,
      vigencia: statusVigencia(c.vencimento, hoje, avisoDias),
      editavel: false,
      documento_url: c.documento_url,
    }
  })
  const b: ContratoConsolidado[] = juridicos.map((j) => {
    const meta = STATUS_CONTRATO_JUR_META[j.status] || STATUS_CONTRATO_JUR_META.rascunho
    const ativo = j.status === 'vigente'
    return {
      id: `jur:${j.id}`,
      origem: 'juridico',
      categoria: j.categoria,
      categoriaLabel: categoriaContratoLabel(j.categoria),
      titulo: j.titulo || j.numero || categoriaContratoLabel(j.categoria),
      contraparte: j.contraparte || '—',
      numero: j.numero,
      valor_num: Number(j.valor_num) || 0,
      moeda: j.moeda || 'BRL',
      vencimento: j.vigencia_fim,
      statusLabel: meta.label,
      tone: meta.tone,
      ativo,
      vigencia: statusVigencia(j.vigencia_fim, hoje, avisoDias),
      editavel: true,
      documento_url: j.documento_url,
    }
  })
  return [...a, ...b]
}

// ── KPIs / agregações ─────────────────────────────────────────────────────────
export type ResumoContratos = {
  total: number
  ativos: number
  vigentes: number
  aVencer: number
  vencidos: number
  faixa30: number
  faixa60: number
  faixa90: number
  /** Valor sob contrato (ativos), separado por moeda para não somar BRL+USD. */
  valorPorMoeda: Record<string, number>
}
export function resumoContratos(list: ContratoConsolidado[]): ResumoContratos {
  const r: ResumoContratos = {
    total: list.length, ativos: 0, vigentes: 0, aVencer: 0, vencidos: 0,
    faixa30: 0, faixa60: 0, faixa90: 0, valorPorMoeda: {},
  }
  for (const c of list) {
    if (!c.ativo) continue
    r.ativos++
    r.valorPorMoeda[c.moeda] = (r.valorPorMoeda[c.moeda] || 0) + c.valor_num
    if (c.vigencia.status === 'vigente') r.vigentes++
    else if (c.vigencia.status === 'a_vencer') r.aVencer++
    else if (c.vigencia.status === 'vencido') r.vencidos++
    if (c.vigencia.faixa === '30') r.faixa30++
    else if (c.vigencia.faixa === '60') r.faixa60++
    else if (c.vigencia.faixa === '90') r.faixa90++
  }
  return r
}

export type ResumoProcessos = { total: number; ativos: number; comPrazo: number; valorPorMoeda: Record<string, number> }
export function resumoProcessos(list: Processo[]): ResumoProcessos {
  const r: ResumoProcessos = { total: list.length, ativos: 0, comPrazo: 0, valorPorMoeda: {} }
  for (const p of list) {
    if (processoEmAberto(p.status)) {
      r.ativos++
      if (p.prazo) r.comPrazo++
      const v = Number(p.valor_envolvido_num) || 0
      if (v) r.valorPorMoeda[p.moeda || 'BRL'] = (r.valorPorMoeda[p.moeda || 'BRL'] || 0) + v
    }
  }
  return r
}

export type ResumoLGPD = {
  consentAtivos: number
  consentRevogados: number
  solicAbertas: number
  solicVencidas: number
  solicAVencer: number
}
export function resumoLGPD(consent: Consentimento[], solic: Solicitacao[], hoje: string): ResumoLGPD {
  const r: ResumoLGPD = { consentAtivos: 0, consentRevogados: 0, solicAbertas: 0, solicVencidas: 0, solicAVencer: 0 }
  for (const c of consent) {
    if (consentimentoAtivo(c)) r.consentAtivos++
    else r.consentRevogados++
  }
  for (const s of solic) {
    if (solicitacaoEncerrada(s.status)) continue
    r.solicAbertas++
    const sla = slaSolicitacao(s.prazo, hoje, s.status)
    if (sla.status === 'vencido') r.solicVencidas++
    else if (sla.status === 'a_vencer') r.solicAVencer++
  }
  return r
}

// ── Prazos próximos (timeline do Painel) ──────────────────────────────────────
export type PrazoOrigem = 'contrato' | 'processo' | 'solicitacao' | 'retencao'
export type PrazoItem = {
  id: string
  origem: PrazoOrigem
  titulo: string
  subtitulo: string
  data: string
  dias: number
  tone: Tone
  vencido: boolean
  href?: string
}

/** Junta os prazos de contratos, processos e solicitações num feed ordenado por
 *  data, incluindo vencidos (dias < 0). `janelaDias` limita o horizonte futuro. */
export function prazosProximos(
  contratos: ContratoConsolidado[],
  processos: Processo[],
  solicitacoes: Solicitacao[],
  hoje: string,
  janelaDias = 120,
): PrazoItem[] {
  const itens: PrazoItem[] = []

  for (const c of contratos) {
    if (!c.ativo || !c.vencimento) continue
    const dias = diffDias(hoje, c.vencimento)
    if (dias == null || dias > janelaDias) continue
    itens.push({
      id: c.id, origem: 'contrato', titulo: c.titulo,
      subtitulo: `${c.categoriaLabel} · ${c.contraparte}`,
      data: c.vencimento, dias, tone: vigenciaTone(c.vigencia.status), vencido: dias < 0,
    })
  }
  for (const p of processos) {
    if (!processoEmAberto(p.status) || !p.prazo) continue
    const dias = diffDias(hoje, p.prazo)
    if (dias == null || dias > janelaDias) continue
    const v = statusVigencia(p.prazo, hoje, 7)
    itens.push({
      id: `proc:${p.id}`, origem: 'processo',
      titulo: p.proximo_passo || `Processo ${p.numero || ''}`.trim(),
      subtitulo: `${tipoProcessoLabel(p.tipo)} · ${p.parte || '—'}`,
      data: p.prazo, dias, tone: vigenciaTone(v.status), vencido: dias < 0,
    })
  }
  for (const s of solicitacoes) {
    if (solicitacaoEncerrada(s.status) || !s.prazo) continue
    const dias = diffDias(hoje, s.prazo)
    if (dias == null || dias > janelaDias) continue
    const sla = slaSolicitacao(s.prazo, hoje, s.status)
    itens.push({
      id: `solic:${s.id}`, origem: 'solicitacao',
      titulo: `${tipoSolicitacaoLabel(s.tipo)} — ${s.titular_nome || 'titular'}`,
      subtitulo: 'Direito do titular (LGPD)',
      data: s.prazo, dias, tone: sla.tone, vencido: dias < 0,
    })
  }

  return itens.sort((x, y) => x.dias - y.dias || x.data.localeCompare(y.data))
}
