// Motor PURO de Marketing (cockpit de aquisição) — /painel/marketing.
// ─────────────────────────────────────────────────────────────────────────────
// Central de aquisição e presença: de onde vêm os leads, quanto custa cada canal,
// o que converte e a agenda de conteúdo/ações. Espelha as regras de ouro das
// outras engines (lib/campanhas, lib/feedback, lib/reservas): SEM React, SEM
// Supabase, SEM "R$"/Intl — só tipos, constantes e funções determinísticas e
// testáveis. A formatação i18n (moeda/datas/percentuais) fica em lib/format,
// injetada pelas páginas.
//
// Divisão de responsabilidades:
//   • A ATRIBUIÇÃO de origem é feita no painel a partir de `clientes_eventos`
//     (campo `como_conheceu`) com fallback para o `clientes.origem` do cliente
//     vinculado; o painel nos entrega cada lead já normalizado (`LeadLite`).
//   • O GASTO por canal combina o custo mensal recorrente do canal
//     (`marketing_canais.custo_mensal_num`, prorrateado ao período) com o
//     investimento pontual das ações (`marketing_acoes.investimento_num`).
//   • CAC/CPL/ROI/conversão e o funil são calculados aqui (puro) e reusados pela
//     Visão, pela aba Canais e pelo ranking.

// ── Tipos de domínio ──────────────────────────────────────────────────────────
export type CanalTipo = 'organico' | 'pago' | 'parceria' | 'indicacao' | 'outro';
export type TipoAcao = 'post' | 'anuncio' | 'parceria' | 'evento' | 'email';
export type StatusAcao = 'planejado' | 'em_andamento' | 'publicado' | 'cancelado';
export type Periodo = 'mes' | 'trimestre' | 'ano';

// Canal de aquisição (linha editável da aba Canais). `origem_key` é a chave
// canônica usada para casar o canal com a origem registrada no CRM.
export type Canal = {
  id: string;
  usuario_id: string;
  nome: string;
  origem_key: string;          // canônico (ver ORIGENS) — atribuição vs. CRM
  tipo: CanalTipo;
  custo_mensal_num: number;    // custo fixo recorrente do canal (mensal)
  ativo: boolean;
  criado_em: string;
};

// Resultado pontual de uma ação (alcance/cliques/leads gerados) — métricas de
// topo de funil dos posts/anúncios. Não carrega dinheiro cru.
export type ResultadoAcao = { alcance?: number; cliques?: number; leads?: number; obs?: string };

// Ação de marketing (item do calendário): post, anúncio, parceria, evento, email.
export type Acao = {
  id: string;
  usuario_id: string;
  canal_id: string | null;
  titulo: string;
  tipo: TipoAcao;
  data: string;                // YYYY-MM-DD
  status: StatusAcao;
  investimento_num: number;    // investimento pontual da ação
  resultado: ResultadoAcao;
  criado_em: string;
};

// Lead normalizado pelo painel a partir de `clientes_eventos`. A origem já vem
// atribuída (canônica). `data` é a entrada no funil (criado_em) — usada p/ a
// janela do período (coorte de aquisição).
export type LeadLite = {
  id: string;
  origem: string;              // canônico (normalizeOrigem)
  status: string;              // status cru do CRM (mapeado p/ etapa do funil)
  valor: number;               // valor_total_num (receita potencial/contratada)
  data: string | null;        // criado_em
};

// ── Origens canônicas (espelha /painel/clientes ORIGENS) ───────────────────────
export const ORIGENS = ['indicacao', 'site', 'instagram', 'google', 'facebook', 'whatsapp', 'evento', 'outro'] as const;
export type Origem = (typeof ORIGENS)[number];

export const ORIGEM_LABEL: Record<string, string> = {
  indicacao: 'Indicação', site: 'Site', instagram: 'Instagram', google: 'Google',
  facebook: 'Facebook', whatsapp: 'WhatsApp', evento: 'Evento/Feira', outro: 'Outro',
};

// Cor por origem (paleta do design system) — usada em donut/legenda.
export const ORIGEM_COR: Record<string, string> = {
  indicacao: '#10b981', site: '#1a73e8', instagram: '#ec4899', google: '#f59e0b',
  facebook: '#3b5998', whatsapp: '#25d366', evento: '#8b5cf6', outro: '#94a3b8',
};

/** Normaliza texto livre (clientes_eventos.como_conheceu / clientes.origem) para
 *  uma origem canônica. Tolerante a sinônimos e idioma; cai em 'outro'. */
