/**
 * Story 3.1 — PURE-LOGIC edge-case tests for the CRM input validators
 * (`@/server/commands/crm/validation`). Test-automation EXPANSION (testarch-automate):
 * the ATDD scaffolds drive a handful of validation failures through the DB-backed
 * command envelope; this file exhaustively pins the PURE validators at their exact
 * branch boundaries WITHOUT a database — the customer-type CHECK surface, the
 * identifier-by-type requiredness + mutual-exclusion rules, the email/phone/name
 * format bounds, the UUID-shape guards, optional-field present-but-bad handling, the
 * non-record inputs, and the "client tenant_id is stripped from the validated value"
 * contract (architecture §5 step 4 / §6 no-client-trusted-tenant).
 *
 * These run under `node --test` (pure, no I/O) — the project's two-runner split
 * (units → node --test; DB-backed → Vitest). Every assertion encodes EXPECTED
 * behavior; no `assert.ok(true)`.
 *
 * COVERAGE (story AC2/AC3, Task 2.2; gaps the ATDD scaffolds did not already cover).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_TYPES,
  validateCreateCustomer,
  validateUpdateCustomer,
  validateArchive,
  validateCreateFacility,
  validateUpdateFacility,
  validateCreateContact,
  validateUpdateContact,
} from "@/server/commands/crm/validation";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

/** Assert a result is the VALIDATION_FAILED shape (and NEVER echoes the raw value). */
function assertRejected(result: { ok: boolean }, label: string): void {
  assert.equal(result.ok, false, `expected VALIDATION_FAILED: ${label}`);
  const r = result as { ok: false; code?: string; data?: unknown };
  assert.equal(r.code, "VALIDATION_FAILED", `wrong code: ${label}`);
  assert.equal("data" in r, false, `rejection must not carry data: ${label}`);
}

