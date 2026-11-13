# Tamark Solar Energy — Production Readiness Tracker

> **Authoritative project tracker.** Before changing a feature, read its status, dependencies, acceptance criteria, and evidence here. After a change, update this document with what changed and the actual test output. `IMPLEMENTED` is not `TESTED`; `TESTED` is not `APPROVED FOR PRODUCTION`. Never claim production approval without passing the listed acceptance criteria and recording review evidence.

**Baseline reviewed:** 2026-11-06  
**Project root:** this document's directory  
**Current release stage:** Pre-production engineering; production approval is not established  
**Document history:** No prior `TAMARK_PRODUCTION_READINESS.md` was present during this baseline. This initial tracker records the current repository and prior validation evidence without replacing or deleting other project documentation.

## Dashboard

The inventory below contains 27 product modules, including two new modules for the gallery and certificates. Payment modules are marked decommissioned, not supported. Module status is assigned from repository evidence, not inferred from a visible interface. Detailed acceptance evidence remains incomplete for every module; checks that have run are recorded separately in [Validation evidence](#validation-evidence).

| Status | Count |
|---|---:|
| Total tracked product modules | 27 |
| Not started | 4 |
| In progress | 2 |
| Implemented (acceptance not yet established) | 16 |
| Tested against full module acceptance criteria | 0 |
| Approved for production | 0 |
| Blocked | 1 |
| Decommissioned | 4 |

**Critical outstanding issues:** a user-reported Supabase migration attempt failed because required enum labels/columns were unavailable; the current database state is unknown and must be inspected read-only before retrying. The migration chain is not validated. There is no concurrency/load-test evidence; cohort seat-capacity allocation is absent; private application-document handling is absent; backup restoration, production monitoring, and release gates have no recorded operational evidence.

## Table of contents

- [Project overview](#project-overview)
- [Brand assets and icons](#brand-assets-and-icons)
- [Architecture and baseline review](#architecture-and-baseline-review)
- [Status and evidence rules](#status-and-evidence-rules)
- [Product modules](#product-modules)
- [Database and data integrity](#database-and-data-integrity)
- [Authentication and security](#authentication-and-security)
- [Payment and financial integrity](#payment-and-financial-integrity)
- [Concurrency and scalability](#concurrency-and-scalability)
- [Performance, reliability, and caching](#performance-reliability-and-caching) 
- [Mobile responsiveness and accessibility](#mobile-responsiveness-and-accessibility)
- [Notifications and communications](#notifications-and-communications)
- [Analytics and reporting](#analytics-and-reporting)
- [Backups and disaster recovery](#backups-and-disaster-recovery)
- [Monitoring and system health](#monitoring-and-system-health)
- [DevOps and deployment](#devops-and-deployment)
- [Privacy and legal review](#privacy-and-legal-review)
- [Testing and quality assurance](#testing-and-quality-assurance)
- [Issue register and change management](#issue-register-and-change-management)
- [Production release gates](#production-release-gates)
- [End-to-end acceptance journey](#end-to-end-acceptance-journey)
- [Architecture decisions awaiting confirmation](#architecture-decisions-awaiting-confirmation)
- [Prioritized implementation plan](#prioritized-implementation-plan)
- [Validation evidence](#validation-evidence)

## Project overview

- **Purpose:** Tamark Solar Energy's public website and online solar-training application and student-management platform.
- **Business location:** Kaduna, Nigeria. Business contact details, programme prices, policies, and operational targets must come from Tamark; none are to be invented.
- **Target users:** Students and Administrators (`admin` is the highest account role).
- **Capabilities:** Public content and training catalogue, student registration/authentication, WhatsApp application handoff, student/admin dashboards, programme and application management, public gallery, private certificates, notifications, and student/application reports.
- **Stack found in the repository:** Next.js App Router, React, TypeScript, Supabase PostgreSQL/Auth/Storage, and intended Vercel deployment. Dependency versions and commands are in `package.json`.
- **Design reference found:** `Tamark Solar Energy.html`, plus the existing application screens. Preserve the approved brand, green/emerald palette, solar-yellow accents, typography, and desktop composition while designing mobile interactions for mobile.
- **Architecture objective:** A maintainable modular monolith with PostgreSQL transactions and managed services. Do not introduce queues, cache vendors, microservices, or other infrastructure without a measured need and a documented decision.

## Brand assets and icons

- **Approved source supplied:** `public/Solar Leaf Energy Emblem.png` (1254×1254 RGB PNG). The source is kept unchanged.
- **Optimized site mark:** `public/solar-leaf-energy-emblem.png`, cropped around the artwork and resized from the supplied source. The reusable `src/components/brand-mark.tsx` is used in the public header/footer, student/admin sidebar, and application wizard.
- **Rounded icons:** favicon, Apple icon, and all PWA icons have rounded transparent corners; standard 192/512 icons and a maskable 512 icon are listed in `public/site.webmanifest`.
- **Notification icon:** browser push uses the 192px emblem asset instead of the previous stock photo.
- **Acceptance:** source remains intact; optimized marks/icons are derived from it; favicon/Apple/manifest metadata is present; manifest paths resolve; public header renders the image. Test evidence is logged under [Validation evidence](#validation-evidence). Student/admin visual checks remain outstanding.
- **Install prompt:** `[x] IMPLEMENTED` — `src/components/install-prompt-banner.tsx` captures supported browser install events, offers iOS/iPadOS manual Add to Home Screen steps, registers the app service worker, and supports dismissal/installed state. Real OS installation and cross-platform behavior still require device verification.

## Architecture and baseline review

### Existing architecture

The Next.js application serves public and authenticated student/admin routes. Server API routes use Supabase clients; user-scoped operations are intended to rely on Supabase Auth and RLS, while privileged workflows use a server-only service-role client. Applications are submitted to Supabase before the browser opens WhatsApp. The `supabase/` directory contains the initial schema and follow-on SQL migrations.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : identifies
  PROFILES ||--o{ APPLICATIONS : owns
  PROGRAMMES ||--o{ APPLICATIONS : receives
  PROFILES ||--o{ NOTIFICATIONS : receives
  PROGRAMMES ||--o{ GALLERY_ITEMS : displays
  PROFILES ||--o{ CERTIFICATES : receives
  PROFILES ||--o{ AUDIT_LOGS : acts
  PROGRAMMES ||--o{ TRAINING_SESSIONS : schedules
```

The diagram represents entities found or introduced by current SQL, not a fully approved target model. Historical schema and migrations still contain payment objects until migration 08 is applied. Cohorts, reservations, enrollments, application documents, notification delivery jobs/preferences, and support requests are not all represented as implemented database entities.

### Findings from the initial review and subsequent changes

The original review predates migrations 04–08 and the current feature work. It identified a user-reported SQL failure in migrations 01–03; the resulting database state remains unknown. Migrations 03/04 add submission idempotency and draft version checks, and 05 cleans up historical role/finance distinctions; none of those database changes has been verified against the user's project. Payment provider, checkout, refund, and reconciliation features are now decommissioned in application code. Migration 08 purges historical records from the active database only after read-only state inspection and a verified backup; backups, exports, logs, and third-party copies require separate retention/deletion handling.

Cohort capacity, private application-document uploads, durable email delivery, comprehensive audit coverage, load/concurrency evidence, backup restore, CI/CD, production monitoring, and approved privacy/legal notices remain incomplete. The repository is under Git, but CI and staging execution are not evidenced. The gallery and private student certificate paths are implemented locally and still require migration, RLS/Storage, browser, and mobile acceptance tests.

## Status and evidence rules

Use one status per tracked item:

| Marker | Meaning |
|---|---|
| `[ ] NOT STARTED` | No verified implementation exists. |
| `[~] IN PROGRESS` | Partially implemented or actively being changed. |
| `[x] IMPLEMENTED` | Code exists; acceptance tests have not all passed. |
| `[T] TESTED` | All listed acceptance criteria for this item passed and evidence is recorded. |
| `[A] APPROVED FOR PRODUCTION` | Acceptance, security, operational, and company approval requirements passed with recorded approver/evidence. |
| `[!] BLOCKED` | Cannot proceed until the named dependency/decision is resolved. |
| `[D] DECOMMISSIONED` | Product capability was deliberately removed; historical migration/source artifacts may remain for database upgrade history. |

For every material status change, record: date, status, commit/PR or file references when available, commands or test scenario, observed result, reviewer/approver, and unresolved limitations. Do not count implementation as test evidence. Do not mark unknown work complete. If the repository lacks Git history, record that fact rather than fabricating a commit.

## Product modules

For every module below, frontend, backend, database, security, and testing criteria are explicit. Each row has an evidence field; update it only with actual results. “Owner” defaults to **Unassigned** until Tamark assigns a responsible person.

| # | Module and objective | Current status | Acceptance criteria, dependencies, and evidence |
|---:|---|---|---|
| 1 | **Public website** — present approved company information and route users to services/training. | `[x] IMPLEMENTED` | **UI:** approved design and mobile behavior. **API/data:** public content only; no private data. **DB:** public content must have safe publication rules. **Security:** no secret/private data in HTML or cache. **Test:** all public routes, mobile, links, and content approval. **Depends:** company-approved copy/contact. **Evidence:** `src/app/page.tsx`, `src/components/home-page.tsx`, shared `src/components/brand-mark.tsx`; logo appears in public header/footer. Build and mobile-homepage visual screenshot pass; other public routes and full mobile criteria remain open. **Owner:** Unassigned. |
| 2 | **Homepage** — communicate Tamark's identity and primary actions. | `[x] IMPLEMENTED` | **UI:** retain prototype composition/branding and responsive hero. **Backend/DB:** approved content and images only. **Security:** safe image/content handling. **Test:** 320–1440px, keyboard, contrast, Core Web Vitals. **Depends:** approved copy/assets. **Evidence:** `src/components/home-page.tsx`; new Solar Leaf source/derived logo is rendered in shared site header. Favicon/app icon assets and manifest added; no Lighthouse evidence. **Owner:** Unassigned. |
| 3 | **About page** — publish approved company story and profile. | `[ ] NOT STARTED` | **UI:** accessible branded page. **API/DB:** CMS or approved static source decision. **Security:** constrain publishing permissions. **Test:** content review, responsive/accessibility. **Depends:** Tamark-approved company content. **Evidence:** no dedicated route verified in `src/app/`. **Owner:** Unassigned. |
| 4 | **Services** — explain approved solar services and enquiry path. | `[ ] NOT STARTED` | **UI:** approved service content and contact action. **API/DB:** decide static content vs managed services catalog. **Security:** validate enquiry data and rate-limit submissions if added. **Test:** content, links, mobile, abuse/rate-limit. **Depends:** service scope and contact workflow confirmation. **Evidence:** no dedicated services route/module verified. **Owner:** Unassigned. |
| 5 | **Training catalogue** — list published programmes. | `[x] IMPLEMENTED` | **UI:** cards and mobile layout. **API/DB:** only published/approved details, paginated if growth requires. **Security:** public read must not expose drafts/private fields. **Test:** publication, empty/loading/error, query plan, responsive. **Depends:** approved programme data. **Evidence:** `src/app/training/page.tsx`, `src/components/programme-catalog.tsx`; course content/prices remain business-controlled. **Owner:** Unassigned. |
| 6 | **Programme details** — provide approved content and application entry. | `[x] IMPLEMENTED` | **UI:** accessible detail page. **API/DB:** valid slug/programme data and current approved price. **Security:** do not trust browser prices. **Test:** unpublished/invalid slug, price changes, cache invalidation. **Depends:** catalogue. **Evidence:** `src/app/training/[slug]/page.tsx`; no cache invalidation acceptance evidence. **Owner:** Unassigned. |
| 7 | **Student registration** — create student accounts. | `[x] IMPLEMENTED` | **UI:** validate and explain confirmation. **API/DB:** profile creation idempotent. **Security:** Supabase Auth, server validation, abuse controls. **Test:** simultaneous registration, duplicate email, confirmation and failure recovery. **Depends:** Auth/SMTP dashboard settings. **Evidence:** `src/components/auth-form.tsx`; no concurrent test. **Owner:** Unassigned. |
| 8 | **Authentication and password recovery** — sign in, sign out, reset/update password. | `[x] IMPLEMENTED` | **UI:** clear errors and recovery. **API/DB:** valid Supabase session lifecycle. **Security:** email confirmation, policy, redirect allowlist, Auth rate limits, privileged MFA decisions. **Test:** expired/invalid recovery, suspended account, redirect validation. **Depends:** Supabase Auth configuration. **Evidence:** `src/app/sign-in/`, `src/app/sign-up/`, `src/app/reset-password/`, `src/middleware.ts`; provider settings unverified. **Owner:** Unassigned. |
| 9 | **Student application process** — apply without an account, submit, and continue through WhatsApp. | `[~] IN PROGRESS` | **UI:** optional profile-prefilled name/email/phone, editable review, clear WhatsApp handoff. **API/DB:** validated, rate-limited public submission; retry key; optional student ownership; server-resolved WhatsApp. **Security:** same-origin mutation checks; service-role-only writes; no anonymous table grants. **Test:** valid/invalid submissions, retries, rate limiting, guest/admin workflows, valid/missing WhatsApp destination. **Depends:** published programme, migrations 02–04, 06–07 and 09. **Evidence:** `src/components/application-wizard.tsx`, `src/app/api/applications/guest/route.ts`, `supabase/security_financial_09_guest_applications.sql`; source-contract evidence only until database/RLS/API acceptance is run. |
| 10 | **Online payment integration** — historical provider checkout. | `[D] DECOMMISSIONED` | Removed from application, routes, dependencies, and environment configuration. Migration 08 will permanently delete historical payment data and schema objects after approval/backup. **Evidence:** `supabase/security_financial_08_remove_payments.sql`; no database execution. |
| 11 | **Payment verification/webhook** — historical provider confirmation. | `[D] DECOMMISSIONED` | Webhook and verification routes/source removed. Legacy migrations remain for upgrade history only. Database migration state is unknown; no current payment callback should be configured. |
| 12 | **Student dashboard** — show own applications, certificates, notifications, and profile. | `[x] IMPLEMENTED` | **UI:** responsive, understandable status/empty/error states. **API/DB:** owner-scoped data and pagination. **Security:** RLS; no cross-user cache. **Test:** two-student isolation, suspended user, mobile and keyboard. **Depends:** Auth and RLS migrations. **Evidence:** `src/app/student/`, `src/components/dashboard-manager.tsx`, `src/app/api/student/`; RLS integration tests absent. |
| 13 | **Administrator dashboard** — review operational records and actions. | `[x] IMPLEMENTED` | **UI:** accessible tables/actions. **API/DB:** role-checked queries and pagination. **Security:** server-side admin checks; admin is the highest role and grants finance access. **Test:** student, active admin, and suspended admin. **Depends:** RBAC migration. **Evidence:** `src/app/admin/`, `src/lib/api-auth.ts`; all admin APIs use the same active-admin authorization; role matrix not integration-tested. **Owner:** Unassigned. |
| 14 | **Application management** — review and decide application outcomes. | `[~] IN PROGRESS` | **UI:** show fresh status and stale/conflict warning. **API/DB:** explicit transitions and optimistic version/status predicate. **Security:** audit actor and decision. **Test:** two administrators make conflicting decisions concurrently; exactly one valid terminal transition. **Depends:** application version/transition design. **Evidence:** `src/app/api/admin/[...path]/route.ts`, `src/components/dashboard-manager.tsx`; expected `updated_at` is now required and conditionally updated; no live concurrency test. **Owner:** Unassigned. |
| 15 | **Student management** — authorized administrators view/manage student records. | `[x] IMPLEMENTED` | **UI:** privacy-conscious listing and pagination. **API/DB:** minimize fields, avoid N+1, audit changes. **Security:** least privilege and export controls. **Test:** role matrix, pagination, data minimization, access audit. **Depends:** RBAC and privacy policy. **Evidence:** `src/app/api/admin/[...path]/route.ts`; acceptance tests absent. **Owner:** Unassigned. |
| 16 | **Training programme management** — maintain programme content and publication. | `[x] IMPLEMENTED` | **UI:** detailed desktop admin table with image, name, category, slug, summary, duration, publication/catalogue status, add, inline edit, unpublish, and delete actions; mobile switches to stacked programme cards with labeled details and touch-sized controls. **API/DB:** validate updates; permanent deletion is allowed only when there are no linked applications; referenced programmes are retained and can be unpublished instead. Programme image cleanup is attempted after deletion. **Security:** admin authorization; deletion audit. **Test:** concurrent edits, referenced-programme delete block, unpublished visibility, revalidation. **Depends:** Tamark-approved content. **Evidence:** `src/app/api/admin/[...path]/route.ts`, `src/components/dashboard-manager.tsx`; source-contract tests cover delete guard, table actions and mobile layout; database/concurrency/cache tests absent. |
| 17 | **Training cohorts and capacity** — allocate seats without overselling. | `[ ] NOT STARTED` | **UI:** cohort dates, capacity, availability, deadlines, status. **API/DB:** transactional reservations, unique student/cohort constraint, expiry/release, confirmed enrollment. **Security:** only authorized cohort management; validate date/capacity. **Test:** 100 simultaneous attempts against 30 seats yields at most 30 confirmed/reserved; retries/expiry do not double-book. **Depends:** company rules for reservation point, hold duration, payment timing, waitlist, and cancellation. **Evidence:** no cohort-capacity table/function verified; current schedules are not seat inventory. **Owner:** Unassigned. |
| 18 | **Payment management** — inspect payment records and financial summaries. | `[D] DECOMMISSIONED` | Payment dashboard/report queries and APIs removed. Migration 08 drops historical tables and payment routines; application of the destructive purge is not verified. |
| 19 | **Refund management** — request and track provider refunds. | `[D] DECOMMISSIONED` | Refund APIs and provider integration removed. Historical refund rows are deleted only when migration 08 is approved and applied. |
| 20 | **Notifications** — in-app and optional browser push. | `[x] IMPLEMENTED` | **UI:** read/unread and accessible links. **API/DB:** notification and delivery state. **Security:** own-user visibility; secrets private. **Test:** delivery failure, retry, preferences, certificate notification. **Depends:** email/job-provider selection for transactional email. **Evidence:** `src/components/push-notification-control.tsx`, `src/app/api/student/push-subscriptions/route.ts`, `supabase/push_notifications_migration.sql`; durable email queue not implemented. |
| 21 | **Reports and analytics** — provide permission-filtered student/application reports. | `[x] IMPLEMENTED` | **UI:** clear metric definitions and filters. **API/DB:** aggregate current records, avoid duplicates, pagination. **Security:** active-admin authorization, least-privilege export, privacy-safe CSV. **Test:** export injection/privacy and accuracy. **Evidence:** `src/app/api/admin/[...path]/route.ts`; CSV/export tests incomplete. |
| 22 | **Profile management** — allow safe student profile updates. | `[x] IMPLEMENTED` | **UI:** accessible validation and saved/error states. **API/DB:** field-level write grants and timestamps. **Security:** prevent role/suspension/permission escalation. **Test:** profile ownership and attempts to change restricted fields. **Depends:** Auth/RLS. **Evidence:** `supabase/schema.sql`, `src/app/api/student/`; policy integration test absent. **Owner:** Unassigned. |
| 23 | **Document management** — securely upload and retrieve application documents. | `[!] BLOCKED` | **UI:** file type/size guidance and upload recovery. **API/DB:** private bucket, metadata/ownership, signed short-lived downloads, retention/delete process. **Security:** content validation, malware strategy, no public URLs, audit. **Test:** cross-user access, malicious/oversized files, signed URL expiry. **Depends:** Tamark's document list, retention policy, storage/security choices. **Evidence:** no private application-document or signed-download workflow verified; see `SECURITY-ARCHITECTURE.md`. **Owner:** Unassigned. |
| 24 | **System settings** — maintain approved public contact and organizational settings. | `[x] IMPLEMENTED` | **UI:** role-appropriate settings and confirmation. **API/DB:** validation, audit, concurrency check, cache invalidation. **Security:** admin-only writes and controlled public fields. **Test:** unauthorized update, malformed values, cache propagation. **Depends:** approved contact data and permissions. **Evidence:** `src/app/api/admin/[...path]/route.ts`; acceptance/security tests absent. **Owner:** Unassigned. |
| 25 | **Support and contact management** — route and track student enquiries. | `[ ] NOT STARTED` | **UI:** accessible contact and case status. **API/DB:** validated, rate-limited support requests and retention. **Security:** protect personal data and prevent spam. **Test:** delivery, abuse limits, staff permissions, privacy. **Depends:** support owner, contact channel, response policy. **Evidence:** no support-request module verified; settings/contact presentation is not case management. **Owner:** Unassigned. |
| 26 | **Public gallery** — publish admin-approved project and training photos. | `[x] IMPLEMENTED` | **UI:** responsive public gallery and admin upload/edit/publish/delete. New uploads use a single image picker with an in-box preview; the initial accessible title is derived from the filename and can be edited after upload. Existing admin gallery entries appear in a detailed, horizontally scrollable CRUD table with thumbnail, title, caption, order, publication status, creation date, and actions; edit expands an inline accessible form. A global accessible toast provider gives timed, dismissible success/error feedback for dashboard changes. **API/DB:** uploads image bytes to the public `tamark-gallery` Supabase Storage bucket, then inserts metadata in `gallery_items`; if metadata insertion fails, the uploaded object is cleaned up. Missing bucket/schema and Storage permission failures return actionable guidance. **Security:** active-admin writes; MIME/signature/size validation; published-only public query. **Test:** unauthorized writes, invalid upload, publication visibility, mobile and accessibility. **Depends:** migration 07 and image publication consent. **Evidence:** `src/components/home-page.tsx`, `src/components/dashboard-manager.tsx`, `src/app/api/admin/gallery/`, `src/components/toast-provider.tsx`, `supabase/media_07_gallery_certificates.sql`; source-contract tests verify table columns, edit/delete controls and horizontal mobile overflow behavior; database migration and real authenticated upload/storage behavior remain unverified. |
| 27 | **Student certificates** — issue and privately deliver student certificates. | `[x] IMPLEMENTED` | **UI:** admin issues PDF; student lists and downloads own certificate. **API/DB:** private storage, metadata, notification, signed URL. **Security:** admin issuance, student ownership checks, file type/signature/size validation. **Test:** cross-student denial, invalid file, expiry, notification failure. **Depends:** migration 07 and certificate issuance policy. **Evidence:** `src/components/dashboard-manager.tsx`, `src/app/api/admin/certificates/`, `src/app/api/student/certificates/`, `supabase/media_07_gallery_certificates.sql`; implementation is present, but database migration and authenticated admin/student issuance, notification, privacy, and download flows remain untested. |

## Database and data integrity

### Current model and required additions

Current application SQL intends profiles, programmes, applications, notifications, training sessions, announcements, organization settings, push subscriptions, gallery items, and certificates. Historical base/security migrations still define payment objects; migration 08 removes them. Validate the actual deployed schema read-only before further migrations.

Add or formalize only after requirements are approved: cohorts, reservations, confirmed enrollments, attendance, application documents, notification preferences/delivery jobs, payment reconciliation runs, and support requests. Avoid duplicate user tables; use Supabase Auth as identity and profiles for application-specific fields.

### Database checklist

- [x] Initial schema and versioned SQL migrations exist in `supabase/`.
- [~] Core primary keys, foreign keys, checks, and indexes exist; audit coverage and query plans are incomplete.
- [~] RLS is present and security migrations introduce stricter policies; role/ownership policies need staging tests.
- [~] Add version/expected-`updated_at` conflict protection: administrator decisions now compare the loaded version; application drafts and programme edits remain open, and the admin path needs database concurrency testing.
- [ ] Define data retention, archival, deletion, and financial-record correction procedures with Tamark/legal review.
- [ ] Review indexes with representative query plans and data volume; record slow-query baseline.
- [ ] Test migrations forward on a disposable/staging database and verify backups/rollback procedure.
- [!] Inspect the user-reported failed SQL execution before retrying; do not assume transaction rollback or run later migration files until prerequisites are confirmed.

### Migration approval checklist

- [ ] Confirm migration is additive or document data transformation/lock impact.
- [ ] Validate existing data against all new constraints before rollout.
- [ ] Apply to disposable environment; test RLS, grants, functions, and rollback/forward recovery.
- [ ] Capture query plans and execution time for material DDL/backfills.
- [ ] Take/verify pre-deployment backup and agree rollback/repair steps.
- [ ] Obtain database owner and release approver sign-off.
- [ ] Apply to production only through an approved, recorded deployment process.

### Current migration sequence

After the existing schema, dashboard, programme catalogue, and push-notification SQL listed in `README.md`, apply the security workflow migrations one at a time:

1. `supabase/security_financial_00_enum_values.sql` (historical payment enum step; required only as part of the ordered legacy migration chain).
2. `supabase/security_financial_01_primitives.sql`.
3. `supabase/security_financial_02_workflows.sql`.
4. `supabase/security_financial_03_concurrency.sql`.
5. `supabase/security_financial_04_draft_concurrency.sql` (only after 00–03 succeed; adds optimistic concurrency for draft saves).
6. `supabase/security_financial_05_admin_access.sql` (only after 00–04 succeed; keeps role labels to student/admin and removes legacy role/finance flags).
7. `supabase/security_financial_06_whatsapp_applications.sql` (only after 00–05; removes fee eligibility and adds no-payment application submission/WhatsApp setting).
8. `supabase/media_07_gallery_certificates.sql` (only after 06; adds gallery and private certificates).
9. `supabase/security_financial_09_guest_applications.sql` (only after 06–07; enables nullable student ownership for submitted guest records and adds an idempotency key without granting anonymous table access).
10. `supabase/security_financial_08_remove_payments.sql` (optional/destructive; only after 06–07, verified backup, and confirmed approval; irreversibly deletes payment/refund history and removes its schema).

The user reported executing migration files 01–03 and receiving prerequisite errors. No successful completion of the full migration chain is evidenced; the resulting database state is unknown. A read-only REST check confirmed `applications.public_submission_key` is absent, so migration 09 has not completed on the configured project. Use the read-only diagnostics in `SECURITY-ARCHITECTURE.md` before applying migration 09. Migrations 04–08 remain unverified, and migration 08 must not run until the database state and backup are verified. Staging validation remains a P0 release gate.

## Authentication and security

- [x] Supabase Auth sign-up/sign-in and password-reset UI exist.
- [~] Server-side authentication, role checks, suspension checks, same-origin mutation checks, security headers, API validation, and rate-limit/audit helpers exist.
- [~] Active-admin checks are used by admin APIs; the role/RLS matrix and migrations 05–08 remain pending integration verification.
- [ ] Configure and evidence Supabase password policy, email verification, SMTP, redirect allowlist, Auth rate limits, session lifetime/refresh, MFA for privileged accounts, and recovery procedures.
- [ ] Add rate limits for registration, password reset, uploads, support, and sensitive admin operations where risk warrants; confirm retries remain usable.
- [ ] Add upload security only with private document flow; no public sensitive-document storage.
- [ ] Add dependency vulnerability scanning and documented patch response.
- [ ] Complete OWASP-oriented security and RLS testing; frontend route hiding is never a substitute for server authorization and database RLS.

## Payment and financial integrity — decommissioned

The current application has no online payment provider, checkout, receipt, refund, webhook, or reconciliation flow. Migration 06 removes fee approval as an application prerequisite; migration 08 removes payment schema and deletes historical payment/refund records and related notifications/audit events from the active database. The user explicitly approved that deletion, but migration 08 remains unapplied pending database-state inspection and a verified restorable backup. The migration does not purge backup, export, log, or third-party copies; those require separate retention/deletion handling. Historical migrations 00–05 remain in order for compatibility and are not evidence of a current payment feature.

| Removal acceptance | Expected result | Evidence |
|---|---|---|
| Application and published programme eligibility | No price/fee prerequisite | Migration 06 source-contract test passes; database migration not run |
| Checkout, provider, refund and financial API routes | No live app endpoints or provider credentials | Source routes/dependencies removed; lint/build validation pending |
| Historical data purge | Payment/refund rows and their related records deleted from the active database after explicit approval and verified restorable backup; retained copies handled separately | Migration 08 authored; no database run or row-count evidence; backup/export/log retention not evaluated |
| Replay/idempotency and ownership | Application submission still returns the same reference on retry; student-owned records remain protected | Migration 03 source contract passes; database test pending |

Do not treat payment data as deleted until migration 08 succeeds in the inspected target database. See [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md) for the read-only preflight and migration cautions.

## Concurrency and scalability

### Critical acceptance criteria

- **Applications:** 100 concurrent draft saves for distinct students persist without cross-user writes; same-student stale writes return a conflict rather than silently overwrite; duplicate submit requests create exactly one reference and return the same result.
- **Cohorts:** for capacity 30, 100 simultaneous valid registration requests produce at most 30 active reservations/confirmed seats; duplicate student attempts consume one seat; expiry frees seats once.
- **Administrator reviews:** two stale decisions cannot silently overwrite one another; the losing request receives a conflict with current state/version.
- **Programme edits:** stale content/price updates are rejected or explicitly merged; price approval is separately authorized and audited.
- **Failure safety:** bounded retries only for safe/idempotent operations; never retry a provider-side charge/refund blindly after an ambiguous timeout.

### Design/testing plan

1. **Implemented:** make final application submission idempotent by returning the existing reference on repeated owner-authorized requests; migration 03 also backfills references for prior non-draft applications.
2. **Implemented, integration test pending:** administrator decisions now require the loaded `updated_at` and return HTTP 409 when the row has changed.
3. Add Postgres integration tests for unique constraints, RLS, RPCs, and transaction transitions on a disposable Supabase/Postgres environment.
4. **Implemented locally, tests pending:** add optimistic version checks to application drafts; programme edits still need the same protection and database integration tests are pending.
5. Design cohort capacity as a transactional reservation/confirmation flow only after business rules below are confirmed; include unique enrollment and bounded reservation expiry.
6. Run deterministic concurrency tests against the database (barrier-started transactions) before k6 traffic tests.
7. Exercise deadlock/serialization handling with bounded, jittered retries only for idempotent database operations; log exhausted retries without sensitive data.
8. Record request throughput, p50/p95/p99 latency, error rate, DB CPU/connections, and slow queries. Do not claim user capacity until measured.

## Performance, reliability, and caching

- **Performance status:** unmeasured; no Lighthouse/Core Web Vitals, API percentile, or database query-plan baseline is recorded.
- **Targets:** pending baseline and Tamark approval. Set page/API budgets, availability, and error-rate targets only after representative staging measurements; do not invent SLAs.
- [ ] Measure Core Web Vitals and Lighthouse for public routes and authenticated dashboards on mobile and desktop.
- [ ] Profile bundle size, image delivery, database query plans, pagination, N+1 behavior, connection pool behavior, and slow queries.
- [ ] Cache only public published programme/company content; invalidate after changes. Never cache cross-user data, permissions, documents, or authoritative payment status.
- [ ] Establish safe request timeouts and bounded retries; preserve drafts during network failures.
- [ ] Choose background jobs only for reliable async work (email, reminders, exports, cleanup) after selecting a managed mechanism. Jobs require idempotency, retry/backoff, maximum attempts, failed-job review, and monitoring. Notification failure must not undo application submission.
- [ ] Add health checks and controlled error boundaries; avoid logging secrets or unnecessary personal/payment data.
- [ ] Load-test specified scenarios at 100 browsing/registration/draft users and 50 administrators only after safe staging fixtures are available.

## Mobile responsiveness and accessibility

The mobile drawer and mobile layout adjustments have been implemented previously, with viewport overflow and drawer interaction checks recorded in prior session history. That does not constitute a complete responsive/accessibility approval.

- [ ] Test 320, 360, 375, 390, 414, 480, 768, 1024, 1280, and 1440px.
- [ ] Cover homepage hero, services, gallery, training catalogue/details, application, student/admin dashboards, certificate forms, tables, dialogs, and footer.
- [ ] Verify keyboard-only navigation, focus visibility/order/return, Escape behavior, semantic labels, screen-reader announcements, error associations, and 200% zoom.
- [ ] Audit contrast, non-color status cues, mobile touch targets, responsive text, and loading/error/empty states against WCAG 2.2 AA.
- [ ] Record tool/manual results and remediation evidence; do not claim WCAG conformance without an accessibility review.

## Notifications and communications

- Current in-app notifications and optional browser push exist. The transactional email/job system, delivery state/retries, preference center, and SMS integration are not verified as implemented.
- [ ] Confirm transactional email provider, domain authentication, templates, sender ownership, and Supabase Auth SMTP configuration.
- [ ] Define required event types and service-vs-marketing preferences; keep marketing consent separate.
- [ ] Persist delivery jobs/status and deduplication keys; implement bounded retry/backoff and a failed-delivery review path.
- [ ] Test that email/push failure cannot reverse application or certificate transitions.
- [ ] Treat SMS as optional; do not configure a provider or imply SMS delivery until approved.
- **Owner:** Unassigned. **Company/provider decisions:** pending. **Evidence:** in-app/push code exists; no reliable email-queue delivery test.

## Analytics and reporting

Report definitions must be approved and derived from actual records. Initial definitions:

| Metric | Proposed calculation | Approval/evidence |
|---|---|---|
| Registered students | Count of non-deleted profiles with student role | Confirm account lifecycle |
| Applications by status | Count by canonical application status and selected period field | Define created vs submitted date |
| Cohort capacity/enrollment | Reserved and confirmed seats by cohort | Cohort model/business rules absent |

- [ ] Add date/programme/cohort/status filters and stable pagination.
- [ ] Secure CSV/Excel/PDF exports and mitigate spreadsheet formula injection; limit personal data in exports.
- [ ] Validate totals against known staging fixtures.
- **Current:** application/student CSV exports exist. Cohort, filters, and export-format acceptance is incomplete; financial reports are decommissioned.

## Backups and disaster recovery

- **RPO:** pending company/provider decision.
- **RTO:** pending company/provider decision.
- **Retention:** pending legal/finance approval; do not invent retention periods.
- [ ] Confirm Supabase backup/PITR plan, retention, access control, and production project tier.
- [ ] Document recovery from database loss, accidental deletion, failed migration, compromised access, storage failure, and bad deployment.
- [ ] Restore a backup into an isolated environment; verify profiles, applications, certificates, relationships, constraints, storage objects, and Auth configuration.
- [ ] Record restoration date, duration, data loss window, integrity checks, operator, and remediation. A backup is not approved until a restore succeeds.
- [ ] Define and exercise incident escalation and data-integrity checks after recovery.
- **Current:** no backup configuration or restoration evidence in repository.

## Monitoring and system health

- [ ] Add privacy-safe structured logs with correlation/request IDs and redaction.
- [ ] Monitor API latency/errors, database health/connections/slow queries, Auth failures, application submissions, certificate/gallery storage, notification delivery, and traffic spikes.
- [ ] Configure alert ownership, severity, thresholds, delivery channel, and runbooks.
- [ ] Create an admin-only health view only for indicators that can be safely exposed; do not show secrets or internal infrastructure detail to students.
- [ ] Test alerts with controlled staging faults and record acknowledgement/escalation.
- **Current:** audit logs exist in migrations and some routes; no production telemetry/alert configuration or health dashboard evidence.

## DevOps and deployment

- [ ] Establish Git repository/branches, protected production branch, pull request review, and versioned migration workflow. Current workspace inspection found no Git repository.
- [ ] Provide separate local/staging/production Supabase credentials; never use production personal data in unrestricted development.
- [ ] Add CI for dependency install, typecheck, lint, security tests, integration tests, dependency scan, and build.
- [ ] Test migration and application release independently; establish rollback/forward-fix procedure (database rollback is not assumed safe).
- [ ] Gate production deploy on staging smoke tests, migration approval, backup/restore evidence, privacy/accessibility review, and release sign-off.
- [ ] Run post-deploy health, authentication, WhatsApp/application/media smoke checks, and rollback readiness checks.
- [ ] Store secrets in hosting/provider secret stores; do not commit `.env.local` or service-role/provider secrets.
- **Current:** repository is under Git; no CI workflow, staging/production configuration, or deployment evidence was found.

## Privacy and legal review

This checklist is an engineering aid, not legal advice. Nigeria Data Protection Act 2023 and applicable NDPC requirements require review by Tamark and qualified counsel.

- [ ] Identify data categories, purpose, lawful basis, recipients/processors, cross-border transfers, retention, and access roles.
- [ ] Obtain company/legal approval for privacy notice, terms, cookie/tracking behavior, consent language, retention schedule, and student rights process.
- [ ] Separate necessary service messages from optional marketing consent.
- [ ] Define access, correction, deletion/objection/portability requests where applicable, with legal/financial retention review.
- [ ] Document breach identification, containment, evidence preservation, harm assessment, notification/escalation, and corrective action.
- [ ] Review processor terms and data processing arrangements for Supabase, Vercel, WhatsApp, and any approved email/SMS providers.
- [ ] Implement private document storage before collecting sensitive documents; restrict exports and audit access.
- **Current:** privacy documentation, retention periods, and legal/company approval evidence not found. Mark all as **PENDING COMPANY/LEGAL CONFIRMATION** until reviewed.

### SEO, consent, and legal-page implementation (2026-11-06)

**Status:** `[~] IMPLEMENTED, NOT PRODUCTION-APPROVED`. The engineering surfaces below are in place; business/legal approval and production-origin configuration remain release gates.

- [x] Canonical metadata, Open Graph/Twitter defaults, organization/site JSON-LD, and Course JSON-LD only for published programmes.
- [x] `robots.txt` and sitemap generation; sitemap includes the homepage, training index, and published programmes only. Private HTML routes remain crawlable to expose their `noindex`; APIs/webhooks are disallowed and API/private-dashboard responses return `X-Robots-Tag`.
- [x] Noindex metadata for sign-in/up, password reset, application, access-denied, student/admin dashboards, and unapproved legal drafts.
- [x] Versioned, default-deny essential/analytics/functional/marketing consent UI with reject/customize/accept, editable preferences, preserved first-choice timestamp, updated timestamp, visible storage errors, keyboard handling, mobile layout, and a footer preferences link. No analytics or marketing provider/script is installed, even when consent flags are granted.
- [x] Branded Open Graph image uses the provided Solar Leaf emblem; optional Google/Bing site-verification metadata is supported through deployment configuration.
- [x] Legal terms/privacy/cookie pages are visibly labelled as drafts and `noindex`; WhatsApp handoff and private certificate processing require final company/legal review.
- [ ] Tamark/legal review and approval of terms, privacy/cookie notices, consent language, processing/retention periods, contact details, and any terms-acceptance flow. Draft terms are not recorded or represented as accepted.
- [ ] Set and verify `NEXT_PUBLIC_SITE_URL` as Tamark's actual canonical production HTTPS origin; Vercel's `VERCEL_URL` is only a build-safe fallback and must not replace the real canonical domain. Verify Google/Bing Search Console ownership and submit the production sitemap.
- [ ] Dedicated About and Services routes remain absent; homepage sections are not listed as separate sitemap routes.
- [ ] No browser matrix, accessibility audit, production crawler/Search Console result, legal sign-off, or production analytics configuration has been completed.

## Testing and quality assurance

| Test layer | Minimum evidence required | Status |
|---|---|---|
| Unit | Business validation, state transitions, retry/idempotency, upload/access contracts | `[~]` source-contract checks exist; database behavior remains untested |
| Integration | API + Supabase/Postgres, RLS, constraints, RPCs, provider mocks | `[ ]` no recorded run |
| End-to-end | Complete student/admin journey and failure branches | `[ ]` no recorded run |
| Database | Migration forward path, constraints, role matrix, transaction contention | `[ ]` no disposable/staging DB run |
| Auth/security | Role, suspension, session, CSRF/origin, rate limit, input and secret handling | `[ ]` no formal security suite |
| Decommissioning | No current payment routes/provider configuration; historical purge migration verified in staging | `[~]` source and configuration removal in progress; migration not run |
| Concurrency/load | Concurrent submissions, admin decisions, cohorts; k6 metrics | `[ ]` no tests/results |
| Accessibility/responsive | WCAG review and listed viewport matrix | `[~]` earlier mobile checks only; full audit absent |
| Backup/restore | Actual isolated restore and integrity report | `[ ]` no evidence |
| User acceptance | Tamark-approved scenarios and sign-off | `[ ]` no evidence |

## Issue register and change management

### Open issue register

| ID | Issue | Severity | Priority | Affected area | Resolution/acceptance | Status | Owner/evidence |
|---|---|---|---|---|---|---|---|
| PR-001 | Security migration attempt failed on missing enum labels/column; actual database state is unknown | Critical | P0 | Database, auth, applications | Read-only inspect actual schema; then apply ordered files individually in staging and verify grants, RLS, workflows, storage, and recovery | Open | User reported errors; database state not yet inspected |
| PR-002 | No cohort capacity/reservation system | High | P1 | Cohorts, enrollment | Approve business rules; implement atomic allocation; pass 100-to-30 contention test | Open | Unassigned; company decision pending |
| PR-003 | Draft autosave lacks version-based stale-write detection | High | P1 | Applications | Stale payload receives conflict and cannot overwrite newer edit | In progress; API/UI and migration 04 implemented locally; database validation pending | `npm run test:security`, `npm run lint`, `npm run build`, and `npm run typecheck` pass; no migration applied |
| PR-004 | Repeat application submit does not return existing result | High | P1 | Applications | Idempotent retry returns same application reference | In progress; migration 03 added, DB test pending | Unassigned |
| PR-005 | No payment concurrency/load evidence | Superseded | — | Decommissioned payment system | Not applicable after payment integration removal; verify migration 08 purge separately under PR-001 | Closed by scope change | Payment routes removed; no live payment traffic |
| PR-006 | Private application document upload/download is absent | High | P1 | Documents/privacy | Approved document/retention policy and private signed access tests | Blocked | Company decision required |
| PR-007 | Backup restoration and RPO/RTO are unverified | Critical | P0 | Operations | Approved objectives and successful documented restore | Open | Unassigned; targets pending |
| PR-008 | No CI/CD, production monitoring, or deployment evidence | High | P1 | DevOps/operations | Reproducible CI and staging/release/rollback evidence | Open | Unassigned; repository exists but no CI evidence |
| PR-009 | Privacy, retention, and legal notices are not approved | High | P1 | Privacy/compliance | Tamark/legal approval and implemented request/retention process | Blocked | Company/legal decision required |

### Change procedure

For every significant feature:

1. Read this tracker and relevant code/docs; record affected module(s) and evidence baseline.
2. Identify dependencies, access/security effects, migration/data effects, and concurrency/failure modes.
3. Present an implementation plan before major architectural or provider changes; obtain company decisions where required.
4. Implement the smallest complete change consistent with approved design and existing stack.
5. Run focused automated checks plus relevant integration/concurrency/accessibility tests.
6. Update directly related documentation and this tracker with actual results and remaining risks.
7. Promote status only when the corresponding status definition and acceptance criteria are met.

## Production release gates

Every gate requires a named reviewer, date, and evidence. A critical open issue blocks production approval.

| Gate | Required approval evidence | Status |
|---|---|---|
| 1. Frontend/design | Brand/design review; responsive and accessibility evidence | `[ ] NOT STARTED` |
| 2. Database/backend | Staging migrations, data integrity, RLS, rollback/restore review | `[ ] NOT STARTED` |
| 3. Authentication/security | Threat/security tests, roles, secrets, Auth configuration | `[ ] NOT STARTED` |
| 4. Application/media data | WhatsApp handoff, gallery publication, certificate ownership, approved history purge and backup handling | `[ ] NOT STARTED` |
| 5. Concurrency/performance | Defined targets; race/load results and capacity evidence | `[ ] NOT STARTED` |
| 6. Notifications/reporting | Delivery retry tests and approved application/report definitions | `[ ] NOT STARTED` |
| 7. Privacy/accessibility | Company/legal approval and accessibility audit | `[ ] NOT STARTED` |
| 8. Backup/disaster recovery | Approved RPO/RTO and successful restore exercise | `[ ] NOT STARTED` |
| 9. End-to-end UAT | Student/admin flows and failure scenarios signed off | `[ ] NOT STARTED` |
| 10. Production deployment | Approved release, smoke tests, monitoring and rollback owner | `[ ] NOT STARTED` |

## End-to-end acceptance journey

For each step, test normal and failure/retry cases. Record environment, test account/fixture, expected and actual result, and evidence; never record secrets or unnecessary personal data.

1. Student visits public site and views only published programmes.
2. Student creates an account, verifies email, and signs in.
3. Student selects a programme and completes/reviews an application.
4. Application draft autosaves and can be recovered after network failure.
5. Student reviews profile-prefilled details; the application is persisted before WhatsApp opens with only name, programme, and reference prefilled.
6. Submission retries return one stable application reference; missing WhatsApp configuration is shown as an error.
7. Student sees only their own application and certificate records and cannot download another student's PDF.
8. Administrator reviews the latest application; concurrent conflicting decisions cannot silently overwrite.
9. Admin uploads and publishes an approved gallery image; only published images appear publicly.
10. Admin issues a private PDF certificate; the student receives an in-app notification and can download only their own file.
11. Cohort allocation (once implemented) cannot oversell and handles duplicate/expired reservations.
12. Backup restore, approved historical payment-data deletion, and operational alert scenarios are exercised before production approval.

## Architecture decisions awaiting confirmation

| Decision | Why required | Proposed next action |
|---|---|---|
| Cohort seat reservation point, hold expiry, confirmation, waitlist/cancellation rules | Determines table model and application/enrollment coupling | Tamark defines business flow before cohort migration |
| Supported concurrency, latency/error SLOs, traffic profile | Required to size load tests and avoid unsubstantiated capacity claims | Establish staging baseline, then approve targets |
| Backup retention, RPO, RTO, recovery owner | Business impact and provider tier determine recovery design | Tamark and hosting/database owner approve values |
| Student/application/document retention periods and privacy request workflow | Legal, financial, and operational obligations differ | Tamark/legal review; no default duration invented |
| Transactional email provider and sender domain; optional SMS | Provider affects secrets, queue/retry design, templates, and cost | Select/approve provider and deliverability owner |
| Support/enquiry channel, service levels, and ownership | Determines whether a support case module is needed | Product owner confirms scope |
| Production Git/CI, staging, and monitoring providers | Workspace currently has no Git/CI evidence | Confirm hosting and repository owners before rollout |

## Prioritized implementation plan

This plan is sequencing, not approval to deploy. Dependencies requiring business confirmation remain blocked.

| Priority | Workstream | Main dependencies | Exit evidence |
|---|---|---|---|
| P0 | Provision disposable/staging Supabase and validate the existing migration chain/RLS/workflows | Safe environment, migration owner, test fixtures | All migrations apply; ownership/role/state tests pass; backup/rollback understood |
| P0 | Validate migrations 06–08, RLS/Storage, WhatsApp handoff, and migration 03 submission idempotency | P0 database environment, backup and purge approval | Migration success, access-isolation tests, and stable submission reference |
| P1 | Add optimistic concurrency to draft and programme edits; test the admin decision version guard | Version contract and UI conflict behavior | Stale writes return conflict; current data remains intact |
| P1 | Define and implement cohort reservations/capacity | Tamark seat/enrollment rules | 100 contenders against 30 seats never exceed capacity |
| P1 | Establish CI and staging deployment/release path | Git repository/hosting owner | Automated checks, migration gate, rollback/runbook and smoke tests |
| P1 | Approve privacy, document, retention, backup, and recovery policies | Tamark/legal/provider decisions | Private document flow, approved notices, measured restore/RPO/RTO |
| P2 | Baseline performance/accessibility and tune measured bottlenecks | Staging data and approved thresholds | Recorded Lighthouse/CWV, query plans, load profile and accessibility findings |
| P2 | Durable email/job delivery, system-health observability, expanded reports | Provider choices and metric definitions | Retry/failure evidence, monitoring alerts, finance-approved reports |

## Validation evidence

Evidence below records actual checks already run for this code state; it is not equivalent to full feature acceptance.

| Date | Command/scenario | Result | Scope and limitation |
|---|---|---|---|
| 2026-11-06 | User-reported Supabase SQL execution of security migrations 01–03 | Failed with `22P02` for absent higher-role/`successful` enum labels and `42703` for absent `application_reference` | Actual database state/transaction rollback unknown; no migration is considered tested. Current migration 00 does not add a higher administrator role, and current code grants financial access to active admins. Migration 05 includes a guarded database cleanup for legacy role/finance-flag state. Read-only preflight and ordered recovery procedure documented in `SECURITY-ARCHITECTURE.md`. |
| 2026-11-06 | `npm run test:security` | Pass: 6 tests, 0 failures | Four Paystack signature tests plus two source-contract checks for submission idempotency and administrator version guards; not database/concurrency integration |
| 2026-11-06 | Rounded icon asset/manifest validation | Pass: favicon ICO, Apple PNG 180px, PWA PNG 192px/512px/maskable 512px; transparent rounded corners; all manifest assets resolve | Static file/JSON validation; actual browser/OS icon presentation not tested |
| 2026-11-06 | `npm run lint` | Pass after install banner changes | ESLint on `src`; does not test SQL or runtime behavior |
| 2026-11-06 | `npm run build` | Pass after install banner changes | Next.js production build; `apple-icon.png` recognized; no deployment performed |
| 2026-11-06 | `npm run typecheck` after production build | Pass | A concurrent typecheck before Next generated `.next/types` failed; rerun after build passed |
| 2026-11-06 | `npm run test:security` | Pass: 6 tests, 0 failures | Existing signature and concurrency contract tests; no dedicated browser install or OS prompt test |
| 2026-11-06 | Draft optimistic concurrency implementation | Pass: 7 security tests, 0 failures; lint, production build, and typecheck pass | Added version-checked draft RPC migration 04, API 409 conflict/current-draft response, local version persistence, and explicit load-latest recovery. Contract tests inspect source behavior; no PostgreSQL/Supabase migration, RLS, API integration, or browser conflict test was run. Migration remains unapplied pending read-only diagnosis of the user's database state. |
| 2026-11-06 | Finance access clarification | Superseded by admin-wide access | Earlier implementation required a separate admin finance flag. It was removed in the follow-up change below; no account or database value was changed by that earlier work. |
| 2026-11-06 | Admin-wide financial access and legacy-role cleanup implementation | Pass: 10 security tests, 0 failures; lint, production build, and typecheck pass | All active admins are authorized for payments, reports, refunds, reconciliation, and programme pricing; no finance flag remains in app authorization. Migration 05 drops the obsolete database flag and, only if present and safely scoped, rebuilds `account_role` with only `student` and `admin`, mapping old higher-role profiles to `admin`. Source-contract tests pass. No database changes applied; SQL execution, migration state, and staging RLS validation remain pending. |
| 2026-11-06 | Browser screenshot of shared mobile homepage (prior logo task) | Pass: Solar Leaf mark visible; no install banner shown in that browser context | Browser did not provide a native install event; install banner trigger/dismissal and iOS instructions not verified visually |
| Not run | Install-flow browser/device test (Chromium `beforeinstallprompt`, iOS Add to Home Screen, standalone launch) | No result | Requires supported install context/device; do not mark PWA install acceptance tested |
| Prior mobile redesign session | Mobile navigation open/close, body scroll lock, Escape, viewport overflow checks | Reported pass in prior conversation/session checkpoint | Dashboard authenticated screens and full accessibility/mobile matrix were not verified in this run |
| 2026-11-06 | `npm run test:security` after SEO/consent changes | Pass: 15 tests, 0 failures | Includes new source contracts for metadata/indexing/sitemap/robots/private-route noindex, production canonical-origin guard, consent parsing/default-deny/version timestamps, visible storage failures, and absence of analytics vendor scripts; not live crawler/Search Console or legal acceptance evidence |
| 2026-11-06 | `npm run lint` | Pass | ESLint on `src`, zero warnings |
| 2026-11-06 | `npm run build` with `NEXT_PUBLIC_SITE_URL=https://tamark.example` | Pass: production build and all 28 static pages generated | Reserved `.example` origin used only for build validation; not a production domain and must not be deployed. Build with localhost was rejected by the production-origin guard as intended. |
| 2026-11-06 | `npm run typecheck` after production build | Pass | TypeScript check; no deployment/database integration |
| 2026-11-06 | Local browser consent and legal-page smoke test at 375×812 and 320×640 | Pass for tested UI: banner/modal fit viewport; reject stored all optional categories false; customized analytics preference saved and `updatedAt` changed while original timestamp remained; privacy page rendered draft notice with `noindex, nofollow` | Local browser only; no assistive-technology/device matrix. Student-route prefetch redirected from `127.0.0.1` to `localhost` and produced CORS errors, so authenticated navigation was not validated. |
| 2026-11-06 | `GET /robots.txt`, `/sitemap.xml`, `/opengraph-image` on local production server | Pass: HTTP 200, text/plain, application/xml, and image/png; sitemap contained only home/training/published programme URLs | Initial check exposed localhost sitemap links; canonical-origin guard was added. Follow-up production smoke test with reserved `https://tamark.example` confirmed robots and sitemap use the configured origin. Actual production host remains unconfigured/unverified. |
| 2026-11-06 | Second Vercel production build failure reported by user; invalid-config fallback fix | Pass: 15 security tests, lint, typecheck, and production build with `NEXT_PUBLIC_SITE_URL=http://localhost:3000` and a production `VERCEL_URL` | Build now succeeds using Vercel's deployment origin when the configured canonical URL is invalid; a valid configured canonical still takes precedence. Actual Vercel deployment remains unconfirmed. Configure the actual canonical domain in Vercel to avoid using the deployment URL for canonical metadata/sitemap. |
| 2026-11-12 | `npm run test:security` after WhatsApp application, gallery, certificate, and payment-removal changes | Pass: 13 tests, 0 failures | Includes source-contract tests; no Supabase/PostgreSQL migration, RLS/Storage integration, or authenticated student/admin flow was run. |
| 2026-11-12 | `npm run lint`, `npm run typecheck`, and `npm run build` after feature changes | Pass; the first build attempt hit a Next.js `_not-found` collection invariant, and the immediate retry succeeded with all 23 static pages generated | Production build used a reserved `.example` canonical origin and mock Supabase environment. This validates compilation only; it is not a deployment or database integration test. |
| 2026-11-12 | Local mock-backed homepage browser smoke test | Pass: HTTP 200; no horizontal overflow at observed 360px mobile and 1265px desktop widths; gallery rendered in one and three columns respectively | Used two mock gallery records. At the requested 375px viewport, browser-reported document width was 360px; mobile gallery was one column. Does not verify real gallery images, consent, accessibility, admin/student authentication, certificate issuance/download, or database behavior. |
| 2026-11-12 | Homepage request against configured Supabase project | Failed: HTTP 500 because `public.gallery_items` was absent from the Supabase schema cache | Consistent with migration 07 not being applied, but actual database migration state is unknown. Do not add a silent fallback or claim gallery production readiness; inspect the database read-only and follow the migration recovery procedure. |
| 2026-11-12 | User-reported public homepage runtime error loading `organization_settings.whatsapp_phone` | Failed because the column does not exist in the connected database | Migration 06 adds this column (migration 07 also has an idempotent add-column statement). This confirms a code/database schema mismatch, not an environment-variable issue. The database is in an uncertain state after prior SQL errors; check the column and migration prerequisites read-only before applying or repairing migrations. |
| 2026-11-12 | User-reported homepage runtime error loading `public.gallery_items` | Failed: Supabase PostgREST reports the table is missing from its schema cache | Migration 07 creates this table. Together with the missing `whatsapp_phone` column, this indicates the connected database does not expose the new feature schema, either because migrations 06–07 have not completed or the API schema cache is stale. Read-only checks and safe migration/cache-refresh recovery are documented in `SECURITY-ARCHITECTURE.md`; no database changes were run. |
| 2026-11-12 | Gallery upload UI update: image-only selection and in-box preview | Pass: gallery source-contract test included in 14/14 security tests; lint and TypeScript check pass | Metadata entry fields were removed from the upload form; title is derived from the selected filename, with later editing still available on each gallery item. Production build was attempted twice but stopped at Next.js `Invariant: no direct app page entry found for /_not-found`; a local Next.js process was active on port 3001, so rerun the production build in an isolated environment. No authenticated upload or real database test was run. |
| 2026-11-12 | WhatsApp destination setting defaults to `+234` when empty | Pass: country-code source-contract test included in 15/15 security tests; lint and TypeScript check pass | Admin can enter the remaining Tamark number under Settings; no actual number was provided or persisted. The existing database missing-column error must be resolved by applying migrations in order before Settings can read or save the WhatsApp field. No live WhatsApp redirect or database test was performed. |
| 2026-11-12 | Gallery storage diagnosis and global dashboard toast feedback | Pass: `npm run test:security` 16/16, `npm run lint`, `npm run typecheck`, and `git diff --check` | Migration 07 defines the public `tamark-gallery` bucket and Storage policies. API responses now distinguish missing gallery bucket/schema and likely Storage permissions; success/error toasts are wired to generic dashboard mutations, gallery upload/edit/delete, and certificate issuance. No live Supabase upload was run. Production build was not run because Next.js development servers were active on ports 3000 and 3001, sharing `.next` build output; do not stop those user services to build. |
| 2026-11-12 | Admin gallery layout changed from a two-column card grid to a vertical list | Pass: `npm run test:security` 17/17; lint, TypeScript, and `git diff --check` pass | Each gallery item appears as its own horizontal image/details row on wide screens and a stacked row on narrow screens. Source-contract test verifies accessible list semantics and responsive single-column behavior; no authenticated visual browser test was run. |
| 2026-11-12 | Password visibility toggle added to sign-in, sign-up, password reset, and student password-change fields | Pass: `npm run test:security` 18/18; `npm run lint`, `npm run typecheck`, and `git diff --check` pass | Shared accessible field toggles text/password visibility with a labeled button and pressed state. No authenticated browser/device test was run. |
| 2026-11-12 | Password minimum aligned to 8 characters for sign-up and password reset | Pass: `npm run test:security` 18/18; lint and TypeScript pass; repository search found no remaining 12-character password minimum/copy | Updated client HTML constraints, reset validation, and sign-up guidance. Supabase Auth project policy must also be configured with the same minimum; that external setting was not inspected or changed here. |
| 2026-11-12 | Account-free applications and submission-time WhatsApp destination lookup | Pass: `npm run test:security` 22/22; `npm run lint`, `npm run typecheck`, and `git diff --check` pass | `/apply` no longer requires sign-up; guest submissions use a same-origin, IP/email-rate-limited server endpoint with validation, optional signed-in student linkage, idempotency keys, admin visibility, and server-side WhatsApp lookup. Static/source-contract evidence only: migration 09 is authored but not applied because the connected database state remains unknown; no live application or WhatsApp redirect was tested. |
| 2026-11-12 | User-reported guest application submit failure; read-only Supabase REST schema check | Failed: HTTP 400, PostgreSQL code `42703`, `applications.public_submission_key` does not exist; `application_reference` check returned HTTP 200 | Confirms migration 09 is missing from the configured database; no data was written or schema changed by the check. API now returns a migration-specific message instead of the generic verification error. Apply migration 09 only after confirming the prior migration state; then retry. |
| 2026-11-13 | Admin gallery redesigned from cards to a detailed CRUD table | Pass: `npm run test:security` 22/22; lint, TypeScript, and `git diff --check` pass | Table source-contract checks cover thumbnail/details/order/status/added/actions, expandable inline edit, delete, and horizontal overflow styling on narrow screens. Browser visual check was not run because the local preview at `127.0.0.1:3001` refused the connection; no database/gallery CRUD operation was performed. |
| 2026-11-13 | Admin training programmes redesigned from cards to a detailed CRUD table | Pass: `npm run test:security` 23/23; `npm run lint`, `npm run typecheck`, and `git diff --check` pass | Source-contract checks cover programme details/status columns, add, inline edit using the existing full programme form, unpublish, and horizontal overflow on narrow screens. Browser visual check was not run because the shared preview page was unavailable; no database/programme CRUD operation was performed. |
| 2026-11-13 | Training programme mobile layout and safe deletion | Pass: `npm run test:security` 23/23; `npm run lint`, `npm run typecheck`, and `git diff --check` pass | Mobile switches to stacked labeled programme cards with 44px actions. Delete checks for linked applications, blocks referenced programmes with HTTP 409, deletes unused programme records, audits deletion, and attempts image cleanup; unpublish remains a separate action. Source-contract tests only; no live database deletion or browser/device visual test was run. |
| 2026-11-12 | Supabase migrations 06–08, RLS/Storage integration, authenticated admin gallery/certificate and student certificate flows | Not run | Database state remains unknown after prior user-reported SQL failures. Migration 08 is destructive and remains unapplied; verify migration prerequisites, approved deletion, and a restorable backup first. |
| Not run | Successful Supabase migrations 00–05, RLS matrix, payment/refund/reconciliation provider flows | No successful result; user reported failed migration attempt | `psql`, Supabase CLI, and Docker are unavailable in this workspace; database state not inspected; do not treat as staging validation |
| Not run | k6/load/concurrency, backup restoration, CI, production smoke test | No result | No performance capacity, recovery, or release claim |

**Last evidence review:** 2026-11-13
**Reviewed by:** AI assistant; no Tamark/company approval recorded  
**Production approval:** None
