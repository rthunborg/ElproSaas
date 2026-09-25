-- Story 13.1 follow-up: the durable cursor determines safe resumption, so
-- terminal timestamps and partial cursor states must stay internally coherent.
alter table public.job_runs
  add constraint job_runs_finished_after_started_check
    check (finished_at is null or finished_at >= started_at),
  add constraint job_runs_cursor_outcome_check
    check ((outcome = 'partial') = (cursor is not null));
