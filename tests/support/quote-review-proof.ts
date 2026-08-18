import type { CommandDbClient } from "@/server/commands/envelope";
import { buildFreshQuoteSnapshot } from "@/server/commands/quotes/snapshot-build";

export interface QuoteReviewProofInput {
  readonly calculationId: string;
  readonly attachmentFileIds?: readonly string[];
  readonly capturedAt: string;
}

export interface QuoteReviewProof {
  readonly reviewed_snapshot_digest: string;
  readonly reviewed_quote_capture_date: string;
}

/**
 * Capture the same canonical source digest/date that the reviewed-preview path uses.
 * Integration tests call this immediately before the command with the same RLS client,
 * selected attachments, and injected command instant; no test-only digest mapping is kept.
 */
export async function buildQuoteReviewProof(
  client: unknown,
  input: QuoteReviewProofInput,
): Promise<QuoteReviewProof> {
  const built = await buildFreshQuoteSnapshot(client as CommandDbClient, {
    calculationId: input.calculationId,
    attachmentFileIds: input.attachmentFileIds ?? [],
    capturedAt: input.capturedAt,
  });

  return {
    reviewed_snapshot_digest: built.currentReviewDigest,
    reviewed_quote_capture_date: built.quoteCaptureDate,
  };
}
