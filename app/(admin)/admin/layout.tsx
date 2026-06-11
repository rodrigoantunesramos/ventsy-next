// Layout do painel de administração central — VENTSY Admin.
// Proteção SERVER-SIDE real: exige sessão (cookie) + ser membro de admin ativo.
// (Substitui o gate por lista de e-mails que ficava no admin.js legado.)

import '@/styles/admin.css'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabaseServer'
import { getAdminMembro } from '@/lib/adminAuth'
import AdminShell from '@/components/admin/AdminShell'

export const metadata: Metadata = {
  title: 'VENTSY Admin — Painel Central',
  description: 'Painel de administração central da plataforma VENTSY.',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const membro = await getAdminMembro(user.id)
  if (!membro) redirect('/login?redirect=/admin')

  return (
    <AdminShell email={user.email ?? ''} papel={membro.papel} permissoes={membro.permissoes}>
      {children}
    </AdminShell>
  )
}
