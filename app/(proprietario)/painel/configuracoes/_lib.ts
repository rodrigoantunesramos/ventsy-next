// Tipos, defaults e acesso a dados da página de Configurações.
// A tabela `empresa_config` (1 linha por dono) é criada pela migration
// docs/sql/empresa-config-rbac.sql — enquanto types/supabase.ts não a inclui,
// usamos supabaseAny. TODO: regenerar types/supabase.ts após rodar a migration.

import { supabaseAny as sb } from '@/lib/supabase'
import type { Idioma, FormatoData } from '@/lib/prefs'
import type { Currency } from '@/lib/format'

// ── Sub-objetos (jsonb) ──────────────────────────────────────────────────────
export type Endereco = {
  cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string
}
export type Contatos = {
  email: string; telefone: string; whatsapp: string; site: string; instagram: string
}
export type CoresMarca = { primaria: string; secundaria: string; texto: string }
export type ConfigFiscal = {
  regime: string; cnae: string; codigo_servico: string; iss: string;
  emitente_nome: string; emitente_email: string;
  optante_simples: boolean; incentivador_cultural: boolean; observacoes: string
}
export type Numeracao = {
  proposta_prefixo: string; proposta_proximo: string;
  contrato_prefixo: string; contrato_proximo: string;
  nota_prefixo: string; nota_proximo: string
}
export type Preferencias = {
  formato_data: FormatoData; primeira_hora: string; numeracao: Numeracao;
  template_proposta: string; template_contrato: string
}
export type Notificacoes = Record<string, boolean>

export type EmpresaConfig = {
  razao_social: string; fantasia: string; cnpj: string; ie: string; im: string;
  endereco: Endereco; contatos: Contatos; logo_url: string;
  cores_marca: CoresMarca; idioma: Idioma; moeda: Currency; fuso: string;
  config_fiscal: ConfigFiscal; preferencias: Preferencias; notificacoes: Notificacoes;
  retencao_meses: number; exclusao_solicitada_em: string | null
}

