import { SearchResults } from "src/components/public/SearchResults";
import { Header } from "@/components/public/header";
import { Footer } from "@/components/public/Footer";

export default function SearchPage({
  searchParams,
}: {
  searchParams: {
    location?: string;
    event?: string;
    guests?: string;
  };
}) {
  return (
    <><div>
      <Header />

      <div className="p-6">
        <SearchResults searchParams={searchParams} />
      </div>
    </div><Footer /></>
  );
}