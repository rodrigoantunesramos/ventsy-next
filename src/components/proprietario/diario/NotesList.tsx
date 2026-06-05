"use client";

import { useDiaryStore } from "src/components/proprietario/diario//useDiaryStore";

export function NotesList() {
  const { notes, search, toggleImportant } = useDiaryStore();

  const filtered = notes.filter((n) => {
    const text = (n.content + " " + n.tags.join(" ")).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="mt-6 space-y-4">
      {filtered.map((note) => (
        <div
          key={note.id}
          className="bg-white p-4 rounded-xl shadow flex flex-col gap-2"
        >
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">
              {new Date(note.createdAt).toLocaleDateString()}
            </span>

            <button onClick={() => toggleImportant(note.id)}>
              {note.isImportant ? "⭐" : "☆"}
            </button>
          </div>

          <p>{note.content}</p>

          <div className="flex gap-2 flex-wrap">
            {note.tags.map((tag, i) => (
              <span
                key={i}
                className="bg-yellow-100 px-2 py-1 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}