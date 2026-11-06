# Tamark Solar Energy

Next.js App Router application based on the approved prototype design. The original HTML file is retained as a visual reference only; it is not served or embedded.

## Local setup

1. Install Node.js 20.9 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL, anon key, service-role key, Paystack secret key, and public site URL.
4. Apply `supabase/schema.sql` to the Supabase project.
5. Apply `supabase/dashboard_migration.sql` to the Supabase project to add live dashboard records, organization settings, reports, and account email synchronization.
6. Apply `supabase/programme_catalogue_migration.sql` to enable public “Coming soon” programme listings and create the public-read, admin-write `programme-images` Storage bucket. This is safe to run on existing projects and can be run after `schema.sql` on a new project.
7. Apply `supabase/push_notifications_migration.sql` to store browser subscriptions and add idempotent payment notifications.
8. Apply `supabase/security_financial_00_enum_values.sql` by itself. Wait for successful completion, then verify the enum values in a separate query/editor run before continuing.
9. Only after step 8 is committed, apply `supabase/security_financial_01_primitives.sql` by itself and wait for successful completion.
10. Only after step 9 succeeds, apply `supabase/security_financial_02_workflows.sql` by itself and wait for successful completion.
11. Only after step 10 succeeds, apply `supabase/security_financial_03_concurrency.sql` by itself.
12. Only after step 11 succeeds, apply `supabase/security_financial_04_draft_concurrency.sql` by itself.
13. Only after step 12 succeeds, apply `supabase/security_financial_05_admin_access.sql` by itself. This gives every active admin access to financial tools, removes the obsolete finance flag, and safely migrates any legacy role entries to `admin`.
14. If any migration reports an error, stop. Do not run later migrations or reset/drop database objects. Inspect the migration state using the recovery procedure in `SECURITY-ARCHITECTURE.md`; resume only after the failed stage has been diagnosed.
15. Configure Web Push VAPID values as described below, then start the development server with `npm run dev`.

Use `http://localhost:3000` with `npm run dev`. Vercel builds use the deployment-provided `VERCEL_URL` if `NEXT_PUBLIC_SITE_URL` is missing or invalid, so a bad canonical-domain setting won't block deployment. Configure `NEXT_PUBLIC_SITE_URL` in Vercel's project environment settings to Tamark's actual canonical HTTPS domain for correct canonical links, Open Graph URLs, and sitemap entries. Do not use a preview deployment URL as the production canonical.

The service-role key and Paystack secret key are server-only. Never prefix either with `NEXT_PUBLIC_` or expose them to the browser. `PAYSTACK_MODE` defaults to `test`; use a Paystack test secret key (`sk_test_...`) for development. The application rejects a live key in test mode. Only set `PAYSTACK_MODE=live` together with a live secret key (`sk_live_...`) when Tamark has approved production payments.

The supplied `public/Solar Leaf Energy Emblem.png` is the source logo. The optimized logo is used across the site, dashboards, application flow, and PDF receipts; `public/favicon.ico`, the Apple icon, and `public/site.webmanifest` provide browser and installable app icons. Keep the original source image unchanged when regenerating these derivatives.

## Current implementation

- The public home, training catalogue, programme detail, application, checkout, student portal, and administrator route surfaces are implemented in React and TypeScript.
- Training programmes load from Supabase. The schema seeds the six prototype programme names as publicly listed “Coming soon” drafts without demo descriptions, durations, prices, or curriculum. Applications and checkout remain unavailable until Tamark supplies and approves commercial details and an administrator publishes the programme.
- Student routes load authenticated applications, successful payments, profile details, published announcements, training sessions, and notifications. Students can update their profile and mark notifications read.
- Administrators can create/edit programmes, set and approve prices, publish/unpublish courses, review applications, view students and payments, manage schedules and announcements, update approved public contact settings, and export current reports. Management APIs check the appropriate administrator role and permission; payment totals are aggregated from successful records.
- Administrators can upload JPG, PNG, or WebP programme artwork (up to 5 MB). Images are stored in the `programme-images` Supabase Storage bucket; public listing images are readable publicly, while uploads are restricted to administrator requests.
- Students can opt in to browser push alerts for application decisions and successful payments from Notifications. In-app notifications remain available if a browser has push disabled.
- No demo student accounts, course prices, references, revenue, contact details, or sample schedules are shipped. Initial course names are listed as unpublished drafts; contact details are blank until approved by Tamark.
- Student signup and sign-in use Supabase Auth. Apply `supabase/schema.sql` before enabling accounts. Administrator roles must be assigned through a trusted Supabase administrative process; users cannot change their own role.
- Students must create an account and sign in before opening the application form. Email-confirmation callbacks return them to the application they requested.
- The application has five steps (personal details, contact details, programme, review, payment); education is not collected. Phone numbers accept digits only and are checked both in the form and on the server. Drafts autosave to the current browser.
- Application drafts are saved through an authenticated database function. Final submission requires a successful payment and a separate explicit student action.
- Paystack checkout requires both server credentials and a valid site URL. Server-side verification or a signed webhook records successful payment, but does not submit the application. Only successful payment rows can produce downloadable PDF receipts.
- Administrators have access to financial records and operations. `admin` is the highest account role. Refunds currently support full refunds only.
- Password reset is available at `/reset-password`. Password length checks in the UI must be paired with the Supabase Auth password policy configured for deployment.

## Paystack deployment

For test payments, set `PAYSTACK_MODE=test` and configure your Paystack test secret key as `PAYSTACK_SECRET_KEY` in `.env.local` or your server environment. Do not send the key in chat or commit it. The same Paystack API endpoints automatically use test mode based on the key. Set `NEXT_PUBLIC_SITE_URL` to your app origin and configure Paystack's webhook URL as `https://<your-domain>/api/payments/webhook`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only as well.

The admin must enter a positive programme price, explicitly approve it, then publish the programme before applications can proceed to checkout. Paystack amounts are sent in the currency's minor unit. Transaction reference, amount, currency, and customer email are re-verified against Paystack before a database function records the payment as successful. The student then explicitly submits the application. The receipt endpoint returns a receipt only for a successful payment owned by the signed-in student.

For production rollout, apply all database migrations and complete the staged verification checklist in [SECURITY-ARCHITECTURE.md](./SECURITY-ARCHITECTURE.md). Configure Supabase Auth (password policy, email confirmation, SMTP, redirect allowlist, and rate limits) in the Supabase dashboard; these settings are not controlled by this repository.

## Browser push notifications

Generate a VAPID key pair locally with `npx web-push generate-vapid-keys`. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `PUSH_VAPID_PRIVATE_KEY`, and a real contact such as `mailto:admin@your-domain.example` in `PUSH_VAPID_SUBJECT` in `.env.local` and the deployment server environment. The public key is safe to expose; never expose or commit the private key. Restart/rebuild the app after setting the public key. Push requires HTTPS in production; localhost is supported for local development. Students enable or disable this device's browser subscription from **Student portal → Notifications**.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run test:security`
- `npm run build`
