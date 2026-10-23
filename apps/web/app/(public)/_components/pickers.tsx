"use client";

import * as React from "react";
import { BuildingIcon, CheckIcon, ChevronDownIcon, MapPinIcon, PlaneIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@mrac/ui/components/popover";
import { cn } from "@mrac/ui/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 * Themed pickers for the booking capsule (the browser's own <select> menu can't be styled).
 * ListPicker: a popover listbox with keyboard support, optional search and groups.
 * ────────────────────────────────────────────────────────────────────────── */

export type PickerOption = {
  value: string;
  label: string;
  sub?: string;
  group?: string;
  code?: string;
  icon?: typeof MapPinIcon;
};

export function ListPicker({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select…",
  search = false,
  variant = "bare",
  icon: TriggerIcon,
  showSubInTrigger = false,
  contentClassName,
  align = "start",
  stretch = true,
  triggerClassName,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  ariaLabel: string;
  placeholder?: string;
  search?: boolean;
  /** "bare": the value sits inside a capsule cell; "field": a full input-styled control */
  variant?: "bare" | "field";
  icon?: typeof MapPinIcon;
  showSubInTrigger?: boolean;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  /** bare variant: let the trigger's hit area cover its whole capsule cell */
  stretch?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.sub ?? ""} ${o.code ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  // On open: highlight the current value and scroll it into view.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "center" }));
  }, [open, options, value]);

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (o: PickerOption | undefined) => {
    if (!o) return;
    onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    }
  };

  // group headings, in first-seen order
  let lastGroup: string | undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex w-full min-w-0 items-center gap-2 text-left outline-none",
            variant === "bare" && "cursor-pointer p-0 text-[15px] font-semibold text-foreground",
            variant === "bare" && stretch && "after:absolute after:inset-0 after:content-['']",
            variant === "field" &&
              "h-(--control-height) cursor-pointer rounded-control border border-input bg-card px-3 text-sm transition-[border-color,box-shadow] hover:border-foreground/60 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:border-foreground",
            triggerClassName,
          )}
        >
          {TriggerIcon && variant === "field" && <TriggerIcon className="size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              <>
                {selected.label}
                {showSubInTrigger && selected.sub && <span className="ml-1.5 font-normal text-muted-foreground">{selected.sub}</span>}
              </>
            ) : (
              <span className="font-normal text-muted-foreground">{placeholder}</span>
            )}
          </span>
          {variant === "field" && <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={14}
        onOpenAutoFocus={(e) => {
          if (!search) {
            e.preventDefault();
            listRef.current?.focus();
          }
        }}
        className={cn("w-80 overflow-hidden p-0", contentClassName)}
      >
        {search && (
          <div className="flex items-center gap-2 border-b px-3.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search a city, airport or street"
              aria-label="Search"
              aria-controls={`${baseId}-list`}
              aria-activedescendant={shown[active] ? `${baseId}-${active}` : undefined}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div
          ref={listRef}
          id={`${baseId}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={shown[active] ? `${baseId}-${active}` : undefined}
          onKeyDown={onKeyDown}
          className="max-h-80 overflow-y-auto overscroll-contain p-1.5 outline-none"
        >
          {shown.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>}
          {shown.map((o, i) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const isSel = o.value === value;
            const Icon = o.icon;
            return (
              <React.Fragment key={o.value}>
                {heading && <div className={cn("px-3 pt-2.5 pb-1.5 text-xs font-semibold text-muted-foreground", i > 0 && "mt-1 border-t pt-3")}>{heading}</div>}
                <div
                  id={`${baseId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-sm transition-colors",
                    i === active && "bg-muted",
                  )}
                >
                  {Icon && (
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", isSel ? "bg-foreground text-background" : "bg-muted text-foreground", i === active && !isSel && "bg-card")}>
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate", isSel ? "font-semibold" : "font-medium")}>{o.label}</span>
                      {o.code && <span className="type-code shrink-0 rounded-[6px] bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{o.code}</span>}
                    </span>
                    {o.sub && <span className="block truncate text-xs text-muted-foreground">{o.sub}</span>}
                  </span>
                  {isSel && <CheckIcon className="size-4 shrink-0 text-brand" strokeWidth={2.5} />}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Location options ─────────────────────────────────────────────────── */

type Loc = { id: string; name: string; city?: string | null; province?: string | null; address1?: string | null; isOffsite?: boolean | null };

const REGION: Record<string, string> = { BC: "Metro Vancouver", AB: "Calgary" };

/** "Burnaby - 6322 Kingsway, V5E 1C5" → label "Burnaby", sub "6322 Kingsway, V5E 1C5"; airports get a code and go first. */
export function locationOptions(locations: Loc[] | undefined): PickerOption[] {
  if (!locations) return [];
  const opts = locations.map((l) => {
    const code = l.name.match(/\b(YVR|YYC)\b/i)?.[1]?.toUpperCase();
    const [head, ...rest] = l.name.split(/\s+-\s+/);
    const airport = !!code || /airport/i.test(l.name);
    const label = code === "YVR" ? "Vancouver Airport" : code === "YYC" ? "Calgary Airport" : (head ?? l.name).trim();
    const sub = airport ? (l.isOffsite ? "Off-airport pick-up" : rest.join(" - ") || l.address1 || undefined) : rest.join(" - ") || l.address1 || undefined;
    const group = (l.province && REGION[l.province.toUpperCase()]) || l.province || undefined;
    return { value: l.id, label, sub: sub ?? undefined, code, group, icon: airport ? PlaneIcon : l.isOffsite ? BuildingIcon : MapPinIcon, airport };
  });
  const groupOrder = ["Metro Vancouver", "Calgary"];
  const gi = (g?: string) => {
    const i = groupOrder.indexOf(g ?? "");
    return i === -1 ? groupOrder.length : i;
  };
  opts.sort((a, b) => gi(a.group) - gi(b.group) || Number(b.airport) - Number(a.airport) || a.label.localeCompare(b.label));
  // only show group headings when there's more than one region
  const multi = new Set(opts.map((o) => o.group)).size > 1;
  return opts.map(({ airport: _a, ...o }) => (multi ? o : { ...o, group: undefined }));
}

