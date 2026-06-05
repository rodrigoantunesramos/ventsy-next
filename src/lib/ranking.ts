export async function getRanking({ city, niche }: any) {
  const { data } = await supabase.rpc('ranking_by_city_niche', {
    city_param: city,
    niche_param: niche,
  })

  return data
}