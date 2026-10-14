export const metadata = { title: "Our Services" };

/** Shell only. Content migrates from the current WordPress site (copy, timeline/FAQ, blog posts). */
export default function Page() {
  return (
    <>
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold tracking-tight">Our Services</h1>
          <p className="mt-2 opacity-80">What we offer</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Content is being migrated from the current website.</div>
    </>
  );
}
