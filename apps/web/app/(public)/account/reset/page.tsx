import { ResetForm } from "../account-forms";

export const metadata = { title: "Reset password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <ResetForm token={(await searchParams).token ?? ""} />;
}