// ── Defaults ─────────────────────────────────────────────────────────────────
export const EMPTY_ENDERECO: Endereco = { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' }
export const EMPTY_CONTATOS: Contatos = { email: '', telefone: '', whatsapp: '', site: '', instagram: '' }
export const DEFAULT_CORES: CoresMarca = { primaria: '#ff385c', secundaria: '#0d0d0d', texto: '#0d0d0d' }
export const EMPTY_FISCAL: ConfigFiscal = {
  regime: 'simples', cnae: '', codigo_servico: '', iss: '',
  emitente_nome: '', emitente_email: '', optante_simples: true, incentivador_cultural: false, observacoes: '',
}
export const EMPTY_NUMERACAO: Numeracao = {
  proposta_prefixo: 'PROP-', proposta_proximo: '1',
  contrato_prefixo: 'CTR-', contrato_proximo: '1',
  nota_prefixo: 'NF-', nota_proximo: '1',
}
export const EMPTY_PREFS: Preferencias = {
  formato_data: 'auto', primeira_hora: '08:00', numeracao: EMPTY_NUMERACAO,
  template_proposta: '', template_contrato: '',
}

export const NOTIF_ITEMS: { k: string; label: string; grupo: string }[] = [
  { k: 'lead_email', label: 'Novos leads por e-mail', grupo: 'Comercial' },
  { k: 'lead_wpp', label: 'Novos leads por WhatsApp', grupo: 'Comercial' },
  { k: 'visitas', label: 'Lembretes de visitas agendadas', grupo: 'Comercial' },
  { k: 'parcela_vence', label: 'Parcela a vencer', grupo: 'Financeiro' },
  { k: 'parcela_atrasa', label: 'Parcela em atraso', grupo: 'Financeiro' },
  { k: 'contrato_pendente', label: 'Contrato não assinado', grupo: 'Operacional' },
  { k: 'avaliacao', label: 'Nova avaliação recebida', grupo: 'Operacional' },
  { k: 'relatorio', label: 'Relatório mensal de desempenho', grupo: 'Geral' },
  { k: 'promo', label: 'Novidades e promoções da Ventsy', grupo: 'Geral' },
]
export const NOTIF_DEFAULTS: Notificacoes = {
  lead_email: true, lead_wpp: false, visitas: false,
  parcela_vence: true, parcela_atrasa: true, contrato_pendente: true,
  avaliacao: true, relatorio: true, promo: true,
}

export const REGIMES: { v: string; label: string }[] = [
  { v: 'mei', label: 'MEI' },
  { v: 'simples', label: 'Simples Nacional' },
  { v: 'presumido', label: 'Lucro Presumido' },
  { v: 'real', label: 'Lucro Real' },
  { v: 'isento', label: 'Pessoa Física / Isento' },
]

export const EMPTY_EMPRESA: EmpresaConfig = {
  razao_social: '', fantasia: '', cnpj: '', ie: '', im: '',
  endereco: { ...EMPTY_ENDERECO }, contatos: { ...EMPTY_CONTATOS }, logo_url: '',
  cores_marca: { ...DEFAULT_CORES }, idioma: 'pt', moeda: 'BRL', fuso: 'America/Sao_Paulo',
  config_fiscal: { ...EMPTY_FISCAL }, preferencias: { ...EMPTY_PREFS, numeracao: { ...EMPTY_NUMERACAO } },
  notificacoes: { ...NOTIF_DEFAULTS }, retencao_meses: 24, exclusao_solicitada_em: null,
}

// ── Acesso a dados ───────────────────────────────────────────────────────────
// Mescla a linha do banco (jsonb possivelmente parcial) com os defaults para a
// UI nunca lidar com campos undefined.
export async function carregarEmpresa(uid: string): Promise<{ data: EmpresaConfig; existe: boolean }> {
  const { data } = await sb.from('empresa_config').select('*').eq('usuario_id', uid).maybeSingle()
  if (!data) return { data: { ...EMPTY_EMPRESA }, existe: false }
  return {
    existe: true,
    data: {
      razao_social: data.razao_social ?? '', fantasia: data.fantasia ?? '',
      cnpj: data.cnpj ?? '', ie: data.ie ?? '', im: data.im ?? '',
      endereco: { ...EMPTY_ENDERECO, ...(data.endereco ?? {}) },
      contatos: { ...EMPTY_CONTATOS, ...(data.contatos ?? {}) },
      logo_url: data.logo_url ?? '',
      cores_marca: { ...DEFAULT_CORES, ...(data.cores_marca ?? {}) },
      idioma: (data.idioma ?? 'pt') as Idioma,
      moeda: (data.moeda ?? 'BRL') as Currency,
      fuso: data.fuso ?? 'America/Sao_Paulo',
      config_fiscal: { ...EMPTY_FISCAL, ...(data.config_fiscal ?? {}) },
      preferencias: {
        ...EMPTY_PREFS,
        ...(data.preferencias ?? {}),
        numeracao: { ...EMPTY_NUMERACAO, ...((data.preferencias ?? {}).numeracao ?? {}) },
      },
      notificacoes: { ...NOTIF_DEFAULTS, ...(data.notificacoes ?? {}) },
      retencao_meses: data.retencao_meses ?? 24,
      exclusao_solicitada_em: data.exclusao_solicitada_em ?? null,
    },
  }
}

// Persiste a configuração completa (upsert por usuario_id). RLS garante o tenant.
export async function salvarEmpresa(uid: string, e: EmpresaConfig): Promise<string | null> {
  const row = {
    usuario_id: uid,
    razao_social: e.razao_social || null, fantasia: e.fantasia || null,
    cnpj: e.cnpj || null, ie: e.ie || null, im: e.im || null,
    endereco: e.endereco, contatos: e.contatos, logo_url: e.logo_url || null,
    cores_marca: e.cores_marca, idioma: e.idioma, moeda: e.moeda, fuso: e.fuso,
    config_fiscal: e.config_fiscal, preferencias: e.preferencias, notificacoes: e.notificacoes,
    retencao_meses: e.retencao_meses,
    atualizado_em: new Date().toISOString(),
  }
  const { error } = await sb.from('empresa_config').upsert(row, { onConflict: 'usuario_id' })
  return error ? error.message : null
}
