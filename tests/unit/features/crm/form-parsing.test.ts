/**
 * Story 3.2 — unit tests for the PURE CRM FormData parsers
 * (`src/features/crm/form-parsing.ts`).
 *
 * These pin the client-side (UX nicety) field validation + the input-shape mirroring
 * of the 3.1 command contracts, WITHOUT a browser or a server round-trip:
 *   - customer create: type + display_name required; identifier driven by type
 *     (private ⇒ personnummer; non-private ⇒ org_nr); the wrong-type identifier is
 *     dropped so the 3.1 validator / DB CHECK is never tripped on a trivial near-miss;
 *   - customer update: no customer_type (no type switch on update);
 *   - facility/contact create require name; values are echoed back for preservation.
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner. FormData is
 * a Web/Node global; no DOM needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArchiveForm,
  parseCreateContactForm,
  parseCreateCustomerForm,
  parseCreateFacilityForm,
  parseUpdateContactForm,
  parseUpdateCustomerForm,
  parseUpdateFacilityForm,
} from "@/features/crm/form-parsing";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

test("createCustomer: a private customer carries personnummer and NO org_nr", () => {
  const parsed = parseCreateCustomerForm(
    fd({
      customer_type: "private",
      display_name: "Anna Andersson",
      personnummer: "199001011234",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.customer_type, "private");
  assert.equal(parsed.input.personnummer, "199001011234");
  assert.equal("org_nr" in parsed.input, false);
});

test("createCustomer: a company carries org_nr and NO personnummer (even if one is posted)", () => {
  const parsed = parseCreateCustomerForm(
    fd({
      customer_type: "company",
      display_name: "Acme AB",
      org_nr: "556677-8899",
      // A stray personnummer must be dropped for a non-private type (defensive).
      personnummer: "199001011234",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.org_nr, "556677-8899");
  assert.equal("personnummer" in parsed.input, false);
});

test("createCustomer: missing display_name and identifier produce field-associated errors", () => {
  const parsed = parseCreateCustomerForm(fd({ customer_type: "private" }));
  assert.equal(parsed.fieldErrors.display_name, "Fältet är obligatoriskt.");
  assert.equal(parsed.fieldErrors.personnummer, "Fältet är obligatoriskt.");
});

test("createCustomer: an invalid customer_type is a field error on customer_type", () => {
  const parsed = parseCreateCustomerForm(
    fd({ customer_type: "fortnox", display_name: "X" }),
  );
  assert.equal(parsed.fieldErrors.customer_type, "Välj en giltig kundtyp.");
});

test("createCustomer: company missing org_nr is a field error on org_nr", () => {
  const parsed = parseCreateCustomerForm(
    fd({ customer_type: "company", display_name: "Acme AB" }),
  );
  assert.equal(parsed.fieldErrors.org_nr, "Fältet är obligatoriskt.");
});

test("updateCustomer: never reads customer_type (no type switch on update)", () => {
  const parsed = parseUpdateCustomerForm(
    fd({
      id: "11111111-1111-1111-1111-111111111111",
      customer_type: "company", // present in the form but must be ignored
      display_name: "New Name",
    }),
  );
  assert.equal("customer_type" in parsed.input, false);
  assert.equal(parsed.input.id, "11111111-1111-1111-1111-111111111111");
  assert.equal(parsed.input.display_name, "New Name");
});

test("updateCustomer: a present-but-blank display_name is a field error (cleared a required value)", () => {
  const parsed = parseUpdateCustomerForm(
    fd({ id: "11111111-1111-1111-1111-111111111111", display_name: "   " }),
  );
  assert.equal(parsed.fieldErrors.display_name, "Fältet är obligatoriskt.");
});

test("createFacility: requires name; customer_id is forwarded as raw input", () => {
  const ok = parseCreateFacilityForm(
    fd({ customer_id: "c1", name: "Huvudkontor" }),
  );
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.input.customer_id, "c1");
  assert.equal(ok.input.name, "Huvudkontor");

  const bad = parseCreateFacilityForm(fd({ customer_id: "c1" }));
  assert.equal(bad.fieldErrors.name, "Fältet är obligatoriskt.");
});

test("createContact: requires name; facility_id + is_primary are optional", () => {
  const parsed = parseCreateContactForm(
    fd({
      customer_id: "c1",
      name: "Erik",
      facility_id: "f1",
      is_primary: "on",
      email: "erik@acme.test",
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.facility_id, "f1");
  assert.equal(parsed.input.is_primary, true);
  assert.equal(parsed.input.email, "erik@acme.test");

  const bad = parseCreateContactForm(fd({ customer_id: "c1" }));
  assert.equal(bad.fieldErrors.name, "Fältet är obligatoriskt.");
});

test("values are echoed back so the form preserves input on a failed submit", () => {
  const parsed = parseCreateCustomerForm(
    fd({ customer_type: "private", display_name: "Anna", personnummer: "" }),
  );
  assert.equal(parsed.values.display_name, "Anna");
  assert.equal(parsed.values.customer_type, "private");
});

test("parseArchiveForm requires an id", () => {
  assert.equal(parseArchiveForm(fd({})).fieldErrors.id, "Fältet är obligatoriskt.");
  assert.deepEqual(parseArchiveForm(fd({ id: "x" })).fieldErrors, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge-case / branch coverage the happy-path tests above skip.
// ─────────────────────────────────────────────────────────────────────────────

test("createCustomer: brf and public types BOTH require org_nr (not just company)", () => {
  for (const type of ["brf", "public"]) {
    const missing = parseCreateCustomerForm(
      fd({ customer_type: type, display_name: "X" }),
    );
    assert.equal(
      missing.fieldErrors.org_nr,
      "Fältet är obligatoriskt.",
      `${type} without org_nr must flag org_nr`,
    );
    const ok = parseCreateCustomerForm(
      fd({ customer_type: type, display_name: "X", org_nr: "556677-8899" }),
    );
    assert.deepEqual(ok.fieldErrors, {}, `${type} with org_nr is well-formed`);
    assert.equal(ok.input.org_nr, "556677-8899");
    assert.equal("personnummer" in ok.input, false);
  }
});

test("createCustomer: a private customer's stray org_nr is dropped (identifier driven by type)", () => {
  const parsed = parseCreateCustomerForm(
    fd({
      customer_type: "private",
      display_name: "Anna",
      personnummer: "199001011234",
      org_nr: "556677-8899", // wrong identifier for a private type → must be dropped
    }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.personnummer, "199001011234");
  assert.equal("org_nr" in parsed.input, false);
});

test("createCustomer: a whitespace-only display_name is treated as missing (trimmed)", () => {
  const parsed = parseCreateCustomerForm(
    fd({ customer_type: "private", display_name: "   ", personnummer: "199001011234" }),
  );
  assert.equal(parsed.fieldErrors.display_name, "Fältet är obligatoriskt.");
  // But the raw (untrimmed) value is still echoed back for preservation.
  assert.equal(parsed.values.display_name, "   ");
});

test("createCustomer: optional contact/address fields are trimmed; blank ones are omitted", () => {
  const parsed = parseCreateCustomerForm(
    fd({
      customer_type: "company",
      display_name: "Acme AB",
      org_nr: "556677-8899",
      contact_name: "  Erik  ",
      city: "  Stockholm  ",
      email: "", // blank optional → omitted from input
    }),
  );
  assert.equal(parsed.input.contact_name, "Erik");
  assert.equal(parsed.input.city, "Stockholm");
  assert.equal(parsed.input.email, undefined);
});

test("updateCustomer: an entirely absent display_name field is NOT an error (only present-but-blank is)", () => {
  const parsed = parseUpdateCustomerForm(
    fd({ id: "11111111-1111-1111-1111-111111111111", city: "Malmö" }),
  );
  assert.deepEqual(parsed.fieldErrors, {});
  assert.equal(parsed.input.city, "Malmö");
});

test("updateCustomer: BOTH identifier fields are forwarded as-is (no type-driven filtering on update)", () => {
  // Update never reads customer_type, so it cannot filter by type; whichever
  // identifier the (type-consistent) UI submits is forwarded for the DB CHECK.
  const parsed = parseUpdateCustomerForm(
    fd({
      id: "11111111-1111-1111-1111-111111111111",
      personnummer: "199001011234",
      org_nr: "556677-8899",
    }),
  );
  assert.equal(parsed.input.personnummer, "199001011234");
  assert.equal(parsed.input.org_nr, "556677-8899");
});

test("updateCustomer: a missing id is a field-associated error", () => {
  const parsed = parseUpdateCustomerForm(fd({ display_name: "Name" }));
  assert.equal(parsed.fieldErrors.id, "Fältet är obligatoriskt.");
});

test("updateFacility: requires id; a present-but-blank name is flagged; absent name is fine", () => {
  assert.equal(
    parseUpdateFacilityForm(fd({ name: "X" })).fieldErrors.id,
    "Fältet är obligatoriskt.",
  );
  assert.equal(
    parseUpdateFacilityForm(fd({ id: "f1", name: "   " })).fieldErrors.name,
    "Fältet är obligatoriskt.",
  );
  const ok = parseUpdateFacilityForm(fd({ id: "f1", city: "Lund" }));
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.input.id, "f1");
  assert.equal(ok.input.city, "Lund");
});

test("updateContact: requires id; forwards optional facility_id + is_primary; blank name flagged", () => {
  assert.equal(
    parseUpdateContactForm(fd({ name: "X" })).fieldErrors.id,
    "Fältet är obligatoriskt.",
  );
  assert.equal(
    parseUpdateContactForm(fd({ id: "k1", name: "  " })).fieldErrors.name,
    "Fältet är obligatoriskt.",
  );
  const ok = parseUpdateContactForm(
    fd({ id: "k1", facility_id: "f1", is_primary: "true", role_label: "VD" }),
  );
  assert.deepEqual(ok.fieldErrors, {});
  assert.equal(ok.input.facility_id, "f1");
  assert.equal(ok.input.is_primary, true);
  assert.equal(ok.input.role_label, "VD");
});

test("createContact: is_primary boolean parsing — on/true/1 → true; other strings → false", () => {
  for (const truthy of ["on", "true", "1"]) {
    const p = parseCreateContactForm(fd({ customer_id: "c1", name: "E", is_primary: truthy }));
    assert.equal(p.input.is_primary, true, `${truthy} → true`);
  }
  for (const falsy of ["off", "false", "0", "no"]) {
    const p = parseCreateContactForm(fd({ customer_id: "c1", name: "E", is_primary: falsy }));
    assert.equal(p.input.is_primary, false, `${falsy} → false`);
  }
});

test("createContact: is_primary absent → the key is omitted entirely (no forced default)", () => {
  const p = parseCreateContactForm(fd({ customer_id: "c1", name: "E" }));
  assert.equal("is_primary" in p.input, false);
});

test("createContact: a blank optional facility_id/email is omitted from input", () => {
  const p = parseCreateContactForm(
    fd({ customer_id: "c1", name: "E", facility_id: "", email: "" }),
  );
  assert.equal(p.input.facility_id, undefined);
  assert.equal(p.input.email, undefined);
});

test("createCustomer: a missing customer_type AND missing display_name flag both fields", () => {
  const parsed = parseCreateCustomerForm(fd({}));
  assert.equal(parsed.fieldErrors.customer_type, "Välj en giltig kundtyp.");
  assert.equal(parsed.fieldErrors.display_name, "Fältet är obligatoriskt.");
  // With no valid type, the identifier requiredness is NOT asserted (cannot know which).
  assert.equal("personnummer" in parsed.fieldErrors, false);
  assert.equal("org_nr" in parsed.fieldErrors, false);
});

test("values echo: only string form entries are collected (no stray keys)", () => {
  const parsed = parseCreateFacilityForm(fd({ customer_id: "c1", name: "HK" }));
  assert.equal(parsed.values.customer_id, "c1");
  assert.equal(parsed.values.name, "HK");
  // A field the form did not submit is simply absent from values.
  assert.equal("city" in parsed.values, false);
});
