import assert from "node:assert/strict";
import { test } from "node:test";

test("[P0] activates only the current unexpired token bound to the authenticated invited user", async () => {
    const { acceptInvitation } = await import("@/server/commands/admin-users/accept-invitation");
    const result = await acceptInvitation({
      membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
      attemptToken: "current-opaque-token",
    }, {
      currentUser: async () => ({ id: "37eeec1b-093b-41b1-a455-b152f028d8fd", email: "shared.electrician@example.test" }),
      accept: async ({ userId, email, tokenHash }) => userId === "37eeec1b-093b-41b1-a455-b152f028d8fd" && email === "shared.electrician@example.test" && tokenHash.length === 64,
    });

    assert.deepEqual(result, {
      ok: true,
      status: "active",
      membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
    });
  });

test("[P0] denies expired, revoked, and superseded links without granting tenant access", async () => {
    const { acceptInvitation } = await import("@/server/commands/admin-users/accept-invitation");
    for (const attemptToken of ["expired-opaque-token", "revoked-opaque-token", "superseded-opaque-token"]) {
      const result = await acceptInvitation({
        membershipId: "aa15496b-1ca0-4fda-a126-47527539325e",
        attemptToken,
      }, {
        currentUser: async () => ({ id: "37eeec1b-093b-41b1-a455-b152f028d8fd", email: "shared.electrician@example.test" }),
        accept: async () => false,
      });
      assert.deepEqual(result, { ok: false, code: "INVITATION_NOT_ACCEPTABLE" });
    }
  });
