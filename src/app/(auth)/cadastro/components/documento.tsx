'use client'

interface DocumentoStepProps {
  tipoPessoa: 'pf' | 'pj'
  setTipoPessoa: (tipo: 'pf' | 'pj') => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function DocumentoStep({ tipoPessoa, setTipoPessoa, onChange }: DocumentoStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setTipoPessoa('pf')}
          className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition ${tipoPessoa === 'pf' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          <span className="mr-2">👤</span> CPF (Pessoa Física)
        </button>
        <button
          type="button"
          onClick={() => setTipoPessoa('pj')}
          className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition ${tipoPessoa === 'pj' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          <span className="mr-2">🏢</span> CNPJ (Empresa)
        </button>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}
        </label>
        <div className="relative mt-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🪪</span>
          <input
            name="documento"
            type="text"
            required
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500"
            placeholder={tipoPessoa === 'pf' ? "000.000.000-00" : "00.000.000/0001-00"}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  )
}