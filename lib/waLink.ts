// Link wa.me canônico — extraído das cópias em lib/campanhas, lib/automacoes e
// de ~7 construções inline nos _lib do painel. Normaliza número BR (≤11 dígitos
// ganham '55') e anexa ?text= opcional. Retorna null se não há dígitos.
export function waLink(contato: string | null | undefined, texto?: string): string | null {
  const d = (contato || '').replace(/\D/g, '')
  if (!d) return null
  const fone = d.length <= 11 ? '55' + d : d
  const q = texto ? `?text=${encodeURIComponent(texto)}` : ''
  return `https://wa.me/${fone}${q}`
}

/** Link wa.me de COMPARTILHAMENTO (sem destinatário) — só o texto. */
export function waShareLink(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}
