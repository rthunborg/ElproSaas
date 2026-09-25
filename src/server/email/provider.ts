/** Server-only transport seam. A deployment must explicitly opt into the isolated sandbox. */
export type EmailReleaseControl = { readonly mode?: unknown; readonly ownerApproval?: unknown } | undefined;
export type DeliveryEnvelope = {
  readonly tenantId: string;
  readonly recipient: { readonly kind: "synthetic"; readonly address: string };
  readonly template: { readonly key: string; readonly locale: string; readonly renderedBody: string };
  readonly attachments: readonly { readonly filename: string; readonly bytes: Uint8Array; readonly contentType: string }[];
};
export type DeliveryAdapter = { readonly submit: (envelope: DeliveryEnvelope) => Promise<{ readonly providerMessageId: string }> };

export function evaluateEmailReleaseControl(control: EmailReleaseControl): { readonly allowed: boolean; readonly reason: string } {
  if (control?.mode === "sandbox") return { allowed: true, reason: "sandbox" };
  // Real delivery has no implementation authorization in this story. ADR-B011's
  // separate owner record is intentionally not representable by an env toggle.
  return { allowed: false, reason: "real-recipient delivery is not approved" };
}

export function createEmailDeliveryAdapter(options: { readonly mode: "sandbox"; readonly submit: DeliveryAdapter["submit"] }) {
  return {
    async deliver(envelope: DeliveryEnvelope): Promise<{ readonly outcome: "sent"; readonly providerMessageId: string }> {
      if (options.mode !== "sandbox" || envelope.recipient.kind !== "synthetic") throw new Error("Email release control is closed");
      const result = await options.submit(envelope);
      return { outcome: "sent", providerMessageId: result.providerMessageId };
    },
  };
}
