// Geração do PDF da proposta (jspdf) — com marca, partes, itens, totais,
// condições de pagamento, observações/cláusulas e validade. Carregado sob
// demanda (dynamic import) como nas demais páginas. Sem "R$" hardcoded: toda
// moeda passa por lib/format (formatMoney) com a moeda da proposta. As fontes
// padrão do jsPDF não lidam bem com espaços não-quebráveis do Intl, então
// normalizamos U+00A0/U+202F para espaço comum antes de desenhar.

import { formatMoney, formatDate, type Currency } from '@/lib/format';
import { numeroLabel, somaParcelas, type Empresa, type Evento } from './_lib';
import type { PropostaViewData } from './_components/PropostaView';

const BRAND: [number, number, number] = [255, 56, 92];
const INK: [number, number, number] = [13, 13, 13];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [230, 230, 232];

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(new RegExp(String.fromCharCode(160) + '|' + String.fromCharCode(8239), 'g'), ' ');
}

export type PdfOpts = {
  data: PropostaViewData;
  empresa: Empresa | null;
  evento: Evento | null;
  propriedadeNome?: string | null;
  publicUrl?: string | null;
};

export async function buildPropostaPDF(opts: PdfOpts) {
  const { data, empresa, evento, propriedadeNome, publicUrl } = opts;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16; // margem
  const moeda: Currency = data.moeda;
  const money = (v: number | null | undefined) => clean(formatMoney(v, { currency: moeda }));

  let y = 0;

  // ── Cabeçalho de marca ──────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, 'F');
  y = 16;

  const empresaNome = empresa?.fantasia || empresa?.razao_social || 'VENTSY';
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(20);
  doc.text(clean(empresaNome), M, y);

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const c = empresa?.contatos || {};
  const linhaContato = [c.telefone || c.whatsapp, c.email, c.site].filter((x): x is string => Boolean(x)).map(clean).join('  ·  ');
  if (linhaContato) doc.text(linhaContato, M, y + 6);
  if (empresa?.cnpj) doc.text(`CNPJ ${clean(empresa.cnpj)}`, M, y + 10.5);

  // Bloco direito: número + datas
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PROPOSTA COMERCIAL', W - M, y - 2, { align: 'right' });
  doc.setTextColor(...INK);
  doc.setFontSize(15);
  doc.text(numeroLabel(data.numero), W - M, y + 4, { align: 'right' });
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (data.criado_em) doc.text(`Emitida em ${clean(formatDate(data.criado_em))}`, W - M, y + 9.5, { align: 'right' });

  y += 18;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 9;

  // ── Título ──────────────────────────────────────────────────────────────
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const tituloLines = doc.splitTextToSize(clean(data.titulo || 'Proposta comercial'), W - 2 * M);
  doc.text(tituloLines, M, y);
  y += 6 * tituloLines.length + 3;

  // ── Partes (Para / Evento) ──────────────────────────────────────────────
  const colW = (W - 2 * M - 6) / 2;
  const boxTop = y;
  const clienteNome = clean((evento?.quem_contratou || 'Cliente').trim());
  const paraLines = [
    clienteNome,
    ...(evento?.email ? [clean(evento.email)] : []),
    ...(evento?.documento ? [clean(evento.documento)] : []),
  ];
  const eventoLines = [
    ...(evento?.nome_evento ? [clean(evento.nome_evento)] : []),
    clean([evento?.tipo_evento, propriedadeNome].filter(Boolean).join(' · ') || '—'),
    ...(evento?.data_inicio
      ? [clean(formatDate(evento.data_inicio) + (evento.data_fim && evento.data_fim !== evento.data_inicio ? ` → ${formatDate(evento.data_fim)}` : ''))]
      : []),
  ];
  const boxH = 8 + Math.max(paraLines.length, eventoLines.length) * 4.6 + 3;
  infoBox(doc, M, boxTop, colW, boxH, 'PARA', paraLines);
  infoBox(doc, M + colW + 6, boxTop, colW, boxH, 'EVENTO', eventoLines);
  y = boxTop + boxH + 8;

  // ── Tabela de itens ─────────────────────────────────────────────────────
  const cols = [
    { key: 'descricao', label: 'Descrição', w: W - 2 * M - 18 - 28 - 28, align: 'left' as const },
    { key: 'qtd', label: 'Qtd', w: 18, align: 'center' as const },
    { key: 'unit', label: 'Valor unit.', w: 28, align: 'right' as const },
    { key: 'total', label: 'Total', w: 28, align: 'right' as const },
  ];
  y = tableHeader(doc, M, y, cols);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  data.itens.forEach((it, idx) => {
    const descLines = doc.splitTextToSize(clean(it.descricao), cols[0].w - 4);
    const rowH = Math.max(7, descLines.length * 4.4 + 2.5);
    if (y + rowH > H - 24) { doc.addPage(); y = 18; y = tableHeader(doc, M, y, cols); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
    if (idx % 2 === 1) { doc.setFillColor(249, 249, 250); doc.rect(M, y - 4.5, W - 2 * M, rowH, 'F'); }
    let x = M;
    doc.setTextColor(...INK);
    doc.text(descLines, x + 2, y);
    x += cols[0].w;
    doc.setTextColor(...MUTED);
    doc.text(String(it.qtd), x + cols[1].w / 2, y, { align: 'center' });
    x += cols[1].w;
    doc.text(money(it.valor_unit), x + cols[2].w - 2, y, { align: 'right' });
    x += cols[2].w;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(money(it.total), x + cols[3].w - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  });
  doc.setDrawColor(...LINE);
  doc.line(M, y - 1.5, W - M, y - 1.5);
  y += 5;

  // ── Totais ──────────────────────────────────────────────────────────────
  const totBoxW = 70;
  const totX = W - M - totBoxW;
  ensureSpace(28);
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text('Subtotal', totX, y);
  doc.setTextColor(...INK);
  doc.text(money(data.subtotal_num), W - M, y, { align: 'right' });
  y += 6;
  if (data.desconto_num > 0) {
    doc.setTextColor(...MUTED); doc.text('Desconto', totX, y);
    doc.setTextColor(16, 145, 95); doc.text(`- ${money(data.desconto_num)}`, W - M, y, { align: 'right' });
    y += 6;
  }
  doc.setFillColor(...INK);
  doc.roundedRect(totX, y - 1, totBoxW, 11, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL', totX + 4, y + 6);
  doc.setFontSize(13);
  doc.text(money(data.total_num), W - M - 4, y + 6.2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 18;

  // ── Pagamento ───────────────────────────────────────────────────────────
  const parcelas = data.condicoes_pagamento?.parcelas || [];
  if (parcelas.length) {
    ensureSpace(14 + parcelas.length * 6);
    sectionTitle(`Condições de pagamento${data.condicoes_pagamento?.metodo ? ` · ${data.condicoes_pagamento.metodo}` : ''}`);
    doc.setFontSize(9);
    parcelas.forEach((p) => {
      if (y > H - 22) { doc.addPage(); y = 18; }
      doc.setTextColor(...INK); doc.text(clean(p.descricao), M + 2, y);
      doc.setTextColor(...MUTED); doc.text(p.vencimento ? clean(formatDate(p.vencimento)) : 'A combinar', M + 70, y);
      doc.setTextColor(...INK); doc.text(money(p.valor), W - M - 2, y, { align: 'right' });
      y += 5.6;
    });
    const soma = somaParcelas(parcelas);
    if (Math.abs(soma - data.total_num) > 0.01) {
      doc.setTextColor(...MUTED); doc.setFontSize(7.8);
      doc.text(`Soma das parcelas: ${money(soma)}`, M + 2, y);
      y += 5;
    }
    y += 3;
  }

  // ── Observações / cláusulas ─────────────────────────────────────────────
  if (data.observacoes) { y = textBlock('Observações', data.observacoes, 9); }
  if (data.condicoes) { y = textBlock('Condições gerais', data.condicoes, 8); }

  // ── Validade ────────────────────────────────────────────────────────────
  ensureSpace(14);
  doc.setFillColor(255, 240, 243);
  doc.roundedRect(M, y, W - 2 * M, 11, 1.5, 1.5, 'F');
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text('Validade da proposta', M + 4, y + 7);
  doc.setTextColor(...BRAND);
  doc.text(data.validade ? clean(formatDate(data.validade)) : 'A combinar', W - M - 4, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  // ── Rodapé (todas as páginas) ───────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(clean(`${empresaNome} · Proposta ${numeroLabel(data.numero)}`), M, H - 9);
    if (publicUrl) doc.text(clean(publicUrl), M, H - 5.5);
    doc.text(`Página ${p}/${pages}`, W - M, H - 9, { align: 'right' });
  }

  return doc;

  // ── helpers locais (fecham sobre doc/y) ─────────────────────────────────
  function ensureSpace(needed: number) {
    if (y + needed > H - 20) { doc.addPage(); y = 18; }
  }
  function sectionTitle(t: string) {
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(clean(t), M, y); y += 6; doc.setFont('helvetica', 'normal');
  }
  function textBlock(titulo: string, corpo: string, size: number): number {
    const lines = doc.splitTextToSize(clean(corpo), W - 2 * M - 2);
    ensureSpace(10 + lines.length * (size * 0.5));
    sectionTitle(titulo);
    doc.setTextColor(...MUTED); doc.setFontSize(size);
    lines.forEach((ln: string) => {
      if (y > H - 20) { doc.addPage(); y = 18; }
      doc.text(ln, M + 2, y); y += size * 0.52 + 1.2;
    });
    return y + 4;
  }
}

// ── helpers de desenho (puros, recebem doc) ─────────────────────────────────
function infoBox(
  doc: import('jspdf').jsPDF, x: number, y: number, w: number, h: number, titulo: string, lines: string[],
) {
  doc.setDrawColor(...LINE);
  doc.setFillColor(250, 250, 251);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(titulo, x + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let ly = y + 10;
  lines.forEach((ln, i) => {
    doc.setTextColor(...(i === 0 ? INK : MUTED));
    const wrapped = doc.splitTextToSize(ln, w - 6);
    doc.text(wrapped, x + 3, ly);
    ly += 4.6 * wrapped.length;
  });
}

function tableHeader(
  doc: import('jspdf').jsPDF, M: number, y: number,
  cols: { label: string; w: number; align: 'left' | 'center' | 'right' }[],
): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...INK);
  doc.rect(M, y - 4.5, W - 2 * M, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  let x = M;
  cols.forEach((cdef) => {
    const tx = cdef.align === 'right' ? x + cdef.w - 2 : cdef.align === 'center' ? x + cdef.w / 2 : x + 2;
    doc.text(cdef.label.toUpperCase(), tx, y, { align: cdef.align });
    x += cdef.w;
  });
  return y + 7;
}
