'use client'

export default function PagePropriedades() {
  return (
    <div className="page" id="page-propriedades">
      <div className="bg-[#111118] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="font-['Syne',sans-serif] text-[1.05rem] font-bold text-[#f0f0f5]">Todas as propriedades</div>
          <div className="flex items-center gap-2 bg-[#1a1a24] border border-white/[0.07] rounded-lg px-3.5 py-2 text-[0.82rem] text-[#a0a0b8]">
            🔍
            <input
              type="text"
              placeholder="Buscar propriedade..."
              id="search-props"
              onInput={() => window.filterProps()}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Propriedade</th><th>Dono</th><th>Status</th><th>Plano</th><th>Localização</th><th>Ações</th>
            </tr>
          </thead>
          <tbody id="props-tbody"></tbody>
        </table>
      </div>
    </div>
  )
}
