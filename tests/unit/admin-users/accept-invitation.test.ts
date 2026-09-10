import assert from "node:assert/strict";
import { test } from "node:test";

test.skip("[P0] activates only the current unexpired token bound to the authenticated invited user", async () => {
    const { acceptInvitation } = await import("@/server/commands/admin-users/accept-invitation");
    const result = await acceptInvitation({
      tenantId: "4e23bd3a-a589-4e53-9c08-9f6b62e59f36",
      membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
      attemptToken: "current-opaque-token",
      authenticatedUserId: "37eeec1b-093b-41b1-a455-b152f028d8fd",
      authenticatedEmail: "shared.electrician@example.test",
    });

    assert.deepEqual(result, {
      ok: true,
      status: "active",
      membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
    });
  });

test.skip("[P0] denies expired, revoked, and superseded links without granting tenant access", async () => {
    const { acceptInvitation } = await import("@/server/commands/admin-users/accept-invitation");
    for (const attemptToken of ["expired-opaque-token", "revoked-opaque-token", "superseded-opaque-token"]) {
      const result = await acceptInvitation({
        tenantId: "4e23bd3a-a589-4e53-9c08-9f6b62e59f36",
        membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
        attemptToken,
        authenticatedUserId: "37eeec1b-093b-41b1-a455-b152f028d8fd",
        authenticatedEmail: "shared.electrician@example.test",
      });
      assert.deepEqual(result, { ok: false, code: "INVITATION_NOT_ACCEPTABLE" });
    }
  });
