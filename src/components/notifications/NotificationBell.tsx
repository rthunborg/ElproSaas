"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/server/notifications/read-model";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const unread = items.filter((item) => !item.readAt).length;
  const count = unread > 9 ? "9+" : String(unread);
  const accessibleName = unread === 0 ? "Notiser" : `Notiser, ${count} olästa notiser`;

  useEffect(() => {
    void fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load notifications");
        return response.json();
      })
      .then((model) => setItems(model.items))
      .catch(() => setError("Notiser kunde inte hämtas. Försök igen."));
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      bellRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const markAll = async () => {
    const previous = items;
    setError(null);
    setItems((current) => current.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() })));
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) throw new Error("Could not acknowledge notifications");
    } catch { setItems(previous); setError("Kunde inte markera notiser som lästa. Försök igen."); }
  };
  const markRead = async (id: string): Promise<boolean> => {
    const previous = items;
    setError(null);
    setItems((current) => current.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item)));
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error("Could not acknowledge notification");
      return true;
    } catch {
      setItems(previous);
      setError("Kunde inte markera notisen som läst. Försök igen.");
      return false;
    }
  };

  return <div className="relative"><button ref={bellRef} type="button" aria-label={accessibleName} aria-expanded={open} onClick={() => setOpen((current) => !current)} className="rounded-md p-2 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-600">🔔<span className="sr-only">{unread === 0 ? "" : ` ${count} olästa notiser`}</span></button>{open && <div role="dialog" aria-label="Notiser" className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg"><div className="mb-2 flex items-center justify-between"><strong>Notiser</strong><button type="button" onClick={() => void markAll()} disabled={unread === 0} className="text-sm text-blue-700">Markera alla som lästa</button></div>{error && <p role="alert">{error}</p>}<ul className="space-y-2">{items.slice(0, 10).map((item) => <li key={item.id} aria-label={item.readAt ? "läst" : "oläst"} className={item.readAt ? "text-zinc-600" : "font-medium"}><Link href={item.route} onClick={async (event) => { event.preventDefault(); if (await markRead(item.id)) router.push(item.route); }}>{item.title}</Link><p className="text-sm">{item.body}</p></li>)}{(items.length === 0 || unread === 0) && <li>Inga olästa notiser</li>}</ul><Link href="/notifications" className="mt-3 block text-sm text-blue-700">Visa alla</Link></div>}</div>;
}
