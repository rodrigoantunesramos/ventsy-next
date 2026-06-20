'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase, authHeaders } from '@/lib/supabase'
import { CATS, ESTADOS } from '@/lib/data'
import { formatMoney } from '@/lib/format'

const COMODIDADES = [
  'Wi-Fi', 'Estacionamento', 'Churrasqueira', 'Piscina', 'Ar-condicionado',
  'Som ambiente', 'Cozinha equipada', 'Acessibilidade', 'Segurança', 'Área verde',
  'Banheiros', 'Gerador',
]

const inputCls =
  'w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition'
const labelCls = 'block text-sm font-semibold text-ink-soft mb-1.5'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Espaco = Record<string, any>

function parseComod(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    const s = v.trim()
    if (s.startsWith('{')) return s.slice(1, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean)
    try { const j = JSON.parse(s); return Array.isArray(j) ? j : [] } catch { return [] }
  }
  return []
}

function EditarModal({ espaco, onClose, onSaved }: { espaco: Espaco; onClose: () => void; onSaved: (e: Espaco) => void }) {
  const [nome, setNome] = useState(espaco.nome || '')
  const [categoria, setCategoria] = useState(espaco.categoria || espaco.tipo_propriedade || '')
  const [descricao, setDescricao] = useState(espaco.descricao || '')
  const [estado, setEstado] = useState(espaco.estado || '')
  const [cidade, setCidade] = useState(espaco.cidade || '')
  const [capacidade, setCapacidade] = useState(espaco.capacidade ? String(espaco.capacidade) : '')
  const [valorHora, setValorHora] = useState(espaco.valor_hora ? String(espaco.valor_hora) : '')
  const [valorBase, setValorBase] = useState(espaco.valor_base ? String(espaco.valor_base) : '')
  const [whatsapp, setWhatsapp] = useState(espaco.whatsapp || '')
  const [imagemUrl, setImagemUrl] = useState(espaco.imagem_url || '')
  const [comods, setComods] = useState<string[]>(parseComod(espaco.comodidades))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const toggleComod = (c: string) => setComods((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))

  async function salvar() {
    if (nome.trim().length < 3) { setErro('Informe o nome do espaço.'); return }
    setErro('')
    setSalvando(true)
    const payload = {
      nome: nome.trim(),
      categoria,
      tipo_propriedade: categoria,
      descricao: descricao.trim() || null,
      estado,
      cidade: cidade.trim() || null,
      capacidade: capacidade ? Number(capacidade) : null,
      valor_hora: valorHora ? Number(valorHora) : null,
      valor_base: valorBase ? Number(valorBase) : null,
      whatsapp: whatsapp.replace(/\D/g, '') || null,
      imagem_url: imagemUrl.trim() || null,
      comodidades: comods.length ? `{${comods.join(',')}}` : null,
    }
    const { error } = await supabase.from('propriedades').update(payload).eq('id', espaco.id)
    if (error) { setErro(error.message); setSalvando(false); return }
    onSaved({ ...espaco, ...payload })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 p-6 relative shadow-pop">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-muted">✕</button>
        <h3 className="font-display text-xl font-bold text-ink mb-5">Editar espaço</h3>

        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

        <div className="grid gap-4">
          <div>
            <label className={labelCls}>Nome do espaço</label>
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoria</label>
              <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione</option>
                {CATS.map((c) => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Capacidade (pessoas)</label>
              <input className={inputCls} type="number" min={0} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea className={`${inputCls} min-h-[100px] resize-y`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((e) => <option key={e.s} value={e.s}>{e.n} ({e.s})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cidade</label>
              <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Valor/hora (R$)</label>
              <input className={inputCls} type="number" min={0} value={valorHora} onChange={(e) => setValorHora(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Diária (R$)</label>
              <input className={inputCls} type="number" min={0} value={valorBase} onChange={(e) => setValorBase(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>URL da foto de capa</label>
            <input className={inputCls} value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>Comodidades</label>
            <div className="flex flex-wrap gap-2">
              {COMODIDADES.map((c) => {
                const on = comods.includes(c)
                return (
                  <button key={c} type="button" onClick={() => toggleComod(c)} className={`rounded-full px-3 py-1.5 text-sm font-medium border transition ${on ? 'bg-brand text-white border-brand' : 'bg-white text-ink-soft border-gray-300 hover:border-gray-400'}`}>{c}</button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={salvar} disabled={salvando} className="bg-brand hover:bg-brand-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl px-6 py-3 transition-colors">{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
          <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink font-medium">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Comprime/reduz a imagem no browser (≤1600px, JPEG 0.82) antes do upload —
// fotos de celular saem de vários MB para ~100–400 KB.
function comprimirImagem(file: File, maxPx = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return Promise.resolve(file)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxPx || height > maxPx) {
          const r = Math.min(maxPx / width, maxPx / height)
          width = Math.round(width * r); height = Math.round(height * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality)
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

function FotosModal({ espaco, onClose, onCover }: { espaco: Espaco; onClose: () => void; onCover: (url: string | null) => void }) {
  const [fotos, setFotos] = useState<Espaco[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (): Promise<Espaco[]> => {
    const { data } = await supabase.from('fotos_imovel').select('*').eq('propriedade_id', espaco.id).order('ordem', { ascending: true })
    const list = (data || []) as Espaco[]
    setFotos(list); setLoading(false)
    return list
  }
  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [])

  async function enviar(files: FileList | null) {
    if (!files || files.length === 0) return
    setErro(''); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('propriedadeId', String(espaco.id))
      for (const f of Array.from(files)) {
        const blob = await comprimirImagem(f)
        fd.append('files', blob, (f.name.replace(/\.[^.]+$/, '') || 'foto') + '.jpg')
      }
      const res = await fetch('/api/fotos', { method: 'POST', headers: { ...(await authHeaders()) }, body: fd })
      const json = await res.json().catch(() => ({}))
      if (json.error) setErro(json.error)
      const list = await load()
      onCover(list[0]?.url ?? null)
    } catch {
      setErro('Falha ao enviar as fotos.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function reordenar(novaOrdem: string[]) {
    setFotos((prev) => novaOrdem.map((id) => prev.find((f) => String(f.id) === id)).filter(Boolean) as Espaco[])
    const res = await fetch('/api/fotos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ propriedadeId: espaco.id, ordem: novaOrdem }),
    })
    const json = await res.json().catch(() => ({}))
    if (json.capa !== undefined) onCover(json.capa)
  }

  const definirCapa = (id: string) => {
    const ids = fotos.map((f) => String(f.id))
    reordenar([id, ...ids.filter((x) => x !== id)])
  }
  const mover = (idx: number, dir: -1 | 1) => {
    const ids = fotos.map((f) => String(f.id))
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    const tmp = ids[idx]; ids[idx] = ids[j]; ids[j] = tmp
    reordenar(ids)
  }
  async function remover(id: string) {
    if (!confirm('Remover esta foto?')) return
    setFotos((prev) => prev.filter((f) => String(f.id) !== id))
    const res = await fetch(`/api/fotos/${id}`, { method: 'DELETE', headers: { ...(await authHeaders()) } })
    const json = await res.json().catch(() => ({}))
    if (json.capa !== undefined) onCover(json.capa)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 p-6 relative shadow-pop">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-ink-muted">✕</button>
        <h3 className="font-display text-xl font-bold text-ink mb-1">Fotos do espaço</h3>
        <p className="text-sm text-ink-muted mb-5">{espaco.nome || `Espaço #${espaco.id}`} · a 1ª foto é a capa do anúncio.</p>

        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

        {/* Dropzone / botão de upload */}
        <label className={`block rounded-2xl border-2 border-dashed ${uploading ? 'border-gray-200 bg-gray-50' : 'border-brand/40 bg-brand/5 hover:bg-brand/10 cursor-pointer'} px-4 py-7 text-center transition mb-6`}>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => enviar(e.target.files)} />
          <span className="text-3xl block mb-1">{uploading ? '⏳' : '📷'}</span>
          <span className="text-sm font-semibold text-ink-soft block">{uploading ? 'Enviando...' : 'Clique para adicionar fotos'}</span>
          <span className="text-xs text-ink-muted">JPG ou PNG · várias de uma vez · otimizadas automaticamente</span>
        </label>

        {loading ? (
          <p className="text-ink-muted py-8 text-center">Carregando fotos...</p>
        ) : fotos.length === 0 ? (
          <p className="text-ink-muted py-8 text-center">Nenhuma foto ainda. Adicione a primeira acima.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {fotos.map((f, i) => (
              <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="w-full h-32 object-cover" />
                {i === 0 && <span className="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">Capa</span>}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition">
                  <div className="flex gap-1">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} title="Mover para a esquerda" className="w-7 h-7 rounded-full bg-white/90 text-ink text-sm disabled:opacity-30 hover:bg-white">◀</button>
                    <button onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} title="Mover para a direita" className="w-7 h-7 rounded-full bg-white/90 text-ink text-sm disabled:opacity-30 hover:bg-white">▶</button>
                  </div>
                  <div className="flex gap-1">
                    {i !== 0 && <button onClick={() => definirCapa(String(f.id))} title="Definir como capa" className="w-7 h-7 rounded-full bg-white/90 text-sm hover:bg-white">⭐</button>}
                    <button onClick={() => remover(String(f.id))} title="Remover" className="w-7 h-7 rounded-full bg-white/90 text-red-600 text-sm hover:bg-white">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="bg-ink hover:bg-ink-soft text-white font-bold text-sm rounded-xl px-6 py-3 transition-colors">Concluir</button>
        </div>
      </div>
    </div>
  )
}

export default function MeusEspacosPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [espacos, setEspacos] = useState<Espaco[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Espaco | null>(null)
  const [fotosDe, setFotosDe] = useState<Espaco | null>(null)

  const load = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase.from('propriedades').select('*').eq('usuario_id', uid).order('id', { ascending: false })
    setEspacos((data || []) as Espaco[])
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthChecked(true)
      if (session) { setUserId(session.user.id); load(session.user.id) }
      else setLoading(false)
    })
  }, [])

  const togglePublicar = async (esp: Espaco) => {
    const novo = !esp.publicada
    setEspacos((prev) => prev.map((e) => (e.id === esp.id ? { ...e, publicada: novo } : e)))
    await supabase.from('propriedades').update({ publicada: novo }).eq('id', esp.id)
  }

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight">Meus espaços</h1>
          <Link href="/anunciar" className="bg-brand hover:bg-brand-600 text-white font-bold text-sm rounded-xl px-5 py-2.5 transition-colors">+ Novo espaço</Link>
        </div>

        {!authChecked || loading ? (
          <p className="text-ink-muted py-10 text-center">Carregando...</p>
        ) : !userId ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Entre na sua conta para gerenciar seus espaços.</p>
            <Link href="/login" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Entrar</Link>
          </div>
        ) : espacos.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-8 text-center">
            <p className="text-ink-soft mb-4">Você ainda não tem nenhum espaço cadastrado.</p>
            <Link href="/anunciar" className="inline-block bg-brand hover:bg-brand-600 text-white font-bold rounded-xl px-6 py-3 transition-colors">Anunciar meu espaço</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {espacos.map((e) => (
              <div key={e.id} className="rounded-2xl border border-gray-200 bg-white shadow-card overflow-hidden flex flex-col">
                <div className="h-40 bg-gray-100 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.imagem_url || `https://picsum.photos/seed/esp${e.id}/600/400`} alt={e.nome || ''} className="w-full h-full object-cover" />
                  <span className={`absolute top-2 left-2 text-xs font-bold px-2.5 py-1 rounded-full ${e.publicada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {e.publicada ? 'Publicado' : 'Não publicado'}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-1 flex-1">
                  <h3 className="font-display text-lg font-bold text-ink">{e.nome || `Espaço #${e.id}`}</h3>
                  <p className="text-sm text-ink-muted">{[e.cidade, e.estado].filter(Boolean).join(', ')}</p>
                  <p className="text-sm text-ink-soft mt-1">
                    {e.valor_hora > 0 ? `${formatMoney(e.valor_hora)}/h` : e.valor_base > 0 ? formatMoney(e.valor_base) : 'Sob consulta'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => setEditando(e)} className="bg-ink hover:bg-ink-soft text-white text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors">Editar</button>
                    <button onClick={() => setFotosDe(e)} className="bg-white border border-gray-300 hover:border-gray-400 text-ink-soft text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors">📷 Fotos</button>
                    <button onClick={() => togglePublicar(e)} className="bg-white border border-gray-300 hover:border-gray-400 text-ink-soft text-sm font-semibold rounded-lg px-3.5 py-2 transition-colors">
                      {e.publicada ? 'Despublicar' : 'Publicar'}
                    </button>
                    <Link href={`/propriedade/${e.id}`} className="text-sm text-brand font-semibold px-2 py-2 self-center">Ver</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <EditarModal
          espaco={editando}
          onClose={() => setEditando(null)}
          onSaved={(atualizado) => {
            setEspacos((prev) => prev.map((e) => (e.id === atualizado.id ? atualizado : e)))
            setEditando(null)
          }}
        />
      )}

      {fotosDe && (
        <FotosModal
          espaco={fotosDe}
          onClose={() => setFotosDe(null)}
          onCover={(url) => setEspacos((prev) => prev.map((e) => (e.id === fotosDe.id ? { ...e, imagem_url: url } : e)))}
        />
      )}
    </>
  )
}
