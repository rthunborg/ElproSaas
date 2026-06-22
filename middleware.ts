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
 *   - FAIL OPEN for the refresh: a missing/misconfigured `NEXT_PUBLIC_SUPABASE_*` env var
 *     (`getSupabasePublicEnv` throws) or a transient network/SDK rejection in `getUser()`
 *     must NOT 500 every matched request (the matcher covers essentially every non-static
 *     route, including `/login` itself, so an unguarded throw would have no escape). On any
 *     error we fall back to the pass-through `NextResponse.next({ request })` and let the
 *     request proceed unrefreshed — the `(app)` server layout still enforces the boundary
 *     (and guards env/throw via its own try/catch). Failing open here only skips a
 *     best-effort token rotation; it never widens access, because middleware makes no authz
 *     decision.
 *   - Anon key only — never the service-role key (the containment guard scans this file).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/server/db/supabase-env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  try {
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
    // token and triggers the cookie refresh that the `setAll` above persists.
    await supabase.auth.getUser();

    return supabaseResponse;
  } catch {
    // FAIL OPEN for the refresh. Any throw (missing env var, network/SDK rejection) is
    // non-fatal: we return the pass-through response so the request proceeds unrefreshed,
    // rather than 500-ing every matched route. The `(app)` server layout remains the
    // authority and re-resolves (and guards) the session itself. We deliberately do NOT
    // deny or redirect here — handing the middleware an authz role it must not have.
    return NextResponse.next({ request });
  }
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
