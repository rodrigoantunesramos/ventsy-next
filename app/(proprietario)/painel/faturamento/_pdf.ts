// Geração do PDF de um documento fiscal (recibo numerado ou cópia da NFS-e/NF-e
// emitida manualmente) com jspdf — carregado sob demanda (dynamic import). É a
// VIA do "degrade sem provedor": gera um recibo numerado válido como
// comprovante. Sem "R$" hardcoded — toda moeda passa por lib/format. As fontes
// padrão do jsPDF não lidam bem com espaços não-quebráveis do Intl, então
// normalizamos U+00A0/U+202F antes de desenhar.

import { formatMoney, formatDate, type Currency } from '@/lib/format'
import { TIPO_LABEL } from '@/lib/fiscal'
import type { NotaFiscal } from './_lib'

const BRAND: [number, number, number] = [255, 56, 92]
const INK: [number, number, number] = [13, 13, 13]
const MUTED: [number, number, number] = [107, 114, 128]
const LINE: [number, number, number] = [230, 230, 232]

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(new RegExp(String.fromCharCode(160) + '|' + String.fromCharCode(8239), 'g'), ' ')
}

export type EmpresaPdf = {
  fantasia?: string | null
  razao_social?: string | null
  cnpj?: string | null
  im?: string | null
  contatos?: { email?: string; telefone?: string; whatsapp?: string; site?: string } | null
  endereco?: { cidade?: string; estado?: string; rua?: string; numero?: string; bairro?: string } | null
}

export type NotaPdfOpts = {
  nota: NotaFiscal
  empresa: EmpresaPdf | null
  moeda: Currency
  eventoNome?: string | null
}

/** Monta e retorna o jsPDF do documento. O chamador decide salvar/baixar. */
export async function buildNotaPDF(opts: NotaPdfOpts) {
  const { nota, empresa, moeda } = opts
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 16
  const money = (v: number | null | undefined) => clean(formatMoney(v, { currency: moeda }))

  let y = 0

  // ── Cabeçalho de marca ──────────────────────────────────────────────────
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 4, 'F')
  y = 16

  const empresaNome = empresa?.fantasia || empresa?.razao_social || 'VENTSY'
  doc.setTextColor(...BRAND)
  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(20)
  doc.text(clean(empresaNome), M, y)

  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const c = empresa?.contatos || {}
  const linhaContato = [c.telefone || c.whatsapp, c.email, c.site].filter((x): x is string => Boolean(x)).map(clean).join('  ·  ')
  if (linhaContato) doc.text(linhaContato, M, y + 6)
  const docLinha = [empresa?.cnpj ? `CNPJ ${clean(empresa.cnpj)}` : '', empresa?.im ? `IM ${clean(empresa.im)}` : ''].filter(Boolean).join('   ')
  if (docLinha) doc.text(docLinha, M, y + 10.5)

  // Bloco direito: tipo + número + data
  const titulo = nota.tipo === 'recibo' ? 'RECIBO' : `${TIPO_LABEL[nota.tipo]}`.toUpperCase()
  doc.setTextColor(...BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(titulo, W - M, y - 2, { align: 'right' })
  doc.setTextColor(...INK)
  doc.setFontSize(15)
  doc.text(clean(nota.numero), W - M, y + 4, { align: 'right' })
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const dataRef = nota.emitida_em || nota.criado_em
  if (dataRef) doc.text(`Emitido em ${clean(formatDate(dataRef))}`, W - M, y + 9.5, { align: 'right' })
  if (nota.serie) doc.text(`Série ${clean(nota.serie)}`, W - M, y + 13.5, { align: 'right' })

  y += 18
  doc.setDrawColor(...LINE)
  doc.line(M, y, W - M, y)
  y += 9

  // ── Tomador ─────────────────────────────────────────────────────────────
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('TOMADOR / CLIENTE', M, y)
  y += 5
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(clean(nota.tomador_nome || '—'), M, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  const tom = [nota.tomador_doc ? `Doc: ${clean(nota.tomador_doc)}` : '', nota.tomador_email ? clean(nota.tomador_email) : '', opts.eventoNome ? `Evento: ${clean(opts.eventoNome)}` : ''].filter(Boolean).join('   ·   ')
  if (tom) { doc.text(tom, M, y); y += 5 }

  y += 4
  doc.line(M, y, W - M, y)
  y += 9

  // ── Discriminação ───────────────────────────────────────────────────────
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('DISCRIMINAÇÃO DOS SERVIÇOS', M, y)
  y += 5
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const disc = nota.discriminacao || (opts.eventoNome ? `Locação de espaço para evento — ${opts.eventoNome}` : 'Locação de espaço / prestação de serviço')
  const linhas = doc.splitTextToSize(clean(disc), W - 2 * M)
  doc.text(linhas, M, y)
  y += linhas.length * 5 + 6
  if (nota.codigo_servico) {
    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.text(`Código de serviço: ${clean(nota.codigo_servico)}`, M, y)
    y += 6
  }

  doc.line(M, y, W - M, y)
  y += 9

  // ── Valores ─────────────────────────────────────────────────────────────
  const rowY = (label: string, value: string, bold = false, color: [number, number, number] = INK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 9.5)
    doc.setTextColor(...MUTED)
    doc.text(clean(label), M, y)
    doc.setTextColor(...color)
    doc.text(value, W - M, y, { align: 'right' })
    y += bold ? 7 : 6
  }
  rowY('Valor dos serviços', money(nota.valor_servicos_num))
  if (nota.descontos_num > 0) rowY('(−) Descontos', `− ${money(nota.descontos_num)}`)
  if ((nota.aliquota_iss ?? 0) > 0 || nota.iss_num > 0) rowY(`ISS (${nota.aliquota_iss ?? 0}%)`, money(nota.iss_num))
  const linhasRet = nota.retencoes?.linhas || []
  for (const l of linhasRet) rowY(`(−) ${l.label} (${l.aliquota}%)`, `− ${money(l.valor)}`)

  y += 1
  doc.setDrawColor(...LINE)
  doc.line(M, y, W - M, y)
  y += 8
  rowY('VALOR TOTAL', money(nota.valor_total_num), true, INK)
  if (nota.total_retencoes_num > 0) rowY('Valor líquido (após retenções)', money(nota.valor_liquido_num), true, [16, 122, 87])

  // ── Recibo: cláusula de quitação ────────────────────────────────────────
  if (nota.tipo === 'recibo') {
    y += 6
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    const quit = `Recebi(emos) de ${clean(nota.tomador_nome || 'cliente')} a importância de ${money(nota.valor_total_num)}, referente aos serviços acima discriminados, dando plena e geral quitação.`
    const ql = doc.splitTextToSize(clean(quit), W - 2 * M)
    doc.text(ql, M, y)
    y += ql.length * 5 + 12

    // Linha de assinatura
    doc.setDrawColor(...INK)
    doc.line(W / 2 - 35, y, W / 2 + 35, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(clean(empresaNome), W / 2, y, { align: 'center' })
  } else {
    // NFS-e/NF-e: marca a via como cópia/registro.
    y += 8
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    const aviso = nota.provedor === 'manual'
      ? 'Documento registrado para emissão manual. Transmita/valide no portal do município ou do provedor.'
      : 'Cópia para conferência. O documento fiscal oficial é o XML/PDF emitido pelo provedor.'
    doc.text(doc.splitTextToSize(clean(aviso), W - 2 * M), M, y)
  }

  // Rodapé
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Gerado pela Ventsy', M, doc.internal.pageSize.getHeight() - 10)

  return doc
}
