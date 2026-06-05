// components/PopularSearches.tsx
export function PopularSearches() {
  const data = [
    { name: 'Casamento', value: 80 },
    { name: 'Formatura', value: 65 },
    { name: 'Aniversário', value: 50 },
    { name: 'Corporativo', value: 40 },
  ]

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="font-semibold mb-4">Buscas populares</h3>

      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.name}>
            <div className="flex justify-between text-sm">
              <span>{item.name}</span>
              <span>{item.value}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full mt-1">
              <div
                className="h-2 bg-black rounded-full"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}