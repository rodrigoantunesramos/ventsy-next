export function getPosition(ranking: any[], propertyId: string) {
  return ranking.findIndex(r => r.property_id === propertyId) + 1
}