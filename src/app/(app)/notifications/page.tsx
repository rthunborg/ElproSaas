import { readPersonalNotifications } from "@/server/notifications/read-model";
import { NotificationsCenter } from "@/components/notifications/NotificationsCenter";
import { EmailOutboxQueue } from "@/components/notifications/EmailOutboxQueue";
import { readEmailOutboxQueue } from "@/server/read-models/email-outbox";

export default async function NotificationsPage() {
  const [model, outbox] = await Promise.all([readPersonalNotifications(), readEmailOutboxQueue()]);
  return <><NotificationsCenter initialItems={model.items} unavailable={model.unavailable} scanStatus={model.scanStatus} />{!outbox.error && <EmailOutboxQueue items={outbox.data} />}</>;
}
