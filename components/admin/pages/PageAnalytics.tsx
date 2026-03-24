'use client'

export default function PageAnalytics() {
  return (
    <div className="page" id="page-analytics">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff385c] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(255,56,92,0.12)]">👁</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="an-total-views">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Total Visualizações</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Histórico completo</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">📱</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="an-total-wa">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Total Cliques WhatsApp</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(59,130,246,0.12)]">💬</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="an-total-form">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Total Cliques Formulário</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#8b5cf6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(139,92,246,0.12)]">🎯</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="an-ctr">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">CTR — Cliques/Visualizações</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">WhatsApp ÷ Views</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">🏆</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading text-[1.2rem]" id="an-top-prop">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Propriedade mais vista</div>
        </div>
      </div>

      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 mb-6">
        <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-1">Volume de eventos por tipo</div>
        <div className="text-[0.75rem] text-[#5c5c78] mb-5">Distribuição histórica</div>
        <div className="h-[280px] relative">
          <canvas id="chart-eventos-tipo"></canvas>
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">📊 Ranking de propriedades</div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Propriedade</th><th>Visualizações</th><th>WhatsApp</th><th>Formulário</th><th>Total</th>
            </tr>
          </thead>
          <tbody id="ranking-props"></tbody>
        </table>
      </div>
    </div>
  )
}
