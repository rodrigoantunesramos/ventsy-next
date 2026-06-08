// _lib — tipos de linha (DB), rótulos/cores e helpers do módulo Comissões
// (/painel/comissoes). O CÁLCULO puro vive em lib/comissoes.ts; aqui ficam as
// formas completas das tabelas, os adaptadores linha→engine, e helpers de UI.
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// cruas; toda a formatação fica em lib/format, chamada nas páginas.

import type {
  BeneficiarioTipo, BaseCalculo, ComissaoStatus, CondicaoRegra,
  Regra, EventoComissionavel, ComissaoExistente,
} from '@/lib/comissoes'

// ── Linhas das tabelas (espelham docs/sql/comissoes.sql) ──────────────────────
export type Banco = { banco?: string; agencia?: string; conta?: string; titular?: string }

export type Parceiro = {
  id: string
  usuario_id: string
  nome: string
  tipo: string // agencia | cerimonial | promotor | afiliado | outro
  doc: string | null
  contato: string | null
  email: string | null
  telefone: string | null
  whatsapp: string | null
  cidade: string | null
  estado: string | null
  percentual_padrao: number | null
  chave_pix: string | null
  banco: Banco
  ativo: boolean
  obs: string | null
  criado_em: string
  atualizado_em: string
}

export type RegraRow = {
  id: string
  usuario_id: string
  nome: string
  beneficiario_tipo: BeneficiarioTipo
  beneficiario_id: string | null
  base: BaseCalculo
  percentual: number | null
  valor_fixo_num: number | null
  condicao: CondicaoRegra
  vigencia_inicio: string | null
  vigencia_fim: string | null
  prioridade: number
  ativo: boolean
  criado_em: string
}

export type ComissaoRow = {
  id: string
  usuario_id: string
  regra_id: string | null
  beneficiario_tipo: BeneficiarioTipo
  beneficiario_id: string | null
  beneficiario_nome: string | null
  evento_id: string | null
  base_num: number
  percentual: number | null
  valor_num: number
  status: ComissaoStatus
  competencia: string | null
  meio: string | null
  origem: string // auto | manual
  lancamento_id: number | null
  apurada_em: string | null
  aprovada_em: string | null
  pago_em: string | null
  obs: string | null
  criado_em: string
}

// Subconjunto de clientes_eventos com as atribuições (quem vendeu/trouxe/indicou).
export type EventoRow = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  valor_total_num: number | null
  propriedade_id: number | null
  vendedor_equipe_id: number | null
  parceiro_id: string | null
  indicado_por_id: string | null
}

export type ParcelaRow = { evento_id: string; valor: number; status: string }
export type EquipeLite = { id: number; nome: string; cargo: string | null }
export type ClienteLite = { id: string; nome: string }

