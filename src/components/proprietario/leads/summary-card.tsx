import { LucideIcon } from "lucide-react";

export function SummaryCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <h2 className="text-2xl font-bold">{value}</h2>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <div className="bg-gray-100 p-3 rounded-lg">
        <Icon size={20} />
      </div>
    </div>
  );
}