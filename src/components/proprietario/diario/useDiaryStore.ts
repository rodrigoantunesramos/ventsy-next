"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { supabase } from '@/lib/supabase/supabase'

export type Note = {
  id: string;
  content: string;
  tags: string[];
  isImportant: boolean;
  createdAt: Date;
};

type DiaryStore = {
  notes: Note[];
  search: string;

  fetchNotes: () => Promise<void>;
  addNote: (note: Omit<Note, "id" | "createdAt">) => Promise<void>;
  toggleImportant: (id: string) => Promise<void>;
  setSearch: (value: string) => void;
};

export const useDiaryStore = create<DiaryStore>((set, get) => ({
  notes: [],
  search: "",

  fetchNotes: async () => {
    const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });

    if (!data) return;

    const formatted = data.map((n: any) => ({
      id: n.id,
      content: n.content,
      tags: n.tags || [],
      isImportant: n.is_important,
      createdAt: new Date(n.created_at),
    }));

    set({ notes: formatted });
  },

  addNote: async (note) => {
    const { data, error } = await supabase
      .from("notes")
      .insert({
        content: note.content,
        tags: note.tags,
        is_important: note.isImportant,
      })
      .select()
      .single();

    if (error || !data) return;

    const newNote: Note = {
      id: data.id,
      content: data.content,
      tags: data.tags || [],
      isImportant: data.is_important,
      createdAt: new Date(data.created_at),
    };

    set((state) => ({
      notes: [newNote, ...state.notes],
    }));
  },

  toggleImportant: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;

    const { error } = await supabase
      .from("notes")
      .update({ is_important: !note.isImportant })
      .eq("id", id);

    if (error) return;

    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, isImportant: !n.isImportant } : n
      ),
    }));
  },

  setSearch: (value) => set({ search: value }),
}));