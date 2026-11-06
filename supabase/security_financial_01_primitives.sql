alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.applications
  add column if not exists application_reference text;

alter table public.payments
  add column if not exists customer_email text,
  alter column authorization_url drop not null;

update public.payments p
set customer_email = lower(profile.email)
from public.profiles profile
where profile.id = p.student_id and p.customer_email is null and profile.email is not null;

do $$
begin
  if exists (select 1 from public.programmes where currency <> 'NGN')
     or exists (select 1 from public.payments where currency <> 'NGN') then
    raise exception 'Resolve non-NGN programme and payment records before applying NGN-only constraints';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'programmes_currency_ngn_check'
      and conrelid = 'public.programmes'::regclass
  ) then
    alter table public.programmes add constraint programmes_currency_ngn_check check (currency = 'NGN');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'payments_currency_ngn_check'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments add constraint payments_currency_ngn_check check (currency = 'NGN');
  end if;
end;
$$;

create unique index if not exists applications_reference_unique_idx
  on public.applications (application_reference)
  where application_reference is not null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  related_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.paystack_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  provider_reference text,
  payload_sha256 text not null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  received_at timestamptz not null default now(),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.paystack_webhook_events
  add column if not exists claimed_at timestamptz not null default now();

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  requested_by uuid references public.profiles(id) on delete set null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  reason text not null check (length(reason) between 1 and 1000),
  provider_reference text unique,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists refunds_one_pending_per_payment_idx
  on public.refunds (payment_id) where status = 'pending';
create index if not exists refunds_created_idx on public.refunds (created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and suspended_at is null
  );
$$;

create or replace function public.current_user_is_active_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'student'
      and suspended_at is null
  );
$$;

drop policy if exists "Profiles are visible to their owner and admins" on public.profiles;
create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_is_admin()));
drop policy if exists "Students can update their own profile" on public.profiles;
create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'student' and suspended_at is null)
  with check (id = (select auth.uid()) and role = 'student' and suspended_at is null);

drop policy if exists "Students can view their applications and admins can view all" on public.applications;
create policy "Students can view their applications and admins can view all"
  on public.applications for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));

drop policy if exists "Students can view their payments and admins can view all" on public.payments;
drop policy if exists "Students and finance admins can view payments" on public.payments;
create policy "Students and admins can view payments"
  on public.payments for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));

drop policy if exists "Students can view and update their own notifications" on public.notifications;
create policy "Students can view and update their own notifications"
  on public.notifications for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));
drop policy if exists "Students can mark their own notifications read" on public.notifications;
create policy "Students can mark their own notifications read"
  on public.notifications for update to authenticated
  using (student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
  with check (student_id = (select auth.uid()) and (select public.current_user_is_active_student()));

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket public.api_rate_limits%rowtype;
begin
  if p_bucket_key is null or length(p_bucket_key) < 32 or length(p_bucket_key) > 160
     or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.api_rate_limits (bucket_key, window_started_at, request_count)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do nothing;

  select * into current_bucket
  from public.api_rate_limits
  where bucket_key = p_bucket_key
  for update;

  if current_bucket.window_started_at <= now() - make_interval(secs => p_window_seconds) then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1, updated_at = now()
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if current_bucket.request_count >= p_limit then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

create or replace function public.claim_paystack_webhook_event(
  p_event_key text,
  p_event_type text,
  p_provider_reference text,
  p_payload_sha256 text
)
returns table(claimed boolean, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
  current_status text;
  current_claimed_at timestamptz;
begin
  if p_event_key is null or length(p_event_key) <> 64
     or p_event_type is null or length(p_event_type) < 1 or length(p_event_type) > 120
     or p_payload_sha256 is null or length(p_payload_sha256) <> 64 then
    raise exception 'Invalid webhook event';
  end if;

  insert into public.paystack_webhook_events (
    event_key, event_type, provider_reference, payload_sha256
  ) values (
    p_event_key, p_event_type, p_provider_reference, p_payload_sha256
  )
  on conflict (event_key) do nothing
  returning id into event_id;

  if event_id is not null then
    return query select true, 'claimed'::text;
    return;
  end if;

  select event.id, event.processing_status, event.claimed_at
  into event_id, current_status, current_claimed_at
  from public.paystack_webhook_events event
  where event.event_key = p_event_key
  for update;

  if current_status = 'processed' then
    return query select false, 'processed'::text;
    return;
  end if;
  if current_status = 'processing' and current_claimed_at > now() - interval '2 minutes' then
    return query select false, 'busy'::text;
    return;
  end if;

  update public.paystack_webhook_events
  set processing_status = 'processing',
      attempts = attempts + 1,
      last_error = null,
      payload_sha256 = p_payload_sha256,
      claimed_at = now()
  where id = event_id;

  return query select true, 'claimed'::text;
end;
$$;

create or replace function public.write_audit_log(
  p_actor_id uuid,
  p_event_type text,
  p_related_record_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if p_event_type is null or length(p_event_type) < 1 or length(p_event_type) > 120 then
    raise exception 'Invalid audit event type';
  end if;
  insert into public.audit_logs (actor_id, event_type, related_record_id, metadata, correlation_id)
  values (p_actor_id, p_event_type, p_related_record_id, coalesce(p_metadata, '{}'::jsonb), p_correlation_id)
  returning id into result_id;
  return result_id;
end;
$$;

alter table public.audit_logs enable row level security;
alter table public.paystack_webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.api_rate_limits enable row level security;

revoke all on public.audit_logs, public.paystack_webhook_events, public.api_rate_limits from anon, authenticated;
revoke all on public.refunds from anon, authenticated;
grant select on public.refunds to authenticated;

drop policy if exists "Students can view their refunds" on public.refunds;
drop policy if exists "Students and finance admins can view refunds" on public.refunds;
create policy "Students and admins can view refunds"
  on public.refunds for select to authenticated
  using (exists (
    select 1 from public.payments p
    where p.id = refunds.payment_id
      and (
        (p.student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
        or (select public.current_user_is_admin())
      )
  ));

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
revoke all on function public.claim_paystack_webhook_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_paystack_webhook_event(text, text, text, text) to service_role;
revoke all on function public.write_audit_log(uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, jsonb, text) to service_role;
revoke all on function public.current_user_is_active_student() from public, anon;
grant execute on function public.current_user_is_active_student() to authenticated;

revoke update, delete on public.audit_logs from service_role;
grant insert, select on public.audit_logs to service_role;
