import { resolvePlatformOperator } from "@/server/auth/resolve-platform-operator";

export const dynamic = "force-dynamic";

/** Isolated platform boundary. It intentionally has no tenant context or shell. */
export default async function OperatorLayout({ children }: { readonly children: React.ReactNode }) {
  if (!(await resolvePlatformOperator()).ok) return <main className="p-6"><p>Åtkomst saknas.</p></main>;
  return <main className="mx-auto max-w-6xl p-6">{children}</main>;
}
