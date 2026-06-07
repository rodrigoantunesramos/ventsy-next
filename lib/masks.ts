// Máscaras e validações de input (camada de UX). A formatação de exibição
// canônica (moeda/numero/data) fica em lib/format.ts; aqui só tratamos o que o
// usuário digita. A máscara de moeda formata o NÚMERO (sem símbolo) — o "R$" é
// elemento visual do input, nunca hardcode na lógica.

export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '')

/** CEP -> "00000-000" */
export function maskCEP(v: string): string {
  const d = onlyDigits(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Telefone/WhatsApp BR -> "(11) 99999-9999" (aceita fixo e celular) */
export function maskTelefone(v: string): string {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Máscara de moeda baseada em centavos: dígitos "123456" -> "1.234,56". */
export function maskMoeda(v: string): string {
  const d = onlyDigits(v)
  if (!d) return ''
  return (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte o texto mascarado de volta para número (ex.: "1.234,56" -> 1234.56). */
export function parseMoeda(masked: string): number {
  const d = onlyDigits(masked)
  return d ? Number(d) / 100 : 0
}

/** Número do banco -> texto mascarado para o input (ex.: 1500 -> "1.500,00"). */
export function moedaFromNumber(n: number | null | undefined): string {
  if (n == null || Number(n) === 0) return ''
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const validarEmail = (s: string): boolean => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/** Normaliza handle do Instagram: aceita URL completa ou @handle -> "@handle". */
export function normalizeInstagram(v: string): string {
  let s = (v || '').trim()
  if (!s) return ''
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  s = s.replace(/^@+/, '')
  return s ? `@${s}` : ''
}
