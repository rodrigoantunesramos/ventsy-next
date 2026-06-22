'use client'

// Meu Perfil — /client/perfil. Dados pessoais editáveis, preferências de
// notificação (toggles premium), aparência (tema) e atalhos de conta/privacidade.
// Backend: /api/client/perfil (GET dados+preferências, POST salva nome/telefone/prefs).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, authHeaders } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { PageHeader, Card, Section, Badge, Skeleton, btnPrimary, btnGhost, inputCls, Icon } from '../_ui'

type Perfil = {
  nome?: string | null; telefone?: string | null; documento?: string | null
  nascimento?: string | null; usuario?: string | null; seucodigo?: string | null; criado_em?: string | null
}
type Prefs = {
  notif_email: boolean; notif_push: boolean; notif_whatsapp: boolean; novidades: boolean; tema: string
}
type PrefKey = 'notif_email' | 'notif_push' | 'notif_whatsapp' | 'novidades'

const PREFS_DEFAULT: Prefs = { notif_email: true, notif_push: true, notif_whatsapp: false, novidades: true, tema: 'auto' }

export default function PerfilPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<Perfil>({})
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAULT)

  // Formulário de dados pessoais (controlado + dirty)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvo, setSalvo] = useState({ nome: '', telefone: '' })
  const [busy, setBusy] = useState(false)

  async function carregar() {
    const r = await fetch('/api/client/perfil', { headers: await authHeaders() }).then((x) => x.json()).catch(() => null)
    if (!r || r.error) { setErro(true); return }
    setEmail(r.email ?? null)
    const p: Perfil = r.perfil || {}
    setPerfil(p)
    setNome(p.nome || '')
    setTelefone(p.telefone || '')
    setSalvo({ nome: p.nome || '', telefone: p.telefone || '' })
    setPrefs({ ...PREFS_DEFAULT, ...(r.preferencias || {}) })
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); setErro(true); return }
      await carregar()
      setLoading(false)
    })()
  }, [])

  const dirty = nome.trim() !== salvo.nome.trim() || telefone.trim() !== salvo.telefone.trim()

  async function salvarDados() {
    if (!nome.trim()) { toast.error('Informe seu nome.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/client/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim() }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      setSalvo({ nome: nome.trim(), telefone: telefone.trim() })
      setPerfil((prev) => ({ ...prev, nome: nome.trim(), telefone: telefone.trim() || null }))
      toast.success('Dados atualizados!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar.') } finally { setBusy(false) }
  }

  // Persiste uma alteração de preferência; reverte o estado local em caso de erro.
  async function salvarPrefs(patch: Partial<Prefs>, anterior: Prefs, msg?: string) {
    try {
      const r = await fetch('/api/client/perfil', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ preferencias: patch }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      if (msg) toast.success(msg)
    } catch (e) {
      setPrefs(anterior)
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar preferência.')
    }
  }

  function toggle(key: PrefKey) {
    const anterior = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    salvarPrefs({ [key]: next[key] }, anterior)
  }

  function mudarTema(tema: string) {
    const anterior = prefs
    setPrefs({ ...prefs, tema })
    salvarPrefs({ tema }, anterior, 'Aparência atualizada.')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Conta" title="Meu perfil" subtitle="Seus dados e preferências." />
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="user" size={26} /></div>
          <div className="text-base font-bold text-ink">Não foi possível carregar seu perfil</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Verifique sua conexão e tente novamente.</p>
          <button onClick={() => { setErro(false); setLoading(true); carregar().finally(() => setLoading(false)) }} className={`${btnPrimary} mt-5`}>Tentar de novo</button>
        </Card>
      </div>
    )
  }

  const inicial = (nome.trim() || email || '?').charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Meu perfil" subtitle="Seus dados e preferências." />

      {/* Cabeçalho do perfil */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-black text-white">{inicial}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-ink">{nome.trim() || 'Sem nome'}</h2>
              {perfil.seucodigo ? <Badge tone="brand">Código: {perfil.seucodigo}</Badge> : null}
            </div>
            {email ? <div className="mt-0.5 truncate text-sm text-ink-muted">{email}</div> : null}
            {perfil.criado_em ? <div className="mt-1 text-[.78rem] text-ink-muted">Membro desde {formatDate(perfil.criado_em)}</div> : null}
          </div>
        </div>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <Section title="Dados pessoais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[.8rem] font-semibold text-ink-soft">Nome completo</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[.8rem] font-semibold text-ink-soft">Telefone</label>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" className={inputCls} />
            </div>
          </div>

          <div className="mt-4 divide-y divide-line rounded-xl border border-line">
            <ReadRow label="E-mail" value={email} />
            {perfil.documento ? <ReadRow label="Documento" value={perfil.documento} /> : null}
            {perfil.nascimento ? <ReadRow label="Nascimento" value={formatDate(perfil.nascimento)} /> : null}
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={salvarDados} disabled={busy || !dirty} className={btnPrimary}>
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </Section>
      </Card>

      {/* Notificações */}
      <Card>
        <Section title="Notificações">
          <p className="mb-3 text-sm text-ink-muted">Escolha como você quer ser avisado sobre seus eventos e novidades.</p>
          <div className="divide-y divide-line">
            <ToggleRow icon="bell" title="Avisos por e-mail" text="Confirmações, lembretes e atualizações." on={prefs.notif_email} onToggle={() => toggle('notif_email')} />
            <ToggleRow icon="bell" title="Notificações no app" text="Alertas em tempo real enquanto você navega." on={prefs.notif_push} onToggle={() => toggle('notif_push')} />
            <ToggleRow icon="bell" title="WhatsApp" text="Mensagens importantes direto no seu WhatsApp." on={prefs.notif_whatsapp} onToggle={() => toggle('notif_whatsapp')} />
            <ToggleRow icon="sparkle" title="Novidades e dicas Ventsy" text="Ofertas, recursos novos e inspiração para eventos." on={prefs.novidades} onToggle={() => toggle('novidades')} />
          </div>
        </Section>
      </Card>

      {/* Aparência */}
      <Card>
        <Section title="Aparência">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[.9rem] font-semibold text-ink">Tema</div>
              <div className="text-[.78rem] text-ink-muted">Você também pode alternar pelo topo da página.</div>
            </div>
            <select value={prefs.tema} onChange={(e) => mudarTema(e.target.value)} className={`${inputCls} sm:w-44`}>
              <option value="auto">Automático</option>
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
            </select>
          </div>
        </Section>
      </Card>

      {/* Conta e privacidade */}
      <Card>
        <Section title="Conta e privacidade">
          <p className="mb-4 text-sm text-ink-muted">Gerencie seus dados pessoais e o que você compartilha com a Ventsy.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/client/privacidade" className={btnGhost}><Icon name="shield" size={16} /> Privacidade e meus dados</Link>
            <Link href="/client/carteira" className={btnGhost}><Icon name="wallet" size={16} /> Minha carteira</Link>
          </div>
        </Section>
      </Card>
    </div>
  )
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[.8rem] font-medium text-ink-muted">{label}</span>
      <span className="truncate text-[.85rem] font-semibold text-ink">{value || '—'}</span>
    </div>
  )
}

function ToggleRow({ icon, title, text, on, onToggle }: { icon: 'bell' | 'sparkle'; title: string; text: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-brand-50 text-brand' : 'bg-black/[0.05] text-ink-muted'}`}><Icon name={icon} size={16} /></span>
        <div className="min-w-0">
          <div className="text-[.88rem] font-semibold text-ink">{title}</div>
          <div className="text-[.72rem] text-ink-muted">{text}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-brand' : 'bg-black/[0.12]'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
