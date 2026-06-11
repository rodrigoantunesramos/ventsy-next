'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ADMIN_MODULOS,
  adminPode,
  type AdminPapel,
  type AdminPermissoes,
} from '@/lib/adminRbac'

// Shell do novo painel do admin (substitui o admin.js legado). A proteção real
// (sessão + papel) é feita no Server Component pai (layout.tsx); aqui só a UI.
export default function AdminShell({
  email,
  papel,
  permissoes,
  children,
}: {
  email: string
  papel: AdminPapel
  permissoes: AdminPermissoes
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const membro = { usuario_id: '', papel, permissoes, ativo: true }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const itens = ADMIN_MODULOS.filter(
    (m) => m.key === 'dashboard' || adminPode(membro, m.key, 'ver'),
  )

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d13]">
        <div className="border-b border-white/[0.07] px-5 py-5">
          <div className="text-lg font-bold">
            VENTSY <span className="text-[#ff385c]">Admin</span>
          </div>
          <div className="mt-0.5 text-[0.7rem] text-[#5c5c78]">Centro de controle</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {itens.map((m) => {
            const href = m.key === 'dashboard' ? '/admin' : `/admin/${m.key}`
            const active =
              m.key === 'dashboard' ? pathname === '/admin' : pathname.startsWith(href)

            if (!m.pronto) {
              return (
                <div
                  key={m.key}
                  className="flex cursor-not-allowed items-center justify-between px-5 py-2.5 text-[0.85rem] text-[#4a4a5e]"
                  title="Em migração para o novo painel"
                >
                  {m.label}
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">
                    em breve
                  </span>
                </div>
              )
            }

            return (
              <Link
                key={m.key}
                href={href}
                className={`block border-r-2 px-5 py-2.5 text-[0.85rem] transition-colors ${
                  active
                    ? 'border-[#ff385c] bg-[#ff385c]/10 text-[#ff385c]'
                    : 'border-transparent text-[#a0a0b8] hover:bg-white/[0.03]'
                }`}
              >
                {m.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/[0.07] px-5 py-4">
          <div className="truncate text-[0.78rem] text-[#a0a0b8]">{email}</div>
          <div className="mb-2 text-[0.68rem] text-[#5c5c78]">
            {papel === 'super_admin' ? 'Super-admin' : 'Equipe'}
          </div>
          <button onClick={sair} className="text-[0.78rem] text-[#ff385c] hover:underline">
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
