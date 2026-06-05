'use client'

interface DadosPessoaisProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function DadosPessoais({ onChange }: DadosPessoaisProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome completo</label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">👤</span>
          <input name="nome" type="text" required className="block w-full pl-10 py-2 border border-gray-300 rounded-md" placeholder="Seu nome" onChange={onChange} />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data de nascimento</label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🎂</span>
          <input name="nascimento" type="date" required className="block w-full pl-10 py-2 border border-gray-300 rounded-md" onChange={onChange} />
        </div>
        <p className="mt-1 text-xs text-gray-400 italic">Apenas maiores de 18 anos podem se cadastrar.</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">📧</span>
          <input name="email" type="email" required className="block w-full pl-10 py-2 border border-gray-300 rounded-md" placeholder="email@exemplo.com" onChange={onChange} />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome de usuário</label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">@</span>
          <input name="username" type="text" required className="block w-full pl-10 py-2 border border-gray-300 rounded-md" placeholder="usuario_ventsy" onChange={onChange} />
        </div>
      </div>
    </div>
  )
}