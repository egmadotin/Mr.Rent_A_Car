import { VerifyEmail } from "../account-forms";

export const metadata = { title: "Confirm your email" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <VerifyEmail token={(await searchParams).token ?? ""} />;
}
