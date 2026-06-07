import { redirect } from 'next/navigation'

// Aposentada: a gestão de espaços foi consolidada no painel do proprietário.
export default function MeusEspacosRedirect() {
  redirect('/painel/meus-espacos')
}
