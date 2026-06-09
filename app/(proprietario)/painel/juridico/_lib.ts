// _lib — modelo, queries, mapeadores e chamadas do módulo Jurídico & LGPD.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só dados crus; a
// formatação fica em lib/format. A engine (vigência/prazos/SLA/retenção/KPIs)
// vive em lib/juridico (pura, testada), re-exportada abaixo p/ um só import. O
// CRUD das 6 tabelas é via RLS no client; exportar/anonimizar um titular passa
// pela rota /api/juridico (service-role).

import { supabaseAny as sb, authHeaders } from '@/lib/supabase'
import {
  type JuridicoContrato, type ContratoClienteRef, type Processo,
  type Consentimento, type Solicitacao, type ContratoConsolidado, type PrazoItem,
  type BaseLegal, type GatilhoRetencao, type AcaoRetencao, type TipoPolitica,
  type CategoriaContrato, type RenovacaoTipo, type StatusContratoJur,
  type TipoProcesso, type PoloProcesso, type StatusProcesso,
  type TitularTipo, type CanalConsentimento, type TipoSolicitacao, type StatusSolicitacao,
  prazoSolicitacao,
} from '@/lib/juridico'

export type {
  JuridicoContrato, ContratoClienteRef, Processo, Consentimento, Solicitacao, ContratoConsolidado, PrazoItem,
  BaseLegal, GatilhoRetencao, AcaoRetencao, TipoPolitica,
  CategoriaContrato, RenovacaoTipo, StatusContratoJur,
  TipoProcesso, PoloProcesso, StatusProcesso,
  TitularTipo, CanalConsentimento, TipoSolicitacao, StatusSolicitacao,
}
export {
  // datas + vigência
  diaDe, ymd, addDiasYMD, diffDias, statusVigencia, vigenciaTone, FAIXAS_DIAS,
  // catálogos
  CATEGORIAS_CONTRATO, categoriaContratoLabel, RENOVACOES, renovacaoLabel, STATUS_CONTRATO_JUR_META,
  TIPOS_PROCESSO, tipoProcessoLabel, POLOS_PROCESSO, poloProcessoLabel, STATUS_PROCESSO_META, processoEmAberto,
  BASES_LEGAIS, baseLegalLabel, TITULAR_TIPOS, titularTipoLabel, CANAIS_CONSENTIMENTO, canalConsentimentoLabel,
  TIPOS_SOLICITACAO, tipoSolicitacaoLabel, solicitacaoApagaDados, STATUS_SOLICITACAO_META, solicitacaoEncerrada,
  PRAZO_LGPD_DIAS, prazoSolicitacao, slaSolicitacao, consentimentoAtivo,
  ACOES_RETENCAO, acaoRetencaoLabel, GATILHOS_RETENCAO, gatilhoRetencaoLabel, retencaoVencimento, statusRetencao,
  TIPOS_POLITICA, tipoPoliticaLabel,
  // consolidação + KPIs + timeline
  consolidarContratos, resumoContratos, resumoProcessos, resumoLGPD, prazosProximos,
  isMissingTable,
} from '@/lib/juridico'

// ── Entidades só-deste-módulo (não precisam de lógica na engine) ──────────────
export type RegraRetencao = {
  id: string
  tipo_dado: string
  base_legal: BaseLegal
  prazo_meses: number
  gatilho: GatilhoRetencao
  acao_apos: AcaoRetencao
  responsavel: string | null
  obs: string | null
  criado_em?: string
}
export type Politica = {
  id: string
  tipo: TipoPolitica
  versao: string
  titulo: string | null
  resumo: string | null
  url: string | null
  conteudo: string | null
  vigente_desde: string | null
  publicada: boolean
  criado_em?: string
  atualizado_em?: string
}
/** Linhas auxiliares (de outros módulos) para rótulos/sugestões de titular. */
export type FornecedorLite = { id: number; nome: string | null }
export type ClienteLite = { id: string; nome: string | null; email: string | null }
export type EventoLite = { id: string; nome_evento: string | null; quem_contratou: string | null; cliente_id: string | null }

