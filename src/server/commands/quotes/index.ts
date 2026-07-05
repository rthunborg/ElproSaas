/**
 * Quote command domain barrel (Story 6.1; architecture §5
 * `src/server/commands/<domain>/`). Re-exports the quote-version creation command +
 * its pure validator so callers (later 6.x server actions, the DB-backed tests)
 * import from one place.
 */
export {
  createQuoteVersionFromCalculation,
  type CreateQuoteVersionResult,
} from "./quotes";
export {
  updateDraftQuoteVersion,
  type UpdateDraftQuoteVersionResult,
} from "./update-draft";
export {
  validateCreateQuoteVersionFromCalculation,
  type CreateQuoteVersionInput,
  validateUpdateDraftQuoteVersion,
  type UpdateDraftQuoteVersionInput,
} from "./validation";
