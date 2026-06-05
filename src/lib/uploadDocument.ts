import { supabase } from '@/lib/supabase/supabase'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')
}

export async function uploadDocument(file: File) {
  const cleanName = sanitizeFileName(file.name)
  const fileName = `${Date.now()}-${Math.random()}-${cleanName}`

 const {
  data: { user },
} = await supabase.auth.getUser()

const filePath = `${user?.id}/${Date.now()}-${cleanName}`

const { error } = await supabase.storage
  .from('documentos')
  .upload(filePath, file)

  if (error) throw error

  const { data } = supabase.storage
    .from('documentos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

