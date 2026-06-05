export default function Filters({ value, onChange }: any) {
  const categories = [
    'Todos',
    'Jurídico',
    'Licenças',
    'Fiscal',
    'Seguros',
    'Alvarás',
    'Outros',
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-3 py-1 rounded-full text-sm ${
            value === cat ? 'bg-black text-white' : 'bg-gray-200'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}