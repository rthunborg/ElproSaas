import type { ReactNode } from "react";

export function DashboardGrid({ children }: { readonly children?: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-12">{children}</div>;
}
