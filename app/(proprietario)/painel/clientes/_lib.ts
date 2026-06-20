// _lib — modelo, métricas e segmentação RFM do CRM 360º (/painel/clientes).
// Lógica compartilhada entre a Lista (page.tsx) e a Ficha ([id]/page.tsx).
// Regra de ouro: NADA de "R$"/data formatada aqui — só números/datas cruas;
// toda a formatação fica em lib/format, chamada nas páginas.

// ── Tipos ───────────────────────────────────────────────────────────────────
export type TipoCliente = 'pf' | 'pj';
export type Cliente = {
  id: string;
  usuario_id: string;
  tipo: TipoCliente;
  nome: string;
  doc: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  origem: string | null;
  tags: string[];
  segmento: string | null;
  aniversario: string | null;
  vip: boolean;
  obs: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type TipoInteracao = 'ligacao' | 'email' | 'whatsapp' | 'reuniao' | 'nota';
export type Interacao = {
  id: string;
  cliente_id: string;
  usuario_id: string;
  tipo: TipoInteracao;
  conteudo: string | null;
  data: string;
  criado_em: string;
};

export type EventoLite = {
  id: string;
  cliente_id: string | null;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_total_num: number | null;
  propriedade_id: number | null;
  criado_em: string;
};

export type ParcelaLite = {
  id: number;
  evento_id: string;
  valor: number;
  vencimento: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  pago_em: string | null;
};

// ── Estágios do funil (espelha /painel/leads e /painel/financeiro) ───────────
export type Grupo = 'negociando' | 'contratados' | 'finalizados' | 'perdidos';
export const GRUPO_DE: Record<string, Grupo> = {
  lead: 'negociando', consultada: 'negociando', visita: 'negociando', negociacao: 'negociando', reserva: 'negociando',
  contratado: 'contratados', briefing: 'contratados', pronto: 'contratados', montagem: 'contratados',
  finalizado: 'finalizados', pos: 'finalizados', perdido: 'perdidos', recontactar: 'perdidos',
};
export function grupoDe(status: string | null): Grupo { return GRUPO_DE[status || 'lead'] || 'negociando'; }
const GANHOS = new Set<Grupo>(['contratados', 'finalizados']);

// ── Listas de apoio (formulários/filtros) ────────────────────────────────────
export const ORIGENS = ['indicacao', 'site', 'instagram', 'google', 'facebook', 'whatsapp', 'evento', 'outro'];
export const ORIGEM_LABEL: Record<string, string> = {
  indicacao: 'Indicação', site: 'Site VENTSY', instagram: 'Instagram', google: 'Google',
  facebook: 'Facebook', whatsapp: 'WhatsApp', evento: 'Evento/Feira', outro: 'Outro',
};
export const INTERACOES: { v: TipoInteracao; label: string; icon: string }[] = [
  { v: 'nota', label: 'Nota', icon: '📝' },
  { v: 'ligacao', label: 'Ligação', icon: '📞' },
  { v: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { v: 'email', label: 'E-mail', icon: '✉️' },
  { v: 'reuniao', label: 'Reunião', icon: '🤝' },
];
export const INTERACAO_BY: Record<string, { label: string; icon: string }> =
  Object.fromEntries(INTERACOES.map((i) => [i.v, { label: i.label, icon: i.icon }]));

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export { waLink } from '@/lib/waLink';
export function telLink(fone: string | null | undefined): string | null {
  const d = soDigitos(fone);
  return d ? `tel:+${d.length <= 11 ? '55' + d : d}` : null;
}
export function mailLink(email: string | null | undefined): string | null {
  return email && email.includes('@') ? `mailto:${email.trim()}` : null;
}
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
// Dias decorridos de uma data (YYYY-MM-DD ou ISO) até `base` (ancorado ao meio-dia).
export function diffDias(value: string, base: Date): number {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value;
  return Math.floor((base.getTime() - new Date(iso).getTime()) / 86400000);
}
// Telefone "preferido" do cliente para ações rápidas (whatsapp tem prioridade).
export function fonePreferido(c: Cliente): string | null { return c.whatsapp || c.telefone || null; }

// ── Métricas por cliente ──────────────────────────────────────────────────────
export type ClienteMetrics = {
  eventos: EventoLite[];
  nEventos: number;
  nGanhos: number;
  valorContratado: number;   // Σ valor dos eventos contratados/finalizados  (≈ LTV)
  recebido: number;          // Σ parcelas pagas
  emAberto: number;          // Σ parcelas em aberto
  vencido: number;           // Σ parcelas vencidas
  ticket: number;            // valorContratado / nº de eventos ganhos
  ultimoEvento: string | null;     // data do evento ganho mais recente já ocorrido
  proximoEvento: EventoLite | null;
  ultimaAtividade: string | null;  // max(último evento, última interação, cadastro)
  diasDesdeUltima: number | null;  // dias desde a última "compra" (evento ganho)
  inativo: boolean;          // sem evento futuro e >90d sem atividade
};

// Casa eventos a um cliente: por cliente_id (vínculo) ou, para órfãos,
// por nome do contratante (robusto antes da derivação completa rodar).
export function eventosDoCliente(c: Cliente, todos: EventoLite[]): EventoLite[] {
  const nome = c.nome.trim().toLowerCase();
  return todos.filter(
    (e) => e.cliente_id === c.id || (e.cliente_id == null && (e.quem_contratou || '').trim().toLowerCase() === nome),
  );
}

export function metricsCliente(
  c: Cliente, eventos: EventoLite[], parcelas: ParcelaLite[], interacoes: Interacao[], now: Date,
): ClienteMetrics {
  const ids = new Set(eventos.map((e) => e.id));
  const ps = parcelas.filter((p) => ids.has(p.evento_id));
  const ganhos = eventos.filter((e) => GANHOS.has(grupoDe(e.status)));
  const valorContratado = ganhos.reduce((s, e) => s + (e.valor_total_num || 0), 0);
  const recebido = ps.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
  const abertas = ps.filter((p) => p.status !== 'pago' && p.status !== 'cancelado');
  const emAberto = abertas.reduce((s, p) => s + p.valor, 0);
  const hoje = ymd(now);
  const vencido = abertas.filter((p) => p.vencimento && p.vencimento < hoje).reduce((s, p) => s + p.valor, 0);

  const passados = ganhos.map((e) => e.data_inicio).filter((d): d is string => !!d && d <= hoje).sort();
  const ultimoEvento = passados.length ? passados[passados.length - 1] : null;
  const proximoEvento =
    ganhos.filter((e) => e.data_inicio && e.data_inicio >= hoje)
      .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''))[0] || null;

  const ultimaInteracao = interacoes.length ? interacoes.map((i) => i.data).sort().slice(-1)[0] : null;
  const candidatos = [ultimoEvento, ultimaInteracao, c.criado_em].filter((d): d is string => !!d).sort();
  const ultimaAtividade = candidatos.length ? candidatos[candidatos.length - 1] : null;
  const diasDesdeUltima = ultimoEvento ? diffDias(ultimoEvento, now) : null;
  const diasAtividade = ultimaAtividade ? diffDias(ultimaAtividade, now) : 9999;
  const inativo = !proximoEvento && diasAtividade > 90;

  return {
    eventos, nEventos: eventos.length, nGanhos: ganhos.length, valorContratado, recebido, emAberto, vencido,
    ticket: ganhos.length ? valorContratado / ganhos.length : 0,
    ultimoEvento, proximoEvento, ultimaAtividade, diasDesdeUltima, inativo,
  };
}

