"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { NotificationItem, NotificationScanStatus } from "@/server/notifications/read-model";
import { filterNotificationItems, formatNotificationScanStatus, sortLatestNotificationItems } from "./notification-presentation";

export function NotificationsCenter({ initialItems, unavailable, scanStatus }: { initialItems: NotificationItem[]; unavailable: boolean; scanStatus: NotificationScanStatus }) {
  const [items, setItems] = useState(initialItems);
  const [read, setRead] = useState("all");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const acknowledgementInFlight = useRef(false);
  const router = useRouter();
  const rows = useMemo(() => filterNotificationItems(sortLatestNotificationItems(items), { moduleOrCategory: category, readState: read as "all" | "unread" | "read", fromDate: from }), [items, category, read, from]);
  const statusCopy = formatNotificationScanStatus(scanStatus);
  const reload = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load notifications");
    const model = await response.json();
    setItems(model.items);
  }, []);
  const mark = async (id: string): Promise<boolean> => {
    if (acknowledgementInFlight.current) return false;
    acknowledgementInFlight.current = true;
    setError(null);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error("Could not acknowledge notification");
      return true;
    } catch {
      try { await reload(); } catch { /* Preserve the current optimistic state when persisted truth is unavailable. */ }
      setError("Kunde inte markera notisen som läst. Försök igen.");
      return false;
    } finally {
      acknowledgementInFlight.current = false;
    }
  };
  return <section><h1 className="text-2xl font-semibold">Notiser</h1>{unavailable ? <p role="alert">Notiser kunde inte hämtas. Försök igen.</p> : <>{statusCopy && <p role="status">{statusCopy}</p>}<label className="block mt-4">Modul eller kategori<select aria-label="Modul eller kategori" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Alla</option><option value="quotes">Offerter</option><option value="quote.follow_up_due">Förfallen uppföljning</option></select></label><label className="block mt-2">Lässtatus<select aria-label="Lässtatus" value={read} onChange={(event) => setRead(event.target.value)}><option value="all">Alla</option><option value="unread">Olästa</option><option value="read">Lästa</option></select></label><label className="block mt-2">Från datum<input aria-label="Från datum" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<ul className="mt-4 space-y-3">{rows.map((item) => <li key={item.id} aria-label={item.readAt ? "läst" : "oläst"} className="rounded border p-3"><Link href={item.route} onClick={async (event) => { event.preventDefault(); if (await mark(item.id)) router.push(item.route); }}>{item.title}</Link><p>{item.body}</p>{!item.readAt && <button type="button" onClick={() => void mark(item.id)}>Markera som läst</button>}</li>)}{rows.length === 0 && <li>Du har inga notiser ännu</li>}</ul></>}</section>;
}
