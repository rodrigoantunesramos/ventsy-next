'use client'

interface SenhaStepProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function SenhaStep({ onChange }: SenhaStepProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
        <input name="senha" type="password" required className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md" onChange={onChange} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmar</label>
        <input name="confirmarSenha" type="password" required className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md" onChange={onChange} />
      </div>
    </div>
  )
}