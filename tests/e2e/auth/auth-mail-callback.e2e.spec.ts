/**
 * Real local Auth-mail proof for Story 11.3's browser completion handoff.
 * Mailpit receives the provider mail; no callback URL or Auth token is logged.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminQuery } from "../../factories/admin-sql";
import {
  assertLocalStack,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
} from "../../support/test-env";

const MAILPIT_URL = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

// One-time links may contain credentials in fragments. Never retain them in a
// trace, including Playwright's retry trace.
test.use({ trace: "off" });

type MailMessage = { ID?: string; To?: Array<{ Address?: string }> };
type Fixture = { tenantA: { id: string }; adminA: { id: string } };

function fixture(): Fixture {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests", "e2e", ".auth", "fixture.json"), "utf8")) as Fixture;
}

function callbackUrl(testInfo: TestInfo): string {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Auth callback proof requires Playwright's configured base URL.");
  const base = new URL(baseURL);
  if (base.protocol !== "http:" || base.hostname !== "127.0.0.1" || !["3000", "3100"].includes(base.port)) {
    throw new Error("Auth callback proof requires a configured loopback 3000 or 3100 test host.");
  }
  return new URL("/auth/invite/confirm", base).toString();
}

function htmlDecoded(value: string): string {
  // Do not URL-decode the complete verification URL. Its `redirect_to` value
  // contains an encoded query; decoding it here changes its request shape.
  return value.replaceAll("&amp;", "&");
}

function stringsWithin(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsWithin);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsWithin);
  return [];
}

async function confirmationUrl(address: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`Mailpit list failed: ${response.status}`);
    const messages = (await response.json() as { messages?: MailMessage[] }).messages ?? [];
    const message = messages.find((item) => item.To?.some((to) => to.Address === address));
    if (message?.ID) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${encodeURIComponent(message.ID)}`, { signal: AbortSignal.timeout(2_000) });
      if (!detail.ok) throw new Error(`Mailpit detail failed: ${detail.status}`);
      for (const candidate of stringsWithin(await detail.json()).flatMap((text) => [text, htmlDecoded(text)])) {
        const match = candidate.match(/https?:[^"'\s<>]+/);
        if (match && htmlDecoded(match[0]).startsWith(`${LOCAL_SUPABASE_URL}/auth/v1/verify`)) return htmlDecoded(match[0]);
      }
      throw new Error("Mailpit receipt did not contain a Supabase Auth verification URL.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the local Auth receipt.");
}

function pathname(pageUrl: string): string {
  return new URL(pageUrl).pathname;
}

type SafeCallbackRequest = { origin: string; pathname: string; queryKeys: string[] };

function observeCallbackRequests(page: Page): SafeCallbackRequest[] {
  const observed: SafeCallbackRequest[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/verify" || url.pathname.startsWith("/auth/invite/")) {
      observed.push({ origin: url.origin, pathname: url.pathname, queryKeys: [...url.searchParams.keys()].sort() });
    }
  });
  return observed;
}

test("[P0] local Auth invitation establishes a session then activates the matching membership", async ({ page }, testInfo) => {
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") throw new Error("Set SUPABASE_TEST_REQUIRED=1: callback evidence must not silently skip.");
  assertLocalStack();
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(MAILPIT_URL)) throw new Error("Mail proof must use a loopback SMTP sink.");

  const marker = randomUUID();
  const email = `auth-callback-invite-${marker}@example.test`;
  const membershipId = randomUUID();
  const attempt = randomUUID().replaceAll("-", "");
  const auth = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  let userId: string | undefined;
  try {
    const requests = observeCallbackRequests(page);
    const base = fixture();
    await adminQuery(
      `insert into public.tenant_memberships (id, tenant_id, role, status, invited_email, invited_at, invitation_expires_at)
       values ($1, $2, 'montor', 'invited', $3, statement_timestamp(), statement_timestamp() + interval '1 hour')`,
      [membershipId, base.tenantA.id, email],
    );
    await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'montor')",
      [base.tenantA.id, membershipId],
    );
    await adminQuery(
      `insert into public.membership_admin_operations
         (id, tenant_id, actor_user_id, membership_id, action, outcome, invitation_token_hash, invitation_expires_at, completed_at)
       values ($1, $2, $3, $4, 'invite', 'succeeded', $5, statement_timestamp() + interval '1 hour', statement_timestamp())`,
      [randomUUID(), base.tenantA.id, base.adminA.id, membershipId, createHash("sha256").update(attempt).digest("hex")],
    );
    const invite = await auth.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${callbackUrl(testInfo)}?membershipId=${encodeURIComponent(membershipId)}&attempt=${encodeURIComponent(attempt)}`,
    });
    if (invite.error || !invite.data.user) throw new Error(`Local Auth invite failed: ${invite.error?.message ?? "no user"}`);
    userId = invite.data.user.id;

    await page.goto(await confirmationUrl(email));
    await expect.poll(() => pathname(page.url())).toBe("/invite/accept");
    // The assertion intentionally retains only request origins, paths, and
    // parameter names; callback values include one-time credentials.
    expect(requests).toContainEqual({
      origin: callbackUrl(testInfo).slice(0, callbackUrl(testInfo).indexOf("/auth/")),
      pathname: "/auth/invite/confirm",
      queryKeys: ["attempt", "membershipId"],
    });
    expect(requests).toContainEqual({
      origin: callbackUrl(testInfo).slice(0, callbackUrl(testInfo).indexOf("/auth/")),
      pathname: "/auth/invite/complete",
      queryKeys: ["attempt", "membershipId"],
    });
    await expect(page.getByRole("heading", { name: "Bekräfta inbjudan" })).toBeVisible();
    await page.getByRole("button", { name: "Aktivera åtkomst" }).click();
    await expect(page.getByRole("status")).toHaveText("Åtkomsten är aktiverad.");
    const [membership] = await adminQuery<{ user_id: string | null; status: string }>(
      "select user_id, status from public.tenant_memberships where id = $1",
      [membershipId],
    );
    expect(membership).toEqual({ user_id: userId, status: "active" });
  } finally {
    if (userId) await auth.auth.admin.deleteUser(userId);
  }
});

test("[P0] local Auth recovery email establishes a recovery session and persists the new password", async ({ page }, testInfo) => {
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") throw new Error("Set SUPABASE_TEST_REQUIRED=1: callback evidence must not silently skip.");
  assertLocalStack();
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(MAILPIT_URL)) throw new Error("Mail proof must use a loopback SMTP sink.");

  const marker = randomUUID();
  const email = `auth-callback-recovery-${marker}@example.test`;
  const updatedPassword = `Updated-${marker}-Aa1!`;
  const auth = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  let userId: string | undefined;
  try {
    const created = await auth.auth.admin.createUser({ email, password: `Initial-${marker}-Aa1!`, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Local Auth user setup failed: ${created.error?.message ?? "no user"}`);
    userId = created.data.user.id;
    const reset = await auth.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl(testInfo) });
    if (reset.error) throw new Error(`Local Auth reset failed: ${reset.error.message}`);

    await page.context().clearCookies();
    await page.goto(await confirmationUrl(email));
    await expect.poll(() => pathname(page.url())).toBe("/password/update");
    await page.getByLabel("New password").fill(updatedPassword);
    await page.getByLabel("Confirm password").fill(updatedPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toHaveText("Your password has been updated. You can now continue to the app.");

    const verifier = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const verified = await verifier.auth.signInWithPassword({ email, password: updatedPassword });
    expect(verified.error).toBeNull();
    expect(verified.data.user?.id).toBe(userId);
  } finally {
    if (userId) await auth.auth.admin.deleteUser(userId);
  }
});
