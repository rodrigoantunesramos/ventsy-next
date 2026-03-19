'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADOS, CATS, EVENTOS_CATS } from '@/lib/data'

const CATEGORIAS = [
  { v: 'Casas de Festas', label: '🏠 Casas de Festas' },
  { v: 'Sítios', label: '🌳 Sítios' },
  { v: 'Chácaras', label: '🌿 Chácaras' },
  { v: 'Fazendas', label: '🐄 Fazendas' },
  { v: 'Acampamentos', label: '⛺ Acampamentos' },
  { v: 'Bares e Restaurantes', label: '🍽️ Bares e Rest.' },
  { v: 'Beach Clubs', label: '🏖️ Beach Clubs' },
  { v: 'Centros de Convenções e Galpões', label: '🏭 Galpões' },
  { v: 'Clubes', label: '🏊 Clubes' },
  { v: 'Hotéis, Pousadas e Resorts', label: '🏨 Hotéis' },
  { v: 'Rooftops', label: '🌆 Rooftops' },
  { v: 'Teatros', label: '🎭 Teatros' },
  { v: 'Salão de Festas', label: '🎊 Salão de Festas' },
  { v: 'Mansões', label: '🏰 Mansões' },
  { v: 'Espaço Gourmet', label: '👨‍🍳 Espaço Gourmet' },
  { v: 'Lofts', label: '🏙️ Lofts' },
  { v: 'Espaço Industrial', label: '🔩 Industrial' },
  { v: 'Arena', label: '🏟️ Arena' },
  { v: 'Estádios', label: '⚽ Estádios' },
  { v: 'Auditórios', label: '🎤 Auditórios' },
  { v: 'Coworkings', label: '💻 Coworkings' },
  { v: 'Galeria de Arte', label: '🖼️ Galerias' },
  { v: 'Museus', label: '🏛️ Museus' },
  { v: 'Vinicolas', label: '🍷 Vinícolas' },
  { v: 'Iates', label: '⛵ Iates' },
  { v: 'Lanchas', label: '🚤 Lanchas' },
  { v: 'Escuna', label: '⛴️ Escuna' },
  { v: 'Haras', label: '🐎 Haras' },
]

const TIPOS_EVENTO = [
  { v: 'Casamento', label: '💍 Casamento' },
  { v: 'Festa de Aniversário', label: '🎂 Aniversário' },
  { v: 'Festa Infantil', label: '🎈 Festa Infantil' },
  { v: 'Debutante', label: '👑 Debutante' },
  { v: 'Formatura', label: '🎓 Formatura' },
  { v: 'Colação de Grau', label: '📜 Colação de Grau' },
  { v: 'Confraternização', label: '🎉 Confraternização' },
  { v: 'Workshop', label: '💼 Workshop' },
  { v: 'Seminários', label: '🎙️ Seminários' },
  { v: 'Congresso', label: '🏛️ Congresso' },
  { v: 'Happy Hour', label: '🥂 Happy Hour' },
  { v: 'Show', label: '🎵 Show' },
  { v: 'Festival', label: '🎪 Festival' },
  { v: 'Batizado', label: '🕊️ Batizado' },
  { v: 'Encontro Religioso', label: '🙏 Enc. Religioso' },
  { v: 'Provas Hípicas', label: '🏇 Provas Hípicas' },
  { v: 'Pescaria', label: '🎣 Pescaria' },
  { v: 'Radical', label: '🪂 Radical' },
  { v: 'Retiro', label: '🌿 Retiro' },
  { v: 'Acampamento', label: '⛺ Acampamento' },
  { v: 'Ensaio Fotográfico', label: '📸 Ensaio' },
]

export interface Filtros {
  precoMin: number
  precoMax: number
  capacidade: number
  estado: string
  cidade: string
  climatizado: boolean
  estacionamento: boolean
  seguranca: boolean
  espacoAberto: boolean
  ultra: boolean
  acessibilidade: boolean
  somAlto: boolean
  somTarde: boolean
  tiposEvento: string[]
  categorias: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onApply: (f: Filtros) => void
  initialEstado?: string
  initialEvento?: string
}

