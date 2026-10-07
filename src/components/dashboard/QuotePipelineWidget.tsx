"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatOreAsKronor } from "@/lib/money";
import type { DashboardDescriptor } from "@/server/read-models/dashboard";
import { WidgetCard } from "./WidgetCard";

export interface QuotePipelineWidgetProps {
  readonly state: "loading" | "loaded" | "empty" | "error";
  readonly descriptor?: DashboardDescriptor;
  readonly completedAt?: string;
  readonly onRetry?: () => void;
}
function MaskedValue() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const stop = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      setOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);
  return <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-label="Dolt för din roll" aria-describedby={open ? id : undefined} aria-expanded={open}
      title="Din roll ser inte belopp" onClick={() => setOpen(true)}
      onBlur={() => { stop(); setOpen(false); }}
      onPointerDown={() => { stop(); timer.current = setTimeout(() => setOpen(true), 450); }}
      onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
      onFocus={() => setOpen(true)}
      className="inline-flex min-h-11 items-center gap-2 rounded text-base focus-visible:outline-2 focus-visible:outline-offset-2">
      <span aria-hidden="true">🔒</span><span>Dold</span><span className="sr-only">Dolt för din roll</span>
    </button>
    {open && <span id={id} role="tooltip" aria-label="Din roll ser inte belopp" className="absolute bottom-full left-0 z-10 w-48 rounded bg-zinc-900 p-2 text-xs text-white">Din roll ser inte belopp</span>}
  </span>;
}

/** Presentation consumes projected data and never role names or entitlement overrides. */
export function QuotePipelineWidget({ state, descriptor, completedAt, onRetry }: QuotePipelineWidgetProps) {
  if (state === "loading") return <WidgetCard title="Offertpipeline" href="/quotes" busy>
    <div role="status" aria-live="polite" aria-busy="true" className="min-h-48">
      <span className="sr-only">Läser offertpipeline</span>
      <div aria-hidden="true" className="h-5 w-48 rounded bg-zinc-100" />
      <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {[1, 2, 3].map(key => <div key={key} className="h-20 rounded bg-zinc-100" />)}
      </div>
    </div>
  </WidgetCard>;
  if (state === "error" || !descriptor || !completedAt) return <WidgetCard title="Offertpipeline" href="/quotes">
    <div role="alert"><p className="text-sm text-zinc-700">Kunde inte läsa offertpipeline</p></div>
    <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded border border-zinc-300 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Försök igen</button>
  </WidgetCard>;
  const { data, entitlements } = descriptor;
  const empty = data.sentCount === 0 && data.acceptedCount === 0 && data.lostCount === 0;
  return <WidgetCard title="Offertpipeline" href="/quotes">
    <div aria-live="polite" role="status">
      <p className="text-sm text-zinc-600">Period: {data.period.from} – {data.period.to}</p>
      {empty && <p className="mt-4 text-sm text-zinc-700">Inga offerthändelser under perioden</p>}
      <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {[["Skickade", data.sentCount], ["Accepterade", data.acceptedCount], ["Förlorade", data.lostCount]].map(([label, count]) =>
          <div key={label}><dt className="text-sm text-zinc-600">{label}</dt><dd aria-label={String(label)} className="mt-1 text-2xl font-semibold text-zinc-900">{count}</dd></div>)}
        <div><dt className="text-sm text-zinc-600">Träffgrad</dt><dd aria-label="Träffgrad" className="mt-1 text-base font-semibold text-zinc-900">
          {data.hitRate === null ? "Ingen träffgrad ännu" : new Intl.NumberFormat("sv-SE", { style: "percent", maximumFractionDigits: 1 }).format(data.hitRate)}
        </dd></div>
        <div className="col-span-2 min-w-0 sm:col-span-1"><dt className="text-sm text-zinc-600">Accepterat värde</dt><dd aria-label="Accepterat värde" className="mt-1 break-words text-base font-semibold text-zinc-900">
          {entitlements.withheld.includes("acceptedValueOre") ? <MaskedValue /> : data.acceptedValueOre !== undefined ? formatOreAsKronor(data.acceptedValueOre) + " kr" : "Kunde inte läsa offertpipeline"}
        </dd></div>
      </dl>
      <p className="mt-4 text-xs text-zinc-600">Accepterade / (accepterade + förlorade)</p>
      <p className="mt-3 text-xs text-zinc-600">Hämtad <time dateTime={completedAt}>{new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(completedAt))}</time></p>
    </div>
  </WidgetCard>;
}
