"use client";

import { Header } from "src/components/public/header"
import { Footer } from "src/components/public/Footer"
import { Property } from "@/lib/property";
import { PropertyGallery } from "@/components/public/propriedade/PropertyGallery";
import { PropertySidebar } from "@/components/public/propriedade/PropertySidebar";
import { PropertyEvents } from "@/components/public/propriedade/PropertyEvents";
import { useEffect, useState } from "react";
import { getPropertyImages } from "src/components/proprietario/fotos-propriedade/getPropertyImages";



const property: Property = {
  id: "1",
  name: "Espaço Luxo Rio Eventos",
  rating: 4.9,
  location: "Rio de Janeiro, RJ",
  host: {
    name: "Carlos Silva",
    avatar: "https://i.pravatar.cc/150",
    years: 3,
  },
  capacity: 120,
  type: "Salão de Festas",
  address: "Barra da Tijuca, Rio de Janeiro",
  description: "Espaço moderno ideal para eventos corporativos e festas privadas.",
  amenities: ["Wi-Fi", "Ar condicionado", "Estacionamento", "Cozinha"],
  priceHour: 300,
  priceDay: 2000,
  reviews: [
    { name: "Ana", comment: "Lugar incrível!", rating: 5 },
    { name: "João", comment: "Muito bom", rating: 4 },
  ],
  coordinates: { lat: -22.9068, lng: -43.1729 },
  images: []
};

const events = [
  {
    id: "1",
    name: "Casamento Luxo",
    cover: "https://images.unsplash.com/photo-1519741497674-611481863552",
    images: [
      "https://images.unsplash.com/photo-1519741497674-611481863552",
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
  {
    id: "2",
    name: "Aniversário 30 anos",
    cover: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
    images: [
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
  {
    id: "3",
    name: "Evento Corporativo",
    cover: "https://images.unsplash.com/photo-1515168833906-d2a3b82b302a",
    images: [
      "https://images.unsplash.com/photo-1515168833906-d2a3b82b302a",
      "https://images.unsplash.com/photo-1556761175-4b46a572b786",
    ],
  },
  {
    id: "4",
    name: "Chá de bebê",
    cover: "https://images.unsplash.com/photo-1521335629791-ce4aec67dd47",
    images: [
      "https://images.unsplash.com/photo-1521335629791-ce4aec67dd47",
    ],
  },
  {
    id: "5",
    name: "Festa temática",
    cover: "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    images: [
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329",
    ],
  },
];



export default function Page() {

const [images, setImages] = useState<string[]>([]);

useEffect(() => {
  async function loadImages() {
    const imgs = await getPropertyImages(property.id);
    setImages(imgs);
  }

  if (property.id) {
    loadImages();
  }
}, [property.id]);

  

  return (
    <div className="w-full">

      <Header />

      {/* 🔝 HEADER + TITULO */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <h1 className="text-3xl font-bold">{property.name}</h1>
        <p className="text-gray-500">
          ⭐ {property.rating} · {property.location}
        </p>
      </div>

      {/* 🖼️ GALERIA FULL WIDTH */}
      <div className="w-full mt-4">
        <PropertyGallery images={images} />
      </div>

      {/* 📦 CONTEÚDO PRINCIPAL */}
      <div className="mt-10 max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ESQUERDA */}
        <div className="lg:col-span-2 space-y-6 ">

          {/* HOST */}
          <div className="flex items-center gap-4">
            <img
              src={property.host.avatar}
              className="w-12 h-12 rounded-full"
            />
            <p>Na Ventsy há {property.host.years} anos</p>
          </div>

          {/* INFO */}
          <div>
            <h2 className="font-semibold text-xl">Informações</h2>
            <p>Capacidade: {property.capacity}</p>
            <p>Tipo: {property.type}</p>
            <p>{property.address}</p>
          </div>

          {/* DESCRIÇÃO */}
          <div>
            <h2 className="font-semibold text-xl">Sobre o espaço</h2>
            <p>{property.description}</p>
          </div>

          {/* AMENITIES */}
          <div>
            <h2 className="font-semibold text-xl">O que oferece</h2>
            <ul className="grid grid-cols-2 gap-2">
              {property.amenities.map((item) => (
                <li key={item}>✔ {item}</li>
              ))}
            </ul>
          </div>

          {/* REVIEWS */}
          <div>
            <h2 className="font-semibold text-xl">Avaliações</h2>
            {property.reviews.map((r, i) => (
              <div key={i} className="border-b py-2">
                <p className="font-semibold">{r.name}</p>
                <p>⭐ {r.rating}</p>
                <p>{r.comment}</p>
              </div>
            ))}
          </div>

          {/* MAPA */}
          <div>
            <h2 className="font-semibold text-xl">Localização</h2>
            <iframe
              className="w-full h-64 rounded-xl"
              src={`https://maps.google.com/maps?q=${property.coordinates.lat},${property.coordinates.lng}&z=15&output=embed`}
            />
          </div>

          {/* EVENTOS */}
          <PropertyEvents events={events} propertyId={property.id} />
        </div>

        {/* SIDEBAR */}
        <PropertySidebar property={property} />

              
        

      </div>

      <Footer />

    </div>

    
    
  );
}