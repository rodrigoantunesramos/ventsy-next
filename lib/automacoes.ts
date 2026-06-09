// Motor PURO de Automações & Notificações — /painel/automacoes.
// ─────────────────────────────────────────────────────────────────────────────
// "Se isto, então aquilo": regras gatilho → condição → ação que costuram os
// módulos (Cobrança, Contratos, Feedback, Licenças, CRM…) + a central de
// notificações/lembretes. Espelha as regras de ouro das demais engines
// (lib/campanhas, lib/licencas, lib/reservas): SEM React, SEM Supabase, SEM
// "R$"/Intl — só tipos, catálogos e funções determinísticas e testáveis. A
// formatação i18n (datas/moeda) fica em lib/format, injetada por quem exibe/envia.
//
// Divisão de responsabilidades:
//   • A SELEÇÃO de alvos (quais eventos/parcelas/contratos… disparam HOJE) é PURA
//     aqui: `selecionarDisparos(automacao, dados, hoje)` recebe arrays já
//     carregados e devolve os alvos com variáveis para interpolar. É reusada pelo
//     processador (app/api/cron/automacoes) e pelo "testar agora"
//     (app/api/automacoes) — o servidor só carrega dados, DEDUPLICA via log e
//     executa a ação (in-app/e-mail/WhatsApp), formatando moeda/data com lib/format.
//   • Valores monetários trafegam CRUS (`valor_num`) — quem envia formata. Assim a
//     mensagem nunca carrega "R$" hardcoded vindo daqui.

// ── Domínio: gatilhos, ações, canais ─────────────────────────────────────────
export type Gatilho =
  | 'evento_criado'           // novo evento entrou no funil (criado nas últimas 24h)
  | 'x_dias_antes_evento'     // faltam N dias para o evento
  | 'x_dias_apos_evento'      // passaram N dias do evento
  | 'parcela_vence'           // parcela vence em N dias
  | 'parcela_atrasa'          // parcela venceu há N dias (em atraso)
  | 'contrato_nao_assinado'   // contrato enviado há N dias sem assinatura
  | 'feedback_negativo'       // feedback com nota ≤ limiar
  | 'aniversario_cliente'     // aniversário do cliente (hoje ou em N dias)
  | 'licenca_a_vencer';       // licença/alvará vence em N dias

export type Acao =
  | 'notificar'        // cria notificação in-app para o dono (sino)
  | 'enviar_email'     // envia e-mail (lib/email) — dono ou cliente
  | 'enviar_whatsapp'  // prepara link wa.me (degrade: surge como notificação)
  | 'criar_tarefa'     // cria uma pendência (notificação tipo "tarefa")
  | 'mover_funil';     // move o evento para outro status do funil

export type CanalNotif = 'app' | 'email' | 'whatsapp';
export type Destinatario = 'dono' | 'cliente';
export type Urgencia = 'info' | 'sucesso' | 'alerta' | 'critico';

// Escopo da entidade-alvo (define qual fonte de dados o gatilho varre).
export type Escopo = 'evento' | 'parcela' | 'contrato' | 'cliente' | 'licenca' | 'feedback';

// ── Condição (filtros do gatilho — AND entre dimensões) ──────────────────────
export type Condicao = {
  dias?: number | null;            // parametriza o gatilho (N dias) — ver diasDoGatilho
  propriedade_id?: number | null;  // só esta propriedade
  tipos_evento?: string[];         // só estes tipos de evento (OR dentro da lista)
  status?: string[];               // só estes status (evento/funil)
  valor_min?: number | null;       // valor mínimo (parcela/evento) — número CRU
  nota_max?: number | null;        // feedback: dispara quando nota ≤ nota_max
};

// ── Ação (o que fazer + mensagem) ────────────────────────────────────────────
export type AcaoConfig = {
  destinatario?: Destinatario;     // quem recebe (e-mail/WhatsApp); 'dono' p/ in-app
  titulo?: string;                 // título da notificação / assunto do e-mail (com {{vars}})
  mensagem?: string;               // corpo (com {{vars}})
  urgencia?: Urgencia;             // cor/peso da notificação (default por gatilho)
  novo_status?: string;            // mover_funil → status destino do evento
  link?: string;                   // link fixo opcional (senão, link sugerido do gatilho)
};

export type Automacao = {
  id: string;
  usuario_id: string;
  nome: string;
  gatilho: Gatilho;
  condicao: Condicao;
  acao: Acao;
  acao_config: AcaoConfig;
  ativo: boolean;
  ultima_exec: string | null;
  n_exec: number;
  criado_em: string;
  atualizado_em: string;
};

// ── Notificação (central in-app) ─────────────────────────────────────────────
export type Notificacao = {
  id: string;
  usuario_id: string;
  tipo: string;            // 'parcela' | 'contrato' | 'evento' | 'licenca' | 'feedback' | 'tarefa' | 'sistema' | <gatilho>
  titulo: string;
  corpo: string | null;
  link: string | null;
  urgencia: Urgencia;
  origem: string | null;   // 'automacao:<id>' | 'sistema'
  lida: boolean;
  criado_em: string;
};

