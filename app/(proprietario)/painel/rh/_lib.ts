'use client';

// _lib — modelo, catálogos, contexto e chamadas de API do hub de RH.
// Compartilhado pela shell (layout.tsx), pela visão geral (page.tsx) e por todas
// as sub-rotas (funcionarios/recrutamento/admissao/ferias/ponto/documentos/
// desligamento). Regra de ouro: NADA de "R$"/percentual/data formatada aqui — a
// formatação fica em lib/format (chamada nas páginas); a matemática vive nos
// motores puros lib/folha.ts (folha) e lib/rh.ts (ciclo de pessoas).

import { createContext, useContext } from 'react';
import { authHeaders } from '@/lib/supabase';
import type { EtapaCandidato, StatusValidade } from '@/lib/rh';

/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// ── Linhas do banco (ver docs/sql/rh.sql) ─────────────────────────────────────
export type BancoInfo = { banco?: string; agencia?: string; conta?: string; tipo?: string; pix?: string };
export type Funcionario = {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  salario: number;
  contrato: string;
  status: string;
  admissao: string | null;
  telefone: string | null;
  email: string | null;
  obs: string | null;
  cpf: string | null;
  rg: string | null;
  nascimento: string | null;
  foto_url: string | null;
  banco: BancoInfo;
  dependentes: number;
  jornada: string | null;
  centro_custo_id: string | null;
  gestor_id: number | null;
  desligado_em: string | null;
  motivo_desligamento: string | null;
  criado_em: string | null;
};
export type Vaga = {
  id: string; titulo: string; slug: string | null; departamento: string | null;
  tipo_contrato: string; salario_min: number | null; salario_max: number | null;
  descricao: string | null; requisitos: string | null; beneficios: string | null;
  local: string | null; status: 'aberta' | 'pausada' | 'fechada'; vagas: number; criado_em: string | null;
};
export type Candidato = {
  id: string; vaga_id: string | null; nome: string; email: string | null; telefone: string | null;
  curriculo_url: string | null; etapa: EtapaCandidato; nota: number | null; fonte: string | null;
  obs: string | null; ia_resumo: string | null; criado_em: string | null;
};
export type Documento = {
  id: string; equipe_id: number; tipo: string; nome: string | null; arquivo_url: string | null;
  validade: string | null; dias_aviso: number; status: 'valido' | 'pendente' | 'vencido'; obs: string | null; criado_em: string | null;
};
export type Ausencia = {
  id: string; equipe_id: number; tipo: 'ferias' | 'atestado' | 'licenca' | 'falta' | 'folga' | 'banco_horas';
  inicio: string | null; fim: string | null; dias: number;
  status: 'solicitada' | 'aprovada' | 'reprovada' | 'gozada'; saldo: number; obs: string | null;
  decidido_em: string | null; criado_em: string | null;
};
export type EventoFunc = {
  id: string; equipe_id: number; tipo: string; titulo: string; descricao: string | null;
  data: string; dados: Record<string, any>; criado_em: string | null;
};

// ── Selects ───────────────────────────────────────────────────────────────────
export const SEL_FUNC = 'id,nome,cargo,departamento,salario,contrato,status,admissao,telefone,email,obs,cpf,rg,nascimento,foto_url,banco,dependentes,jornada,centro_custo_id,gestor_id,desligado_em,motivo_desligamento,criado_em';
export const SEL_VAGA = 'id,titulo,slug,departamento,tipo_contrato,salario_min,salario_max,descricao,requisitos,beneficios,local,status,vagas,criado_em';
export const SEL_CAND = 'id,vaga_id,nome,email,telefone,curriculo_url,etapa,nota,fonte,obs,ia_resumo,criado_em';
export const SEL_DOC = 'id,equipe_id,tipo,nome,arquivo_url,validade,dias_aviso,status,obs,criado_em';
export const SEL_AUS = 'id,equipe_id,tipo,inicio,fim,dias,status,saldo,obs,decidido_em,criado_em';
export const SEL_EVT = 'id,equipe_id,tipo,titulo,descricao,data,dados,criado_em';

