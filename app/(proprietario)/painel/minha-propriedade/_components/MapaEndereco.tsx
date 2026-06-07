'use client';

// Preview de mapa + geocodificação (Nominatim) para capturar latitude/longitude.
// Reusa o padrão de import dinâmico do Leaflet de components/SearchMap.tsx.
// Usa circleMarker para evitar o problema de ícones 404 do Leaflet sob bundlers.

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';

type LeafletModule = typeof import('leaflet');

export default function MapaEndereco({
  query,
  lat,
  lng,
  onCoords,
}: {
  query: string;
  lat: number | null;
  lng: number | null;
  onCoords: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function setMarker(L: LeafletModule, map: LeafletMap, la: number, lo: number) {
    if (markerRef.current) markerRef.current.setLatLng([la, lo]);
    else markerRef.current = L.circleMarker([la, lo], { radius: 10, color: '#ff385c', fillColor: '#ff385c', fillOpacity: 0.7, weight: 2 }).addTo(map);
  }

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      const L = ((mod as unknown as { default?: LeafletModule }).default ?? mod) as LeafletModule;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const has = lat != null && lng != null;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(has ? [lat!, lng!] : [-15.78, -47.93], has ? 16 : 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      if (has) setMarker(L, map, lat!, lng!);
      setTimeout(() => map.invalidateSize(), 60);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || lat == null || lng == null) return;
    setMarker(L, map, lat, lng);
    map.setView([lat, lng], 16);
    setTimeout(() => map.invalidateSize(), 60);
  }, [lat, lng]);

  async function localizar() {
    if (!query.trim()) {
      setMsg('Preencha ao menos a cidade para localizar no mapa.');
      return;
    }
    setBusy(true);
    setMsg('Buscando localização…');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { 'Accept-Language': 'pt-BR' },
      }).then((r) => r.json());
      if (!Array.isArray(res) || res.length === 0) {
        setMsg('Endereço não encontrado. Confira os dados.');
      } else {
        onCoords(parseFloat(res[0].lat), parseFloat(res[0].lon));
        setMsg('');
      }
    } catch {
      setMsg('Não foi possível buscar a localização agora.');
    }
    setBusy(false);
  }

  const geolocalizado = lat != null && lng != null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-soft">
          Localização no mapa{' '}
          {geolocalizado ? (
            <span className="text-xs font-medium text-emerald-600">✓ fixada</span>
          ) : (
            <span className="text-xs font-medium text-amber-600">não fixada</span>
          )}
        </span>
        <button
          type="button"
          onClick={localizar}
          disabled={busy}
          className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {busy ? 'Localizando…' : geolocalizado ? 'Atualizar mapa' : 'Localizar no mapa'}
        </button>
      </div>
      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.03]" />
      {msg && <p className="mt-1.5 text-xs text-ink-muted">{msg}</p>}
    </div>
  );
}
