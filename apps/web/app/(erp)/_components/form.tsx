"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "@mrac/ui/components/sonner";
import { Button } from "@mrac/ui/components/button";
import { Checkbox } from "@mrac/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Textarea } from "@mrac/ui/components/textarea";
import { cn } from "@mrac/ui/lib/utils";

/** FormData → plain object. Checkboxes become booleans; repeated names become arrays. */
export function formToObject(form: HTMLFormElement) {
  const out: Record<string, unknown> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") {
      if (el.dataset.multi) {
        const arr = (out[el.name] as string[] | undefined) ?? [];
        if (el.checked) arr.push(el.value);
        out[el.name] = arr;
      } else out[el.name] = el.checked;
    } else if (el.type === "radio") {
      if (el.checked) out[el.name] = el.value;
    } else if (el.value !== "") out[el.name] = el.value;
  }
  return out;
}

export function errorMessage(e: unknown) {
  const err = e as { message?: string; data?: { zodError?: { fieldErrors?: Record<string, string[]> } } };
  const fe = err?.data?.zodError?.fieldErrors;
  if (fe) {
    const first = Object.entries(fe).find(([, v]) => v?.length);
    if (first) return `${first[0]}: ${first[1]![0]}`;
  }
  return err?.message ?? "Something went wrong.";
}

/**
 * Dialog wrapping a native form. `onSubmit` gets the form values; throw to keep the dialog
 * open (the error is shown inline and as a toast).
 */
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel = "Save",
  destructive,
  wide,
  onSubmit,
  children,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  submitLabel?: string;
  destructive?: boolean;
  wide?: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<unknown>;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // the dialog is portalled, but React still bubbles submit to an enclosing form (e.g. ⊕ Referral inside Add Quote)
    e.stopPropagation();
    setPending(true);
    setError(null);
    try {
      await onSubmit(formToObject(e.currentTarget));
      toast.success(`${title} — saved`);
      setOpen(false);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn(wide && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className={cn("grid gap-3", wide && "sm:grid-cols-2")}>{children}</div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = { label: string; name: string; required?: boolean; hint?: string; className?: string; full?: boolean };

/** Field-level server errors (zod fieldErrors), keyed by input name. */
export const FormErrorsContext = React.createContext<Record<string, string[] | undefined>>({});

export function fieldErrorsOf(e: unknown): Record<string, string[] | undefined> {
  return (e as { data?: { zodError?: { fieldErrors?: Record<string, string[]> } } })?.data?.zodError?.fieldErrors ?? {};
}

/** Label + control + error/hint for a controlled input. `errorKey` reads a differently keyed error (e.g. "customer.firstName"). */
export function FieldShell({ label, name, required, hint, className, full, errorKey, children }: FieldProps & { errorKey?: string; children: React.ReactNode }) {
  const error = React.useContext(FormErrorsContext)[errorKey ?? name]?.[0];
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2", className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** aria-invalid for inputs inside a FormErrorsContext. */
function useInvalid(name: string) {
  const error = React.useContext(FormErrorsContext)[name]?.[0];
  return error ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};
}

export function Field({
  label,
  name,
  required,
  hint,
  className,
  full,
  inputClassName,
  ...input
}: FieldProps & Omit<React.ComponentProps<"input">, "name"> & { inputClassName?: string }) {
  return (
    <FieldShell {...{ label, name, required, hint, className, full }}>
      <Input id={name} name={name} required={required} className={inputClassName} {...useInvalid(name)} {...input} />
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  required,
  hint,
  className,
  full = true,
  ...rest
}: FieldProps & Omit<React.ComponentProps<"textarea">, "name">) {
  return (
    <FieldShell {...{ label, name, required, hint, className, full }}>
      <Textarea id={name} name={name} required={required} {...useInvalid(name)} {...rest} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  required,
  hint,
  className,
  full,
  options,
  placeholder = "Please select",
  ...rest
}: FieldProps &
  Omit<React.ComponentProps<"select">, "name"> & {
    options: ({ value: string; label: string } | string)[];
    placeholder?: string | false;
  }) {
  return (
    <FieldShell {...{ label, name, required, hint, className, full }}>
      <NativeSelect id={name} name={name} required={required} {...useInvalid(name)} {...rest}>
        {placeholder !== false && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </NativeSelect>
    </FieldShell>
  );
}

export function CheckField({ label, name, className, ...rest }: { label: string; name: string; className?: string } & Omit<React.ComponentProps<"input">, "name" | "type">) {
  return (
    <label className={cn("flex items-center gap-2 text-sm", className)}>
      <Checkbox name={name} {...rest} />
      {label}
    </label>
  );
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: "AMEX", label: "Amex" },
  { value: "CASH", label: "Cash" },
  { value: "DEBIT", label: "Debit" },
  { value: "EMT", label: "EMT (e-Transfer)" },
  { value: "INTERNAL", label: "Internal" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "VISA", label: "Visa" },
];
