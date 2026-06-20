'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, authHeaders } from '@/lib/supabase'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CATS, ESTADOS } from '@/lib/data'
import { useT } from '@/components/i18n/I18nProvider'
import { rotuloDado } from '@/lib/i18n/dados'

const COMODIDADES = [
  'Wi-Fi', 'Estacionamento', 'Churrasqueira', 'Piscina', 'Ar-condicionado',
  'Som ambiente', 'Cozinha equipada', 'Acessibilidade', 'Segurança', 'Área verde',
  'Banheiros', 'Gerador',
]

const inputCls =
  'w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition'
const labelCls = 'block text-sm font-semibold text-ink-soft mb-1.5'

async function geocode(cidade: string, uf: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${cidade}, ${uf}, Brasil`)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
      headers: { Accept: 'application/json' },
    })
    const arr = await res.json()
    if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) {
      return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
    }
  } catch {
    /* ignora — segue sem coordenadas */
  }
  return null
}

export default function AnunciarPage() {
  const router = useRouter()
  const { dict, lhref } = useT()
  const t = dict.anunciar

  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [endereco, setEndereco] = useState('')
  const [capacidade, setCapacidade] = useState('')
  const [valorHora, setValorHora] = useState('')
  const [valorBase, setValorBase] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [comodidades, setComodidades] = useState<string[]>([])

  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setAuthChecked(true)
    })
  }, [])

  function toggleComodidade(c: string) {
    setComodidades((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  function onSelecionarFoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setErro(t.erros.imagemTipo); return }
    if (f.size > 8 * 1024 * 1024) { setErro(t.erros.imagemTamanho); return }
    setErro('')
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(f)
    setFotoPreview(URL.createObjectURL(f))
  }

  function validar(): string | null {
    if (nome.trim().length < 3) return t.erros.nomeCurto
    if (!categoria) return t.erros.categoria
    if (!estado) return t.erros.estado
    if (cidade.trim().length < 2) return t.erros.cidade
    if (!valorHora && !valorBase) return t.erros.preco
    return null
  }

  async function publicar() {
    if (enviando) return
    setErro('')

    const msg = validar()
    if (msg) { setErro(msg); return }

    if (!userId) {
      setErro(t.erros.naoLogado)
      return
    }

    setEnviando(true)
    try {
      const coords = await geocode(cidade.trim(), estado)

      const payload = {
        usuario_id: userId,
        nome: nome.trim(),
        categoria,
        tipo_propriedade: categoria,
        descricao: descricao.trim() || null,
        estado,
        cidade: cidade.trim(),
        bairro: bairro.trim() || null,
        endereco: endereco.trim() || null,
        capacidade: capacidade ? Number(capacidade) : null,
        valor_hora: valorHora ? Number(valorHora) : null,
        valor_base: valorBase ? Number(valorBase) : null,
        whatsapp: whatsapp.replace(/\D/g, '') || null,
        imagem_url: null, // definida pelo upload (/api/fotos) logo após criar a propriedade
        comodidades: comodidades.length ? `{${comodidades.join(',')}}` : null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        publicada: false, // fila de aprovação: vai ao ar após o admin aprovar em /admin/propriedades
        avaliacao: null,
      }

      const { data, error } = await supabase
        .from('propriedades')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setErro(`${t.erros.publicarPrefixo} ${error.message}`)
        setEnviando(false)
        return
      }

      // Upload da foto de capa, se houver — reusa /api/fotos (entra na galeria e vira a capa).
      if (fotoFile) {
        try {
          const fd = new FormData()
          fd.append('propriedadeId', String(data.id))
          fd.append('files', fotoFile)
          fd.append('tipo', 'espaco')
          await fetch('/api/fotos', { method: 'POST', headers: { ...(await authHeaders()) }, body: fd })
        } catch { /* publica mesmo sem a foto; o dono pode adicionar depois no painel */ }
      }

      router.push(`/propriedade/${data.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.erros.publicarGenerico)
      setEnviando(false)
    }
  }

  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-5 pt-28 pb-20">
        <div className="mb-8">
          <span className="inline-block text-xs font-bold tracking-wide uppercase text-brand bg-brand-50 px-3 py-1 rounded-full">
            {t.hero.tag}
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-black text-ink mt-3 tracking-tight">
            {t.hero.titulo}
          </h1>
          <p className="text-ink-muted mt-2">
            {t.hero.subtitulo}
          </p>
        </div>

        {authChecked && !userId && (
          <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-ink-soft">
            {t.avisoDeslogadoInicio}{' '}
            <Link href={lhref('/login')} className="text-brand font-semibold underline">{t.avisoDeslogadoEntre}</Link> {t.avisoDeslogadoOu}{' '}
            <Link href={lhref('/cadastro')} className="text-brand font-semibold underline">{t.avisoDeslogadoCriar}</Link>{' '}
            {t.avisoDeslogadoFim}
          </div>
        )}

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Básico */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">{t.secaoSobre.titulo}</h2>
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>{t.secaoSobre.nomeLabel}</label>
              <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t.secaoSobre.nomePlaceholder} />
            </div>
            <div>
              <label className={labelCls}>{t.secaoSobre.categoriaLabel}</label>
              <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">{t.secaoSobre.categoriaPlaceholder}</option>
                {CATS.map((c) => (
                  <option key={c.nome} value={c.nome}>{c.emoji} {rotuloDado(dict.dados.categorias, c.nome)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.secaoSobre.descricaoLabel}</label>
              <textarea className={`${inputCls} min-h-[110px] resize-y`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t.secaoSobre.descricaoPlaceholder} />
            </div>
          </div>
        </section>

        {/* Localização */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">{t.secaoLocalizacao.titulo}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.secaoLocalizacao.estadoLabel}</label>
              <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">{t.secaoLocalizacao.estadoPlaceholder}</option>
                {ESTADOS.map((e) => (
                  <option key={e.s} value={e.s}>{e.n} ({e.s})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.secaoLocalizacao.cidadeLabel}</label>
              <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder={t.secaoLocalizacao.cidadePlaceholder} />
            </div>
            <div>
              <label className={labelCls}>{t.secaoLocalizacao.bairroLabel}</label>
              <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder={t.secaoLocalizacao.bairroPlaceholder} />
            </div>
            <div>
              <label className={labelCls}>{t.secaoLocalizacao.enderecoLabel}</label>
              <input className={inputCls} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder={t.secaoLocalizacao.enderecoPlaceholder} />
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">
            {t.secaoLocalizacao.ajuda}
          </p>
        </section>

        {/* Capacidade & preço */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">{t.secaoCapacidade.titulo}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t.secaoCapacidade.capacidadeLabel}</label>
              <input className={inputCls} type="number" min={0} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder={t.secaoCapacidade.capacidadePlaceholder} />
            </div>
            <div>
              <label className={labelCls}>{t.secaoCapacidade.valorHoraLabel}</label>
              <input className={inputCls} type="number" min={0} value={valorHora} onChange={(e) => setValorHora(e.target.value)} placeholder={t.secaoCapacidade.valorHoraPlaceholder} />
            </div>
            <div>
              <label className={labelCls}>{t.secaoCapacidade.valorDiariaLabel}</label>
              <input className={inputCls} type="number" min={0} value={valorBase} onChange={(e) => setValorBase(e.target.value)} placeholder={t.secaoCapacidade.valorDiariaPlaceholder} />
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">{t.secaoCapacidade.ajuda}</p>
        </section>

        {/* Comodidades */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">{t.secaoComodidades.titulo}</h2>
          <div className="flex flex-wrap gap-2">
            {COMODIDADES.map((c) => {
              const on = comodidades.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleComodidade(c)}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium border transition ${
                    on ? 'bg-brand text-white border-brand' : 'bg-white text-ink-soft border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {t.comodidadesLabels[c as keyof typeof t.comodidadesLabels] ?? c}
                </button>
              )
            })}
          </div>
        </section>

        {/* Contato & mídia */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-ink mb-4">{t.secaoContato.titulo}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.secaoContato.whatsappLabel}</label>
              <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t.secaoContato.whatsappPlaceholder} />
            </div>
            <div>
              <label className={labelCls} htmlFor="anuncio-foto">{t.secaoContato.fotoLabel}</label>
              <input
                id="anuncio-foto"
                type="file"
                accept="image/*"
                onChange={onSelecionarFoto}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:text-white file:px-4 file:py-2 file:font-semibold file:cursor-pointer hover:file:bg-brand-600 cursor-pointer"
              />
              {fotoPreview ? (
                <img src={fotoPreview} alt={t.secaoContato.fotoPreviewAlt} className="mt-3 h-32 w-full max-w-xs object-cover rounded-xl border border-gray-200" />
              ) : (
                <p className="text-xs text-ink-muted mt-2">{t.secaoContato.fotoAjuda}</p>
              )}
            </div>
          </div>
        </section>

        <button
          onClick={publicar}
          disabled={enviando}
          className="w-full sm:w-auto bg-brand hover:bg-brand-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl px-8 py-3.5 transition-colors inline-flex items-center justify-center gap-2"
        >
          {enviando ? t.publicando : t.publicar}
        </button>
      </main>

      <Footer />
    </>
  )
}
