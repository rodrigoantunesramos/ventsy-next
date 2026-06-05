export function PropertyGallery({ images }: { images: string[] }) {
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-gray-400">
        Carregando imagens...
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 h-[500px] px-2 md:px-6">

      {/* IMAGEM GRANDE */}
      <img
        src={images[0]}
        className="w-full h-full object-cover rounded-xl md:rounded-l-2xl"
      />

      {/* GRID DIREITA */}
      <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-2">
        {images.slice(1, 5).map((img, i) => (
          <div key={i} className="relative">
            <img
              src={img}
              className="w-full h-full object-cover rounded-xl"
            />

            {i === 3 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold rounded-xl cursor-pointer">
                Ver todas
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}