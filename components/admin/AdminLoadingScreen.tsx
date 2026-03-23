// Tela de loading do Admin
// O admin.js manipula este elemento via id="loading-screen" — os ids e a estrutura
// devem ser preservados; só os estilos são migrados para Tailwind.
export default function AdminLoadingScreen() {
  return (
    <div
      id="loading-screen"
      className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center flex-col gap-5 z-[9999]"
    >
      <div className="font-['Syne',sans-serif] text-[2.2rem] font-extrabold tracking-[-1px] text-white">
        VENT<em className="not-italic text-[#ff385c]">SY</em>
      </div>
      <div className="w-[200px] h-[2px] bg-[#222230] rounded-full overflow-hidden">
        <div className="h-full w-0 bg-[#ff385c] rounded-full animate-[loadbar_1.5s_ease_forwards]" />
      </div>
    </div>
  )
}
