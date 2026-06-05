export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      {children}
    </div>
  );
}