import { supabase } from '@/lib/supabase/supabase'

export async function saveDocument(data: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 👇 COLOCA AQUI
  console.log('USER:', user)
  console.log('DATA:', data)
  console.log('ISSUE DATE:', data.issueDate)

  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const { error } = await supabase.from('documents').insert({
    user_id: user.id,
    name: data.name,
    category: data.category,
    issuer: data.issuer,
    number: data.number,
    issue_date: data.issueDate || null,
    expiry_date: data.expiryDate || null,
    notes: data.notes,
    file_url: data.fileUrl,
  })

  if (error) throw error
}