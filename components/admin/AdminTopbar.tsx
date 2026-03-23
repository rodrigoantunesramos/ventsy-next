// Topbar do Admin — title e subtitle são atualizados pelo admin.js via DOM (ids preservados)
export default function AdminTopbar() {
  return (
    <div className="sticky top-0 z-50 bg-[rgba(10,10,15,0.9)] backdrop-blur-xl border-b border-white/[0.07] px-10 py-4 flex items-center justify-between">
      <div>
        <div id="page-title" className="font-['Syne',sans-serif] text-[1.2rem] font-bold text-[#f0f0f5]">
          Dashboard
        </div>
        <div id="page-sub" className="text-[0.78rem] text-[#5c5c78]">Visão geral da plataforma</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[rgba(12,166,120,0.12)] border border-[rgba(12,166,120,0.25)] rounded-full px-3.5 py-[5px] text-[0.75rem] font-semibold text-[#0ca678]">
          <div className="w-[7px] h-[7px] bg-[#0ca678] rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
          Sistema online
        </div>
      </div>
    </div>
  )
}
