// _lib — modelo, constantes e helpers do módulo Compras (/painel/compras).
// Compartilhado entre a shell (page.tsx) e as abas (_components/*).
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/datas
// cruas; toda a formatação fica em lib/format, chamada nos componentes.
//
// Fluxo: requisição → cotação → pedido → recebimento → financeiro.
//   • "A pagar" gerada no recebimento vive em `contas_pagar` (módulo Recebíveis).
//   • Entrada de estoque é tentada em `estoque_mov` e degrada se não existir.
// As regras puras (alçada, comparativo, economia, lead time) ficam em
// lib/compras.ts (testadas) e são re-exportadas no fim.

import { supabase as sb } from '@/lib/supabase';

// ── Status / prioridade / unidades ────────────────────────────────────────────
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type ReqStatus = 'aberta' | 'aprovada' | 'reprovada' | 'em_cotacao' | 'pedido' | 'recebida' | 'cancelada';
export type CotStatus = 'pendente' | 'recebida' | 'recusada';
export type PedidoStatus = 'emitido' | 'parcial' | 'recebido' | 'cancelado';

type Meta = { label: string; cls: string; dot: string; cor: string };

export const PRIORIDADES: { v: Prioridade; label: string; cls: string; cor: string }[] = [
  { v: 'baixa',   label: 'Baixa',    cls: 'bg-gray-100 text-gray-600',     cor: '#94a3b8' },
  { v: 'media',   label: 'Média',    cls: 'bg-sky-50 text-sky-700',        cor: '#0ea5e9' },
  { v: 'alta',    label: 'Alta',     cls: 'bg-amber-50 text-amber-700',    cor: '#f59e0b' },
  { v: 'urgente', label: 'Urgente',  cls: 'bg-red-50 text-red-700',        cor: '#dc2626' },
];
export const PRIORIDADE_BY = Object.fromEntries(PRIORIDADES.map((p) => [p.v, p])) as Record<Prioridade, (typeof PRIORIDADES)[number]>;

