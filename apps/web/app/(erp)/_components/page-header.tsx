import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

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
    <header className={cn("border-b border-border bg-card px-4 py-4 md:px-6 shadow-2xs", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground font-sans">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground/50" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-primary transition-colors hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground/75 font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground font-sans">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
