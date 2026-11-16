"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { fieldClass } from "./input";

type Opt = { value: string; label: string; disabled: boolean; group?: string };

const textOf = (n: React.ReactNode): string =>
  n == null || typeof n === "boolean" ? "" : Array.isArray(n) ? n.map(textOf).join("") : typeof n === "object" && "props" in n ? textOf((n.props as { children?: React.ReactNode }).children) : String(n);

/** The <option>s inside the children (through fragments, arrays and <optgroup>s), in order. */
function optionsOf(children: React.ReactNode, group?: string): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (c) => {
    if (!React.isValidElement(c)) return;
    const p = c.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean; label?: string };
    if (c.type === "option") {
      const label = textOf(p.children);
      out.push({ value: p.value === undefined ? label : String(p.value), label, disabled: !!p.disabled, group });
    } else if (c.type === "optgroup") out.push(...optionsOf(p.children, p.label));
    else if (c.type === React.Fragment) out.push(...optionsOf(p.children, group));
  });
  return out;
}

const setNativeValue = (el: HTMLSelectElement, v: string) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

/**
 * Searchable dropdown with the same props as a native <select> (client request: type to filter, like a search bar).
 * A hidden <select> holds the value, so `name` / FormData, `value` + `onChange` (e.target.value), `defaultValue` and
 * <option> / <optgroup> children all work as before; the visible box is a text input with a filtered list under it.
 * Keyboard: type to filter, ↑ / ↓ to move, Enter to pick, Esc to close.
 */
function NativeSelect({ className, children, id, disabled, "aria-label": ariaLabel, "aria-invalid": ariaInvalid, ref, ...props }: React.ComponentProps<"select">) {
  const selectRef = React.useRef<HTMLSelectElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const options = React.useMemo(() => optionsOf(children), [children]);
  const [cur, setCur] = React.useState<string>(() => String(props.value ?? props.defaultValue ?? options[0]?.value ?? ""));
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);

  // the hidden select is the source of truth (controlled value, defaultValue, the browser's first-option default)
  React.useLayoutEffect(() => {
    const v = selectRef.current?.value ?? "";
    if (v !== cur) setCur(v);
  });
  React.useEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    const sync = () => setCur(el.value);
    const reset = () => setTimeout(sync);
    el.addEventListener("change", sync);
    el.form?.addEventListener("reset", reset);
    return () => {
      el.removeEventListener("change", sync);
      el.form?.removeEventListener("reset", reset);
    };
  }, []);

  const selected = options.find((o) => o.value === cur);
  const words = (query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? options.filter((o) => o.value !== "" && words.every((w) => o.label.toLowerCase().includes(w))) : options;

  function openList() {
    if (disabled) return;
    setOpen(true);
    setQuery(null);
    setActive(Math.max(0, options.findIndex((o) => o.value === cur)));
  }
  function close() {
    setOpen(false);
    setQuery(null);
  }
  function pick(o: Opt | undefined) {
    if (!o || o.disabled) return;
    if (selectRef.current && o.value !== selectRef.current.value) setNativeValue(selectRef.current, o.value);
    setCur(o.value);
    close();
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => {
        let i = a;
        for (let k = 0; k < shown.length; k++) {
          i = (i + step + shown.length) % shown.length;
          if (!shown[i]?.disabled) break;
        }
        return i;
      });
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        pick(shown[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab") close();
  }
  React.useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const highlight = (label: string) => {
    if (!words.length) return label;
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
    return label.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-transparent font-semibold text-foreground">{part}</mark> : part));
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => (o ? openList() : close())}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={wrapRef} className="relative" data-slot="native-select">
          <select
            ref={(el) => {
              selectRef.current = el;
              if (typeof ref === "function") ref(el);
              else if (ref) ref.current = el;
            }}
            tabIndex={-1}
            aria-hidden
            disabled={disabled}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            {...props}
          >
            {children}
          </select>
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            // open: an empty search box with the current choice as the hint, so typing searches only what's typed
            value={open ? (query ?? "") : (selected?.label ?? "")}
            placeholder={(open && selected?.label) || (options[0]?.value === "" ? options[0].label : undefined)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (!open) setOpen(true);
            }}
            onFocus={() => openList()}
            onClick={() => (open ? undefined : openList())}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => {
              if (!wrapRef.current?.contains(document.activeElement) && !listRef.current?.contains(document.activeElement)) close();
            })}
            className={cn(fieldClass, "relative flex h-(--control-height) cursor-pointer py-1 pr-9 pl-3 text-ellipsis focus:cursor-text", className)}
          />
          <ChevronDownIcon
            className={cn("pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (wrapRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-50 max-h-[min(20rem,var(--radix-popover-content-available-height))] min-w-[var(--radix-popover-trigger-width)] max-w-[min(32rem,90vw)] overflow-hidden rounded-control border bg-popover text-sm text-popover-foreground shadow-floating"
        >
          <ul ref={listRef} role="listbox" className="max-h-[inherit] overflow-y-auto p-1">
            {shown.length === 0 && <li className="px-2.5 py-2 text-muted-foreground">No matches</li>}
            {shown.map((o, i) => (
              <li
                key={`${o.group ?? ""}|${o.value}|${i}`}
                role="option"
                aria-label={o.label || undefined}
                data-index={i}
                aria-selected={o.value === cur}
                aria-disabled={o.disabled || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5",
                  i === active && "bg-accent text-accent-foreground",
                  o.disabled && "cursor-not-allowed opacity-50",
                  o.value === "" && "text-muted-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate" title={o.label}>
                  {o.group && <span className="mr-1 text-xs text-muted-foreground">{o.group} ·</span>}
                  {highlight(o.label) || " "}
                </span>
                {o.value === cur && o.value !== "" && <CheckIcon className="size-4 shrink-0 text-primary" />}
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { NativeSelect };
