"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NotificationItem } from "@/server/notifications/read-model";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unread = items.filter((item) => !item.readAt).length;
  const load = async () => { const response = await fetch("/api/notifications", { cache: "no-store" }); if (response.ok) setItems((await response.json()).items); };
  useEffect(() => { void load(); }, []);
  const markAll = async () => { const previous = items; setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt: new Date().toISOString() })); const response = await fetch("/api/notifications/read-all", { method: "POST" }); if (!response.ok) setItems(previous); };
  const markRead = async (id: string) => { const previous = items; setItems((current) => current.map((item) => item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item)); const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" }); if (!response.ok) setItems(previous); };
  const count = unread > 9 ? "9+" : String(unread);
  return <div className="relative"><button type="button" aria-label={`Notiser, ${count} olästa notiser`} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-600">🔔<span className="sr-only"> {count} olästa notiser</span></button>{open && <div role="dialog" aria-label="Notiser" className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg"><div className="mb-2 flex items-center justify-between"><strong>Notiser</strong><button type="button" onClick={() => void markAll()} disabled={unread === 0} className="text-sm text-blue-700">Markera alla som lästa</button></div><ul className="space-y-2">{items.slice(0, 10).map((item) => <li key={item.id} className={item.readAt ? "text-zinc-600" : "font-medium"}><Link href={item.route} onClick={() => void markRead(item.id)}>{item.title}</Link><p className="text-sm">{item.body}</p></li>)}{items.length === 0 && <li>Inga olästa notiser</li>}</ul><Link href="/notifications" className="mt-3 block text-sm text-blue-700">Visa alla</Link></div>}</div>;
}
