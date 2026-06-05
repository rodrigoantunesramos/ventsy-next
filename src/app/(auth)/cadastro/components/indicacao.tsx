'use client'

interface IndicacaoFieldProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function IndicacaoField({ onChange }: IndicacaoFieldProps) {
  return (
    <div className="pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-600 mb-2">🤝 Você veio por indicação? Cole o código abaixo.</p>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🎁</span>
        <input
          name="indicacao"
          type="text"
          className="block w-full pl-10 py-2 border border-dashed border-gray-300 rounded-md"
          placeholder="Código opcional"
          onChange={onChange}
        />
      </div>
    </div>
  )
}