// ── Log de execução (idempotência + auditoria) ───────────────────────────────
export type AutomacaoLog = {
  id: string;
  usuario_id: string;
  automacao_id: string | null;
  gatilho: string;
  acao: string;
  alvo_tipo: string | null;
  alvo_id: string | null;
  alvo_label: string | null;
  dedup_key: string;       // (automacao, alvo, bucket-dia) → não repete no mesmo dia
  canal: string | null;
  sucesso: boolean;
  detalhe: string | null;
  criado_em: string;
};

// ── Entidades-fonte (subconjuntos das tabelas já existentes) ─────────────────
export type EventoLite = {
  id: string;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_total_num: number | null;
  propriedade_id: number | null;
  email: string | null;
  telefone: string | null;
  criado_em: string | null;
};
export type ParcelaLite = {
  id: string;
  evento_id: string | null;
  valor: number | null;
  vencimento: string | null;
  status: string | null;
  pago_em: string | null;
};
export type ContratoLite = {
  id: string;
  evento_id: string | null;
  cliente_id: string | null;
  titulo: string | null;
  numero: string | null;
  status: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};
export type ClienteLite = {
  id: string;
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  telefone: string | null;
  aniversario: string | null;  // YYYY-MM-DD
};
export type LicencaLite = {
  id: string;
  titulo: string | null;
  tipo: string | null;
  validade: string | null;
  status: string | null;
  dias_aviso: number | null;
  propriedade_id: number | null;
  evento_id: string | null;
};
export type FeedbackLite = {
  id: string;
  evento_id: string | null;
  cliente_id: string | null;
  autor_nome: string | null;
  nota_geral: number | null;
  criado_em: string | null;
};

export type DadosSelecao = {
  eventos: EventoLite[];
  parcelas: ParcelaLite[];
  contratos: ContratoLite[];
  clientes: ClienteLite[];
  licencas: LicencaLite[];
  feedbacks: FeedbackLite[];
};

// Um alvo que disparou o gatilho — pronto para a ação interpolar/enviar.
export type Disparo = {
  alvo_tipo: Escopo;
  alvo_id: string;
  alvo_label: string;
  evento_id: string | null;          // p/ mover_funil / vínculo
  contato_email: string | null;      // destinatário=cliente (e-mail)
  contato_whatsapp: string | null;   // destinatário=cliente (WhatsApp, dígitos)
  valor_num: number | null;          // CRU — quem envia formata (lib/format)
  data_ref: string | null;           // data relevante (vencimento/validade/evento), YMD
  link: string | null;               // link sugerido (relativo) se a ação não definir
  vars: Record<string, string>;      // variáveis NÃO-locale ({{cliente}}, {{evento}}, {{dias}}…)
};

// ── Catálogos de UI ──────────────────────────────────────────────────────────
export const GATILHOS: {
  v: Gatilho; label: string; desc: string; escopo: Escopo;
  temDias: boolean; diasDefault: number; diasLabel: string;
}[] = [
  { v: 'evento_criado', label: 'Novo evento criado', desc: 'Quando um evento entra no funil.', escopo: 'evento', temDias: false, diasDefault: 0, diasLabel: '' },
  { v: 'x_dias_antes_evento', label: 'Dias antes do evento', desc: 'Faltam N dias para a data do evento.', escopo: 'evento', temDias: true, diasDefault: 7, diasLabel: 'dias antes' },
  { v: 'x_dias_apos_evento', label: 'Dias após o evento', desc: 'Passaram N dias desde o evento.', escopo: 'evento', temDias: true, diasDefault: 1, diasLabel: 'dias após' },
  { v: 'parcela_vence', label: 'Parcela a vencer', desc: 'Uma parcela vence em N dias.', escopo: 'parcela', temDias: true, diasDefault: 3, diasLabel: 'dias antes' },
  { v: 'parcela_atrasa', label: 'Parcela em atraso', desc: 'Uma parcela venceu há N dias.', escopo: 'parcela', temDias: true, diasDefault: 1, diasLabel: 'dias após' },
  { v: 'contrato_nao_assinado', label: 'Contrato pendente', desc: 'Contrato enviado há N dias sem assinatura.', escopo: 'contrato', temDias: true, diasDefault: 2, diasLabel: 'dias após enviar' },
  { v: 'feedback_negativo', label: 'Feedback negativo', desc: 'Um feedback recebeu nota baixa.', escopo: 'feedback', temDias: false, diasDefault: 0, diasLabel: '' },
  { v: 'aniversario_cliente', label: 'Aniversário do cliente', desc: 'É o aniversário do cliente (ou em N dias).', escopo: 'cliente', temDias: true, diasDefault: 0, diasLabel: 'dias antes' },
  { v: 'licenca_a_vencer', label: 'Licença a vencer', desc: 'Uma licença/alvará vence em N dias.', escopo: 'licenca', temDias: true, diasDefault: 30, diasLabel: 'dias antes' },
];
export const GATILHO_BY = Object.fromEntries(GATILHOS.map((g) => [g.v, g])) as Record<Gatilho, (typeof GATILHOS)[number]>;

