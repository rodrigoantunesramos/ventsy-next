// Núcleo de EXECUÇÃO de Automações — SERVER-ONLY (service-role + SMTP).
// Compartilhado pela rota manual (app/api/automacoes: testar/processar/prévia) e
// pelo processador diário (app/api/cron/automacoes). Carrega o estado atual do
// dono, roda os seletores PUROS de lib/automacoes para descobrir o que dispara
// HOJE, DEDUPLICA via `automacoes_log` (1 disparo por automação×alvo×dia) e
// executa a ação (in-app/e-mail/WhatsApp/mover-funil), formatando moeda/data com
// lib/format nas preferências do dono — sem "R$" hardcoded.

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, emailConfigurado } from '@/lib/email';
import {
  setFormatPrefs, formatMoney, formatDate, type Currency, type Locale,
} from '@/lib/format';
import {
  type Automacao, type DadosSelecao, type Disparo, type Urgencia,
  selecionarDisparos, interpolar, dedupKey, bucketDia, waLink,
  URGENCIA_GATILHO, TIPO_POR_ESCOPO, soDigitos, emailValido,
} from '@/lib/automacoes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

const LOCALE_BY_IDIOMA: Record<string, Locale> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const MAX_POR_AUTOMACAO = 200;      // alvos por regra por execução (trava anti-runaway)
const LIMITE_EMAIL: Record<string, number> = { basico: 0, pro: 400, ultra: 4000 }; // e-mails/execução

// ── Contexto do dono (empresa, e-mail, i18n) ──────────────────────────────────
export type Contexto = {
  empresa: string;
  emailDono: string | null;
  plano: string;
  locale: Locale;
  currency: Currency;
  timeZone: string | undefined;
  optOut: Set<string>;     // e-mails (lower) que pediram opt-out (descadastros)
};

function pickStr(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const k of keys) { const v = obj?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
  return '';
}

async function carregarContexto(uid: string): Promise<Contexto> {
  let empresa = '', emailDono: string | null = null;
  let locale: Locale = 'pt-BR', currency: Currency = 'BRL', timeZone: string | undefined;

  try {
    const { data: cfg } = await admin.from('empresa_config')
      .select('fantasia, razao_social, idioma, moeda, fuso, contatos').eq('usuario_id', uid).maybeSingle();
    if (cfg) {
      empresa = pickStr(cfg, ['fantasia', 'razao_social']);
      locale = LOCALE_BY_IDIOMA[String(cfg.idioma || 'pt')] || 'pt-BR';
      if (cfg.moeda) currency = cfg.moeda as Currency;
      if (cfg.fuso) timeZone = String(cfg.fuso);
      emailDono = pickStr(cfg.contatos as Record<string, unknown>, ['email']) || null;
    }
  } catch { /* sem empresa_config */ }

  if (!empresa) {
    try { const { data: u } = await admin.from('usuarios').select('nome').eq('id', uid).maybeSingle(); empresa = pickStr(u, ['nome']); } catch { /* opcional */ }
  }
  if (!emailDono) {
    try { const { data } = await admin.auth.admin.getUserById(uid); emailDono = data?.user?.email ?? null; } catch { /* opcional */ }
  }

  let plano = 'basico';
  try {
    const { data: a } = await admin.from('assinaturas').select('plano_ativo, plano').eq('usuario_id', uid).maybeSingle();
    plano = (a?.plano_ativo || a?.plano || 'basico').toString().toLowerCase();
  } catch { /* opcional */ }

  const optOut = new Set<string>();
  try {
    const { data } = await admin.from('descadastros').select('contato').eq('usuario_id', uid).eq('canal', 'email');
    for (const d of (data || []) as { contato: string }[]) optOut.add((d.contato || '').trim().toLowerCase());
  } catch { /* sem tabela descadastros */ }

  return { empresa, emailDono, plano, locale, currency, timeZone, optOut };
}

// ── Dados-fonte (defensivo: tabela ausente → lista vazia) ─────────────────────
async function listar(tabela: string, uid: string): Promise<Record<string, unknown>[]> {
  try {
    const { data } = await admin.from(tabela).select('*').eq('usuario_id', uid);
    return (data || []) as Record<string, unknown>[];
  } catch { return []; }
}
const s = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

