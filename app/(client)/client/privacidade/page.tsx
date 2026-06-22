'use client'

// Privacidade & Meus Dados (LGPD) — /client/privacidade. Exportar dados (art. 18
// II/V), registrar aceite dos termos e excluir a conta (art. 18, com step-up de
// senha + confirmação "EXCLUIR"). Backend: /api/conta/{exportar,excluir,consentimento}.

import { useState } from 'react'
import Link from 'next/link'
import { supabase, authHeaders } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { PageHeader, Card, Section, Modal, inputCls, btnPrimary, btnGhost, Icon } from '../_ui'

export default function PrivacidadePage() {
  const toast = useToast()
  const [exportando, setExportando] = useState(false)
  const [aceitando, setAceitando] = useState(false)
  const [modal, setModal] = useState(false)

  async function exportar() {
    setExportando(true)
    try {
      const res = await fetch('/api/conta/exportar', { headers: await authHeaders() })
      if (!res.ok) throw new Error('Falha ao exportar.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventsy-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast.success('Seus dados foram exportados.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível exportar.') } finally { setExportando(false) }
  }

  async function registrarAceite() {
    setAceitando(true)
    try {
      const r = await fetch('/api/conta/consentimento', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({}),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      toast.success(r?.jaRegistrado ? 'Seu aceite já estava registrado.' : 'Aceite registrado. Obrigado!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao registrar.') } finally { setAceitando(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Privacidade e dados" subtitle="Você no controle dos seus dados pessoais, conforme a LGPD." />

      {/* Exportar */}
      <Section title="Seus dados">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="doc" size={22} /></span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">Exportar meus dados</div>
              <div className="text-[.8rem] text-ink-muted">Baixe um arquivo com todos os seus dados pessoais na Ventsy (acesso e portabilidade).</div>
            </div>
          </div>
          <button onClick={exportar} disabled={exportando} className={btnPrimary}>{exportando ? 'Gerando…' : 'Exportar (.json)'}</button>
        </Card>
      </Section>

      {/* Consentimentos / documentos */}
      <Section title="Consentimentos e documentos">
        <Card className="space-y-4">
          <p className="text-sm text-ink-muted">Ao usar a Ventsy você concorda com nossos Termos de Uso e Política de Privacidade. Você pode reconfirmar seu aceite a qualquer momento.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={registrarAceite} disabled={aceitando} className={btnPrimary}><Icon name="shield" size={16} /> {aceitando ? 'Registrando…' : 'Registrar meu aceite'}</button>
            <Link href="/termos" className={btnGhost}><Icon name="doc" size={16} /> Termos de Uso</Link>
            <Link href="/privacidade" className={btnGhost}><Icon name="shield" size={16} /> Política de Privacidade</Link>
          </div>
          <p className="text-[.78rem] text-ink-muted">Preferências de comunicação (e-mail, WhatsApp, novidades) ficam em <Link href="/client/perfil" className="font-semibold text-brand">Meu perfil</Link>.</p>
        </Card>
      </Section>

      {/* Zona de perigo */}
      <Section title="Encerrar conta">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"><Icon name="shield" size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-red-800">Excluir minha conta</div>
              <p className="mt-1 text-[.82rem] text-red-700">Esta ação é irreversível. Seus dados pessoais serão anonimizados e o acesso será encerrado. Você perde o histórico de eventos, favoritos, créditos e cupons.</p>
              <button onClick={() => setModal(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">Excluir conta</button>
            </div>
          </div>
        </div>
      </Section>

      {modal && <ExcluirModal onClose={() => setModal(false)} />}
    </div>
  )
}

function ExcluirModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [busy, setBusy] = useState(false)
  const habilitado = confirma.trim().toUpperCase() === 'EXCLUIR' && senha.length > 0

  async function excluir() {
    setBusy(true)
    try {
      const r = await fetch('/api/conta/excluir', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ senha, confirmacao: 'EXCLUIR' }),
      }).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      toast.success('Conta encerrada. Até logo.')
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao excluir.'); setBusy(false) }
  }

  return (
    <Modal title="Excluir minha conta" onClose={onClose}>
      <p className="text-sm text-ink-muted">Para confirmar, digite <strong className="text-ink">EXCLUIR</strong> e informe sua senha. Esta ação não pode ser desfeita.</p>
      <div className="mt-4 space-y-2.5">
        <input className={inputCls} placeholder="Digite EXCLUIR" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className={`${btnGhost} flex-1`}>Cancelar</button>
        <button onClick={excluir} disabled={!habilitado || busy} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button>
      </div>
    </Modal>
  )
}
