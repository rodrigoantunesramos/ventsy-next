import { SecaoFotos } from "./secaodefotos";

export function FotosEventos() {
  return (
    <div className="space-y-6">

      <div className="bg-black text-white p-4 rounded-xl">
        🎉 Mostre como seu espaço é usado nos eventos
      </div>

      <SecaoFotos titulo="Casamentos" />
      <SecaoFotos titulo="Eventos Corporativos" />
      <SecaoFotos titulo="Aniversários" />

    </div>
  );
}