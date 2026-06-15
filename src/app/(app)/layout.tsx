/**
 * Authenticated app-shell route-group layout. The `(app)` group adds NO URL segment;
 * it scopes the shell chrome (sidebar / icon rail / drawer + top bar) around every
 * Phase A page. This is the only place the shell is mounted.
 *
 * No auth boundary here — `/login` and tenant/membership gating are Epic 2. The shell
 * is presentation only (epics.md#Story 1.3).
 */
import { AppShell } from "@/components/app-shell/AppShell";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