/** Assert a result is the accepted shape and return the narrowed data. */
function assertAccepted<T>(result: { ok: boolean }, label: string): T {
  assert.equal(result.ok, true, `expected accepted: ${label}`);
  const r = result as { ok: true; data: T };
  return r.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// customer_type CHECK surface (AC2): exactly the four owner-approved values.
// ─────────────────────────────────────────────────────────────────────────────

test("CUSTOMER_TYPES is exactly the four owner-approved values, in order", () => {
  assert.deepEqual([...CUSTOMER_TYPES], ["private", "company", "brf", "public"]);
});

test("createCustomer accepts every approved type with its correct identifier", () => {
  // private ⇒ personnummer; company/brf/public ⇒ org_nr.
  const priv = validateCreateCustomer({
    customer_type: "private",
    display_name: "Privat Person",
    personnummer: "19900101-1234",
  });
  assertAccepted(priv, "private");

  for (const type of ["company", "brf", "public"] as const) {
    const r = validateCreateCustomer({
      customer_type: type,
      display_name: `Org ${type}`,
      org_nr: "556677-8899",
    });
    const data = assertAccepted<{ customer_type: string; org_nr?: string }>(
      r,
      type,
    );
    assert.equal(data.customer_type, type);
    assert.equal(data.org_nr, "556677-8899");
  }
});

test("createCustomer rejects a customer_type outside the four values", () => {
  for (const bad of ["charity", "PRIVATE", "Company", "individual", ""]) {
    assertRejected(
      validateCreateCustomer({
        customer_type: bad,
        display_name: "X",
        org_nr: "556677-8899",
      }),
      `bad type ${JSON.stringify(bad)}`,
    );
  }
});

test("createCustomer rejects a non-string customer_type", () => {
  for (const bad of [null, 1, true, ["private"], { t: "private" }, undefined]) {
    assertRejected(
      validateCreateCustomer({ customer_type: bad, display_name: "X" }),
      `non-string type ${JSON.stringify(bad)}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Identifier-by-type requiredness + mutual exclusion (AC2, owner 2026-06-18).
// ─────────────────────────────────────────────────────────────────────────────

test("private requires personnummer (missing ⇒ rejected)", () => {
  assertRejected(
    validateCreateCustomer({ customer_type: "private", display_name: "No PN" }),
    "private missing personnummer",
  );
});

test("private rejects an org_nr (identifier-by-type mutual exclusion)", () => {
  assertRejected(
    validateCreateCustomer({
      customer_type: "private",
      display_name: "PN+Org",
      personnummer: "19900101-1234",
      org_nr: "556677-8899",
    }),
    "private carrying org_nr",
  );
});

test("non-private requires org_nr (missing ⇒ rejected) for every non-private type", () => {
  for (const type of ["company", "brf", "public"] as const) {
    assertRejected(
      validateCreateCustomer({ customer_type: type, display_name: "No Org" }),
      `${type} missing org_nr`,
    );
  }
});

test("non-private rejects a personnummer (mutual exclusion) for every non-private type", () => {
  for (const type of ["company", "brf", "public"] as const) {
    assertRejected(
      validateCreateCustomer({
        customer_type: type,
        display_name: "Org+PN",
        org_nr: "556677-8899",
        personnummer: "19900101-1234",
      }),
      `${type} carrying personnummer`,
    );
  }
});

test("a private customer's validated value carries personnummer and NOT org_nr", () => {
  const data = assertAccepted<{ personnummer?: string; org_nr?: string }>(
    validateCreateCustomer({
      customer_type: "private",
      display_name: "Privat",
      personnummer: "19900101-1234",
    }),
    "private value shape",
  );
  assert.equal(data.personnummer, "19900101-1234");
  assert.equal(data.org_nr, undefined);
});

test("an empty-string identifier counts as absent (requiredness still bites)", () => {
  // isPresent treats "" as absent — a private with personnummer:"" is still missing.
  assertRejected(
    validateCreateCustomer({
      customer_type: "private",
      display_name: "Empty PN",
      personnummer: "",
    }),
    "private personnummer empty string",
  );
  assertRejected(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "Empty Org",
      org_nr: "",
    }),
    "company org_nr empty string",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// display_name / name: non-empty, single-line, bounded.
// ─────────────────────────────────────────────────────────────────────────────

test("createCustomer rejects empty and whitespace-only display_name", () => {
  for (const bad of ["", "   ", "\t", "\n"]) {
    assertRejected(
      validateCreateCustomer({
        customer_type: "company",
        display_name: bad,
        org_nr: "556677-8899",
      }),
      `display_name ${JSON.stringify(bad)}`,
    );
  }
});

test("createCustomer trims the display_name in the validated value", () => {
  const data = assertAccepted<{ display_name: string }>(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "  Elfirma AB  ",
      org_nr: "556677-8899",
    }),
    "trim display_name",
  );
  assert.equal(data.display_name, "Elfirma AB");
});

test("createCustomer rejects an over-long display_name (>256)", () => {
  assertRejected(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "A".repeat(257),
      org_nr: "556677-8899",
    }),
    "display_name 257 chars",
  );
});

test("createFacility / createContact reject empty or whitespace-only name", () => {
  for (const bad of ["", "  ", "\n"]) {
    assertRejected(
      validateCreateFacility({ customer_id: VALID_UUID, name: bad }),
      `facility name ${JSON.stringify(bad)}`,
    );
    assertRejected(
      validateCreateContact({ customer_id: VALID_UUID, name: bad }),
      `contact name ${JSON.stringify(bad)}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Email format (only validated WHEN present).
// ─────────────────────────────────────────────────────────────────────────────

test("createCustomer accepts a well-formed email", () => {
  for (const ok of ["a@b.co", "anna.andersson@example.test", "x+y@sub.domain.se"]) {
    assertAccepted(
      validateCreateCustomer({
        customer_type: "company",
        display_name: "Email OK",
        org_nr: "556677-8899",
        email: ok,
      }),
      `email ${ok}`,
    );
  }
});

test("createCustomer rejects a malformed email when present", () => {
  for (const bad of [
    "not-an-email",
    "missing-at.example.com",
    "a@b",
    "a@b.",
    "@b.co",
    "a@@b.co",
    "a @b.co",
    "a@b .co",
    "a@b.co\n",
  ]) {
    assertRejected(
      validateCreateCustomer({
        customer_type: "company",
        display_name: "Bad Email",
        org_nr: "556677-8899",
        email: bad,
      }),
      `email ${JSON.stringify(bad)}`,
    );
  }
});

test("email is OPTIONAL — absent email is accepted", () => {
  assertAccepted(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "No Email",
      org_nr: "556677-8899",
    }),
    "no email",
  );
});

test("contact email format is validated the same way", () => {
  assertRejected(
    validateCreateContact({
      customer_id: VALID_UUID,
      name: "Bad Email Contact",
      email: "nope",
    }),
    "contact bad email",
  );
  assertAccepted(
    validateCreateContact({
      customer_id: VALID_UUID,
      name: "Good Email Contact",
      email: "ok@example.test",
    }),
    "contact good email",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Phone format (only validated WHEN present).
// ─────────────────────────────────────────────────────────────────────────────

test("createCustomer accepts a well-formed phone", () => {
  for (const ok of ["+46701234567", "08-123 456", "(070) 123 45 67", "12345"]) {
    assertAccepted(
      validateCreateCustomer({
        customer_type: "company",
        display_name: "Phone OK",
        org_nr: "556677-8899",
        phone: ok,
      }),
      `phone ${ok}`,
    );
  }
});

test("createCustomer rejects a malformed phone when present", () => {
  for (const bad of [
    "1234", // < 5 chars
    "phone", // letters
    "070-CALL-NOW",
    "+46 70 123 45 67 ext 9", // letters
    "1".repeat(33), // > 32 chars
    "@#$%^",
  ]) {
    assertRejected(
      validateCreateCustomer({
        customer_type: "company",
        display_name: "Bad Phone",
        org_nr: "556677-8899",
        phone: bad,
      }),
      `phone ${JSON.stringify(bad)}`,
    );
  }
});

test("phone is OPTIONAL — absent phone is accepted", () => {
  assertAccepted(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "No Phone",
      org_nr: "556677-8899",
    }),
    "no phone",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Optional address fields: present-but-bad handling.
// ─────────────────────────────────────────────────────────────────────────────

test("createCustomer rejects an over-long address line (>512)", () => {
  assertRejected(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "Long Addr",
      org_nr: "556677-8899",
      address_line1: "A".repeat(513),
    }),
    "address_line1 513 chars",
  );
});

test("createCustomer rejects an over-long postal/city (>256)", () => {
  assertRejected(
    validateCreateCustomer({
      customer_type: "company",
      display_name: "Long City",
      org_nr: "556677-8899",
      city: "C".repeat(257),
    }),
    "city 257 chars",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// UUID-shape guards (an id the DB would reject as 22P02 fails as VALIDATION first).
// ─────────────────────────────────────────────────────────────────────────────

test("validateArchive rejects a non-UUID id and accepts a UUID id", () => {
  for (const bad of ["", "not-a-uuid", "123", VALID_UUID + "x", 42, null]) {
    assertRejected(validateArchive({ id: bad }), `archive id ${JSON.stringify(bad)}`);
  }
  const data = assertAccepted<{ id: string }>(
    validateArchive({ id: VALID_UUID }),
    "archive valid uuid",
  );
  assert.equal(data.id, VALID_UUID);
});

test("createFacility rejects a non-UUID customer_id", () => {
  assertRejected(
    validateCreateFacility({ customer_id: "nope", name: "F" }),
    "facility bad customer_id",
  );
});

test("createContact rejects a non-UUID customer_id", () => {
  assertRejected(
    validateCreateContact({ customer_id: "nope", name: "C" }),
    "contact bad customer_id",
  );
});

test("createContact rejects a present-but-malformed facility_id", () => {
  assertRejected(
    validateCreateContact({
      customer_id: VALID_UUID,
      facility_id: "not-a-uuid",
      name: "C",
    }),
    "contact bad facility_id",
  );
});

test("createContact accepts an absent facility_id (optional link)", () => {
  const data = assertAccepted<{ facility_id?: string }>(
    validateCreateContact({ customer_id: VALID_UUID, name: "C" }),
    "contact no facility_id",
  );
  assert.equal(data.facility_id, undefined);
});

test("createContact accepts a well-formed facility_id", () => {
  const data = assertAccepted<{ facility_id?: string }>(
    validateCreateContact({
      customer_id: VALID_UUID,
      facility_id: VALID_UUID_2,
      name: "C",
    }),
    "contact good facility_id",
  );
  assert.equal(data.facility_id, VALID_UUID_2);
});

// ─────────────────────────────────────────────────────────────────────────────
// contact is_primary: optional boolean only.
// ─────────────────────────────────────────────────────────────────────────────

test("createContact rejects a present non-boolean is_primary", () => {
  // NOTE: null/undefined are treated as ABSENT (optional) — only a present,
  // non-boolean value is a validation failure.
  for (const bad of ["true", 1, 0, "yes"]) {
    assertRejected(
      validateCreateContact({
        customer_id: VALID_UUID,
        name: "C",
        is_primary: bad,
      }),
      `is_primary ${JSON.stringify(bad)}`,
    );
  }
});

test("createContact accepts an explicit is_primary boolean and preserves it", () => {
  const t = assertAccepted<{ is_primary?: boolean }>(
    validateCreateContact({
      customer_id: VALID_UUID,
      name: "Primary",
      is_primary: true,
    }),
    "is_primary true",
  );
  assert.equal(t.is_primary, true);
  const f = assertAccepted<{ is_primary?: boolean }>(
    validateCreateContact({
      customer_id: VALID_UUID,
      name: "NotPrimary",
      is_primary: false,
    }),
    "is_primary false",
  );
  assert.equal(f.is_primary, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// update validators: bad id, empty-when-supplied name/display_name, format reuse.
// ─────────────────────────────────────────────────────────────────────────────

test("validateUpdateCustomer rejects a non-UUID id", () => {
  assertRejected(
    validateUpdateCustomer({ id: "nope", display_name: "X" }),
    "update bad id",
  );
});

test("validateUpdateCustomer rejects an empty display_name WHEN supplied (but allows omission)", () => {
  assertRejected(
    validateUpdateCustomer({ id: VALID_UUID, display_name: "   " }),
    "update empty display_name",
  );
  // Omitting display_name entirely is fine — a partial update.
  assertAccepted(
    validateUpdateCustomer({ id: VALID_UUID, city: "Göteborg" }),
    "update without display_name",
  );
});

test("validateUpdateCustomer rejects a malformed email/phone WHEN supplied", () => {
  assertRejected(
    validateUpdateCustomer({ id: VALID_UUID, email: "bad" }),
    "update bad email",
  );
  assertRejected(
    validateUpdateCustomer({ id: VALID_UUID, phone: "abc" }),
    "update bad phone",
  );
});

test("validateUpdateFacility rejects empty name WHEN supplied", () => {
  assertRejected(
    validateUpdateFacility({ id: VALID_UUID, name: "  " }),
    "update facility empty name",
  );
  assertAccepted(
    validateUpdateFacility({ id: VALID_UUID, city: "Malmö" }),
    "update facility city only",
  );
});

test("validateUpdateContact rejects a malformed facility_id and whitespace-only name WHEN supplied", () => {
  assertRejected(
    validateUpdateContact({ id: VALID_UUID, facility_id: "nope" }),
    "update contact bad facility_id",
  );
  // A whitespace-only name IS present (not "") and must be rejected. NOTE: an
  // empty-string name "" is treated as ABSENT (a partial update that omits name).
  assertRejected(
    validateUpdateContact({ id: VALID_UUID, name: "   " }),
    "update contact whitespace name",
  );
  assertAccepted(
    validateUpdateContact({ id: VALID_UUID, name: "" }),
    "update contact empty-string name = omit",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-record / nullish inputs — every validator must reject without throwing.
// ─────────────────────────────────────────────────────────────────────────────

test("every validator rejects non-record inputs without throwing", () => {
  const validators = [
    validateCreateCustomer,
    validateUpdateCustomer,
    validateArchive,
    validateCreateFacility,
    validateUpdateFacility,
    validateCreateContact,
    validateUpdateContact,
  ];
  for (const v of validators) {
    for (const bad of [null, undefined, "string", 42, true, ["array"]]) {
      const r = v(bad as unknown);
      assert.equal(r.ok, false, `${v.name} should reject ${JSON.stringify(bad)}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Client tenant_id is NEVER trusted: a smuggled tenant_id is stripped from the
// validated value (architecture §6 — the resolved tenant is the only authority).
// ─────────────────────────────────────────────────────────────────────────────

test("a client-supplied tenant_id is stripped from the validated value (customer)", () => {
  const data = assertAccepted<Record<string, unknown>>(
    validateCreateCustomer({
      tenant_id: VALID_UUID_2,
      customer_type: "company",
      display_name: "Smuggler AB",
      org_nr: "556677-8899",
    } as unknown),
    "customer strips tenant_id",
  );
  assert.equal("tenant_id" in data, false);
});

test("a client-supplied tenant_id is stripped from the validated value (facility & contact)", () => {
  const fac = assertAccepted<Record<string, unknown>>(
    validateCreateFacility({
      tenant_id: VALID_UUID_2,
      customer_id: VALID_UUID,
      name: "Smuggler Facility",
    } as unknown),
    "facility strips tenant_id",
  );
  assert.equal("tenant_id" in fac, false);

  const con = assertAccepted<Record<string, unknown>>(
    validateCreateContact({
      tenant_id: VALID_UUID_2,
      customer_id: VALID_UUID,
      name: "Smuggler Contact",
    } as unknown),
    "contact strips tenant_id",
  );
  assert.equal("tenant_id" in con, false);
});
