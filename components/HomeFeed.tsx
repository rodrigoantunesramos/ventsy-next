'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CATS, DEMO_PROPS, ordenar } from '@/lib/data'
import CategorySection from './CategorySection'
import type { PropertySummary } from '@/types/client'

async function fetchPlanosMap(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/planos')
    const json = await res.json()
    return json.planos || {}
  } catch { return {} }
}

export default function HomeFeed() {
  const [grupos, setGrupos] = useState<Record<string, PropertySummary[]>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: props, error }, planos] = await Promise.all([
        supabase.from('propriedades').select('*').eq('publicada', true),
        fetchPlanosMap(),
      ])

      type RawProp = PropertySummary & { usuario_id?: string }
      const raw: RawProp[] = (props || []) as RawProp[]

      let lista: PropertySummary[]
      if (!raw.length || error) {
        lista = DEMO_PROPS.map(p => ({ ...p, _nota: p.nota_media })) as unknown as PropertySummary[]
      } else {
        lista = raw.map(p => ({
          ...p,
          _plano: ((p.usuario_id && planos[p.usuario_id]) || 'basico') as 'basico' | 'pro' | 'ultra',
          _nota: String(parseFloat(String(p.avaliacao || 0))),
        }))
      }

      const g: Record<string, PropertySummary[]> = {}
      CATS.forEach(c => { g[c.nome] = [] })
      lista.forEach(p => { if (p.categoria && g[p.categoria] !== undefined) g[p.categoria].push(p) })

      setGrupos(g)
      setLoaded(true)
    }
    load()
  }, [])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Carregando espaços...
      </div>
    )
  }

  const secoesVisiveis = CATS.filter(c => (grupos[c.nome] || []).length > 0)

  return (
    <>
      {secoesVisiveis.map((cat, idx) => {
        const grupo = ordenar(grupos[cat.nome] || []).slice(0, 7)
        return (
          <div key={cat.nome}>
            <CategorySection cat={cat} props={grupo} />

            {/* Banner para anunciantes após a 3ª categoria */}
            {idx === 2 && (
              <div className="mx-[5%] my-6 bg-[#0d0d0d] rounded-2xl px-8 py-10 flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Para proprietários</p>
                  <h3 className="text-white text-2xl font-bold mb-2">Anuncie seu espaço na VENTSY</h3>
                  <span className="text-gray-400 text-sm">
                    Alcance milhares de pessoas que buscam o espaço ideal para seu evento.
                  </span>
                </div>
                <Link
                  href="/cadastro"
                  className="bg-[#ff385c] hover:bg-[#e0304f] text-white font-bold py-3 px-7 rounded-xl no-underline transition-colors whitespace-nowrap text-sm"
                >
                  Começar agora →
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
