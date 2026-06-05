export async function trackEvent({
  propertyId,
  type,
  source = 'direct',
  city,
  niche,
}: {
  propertyId: string
  type: string
  source?: string
  city?: string
  niche?: string
}) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        propertyId,
        type,
        source,
        city,
        niche,
      }),
    })
  } catch (err) {
    console.error('Analytics error', err)
  }
}