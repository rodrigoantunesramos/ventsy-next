// _lib — Avaliações (/painel/avaliacoes): tipos + motor PURO de métricas.
// Sem React, sem Supabase, sem formatação de moeda — só agregações testáveis
// sobre a tabela `avaliacoes`. A formatação i18n fica por conta de lib/format
// (datas/percentuais), injetada quando necessário (ex.: exportCSV recebe fmtDate).

export interface Avaliacao {
  id: number;
  user_id: string | null;
  propriedade_id: number | null;
  nota: number;
  texto: string | null;
  autor: string | null;
  avatar: string | null;
  evento_tipo: string | null;
  data: string | null;           // rótulo legado "mês ano"
  verificada: boolean;
  resposta: string | null;
  respondido_em: string | null;
  oculta: boolean;
  destaque: boolean;
  criado_em: string;
}

export interface PropLite { id: number; nome: string | null; cidade: string | null; estado: string | null }

export type StatusFiltro = 'todas' | 'respondidas' | 'pendentes' | 'ocultas' | 'destaque';

export const NOTAS = [5, 4, 3, 2, 1] as const;

export const PERIODOS: { v: number; label: string }[] = [
  { v: 30, label: '30 dias' },
  { v: 90, label: '90 dias' },
  { v: 365, label: '12 meses' },
  { v: 0, label: 'Todo o período' },
];

export const TONS: { v: string; label: string }[] = [
  { v: 'cordial', label: 'Cordial' },
  { v: 'profissional', label: 'Profissional' },
  { v: 'caloroso', label: 'Caloroso' },
];

/** Horas decorridas desde a criação da avaliação. */
export function idadeHoras(a: Avaliacao, now: Date): number {
  const t = Date.parse(a.criado_em || '');
  if (Number.isNaN(t)) return 0;
  return (now.getTime() - t) / 3_600_000;
}

/** Visível, sem resposta e com mais de `horas` de espera — "pede resposta". */
export function precisaResposta(a: Avaliacao, now: Date, horas = 48): boolean {
  return !a.oculta && !a.resposta && idadeHoras(a, now) >= horas;
}

/** Média simples das notas (0 se vazio). */
export function media(list: Avaliacao[]): number {
  if (!list.length) return 0;
  return list.reduce((s, a) => s + (Number(a.nota) || 0), 0) / list.length;
}

/** Distribuição por nota: índice 0 = nota 1 … índice 4 = nota 5. */
export function distribuicao(list: Avaliacao[]): number[] {
  const d = [0, 0, 0, 0, 0];
  list.forEach((a) => { const n = Math.round(Number(a.nota) || 0); if (n >= 1 && n <= 5) d[n - 1]++; });
  return d;
}

/** Série dos últimos `n` meses: média e volume por mês (ym = 'YYYY-MM'). */
export function serieMensal(
  list: Avaliacao[],
  now: Date,
  n = 6,
): { ym: string; media: number; n: number }[] {
  const out: { ym: string; media: number; n: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mes = list.filter((a) => (a.criado_em || '').slice(0, 7) === ym);
    out.push({ ym, media: media(mes), n: mes.length });
  }
  return out;
}

/** Média por chave (propriedade/tipo), ordenada por volume desc. */
export function notaPorChave(
  list: Avaliacao[],
  key: (a: Avaliacao) => string | null,
): { chave: string; media: number; n: number }[] {
  const m = new Map<string, Avaliacao[]>();
  list.forEach((a) => { const k = (key(a) || '—').trim() || '—'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(a); });
  return [...m.entries()]
    .map(([chave, arr]) => ({ chave, media: media(arr), n: arr.length }))
    .sort((a, b) => b.n - a.n);
}

/** Média da janela atual (`dias`) vs janela anterior de mesmo tamanho. */
export function comparativo(
  list: Avaliacao[],
  dias: number,
  now: Date,
): { atual: number; anterior: number; nAtual: number; nAnterior: number } {
  const d = dias > 0 ? dias : 90;
  const ms = d * 86_400_000;
  const ini = now.getTime() - ms;
  const iniAnt = now.getTime() - 2 * ms;
  const win = (lo: number, hi: number) =>
    list.filter((a) => { const t = Date.parse(a.criado_em || ''); return !Number.isNaN(t) && t >= lo && t < hi; });
  const atual = win(ini, now.getTime() + 1);
  const anterior = win(iniAnt, ini);
  return { atual: media(atual), anterior: media(anterior), nAtual: atual.length, nAnterior: anterior.length };
}

/** Está dentro do período selecionado? (`dias = 0` ⇒ tudo). */
export function dentroPeriodo(a: Avaliacao, dias: number, now: Date): boolean {
  if (!dias) return true;
  const t = Date.parse(a.criado_em || '');
  if (Number.isNaN(t)) return true;
  return t >= now.getTime() - dias * 86_400_000;
}

/** Exporta a lista filtrada em CSV (datas via fmtDate, mantendo i18n). */
export function exportAvaliacoesCSV(
  list: Avaliacao[],
  propNome: Map<number, string>,
  fmtDate: (s: string) => string,
): void {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = ['Data', 'Propriedade', 'Autor', 'Nota', 'Tipo de evento', 'Texto', 'Respondida', 'Resposta', 'Oculta', 'Destaque'];
  const body = list.map((a) => [
    esc(a.criado_em ? fmtDate(a.criado_em) : (a.data || '')),
    esc((a.propriedade_id != null && propNome.get(a.propriedade_id)) || ''),
    esc(a.autor || ''), Number(a.nota) || 0, esc(a.evento_tipo || ''), esc(a.texto || ''),
    a.resposta ? 'sim' : 'não', esc(a.resposta || ''), a.oculta ? 'sim' : 'não', a.destaque ? 'sim' : 'não',
  ].join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = `avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`; el.click();
  URL.revokeObjectURL(url);
}
