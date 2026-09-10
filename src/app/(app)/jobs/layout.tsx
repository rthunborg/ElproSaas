import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function JobsLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/jobs">{children}</RouteAccessBoundary>;
}
