export interface DiaryEntry {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  reminder_date: string | null;
  is_important: boolean;
  lead_id: string | null;
  created_at: string;
  // Rótulo do lead vinculado (preenchido pela API via join; opcional).
  lead?: LeadRef | null;
}

export interface LeadRef {
  id: string;
  nome_evento: string;
  quem_contratou: string;
  status: string | null;
}

export interface DiaryFormData {
  content: string;
  tags: string[];
  reminder_date: string;
  is_important: boolean;
  lead_id: string | null;
}
