import { notFound } from "next/navigation";
import { Container } from "../../_components/ds";
import { publicApi } from "../../_lib/api";

/** A page made in Settings > Add/Edit Webpages (type Webpage). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await (await publicApi()).webPage({ id: (await params).id });
  return { title: p?.title ?? "Page" };
}

export default async function WebPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await (await publicApi()).webPage({ id: (await params).id });
  if (!p) notFound();
  return (
    <Container className="py-12">
      <h1 className="type-title-1 mb-6">{p.title}</h1>
      <div className="space-y-4 text-[17px] leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: p.content }} />
    </Container>
  );
}
