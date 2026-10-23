import { LockIcon } from "lucide-react";

/** Shown instead of a screen the signed-in staff member has no permission for. */
export function NoAccess({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
      <span className="rounded-full bg-muted p-3 text-muted-foreground"><LockIcon className="size-6" /></span>
      <h2 className="tracking-tight text-xl font-bold">No access</h2>
      <p className="max-w-md text-sm text-muted-foreground">You don&apos;t have permission to {what}. Ask an admin to give it to you in Settings › Users.</p>
    </div>
  );
}