export async function carregarDados(uid: string): Promise<DadosSelecao> {
  const [evs, pcs, ctrs, cls, lics, fbs] = await Promise.all([
    listar('clientes_eventos', uid), listar('parcelas', uid), listar('contratos', uid),
    listar('clientes', uid), listar('licencas', uid), listar('feedbacks', uid),
  ]);
  return {
    eventos: evs.map((e) => ({
      id: String(e.id), nome_evento: s(e.nome_evento), quem_contratou: s(e.quem_contratou),
      tipo_evento: s(e.tipo_evento), status: s(e.status), data_inicio: s(e.data_inicio), data_fim: s(e.data_fim),
      valor_total_num: n(e.valor_total_num), propriedade_id: e.propriedade_id == null ? null : Number(e.propriedade_id),
      email: s(e.email), telefone: s(e.telefone ?? e.whatsapp ?? e.celular), criado_em: s(e.criado_em),
    })),
    parcelas: pcs.map((p) => ({
      id: String(p.id), evento_id: s(p.evento_id), valor: n(p.valor ?? p.valor_num),
      vencimento: s(p.vencimento), status: s(p.status), pago_em: s(p.pago_em),
    })),
    contratos: ctrs.map((c) => ({
      id: String(c.id), evento_id: s(c.evento_id), cliente_id: s(c.cliente_id), titulo: s(c.titulo),
      numero: s(c.numero), status: s(c.status), criado_em: s(c.criado_em), atualizado_em: s(c.atualizado_em),
    })),
    clientes: cls.map((c) => ({
      id: String(c.id), nome: s(c.nome), email: s(c.email), whatsapp: s(c.whatsapp), telefone: s(c.telefone),
      aniversario: s(c.aniversario ?? c.data_nascimento),
    })),
    licencas: lics.map((l) => ({
      id: String(l.id), titulo: s(l.titulo), tipo: s(l.tipo), validade: s(l.validade), status: s(l.status),
      dias_aviso: n(l.dias_aviso), propriedade_id: l.propriedade_id == null ? null : Number(l.propriedade_id),
      evento_id: s(l.evento_id),
    })),
    feedbacks: fbs.map((f) => ({
      id: String(f.id), evento_id: s(f.evento_id), cliente_id: s(f.cliente_id),
      autor_nome: s(f.autor_nome ?? f.autor ?? f.nome), nota_geral: n(f.nota_geral ?? f.nota), criado_em: s(f.criado_em),
    })),
  };
}

// ── Variáveis enriquecidas (com moeda/data formatadas pela pref. do dono) ─────
function enriquecerVars(d: Disparo, ctx: Contexto): Record<string, string> {
  return {
    ...d.vars,
    empresa: ctx.empresa || 'Ventsy',
    valor: d.valor_num != null ? formatMoney(d.valor_num, { currency: ctx.currency, locale: ctx.locale }) : '',
    data: d.data_ref ? formatDate(d.data_ref, { locale: ctx.locale }) : '',
  };
}

// ── E-mail HTML (cartão simples da marca) ─────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderEmail(titulo: string, corpo: string, empresa: string, link: string | null): string {
  const marca = empresa || 'Ventsy';
  const corpoHtml = escapeHtml(corpo).replace(/\n/g, '<br>');
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br').replace(/\/$/, '');
  const cta = link && link.startsWith('/')
    ? `<p style="text-align:center;margin:24px 0"><a href="${base}${link}" style="background:#ff385c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;display:inline-block">Abrir na Ventsy</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;font-weight:700;color:#ff385c">${escapeHtml(marca)}</div>
      <div style="background:#fff;border-radius:18px;padding:26px;margin-top:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);font-size:15px;line-height:1.6;color:#333">
        ${titulo ? `<div style="font-size:17px;font-weight:700;color:#0d0d0d;margin-bottom:10px">${escapeHtml(titulo)}</div>` : ''}
        ${corpoHtml}
        ${cta}
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">Mensagem automática da ${escapeHtml(marca)} via Ventsy.</p>
    </div>
  </body></html>`;
}

// ── Persistência: notificação in-app ──────────────────────────────────────────
async function inserirNotificacao(uid: string, row: {
  tipo: string; titulo: string; corpo: string | null; link: string | null; urgencia: Urgencia; origem: string | null;
}): Promise<boolean> {
  try {
    const { error } = await admin.from('notificacoes').insert({ usuario_id: uid, lida: false, ...row });
    return !error;
  } catch { return false; }
}

// ── Execução de UMA ação para UM alvo ─────────────────────────────────────────
type AcaoResultado = { ok: boolean; canal: string; detalhe: string | null };