export type Tab = 'painel' | 'contratos' | 'processos' | 'consentimentos' | 'direitos' | 'politicas'

// ── Selects ───────────────────────────────────────────────────────────────────
export const SEL_JC = 'id,usuario_id,categoria,titulo,contraparte,numero,objeto,valor_num,moeda,inicio,vigencia_fim,renovacao,aviso_previo_dias,status,responsavel,documento_url,fornecedor_id,obs,criado_em,atualizado_em'
export const SEL_PROC = 'id,usuario_id,tipo,parte,polo,numero,vara_orgao,status,prazo,proximo_passo,valor_envolvido_num,moeda,advogado,anexos,obs,criado_em,atualizado_em'
export const SEL_CONSENT = 'id,usuario_id,titular_tipo,titular_id,titular_nome,finalidade,base_legal,canal,concedido_em,revogado_em,evidencia,criado_em'
export const SEL_SOLIC = 'id,usuario_id,titular_nome,titular_contato,titular_tipo,titular_id,tipo,canal,status,prazo,resposta,anexos,concluida_em,criado_em,atualizado_em'
export const SEL_RETEN = 'id,usuario_id,tipo_dado,base_legal,prazo_meses,gatilho,acao_apos,responsavel,obs,criado_em,atualizado_em'
export const SEL_POL = 'id,usuario_id,tipo,versao,titulo,resumo,url,conteudo,vigente_desde,publicada,criado_em,atualizado_em'
/** Contratos de cliente (tabela `contratos`) — só o necessário p/ consolidar. */
export const SEL_CONTRATO_CLI = 'id,numero,titulo,status,vencimento,valor_num,moeda,pdf_url,cliente_id,evento_id'

// ── Mapeadores (coerção defensiva) ────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const str = (v: any): string | null => (v == null || v === '' ? null : String(v))

export const mapContratoJur = (r: any): JuridicoContrato => ({
  id: String(r.id), usuario_id: r.usuario_id, categoria: (r.categoria || 'fornecedor') as CategoriaContrato,
  titulo: str(r.titulo), contraparte: str(r.contraparte), numero: str(r.numero), objeto: str(r.objeto),
  valor_num: num(r.valor_num), moeda: r.moeda || 'BRL', inicio: str(r.inicio), vigencia_fim: str(r.vigencia_fim),
  renovacao: (r.renovacao || 'manual') as RenovacaoTipo, aviso_previo_dias: num(r.aviso_previo_dias) || 30,
  status: (r.status || 'vigente') as StatusContratoJur, responsavel: str(r.responsavel),
  documento_url: str(r.documento_url), fornecedor_id: r.fornecedor_id != null ? Number(r.fornecedor_id) : null,
  obs: str(r.obs), criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
})
export const mapProcesso = (r: any): Processo => ({
  id: String(r.id), usuario_id: r.usuario_id, tipo: (r.tipo || 'judicial') as TipoProcesso,
  parte: str(r.parte), polo: (r.polo || 'reu') as PoloProcesso, numero: str(r.numero), vara_orgao: str(r.vara_orgao),
  status: (r.status || 'ativo') as StatusProcesso, prazo: str(r.prazo), proximo_passo: str(r.proximo_passo),
  valor_envolvido_num: num(r.valor_envolvido_num), moeda: r.moeda || 'BRL', advogado: str(r.advogado),
  obs: str(r.obs), criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
})
export const mapConsentimento = (r: any): Consentimento => ({
  id: String(r.id), titular_tipo: (r.titular_tipo || 'cliente') as TitularTipo, titular_id: str(r.titular_id),
  titular_nome: str(r.titular_nome), finalidade: str(r.finalidade), base_legal: (r.base_legal || 'consentimento') as BaseLegal,
  canal: (r.canal || 'formulario') as CanalConsentimento, concedido_em: str(r.concedido_em), revogado_em: str(r.revogado_em),
  evidencia: str(r.evidencia), criado_em: r.criado_em ?? undefined,
})
export const mapSolicitacao = (r: any): Solicitacao => ({
  id: String(r.id), titular_nome: str(r.titular_nome), titular_contato: str(r.titular_contato),
  titular_tipo: (r.titular_tipo || 'cliente') as TitularTipo, titular_id: str(r.titular_id),
  tipo: (r.tipo || 'acesso') as TipoSolicitacao, canal: (r.canal || 'portal') as CanalConsentimento,
  status: (r.status || 'aberta') as StatusSolicitacao, prazo: str(r.prazo), resposta: str(r.resposta),
  concluida_em: str(r.concluida_em), criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
})
export const mapRetencao = (r: any): RegraRetencao => ({
  id: String(r.id), tipo_dado: r.tipo_dado || '', base_legal: (r.base_legal || 'obrigacao_legal') as BaseLegal,
  prazo_meses: num(r.prazo_meses) || 12, gatilho: (r.gatilho || 'coleta') as GatilhoRetencao,
  acao_apos: (r.acao_apos || 'anonimizar') as AcaoRetencao, responsavel: str(r.responsavel), obs: str(r.obs),
  criado_em: r.criado_em ?? undefined,
})
export const mapPolitica = (r: any): Politica => ({
  id: String(r.id), tipo: (r.tipo || 'privacidade') as TipoPolitica, versao: r.versao || '1.0',
  titulo: str(r.titulo), resumo: str(r.resumo), url: str(r.url), conteudo: str(r.conteudo),
  vigente_desde: str(r.vigente_desde), publicada: !!r.publicada,
  criado_em: r.criado_em ?? undefined, atualizado_em: r.atualizado_em ?? undefined,
})
export const mapFornecedor = (r: any): FornecedorLite => ({ id: Number(r.id), nome: str(r.nome) })
export const mapCliente = (r: any): ClienteLite => ({ id: String(r.id), nome: str(r.nome), email: str(r.email) })
export const mapEvento = (r: any): EventoLite => ({
  id: String(r.id), nome_evento: str(r.nome_evento), quem_contratou: str(r.quem_contratou),
  cliente_id: r.cliente_id != null ? String(r.cliente_id) : null,
})