export const REQ_STATUS: Record<ReqStatus, Meta> = {
  aberta:     { label: 'Aberta',       cls: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-500',     cor: '#0ea5e9' },
  aprovada:   { label: 'Aprovada',     cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', cor: '#10b981' },
  reprovada:  { label: 'Reprovada',    cls: 'bg-red-50 text-red-700',         dot: 'bg-red-500',     cor: '#dc2626' },
  em_cotacao: { label: 'Em cotação',   cls: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500',  cor: '#8b5cf6' },
  pedido:     { label: 'Pedido',       cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500',    cor: '#1a73e8' },
  recebida:   { label: 'Recebida',     cls: 'bg-teal-50 text-teal-700',       dot: 'bg-teal-500',    cor: '#14b8a6' },
  cancelada:  { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-400',    cor: '#94a3b8' },
};

export const PEDIDO_STATUS: Record<PedidoStatus, Meta> = {
  emitido:   { label: 'Emitido',   cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500',    cor: '#1a73e8' },
  parcial:   { label: 'Parcial',   cls: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   cor: '#f59e0b' },
  recebido:  { label: 'Recebido',  cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', cor: '#10b981' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-400',    cor: '#94a3b8' },
};

// Unidades de medida comuns (compras de evento).
export const UNIDADES = ['un', 'cx', 'pct', 'fardo', 'kg', 'g', 'L', 'mL', 'm', 'm²', 'par', 'dz', 'serviço', 'diária'];

// Categorias de fornecedor (espelha /painel/fornecedores) — usadas no painel de
// gasto por categoria. Mantidas em sincronia de chaves/cores com aquele módulo.
export const CATEGORIAS: { v: string; label: string; cor: string }[] = [
  { v: 'buffet',     label: 'Buffet / Catering',   cor: '#ff385c' },
  { v: 'som',        label: 'Som & Iluminação',    cor: '#8b5cf6' },
  { v: 'decoracao',  label: 'Decoração & Flores',  cor: '#ec4899' },
  { v: 'estrutura',  label: 'Estrutura & Tendas',  cor: '#f97316' },
  { v: 'locacao',    label: 'Locação de itens',    cor: '#f59e0b' },
  { v: 'seguranca',  label: 'Segurança',           cor: '#1a73e8' },
  { v: 'limpeza',    label: 'Limpeza & Sanitários', cor: '#14b8a6' },
  { v: 'bebidas',    label: 'Bebidas',             cor: '#10b981' },
  { v: 'fotografia', label: 'Foto & Vídeo',        cor: '#0ea5e9' },
  { v: 'transporte', label: 'Transporte & Valet',  cor: '#64748b' },
  { v: 'grafica',    label: 'Gráfica & Convites',  cor: '#a855f7' },
  { v: 'energia',    label: 'Energia & Geradores', cor: '#eab308' },
  { v: 'outro',      label: 'Outro',               cor: '#94a3b8' },
];
const CAT_BY = Object.fromEntries(CATEGORIAS.map((c) => [c.v, c]));
export function catLabel(v: string | null): string { return CAT_BY[v || 'outro']?.label || v || '—'; }
export function catCor(v: string | null): string { return CAT_BY[v || 'outro']?.cor || '#94a3b8'; }

// Classe de input/select reaproveitada (igual ao resto do painel).
export const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

// ── Tipos de domínio (views em memória; money sem o sufixo _num) ──────────────
export type Requisicao = {
  id: string; usuario_id: string; numero: string | null; solicitante: string | null;
  evento_id: string | null; centro_custo_id: string | null; justificativa: string | null;
  prioridade: Prioridade; status: ReqStatus; valor_estimado: number;
  aprovado_por: string | null; aprovado_em: string | null; reprovado_motivo: string | null;
  obs: string | null; criado_em: string; atualizado_em: string;
};
export type RequisicaoItem = {
  id: string; requisicao_id: string; usuario_id: string; produto_id: string | null;
  descricao: string; quantidade: number; unidade: string; valor_estimado: number; obs: string | null; criado_em: string;
};
export type Cotacao = {
  id: string; usuario_id: string; requisicao_id: string; fornecedor_id: string | null; fornecedor_nome: string | null;
  valor_total: number; prazo_dias: number | null; condicao: string | null; validade: string | null;
  anexo_url: string | null; anexo_nome: string | null; escolhida: boolean; status: CotStatus;
  enviada_em: string | null; recebida_em: string | null; obs: string | null; criado_em: string;
};
export type CotacaoItem = {
  id: string; cotacao_id: string; requisicao_item_id: string | null; usuario_id: string;
  descricao: string | null; quantidade: number; valor_unit: number; prazo_dias: number | null; disponivel: boolean; criado_em: string;
};
// Item do pedido (snapshot em jsonb — mantém o sufixo _num do blob).
export type PedidoItem = {
  requisicao_item_id: string | null; produto_id: string | null; descricao: string;
  quantidade: number; unidade: string; valor_unit_num: number; quantidade_recebida: number;
};
export type Pedido = {
  id: string; usuario_id: string; requisicao_id: string | null; cotacao_id: string | null;
  fornecedor_id: string | null; fornecedor_nome: string | null; numero: string | null;
  valor_total: number; status: PedidoStatus; condicao: string | null; previsao_entrega: string | null;
  enviado_em: string | null; itens: PedidoItem[]; obs: string | null; criado_em: string; atualizado_em: string;
};
// Item conferido no recebimento (snapshot em jsonb).
export type RecebimentoItem = {
  descricao: string; quantidade_pedida: number; quantidade_recebida: number; conforme: boolean; obs: string | null;
};
export type Recebimento = {
  id: string; usuario_id: string; pedido_id: string; data: string; itens: RecebimentoItem[];
  nota_fornecedor: string | null; divergencia: boolean; divergencia_obs: string | null;
  valor: number; conta_pagar_id: string | null; obs: string | null; criado_em: string;
};

// Subconjuntos de tabelas-âncora (carregados na shell).
export type FornecedorLite = { id: string; nome: string; fantasia: string | null; categoria: string; whatsapp: string | null; email: string | null; condicoes_pagamento: string | null; prazo_entrega_dias: number | null };
export type EventoLite = { id: string; nome_evento: string | null; tipo_evento: string | null; data_inicio: string | null };
export type CentroCustoLite = { id: string; nome: string };

// Abas do módulo (compartilhado entre a shell e o Painel para navegação).
export type Aba = 'painel' | 'requisicoes' | 'cotacoes' | 'pedidos' | 'recebimentos';

// "Bag" único de dados carregado pela shell e passado para todas as abas.
export type ComprasBag = {
  userId: string;
  requisicoes: Requisicao[];
  reqItens: RequisicaoItem[];
  cotacoes: Cotacao[];
  cotacaoItens: CotacaoItem[];
  pedidos: Pedido[];
  recebimentos: Recebimento[];
  fornecedores: FornecedorLite[];
  eventos: EventoLite[];
  centrosCusto: CentroCustoLite[];
  alcada: number;
  setAlcadaLocal: (n: number) => void;
  recarregar: () => Promise<void>;
};

// ── Mapeadores DB → view ──────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapRequisicao(r: any): Requisicao {
  return {
    id: String(r.id), usuario_id: r.usuario_id, numero: r.numero ?? null, solicitante: r.solicitante ?? null,
    evento_id: r.evento_id ?? null, centro_custo_id: r.centro_custo_id ?? null, justificativa: r.justificativa ?? null,
    prioridade: (r.prioridade || 'media') as Prioridade, status: (r.status || 'aberta') as ReqStatus,
    valor_estimado: Number(r.valor_estimado_num) || 0, aprovado_por: r.aprovado_por ?? null, aprovado_em: r.aprovado_em ?? null,
    reprovado_motivo: r.reprovado_motivo ?? null, obs: r.obs ?? null, criado_em: r.criado_em, atualizado_em: r.atualizado_em,
  };
}
export function mapReqItem(r: any): RequisicaoItem {
  return {
    id: String(r.id), requisicao_id: r.requisicao_id, usuario_id: r.usuario_id, produto_id: r.produto_id ?? null,
    descricao: r.descricao || '', quantidade: Number(r.quantidade) || 0, unidade: r.unidade || 'un',
    valor_estimado: Number(r.valor_estimado_num) || 0, obs: r.obs ?? null, criado_em: r.criado_em,
  };
}
export function mapCotacao(r: any): Cotacao {
  return {
    id: String(r.id), usuario_id: r.usuario_id, requisicao_id: r.requisicao_id, fornecedor_id: r.fornecedor_id ?? null,
    fornecedor_nome: r.fornecedor_nome ?? null, valor_total: Number(r.valor_total_num) || 0, prazo_dias: r.prazo_dias ?? null,
    condicao: r.condicao ?? null, validade: r.validade ?? null, anexo_url: r.anexo_url ?? null, anexo_nome: r.anexo_nome ?? null,
    escolhida: !!r.escolhida, status: (r.status || 'pendente') as CotStatus, enviada_em: r.enviada_em ?? null,
    recebida_em: r.recebida_em ?? null, obs: r.obs ?? null, criado_em: r.criado_em,
  };
}
export function mapCotacaoItem(r: any): CotacaoItem {
  return {
    id: String(r.id), cotacao_id: r.cotacao_id, requisicao_item_id: r.requisicao_item_id ?? null, usuario_id: r.usuario_id,
    descricao: r.descricao ?? null, quantidade: Number(r.quantidade) || 0, valor_unit: Number(r.valor_unit_num) || 0,
    prazo_dias: r.prazo_dias ?? null, disponivel: r.disponivel !== false, criado_em: r.criado_em,
  };
}
export function mapPedido(r: any): Pedido {
  const itens = Array.isArray(r.itens) ? (r.itens as any[]).map(mapPedidoItem) : [];
  return {
    id: String(r.id), usuario_id: r.usuario_id, requisicao_id: r.requisicao_id ?? null, cotacao_id: r.cotacao_id ?? null,
    fornecedor_id: r.fornecedor_id ?? null, fornecedor_nome: r.fornecedor_nome ?? null, numero: r.numero ?? null,
    valor_total: Number(r.valor_total_num) || 0, status: (r.status || 'emitido') as PedidoStatus, condicao: r.condicao ?? null,
    previsao_entrega: r.previsao_entrega ?? null, enviado_em: r.enviado_em ?? null, itens, obs: r.obs ?? null,
    criado_em: r.criado_em, atualizado_em: r.atualizado_em,
  };
}
export function mapPedidoItem(r: any): PedidoItem {
  return {
    requisicao_item_id: r.requisicao_item_id ?? null, produto_id: r.produto_id ?? null, descricao: r.descricao || '',
    quantidade: Number(r.quantidade) || 0, unidade: r.unidade || 'un', valor_unit_num: Number(r.valor_unit_num) || 0,
    quantidade_recebida: Number(r.quantidade_recebida) || 0,
  };
}
export function mapRecebimento(r: any): Recebimento {
  const itens = Array.isArray(r.itens) ? (r.itens as any[]).map((i) => ({
    descricao: i.descricao || '', quantidade_pedida: Number(i.quantidade_pedida) || 0,
    quantidade_recebida: Number(i.quantidade_recebida) || 0, conforme: i.conforme !== false, obs: i.obs ?? null,
  })) : [];
  return {
    id: String(r.id), usuario_id: r.usuario_id, pedido_id: r.pedido_id, data: r.data, itens,
    nota_fornecedor: r.nota_fornecedor ?? null, divergencia: !!r.divergencia, divergencia_obs: r.divergencia_obs ?? null,
    valor: Number(r.valor_num) || 0, conta_pagar_id: r.conta_pagar_id ?? null, obs: r.obs ?? null, criado_em: r.criado_em,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── "Tabela ainda não criada" (rodar a migration) ────────────────────────────
// PGRST205 = REST não encontrou a tabela; 42P01 = undefined_table (SQL direto).
export { isMissingTable } from '@/lib/dbErrors'

// ── Helpers genéricos ─────────────────────────────────────────────────────────
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function soDigitos(s: string | null | undefined): string { return (s || '').replace(/\D/g, ''); }
export function waLink(fone: string | null | undefined, msg = ''): string | null {
  const d = soDigitos(fone);
  if (!d) return null;
  const base = `https://wa.me/${d.length <= 11 ? '55' + d : d}`;
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}
export function mailLink(email: string | null | undefined, subject = '', body = ''): string | null {
  if (!email || !email.includes('@')) return null;
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
  return `mailto:${email.trim()}${q ? '?' + q : ''}`;
}
export function fornNomeDe(f: FornecedorLite | undefined | null): string { return f ? (f.fantasia || f.nome) : ''; }

// Próximo número sequencial (REQ-0001 / PC-0001) a partir dos existentes.
export function proximoNumero(prefixo: string, existentes: (string | null)[]): string {
  let max = 0;
  for (const n of existentes) {
    const m = (n || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefixo}-${String(max + 1).padStart(4, '0')}`;
}

// ── Alçada (limite de aprovação) — preferência por usuário em localStorage ────
const ALCADA_KEY = 'ventsy_compras_alcada';
export function getAlcada(uid: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(`${ALCADA_KEY}_${uid}`);
  return raw ? Number(raw) || 0 : 0;
}
export function setAlcada(uid: string, valor: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${ALCADA_KEY}_${uid}`, String(Math.max(0, valor || 0)));
}

// ── Storage (reutiliza o bucket `documentos`) ─────────────────────────────────
export const BUCKET = 'documentos';
export type UploadResult = { anexo_url: string; anexo_nome: string };
export async function uploadAnexo(uid: string, file: File): Promise<UploadResult> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${uid}/compras/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { anexo_url: path, anexo_nome: file.name };
}
export async function signedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
export async function removeArquivo(path: string | null): Promise<void> {
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]);
}

// ── Export CSV ────────────────────────────────────────────────────────────────
const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
function csvDownload(name: string, header: string[], body: string): void {
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
export function exportPedidosCSV(pedidos: Pedido[], fornNome: (id: string | null, snap: string | null) => string, hoje: string): void {
  const header = ['Número', 'Fornecedor', 'Status', 'Previsão', 'Itens', 'Valor total', 'Criado em'];
  const body = pedidos.map((p) => [
    esc(p.numero || ''), esc(fornNome(p.fornecedor_id, p.fornecedor_nome)), PEDIDO_STATUS[p.status].label,
    p.previsao_entrega || '', p.itens.length, p.valor_total, (p.criado_em || '').slice(0, 10),
  ].join(',')).join('\n');
  csvDownload(`pedidos-compra-${hoje}.csv`, header, body);
}

// ── Re-export do motor puro (testado em __tests__/lib/compras.test.ts) ────────
export {
  precisaAlcada, valorEstimado, montarComparativo, calcularEconomia,
  leadTimeDias, mediaLeadTime, statusPedidoPorItens, saldoAReceber,
} from '@/lib/compras';
export type {
  ReqItemRef, CotacaoItemRef, CotacaoRef, Comparativo, CompLinha, CompCelula, CompTotal, Economia,
} from '@/lib/compras';
