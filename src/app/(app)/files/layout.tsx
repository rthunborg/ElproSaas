import { RouteAccessBoundary } from "@/components/app-shell/RouteAccessBoundary";

export default function FilesLayout({ children }: { readonly children: React.ReactNode }) {
  return <RouteAccessBoundary route="/files">{children}</RouteAccessBoundary>;
}
