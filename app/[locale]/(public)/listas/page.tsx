// Vitrine PÚBLICA das Listas Oficiais — (public)/listas.
// Server component (SEO/OpenGraph + ISR): lê listas públicas via service-role e
// monta destaques, ranking e navegação por categoria/cidade. Cada card abre a
// lista em /listas/[slug]. Filtros (categoria/cidade/q) via searchParams (links,
// sem JS). Sem "R$" — listas não carregam valores monetários.

import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getDictionary } from '@/lib/i18n/getDictionary';
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config';
import { buildAlternates } from '@/lib/i18n/seo';
import {
  fetchListasPublicas, categoriaLabel, engajamento, type PublicLista,
} from './_data';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const t = getDictionary(locale).listas.meta;
  return {
    title: t.indexTitle,
    description: t.indexDescription,
    alternates: buildAlternates(locale, '/listas'),
    openGraph: {
      title: t.indexOgTitle,
      description: t.indexOgDescription,
      url: localizar(locale, '/listas'),
      type: 'website',
    },
  };
}

function uniqCount(items: (string | null)[]): { v: string; n: number }[] {
  const m = new Map<string, number>();
  for (const it of items) { const k = (it || '').trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([v, n]) => ({ v, n })).sort((a, b) => b.n - a.n);
}

