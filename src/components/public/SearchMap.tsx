"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🔥 Função para criar pin com preço estilo Airbnb
function createPriceIcon(price: number, isActive: boolean) {
  return L.divIcon({
    className: "custom-price-icon",
    html: `
      <div class="price-marker ${isActive ? "active" : ""}">
        R$ ${price}
      </div>
    `,
    iconSize: [0, 0], // 🔥 ESSENCIAL
  });
}

type Property = {
  id: number;
  name: string;
  price: number;
  lat: number;
  lng: number;
};

export function SearchMap({
  properties,
  hoveredId,
}: {
  properties: Property[];
  hoveredId: number | null;
}) {
  const defaultCenter = [-22.9068, -43.1729]; // Rio

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="w-full h-full rounded-2xl"
      zoomControl={false}
    >
      {/* 🗺️ MapTiler (lembra da KEY no .env.local) */}
      <TileLayer
        url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
      />

      {/* 📍 Pins com preço */}
      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[property.lat, property.lng]}
          icon={createPriceIcon(
            property.price,
            hoveredId === property.id
          )}
        >
          <Popup>
            <strong>{property.name}</strong>
            <p>R$ {property.price}/dia</p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}