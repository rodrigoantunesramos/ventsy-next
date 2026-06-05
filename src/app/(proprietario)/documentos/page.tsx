'use client'

import { useMemo, useState } from 'react'
import { useDocuments } from '@/hooks/useDocuments'

import DocumentCard from 'src/components/proprietario/documentos/DocumentCard'
import DocumentModal from 'src/components/proprietario/documentos/DocumentModal'
import EditDocumentModal from 'src/components/proprietario/documentos/EditDocumentModal'
import Filters from 'src/components/proprietario/documentos/Filter'
import SearchInput from '@/components/proprietario/documentos/SearchImput'

function getStatus(expiryDate: string) {
  if (!expiryDate) return { label: 'Sem vencimento', color: 'gray', days: 0 }

  const today = new Date()
  const expiry = new Date(expiryDate)
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)

  if (diff < 0) return { label: 'Vencido', color: 'red', days: Math.abs(diff) }
  if (diff <= 90) return { label: 'A vencer', color: 'yellow', days: diff }
  return { label: 'Em dia', color: 'green', days: diff }
}

export default function Page() {
  const { documents, loading, addOrUpdate, remove } = useDocuments()

  const [selected, setSelected] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const matchSearch =
        doc.name?.toLowerCase().includes(search.toLowerCase()) ||
        doc.number?.toLowerCase().includes(search.toLowerCase()) ||
        doc.issuer?.toLowerCase().includes(search.toLowerCase())

      const matchCategory = category === 'Todos' || doc.category === category

      return matchSearch && matchCategory
    })
  }, [documents, search, category])

  const stats = useMemo(() => {
    let emDia = 0
    let aVencer = 0
    let vencidos = 0

    documents.forEach((doc) => {
      const status = getStatus(doc.expiryDate)
      if (status.label === 'Em dia') emDia++
      if (status.label === 'A vencer') aVencer++
      if (status.label === 'Vencido') vencidos++
    })

    return { emDia, aVencer, vencidos, total: documents.length }
  }, [documents])

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Documentos</h1>

        <button
          onClick={() => setEdit({})}
          className="bg-black text-white px-4 py-2 rounded-xl"
        >
          + Novo Documento
        </button>
      </div>

      {/* LOADING */}
      {loading && <div className="text-gray-500">Carregando...</div>}

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Em dia" value={stats.emDia} />
        <Stat label="A vencer" value={stats.aVencer} />
        <Stat label="Vencidos" value={stats.vencidos} />
        <Stat label="Total" value={stats.total} />
      </div>

      {/* ALERT */}
      {stats.vencidos > 0 && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {stats.vencidos} documentos vencidos!
        </div>
      )}

      {/* FILTERS */}
      <div className="flex gap-4">
        <Filters value={category} onChange={setCategory} />
        <SearchInput value={search} onChange={setSearch} />
      </div>

      {/* LIST */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onView={() => setSelected(doc)}
            onEdit={() => setEdit(doc)}
          />
        ))}
      </div>

      {/* EMPTY */}
      {!loading && documents.length === 0 && (
        <div className="text-center text-gray-500">
          Nenhum documento ainda
        </div>
      )}

      {/* VIEW */}
      {selected && (
        <DocumentModal
          doc={selected}
          onClose={() => setSelected(null)}
          onDelete={(id: string) => {
            remove(id)
            setSelected(null)
          }}
          onEdit={() => {
            setSelected(null)
            setEdit(selected)
          }}
        />
      )}

      {/* EDIT */}
      {edit && (
        <EditDocumentModal
          doc={edit}
          onClose={() => setEdit(null)}
          onSave={(doc: any) => {
            addOrUpdate(doc)
            setEdit(null)
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-white shadow rounded-xl p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}