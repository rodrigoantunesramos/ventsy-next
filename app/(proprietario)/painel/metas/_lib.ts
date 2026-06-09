// _lib — modelo, queries, cálculo do REALIZADO e CRUD via RLS do módulo Metas.
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
//
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// crus; a formatação fica em lib/format, escolhida pela `unidade` da métrica. A
// matemática (período, run-rate, semáforo, OKR) vive em lib/metas (motor puro,
// testado) e é re-exportada abaixo para um import único nas abas.
//
// REUSO: receita/lucro/adimplência continuam em `metas_financeiras` (convenção do
// /painel/financeiro). Esta camada lê/grava aquela tabela para essas três e usa a
// nova `metas` para o resto. O realizado é calculado lendo as tabelas-fonte
// (lançamentos, clientes_eventos, parcelas, pesquisas_respostas, avaliacoes) —
// cada leitura degrada para null se a tabela ainda não existir.

import { supabaseAny as sb } from '@/lib/supabase';
import {
  type Periodo, type Area, type Granularidade, type Store,
  diasAte, metricaMeta, isMissingTable,
} from '@/lib/metas';

// Re-export do motor puro (as abas importam tudo daqui).
export * from '@/lib/metas';

/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const nid = (v: any): number | null => (v == null ? null : Number(v));

// ── Linhas do banco (ver docs/sql/metas.sql) ─────────────────────────────────
export type MetaRow = {
  id: string;
  area: Area;
  metrica: string;
  periodo: string;            // chave absoluta 'YYYY-MM' | 'YYYY-Qn' | 'YYYY'
  alvo_num: number;
  realizado_num: number | null;
  responsavel: string | null;
  propriedade_id: number | null;
  obs: string | null;
};
export type OkrRow = {
  id: string;
  objetivo: string;
  trimestre: string;
  krs: unknown;               // jsonb → normalizarKRs
  obs: string | null;
};
export type MetaFinanceira = { metrica: string; periodo: string; alvo: number };
export type PropriedadeLite = { id: number; nome: string };

export const SEL_META = 'id,area,metrica,periodo,alvo_num,realizado_num,responsavel,propriedade_id,obs';
export const SEL_OKR = 'id,objetivo,trimestre,krs,obs';

export function mapMeta(r: any): MetaRow {
  return {
    id: String(r.id),
    area: (r.area || 'comercial') as Area,
    metrica: String(r.metrica || ''),
    periodo: String(r.periodo || ''),
    alvo_num: n(r.alvo_num),
    realizado_num: r.realizado_num == null ? null : n(r.realizado_num),
    responsavel: r.responsavel ?? null,
    propriedade_id: nid(r.propriedade_id),
    obs: r.obs ?? null,
  };
}
export const mapOkr = (r: any): OkrRow => ({
  id: String(r.id), objetivo: String(r.objetivo || ''), trimestre: String(r.trimestre || ''),
  krs: r.krs ?? [], obs: r.obs ?? null,
});
export const mapProp = (r: any): PropriedadeLite => ({ id: Number(r.id), nome: r.nome || 'Espaço' });
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Hoje (YYYY-MM-DD) — entra no motor puro como parâmetro ───────────────────
export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Classes de input padrão (igual ao resto do painel) ───────────────────────
export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Status de eventos no funil (espelha o Financeiro) ────────────────────────
const STATUS_CONTRATADO = new Set(['contratado', 'briefing', 'pronto', 'montagem', 'finalizado', 'pos']);
const STATUS_FINALIZADO = new Set(['finalizado', 'pos']);

// ── REALIZADO automático ──────────────────────────────────────────────────────
// Lê cada fonte escopada por usuario_id (+ propriedade quando aplicável) na janela
// do período e devolve metrica→valor. `null` = fonte ausente OU sem base para a
// razão (ex.: margem sem receita). Cada leitura é guardada contra tabela ausente.
export type Realizado = Record<string, number | null>;

type EventoRow = {
  status: string | null; data_inicio: string | null; data_fim: string | null;
  criado_em: string | null; valor_total_num: number | null; propriedade_id: number | null;
};
type LancRow = { tipo: string; valor: number; categoria: string | null; status: string; data: string };

