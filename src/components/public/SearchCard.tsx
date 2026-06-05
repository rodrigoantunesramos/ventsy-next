type Property = {
  id: number;
  name: string;
  city: string;
  price: number;
  capacity: number;
  image: string;
};

export function SearchCard({
  property,
  onHover,
}: {
  property: Property;
  onHover: (id: number | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(property.id)}
      onMouseLeave={() => onHover(null)}
      className="bg-white rounded-2xl shadow-md overflow-hidden hover:scale-105 transition cursor-pointer"
    >
      <img
        src={property.image}
        alt={property.name}
        className="w-full h-48 object-cover"
      />

      <div className="p-4">
        <h3 className="font-semibold text-lg">
          {property.name}
        </h3>

        <p className="text-sm text-gray-500">
          {property.city}
        </p>

        <p className="text-sm mt-1">
          Capacidade: {property.capacity} pessoas
        </p>

        <div className="mt-2 font-bold">
          R$ {property.price}/dia
        </div>
      </div>
    </div>
  );
}