/** Mapeia o contrato de CLIENTE bruto p/ a referência consolidada, resolvendo a
 *  contraparte a partir dos mapas de clientes/eventos já carregados. */
export function mapContratoCliente(
  r: any,
  nomePorCliente: Map<string, string>,
  rotuloPorEvento: Map<string, string>,
): ContratoClienteRef {
  const contraparte =
    (r.cliente_id && nomePorCliente.get(String(r.cliente_id))) ||
    (r.evento_id && rotuloPorEvento.get(String(r.evento_id))) ||
    str(r.titulo) || null
  return {
    id: String(r.id), numero: str(r.numero), titulo: str(r.titulo), contraparte,
    status: str(r.status), vencimento: str(r.vencimento), valor_num: num(r.valor_num),
    moeda: r.moeda || 'BRL', documento_url: str(r.pdf_url),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Bag de estado compartilhado entre a shell e as abas ──────────────────────
export type JuridicoBag = {
  userId: string
  hoje: string
  empresa: string
  contratosCliente: ContratoClienteRef[]
  contratosJur: JuridicoContrato[]
  processos: Processo[]
  consentimentos: Consentimento[]
  solicitacoes: Solicitacao[]
  retencao: RegraRetencao[]
  politicas: Politica[]
  fornecedores: FornecedorLite[]
  clientes: ClienteLite[]
  reload: () => Promise<void>
  goTab: (t: Tab) => void
}

// ── CRUD via RLS (client) ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export const criarContratoJur = (row: Record<string, unknown>) => sb.from('juridico_contratos').insert(row).select(SEL_JC).single()
export const salvarContratoJur = (id: string, patch: Record<string, unknown>) => sb.from('juridico_contratos').update(patch).eq('id', id).select(SEL_JC).single()
export const excluirContratoJur = (id: string) => sb.from('juridico_contratos').delete().eq('id', id)

export const criarProcesso = (row: Record<string, unknown>) => sb.from('juridico_processos').insert(row).select(SEL_PROC).single()
export const salvarProcesso = (id: string, patch: Record<string, unknown>) => sb.from('juridico_processos').update(patch).eq('id', id).select(SEL_PROC).single()
export const excluirProcesso = (id: string) => sb.from('juridico_processos').delete().eq('id', id)

export const criarConsentimento = (row: Record<string, unknown>) => sb.from('lgpd_consentimentos').insert(row).select(SEL_CONSENT).single()
export const salvarConsentimento = (id: string, patch: Record<string, unknown>) => sb.from('lgpd_consentimentos').update(patch).eq('id', id).select(SEL_CONSENT).single()
export const excluirConsentimento = (id: string) => sb.from('lgpd_consentimentos').delete().eq('id', id)

export const criarSolicitacao = (row: Record<string, unknown>) => sb.from('lgpd_solicitacoes').insert(row).select(SEL_SOLIC).single()
export const salvarSolicitacao = (id: string, patch: Record<string, unknown>) => sb.from('lgpd_solicitacoes').update(patch).eq('id', id).select(SEL_SOLIC).single()
export const excluirSolicitacao = (id: string) => sb.from('lgpd_solicitacoes').delete().eq('id', id)

export const criarRetencao = (row: Record<string, unknown>) => sb.from('lgpd_retencao').insert(row).select(SEL_RETEN).single()
export const salvarRetencao = (id: string, patch: Record<string, unknown>) => sb.from('lgpd_retencao').update(patch).eq('id', id).select(SEL_RETEN).single()
export const excluirRetencao = (id: string) => sb.from('lgpd_retencao').delete().eq('id', id)

export const criarPolitica = (row: Record<string, unknown>) => sb.from('lgpd_politicas').insert(row).select(SEL_POL).single()
export const salvarPolitica = (id: string, patch: Record<string, unknown>) => sb.from('lgpd_politicas').update(patch).eq('id', id).select(SEL_POL).single()
export const excluirPolitica = (id: string) => sb.from('lgpd_politicas').delete().eq('id', id)
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Calcula o prazo legal (15 dias) e devolve a linha pronta p/ inserir solicitação. */
export function novaSolicitacaoRow(userId: string, base: Partial<Solicitacao>, hoje: string): Record<string, unknown> {
  return {
    usuario_id: userId,
    titular_nome: base.titular_nome || null,
    titular_contato: base.titular_contato || null,
    titular_tipo: base.titular_tipo || 'cliente',
    titular_id: base.titular_id || null,
    tipo: base.tipo || 'acesso',
    canal: base.canal || 'portal',
    status: base.status || 'aberta',
    prazo: prazoSolicitacao(hoje),
  }
}

// ── Rota /api/juridico (service-role): exportar/anonimizar titular ────────────
export type TitularQuery = { nome?: string; email?: string; doc?: string; tipo?: TitularTipo; id?: string }
export type ApiResult<T = unknown> = { ok: boolean; data?: T; error?: string; status?: number }

async function postJuridico<T = unknown>(body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const res = await fetch('/api/juridico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error || 'Falha na requisição', status: res.status }
    return { ok: true, data: json.data as T }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Erro de rede' }
  }
}

export type ExportTitular = {
  titular: TitularQuery
  registros: { tabela: string; rotulo: string; itens: Record<string, unknown>[] }[]
  total: number
}
/** Reúne (acesso/portabilidade) todos os dados pessoais de um titular. */
export const exportarTitular = (titular: TitularQuery) => postJuridico<ExportTitular>({ action: 'exportar_titular', titular })

export type AnonimizarResult = { afetados: { tabela: string; linhas: number }[]; total: number }
/** Anonimiza (sobrescreve PII) os dados de um titular nas tabelas com dados pessoais.
 *  Opcionalmente marca a solicitação como concluída. */
export const anonimizarTitular = (titular: TitularQuery, solicitacao_id?: string) =>
  postJuridico<AnonimizarResult>({ action: 'anonimizar_titular', titular, solicitacao_id: solicitacao_id || null })

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
export const selCls = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

// ── Export CSV (genérico) ────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
