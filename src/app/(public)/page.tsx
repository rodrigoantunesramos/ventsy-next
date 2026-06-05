import { Header } from "@/components/public/header";
import { Footer } from "@/components/public/Footer";
import { PropertyCarousel } from "@/components/public/PropertyCarousel";

const mockProperties = [
  {
    id: 1,
    name: "Espaço Sunset",
    city: "Rio de Janeiro",
    price: 500,
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85",
  },
  {
    id: 2,
    name: "Salão Premium",
    city: "São Paulo",
    price: 800,
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb",
  },
  {
    id: 3,
    name: "Chácara Verde",
    city: "Belo Horizonte",
    price: 600,
    image: "https://images.unsplash.com/photo-1501183638710-841dd1904471",
  },
  {
    id: 4,
    name: "Espaço Luxo",
    city: "Curitiba",
    price: 900,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
  },
];

export default function HomePage() {
  return (
    <div>
      <Header />

      <main className="mt-6">
        <PropertyCarousel
          title="Destaques"
          properties={mockProperties}
        />

        <PropertyCarousel
          title="Mais buscados"
          properties={mockProperties}
        />

        <PropertyCarousel
          title="Recomendados para você"
          properties={mockProperties}
        />
      </main>

      <Footer />
    </div>
  );
}