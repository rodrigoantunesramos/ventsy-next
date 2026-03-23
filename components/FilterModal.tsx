'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ESTADOS } from '@/lib/data'

const CATEGORIAS = [
  { v: 'Casas de Festas',                  label: '🏠 Casas de Festas' },
  { v: 'Sítios',                           label: '🌳 Sítios' },
  { v: 'Chácaras',                         label: '🌿 Chácaras' },
  { v: 'Fazendas',                         label: '🐄 Fazendas' },
  { v: 'Acampamentos',                     label: '⛺ Acampamentos' },
  { v: 'Bares e Restaurantes',             label: '🍽️ Bares e Rest.' },
  { v: 'Beach Clubs',                      label: '🏖️ Beach Clubs' },
  { v: 'Centros de Convenções e Galpões',  label: '🏭 Galpões' },
  { v: 'Clubes',                           label: '🏊 Clubes' },
  { v: 'Hotéis, Pousadas e Resorts',       label: '🏨 Hotéis' },
  { v: 'Rooftops',                         label: '🌆 Rooftops' },
  { v: 'Teatros',                          label: '🎭 Teatros' },
  { v: 'Salão de Festas',                  label: '🎊 Salão de Festas' },
  { v: 'Mansões',                          label: '🏰 Mansões' },
  { v: 'Espaço Gourmet',                   label: '👨‍🍳 Espaço Gourmet' },
  { v: 'Lofts',                            label: '🏙️ Lofts' },
  { v: 'Espaço Industrial',                label: '🔩 Industrial' },
  { v: 'Arena',                            label: '🏟️ Arena' },
  { v: 'Estádios',                         label: '⚽ Estádios' },
  { v: 'Auditórios',                       label: '🎤 Auditórios' },
  { v: 'Coworkings',                       label: '💻 Coworkings' },
  { v: 'Galeria de Arte',                  label: '🖼️ Galerias' },
  { v: 'Museus',                           label: '🏛️ Museus' },
  { v: 'Vinicolas',                        label: '🍷 Vinícolas' },
  { v: 'Iates',                            label: '⛵ Iates' },
  { v: 'Lanchas',                          label: '🚤 Lanchas' },
  { v: 'Escuna',                           label: '⛴️ Escuna' },
  { v: 'Haras',                            label: '🐎 Haras' },
]

const TIPOS_EVENTO = [
  { v: 'Casamento',           label: '💍 Casamento' },
  { v: 'Festa de Aniversário', label: '🎂 Aniversário' },
  { v: 'Festa Infantil',      label: '🎈 Festa Infantil' },
  { v: 'Debutante',           label: '👑 Debutante' },
  { v: 'Formatura',           label: '🎓 Formatura' },
  { v: 'Colação de Grau',     label: '📜 Colação de Grau' },
  { v: 'Confraternização',    label: '🎉 Confraternização' },
  { v: 'Workshop',            label: '💼 Workshop' },
  { v: 'Seminários',          label: '🎙️ Seminários' },
  { v: 'Congresso',           label: '🏛️ Congresso' },
  { v: 'Happy Hour',          label: '🥂 Happy Hour' },
  { v: 'Show',                label: '🎵 Show' },
  { v: 'Festival',            label: '🎪 Festival' },
  { v: 'Batizado',            label: '🕊️ Batizado' },
  { v: 'Encontro Religioso',  label: '🙏 Enc. Religioso' },
  { v: 'Provas Hípicas',      label: '🏇 Provas Hípicas' },
  { v: 'Pescaria',            label: '🎣 Pescaria' },
  { v: 'Radical',             label: '🪂 Radical' },
  { v: 'Retiro',              label: '🌿 Retiro' },
  { v: 'Acampamento',         label: '⛺ Acampamento' },
  { v: 'Ensaio Fotográfico',  label: '📸 Ensaio' },
]

export interface Filtros {
  precoMin:       number
  precoMax:       number
  capacidade:     number
  estado:         string
  cidade:         string
  climatizado:    boolean
  estacionamento: boolean
  seguranca:      boolean
  espacoAberto:   boolean
  ultra:          boolean
  acessibilidade: boolean
  somAlto:        boolean
  somTarde:       boolean
  tiposEvento:    string[]
  categorias:     string[]
}

