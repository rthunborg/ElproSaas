# ADR-B013: Kopplas product name and compatibility

Status: **Accepted** — owner approved the rename proposal on 2026-10-09 and
directed implementation, including the GitHub repository and local directory.

## Decision

The application is **Kopplas**; lowercase technical names use **kopplas**.
The existing Supabase project is named Kopplas and the Vercel project kopplas.
Retain their existing project IDs, database contents, credentials, and tenant
identities. Rename the GitHub repository to `rthunborg/Kopplas` and the checkout
to `C:\DEV\Kopplas` after in-flight work finishes.

The owner identifies `kopplas.se`, `kopplas.io`, and `kopplas.com` as **future
domains**. This does not establish a current primary origin or authorize domain
purchase. Keep the verified current deployment origin until a domain cutover is
explicitly configured and verified. All auth callback and monitor targets must
agree with that origin; never infer a working domain from its spelling.

This ADR authorizes task **KOPPLAS-RENAME-2026-10-09**: current branding, package
names, workflow configuration, working documentation, disposable fixtures,
environment-variable aliases, and coordinated repository/local naming. It adds
no module, public capability, schema feature, dependency, or Phase C surface.
Existing epic/story IDs and statuses remain unchanged.

## Compatibility exceptions

These are stable technical contracts, not the product display name:

- Versioned `elpro.*.v1` HMAC, key-derivation, encryption, replay-lock and review
  domains. Preserve deployed SQL mirrors and signed bytes.
- `elpro.booking-create-id.v1`: changing it changes deterministic booking IDs
  and breaks previously committed command replay.
- `elpro_file_linked_at`: existing Storage metadata participates in immutable
  object protection, including the queued-update race.
- `elpro_pilot_backup`: existing Drive backup discovery, ownership, recovery,
  and retention depend on this exact marker.
- The deployed Cloudflare Worker identity remains
  `elpro-pilot-availability-monitor` until its state/history and Cron can be
  migrated safely. Package names, messages, and user agents use Kopplas.
- Existing external profile credentials or resource registrations may retain
  their old identity until their replacement is verified. Never strand a
  credential or relaunch resources under a different name to escape a refusal.

Existing migration files, frozen Phase A planning, historical evidence and
completed execution/review records remain intact. Historical Elpro/ElproSaas
references identify Kopplas before this decision. Existing tenant legal names,
Auth identities, quote snapshots and PDFs are not rewritten by a branding task.

Prefer `KOPPLAS_QUOTE_SEND_TRACK` over the legacy setting name, with a temporary
legacy-only fallback. Conflicting or invalid values must preserve the safe
`real_customer` mode; default is `real_customer`. Keep monitor environment aliases
until all consumers have migrated. Remove aliases only in a verified later
change, never on a guessed deadline.

## Execution and verification

Use a boundary-aware inventory of remaining old-name references. Every retained
current reference needs a compatibility or external-identity explanation;
historical records are a separately identified immutable category.

Ordinary branding and documentation use Sol 6.1 Low. Environment behavior that
affects tax gates, auth origins, cryptographic/storage/replay contracts, or
backup deletion eligibility requires a recorded Sol 6.1 High handoff and
independent review. Preserve the existing test and scope gates.

Record outcomes and unresolved operational work in
`docs/process/kopplas-rename-status.md`. Report repository verification separately
from hosted deployment, DNS, callback, and profile evidence. No test email is
sent to a person without explicit authorization.

## References

- [Approved proposal](../../_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-09-kopplas-rename.md)
- [Agent routing](../process/agent-model-routing.md)
- [Local setup](../process/local-setup.md)
