// Lógica PURA de filtros da busca (sem Supabase) — compartilhada entre o server
// (page.tsx, via supabaseAdmin) e o client (_BuscaClient, via supabase). Mantê-la
// aqui evita arrastar a service-role key para o bundle do cliente.
import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { Filtros } from '@/components/FilterModal'

export type SP = URLSearchParams | ReadonlyURLSearchParams

export function filtrosFromParams(p: SP): Filtros {
  const num = (k: string, d: number) => { const v = p.get(k); const n = Number(v); return v !== null && Number.isFinite(n) ? n : d }
  const bool = (k: string) => p.get(k) === '1'
  const list = (k: string) => { const v = p.get(k); return v ? v.split(',').filter(Boolean) : [] }
  return {
    precoMin: num('preco_min', 0),
    precoMax: num('preco_max', 10000),
    capacidade: num('convidados', 0),
    estado: (p.get('estado') || '').toUpperCase(),
    cidade: p.get('cidade') || '',
    climatizado: bool('climatizado'),
    estacionamento: bool('estacionamento'),
    seguranca: bool('seguranca'),
    espacoAberto: bool('espaco_aberto'),
    ultra: bool('ultra'),
    acessibilidade: bool('acessibilidade'),
    somAlto: bool('som_alto'),
    somTarde: bool('som_tarde'),
    tiposEvento: list('eventos'),
    categorias: list('categorias'),
  }
}

export function paramsFromFiltros(f: Filtros, base: SP): URLSearchParams {
  const p = new URLSearchParams()
  for (const k of ['bairro', 'data_inicio', 'data_fim', 'tipo']) {
    const v = base.get(k); if (v) p.set(k, v)
  }
  if (f.estado) p.set('estado', f.estado)
  if (f.cidade) p.set('cidade', f.cidade)
  if (f.precoMin > 0) p.set('preco_min', String(f.precoMin))
  if (f.precoMax < 10000) p.set('preco_max', String(f.precoMax))
  if (f.capacidade > 0) p.set('convidados', String(f.capacidade))
  if (f.climatizado) p.set('climatizado', '1')
  if (f.estacionamento) p.set('estacionamento', '1')
  if (f.seguranca) p.set('seguranca', '1')
  if (f.espacoAberto) p.set('espaco_aberto', '1')
  if (f.ultra) p.set('ultra', '1')
  if (f.acessibilidade) p.set('acessibilidade', '1')
  if (f.somAlto) p.set('som_alto', '1')
  if (f.somTarde) p.set('som_tarde', '1')
  if (f.tiposEvento.length) p.set('eventos', f.tiposEvento.join(','))
  if (f.categorias.length) p.set('categorias', f.categorias.join(','))
  return p
}

export function contarFiltros(f: Filtros): number {
  let c = 0
  if (f.precoMin > 0 || f.precoMax < 10000) c++
  if (f.capacidade > 0) c++
  if (f.climatizado || f.estacionamento || f.seguranca || f.espacoAberto) c++
  if (f.somAlto || f.somTarde) c++
  if (f.acessibilidade) c++
  if (f.ultra) c++
  if (f.tiposEvento.length) c++
  if (f.categorias.length) c++
  return c
}

// Aplica todos os filtros (exceto "ultra", que depende dos planos) num query
// builder do Supabase (mesmo `.eq/.ilike/.gte/...` no client e no server).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltrosNaQuery(query: any, sp: SP) {
  const f = filtrosFromParams(sp)
  const bairro = sp.get('bairro') || ''
  const tipo = sp.get('tipo') || sp.get('evento') || ''

  if (f.estado) query = query.eq('estado', f.estado)
  if (f.cidade) query = query.ilike('cidade', `%${f.cidade}%`)
  if (bairro) query = query.ilike('bairro', `%${bairro}%`)
  if (f.capacidade > 0) query = query.gte('capacidade', f.capacidade)
  // Preço: casa se valor_hora OU valor_base cair na faixa (espaços precificam
  // por hora ou por diária). Antes só olhava valor_hora — zerava os resultados
  // de quem cadastra apenas a diária.
  const precoMin = f.precoMin > 0 ? f.precoMin : null
  const precoMax = f.precoMax < 10000 ? f.precoMax : null
  if (precoMin !== null || precoMax !== null) {
    const faixa = (col: string) => {
      const ps: string[] = []
      if (precoMin !== null) ps.push(`${col}.gte.${precoMin}`)
      if (precoMax !== null) ps.push(`${col}.lte.${precoMax}`)
      return ps.length > 1 ? `and(${ps.join(',')})` : ps[0]
    }
    query = query.or(`${faixa('valor_hora')},${faixa('valor_base')}`)
  }
  if (f.acessibilidade) query = query.eq('acessibilidade', true)
  if (f.somAlto) query = query.eq('som_alto', true)
  if (f.somTarde) query = query.eq('som_tarde', true)
  // comodidades é text (JSON serializado) — filtra por substring do slug.
  if (f.climatizado) query = query.ilike('comodidades', '%"climatizado"%')
  if (f.estacionamento) query = query.ilike('comodidades', '%"estacionamento"%')
  if (f.seguranca) query = query.ilike('comodidades', '%"seguranca"%')
  if (f.espacoAberto) query = query.ilike('comodidades', '%"espaco-aberto"%')
  if (f.tiposEvento.length > 0) query = query.or(f.tiposEvento.map((t) => `tipo_evento.ilike.%${t}%`).join(','))
  if (f.categorias.length > 0) {
    query = query.or(f.categorias.flatMap((v) => [`tipo_propriedade.eq.${v}`, `categoria.eq.${v}`]).join(','))
  } else if (tipo) {
    query = query.eq('categoria', tipo)
  }
  return query
}

// Relevância: plano pago primeiro (ultra > pro > básico), depois nota, depois nome.
const pesoPlano = (p: string) => (p === 'ultra' ? 0 : p === 'pro' ? 1 : 2)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ordenarPorRelevancia<T extends Record<string, any>>(props: T[], planos: Record<string, string>): T[] {
  return [...props].sort((a, b) => {
    const dp = pesoPlano(planos[a.usuario_id] || 'basico') - pesoPlano(planos[b.usuario_id] || 'basico')
    if (dp !== 0) return dp
    const dn = (parseFloat(String(b.avaliacao ?? 0)) || 0) - (parseFloat(String(a.avaliacao ?? 0)) || 0)
    if (dn !== 0) return dn
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
  })
}

// Disponibilidade por data: ids dos espaços com data bloqueada no intervalo.
// O `client` (supabase no cliente, admin no servidor) é injetado — mantém este
// módulo sem dependência direta de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function idsIndisponiveis(client: any, dataInicio: string, dataFim?: string): Promise<Array<number | string>> {
  const di = (dataInicio || '').trim()
  if (!di) return []
  const df = (dataFim || '').trim() || di
  const { data } = await client
    .from('disponibilidade')
    .select('prop_id')
    .eq('bloqueado', true)
    .gte('data', di)
    .lte('data', df)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...new Set((data || []).map((b: any) => b.prop_id).filter((v: any) => v != null))] as Array<number | string>
}

// Remove da query os ids indisponíveis (no-op se a lista vier vazia).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function excluirIds(query: any, ids: Array<number | string>) {
  return ids.length ? query.not('id', 'in', `(${ids.join(',')})`) : query
}
