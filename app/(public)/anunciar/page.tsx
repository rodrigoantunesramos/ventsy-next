'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CATS, ESTADOS } from '@/lib/data'

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
  const [imagemUrl, setImagemUrl] = useState('')
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

  function validar(): string | null {
    if (nome.trim().length < 3) return 'Informe o nome do espaço (mín. 3 caracteres).'
    if (!categoria) return 'Escolha a categoria do espaço.'
    if (!estado) return 'Selecione o estado.'
    if (cidade.trim().length < 2) return 'Informe a cidade.'
    if (!valorHora && !valorBase) return 'Informe ao menos um preço (por hora ou diária).'
    return null
  }

  async function publicar() {
    if (enviando) return
    setErro('')

    const msg = validar()
    if (msg) { setErro(msg); return }

    if (!userId) {
      setErro('Você precisa estar logado para publicar. Entre ou crie sua conta.')
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
        imagem_url: imagemUrl.trim() || null,
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
        setErro(`Não foi possível publicar: ${error.message}`)
        setEnviando(false)
        return
      }

      router.push(`/propriedade/${data.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Ocorreu um erro ao publicar. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <>
      <Header />

      <main className="max-w-3xl mx-auto px-5 pt-28 pb-20">
        <div className="mb-8">
          <span className="inline-block text-xs font-bold tracking-wide uppercase text-brand bg-brand-50 px-3 py-1 rounded-full">
            Anuncie grátis
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-black text-ink mt-3 tracking-tight">
            Anuncie seu espaço
          </h1>
          <p className="text-ink-muted mt-2">
            Preencha as informações do seu espaço. Ele aparecerá na busca assim que publicado.
          </p>
        </div>

        {authChecked && !userId && (
          <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-ink-soft">
            Você está navegando deslogado.{' '}
            <Link href="/login" className="text-brand font-semibold underline">Entre</Link> ou{' '}
            <Link href="/cadastro" className="text-brand font-semibold underline">crie sua conta</Link>{' '}
            para publicar o anúncio.
          </div>
        )}

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Básico */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Sobre o espaço</h2>
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Nome do espaço *</label>
              <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Chácara Recanto Verde" />
            </div>
            <div>
              <label className={labelCls}>Categoria *</label>
              <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione a categoria</option>
                {CATS.map((c) => (
                  <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea className={`${inputCls} min-h-[110px] resize-y`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Conte o que torna o seu espaço especial..." />
            </div>
          </div>
        </section>

        {/* Localização */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Localização</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Estado *</label>
              <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((e) => (
                  <option key={e.s} value={e.s}>{e.n} ({e.s})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cidade *</label>
              <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
            </div>
            <div>
              <label className={labelCls}>Bairro</label>
              <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div>
              <label className={labelCls}>Endereço</label>
              <input className={inputCls} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número" />
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">
            Usamos cidade e estado para posicionar seu espaço no mapa da busca.
          </p>
        </section>

        {/* Capacidade & preço */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Capacidade e preço</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Capacidade (pessoas)</label>
              <input className={inputCls} type="number" min={0} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder="Ex: 150" />
            </div>
            <div>
              <label className={labelCls}>Valor por hora (R$)</label>
              <input className={inputCls} type="number" min={0} value={valorHora} onChange={(e) => setValorHora(e.target.value)} placeholder="Ex: 500" />
            </div>
            <div>
              <label className={labelCls}>Valor da diária (R$)</label>
              <input className={inputCls} type="number" min={0} value={valorBase} onChange={(e) => setValorBase(e.target.value)} placeholder="Ex: 3000" />
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">Informe ao menos um dos valores.</p>
        </section>

        {/* Comodidades */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-5">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Comodidades</h2>
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
                  {c}
                </button>
              )
            })}
          </div>
        </section>

        {/* Contato & mídia */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-card p-5 md:p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Contato e mídia</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 99999-9999" />
            </div>
            <div>
              <label className={labelCls}>URL da foto de capa</label>
              <input className={inputCls} value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </section>

        <button
          onClick={publicar}
          disabled={enviando}
          className="w-full sm:w-auto bg-brand hover:bg-brand-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl px-8 py-3.5 transition-colors inline-flex items-center justify-center gap-2"
        >
          {enviando ? 'Publicando...' : 'Publicar espaço'}
        </button>
      </main>

      <Footer />
    </>
  )
}
