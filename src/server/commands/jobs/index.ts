/**
 * Job command domain barrel (Story 7.3; architecture §5 `src/server/commands/<domain>/`).
 * Re-exports the `updateJob` allowed-edit command + its pure validator/types so callers (the
 * `/jobs` server action, the DB-backed tests) import from one place. Mirrors `crm/`, `files/`.
 */
export { updateJob, type JobCommandResult } from "./jobs";
export {
  validateUpdateJob,
  JOB_STATUS_VALUES,
  type UpdateJobInput,
  type JobStatusValue,
} from "./validation";
