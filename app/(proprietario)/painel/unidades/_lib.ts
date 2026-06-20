// Carga de dados da página Multi-unidades. Lê tudo escopado por usuario_id (RLS)
// e detecta se as 3 tabelas novas (unidades_grupos/_config/_acesso) já existem.
// A matemática (métricas/consolidação/ranking) vive em lib/unidades.ts (pura).

import { supabase as sb } from '@/lib/supabase'
import {
  isMissingTable,
  type PropriedadeLite, type LancamentoLite, type EventoLite,
  type UnidadeConfig, type GrupoUnidade, type UnidadeAcesso,
} from '@/lib/unidades'

export type Membro = { id: number; nome: string; cargo: string | null; prop_id: number | null }

export type DadosUnidades = {
  needsSetup: boolean          // alguma das tabelas novas ainda não existe → rodar SQL
  props: PropriedadeLite[]     // as unidades (propriedades do dono)
  configs: UnidadeConfig[]
  grupos: GrupoUnidade[]
  acessos: UnidadeAcesso[]
  membros: Membro[]            // equipe (para o controle de acesso)
  lancamentos: LancamentoLite[]
  eventos: EventoLite[]
}

/** Plano Ultra? (multi-unidades é exclusivo do Ultra). */
export function isUltra(plano: string | null | undefined): boolean {
  return (plano || 'basico').toLowerCase() === 'ultra'
}

const PROP_COLS = 'id,nome,cidade,estado,categoria,tipo_propriedade,capacidade,avaliacao,imagem_url,publicada'

/** Carrega tudo o que a página precisa para um dono. Nunca lança — degrade a vazio. */
export async function carregarUnidades(uid: string): Promise<DadosUnidades> {
  const d: DadosUnidades = {
    needsSetup: false, props: [], configs: [], grupos: [], acessos: [], membros: [],
    lancamentos: [], eventos: [],
  }

  // Propriedades = unidades.
  try {
    const { data } = await sb.from('propriedades').select(PROP_COLS).eq('usuario_id', uid).order('id')
    d.props = (data || []) as PropriedadeLite[]
  } catch { /* sem propriedades */ }

  // Caixa (lançamentos) e eventos — fontes da consolidação (já têm prop_id/propriedade_id).
  try {
    const { data } = await sb.from('lancamentos').select('prop_id,tipo,valor,data').eq('usuario_id', uid).limit(50000)
    d.lancamentos = (data || []) as LancamentoLite[]
  } catch { /* sem caixa */ }
  try {
    const { data } = await sb.from('clientes_eventos').select('propriedade_id,status,valor_total_num,data_inicio,data_fim').eq('usuario_id', uid).limit(50000)
    d.eventos = (data || []) as EventoLite[]
  } catch { /* sem eventos */ }

  // Equipe (para o controle de acesso por unidade) — opcional.
  try {
    const { data } = await sb.from('equipe').select('id,nome,cargo,prop_id').eq('usuario_id', uid).order('nome')
    d.membros = (data || []) as Membro[]
  } catch { /* sem equipe */ }

  // Tabelas novas — se faltarem, sinaliza setup (sem quebrar).
  try {
    const { data, error } = await sb.from('unidades_config').select('*').eq('usuario_id', uid)
    if (error) { if (isMissingTable(error)) d.needsSetup = true } else d.configs = (data || []) as UnidadeConfig[]
  } catch { d.needsSetup = true }
  try {
    const { data, error } = await sb.from('unidades_grupos').select('*').eq('usuario_id', uid).order('nome')
    if (error) { if (isMissingTable(error)) d.needsSetup = true } else d.grupos = (data || []) as GrupoUnidade[]
  } catch { d.needsSetup = true }
  try {
    const { data, error } = await sb.from('unidades_acesso').select('*').eq('usuario_id', uid)
    if (error) { if (isMissingTable(error)) d.needsSetup = true } else d.acessos = (data || []) as UnidadeAcesso[]
  } catch { d.needsSetup = true }

  return d
}
