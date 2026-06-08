// _lib — tipos e helpers só do módulo Bilheteria (/painel/bilheteria).
// A lógica de domínio (preço, disponibilidade, agregações, QR) vive em
// lib/bilheteria.ts (pura e testada). Aqui ficam o tipo de vínculo (evento),
// utilitários de UI e geradores que dependem do browser (token via crypto,
// impressão de ingressos). Regra de ouro: NADA de "R$"/data formatada aqui —
// toda formatação fica em lib/format, chamada na página.

import { gerarQrPayload, tokenCurto, ingressoStatusMeta, type Pedido, type Ingresso } from '@/lib/bilheteria'
import { qrSvgString } from '@/lib/qrcode'

// Evento (clientes_eventos) — subconjunto para vincular/rotular a bilheteria.
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  propriedade_id: number | null
}
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return '—'
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome'
}

export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42P01' || err.code === 'PGRST205'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '')
}

/** Token único (página pública / QR de ingresso). 32 hex via crypto. */
export function gerarToken(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

/** URL pública da página de venda (origin + token). */
export function linkPublico(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/ingressos/${token}`
}

// ── Export CSV (sem moeda formatada; valores crus, BOM p/ Excel BR) ──────────
const escCsv = (s: string) => `"${(s || '').replace(/"/g, '""')}"`

export function exportPedidosCSV(pedidos: Pedido[]): void {
  const header = ['Pedido', 'Comprador', 'E-mail', 'Documento', 'Canal', 'Status', 'Subtotal', 'Desconto', 'Taxa', 'Total', 'Cupom', 'Criado em', 'Pago em']
  const body = pedidos.map((p) => [
    escCsv(p.id.slice(0, 8)), escCsv(p.comprador_nome), escCsv(p.comprador_email || ''), escCsv(p.comprador_doc || ''),
    escCsv(p.canal), escCsv(p.status), p.subtotal_num, p.desconto_num, p.taxa_num, p.total_num,
    escCsv(p.cupom_codigo || ''), escCsv(p.criado_em || ''), escCsv(p.pago_em || ''),
  ].join(',')).join('\n')
  baixar(header.join(',') + '\n' + body, `pedidos-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function exportIngressosCSV(ingressos: Ingresso[], catNome: Map<string, string>): void {
  const header = ['Categoria', 'Titular', 'Documento', 'Valor', 'Meia', 'Status', 'Token']
  const body = ingressos.map((i) => [
    escCsv(catNome.get(i.categoria_id) || ''), escCsv(i.comprador_nome || ''), escCsv(i.comprador_doc || ''),
    i.valor_num, i.meia ? 'sim' : 'não', escCsv(ingressoStatusMeta(i.status).label), escCsv(i.qr_token),
  ].join(',')).join('\n')
  baixar(header.join(',') + '\n' + body, `ingressos-${new Date().toISOString().slice(0, 10)}.csv`)
}

function baixar(conteudo: string, nome: string): void {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

function escHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/**
 * Abre uma janela de impressão com um ingresso por linha (QR + categoria +
 * titular), pronto para imprimir/recortar. Reusa o encoder puro de QR.
 */
export function printIngressos(ingressos: Ingresso[], catNome: Map<string, string>, eventoTitulo: string): void {
  if (!ingressos.length) return
  const win = window.open('', '_blank', 'width=900,height=720')
  if (!win) return
  const cards = ingressos.map((i) => {
    const qr = qrSvgString(gerarQrPayload(i.qr_token), { size: 150 })
    return `
      <div class="tk">
        <div class="info">
          <div class="evt">${escHtml(eventoTitulo)}</div>
          <div class="cat">${escHtml(catNome.get(i.categoria_id) || 'Ingresso')}${i.meia ? ' · meia' : ''}</div>
          ${i.comprador_nome ? `<div class="nome">${escHtml(i.comprador_nome)}</div>` : ''}
          <div class="cod">${escHtml(tokenCurto(i.qr_token))}</div>
        </div>
        <div class="qr">${qr}</div>
      </div>`
  }).join('')
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ingressos — ${escHtml(eventoTitulo)}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'DM Sans', system-ui, sans-serif; margin: 0; padding: 10mm; background: #f4f4f5; }
      .grid { display: flex; flex-direction: column; gap: 4mm; }
      .tk { width: 170mm; min-height: 45mm; background: #fff; border: 1px dashed #a1a1aa; border-radius: 3mm; display: flex; align-items: center; justify-content: space-between; padding: 5mm 7mm; }
      .evt { font-size: 9pt; color: #71717a; text-transform: uppercase; letter-spacing: .05em; }
      .cat { font-size: 17pt; font-weight: 700; color: #18181b; margin-top: 2mm; }
      .nome { font-size: 11pt; color: #52525b; margin-top: 1mm; }
      .cod { font-size: 9pt; letter-spacing: .14em; color: #3f3f46; margin-top: 3mm; font-family: ui-monospace, monospace; }
      .qr svg { width: 32mm; height: 32mm; }
      @media print { body { padding: 0; background: #fff; } .tk { page-break-inside: avoid; } }
    </style></head>
    <body onload="window.focus();window.print();"><div class="grid">${cards}</div></body></html>`)
  win.document.close()
}
