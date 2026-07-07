/**
 * Story 8.2 — code-review PATCH pin: the `EntityFilePanel` `ownerType` prop must be sourced
 * from the single-source-of-truth `ActiveOwnerType` union (derived from `ACTIVE_OWNER_TYPES`),
 * NOT a hand-written literal union that can silently drift from `readEntityFiles`'s
 * `ActiveOwnerType`-typed `ownerType`.
 *
 * This is a COMPILE-TIME assertion: `TypeEqual<EntityFilePanelProps["ownerType"], ActiveOwnerType>`
 * only resolves to `true` when the two types are EXACTLY equal. If someone re-hand-writes the
 * panel prop as a literal union and `ACTIVE_OWNER_TYPES` later changes, this pin fails
 * `tsc --noEmit` (the fast gate) with a type error — closing the drift the review flagged.
 * The runtime `node --test` body just anchors the assertions so the file executes green.
 *
 * [Source: story 8.2 Review Findings — [Review][Patch][Med] EntityFilePanel ownerType drift;
 *  src/components/files/EntityFilePanel.tsx; src/server/commands/files/validation.ts
 *  (ACTIVE_OWNER_TYPES / ActiveOwnerType); src/features/files/read.ts (readEntityFiles)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EntityFilePanelProps } from "@/components/files/EntityFilePanel";
import type { ActiveOwnerType } from "@/server/commands/files/validation";
import { ACTIVE_OWNER_TYPES } from "@/server/commands/files/validation";

/** Exact type equality (invariant both ways) — resolves to `true` only when A ≡ B. */
type TypeEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** A compile-time `true` iff the panel prop type is EXACTLY `ActiveOwnerType`. */
type PanelOwnerTypeIsActiveOwnerType = TypeEqual<
  EntityFilePanelProps["ownerType"],
  ActiveOwnerType
>;

// If the panel prop drifts from `ActiveOwnerType`, this assignment fails `tsc --noEmit`.
const _ownerTypePinnedToActiveUnion: PanelOwnerTypeIsActiveOwnerType = true;

test("[8.2-PATCH] EntityFilePanel.ownerType is sourced from ActiveOwnerType (no drift)", () => {
  // The compile-time pin is the real guard; assert it at runtime too for a green execution.
  assert.equal(_ownerTypePinnedToActiveUnion, true);

  // Every active owner type is a valid panel ownerType (assignable — no widening/narrowing).
  for (const owner of ACTIVE_OWNER_TYPES) {
    const asProp: EntityFilePanelProps["ownerType"] = owner;
    assert.equal(asProp, owner);
  }
});
