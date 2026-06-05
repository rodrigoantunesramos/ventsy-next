type Property = {
  id: number;
  name: string;
  city: string;
  price: number;
  image: string;
};

export function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="min-w-[250px] bg-white rounded-2xl shadow-md overflow-hidden hover:scale-105 transition-transform">
      
      <img
        src={property.image}
        alt={property.name}
        className="w-full h-40 object-cover"
      />

      <div className="p-3">
        <h3 className="font-semibold">{property.name}</h3>
        <p className="text-sm text-gray-500">{property.city}</p>

        <div className="flex justify-between items-center mt-2">
          <span className="font-bold">R$ {property.price}/dia</span>
          <span className="text-yellow-500">★ 4.8</span>
        </div>
      </div>
    </div>
  );
}