// ── Mapeadores (coerção defensiva) ────────────────────────────────────────────
export function mapFunc(r: any): Funcionario {
  return {
    id: Number(r.id), nome: r.nome || '', cargo: r.cargo ?? null, departamento: r.departamento ?? null,
    salario: n(r.salario), contrato: r.contrato || 'clt', status: r.status || 'ativo', admissao: r.admissao ?? null,
    telefone: r.telefone ?? null, email: r.email ?? null, obs: r.obs ?? null,
    cpf: r.cpf ?? null, rg: r.rg ?? null, nascimento: r.nascimento ?? null, foto_url: r.foto_url ?? null,
    banco: (r.banco && typeof r.banco === 'object') ? r.banco : {}, dependentes: n(r.dependentes),
    jornada: r.jornada ?? null, centro_custo_id: r.centro_custo_id ?? null,
    gestor_id: r.gestor_id != null ? Number(r.gestor_id) : null,
    desligado_em: r.desligado_em ?? null, motivo_desligamento: r.motivo_desligamento ?? null, criado_em: r.criado_em ?? null,
  };
}
export const mapVaga = (r: any): Vaga => ({
  id: String(r.id), titulo: r.titulo || '', slug: r.slug ?? null, departamento: r.departamento ?? null,
  tipo_contrato: r.tipo_contrato || 'clt', salario_min: r.salario_min != null ? n(r.salario_min) : null,
  salario_max: r.salario_max != null ? n(r.salario_max) : null, descricao: r.descricao ?? null,
  requisitos: r.requisitos ?? null, beneficios: r.beneficios ?? null, local: r.local ?? null,
  status: (r.status || 'aberta'), vagas: n(r.vagas) || 1, criado_em: r.criado_em ?? null,
});
export const mapCand = (r: any): Candidato => ({
  id: String(r.id), vaga_id: r.vaga_id ?? null, nome: r.nome || '', email: r.email ?? null, telefone: r.telefone ?? null,
  curriculo_url: r.curriculo_url ?? null, etapa: (r.etapa || 'triagem'), nota: r.nota != null ? n(r.nota) : null,
  fonte: r.fonte ?? null, obs: r.obs ?? null, ia_resumo: r.ia_resumo ?? null, criado_em: r.criado_em ?? null,
});
export const mapDoc = (r: any): Documento => ({
  id: String(r.id), equipe_id: Number(r.equipe_id), tipo: r.tipo || 'outro', nome: r.nome ?? null,
  arquivo_url: r.arquivo_url ?? null, validade: r.validade ?? null, dias_aviso: n(r.dias_aviso) || 30,
  status: (r.status || 'valido'), obs: r.obs ?? null, criado_em: r.criado_em ?? null,
});
export const mapAus = (r: any): Ausencia => ({
  id: String(r.id), equipe_id: Number(r.equipe_id), tipo: (r.tipo || 'ferias'), inicio: r.inicio ?? null, fim: r.fim ?? null,
  dias: n(r.dias), status: (r.status || 'solicitada'), saldo: n(r.saldo), obs: r.obs ?? null,
  decidido_em: r.decidido_em ?? null, criado_em: r.criado_em ?? null,
});
export const mapEvt = (r: any): EventoFunc => ({
  id: String(r.id), equipe_id: Number(r.equipe_id), tipo: r.tipo || 'nota', titulo: r.titulo || '', descricao: r.descricao ?? null,
  data: r.data || '', dados: (r.dados && typeof r.dados === 'object') ? r.dados : {}, criado_em: r.criado_em ?? null,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Catálogos (rótulos PT; i18n: extrair p/ dicionário) ───────────────────────
export const DEPARTAMENTOS = ['Operações', 'Comercial', 'Financeiro', 'Cozinha', 'Bar', 'Limpeza', 'Segurança', 'Administrativo', 'Marketing'];

// Funções típicas da operação de eventos (CLT fixo + freelancers).
export const FUNCOES_EVENTO = ['Garçom', 'Segurança', 'Recepcionista', 'Montador', 'Manobrista', 'Brigadista', 'Limpeza', 'Coordenação', 'Cozinheiro', 'Bartender', 'Maître'];

export const TIPO_CONTRATO_VAGA: { v: string; label: string }[] = [
  { v: 'clt', label: 'CLT' }, { v: 'horista', label: 'Horista' }, { v: 'mei', label: 'MEI/PJ' },
  { v: 'estagio', label: 'Estágio' }, { v: 'freelancer', label: 'Freelancer' },
];

export const TIPOS_DOC: { v: string; label: string }[] = [
  { v: 'rg', label: 'RG' }, { v: 'cpf', label: 'CPF' }, { v: 'ctps', label: 'CTPS' },
  { v: 'aso', label: 'ASO (exame)' }, { v: 'contrato', label: 'Contrato de trabalho' },
  { v: 'comprovante', label: 'Comprovante de residência' }, { v: 'certificacao', label: 'Certificação' },
  { v: 'nr', label: 'NR (treinamento)' }, { v: 'brigada', label: 'Brigada de incêndio' },
  { v: 'vigilante', label: 'Curso de vigilante' }, { v: 'manipulacao', label: 'Manipulação de alimentos' },
  { v: 'outro', label: 'Outro' },
];
export const DOC_LABEL = Object.fromEntries(TIPOS_DOC.map((t) => [t.v, t.label])) as Record<string, string>;

export const TIPOS_AUSENCIA: { v: string; label: string; cls: string }[] = [
  { v: 'ferias', label: 'Férias', cls: 'bg-blue-50 text-blue-700' },
  { v: 'atestado', label: 'Atestado', cls: 'bg-amber-50 text-amber-700' },
  { v: 'licenca', label: 'Licença', cls: 'bg-violet-50 text-violet-700' },
  { v: 'falta', label: 'Falta', cls: 'bg-red-50 text-red-700' },
  { v: 'folga', label: 'Folga', cls: 'bg-emerald-50 text-emerald-700' },
  { v: 'banco_horas', label: 'Banco de horas', cls: 'bg-sky-50 text-sky-700' },
];
export const AUS_BY = Object.fromEntries(TIPOS_AUSENCIA.map((t) => [t.v, t])) as Record<string, (typeof TIPOS_AUSENCIA)[number]>;

export const STATUS_AUSENCIA: { v: string; label: string; cls: string }[] = [
  { v: 'solicitada', label: 'Solicitada', cls: 'bg-amber-50 text-amber-700' },
  { v: 'aprovada', label: 'Aprovada', cls: 'bg-emerald-50 text-emerald-700' },
  { v: 'reprovada', label: 'Reprovada', cls: 'bg-red-50 text-red-700' },
  { v: 'gozada', label: 'Gozada', cls: 'bg-black/[0.06] text-ink-soft' },
];
export const STATUS_AUS_BY = Object.fromEntries(STATUS_AUSENCIA.map((t) => [t.v, t])) as Record<string, (typeof STATUS_AUSENCIA)[number]>;

export const ETAPA_CLS: Record<EtapaCandidato, string> = {
  triagem: 'bg-sky-50 text-sky-700', entrevista: 'bg-violet-50 text-violet-700', teste: 'bg-amber-50 text-amber-700',
  proposta: 'bg-blue-50 text-blue-700', contratado: 'bg-emerald-50 text-emerald-700', reprovado: 'bg-red-50 text-red-700',
};
export const VAGA_STATUS_CLS: Record<string, string> = {
  aberta: 'bg-emerald-50 text-emerald-700', pausada: 'bg-amber-50 text-amber-700', fechada: 'bg-black/[0.06] text-ink-soft',
};

// Semáforo de validade (espelha o motor lib/rh.statusValidade).
export const VAL_CLS: Record<StatusValidade, string> = {
  vencido: 'bg-red-50 text-red-700', critico: 'bg-orange-50 text-orange-700',
  atencao: 'bg-amber-50 text-amber-700', ok: 'bg-emerald-50 text-emerald-700', sem_validade: 'bg-black/[0.04] text-ink-muted',
};
export const VAL_LABEL: Record<StatusValidade, string> = {
  vencido: 'Vencido', critico: 'Vence em ≤7 dias', atencao: 'A vencer', ok: 'Em dia', sem_validade: 'Sem validade',
};

export const AVATAR_CORES = ['#0ca678', '#f59e0b', '#ff385c', '#8b5cf6', '#1a73e8', '#fb923c', '#14b8a6', '#ec4899'];
export const inicial = (nome: string): string => (nome || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
export const avatarCor = (seed: number): string => AVATAR_CORES[Math.abs(seed) % AVATAR_CORES.length];

// Classe de input padrão (igual ao resto do painel).
export const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// ── Setup / premium probing ───────────────────────────────────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table.
export function isMissingTable(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === 'PGRST205' || err?.code === '42P01';
}
export function isPremium(plano: string | null | undefined): boolean {
  const p = (plano || 'basico').toLowerCase();
  return p === 'pro' || p === 'ultra';
}

// ── Contexto do hub (provido pelo layout, consumido pelas sub-rotas) ──────────
export type RhContextValue = {
  userId: string;
  hoje: string;            // YYYY-MM-DD compartilhado por todo o hub
  equipe: Funcionario[];   // quadro carregado uma vez no layout
  reloadEquipe: () => Promise<void>;
};
export const RhContext = createContext<RhContextValue | null>(null);
export function useRh(): RhContextValue {
  const ctx = useContext(RhContext);
  if (!ctx) throw new Error('useRh precisa estar dentro do layout de /painel/rh');
  return ctx;
}

// ── Slug de vaga (URL pública /vagas/[slug]) ──────────────────────────────────
export function slugify(titulo: string, sufixo: string): string {
  const base = (titulo || 'vaga')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${base || 'vaga'}-${sufixo}`;
}

// ── API de IA (triagem de currículo) — opcional, com fallback no servidor ─────
export async function triagemIA(payload: { candidatoId: string; nome: string; curriculo?: string; vagaTitulo?: string; requisitos?: string }): Promise<{ ok: boolean; resumo?: string; error?: string }> {
  try {
    const res = await fetch('/api/rh/triagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, resumo: json.resumo } : { ok: false, error: json.error };
  } catch {
    return { ok: false, error: 'rede' };
  }
}

// ── Export CSV (genérico) ─────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
export function exportCSV(name: string, header: string[], rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((c) => (typeof c === 'number' ? c : esc(String(c)))).join(',')).join('\n');
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
