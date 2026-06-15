// Motor PURO de Campanhas (disparo em massa) — /painel/campanhas.
// ─────────────────────────────────────────────────────────────────────────────
// Cria e dispara mensagens em massa para SEGMENTOS de clientes (e-mail/WhatsApp),
// com templates, agendamento e métricas. Espelha as regras de ouro das outras
// engines (lib/feedback, lib/comissoes, lib/reservas): SEM React, SEM Supabase,
// SEM "R$"/Intl — só tipos, constantes e funções determinísticas e testáveis. A
// formatação i18n (datas/percentuais) fica em lib/format, injetada pelas páginas.
//
// Divisão de responsabilidades:
//   • A SEGMENTAÇÃO RFM mora em app/(proprietario)/painel/clientes/_lib (Campeão,
//     Fiel, …). O painel calcula o rótulo de cada cliente e nos entrega um
//     `ClienteAlvo` já normalizado — aqui só FILTRAMOS por esse rótulo + atributos.
//   • A audiência é RESOLVIDA no painel (tem os clientes + RFM) e MATERIALIZADA em
//     `campanhas_envios` ao enviar/agendar. O servidor (API/cron) só processa a
//     fila — não recomputa segmento. Por isso o motor é compartilhado por painel,
//     API de envio e cron.

export { isMissingTable } from '@/lib/dbErrors';

// ── Tipos de domínio ──────────────────────────────────────────────────────────
export type Canal = 'email' | 'whatsapp' | 'sms';
export type StatusCampanha = 'rascunho' | 'agendada' | 'enviando' | 'enviada' | 'pausada';
export type StatusEnvio = 'fila' | 'enviado' | 'entregue' | 'aberto' | 'clicado' | 'falha' | 'descadastrado';

// Rótulo RFM (mesma união de strings de clientes/_lib — compatível por valor).
export type SegmentoRFM = 'campeao' | 'fiel' | 'novo' | 'em_risco' | 'perdido' | 'lead';

export type Campanha = {
  id: string;
  usuario_id: string;
  nome: string;
  canal: Canal;
  assunto: string | null;
  corpo: string;                       // texto/HTML com variáveis {{nome}} {{evento}} {{empresa}}
  segmento: SegmentoFiltro;            // filtros do público
  agendada_para: string | null;
  status: StatusCampanha;
  enviada_em: string | null;
  n_total: number;
  n_enviados: number;
  n_entregues: number;
  n_abertos: number;
  n_clicados: number;
  n_falhas: number;
  n_descadastros: number;
  criado_em: string;
  atualizado_em: string;
};

export type Envio = {
  id: string;
  campanha_id: string;
  usuario_id: string;
  cliente_id: string | null;
  contato: string;
  nome: string | null;
  vars: Record<string, string>;
  status: StatusEnvio;
  enviado_em: string | null;
  aberto_em: string | null;
  clicado_em: string | null;
  erro: string | null;
  criado_em: string;
};

export type Descadastro = {
  id: string;
  usuario_id: string;
  cliente_id: string | null;
  contato: string;
  canal: Canal;
  criado_em: string;
};

// Filtros do público — todas as dimensões são AND entre si; dentro de cada lista
// o critério é OR (ex.: origens:['site','indicacao'] = site OU indicação).
export type SegmentoFiltro = {
  segmentos?: SegmentoRFM[];      // rótulos RFM
  origens?: string[];             // clientes.origem
  cidades?: string[];             // clientes.cidade
  tags?: string[];                // clientes.tags (qualquer)
  tiposEvento?: string[];         // tipos de evento já contratados (qualquer)
  vip?: boolean;                  // somente VIP
  inativo90?: boolean;            // somente inativos (90d+ sem comprar, RFM)
  aniversariantesMes?: boolean;   // aniversário no mês corrente
};

// Cliente normalizado pelo painel (já com RFM resolvido) para o motor filtrar.
export type ClienteAlvo = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  telefone: string | null;
  cidade: string | null;
  origem: string | null;
  tags: string[];
  aniversario: string | null;     // YYYY-MM-DD
  segmento: SegmentoRFM;
  tiposEvento: string[];          // tipos de evento contratados
  inativo: boolean;               // RFM: sem evento futuro e >90d sem atividade
  nEventos: number;
  vip: boolean;
  proximoEvento: string | null;   // nome/tipo do próximo evento (variável {{evento}})
};

