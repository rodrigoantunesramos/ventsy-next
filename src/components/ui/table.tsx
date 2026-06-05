type TableProps = {
  children?: React.ReactNode;
  columns?: string[];
  data?: any[][];
};

export function Table({ children, columns, data }: TableProps) {
  const base =
    "bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden";

  // 🔹 MODO AUTOMÁTICO (columns + data)
  if (columns && data) {
    return (
      <div className={base}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-left px-4 py-3 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50 transition">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 🔹 MODO CUSTOM (children)
  return (
    <div className={base}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: any) {
  return (
    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
      {children}
    </thead>
  );
}

export function TableRow({ children }: any) {
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50 transition">
      {children}
    </tr>
  );
}

export function TableCell({ children }: any) {
  return <td className="px-4 py-3">{children}</td>;
}