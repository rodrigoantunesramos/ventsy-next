// Layout do painel de administração central — VENTSY Admin
// Acesso restrito: verificação de e-mail admin feita no admin.js (ADMIN_EMAILS)
// TODO: adicionar verificação server-side via middleware quando necessário

import '@/styles/admin.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VENTSY Admin — Painel Central',
  description: 'Painel de administração central da plataforma VENTSY.',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
