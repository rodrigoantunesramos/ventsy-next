"use client";

export function SeletorData({ tipo, mes, ano, setMes, setAno, fechar }: any) {
  const meses = [
    "Jan","Fev","Mar","Abr","Mai","Jun",
    "Jul","Ago","Set","Out","Nov","Dez"
  ];

  const anos = Array.from({ length: 20 }, (_, i) => ano - 10 + i);

  return (
    <div className="absolute bg-white border rounded-xl p-4 shadow-lg mt-2">

      {/* SELETOR DE MÊS */}
      {tipo === "mes" && (
        <div className="grid grid-cols-4 gap-2">
          {meses.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                setMes(i);
                fechar();
              }}
              className={`p-2 rounded ${
                mes === i ? "bg-pink-500 text-white" : "hover:bg-gray-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* SELETOR DE ANO */}
      {tipo === "ano" && (
        <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
          {anos.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAno(a);
                fechar();
              }}
              className={`p-2 rounded ${
                ano === a ? "bg-pink-500 text-white" : "hover:bg-gray-100"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}