import { redirect } from 'next/navigation'

// Aposentada: os ganhos foram consolidados no painel do proprietário.
export default function GanhosRedirect() {
  redirect('/painel/ganhos')
}
