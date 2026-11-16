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
 * Keep a form's state in this browser while it's being filled in or edited (client request, Nov 9: never lose entered
 * data — a refresh by mistake or a dropped connection brings everything back exactly as it was).
 * - written a moment after each change, and at once when the page is being closed / refreshed / hidden
 * - while something is unsaved, the browser asks before leaving the page ("Leave site?")
 * - `snapshot` is everything the form needs to come back (never the card CVV: it isn't part of the form state);
 *   `restore` puts it back on load. New forms call `clear()` once saved; edit forms call `saved()` after each save.
 */
export function useFormDraft<T>({ enabled, snapshot, restore, label }: { enabled: boolean; snapshot: T; restore: (d: T) => void; label: string }) {
  const key = React.useRef<string | null>(null);
  const pristine = React.useRef<string | null>(null);
  const done = React.useRef(false);
  const ready = React.useRef(false);
  const restored = React.useRef(false);
  const settled = React.useRef(false);
  const stored = React.useRef(false);
  const json = JSON.stringify(snapshot);
  const latest = React.useRef(json);
  latest.current = json;
  const restoreRef = React.useRef(restore);
  restoreRef.current = restore;

  const write = React.useCallback(() => {
    if (!enabled || !ready.current || done.current || !key.current) return;
    try {
      // an untouched form leaves nothing behind; restored data counts as unsaved until it's saved
      if (latest.current === pristine.current && !restored.current) {
        localStorage.removeItem(key.current);
        stored.current = false;
      } else {
        localStorage.setItem(key.current, JSON.stringify({ at: Date.now(), data: JSON.parse(latest.current) }));
        stored.current = true;
      }
    } catch {
      /* storage full or blocked: the form still works */
    }
  }, [enabled]);

  // restore once, on load (the URL is the key: /reservations/new, /reservations/new?quoteId=…, /reservations/<id>/edit)
  React.useEffect(() => {
    if (!enabled) return;
    key.current = PREFIX + location.pathname + location.search;
    pristine.current = latest.current;
    const saved = read(key.current) as T | null;
    if (saved) {
      restored.current = true;
      stored.current = true;
      restoreRef.current(saved);
      toast.info(`Unsaved ${label} restored`, {
        description: "What was entered before the page reloaded is back, exactly as it was.",
        duration: 10000,
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
    // defaults filled in while the page settles (locations, times…) aren't the user's typing
    const t = setTimeout(() => (settled.current = true), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled || !ready.current) return;
    if (!settled.current && !restored.current) {
      pristine.current = json;
      return;
    }
    const t = setTimeout(write, 300);
    return () => clearTimeout(t);
  }, [json, enabled, write]);

  // write at once when the page goes away, and ask before leaving with unsaved entries
  React.useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (settled.current || restored.current) write();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (!done.current && stored.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [enabled, write]);

  function clear() {
    done.current = true;
    stored.current = false;
    try {
      if (key.current) localStorage.removeItem(key.current);
    } catch {
      /* ignore */
    }
  }
  /** The server has everything: drop the local copy but keep watching for new changes (edit forms). */
  function saved(savedJson?: string) {
    pristine.current = savedJson ?? latest.current;
    restored.current = false;
    if (pristine.current === latest.current) {
      stored.current = false;
      try {
        if (key.current) localStorage.removeItem(key.current);
      } catch {
        /* ignore */
      }
    }
  }
  return { clear, saved };
}

/** Online / offline, live. */
export function useOnline() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  return online;
}

/** Shown on every page while the connection is down. */
export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="mt-3 flex items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
      No internet connection. What you enter is kept on this computer and comes back after a refresh; it saves once the connection is back.
    </div>
  );
}

const OFFLINE = "offline — kept on this computer, saves when the connection is back";

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
  const online = useOnline();

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
    if (!online) {
      setState({ status: "error", message: OFFLINE });
      return;
    }
    setState({ status: "pending" });
    const t = setTimeout(() => {
      running.current = running.current.then(async () => {
        setState({ status: "saving" });
        try {
          await saveRef.current();
          baseline.current = json;
          setState({ status: "saved", at: new Date() });
        } catch (e) {
          setState({ status: "error", message: navigator.onLine ? errorMessage(e) : OFFLINE });
        }
      });
    }, delay);
    return () => clearTimeout(t);
  }, [json, enabled, delay, online]);

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
