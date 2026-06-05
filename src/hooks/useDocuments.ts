import { useEffect, useState } from 'react'
import { fetchDocuments } from '@/services/documents'

export function useDocuments() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await fetchDocuments()
    setDocuments(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function addOrUpdate(doc: any) {
    setDocuments((prev) => {
      const exists = prev.find((d) => d.id === doc.id)

      if (exists) {
        return prev.map((d) => (d.id === doc.id ? doc : d))
      }

      return [doc, ...prev]
    })
  }

  function remove(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return {
    documents,
    loading,
    addOrUpdate,
    remove,
    reload: load,
  }
}