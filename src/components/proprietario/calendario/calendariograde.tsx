export function CalendarGrid({ dias, onClickDia, mes, ano }: any) {
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeData = new Date();
  const eMesAtual = hojeData.getMonth() === mes && hojeData.getFullYear() === ano;
  const hojeDia = hojeData.getDate();
  const data = dias?.[dias];

  return (
    <div className="grid grid-cols-7 gap-3">

      {Array.from({ length: totalDias }).map((_, i) => {
        const dia = i + 1;
        const data = dias[dia];

        let style = "bg-gray-50 hover:bg-gray-100";

        // 🔴 BLOQUEADO
        if (data?.status === "bloqueado") {
          style = "bg-red-100 border-red-300";
        }

        // 🔵 RESERVADO
            if (data?.status === "reservado") {
            style = "bg-red-100 text-red-600 font-semibold";
          }

        // 🌸 HOJE (prioridade se não tiver evento)
        if (!data && eMesAtual && dia === hojeDia) {
          style = "bg-pink-500 text-white border-pink-500"; 
        }

        

        return (
          <div
            key={dia}
            onClick={() => onClickDia(dia)}
            className={`h-20 rounded-xl p-2 cursor-pointer border text-sm ${style}`}
          >
            <div className="font-medium">{dia}</div>

            {data?.evento && (
              <p className="text-xs mt-1 truncate">
                {data.evento.nome}
              </p>
            )}
          </div>
        );
      })}

    </div>
  );
}