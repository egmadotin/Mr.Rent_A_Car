import { FileTextIcon } from "lucide-react";
import { Container, Notice, PageHero } from "../_components/ds";

export const metadata = { title: "Blog" };

/** Shell only. Content migrates from the current WordPress site (copy, timeline/FAQ, blog posts). */
export default function Page() {
  return (
    <>
      <PageHero kicker="Blog" title="Blog" lead="News, travel tips and local guides for Vancouver and Calgary." />
      <Container className="py-10">
        <Notice tone="muted" icon={FileTextIcon}>
          This page’s content is being moved over from the current website.
        </Notice>
      </Container>
    </>
  );
}
