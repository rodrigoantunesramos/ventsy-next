// _lib — tipos e helpers só do módulo Acesso (/painel/acesso).
// A lógica de domínio (autorização, lotação, validação de movimento, QR) vive em
// lib/acesso.ts e lib/qrcode.ts (puras e testadas). Aqui ficam apenas o tipo de
// vínculo (evento), utilitários de UI e geradores que dependem do browser
// (token via crypto, impressão de crachás). Regra de ouro: NADA de "R$"/data
// formatada aqui — toda formatação fica em lib/format, chamada na página.

import { credTipoMeta, gerarQrPayload, tokenCurto, type Credencial } from '@/lib/acesso'
import { qrSvgString } from '@/lib/qrcode'

// Evento (clientes_eventos) — subconjunto para escopar o credenciamento.
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  pessoas: number | null
  propriedade_id: number | null
}
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return '—'
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome'
}

// Iniciais para o avatar (mesma estética dos demais módulos).
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Token único da credencial (32 hex). A unicidade é garantida pelo índice
 *  único em `credenciais.qr_token`; a colisão de UUID é desprezível. */
export function gerarToken(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
  // fallback defensivo (ambientes sem crypto.randomUUID)
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

// Linha de importação em massa.
export type ImportLinha = { nome: string; doc: string | null; empresa: string | null }
/**
 * Parser tolerante de importação colada: uma pessoa por linha, campos separados
 * por TAB, vírgula ou ponto-e-vírgula → nome[, documento[, empresa]].
 * Ignora cabeçalho óbvio ("nome,...") e linhas vazias.
 */
export function parseImportText(text: string): ImportLinha[] {
  const out: ImportLinha[] = []
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const cols = line.split(/\t|;|,/).map((s) => s.trim())
    const nome = cols[0]
    if (!nome) continue
    if (out.length === 0 && /^nome$/i.test(nome)) continue // cabeçalho
    out.push({ nome, doc: cols[1] || null, empresa: cols[2] || null })
  }
  return out
}

const escCsv = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
/** Exporta credenciais para CSV (sem moeda; valores crus, BOM p/ Excel BR). */
export function exportCredenciaisCSV(creds: Credencial[]): void {
  const header = ['Nome', 'Tipo', 'Documento', 'Empresa', 'Zonas', 'Status', 'Token']
  const body = creds
    .map((c) =>
      [
        escCsv(c.nome),
        escCsv(credTipoMeta(c.tipo).label),
        escCsv(c.doc || ''),
        escCsv(c.empresa || ''),
        escCsv((c.zonas || []).join(' | ')),
        escCsv(c.status),
        escCsv(c.qr_token),
      ].join(','),
    )
    .join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `credenciais-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function escHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/**
 * Abre uma janela de impressão com um crachá por credencial (QR + nome + tipo +
 * zonas), pronto para imprimir/recortar (≈ 9×5,5 cm). Crachá imprimível é
 * critério de aceite do módulo.
 */
export function printCredenciais(creds: Credencial[], eventoNome: string): void {
  if (!creds.length) return
  const win = window.open('', '_blank', 'width=980,height=720')
  if (!win) return
  const cards = creds
    .map((c) => {
      const meta = credTipoMeta(c.tipo)
      const qr = qrSvgString(gerarQrPayload(c.qr_token), { size: 150 })
      const zonas = (c.zonas || []).length ? (c.zonas || []).join(' · ') : 'Perímetro'
      return `
        <div class="badge">
          <div class="strip" style="background:${meta.hex}"></div>
          <div class="body">
            <div class="info">
              <div class="evt">${escHtml(eventoNome)}</div>
              <div class="nome">${escHtml(c.nome)}</div>
              ${c.empresa ? `<div class="empresa">${escHtml(c.empresa)}</div>` : ''}
              <div class="tipo" style="background:${meta.hex}">${escHtml(meta.label)}</div>
              <div class="zonas">Zonas: ${escHtml(zonas)}</div>
            </div>
            <div class="qr">${qr}<div class="tk">${escHtml(tokenCurto(c.qr_token))}</div></div>
          </div>
        </div>`
    })
    .join('')
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Crachás — ${escHtml(eventoNome)}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'DM Sans', system-ui, sans-serif; margin: 0; padding: 10mm; background: #f4f4f5; }
      .grid { display: flex; flex-wrap: wrap; gap: 6mm; }
      .badge { width: 90mm; height: 55mm; background: #fff; border: 1px solid #d4d4d8; border-radius: 4mm; overflow: hidden; display: flex; flex-direction: column; }
      .strip { height: 6mm; }
      .body { flex: 1; display: flex; gap: 4mm; padding: 4mm 5mm; }
      .info { flex: 1; min-width: 0; }
      .evt { font-size: 9pt; color: #71717a; text-transform: uppercase; letter-spacing: .04em; }
      .nome { font-size: 16pt; font-weight: 700; color: #18181b; margin-top: 2mm; line-height: 1.1; }
      .empresa { font-size: 10pt; color: #52525b; margin-top: 1mm; }
      .tipo { display: inline-block; margin-top: 3mm; padding: 1mm 3mm; border-radius: 10mm; color: #fff; font-size: 9pt; font-weight: 700; }
      .zonas { font-size: 8pt; color: #71717a; margin-top: 3mm; }
      .qr { display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .qr svg { width: 34mm; height: 34mm; }
      .tk { font-size: 8pt; letter-spacing: .12em; color: #3f3f46; margin-top: 1mm; font-family: ui-monospace, monospace; }
      @media print { body { padding: 0; background: #fff; } .badge { page-break-inside: avoid; } }
    </style></head>
    <body onload="window.focus();window.print();"><div class="grid">${cards}</div></body></html>`)
  win.document.close()
}
