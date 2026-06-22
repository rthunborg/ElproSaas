/**
 * Browser (client-side) Supabase client factory.
 *
 * Used from `"use client"` code (the `/login` form, the sign-out control) to run
 * password sign-in / sign-out against Supabase Auth. It uses ONLY the anon key and the
 * public URL — both `NEXT_PUBLIC_`-prefixed and browser-safe (architecture §6). The
 * service-role key is never referenced here; the Story 2.1 containment guard fails CI if
 * a service-role reference ever appears in a client path.
 *
 * `createBrowserClient` persists the session in cookies via `@supabase/ssr`, so the
 * per-request server client (`supabase-server-client.ts`) can read it back and the
 * server stays the tenant-context authority. This module is named under `src/server/db/`
 * per architecture §3's client-factory home, but is import-safe from client components.
 */
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./supabase-env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
