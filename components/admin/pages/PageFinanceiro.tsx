'use client'

export default function PageFinanceiro() {
  return (
    <div className="page" id="page-financeiro">
      <div id="fin-alerts"></div>

      {/* KPIs principais */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">💵</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-mrr">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">MRR</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Receita Mensal Recorrente</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(59,130,246,0.12)]">📅</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-arr">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">ARR</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Receita Anual Recorrente</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#8b5cf6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(139,92,246,0.12)]">💳</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-total">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Receita Total</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Histórico de pagamentos</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#f59e0b] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(245,158,11,0.12)]">👤</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-arpu">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">ARPU</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Receita por usuário ativo</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#ff385c] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(255,56,92,0.12)]">📉</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-churn">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Taxa de Churn</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Cancelamentos / Total</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#0ca678] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(12,166,120,0.12)]">🏆</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-ltv">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">LTV Estimado</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Valor médio por cliente</div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden transition-[border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-0.5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#3b82f6] before:to-transparent">
          <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[1.2rem] mb-4 bg-[rgba(59,130,246,0.12)]">⬆️</div>
          <div className="font-['Syne',sans-serif] text-[2rem] font-extrabold text-[#f0f0f5] leading-none mb-1.5 loading" id="fin-novos-mrr">—</div>
          <div className="text-[0.8rem] text-[#a0a0b8] font-medium">Novos MRR (30d)</div>
          <div className="text-[0.72rem] text-[#5c5c78] mt-1">Assinaturas novas este mês</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-4 mb-6">
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
          <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-1">Evolução da receita — 6 meses</div>
          <div className="text-[0.75rem] text-[#5c5c78] mb-5">Receita realizada por mês (valor_pago)</div>
          <div className="h-[240px] relative">
            <canvas id="chart-receita-mensal"></canvas>
          </div>
        </div>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
          <div className="font-['Syne',sans-serif] text-[0.95rem] font-bold mb-1">MRR por plano</div>
          <div className="text-[0.75rem] text-[#5c5c78] mb-5">Distribuição da receita recorrente atual</div>
          <div className="h-[240px] relative flex items-center justify-center">
            <canvas id="chart-receita-planos"></canvas>
          </div>
        </div>
      </div>

      {/* Breakdown por plano */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">📊 Breakdown por plano</div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden mb-7">
        <table>
          <thead>
            <tr>
              <th>Plano</th><th>Assinantes ativos</th><th>Preço</th><th>MRR</th><th>% da receita</th>
            </tr>
          </thead>
          <tbody id="fin-breakdown-tbody"></tbody>
        </table>
      </div>

      {/* Vencimentos */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">⏰ Vencimentos nos próximos 30 dias</div>
          <div className="text-[0.75rem] text-[#5c5c78] mt-0.5" id="fin-venc-count">Carregando...</div>
        </div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden mb-7">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Vence em</th><th>Dias restantes</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="fin-venc-tbody"></tbody>
        </table>
      </div>

      {/* Histórico de pagamentos */}
      <div className="flex items-center justify-between mb-5">
        <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">💳 Histórico de pagamentos</div>
      </div>
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <table>
          <thead>
            <tr>
              <th>Usuário</th><th>Plano</th><th>Valor</th><th>Início</th><th>Status</th>
            </tr>
          </thead>
          <tbody id="fin-pagamentos-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
