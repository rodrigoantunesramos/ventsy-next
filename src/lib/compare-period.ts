export function comparePeriods(current: any[], previous: any[]) {
  const currentTotal = current.length
  const previousTotal = previous.length

  if (previousTotal === 0) return 100

  return ((currentTotal - previousTotal) / previousTotal) * 100
}