import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function SettingsLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/settings">{children}</RouteAccessBoundary>;
}
