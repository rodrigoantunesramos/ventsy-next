'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter, type ReadonlyURLSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import FilterModal, { type Filtros } from '@/components/FilterModal'
import SearchMap from '@/components/SearchMap'
import { supabase } from '@/lib/supabase'
import { DEMO_PROPS } from '@/lib/data'
import type { PropertySummary } from '@/types/client'

const SIGLA_PARA_NOME: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará',
  PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima',
  SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
}

const DEMO_BUSCA = DEMO_PROPS.map((d) => {
  const [cidade, estado] = d.cidade.split(',').map((s) => s.trim())
  return {
    id: d.id, nome: d.nome, cidade, estado,
    valor_base: d.preco, valor_hora: 0,
    avaliacao: d.nota_media, _nota: String(d.nota_media),
    _plano: d._plano, categoria: d.categoria, imagem_url: d.imagem_url,
    latitude: d.latitude, longitude: d.longitude,
  }
})

const fmtDataCurta = (isoStr: string) => {
  const [y, m, d] = isoStr.split('-').map(Number)
  if (!y || !m || !d) return isoStr
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Filtros ↔ URL (a URL é a fonte da verdade: busca compartilhável e persistente) ──
type SP = URLSearchParams | ReadonlyURLSearchParams

function filtrosFromParams(p: SP): Filtros {
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

function paramsFromFiltros(f: Filtros, base: SP): URLSearchParams {
  const p = new URLSearchParams()
  // preserva contexto da busca que não vem do modal
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

function contarFiltros(f: Filtros): number {
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

type RawProperty = PropertySummary & { usuario_id?: string; latitude?: number | null; longitude?: number | null }

function BuscaContent() {
  const params = useSearchParams()
  const router = useRouter()
  const qs = params.toString()

  const estadoParam = params.get('estado')?.toUpperCase() || ''
  const cidadeParam = params.get('cidade') || ''
  const bairroParam = params.get('bairro') || ''
  const tipoParam   = params.get('tipo') || params.get('evento') || ''
  const dataInicioParam = params.get('data_inicio') || ''
  const dataFimParam    = params.get('data_fim') || ''
  const dataParam   = dataInicioParam
    ? (dataFimParam && dataFimParam !== dataInicioParam
        ? `${fmtDataCurta(dataInicioParam)} → ${fmtDataCurta(dataFimParam)}`
        : fmtDataCurta(dataInicioParam))
    : (params.get('data') || '')

  const filtros = filtrosFromParams(params)
  const contFiltros = contarFiltros(filtros)

  const [props, setProps]           = useState<RawProperty[]>([])
  const [loading, setLoading]       = useState(true)
  const [planosMap, setPlanosMap]   = useState<Record<string, string>>({})
  const [filtroOpen, setFiltroOpen] = useState(false)

  useEffect(() => {
    fetch('/api/planos').then(r => r.json()).then(json => setPlanosMap(json.planos || {})).catch(() => {})
  }, [])

  // A busca reage a QUALQUER mudança de params (localização, datas e filtros do modal).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { buscar() }, [qs])

  async function buscar() {
    setLoading(true)
    const f = filtrosFromParams(params)
    let query = supabase.from('propriedades').select('*').eq('publicada', true)

    if (f.estado) query = query.eq('estado', f.estado)
    if (f.cidade) query = query.ilike('cidade', `%${f.cidade}%`)
    if (bairroParam) query = query.ilike('bairro', `%${bairroParam}%`)
    if (f.capacidade > 0) query = query.gte('capacidade', f.capacidade)
    if (f.precoMin > 0)     query = query.gte('valor_hora', f.precoMin)
    if (f.precoMax < 10000) query = query.lte('valor_hora', f.precoMax)
    if (f.acessibilidade)   query = query.eq('acessibilidade', true)
    if (f.somAlto)          query = query.eq('som_alto', true)
    if (f.somTarde)         query = query.eq('som_tarde', true)
    // comodidades é text (JSON serializado), não array — filtra por substring do slug.
    if (f.climatizado)      query = query.ilike('comodidades', '%"climatizado"%')
    if (f.estacionamento)   query = query.ilike('comodidades', '%"estacionamento"%')
    if (f.seguranca)        query = query.ilike('comodidades', '%"seguranca"%')
    if (f.espacoAberto)     query = query.ilike('comodidades', '%"espaco-aberto"%')
    if (f.tiposEvento.length > 0) query = query.or(f.tiposEvento.map(t => `tipo_evento.ilike.%${t}%`).join(','))

    if (f.categorias.length > 0) {
      query = query.or(f.categorias.flatMap(v => [`tipo_propriedade.eq.${v}`, `categoria.eq.${v}`]).join(','))
    } else if (tipoParam) {
      query = query.eq('categoria', tipoParam)
    }

    if (f.ultra) {
      const { planos } = await fetch('/api/planos').then(r => r.json()).catch(() => ({ planos: {} }))
      const ultraUserIds = Object.entries(planos || {}).filter(([, p]) => p === 'ultra').map(([uid]) => uid)
      if (ultraUserIds.length > 0) query = query.in('usuario_id', ultraUserIds)
      else { setProps([]); setLoading(false); return }
    }

    const { data, error } = await query.limit(60)
    const rows = (data || []) as unknown as RawProperty[]
    const usarDemo = process.env.NODE_ENV !== 'production' && !error
    setProps(rows.length ? rows : usarDemo ? (DEMO_BUSCA as unknown as RawProperty[]) : [])
    setLoading(false)
  }

  // Aplicar filtros = navegar com os filtros na URL (compartilhável, com histórico).
  const aplicarFiltros = (f: Filtros) => {
    setFiltroOpen(false)
    router.push(`/busca?${paramsFromFiltros(f, params).toString()}`)
    f.tiposEvento.forEach(async t => {
      try { await supabase.from('buscas').insert({ tipo_evento: t }) } catch (_) {}
    })
  }

  const nomeEstado = SIGLA_PARA_NOME[estadoParam] || estadoParam
  const titulo = cidadeParam
    ? `Espaços em ${cidadeParam}${estadoParam ? `, ${estadoParam}` : ''}`
    : estadoParam ? `Espaços em ${nomeEstado}`
    : tipoParam   ? tipoParam
    : 'Todos os espaços'

  return (
    <>
      <Header />

      <div className="mt-20 flex h-[calc(100vh-80px)]">
        <section className="flex-1 overflow-y-auto px-5 py-5 min-w-0">
          <div className="flex items-center gap-4 flex-wrap mb-2">
            <h1 className="text-[1.4rem] font-extrabold text-[#0d0d0d] m-0">{titulo}</h1>
            <button
              type="button"
              aria-haspopup="dialog"
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-gray-400 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 cursor-pointer transition-colors font-[inherit]"
              onClick={() => setFiltroOpen(true)}
            >
              ⚙ Filtros
              {contFiltros > 0 && (
                <span className="bg-[#ff385c] text-white rounded-full w-[18px] h-[18px] inline-flex items-center justify-center text-[.7rem] font-extrabold">
                  {contFiltros}
                </span>
              )}
            </button>
            {contFiltros > 0 && (
              <button
                type="button"
                onClick={() => router.push('/busca')}
                className="text-sm text-gray-500 hover:text-gray-800 underline cursor-pointer bg-transparent border-none font-[inherit]"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {!loading && (
            <p className="text-gray-400 text-[.88rem] mb-4" aria-live="polite">
              {props.length} espaço{props.length !== 1 ? 's' : ''} encontrado{props.length !== 1 ? 's' : ''}
              {dataParam ? ` · ${dataParam}` : ''}
            </p>
          )}

          {loading ? (
            <div className="text-gray-400 py-10 text-center">Carregando...</div>
          ) : props.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[1.1rem] mb-3">😕 Nenhum espaço encontrado</p>
              <p className="text-gray-400 mb-6 text-[.9rem]">Tente ajustar os filtros ou buscar em outra região.</p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="bg-[#ff385c] hover:bg-[#e0304f] text-white border-none rounded-xl px-7 py-3 cursor-pointer font-[inherit] font-bold text-[.9rem] transition-colors"
              >
                Ver todos os espaços
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {props.map(p => (
                <PropertyCard
                  key={p.id}
                  property={{ ...p, _plano: ((p.usuario_id && planosMap[p.usuario_id]) || 'basico') as 'basico' | 'pro' | 'ultra' }}
                  variant="grid"
                />
              ))}
            </div>
          )}
        </section>

        <section className="hidden lg:block w-[420px] xl:w-[480px] flex-shrink-0 sticky top-0 h-full">
          <SearchMap
            properties={props.map((p) => ({
              id: p.id,
              nome: p.nome,
              latitude: p.latitude,
              longitude: p.longitude,
              valor_hora: p.valor_hora,
              valor_base: p.valor_base,
              _plano: ((p.usuario_id && planosMap[p.usuario_id]) || 'basico') as 'basico' | 'pro' | 'ultra',
            }))}
          />
        </section>
      </div>

      <FilterModal
        open={filtroOpen}
        onClose={() => setFiltroOpen(false)}
        onApply={aplicarFiltros}
        initialEstado={estadoParam}
        initialEvento={filtros.tiposEvento.join(',') || tipoParam}
      />

      <Footer />
    </>
  )
}

export default function BuscaClient() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-gray-400">
        Carregando...
      </div>
    }>
      <BuscaContent />
    </Suspense>
  )
}
