export function SummaryCard({ title, value, color }: any) {
  const colors: any = {
    green: "text-green-600",
    red: "text-red-500",
    blue: "text-blue-500",
    gray: "text-gray-700",
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <p className="text-sm text-gray-400">{title}</p>
      <h2 className={`text-2xl font-bold mt-2 ${colors[color]}`}>
        {value}
      </h2>
    </div>
  );
}