export const ACOES: { v: Acao; label: string; desc: string; canal: CanalNotif | null; precisaContato: boolean }[] = [
  { v: 'notificar', label: 'Notificar no app', desc: 'Avisa você no sino de notificações.', canal: 'app', precisaContato: false },
  { v: 'enviar_email', label: 'Enviar e-mail', desc: 'Dispara um e-mail (a você ou ao cliente).', canal: 'email', precisaContato: true },
  { v: 'enviar_whatsapp', label: 'Preparar WhatsApp', desc: 'Monta a mensagem e o link wa.me do cliente.', canal: 'whatsapp', precisaContato: true },
  { v: 'criar_tarefa', label: 'Criar tarefa', desc: 'Abre uma pendência na sua lista do dia.', canal: 'app', precisaContato: false },
  { v: 'mover_funil', label: 'Mover no funil', desc: 'Muda o status do evento automaticamente.', canal: null, precisaContato: false },
];
export const ACAO_BY = Object.fromEntries(ACOES.map((a) => [a.v, a])) as Record<Acao, (typeof ACOES)[number]>;

export const CANAIS: { v: CanalNotif; label: string; icon: string }[] = [
  { v: 'app', label: 'No app (sino)', icon: '🔔' },
  { v: 'email', label: 'E-mail', icon: '✉️' },
  { v: 'whatsapp', label: 'WhatsApp', icon: '💬' },
];