// ── Segmentação RFM simples → rótulo automático ───────────────────────────────
export type Segmento = 'campeao' | 'fiel' | 'novo' | 'em_risco' | 'perdido' | 'lead';
export const SEGMENTOS: { v: Segmento; label: string; cls: string; dot: string; cor: string; desc: string }[] = [
  { v: 'campeao', label: 'Campeão', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', cor: '#10b981', desc: 'Recorrente e valioso' },
  { v: 'fiel', label: 'Fiel', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500', cor: '#1a73e8', desc: 'Mais de um evento' },
  { v: 'novo', label: 'Novo', cls: 'bg-brand-50 text-brand', dot: 'bg-brand', cor: '#ff385c', desc: 'Cliente recente' },
  { v: 'em_risco', label: 'Em risco', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', cor: '#f59e0b', desc: 'Sem comprar há +120d' },
  { v: 'perdido', label: 'Perdido', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500', cor: '#ef4444', desc: 'Sem comprar há +1 ano' },
  { v: 'lead', label: 'Lead', cls: 'bg-black/[0.05] text-ink-muted', dot: 'bg-ink-muted', cor: '#94a3b8', desc: 'Ainda não fechou' },
];
export const SEG_BY: Record<Segmento, (typeof SEGMENTOS)[number]> =
  Object.fromEntries(SEGMENTOS.map((s) => [s.v, s])) as Record<Segmento, (typeof SEGMENTOS)[number]>;

// `refValor` = valor de referência (média de LTV dos clientes que já fecharam),
// usado para distinguir "Campeão" (frequente E valioso) de "Fiel".
export function segmentar(c: Cliente, m: ClienteMetrics, now: Date, refValor: number): Segmento {
  const novoRecente = diffDias(c.criado_em, now) <= 60;
  if (m.nGanhos === 0) return novoRecente ? 'novo' : 'lead';
  const dias = m.diasDesdeUltima;
  if (dias != null && dias > 365) return 'perdido';
  if (dias != null && dias > 120) return 'em_risco';
  if (m.nGanhos >= 2 && m.valorContratado >= refValor) return 'campeao';
  if (m.nGanhos >= 2) return 'fiel';
  return novoRecente ? 'novo' : 'fiel';
}

// ── CSV: parser tolerante (aspas) + leitura/escrita ──────────────────────────
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', i = 0, q = false;
  const t = text.replace(/\r\n?/g, '\n');
  while (i < t.length) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
    i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export type ImportRow = {
  nome: string; doc: string; email: string; telefone: string;
  cidade: string; estado: string; origem: string; tipo: TipoCliente;
};
// Mapeia cabeçalhos PT/EN comuns -> campos. Retorna linhas com nome preenchido.
export function importClientesCSV(text: string): ImportRow[] {
  const grid = parseCSV(text);
  if (grid.length < 2) return [];
  const head = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (alts: string[]) => head.findIndex((h) => alts.includes(h));
  const iNome = idx(['nome', 'name', 'cliente', 'contratante']);
  const iDoc = idx(['doc', 'documento', 'cpf', 'cnpj', 'cpf/cnpj']);
  const iEmail = idx(['email', 'e-mail']);
  const iTel = idx(['telefone', 'phone', 'celular', 'whatsapp', 'fone']);
  const iCid = idx(['cidade', 'city']);
  const iEst = idx(['estado', 'uf', 'state']);
  const iOri = idx(['origem', 'source', 'como conheceu']);
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '');
  return grid.slice(1).map((r) => {
    const doc = at(r, iDoc);
    return {
      nome: at(r, iNome) || at(r, iEmail) || 'Sem nome',
      doc, email: at(r, iEmail), telefone: at(r, iTel),
      cidade: at(r, iCid), estado: at(r, iEst).toUpperCase().slice(0, 2),
      origem: at(r, iOri).toLowerCase(),
      tipo: (soDigitos(doc).length > 11 ? 'pj' : 'pf') as TipoCliente,
    };
  }).filter((r) => r.nome && r.nome !== 'Sem nome');
}

// Chave de de-dupe: documento (só dígitos) > e-mail > nome normalizado.
export function chaveDedupe(x: { doc?: string | null; email?: string | null; nome?: string | null }): string {
  const d = soDigitos(x.doc);
  if (d) return 'doc:' + d;
  if (x.email && x.email.includes('@')) return 'mail:' + x.email.trim().toLowerCase();
  return 'nome:' + (x.nome || '').trim().toLowerCase();
}

export function exportClientesCSV(
  linhas: { c: Cliente; m: ClienteMetrics; seg: Segmento }[],
): void {
  const header = ['Nome', 'Tipo', 'Documento', 'E-mail', 'Telefone', 'WhatsApp', 'Cidade', 'Estado', 'Origem', 'Tags', 'Segmento', 'Nº eventos', 'Valor gerado', 'Recebido', 'Em aberto', 'Último evento'];
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const body = linhas.map(({ c, m, seg }) => [
    esc(c.nome), c.tipo, esc(c.doc || ''), esc(c.email || ''), esc(c.telefone || ''), esc(c.whatsapp || ''),
    esc(c.cidade || ''), esc(c.estado || ''), esc(ORIGEM_LABEL[c.origem || ''] || c.origem || ''),
    esc((c.tags || []).join('; ')), SEG_BY[seg].label, m.nGanhos, m.valorContratado, m.recebido, m.emAberto, m.ultimoEvento || '',
  ].join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
