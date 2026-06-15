// Helpers de data em string 'YYYY-MM-DD' (local, agnóstico de fuso). Extraídos
// de lib/equipamentos e lib/logistica (defs idênticas), que re-exportam daqui.
const DIA_MS = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' → meia-noite local em ms (ancorado p/ evitar o off-by-one de UTC). NaN se inválido. */
export function startOfDayLocal(ymdStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymdStr)
  if (!m) return NaN
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime()
}

/** Date → 'YYYY-MM-DD' local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Soma `n` dias a uma string 'YYYY-MM-DD' (local), devolvendo 'YYYY-MM-DD'. */
export function addDaysYmd(s: string, n: number): string {
  const t = startOfDayLocal(s)
  if (Number.isNaN(t)) return s
  return ymd(new Date(t + n * DIA_MS))
}
