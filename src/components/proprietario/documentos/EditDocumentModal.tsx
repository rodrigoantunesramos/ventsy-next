'use client'

import { useState } from 'react'
import { uploadDocument } from '@/lib/uploadDocument'
import { saveDocument } from '@/lib/saveDocument'

export default function EditDocumentModal({ doc, onClose, onSave }: any) {
  const [form, setForm] = useState({
    id: doc?.id || Date.now().toString(),
    name: doc?.name || '',
    category: doc?.category || 'Licenças',
    issuer: doc?.issuer || '',
    number: doc?.number || '',
    issueDate: doc?.issueDate || '',
    expiryDate: doc?.expiryDate || '',
    notes: doc?.notes || '',
    file: null as File | null,
  })

  const [hasExpiry, setHasExpiry] = useState(!!doc?.expiryDate)

  function handleFile(e: any) {
    const file = e.target.files[0]
    if (file) {
      setForm({ ...form, file })
    }
  }

  const isValid =
    form.name &&
    form.category &&
    form.issuer &&
    form.number &&
    form.issueDate &&
    (form.file || doc?.fileUrl) &&
    (!hasExpiry || form.expiryDate)

  async function handleSave() {
    if (!isValid) return

    try {
      let fileUrl = doc?.fileUrl || ''

      if (form.file) {
        fileUrl = await uploadDocument(form.file)
      }

      await saveDocument({
        ...form,
        expiryDate: hasExpiry ? form.expiryDate : null,
        fileUrl,
      })

      onSave({
        ...form,
        expiryDate: hasExpiry ? form.expiryDate : null,
        fileUrl,
      })
    } catch (err) {
  
  console.error('ERRO COMPLETO:', err)

if (err instanceof Error) {
  alert(err.message)
} else {
  alert('Erro desconhecido')
}
}
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between">
          <div>
            <h2 className="text-xl font-semibold">Editar Documento</h2>
            <p className="text-sm text-gray-500">
              Preencha os dados e anexe o arquivo do documento.
            </p>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        {/* NOME */}
        <input
          placeholder="Nome do documento"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-lg p-2"
        />

        {/* GRID */}
        <div className="grid grid-cols-2 gap-4">
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            className="border rounded-lg p-2"
          >
            <option>Jurídico</option>
            <option>Licenças</option>
            <option>Fiscal</option>
            <option>Seguros</option>
            <option>Alvarás</option>
            <option>Outros</option>
          </select>

          <input
            placeholder="Órgão emissor"
            value={form.issuer}
            onChange={(e) =>
              setForm({ ...form, issuer: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <input
            placeholder="Número"
            value={form.number}
            onChange={(e) =>
              setForm({ ...form, number: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="date"
            value={form.issueDate}
            onChange={(e) =>
              setForm({ ...form, issueDate: e.target.value })
            }
            className="border rounded-lg p-2"
          />
        </div>

        {/* CHECKBOX */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasExpiry}
            onChange={(e) => setHasExpiry(e.target.checked)}
          />
          <span className="text-sm">Possui vencimento</span>
        </div>

        {/* DATA VENCIMENTO */}
        {hasExpiry && (
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) =>
              setForm({ ...form, expiryDate: e.target.value })
            }
            className="border rounded-lg p-2 w-full"
          />
        )}

        {/* OBS */}
        <textarea
          placeholder="Observações"
          value={form.notes}
          onChange={(e) =>
            setForm({ ...form, notes: e.target.value })
          }
          className="w-full border rounded-lg p-2"
        />

        {/* UPLOAD */}
        <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer">
          <input type="file" className="hidden" onChange={handleFile} />
          <p className="text-gray-400">
            Arraste ou clique para selecionar
          </p>
        </label>

        {form.file && (
          <div className="bg-green-50 p-2 rounded">
            {form.file.name}
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose}>Cancelar</button>

          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg text-white ${
              isValid
                ? 'bg-red-500'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Salvar Documento
          </button>
        </div>
      </div>
    </div>
  )
}