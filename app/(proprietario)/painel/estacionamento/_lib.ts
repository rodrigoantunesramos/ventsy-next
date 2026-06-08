// _lib — tipos e helpers só do módulo Estacionamento (/painel/estacionamento).
// A lógica de domínio (tarifa, lotação, receita, mobilidade) vive em
// lib/estacionamento.ts (pura e testada). Aqui ficam o tipo de vínculo (evento),
// formatação de duração (símbolos h/min/d, neutros de idioma), export CSV e o
// comprovante de valet imprimível (QR via lib/qrcode). Regra de ouro: NADA de
// "R$"/data formatada aqui — moeda/data ficam em lib/format, chamadas na página.

import { duracaoPartes, setorTipoMeta, type AcessoVeicular, type Setor } from '@/lib/estacionamento'
import { qrSvgString } from '@/lib/qrcode'

// Evento (clientes_eventos) — subconjunto para escopar o estacionamento.
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

/** Duração legível com símbolos universais (h/min/d) — neutro de idioma. */
export function fmtDuracao(ms: number): string {
  const { dias, horas, minutos } = duracaoPartes(ms)
  if (dias > 0) return `${dias}d ${horas}h`
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}

const escCsv = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
/** Exporta os acessos do pátio para CSV (valores crus, sem moeda; BOM p/ Excel BR). */
export function exportAcessosCSV(acessos: AcessoVeicular[], setores: Setor[], nowMs: number): void {
  const setorNome = new Map(setores.map((s) => [s.id, s.nome]))
  const header = ['Placa', 'Tipo', 'Setor', 'Entrada', 'Saida', 'Permanencia_min', 'Valor', 'Pago', 'Metodo', 'Valet', 'Status']
  const body = acessos
    .map((a) => {
      const ent = a.entrada ? Date.parse(a.entrada) : NaN
      const fim = a.saida ? Date.parse(a.saida) : nowMs
      const permMin = Number.isNaN(ent) ? '' : String(Math.max(0, Math.round((fim - ent) / 60000)))
      return [
        escCsv(a.placa),
        escCsv(setorTipoMeta(a.tipo).label),
        escCsv(a.setor_id ? setorNome.get(a.setor_id) || '' : ''),
        escCsv(a.entrada || ''),
        escCsv(a.saida || ''),
        permMin,
        (Number(a.valor_num) || 0).toFixed(2),
        a.pago ? '1' : '0',
        escCsv(a.metodo || ''),
        a.valet ? '1' : '0',
        escCsv(a.status),
      ].join(',')
    })
    .join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `estacionamento-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function escHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/**
 * Abre uma janela de impressão com o comprovante de VALET (QR + placa + setor +
 * local da chave + horário). O cliente apresenta na retirada; o manobrista casa
 * o ticket com o veículo. ≈ 8×5 cm, pronto para recortar.
 */
export function printValetTicket(acesso: AcessoVeicular, setorNome: string, eventoNome: string): void {
  const win = window.open('', '_blank', 'width=520,height=640')
  if (!win) return
  const qr = qrSvgString(`VTS-PARK:${acesso.id}`, { size: 150 })
  const entrada = acesso.entrada ? new Date(acesso.entrada).toLocaleString() : ''
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Valet — ${escHtml(acesso.placa)}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'DM Sans', system-ui, sans-serif; margin: 0; padding: 8mm; background: #f4f4f5; }
      .ticket { width: 80mm; margin: 0 auto; background: #fff; border: 1px solid #d4d4d8; border-radius: 4mm; overflow: hidden; }
      .top { background: #ff385c; color: #fff; padding: 4mm 5mm; }
      .top .ev { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; opacity: .9; }
      .top .ti { font-size: 13pt; font-weight: 800; margin-top: 1mm; }
      .body { padding: 5mm; display: flex; gap: 5mm; align-items: center; }
      .placa { font-size: 22pt; font-weight: 800; letter-spacing: .06em; color: #18181b; font-family: ui-monospace, monospace; }
      .meta { font-size: 9pt; color: #52525b; margin-top: 2mm; line-height: 1.5; }
      .meta b { color: #18181b; }
      .qr svg { width: 30mm; height: 30mm; }
      .foot { border-top: 1px dashed #d4d4d8; padding: 3mm 5mm; font-size: 7.5pt; color: #71717a; text-align: center; }
      @media print { body { padding: 0; background: #fff; } }
    </style></head>
    <body onload="window.focus();window.print();">
      <div class="ticket">
        <div class="top"><div class="ev">${escHtml(eventoNome)} · Valet</div><div class="ti">Comprovante de manobrista</div></div>
        <div class="body">
          <div style="flex:1">
            <div class="placa">${escHtml(acesso.placa || '—')}</div>
            <div class="meta">
              ${acesso.modelo ? `<div><b>Veículo:</b> ${escHtml(acesso.modelo)}${acesso.cor_veiculo ? ' · ' + escHtml(acesso.cor_veiculo) : ''}</div>` : ''}
              <div><b>Setor:</b> ${escHtml(setorNome || '—')}</div>
              ${acesso.valet_local ? `<div><b>Vaga/Chave:</b> ${escHtml(acesso.valet_local)}</div>` : ''}
              ${entrada ? `<div><b>Entrada:</b> ${escHtml(entrada)}</div>` : ''}
            </div>
          </div>
          <div class="qr">${qr}</div>
        </div>
        <div class="foot">Guarde este comprovante para a retirada do veículo.</div>
      </div>
    </body></html>`)
  win.document.close()
}
