/**
 * File command domain barrel (Story 8.1; architecture §5
 * `src/server/commands/<domain>/`). Re-exports the file commands + their pure
 * validators so callers (Epic 6 attachment/PDF stories, the DB-backed tests) import
 * from one place. Mirrors `calculations/index.ts`.
 */
export {
  createSignedFileAccess,
  createFileLink,
  uploadFile,
  archiveFile,
  type SignedFileAccessResult,
  type CreateFileLinkResult,
  type UploadFileResult,
  type ArchiveFileResult,
} from "./files";
export {
  OWNER_TYPES,
  ACTIVE_OWNER_TYPES,
  FILE_PURPOSES,
  OWNER_TYPE_PURPOSE,
  isOwnerType,
  isActiveOwnerType,
  isFilePurpose,
  validateSignedAccess,
  validateCreateFileLink,
  validateUploadFile,
  validateArchiveFile,
  type OwnerType,
  type ActiveOwnerType,
  type FilePurpose,
  type SignedAccessInput,
  type CreateFileLinkInput,
  type UploadFileInput,
  type ArchiveFileInput,
} from "./validation";
