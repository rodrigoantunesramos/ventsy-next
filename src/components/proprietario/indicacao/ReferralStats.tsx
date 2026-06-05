type Props = {
  stats: {
    invited: number;
    converted: number;
    rewards: number;
  };
};

export function ReferralStats({ stats }: Props) {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-6">
      <Card label="Indicados" value={stats.invited} />
      <Card label="Publicaram" value={stats.converted} />
      <Card label="Meses ganhos" value={`${stats.rewards} meses`} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-md hover:scale-[1.02] transition">
      <p className="text-sm text-zinc-500">{label}</p>
      <h3 className="text-xl font-semibold mt-1">{value}</h3>
    </div>
  );
}