export function normalizeOrigem(raw: string | null | undefined): Origem {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return 'outro';
  if (/(indica|refer|amig|boca a boca|word.?of.?mouth)/.test(s)) return 'indicacao';
  if (/(instagram|insta|\big\b|reels|stories)/.test(s)) return 'instagram';
  if (/(facebook|\bface\b|\bfb\b|meta)/.test(s)) return 'facebook';
  if (/(whats|\bwpp\b|\bzap\b|whatsapp)/.test(s)) return 'whatsapp';
  if (/(google|adwords|\bsem\b|search|busca|pesquisa)/.test(s)) return 'google';
  if (/(feira|evento|expo|stand|estande|networking)/.test(s)) return 'evento';
  if (/(site|website|portal|web|orgânic|organic|blog)/.test(s)) return 'site';
  return (ORIGENS as readonly string[]).includes(s) ? (s as Origem) : 'outro';
}

// ── Catálogos de UI (label/cor/ícone) ──────────────────────────────────────────
export const CANAL_TIPOS: { v: CanalTipo; label: string }[] = [
  { v: 'organico', label: 'Orgânico' },
  { v: 'pago', label: 'Mídia paga' },
  { v: 'parceria', label: 'Parceria' },
  { v: 'indicacao', label: 'Indicação' },
  { v: 'outro', label: 'Outro' },
];

export const TIPOS_ACAO: { v: TipoAcao; label: string; icon: string; cls: string }[] = [
  { v: 'post', label: 'Post', icon: '📷', cls: 'bg-pink-50 text-pink-700' },
  { v: 'anuncio', label: 'Anúncio', icon: '📣', cls: 'bg-amber-50 text-amber-700' },
  { v: 'parceria', label: 'Parceria', icon: '🤝', cls: 'bg-violet-50 text-violet-700' },
  { v: 'evento', label: 'Evento/Feira', icon: '🎪', cls: 'bg-blue-50 text-blue-700' },
  { v: 'email', label: 'E-mail', icon: '✉️', cls: 'bg-emerald-50 text-emerald-700' },
];
export const TIPO_ACAO_BY: Record<TipoAcao, (typeof TIPOS_ACAO)[number]> =
  Object.fromEntries(TIPOS_ACAO.map((t) => [t.v, t])) as Record<TipoAcao, (typeof TIPOS_ACAO)[number]>;

