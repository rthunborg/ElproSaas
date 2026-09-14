"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAuthEmailCallbackDestination } from "@/features/admin-users/auth-email-callback";
import { createSupabaseBrowserClient } from "@/server/db/supabase-browser-client";

/**
 * Supabase's implicit email links put their session in a URL fragment. Fragments
 * never reach a route handler, so this browser-only page must initialize the
 * public Auth client before the app chooses a destination.
 */
export default function CompleteAuthEmailCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifierar länken…");

  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const type = fragment.get("type");
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    const searchParams = new URLSearchParams(window.location.search);
    const destination = resolveAuthEmailCallbackDestination({
      type,
      membershipId: searchParams.get("membershipId"),
      attempt: searchParams.get("attempt"),
    });
    async function complete() {
      // `createBrowserClient` uses PKCE and therefore must not auto-read this
      // implicit-flow fragment. Keep credentials out of history before creating
      // the client, then let its public Auth API validate and persist the pair.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      if (!accessToken || !refreshToken) {
        setMessage("Länken kunde inte bekräftas. Begär en ny länk och försök igen.");
        return;
      }
      const auth = createSupabaseBrowserClient();
      const { data, error } = await auth.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      const verified = !error && data.session ? await auth.auth.getUser() : { data: { user: null }, error };
      if (!active) return;
      if (error || !data.session || verified.error || !verified.data.user) {
        setMessage("Länken kunde inte bekräftas. Begär en ny länk och försök igen.");
        return;
      }
      // Refresh first so the cookie persisted by the browser client is visible
      // to the server action/page that follows.
      router.refresh();
      router.replace(destination);
    }

    void complete();
    return () => { active = false; };
  }, [router]);

  return <main className="mx-auto max-w-md p-6"><p role="status">{message}</p></main>;
}
