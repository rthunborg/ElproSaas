"use client";

/**
 * Top-bar sign-out control (Story 2.1, Task 3.3).
 *
 * A minimal `"use client"` island: it calls `supabase.auth.signOut()` via the BROWSER
 * client (anon key only — never the service-role key; the containment guard enforces
 * this), which clears the auth cookies. ONLY on a successful sign-out does it refresh and
 * navigate to `/login` so the server `(app)` layout re-resolves tenant context on the next
 * request and the protected boundary redirects an unauthenticated caller (AC3 round-trip).
 *
 * A FAILED `signOut()` (e.g. network down) does NOT clear the cookie, so we must NOT
 * navigate — the still-valid cookie would make the server boundary immediately redirect
 * back to `/dashboard`, a "logged out but still logged in" redirect loop (review fix). On
 * failure we surface an error and stay put so the user can retry.
 *
 * Authorization stays server-side: this control only ends the session; the server layout
 * is the authority. Scope is intentionally minimal — just enough to make the
 * login/logout loop testable (Story 2.1 Task 3.3).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/server/db/supabase-browser-client";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        // Sign-out failed — the cookie was NOT cleared. Do NOT navigate (a navigation with a
        // still-valid cookie would just bounce straight back). Surface a retry prompt.
        setError("Utloggningen misslyckades. Försök igen.");
        setSigningOut(false);
        return;
      }

      // Success: cookie cleared. Refresh FIRST so the cleared session is server-visible,
      // THEN navigate (canonical @supabase/ssr order — avoids a stale-cookie flash).
      router.refresh();
      router.replace("/login");
    } catch {
      // A thrown error means the session state is unknown / not cleared — same rule: do not
      // navigate, let the user retry.
      setError("Utloggningen misslyckades. Försök igen.");
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
      >
        {signingOut ? "Loggar ut…" : "Logga ut"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
