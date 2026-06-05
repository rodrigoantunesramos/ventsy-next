type Lead = {
  id: string;
  evento: string;
  cliente: string;
  data: string;
};


export function LeadCard({ lead, onClick }: any) {
  return (
    <div
      onClick={() => onClick(lead)}
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
    >
      <p className="text-sm font-medium">{lead.evento}</p>
      <p className="text-xs text-gray-500">{lead.cliente}</p>
      <p className="text-xs text-gray-400">{lead.data}</p>
    </div>
  );
}