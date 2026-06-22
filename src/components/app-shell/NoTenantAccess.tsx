/**
 * User-safe "no tenant access" state (Story 2.1, AC2).
 *
 * Shown when a request is AUTHENTICATED but has no ACTIVE `tenant_admin` membership
 * (no row, or a non-`active` status such as `invited`/`disabled`). It deliberately:
 *   - loads ZERO tenant-owned data (it is rendered INSTEAD of the app shell, which is
 *     where any tenant data would live), and
 *   - shows a GENERIC message that never reveals whether a specific tenant/user exists
 *     (UX §11; architecture §20 "client tenant spoofing" / generic access failures).
 *
 * `role="alert"` so assistive tech announces the access denial. A sign-out affordance is
 * offered so a wrong-account user can switch (the login/logout loop stays testable —
 * Task 3.3). This is presentation only; authorization was already decided server-side.
 */
import { SignOutButton } from "./SignOutButton";

export function NoTenantAccess({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Ingen åtkomst</h1>
        <p role="alert" className="mt-2 text-sm text-zinc-600">
          {message}
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