async function executarAcao(
  uid: string, a: Automacao, d: Disparo, ctx: Contexto, contadorEmail: { n: number; limite: number },
): Promise<AcaoResultado> {
  const vars = enriquecerVars(d, ctx);
  const urgencia = (a.acao_config.urgencia || URGENCIA_GATILHO[a.gatilho] || 'info') as Urgencia;
  const link = a.acao_config.link || d.link || null;
  const titulo = interpolar(a.acao_config.titulo || a.nome, vars) || a.nome;
  const corpo = interpolar(a.acao_config.mensagem || '', vars);
  const origem = `automacao:${a.id}`;
  const tipoNotif = a.acao === 'criar_tarefa' ? 'tarefa' : TIPO_POR_ESCOPO[d.alvo_tipo];

  // notificar / criar_tarefa → sino in-app (sempre disponível)
  if (a.acao === 'notificar' || a.acao === 'criar_tarefa') {
    const ok = await inserirNotificacao(uid, { tipo: tipoNotif, titulo, corpo: corpo || null, link, urgencia, origem });
    return { ok, canal: 'app', detalhe: ok ? null : 'falha ao gravar notificação' };
  }

  // mover_funil → muda o status do evento
  if (a.acao === 'mover_funil') {
    const novo = (a.acao_config.novo_status || '').trim();
    if (!d.evento_id || !novo) return { ok: false, canal: 'funil', detalhe: 'sem evento/status' };
    try {
      const { error } = await admin.from('clientes_eventos').update({ status: novo }).eq('id', d.evento_id).eq('usuario_id', uid);
      if (error) return { ok: false, canal: 'funil', detalhe: error.message };
    } catch (e) { return { ok: false, canal: 'funil', detalhe: String((e as Error).message).slice(0, 200) }; }
    // deixa um rastro no sino para o dono ver o movimento
    await inserirNotificacao(uid, { tipo: 'evento', titulo: titulo || `Evento movido para "${novo}"`, corpo: corpo || null, link, urgencia: 'info', origem });
    return { ok: true, canal: 'funil', detalhe: `→ ${novo}` };
  }

  // enviar_whatsapp → prepara o link wa.me e surge como notificação (degrade)
  if (a.acao === 'enviar_whatsapp') {
    const wa = waLink(d.contato_whatsapp, corpo);
    if (!wa) {
      const ok = await inserirNotificacao(uid, { tipo: tipoNotif, titulo: `${titulo} (sem WhatsApp)`, corpo: corpo || null, link, urgencia, origem });
      return { ok, canal: 'app', detalhe: 'cliente sem WhatsApp → notificado no app' };
    }
    const ok = await inserirNotificacao(uid, { tipo: 'tarefa', titulo: `WhatsApp: ${titulo}`, corpo: corpo || null, link: wa, urgencia, origem });
    return { ok, canal: 'whatsapp', detalhe: ok ? 'link pronto' : 'falha ao gravar' };
  }

  // enviar_email → e-mail (dono ou cliente), com degrade para in-app
  if (a.acao === 'enviar_email') {
    const paraCliente = a.acao_config.destinatario === 'cliente';
    const destino = paraCliente ? d.contato_email : ctx.emailDono;
    const planoEmail = (LIMITE_EMAIL[ctx.plano] ?? 0) > 0;
    const degradarApp = async (motivo: string): Promise<AcaoResultado> => {
      const ok = await inserirNotificacao(uid, { tipo: tipoNotif, titulo, corpo: corpo || null, link, urgencia, origem });
      return { ok, canal: 'app', detalhe: `${motivo} → notificado no app` };
    };
    if (!planoEmail) return degradarApp('e-mail é Pro+');
    if (!emailConfigurado()) return degradarApp('SMTP não configurado');
    if (!emailValido(destino)) return degradarApp('sem e-mail de destino');
    if (paraCliente && ctx.optOut.has(destino!.trim().toLowerCase())) {
      return { ok: false, canal: 'email', detalhe: 'destinatário descadastrado' };
    }
    if (contadorEmail.n >= contadorEmail.limite) return degradarApp('limite de e-mails do plano');
    try {
      const r = await sendEmail({ to: destino!, subject: titulo, html: renderEmail(titulo, corpo, ctx.empresa, paraCliente ? null : link) });
      if (r.ok) { contadorEmail.n++; return { ok: true, canal: 'email', detalhe: paraCliente ? 'ao cliente' : 'ao dono' }; }
      return degradarApp('falha SMTP');
    } catch (e) { return { ok: false, canal: 'email', detalhe: String((e as Error).message).slice(0, 200) }; }
  }

  return { ok: false, canal: 'app', detalhe: 'ação desconhecida' };
}

