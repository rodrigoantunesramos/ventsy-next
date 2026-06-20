// Motor PURO de Pesquisas & NPS pós-evento — /painel/pesquisas.
// ─────────────────────────────────────────────────────────────────────────────
// Mede satisfação de forma ESTRUTURADA: construtor de pesquisas customizáveis
// (NPS 0–10 · escala · CSAT · múltipla · texto) disparadas após o evento, com
// foco em MÉTRICA e TENDÊNCIA (NPS). Complementa Feedbacks (qualitativo/tratativa):
// aqui o que importa é o score, a evolução e a segmentação.
//
// Regras de ouro (espelham lib/feedback.ts, lib/comissoes.ts, lib/catering.ts):
// SEM React, SEM Supabase, SEM "R$"/Intl — só tipos, constantes e agregações
// determinísticas e testáveis. A formatação i18n (datas/percentuais) fica em
// lib/format, injetada pelas páginas. Compartilhado por painel + rota pública +
// API + cron.

export { isMissingTable } from '@/lib/dbErrors';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type TipoPesquisa = 'nps' | 'csat' | 'custom';
export type Gatilho = 'manual' | 'pos_evento' | 'dias_apos';
export type TipoPergunta = 'nps' | 'escala' | 'csat' | 'multipla' | 'texto';
export type CategoriaNps = 'promotor' | 'neutro' | 'detrator';

export type Pergunta = {
  id: string;                  // estável dentro da pesquisa (chave em `respostas`)
  tipo: TipoPergunta;
  titulo: string;
  opcoes?: string[];           // só `multipla`
  obrigatoria?: boolean;
};

