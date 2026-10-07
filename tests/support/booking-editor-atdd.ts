/**
 * TEST-OWNED engineering adapter contract for Story 14.4; these names are NOT
 * production exports or invented HTTP endpoints. Loader fails until real binding.
 *
 * Implement using actual editor-preview/action/read (once present), createBooking/
 * updateBooking + runCommand, checked snapshot/finalize RPC and sole detectConflicts.
 * Preserve raw browser DTO for leak assertions and real Result errors verbatim.
 * Normalization below is test-owned only; do not force this DTO onto production.
 * Never synthesize command success, SQL replies, receipts, acceptance or readback.
 *
 * Local setup: withConflictFixture provides independent tenant A/B and actual
 * schedules. seedMixed must use real checked commands for peers, reserving a
 * stable proposed create UUID that sorts THIRD among >=4 same-person participants.
 * Seed one unrelated tenant-A conflict and one tenant-B conflict as controls.
 * Arrange >=2 candidate groups (capacity + overlap) and return independent expected
 * identities from literal seeded intervals/IDs, never from the preview under test.
 * Preserve sole-engine logical identity BEFORE v1/v2 translation. A group maps ALL
 * base/association natural keys. Do not infer group identity from row endpoints.
 *
 * Temporary fault hooks are local test-only correlation-scoped triggers, revoked
 * from public/anon/authenticated/service_role, cleaned in finally. after_acceptance
 * must prove the acceptance UPDATE was reached before raising; before_audit must
 * prove accepted rows existed in the same transaction before the audit exception.
 * Rollback snapshots include all columns/private create_* and update_outcomes and
 * all audit rows for both tenants through bookingSnapshot. Never strip timestamps.
 *
 * Barrier observers wrap the REAL client RPC and pause only after actual snapshot/
 * before finalize. Gates/role revocation must observe pg_blocking_pids through
 * waitForBlocked; expire using SQL clock with a genuinely signed short lifetime,
 * not arbitrary sleeps or altered unsigned claims. Renew transport with real signer.
 * signedAttack re-signs intentional invalid authenticated claims with REAL receipt
 * signer to exercise binding/group validation past HMAC (never fake verification).
 * SQL inventory is discovered from actual pg_proc/migrations including old overloads;
 * do not assume just the current TS wrapper is the only authenticated fresh entry.
 */
import type { BookingFixture, BookingInput, DurableRow } from "./bookings-atdd";
import type { TestServerClient } from "../factories/tenants";
import type { Operation } from "./booking-conflicts-atdd";

export type LogicalIdentity = {
  naturalKey: string; conflictType: string; bookingIds: string[];
  affectedPersonIds: string[]; startsAt: string; endsAt: string;
};
export type LogicalGroup = LogicalIdentity & { persistedKeys: string[] };
export type Warning = LogicalIdentity & {
  ruleLabel: string; personLabels: string[];
  collisions: { bookingId: string; startsAt: string; endsAt: string }[];
};
export type ReceiptClaims = {
  domain: string; tenantId: string; actorId: string; operation: Operation;
  bookingId: string; candidateDigest: string; factDigest: string;
  engineVersion: string; configVersion: string; issuedAt: string; expiresAt: string;
  canonicalCandidate: Record<string, unknown>; groups: LogicalGroup[];
};
export type Preview = {
  bookingId: string; warnings: Warning[];
  availability: { personId: string; state: "available" | "conflict" | "unknown" }[];
  receipt: string; rawBrowserPayload: unknown;
};
export type Decision = {
  acknowledged: boolean; reviewedLogicalIds: string[]; selectedLogicalIds: string[];
  reason: string; receipt: string;
};
export type EditorInput = BookingInput & { proposedCreateId?: string; decision?: Decision };
export type Result =
  | { ok: true; data: { bookingId: string } }
  | { ok: false; code: string; message: string };