export default function FilterModal({ open, onClose, onApply, initialEstado = '', initialEvento = '' }: Props) {
  const [precoMin, setPrecoMin]         = useState(0)
  const [precoMax, setPrecoMax]         = useState(10000)
  const [capacidade, setCapacidade]     = useState(0)
  const [estado, setEstado]             = useState(initialEstado)
  const [cidade, setCidade]             = useState('')
  const [cidades, setCidades]           = useState<string[]>([])
  const [loadCidades, setLoadCidades]   = useState(false)
  const [climatizado, setClimatizado]   = useState(false)
  const [estacionamento, setEstacionamento] = useState(false)
  const [seguranca, setSeguranca]       = useState(false)
  const [espacoAberto, setEspacoAberto] = useState(false)
  const [ultra, setUltra]               = useState(false)
  const [acessibilidade, setAcessibilidade] = useState(false)
  const [somAlto, setSomAlto]           = useState(false)
  const [somTarde, setSomTarde]         = useState(false)
  const [tiposEvento, setTiposEvento]   = useState<Set<string>>(
    new Set(initialEvento ? initialEvento.split(',').map(s => s.trim()).filter(Boolean) : [])
  )
  const [categorias, setCategorias]     = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!estado) { setCidades([]); setCidade(''); return }
    setLoadCidades(true)
    supabase.from('propriedades').select('cidade').eq('estado', estado).eq('publicada', true).not('cidade', 'is', null)
      .then(({ data }) => {
        const uniq = [...new Set((data || []).map((p: any) => p.cidade).filter(Boolean))].sort() as string[]
        setCidades(uniq)
        setLoadCidades(false)
      })
  }, [estado])

  const toggleEvento = (v: string) => {
    const next = new Set(tiposEvento)
    next.has(v) ? next.delete(v) : next.add(v)
    setTiposEvento(next)
  }

  const toggleCategoria = (v: string) => {
    const next = new Set(categorias)
    next.has(v) ? next.delete(v) : next.add(v)
    setCategorias(next)
  }

  const limpar = () => {
    setPrecoMin(0); setPrecoMax(10000); setCapacidade(0)
    setEstado(initialEstado); setCidade('')
    setClimatizado(false); setEstacionamento(false); setSeguranca(false); setEspacoAberto(false)
    setUltra(false); setAcessibilidade(false); setSomAlto(false); setSomTarde(false)
    setTiposEvento(new Set()); setCategorias(new Set())
  }

  const aplicar = () => {
    onApply({
      precoMin, precoMax, capacidade, estado, cidade,
      climatizado, estacionamento, seguranca, espacoAberto,
      ultra, acessibilidade, somAlto, somTarde,
      tiposEvento: [...tiposEvento],
      categorias: [...categorias],
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content">
        <div className="modal-header">
          <button className="fechar-modal" onClick={onClose}>✕</button>
          <h2>Filtros</h2>
        </div>

        <div className="modal-body">
          {/* Localização */}
          <section className="filtro-secao">
            <h3>Localização</h3>
            <select className="filtro-select" value={estado} onChange={e => { setEstado(e.target.value); setCidade('') }}>
              <option value="">Todos os estados</option>
              {ESTADOS.map(e => <option key={e.s} value={e.s}>{e.n}</option>)}
            </select>
            <select className="filtro-select" value={cidade} onChange={e => setCidade(e.target.value)} disabled={!estado || loadCidades}>
              <option value="">{loadCidades ? 'Carregando...' : estado ? 'Todas as cidades' : 'Selecione um estado primeiro'}</option>
              {cidades.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </section>

          {/* Preço */}
          <section className="filtro-secao">
            <h3>Faixa de preço</h3>
            <p>Preço por hora</p>
            <div className="range-container">
              <div className="slider-track" />
              <input type="range" min={0} max={10000} step={100} value={precoMin}
                onChange={e => setPrecoMin(Math.min(Number(e.target.value), precoMax - 100))} />
              <input type="range" min={0} max={10000} step={100} value={precoMax}
                onChange={e => setPrecoMax(Math.max(Number(e.target.value), precoMin + 100))} />
            </div>
            <div className="inputs-preco">
              <div className="caixa-preco">
                <label>Mínimo</label>
                <span>R$ <input type="number" value={precoMin} onChange={e => setPrecoMin(Number(e.target.value))} /></span>
              </div>
              <div className="caixa-preco">
                <label>Máximo</label>
                <span>R$ <input type="number" value={precoMax} onChange={e => setPrecoMax(Number(e.target.value))} /></span>
              </div>
            </div>
          </section>

          {/* Capacidade */}
          <section className="filtro-secao">
            <h3>Capacidade mínima</h3>
            <p>Mostra locais que comportam pelo menos este número de convidados</p>
            <div className="capacidade-container">
              <input type="range" min={0} max={500} step={10} value={capacidade}
                onChange={e => setCapacidade(Number(e.target.value))} />
              <div className="capacidade-display">
                <span>{capacidade === 0 ? 'Qualquer tamanho' : `Mínimo ${capacidade} convidados`}</span>
                <div className="capacidade-input-wrap">
                  <input type="number" value={capacidade} min={0} max={500}
                    onChange={e => setCapacidade(Math.min(500, Math.max(0, Number(e.target.value))))} />
                  <span className="capacidade-unit">convidados</span>
                </div>
              </div>
            </div>
          </section>

          {/* Serviços */}
          <section className="filtro-secao">
            <h3>Serviços oferecidos</h3>
            <div className="grid-checkbox">
              {[
                { id: 'climatizado', label: 'Climatizado', val: climatizado, set: setClimatizado },
                { id: 'estacionamento', label: 'Estacionamento gratuito', val: estacionamento, set: setEstacionamento },
                { id: 'seguranca', label: 'Segurança', val: seguranca, set: setSeguranca },
                { id: 'espacoAberto', label: 'Espaço aberto', val: espacoAberto, set: setEspacoAberto },
              ].map(f => (
                <label key={f.id} className={f.val ? 'checked' : ''}>
                  <input type="checkbox" checked={f.val} onChange={e => f.set(e.target.checked)} /> {f.label}
                </label>
              ))}
            </div>
          </section>

          {/* Tipo de propriedade */}
          <section className="filtro-secao">
            <h3>Tipo de Propriedade</h3>
            <div className="grid-eventos grid-categorias">
              {CATEGORIAS.map(c => (
                <label key={c.v} className={`evento-chip${categorias.has(c.v) ? ' chip-on' : ''}`}>
                  <input type="checkbox" checked={categorias.has(c.v)} onChange={() => toggleCategoria(c.v)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Tipo de evento */}
          <section className="filtro-secao">
            <h3>Tipo de Evento</h3>
            <div className="grid-eventos">
              {TIPOS_EVENTO.map(t => (
                <label key={t.v} className={`evento-chip${tiposEvento.has(t.v) ? ' chip-on' : ''}`}>
                  <input type="checkbox" checked={tiposEvento.has(t.v)} onChange={() => toggleEvento(t.v)} />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Destaques */}
          <section className="filtro-secao">
            <h3>Destaques</h3>
            <div className="grid-checkbox">
              <label className={ultra ? 'checked' : ''}>
                <input type="checkbox" checked={ultra} onChange={e => setUltra(e.target.checked)} /> Propriedades premium
              </label>
            </div>
          </section>

          {/* Som */}
          <section className="filtro-secao">
            <h3>Som</h3>
            <div className="switch-container">
              <span>Permite som alto</span>
              <label className="switch">
                <input type="checkbox" checked={somAlto} onChange={e => setSomAlto(e.target.checked)} />
                <span className="slider-round" />
              </label>
            </div>
            <div className="switch-container" style={{ marginTop: 10 }}>
              <span>Permite som até tarde</span>
              <label className="switch">
                <input type="checkbox" checked={somTarde} onChange={e => setSomTarde(e.target.checked)} />
                <span className="slider-round" />
              </label>
            </div>
          </section>

          {/* Acessibilidade */}
          <section className="filtro-secao">
            <h3>Acessibilidade</h3>
            <div className="switch-container">
              <span>Necessita de acessibilidade?</span>
              <label className="switch">
                <input type="checkbox" checked={acessibilidade} onChange={e => setAcessibilidade(e.target.checked)} />
                <span className="slider-round" />
              </label>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-limpar" onClick={limpar}>Remover todos</button>
          <button className="btn-aplicar" onClick={aplicar}>Mostrar resultados</button>
        </div>
      </div>
    </div>
  )
}
