export const metadata = { title: "About Us" };

/** Shell only. Content migrates from the current WordPress site (copy, timeline/FAQ, blog posts). */
export default function Page() {
  return (
    <>
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold tracking-tight">About Us</h1>
          <p className="mt-2 opacity-80">Our history since 1996, timeline and FAQ</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Content is being migrated from the current website.</div>
    </>
  );
}
