/**
 * Story 8.2 — coverage-expansion UNIT pins for the SHARED object-byte upload helper
 * (`src/server/storage/upload-object.ts`, Task 3.3) — 8.2-UNIT-06 (P0, AC4, R-807).
 *
 * `uploadObjectWithMetadata` is the extracted 6.3 "id-up-front → object write → verified-
 * compensated metadata" seam BOTH the generic `uploadFile` command and (later) the 6.3 PDF
 * path can share. Its verified-compensated branch table is proven END-TO-END only by the
 * DB-backed INT (8.2-INT-05), which SKIPS when no local Supabase stack is up. This file pins
 * every branch cheaply and NON-SKIPPABLY with injected fakes (pure, no DB, no PII):
 *
 *   - happy path: object uploaded (tenant-first server-derived path, correct contentType +
 *     upsert), files row inserted with the object path, link inserted with the up-front id,
 *     returns { fileId, objectPath, linkId };
 *   - storage fault → throws BEFORE any metadata write (nothing persisted → nothing to
 *     compensate); a storage fault is TRANSIENT (surfaces as a plain Error → SERVER_ERROR);
 *   - link-insert fault AFTER the files row was written → ARCHIVE that file id (archive-over-
 *     delete — 8.1 has no reclamation) then re-throw the ORIGINAL error (never a false success);
 *   - archive secondary-fault is SWALLOWED — the ORIGINAL error still surfaces;
 *   - files-row-insert fault (before any row written) → does NOT archive (nothing to undo).
 *
 * [Source: story 8.2 Task 3.3 / Task 6.2; src/server/storage/upload-object.ts;
 *  src/server/storage/object-path.ts (deriveObjectPath tenant-first); epics.md 8.2 AC4;
 *  test-design-epic-8.md §"Storage↔DB consistency" (R-807 storage side)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uploadObjectWithMetadata,
  TENANT_FILES_BUCKET,
  type UploadStorageClient,
} from "@/server/storage/upload-object";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FILE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LINK_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const BYTES = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

interface UploadCall {
  readonly bucket: string;
  readonly path: string;
  readonly contentType?: string;
  readonly upsert?: boolean;
}

/** A fake RLS storage client whose `.upload` records the call and returns a configured result. */
function fakeClient(uploadResult: { error: { message?: string } | null }, calls: UploadCall[]): UploadStorageClient {
  return {
    storage: {
      from(bucket: string) {
        return {
          async upload(path, body, options) {
            void body;
            calls.push({ bucket, path, contentType: options.contentType, upsert: options.upsert });
            return { data: uploadResult.error ? null : {}, error: uploadResult.error };
          },
        };
      },
    },
  };
}

test("[8.2-UNIT-06a][P0/AC4] happy path: object + files + link written, returns ids; path is tenant-first server-derived", async () => {
  const calls: UploadCall[] = [];
  const filesInserted: string[] = [];
  const linksInserted: string[] = [];

  const result = await uploadObjectWithMetadata({
    client: fakeClient({ error: null }, calls),
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "kundavtal.pdf",
    mimeType: "application/pdf",
    bytes: BYTES,
    insertFileRow: async (objectPath) => {
      filesInserted.push(objectPath);
    },
    insertLinkRow: async (fileId) => {
      linksInserted.push(fileId);
      return LINK_ID;
    },
    archiveFileRow: async () => {
      throw new Error("archive must NOT be called on the happy path");
    },
  });

  // The returned object path is `{tenantId}/{fileId}/{sanitizedName}` — tenant-first, never a client path.
  const expectedPath = `${TENANT_ID}/${FILE_ID}/kundavtal.pdf`;
  assert.deepEqual(result, { fileId: FILE_ID, objectPath: expectedPath, linkId: LINK_ID });

  // The object was uploaded to the single private bucket with the derived path, mime, upsert.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bucket, TENANT_FILES_BUCKET);
  assert.equal(calls[0].path, expectedPath);
  assert.equal(calls[0].contentType, "application/pdf");
  assert.equal(calls[0].upsert, true);

  // The files row got the SAME derived path; the link got the up-front file id.
  assert.deepEqual(filesInserted, [expectedPath]);
  assert.deepEqual(linksInserted, [FILE_ID]);
});