export const STATUS_ACAO: { v: StatusAcao; label: string; cls: string; dot: string }[] = [
  { v: 'planejado', label: 'Planejado', cls: 'bg-black/[0.05] text-ink-muted', dot: 'bg-ink-muted' },
  { v: 'em_andamento', label: 'Em andamento', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { v: 'publicado', label: 'Publicado', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'cancelado', label: 'Cancelado', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
];
export const STATUS_ACAO_BY: Record<StatusAcao, (typeof STATUS_ACAO)[number]> =
  Object.fromEntries(STATUS_ACAO.map((s) => [s.v, s])) as Record<StatusAcao, (typeof STATUS_ACAO)[number]>;

// ── Helpers genéricos ───────────────────────────────────────────────────────────
function taxa(num: number, den: number): number { return den > 0 ? num / den : 0; }
/** Razão receita÷investimento etc.; null quando o denominador é zero (n/d). */
function razaoOuNull(num: number, den: number): number | null { return den > 0 ? num / den : null; }
function norm(s: string | null | undefined): string { return (s || '').trim().toLowerCase(); }
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function ymKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

/** Erro de tabela ausente (mesma checagem das demais engines). */
export function isMissingTable(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01');
}

// ── Período (espelha o financeiro) ──────────────────────────────────────────────
/** Nº de meses do período — usado para prorratear o custo mensal dos canais. */
export function mesesNoPeriodo(p: Periodo): number {
  return p === 'ano' ? 12 : p === 'trimestre' ? 3 : 1;
}
/** Intervalo [início, fim] em YYYY-MM-DD do período corrente. */
export function periodoRange(p: Periodo, now: Date): [string, string] {
  const y = now.getFullYear(), m = now.getMonth();
  if (p === 'ano') return [`${y}-01-01`, `${y}-12-31`];
  if (p === 'trimestre') return [ymd(new Date(y, m - 2, 1)), ymd(new Date(y, m + 1, 0))];
  return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
}
/** A data (YYYY-MM-DD ou ISO) cai dentro de [ini, fim]? */
export function dentroDoPeriodo(data: string | null | undefined, ini: string, fim: string): boolean {
  if (!data) return false;
  const d = data.slice(0, 10);
  return d >= ini && d <= fim;
}

// ── Funil de aquisição (do CRM) ─────────────────────────────────────────────────
// Mapeia o status cru do lead (clientes_eventos.status) para uma POSIÇÃO no funil
// de aquisição. O funil é CUMULATIVO: quem chegou a "fechado" também passou por
// lead/qualificado/proposta. 'perdido'/'recontactar' entraram como lead (topo),
// mas não progridem.
export type EtapaFunil = 'lead' | 'qualificado' | 'proposta' | 'fechado';
export const FUNIL_ETAPAS: { key: EtapaFunil; label: string }[] = [
  { key: 'lead', label: 'Leads' },
  { key: 'qualificado', label: 'Qualificados' },
  { key: 'proposta', label: 'Em proposta' },
  { key: 'fechado', label: 'Fechados' },
];
const STATUS_RANK: Record<string, number> = {
  lead: 1, consultada: 1, perdido: 1, recontactar: 1,
  visita: 2,
  negociacao: 3, reserva: 3,
  contratado: 4, briefing: 4, pronto: 4, montagem: 4, finalizado: 4, pos: 4,
};
/** Rank do funil (1..4) para um status; 0 = fora do funil. */
export function rankStatus(status: string | null | undefined): number {
  return STATUS_RANK[norm(status)] ?? 1; // status desconhecido conta como lead (topo)
}
/** Um lead chegou (ao menos) à etapa de ganho (contratado/finalizado)? */
export function isGanho(status: string | null | undefined): boolean {
  return rankStatus(status) >= 4;
}

export type FunilSaida = {
  etapas: { key: EtapaFunil; label: string; n: number; pct: number; convDoAnterior: number }[];
  gargalo: { de: string; para: string; conv: number } | null;
};
/** Funil cumulativo + gargalo (transição com menor conversão). `pct` é relativo
 *  ao topo (leads). `convDoAnterior` é a conversão da etapa anterior p/ esta. */
export function funilAquisicao(leads: LeadLite[]): FunilSaida {
  const ranks = leads.map((l) => rankStatus(l.status));
  const cont = (min: number) => ranks.filter((r) => r >= min).length;
  const ns: Record<EtapaFunil, number> = { lead: cont(1), qualificado: cont(2), proposta: cont(3), fechado: cont(4) };
  const topo = ns.lead || 0;
  const etapas = FUNIL_ETAPAS.map((e, i) => {
    const n = ns[e.key];
    const prev = i === 0 ? n : ns[FUNIL_ETAPAS[i - 1].key];
    return { key: e.key, label: e.label, n, pct: taxa(n, topo), convDoAnterior: i === 0 ? 1 : taxa(n, prev) };
  });
  let gargalo: FunilSaida['gargalo'] = null;
  for (let i = 1; i < etapas.length; i++) {
    if (etapas[i - 1].n === 0) continue;
    const conv = etapas[i].convDoAnterior;
    if (!gargalo || conv < gargalo.conv) gargalo = { de: etapas[i - 1].label, para: etapas[i].label, conv };
  }
  return { etapas, gargalo };
}

// ── Métricas por canal (atribuição × gasto) ─────────────────────────────────────
export type CanalMetric = {
  origem_key: string;
  nome: string;
  tipo: CanalTipo | null;
  configurado: boolean;        // existe linha em marketing_canais para esta origem?
  ativo: boolean;
  leads: number;
  qualificados: number;
  fechados: number;
  receita: number;             // Σ valor dos leads que fecharam (receita atribuída)
  custoCanal: number;          // custo mensal prorrateado ao período
  investimentoAcoes: number;   // Σ investimento das ações do período
  investimento: number;        // custoCanal + investimentoAcoes
  cpl: number | null;          // investimento ÷ leads (custo por lead)
  cac: number | null;          // investimento ÷ fechados (custo de aquisição)
  conversao: number;           // fechados ÷ leads
  roi: number | null;          // receita ÷ investimento (múltiplo)
  retorno: number;             // receita − investimento (lucro)
};

/** Agrega leads + custo de canal + investimento de ações por origem canônica.
 *  - `leads` já filtrados ao período pela página (coorte de aquisição).
 *  - `acoes` já filtradas ao período pela página.
 *  - `mesesPeriodo` prorrateia o custo mensal recorrente de cada canal.
 *  Retorna a UNIÃO de origens (canais cadastrados ∪ origens vistas no CRM ∪
 *  canais com ações), ordenada por receita atribuída desc (ranking). */
export function metricasPorCanal(
  canais: Canal[], acoes: Acao[], leads: LeadLite[], mesesPeriodo: number,
): CanalMetric[] {
  const canalById = new Map(canais.map((c) => [c.id, c]));
  // bucket por origem
  type B = { leads: number; qualificados: number; fechados: number; receita: number; investAcoes: number };
  const buckets = new Map<string, B>();
  const get = (k: string): B => {
    let b = buckets.get(k);
    if (!b) { b = { leads: 0, qualificados: 0, fechados: 0, receita: 0, investAcoes: 0 }; buckets.set(k, b); }
    return b;
  };

  for (const l of leads) {
    const b = get(l.origem || 'outro');
    const r = rankStatus(l.status);
    b.leads++;
    if (r >= 2) b.qualificados++;
    if (r >= 4) { b.fechados++; b.receita += l.valor || 0; }
  }
  for (const a of acoes) {
    const canal = a.canal_id ? canalById.get(a.canal_id) : undefined;
    const key = canal ? canal.origem_key : 'outro';
    get(key).investAcoes += a.investimento_num || 0;
  }
  // custo de canal (prorrateado) — garante a presença de canais sem leads/ações
  const canalPorOrigem = new Map<string, Canal>();
  for (const c of canais) { if (!canalPorOrigem.has(c.origem_key)) canalPorOrigem.set(c.origem_key, c); get(c.origem_key); }

  const out: CanalMetric[] = [];
  for (const [origem_key, b] of buckets) {
    const canal = canalPorOrigem.get(origem_key);
    const custoCanal = canal && canal.ativo ? (canal.custo_mensal_num || 0) * mesesPeriodo : 0;
    const investimento = custoCanal + b.investAcoes;
    out.push({
      origem_key,
      nome: canal?.nome || ORIGEM_LABEL[origem_key] || origem_key,
      tipo: canal?.tipo ?? null,
      configurado: !!canal,
      ativo: canal ? canal.ativo : true,
      leads: b.leads, qualificados: b.qualificados, fechados: b.fechados, receita: b.receita,
      custoCanal, investimentoAcoes: b.investAcoes, investimento,
      cpl: razaoOuNull(investimento, b.leads),
      cac: razaoOuNull(investimento, b.fechados),
      conversao: taxa(b.fechados, b.leads),
      roi: razaoOuNull(b.receita, investimento),
      retorno: b.receita - investimento,
    });
  }
  return out.sort((a, b) => b.receita - a.receita || b.leads - a.leads);
}

// ── Resumo agregado (KPIs da Visão) ─────────────────────────────────────────────
export type ResumoMarketing = {
  leads: number;
  fechados: number;
  receita: number;
  investimento: number;
  cac: number | null;
  cpl: number | null;
  conversao: number;
  roi: number | null;
  retorno: number;
};
export function resumoMarketing(metrics: CanalMetric[]): ResumoMarketing {
  const s = metrics.reduce(
    (acc, m) => {
      acc.leads += m.leads; acc.fechados += m.fechados; acc.receita += m.receita; acc.investimento += m.investimento;
      return acc;
    },
    { leads: 0, fechados: 0, receita: 0, investimento: 0 },
  );
  return {
    ...s,
    cac: razaoOuNull(s.investimento, s.fechados),
    cpl: razaoOuNull(s.investimento, s.leads),
    conversao: taxa(s.fechados, s.leads),
    roi: razaoOuNull(s.receita, s.investimento),
    retorno: s.receita - s.investimento,
  };
}

/** Distribuição de leads por origem (donut da Visão), ordenada desc. */
export function leadsPorOrigem(leads: LeadLite[]): { origem: string; label: string; cor: string; n: number }[] {
  const m = new Map<string, number>();
  for (const l of leads) m.set(l.origem || 'outro', (m.get(l.origem || 'outro') || 0) + 1);
  return [...m.entries()]
    .map(([origem, n]) => ({ origem, label: ORIGEM_LABEL[origem] || origem, cor: ORIGEM_COR[origem] || ORIGEM_COR.outro, n }))
    .sort((a, b) => b.n - a.n);
}

/** Série mensal de leads (mini-gráfico). Conta leads por mês de criação. */
export function serieLeadsMensal(leads: LeadLite[], now: Date, meses = 6): { ym: string; n: number }[] {
  const out: { ym: string; n: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) out.push({ ym: ymKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), n: 0 });
  const idx = new Map(out.map((o, i) => [o.ym, i]));
  for (const l of leads) {
    if (!l.data) continue;
    const i = idx.get(l.data.slice(0, 7));
    if (i != null) out[i].n++;
  }
  return out;
}

// ── Calendário (Agenda de conteúdo/ações) ───────────────────────────────────────
/** Grade de 6 semanas (semana começa no domingo) cobrindo o mês `mes` (0–11) de
 *  `ano`. Cada célula traz o YYYY-MM-DD e se pertence ao mês corrente. */
export function gradeDoMes(ano: number, mes: number): { ymd: string; dia: number; mesAtual: boolean }[] {
  const primeiro = new Date(ano, mes, 1);
  const start = new Date(ano, mes, 1 - primeiro.getDay()); // recua até domingo
  const out: { ymd: string; dia: number; mesAtual: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push({ ymd: ymd(d), dia: d.getDate(), mesAtual: d.getMonth() === mes });
  }
  return out;
}
/** Agrupa ações por dia (YYYY-MM-DD). */
export function acoesPorDia(acoes: Acao[]): Map<string, Acao[]> {
  const m = new Map<string, Acao[]>();
  for (const a of acoes) {
    const k = (a.data || '').slice(0, 10);
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(a); else m.set(k, [a]);
  }
  return m;
}

// ── UTM builder + utilidades de divulgação ──────────────────────────────────────
export type UtmParams = { source: string; medium: string; campaign?: string; term?: string; content?: string };
/** Monta uma URL com parâmetros UTM, preservando a query/hash existentes (mas
 *  substituindo UTMs antigas) e normalizando source/medium (minúsculo, "_" no
 *  lugar de espaço). Tudo é codificado p/ URL. Puro e testável. */
export function buildUTM(base: string, p: UtmParams): string {
  const raw = (base || '').trim();
  if (!raw) return '';
  const hashAt = raw.indexOf('#');
  const hash = hashAt >= 0 ? raw.slice(hashAt) : '';
  const semHash = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
  const qAt = semHash.indexOf('?');
  const path = qAt >= 0 ? semHash.slice(0, qAt) : semHash;
  const existing = qAt >= 0 ? semHash.slice(qAt + 1) : '';
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');

  // Mantém os parâmetros existentes que NÃO são utm_* (não duplica nem conflita).
  const pairs: [string, string][] = [];
  if (existing) {
    for (const part of existing.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const k = eq >= 0 ? part.slice(0, eq) : part;
      const v = eq >= 0 ? part.slice(eq + 1) : '';
      if (!k.startsWith('utm_')) pairs.push([k, v]);
    }
  }
  const push = (k: string, v: string | undefined, asSlug = false) => {
    const val = (v || '').trim();
    if (val) pairs.push([k, encodeURIComponent(asSlug ? slug(val) : val)]);
  };
  push('utm_source', p.source, true);
  push('utm_medium', p.medium, true);
  push('utm_campaign', p.campaign);
  push('utm_term', p.term);
  push('utm_content', p.content);
  const qs = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  return `${path}${qs ? '?' + qs : ''}${hash}`;
}

// ── Validação ───────────────────────────────────────────────────────────────────
export function validarCanal(c: Pick<Canal, 'nome' | 'custo_mensal_num'>): string[] {
  const erros: string[] = [];
  if (!c.nome.trim()) erros.push('Dê um nome ao canal.');
  if (c.custo_mensal_num < 0) erros.push('O custo mensal não pode ser negativo.');
  return erros;
}
export function validarAcao(a: Pick<Acao, 'titulo' | 'data' | 'investimento_num'>): string[] {
  const erros: string[] = [];
  if (!a.titulo.trim()) erros.push('Dê um título à ação.');
  if (!a.data) erros.push('Escolha uma data.');
  if (a.investimento_num < 0) erros.push('O investimento não pode ser negativo.');
  return erros;
}

// ── Export CSV (puro: retorna string; o download/DOM fica na página) ─────────────
export function canaisToCSV(
  metrics: CanalMetric[],
  fmtMoney: (n: number) => string,
  fmtPct: (f: number) => string,
): string {
  const header = ['Canal', 'Tipo', 'Leads', 'Qualificados', 'Fechados', 'Conversão', 'Investimento', 'Receita atribuída', 'CPL', 'CAC', 'ROI', 'Retorno'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const tipoLabel = (t: CanalTipo | null) => (t ? CANAL_TIPOS.find((x) => x.v === t)?.label || t : '—');
  const rows = metrics.map((m) => [
    esc(m.nome), esc(tipoLabel(m.tipo)), m.leads, m.qualificados, m.fechados, esc(fmtPct(m.conversao)),
    esc(fmtMoney(m.investimento)), esc(fmtMoney(m.receita)),
    esc(m.cpl == null ? '—' : fmtMoney(m.cpl)), esc(m.cac == null ? '—' : fmtMoney(m.cac)),
    esc(m.roi == null ? '—' : `${m.roi.toFixed(1)}x`), esc(fmtMoney(m.retorno)),
  ].join(','));
  return '﻿' + header.join(',') + '\n' + rows.join('\n');
}
