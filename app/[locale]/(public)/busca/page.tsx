// Busca — /busca. Server Component "casca": gera metadata dinâmica por região/
// tipo (title/description/canonical indexáveis, ex. "Espaços para eventos em São
// Paulo"). A listagem interativa (filtros, mapa, re-query) é a ilha _BuscaClient.
import type { Metadata } from 'next'
import { SITE_NAME, abs } from '@/lib/site'
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

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const estado = one(searchParams.estado).toUpperCase()
  const cidade = one(searchParams.cidade)
  const tipo = one(searchParams.tipo) || one(searchParams.evento)
  const nomeEstado = SIGLA_PARA_NOME[estado] || estado

  let titulo: string
  let local = ''
  if (cidade) { local = `${cidade}${estado ? `, ${estado}` : ''}`; titulo = `Espaços para eventos em ${local}` }
  else if (estado) { local = nomeEstado; titulo = `Espaços para eventos em ${nomeEstado}` }
  else if (tipo) { titulo = `Espaços para ${tipo}` }
  else { titulo = 'Buscar espaços para eventos' }

  const desc = local
    ? `Encontre e compare espaços para eventos em ${local}: casas de festa, sítios, salões, rooftops e mais. Filtre por capacidade, preço e tipo de evento na ${SITE_NAME}.`
    : `Encontre e compare espaços para eventos no Brasil${tipo ? ` para ${tipo}` : ''}. Filtre por cidade, capacidade e tipo de evento na ${SITE_NAME}.`

  // Canonical por região (estado/cidade ou tipo) — concentra o sinal de SEO e
  // ignora filtros voláteis (preço, comodidades, etc.).
  const cp = new URLSearchParams()
  if (estado) cp.set('estado', estado)
  if (cidade) cp.set('cidade', cidade)
  if (!estado && !cidade && tipo) cp.set('tipo', tipo)
  const qs = cp.toString()
  const canonical = `/busca${qs ? `?${qs}` : ''}`

  return {
    title: titulo,
    description: desc,
    alternates: { canonical },
    openGraph: { title: `${titulo} · ${SITE_NAME}`, description: desc, url: abs(canonical) },
  }
}

export default async function BuscaPage({ searchParams }: { searchParams: SP }) {
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
