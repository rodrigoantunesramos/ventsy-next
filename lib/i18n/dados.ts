// Traduz um valor canônico de domínio; cai no próprio valor se ausente.
export function rotuloDado(mapa: Record<string, string>, valor: string | undefined | null): string {
  if (!valor) return ''
  return mapa[valor] ?? valor
}