// ── Catálogos de UI (label/cor) ───────────────────────────────────────────────
export const CANAIS: { v: Canal; label: string; icon: string }[] = [
  { v: 'email', label: 'E-mail', icon: '✉️' },
  { v: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { v: 'sms', label: 'SMS', icon: '📱' },
];
export const CANAL_BY: Record<Canal, { label: string; icon: string }> =
  Object.fromEntries(CANAIS.map((c) => [c.v, { label: c.label, icon: c.icon }])) as Record<Canal, { label: string; icon: string }>;

export const STATUS_CAMPANHA: { v: StatusCampanha; label: string; cls: string; dot: string }[] = [
  { v: 'rascunho', label: 'Rascunho', cls: 'bg-black/[0.05] text-ink-muted', dot: 'bg-ink-muted' },
  { v: 'agendada', label: 'Agendada', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { v: 'enviando', label: 'Enviando', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { v: 'enviada', label: 'Enviada', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'pausada', label: 'Pausada', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
];
export const STATUS_CAMPANHA_BY: Record<StatusCampanha, (typeof STATUS_CAMPANHA)[number]> =
  Object.fromEntries(STATUS_CAMPANHA.map((s) => [s.v, s])) as Record<StatusCampanha, (typeof STATUS_CAMPANHA)[number]>;

// Variáveis reconhecidas no corpo/assunto (chips do editor).
export const VARIAVEIS: { k: string; label: string; exemplo: string }[] = [
  { k: 'nome', label: 'Nome do cliente', exemplo: 'Maria' },
  { k: 'evento', label: 'Evento', exemplo: 'Casamento' },
  { k: 'empresa', label: 'Sua empresa', exemplo: 'Espaço Villa' },
];

// ── Templates (biblioteca) ────────────────────────────────────────────────────
export type Template = { id: string; nome: string; categoria: string; assunto: string; corpo: string };
export const TEMPLATES: Template[] = [
  {
    id: 'boas-vindas', nome: 'Boas-vindas', categoria: 'Relacionamento',
    assunto: 'Que bom ter você por aqui, {{nome}}! 🎉',
    corpo: 'Olá {{nome}},\n\nObrigado por escolher a {{empresa}}. Estamos à disposição para tornar o seu evento inesquecível.\n\nQualquer dúvida, é só responder esta mensagem.\n\nAbraços,\nEquipe {{empresa}}',
  },
  {
    id: 'pos-evento', nome: 'Pós-evento', categoria: 'Relacionamento',
    assunto: 'Como foi o seu {{evento}}, {{nome}}?',
    corpo: 'Oi {{nome}},\n\nFoi uma alegria receber você na {{empresa}}! Esperamos que o {{evento}} tenha sido tudo o que você imaginou.\n\nSe puder, conte para a gente como foi — sua opinião nos ajuda a melhorar.\n\nCom carinho,\n{{empresa}}',
  },
  {
    id: 'reativacao', nome: 'Reativação', categoria: 'Vendas',
    assunto: 'Sentimos sua falta, {{nome}} 💜',
    corpo: 'Olá {{nome}},\n\nFaz um tempo que não conversamos! Estamos com novidades na {{empresa}} e adoraríamos receber você de novo.\n\nQue tal agendar uma visita sem compromisso?\n\nEstamos te esperando,\n{{empresa}}',
  },
  {
    id: 'promocao', nome: 'Promoção sazonal', categoria: 'Vendas',
    assunto: 'Datas especiais com condição exclusiva — {{empresa}}',
    corpo: 'Oi {{nome}},\n\nAbrimos uma janela com condições especiais para as próximas datas na {{empresa}}.\n\nAs agendas mais procuradas costumam fechar rápido — responda esta mensagem para garantir a sua.\n\nAté breve,\n{{empresa}}',
  },
  {
    id: 'aniversario', nome: 'Aniversário', categoria: 'Relacionamento',
    assunto: 'Feliz aniversário, {{nome}}! 🥳',
    corpo: 'Olá {{nome}},\n\nToda a equipe da {{empresa}} deseja a você um feliz aniversário! Que seja um ano cheio de bons momentos para celebrar.\n\nUm abraço,\n{{empresa}}',
  },
  {
    id: 'indique', nome: 'Indique e ganhe', categoria: 'Vendas',
    assunto: 'Indique a {{empresa}} e seja recompensado, {{nome}}',
    corpo: 'Oi {{nome}},\n\nConhece alguém com um evento à vista? Indique a {{empresa}} e aproveite um benefício especial a cada indicação que fechar conosco.\n\nÉ só responder com o contato — cuidamos do resto.\n\nObrigado pela confiança,\n{{empresa}}',
  },
];

// ── Limites de envio por plano (Pro+) ─────────────────────────────────────────
// Envios contam por mês corrente. 'basico' não envia (só monta/pré-visualiza).
export const LIMITES_PLANO: Record<string, number> = { basico: 0, pro: 2000, ultra: 20000 };
export function limiteDoPlano(plano: string | null | undefined): number {
  return LIMITES_PLANO[(plano || 'basico').toLowerCase()] ?? 0;
}

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export function emailValido(s: string | null | undefined): boolean {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function ymKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function norm(s: string | null | undefined): string { return (s || '').trim().toLowerCase(); }
function intersecta(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const set = new Set(a.map(norm));
  return b.some((x) => set.has(norm(x)));
}

/** Link wa.me com prefixo BR (≤11 dígitos ganham '55') e texto opcional. */
export function waLink(contato: string | null | undefined, texto?: string): string | null {
  const d = soDigitos(contato);
  if (!d) return null;
  const fone = d.length <= 11 ? '55' + d : d;
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return `https://wa.me/${fone}${q}`;
}

// ── Interpolação de variáveis {{chave}} ───────────────────────────────────────
// Substitui {{nome}}, {{evento}}, {{empresa}}, … por vars[chave]. Tolerante a
// espaços ({{ nome }}) e case-insensitive. Variáveis sem valor viram string vazia,
// nunca deixam "{{x}}" cru na mensagem enviada.
export function interpolar(template: string | null | undefined, vars: Record<string, string | null | undefined>): string {
  if (!template) return '';
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) lower[k.toLowerCase()] = v == null ? '' : String(v);
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) => lower[k.toLowerCase()] ?? '');
}

/** Variáveis snapshot de um alvo, para gravar no envio e interpolar depois. */
export function varsDoAlvo(a: ClienteAlvo, empresa: string): Record<string, string> {
  return {
    nome: (a.nome || '').trim().split(/\s+/)[0] || a.nome || '',
    evento: a.proximoEvento || '',
    empresa: empresa || '',
  };
}

// ── Contato e opt-out ─────────────────────────────────────────────────────────
/** Contato do alvo para o canal (e-mail válido, ou dígitos do WhatsApp/telefone). */
export function contatoDoAlvo(a: ClienteAlvo, canal: Canal): string | null {
  if (canal === 'email') return emailValido(a.email) ? a.email!.trim().toLowerCase() : null;
  const d = soDigitos(a.whatsapp) || soDigitos(a.telefone);
  return d || null;
}
/** Chave canônica de opt-out (canal+contato normalizado). */
export function chaveDescadastro(contato: string, canal: Canal): string {
  return `${canal}:${canal === 'email' ? contato.trim().toLowerCase() : soDigitos(contato)}`;
}

// ── Filtro de segmento ────────────────────────────────────────────────────────
export function segmentoVazio(f: SegmentoFiltro): boolean {
  return !(
    f.segmentos?.length || f.origens?.length || f.cidades?.length || f.tags?.length ||
    f.tiposEvento?.length || f.vip || f.inativo90 || f.aniversariantesMes
  );
}

export function matchSegmento(a: ClienteAlvo, f: SegmentoFiltro, now: Date): boolean {
  if (f.segmentos?.length && !f.segmentos.includes(a.segmento)) return false;
  if (f.origens?.length && !f.origens.map(norm).includes(norm(a.origem))) return false;
  if (f.cidades?.length && !f.cidades.map(norm).includes(norm(a.cidade))) return false;
  if (f.tags?.length && !intersecta(a.tags, f.tags)) return false;
  if (f.tiposEvento?.length && !intersecta(a.tiposEvento, f.tiposEvento)) return false;
  if (f.vip && !a.vip) return false;
  if (f.inativo90 && !a.inativo) return false;
  if (f.aniversariantesMes) {
    if (!a.aniversario) return false;
    const m = Number(a.aniversario.slice(5, 7));
    if (m !== now.getMonth() + 1) return false;
  }
  return true;
}

// Resultado da resolução do público — contagem ao vivo e fila a materializar.
export type PublicoResolvido = {
  elegiveis: { alvo: ClienteAlvo; contato: string }[];  // batem no filtro, têm contato e não fizeram opt-out
  totalNoSegmento: number;     // quantos batem no filtro (independente de contato/opt-out)
  semContato: number;          // batem mas não têm contato válido p/ o canal
  descadastrados: number;      // batem e têm contato, mas pediram opt-out
};

/** Resolve o público de uma campanha: filtra por segmento, exige contato do canal
 *  e remove quem fez opt-out. Base tanto da contagem ao vivo quanto da fila. */
export function resolverPublico(
  alvos: ClienteAlvo[], f: SegmentoFiltro, descadastros: Descadastro[], canal: Canal, now: Date,
): PublicoResolvido {
  const optOut = new Set(
    descadastros.filter((d) => d.canal === canal).map((d) => chaveDescadastro(d.contato, canal)),
  );
  const elegiveis: { alvo: ClienteAlvo; contato: string }[] = [];
  let totalNoSegmento = 0, semContato = 0, descadastrados = 0;
  for (const a of alvos) {
    if (!matchSegmento(a, f, now)) continue;
    totalNoSegmento++;
    const contato = contatoDoAlvo(a, canal);
    if (!contato) { semContato++; continue; }
    if (optOut.has(chaveDescadastro(contato, canal))) { descadastrados++; continue; }
    elegiveis.push({ alvo: a, contato });
  }
  return { elegiveis, totalNoSegmento, semContato, descadastrados };
}

// ── Limite do plano (mês corrente) ────────────────────────────────────────────
/** Total já ENVIADO no mês corrente (Σ n_enviados das campanhas do mês). */
export function enviadasNoMes(campanhas: Campanha[], now: Date): number {
  const ym = ymKey(now);
  return campanhas.reduce((s, c) => {
    const ref = c.enviada_em || c.criado_em;
    return ref && ref.slice(0, 7) === ym ? s + (c.n_enviados || 0) : s;
  }, 0);
}

export type LimiteInfo = { limite: number; usado: number; restante: number; ilimitado: boolean };
export function limiteInfo(plano: string, campanhas: Campanha[], now: Date): LimiteInfo {
  const limite = limiteDoPlano(plano);
  const usado = enviadasNoMes(campanhas, now);
  return { limite, usado, restante: Math.max(0, limite - usado), ilimitado: false };
}

/** Pode enviar `qtd` agora? Retorna o que falta caso estoure o limite do mês. */
export function podeEnviarQtd(
  plano: string, campanhas: Campanha[], now: Date, qtd: number,
): { ok: boolean; restante: number; limite: number; permitido: number } {
  const { limite, restante } = limiteInfo(plano, campanhas, now);
  return { ok: qtd <= restante, restante, limite, permitido: Math.min(qtd, restante) };
}

// ── Métricas de campanha (a partir dos contadores de rollup) ──────────────────
function taxa(num: number, den: number): number { return den > 0 ? num / den : 0; }
export function taxaEntrega(c: Campanha): number { return taxa(c.n_entregues, c.n_enviados); }
export function taxaAbertura(c: Campanha): number { return taxa(c.n_abertos, c.n_entregues || c.n_enviados); }
export function taxaClique(c: Campanha): number { return taxa(c.n_clicados, c.n_abertos || c.n_entregues || c.n_enviados); }
export function taxaCliqueEnvio(c: Campanha): number { return taxa(c.n_clicados, c.n_enviados); }
export function taxaFalha(c: Campanha): number { return taxa(c.n_falhas, c.n_total || c.n_enviados); }

// Contagem EXATA por status a partir das linhas de envio (fonte da verdade do
// modal de métricas). Respeita a hierarquia: clicado⊂aberto⊂entregue⊂enviado.
export type ContagemEnvios = {
  total: number; enviados: number; entregues: number; abertos: number;
  clicados: number; falhas: number; descadastros: number; fila: number;
};
export function contarEnvios(envios: { status: StatusEnvio }[]): ContagemEnvios {
  const c: ContagemEnvios = { total: envios.length, enviados: 0, entregues: 0, abertos: 0, clicados: 0, falhas: 0, descadastros: 0, fila: 0 };
  for (const e of envios) {
    switch (e.status) {
      case 'clicado': c.clicados++; c.abertos++; c.entregues++; c.enviados++; break;
      case 'aberto': c.abertos++; c.entregues++; c.enviados++; break;
      case 'entregue': c.entregues++; c.enviados++; break;
      case 'enviado': c.enviados++; break;
      case 'falha': c.falhas++; break;
      case 'descadastrado': c.descadastros++; break;
      case 'fila': c.fila++; break;
    }
  }
  return c;
}

export type FunilEtapa = { etapa: string; n: number; pct: number };
/** Funil enviados→entregues→abertos→clicados (pct relativo aos enviados). */
export function funilCampanha(c: Campanha): FunilEtapa[] {
  const base = c.n_enviados || c.n_total || 0;
  const etapa = (nome: string, n: number): FunilEtapa => ({ etapa: nome, n, pct: taxa(n, base) });
  return [
    etapa('Enviados', c.n_enviados),
    etapa('Entregues', c.n_entregues),
    etapa('Abertos', c.n_abertos),
    etapa('Clicados', c.n_clicados),
  ];
}

/** Agregado da carteira de campanhas (KPIs do topo). */
export function agregado(campanhas: Campanha[]) {
  const sum = (k: keyof Campanha) => campanhas.reduce((s, c) => s + (Number(c[k]) || 0), 0);
  const enviados = sum('n_enviados'), entregues = sum('n_entregues');
  const abertos = sum('n_abertos'), clicados = sum('n_clicados');
  return {
    total: campanhas.length,
    enviadas: campanhas.filter((c) => c.status === 'enviada').length,
    agendadas: campanhas.filter((c) => c.status === 'agendada').length,
    enviados, entregues, abertos, clicados,
    aberturaMedia: taxa(abertos, entregues || enviados),
    cliqueMedio: taxa(clicados, abertos || entregues || enviados),
  };
}

/** Série mensal de enviados (mini-gráfico do dashboard). */
export function serieEnviosMensal(campanhas: Campanha[], now: Date, meses = 6): { ym: string; enviados: number; abertos: number }[] {
  const out: { ym: string; enviados: number; abertos: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ ym: ymKey(d), enviados: 0, abertos: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.ym, i]));
  for (const c of campanhas) {
    const ref = c.enviada_em || c.criado_em;
    if (!ref) continue;
    const i = idx.get(ref.slice(0, 7));
    if (i == null) continue;
    out[i].enviados += c.n_enviados || 0;
    out[i].abertos += c.n_abertos || 0;
  }
  return out;
}

