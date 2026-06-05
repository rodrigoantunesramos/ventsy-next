import { PreviewGaleria } from "./galeriaprincipal";
import { SecaoFotos } from "./secaodefotos";

export function FotosPropriedade() {
  return (
    <div className="space-y-6">

      <PreviewGaleria />

      <SecaoFotos titulo="Área Externa" />
      <SecaoFotos titulo="Salão Principal" />
      <SecaoFotos titulo="Área Interna" />

    </div>
  );
}