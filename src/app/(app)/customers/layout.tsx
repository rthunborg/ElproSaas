import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function CustomersLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/customers">{children}</RouteAccessBoundary>;
}
