/**
 * Controlled local Supabase Auth transport proof for Epic 11 R-1109.
 * It sends a real Auth invite and recovery email to the local Mailpit sink,
 * then verifies that each rendered email contains the configured callback route.
 * It never contacts a hosted Supabase project or an external mailbox.
 */
import { createClient } from "@supabase/supabase-js";
import { assertLocalStack, isLocalStackReachable, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../tests/support/test-env";

const MAILPIT_URL = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";
const CALLBACK = "http://127.0.0.1:3000/auth/invite/confirm";
const POLL_TIMEOUT_MS = 15_000;
const CONTEXT_MARKERS = { nfrContextA: "alpha", nfrContextB: "bravo" } as const;

type MailMessage = { ID?: string; To?: Array<{ Address?: string }> };

function assertLocalMailpit(): void {
  let endpoint: URL;
  try {
    endpoint = new URL(MAILPIT_URL);
  } catch {
    throw new Error("SUPABASE_TEST_MAILPIT_URL must be a valid loopback HTTP URL.");
  }
  const loopback = endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost" || endpoint.hostname === "::1";
  if (endpoint.protocol !== "http:" || !loopback || endpoint.username || endpoint.password) {
    throw new Error("SUPABASE_TEST_MAILPIT_URL must be an unauthenticated loopback HTTP URL.");
  }
}

function stringsWithin(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsWithin);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsWithin);
  return [];
}

function decodeHtmlEntities(value: string): string {
  // The confirmation URL contains a nested, percent-encoded redirect URL. Do
  // not decode percent escapes here: doing so promotes nested query parameters
  // into the outer Auth verification URL and changes what the browser receives.
  return value.replaceAll("&amp;", "&");
}

async function messages(): Promise<MailMessage[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error(`Mailpit list failed: ${response.status}`);
  const body = await response.json() as { messages?: MailMessage[] };
  return body.messages ?? [];
}

async function confirmationUrl(address: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const message = (await messages()).find((item) => item.To?.some((to) => to.Address === address));
    if (message?.ID) {
      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${encodeURIComponent(message.ID)}`, { signal: AbortSignal.timeout(2_000) });
      if (!response.ok) throw new Error(`Mailpit detail failed: ${response.status}`);
      const candidates = stringsWithin(await response.json()).flatMap((text) => [text, decodeHtmlEntities(text)]);
      for (const candidate of candidates) {
        const match = candidate.match(/https?:[^"'\s<>]+/);
        if (match && decodeHtmlEntities(match[0]).startsWith(`${LOCAL_SUPABASE_URL}/auth/v1/verify`)) return decodeHtmlEntities(match[0]);
      }
      throw new Error("Mailpit receipt did not contain a Supabase Auth verification URL.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for a Mailpit receipt for ${address}.`);
}

type RedirectObservation = Readonly<{ status: number; origin: string; pathname: string; hasFragment: boolean }>;

async function verifyAuthRedirect(url: string, marker: string): Promise<RedirectObservation> {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
  const location = response.headers.get("location");
  if (response.status < 300 || response.status >= 400 || !location) throw new Error("Supabase Auth verification URL did not redirect.");
  const target = decodeHtmlEntities(location);
  const parsed = new URL(target);
  const expected = new URL(CALLBACK);
  if (
    parsed.origin !== expected.origin
    || parsed.pathname !== expected.pathname
    || parsed.searchParams.get("nfrSmoke") !== marker
    || parsed.searchParams.get("nfrContextA") !== CONTEXT_MARKERS.nfrContextA
    || parsed.searchParams.get("nfrContextB") !== CONTEXT_MARKERS.nfrContextB
  ) {
    throw new Error("Supabase Auth redirect did not preserve the configured callback context.");
  }
  // Return only non-secret redirect facts. A hash can carry an Auth token, so it
  // is never emitted; whether it exists distinguishes server-readable query
  // callbacks from implicit client-side callbacks.
  return { status: response.status, origin: parsed.origin, pathname: parsed.pathname, hasFragment: parsed.hash.length > 0 };
}

async function main(): Promise<void> {
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") throw new Error("Set SUPABASE_TEST_REQUIRED=1: this smoke must not silently skip.");
  assertLocalStack();
  assertLocalMailpit();
  if (!(await isLocalStackReachable())) throw new Error("Local Supabase Auth is unreachable.");
  const marker = crypto.randomUUID();
  const inviteEmail = `nfr-11-invite-${marker}@example.test`;
  const recoveryEmail = `nfr-11-recovery-${marker}@example.test`;
  const auth = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const redirect = new URL(CALLBACK);
  redirect.searchParams.set("nfrSmoke", marker);
  for (const [key, value] of Object.entries(CONTEXT_MARKERS)) redirect.searchParams.set(key, value);
  const redirectTo = redirect.toString();
  const createdIds: string[] = [];
  try {
    const invite = await auth.auth.admin.inviteUserByEmail(inviteEmail, { redirectTo });
    if (invite.error) throw new Error(`Auth invite call failed: ${invite.error.message}`);
    if (invite.data.user?.id) createdIds.push(invite.data.user.id);
    const invitedUrl = await confirmationUrl(inviteEmail);
    if (!invitedUrl.includes(marker)) throw new Error("Invite receipt does not carry the smoke marker.");
    const inviteRedirect = await verifyAuthRedirect(invitedUrl, marker);

    const recovery = await auth.auth.admin.createUser({ email: recoveryEmail, password: `Nfr-${marker}-Aa1!`, email_confirm: true });
    if (recovery.error || !recovery.data.user) throw new Error(`Recovery fixture creation failed: ${recovery.error?.message ?? "no user"}`);
    createdIds.push(recovery.data.user.id);
    const reset = await auth.auth.resetPasswordForEmail(recoveryEmail, { redirectTo });
    if (reset.error) throw new Error(`Auth recovery call failed: ${reset.error.message}`);
    const recoveryUrl = await confirmationUrl(recoveryEmail);
    if (!recoveryUrl.includes(marker)) throw new Error("Recovery receipt does not carry the smoke marker.");
    const recoveryRedirect = await verifyAuthRedirect(recoveryUrl, marker);
    console.log(JSON.stringify({ status: "passed", target: "local Supabase Auth to Mailpit", flows: ["invite", "recovery"], authRedirects: { invite: inviteRedirect, recovery: recoveryRedirect }, appCallbackConsumed: false }));
  } finally {
    for (const id of createdIds) {
      const { error } = await auth.auth.admin.deleteUser(id);
      if (error) console.warn(`mail smoke cleanup could not remove ${id}: ${error.message}`);
    }
  }
}

await main();