export async function computarRealizado(
  uid: string, periodo: Periodo, propriedadeId: number | null,
  propsCount: number, propIds: number[],
): Promise<Realizado> {
  const dIni = periodo.ini, dFim = periodo.fim;
  const tsIni = `${dIni}T00:00:00`, tsFim = `${dFim}T23:59:59`;
  const diasPeriodo = (diasAte(dFim, dIni) ?? 0) + 1;
  const out: Realizado = {};

  // 1) Financeiro (lançamentos) — receita/lucro/margem/adimplência/despesa/marketing
  let lq = sb.from('lancamentos').select('tipo,valor,categoria,status,data')
    .eq('usuario_id', uid).gte('data', dIni).lte('data', dFim);
  if (propriedadeId != null) lq = lq.eq('prop_id', propriedadeId);
  const lr = await lq;
  if (lr.error && isMissingTable(lr.error)) {
    for (const k of ['receita', 'lucro', 'margem', 'adimplencia', 'despesa', 'cac']) out[k] = null;
  } else {
    const rows = (lr.data || []) as LancRow[];
    const receita = rows.filter((r) => r.tipo === 'receita').reduce((s, r) => s + n(r.valor), 0);
    const despesa = rows.filter((r) => r.tipo === 'despesa').reduce((s, r) => s + n(r.valor), 0);
    const lucro = receita - despesa;
    const pagos = rows.filter((r) => r.status === 'pago').length;
    const despMkt = rows.filter((r) => r.tipo === 'despesa' && (r.categoria || '').toLowerCase().includes('marketing'))
      .reduce((s, r) => s + n(r.valor), 0);
    out.receita = receita;
    out.lucro = lucro;
    out.despesa = despesa;
    out.margem = receita > 0 ? lucro / receita : null;                 // fração
    out.adimplencia = rows.length > 0 ? pagos / rows.length : null;     // fração
    out._despMkt = despMkt; // intermediário p/ CAC (resolvido abaixo)
  }

  // 2) CRM (clientes_eventos) — eventos/leads/conversão/ticket/receita contratada/ocupação
  let eq = sb.from('clientes_eventos')
    .select('status,data_inicio,data_fim,criado_em,valor_total_num,propriedade_id')
    .eq('usuario_id', uid);
  if (propriedadeId != null) eq = eq.eq('propriedade_id', propriedadeId);
  const er = await eq;
  if (er.error && isMissingTable(er.error)) {
    for (const k of ['eventos', 'eventos_realizados', 'leads', 'conversao', 'ticket_medio', 'receita_contratada', 'ocupacao']) out[k] = null;
  } else {
    const evs = (er.data || []) as EventoRow[];
    const noPeriodo = (d: string | null) => !!d && d >= dIni && d <= dFim;
    const criadoNoPeriodo = (d: string | null) => !!d && d.slice(0, 10) >= dIni && d.slice(0, 10) <= dFim;
    const contratados = evs.filter((e) => STATUS_CONTRATADO.has(e.status || '') && noPeriodo(e.data_inicio));
    const realizados = evs.filter((e) => STATUS_FINALIZADO.has(e.status || '') && noPeriodo(e.data_inicio));
    const leads = evs.filter((e) => criadoNoPeriodo(e.criado_em));
    const recContratada = contratados.reduce((s, e) => s + n(e.valor_total_num), 0);
    out.eventos = contratados.length;
    out.eventos_realizados = realizados.length;
    out.leads = leads.length;
    out.receita_contratada = recContratada;
    out.ticket_medio = contratados.length > 0 ? recContratada / contratados.length : null;
    out.conversao = leads.length > 0 ? contratados.length / leads.length : null; // fração
    // Ocupação: dias-evento ocupados ÷ (espaços × dias do período). Proxy de planejamento.
    const denomProps = propriedadeId != null ? 1 : Math.max(1, propsCount);
    let diasOcupados = 0;
    for (const e of contratados.concat(realizados)) {
      if (!e.data_inicio) continue;
      const ini = e.data_inicio < dIni ? dIni : e.data_inicio;
      const fimRaw = e.data_fim && e.data_fim >= e.data_inicio ? e.data_fim : e.data_inicio;
      const fim = fimRaw > dFim ? dFim : fimRaw;
      diasOcupados += Math.max(0, (diasAte(fim, ini) ?? 0) + 1);
    }
    out.ocupacao = diasPeriodo > 0 ? Math.min(1, diasOcupados / (denomProps * diasPeriodo)) : null;
  }

  // 3) Pesquisas & NPS (pesquisas_respostas) — NPS padrão (-100..100)
  const pr = await sb.from('pesquisas_respostas').select('nps,categoria,criado_em')
    .eq('usuario_id', uid).gte('criado_em', tsIni).lte('criado_em', tsFim);
  if (pr.error && isMissingTable(pr.error)) {
    out.nps = null;
  } else {
    const resp = (pr.data || []) as { nps: number | null; categoria: string | null }[];
    const validas = resp.filter((r) => r.nps != null || r.categoria);
    if (validas.length === 0) out.nps = null;
    else {
      const cat = (r: { nps: number | null; categoria: string | null }) =>
        r.categoria || (r.nps == null ? 'neutro' : r.nps >= 9 ? 'promotor' : r.nps >= 7 ? 'neutro' : 'detrator');
      const promo = validas.filter((r) => cat(r) === 'promotor').length;
      const detr = validas.filter((r) => cat(r) === 'detrator').length;
      out.nps = Math.round(((promo - detr) / validas.length) * 100);
    }
  }

  // 4) Avaliações (avaliacoes) — média 1–5. NOTA: escopada por propriedade do dono.
  const alvoProps = propriedadeId != null ? [propriedadeId] : propIds;
  if (alvoProps.length === 0) {
    out.avaliacao = null;
  } else {
    const ar = await sb.from('avaliacoes').select('nota,criado_em,propriedade_id')
      .in('propriedade_id', alvoProps).gte('criado_em', tsIni).lte('criado_em', tsFim);
    if (ar.error && isMissingTable(ar.error)) out.avaliacao = null;
    else {
      const notas = ((ar.data || []) as { nota: number | null }[]).map((r) => n(r.nota)).filter((x) => x > 0);
      out.avaliacao = notas.length > 0 ? notas.reduce((s, x) => s + x, 0) / notas.length : null;
    }
  }

  // 5) CAC = gasto de marketing ÷ novos clientes (leads). Resolvido após 1 e 2.
  const despMkt = out._despMkt;
  delete out._despMkt;
  if (despMkt == null || out.leads == null) out.cac = null;
  else out.cac = out.leads > 0 ? despMkt / out.leads : (despMkt > 0 ? despMkt : 0);

  return out;
}

