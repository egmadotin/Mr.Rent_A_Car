import { FileTextIcon } from "lucide-react";
import { Container, Notice, PageHero } from "../_components/ds";

export const metadata = { title: "Our services" };

/** Shell only. Content migrates from the current WordPress site (copy, timeline/FAQ, blog posts). */
export default function Page() {
  return (
    <>
      <PageHero kicker="Services" title="Our services" lead="Everyday rentals, airport pick-up, one-way trips, monthly rentals and insurance replacements." />
      <Container className="py-10">
        <Notice tone="muted" icon={FileTextIcon}>
          This page’s content is being moved over from the current website.
        </Notice>
      </Container>
    </>
  );
}
