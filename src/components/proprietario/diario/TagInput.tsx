"use client";

import { useState } from "react";

export function TagInput({ onChange }: any) {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const addTag = (e: any) => {
    if (e.key === "Enter" && input.trim()) {
      const newTags = [...tags, input.trim()];
      setTags(newTags);
      onChange(newTags);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="bg-yellow-200 px-2 py-1 rounded-lg text-sm">
            {tag}
          </span>
        ))}
      </div>

      <input
        placeholder="Adicionar tag (Enter)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={addTag}
        className="w-full p-2 border rounded-lg"
      />
    </div>
  );
}