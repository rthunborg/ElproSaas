/**
 * File command domain barrel (Story 8.1; architecture §5
 * `src/server/commands/<domain>/`). Re-exports the file commands + their pure
 * validators so callers (Epic 6 attachment/PDF stories, the DB-backed tests) import
 * from one place. Mirrors `calculations/index.ts`.
 */
export {
  createSignedFileAccess,
  createFileLink,
  type SignedFileAccessResult,
  type CreateFileLinkResult,
} from "./files";
export {
  OWNER_TYPES,
  ACTIVE_OWNER_TYPES,
  FILE_PURPOSES,
  isOwnerType,
  isActiveOwnerType,
  isFilePurpose,
  validateSignedAccess,
  validateCreateFileLink,
  type OwnerType,
  type ActiveOwnerType,
  type FilePurpose,
  type SignedAccessInput,
  type CreateFileLinkInput,
} from "./validation";
