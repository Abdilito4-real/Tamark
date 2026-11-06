# Security architecture and deployment checklist

## Scope and trust boundaries

This application uses Next.js server routes and Supabase Auth/Postgres, with Paystack as the payment provider. The browser is untrusted. Prices, application ownership, payment status, permissions, and refund eligibility are checked server-side or in restricted database functions.

Trust boundaries:

1. **Browser to Next.js:** authenticated cookies identify students and administrators. Mutating API requests must have a same-origin `Origin`; the public Paystack webhook is exempt from this check but requires a valid HMAC signature.
2. **Next.js to Supabase:** user-scoped Supabase clients enforce RLS. Server-only service-role clients bypass RLS and must only be used after the route has checked the caller's role and permissions.
3. **Next.js to Paystack:** secret-key requests initialize and verify payments and request refunds. A browser redirect is not proof of payment.
4. **Paystack to webhook:** webhook bodies are size-limited, signature-checked against the exact raw body, and deduplicated by provider event identity. Payment state is verified directly with Paystack before it is finalized.

## Threats and controls

| Threat | Controls in this codebase | Residual risk |
|---|---|---|
| Forged or replayed payment confirmation | Paystack HMAC verification; server-side transaction lookup; reference, amount, currency, and customer email matching; idempotent payment finalization | Provider credentials, database migrations, and webhook delivery settings must be correct |
| Browser changes price, owner, or payment status | Server-selected approved programme price; authenticated ownership checks; database constraints and restricted workflow functions; no direct authenticated application writes | Production schema must include all security migrations |
| Unauthorized access to finance records | Active admin checks in finance routes and payment/refund RLS; students can view only their own records | Service-role routes bypass RLS and require ongoing route-level authorization review |
| Cross-site request forgery | Same-origin validation for mutating API routes; webhook uses provider signature instead | Production proxy/origin configuration must preserve the expected request origin |
| Repeated sensitive operations | Database-backed rate limits for payment verification, application submit, and refund requests | Supabase Auth login/recovery rate limits are configured outside this repository |
| Unauthorized or duplicate refund | Finance permission, explicit full-refund confirmation and reason, successful-payment eligibility, a single pending refund per payment, audit record, and pending state for uncertain provider outcomes | Partial refunds are not supported; pending refunds require manual provider review |
| Audit history tampering | Audit table has RLS enabled, no user access, and service-role update/delete privileges revoked | Login, password changes, and every administrator action are not yet comprehensively audited; protect database owners and backups |
| Account takeover or suspended-user activity | Server-validated Supabase user, active-profile checks, suspension-aware RLS and API contexts, password reset flow | MFA, SMTP delivery, password strength enforcement, session lifetime, and account-recovery policy require Supabase configuration |

## Administrator access

`admin` is the highest account role. Every active administrator can use the admin dashboard, payments, reports, refunds, reconciliation, and programme pricing tools. Suspended accounts remain denied. There is no separate finance flag or higher administrator role.

## Database migration order

On a new project, first apply the existing schema files in the order shown in `README.md`. Then apply these files **one at a time and in order**:

1. `supabase/security_financial_00_enum_values.sql` alone; wait for success and commit before continuing.
2. `supabase/security_financial_01_primitives.sql` alone; run only after step 1 is committed and its enum labels are visible in a fresh query.
3. `supabase/security_financial_02_workflows.sql` alone; run only after step 2 succeeds.
4. `supabase/security_financial_03_concurrency.sql` alone; run only after step 3 succeeds.
5. `supabase/security_financial_04_draft_concurrency.sql` alone; run only after step 4 succeeds.
6. `supabase/security_financial_05_admin_access.sql` alone; run only after step 5 succeeds. It removes the obsolete finance flag and, if present, rebuilds `account_role` to contain only `student` and `admin`, mapping any legacy super-admin profiles to `admin`. The type rebuild is guarded: unexpected enum labels or role-column dependencies stop the migration without cascading drops.

The payment-status enum additions in step 1 must be committed before later migrations use those new values. Account roles are only `student` and `admin`. Migration 03 backfills references for legacy non-draft applications and makes repeated paid-application submission return the existing reference. Migration 04 makes draft saves conditional on the expected row version and returns a conflict rather than silently overwriting a different saved draft. Migration 05 grants every active admin access to financial tools and removes legacy privilege distinctions. Do not paste multiple numbered migrations into one SQL execution. Do not apply these migrations directly to production without first applying them to a staging project, reviewing the changes, and taking a database backup.

### If a migration reports an error

Stop immediately; do not run later migrations, drop objects, or reset the project. A failed SQL editor script may have rolled back, or may have left earlier statements applied depending on how it was executed. First inspect the actual database state with read-only queries:

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
    (table_name = 'profiles' and column_name in ('role', 'suspended_at', 'can_manage_finances'))
    or (table_name = 'applications' and column_name = 'application_reference')
    or (table_name = 'payments' and column_name in ('customer_email', 'authorization_url', 'status'))
  )
