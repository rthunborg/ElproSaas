-- Story 13.1 convergence: a failed bounded producer page must retain the
-- checkpoint it received. The latest failed row is authoritative for retry;
-- completed rows still carry no cursor and therefore clear older checkpoints.

alter table public.job_runs
  drop constraint job_runs_cursor_outcome_check,
  add constraint job_runs_cursor_outcome_check check (
    (outcome = 'partial' and cursor is not null)
    or outcome = 'failed'
    or (outcome in ('running', 'completed') and cursor is null)
  );
