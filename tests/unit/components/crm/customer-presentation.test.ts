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

// ─────────────────────────────────────────────────────────────────────────────
// Edge-case / branch coverage the happy-path tests above skip.
// ─────────────────────────────────────────────────────────────────────────────

test("toCustomerListItem: undefined optional columns collapse to null (no undefined leaks into the view-model)", () => {
  // A projection row whose optional columns are absent (undefined) rather than null —
  // the view-model must normalize to null so the UI renders a stable empty cell.
  const row = {
    id: "33333333-3333-3333-3333-333333333333",
    customer_type: "public",
    display_name: "Kommun",
    org_nr: "212000-0000",
    email: undefined,
    phone: undefined,
    city: undefined,
    archived_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
  } as unknown as CustomerListRow;
  const it = toCustomerListItem(row);
  assert.equal(it.email, null);
  assert.equal(it.phone, null);
  assert.equal(it.city, null);
  assert.equal(it.identifier, "212000-0000");
  assert.equal(it.typeLabel, "Offentlig");
  assert.equal(it.type, "public");
});

test("toCustomerListItem: an unknown customer_type still renders (raw-string label fallback, never throws)", () => {
  const row: CustomerListRow = {
    id: "44444444-4444-4444-4444-444444444444",
    customer_type: "legacy_unknown",
    display_name: "Mystery",
    org_nr: null,
    email: null,
    phone: null,
    city: null,
    archived_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
  };
  const it = toCustomerListItem(row);
  assert.equal(it.typeLabel, "legacy_unknown");
  assert.equal(it.type, "legacy_unknown");
  assert.equal(it.identifier, null);
});

test("matchesQuery: a query that ONLY matches the identifier still matches (org_nr is searchable)", () => {
  const it = item({ displayName: "Acme AB", identifier: "556677-8899" });
  assert.equal(matchesQuery(it, "556677"), true);
});

test("matchesQuery: null fields are skipped, never coerced to the string 'null'", () => {
  const it = item({ displayName: "Acme AB", identifier: null, email: null });
  assert.equal(matchesQuery(it, "null"), false);
  assert.equal(matchesQuery(it, "acme"), true);
});

test("matchesQuery: the query itself is trimmed before matching", () => {
  const it = item({ city: "Stockholm" });
  assert.equal(matchesQuery(it, "  stockholm  "), true);
});

test("matchesQuery: a partial substring within a field matches", () => {
  const it = item({ email: "info@acme.test" });
  assert.equal(matchesQuery(it, "acme.te"), true);
});

test("maskPersonnummer: an exactly-4-char value is fully masked (boundary: <= 4 → all bullets)", () => {
  // The last-4 reveal would expose the WHOLE value at length 4, so the helper masks
  // everything at/under 4 chars instead of revealing it.
  assert.equal(maskPersonnummer("1234"), "••••");
});

test("maskPersonnummer: surrounding whitespace is trimmed before the last-4 reveal", () => {
  assert.equal(maskPersonnummer("  199001011234  "), "••••••••1234");
});

test("maskPersonnummer: a whitespace-only value masks to a single bullet — never the raw spaces (no leak)", () => {
  // A non-empty whitespace string is truthy (skips the "—" guard); trimmed to empty it
  // falls in the <=4 branch and yields at least one bullet. The contract that matters:
  // it NEVER returns the original whitespace and NEVER throws.
  const masked = maskPersonnummer("   ");
  assert.equal(masked, "•");
  assert.equal(/[•—]/.test(masked), true);
  assert.equal(masked.includes(" "), false);
});

test("findDuplicateLikeNames: returns ALL active matches, and a substring near-miss does NOT match (exact only)", () => {
  const existing = [
    item({ displayName: "Acme AB" }),
    item({ displayName: "ACME ab" }), // case-variant duplicate → matches
    item({ displayName: "Acme AB Sweden" }), // superset → NOT a match (exact only)
  ];
  assert.deepEqual(findDuplicateLikeNames("Acme AB", existing), ["Acme AB", "ACME ab"]);
});

test("findDuplicateLikeNames: a whitespace-only candidate matches nothing", () => {
  const existing = [item({ displayName: "Acme AB" })];
  assert.deepEqual(findDuplicateLikeNames("   ", existing), []);
});

test("findDuplicateLikeNames: an empty existing list yields no matches", () => {
  assert.deepEqual(findDuplicateLikeNames("Acme AB", []), []);
});
