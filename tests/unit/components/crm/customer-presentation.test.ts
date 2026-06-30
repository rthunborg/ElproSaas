/**
 * Story 3.2 — unit tests for the PURE CRM customer presentation helpers
 * (`src/components/crm/customer-presentation.ts`).
 *
 * These pin the load-bearing private-data + display contracts WITHOUT a browser:
 *   - the Swedish type-badge map (the four owner-approved types);
 *   - the list view-model EXCLUDES personnummer by construction (P0 non-exposure);
 *   - the approved-fields search predicate (personnummer is NOT searchable);
 *   - the personnummer mask (restrained display on the detail surface);
 *   - the simple, non-blocking duplicate-like heuristic.
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_TYPE_LABELS,
  customerTypeLabel,
  findDuplicateLikeNames,
  isCustomerType,
  maskPersonnummer,
  matchesQuery,
  toCustomerListItem,
  type CustomerListItem,
  type CustomerListRow,
} from "@/components/crm/customer-presentation";

test("CUSTOMER_TYPE_LABELS maps exactly the four owner-approved types to Swedish badges", () => {
  assert.deepEqual(CUSTOMER_TYPE_LABELS, {
    private: "Privatperson",
    company: "Företag",
    brf: "BRF",
    public: "Offentlig",
  });
});

test("isCustomerType accepts the four types and rejects anything else", () => {
  for (const t of ["private", "company", "brf", "public"]) {
    assert.equal(isCustomerType(t), true);
  }
  for (const bad of ["", "PRIVATE", "fortnox", null, undefined, 1]) {
    assert.equal(isCustomerType(bad), false);
  }
});

test("customerTypeLabel falls back to the raw string for an unknown type (never throws)", () => {
  assert.equal(customerTypeLabel("private"), "Privatperson");
  assert.equal(customerTypeLabel("mystery"), "mystery");
});

test("toCustomerListItem maps a projection row WITHOUT any personnummer slot (private-data posture)", () => {
  const row: CustomerListRow = {
    id: "11111111-1111-1111-1111-111111111111",
    customer_type: "company",
    display_name: "Acme AB",
    org_nr: "556677-8899",
    email: "info@acme.test",
    phone: "+46 8 123 456",
    city: "Stockholm",
    archived_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
  };
  const item = toCustomerListItem(row);
  assert.equal(item.identifier, "556677-8899");
  assert.equal(item.typeLabel, "Företag");
  assert.equal(item.isArchived, false);
  // The view-model object must have NO personnummer key at all.
  assert.equal("personnummer" in item, false);
  assert.equal(JSON.stringify(item).includes("personnummer"), false);
});

test("toCustomerListItem: a private customer surfaces NO identifier in the list (org_nr is null)", () => {
  const row: CustomerListRow = {
    id: "22222222-2222-2222-2222-222222222222",
    customer_type: "private",
    display_name: "Anna Andersson",
    org_nr: null, // DB CHECK keeps org_nr null for private; personnummer is NOT projected
    email: null,
    phone: null,
    city: "Göteborg",
    archived_at: "2026-06-02T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  };
  const item = toCustomerListItem(row);
  assert.equal(item.identifier, null);
  assert.equal(item.typeLabel, "Privatperson");
  assert.equal(item.isArchived, true);
});

function item(partial: Partial<CustomerListItem>): CustomerListItem {
  return {
    id: "id",
    displayName: "",
    type: "company",
    typeLabel: "Företag",
    identifier: null,
    email: null,
    phone: null,
    city: null,
    isArchived: false,
    ...partial,
  };
}

test("matchesQuery: empty/whitespace query matches everything", () => {
  const it = item({ displayName: "Acme AB" });
  assert.equal(matchesQuery(it, ""), true);
  assert.equal(matchesQuery(it, "   "), true);
});

test("matchesQuery searches display_name / org_nr / email / phone / city, case-insensitively", () => {
  const it = item({
    displayName: "Acme AB",
    identifier: "556677-8899",
    email: "info@acme.test",
    phone: "+46 8 123 456",
    city: "Stockholm",
  });
  assert.equal(matchesQuery(it, "acme"), true);
  assert.equal(matchesQuery(it, "8899"), true);
  assert.equal(matchesQuery(it, "INFO@acme"), true);
  assert.equal(matchesQuery(it, "123"), true);
  assert.equal(matchesQuery(it, "stockholm"), true);
  assert.equal(matchesQuery(it, "nomatch"), false);
});

test("maskPersonnummer masks all but the last 4 chars; null/short are safe", () => {
  assert.equal(maskPersonnummer("199001011234"), "••••••••1234");
  assert.equal(maskPersonnummer(null), "—");
  assert.equal(maskPersonnummer(undefined), "—");
  assert.equal(maskPersonnummer(""), "—");
  assert.equal(maskPersonnummer("12"), "••");
  // No clear-text personnummer digits leak beyond the last four.
  assert.equal(maskPersonnummer("199001011234").includes("19900101"), false);
});

test("findDuplicateLikeNames: case-insensitive exact display_name match over ACTIVE customers only", () => {
  const existing = [
    item({ displayName: "Acme AB" }),
    item({ displayName: "Acme AB", isArchived: true }), // archived → ignored
    item({ displayName: "Other Co" }),
  ];
  assert.deepEqual(findDuplicateLikeNames("acme ab", existing), ["Acme AB"]);
  assert.deepEqual(findDuplicateLikeNames("  ACME AB ", existing), ["Acme AB"]);
  assert.deepEqual(findDuplicateLikeNames("nobody", existing), []);
  assert.deepEqual(findDuplicateLikeNames("", existing), []);
});
