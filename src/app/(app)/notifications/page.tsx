import { readPersonalNotifications } from "@/server/notifications/read-model";
import { NotificationsCenter } from "@/components/notifications/NotificationsCenter";

export default async function NotificationsPage() { const model = await readPersonalNotifications(); return <NotificationsCenter initialItems={model.items} unavailable={model.unavailable} scanStatus={model.scanStatus} />; }
