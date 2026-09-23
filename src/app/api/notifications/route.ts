import { NextResponse } from "next/server";
import { readPersonalNotifications } from "@/server/notifications/read-model";

export async function GET() {
  const model = await readPersonalNotifications();
  return NextResponse.json(model, { status: model.unavailable ? 403 : 200 });
}
