/**
 * Job command domain barrel (Story 7.3 + standalone job creation 2026-07-14; architecture §5
 * `src/server/commands/<domain>/`). Re-exports the `updateJob` allowed-edit command, the
 * `createJob` standalone-create command, and their pure validators/types so callers (the `/jobs`
 * server actions, the DB-backed tests) import from one place. Mirrors `crm/`, `files/`.
 */
export { updateJob, type JobCommandResult } from "./jobs";
export { createJob } from "./create-job";
export {
  validateCreateJob,
  validateUpdateJob,
  JOB_STATUS_VALUES,
  type CreateJobInput,
  type UpdateJobInput,
  type JobStatusValue,
} from "./validation";
