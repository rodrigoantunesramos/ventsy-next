'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATS, DEMO_PROPS, ordenar } from '@/lib/data'
import CategorySection from './CategorySection'
import Link from 'next/link'

async function planosMap() {
  try {
    const { data } = await supabase.from('assinaturas').select('usuario_id, plano_ativo, status')
    const m: Record<string, string> = {}
    ;(data || []).forEach((a: any) => {
      if (a.status === 'ativa' || a.status === 'trial') m[a.usuario_id] = a.plano_ativo
    })
    return m
  } catch { return {} }
}

export default function HomeFeed() {
  const [grupos, setGrupos] = useState<Record<string, any[]>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: props, error }, planos] = await Promise.all([
        supabase.from('propriedades').select('*').eq('publicada', true),
        planosMap()
      ])

      let lista: any[] = props || []

      if (!lista.length || error) {
        lista = DEMO_PROPS.map(p => ({ ...p, _nota: p.nota_media }))
      } else {
        lista = lista.map(p => ({
          ...p,
          _plano: (p.usuario_id && planos[p.usuario_id]) || 'basico',
          _nota: parseFloat(p.avaliacao || 0)
        }))
      }

      const g: Record<string, any[]> = {}
      CATS.forEach(c => { g[c.nome] = [] })
      lista.forEach(p => { if (g[p.categoria] !== undefined) g[p.categoria].push(p) })

      setGrupos(g)
      setLoaded(true)
    }
    load()
  }, [])

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#aaa', fontSize: '.9rem' }}>
      Carregando espaços...
    </div>
  )

  const secoesVisiveis = CATS.filter(c => (grupos[c.nome] || []).length > 0)

  return (
    <>
      {secoesVisiveis.map((cat, idx) => {
        const grupo = ordenar(grupos[cat.nome] || []).slice(0, 7)
        return (
          <>
            <CategorySection key={cat.nome} cat={cat} props={grupo} />
            {idx === 2 && (
              <div className="banner-anuncie" key="banner">
                <div className="banner-inner">
                  <div className="banner-txt">
                    <p>Para proprietários</p>
                    <h3>Anuncie seu espaço na VENTSY</h3>
                    <span>Alcance milhares de pessoas que buscam o espaço ideal para seu evento.</span>
                  </div>
                  <Link href="/cadastro" className="btn-banner">Começar agora →</Link>
                </div>
              </div>
            )}
          </>
        )
      })}
    </>
  )
}
