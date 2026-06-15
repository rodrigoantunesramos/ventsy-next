import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/getDictionary'
import { isLocale, defaultLocale, localizar, type Locale } from '@/lib/i18n/config'
import '../legal.css'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const p = getDictionary(locale).legal.privacidade
  return {
    title: p.meta.title,
    description: p.meta.description,
    alternates: { canonical: localizar(locale, '/privacidade') },
  }
}

// IDs e numeração das seções (alvos de âncora — estáveis, fora do i18n).
const ids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11']
const nums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']

export default function PrivacidadePage({ params }: { params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : defaultLocale
  const p = getDictionary(locale).legal.privacidade

  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-tag">{p.heroTag}</span>
          <h1>{p.heroTitulo}</h1>
          <p>{p.heroSub}</p>
        </div>
      </section>

      {/* ── CONTEÚDO ── */}
      <div className="content-wrap">

        <div className="update-badge">
          📅 {p.atualizadoLabel} <span>{p.atualizadoData}</span>
        </div>

        {/* ── ÍNDICE ── */}
        <div className="indice">
          <h2>{p.indiceTitulo}</h2>
          <ol>
            {p.indice.map((titulo, i) => (
              <li key={ids[i]}>
                <a href={`#${ids[i]}`}>{titulo}</a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 01 ── */}
        <div className="secao" id={ids[0]}>
          <span className="secao-num">{nums[0]}</span>
          <h2>{p.s1.titulo}</h2>
          <p>{p.s1.p1a}<strong>{p.s1.p1Strong}</strong>{p.s1.p1b}</p>
          <p>{p.s1.p2a}<strong>{p.s1.p2Strong}</strong>{p.s1.p2b}</p>
        </div>

        {/* ── 02 ── */}
        <div className="secao" id={ids[1]}>
          <span className="secao-num">{nums[1]}</span>
          <h2>{p.s2.titulo}</h2>
          <p>{p.s2.intro}</p>
          <ul>
            {p.s2.itensTitulo.map((rotulo, i) => (
              <li key={i}><strong>{rotulo}</strong> {p.s2.itensTexto[i]}</li>
            ))}
          </ul>
        </div>

        {/* ── 03 ── */}
        <div className="secao" id={ids[2]}>
          <span className="secao-num">{nums[2]}</span>
          <h2>{p.s3.titulo}</h2>
          <p>{p.s3.intro}</p>
          <ul>
            {p.s3.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <div className="destaque">{p.s3.destaque}</div>
        </div>

        {/* ── 04 ── */}
        <div className="secao" id={ids[3]}>
          <span className="secao-num">{nums[3]}</span>
          <h2>{p.s4.titulo}</h2>
          <p>{p.s4.intro}</p>
          <ul>
            {p.s4.itensTitulo.map((rotulo, i) => (
              <li key={i}><strong>{rotulo}</strong> {p.s4.itensTexto[i]}</li>
            ))}
          </ul>
        </div>

        {/* ── 05 ── */}
        <div className="secao" id={ids[4]}>
          <span className="secao-num">{nums[4]}</span>
          <h2>{p.s5.titulo}</h2>
          <p>{p.s5.intro}</p>
          <ul>
            {p.s5.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{p.s5.fim}</p>
        </div>

        {/* ── 06 ── */}
        <div className="secao" id={ids[5]}>
          <span className="secao-num">{nums[5]}</span>
          <h2>{p.s6.titulo}</h2>
          <p>{p.s6.intro}</p>
          <ul>
            {p.s6.itens.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p>{p.s6.fim}</p>
        </div>

        {/* ── 07 ── */}
        <div className="secao" id={ids[6]}>
          <span className="secao-num">{nums[6]}</span>
          <h2>{p.s7.titulo}</h2>
          <p>{p.s7.intro}</p>
          <ul>
            {p.s7.itensTitulo.map((rotulo, i) => (
              <li key={i}><strong>{rotulo}</strong> {p.s7.itensTexto[i]}</li>
            ))}
          </ul>
          <p>{p.s7.fimA}<strong><a href="mailto:privacidade@ventsy.com.br" className="text-[var(--vermelho)]">privacidade@ventsy.com.br</a></strong>{p.s7.fimB}</p>
        </div>

        {/* ── 08 ── */}
        <div className="secao" id={ids[7]}>
          <span className="secao-num">{nums[7]}</span>
          <h2>{p.s8.titulo}</h2>
          <p>{p.s8.p1a}<strong>{p.s8.p1Strong}</strong>{p.s8.p1b}</p>
          <p>{p.s8.p2}</p>
        </div>

        {/* ── 09 ── */}
        <div className="secao" id={ids[8]}>
          <span className="secao-num">{nums[8]}</span>
          <h2>{p.s9.titulo}</h2>
          <p>{p.s9.p1a}<strong>{p.s9.p1Strong}</strong>{p.s9.p1b}</p>
        </div>

        {/* ── 10 ── */}
        <div className="secao" id={ids[9]}>
          <span className="secao-num">{nums[9]}</span>
          <h2>{p.s10.titulo}</h2>
          <p>{p.s10.p1a}<strong>{p.s10.p1Strong}</strong>{p.s10.p1b}</p>
          <p>{p.s10.p2}</p>
        </div>

        {/* ── 11 ── */}
        <div className="secao" id={ids[10]}>
          <span className="secao-num">{nums[10]}</span>
          <h2>{p.s11.titulo}</h2>
          <p>{p.s11.intro}</p>
          <ul>
            <li><strong>{p.s11.emailLabel}</strong> <a href="mailto:privacidade@ventsy.com.br" className="text-[var(--vermelho)]">privacidade@ventsy.com.br</a></li>
            <li><strong>{p.s11.atendimentoLabel}</strong> {p.s11.atendimentoValor}</li>
            <li><strong>{p.s11.prazoLabel}</strong> {p.s11.prazoValor}</li>
          </ul>
        </div>

        {/* ── CARD CONTATO ── */}
        <div className="contato-card">
          <h3>{p.contatoTitulo}</h3>
          <p>{p.contatoSub}</p>
          <Link href={localizar(locale, '/fale-conosco')} className="btn-contato">{p.contatoBtn}</Link>
        </div>

      </div>

      <Footer />
    </>
  )
}
