# Epic 13 Context: Notifications and Email Infrastructure

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish Phase B's authenticated background-work foundation, useful in-app notifications, and a reliable email outbox. The epic removes the legacy forged-JWT privileged-cron risk, delivers tenant-isolated user communication, and makes email delivery sandbox-provable while real-recipient delivery remains disabled until a separately recorded owner go-live decision.

## Stories

- Story 13.1: Authenticated Background Runner and Producer Registry
- Story 13.2: In-App Notifications — Bell, Center, and Preferences
- Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)
- Story 13.4: Email Sending Activation

## Requirements & Constraints

- Activate the notifications module and its declared tables when its first surface ships. Derive producers, categories, permissions, and guardrails from active manifest modules; do not create pending-module producers, categories, or placeholder surface.
- Run all Phase B background work through one scheduler-invoked `POST /api/jobs/run` lane. Authenticate with a server-only, at-least-256-bit `CRON_SECRET`, timing-safe comparison, and current/previous secret rotation. Missing, invalid, forged, unsigned, or wrong credentials must receive the same generic 401 with no side effects. Do not decode or authorize an unverified JWT, and do not add pg_cron, Edge Functions, or another execution lane.
- Background producers must be server-contained, explicitly iterate tenants, tenant-scope every query, write audited system events with a null actor and producer-named command, and record bounded chunked run results with sanitized errors. Admins need failure and freshness visibility from run logs; scans must not appear real-time.
- Notifications contain tenant, recipient, stable module-namespaced category, title/body, emit-time deep-link route, and read state. The bell shows every role an unread count capped at `9+`; its popover lists recent items, supports mark-all-read, and links to the full center. The center filters by category/module, read state, and date. Read changes are the permitted optimistic UI case.
- Preferences are per user, category, and channel. Show only the active-module category union, grouped by module; enforce essential categories as non-disableable on the server. Email preferences stay unavailable until the deployment has email delivery enabled. Notification and mail bodies must use the recipient's entitlement projection so unentitled data never appears.
- Email uses tenant-scoped outbox, append-only delivery events, and suppression records. Claim work with `FOR UPDATE SKIP LOCKED`; apply suppression before sending; use bounded retry/backoff and a category/entity/period dedupe key; save the provider message ID before marking a message sent. Statuses are `queued`, `sending`, `sent`, `failed`, and `suppressed`.
- Before sending activation, mail may queue and appear to Admin but must never invoke a provider. Activation must fail closed: absent, invalid, or preview release configuration makes no provider call and leaves mail queued. Sandbox or mock sending only to synthetic recipients proves queued-to-sent delivery. Real recipients require the separate owner go-live record.
- Use the centrally verified sending subdomain, a `[Företagsnamn] via [Systemnamn]` display name, and tenant Reply-To address. Only active-module flows may send, in the defined priority order. Do not duplicate existing Supabase Auth invitation/security mail; Fortnox owns invoice mail; no marketing flow is built.
- Customer quote mail attaches only the current valid snapshot-derived PDF through authorized narrow byte access. Stale or invalid PDFs fail closed. Do not add a public quote view or online acceptance/rejection link. Quote reminders stop on acceptance, rejection, withdrawal, replacement by a new version, and expiry.
- Non-essential mail has a public unsubscribe capability using a hashed 256-bit server-generated token, uniform valid/revoked/unknown responses, revocation, token and IP-hash rate limits, no tenant enumeration, and re-subscribe. It is the limited public unsubscribe route, isolated from authenticated app-shell and tenant-context imports, and has no privileged capability.
- Verify authentication negatives, containment, RLS and tenant isolation, producer idempotency, preference/category derivation, queue concurrency, suppression, retry, dedupe, non-sending behavior, provider contracts, sandbox delivery, fail-closed controls, unsubscribe abuse handling, quote-PDF access, duplicate Auth-mail prevention, and every reminder stop condition.

## Technical Decisions

- Keep the typed producer registry in `src/server/jobs/producers.ts`; each producer declares its identifier, module, category, schedule, and essential status. The scope manifest determines whether it can run. Command-layer emitters may use the same category taxonomy for interactive events.
- Contain service-role access under `src/server/jobs/**` and enforce that client paths cannot import it. Producer work is the sole non-user execution context and remains explicitly tenant-scoped and auditable despite elevated database access.
- Treat absent preference rows as category defaults. Persist notification routes at emission so clients never reconstruct routing decisions.
- Keep provider selection behind `src/server/email/provider.ts`. Separate transactional and marketing classes in the model while implementing transactional delivery only. The adapter must accommodate a later per-tenant sending-domain feature without assuming it now.
- Delivery events record template identity/version, company, recipient, sender and Reply-To, trigger and time, related entity, provider message ID, delivery status/timestamps, bounce timing, and failure reason.
- Use a SHA-256 token lookup for public unsubscribe tokens. Tokens are single-purpose, idempotent, lifecycle-audited, and protected by database-backed fixed-window limits suitable for pilot scale.

## UX & Interaction Patterns

- Every role has a notification bell. The popover uses category icons, one-line content, relative time, unread state, `Markera alla som lästa`, and `Visa alla`; the full center has meaningful empty states and stable deep links.
- Put `Notisinställningar` in the profile menu. Show module-grouped category rows with `I appen` and `E-post` columns; label required notifications and explain unavailable email delivery in Swedish.
- Present producer-fed data as a queue with a freshness stamp, and show producer failures to Admin. The first scheduled notification is the quote follow-up reminder; command events can also notify users.
- The public unsubscribe page is minimal: it confirms the affected mail scope, offers re-subscription, and exposes no tenant identity, application navigation, or authenticated UI.

## Cross-Story Dependencies

- Story 10.1 supplies manifest governance; Epic 10 supplies follow-up data for the first scheduled producer.
- Epic 11 supplies role and Admin visibility foundations. Existing Supabase Auth invitation/security mail remains its own path unless an explicit non-duplicating handoff is made.
- Story 13.1 establishes the runner, containment, registry, and run logging; Story 13.2 builds notification UI and preferences; Story 13.3 creates the dark outbox; Story 13.4 adds sandbox-proven provider delivery and public unsubscribe.
- Later modules use this registry and notification infrastructure only when their own module activates.
