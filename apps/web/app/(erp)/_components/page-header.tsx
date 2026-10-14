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
    <header className={cn("border-b bg-card px-4 py-4 md:px-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="size-3" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
