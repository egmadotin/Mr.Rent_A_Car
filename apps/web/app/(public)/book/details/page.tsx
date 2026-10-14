import { BookDetails } from "./book-details";

export const metadata = { title: "Your details", robots: { index: false } };

export default async function BookDetailsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <BookDetails search={{ pickup: sp.pickup, return: sp.return, from: sp.from, to: sp.to, promo: sp.promo }} vehicleTypeId={sp.type ?? ""} insuranceId={sp.ins} extras={sp.x} />;
}
