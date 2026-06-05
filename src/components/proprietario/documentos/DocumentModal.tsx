'use client'

export default function DocumentModal({
  doc,
  onClose,
  onDelete,
  onEdit,
}: any) {
  const today = new Date()
  const expiry = new Date(doc.expiryDate)
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)

  const isExpired = diff < 0

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs uppercase text-gray-400">
              {doc.category}
            </p>
            <h2 className="text-xl font-semibold">{doc.name}</h2>
          </div>

          <button onClick={onClose} className="text-gray-400 text-xl">
            ✕
          </button>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-4">
          <Info label="Órgão emissor" value={doc.issuer} />
          <Info label="Número / Protocolo" value={doc.number} />
          <Info label="Data de emissão" value={doc.issueDate} />
          <Info
            label="Data de vencimento"
            value={doc.expiryDate}
            highlight={isExpired}
          />
        </div>

        {/* STATUS */}
        <div className="bg-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-400 uppercase">Situação</p>
          <p
            className={`font-semibold ${
              isExpired ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {isExpired
              ? `Vencido há ${Math.abs(diff)} dias`
              : `Vence em ${diff} dias`}
          </p>
        </div>

        {/* PREVIEW */}
        <div className="bg-gray-100 rounded-xl p-6 text-center text-gray-400">
          📄 Pré-visualização não disponível
          <div className="text-xs mt-1">{doc.fileUrl}</div>
        </div>

        {/* OBS */}
        <div>
          <p className="text-xs uppercase text-gray-400">Observações</p>
          <div className="bg-gray-100 rounded-xl p-3 text-sm">
            {doc.notes || 'Sem observações'}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => onDelete(doc.id)}
            className="text-red-600 text-sm"
          >
            Excluir
          </button>

          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 rounded-lg border"
            >
              Editar
            </button>

            <a
              href={doc.fileUrl}
              download
              className="px-4 py-2 rounded-lg bg-red-500 text-white"
            >
              ⬇ Baixar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value, highlight }: any) {
  return (
    <div className="bg-gray-100 rounded-xl p-3">
      <p className="text-xs text-gray-400 uppercase">{label}</p>
      <p className={highlight ? 'text-red-600 font-semibold' : 'font-medium'}>
        {value}
      </p>
    </div>
  )
}

