export type RecipientEntitlementProjection = {
  readonly recipientUserId: string;
  readonly displayName: string;
  readonly locale: string;
};

export type EmailTemplate = {
  readonly key: string;
  readonly version: number;
  readonly params: RecipientEntitlementProjection;
};

/**
 * The outbox only accepts this small recipient projection. Domain source rows and
 * administrator-only fields cannot cross the email rendering boundary.
 */
export function validateRecipientProjection(value: unknown): RecipientEntitlementProjection {
  if (!value || typeof value !== "object") throw new Error("Email template requires a recipient projection");
  const input = value as Record<string, unknown>;
  if (typeof input.recipientUserId !== "string" || typeof input.displayName !== "string" || typeof input.locale !== "string") {
    throw new Error("Email template requires a recipient projection");
  }
  return { recipientUserId: input.recipientUserId, displayName: input.displayName, locale: input.locale };
}

/** A dark render seam: it deliberately has no provider, credential, or transport dependency. */
export function renderDarkTemplate(template: EmailTemplate): RecipientEntitlementProjection {
  return validateRecipientProjection(template.params);
}