export type PreviewResult = { ok: true; data: Preview } | { ok: false; code: string; message: string };
export type Scenario = {
  input: EditorInput; expectedGroups: LogicalGroup[]; selected: LogicalGroup;
  unrelatedKeys: string[]; otherReviewedKeys: string[]; peerIds: string[];
  foreignBookingId: string; ownBookingIds: string[]; coworkerOnlyBookingId: string;
  /** Canonical exact input captured from production validation, without decision transport. */
  canonicalCandidate: Record<string, unknown>;
};
export type RpcReply = { data: unknown; error: { code: string; message?: string } | null };
export type SqlEntry = { signature: string; name: string; args: Record<string, unknown> };
export type SqlAcl = {
  signature: string; publicExecute: boolean; anonExecute: boolean;
  authenticatedExecute: boolean; serviceRoleExecute: boolean;
};
export type Observation = {
  result: Result; snapshots: number; finalizations: number;
  /** Actual finalization result kinds, not fixture-generated statuses. */
  finalizationKinds: string[];
};
export interface EditorBindings {
  sourceEvidence: string[];
  seedMixed(fx: BookingFixture, operation?: Operation): Promise<Scenario>;
  /** Independently seeded expected groups; no reading expectations from preview output. */
  seedConflictFree(fx: BookingFixture): Promise<{ input: EditorInput }>;
  /** Fresh command/stable UUID on same current facts, same-person intersecting interval. */
  competingCandidate(fx: BookingFixture, original: Scenario): Promise<Scenario>;
  preview(client: TestServerClient, operation: Operation, input: EditorInput): Promise<PreviewResult>;
  save(client: TestServerClient, operation: Operation, input: EditorInput, correlationId: string): Promise<Result>;
  /** Server/test-only genuine verification returns claims, NEVER a browser function. */
  verifyReceipt(receipt: string): Promise<ReceiptClaims>;
  /** Private output/proof, for assertions of exclusion and substitution only. */
  privateAttempt(client: TestServerClient, operation: Operation, input: EditorInput): Promise<{
    proofTransport: string; outputText: string; factMarkers: string[]; signature: string;
  }>;
  /** Rebind REAL issuance/correlation/validity/signature for same human business decision. */
  renewedTransport(fx: BookingFixture, input: EditorInput): Promise<EditorInput>;
  signedAttack(fx: BookingFixture, scenario: Scenario, preview: Preview,
    attack: "forged-receipt" | "partial-logical-group" | "unrelated-logical-group" |
      "wrong-tenant" | "wrong-actor" | "wrong-candidate" | "wrong-target" |
      "wrong-operation" | "different-preview" | "client-detector-fields"): Promise<EditorInput>;
  /** Must bypass TS validation and invoke actual checked authenticated RPC. */
  direct(client: TestServerClient, operation: Operation, input: EditorInput,
    options?: { detectorProofAsReceipt?: boolean; receiptAsDetectorProof?: boolean;
      omitDecision?: boolean; spoofAcceptance?: boolean }): Promise<RpcReply>;
  /** Force genuine receipt expiry via SQL clock then stale fresh save. */
  expireReceipt(fx: BookingFixture, input: EditorInput): Promise<EditorInput>;
  changeFacts(fx: BookingFixture, kind: "schedule" | "concurrent-booking"): Promise<void>;
  changedCandidate(fx: BookingFixture, input: EditorInput,
    kind: "time" | "assignees" | "connections" | "status"): Promise<EditorInput>;
  observeSave(client: TestServerClient, operation: Operation, input: EditorInput,
    correlationId: string, beforeFinalize: () => Promise<void>): Promise<Observation>;
  /** Downgrade planner to saljare removing secondary grants via actual admin writer;
   * observe a blocked replay before committing revocation and release gate, so role
   * revalidation AFTER waits is exercised. Restore all authority in finally. */
  withRevokedPlanner(fx: BookingFixture, run: (client: TestServerClient) => Promise<void>): Promise<void>;
  withFault<T>(fx: BookingFixture, correlationId: string,
    stage: "after_acceptance" | "before_audit", run: () => Promise<T>): Promise<{
      value: T; reached: boolean; acceptedKeysObserved: string[];
    }>;
  /** Raw checked browser read DTO with no secret/history projection. */
  read(client: TestServerClient): Promise<{ bookings: DurableRow[]; conflicts: DurableRow[];
    openCounts: Record<string, number>; rawBrowserPayload: unknown }>;
  /** Normalizes exact UTC microseconds only; workflow values/keys remain unchanged. */
  normalizedConflicts(rows: DurableRow[]): DurableRow[];
  /** Collision time edit to a known DIFFERENT logical identity, reviewed afresh. */
  changedCollision(fx: BookingFixture, scenario: Scenario): Promise<{
    input: EditorInput; oldKeys: string[]; expectedNewGroups: LogicalGroup[];
  }>;
  foreignReference(fx: BookingFixture, scenario: Scenario,
    ref: "assignee" | "job" | "customer" | "facility" | "contact" | "booking"): Promise<EditorInput>;
  sqlInventory(fx: BookingFixture, scenario: Scenario): Promise<{
    checked: SqlEntry[]; obsoleteFinalize: SqlEntry[]; private: SqlEntry[];
  }>;
  sqlAcls(entries: SqlEntry[]): Promise<SqlAcl[]>;
  /** Removes only human review, preserving OTHERWISE VALID current detector proof. */
  invokeWithoutReview(client: TestServerClient, entry: SqlEntry): Promise<RpcReply>;
}

/** Typed fail-closed activation seam. Replace body with actual production adapters;
 * do not add a fake implementation or switch skips to pass-through fixture responses.
 */
export async function loadBookingEditorBindings(): Promise<EditorBindings> {
  throw new Error("14.4 RED: real editor preview receipt, decision command/RPC and audited override bindings are not implemented. Bind actual production code before unskipping.");
}
