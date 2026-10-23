export default function AdminAppLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-control bg-muted" />
          <div className="h-4 w-72 rounded-control bg-muted/70" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded-control bg-muted" />
          <div className="h-9 w-28 rounded-control bg-muted" />
        </div>
      </div>
      <div className="rounded-card border bg-card p-3">
        <div className="flex gap-3">
          <div className="h-9 w-36 rounded-control bg-muted" />
          <div className="h-9 flex-1 rounded-control bg-muted/70" />
          <div className="h-9 w-24 rounded-control bg-muted" />
        </div>
      </div>
      <div className="overflow-hidden rounded-card border bg-card">
        <div className="flex h-10 items-center gap-8 border-b bg-muted/60 px-4">
          {[24, 20, 28, 16].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="divide-y">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex h-12 items-center justify-between px-4">
              <div className="h-4 w-32 rounded bg-muted/80" />
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-4 w-36 rounded bg-muted/80" />
              <div className="h-6 w-20 rounded-pill bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
