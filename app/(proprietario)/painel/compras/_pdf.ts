// Geração do PDF do Pedido de Compra (jspdf) — marca, fornecedor, itens, totais,
// condição/previsão e observações. Carregado sob demanda (dynamic import) como
// na proposta. Sem "R$" hardcoded: moeda via lib/format (formatMoney) com a moeda
// ativa. Normaliza U+00A0/U+202F (espaços do Intl) que as fontes padrão do jsPDF
// não desenham bem.

import { formatMoney, formatDate, type Currency } from '@/lib/format';

const BRAND: [number, number, number] = [255, 56, 92];
const INK: [number, number, number] = [13, 13, 13];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [230, 230, 232];

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(new RegExp(String.fromCharCode(160) + '|' + String.fromCharCode(8239), 'g'), ' ');
}

export type PedidoPdfItem = { descricao: string; quantidade: number; unidade: string; valor_unit_num: number };
export type PedidoPdfData = {
  numero: string | null;
  fornecedorNome: string;
  fornecedorDoc?: string | null;
  fornecedorContato?: string | null;
  condicao?: string | null;
  previsao?: string | null;
  criadoEm?: string | null;
  obs?: string | null;
  itens: PedidoPdfItem[];
  total: number;
  moeda: Currency;
  empresaNome?: string | null;
  empresaContato?: string | null;
  empresaCnpj?: string | null;
};

export async function buildPedidoPDF(d: PedidoPdfData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const moeda = d.moeda;
  const money = (v: number | null | undefined) => clean(formatMoney(v, { currency: moeda }));
  let y = 0;

  // ── Cabeçalho de marca ──────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, 'F');
  y = 16;
  const empresaNome = d.empresaNome || 'VENTSY';
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(20);
  doc.text(clean(empresaNome), M, y);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (d.empresaContato) doc.text(clean(d.empresaContato), M, y + 6);
  if (d.empresaCnpj) doc.text(`CNPJ ${clean(d.empresaCnpj)}`, M, y + 10.5);

  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PEDIDO DE COMPRA', W - M, y - 2, { align: 'right' });
  doc.setTextColor(...INK);
  doc.setFontSize(15);
  doc.text(clean(d.numero || '—'), W - M, y + 4, { align: 'right' });
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (d.criadoEm) doc.text(`Emitido em ${clean(formatDate(d.criadoEm))}`, W - M, y + 9.5, { align: 'right' });

  y += 18;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 9;

  // ── Fornecedor + condições ──────────────────────────────────────────────
  const colW = (W - 2 * M - 6) / 2;
  const fornLines = [
    clean(d.fornecedorNome || '—'),
    ...(d.fornecedorDoc ? [clean(d.fornecedorDoc)] : []),
    ...(d.fornecedorContato ? [clean(d.fornecedorContato)] : []),
  ];
  const condLines = [
    clean(d.condicao || 'A combinar'),
    ...(d.previsao ? [`Previsão de entrega: ${clean(formatDate(d.previsao))}`] : []),
  ];
  const boxH = 8 + Math.max(fornLines.length, condLines.length) * 4.6 + 3;
  infoBox(doc, M, y, colW, boxH, 'FORNECEDOR', fornLines);
  infoBox(doc, M + colW + 6, y, colW, boxH, 'CONDIÇÕES', condLines);
  y += boxH + 8;

  // ── Tabela de itens ─────────────────────────────────────────────────────
  const cols = [
    { key: 'descricao', label: 'Item', w: W - 2 * M - 22 - 22 - 28 - 30, align: 'left' as const },
    { key: 'qtd', label: 'Qtd', w: 22, align: 'center' as const },
    { key: 'un', label: 'Un.', w: 22, align: 'center' as const },
    { key: 'unit', label: 'Valor unit.', w: 30, align: 'right' as const },
    { key: 'total', label: 'Total', w: 28, align: 'right' as const },
  ];
  y = tableHeader(doc, M, y, cols);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  d.itens.forEach((it, idx) => {
    const descLines = doc.splitTextToSize(clean(it.descricao), cols[0].w - 4);
    const rowH = Math.max(7, descLines.length * 4.4 + 2.5);
    if (y + rowH > H - 24) { doc.addPage(); y = 18; y = tableHeader(doc, M, y, cols); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
    if (idx % 2 === 1) { doc.setFillColor(249, 249, 250); doc.rect(M, y - 4.5, W - 2 * M, rowH, 'F'); }
    let x = M;
    doc.setTextColor(...INK);
    doc.text(descLines, x + 2, y); x += cols[0].w;
    doc.setTextColor(...MUTED);
    doc.text(String(it.quantidade), x + cols[1].w / 2, y, { align: 'center' }); x += cols[1].w;
    doc.text(clean(it.unidade), x + cols[2].w / 2, y, { align: 'center' }); x += cols[2].w;
    doc.text(money(it.valor_unit_num), x + cols[3].w - 2, y, { align: 'right' }); x += cols[3].w;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(money((Number(it.valor_unit_num) || 0) * (Number(it.quantidade) || 0)), x + cols[4].w - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += rowH;
  });
  doc.setDrawColor(...LINE);
  doc.line(M, y - 1.5, W - M, y - 1.5);
  y += 6;

  // ── Total ───────────────────────────────────────────────────────────────
  const totBoxW = 70, totX = W - M - totBoxW;
  if (y + 14 > H - 20) { doc.addPage(); y = 18; }
  doc.setFillColor(...INK);
  doc.roundedRect(totX, y - 1, totBoxW, 11, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL', totX + 4, y + 6);
  doc.setFontSize(13);
  doc.text(money(d.total), W - M - 4, y + 6.2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 18;

  // ── Observações ─────────────────────────────────────────────────────────
  if (d.obs) {
    const lines = doc.splitTextToSize(clean(d.obs), W - 2 * M - 2);
    if (y + 10 + lines.length * 5 > H - 20) { doc.addPage(); y = 18; }
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Observações', M, y); y += 6;
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    lines.forEach((ln: string) => { if (y > H - 20) { doc.addPage(); y = 18; } doc.text(ln, M + 2, y); y += 5; });
  }

  // ── Rodapé ──────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(clean(`${empresaNome} · Pedido de compra ${d.numero || ''}`), M, H - 9);
    doc.text(`Página ${p}/${pages}`, W - M, H - 9, { align: 'right' });
  }
  return doc;
}

// ── helpers de desenho ──────────────────────────────────────────────────────
function infoBox(doc: import('jspdf').jsPDF, x: number, y: number, w: number, h: number, titulo: string, lines: string[]) {
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

function tableHeader(doc: import('jspdf').jsPDF, M: number, y: number, cols: { label: string; w: number; align: 'left' | 'center' | 'right' }[]): number {
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
