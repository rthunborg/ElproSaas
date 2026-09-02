/**
 * Story 10.9 — the carry-forward dialog is deliberately a plain progressive-enhancement form:
 * the static form fields are the contract even when JavaScript has not hydrated.  This focused
 * render test needs neither a browser nor a database; the command/action integration owns the
 * server-side revalidation.
 */
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/quotes/actions", () => ({
  createNewQuoteVersionAction: vi.fn(),
}));

import { CreateNewVersionButton } from "@/components/quotes/CreateNewVersionButton";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const ELIGIBLE_FILE_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_ELIGIBLE_FILE_ID = "44444444-4444-4444-8444-444444444444";

function renderSelection(props: Partial<ComponentProps<typeof CreateNewVersionButton>> = {}) {
  return renderToStaticMarkup(
    createElement(CreateNewVersionButton, {
      quoteId: QUOTE_ID,
      quoteVersionId: VERSION_ID,
      predecessorAttachments: [
        { fileId: ELIGIBLE_FILE_ID, displayName: "Ritning.pdf" },
        { fileId: SECOND_ELIGIBLE_FILE_ID, displayName: "Underlag.pdf" },
      ],
      ...props,
    }),
  );
}

describe("CreateNewVersionButton — attachment re-selection form", () => {
  it("[P1] shows only eligible predecessors as initially checked selections and explains omitted attachments", () => {
    const html = renderSelection({ omittedPredecessorAttachmentCount: 2 });

    expect(html).toContain("Bilagor som fortfarande kan följa med är förvalda.");
    for (const [fileId, displayName] of [
      [ELIGIBLE_FILE_ID, "Ritning.pdf"],
      [SECOND_ELIGIBLE_FILE_ID, "Underlag.pdf"],
    ]) {
      expect(html).toMatch(
        new RegExp(
          `<input(?=[^>]*type="checkbox")(?=[^>]*name="attachment_file_ids")(?=[^>]*value="${fileId}")(?=[^>]*checked)[^>]*>`,
        ),
      );
      expect(html).toContain(displayName);
    }
    expect(html).toContain('data-testid="create-new-version-attachments-omitted"');
    expect(html).toContain(
      "En eller flera tidigare bilagor är inte längre tillgängliga och följer inte med i den nya versionen.",
    );
  });

  it("[P1] carries the explicit-selection marker, so a user who deselects every checkbox submits copy-none", () => {
    const html = renderSelection();

    // Native form submission omits unchecked checkboxes.  This hidden marker is rendered whenever
    // there were eligible choices, so the browser submits it even after the user unchecks both;
    // createNewQuoteVersionAction maps exactly this payload to attachment_file_ids: [].
    expect(html).toMatch(
      /<input(?=[^>]*type="hidden")(?=[^>]*name="attachment_selection_present")(?=[^>]*value="1")[^>]*>/,
    );
    expect(html).toContain('name="attachment_file_ids"');
    expect(html).toContain('data-testid="create-new-version-form"');
  });
});
