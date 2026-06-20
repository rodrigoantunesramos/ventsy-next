// _lib — tipos "lite" das fontes, helpers de apresentação e geração de PDF da
// página de Contratos (/painel/contratos). A LÓGICA de domínio (variáveis,
// render, cláusulas, hash) mora em lib/contracts.ts (pura e compartilhada).
// Moeda/idioma sempre via lib/format — nunca "R$" hardcoded.

import { getFormatPrefs, formatMoney, formatDate, formatDateTime, type Currency } from '@/lib/format';
import { MOEDAS } from '@/lib/prefs';
import { PAPEL_META, type Contrato, type Assinatura } from '@/lib/contracts';

// ── Fontes (linhas cruas que viram contexto de variáveis) ─────────────────────
export type EventoLite = {
  id: string; cliente_id: string | null; nome_evento: string | null; quem_contratou: string | null;
  tipo_evento: string | null; status: string | null; data_inicio: string | null; data_fim: string | null;
  horario_inicio: string | null; horario_fim: string | null; qtd_adultos: number | null; qtd_criancas: number | null;
  documento: string | null; email: string | null; telefones: string[] | null; forma_pagamento: string | null;
  valor_total_num: number | null; propriedade_id: number | null;
};
export type ClienteLite = {
  id: string; nome: string; doc: string | null; email: string | null; telefone: string | null;
  whatsapp: string | null; endereco: string | null; cidade: string | null; estado: string | null;
};
export type Propriedade = {
  id: number; nome: string | null; rua: string | null; numero: string | null;
  bairro: string | null; cidade: string | null; estado: string | null;
};
export type EmpresaConfig = {
  razao_social: string | null; fantasia: string | null; cnpj: string | null;
  endereco: Record<string, string> | null; contatos: Record<string, string> | null;
} | null;

// ── Símbolo da moeda ativa (da tabela MOEDAS — sem "R$" hardcoded) ────────────
const SIMBOLO: Record<Currency, string> = Object.fromEntries(MOEDAS.map((m) => [m.v, m.simbolo])) as Record<Currency, string>;
export function simboloMoeda(c?: Currency): string {
  return SIMBOLO[c ?? getFormatPrefs().currency] ?? '';
}

// Tabela ainda não criada (migration pendente): Postgres cru → 42P01; PostgREST → PGRST205.
export { isMissingTable } from '@/lib/dbErrors'

export const numOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v));

// ── PDF: contrato + certificado de assinatura (trilha de auditoria) ───────────
// markdown-lite → texto simples para o jsPDF (remove #, **, e bullets).
export async function gerarPdfContrato(c: Contrato, assinaturas: Assinatura[], contratada: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const M = 16, maxW = 210 - M * 2;
  let y = 20;
  const nl = (h = 6) => { if (y + h > 285) { doc.addPage(); y = 20; } };

  // Cabeçalho
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 56, 92);
  doc.text('VENTSY', M, y);
  doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${c.numero}`, 210 - M, y, { align: 'right' });
  y += 9;
  doc.setDrawColor(230); doc.line(M, y, 210 - M, y); y += 8;

  for (const raw of (c.conteudo_final || '').split('\n')) {
    const line = raw.trim();
    if (!line) { y += 3; continue; }
    let text = line, size = 10, bold = false;
    if (/^#\s/.test(line)) { text = line.replace(/^#\s/, ''); size = 13; bold = true; }
    else if (/^##\s/.test(line)) { text = line.replace(/^##\s/, ''); size = 11; bold = true; }
    else if (/^###\s/.test(line)) { text = line.replace(/^###\s/, ''); size = 10; bold = true; }
    else if (/^[-*]\s/.test(line)) { text = '•  ' + line.replace(/^[-*]\s/, ''); }
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(bold ? 20 : 40);
    for (const w of doc.splitTextToSize(text, maxW)) { nl(size * 0.5 + 2); doc.text(w, M, y); y += size * 0.5 + 2; }
    if (bold) y += 1.5;
  }

  // ── Certificado de assinatura (página própria) ──────────────────────────────
  doc.addPage(); y = 20;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 56, 92);
  doc.text('Certificado de Assinatura Eletrônica', M, y); y += 7;
  doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Contrato ${c.numero}${c.titulo ? ' — ' + c.titulo : ''}`, M, y); y += 5;
  doc.text(`Contratada: ${contratada}`, M, y); y += 5;
  doc.text(`Valor: ${formatMoney(c.valor_num, { currency: c.moeda })}`, M, y); y += 5;
  doc.text(`Emitido em: ${formatDateTime(new Date())}`, M, y); y += 8;
  doc.setDrawColor(230); doc.line(M, y, 210 - M, y); y += 8;

  const ordered = [...assinaturas].sort((a, b) => a.ordem - b.ordem);
  ordered.forEach((s, i) => {
    nl(40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(`${i + 1}. ${s.signatario_nome} — ${PAPEL_META[s.papel].label}`, M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
    const rows: Array<[string, string]> = [
      ['Documento', s.signatario_doc || '—'],
      ['E-mail', s.email || '—'],
      ['Status', s.assinou_em ? `Assinado em ${formatDateTime(s.assinou_em, { withSeconds: true })}` : 'Pendente'],
      ['Método', s.metodo || '—'],
      ['IP', s.ip || '—'],
      ['Dispositivo', (s.user_agent || '—').slice(0, 90)],
      ['Hash (SHA-256)', s.hash || '—'],
    ];
    for (const [k, v] of rows) {
      for (const w of doc.splitTextToSize(`${k}: ${v}`, maxW - 4)) { nl(4.5); doc.text(w, M + 4, y); y += 4.2; }
    }
    y += 4;
  });

  nl(10);
  doc.setFontSize(7); doc.setTextColor(140);
  doc.text('Trilha de auditoria gerada pela Ventsy. O hash sela o conteúdo do contrato no momento da assinatura.', M, y);

  doc.save(`${c.numero}.pdf`);
}

// Rótulo curto de uma fonte de evento para o seletor do wizard.
export function rotuloEvento(e: EventoLite): string {
  const partes = [e.nome_evento || e.tipo_evento || 'Evento', e.quem_contratou || ''].filter(Boolean);
  const quando = e.data_inicio ? ` · ${formatDate(e.data_inicio)}` : '';
  return partes.join(' · ') + quando;
}
