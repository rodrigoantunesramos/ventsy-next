// Server Component: busca os espaços publicados no servidor (HTML no primeiro
// byte → SEO + LCP) e os agrupa por categoria. Os cards/SearchBar continuam
// como ilhas cliente onde há interação.
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CATS, DEMO_PROPS, ordenar } from '@/lib/data'
import { localizar, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/getDictionary'
import CategorySection from './CategorySection'
import type { PropertySummary } from '@/types/client'

export const revalidate = 120

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

async function fetchHomeFeed(): Promise<Record<string, PropertySummary[]>> {
  let raw: Array<Record<string, unknown>> = []
  const planos: Record<string, string> = {}

  try {
    const [{ data: props }, { data: assinaturas }] = await Promise.all([
      admin.from('propriedades')
        .select('id,nome,cidade,estado,bairro,imagem_url,categoria,tipo_propriedade,avaliacao,valor_base,valor_hora,capacidade,usuario_id')
        .limit(300)
        .eq('publicada', true),
      admin.from('assinaturas').select('usuario_id, plano_ativo, status').in('status', ['ativa', 'trial']),
    ])
    raw = props || []
    ;(assinaturas || []).forEach((a: { usuario_id: string; plano_ativo: string }) => {
      const p = (a.plano_ativo || 'basico').toLowerCase()
      if (['basico', 'pro', 'ultra'].includes(p)) planos[a.usuario_id] = p
    })
  } catch {
    /* sem dados — cai no fallback abaixo */
  }

  const usarDemo = process.env.NODE_ENV !== 'production' && raw.length === 0

  const lista: PropertySummary[] = usarDemo
    ? (DEMO_PROPS.map((p) => ({ ...p, _nota: p.nota_media })) as unknown as PropertySummary[])
    : raw.map((p) => {
        const r = p as Record<string, unknown> & { usuario_id?: string; avaliacao?: unknown }
        return {
          ...r,
          _plano: ((r.usuario_id && planos[r.usuario_id]) || 'basico') as 'basico' | 'pro' | 'ultra',
          _nota: String(parseFloat(String(r.avaliacao || 0))),
        } as unknown as PropertySummary
      })

  const grupos: Record<string, PropertySummary[]> = {}
  CATS.forEach((c) => { grupos[c.nome] = [] })
  lista.forEach((p) => { if (p.categoria && grupos[p.categoria] !== undefined) grupos[p.categoria].push(p) })
  return grupos
}

export default async function HomeFeed({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const grupos = await fetchHomeFeed()
  const secoesVisiveis = CATS.filter((c) => (grupos[c.nome] || []).length > 0)

  return (
    <>
      {secoesVisiveis.map((cat, idx) => {
        const grupo = ordenar(grupos[cat.nome] || []).slice(0, 7)
        return (
          <div key={cat.nome}>
            <CategorySection cat={cat} props={grupo} locale={locale} />

            {/* Banner para anunciantes após a 3ª categoria */}
            {idx === 2 && (
              <div className="mx-[5%] my-6 bg-ink rounded-2xl px-8 py-10 flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <p className="text-gray-400 text-sm mb-1">{dict.componentes.homeBanner.paraProprietarios}</p>
                  <h3 className="text-white text-2xl font-bold mb-2">{dict.componentes.homeBanner.titulo}</h3>
                  <span className="text-gray-400 text-sm">
                    {dict.componentes.homeBanner.desc}
                  </span>
                </div>
                <Link
                  href={localizar(locale, '/cadastro')}
                  className="bg-brand hover:bg-brand-600 text-white font-bold py-3 px-7 rounded-xl no-underline transition-colors whitespace-nowrap text-sm"
                >
                  {dict.componentes.homeBanner.cta}
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
