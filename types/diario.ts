export interface DiaryEntry {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  reminder_date: string | null;
  is_important: boolean;
  created_at: string;
}

export interface DiaryFormData {
  content: string;
  tags: string[];
  reminder_date: string;
  is_important: boolean;
}
