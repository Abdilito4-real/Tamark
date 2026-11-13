# Security architecture and deployment checklist

## Scope and trust boundaries

The application uses Next.js, Supabase Auth/Postgres/Storage, and same-origin application APIs. There is no online payment provider integration. Student applications are saved and submitted on the server before the browser opens WhatsApp with a short prefilled message; the user must choose to send it.

1. **Browser to Next.js:** authenticated cookies identify students and administrators. Mutating API requests require a same-origin `Origin`.
2. **Next.js to Supabase:** user-scoped clients rely on RLS. Server-only service-role clients bypass RLS and may only be used after route-level authorization.
3. **Storage:** published gallery images are public. Certificate PDFs are private and downloaded through an owner-checked route that issues a short-lived signed URL.
4. **External communication:** the application redirect includes only the applicant's name, selected programme, and application reference. Do not add additional personal data to this message without review.

## Threats and controls

| Threat | Controls in this codebase | Residual risk |
|---|---|---|
| Forged application ownership or status | Authenticated API, owner checks, versioned draft RPC, idempotent submission RPC, same-origin mutation checks | Database migrations and RLS are not yet validated against the deployed project |
| Unauthorized admin actions | Active-admin checks on service-role APIs; suspended accounts are denied | Role/RLS matrix needs staging integration tests |
| Cross-student certificate access | Student-scoped metadata query; private bucket; signed URL only after owner check | Storage policy and expiry behavior need staging tests |
| Unapproved public gallery content | Admin-only management API; publication flag; public query returns published items only | Content approval/consent process remains a company responsibility |
| Cross-site request forgery | Same-origin validation for all mutating API routes | Reverse-proxy origin configuration must be checked in deployment |
| Malicious or oversized uploads | Server-side MIME, size, and file-signature checks for images and PDFs | Malware scanning and file-retention policy are not implemented |
| Account takeover or suspended-user activity | Server-validated Supabase user, active-profile checks, suspension-aware API/RLS, password reset flow | MFA, SMTP, password policy, session lifetime, and account recovery require Supabase configuration |
| Audit history tampering | Audit table has RLS enabled, no user access, and service-role update/delete privileges revoked | Audit coverage and protected backup controls remain incomplete |

`admin` is the highest account role. There is no super-admin or separate finance role.

## Database migration order

Follow the complete ordered setup in `README.md`. The SQL files `security_financial_00` through `security_financial_05` are retained as historical prerequisites for databases that have not completed the previous workflow. Apply migrations individually and stop at the first error.

After migrations 00–05:

1. Apply `supabase/security_financial_06_whatsapp_applications.sql` to remove payment eligibility from draft saves/submission and set up the separate WhatsApp destination.
2. Apply `supabase/media_07_gallery_certificates.sql` to create gallery/certificate metadata and their public/private Storage buckets and policies.
3. Apply `supabase/security_financial_09_guest_applications.sql` to allow account-free submitted applications with an idempotency key. This migration must follow 06–07 and does not grant anonymous table access.
4. **Destructive step:** only after verifying that an approved backup is restorable and confirming financial-history deletion is approved, apply `supabase/security_financial_08_remove_payments.sql`. It deletes payment/refund records and payment-related notifications/audit events, then removes payment tables, routines, status type, notification reference, and programme fee columns. Do not run it if Tamark must retain those records. It does not delete copies in backups, exports, logs, or other systems; separately assess those copies under the approved retention and deletion procedures.

The previously reported SQL failures mean the actual database state is unknown. No migration from this feature has been executed. Before retrying or running the destructive migration, inspect the target database read-only:

```sql
select t.typname as enum_type, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('account_role', 'payment_status')
order by t.typname, e.enumsortorder;

select table_name, column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'organization_settings' and column_name = 'whatsapp_phone')
    or (table_name = 'profiles' and column_name in ('role', 'suspended_at'))
    or (table_name = 'applications' and column_name in ('application_reference', 'public_submission_key', 'status'))
    or (table_name = 'programmes' and column_name in ('price_minor', 'price_approved', 'currency'))
  )
order by table_name, ordinal_position;

select to_regclass('public.payments') as payments,
       to_regclass('public.refunds') as refunds,
       to_regclass('public.organization_settings') as organization_settings,
       to_regclass('public.gallery_items') as gallery_items,
       to_regclass('public.certificates') as certificates,
       to_regclass('public.api_rate_limits') as api_rate_limits;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('tamark-gallery', 'student-certificates');
```

