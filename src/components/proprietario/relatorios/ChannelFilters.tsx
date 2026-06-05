// components/ChannelFilters.tsx
export function ChannelFilters() {
  const channels = [
    { name: 'Visualizações', value: 1200 },
    { name: 'Fotos', value: 320 },
    { name: 'WhatsApp', value: 210 },
    { name: 'Formulários', value: 90 },
    { name: 'Avaliações', value: 45 },
    { name: 'Instagram', value: 150 },
    { name: 'Facebook', value: 80 },
    { name: 'TikTok', value: 60 },
    { name: 'YouTube', value: 30 },
    { name: 'LinkedIn', value: 15 },
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {channels.map((c) => (
        <div
          key={c.name}
          className="min-w-[140px] bg-white shadow rounded-xl p-3 hover:shadow-md cursor-pointer"
        >
          <p className="text-sm text-gray-500">{c.name}</p>
          <p className="text-lg font-semibold">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
