# Epic 14 guarded Compose startup diagnosis — 2026-09-29

## Purpose

This record captures the evidence available after the repeated isolated test-stack startup failure for Story 14.1. It preserves the distinction between guarded admission and proven service and schema readiness.

## Scope and safety boundary

The diagnosis used bounded read-only checks plus one guarded startup attempt and its Stop request. No successful stack startup or populated-data/system configuration changes were demonstrated. It did not reset, prune, remove, or bypass the guarded lifecycle path.

The resource lifecycle contract requires guard-managed admission and readiness before the isolated stack is used. It also prohibits runtime staging, activation, rollback, uninstall, and broad administrative actions from this agent session.

## Environment observations

- The guard Status/List projection was healthy.
- The installed guard package was `0.9.13-4190dac0-09ec-4d36-8e39-173cfcebcea9`; its locator timestamp was `2026-09-27T17:43:25Z`.
- Docker `29.8.0` and Compose `5.5.1` were healthy.
- The active Docker context was `desktop-linux`; its endpoint, `npipe:////./pipe/dockerDesktopLinuxEngine`, matched the adapter requirement.
- The private Compose working directory was `C:\Users\Rasmus\.codex\worktrees\epic14-scheduling\guard-compose-01a0ecb9-r4` using `compose.test.yaml`.
- Compose configuration validation completed with native exit code `0`. The configuration declares five services and two named volumes, uses only read-only in-directory existing binds, and declares no privileged service, build, global network, or fixed container name.

These observations only establish configuration and host-adapter prerequisites. They do not establish that Compose dispatched successfully, that any service is healthy, or that the schema is ready.

## Fresh guarded admission evidence

A fresh root-owned Compose request created lifecycle resource `6dcd6e61-0fd5-4027-a67f-96355d2634ae`.

| Event | Time / result |
| --- | --- |
| Admission accepted | `2026-09-29T14:31:38.7811353Z` |
| Terminal observed | `2026-09-29T14:31:39.6309505Z` |
| Lifecycle state | `start_uncertain` |
| Compose phase | `uncertain` |
| Dispatch | `dispatchCommitted=true` |
| Backend category | `worker-failed` |
| Progress | `worker-failed` |
| Error code | `RETAINED_START_INCOMPLETE` |
| Guard project / Compose exit / failing service | all null |
| Verified outcome | `false` |

The Stop request was submitted once and accepted with native exit code `0`, `ok=true`, `state=stop_requested`, and `verified=false`. Shutdown was not polled.

## Diagnosis

The failure reproduces before the guard exposes a Compose project, service-level failure, or Compose exit code. The installed signed package provides no supplied source or diagnostic documentation, and the public projection discards the specific worker exception. The exact cause is therefore unestablished. No specific repair could be identified from the exposed evidence.

## Required continuation condition

A host/runtime maintainer must expose the worker exception and repair the supported guard startup path. Before `/auto-bmad epic --epic 14` resumes, that repaired path must demonstrate that the isolated services and schema are ready. Until then, the Story 14.1 integration/RLS and browser evidence remains unexecuted, review round count remains zero, and Phase 5 is incomplete.
