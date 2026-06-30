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
  parseUpdateCustomerForm,
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