interface Props {
  open:           boolean
  onClose:        () => void
  onApply:        (f: Filtros) => void
  initialEstado?: string
  initialEvento?: string
}

// Componente de seção interna do modal
function FiltroSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-gray-100 pb-5 last:border-0">
      <h3 className="font-bold text-sm text-gray-800 mb-3">{titulo}</h3>
      {children}
    </section>
  )
}

// Toggle switch
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors border-none cursor-pointer flex-shrink-0
          ${checked ? 'bg-[#ff385c]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

// Chip de seleção (evento / categoria)
function Chip({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <label
      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full cursor-pointer transition-all select-none
        ${checked ? 'bg-[#ff385c] text-white font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      onClick={onClick}
    >
      <input type="checkbox" checked={checked} onChange={() => {}} className="sr-only" />
      {label}
    </label>
  )
}

export default function FilterModal({ open, onClose, onApply, initialEstado = '', initialEvento = '' }: Props) {
  const [precoMin,       setPrecoMin]       = useState(0)
  const [precoMax,       setPrecoMax]       = useState(10000)
  const [capacidade,     setCapacidade]     = useState(0)
  const [estado,         setEstado]         = useState(initialEstado)
  const [cidade,         setCidade]         = useState('')
  const [cidades,        setCidades]        = useState<string[]>([])
  const [loadCidades,    setLoadCidades]    = useState(false)
  const [climatizado,    setClimatizado]    = useState(false)
  const [estacionamento, setEstacionamento] = useState(false)
  const [seguranca,      setSeguranca]      = useState(false)
  const [espacoAberto,   setEspacoAberto]   = useState(false)
  const [ultra,          setUltra]          = useState(false)
  const [acessibilidade, setAcessibilidade] = useState(false)
  const [somAlto,        setSomAlto]        = useState(false)
  const [somTarde,       setSomTarde]       = useState(false)
  const [tiposEvento,    setTiposEvento]    = useState<Set<string>>(
    new Set(initialEvento ? initialEvento.split(',').map(s => s.trim()).filter(Boolean) : [])
  )
  const [categorias, setCategorias] = useState<Set<string>>(new Set())

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

  const toggleEvento    = (v: string) => { const s = new Set(tiposEvento); s.has(v) ? s.delete(v) : s.add(v); setTiposEvento(s) }
  const toggleCategoria = (v: string) => { const s = new Set(categorias);  s.has(v) ? s.delete(v) : s.add(v); setCategorias(s)  }

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
      categorias:  [...categorias],
    })
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[9999]"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full md:w-[540px] max-h-[92vh] rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <button
            className="text-gray-400 hover:text-gray-700 text-lg transition-colors bg-transparent border-none cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
          <h2 className="font-bold text-base text-gray-800">Filtros</h2>
          <div className="w-6" />
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Localização */}
          <FiltroSecao titulo="Localização">
            <div className="space-y-2">
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white outline-none focus:border-[#ff385c] transition-colors"
                value={estado}
                onChange={e => { setEstado(e.target.value); setCidade('') }}
              >
                <option value="">Todos os estados</option>
                {ESTADOS.map(e => <option key={e.s} value={e.s}>{e.n}</option>)}
              </select>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white outline-none focus:border-[#ff385c] transition-colors disabled:opacity-50"
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                disabled={!estado || loadCidades}
              >
                <option value="">
                  {loadCidades ? 'Carregando...' : estado ? 'Todas as cidades' : 'Selecione um estado primeiro'}
                </option>
                {cidades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </FiltroSecao>

          {/* Faixa de preço */}
          <FiltroSecao titulo="Faixa de preço — por hora">
            <div className="space-y-3">
              <div className="relative h-1 bg-gray-200 rounded-full mx-1">
                <div
                  className="absolute h-1 bg-[#ff385c] rounded-full"
                  style={{ left: `${(precoMin / 10000) * 100}%`, right: `${100 - (precoMax / 10000) * 100}%` }}
                />
                <input type="range" min={0} max={10000} step={100} value={precoMin}
                  onChange={e => setPrecoMin(Math.min(Number(e.target.value), precoMax - 100))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-1" />
                <input type="range" min={0} max={10000} step={100} value={precoMax}
                  onChange={e => setPrecoMax(Math.max(Number(e.target.value), precoMin + 100))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-1" />
              </div>
              <div className="flex gap-3">
                {[
                  { label: 'Mínimo', value: precoMin, set: setPrecoMin },
                  { label: 'Máximo', value: precoMax, set: setPrecoMax },
                ].map(f => (
                  <div key={f.label} className="flex-1 border border-gray-200 rounded-xl px-3 py-2">
                    <label className="text-[10px] text-gray-400 block">{f.label}</label>
                    <span className="text-sm text-gray-700">
                      R$ <input
                        type="number"
                        value={f.value}
                        onChange={e => f.set(Number(e.target.value))}
                        className="w-16 border-none outline-none text-sm bg-transparent font-medium"
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FiltroSecao>

          {/* Capacidade */}
          <FiltroSecao titulo="Capacidade mínima">
            <p className="text-xs text-gray-400 mb-3">
              {capacidade === 0 ? 'Qualquer tamanho' : `Mínimo ${capacidade} convidados`}
            </p>
            <input
              type="range" min={0} max={500} step={10} value={capacidade}
              onChange={e => setCapacidade(Number(e.target.value))}
              className="w-full accent-[#ff385c]"
            />
          </FiltroSecao>

          {/* Serviços */}
          <FiltroSecao titulo="Serviços oferecidos">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '❄️ Climatizado',            val: climatizado,    set: setClimatizado    },
                { label: '🅿️ Estacionamento gratuito', val: estacionamento, set: setEstacionamento },
                { label: '🛡️ Segurança',               val: seguranca,      set: setSeguranca      },
                { label: '🌳 Espaço aberto',           val: espacoAberto,   set: setEspacoAberto   },
              ].map(f => (
                <label
                  key={f.label}
                  className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none
                    ${f.val ? 'bg-[#fff0f3] text-[#ff385c] font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  <input type="checkbox" checked={f.val} onChange={e => f.set(e.target.checked)} className="sr-only" />
                  {f.label}
                </label>
              ))}
            </div>
          </FiltroSecao>

          {/* Tipo de propriedade */}
          <FiltroSecao titulo="Tipo de Propriedade">
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(c => (
                <Chip
                  key={c.v}
                  label={c.label}
                  checked={categorias.has(c.v)}
                  onClick={() => toggleCategoria(c.v)}
                />
              ))}
            </div>
          </FiltroSecao>

          {/* Tipo de evento */}
          <FiltroSecao titulo="Tipo de Evento">
            <div className="flex flex-wrap gap-2">
              {TIPOS_EVENTO.map(t => (
                <Chip
                  key={t.v}
                  label={t.label}
                  checked={tiposEvento.has(t.v)}
                  onClick={() => toggleEvento(t.v)}
                />
              ))}
            </div>
          </FiltroSecao>

          {/* Destaques */}
          <FiltroSecao titulo="Destaques">
            <label
              className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none
                ${ultra ? 'bg-[#fff0f3] text-[#ff385c] font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              <input type="checkbox" checked={ultra} onChange={e => setUltra(e.target.checked)} className="sr-only" />
              ✦ Apenas propriedades premium
            </label>
          </FiltroSecao>

          {/* Som */}
          <FiltroSecao titulo="Som">
            <div className="space-y-3">
              <Toggle checked={somAlto}  onChange={setSomAlto}  label="Permite som alto"     />
              <Toggle checked={somTarde} onChange={setSomTarde} label="Permite som até tarde" />
            </div>
          </FiltroSecao>

          {/* Acessibilidade */}
          <FiltroSecao titulo="Acessibilidade">
            <Toggle checked={acessibilidade} onChange={setAcessibilidade} label="Necessita de acessibilidade?" />
          </FiltroSecao>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors underline bg-transparent border-none cursor-pointer font-[inherit]"
            onClick={limpar}
          >
            Remover todos
          </button>
          <button
            className="bg-[#ff385c] hover:bg-[#e0304f] text-white font-bold py-3 px-8 rounded-xl text-sm transition-colors border-none cursor-pointer font-[inherit]"
            onClick={aplicar}
          >
            Mostrar resultados
          </button>
        </div>
      </div>
    </div>
  )
}
