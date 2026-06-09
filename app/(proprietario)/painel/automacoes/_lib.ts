// _lib — tipos, normalizadores, queries e wrappers de API só do módulo
// Automações & Notificações (/painel/automacoes). A lógica de domínio (seletores,
// catálogos, pendências, validação) vive no motor PURO lib/automacoes.ts. Aqui
// ficam: o contexto compartilhado entre as abas, o CRUD via RLS, os wrappers da
// /api/automacoes e as cargas das fontes (eventos/parcelas/contratos/licenças)
// que alimentam "pendências do dia". Regra de ouro: NADA de "R$"/data formatada
// aqui — só dados crus; a formatação fica em lib/format, nos componentes.

import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import {
  type Automacao, type Notificacao, type AutomacaoLog, type DadosSelecao,
  type EventoLite, type ParcelaLite, type ContratoLite, type LicencaLite,
  type Gatilho, type Acao, type Condicao, type AcaoConfig,
} from '@/lib/automacoes';

// ── Contexto compartilhado (page → abas) ─────────────────────────────────────
export type AutomacoesCtx = {
  userId: string;
  plano: string;
  empresa: string;
  automacoes: Automacao[];
  notificacoes: Notificacao[];
  logs: AutomacaoLog[];
  dados: DadosSelecao;                         // fontes p/ pendências do dia
  propriedades: { id: number; nome: string }[];
  tiposEvento: string[];
  statusEvento: string[];
  hoje: string;                                // YMD
  reloadAutomacoes: () => Promise<void>;
  reloadNotificacoes: () => Promise<void>;
  reloadLogs: () => Promise<void>;
};

// ── Selects ──────────────────────────────────────────────────────────────────
export const SEL_AUTO = 'id,usuario_id,nome,gatilho,condicao,acao,acao_config,ativo,ultima_exec,n_exec,criado_em,atualizado_em';
export const SEL_NOTIF = 'id,usuario_id,tipo,titulo,corpo,link,urgencia,origem,lida,criado_em';
export const SEL_LOG = 'id,usuario_id,automacao_id,gatilho,acao,alvo_tipo,alvo_id,alvo_label,dedup_key,canal,sucesso,detalhe,criado_em';
const SEL_EVENTO = 'id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id,criado_em';

// ── Normalizadores (banco → tipos do motor) ──────────────────────────────────
function obj(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}; }
const s = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normAutomacao(r: any): Automacao {
  return {
    id: String(r.id), usuario_id: r.usuario_id ?? '', nome: r.nome ?? '',
    gatilho: (r.gatilho ?? 'evento_criado') as Gatilho, condicao: obj(r.condicao) as Condicao,
    acao: (r.acao ?? 'notificar') as Acao, acao_config: obj(r.acao_config) as AcaoConfig,
    ativo: r.ativo !== false, ultima_exec: r.ultima_exec ?? null, n_exec: Number(r.n_exec) || 0,
    criado_em: r.criado_em ?? '', atualizado_em: r.atualizado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normNotificacao(r: any): Notificacao {
  return {
    id: String(r.id), usuario_id: r.usuario_id ?? '', tipo: r.tipo ?? 'sistema', titulo: r.titulo ?? '',
    corpo: r.corpo ?? null, link: r.link ?? null, urgencia: (r.urgencia ?? 'info'), origem: r.origem ?? null,
    lida: !!r.lida, criado_em: r.criado_em ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normLog(r: any): AutomacaoLog {
  return {
    id: String(r.id), usuario_id: r.usuario_id ?? '', automacao_id: r.automacao_id ?? null,
    gatilho: r.gatilho ?? '', acao: r.acao ?? '', alvo_tipo: r.alvo_tipo ?? null, alvo_id: r.alvo_id ?? null,
    alvo_label: r.alvo_label ?? null, dedup_key: r.dedup_key ?? '', canal: r.canal ?? null,
    sucesso: !!r.sucesso, detalhe: r.detalhe ?? null, criado_em: r.criado_em ?? '',
  };
}

// ── Cargas das fontes (pendências do dia) ────────────────────────────────────
export async function carregarFontes(uid: string): Promise<DadosSelecao> {
  const [evRes, pcRes, ctRes, licRes] = await Promise.all([
    sb.from('clientes_eventos').select(SEL_EVENTO).eq('usuario_id', uid),
    sb.from('parcelas').select('id,evento_id,valor,vencimento,status,pago_em').eq('usuario_id', uid),
    sb.from('contratos').select('id,evento_id,cliente_id,titulo,numero,status,criado_em,atualizado_em').eq('usuario_id', uid),
    sb.from('licencas').select('id,titulo,tipo,validade,status,dias_aviso,propriedade_id,evento_id').eq('usuario_id', uid),
  ]);
  const eventos: EventoLite[] = ((evRes.data || []) as Record<string, unknown>[]).map((e) => ({
    id: String(e.id), nome_evento: s(e.nome_evento), quem_contratou: s(e.quem_contratou), tipo_evento: s(e.tipo_evento),
    status: s(e.status), data_inicio: s(e.data_inicio), data_fim: s(e.data_fim), valor_total_num: num(e.valor_total_num),
    propriedade_id: e.propriedade_id == null ? null : Number(e.propriedade_id), email: null, telefone: null, criado_em: s(e.criado_em),
  }));
  const parcelas: ParcelaLite[] = ((pcRes.data || []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id), evento_id: s(p.evento_id), valor: num(p.valor), vencimento: s(p.vencimento), status: s(p.status), pago_em: s(p.pago_em),
  }));
  const contratos: ContratoLite[] = ((ctRes.data || []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id), evento_id: s(c.evento_id), cliente_id: s(c.cliente_id), titulo: s(c.titulo), numero: s(c.numero),
    status: s(c.status), criado_em: s(c.criado_em), atualizado_em: s(c.atualizado_em),
  }));
  const licencas: LicencaLite[] = licRes.error ? [] : ((licRes.data || []) as Record<string, unknown>[]).map((l) => ({
    id: String(l.id), titulo: s(l.titulo), tipo: s(l.tipo), validade: s(l.validade), status: s(l.status),
    dias_aviso: num(l.dias_aviso), propriedade_id: l.propriedade_id == null ? null : Number(l.propriedade_id), evento_id: s(l.evento_id),
  }));
  return { eventos, parcelas, contratos, licencas, clientes: [], feedbacks: [] };
}

