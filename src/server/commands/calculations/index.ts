/**
 * Calculation command domain barrel (Story 5.1; architecture §5
 * `src/server/commands/<domain>/`). Re-exports the calc lifecycle + section/row +
 * atomic-reorder commands and their pure validators so callers (Story 5.2 server
 * actions, the DB-backed tests) import from one place.
 */
export {
  createCalculation,
  updateCalculation,
  archiveCalculation,
  type CalcCommandResult,
} from "./calculations";
export { createSection, updateSection, archiveSection } from "./sections";
export { createRow, updateRow, archiveRow } from "./rows";
export { reorderRows, reorderSections } from "./reorder";
export {
  ROW_TYPES,
  CALC_STATUSES,
  SECTION_DISPLAY_MODES,
  validateCreateCalculation,
  validateUpdateCalculation,
  validateArchiveCalc,
  validateCreateSection,
  validateUpdateSection,
  validateArchiveSection,
  validateCreateRow,
  validateUpdateRow,
  validateArchiveRow,
  validateReorderRows,
  validateReorderSections,
  type RowType,
  type CalcStatus,
  type SectionDisplayMode,
  type CreateCalculationInput,
  type UpdateCalculationInput,
  type ArchiveCalcInput,
  type CreateSectionInput,
  type UpdateSectionInput,
  type CreateRowInput,
  type UpdateRowInput,
  type ReorderRowsInput,
  type ReorderSectionsInput,
} from "./validation";
