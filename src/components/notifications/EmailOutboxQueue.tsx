import type { EmailOutboxQueueItem } from "@/server/read-models/email-outbox";

const LABELS: Record<EmailOutboxQueueItem["state"], string> = { queued: "Köad", retry: "Försök igen", failed: "Misslyckad", suppressed: "Undertryckt", cancelled: "Avbruten" };
export function EmailOutboxQueue({ items }: { readonly items: readonly EmailOutboxQueueItem[] }) {
  return <section data-testid="email-outbox-queue" className="mt-8"><h2 className="text-xl font-semibold">E-postutkö</h2><table><thead><tr><th>Referens</th><th>Status</th><th>Försök</th><th>Nästa försök</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.reference}</td><td>{item.state === "failed" ? "Misslyckad — kunde inte levereras" : LABELS[item.state]}</td><td>{item.attempts}</td><td>{item.nextAttemptAt ? `Nästa försök: ${new Date(item.nextAttemptAt).toLocaleString("sv-SE")}` : "—"}</td></tr>)}{items.length === 0 && <tr><td colSpan={4}>Inga e-postmeddelanden i kön.</td></tr>}</tbody></table></section>;
}
