// components/RankingCard.tsx
export function RankingCard() {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="font-semibold mb-2">Seu Ranking</h3>
      <p className="text-gray-600">Você está na posição</p>
      <p className="text-3xl font-bold">#3</p>
      <p className="text-sm text-gray-500">de 25 espaços</p>

      <div className="mt-4 h-2 bg-gray-200 rounded-full">
        <div className="h-2 bg-black rounded-full w-[60%]" />
      </div>
    </div>
  )
}