// ── Orquestração ──────────────────────────────────────────────────────────────
export type ExecOpts = { dry?: boolean };
export type ExecResultado = {
  automacoes: number; alvos: number; executados: number; pulados: number; falhas: number;
  porAcao: Record<string, number>;
};

/** Executa um conjunto de automações do dono `uid` para a data `hoje` (YMD). */
export async function executarAutomacoes(
  uid: string, automacoes: Automacao[], hoje: string, opts: ExecOpts = {},
): Promise<ExecResultado> {
  const res: ExecResultado = { automacoes: automacoes.length, alvos: 0, executados: 0, pulados: 0, falhas: 0, porAcao: {} };
  const ativas = automacoes.filter((a) => a.ativo);
  if (!ativas.length) return res;

  const ctx = await carregarContexto(uid);
  // Preferências de moeda/data do dono valem nas formatações abaixo.
  setFormatPrefs({ locale: ctx.locale, currency: ctx.currency, timeZone: ctx.timeZone });
  const dados = await carregarDados(uid);

  // Chaves de dedup já gravadas hoje (idempotência: não repete no mesmo dia).
  const bucket = bucketDia(hoje);
  const jaFeito = new Set<string>();
  try {
    const { data } = await admin.from('automacoes_log').select('dedup_key')
      .eq('usuario_id', uid).gte('criado_em', `${hoje}T00:00:00Z`);
    for (const l of (data || []) as { dedup_key: string }[]) jaFeito.add(l.dedup_key);
  } catch { /* log ausente → sem dedup nesta passada */ }

  const contadorEmail = { n: 0, limite: LIMITE_EMAIL[ctx.plano] ?? 0 };

  for (const a of ativas) {
    let disparos = selecionarDisparos(a, dados, hoje);
    if (disparos.length > MAX_POR_AUTOMACAO) disparos = disparos.slice(0, MAX_POR_AUTOMACAO);
    res.alvos += disparos.length;
    let execNesta = 0;

    for (const d of disparos) {
      const key = dedupKey(a.id, d.alvo_id, bucket);
      if (jaFeito.has(key)) { res.pulados++; continue; }
      if (opts.dry) { res.executados++; res.porAcao[a.acao] = (res.porAcao[a.acao] || 0) + 1; continue; }

      const r = await executarAcao(uid, a, d, ctx, contadorEmail);
      // Grava o log (a unique index em dedup_key é o backstop anti-duplicidade).
      try {
        await admin.from('automacoes_log').insert({
          usuario_id: uid, automacao_id: a.id, gatilho: a.gatilho, acao: a.acao,
          alvo_tipo: d.alvo_tipo, alvo_id: d.alvo_id, alvo_label: d.alvo_label,
          dedup_key: key, canal: r.canal, sucesso: r.ok, detalhe: r.detalhe,
        });
      } catch { /* conflito de unique = já feito por execução concorrente */ }
      jaFeito.add(key);

      if (r.ok) { res.executados++; execNesta++; res.porAcao[a.acao] = (res.porAcao[a.acao] || 0) + 1; }
      else res.falhas++;
    }

    if (!opts.dry && execNesta > 0) {
      try {
        await admin.from('automacoes').update({ ultima_exec: new Date().toISOString(), n_exec: (Number(a.n_exec) || 0) + execNesta }).eq('id', a.id);
      } catch { /* opcional */ }
    }
  }

  return res;
}

/** Prévia (dry, SEM dedup): só descreve os alvos que casariam HOJE com a regra. */
export async function previaAutomacao(uid: string, a: Automacao, hoje: string): Promise<{ total: number; amostra: { alvo_id: string; alvo_label: string; alvo_tipo: string }[] }> {
  const dados = await carregarDados(uid);
  const disparos = selecionarDisparos(a, dados, hoje);
  return {
    total: disparos.length,
    amostra: disparos.slice(0, 12).map((d) => ({ alvo_id: d.alvo_id, alvo_label: d.alvo_label, alvo_tipo: d.alvo_tipo })),
  };
}

/** YMD de hoje em UTC (alinhado ao pg_cron, que roda em UTC). */
export function hojeUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
