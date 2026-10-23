import { LoginForm } from "../account-forms";

export const metadata = { title: "Log In" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <LoginForm next={(await searchParams).next} />;
}