// ── Rótulos + cores de status ────────────────────────────────────────────────
export const STATUS_META: Record<ComissaoStatus, { label: string; cls: string; dot: string; cor: string }> = {
  prevista:  { label: 'Prevista',  cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500',    cor: '#1a73e8' },
  apurada:   { label: 'Apurada',   cls: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500',  cor: '#8b5cf6' },
  aprovada:  { label: 'Aprovada',  cls: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   cor: '#f59e0b' },
  paga:      { label: 'Paga',      cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', cor: '#10b981' },
  cancelada: { label: 'Cancelada', cls: 'bg-black/[0.05] text-ink-muted', dot: 'bg-black/20',    cor: '#94a3b8' },
}

export const TIPO_PARCEIRO_LABEL: Record<string, string> = {
  cerimonial: 'Cerimonialista', agencia: 'Agência', promotor: 'Promotor', afiliado: 'Afiliado', outro: 'Outro',
}
export function tipoParceiroLabel(v: string | null): string {
  return TIPO_PARCEIRO_LABEL[v || 'outro'] || v || 'Parceiro'
}

export const BENEFICIARIO_META: Record<BeneficiarioTipo, { label: string; plural: string; icon: string; cor: string }> = {
  equipe:   { label: 'Vendedor',  plural: 'Vendedores', icon: '🧑‍💼', cor: '#1a73e8' },
  parceiro: { label: 'Parceiro',  plural: 'Parceiros',  icon: '🤝',   cor: '#8b5cf6' },
  cliente:  { label: 'Indicação', plural: 'Indicações', icon: '💌',   cor: '#ec4899' },
}

// Meios de pagamento (espelha o financeiro).
export const MEIOS = ['Pix', 'Transferência', 'Cartão de crédito', 'Dinheiro', 'Boleto', 'Outro']

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, '') }
export function waLink(fone: string | null | undefined): string | null {
  const d = soDigitos(fone)
  if (!d) return null
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}
export function mailLink(email: string | null | undefined): string | null {
  return email && email.includes('@') ? `mailto:${email.trim()}` : null
}
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ── Adaptadores linha → engine ────────────────────────────────────────────────
export function toEngineRegra(r: RegraRow): Regra {
  return {
    id: r.id, nome: r.nome, beneficiario_tipo: r.beneficiario_tipo, beneficiario_id: r.beneficiario_id,
    base: r.base, percentual: r.percentual != null ? Number(r.percentual) : null,
    valor_fixo_num: r.valor_fixo_num != null ? Number(r.valor_fixo_num) : null,
    condicao: r.condicao || {}, vigencia_inicio: r.vigencia_inicio, vigencia_fim: r.vigencia_fim,
    prioridade: Number(r.prioridade) || 0, ativo: !!r.ativo,
  }
}
export function toEngineEvento(e: EventoRow): EventoComissionavel {
  return {
    id: e.id, tipo_evento: e.tipo_evento, status: e.status, data_inicio: e.data_inicio,
    valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null,
    propriedade_id: e.propriedade_id != null ? Number(e.propriedade_id) : null,
    vendedor_equipe_id: e.vendedor_equipe_id != null ? Number(e.vendedor_equipe_id) : null,
    parceiro_id: e.parceiro_id, indicado_por_id: e.indicado_por_id,
  }
}
export function toEngineComissao(c: ComissaoRow): ComissaoExistente {
  return {
    id: c.id, beneficiario_tipo: c.beneficiario_tipo, beneficiario_id: c.beneficiario_id,
    evento_id: c.evento_id, valor_num: Number(c.valor_num) || 0, status: c.status, origem: c.origem,
  }
}

// ── Resolução do nome do beneficiário (snapshot na persistência) ──────────────
export function nomeBeneficiario(
  tipo: BeneficiarioTipo,
  id: string | null,
  maps: { equipe: Map<string, string>; parceiros: Map<string, string>; clientes: Map<string, string> },
): string {
  if (!id) return BENEFICIARIO_META[tipo].label
  if (tipo === 'equipe') return maps.equipe.get(id) || 'Vendedor removido'
  if (tipo === 'parceiro') return maps.parceiros.get(id) || 'Parceiro removido'
  return maps.clientes.get(id) || 'Cliente removido'
}

// ── Export CSV (extrato de comissões) ─────────────────────────────────────────
export function exportComissoesCSV(
  rows: { c: ComissaoRow; beneficiario: string; evento: string | null }[],
): void {
  const header = ['Beneficiário', 'Tipo', 'Evento', 'Base', 'Percentual', 'Valor', 'Status', 'Competência', 'Pago em']
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const body = rows.map(({ c, beneficiario, evento }) => [
    esc(beneficiario), c.beneficiario_tipo, esc(evento || ''),
    c.base_num || 0, c.percentual != null ? c.percentual : '', c.valor_num || 0,
    c.status, c.competencia || '', c.pago_em ? c.pago_em.slice(0, 10) : '',
  ].join(',')).join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `comissoes-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}
