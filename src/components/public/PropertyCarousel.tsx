import { PropertyCard } from "./PropertyCard";

type Property = {
  id: number;
  name: string;
  city: string;
  price: number;
  image: string;
};

export function PropertyCarousel({
  title,
  properties,
}: {
  title: string;
  properties: Property[];
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4 px-6">{title}</h2>

      <div className="flex gap-4 overflow-x-auto px-6 scrollbar-hide">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}