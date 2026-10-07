"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardPipelineResult } from "@/server/read-models/dashboard";
import { QuotePipelineWidget } from "./QuotePipelineWidget";

/** Refresh repeats server authority and reads; no values survive in a local cache. */
export function DashboardRetry({ result }: { readonly result: DashboardPipelineResult }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const retry = () => { if (!pending) startTransition(() => router.refresh()); };
  return <QuotePipelineWidget state={pending ? "loading" : result.ok ? "loaded" : "error"}
    descriptor={!pending && result.ok ? result.data.descriptor : undefined}
    completedAt={!pending && result.ok ? result.data.completedAt : undefined}
    onRetry={retry} />;
}
