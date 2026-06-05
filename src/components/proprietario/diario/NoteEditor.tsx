"use client";

import { useState } from "react";
import { useDiaryStore } from "src/components/proprietario/diario/useDiaryStore";
import { TagInput } from "./TagInput";

export function NoteEditor() {
  const addNote = useDiaryStore((s) => s.addNote);

  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const handleSave = () => {
    if (!content.trim()) return;

    addNote({
      content,
      tags,
      isImportant: false,
    });

    setContent("");
    setTags([]);
  };

  return (
    <div className="bg-[#fdfaf5] p-5 rounded-2xl shadow">
      <textarea
        placeholder="O que aconteceu? Com quem você falou?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-32 p-3 rounded-xl border resize-none"
      />

      <div className="mt-3">
        <TagInput onChange={setTags} />
      </div>

      <button
        onClick={handleSave}
        className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded-xl"
      >
        Salvar
      </button>
    </div>
  );
}