Save exact results and errors without sharing credentials or project secrets. Do not drop objects, reset a project, skip prerequisites, or rerun a partially applied SQL file based on assumptions. Confirm migration 06's replacement application/programme policies exist before applying 08; they remove references to price columns so they can be dropped without `CASCADE`.

The application runtime errors for the missing `organization_settings.whatsapp_phone` column and `public.gallery_items` table indicate the connected database does not currently expose the schema expected by the app. If the read-only checks show the column/table is absent, confirm earlier migrations 00–05 succeeded and apply migration 06, then migration 07, individually in that order; stop on the first error because the prior migration state is unknown. If the table and column exist in PostgreSQL but PostgREST still reports a schema-cache miss, refresh the Supabase API schema cache with `NOTIFY pgrst, 'reload schema';` and retry. Do not add a code fallback that hides missing schema.

Migration 07 creates the public `tamark-gallery` bucket (JPG/PNG/WebP, 5 MB limit) and its public-read/admin-write Storage policies. The admin API uploads through the server-side service-role client, then inserts the object's path into `gallery_items`. If an upload fails, use the API's error toast to distinguish missing bucket/schema from a Storage permission/configuration issue; verify that the server-only service-role key is configured for the same Supabase project without copying it into chat or browser code. A gallery item visible after a page reload means both its database metadata and public image URL are currently readable, but does not prove a new upload will succeed.

Before migration 08, record the backup identifier and retention window, verify restore access, and confirm the active-database row purge is approved. The migration cannot purge historical copies held by backup, export, logging, or third-party systems.

## Deployment checklist

### Supabase and application configuration

- [ ] Use separate Supabase projects for development, staging, and production.
- [ ] Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` in the hosting provider's secret/configuration store.
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix it with `NEXT_PUBLIC_`.
- [ ] Set and verify the WhatsApp applications number in Administrator → Settings. Confirm the number includes country code and is controlled by Tamark.
- [ ] Configure Supabase Auth password policy, email confirmation, trusted SMTP, redirect allowlist, Auth rate limits, session lifetime, and MFA for privileged accounts where supported.
- [ ] Confirm TLS, trusted proxy/origin handling, database backups and restore procedures, and monitoring for application, upload, and notification failures.
- [ ] If browser push is enabled, configure VAPID values as described in `README.md`; keep the private key server-side.

### Staging verification before production

- [ ] Apply the full migration sequence to a staging copy, verifying schema, RLS, Storage policies, and rollback/restore procedures after each step.
- [ ] Test two student accounts: each can access only its own application and certificates, and cannot upload or read another student's private certificate.
- [ ] Test active and suspended admins against all admin APIs, gallery management, and certificate issuance.
- [ ] Verify drafts are version-checked, submission is idempotent, and WhatsApp opens only after the server returns a submitted application reference.
- [ ] Verify missing/invalid WhatsApp destination prevents submission and that the message contains no DOB, address, or other unnecessary data.
- [ ] Test image/PDF MIME, signature, and size rejection, database/storage failures, notification failures, and retry behavior.
- [ ] Confirm the public gallery exposes published images only and certificate files never have public URLs.
- [ ] Run `npm run test:security`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Known limitations and production gates

- Database migrations have not been run against the target or staging project; the previous SQL error state remains unknown.
- Historical payment/refund deletion is implemented only as a migration and remains unapplied. Validate approvals and backup before execution.
- Application document uploads are not implemented; do not reuse the certificate bucket for application documents.
- Email delivery queues, comprehensive audit coverage, backup restoration, monitoring, concurrency/load tests, and a complete accessibility review remain outstanding.
- Source-contract tests do not replace staging integration tests for RLS, migration behavior, Storage access, or browser redirects. Do not mark the feature production-approved until the readiness tracker acceptance criteria pass.
