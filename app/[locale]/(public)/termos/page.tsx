import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import { buildAlternates } from '@/lib/i18n/seo'
import '../legal.css'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const t = getDictionary(locale).legal.termos
  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: buildAlternates(locale, '/termos'),
  }
}

// IDs e numeração das seções (alvos de âncora — estáveis, fora do i18n).
const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13']
const nums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13']

export default function TermosPage({ params }: { params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const legal = getDictionary(locale).legal
  const t = legal.termos

  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-tag">{t.heroTag}</span>
          <h1>{t.heroTitulo}</h1>
          <p>{t.heroSub}</p>
        </div>
      </section>

      {/* ── CONTEÚDO ── */}
      <div className="content-wrap">

        <div className="update-badge">
          📅 {t.atualizadoLabel} <span>{t.atualizadoData}</span>
        </div>

        {legal.avisoTraducao && (
          <div className="alerta">
            <span className="alerta-icon">🌐</span>
            <span>{legal.avisoTraducao}</span>
          </div>
        )}

        <div className="alerta">
          <span className="alerta-icon">⚠️</span>
          <span>{t.alerta}</span>
        </div>

        {/* ── ÍNDICE ── */}
        <div className="indice">
          <h2>{t.indiceTitulo}</h2>
          <ol>
            {t.indice.map((titulo, i) => (
              <li key={ids[i]}>
                <a href={`#${ids[i]}`}>{titulo}</a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── SEÇÃO 1 ── */}
        <div className="secao" id={ids[0]}>
          <span className="secao-num">{nums[0]}</span>
          <h2>{t.s1.titulo}</h2>
          <p>{t.s1.intro}</p>
          <ul>
            {t.s1.itensTitulo.map((rotulo, i) => (
              <li key={i}><strong>{rotulo}</strong> {t.s1.itensTexto[i]}</li>
            ))}
          </ul>
        </div>

        {/* ── SEÇÃO 2 ── */}
        <div className="secao" id={ids[1]}>
          <span className="secao-num">{nums[1]}</span>
          <h2>{t.s2.titulo}</h2>
          <p>
            {t.s2.p1a}
            <Link href={localizar(locale, '/privacidade')} className="text-[var(--vermelho)]">{t.s2.p1Link}</Link>
            {t.s2.p1b}
          </p>
          <p>{t.s2.p2}</p>
        </div>

        {/* ── SEÇÃO 3 ── */}
        <div className="secao" id={ids[2]}>
          <span className="secao-num">{nums[2]}</span>
          <h2>{t.s3.titulo}</h2>
          <p>{t.s3.intro}</p>
          <ul>
            {t.s3.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <div className="destaque">{t.s3.destaque}</div>
        </div>

        {/* ── SEÇÃO 4 ── */}
        <div className="secao" id={ids[3]}>
          <span className="secao-num">{nums[3]}</span>
          <h2>{t.s4.titulo}</h2>
          <p>{t.s4.intro}</p>
          <ul>
            {t.s4.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        {/* ── SEÇÃO 5 ── */}
        <div className="secao" id={ids[4]}>
          <span className="secao-num">{nums[4]}</span>
          <h2>{t.s5.titulo}</h2>
          <p>{t.s5.intro}</p>
          <ul>
            {t.s5.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t.s5.fim}</p>
        </div>

        {/* ── SEÇÃO 6 ── */}
        <div className="secao" id={ids[5]}>
          <span className="secao-num">{nums[5]}</span>
          <h2>{t.s6.titulo}</h2>
          <p>{t.s6.intro}</p>
          <ul>
            {t.s6.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        {/* ── SEÇÃO 7 ── */}
        <div className="secao" id={ids[6]}>
          <span className="secao-num">{nums[6]}</span>
          <h2>{t.s7.titulo}</h2>
          <p>{t.s7.p1a}<strong>{t.s7.p1Strong}</strong>{t.s7.p1b}</p>
          <ul>
            {t.s7.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t.s7.fim}</p>
        </div>

        {/* ── SEÇÃO 8 ── */}
        <div className="secao" id={ids[7]}>
          <span className="secao-num">{nums[7]}</span>
          <h2>{t.s8.titulo}</h2>
          <p>{t.s8.intro}</p>
          <ul>
            {t.s8.itensTitulo.map((rotulo, i) => (
              <li key={i}><strong>{rotulo}</strong> {t.s8.itensTexto[i]}</li>
            ))}
          </ul>
          <div className="destaque">{t.s8.destaque}</div>
        </div>

        {/* ── SEÇÃO 9 ── */}
        <div className="secao" id={ids[8]}>
          <span className="secao-num">{nums[8]}</span>
          <h2>{t.s9.titulo}</h2>
          <p>{t.s9.intro}</p>
          <ul>
            {t.s9.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t.s9.p2}</p>
          <p>{t.s9.p3a}<strong>{t.s9.p3Strong}</strong>{t.s9.p3b}</p>
        </div>

        {/* ── SEÇÃO 10 ── */}
        <div className="secao" id={ids[9]}>
          <span className="secao-num">{nums[9]}</span>
          <h2>{t.s10.titulo}</h2>
          <p>{t.s10.p1a}<strong>{t.s10.p1Strong}</strong>{t.s10.p1b}</p>
          <ul>
            {t.s10.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t.s10.fim}</p>
        </div>

        {/* ── SEÇÃO 11 ── */}
        <div className="secao" id={ids[10]}>
          <span className="secao-num">{nums[10]}</span>
          <h2>{t.s11.titulo}</h2>
          <p>{t.s11.p1}</p>
          <p>{t.s11.p2}</p>
          <p>{t.s11.p3}</p>
        </div>

        {/* ── SEÇÃO 12 ── */}
        <div className="secao" id={ids[11]}>
          <span className="secao-num">{nums[11]}</span>
          <h2>{t.s12.titulo}</h2>
          <p>{t.s12.intro}</p>
          <ul>
            {t.s12.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{t.s12.fim}</p>
        </div>

        {/* ── SEÇÃO 13 ── */}
        <div className="secao" id={ids[12]}>
          <span className="secao-num">{nums[12]}</span>
          <h2>{t.s13.titulo}</h2>
          <p>{t.s13.p1}</p>
          <p>{t.s13.p2}</p>
          <p>{t.s13.p3a}<strong><a href="mailto:juridico@ventsy.com.br" className="text-[var(--vermelho)]">juridico@ventsy.com.br</a></strong>.</p>
        </div>

        {/* ── CARD CONTATO ── */}
        <div className="contato-card">
          <h3>{t.contatoTitulo}</h3>
          <p>{t.contatoSub}</p>
          <Link href={localizar(locale, '/fale-conosco')} className="btn-contato">{t.contatoBtn}</Link>
        </div>

      </div>

      <Footer />
    </>
  )
}
