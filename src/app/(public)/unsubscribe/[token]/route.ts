import { handleUnsubscribeRequest } from "@/server/email/unsubscribe";

function documentFor(state: "active" | "inactive" | "unsubscribed" | "limited") {
  if (state === "inactive") return '<!doctype html><main><h1>Länken är inte längre aktiv</h1></main>';
  if (state === "limited") return '<!doctype html><main><h1>E-postinställningar</h1><p role="alert">För många försök. Försök igen senare.</p></main>';
  if (state === "unsubscribed") return '<!doctype html><main><h1>E-postinställningar</h1><p role="status">Du är avregistrerad.</p><button>Återaktivera</button></main>';
  return '<!doctype html><main><h1>E-postinställningar</h1><form method="post"><button type="submit">Avregistrera</button></form></main>';
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A token's active state is deliberately not disclosed before an explicit POST.
  if (!/^[a-f0-9]{64}$/i.test(token)) return new Response(documentFor("inactive"), { headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response(documentFor("active"), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await handleUnsubscribeRequest({ token, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" });
  const state = result.status === 429 ? "limited" : result.body.state === "inactive" ? "inactive" : "unsubscribed";
  return new Response(documentFor(state), { status: result.status, headers: { "content-type": "text/html; charset=utf-8", ...result.headers } });
}