test("[8.2-UNIT-06b][P0/AC4] a storage fault throws BEFORE any metadata write (nothing to compensate)", async () => {
  const calls: UploadCall[] = [];
  let fileInsertCalled = false;
  let archiveCalled = false;

  await assert.rejects(
    uploadObjectWithMetadata({
      client: fakeClient({ error: { message: "storage down" } }, calls),
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      displayName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      insertFileRow: async () => {
        fileInsertCalled = true;
      },
      insertLinkRow: async () => LINK_ID,
      archiveFileRow: async () => {
        archiveCalled = true;
      },
    }),
    /file upload failed/,
  );

  assert.equal(calls.length, 1, "the object upload was attempted");
  assert.equal(fileInsertCalled, false, "NO files row is inserted after a storage fault");
  assert.equal(archiveCalled, false, "nothing was persisted, so nothing is compensated");
});

test("[8.2-UNIT-06c][P0/AC4/R-807] a link fault AFTER the files row is written ARCHIVES that file id then re-throws the ORIGINAL error", async () => {
  const calls: UploadCall[] = [];
  const archived: string[] = [];
  const originalError = new Error("link insert failed");

  await assert.rejects(
    uploadObjectWithMetadata({
      client: fakeClient({ error: null }, calls),
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      displayName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      insertFileRow: async () => {
        /* files row written */
      },
      insertLinkRow: async () => {
        throw originalError;
      },
      archiveFileRow: async (fileId) => {
        archived.push(fileId);
      },
    }),
    (err: unknown) => err === originalError, // the ORIGINAL error, not an archive/secondary one
  );

  // Archive-over-delete: the written files row is archived (no usable orphan); object left.
  assert.deepEqual(archived, [FILE_ID]);
});

test("[8.2-UNIT-06d][P0/AC4] an archive secondary-fault is SWALLOWED — the ORIGINAL error still surfaces", async () => {
  const calls: UploadCall[] = [];
  const originalError = new Error("link insert failed");

  await assert.rejects(
    uploadObjectWithMetadata({
      client: fakeClient({ error: null }, calls),
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      displayName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      insertFileRow: async () => {},
      insertLinkRow: async () => {
        throw originalError;
      },
      archiveFileRow: async () => {
        throw new Error("archive ALSO failed");
      },
    }),
    (err: unknown) => err === originalError, // the caller sees the ORIGINAL fault, not the archive fault
  );
});

test("[8.2-UNIT-06e][P0/AC4] a files-row-insert fault (before any row is written) does NOT archive", async () => {
  const calls: UploadCall[] = [];
  let archiveCalled = false;
  const originalError = new Error("files insert failed");

  await assert.rejects(
    uploadObjectWithMetadata({
      client: fakeClient({ error: null }, calls),
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      displayName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      insertFileRow: async () => {
        throw originalError;
      },
      insertLinkRow: async () => LINK_ID,
      archiveFileRow: async () => {
        archiveCalled = true;
      },
    }),
    (err: unknown) => err === originalError,
  );

  // The files row was never written, so there is nothing to archive.
  assert.equal(archiveCalled, false);
});

test("[8.2-UNIT-06f][P0] compensation is best-effort: a link fault WITHOUT an archiveFileRow still re-throws the original error", async () => {
  const calls: UploadCall[] = [];
  const originalError = new Error("link insert failed");

  await assert.rejects(
    uploadObjectWithMetadata({
      client: fakeClient({ error: null }, calls),
      tenantId: TENANT_ID,
      fileId: FILE_ID,
      displayName: "x.pdf",
      mimeType: "application/pdf",
      bytes: BYTES,
      insertFileRow: async () => {},
      insertLinkRow: async () => {
        throw originalError;
      },
      // no archiveFileRow provided — the helper must still re-throw, not swallow.
    }),
    (err: unknown) => err === originalError,
  );
});
