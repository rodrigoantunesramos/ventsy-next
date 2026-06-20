// Motor PURO de Feedbacks (privados, pós-evento) — /painel/feedbacks.
// ─────────────────────────────────────────────────────────────────────────────
// Avaliação PRIVADA cliente↔dono, separada das avaliações PÚBLICAS (/painel/avaliacoes):
// notas por critério, comentário franco, tratativa (plano de ação/CAPA) e medição
// de satisfação real por evento. NÃO aparece no anúncio público — salvo quando o
// dono "promove" um feedback elogioso a avaliação pública.
//
// Regras de ouro (espelham lib/comissoes.ts, lib/catering.ts, lib/reservas.ts):
// SEM React, SEM Supabase, SEM "R$"/Intl — só tipos, constantes e agregações
// determinísticas e testáveis. A formatação i18n (datas/percentuais) fica em
// lib/format, injetada pelas páginas. Compartilhado por painel + rota pública + API.

export { isMissingTable } from '@/lib/dbErrors';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type CanalFeedback = 'formulario' | 'whatsapp' | 'presencial' | 'email' | 'portal';
export type StatusFeedback = 'novo' | 'em_tratativa' | 'resolvido';
export type StatusAcao = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada';

export type Feedback = {
  id: string;
  usuario_id: string;
  cliente_id: string | null;
  evento_id: string | null;
  propriedade_id: number | null;
  autor_nome: string | null;
  autor_contato: string | null;        // e-mail/telefone informado no formulário (p/ resposta)
  canal: CanalFeedback;
  nota_geral: number | null;           // 1–5 (CSAT)
  criterios: Record<string, number>;   // { atendimento:5, estrutura:4, ... } (1–5)
  comentario: string | null;
  pontos_positivos: string | null;
  pontos_negativos: string | null;
  permite_publicar: boolean;           // cliente autorizou virar avaliação pública
  status: StatusFeedback;
  resposta_privada: string | null;     // resposta interna do dono ao cliente
  respondido_em: string | null;
  promovida_avaliacao_id: number | null;
  resolvido_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type FeedbackAcao = {
  id: string;
  feedback_id: string;
  usuario_id: string;
  descricao: string;
  responsavel: string | null;
  prazo: string | null;                // YYYY-MM-DD
  status: StatusAcao;
  concluida_em: string | null;
  criado_em: string;
};

// Subconjunto de clientes_eventos usado para escolher o evento e dar contexto.
export type EventoLite = {
  id: string;
  cliente_id: string | null;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  propriedade_id: number | null;
  criado_em: string;
};

export type PropLite = { id: number; nome: string | null; cidade: string | null; estado: string | null };

// ── Constantes de domínio ─────────────────────────────────────────────────────
export type CriterioDef = { v: string; label: string };
// Eixos fixos do radar/formulário. O jsonb `criterios` admite chaves extras, mas
// o painel mede e exibe estes (ordem = ordem do radar). NÃO confundir
// "custo_beneficio" (nota 1–5 de percepção) com valor monetário — não há "R$" aqui.
export const CRITERIOS: CriterioDef[] = [
  { v: 'atendimento', label: 'Atendimento' },
  { v: 'estrutura', label: 'Estrutura' },
  { v: 'limpeza', label: 'Limpeza' },
  { v: 'organizacao', label: 'Organização' },
  { v: 'custo_beneficio', label: 'Custo-benefício' },
];
export const CRITERIO_LABEL: Record<string, string> = Object.fromEntries(CRITERIOS.map((c) => [c.v, c.label]));

export const CANAIS: { v: CanalFeedback; label: string; icon: string }[] = [
  { v: 'formulario', label: 'Formulário', icon: '📝' },
  { v: 'portal', label: 'Portal do cliente', icon: '🌐' },
  { v: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { v: 'presencial', label: 'Presencial', icon: '🤝' },
  { v: 'email', label: 'E-mail', icon: '✉️' },
];
export const CANAL_BY: Record<string, { v: CanalFeedback; label: string; icon: string }> =
  Object.fromEntries(CANAIS.map((c) => [c.v, c]));

export const STATUS_FEEDBACK: { v: StatusFeedback; label: string; cls: string; dot: string }[] = [
  { v: 'novo', label: 'Novo', cls: 'bg-brand-50 text-brand', dot: 'bg-brand' },
  { v: 'em_tratativa', label: 'Em tratativa', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { v: 'resolvido', label: 'Resolvido', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
];
export const STATUS_FB_BY: Record<string, { v: StatusFeedback; label: string; cls: string; dot: string }> =
  Object.fromEntries(STATUS_FEEDBACK.map((s) => [s.v, s]));

export const STATUS_ACAO: { v: StatusAcao; label: string; cls: string }[] = [
  { v: 'aberta', label: 'Aberta', cls: 'bg-black/[0.05] text-ink-muted' },
  { v: 'em_andamento', label: 'Em andamento', cls: 'bg-blue-50 text-blue-700' },
  { v: 'concluida', label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  { v: 'cancelada', label: 'Cancelada', cls: 'bg-red-50 text-red-700' },
];
export const STATUS_ACAO_BY: Record<string, { v: StatusAcao; label: string; cls: string }> =
  Object.fromEntries(STATUS_ACAO.map((s) => [s.v, s]));

export const PERIODOS: { v: number; label: string }[] = [
  { v: 30, label: '30 dias' },
  { v: 90, label: '90 dias' },
  { v: 365, label: '12 meses' },
  { v: 0, label: 'Todo o período' },
];

// Nota mínima para promover um feedback a avaliação pública (gate de qualidade).
export const NOTA_MIN_PROMOVER = 4;

// ── Helpers de data ───────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ms(s: string | null | undefined): number {
  return Date.parse(s || '');
}
/** Dias decorridos de `value` (ISO/'YYYY-MM-DD') até `base` (ancorado ao meio-dia). */
export function diffDias(value: string, base: Date): number {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.floor((base.getTime() - t) / 86_400_000);
}

// ── Normalização (tolera jsonb/strings vindos do banco) ───────────────────────
/** Coage o jsonb `criterios` num mapa numérico limpo (descarta valores fora de 1–5). */
export function normalizarCriterios(raw: unknown): Record<string, number> {
  let obj: Record<string, unknown> = {};
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) || {}; } catch { obj = {}; } }
  else if (raw && typeof raw === 'object') obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

// ── Métricas de satisfação ────────────────────────────────────────────────────
const comNota = (list: Feedback[]) => list.filter((f) => Number(f.nota_geral) >= 1);

/** CSAT médio: média da nota geral (escala 0–5; 0 se não houver notas). */
export function csat(list: Feedback[]): number {
  const arr = comNota(list);
  if (!arr.length) return 0;
  return arr.reduce((s, f) => s + (Number(f.nota_geral) || 0), 0) / arr.length;
}

/** Fração de respostas satisfeitas (nota ≥ 4) sobre o total com nota. */
export function pctSatisfeitos(list: Feedback[]): number {
  const arr = comNota(list);
  if (!arr.length) return 0;
  return arr.filter((f) => Number(f.nota_geral) >= 4).length / arr.length;
}

/** Distribuição por nota geral: índice 0 = nota 1 … índice 4 = nota 5. */
export function distribuicaoNotas(list: Feedback[]): number[] {
  const d = [0, 0, 0, 0, 0];
  list.forEach((f) => { const n = Math.round(Number(f.nota_geral) || 0); if (n >= 1 && n <= 5) d[n - 1]++; });
  return d;
}

/** Média por critério conhecido (eixos do radar). Sempre retorna todos os CRITERIOS. */
export function notaPorCriterio(list: Feedback[]): { v: string; label: string; media: number; n: number }[] {
  return CRITERIOS.map(({ v, label }) => {
    const vals = list.map((f) => Number(f.criterios?.[v])).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
    const media = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
    return { v, label, media, n: vals.length };
  });
}

/** Série dos últimos `n` meses: CSAT e volume por mês (ym = 'YYYY-MM'). */
export function serieMensal(list: Feedback[], now: Date, n = 6): { ym: string; media: number; n: number }[] {
  const out: { ym: string; media: number; n: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mes = list.filter((f) => (f.criado_em || '').slice(0, 7) === ym);
    out.push({ ym, media: csat(mes), n: mes.length });
  }
  return out;
}

/** CSAT da janela atual (`dias`) vs janela anterior de mesmo tamanho. */
export function comparativoCsat(
  list: Feedback[], dias: number, now: Date,
): { atual: number; anterior: number; nAtual: number; nAnterior: number } {
  const d = dias > 0 ? dias : 90;
  const span = d * 86_400_000;
  const ini = now.getTime() - span;
  const iniAnt = now.getTime() - 2 * span;
  const win = (lo: number, hi: number) =>
    list.filter((f) => { const t = ms(f.criado_em); return !Number.isNaN(t) && t >= lo && t < hi; });
  const atual = win(ini, now.getTime() + 1);
  const anterior = win(iniAnt, ini);
  return { atual: csat(atual), anterior: csat(anterior), nAtual: atual.length, nAnterior: anterior.length };
}

/** Contagem por status do feedback. */
export function distribuicaoStatus(list: Feedback[]): Record<StatusFeedback, number> {
  const d: Record<StatusFeedback, number> = { novo: 0, em_tratativa: 0, resolvido: 0 };
  list.forEach((f) => { if (f.status in d) d[f.status]++; });
  return d;
}

/** Fração de feedbacks que geraram ao menos uma ação (plano de ação/CAPA). */
export function pctViraramAcao(list: Feedback[], acoes: FeedbackAcao[]): number {
  if (!list.length) return 0;
  const comAcao = new Set(acoes.map((a) => a.feedback_id));
  return list.filter((f) => comAcao.has(f.id)).length / list.length;
}

/** Tempo médio de resolução (dias) dos feedbacks resolvidos com carimbo de data. */
export function tempoMedioResolucaoDias(list: Feedback[]): number {
  const res = list.filter((f) => f.status === 'resolvido' && f.resolvido_em && f.criado_em);
  if (!res.length) return 0;
  const total = res.reduce((s, f) => {
    const dt = (ms(f.resolvido_em) - ms(f.criado_em)) / 86_400_000;
    return s + (Number.isFinite(dt) && dt >= 0 ? dt : 0);
  }, 0);
  return total / res.length;
}

/** Ação está atrasada? (não concluída/cancelada e prazo já passou). */
export function acaoAtrasada(a: FeedbackAcao, now: Date): boolean {
  if (a.status === 'concluida' || a.status === 'cancelada' || !a.prazo) return false;
  return a.prazo < ymd(now);
}
export function acoesAtrasadas(acoes: FeedbackAcao[], now: Date): FeedbackAcao[] {
  return acoes.filter((a) => acaoAtrasada(a, now));
}

/** Ações em aberto (não concluídas/canceladas). */
export function acoesPendentes(acoes: FeedbackAcao[]): FeedbackAcao[] {
  return acoes.filter((a) => a.status !== 'concluida' && a.status !== 'cancelada');
}

/** Está dentro do período selecionado? (`dias = 0` ⇒ tudo). */
export function dentroPeriodo(f: Feedback, dias: number, now: Date): boolean {
  if (!dias) return true;
  const t = ms(f.criado_em);
  if (Number.isNaN(t)) return true;
  return t >= now.getTime() - dias * 86_400_000;
}

/** Média por chave (propriedade/tipo de evento), ordenada por volume desc. */
export function notaPorChave(
  list: Feedback[], key: (f: Feedback) => string | null,
): { chave: string; media: number; n: number }[] {
  const m = new Map<string, Feedback[]>();
  list.forEach((f) => { const k = (key(f) || '—').trim() || '—'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(f); });
  return [...m.entries()]
    .map(([chave, arr]) => ({ chave, media: csat(arr), n: arr.length }))
    .sort((a, b) => b.n - a.n);
}

/** Pode virar avaliação pública? (cliente autorizou, nota alta e ainda não promovido). */
export function podePromover(f: Feedback): boolean {
  return !!f.permite_publicar && Number(f.nota_geral) >= NOTA_MIN_PROMOVER && !f.promovida_avaliacao_id;
}

// ── Export CSV (puro: retorna string; o download/DOM fica na página) ───────────
export function feedbacksToCSV(
  list: Feedback[],
  ctx: { propNome: (id: number | null) => string; eventoNome: (id: string | null) => string; fmtDate: (s: string) => string },
): string {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = [
    'Data', 'Evento', 'Propriedade', 'Autor', 'Canal', 'Nota geral',
    ...CRITERIOS.map((c) => c.label), 'Comentário', 'Pontos positivos', 'Pontos negativos',
    'Permite publicar', 'Status', 'Resposta privada',
  ];
  const body = list.map((f) => [
    esc(f.criado_em ? ctx.fmtDate(f.criado_em) : ''),
    esc(ctx.eventoNome(f.evento_id)),
    esc(ctx.propNome(f.propriedade_id)),
    esc(f.autor_nome || ''),
    esc(CANAL_BY[f.canal]?.label || f.canal),
    f.nota_geral ?? '',
    ...CRITERIOS.map((c) => f.criterios?.[c.v] ?? ''),
    esc(f.comentario || ''), esc(f.pontos_positivos || ''), esc(f.pontos_negativos || ''),
    f.permite_publicar ? 'sim' : 'não',
    esc(STATUS_FB_BY[f.status]?.label || f.status),
    esc(f.resposta_privada || ''),
  ].join(','));
  return '﻿' + header.join(',') + '\n' + body.join('\n');
}
