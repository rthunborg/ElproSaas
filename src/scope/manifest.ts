/**
 * The single machine-readable scope manifest (Story 10.1, ADR-B003 §5.1). This is the ONE derived
 * source of truth for what surface exists in each phase — collapsing the four previously
 * independently-authored copies (the file-index deny-list, the nav guardrail expected set, the H4
 * tenant-table inventory, and the deferred-token scope scans) into derivations OFF this constant
 * (§5.3). The Epic 9 retro theme was those four copies drifting; this file is the fix.
 *
 * SHAPE + GUARD (AC2): every module carries the §5.2 field shape; the constant is `satisfies
 * ScopeManifest`-guarded (rejects extra/missing/mistyped fields at `tsc` time, the proven
 * `READINESS_CODES` single-source pattern) AND is validated for coherence by
 * `validateManifestCoherence` (unit suite `tests/unit/scope/manifest-coherence.test.ts`).
 *
 * PHASE A ACTIVE SET (AC2): Phase A originally shipped 7 nav items, 24 tenant tables, and 7 file
 * owner types (Persistent Facts baseline). The current active union is 7 nav items, 27 tenant tables,
 * and 7 file owner types after Epic 10 deepened the active `quotes` module. Every Phase B module is
 * `pending` (no live surface) until its epic's first story flips it `active` in the same PR as the
 * module's first schema/nav change (§5.5). Stories 10.2/10.3/10.8 enrol quote tables into the
 * already-active `quotes` module in the SAME PR as their schema changes — keep its boundary clean
 * and obvious.
 *
 * PARTITION NOTE: module boundaries partition the current active surface exactly (unions must equal
 * the authored 27/7/7; the original Phase A baseline was 24/7/7 — coherence + derivation tests
 * enforce the current partition). `tenant_counters` (quote
 * numbering) is the easy-to-forget quote table; `work_roles`/`articles` (pricing) live under the
 * `/settings/pricing` sub-route so they sit in the `settings` module.
 *
 * ACTIVATED-AT: each active module's `activatedAt` is its delivering-epic Phase A baseline date
 * (Open Question 1's applied default — the validator only checks presence, so the value is honest
 * traceability, not a load-bearing input).
 *
 * [Source: architecture-phase-b.md §5.2 (schema + Phase A baseline), §5.3 (derivations), §5.5
 *  (activation); epics-phase-b.md (Epic 10–34 wave/activation mapping — module ids/waves/tokens);
 *  story 10.1 AC2/AC3, Tasks 2/4/5/6, Dev Notes (initial 24/7/7 partition; deny-list nuance).]
 */
import type { ScopeManifest } from "./manifest-schema";

/**
 * Phase A baseline activation dates per delivering epic (Open Question 1 default). Grounded in the
 * epic retro dates; the validator checks presence only, so these are honest traceability metadata.
 */
const PHASE_A = {
  E1: "2026-06-18", // app shell / dashboard scaffold
  E2: "2026-06-29", // tenancy foundation
  E3: "2026-07-01", // CRM + settings + pricing
  E5: "2026-07-03", // calculations
  E6: "2026-07-05", // quote versions / PDF
  E7: "2026-07-07", // acceptance + basic jobs
  E8: "2026-07-07", // files foundation + limited index
} as const;

