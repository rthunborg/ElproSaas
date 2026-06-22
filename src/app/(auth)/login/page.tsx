"use client";

/**
 * `/login` — Supabase Auth entry (architecture §4 route table: `/login` → "Logga in").
 *
 * Password-based sign-in (test-design B2: automated tests use password/admin-created
 * users; no magic-link-only flow). On success the browser client persists the session in
 * cookies (via `@supabase/ssr`) and we redirect into the `(app)` shell (`/dashboard`),
 * where the SERVER layout re-resolves tenant context as the authority (the client never
 * decides authorization). Phase A scope: no signup, no password-reset UI.
 *
 * This is a `"use client"` module: it uses ONLY the browser Supabase client (anon key) —
 * never the service-role key (the containment guard enforces this).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/server/db/supabase-browser-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Generic, user-safe message — never leak whether the email exists (no account
        // enumeration; UX §11). The specific Supabase error is not surfaced.
        setError("Fel e-post eller lösenord. Försök igen.");
        setSubmitting(false);
        return;
      }

      // Server layout re-resolves tenant context on the next request. `refresh()` ensures
      // the server components re-run with the freshly-set auth cookie before navigation.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Inloggningen kunde inte slutföras. Försök igen senare.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Logga in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Logga in med ditt konto för att fortsätta till Elpro.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-zinc-800">
              E-post
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-zinc-800">
              Lösenord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
          >
            {submitting ? "Loggar in…" : "Logga in"}
          </button>
        </form>
      </div>
    </main>
  );
}
