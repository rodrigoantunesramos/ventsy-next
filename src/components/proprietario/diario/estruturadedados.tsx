type Note = {
  id: string;
  content: string;
  tags: string[];
  isImportant: boolean;
  reminderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  checklist?: {
    text: string;
    done: boolean;
  }[];
};