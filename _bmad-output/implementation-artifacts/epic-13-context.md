# Epic 13 Context: Notifications and Email Infrastructure

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish Phase B's first authenticated background-execution capability, together with in-app notifications and a reliable email outbox. The epic prevents the legacy forged-JWT privileged cron vulnerability, gives users timely and tenant-isolated notifications, and proves email delivery in a sandbox while keeping delivery to real recipients disabled until a separately recorded owner go-live decision.

## Stories

- Story 13.1: Authenticated Background Runner and Producer Registry
- Story 13.2: In-App Notifications — Bell, Center, and Preferences
- Story 13.3: Email Outbox Pipeline (Queued, Non-Sending)
- Story 13.4: Email Sending Activation

## Requirements & Constraints

- Activate the `notifications` module with its declared tables and `job_runs` operational table in the same change as the first live surface. The bell and `/notifications` route are live surfaces but the center is not a navigation item. Keep notification categories, producers, tables, permissions, and scope guardrails derived from the active-module manifest; do not add placeholders or producers for pending modules.
- Use one scheduler-invoked `POST /api/jobs/run` lane for all Phase B background work. Authenticate with a server-only, at-least-256-bit `CRON_SECRET` using timing-safe comparison and support current/previous values during rotation. Reject forged, unsigned, `none`-algorithm, garbage, missing, and wrong credentials with the same generic 401 and no side effects. Never decode or authorize from an unverified JWT, and do not introduce pg_cron, Edge Functions, or another execution lane.
- Background producers run only through server-contained code, explicitly iterate tenants, tenant-scope every query, audit system writes with a null actor and producer-named command, and record a bounded, chunked run outcome and sanitized error summary. Admins need failure visibility and freshness information based on run logs; a scan must never imply real-time data.
- Notifications store tenant, recipient user, stable module-namespaced category, title/body, an emit-time-computed deep-link route, and read state. The bell shows an unread count capped at `9+`, lists the latest notifications, supports mark-all-read and deep linking, and the center filters by category/module, read state, and date. Read flips are the permitted optimistic UI case.
- Preferences are per user, category, and channel. The UI renders only the category union backed by active modules, groups it by module, and enforces essential categories as non-disableable on the server. Email preferences remain visibly unavailable until sending is enabled for the deployment. Notification and email content must use the recipient's entitlement projection, so unentitled data never appears in a body or notification.
- The email pipeline uses tenant-scoped outbox, append-only delivery-event, and suppression records. Statuses progress from `queued` through `sending` to `sent`, `failed`, or `suppressed`; queue claims use `FOR UPDATE SKIP LOCKED`; suppression applies before sending; retries are bounded with backoff; and a unique dedupe key by category, subject entity, and period prevents duplicate sends. Store the provider message ID before marking a message sent.
- Before Story 13.4, emails can queue and be visible to Admin but must never invoke a provider or send. Story 13.4 adds the adapter and must fail closed: absent, invalid, or preview release configuration leaves work queued and makes no real-provider call. Sandbox/mock sending to synthetic recipients proves the queued-to-sent path; real-recipient sending needs a separate recorded owner go-live decision.
- The sender uses the centrally verified sending subdomain with display name `[Företagsnamn] via [Systemnamn]` and the tenant's chosen Reply-To address. Implement only active-module flows in priority order: invitations/security, customer quote PDF, internal accept/reject, job assignment or material reschedule, quote reminders, then digests. Do not duplicate existing Supabase Auth invitation/security email. Invoices are sent by Fortnox, and no marketing flow is built.
- Customer quote email attaches the current valid snapshot-derived PDF through authorized narrow byte access. Stale or invalid PDFs fail closed. Do not create a public quote view or online accept/reject link. Quote reminders stop on acceptance, rejection, withdrawal, replacement by a new version, and expiry.
- Non-essential email uses an unsubscribe token. This public capability uses a hashed 256-bit server-generated token, uniform responses for valid/revoked/unknown tokens, revocation, token and IP-hash rate limits, no tenant enumeration, minimal anonymous UI, and re-subscribe. It is the third and final allowed public-token surface, is isolated in the public route group without authenticated app-shell or tenant-context imports, and carries no privileged capability.
- Test permanent authentication negatives, service-context containment, tenant/RLS negatives, producer idempotency, notification preference and category derivation, queue concurrency, suppression, retry, dedupe, non-sending behavior, provider-adapter contracts, sandbox delivery, fail-closed delivery control, unsubscribe abuse cases, valid quote-PDF attachment access, no duplicate Auth mail, and every reminder-stop condition.

## Technical Decisions

- Define a typed producer registry in `src/server/jobs/producers.ts`. Each producer declares its id, module id, category, schedule, and essential flag; the manifest determines whether it is active. Command-layer emitters may share the same category taxonomy for interactive events.
- Keep the service-role context exclusively under `src/server/jobs/**` and extend containment tests so client paths cannot import it. Producer work is the sole non-user execution context and must remain auditable and tenant explicit despite elevated database access.
- Model preferences as user × category × channel, treating a missing preference as the category default. Store notification target routes when emitting; clients consume them without reconstructing destination logic.
- Keep provider selection behind `src/server/email/provider.ts`. Model transactional and marketing classes separately but implement only transactional capability. The adapter must allow a later per-tenant sending-domain addition without assuming one today.
- Delivery logs record message type, template identity and version, company, recipient, sender and reply-to addresses, trigger and time, related entity, provider message ID, delivery status and timestamps, bounce time, and failure reason.
- Public unsubscribe tokens follow the shared public-token design: SHA-256 lookup, single-purpose and idempotent reuse, audited lifecycle changes, and database-backed fixed-window rate-limit counters appropriate for pilot scale.

## UX & Interaction Patterns

- Show the notification bell for every role. The popover uses category icons, one-line text, relative time, unread state, and the actions `Markera alla som lästa` and `Visa alla`; the full center has meaningful empty states and stable deep links.
- Put `Notisinställningar` in the profile menu. Present categories as module-grouped rows with `I appen` and `E-post` columns; label essential notices as required and explain unavailable email delivery in Swedish.
- Treat notifications as a reusable queue pattern: show a freshness stamp, surface producer failures to Admin, and make stale or unavailable data explicit. The first scheduled B1a notification is the quote follow-up reminder, with admin/user events also available.
- The unsubscribe page is a minimal public page that confirms the affected mail scope, offers re-subscription, and exposes no tenant identity, navigation, or other authenticated UI.

## Cross-Story Dependencies

- Story 10.1 provides the scope manifest that activates producers and categories; Epic 10 supplies follow-up data for the first scheduled producer.
- Epic 11 provides role and admin-visibility foundations, and its existing Auth invitation/security mail remains the delivery path until a deliberate non-duplicating handoff.
- Story 13.1 establishes runner, containment, registry, and run logging; Story 13.2 builds notification UI and preferences on that foundation; Story 13.3 adds a dark outbox; Story 13.4 adds sandbox-proven provider delivery and the public unsubscribe surface.
- Later scheduling, service, asset, HR, notes, and export stories consume this registry and notification infrastructure only as their modules activate.
