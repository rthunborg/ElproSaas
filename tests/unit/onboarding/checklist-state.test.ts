import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateOnboardingChecklist, ONBOARDING_CHECKLIST_ITEMS, type OnboardingChecklistFacts } from "@/features/onboarding/checklist-state";

const completeFacts: OnboardingChecklistFacts = {
  companyName: "Elpro AB", companyOrganizationNumber: "556123-4567", tenantOrganizationNumber: "5561234567",
  vatDisplay: "company_togglable", vatRateBasisPoints: 2500, termsText: "Villkor", termsApprovedAt: null,
  activeWorkRoles: 1, additionalRoleBearingMembers: 1,
};

test("checklist preserves fixed Swedish outward item order and real destinations", () => {
  assert.deepEqual(ONBOARDING_CHECKLIST_ITEMS.map(({ id, label, href }) => ({ id, label, href })), [
    { id: "company", label: "Företagsinställningar", href: "/settings/company" },
    { id: "vat", label: "Moms & visning", href: "/settings/company" },
    { id: "terms", label: "Offertvillkor", href: "/settings/quote-terms" },
    { id: "pricing", label: "Arbetsroller & priser", href: "/settings/pricing" },
    { id: "users", label: "Bjud in användare", href: "/admin/users" },
  ]);
});

test("each server fact independently controls only its checklist predicate", () => {
  const failures: readonly [keyof OnboardingChecklistFacts, unknown, string][] = [
    ["companyName", " ", "company"], ["vatRateBasisPoints", 10001, "vat"], ["termsText", "", "terms"],
    ["activeWorkRoles", 0, "pricing"], ["additionalRoleBearingMembers", 0, "users"],
  ];
  for (const [field, value, expectedId] of failures) {
    const evaluated = evaluateOnboardingChecklist({ ...completeFacts, [field]: value });
    assert.equal(evaluated.items.find((item) => item.id === expectedId)?.complete, false);
    assert.equal(evaluated.items.filter((item) => !item.complete).length, 1);
    assert.equal(evaluated.workingState, false);
  }
});

test("company identity fails closed for malformed or foreign organization number", () => {
  for (const companyOrganizationNumber of [null, "556677889", "1234567890"]) {
    const state = evaluateOnboardingChecklist({ ...completeFacts, companyOrganizationNumber });
    assert.equal(state.items[0].complete, false);
  }
});

test("persisted terms complete configuration but a null approval remains a separate warning", () => {
  const warning = evaluateOnboardingChecklist(completeFacts);
  assert.equal(warning.items[2].complete, true);
  assert.equal(warning.termsApprovalWarning, true);
  assert.equal(evaluateOnboardingChecklist({ ...completeFacts, termsApprovedAt: "2026-09-20T10:00:00.000Z" }).termsApprovalWarning, false);
});

test("all five green facts produce the working state", () => {
  const state = evaluateOnboardingChecklist(completeFacts);
  assert.equal(state.workingState, true);
  assert.deepEqual(state.items.map((item) => item.complete), [true, true, true, true, true]);
});
