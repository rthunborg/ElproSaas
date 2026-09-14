import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthEmailCallbackDestination, resolveTrustedAuthEmailCallbackOrigin } from "@/features/admin-users/auth-email-callback";

test("auth email callback sends recovery sessions to password update", () => {
  assert.equal(resolveAuthEmailCallbackDestination({ type: "recovery", membershipId: "ignored", attempt: "ignored" }), "/password/update");
});

test("auth email callback preserves only invitation context on the same-origin acceptance route", () => {
  assert.equal(
    resolveAuthEmailCallbackDestination({ type: "invite", membershipId: "member id", attempt: "attempt/value" }),
    "/invite/accept?membershipId=member+id&attempt=attempt%2Fvalue",
  );
});

test("auth email callback uses the deployment-owned origin and fails closed for a missing production configuration", () => {
  assert.equal(resolveTrustedAuthEmailCallbackOrigin("https://app.example.test/path", "https://host-header.example.test", true), "https://app.example.test");
  assert.equal(resolveTrustedAuthEmailCallbackOrigin(undefined, "http://127.0.0.1:3000", false), "http://127.0.0.1:3000");
  assert.equal(resolveTrustedAuthEmailCallbackOrigin(undefined, "https://host-header.example.test", true), null);
});
