export function PreviewGaleria() {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-4">

      <h2 className="font-semibold">
        ⭐ 5 Fotos em Destaque — Galeria Principal
      </h2>

      <div className="grid grid-cols-3 gap-4 h-[200px]">

        {/* FOTO GRANDE */}
        <div className="col-span-2 bg-gray-100 rounded-xl flex items-center justify-center">
          Foto 1
        </div>

        {/* 4 PEQUENAS */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-100 rounded-lg">2</div>
          <div className="bg-gray-100 rounded-lg">3</div>
          <div className="bg-gray-100 rounded-lg">4</div>
          <div className="bg-gray-100 rounded-lg">5</div>
        </div>

      </div>

    </div>
  );
}