order by table_name, ordinal_position;

select to_regclass('public.audit_logs') as audit_logs,
       to_regclass('public.paystack_webhook_events') as webhook_events,
       to_regclass('public.refunds') as refunds,
       to_regclass('public.api_rate_limits') as api_rate_limits;
```

Save the exact errors and results, redact project identifiers if sharing them, then compare the results with the migration prerequisites. The previously reported `22P02` for `super_admin` came from an earlier migration version. Current code does not use a higher role or finance flag, and migration 05 removes those legacy database entries after migrations 00–04 succeed. The `successful` enum error means the payment-status label was not available to the failing statements in that database transaction (usually because migration 00 was skipped, failed, or its enum changes were not committed separately). The missing `application_reference` error means migration 01 did not successfully establish its prerequisite, so migration 03 cannot run yet.

Recovery order: inspect the actual state read-only; run migration 00; verify its payment-status labels are visible in a fresh query; run 01 and confirm its columns/tables; then run 02, 03, 04, and finally 05. Do not manually remove enum labels or drop objects. Migration 05 handles the obsolete role/flag only after checking its dependencies and aborts rather than cascading if the database differs from the expected schema. Each file is intended to be repeatable for its guarded objects, but do not assume a partially executed script is safe to replay without checking its state first. If migration 01 stops at the documented NGN constraint, resolve the existing non-NGN records with Tamark rather than bypassing the constraint. Do not run this recovery sequence against production as a test.

Migration 01 intentionally stops if existing programme or payment records use a currency other than NGN. Resolve those records with the business owner before retrying; do not remove or bypass the currency constraints without reviewing payment and reporting behavior.

After migration, use a trusted Supabase administrative process to assign only `student` or `admin` roles. Never grant a user administrative access based on browser-submitted profile data.

## Deployment checklist

### Supabase and application configuration

- [ ] Use separate Supabase and Paystack projects/keys for development, staging, and production.
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_MODE`, `PAYSTACK_SECRET_KEY`, and `NEXT_PUBLIC_SITE_URL` in the hosting provider's secret/configuration store.
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` server-only; never use the `NEXT_PUBLIC_` prefix for either.
- [ ] Use `PAYSTACK_MODE=test` with a test secret in non-production. Set `PAYSTACK_MODE=live` only with an approved live key and production payment approval.
- [ ] Configure the Paystack webhook URL as `https://<production-domain>/api/payments/webhook`; confirm successful test delivery and signature validation before enabling live charges.
- [ ] Configure Supabase Auth: enforce at least a 12-character password, enable email confirmation as required, use trusted SMTP, restrict allowed redirect URLs to deployed origins, and set appropriate login/recovery rate limits.
- [ ] Set session lifetime/refresh policy and enable MFA for privileged accounts where supported by the organization's Supabase Auth setup.
- [ ] Confirm production TLS, trusted proxy/origin handling, database backups and restore procedures, and monitoring/alerting for failed payment, webhook, and refund operations.
- [ ] If browser push is enabled, configure the VAPID values as described in `README.md`; keep the private key server-side.

### Staging verification before production

- [ ] Apply the full migration sequence to a staging copy and check that all constraints, policies, and functions complete successfully.
- [ ] Test RLS with two student accounts: each can read only their own payments/refunds and cannot directly insert or update applications or payment records.
- [ ] Test an active administrator and a suspended administrator: active admins can read financial records and call finance endpoints; suspended admins are denied.
- [ ] Confirm a student cannot submit an application until payment is successful, and that verification alone leaves the application as a draft until the student explicitly submits it.
- [ ] In Paystack test mode, exercise a successful transaction, a failed transaction, duplicate webhook delivery, invalid signature, and mismatched reference/amount/currency/email.
- [ ] Test full refunds with accepted, rejected, and uncertain provider outcomes. Reconcile uncertain outcomes manually; do not resubmit while the first outcome is unknown.
- [ ] Run reconciliation for a small date range and verify that it reports discrepancies without changing payment records.
- [ ] Confirm receipts are unavailable to another student and are unavailable for non-successful payments.
- [ ] Run `npm run test:security`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Known limitations and production gates

- Private application-document uploads and signed-download routes are not implemented. Do not collect sensitive documents through an unreviewed public bucket or endpoint.
- Only full refunds are implemented. Partial refunds and automated reconciliation of provider refund records are not implemented.
- Reconciliation is read-only, limited to 31 days and 1,000 transactions per run; pending refunds are flagged for manual provider review.
- Audit logging does not yet cover every login, password change, or administrator action. Supabase Auth logs and database/provider monitoring remain necessary.
- The automated security test currently covers Paystack signature validation. It does not replace staging integration tests for RLS, migrations, payment state transitions, or provider behavior.
- Database migrations have not been run against the production project as part of this code change. Do not consider payment security production-ready until staging verification, deployment configuration, and the remaining limitations have been reviewed and accepted.