// ── Payload do form → linha de `automacoes` (CRUD via RLS) ───────────────────
export type AutomacaoForm = {
  id: string | null;
  nome: string;
  gatilho: Gatilho;
  condicao: Condicao;
  acao: Acao;
  acao_config: AcaoConfig;
  ativo: boolean;
};

export function formToPayload(uid: string, f: AutomacaoForm): Record<string, unknown> {
  return {
    usuario_id: uid, nome: f.nome.trim(), gatilho: f.gatilho, condicao: f.condicao,
    acao: f.acao, acao_config: f.acao_config, ativo: f.ativo,
  };
}

/** Insere (sem id) ou atualiza (com id) a automação. Devolve o id ou null. */
export async function salvarAutomacao(uid: string, f: AutomacaoForm): Promise<string | null> {
  const payload = formToPayload(uid, f);
  if (f.id) {
    const { error } = await sb.from('automacoes').update(payload).eq('id', f.id);
    return error ? null : f.id;
  }
  const { data, error } = await sb.from('automacoes').insert(payload).select('id').single();
  return error || !data ? null : String(data.id);
}

export async function toggleAtivo(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await sb.from('automacoes').update({ ativo }).eq('id', id);
  return !error;
}
export async function excluirAutomacao(id: string): Promise<boolean> {
  const { error } = await sb.from('automacoes').delete().eq('id', id);
  return !error;
}

/** Ativa uma receita: cria a automação a partir do modelo. Devolve o id. */
export async function ativarReceita(uid: string, r: { nome: string; gatilho: Gatilho; condicao: Condicao; acao: Acao; acao_config: AcaoConfig }): Promise<string | null> {
  const { data, error } = await sb.from('automacoes').insert({
    usuario_id: uid, nome: r.nome, gatilho: r.gatilho, condicao: r.condicao, acao: r.acao, acao_config: r.acao_config, ativo: true,
  }).select('id').single();
  return error || !data ? null : String(data.id);
}

// ── Notificações (central in-app via RLS) ────────────────────────────────────
export async function marcarLida(id: string, lida = true): Promise<boolean> {
  const { error } = await sb.from('notificacoes').update({ lida }).eq('id', id);
  return !error;
}
export async function marcarTodasLidas(uid: string): Promise<boolean> {
  const { error } = await sb.from('notificacoes').update({ lida: true }).eq('usuario_id', uid).eq('lida', false);
  return !error;
}
export async function excluirNotificacao(id: string): Promise<boolean> {
  const { error } = await sb.from('notificacoes').delete().eq('id', id);
  return !error;
}

// ── Wrappers da /api/automacoes ──────────────────────────────────────────────
type Json = Record<string, unknown>;
async function postApi(payload: Json): Promise<Json> {
  try {
    const res = await fetch('/api/automacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ error: 'Resposta inválida.' }));
  } catch (e) { return { error: e instanceof Error ? e.message : 'Falha de rede.' }; }
}
export function apiPrevia(automacao: Partial<Automacao>) { return postApi({ action: 'previa', automacao }); }
export function apiTestar(id: string) { return postApi({ action: 'testar', id }); }
export function apiProcessar() { return postApi({ action: 'processar' }); }
