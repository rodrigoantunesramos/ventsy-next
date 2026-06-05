export default function SearchInput({ value, onChange }: any) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Buscar documentos..."
      className="border rounded-xl px-4 py-2 w-full"
    />
  )
}