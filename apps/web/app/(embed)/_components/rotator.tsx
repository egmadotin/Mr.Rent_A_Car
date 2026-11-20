"use client";

/* eslint-disable @next/next/no-img-element -- class photos are static files / storage URLs */
import * as React from "react";

type Slide = { id: string; name: string; image: string; description: string | null; seats: number | null; from: string | null };

/**
 * The vehicle rotator (RentCentric WebCustomer/Rotator.aspx): the classes offered online, one at a time; a click opens
 * the website's booking for that class in the Target chosen in Settings > Widget/Rotator Setup.
 */
export function Rotator({ slides, href, target }: { slides: Slide[]; href: string; target: string }) {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  if (!slides.length) return <p className="p-4 text-sm text-muted-foreground">No vehicles online right now.</p>;
  const s = slides[i]!;
  return (
    <div className="p-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <a href={href} target={target} rel={target === "_blank" ? "noopener" : undefined} className="block rounded-sheet border bg-card p-3 text-center hover:shadow">
        <img src={s.image} alt={s.name} className="mx-auto h-36 w-full object-contain" />
        <div className="mt-2 text-base font-semibold">{s.name}</div>
        {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
        <div className="mt-1 text-sm">
          {s.seats ? `${s.seats} seats` : ""}
          {s.from ? <span className="ml-2 font-semibold">from ${s.from}/day</span> : null}
        </div>
        <span className="mt-2 inline-block rounded-pill bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Book now</span>
      </a>
      <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label="Vehicles">
        {slides.map((x, k) => (
          <button key={x.id} type="button" role="tab" aria-selected={k === i} aria-label={x.name} onClick={() => setI(k)} className={`size-2 rounded-full ${k === i ? "bg-primary" : "bg-muted-foreground/30"}`} />
        ))}
      </div>
    </div>
  );
}
