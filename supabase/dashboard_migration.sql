create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references public.programmes(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  details text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_session_dates_valid check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_settings (
  id boolean primary key default true check (id),
  organization_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;
create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email)) where email is not null;

create or replace function public.create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_student_profile();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute procedure public.create_student_profile();

alter table public.announcements enable row level security;
alter table public.training_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.organization_settings enable row level security;

create policy "Students can view published announcements"
  on public.announcements for select to authenticated
  using (published or (select public.current_user_is_admin()));
create policy "Admins can manage announcements"
  on public.announcements for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Authenticated users can view training sessions"
  on public.training_sessions for select to authenticated using (true);
create policy "Admins can manage training sessions"
  on public.training_sessions for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Students can view and update their own notifications"
  on public.notifications for select to authenticated
  using (student_id = (select auth.uid()) or (select public.current_user_is_admin()));
create policy "Students can mark their own notifications read"
  on public.notifications for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
create policy "Admins can manage notifications"
  on public.notifications for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Admins can view organization settings"
  on public.organization_settings for select to authenticated
  using ((select public.current_user_is_admin()));
create policy "Admins can manage organization settings"
  on public.organization_settings for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));
create policy "Public can read approved organization contact details"
  on public.organization_settings for select to anon
  using (id = true);

create index if not exists announcements_published_idx on public.announcements (published, published_at desc);
create index if not exists training_sessions_starts_idx on public.training_sessions (starts_at);
create index if not exists notifications_student_created_idx on public.notifications (student_id, created_at desc);

create or replace function public.admin_payment_summary()
returns table (currency text, payment_count bigint, revenue_minor numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.currency, count(*)::bigint, sum(p.amount_minor)::numeric
  from public.payments p
  where p.status = 'verified'
  group by p.currency
  order by p.currency;
$$;
revoke all on function public.admin_payment_summary() from public, anon, authenticated;
grant execute on function public.admin_payment_summary() to service_role;

create or replace function public.admin_application_summary()
returns table (status public.application_status, application_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.status, count(*)::bigint
  from public.applications a
  group by a.status
  order by a.status;
$$;
revoke all on function public.admin_application_summary() from public, anon, authenticated;
grant execute on function public.admin_application_summary() to service_role;

create or replace function public.finalize_verified_payment(p_reference text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
begin
  select * into payment_row
  from public.payments
  where provider_reference = p_reference
  for update;
  if not found then raise exception 'Payment reference not found'; end if;
  if payment_row.status not in ('pending', 'verified', 'failed') then raise exception 'Payment cannot be finalized'; end if;

  update public.applications
  set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_at = now()
  where id = payment_row.application_id and status = 'draft';
  if not found and not exists (
    select 1 from public.applications
    where id = payment_row.application_id and status in ('submitted', 'under_review', 'approved', 'rejected')
  ) then raise exception 'Application cannot be submitted'; end if;

  update public.payments
  set status = 'verified', verified_at = coalesce(verified_at, now())
  where id = payment_row.id;
  return payment_row.application_id;
end;
$$;
revoke all on function public.finalize_verified_payment(text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text) to service_role;

grant select on public.announcements, public.training_sessions, public.notifications, public.organization_settings to authenticated;
grant insert, update, delete on public.announcements, public.training_sessions, public.notifications, public.organization_settings to authenticated;
grant select on public.organization_settings to anon;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

insert into public.organization_settings (id) values (true) on conflict (id) do nothing;
