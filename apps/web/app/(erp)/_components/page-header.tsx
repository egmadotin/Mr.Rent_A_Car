import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

/** Page title band: breadcrumbs, title (Inter Bold, tight), description and the page's actions. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("px-4 pt-6 pb-2 md:px-6 md:pt-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="size-3.5 text-muted-foreground/60" />}
              {b.href ? (
                <Link href={b.href} className="font-medium transition-colors hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.03em] md:text-[28px]">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
