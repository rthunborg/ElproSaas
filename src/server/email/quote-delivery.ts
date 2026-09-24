import { createHash } from "node:crypto";

export type QuoteDeliveryRecipient = {
  readonly address: string;
  readonly sourceType: "customer" | "contact";
  readonly sourceId: string;
};

export type QuoteDeliveryArtifact = {
  readonly outboxId: string;
  readonly tenantId: string;
  readonly quoteVersionId: string;
  readonly contentFingerprint: string;
  readonly bytes: Uint8Array;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalize the sender-confirmed CRM address before it is frozen into delivery state. */
export function normalizeQuoteDeliveryRecipient(input: QuoteDeliveryRecipient): QuoteDeliveryRecipient {
  const address = input.address.trim().toLowerCase();
  if (!EMAIL.test(address) || address.length > 256) throw new Error("A linked customer or contact email is required");
  if (!input.sourceId) throw new Error("A linked customer or contact source is required");
  return { ...input, address };
}

/** The artifact is content-addressed so a worker can reject altered bytes before submission. */
export function assertQuoteDeliveryArtifact(input: QuoteDeliveryArtifact): void {
  if (input.bytes.byteLength === 0) throw new Error("Quote delivery artifact is empty");
  const actual = createHash("sha256").update(input.bytes).digest("hex");
  if (actual !== input.contentFingerprint) throw new Error("Quote delivery artifact fingerprint mismatch");
}
