'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import FilterModal, { type Filtros } from '@/components/FilterModal'
import { supabase } from '@/lib/supabase'
import type { PropertySummary } from '@/types/client'

const SIGLA_PARA_NOME: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará',
  PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima',
  SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
}

function BuscaContent() {
  const params = useSearchParams()
  const router = useRouter()

  const estadoParam = params.get('estado')?.toUpperCase() || ''
  const cidadeParam = params.get('cidade') || ''
  const bairroParam = params.get('bairro') || ''
  const tipoParam   = params.get('tipo') || params.get('evento') || ''
  const dataParam   = params.get('data') || ''

  type RawProperty = PropertySummary & { usuario_id?: string }
  const [props, setProps]             = useState<RawProperty[]>([])
  const [loading, setLoading]         = useState(true)
  const [planosMap, setPlanosMap]     = useState<Record<string, string>>({})
  const [filtroOpen, setFiltroOpen]   = useState(false)
  const [filtros, setFiltros]         = useState<Filtros | null>(null)
  const [contFiltros, setContFiltros] = useState(0)

  useEffect(() => {
    fetch('/api/planos').then(r => r.json()).then(json => setPlanosMap(json.planos || {}))
  }, [])

  useEffect(() => { buscar(null) }, [estadoParam, cidadeParam, bairroParam, tipoParam])

  async function buscar(f: Filtros | null) {
    setLoading(true)
    let query = supabase.from('propriedades').select('*').eq('publicada', true)

    const estado = f?.estado || estadoParam
    const cidade = f?.cidade || cidadeParam
    const bairro = bairroParam

    if (estado) query = query.eq('estado', estado)
    if (cidade) query = query.ilike('cidade', `%${cidade}%`)
    if (bairro) query = query.ilike('bairro', `%${bairro}%`)

    if (f) {
      if (f.precoMin > 0)     query = query.gte('valor_hora', f.precoMin)
      if (f.precoMax < 10000) query = query.lte('valor_hora', f.precoMax)
      if (f.capacidade > 0)   query = query.gte('capacidade', f.capacidade)
      if (f.acessibilidade)   query = query.eq('acessibilidade', true)
      if (f.somAlto)          query = query.eq('som_alto', true)
      if (f.somTarde)         query = query.eq('som_tarde', true)
      if (f.climatizado)      query = query.contains('comodidades', ['climatizado'])
      if (f.estacionamento)   query = query.contains('comodidades', ['estacionamento'])
      if (f.seguranca)        query = query.contains('comodidades', ['seguranca'])
      if (f.espacoAberto)     query = query.contains('comodidades', ['espaco-aberto'])

      if (f.tiposEvento.length > 0) {
        const orStr = f.tiposEvento.map(t => `tipo_evento.ilike.%${t}%`).join(',')
        query = query.or(orStr)
      }
      if (f.categorias.length > 0) {
        const orStr = f.categorias.flatMap(v => [
          `tipo_propriedade.eq.${v}`,
          `categoria.eq.${v}`,
        ]).join(',')
        query = query.or(orStr)
      }
      if (f.ultra) {
        const res = await fetch('/api/planos')
        const { planos } = await res.json()
        const ultraUserIds = Object.entries(planos || {})
          .filter(([, p]) => p === 'ultra')
          .map(([uid]) => uid)
        if (ultraUserIds.length > 0) {
          query = query.in('usuario_id', ultraUserIds)
        } else {
          setProps([]); setLoading(false); return
        }
      }
    } else if (tipoParam) {
      query = query.eq('categoria', tipoParam)
    }

    const { data } = await query
    setProps((data || []) as RawProperty[])
    setLoading(false)
  }

  const aplicarFiltros = (f: Filtros) => {
    setFiltros(f)
    let c = 0
    if (f.precoMin > 0 || f.precoMax < 10000) c++
    if (f.capacidade > 0) c++
    if (f.climatizado || f.estacionamento || f.seguranca || f.espacoAberto) c++
    if (f.somAlto || f.somTarde) c++
    if (f.acessibilidade) c++
    if (f.ultra) c++
    if (f.tiposEvento.length) c++
    if (f.categorias.length) c++
    setContFiltros(c)
    buscar(f)
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

      {/* Layout split: cards + mapa */}
      <div className="mt-20 flex h-[calc(100vh-80px)]">

        {/* Coluna de cards */}
        <section className="flex-1 overflow-y-auto px-5 py-5 min-w-0">

          {/* Título + botão de filtros */}
          <div className="flex items-center gap-4 flex-wrap mb-2">
            <h1 className="text-[1.4rem] font-extrabold text-[#0d0d0d] m-0">{titulo}</h1>
            <button
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
          </div>

          {!loading && (
            <p className="text-gray-400 text-[.88rem] mb-4">
              {props.length} espaço{props.length !== 1 ? 's' : ''} encontrado{props.length !== 1 ? 's' : ''}
              {dataParam ? ` · ${dataParam}` : ''}
            </p>
          )}

          {/* Estados da busca */}
          {loading ? (
            <div className="text-gray-400 py-10 text-center">Carregando...</div>
          ) : props.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[1.1rem] mb-3">😕 Nenhum espaço encontrado</p>
              <p className="text-gray-400 mb-6 text-[.9rem]">Tente ajustar os filtros ou buscar em outra região.</p>
              <button
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

        {/* Coluna do mapa */}
        <section className="hidden lg:flex w-[420px] xl:w-[480px] flex-shrink-0 bg-gray-100 items-center justify-center sticky top-0">
          <p className="text-gray-400 text-[.9rem] text-center px-5">
            🗺️ Mapa integrado<br />
            <span className="text-[.8rem]">Integre Google Maps ou Leaflet aqui</span>
          </p>
        </section>
      </div>

      <FilterModal
        open={filtroOpen}
        onClose={() => setFiltroOpen(false)}
        onApply={aplicarFiltros}
        initialEstado={estadoParam}
        initialEvento={tipoParam}
      />

      <Footer />
    </>
  )
}

export default function BuscaPage() {
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
