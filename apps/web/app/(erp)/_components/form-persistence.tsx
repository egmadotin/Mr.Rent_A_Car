"use client";

import * as React from "react";
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "./form";

/**
 * Client requests (Nov 16):
 * - a new quote / reservation / rental keeps what was typed through a page refresh (a draft in this browser, cleared
 *   on save or Discard, forgotten after a day)
 * - editing an existing one saves by itself a moment after each change, with "Saving… / All changes saved" shown
 */

const PREFIX = "mrac-draft:";
const MAX_AGE = 24 * 3600_000;

const read = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at: number; data: unknown };
    if (Date.now() - d.at > MAX_AGE) return localStorage.removeItem(key), null;
    return d.data;
  } catch {
    return null;
  }
};

/**
 * Keep a new form's state in this browser while it's being filled in. `snapshot` is everything the form needs to come
 * back (no card CVV: that field isn't part of the form state); `restore` puts it back on load. Call `clear()` once saved.
 */
export function useFormDraft<T>({ enabled, snapshot, restore, label }: { enabled: boolean; snapshot: T; restore: (d: T) => void; label: string }) {
  const key = React.useRef<string | null>(null);
  const pristine = React.useRef<string | null>(null);
  const done = React.useRef(false);
  const ready = React.useRef(false);
  const json = JSON.stringify(snapshot);
  const restoreRef = React.useRef(restore);
  restoreRef.current = restore;

  // restore once, on load (the URL is the key: /reservations/new and /reservations/new?quoteId=… are separate drafts)
  React.useEffect(() => {
    if (!enabled) return;
    key.current = PREFIX + location.pathname + location.search;
    pristine.current = json;
    const saved = read(key.current) as T | null;
    if (saved) {
      restoreRef.current(saved);
      toast.info(`Unsaved ${label} restored`, {
        description: "What you typed before the page reloaded is back.",
        duration: 8000,
        action: {
          label: "Discard",
          onClick: () => {
            clear();
            location.reload();
          },
        },
      });
    }
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // write a moment after each change; an untouched form leaves nothing behind
  React.useEffect(() => {
    if (!enabled || !ready.current || done.current || !key.current) return;
    const t = setTimeout(() => {
      try {
        if (json === pristine.current) localStorage.removeItem(key.current!);
        else localStorage.setItem(key.current!, JSON.stringify({ at: Date.now(), data: JSON.parse(json) }));
      } catch {
        /* storage full or blocked: the form still works */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [json, enabled]);

  function clear() {
    done.current = true;
    try {
      if (key.current) localStorage.removeItem(key.current);
    } catch {
      /* ignore */
    }
  }
  return { clear };
}

export type AutoSaveState = { status: "idle" | "pending" | "saving" | "saved" | "error"; at?: Date; message?: string };

/**
 * Save an existing record by itself `delay` ms after the last change. Changes made while the page is still settling
 * (defaults filled in on load) don't count; saves never overlap. `save` throws to report a problem.
 */
export function useAutoSave({ enabled, value, save, delay = 1200 }: { enabled: boolean; value: unknown; save: () => Promise<void>; delay?: number }) {
  const [state, setState] = React.useState<AutoSaveState>({ status: "idle" });
  const json = JSON.stringify(value);
  const baseline = React.useRef(json);
  const settled = React.useRef(false);
  const running = React.useRef<Promise<void>>(Promise.resolve());
  const saveRef = React.useRef(save);
  saveRef.current = save;

  React.useEffect(() => {
    const t = setTimeout(() => (settled.current = true), 1500);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    if (!settled.current) {
      baseline.current = json;
      return;
    }
    if (json === baseline.current) return;
    setState({ status: "pending" });
    const t = setTimeout(() => {
      running.current = running.current.then(async () => {
        setState({ status: "saving" });
        try {
          await saveRef.current();
          baseline.current = json;
          setState({ status: "saved", at: new Date() });
        } catch (e) {
          setState({ status: "error", message: errorMessage(e) });
        }
      });
    }, delay);
    return () => clearTimeout(t);
  }, [json, enabled, delay]);

  return state;
}

/** "Saving… / All changes saved 10:42 / Not saved: …" beside the Save button. */
export function SaveStatus({ state }: { state: AutoSaveState }) {
  if (state.status === "idle") return <span className="text-xs text-muted-foreground">Changes save automatically</span>;
  if (state.status === "pending" || state.status === "saving")
    return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2Icon className="size-3.5 animate-spin" /> Saving…</span>;
  if (state.status === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-success" /> All changes saved {state.at?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    );
  return (
    <span className="flex max-w-80 items-center gap-1.5 text-xs text-destructive" title={state.message}>
      <AlertTriangleIcon className="size-3.5 shrink-0" /> <span className="truncate">Not saved: {state.message}</span>
    </span>
  );
}
