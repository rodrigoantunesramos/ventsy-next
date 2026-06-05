"use client";

import { useDiaryStore } from "src/components/proprietario/diario/useDiaryStore";

export function DashboardStats() {
  const { notes } = useDiaryStore();

  const important = notes.filter((n) => n.isImportant).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card title="Total" value={notes.length} />
      <Card title="Importantes" value={important} />
      <Card title="Tags" value={new Set(notes.flatMap(n => n.tags)).size} />
      <Card title="Hoje" value={notes.length} />
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow text-center">
      <p className="text-gray-400 text-sm">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );
}