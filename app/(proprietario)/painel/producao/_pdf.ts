// Geração do PDF do Run-of-show (jspdf) — o roteiro operacional do dia para
// imprimir/distribuir à equipe: marca, evento, data e, por dia, a tabela
// minuto-a-minuto (horário · duração · atividade · área · responsável · recurso).
// Carregado sob demanda (dynamic import), como na proposta/pedido. Não há moeda
// aqui — datas via lib/format (formatDate); durações via rótulo técnico (h/min).
// Normaliza U+00A0/U+202F (espaços do Intl) que as fontes padrão do jsPDF não
// desenham bem.

import { formatDate } from '@/lib/format';
import { duracaoLabel } from '@/lib/producao';

const BRAND: [number, number, number] = [255, 56, 92];
const INK: [number, number, number] = [13, 13, 13];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [230, 230, 232];

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(new RegExp(String.fromCharCode(160) + '|' + String.fromCharCode(8239), 'g'), ' ');
}

export type RunshowPdfItem = {
  horario: string;
  duracao_min: number;
  atividade: string;
  area?: string | null;
  responsavel?: string | null;
  recurso?: string | null;
};
export type RunshowPdfDia = { data: string | null; itens: RunshowPdfItem[] };
export type RunshowPdfData = {
  eventoNome: string;
  eventoData?: string | null;
  dias: RunshowPdfDia[];
  empresaNome?: string | null;
  empresaContato?: string | null;
};

export async function buildRunshowPDF(d: RunshowPdfData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
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

  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RUN-OF-SHOW', W - M, y - 2, { align: 'right' });
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const nomeLines = doc.splitTextToSize(clean(d.eventoNome || 'Evento'), 90);
  doc.text(nomeLines, W - M, y + 4, { align: 'right' });
  if (d.eventoData) {
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(clean(formatDate(d.eventoData, { style: 'long' })), W - M, y + 4 + nomeLines.length * 5, { align: 'right' });
  }

  y += 16;
  doc.setDrawColor(...LINE);
  doc.line(M, y, W - M, y);
  y += 8;

  // ── Colunas da tabela ───────────────────────────────────────────────────
  const cols = [
    { key: 'hora', label: 'Horário', w: 18, align: 'left' as const },
    { key: 'dur', label: 'Duração', w: 18, align: 'left' as const },
    { key: 'ativ', label: 'Atividade', w: W - 2 * M - 18 - 18 - 26 - 26, align: 'left' as const },
    { key: 'area', label: 'Área', w: 26, align: 'left' as const },
    { key: 'resp', label: 'Resp./Recurso', w: 26, align: 'left' as const },
  ];

  const dias = d.dias.length ? d.dias : [{ data: d.eventoData ?? null, itens: [] }];
  for (const dia of dias) {
    if (y + 20 > H - 18) { doc.addPage(); y = 18; }
    // Cabeçalho do dia
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(clean(dia.data ? formatDate(dia.data, { style: 'long' }) : 'Sem data definida'), M, y);
    y += 5;
    y = tableHeader(doc, M, y, cols);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);

    if (dia.itens.length === 0) {
      doc.setTextColor(...MUTED);
      doc.text('Sem itens neste dia.', M + 2, y);
      y += 8;
      continue;
    }

    dia.itens.forEach((it, idx) => {
      const ativLines = doc.splitTextToSize(clean(it.atividade), cols[2].w - 3);
      const respTxt = [it.responsavel, it.recurso].filter(Boolean).map(clean).join(' · ');
      const respLines = doc.splitTextToSize(respTxt || '—', cols[4].w - 3);
      const areaLines = doc.splitTextToSize(clean(it.area || '—'), cols[3].w - 3);
      const rowH = Math.max(6.5, ativLines.length * 4.2 + 2, respLines.length * 4.2 + 2, areaLines.length * 4.2 + 2);
      if (y + rowH > H - 18) { doc.addPage(); y = 18; y = tableHeader(doc, M, y, cols); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); }
      if (idx % 2 === 1) { doc.setFillColor(249, 249, 250); doc.rect(M, y - 4, W - 2 * M, rowH, 'F'); }
      let x = M;
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'bold');
      doc.text(clean(it.horario), x + 1, y); x += cols[0].w;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(duracaoLabel(it.duracao_min), x + 1, y); x += cols[1].w;
      doc.setTextColor(...INK);
      doc.text(ativLines, x + 1, y); x += cols[2].w;
      doc.setTextColor(...MUTED);
      doc.text(areaLines, x + 1, y); x += cols[3].w;
      doc.text(respLines, x + 1, y);
      y += rowH;
    });
    doc.setDrawColor(...LINE);
    doc.line(M, y - 1, W - M, y - 1);
    y += 8;
  }

  // ── Rodapé ──────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(clean(`${empresaNome} · Run-of-show ${d.eventoNome || ''}`), M, H - 9);
    doc.text(`Página ${p}/${pages}`, W - M, H - 9, { align: 'right' });
  }
  return doc;
}

function tableHeader(doc: import('jspdf').jsPDF, M: number, y: number, cols: { label: string; w: number; align: 'left' | 'center' | 'right' }[]): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...INK);
  doc.rect(M, y - 4, W - 2 * M, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  let x = M;
  cols.forEach((cdef) => {
    doc.text(cdef.label.toUpperCase(), x + 1, y);
    x += cdef.w;
  });
  return y + 6.5;
}
