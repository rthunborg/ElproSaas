"use client";

/**
 * Top-bar sign-out control (Story 2.1, Task 3.3).
 *
 * A minimal `"use client"` island: it calls `supabase.auth.signOut()` via the BROWSER
 * client (anon key only — never the service-role key; the containment guard enforces
 * this), which clears the auth cookies. It then navigates to `/login` and refreshes so
 * the server `(app)` layout re-resolves tenant context on the next request and the
 * protected boundary redirects an unauthenticated caller (AC3 round-trip).
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

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      // Navigate regardless: even if signOut errored, the server boundary re-validates
      // the (possibly already-cleared) session and redirects as needed.
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
    >
      {signingOut ? "Loggar ut…" : "Logga ut"}
    </button>
  );
}