export const URGENCIAS: { v: Urgencia; label: string; cls: string; dot: string }[] = [
  { v: 'info', label: 'Informativo', cls: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  { v: 'sucesso', label: 'Positivo', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  { v: 'alerta', label: 'Atenção', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { v: 'critico', label: 'Crítico', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
];
export const URGENCIA_BY = Object.fromEntries(URGENCIAS.map((u) => [u.v, u])) as Record<Urgencia, (typeof URGENCIAS)[number]>;

// Urgência padrão de cada gatilho (usada quando a ação não define uma).
export const URGENCIA_GATILHO: Record<Gatilho, Urgencia> = {
  evento_criado: 'info',
  x_dias_antes_evento: 'info',
  x_dias_apos_evento: 'info',
  parcela_vence: 'alerta',
  parcela_atrasa: 'critico',
  contrato_nao_assinado: 'alerta',
  feedback_negativo: 'critico',
  aniversario_cliente: 'sucesso',
  licenca_a_vencer: 'alerta',
};

// Variáveis reconhecidas no título/mensagem (chips do editor).
export const VARIAVEIS: { k: string; label: string; exemplo: string }[] = [
  { k: 'cliente', label: 'Nome do cliente', exemplo: 'Maria' },
  { k: 'evento', label: 'Evento', exemplo: 'Casamento Ana & João' },
  { k: 'empresa', label: 'Sua empresa', exemplo: 'Espaço Villa' },
  { k: 'data', label: 'Data relevante', exemplo: '12/08/2026' },
  { k: 'valor', label: 'Valor (formatado)', exemplo: 'R$ 2.500,00' },
  { k: 'dias', label: 'Nº de dias', exemplo: '3' },
  { k: 'titulo', label: 'Título (contrato/licença)', exemplo: 'Contrato 2026/014' },
  { k: 'nota', label: 'Nota do feedback', exemplo: '2' },
];

// Tipo de notificação por escopo (ícone/agrupamento na central).
export const TIPO_POR_ESCOPO: Record<Escopo, string> = {
  evento: 'evento', parcela: 'parcela', contrato: 'contrato',
  cliente: 'cliente', licenca: 'licenca', feedback: 'feedback',
};

// Link sugerido por escopo (quando a ação não define um).
export const LINK_POR_ESCOPO: Record<Escopo, string> = {
  evento: '/painel/clientes', parcela: '/painel/recebiveis', contrato: '/painel/contratos',
  cliente: '/painel/clientes', licenca: '/painel/licencas', feedback: '/painel/feedbacks',
};

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function isMissingTable(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01');
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export function emailValido(s: string | null | undefined): boolean {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
function norm(s: string | null | undefined): string { return (s || '').trim().toLowerCase(); }
function intersecta(a: string[] | undefined, valor: string | null | undefined): boolean {
  if (!a || !a.length) return true;          // lista vazia = não filtra
  return a.map(norm).includes(norm(valor));
}

/** Link wa.me com DDI BR (≤11 dígitos ganham '55') e texto opcional. */
export function waLink(contato: string | null | undefined, texto?: string): string | null {
  const d = soDigitos(contato);
  if (!d) return null;
  const fone = d.length <= 11 ? '55' + d : d;
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return `https://wa.me/${fone}${q}`;
}

// ── Datas (YMD puro, sem locale) ──────────────────────────────────────────────
/** Primeiros 10 chars (YYYY-MM-DD) de uma data/timestamp; null se vazio. */
export function ymdOf(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v));
  return m ? m[1] : null;
}
/** Soma `n` dias a um 'YYYY-MM-DD' (ancorado ao meio-dia p/ evitar DST). */
export function addDiasYMD(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Dias (inteiros) de `a` até `b` (b - a). Positivo = b no futuro. */
export function diffDiasYMD(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / 86400000);
}
/** MM-DD de um YMD (para aniversários, ignora o ano). */
export function mmdd(ymd: string | null | undefined): string | null {
  const y = ymdOf(ymd);
  return y ? y.slice(5) : null;
}

/** N dias do gatilho (da condição ou o default do catálogo). */
export function diasDoGatilho(a: Pick<Automacao, 'gatilho' | 'condicao'>): number {
  const d = a.condicao?.dias;
  if (d != null && Number.isFinite(Number(d))) return Math.max(0, Math.trunc(Number(d)));
  return GATILHO_BY[a.gatilho]?.diasDefault ?? 0;
}

// ── Interpolação {{chave}} (tolerante a espaço/caso; sem {{x}} cru no envio) ──
export function interpolar(template: string | null | undefined, vars: Record<string, string | null | undefined>): string {
  if (!template) return '';
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) lower[k.toLowerCase()] = v == null ? '' : String(v);
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k: string) => lower[k.toLowerCase()] ?? '');
}

// ── Rótulos / nomes ───────────────────────────────────────────────────────────
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return 'Evento';
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome';
}
function primeiroNome(nome: string | null | undefined): string {
  const n = (nome || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

// ── Dedup (idempotência: 1 disparo por automação×alvo×dia) ────────────────────
/** Bucket diário (YMD) — o processador roda 1×/dia; isto evita reenvio no dia. */
export function bucketDia(hoje: string): string { return hoje; }
export function dedupKey(automacaoId: string, alvoId: string, bucket: string): string {
  return `${automacaoId}|${alvoId}|${bucket}`;
}

// ── Condição genérica ─────────────────────────────────────────────────────────
function passaCondicaoEvento(e: EventoLite, c: Condicao): boolean {
  if (c.propriedade_id != null && Number(e.propriedade_id) !== Number(c.propriedade_id)) return false;
  if (!intersecta(c.tipos_evento, e.tipo_evento)) return false;
  if (c.status && c.status.length && !intersecta(c.status, e.status)) return false;
  if (c.valor_min != null && (Number(e.valor_total_num) || 0) < Number(c.valor_min)) return false;
  return true;
}

// ── Seletores por escopo (PUROS) ──────────────────────────────────────────────
function dispEvento(e: EventoLite, dias: number, hoje: string, extraVars: Record<string, string> = {}): Disparo {
  return {
    alvo_tipo: 'evento', alvo_id: e.id, alvo_label: eventoLabel(e), evento_id: e.id,
    contato_email: emailValido(e.email) ? e.email!.trim() : null,
    contato_whatsapp: soDigitos(e.telefone) || null,
    valor_num: e.valor_total_num != null ? Number(e.valor_total_num) : null,
    data_ref: ymdOf(e.data_inicio),
    link: LINK_POR_ESCOPO.evento,
    vars: {
      cliente: primeiroNome(e.quem_contratou), evento: eventoLabel(e),
      tipo: e.tipo_evento || '', dias: String(dias), ...extraVars,
    },
  };
}

export function selecionarEventos(eventos: EventoLite[], a: Automacao, hoje: string): Disparo[] {
  const dias = diasDoGatilho(a);
  const out: Disparo[] = [];
  for (const e of eventos) {
    if (!passaCondicaoEvento(e, a.condicao)) continue;
    if (a.gatilho === 'evento_criado') {
      if (ymdOf(e.criado_em) === hoje) out.push(dispEvento(e, dias, hoje));
    } else if (a.gatilho === 'x_dias_antes_evento') {
      const ini = ymdOf(e.data_inicio);
      if (ini && ini === addDiasYMD(hoje, dias)) out.push(dispEvento(e, dias, hoje));
    } else if (a.gatilho === 'x_dias_apos_evento') {
      const fim = ymdOf(e.data_fim) || ymdOf(e.data_inicio);
      if (fim && fim === addDiasYMD(hoje, -dias)) out.push(dispEvento(e, dias, hoje));
    }
  }
  return out;
}

export function selecionarParcelas(parcelas: ParcelaLite[], eventosById: Map<string, EventoLite>, a: Automacao, hoje: string): Disparo[] {
  const dias = diasDoGatilho(a);
  const out: Disparo[] = [];
  for (const p of parcelas) {
    const venc = ymdOf(p.vencimento);
    if (!venc) continue;
    const pago = norm(p.status) === 'pago' || !!p.pago_em;
    if (pago) continue;
    const ev = p.evento_id ? eventosById.get(String(p.evento_id)) : undefined;
    // filtros de condição via evento (propriedade/tipo) + valor mínimo na parcela
    if (ev && !passaCondicaoEvento(ev, { ...a.condicao, valor_min: null })) continue;
    if (a.condicao.valor_min != null && (Number(p.valor) || 0) < Number(a.condicao.valor_min)) continue;

    let ok = false;
    if (a.gatilho === 'parcela_vence') ok = venc === addDiasYMD(hoje, dias);
    else if (a.gatilho === 'parcela_atrasa') ok = venc === addDiasYMD(hoje, -Math.max(1, dias || 1));
    if (!ok) continue;

    out.push({
      alvo_tipo: 'parcela', alvo_id: String(p.id), alvo_label: ev ? eventoLabel(ev) : `Parcela`,
      evento_id: p.evento_id ?? null,
      contato_email: ev && emailValido(ev.email) ? ev.email!.trim() : null,
      contato_whatsapp: ev ? soDigitos(ev.telefone) || null : null,
      valor_num: p.valor != null ? Number(p.valor) : null,
      data_ref: venc, link: LINK_POR_ESCOPO.parcela,
      vars: {
        cliente: ev ? primeiroNome(ev.quem_contratou) : '', evento: ev ? eventoLabel(ev) : '',
        dias: String(dias),
      },
    });
  }
  return out;
}

export function selecionarContratos(contratos: ContratoLite[], eventosById: Map<string, EventoLite>, a: Automacao, hoje: string): Disparo[] {
  const dias = diasDoGatilho(a);
  const out: Disparo[] = [];
  for (const c of contratos) {
    if (norm(c.status) !== 'enviado') continue;        // pendente de assinatura
    const ref = ymdOf(c.criado_em);
    if (!ref) continue;
    if (ref !== addDiasYMD(hoje, -Math.max(1, dias || 1))) continue;
    const ev = c.evento_id ? eventosById.get(String(c.evento_id)) : undefined;
    if (ev && !passaCondicaoEvento(ev, { ...a.condicao, valor_min: null })) continue;
    out.push({
      alvo_tipo: 'contrato', alvo_id: String(c.id),
      alvo_label: c.titulo || (c.numero ? `Contrato ${c.numero}` : 'Contrato'),
      evento_id: c.evento_id ?? null,
      contato_email: ev && emailValido(ev.email) ? ev.email!.trim() : null,
      contato_whatsapp: ev ? soDigitos(ev.telefone) || null : null,
      valor_num: null, data_ref: ref, link: LINK_POR_ESCOPO.contrato,
      vars: {
        cliente: ev ? primeiroNome(ev.quem_contratou) : '', evento: ev ? eventoLabel(ev) : '',
        titulo: c.titulo || (c.numero ? `Contrato ${c.numero}` : 'Contrato'), dias: String(dias),
      },
    });
  }
  return out;
}

export function selecionarAniversarios(clientes: ClienteLite[], a: Automacao, hoje: string): Disparo[] {
  const dias = diasDoGatilho(a);
  const alvo = mmdd(addDiasYMD(hoje, dias));      // aniversário em `dias` dias
  const out: Disparo[] = [];
  for (const cl of clientes) {
    const d = mmdd(cl.aniversario);
    if (!d || d !== alvo) continue;
    out.push({
      alvo_tipo: 'cliente', alvo_id: String(cl.id), alvo_label: cl.nome || 'Cliente', evento_id: null,
      contato_email: emailValido(cl.email) ? cl.email!.trim() : null,
      contato_whatsapp: soDigitos(cl.whatsapp) || soDigitos(cl.telefone) || null,
      valor_num: null, data_ref: ymdOf(cl.aniversario), link: LINK_POR_ESCOPO.cliente,
      vars: { cliente: primeiroNome(cl.nome), dias: String(dias) },
    });
  }
  return out;
}

export function selecionarLicencas(licencas: LicencaLite[], a: Automacao, hoje: string): Disparo[] {
  const dias = diasDoGatilho(a);
  const out: Disparo[] = [];
  for (const l of licencas) {
    const val = ymdOf(l.validade);
    if (!val) continue;
    const st = norm(l.status);
    if (st === 'nao_aplicavel' || st === 'cancelada' || st === 'dispensada') continue;
    if (a.condicao.propriedade_id != null && Number(l.propriedade_id) !== Number(a.condicao.propriedade_id)) continue;
    if (val !== addDiasYMD(hoje, dias)) continue;
    out.push({
      alvo_tipo: 'licenca', alvo_id: String(l.id), alvo_label: l.titulo || l.tipo || 'Licença', evento_id: l.evento_id ?? null,
      contato_email: null, contato_whatsapp: null, valor_num: null, data_ref: val, link: LINK_POR_ESCOPO.licenca,
      vars: { titulo: l.titulo || l.tipo || 'Licença', tipo: l.tipo || '', dias: String(dias) },
    });
  }
  return out;
}

export function selecionarFeedbacks(feedbacks: FeedbackLite[], eventosById: Map<string, EventoLite>, a: Automacao, hoje: string): Disparo[] {
  const notaMax = a.condicao.nota_max != null ? Number(a.condicao.nota_max) : 2;
  const out: Disparo[] = [];
  for (const f of feedbacks) {
    const nota = f.nota_geral == null ? null : Number(f.nota_geral);
    if (nota == null || nota > notaMax || nota <= 0) continue;
    if (ymdOf(f.criado_em) !== hoje) continue;        // só os de hoje (o cron varre diário)
    const ev = f.evento_id ? eventosById.get(String(f.evento_id)) : undefined;
    if (ev && !passaCondicaoEvento(ev, { ...a.condicao, valor_min: null, nota_max: null })) continue;
    out.push({
      alvo_tipo: 'feedback', alvo_id: String(f.id),
      alvo_label: ev ? eventoLabel(ev) : (f.autor_nome || 'Feedback'),
      evento_id: f.evento_id ?? null,
      contato_email: null, contato_whatsapp: null, valor_num: null, data_ref: ymdOf(f.criado_em),
      link: LINK_POR_ESCOPO.feedback,
      vars: {
        cliente: primeiroNome(f.autor_nome) || (ev ? primeiroNome(ev.quem_contratou) : ''),
        evento: ev ? eventoLabel(ev) : '', nota: String(nota),
      },
    });
  }
  return out;
}

/** Roteia o gatilho para o seletor certo. É o coração reusado por cron e "testar". */
export function selecionarDisparos(a: Automacao, d: DadosSelecao, hoje: string): Disparo[] {
  const eventosById = new Map(d.eventos.map((e) => [String(e.id), e]));
  switch (a.gatilho) {
    case 'evento_criado':
    case 'x_dias_antes_evento':
    case 'x_dias_apos_evento':
      return selecionarEventos(d.eventos, a, hoje);
    case 'parcela_vence':
    case 'parcela_atrasa':
      return selecionarParcelas(d.parcelas, eventosById, a, hoje);
    case 'contrato_nao_assinado':
      return selecionarContratos(d.contratos, eventosById, a, hoje);
    case 'aniversario_cliente':
      return selecionarAniversarios(d.clientes, a, hoje);
    case 'licenca_a_vencer':
      return selecionarLicencas(d.licencas, a, hoje);
    case 'feedback_negativo':
      return selecionarFeedbacks(d.feedbacks, eventosById, a, hoje);
    default:
      return [];
  }
}

// ── Validação (antes de salvar/ativar) ────────────────────────────────────────
export function validarAutomacao(a: Pick<Automacao, 'nome' | 'gatilho' | 'acao' | 'acao_config'>): string[] {
  const erros: string[] = [];
  if (!a.nome.trim()) erros.push('Dê um nome à automação.');
  if (!GATILHO_BY[a.gatilho]) erros.push('Escolha um gatilho válido.');
  const ac = ACAO_BY[a.acao];
  if (!ac) erros.push('Escolha uma ação válida.');
  if (a.acao === 'mover_funil' && !a.acao_config?.novo_status?.trim()) {
    erros.push('Defina o status de destino do funil.');
  }
  if ((a.acao === 'enviar_email' || a.acao === 'enviar_whatsapp') && !a.acao_config?.mensagem?.trim()) {
    erros.push('Escreva a mensagem que será enviada.');
  }
  if (a.acao === 'enviar_email' && a.acao_config?.destinatario === 'cliente'
      && GATILHO_BY[a.gatilho]?.escopo === 'licenca') {
    erros.push('Licença não tem cliente destinatário — notifique você mesmo.');
  }
  return erros;
}

/** "Se … então …" legível para o card da automação. */
export function resumoAutomacao(a: Pick<Automacao, 'gatilho' | 'condicao' | 'acao' | 'acao_config'>): { se: string; entao: string } {
  const g = GATILHO_BY[a.gatilho];
  const dias = diasDoGatilho(a);
  let se = g?.label || a.gatilho;
  if (g?.temDias) se = `${g.label} (${dias} ${g.diasLabel})`;
  if (a.condicao?.tipos_evento?.length) se += ` · ${a.condicao.tipos_evento.join('/')}`;
  const ac = ACAO_BY[a.acao];
  let entao = ac?.label || a.acao;
  if (a.acao === 'mover_funil' && a.acao_config?.novo_status) entao = `Mover para "${a.acao_config.novo_status}"`;
  if (a.acao === 'enviar_email') entao = a.acao_config?.destinatario === 'cliente' ? 'E-mail ao cliente' : 'E-mail para você';
  return { se, entao };
}

// ── Pendências do dia (agenda viva — independe de automações configuradas) ───
export type Pendencia = {
  tipo: Escopo | 'evento';
  titulo: string;
  sub: string;
  link: string;
  urgencia: Urgencia;
  data: string | null;     // YMD relevante
  valor_num: number | null;
  ordem: number;           // p/ ordenação estável (menor = mais urgente)
};

/**
 * Monta as pendências de HOJE a partir dos dados já carregados — o "minhas
 * pendências do dia" da central. NÃO depende de automações: dá valor imediato.
 *   • parcelas atrasadas / a vencer dentro do horizonte
 *   • contratos enviados sem assinatura há ≥ 2 dias
 *   • eventos nos próximos `horizonte` dias
 *   • licenças a vencer dentro do dias_aviso (ou horizonte estendido)
 */
export function pendenciasDoDia(d: DadosSelecao, hoje: string, horizonte = 7): Pendencia[] {
  const out: Pendencia[] = [];
  const eventosById = new Map(d.eventos.map((e) => [String(e.id), e]));

  for (const p of d.parcelas) {
    const venc = ymdOf(p.vencimento);
    if (!venc) continue;
    if (norm(p.status) === 'pago' || p.pago_em) continue;
    const delta = diffDiasYMD(hoje, venc);     // <0 atrasada, 0 hoje, >0 futura
    if (delta > horizonte) continue;
    const ev = p.evento_id ? eventosById.get(String(p.evento_id)) : undefined;
    const atrasada = delta < 0;
    out.push({
      tipo: 'parcela',
      titulo: ev ? eventoLabel(ev) : 'Parcela',
      sub: atrasada ? `Vencida há ${Math.abs(delta)} dia(s)` : delta === 0 ? 'Vence hoje' : `Vence em ${delta} dia(s)`,
      link: LINK_POR_ESCOPO.parcela, urgencia: atrasada ? 'critico' : delta <= 2 ? 'alerta' : 'info',
      data: venc, valor_num: p.valor != null ? Number(p.valor) : null, ordem: delta,
    });
  }

  for (const c of d.contratos) {
    if (norm(c.status) !== 'enviado') continue;
    const ref = ymdOf(c.criado_em);
    if (!ref) continue;
    const idade = diffDiasYMD(ref, hoje);      // dias desde criado
    if (idade < 2) continue;
    const ev = c.evento_id ? eventosById.get(String(c.evento_id)) : undefined;
    out.push({
      tipo: 'contrato',
      titulo: c.titulo || (c.numero ? `Contrato ${c.numero}` : 'Contrato'),
      sub: `${ev ? eventoLabel(ev) + ' · ' : ''}Sem assinatura há ${idade} dia(s)`,
      link: LINK_POR_ESCOPO.contrato, urgencia: idade >= 5 ? 'alerta' : 'info',
      data: ref, valor_num: null, ordem: 100 - idade,
    });
  }

  for (const e of d.eventos) {
    const ini = ymdOf(e.data_inicio);
    if (!ini) continue;
    const delta = diffDiasYMD(hoje, ini);
    if (delta < 0 || delta > horizonte) continue;
    out.push({
      tipo: 'evento', titulo: eventoLabel(e),
      sub: delta === 0 ? 'É hoje' : `Em ${delta} dia(s)`,
      link: LINK_POR_ESCOPO.evento, urgencia: delta <= 1 ? 'alerta' : 'info',
      data: ini, valor_num: e.valor_total_num != null ? Number(e.valor_total_num) : null, ordem: delta,
    });
  }

  for (const l of d.licencas) {
    const val = ymdOf(l.validade);
    if (!val) continue;
    const st = norm(l.status);
    if (st === 'nao_aplicavel' || st === 'cancelada' || st === 'dispensada') continue;
    const delta = diffDiasYMD(hoje, val);
    const aviso = Number(l.dias_aviso) || 30;
    if (delta < -30 || delta > aviso) continue;
    out.push({
      tipo: 'licenca', titulo: l.titulo || l.tipo || 'Licença',
      sub: delta < 0 ? `Vencida há ${Math.abs(delta)} dia(s)` : delta === 0 ? 'Vence hoje' : `Vence em ${delta} dia(s)`,
      link: LINK_POR_ESCOPO.licenca, urgencia: delta < 0 ? 'critico' : delta <= 15 ? 'alerta' : 'info',
      data: val, valor_num: null, ordem: delta,
    });
  }

  return out.sort((a, b) => a.ordem - b.ordem);
}

// ── Agregados do log / notificações ──────────────────────────────────────────
export function agregadoLog(logs: AutomacaoLog[]): {
  total: number; sucesso: number; falha: number; porCanal: Record<string, number>;
} {
  const porCanal: Record<string, number> = {};
  let sucesso = 0, falha = 0;
  for (const l of logs) {
    if (l.sucesso) sucesso++; else falha++;
    const k = l.canal || 'app';
    porCanal[k] = (porCanal[k] || 0) + 1;
  }
  return { total: logs.length, sucesso, falha, porCanal };
}

export function contarNaoLidas(notifs: Notificacao[]): number {
  return notifs.reduce((s, n) => s + (n.lida ? 0 : 1), 0);
}

// ── Biblioteca de receitas (1 clique) ─────────────────────────────────────────
export type Receita = {
  id: string; nome: string; desc: string; emoji: string;
  gatilho: Gatilho; condicao: Condicao; acao: Acao; acao_config: AcaoConfig;
};

export const RECEITAS: Receita[] = [
  {
    id: 'lembrete-parcela', nome: 'Lembrete de parcela a vencer', emoji: '💳',
    desc: 'Avisa você 3 dias antes de cada parcela vencer.',
    gatilho: 'parcela_vence', condicao: { dias: 3 }, acao: 'notificar',
    acao_config: { destinatario: 'dono', urgencia: 'alerta', titulo: 'Parcela a vencer — {{evento}}', mensagem: 'A parcela de {{evento}} vence em {{dias}} dia(s) ({{data}}), valor {{valor}}.' },
  },
  {
    id: 'cobranca-atraso', nome: 'Cobrança de atraso', emoji: '⏰',
    desc: 'Prepara um WhatsApp ao cliente 1 dia após a parcela vencer.',
    gatilho: 'parcela_atrasa', condicao: { dias: 1 }, acao: 'enviar_whatsapp',
    acao_config: { destinatario: 'cliente', urgencia: 'critico', titulo: 'Parcela em atraso', mensagem: 'Olá {{cliente}}! Notamos que a parcela de {{evento}} (venc. {{data}}, {{valor}}) está em aberto. Podemos ajudar a regularizar?' },
  },
  {
    id: 'contrato-pendente', nome: 'Contrato pendente há 48h', emoji: '✍️',
    desc: 'Avisa você quando um contrato enviado fica 2 dias sem assinatura.',
    gatilho: 'contrato_nao_assinado', condicao: { dias: 2 }, acao: 'notificar',
    acao_config: { destinatario: 'dono', urgencia: 'alerta', titulo: 'Contrato sem assinatura', mensagem: '{{titulo}} ({{evento}}) foi enviado há {{dias}} dias e ainda não foi assinado.' },
  },
  {
    id: 'pos-evento-agradecimento', nome: 'Agradecimento pós-evento', emoji: '💌',
    desc: 'Envia um e-mail de agradecimento ao cliente 1 dia após o evento.',
    gatilho: 'x_dias_apos_evento', condicao: { dias: 1 }, acao: 'enviar_email',
    acao_config: { destinatario: 'cliente', urgencia: 'sucesso', titulo: 'Obrigado, {{cliente}}!', mensagem: 'Oi {{cliente}}!\n\nFoi uma alegria receber {{evento}} na {{empresa}}. Esperamos que tenha sido tudo o que você imaginou.\n\nQualquer coisa, é só responder este e-mail.\n\nCom carinho,\n{{empresa}}' },
  },
  {
    id: 'pesquisa-pos-evento', nome: 'Lembrete: enviar pesquisa pós-evento', emoji: '📋',
    desc: 'Lembra você de enviar a pesquisa 2 dias após o evento.',
    gatilho: 'x_dias_apos_evento', condicao: { dias: 2 }, acao: 'criar_tarefa',
    acao_config: { destinatario: 'dono', urgencia: 'info', titulo: 'Enviar pesquisa — {{evento}}', mensagem: 'Combine o pós-venda de {{evento}}: dispare a pesquisa de satisfação e registre o feedback.' },
  },
  {
    id: 'aniversario', nome: 'Parabéns de aniversário', emoji: '🥳',
    desc: 'Envia um e-mail de feliz aniversário ao cliente no dia.',
    gatilho: 'aniversario_cliente', condicao: { dias: 0 }, acao: 'enviar_email',
    acao_config: { destinatario: 'cliente', urgencia: 'sucesso', titulo: 'Feliz aniversário, {{cliente}}! 🎉', mensagem: 'Olá {{cliente}},\n\nToda a equipe da {{empresa}} deseja um feliz aniversário! Que seu dia seja cheio de bons momentos.\n\nUm abraço,\n{{empresa}}' },
  },
  {
    id: 'licenca-vencer', nome: 'Alerta de licença a vencer', emoji: '📑',
    desc: 'Avisa você 30 dias antes de qualquer licença/alvará vencer.',
    gatilho: 'licenca_a_vencer', condicao: { dias: 30 }, acao: 'notificar',
    acao_config: { destinatario: 'dono', urgencia: 'alerta', titulo: 'Licença a vencer — {{titulo}}', mensagem: '{{titulo}} vence em {{dias}} dias ({{data}}). Programe a renovação.' },
  },
  {
    id: 'briefing-pendente', nome: 'Briefing pendente 7 dias antes', emoji: '🗂️',
    desc: 'Lembra você de fechar o briefing 7 dias antes do evento.',
    gatilho: 'x_dias_antes_evento', condicao: { dias: 7 }, acao: 'criar_tarefa',
    acao_config: { destinatario: 'dono', urgencia: 'alerta', titulo: 'Briefing — {{evento}}', mensagem: 'Faltam {{dias}} dias para {{evento}}. Confirme o briefing, a equipe e os fornecedores na Produção.' },
  },
  {
    id: 'feedback-negativo', nome: 'Feedback negativo → tratativa', emoji: '🚨',
    desc: 'Alerta você imediatamente quando chega um feedback com nota baixa.',
    gatilho: 'feedback_negativo', condicao: { nota_max: 2 }, acao: 'notificar',
    acao_config: { destinatario: 'dono', urgencia: 'critico', titulo: 'Feedback negativo — {{evento}}', mensagem: '{{cliente}} avaliou {{evento}} com nota {{nota}}. Abra uma tratativa e responda rápido.' },
  },
  {
    id: 'boas-vindas-evento', nome: 'Boas-vindas a novo evento', emoji: '🎉',
    desc: 'Notifica você quando um novo evento entra no funil.',
    gatilho: 'evento_criado', condicao: {}, acao: 'notificar',
    acao_config: { destinatario: 'dono', urgencia: 'info', titulo: 'Novo evento — {{evento}}', mensagem: '{{evento}} entrou no funil. Dê o primeiro passo do atendimento.' },
  },
];

// ── Payload da receita → linha de `automacoes` (sem usuario_id/id) ────────────
export function receitaParaAutomacao(r: Receita): Pick<Automacao, 'nome' | 'gatilho' | 'condicao' | 'acao' | 'acao_config' | 'ativo'> {
  return { nome: r.nome, gatilho: r.gatilho, condicao: r.condicao, acao: r.acao, acao_config: r.acao_config, ativo: true };
}
