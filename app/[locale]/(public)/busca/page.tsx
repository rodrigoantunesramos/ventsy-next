// Busca — /busca. Server Component "casca": gera metadata dinâmica por região/
// tipo (title/description/canonical indexáveis, ex. "Espaços para eventos em São
// Paulo"). A listagem interativa (filtros, mapa, re-query) é a ilha _BuscaClient.
import type { Metadata } from 'next'
import { SITE_NAME, abs } from '@/lib/site'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'
import BuscaClient from './_BuscaClient'
import { fetchBuscaInicial } from './_data'

const SIGLA_PARA_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

type SP = { [k: string]: string | string[] | undefined }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ''

export async function generateMetadata(
  { params, searchParams }: { params: { locale: string }; searchParams: SP },
): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const m = getDictionary(locale).busca.meta

  const estado = one(searchParams.estado).toUpperCase()
  const cidade = one(searchParams.cidade)
  const tipo = one(searchParams.tipo) || one(searchParams.evento)
  const nomeEstado = SIGLA_PARA_NOME[estado] || estado

  let titulo: string
  let local = ''
  if (cidade) { local = `${cidade}${estado ? `, ${estado}` : ''}`; titulo = m.tituloCidade.replace('{local}', local) }
  else if (estado) { local = nomeEstado; titulo = m.tituloEstado.replace('{estado}', nomeEstado) }
  else if (tipo) { titulo = m.tituloTipo.replace('{tipo}', tipo) }
  else { titulo = m.tituloPadrao }

  const desc = local
    ? m.descComLocal.replace('{local}', local).replace('{site}', SITE_NAME)
    : m.descSemLocal
        .replace('{tipo}', tipo ? m.descSemLocalTipo.replace('{tipo}', tipo) : '')
        .replace('{site}', SITE_NAME)

  // Canonical por região (estado/cidade ou tipo) — concentra o sinal de SEO e
  // ignora filtros voláteis (preço, comodidades, etc.).
  const cp = new URLSearchParams()
  if (estado) cp.set('estado', estado)
  if (cidade) cp.set('cidade', cidade)
  if (!estado && !cidade && tipo) cp.set('tipo', tipo)
  const qs = cp.toString()
  const canonical = localizar(locale, `/busca${qs ? `?${qs}` : ''}`)

  return {
    title: titulo,
    description: desc,
    // hreflang sem a query string (rota base /busca); mantém o canonical por
    // região (estado/cidade/tipo) que concentra o sinal de SEO.
    alternates: { ...buildAlternates(locale, '/busca'), canonical },
    openGraph: { title: `${titulo} · ${SITE_NAME}`, description: desc, url: abs(canonical) },
  }
}

export default async function BuscaPage({ searchParams }: { params: { locale: string }; searchParams: SP }) {
  // Converte os searchParams (objeto) num URLSearchParams e faz a query inicial
  // no servidor → a listagem já vem no HTML (SEO/LCP); a ilha re-busca em mudanças.
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    const val = Array.isArray(v) ? v[0] : v
    if (val) sp.set(k, val)
  }
  const { props, planos } = await fetchBuscaInicial(sp)
  return <BuscaClient initialProps={props} initialPlanos={planos} />
}