// ── CRUD via RLS (client) ─────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function criarMeta(row: Record<string, unknown>) {
  return sb.from('metas').insert(row).select(SEL_META).single();
}
export async function salvarMeta(id: string, patch: Record<string, unknown>) {
  return sb.from('metas').update(patch).eq('id', id).select(SEL_META).single();
}
export async function excluirMeta(id: string) {
  return sb.from('metas').delete().eq('id', id);
}
export async function criarOkr(row: Record<string, unknown>) {
  return sb.from('okrs').insert(row).select(SEL_OKR).single();
}
export async function salvarOkr(id: string, patch: Record<string, unknown>) {
  return sb.from('okrs').update(patch).eq('id', id).select(SEL_OKR).single();
}
export async function excluirOkr(id: string) {
  return sb.from('okrs').delete().eq('id', id);
}
// metas_financeiras: upsert pela mesma convenção do /painel/financeiro.
export async function upsertMetaFinanceira(uid: string, metrica: string, periodoGran: Granularidade, alvo: number) {
  return sb.from('metas_financeiras').upsert(
    { usuario_id: uid, metrica, periodo: periodoGran, alvo },
    { onConflict: 'usuario_id,metrica,periodo' },
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Onde o alvo de uma métrica é gravado (roteia o salvar). */
export function storeDaMetrica(metrica: string): Store {
  return metricaMeta(metrica).store;
}

// Conversão de unidade percentual entre metas_financeiras e o motor:
// o motor usa FRAÇÃO (0..1); metas_financeiras guarda adimplência em pontos
// percentuais (0..100) — convenção herdada do /painel/financeiro. Receita/lucro
// (moeda) passam direto. Mantém as duas páginas consistentes na mesma tabela.
export function finStoredToEngine(metrica: string, stored: number): number {
  return metrica === 'adimplencia' ? (Number(stored) || 0) / 100 : (Number(stored) || 0);
}
export function finEngineToStored(metrica: string, engine: number): number {
  return metrica === 'adimplencia' ? (Number(engine) || 0) * 100 : (Number(engine) || 0);
}

// ── Export CSV (genérico) ────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