/** Melhor horário de abertura (hora 0–23 com mais aberturas), aproximado. */
export function melhorHorario(envios: Envio[]): { hora: number; n: number } | null {
  const tally = new Array(24).fill(0);
  for (const e of envios) {
    if (!e.aberto_em) continue;
    const d = new Date(e.aberto_em);
    if (!Number.isNaN(d.getTime())) tally[d.getHours()]++;
  }
  let melhor = -1, max = 0;
  tally.forEach((n, h) => { if (n > max) { max = n; melhor = h; } });
  return melhor < 0 ? null : { hora: melhor, n: max };
}

// ── Validação da campanha (antes de enviar/agendar) ───────────────────────────
export function validarCampanha(c: Pick<Campanha, 'nome' | 'canal' | 'assunto' | 'corpo'>): string[] {
  const erros: string[] = [];
  if (!c.nome.trim()) erros.push('Dê um nome à campanha.');
  if (c.canal === 'email' && !(c.assunto || '').trim()) erros.push('O assunto é obrigatório para e-mail.');
  if (!c.corpo.trim()) erros.push('Escreva a mensagem.');
  return erros;
}

// ── Export CSV (puro: retorna string; o download/DOM fica na página) ───────────
export function campanhasToCSV(list: Campanha[], fmtDate: (s: string | null) => string): string {
  const header = ['Nome', 'Canal', 'Status', 'Público', 'Enviados', 'Entregues', 'Abertos', 'Clicados', 'Falhas', 'Descadastros', 'Criada em', 'Enviada em'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const rows = list.map((c) => [
    esc(c.nome), CANAL_BY[c.canal]?.label || c.canal, STATUS_CAMPANHA_BY[c.status]?.label || c.status,
    c.n_total, c.n_enviados, c.n_entregues, c.n_abertos, c.n_clicados, c.n_falhas, c.n_descadastros,
    esc(fmtDate(c.criado_em)), esc(fmtDate(c.enviada_em)),
  ].join(','));
  return '﻿' + header.join(',') + '\n' + rows.join('\n');
}
