// _lib — tipos, helpers e apresentação do Faturamento (/painel/faturamento).
// O CÁLCULO de impostos NÃO mora aqui: vem do motor puro lib/fiscal.ts (mesmo
// usado pela rota autoritativa /api/faturamento/emitir). Aqui ficam os tipos das
// linhas persistidas, coerções numéricas, exportação do lote e rótulos. Sem
// "R$" hardcoded — moeda sempre por lib/format (o símbolo do input vem do locale).

import { getFormatPrefs, formatMoney } from '@/lib/format'
import type { NotaTipo, NotaStatus, RetencaoLinha, RetencaoConfig } from '@/lib/fiscal'

// ── Entidades persistidas (espelham docs/sql/faturamento.sql) ────────────────
export type NotaFiscal = {
  id: string
  tipo: NotaTipo
  numero: string
  numero_seq: number
  serie: string | null
  cliente_id: string | null
  evento_id: string | null
  contrato_id: string | null
  parcela_id: number | null
  tomador_nome: string | null
  tomador_doc: string | null
  tomador_email: string | null
  valor_servicos_num: number
  descontos_num: number
  aliquota_iss: number | null
  iss_num: number
  retencoes: { linhas?: RetencaoLinha[]; config?: RetencaoConfig } | null
  total_retencoes_num: number
  valor_liquido_num: number
  valor_total_num: number
  codigo_servico: string | null
  discriminacao: string | null
  regime: string | null
  status: NotaStatus
  emitida_em: string | null
  cancelada_em: string | null
  provedor: string | null
  provedor_id: string | null
  provedor_msg: string | null
  xml_url: string | null
  pdf_url: string | null
  criado_em: string
}

export type FaturaStatus = 'aberta' | 'paga' | 'vencida' | 'cancelada'
export type Fatura = {
  id: string
  cliente_id: string | null
  evento_id: string | null
  parcela_id: number | null
  nota_id: string | null
  descricao: string | null
  valor_num: number
  vencimento: string | null
  status: FaturaStatus
  meio: 'pix' | 'boleto' | 'cartao' | 'link' | null
  link_pagamento: string | null
  provedor_pgto: string | null
  pago_em: string | null
  lancamento_id: number | null
  criado_em: string
}

export type Evento = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  documento: string | null
  email: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  valor_total_num: number | null
  propriedade_id: number | null
  cliente_id: string | null
}

export type Parcela = {
  id: number
  evento_id: string
  numero: number | null
  descricao: string | null
  valor: number
  vencimento: string | null
  status: 'pendente' | 'pago' | 'cancelado'
  pago_em: string | null
  nota_id: string | null
}

export type ProvedorStatus = {
  configured: boolean
  provedor: string
  ambiente: string
  endpoint: string
  cnpj: string
  ativo: boolean
  last4: string
  has_token: boolean
}

// ── Coerções (Supabase numeric vem como string) ──────────────────────────────
const n = (v: unknown): number => Number(v) || 0
export function coerceNota(r: NotaFiscal): NotaFiscal {
  return {
    ...r,
    numero_seq: n(r.numero_seq),
    parcela_id: r.parcela_id != null ? n(r.parcela_id) : null,
    valor_servicos_num: n(r.valor_servicos_num),
    descontos_num: n(r.descontos_num),
    aliquota_iss: r.aliquota_iss != null ? n(r.aliquota_iss) : null,
    iss_num: n(r.iss_num),
    total_retencoes_num: n(r.total_retencoes_num),
    valor_liquido_num: n(r.valor_liquido_num),
    valor_total_num: n(r.valor_total_num),
  }
}
export function coerceFatura(r: Fatura): Fatura {
  return { ...r, valor_num: n(r.valor_num), parcela_id: r.parcela_id != null ? n(r.parcela_id) : null, lancamento_id: r.lancamento_id != null ? n(r.lancamento_id) : null }
}

// ── Datas ────────────────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addMonths(base: string, months: number): string {
  const d = new Date((base || ymd(new Date())) + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return ymd(d)
}

/** Símbolo da moeda ATIVA (do locale do usuário) — para rótulos de input, sem
 *  hardcode de "R$". Ex.: 'R$' (pt-BR/BRL), '$' (en-US/USD), '€' (es-ES/EUR). */
export function moedaSimbolo(): string {
  const { locale, currency } = getFormatPrefs()
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value || currency
  } catch {
    return currency
  }
}

// ── Fatura: status efetivo (vencida derivada da data) ────────────────────────
export function faturaEfetiva(f: Fatura, hoje: string): FaturaStatus {
  if (f.status === 'paga' || f.status === 'cancelada') return f.status
  if (f.vencimento && f.vencimento < hoje) return 'vencida'
  return 'aberta'
}
export const FATURA_META: Record<FaturaStatus, { label: string; cls: string }> = {
  aberta: { label: 'Aberta', cls: 'bg-amber-50 text-amber-700' },
  paga: { label: 'Paga', cls: 'bg-emerald-50 text-emerald-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-50 text-red-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
}
export const MEIO_LABEL: Record<string, string> = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão', link: 'Link' }

// ── Tomador a partir do evento (pré-preenche a emissão) ──────────────────────
export function tomadorDoEvento(e: Evento | null | undefined): { nome: string; doc: string; email: string } {
  return {
    nome: (e?.quem_contratou || e?.nome_evento || '').trim(),
    doc: (e?.documento || '').trim(),
    email: (e?.email || '').trim(),
  }
}

// ── Export do lote fiscal (para o contador) ──────────────────────────────────
export function exportNotasCSV(notas: NotaFiscal[], eventoNome: (id: string | null) => string) {
  const header = 'Numero,Tipo,Tomador,Documento,Evento,Emitida,Servicos,Descontos,ISS,Retencoes,Total,Liquido,Status\n'
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const m = (v: number) => formatMoney(v)
  const rows = notas
    .map((no) =>
      [
        esc(no.numero),
        no.tipo,
        esc(no.tomador_nome || ''),
        esc(no.tomador_doc || ''),
        esc(eventoNome(no.evento_id)),
        no.emitida_em ? no.emitida_em.slice(0, 10) : '',
        esc(m(no.valor_servicos_num)),
        esc(m(no.descontos_num)),
        esc(m(no.iss_num)),
        esc(m(no.total_retencoes_num)),
        esc(m(no.valor_total_num)),
        esc(m(no.valor_liquido_num)),
        no.status,
      ].join(','),
    )
    .join('\n')
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `notas-fiscais-${ymd(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Classe de input reutilizada (espelha o design system do contexto-base).
export const inp =
  'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
