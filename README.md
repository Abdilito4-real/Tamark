# Tamark Solar Energy

Next.js App Router application based on the approved prototype design. The original HTML file is retained as a visual reference only; it is not served or embedded.

## Local setup

1. Install Node.js 20.9 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL, anon key, service-role key, and public site URL.
4. Apply `supabase/schema.sql` to the Supabase project.
5. Apply `supabase/dashboard_migration.sql` to the Supabase project to add live dashboard records, organization settings, reports, and account email synchronization.
6. Apply `supabase/programme_catalogue_migration.sql` to enable public “Coming soon” programme listings and create the public-read, admin-write `programme-images` Storage bucket. This is safe to run on existing projects and can be run after `schema.sql` on a new project.
7. Apply `supabase/push_notifications_migration.sql` to store browser subscriptions. This historical migration also contains payment notification objects removed by migration 08.
8. Apply `supabase/security_financial_00_enum_values.sql` by itself. Wait for successful completion, then verify the enum values in a separate query/editor run before continuing.
9. Only after step 8 is committed, apply `supabase/security_financial_01_primitives.sql` by itself and wait for successful completion.
10. Only after step 9 succeeds, apply `supabase/security_financial_02_workflows.sql` by itself and wait for successful completion.
11. Only after step 10 succeeds, apply `supabase/security_financial_03_concurrency.sql` by itself.
12. Only after step 11 succeeds, apply `supabase/security_financial_04_draft_concurrency.sql` by itself.
13. Only after step 12 succeeds, apply `supabase/security_financial_05_admin_access.sql` by itself. This gives every active admin access to financial tools, removes the obsolete finance flag, and safely migrates any legacy role entries to `admin`.
14. Only after step 13 succeeds, apply `supabase/security_financial_06_whatsapp_applications.sql` by itself. This removes fees as an application prerequisite, adds the WhatsApp contact setting, and adds payment-free submission RPCs.
15. Only after step 14 succeeds, apply `supabase/media_07_gallery_certificates.sql` by itself to create the `tamark-gallery` public image bucket and metadata table, plus the private student certificate bucket/table. The admin upload API writes images to `tamark-gallery`; confirm the migration succeeds before uploading.
16. Only after steps 14–15 succeed, apply `supabase/security_financial_09_guest_applications.sql` by itself. This allows account-free submissions, adds a retry key, and keeps anonymous database access disabled. The public application API uses the server-only service role, validates submissions, and reads the saved WhatsApp destination at submission time.
17. **Destructive and optional:** only after steps 14–16 succeed, an approved backup is verified restorable, and deletion is approved, apply `supabase/security_financial_08_remove_payments.sql` by itself. It deletes stored payment/refund records and payment-related notifications/audit events, then removes payment objects and programme pricing columns. Do not run it if Tamark must retain these records. This migration does not erase copies in backups, exports, logs, or other systems; those copies remain subject to their own retention and approved deletion procedures.
18. If any migration reports an error, stop. Do not run later migrations or reset/drop database objects. The actual database state is unknown after previously reported SQL failures; inspect it read-only and use the recovery procedure in `SECURITY-ARCHITECTURE.md` before continuing.
19. Configure Web Push VAPID values as described below, then start the development server with `npm run dev`.

Use `http://localhost:3000` with `npm run dev`. Vercel builds use the deployment-provided `VERCEL_URL` if `NEXT_PUBLIC_SITE_URL` is missing or invalid, so a bad canonical-domain setting won't block deployment. Configure `NEXT_PUBLIC_SITE_URL` in Vercel's project environment settings to Tamark's actual canonical HTTPS domain for correct canonical links, Open Graph URLs, and sitemap entries. Do not use a preview deployment URL as the production canonical.

The service-role key is server-only. Never prefix it with `NEXT_PUBLIC_` or expose it to the browser. This release has no online payment provider integration.

The supplied `public/Solar Leaf Energy Emblem.png` is the source logo. The optimized logo is used across the site, dashboards, and application flow; `public/favicon.ico`, the Apple icon, and `public/site.webmanifest` provide browser and installable app icons. Keep the original source image unchanged when regenerating these derivatives.

## Current implementation

- The public home, training catalogue, programme detail, application, student portal, and administrator route surfaces are implemented in React and TypeScript.
- Training programmes load from Supabase. The schema seeds six prototype programme names as publicly listed “Coming soon” drafts; applications are available for programmes published by an administrator.
- Student routes load authenticated applications, profile details, certificates, published announcements, training sessions, and notifications. Students can update their profile and mark notifications read.
- Administrators can create/edit programmes, publish/unpublish courses, review applications, view students, manage schedules and announcements, set the separate WhatsApp applications number, manage the public gallery, issue private student certificates, update approved public contact settings, and export application/student reports.
- Administrators can upload JPG, PNG, or WebP programme artwork (up to 5 MB). Images are stored in the `programme-images` Supabase Storage bucket; public listing images are readable publicly, while uploads are restricted to administrator requests.
- Students can opt in to browser push alerts for application decisions and training updates from Notifications. In-app notifications remain available if a browser has push disabled.
- Admin-managed gallery images are displayed on the public homepage after publication. Student certificates are private PDFs, downloadable only by their owner through a short-lived signed URL.
- No demo student accounts, course prices, references, revenue, contact details, or sample schedules are shipped. Initial course names are listed as unpublished drafts; contact details are blank until approved by Tamark.
- Student signup and sign-in use Supabase Auth. Apply `supabase/schema.sql` before enabling accounts. Administrator roles must be assigned through a trusted Supabase administrative process; users cannot change their own role.
- Applicants can open `/apply` and submit without creating an account. If a signed-in student applies, their profile may prefill the form and the submission remains linked to that account; guest applications are reviewable by administrators but are not attached to student dashboards.
- The application has four steps (personal details, contact details, programme, review and send); education is not collected. Name, email, and phone are prefilled from a signed-in student's profile when available. Incomplete drafts autosave to the current browser.
- Final submission is validated and persisted by a rate-limited server endpoint before WhatsApp opens. Retry keys prevent duplicate records; the endpoint reads the current WhatsApp destination from organization settings rather than trusting a cached page or client value.
- The WhatsApp destination is configured separately under Administrator → Settings; the number field pre-fills Nigeria's `+234` country code when no destination has been saved. Enter the rest of Tamark's WhatsApp number without the local leading zero, then save after the WhatsApp database migration has been applied. No payment is collected through the website.
- Migration 08 deletes historical payment/refund records from the active database when applied. The migration has not been run; actual database state and backup status must be checked first. It does not erase backup, export, log, or third-party copies, which remain subject to their retention and approved deletion procedures. Do not apply it if financial history must be retained.
- Password reset is available at `/reset-password`. Sign-up and password reset require a minimum of 8 characters; configure Supabase Auth with the same minimum for deployment.

For production rollout, apply all database migrations and complete the staged verification checklist in [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md). Configure Supabase Auth (password policy, email confirmation, SMTP, redirect allowlist, and rate limits) in the Supabase dashboard; these settings are not controlled by this repository.

## Browser push notifications

Generate a VAPID key pair locally with `npx web-push generate-vapid-keys`. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `PUSH_VAPID_PRIVATE_KEY`, and a real contact such as `mailto:admin@your-domain.example` in `PUSH_VAPID_SUBJECT` in `.env.local` and the deployment server environment. The public key is safe to expose; never expose or commit the private key. Restart/rebuild the app after setting the public key. Push requires HTTPS in production; localhost is supported for local development. Students enable or disable this device's browser subscription from **Student portal → Notifications**.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run test:security`
- `npm run build`
