import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

async function loadOutbox(): Promise<typeof import("@/server/email/outbox")> {
  return import(["@/server/email/outbox"].join(""));
}

describe("Story 13.4 quote-email attachment authority (ATDD RED)", () => {
  test("[P0][13.4-INT-004] submits current authorized quote PDF bytes only and never constructs a public acceptance link", async () => {
    const { processQuoteDelivery } = await loadOutbox();
    const submit = vi.fn().mockResolvedValue({ providerMessageId: "sandbox-quote-13-4" });
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const artifact = { outboxId: "33333333-3333-4333-8333-333333333333", tenantId: "11111111-1111-4111-8111-111111111111", quoteVersionId: "44444444-4444-4444-8444-444444444444", contentFingerprint: "c".repeat(64), pdfChecksumSha256: createHash("sha256").update(bytes).digest("hex"), bytes };
    const loadCurrentAuthorizedPdf = vi.fn().mockResolvedValue({ bytes, snapshotId: "snapshot-current", artifact });
    await processQuoteDelivery({ releaseControl: { mode: "sandbox" }, loadCurrentAuthorizedPdf, revalidateQuoteDeliveryArtifact: async () => true, deliveryAdapter: { submit } }, { tenantId: "11111111-1111-4111-8111-111111111111", quoteId: "22222222-2222-4222-8222-222222222222" });
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ attachments: [expect.objectContaining({ bytes: new Uint8Array([37, 80, 68, 70]) })] }));
    expect(JSON.stringify(submit.mock.calls)).not.toMatch(/accept|public|signedUrl/i);
  });

  test("[P0][13.4-INT-005] rejects stale, invalid, or missing quote PDFs before provider submission and keeps the item recoverably queued", async () => {
    const { processQuoteDelivery } = await loadOutbox();
    for (const pdf of [null, { bytes: new Uint8Array(), snapshotId: "stale", current: false }, { bytes: new Uint8Array([37]), snapshotId: "invalid", valid: false }]) {
      const submit = vi.fn();
      await expect(processQuoteDelivery({ releaseControl: { mode: "sandbox" }, loadCurrentAuthorizedPdf: async () => pdf, deliveryAdapter: { submit } }, { tenantId: "11111111-1111-4111-8111-111111111111", quoteId: "22222222-2222-4222-8222-222222222222" })).rejects.toMatchObject({ code: "QUOTE_PDF_UNAVAILABLE", recoverable: true });
      expect(submit).not.toHaveBeenCalled();
    }
  });

  test("[P0][13.4-INT-007] rejects an absent, altered, or no-longer-current delivery artifact before provider submission", async () => {
    const { processQuoteDelivery } = await loadOutbox();
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const artifact = { outboxId: "33333333-3333-4333-8333-333333333333", tenantId: "11111111-1111-4111-8111-111111111111", quoteVersionId: "44444444-4444-4444-8444-444444444444", contentFingerprint: "a".repeat(64), pdfChecksumSha256: createHash("sha256").update(bytes).digest("hex"), bytes };
    const submit = vi.fn();
    await expect(processQuoteDelivery({ releaseControl: { mode: "sandbox" }, loadCurrentAuthorizedPdf: async () => ({ bytes, snapshotId: "current", artifact }), revalidateQuoteDeliveryArtifact: async () => false, deliveryAdapter: { submit } }, { tenantId: artifact.tenantId, quoteId: "22222222-2222-4222-8222-222222222222" })).rejects.toMatchObject({ code: "QUOTE_PDF_UNAVAILABLE" });
    expect(submit).not.toHaveBeenCalled();
  });

  test("[P1][13.4-INT-006] prevents every terminal quote reminder state from enqueueing or submitting a reminder", async () => {
    const { processQuoteDelivery } = await loadOutbox();
    for (const status of ["accepted", "rejected", "withdrawn", "superseded", "expired"]) {
      await expect(processQuoteDelivery({ releaseControl: { mode: "sandbox" } }, { tenantId: "11111111-1111-4111-8111-111111111111", quoteId: "22222222-2222-4222-8222-222222222222", kind: "reminder", quoteStatus: status })).resolves.toMatchObject({ outcome: "not_eligible" });
    }
  });
});
