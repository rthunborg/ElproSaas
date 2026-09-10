import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function CalculationsLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/calculations">{children}</RouteAccessBoundary>;
}
