import { supabase } from '@/lib/supabase/supabase'

export async function fetchDocuments() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return []
  }

  return data.map((doc) => ({
    id: doc.id,
    name: doc.name,
    category: doc.category,
    issuer: doc.issuer,
    number: doc.number,
    issueDate: doc.issue_date,
    expiryDate: doc.expiry_date,
    fileUrl: doc.file_url,
    notes: doc.notes,
  }))
}