export type Pesquisa = {
  id: string;
  usuario_id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoPesquisa;
  perguntas: Pergunta[];
  gatilho: Gatilho;
  dias_apos: number | null;    // usado quando gatilho = 'dias_apos'
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type RespostaPesquisa = {
  id: string;
  pesquisa_id: string;
  usuario_id: string;
  evento_id: string | null;
  cliente_id: string | null;
  propriedade_id: number | null;
  autor_nome: string | null;
  autor_contato: string | null;
  respostas: Record<string, unknown>;  // { [perguntaId]: valor }
  nps: number | null;                  // 0–10 da pergunta NPS (null se a pesquisa não tem NPS)
  categoria: CategoriaNps | null;      // derivada do nps no momento da gravação
  comentario: string | null;          // 1º texto preenchido — denormalizado p/ feed/IA
  criado_em: string;
};

// Subconjunto de clientes_eventos usado p/ contexto e disparo automático.
export type EventoLite = {
  id: string;
  cliente_id: string | null;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  email: string | null;
  propriedade_id: number | null;
  criado_em: string;
};

export type PropLite = { id: number; nome: string | null; cidade: string | null; estado: string | null };

// ── Constantes de domínio ─────────────────────────────────────────────────────
// Fronteiras do NPS (padrão de mercado): detrator 0–6 · neutro 7–8 · promotor 9–10.
export const NPS_PROMOTOR_MIN = 9;
export const NPS_NEUTRO_MIN = 7;
export const NPS_MAX = 10;

export const TIPOS_PESQUISA: { v: TipoPesquisa; label: string; desc: string }[] = [
  { v: 'nps', label: 'NPS', desc: 'Mede lealdade (0–10) e classifica promotores/detratores.' },
  { v: 'csat', label: 'Satisfação (CSAT)', desc: 'Satisfação geral por estrelas (1–5) + recomendação.' },
  { v: 'custom', label: 'Personalizada', desc: 'Monte as perguntas do zero.' },
];
export const TIPO_PESQUISA_BY: Record<string, { v: TipoPesquisa; label: string; desc: string }> =
  Object.fromEntries(TIPOS_PESQUISA.map((t) => [t.v, t]));

export const GATILHOS: { v: Gatilho; label: string; desc: string }[] = [
  { v: 'manual', label: 'Manual', desc: 'Você envia o link/QR quando quiser.' },
  { v: 'pos_evento', label: 'Após o evento', desc: 'Dispara automaticamente alguns dias após o evento.' },
  { v: 'dias_apos', label: 'X dias após', desc: 'Dispara um número específico de dias após o evento.' },
];
export const GATILHO_BY: Record<string, { v: Gatilho; label: string; desc: string }> =
  Object.fromEntries(GATILHOS.map((g) => [g.v, g]));

export const GATILHO_PADRAO_DIAS = 2;  // pos_evento sem nº definido

export const TIPOS_PERGUNTA: { v: TipoPergunta; label: string; hint: string }[] = [
  { v: 'nps', label: 'NPS (0–10)', hint: 'Recomendação de 0 a 10.' },
  { v: 'csat', label: 'Satisfação (1–5)', hint: 'Estrelas de satisfação.' },
  { v: 'escala', label: 'Escala (1–5)', hint: 'Avaliação por estrelas.' },
  { v: 'multipla', label: 'Múltipla escolha', hint: 'Uma opção entre várias.' },
  { v: 'texto', label: 'Texto livre', hint: 'Resposta aberta.' },
];
export const TIPO_PERGUNTA_BY: Record<string, { v: TipoPergunta; label: string; hint: string }> =
  Object.fromEntries(TIPOS_PERGUNTA.map((t) => [t.v, t]));

export const CATEGORIAS_NPS: { v: CategoriaNps; label: string; cls: string; dot: string; bar: string }[] = [
  { v: 'promotor', label: 'Promotores', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  { v: 'neutro', label: 'Neutros', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', bar: 'bg-amber-400' },
  { v: 'detrator', label: 'Detratores', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500', bar: 'bg-red-500' },
];
export const CATEGORIA_NPS_BY: Record<string, { v: CategoriaNps; label: string; cls: string; dot: string; bar: string }> =
  Object.fromEntries(CATEGORIAS_NPS.map((c) => [c.v, c]));

export const PERIODOS: { v: number; label: string }[] = [
  { v: 30, label: '30 dias' },
  { v: 90, label: '90 dias' },
  { v: 365, label: '12 meses' },
  { v: 0, label: 'Todo o período' },
];

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

// ── Classificação NPS ─────────────────────────────────────────────────────────
/** Categoria a partir de uma nota NPS (0–10). Valores fora da faixa são clampados. */
export function categoriaNps(n: number): CategoriaNps {
  const v = Math.max(0, Math.min(NPS_MAX, Math.round(Number(n))));
  if (v >= NPS_PROMOTOR_MIN) return 'promotor';
  if (v >= NPS_NEUTRO_MIN) return 'neutro';
  return 'detrator';
}

/** Zona qualitativa do score NPS (−100…100) — rótulo + cor p/ o medidor. */
export function zonaNps(score: number): { label: string; cls: string } {
  if (score >= 75) return { label: 'Excelente', cls: 'text-emerald-600' };
  if (score >= 50) return { label: 'Ótimo', cls: 'text-emerald-600' };
  if (score >= 0) return { label: 'Razoável', cls: 'text-amber-600' };
  return { label: 'Crítico', cls: 'text-red-600' };
}

// ── Construtor: perguntas-padrão e templates ──────────────────────────────────
/** Texto-padrão de uma pergunta nova do tipo informado (o id é injetado fora). */
export function tituloPadrao(tipo: TipoPergunta): string {
  switch (tipo) {
    case 'nps': return 'De 0 a 10, o quanto você recomendaria nosso espaço a um amigo ou colega?';
    case 'csat': return 'Como você avalia sua satisfação geral com o evento?';
    case 'escala': return 'Como você avalia este item?';
    case 'multipla': return 'Selecione uma opção';
    case 'texto': return 'Deixe seu comentário';
  }
}
/** Cria uma pergunta nova com defaults sãos. `id` deve ser único na pesquisa. */
export function novaPergunta(tipo: TipoPergunta, id: string): Pergunta {
  const p: Pergunta = { id, tipo, titulo: tituloPadrao(tipo), obrigatoria: tipo === 'nps' };
  if (tipo === 'multipla') p.opcoes = ['Opção 1', 'Opção 2'];
  return p;
}

/** Conjunto de perguntas inicial por tipo de pesquisa (ids estáveis e semânticos). */
export function templatePerguntas(tipo: TipoPesquisa): Pergunta[] {
  if (tipo === 'csat') {
    return [
      { id: 'q_csat', tipo: 'csat', titulo: 'Como você avalia sua satisfação geral com o evento?', obrigatoria: true },
      { id: 'q_nps', tipo: 'nps', titulo: 'De 0 a 10, o quanto você nos recomendaria?', obrigatoria: true },
      { id: 'q_comentario', tipo: 'texto', titulo: 'O que podemos fazer para melhorar?' },
    ];
  }
  if (tipo === 'custom') {
    return [
      { id: 'q_nps', tipo: 'nps', titulo: tituloPadrao('nps'), obrigatoria: true },
      { id: 'q_comentario', tipo: 'texto', titulo: 'Comentários' },
    ];
  }
  // 'nps'
  return [
    { id: 'q_nps', tipo: 'nps', titulo: tituloPadrao('nps'), obrigatoria: true },
    { id: 'q_motivo', tipo: 'texto', titulo: 'Qual o principal motivo da sua nota?' },
    { id: 'q_melhoria', tipo: 'texto', titulo: 'O que poderíamos fazer para melhorar?' },
  ];
}

/** Título sugerido por tipo (placeholder do construtor). */
export function tituloPesquisaPadrao(tipo: TipoPesquisa): string {
  if (tipo === 'csat') return 'Pesquisa de satisfação';
  if (tipo === 'custom') return 'Nova pesquisa';
  return 'Pesquisa de recomendação (NPS)';
}

// ── Leitura de respostas (jsonb) ──────────────────────────────────────────────
/** A 1ª pergunta NPS da pesquisa (a que alimenta o score). Null se não houver. */
export function perguntaNpsDe(p: Pesquisa | { perguntas: Pergunta[] }): Pergunta | null {
  return p.perguntas.find((q) => q.tipo === 'nps') || null;
}

/** Extrai a nota NPS (0–10) de um conjunto de respostas, dada a pesquisa. */
export function extrairNps(respostas: Record<string, unknown>, p: Pesquisa | { perguntas: Pergunta[] }): number | null {
  const q = perguntaNpsDe(p);
  if (!q) return null;
  const raw = respostas?.[q.id];
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 0 || n > NPS_MAX) return null;
  return n;
}

/** Extrai o 1º comentário de texto não-vazio (denormalizado p/ feed/IA). */
export function extrairComentario(respostas: Record<string, unknown>, p: Pesquisa | { perguntas: Pergunta[] }): string | null {
  for (const q of p.perguntas) {
    if (q.tipo !== 'texto') continue;
    const v = respostas?.[q.id];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// ── Normalização (tolera jsonb/strings vindos do banco) ───────────────────────
export function normalizarPerguntas(raw: unknown): Pergunta[] {
  let arr: unknown[] = [];
  if (typeof raw === 'string') { try { arr = JSON.parse(raw) || []; } catch { arr = []; } }
  else if (Array.isArray(raw)) arr = raw;
  const out: Pergunta[] = [];
  arr.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const tipo = String(o.tipo || 'texto') as TipoPergunta;
    if (!TIPO_PERGUNTA_BY[tipo]) return;
    const id = String(o.id || `q${i}`);
    const titulo = String(o.titulo || tituloPadrao(tipo));
    const q: Pergunta = { id, tipo, titulo, obrigatoria: !!o.obrigatoria };
    if (tipo === 'multipla') {
      const ops = Array.isArray(o.opcoes) ? o.opcoes.map((x) => String(x)).filter(Boolean) : [];
      q.opcoes = ops.length ? ops : ['Opção 1', 'Opção 2'];
    }
    out.push(q);
  });
  return out;
}

export function normalizarRespostas(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') { try { return JSON.parse(raw) || {}; } catch { return {}; } }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

// ── Validação do construtor ───────────────────────────────────────────────────
/** Retorna a 1ª mensagem de erro (ou null se a pesquisa está apta a salvar). */
export function validarPesquisa(p: { titulo: string; perguntas: Pergunta[]; gatilho: Gatilho; dias_apos: number | null }): string | null {
  if (!p.titulo.trim()) return 'Dê um título à pesquisa.';
  if (!p.perguntas.length) return 'Adicione pelo menos uma pergunta.';
  for (const q of p.perguntas) {
    if (!q.titulo.trim()) return 'Toda pergunta precisa de um enunciado.';
    if (q.tipo === 'multipla' && (q.opcoes || []).filter((o) => o.trim()).length < 2) {
      return `A pergunta "${q.titulo}" precisa de pelo menos 2 opções.`;
    }
  }
  if (p.gatilho === 'dias_apos' && (!p.dias_apos || p.dias_apos < 1)) {
    return 'Defina em quantos dias após o evento a pesquisa deve disparar.';
  }
  return null;
}

/** Dias efetivos de disparo de uma pesquisa automática (pos_evento usa o padrão). */
export function diasDisparo(p: { gatilho: Gatilho; dias_apos: number | null }): number | null {
  if (p.gatilho === 'dias_apos') return p.dias_apos && p.dias_apos > 0 ? p.dias_apos : GATILHO_PADRAO_DIAS;
  if (p.gatilho === 'pos_evento') return GATILHO_PADRAO_DIAS;
  return null;  // manual
}

// ── Agregações de NPS ─────────────────────────────────────────────────────────
const catDe = (r: RespostaPesquisa): CategoriaNps | null =>
  r.categoria ?? (r.nps != null ? categoriaNps(r.nps) : null);

/** Contagem por categoria (só respostas com NPS). */
export function distribuicaoNps(list: RespostaPesquisa[]): { promotor: number; neutro: number; detrator: number; total: number } {
  const d = { promotor: 0, neutro: 0, detrator: 0, total: 0 };
  for (const r of list) {
    const c = catDe(r);
    if (!c) continue;
    d[c]++; d.total++;
  }
  return d;
}

/** Score NPS canônico: (%promotores − %detratores), em pontos (−100…100). */
export function npsScore(list: RespostaPesquisa[]): number {
  const d = distribuicaoNps(list);
  if (!d.total) return 0;
  return Math.round(((d.promotor - d.detrator) / d.total) * 100);
}

/** Frações por categoria (0–1) sobre o total com NPS. */
export function pctCategoria(list: RespostaPesquisa[]): { promotor: number; neutro: number; detrator: number } {
  const d = distribuicaoNps(list);
  const t = d.total || 1;
  return { promotor: d.promotor / t, neutro: d.neutro / t, detrator: d.detrator / t };
}

/** Série dos últimos `n` meses: score NPS e volume por mês (ym = 'YYYY-MM'). */
export function serieMensalNps(list: RespostaPesquisa[], now: Date, n = 6): { ym: string; nps: number; n: number }[] {
  const out: { ym: string; nps: number; n: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mes = list.filter((r) => (r.criado_em || '').slice(0, 7) === ym);
    out.push({ ym, nps: npsScore(mes), n: distribuicaoNps(mes).total });
  }
  return out;
}

/** Score da janela atual (`dias`) vs janela anterior de mesmo tamanho. */
export function comparativoNps(
  list: RespostaPesquisa[], dias: number, now: Date,
): { atual: number; anterior: number; nAtual: number; nAnterior: number } {
  const d = dias > 0 ? dias : 90;
  const span = d * 86_400_000;
  const ini = now.getTime() - span;
  const iniAnt = now.getTime() - 2 * span;
  const win = (lo: number, hi: number) =>
    list.filter((r) => { const t = ms(r.criado_em); return !Number.isNaN(t) && t >= lo && t < hi; });
  const atual = win(ini, now.getTime() + 1);
  const anterior = win(iniAnt, ini);
  return {
    atual: npsScore(atual), anterior: npsScore(anterior),
    nAtual: distribuicaoNps(atual).total, nAnterior: distribuicaoNps(anterior).total,
  };
}

/** Score por chave (propriedade/tipo de evento/pesquisa), ordenado por volume desc. */
export function npsPorChave(
  list: RespostaPesquisa[], key: (r: RespostaPesquisa) => string | null,
): { chave: string; nps: number; n: number }[] {
  const m = new Map<string, RespostaPesquisa[]>();
  list.forEach((r) => { const k = (key(r) || '—').trim() || '—'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
  return [...m.entries()]
    .map(([chave, arr]) => ({ chave, nps: npsScore(arr), n: distribuicaoNps(arr).total }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

/** Está dentro do período selecionado? (`dias = 0` ⇒ tudo). */
export function dentroPeriodo(r: RespostaPesquisa, dias: number, now: Date): boolean {
  if (!dias) return true;
  const t = ms(r.criado_em);
  if (Number.isNaN(t)) return true;
  return t >= now.getTime() - dias * 86_400_000;
}

/** Detratores recentes que pedem atenção (alerta/tratativa). */
export function detratoresRecentes(list: RespostaPesquisa[], now: Date, dias = 30): RespostaPesquisa[] {
  return list.filter((r) => catDe(r) === 'detrator' && dentroPeriodo(r, dias, now));
}

/** Comentários não-vazios (mais recentes primeiro) — alimenta nuvem de temas/IA. */
export function comentarios(list: RespostaPesquisa[]): string[] {
  return list
    .filter((r) => r.comentario && r.comentario.trim())
    .map((r) => r.comentario!.trim());
}

/** Mapeia um NPS (0–10) para nota 1–5 (p/ abrir tratativa em Feedbacks). */
export function npsParaNota5(nps: number): number {
  const v = Math.max(0, Math.min(NPS_MAX, Math.round(Number(nps) || 0)));
  return Math.max(1, Math.min(5, Math.round((v / NPS_MAX) * 5) || 1));
}

// ── Export CSV (puro: retorna string; o download/DOM fica na página) ───────────
export function respostasToCSV(
  list: RespostaPesquisa[],
  ctx: {
    pesquisaTitulo: (id: string) => string;
    propNome: (id: number | null) => string;
    eventoNome: (id: string | null) => string;
    fmtDate: (s: string) => string;
  },
): string {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = ['Data', 'Pesquisa', 'Evento', 'Propriedade', 'Autor', 'NPS', 'Categoria', 'Comentário'];
  const body = list.map((r) => [
    esc(r.criado_em ? ctx.fmtDate(r.criado_em) : ''),
    esc(ctx.pesquisaTitulo(r.pesquisa_id)),
    esc(ctx.eventoNome(r.evento_id)),
    esc(ctx.propNome(r.propriedade_id)),
    esc(r.autor_nome || ''),
    r.nps ?? '',
    esc(r.categoria ? CATEGORIA_NPS_BY[r.categoria]?.label || r.categoria : ''),
    esc(r.comentario || ''),
  ].join(','));
  return '﻿' + header.join(',') + '\n' + body.join('\n');
}
