/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import Link from "next/link";
import { ArrowRightIcon, BriefcaseIcon, CarFrontIcon, DoorOpenIcon, UsersIcon, ZapIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 * Public-site building blocks from the Mr. Rent A Car design system:
 * Price, SectionHeading, PageHero, ClassTile, VehicleCard, PromoBanner, Notice.
 * ────────────────────────────────────────────────────────────────────────── */

export type Category = "Economy" | "Compact SUV" | "SUV" | "Minivan" | "Van" | "Truck" | "Electric" | "Signature";

/** The price ladder, cheapest first, Signature last. */
export const CATEGORY_ORDER: Category[] = ["Economy", "Compact SUV", "SUV", "Minivan", "Van", "Truck", "Electric", "Signature"];

/** Category from a class name (classes have no category field). */
export function categoryOf(name: string): Category {
  const n = name.toLowerCase();
  if (/model 3|model y|tesla|eqb|ioniq|electric|\bev\b|mx-30|bolt|leaf/.test(n)) return "Electric";
  if (/range rover|land rover|audi|bmw|mercedes|\bamg\b|gle|glc|c43|c300|cla|luxury|premium|signature|convertible|cab\b|mustang|challenger|charger scat/.test(n)) return "Signature";
  if (/cargo|\bvan\b/.test(n) && !/minivan/.test(n)) return "Van";
  if (/minivan|passenger|caravan|sedona|carnival|odyssey|sienna|pacifica/.test(n)) return "Minivan";
  if (/truck|pickup|ram 1500|f-150/.test(n)) return "Truck";
  if (/compact suv|kona|kicks|cx-30|countryman|x1\b/.test(n)) return "Compact SUV";
  if (/suv|sport utility|rogue|rav4|cr-v|cherokee|pathfinder|suburban|yukon|wrangler|murano|atlas/.test(n)) return "SUV";
  return "Economy";
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Price is the hero: Inter 800, tabular, small raised "$", "/day" beside it. */
export function Price({
  amount,
  per = "day",
  from = false,
  size = "md",
  className,
}: {
  amount: number | string;
  per?: string | null;
  from?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const n = Number(amount);
  return (
    <span className={cn("inline-flex items-baseline gap-0.5 whitespace-nowrap", className)}>
      {from && <span className="mr-1 text-xs font-medium text-muted-foreground">from</span>}
      <span
        className={cn(
          "font-extrabold tracking-[-0.035em] tabular-nums",
          size === "sm" && "text-xl",
          size === "md" && "text-[26px] leading-none",
          size === "lg" && "type-price",
        )}
      >
        <span className={cn("relative mr-px align-top font-bold", size === "sm" ? "top-0.5 text-xs" : "top-1 text-sm")}>$</span>
        {fmt(n)}
      </span>
      {per && <span className="ml-0.5 text-sm font-medium text-muted-foreground">/{per}</span>}
    </span>
  );
}

/** Section kicker + title + optional lead, left-aligned like an app. */
export function SectionHeading({
  kicker,
  title,
  lead,
  action,
  className,
  tone = "default",
}: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tone?: "default" | "signature";
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4", className)}>
      <div className="max-w-2xl">
        {kicker && (
          <p className={cn("text-[13px] font-semibold", tone === "signature" ? "text-champagne" : "text-brand")}>{kicker}</p>
        )}
        <h2 className={cn("mt-1.5 text-balance", tone === "signature" ? "type-signature-title md:text-[2.25rem]" : "type-title-2")}>{title}</h2>
        {lead && <p className={cn("mt-3 text-[17px] leading-relaxed", tone === "signature" ? "text-on-onyx-muted" : "text-muted-foreground")}>{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** Arrow link: "See all vehicles →" with the 3px nudge on hover. */
export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-brand", className)}>
      {children}
      <ArrowRightIcon className="size-4 transition-transform duration-180 ease-out-quick group-hover:translate-x-[3px]" />
    </Link>
  );
}

/** The top band of inner pages: a rounded sheet with the page title and the blush corner. */
export function PageHero({
  kicker,
  title,
  lead,
  children,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-4 pt-4 sm:px-6 lg:px-8", className)}>
      <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-sheet border bg-card">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-[26rem] rounded-full bg-[radial-gradient(circle,var(--brand-glow)_0%,transparent_65%)] opacity-60" />
        <div className="relative px-6 py-12 sm:px-10 md:py-16">
          {kicker && <p className="text-[13px] font-semibold text-brand">{kicker}</p>}
          <h1 className="mt-2 max-w-3xl type-title-1 text-balance">{title}</h1>
          {lead && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

/** Content container: 1280px, 16px gutters (32px from 640px). */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-8", className)}>{children}</div>;
}

/** One rung of the price ladder: category, photo, "from $X/day". */
export function ClassTile({
  category,
  image,
  fromDaily,
  count,
  href,
}: {
  category: Category;
  image?: string | null;
  fromDaily?: number | null;
  count: number;
  href: string;
}) {
  const sig = category === "Signature";
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border transition-[box-shadow,transform] duration-180 ease-out-quick hover:-translate-y-0.5 hover:shadow-lift",
        sig ? "signature border-onyx-line" : "bg-card",
      )}
    >
      <div className="studio relative grid aspect-[16/10] place-items-center overflow-hidden px-3 pt-3">
        {image ? (
          <img src={image} alt="" loading="lazy" className="max-h-full w-full object-contain transition-transform duration-700 ease-out-quick group-hover:scale-[1.03]" />
        ) : (
          <CarFrontIcon className="size-10 text-muted-foreground/50" aria-hidden />
        )}
        {category === "Electric" && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-pill bg-green-tint px-2 py-0.5 text-[11px] font-semibold text-racing">
            <ZapIcon className="size-3" /> Electric
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={cn("text-[15px] font-semibold tracking-tight", sig && "font-serif text-xl font-normal tracking-normal")}>{category}</h3>
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? "class" : "classes"}
            </p>
          </div>
          <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-[3px]" />
        </div>
        {fromDaily != null ? <Price amount={fromDaily} size="sm" from className="mt-auto" /> : <span className="mt-auto text-xs text-muted-foreground">Price with your dates</span>}
      </div>
    </Link>
  );
}

export type CardClass = {
  id: string;
  name: string;
  description: string | null;
  seats: number | null;
  luggage: number | null;
  doors: number | null;
  imageKey?: string | null;
  fromDaily?: string | number | null;
};

/** Up to four icon specs: seats, bags, doors (+ "Electric"). */
export function Specs({ vc, className }: { vc: CardClass; className?: string }) {
  const specs = [
    vc.seats != null && { icon: UsersIcon, label: `${vc.seats} seats` },
    vc.luggage != null && vc.luggage > 0 && { icon: BriefcaseIcon, label: `${vc.luggage} bags` },
    vc.doors != null && vc.doors > 0 && { icon: DoorOpenIcon, label: `${vc.doors} doors` },
    categoryOf(vc.name) === "Electric" && { icon: ZapIcon, label: "Electric" },
  ].filter(Boolean) as { icon: typeof UsersIcon; label: string }[];
  if (!specs.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground", className)}>
      {specs.slice(0, 4).map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <s.icon className="size-4" strokeWidth={1.75} /> {s.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Vehicle card: studio photo (16:10, contain), class as the title, "Toyota RAV4 or similar" in ink-muted,
 * icon specs, then the price and the action.
 */
export function VehicleCard({
  vc,
  image,
  footer,
  className,
}: {
  vc: CardClass;
  image?: string | null;
  footer?: React.ReactNode;
  className?: string;
}) {
  const sig = categoryOf(vc.name) === "Signature";
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border transition-[box-shadow,transform] duration-180 ease-out-quick hover:-translate-y-0.5 hover:shadow-lift",
        sig ? "signature border-onyx-line" : "bg-card",
        className,
      )}
    >
      <div className="studio relative grid aspect-[16/10] place-items-center overflow-hidden p-4">
        {image ? (
          <img src={image} alt={vc.name} loading="lazy" className="max-h-full w-full object-contain transition-transform duration-700 ease-out-quick group-hover:scale-[1.03]" />
        ) : (
          <CarFrontIcon className="size-12 text-muted-foreground/40" aria-hidden />
        )}
        {sig && <span className="absolute top-3 left-3 rounded-pill bg-champagne px-2.5 py-0.5 text-[11px] font-semibold text-on-champagne">Signature</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className={cn("type-heading", sig && "font-serif text-[22px] leading-tight font-normal tracking-normal")}>{vc.name}</h3>
          {vc.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{vc.description}</p>}
        </div>
        <Specs vc={vc} />
        {footer && <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">{footer}</div>}
      </div>
    </article>
  );
}

/** Promo banner: a card with a short headline, one line of copy and an arrow link. */
export function PromoBanner({
  title,
  text,
  href,
  cta,
  tone = "sheet",
  icon: Icon,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
  tone?: "sheet" | "green" | "steel";
  icon?: typeof UsersIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col justify-between gap-6 rounded-card border p-6 transition-shadow duration-180 hover:shadow-lift",
        tone === "sheet" && "bg-card",
        tone === "green" && "border-transparent bg-green-tint",
        tone === "steel" && "border-transparent bg-steel-tint",
      )}
    >
      <div>
        {Icon && (
          <span
            className={cn(
              "mb-4 grid size-10 place-items-center rounded-control",
              tone === "green" ? "bg-racing text-surface-sheet" : tone === "steel" ? "bg-steel text-surface-sheet" : "bg-muted text-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        )}
        <h3 className="type-title-3">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:text-brand">
        {cta} <ArrowRightIcon className="size-4 transition-transform duration-180 group-hover:translate-x-[3px]" />
      </span>
    </Link>
  );
}

/** Info / success / warning notice (radius-card, tinted). Always a word and an icon. */
export function Notice({
  tone = "info",
  icon: Icon,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "muted";
  icon?: typeof UsersIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-control px-4 py-3 text-sm",
        tone === "info" && "bg-steel-tint text-steel",
        tone === "success" && "bg-green-tint text-racing",
        tone === "warning" && "bg-amber-tint text-amber-ds",
        tone === "danger" && "bg-blush text-brand",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 text-foreground/90 [&_strong]:font-semibold">{children}</div>
    </div>
  );
}
