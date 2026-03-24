'use client'

export default function PageAssinaturas() {
  return (
    <div className="page" id="page-assinaturas">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">✅</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="ass-ativas">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Assinaturas ativas</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">🎁</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="ass-trial">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Em período trial</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff385c] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(255,56,92,0.12)]">❌</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="ass-canc">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Canceladas</div>
        </div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">Todas as assinaturas</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Status</th><th>Início</th><th>Fim</th><th>Valor</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="ass-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
