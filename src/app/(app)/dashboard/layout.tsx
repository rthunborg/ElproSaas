import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/dashboard">{children}</RouteAccessBoundary>;
}
