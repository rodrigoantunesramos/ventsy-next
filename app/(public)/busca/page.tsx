'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SearchResultCard from '@/components/SearchResultCard'
import FilterModal, { type Filtros } from '@/components/FilterModal'
import { supabase } from '@/lib/supabase'

const SIGLA_PARA_NOME: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará',
  PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima',
  SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
}

function BuscaContent() {
  const params  = useSearchParams()
  const router  = useRouter()

  const estadoParam  = params.get('estado')?.toUpperCase() || ''
  const cidadeParam  = params.get('cidade') || ''
  const bairroParam  = params.get('bairro') || ''
  const tipoParam    = params.get('tipo') || params.get('evento') || ''
  const dataParam    = params.get('data') || ''

  const [props, setProps]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [planosMap, setPlanosMap]   = useState<Record<string, string>>({})
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [filtros, setFiltros]       = useState<Filtros | null>(null)
  const [contFiltros, setContFiltros] = useState(0)

  useEffect(() => {
    fetch('/api/planos').then(r => r.json()).then(json => setPlanosMap(json.planos || {}))
  }, [])

  useEffect(() => { buscar(null) }, [estadoParam, cidadeParam, bairroParam, tipoParam])

  async function buscar(f: Filtros | null) {
    setLoading(true)
    let query = supabase.from('propriedades').select('*').eq('publicada', true)

    const estado  = f?.estado || estadoParam
    const cidade  = f?.cidade || cidadeParam
    const bairro  = bairroParam

    if (estado) query = query.eq('estado', estado)
    if (cidade)  query = query.ilike('cidade', `%${cidade}%`)
    if (bairro)  query = query.ilike('bairro', `%${bairro}%`)

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
          `categoria.eq.${v}`
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
    setProps(data || [])
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
    : tipoParam ? tipoParam
    : 'Todos os espaços'

  return (
    <>
      <Header />

      <div className="listagem-split">
        <section className="coluna-cards">
          <div className="header-listagem">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d0d0d', margin: 0 }}>{titulo}</h1>
              <button className="btn-abrir-filtro" onClick={() => setFiltroOpen(true)}>
                ⚙ Filtros{contFiltros > 0 && (
                  <span style={{
                    background: 'var(--vermelho)', color: '#fff', borderRadius: '50%',
                    width: 18, height: 18, display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '.7rem', fontWeight: 800
                  }}>{contFiltros}</span>
                )}
              </button>
            </div>
            {!loading && (
              <p style={{ color: '#888', fontSize: '.88rem' }}>
                {props.length} espaço{props.length !== 1 ? 's' : ''} encontrado{props.length !== 1 ? 's' : ''}
                {dataParam ? ` · ${dataParam}` : ''}
              </p>
            )}
          </div>

          {loading ? (
            <div style={{ color: '#aaa', padding: '40px 0', textAlign: 'center' }}>Carregando...</div>
          ) : props.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: 12 }}>😕 Nenhum espaço encontrado</p>
              <p style={{ color: '#888', marginBottom: 24, fontSize: '.9rem' }}>Tente ajustar os filtros ou buscar em outra região.</p>
              <button onClick={() => router.push('/')}
                style={{ background: 'var(--vermelho)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '.9rem' }}>
                Ver todos os espaços
              </button>
            </div>
          ) : (
            <div className="grid-resultados-split">
              {props.map(p => (
                <SearchResultCard key={p.id} prop={p} plano={(p.usuario_id && planosMap[p.usuario_id]) || 'basico'} />
              ))}
            </div>
          )}
        </section>

        <section className="coluna-mapa">
          <div style={{ width: '100%', height: '100%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#aaa', fontSize: '.9rem', textAlign: 'center', padding: 20 }}>
              🗺️ Mapa integrado<br />
              <span style={{ fontSize: '.8rem' }}>Integre Google Maps ou Leaflet aqui</span>
            </p>
          </div>
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
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#aaa' }}>Carregando...</div>}>
      <BuscaContent />
    </Suspense>
  )
}
