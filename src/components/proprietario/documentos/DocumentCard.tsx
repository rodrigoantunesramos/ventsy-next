export default function DocumentCard({ doc, onView, onEdit }: any) {
  const today = new Date()
  const expiry = new Date(doc.expiryDate)
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)

  const isExpired = diff < 0

  return (
    <div
      className={`border rounded-xl p-4 shadow ${isExpired ? 'border-red-500' : ''}`}
    >
      <h3 className="font-semibold">{doc.name}</h3>
      <p className="text-sm text-gray-500">{doc.category}</p>
      <p className="text-sm">{doc.issuer}</p>
      <p className="text-xs">{doc.number}</p>

      <div className="text-xs mt-2">
        {isExpired
          ? `Vencido há ${Math.abs(diff)} dias`
          : `Vence em ${diff} dias`}
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={onView} className="text-blue-600 text-sm">
          Ver
        </button>
        <button onClick={onEdit} className="text-gray-600 text-sm">
          Editar
        </button>
      </div>
    </div>
  )
}
