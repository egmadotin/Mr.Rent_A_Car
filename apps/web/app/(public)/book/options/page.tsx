import { BookOptions } from "./book-options";

export const metadata = { title: "Rental Options", robots: { index: false } };

export default async function BookOptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <BookOptions search={{ pickup: sp.pickup, return: sp.return, from: sp.from, to: sp.to, promo: sp.promo }} vehicleTypeId={sp.type ?? ""} />;
}
