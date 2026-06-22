/**
 * Per-request server Supabase client factory (App Router).
 *
 * Created fresh per request inside Server Components / Route Handlers / Server Actions
 * using Next's async `cookies()` (Next 16: `cookies()` returns a Promise — it is awaited
 * here). NEVER share a server client across requests (architecture §6; @supabase/ssr SSR
 * guide). It is cookie-bound so `supabase.auth.getClaims()` / `getUser()` can re-validate
 * the caller's JWT server-side; the authorization decision is made there, not from
 * `getSession()` (which is not guaranteed to re-validate — architecture §5 step 1).
 *
 * Uses the v0.6+ cookie API (`getAll` / `setAll`); the removed single-cookie
 * `get`/`set`/`remove` API would break. Anon key only — no service-role key here.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./supabase-env";

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // `setAll` runs after a token refresh to write rotated auth cookies. In a Server
        // Component the cookie store is read-only and `.set` throws; that is expected and
        // safe to ignore here because middleware/route handlers refresh the session in a
        // writable context. (Canonical @supabase/ssr Next.js pattern.)
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Read-only cookie context (Server Component) — ignore.
        }
      },
    },
  });
}
