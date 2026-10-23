import { SignUpForm } from "../account-forms";

export const metadata = { title: "Create an account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SignUpForm next={(await searchParams).next} />;
}
