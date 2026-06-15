'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import FilterModal, { type Filtros } from '@/components/FilterModal'
import SearchMap from '@/components/SearchMap'
import { supabase } from '@/lib/supabase'
import { filtrosFromParams, paramsFromFiltros, contarFiltros, aplicarFiltrosNaQuery, ordenarPorRelevancia } from './_filtros'
import type { PropertySummary } from '@/types/client'

const SIGLA_PARA_NOME: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará',
  PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima',
  SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
}

const fmtDataCurta = (isoStr: string) => {
  const [y, m, d] = isoStr.split('-').map(Number)
  if (!y || !m || !d) return isoStr
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

type RawProperty = PropertySummary & { usuario_id?: string; latitude?: number | null; longitude?: number | null }

function BuscaContent({ initialProps, initialPlanos }: { initialProps: RawProperty[]; initialPlanos: Record<string, string> }) {
  const params = useSearchParams()
  const router = useRouter()
  const qs = params.toString()

  const estadoParam = params.get('estado')?.toUpperCase() || ''
  const cidadeParam = params.get('cidade') || ''
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

  const [props, setProps]           = useState<RawProperty[]>(initialProps)
  const [loading, setLoading]       = useState(false)
  const [planosMap]                 = useState<Record<string, string>>(initialPlanos)
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [visiveis, setVisiveis]     = useState(24)
  const primeira = useRef(true)

  // A listagem inicial vem do servidor (initialProps). A ilha só re-busca quando
  // os params mudam (navegação/filtros), pulando o primeiro render.
  useEffect(() => {
    setVisiveis(24) // nova busca recomeça a paginação
    if (primeira.current) { primeira.current = false; return }
    buscar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs])

  async function buscar() {
    setLoading(true)
    const f = filtrosFromParams(params)
    let query = supabase.from('propriedades').select('*').eq('publicada', true)
    query = aplicarFiltrosNaQuery(query, params)

    if (f.ultra) {
      const { planos } = await fetch('/api/planos').then(r => r.json()).catch(() => ({ planos: {} }))
      const ultraUserIds = Object.entries(planos || {}).filter(([, p]) => p === 'ultra').map(([uid]) => uid)
      if (ultraUserIds.length > 0) query = query.in('usuario_id', ultraUserIds)
      else { setProps([]); setLoading(false); return }
    }

    const { data } = await query.limit(60)
    setProps(ordenarPorRelevancia((data || []) as unknown as RawProperty[], planosMap))
    setLoading(false)
  }

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
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {props.slice(0, visiveis).map(p => (
                  <PropertyCard
                    key={p.id}
                    property={{ ...p, _plano: ((p.usuario_id && planosMap[p.usuario_id]) || 'basico') as 'basico' | 'pro' | 'ultra' }}
                    variant="grid"
                  />
                ))}
              </div>
              {props.length > visiveis && (
                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => setVisiveis(v => v + 24)}
                    className="bg-white border border-gray-300 hover:border-gray-500 rounded-full px-7 py-3 text-sm font-bold text-gray-700 cursor-pointer transition-colors font-[inherit]"
                  >
                    Carregar mais ({props.length - visiveis} restantes)
                  </button>
                </div>
              )}
            </>
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

export default function BuscaClient({ initialProps, initialPlanos }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialProps: any[]
  initialPlanos: Record<string, string>
}) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-gray-400">
        Carregando...
      </div>
    }>
      <BuscaContent initialProps={initialProps as RawProperty[]} initialPlanos={initialPlanos} />
    </Suspense>
  )
}
