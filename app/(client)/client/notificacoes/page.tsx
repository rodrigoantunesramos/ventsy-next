'use client'

// Central de Notificações — /client/notificacoes. Lê `notificacoes` do usuário
// via RLS (mesmo schema do NotificationBell), filtra lidas/não lidas, marca lida
// ao clicar (e navega pelo link) e oferece "marcar todas como lidas".

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/components/Toast'
import { PageHeader, Card, Tabs, EmptyState, Skeleton, btnGhost, Icon, type IconName } from '../_ui'

type Notif = { id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; urgencia: string; lida: boolean; criado_em: string }

const SEL = 'id,tipo,titulo,corpo,link,urgencia,lida,criado_em'

// Ícone + tom por tipo/urgência da notificação.
function visual(n: Notif): { icon: IconName; cls: string } {
  const t = (n.tipo || '').toLowerCase()
  if (/parcela|pagamento|financ|fatura/.test(t)) return { icon: 'card', cls: 'bg-amber-50 text-amber-600' }
  if (/mensagem|conversa|chat/.test(t)) return { icon: 'chat', cls: 'bg-sky-50 text-sky-600' }
  if (/avalia|review|feedback/.test(t)) return { icon: 'star', cls: 'bg-amber-50 text-amber-600' }
  if (/indica|recompensa|credito|cupom/.test(t)) return { icon: 'gift', cls: 'bg-violet-50 text-violet-600' }
  if (/evento|reserva|contrato/.test(t)) return { icon: 'ticket', cls: 'bg-brand-50 text-brand' }
  if (n.urgencia === 'critico' || n.urgencia === 'alerta') return { icon: 'bell', cls: 'bg-red-50 text-red-600' }
  return { icon: 'bell', cls: 'bg-brand-50 text-brand' }
}

export default function NotificacoesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [aba, setAba] = useState<'todas' | 'nao_lidas'>('todas')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const id = session.user.id
      setUid(id)
      const { data } = await supabase.from('notificacoes').select(SEL).eq('usuario_id', id).order('criado_em', { ascending: false }).limit(100)
      setNotifs((data || []) as Notif[])
      setLoading(false)
    })()
  }, [])

  const naoLidas = notifs.filter((n) => !n.lida).length
  const visiveis = aba === 'nao_lidas' ? notifs.filter((n) => !n.lida) : notifs

  async function abrir(n: Notif) {
    if (!n.lida) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)))
      await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
    }
    if (n.link) {
      if (n.link.startsWith('http')) window.open(n.link, '_blank')
      else router.push(n.link)
    }
  }

  async function marcarTodas() {
    if (!uid || !naoLidas) return
    setNotifs((prev) => prev.map((x) => ({ ...x, lida: true })))
    await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', uid).eq('lida', false)
    toast.success('Todas marcadas como lidas.')
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-56" /><Skeleton className="h-72" /></div>

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Notificações" subtitle="Tudo o que aconteceu na sua conta, em um só lugar."
        actions={naoLidas > 0 ? <button onClick={marcarTodas} className={btnGhost}><Icon name="bell" size={16} /> Marcar todas como lidas</button> : undefined} />

      <Tabs tabs={[{ key: 'todas', label: 'Todas', count: notifs.length }, { key: 'nao_lidas', label: 'Não lidas', count: naoLidas }]} active={aba} onChange={setAba} />

      {visiveis.length === 0 ? (
        <EmptyState icon="bell" title={aba === 'nao_lidas' ? 'Nada por ler' : 'Tudo limpo por aqui'} text="Seus avisos, lembretes de eventos e novidades aparecem aqui." />
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-line">
            {visiveis.map((n) => {
              const v = visual(n)
              return (
                <button key={n.id} onClick={() => abrir(n)} className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.02] ${n.lida ? '' : 'bg-brand-50/40'}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${v.cls}`}><Icon name={v.icon} size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`truncate text-[.9rem] ${n.lida ? 'font-semibold text-ink' : 'font-bold text-ink'}`}>{n.titulo}</div>
                      {!n.lida && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    </div>
                    {n.corpo && <div className="mt-0.5 line-clamp-2 text-[.8rem] text-ink-soft">{n.corpo}</div>}
                    <div className="mt-1 text-[.7rem] text-ink-muted">{formatDateTime(n.criado_em)}</div>
                  </div>
                  {n.link && <span className="mt-1 shrink-0 text-ink-muted">→</span>}
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
