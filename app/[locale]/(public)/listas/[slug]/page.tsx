// Página PÚBLICA de uma Lista Oficial — (public)/listas/[slug].
// Server component (SEO/OpenGraph dinâmico por lista + ISR). Lê a lista pública e
// seus itens via service-role; itens que apontam para uma propriedade da
// plataforma LINKAM ao anúncio (/propriedade/[id]). A interação (curtir/salvar/
// seguir/compartilhar) é uma ilha cliente (_Interacoes) sob RLS. Sem "R$".

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  fetchListaPorSlug, fetchRelacionadas, categoriaLabel, TIPO_LABEL, type PublicItem,
} from '../_data';
import Interacoes from './_Interacoes';
import { SITE_URL, abs } from '@/lib/site';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const res = await fetchListaPorSlug(params.slug);
  if (!res) return { title: 'Lista não encontrada — VENTSY' };
  const { lista } = res;
  const desc = (lista.descricao || `Uma seleção de ${lista.n_itens} recomendações para o seu evento, pela comunidade VENTSY.`).slice(0, 160);
  const titulo = `${lista.titulo} — Listas Oficiais | VENTSY`;
  return {
    title: titulo,
    description: desc,
    openGraph: {
      title: lista.titulo,
      description: desc,
      type: 'article',
      ...(lista.capa_url ? { images: [{ url: lista.capa_url }] } : {}),
    },
    twitter: { card: lista.capa_url ? 'summary_large_image' : 'summary', title: lista.titulo, description: desc },
  };
}

export default async function ListaPublicaPage({ params }: { params: { slug: string } }) {
  const res = await fetchListaPorSlug(params.slug);
  if (!res) notFound();
  const { lista, itens } = res;
  const relacionadas = await fetchRelacionadas(lista, 6);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Listas Oficiais', item: abs('/listas') },
          { '@type': 'ListItem', position: 3, name: lista.titulo, item: abs(`/listas/${lista.slug}`) },
        ],
      },
      {
        '@type': 'ItemList',
        name: lista.titulo,
        numberOfItems: itens.length,
        itemListElement: itens.map((it, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: it.ref_nome || it.nome_externo || 'Item',
          ...(it.propriedade_id != null ? { url: abs(`/propriedade/${it.propriedade_id}`) } : {}),
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header />
      <main className="min-h-screen bg-[#f7f7f8]">
        {/* Capa / cabeçalho */}
        <section className="relative">
          <div className="h-52 w-full overflow-hidden bg-gradient-to-br from-brand-100 to-amber-100 sm:h-64">
            {lista.capa_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lista.capa_url} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
          <div className="mx-auto max-w-4xl px-4">
            <div className="-mt-24 rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <nav className="mb-2 text-xs text-ink-muted">
                <Link href="/listas" className="font-semibold text-brand hover:underline">Listas Oficiais</Link>
                {lista.categoria && <> · <Link href={`/listas?categoria=${encodeURIComponent(lista.categoria)}`} className="hover:underline">{categoriaLabel(lista.categoria)}</Link></>}
              </nav>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{lista.titulo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {lista.autor_nome && <span>por <strong className="text-ink-soft">{lista.autor_nome}</strong></span>}
                {lista.cidade && <span>· {lista.cidade}</span>}
                <span>· {lista.n_itens} {lista.n_itens === 1 ? 'item' : 'itens'}</span>
              </div>
              {lista.descricao && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{lista.descricao}</p>}
              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <Interacoes listaId={lista.id} autorId={lista.autor_id} slug={lista.slug} titulo={lista.titulo} curtidas={lista.curtidas} salvos={lista.salvos} />
              </div>
            </div>
          </div>
        </section>

        {/* Itens */}
        <section className="mx-auto max-w-4xl px-4 py-8">
          {itens.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/10 bg-white py-12 text-center text-sm text-ink-muted">Esta lista ainda não tem itens.</p>
          ) : (
            <ol className="space-y-3">
              {itens.map((it, idx) => <ItemCard key={it.id} item={it} pos={idx + 1} />)}
            </ol>
          )}
        </section>

        {/* Relacionadas */}
        {relacionadas.length > 0 && (
          <section className="mx-auto max-w-4xl px-4 pb-12">
            <h2 className="mb-3 text-lg font-bold text-ink">Listas relacionadas</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relacionadas.map((r) => (
                <Link key={r.id} href={`/listas/${r.slug}`} className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-pop">
                  <div className="h-24 w-full overflow-hidden bg-gradient-to-br from-brand-50 to-amber-50">
                    {r.capa_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.capa_url} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-brand/40"><IcoList /></div>}
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink group-hover:text-brand">{r.titulo}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{r.n_itens} itens · ♥ {r.curtidas}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

// ── Card de item (linka ao anúncio quando é propriedade da plataforma) ──
function ItemCard({ item, pos }: { item: PublicItem; pos: number }) {
  const nome = item.ref_nome || item.nome_externo || 'Item';
  const naPlataforma = item.propriedade_id != null;

  const inner = (
    <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-card transition group-hover:shadow-pop">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">{pos}</span>
      {item.ref_imagem
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={item.ref_imagem} alt="" className="h-20 w-28 flex-shrink-0 rounded-xl object-cover" />
        : <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-ink-muted"><IcoImage /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`truncate font-bold text-ink ${naPlataforma ? 'group-hover:text-brand' : ''}`}>{nome}</h3>
          <span className="flex-shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-semibold text-ink-soft">{TIPO_LABEL[item.tipo] ?? item.tipo}</span>
          {naPlataforma && <span className="flex-shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-semibold text-brand">na VENTSY</span>}
        </div>
        {item.ref_cidade && <p className="mt-0.5 truncate text-xs text-ink-muted">{item.ref_cidade}</p>}
        {item.nota != null && <Stars value={item.nota} />}
        {item.comentario && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.comentario}</p>}
        {naPlataforma && <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">Ver anúncio <IcoArrow /></span>}
      </div>
    </div>
  );

  return naPlataforma
    ? <li><Link href={`/propriedade/${item.propriedade_id}`} className="group block">{inner}</Link></li>
    : <li className="group">{inner}</li>;
}

function Stars({ value }: { value: number }) {
  const v = Math.round(value);
  return (
    <div className="mt-1 flex items-center gap-0.5" aria-label={`Nota ${v} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= v ? 'text-amber-400' : 'text-black/15'}>★</span>)}
    </div>
  );
}

function IcoList() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
function IcoImage() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>; }
function IcoArrow() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
