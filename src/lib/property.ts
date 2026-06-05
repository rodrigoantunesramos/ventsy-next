// =========================
// FILE: src/lib/types/property.ts
// =========================
export interface Property {
  id: string;
  name: string;
  rating: number;
  location: string;
  images: string[];
  host: {
    name: string;
    avatar: string;
    years: number;
  };
  capacity: number;
  type: string;
  address: string;
  description: string;
  amenities: string[];
  priceHour: number;
  priceDay: number;
  reviews: { name: string; comment: string; rating: number }[];
  coordinates: { lat: number; lng: number };
}