export default async function ListasIndexPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { categoria?: string; cidade?: string; q?: string };
}) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const dict = getDictionary(locale);
  const t = dict.listas.index;
  const tc = dict.listas.card;

  const todas = await fetchListasPublicas(120);

  const categorias = uniqCount(todas.map((l) => l.categoria));
  const cidades = uniqCount(todas.map((l) => l.cidade)).slice(0, 12);

  const fCat = searchParams.categoria?.trim() || '';
  const fCidade = searchParams.cidade?.trim() || '';
  const q = searchParams.q?.trim().toLowerCase() || '';
  const filtrando = !!(fCat || fCidade || q);

  let filtradas = todas;
  if (fCat) filtradas = filtradas.filter((l) => l.categoria === fCat);
  if (fCidade) filtradas = filtradas.filter((l) => l.cidade === fCidade);
  if (q) filtradas = filtradas.filter((l) => l.titulo.toLowerCase().includes(q) || (l.descricao || '').toLowerCase().includes(q) || (l.cidade || '').toLowerCase().includes(q));

  const destaques = [...todas].sort((a, b) => engajamento(b) - engajamento(a)).slice(0, 3);
  const ranking = [...todas].sort((a, b) => engajamento(b) - engajamento(a)).slice(0, 6);

  const headingFiltrado = (() => {
    const base = (filtradas.length === 1 ? t.encontradaSingular : t.encontradaPlural).replace('{n}', String(filtradas.length));
    const cat = fCat ? t.emCategoria.replace('{cat}', categoriaLabel(fCat)) : '';
    const cid = fCidade ? ` · ${fCidade}` : '';
    return `${base}${cat}${cid}`;
  })();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f7f7f8]">
        {/* Hero */}
        <section className="border-b border-black/[0.06] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{t.heroTag}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">{t.heroTitulo}</h1>
            <p className="mt-3 max-w-2xl text-base text-ink-muted">{t.heroSub}</p>

            {/* Busca */}
            <form action={localizar(locale, '/listas')} method="get" className="mt-6 flex max-w-lg items-center gap-2">
              <input name="q" defaultValue={searchParams.q ?? ''} placeholder={t.buscaPlaceholder} className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              <button type="submit" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{t.buscarBtn}</button>
            </form>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8">
          {todas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white py-16 text-center">
              <h2 className="font-display text-xl font-bold text-ink">{t.vazioTitulo}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t.vazioTexto}</p>
              <Link href={localizar(locale, '/painel/listas')} className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">{t.vazioCta}</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
              {/* Coluna principal */}
              <div className="min-w-0">
                {/* Destaques (só sem filtro) */}
                {!filtrando && destaques.length > 0 && (
                  <section className="mb-8">
                    <h2 className="mb-3 text-lg font-bold text-ink">{t.destaques}</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {destaques.map((l) => <CardDestaque key={l.id} l={l} locale={locale} tc={tc} />)}
                    </div>
                  </section>
                )}

                {/* Navegação por categoria */}
                {categorias.length > 0 && (
                  <div className="mb-6 flex flex-wrap gap-2">
                    <Chip href={localizar(locale, '/listas')} active={!fCat && !fCidade && !q} label={t.todas} />
                    {categorias.map((c) => (
                      <Chip key={c.v} href={localizar(locale, `/listas?categoria=${encodeURIComponent(c.v)}`)} active={fCat === c.v} label={`${categoriaLabel(c.v)} · ${c.n}`} />
                    ))}
                  </div>
                )}

                <h2 className="mb-3 text-lg font-bold text-ink">
                  {filtrando ? headingFiltrado : t.todasAsListas}
                </h2>

                {filtradas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white py-12 text-center">
                    <p className="text-sm text-ink-muted">{t.semFiltro}</p>
                    <Link href={localizar(locale, '/listas')} className="mt-3 inline-block text-sm font-semibold text-brand underline">{t.verTodas}</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {filtradas.map((l) => <CardLista key={l.id} l={l} locale={locale} tc={tc} />)}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="space-y-6">
                {ranking.length > 0 && (
                  <div className="rounded-2xl bg-white p-5 shadow-card">
                    <h3 className="mb-3 text-sm font-bold text-ink">{t.maisPopulares}</h3>
                    <ol className="space-y-3">
                      {ranking.map((l, i) => (
                        <li key={l.id}>
                          <Link href={localizar(locale, `/listas/${l.slug}`)} className="flex items-start gap-3 group">
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{i + 1}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand">{l.titulo}</span>
                              <span className="block text-xs text-ink-muted">{l.n_itens} {tc.itens} · {l.curtidas} {tc.curtidas}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {cidades.length > 0 && (
                  <div className="rounded-2xl bg-white p-5 shadow-card">
                    <h3 className="mb-3 text-sm font-bold text-ink">{t.porCidade}</h3>
                    <div className="flex flex-wrap gap-2">
                      {cidades.map((c) => (
                        <Chip key={c.v} href={localizar(locale, `/listas?cidade=${encodeURIComponent(c.v)}`)} active={fCidade === c.v} label={`${c.v} · ${c.n}`} small />
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50 p-5">
                  <h3 className="text-sm font-bold text-ink">{t.crieTitulo}</h3>
                  <p className="mt-1 text-xs text-ink-soft">{t.crieTexto}</p>
                  <Link href={localizar(locale, '/painel/listas')} className="mt-3 inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">{t.crieCta}</Link>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

type CardT = { itens: string; curtidas: string; por: string };

// ── Cards (server-rendered) ──
function CardDestaque({ l, locale, tc }: { l: PublicLista; locale: Locale; tc: CardT }) {
  return (
    <Link href={localizar(locale, `/listas/${l.slug}`)} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-pop">
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-brand-100 to-amber-100">
        {l.capa_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={l.capa_url} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
          : <div className="flex h-full w-full items-center justify-center text-brand/40"><IcoList size={40} /></div>}
        {l.categoria && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.65rem] font-bold text-brand">{categoriaLabel(l.categoria)}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-bold leading-snug text-ink group-hover:text-brand">{l.titulo}</h3>
        <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-ink-muted">
          <span>{l.n_itens} {tc.itens}</span><span>·</span><span>♥ {l.curtidas}</span>{l.cidade && <><span>·</span><span className="truncate">{l.cidade}</span></>}
        </div>
      </div>
    </Link>
  );
}

function CardLista({ l, locale, tc }: { l: PublicLista; locale: Locale; tc: CardT }) {
  return (
    <Link href={localizar(locale, `/listas/${l.slug}`)} className="group flex gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-card transition hover:shadow-pop">
      <div className="h-24 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 to-amber-50">
        {l.capa_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={l.capa_url} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-brand/40"><IcoList size={26} /></div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          {l.categoria && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-semibold text-brand">{categoriaLabel(l.categoria)}</span>}
          {l.cidade && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.6rem] font-semibold text-ink-soft">{l.cidade}</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-ink group-hover:text-brand">{l.titulo}</h3>
        {l.descricao && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{l.descricao}</p>}
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-ink-muted">
          <span>{l.n_itens} {tc.itens}</span><span>♥ {l.curtidas}</span><span>⤓ {l.salvos}</span>
          {l.autor_nome && <span className="truncate">{tc.por} {l.autor_nome}</span>}
        </div>
      </div>
    </Link>
  );
}

function Chip({ href, active, label, small }: { href: string; active?: boolean; label: string; small?: boolean }) {
  return (
    <Link href={href} className={`rounded-full border px-3 ${small ? 'py-1 text-[0.7rem]' : 'py-1.5 text-xs'} font-semibold transition ${active ? 'border-brand bg-brand text-white' : 'border-black/10 bg-white text-ink-soft hover:border-brand/40 hover:text-brand'}`}>
      {label}
    </Link>
  );
}

function IcoList({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
