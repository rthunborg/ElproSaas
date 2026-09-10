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
  generateQuotePdf,
  type GenerateQuotePdfResult,
} from "./generate-pdf";
export {
  markQuoteVersionSent,
  type MarkQuoteVersionSentResult,
} from "./mark-sent";
export {
  createNewQuoteVersion,
  type CreateNewQuoteVersionResult,
} from "./new-version";
export {
  markQuoteVersionLifecycle,
  type MarkQuoteVersionLifecycleResult,
} from "./lifecycle";
export {
  markQuoteVersionLost,
  type MarkQuoteVersionLostResult,
} from "./lost";
export {
  planQuoteFollowUp,
  completeQuoteFollowUp,
  annotateQuoteFollowUp,
  type PlanQuoteFollowUpResult,
  type CompleteQuoteFollowUpResult,
  type AnnotateQuoteFollowUpResult,
} from "./follow-ups";
export {
  captureQuoteAcceptance,
  type CaptureQuoteAcceptanceResult,
} from "./accept";
export {
  acceptQuoteAndCreateJob,
  buildAcceptAndCreateJobRpcArgs,
  type AcceptQuoteAndCreateJobResult,
} from "./accept-and-create-job";
export {
  validateCreateQuoteVersionFromCalculation,
  type CreateQuoteVersionInput,
  validateUpdateDraftQuoteVersion,
  type UpdateDraftQuoteVersionInput,
  validateGenerateQuotePdf,
  type GenerateQuotePdfInput,
  validateMarkQuoteVersionSent,
  type MarkQuoteVersionSentInput,
  validateCreateNewQuoteVersion,
  type CreateNewQuoteVersionInput,
  validateMarkQuoteVersionLifecycle,
  type MarkQuoteVersionLifecycleInput,
  type QuoteLifecycleTransition,
  validateMarkQuoteVersionLost,
  type MarkQuoteVersionLostInput,
  type QuoteLostOutcome,
  type QuoteLostCategory,
  validatePlanQuoteFollowUp,
  type PlanQuoteFollowUpInput,
  validateCompleteQuoteFollowUp,
  type CompleteQuoteFollowUpInput,
  validateAnnotateQuoteFollowUp,
  type AnnotateQuoteFollowUpInput,
  validateCaptureQuoteAcceptance,
  type CaptureQuoteAcceptanceInput,
  validateAcceptQuoteAndCreateJob,
  type AcceptQuoteAndCreateJobInput,
} from "./validation";

export {
  createQuotePdfSignedAccess,
  type QuotePdfSignedAccessResult,
} from "./quote-pdf-signed-access";