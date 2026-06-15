// Página PÚBLICA de vaga — /vagas/[slug]. Server Component: conteúdo e metadata
// renderizados no servidor (indexável + Google for Jobs via JSON-LD JobPosting).
// O formulário de candidatura é uma ilha cliente (_Candidatura).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatMoneyShort } from '@/lib/format'
import { SITE_NAME, SITE_URL, abs } from '@/lib/site'
import { fetchVagaPorSlug, type Vaga } from './_data'
import Candidatura from './_Candidatura'

export const revalidate = 300

const CONTRATO_LABEL: Record<string, string> = { clt: 'CLT', horista: 'Horista', mei: 'MEI/PJ', estagio: 'Estágio', freelancer: 'Freelancer' }
// Mapeia o tipo de contrato para o employmentType do schema.org JobPosting.
const EMPLOYMENT_TYPE: Record<string, string> = { clt: 'FULL_TIME', horista: 'PART_TIME', mei: 'CONTRACTOR', estagio: 'INTERN', freelancer: 'CONTRACTOR' }

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const vaga = await fetchVagaPorSlug(params.slug)
  if (!vaga) return { title: 'Vaga não encontrada', robots: { index: false } }
  const desc = (vaga.descricao || `Vaga de ${vaga.titulo} na ${SITE_NAME}. Candidate-se online.`).replace(/\s+/g, ' ').slice(0, 160)
  return {
    title: `${vaga.titulo}${vaga.local ? ` — ${vaga.local}` : ''}`,
    description: desc,
    alternates: { canonical: `/vagas/${vaga.slug}` },
    openGraph: { title: vaga.titulo, description: desc, type: 'article', url: abs(`/vagas/${vaga.slug}`) },
  }
}

function jobPostingLd(vaga: Vaga) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: vaga.titulo,
    description: [vaga.descricao, vaga.requisitos && `Requisitos:\n${vaga.requisitos}`, vaga.beneficios && `Benefícios:\n${vaga.beneficios}`]
      .filter(Boolean)
      .join('\n\n'),
    ...(vaga.criado_em ? { datePosted: vaga.criado_em } : {}),
    ...(EMPLOYMENT_TYPE[vaga.tipo_contrato] ? { employmentType: EMPLOYMENT_TYPE[vaga.tipo_contrato] } : {}),
    hiringOrganization: { '@type': 'Organization', name: SITE_NAME, sameAs: SITE_URL },
    directApply: true,
    url: abs(`/vagas/${vaga.slug}`),
    ...(vaga.local
      ? { jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: vaga.local, addressCountry: 'BR' } } }
      : { jobLocationType: 'TELECOMMUTE' }),
    ...(vaga.salario_min || vaga.salario_max
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'BRL',
            value: {
              '@type': 'QuantitativeValue',
              ...(vaga.salario_min ? { minValue: vaga.salario_min } : {}),
              ...(vaga.salario_max ? { maxValue: vaga.salario_max } : {}),
              unitText: 'MONTH',
            },
          },
        }
      : {}),
  }
}

export default async function VagaPublicaPage({ params }: { params: { slug: string } }) {
  const vaga = await fetchVagaPorSlug(params.slug)
  if (!vaga) notFound()

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(vaga)) }} />

      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center px-4">
          <Link href="/" className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-5">
          <article className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{vaga.titulo}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {vaga.departamento && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{vaga.departamento}</span>}
              <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{CONTRATO_LABEL[vaga.tipo_contrato] ?? vaga.tipo_contrato}</span>
              {vaga.local && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{vaga.local}</span>}
              {(vaga.salario_min || vaga.salario_max) && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  {[vaga.salario_min, vaga.salario_max].filter(Boolean).map((x) => formatMoneyShort(x!)).join(' – ')}
                </span>
              )}
            </div>
            {vaga.descricao && <Secao titulo="Descrição">{vaga.descricao}</Secao>}
            {vaga.requisitos && <Secao titulo="Requisitos">{vaga.requisitos}</Secao>}
            {vaga.beneficios && <Secao titulo="Benefícios">{vaga.beneficios}</Secao>}
          </article>

          <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
            <h2 className="font-display text-lg font-bold text-ink">Candidate-se</h2>
            <Candidatura slug={vaga.slug} />
          </div>
        </div>
      </main>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-muted">{titulo}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  )
}
