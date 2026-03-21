import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const espacoId = formData.get('espacoId')

  const filePath = `${espacoId}/${Date.now()}-${file.name}`

  const { data, error } = await supabase.storage
    .from('propriedades_eventos')
    .upload(filePath, file)

  return Response.json({ data, error, path: filePath })
}