import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function QuotesLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/quotes">{children}</RouteAccessBoundary>;
}