export const SCOPE_MANIFEST: ScopeManifest = {
  modules: [
    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE A — the initial `active` modules (wave A). Original baseline: 7 nav / 24 tenant tables /
    // 7 file owner types; current active union: 7 nav / 27 tenant tables / 7 file owner types. Tests
    // enforce the current manifest-derived partition.
    // ═══════════════════════════════════════════════════════════════════════════
    {
      id: "foundation",
      label: "Foundation (tenancy & audit)",
      wave: "A",
      status: "active",
      epic: "E2",
      activatedAt: PHASE_A.E2,
      navItems: [], // nav-less — the tenancy/audit spine, not a user-facing module
      tenantTables: ["tenants", "tenant_memberships", "membership_roles", "audit_events"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "dashboard",
      label: "Dashboard",
      wave: "A",
      status: "active",
      epic: "E1",
      activatedAt: PHASE_A.E1,
      navItems: [{ route: "/dashboard", group: "primary", requiredCapability: "Dashboard.View" }],
      tenantTables: [], // no tenant tables in Phase A (widgets/read-models arrive at E19)
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "crm",
      label: "Kunder",
      wave: "A",
      status: "active",
      epic: "E3",
      activatedAt: PHASE_A.E3,
      navItems: [{ route: "/customers", group: "primary", requiredCapability: "Customers.View" }],
      tenantTables: ["customers", "facilities", "contacts"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: ["customer", "facility", "contact"],
    },
    {
      id: "settings",
      label: "Inställningar",
      wave: "A",
      status: "active",
      epic: "E3",
      activatedAt: PHASE_A.E3,
      // work_roles/articles (pricing) live under the /settings/pricing sub-route → the settings module.
      navItems: [{ route: "/settings", group: "secondary", requiredCapability: "CompanySettings.View" }],
      tenantTables: ["company_settings", "quote_terms", "work_roles", "articles"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "calculations",
      label: "Kalkyler",
      wave: "A",
      status: "active",
      epic: "E5",
      activatedAt: PHASE_A.E5,
      navItems: [{ route: "/calculations", group: "primary", requiredCapability: "Calculations.View" }],
      tenantTables: ["calculations", "calculation_sections", "calculation_rows"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: ["calculation"],
    },
    {
      id: "quotes",
      label: "Offerter",
      wave: "A",
      status: "active",
      epic: "E6",
      activatedAt: PHASE_A.E6,
      navItems: [{ route: "/quotes", group: "primary", requiredCapability: "Quotes.View" }],
      // The quote-family tables. Stories 10.2/10.3 enrolled quote_lost_reasons/quote_follow_ups HERE
      // in the same PRs as their schema changes; Story 10.8 similarly enrolled
      // quote_review_authorizations (ADR-B003 §5.5 / FR129). Keep this boundary clean.
      // tenant_counters is the easy-to-forget quote-numbering table.
      tenantTables: [
        "tenant_counters",
        "quotes",
        "quote_versions",
        "quote_version_lines",
        "quote_version_attachments",
        "quote_events",
        "quote_review_authorizations",
        "quote_acceptances",
        "quote_lost_reasons",
        "quote_follow_ups",
      ],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: ["quote_version", "quote_acceptance"],
    },
    {
      id: "jobs",
      label: "Jobb/Order",
      wave: "A",
      status: "active",
      epic: "E7",
      activatedAt: PHASE_A.E7,
      navItems: [{ route: "/jobs", group: "primary", requiredCapability: "Jobs.ViewAll" }],
      tenantTables: ["jobs", "job_events"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: ["job"],
    },
    {
      id: "files",
      label: "Filer",
      wave: "A",
      status: "active",
      epic: "E8",
      activatedAt: PHASE_A.E8,
      navItems: [{ route: "/files", group: "primary", requiredCapability: "Files.View" }],
      tenantTables: ["files", "file_links"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE B — `pending` modules (declared future surface, NO live surface). Each
    // flips to `active` in its epic's first story, in the same PR as its first
    // schema/nav change (§5.5). The 7 token-bearing modules declare a
    // `deferredFileToken` — the deny-list (`FORBIDDEN_DEFERRED_CATEGORIES`) is the
    // union of these (§5.3 derivation 1). NO OTHER pending module contributes a
    // file token. Note: Epics 16–19 DEEPEN the Phase-A-active `jobs`/`dashboard`
    // modules (no separate pending module); Epic 10 deepens the active `quotes`
    // module. All arrays stay empty until activation.
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Wave B1a ──────────────────────────────────────────────────────────────
    {
      id: "rbac",
      label: "RBAC & Admin User Management",
      wave: "B1a",
      status: "active",
      epic: "E11",
      activatedAt: "2026-09-10",
      navItems: [{ route: "/admin/users", group: "secondary", requiredCapability: "Memberships.Manage" }],
      tenantTables: ["membership_admin_operations"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "provisioning",
      label: "Tenant Provisioning & Onboarding",
      wave: "B1a",
      status: "active",
      epic: "E12",
      // EB-A10: the E12 operator console + platform_operators are PLATFORM-scoped (an enumerated
      // exception class), not a tenant module. Marked here so the schema expresses it; not live in 10.1.
      scope: "platform",
      activatedAt: "2026-09-19",
      navItems: [],
      tenantTables: ["tenant_provisioning_requests", "tenant_provisioning_invites"],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "notifications",
      label: "Notifications & Email",
      wave: "B1a",
      status: "pending",
      epic: "E13",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },

    // ── Wave B1b ──────────────────────────────────────────────────────────────
    {
      id: "resources",
      label: "Resource & Scheduling Foundation",
      wave: "B1b",
      status: "pending",
      epic: "E14",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "scheduling",
      label: "Scheduling, Time Reporting & Calendar Feeds",
      wave: "B1b",
      status: "pending",
      epic: "E15",
      // Future public surface `calendar_feed` (ADR-B004) is declared only on activation (a pending
      // module carries no live/declared public surface — coherence rule 2/3). Empty here.
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },

    // ── Wave B2 ───────────────────────────────────────────────────────────────
    {
      id: "documents",
      label: "Documents Center",
      wave: "B2",
      status: "pending",
      epic: "E20",
      // Aggregation read-model over the existing file model (AR-B16: zero new storage tables).
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "rentals",
      label: "Uthyrning",
      wave: "B2",
      status: "pending",
      epic: "E21",
      deferredFileToken: "rental", // deny-list token until E21 activates
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "assets",
      label: "Utrustning (Assets & QR)",
      wave: "B2",
      status: "pending",
      epic: "E22",
      deferredFileToken: "asset", // deny-list token until E22 activates (public surface asset_qr on activation)
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "service",
      label: "Service & Warranties",
      wave: "B2",
      status: "pending",
      epic: "E23",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "panels",
      label: "Electrical Panels",
      wave: "B2",
      status: "pending",
      epic: "E24",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "suppliers",
      label: "Supplier Data & Imports",
      wave: "B2",
      status: "pending",
      epic: "E25",
      deferredFileToken: "supplier", // deny-list token until E25 activates (file import only in Phase B)
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "billing",
      label: "Billing Basis",
      wave: "B2",
      status: "pending",
      epic: "E26",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },

    // ── Wave B3 ───────────────────────────────────────────────────────────────
    {
      id: "dou",
      label: "DoU (drift & underhåll)",
      wave: "B3",
      status: "pending",
      epic: "E27",
      deferredFileToken: "dou", // deny-list token until E27 activates (manual core; DoU automation stays Phase C)
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "self_inspections",
      label: "Self-Inspections",
      wave: "B3",
      status: "pending",
      epic: "E28",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "tenders",
      label: "Anbud (FKU)",
      wave: "B3",
      status: "pending",
      epic: "E29",
      deferredFileToken: "upphandling", // deny-list token until E29 activates (thin core; tender AI/RAG stays Phase C)
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "knx",
      label: "KNX",
      wave: "B3",
      status: "pending",
      epic: "E30",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "hr",
      label: "HR Depth",
      wave: "B3",
      status: "pending",
      epic: "E31",
      deferredFileToken: "hr", // deny-list token until E31 activates
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "notes",
      label: "Notes & CRM Completions",
      wave: "B3",
      status: "pending",
      epic: "E32",
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
    {
      id: "fortnox",
      label: "Fortnox Integration",
      wave: "B3",
      status: "pending",
      epic: "E33",
      deferredFileToken: "fortnox", // deny-list token until E33 activates (no Fortnox artifact before ADR-B005-final)
      navItems: [],
      tenantTables: [],
      widgets: [],
      notificationCategories: [],
      publicSurfaces: [],
      fileOwnerTypes: [],
    },
  ],
} satisfies ScopeManifest;
