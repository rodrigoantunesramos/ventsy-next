export function groupByDay(data: any[]) {
  const map: any = {}

  data.forEach((item) => {
    const day = new Date(item.created_at).getDate()

    if (!map[day]) {
      map[day] = { day, views: 0, clicks: 0 }
    }

    if (item.event_type === 'view') map[day].views++
    else map[day].clicks++
  })

  return Object.values(map)
}