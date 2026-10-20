import * as React from "react";

export default function AdminAppLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#D5D5D5]/60 pb-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-[#D5D5D5]/60" />
          <div className="h-4 w-72 rounded bg-[#D5D5D5]/40" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded bg-[#D5D5D5]/60" />
          <div className="h-9 w-28 rounded bg-primary/30" />
        </div>
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="rounded-lg border border-[#D5D5D5] bg-white/80 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-9 rounded bg-[#E9E3D5]/70" />
          <div className="h-9 rounded bg-[#E9E3D5]/70" />
          <div className="h-9 rounded bg-[#E9E3D5]/70" />
          <div className="h-9 rounded bg-primary/40" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg border border-[#D5D5D5] bg-white overflow-hidden shadow-xs">
        <div className="h-10 border-b border-[#D5D5D5] bg-[#F4EFE6]/70 px-4 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-[#D5D5D5]/60" />
          <div className="h-4 w-20 rounded bg-[#D5D5D5]/60" />
          <div className="h-4 w-28 rounded bg-[#D5D5D5]/60" />
          <div className="h-4 w-16 rounded bg-[#D5D5D5]/60" />
        </div>
        <div className="divide-y divide-[#D5D5D5]/50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 px-4 flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-[#D5D5D5]/40" />
              <div className="h-4 w-24 rounded bg-[#D5D5D5]/30" />
              <div className="h-4 w-36 rounded bg-[#D5D5D5]/40" />
              <div className="h-6 w-20 rounded-full bg-forest-moss/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
