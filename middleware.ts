/**
 * Root Next.js middleware — Supabase session refresh (Story 2.1 review fix).
 *
 * `@supabase/ssr` on the App Router relies on middleware to ROTATE expiring auth tokens
 * before any Server Component / server layout runs. A Server Component cookie store is
 * read-only (`supabase-server-client.ts setAll` is a deliberate no-op there), so without a
 * writable middleware context an active session's access token would expire mid-session
 * and the protected `(app)` layout would re-resolve it as UNAUTHENTICATED and bounce the
 * user to `/login` with no auto-recover.
 *
 * This is the canonical `@supabase/ssr` `updateSession` pattern: create a request-bound
 * server client in the WRITABLE middleware context, call `supabase.auth.getUser()` to
 * trigger a refresh when the token is near expiry, and write the rotated cookies back onto
 * the response so they are visible to the downstream Server Components on the SAME request.
 *
 * IMPORTANT (canonical pattern caveats):
 *   - Do NOT run code between `createServerClient` and `supabase.auth.getUser()`, and
 *     always return the `supabaseResponse` object as-is (re-create it via `NextResponse.next`
 *     when constructing a redirect) so the refreshed cookies are never dropped.
 *   - This middleware makes NO authorization decision — the `(app)` server layout remains
 *     the tenant-context authority (`resolveTenantContext`). Middleware only refreshes the
 *     session; it never widens access.
 *   - Anon key only — never the service-role key (the containment guard scans this file).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write rotated cookies back onto BOTH the request (so a downstream read in this
        // same pass sees them) and the response (so they reach the browser). Canonical
        // @supabase/ssr middleware pattern.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Do not insert logic between client creation and getUser(): getUser() re-validates the
  // token and triggers the cookie refresh that the `setAll` above persists. Errors here are
  // non-fatal — an unauthenticated request simply has no session to refresh, and the
  // protected layout still enforces the boundary.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  /**
   * Run on all request paths EXCEPT static assets and image-optimization files, per the
   * canonical pattern. Keeping the session-refresh off static assets avoids needless work;
   * the protected routes (which need a fresh session) are all covered.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
