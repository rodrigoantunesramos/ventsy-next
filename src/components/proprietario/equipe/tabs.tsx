"use client";

interface Props {
  active: string;
  setActive: (tab: string) => void;
}

export function Tabs({ active, setActive }: Props) {
  const tabs = ["EQUIPE", "FOLHA", "ENCARGOS"];

  return (
    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActive(tab)}
          className={`px-4 py-2 text-sm rounded-lg transition ${
            active === tab ? "bg-white shadow font-medium" : "text-gray-500"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
