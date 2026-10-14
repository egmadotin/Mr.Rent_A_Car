import { BookResults } from "./book-results";

export const metadata = { title: "Select Vehicle", robots: { index: false } };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <BookResults search={{ pickup: sp.pickup, return: sp.return, from: sp.from, to: sp.to, promo: sp.promo }} />;
}
