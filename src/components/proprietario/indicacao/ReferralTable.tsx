import { Referral } from "@/types/referral";

type Props = {
  data: Referral[];
};

export function ReferralTable({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl p-10 shadow-md text-center">
        <p className="text-zinc-500">
          Nenhuma indicação ainda. Compartilhe seu link e comece a ganhar!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-2">Propriedade</th>
            <th>Data</th>
            <th>Status</th>
            <th>Recompensa</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="py-2">{item.name}</td>
              <td>{item.date}</td>
              <td>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    item.status === "convertido"
                      ? "bg-green-100 text-green-600"
                      : "bg-yellow-100 text-yellow-600"
                  }`}
                >
                  {item.status}
                </span>
              </td>
              <td>{item.reward}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}