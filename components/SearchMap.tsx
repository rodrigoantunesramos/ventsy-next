'use client'
import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'

type LeafletModule = typeof import('leaflet')

export type MapProperty = {
  id: number | string
  nome?: string | null
  latitude?: number | null
  longitude?: number | null
  valor_hora?: number | null
  valor_base?: number | null
  _plano?: 'basico' | 'pro' | 'ultra'
}

export default function SearchMap({ properties }: { properties: MapProperty[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const LRef = useRef<LeafletModule | null>(null)

  // Inicializa o mapa uma vez (import dinâmico — Leaflet acessa window)
  useEffect(() => {
    let cancelled = false
    import('leaflet').then((mod) => {
      const L = ((mod as unknown as { default?: LeafletModule }).default ?? mod) as LeafletModule
      if (cancelled || !containerRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([-15.78, -47.93], 4)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 0)
      drawMarkers()
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redesenha marcadores quando a lista muda (filtros/busca)
  useEffect(() => {
    drawMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties])

  function drawMarkers() {
    const L = LRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!L || !map || !layer) return
    layer.clearLayers()
    const pts: [number, number][] = []
    for (const p of properties) {
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) continue
      const valor = Number(p.valor_hora) > 0 ? Number(p.valor_hora) : Number(p.valor_base) > 0 ? Number(p.valor_base) : 0
      const label = valor > 0 ? `R$ ${valor.toLocaleString('pt-BR')}` : 'Ver'
      const ultra = p._plano === 'ultra' ? ' price-marker-ultra' : ''
      const icon = L.divIcon({
        className: 'price-marker-wrap',
        html: `<span class="price-marker${ultra}">${label}</span>`,
        iconSize: [1, 1],
      })
      const marker = L.marker([lat, lng], { icon })
      marker.on('click', () => { window.location.href = `/propriedade/${p.id}` })
      if (p.nome) marker.bindTooltip(p.nome, { direction: 'top', offset: [0, -14] })
      marker.addTo(layer)
      pts.push([lat, lng])
    }
    if (pts.length === 1) map.setView(pts[0], 13)
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 })
  }

  return <div ref={containerRef} className="w-full h-full bg-gray-100" />
}
