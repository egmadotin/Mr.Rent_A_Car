import { FileTextIcon } from "lucide-react";
import { Container, Notice, PageHero } from "../_components/ds";

export const metadata = { title: "About us" };

/** Shell only. Content migrates from the current WordPress site (copy, timeline/FAQ, blog posts). */
export default function Page() {
  return (
    <>
      <PageHero kicker="About" title="About us" lead="Locally owned since 1996: our history, timeline and FAQ." />
      <Container className="py-10">
        <Notice tone="muted" icon={FileTextIcon}>
          This page’s content is being moved over from the current website.
        </Notice>
      </Container>
    </>
  );
}
