import { Skeleton } from "@/components/ui/skeleton";

export function Card({ title, loading }: { title: string; loading?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition hover:shadow-md hover:-translate-y-1 cursor-pointer">
      <p className="text-sm text-gray-400">{title}</p>

      {loading ? (
        <Skeleton className="h-6 w-20 mt-2" />
      ) : (
        <p className="text-2xl font-bold mt-2 text-gray-800">123</p>
      )}
    </div>
  );
}