create extension if not exists pgcrypto;

create type public.account_role as enum ('student', 'admin');
create type public.application_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected');
create type public.payment_status as enum ('pending', 'verified', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.account_role not null default 'student',
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null default '',
  category text not null default '',
  duration text,
  price_minor integer check (price_minor is null or price_minor >= 0),
  price_approved boolean not null default false,
  currency text not null default 'NGN',
  curriculum jsonb not null default '[]'::jsonb,
  outcomes jsonb not null default '[]'::jsonb,
  entry_requirements text,
  image_path text,
  is_published boolean not null default false,
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  programme_id uuid not null references public.programmes (id),
  status public.application_status not null default 'draft',
  personal_details jsonb not null default '{}'::jsonb,
  contact_details jsonb not null default '{}'::jsonb,
  education_details jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  provider_reference text not null unique,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'NGN',
  authorization_url text not null,
  status public.payment_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now()
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
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.programmes enable row level security;
alter table public.applications enable row level security;
alter table public.payments enable row level security;

create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_is_admin()));
create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'student')
  with check (id = (select auth.uid()) and role = 'student');
revoke update on public.profiles from authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

create policy "Published programmes are public"
  on public.programmes for select to anon, authenticated
  using (is_listed or (is_published and price_approved) or (select public.current_user_is_admin()));
create policy "Admins can manage programmes"
  on public.programmes for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Students can view their applications and admins can view all"
  on public.applications for select to authenticated
  using (student_id = (select auth.uid()) or (select public.current_user_is_admin()));
create policy "Students can create their own applications"
  on public.applications for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'draft'
    and exists (
      select 1 from public.programmes p
      where p.id = applications.programme_id and p.is_published and p.price_approved
    )
  );
create policy "Students can update their own drafts"
  on public.applications for update to authenticated
  using ((student_id = (select auth.uid()) and status = 'draft') or (select public.current_user_is_admin()))
  with check (
    (student_id = (select auth.uid()) and status = 'draft' and exists (
      select 1 from public.programmes p
      where p.id = applications.programme_id and p.is_published and p.price_approved
    )) or (select public.current_user_is_admin())
  );

create policy "Students can view their payments and admins can view all"
  on public.payments for select to authenticated
  using (student_id = (select auth.uid()) or (select public.current_user_is_admin()));

create index applications_student_created_idx on public.applications (student_id, created_at desc);
create index payments_student_created_idx on public.payments (student_id, created_at desc);
create index payments_application_idx on public.payments (application_id, created_at desc);
create unique index payments_one_pending_per_application_idx
  on public.payments (application_id) where status = 'pending';

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

  if not found then
    raise exception 'Payment reference not found';
  end if;

  if payment_row.status not in ('pending', 'verified', 'failed') then
    raise exception 'Payment cannot be finalized';
  end if;

  update public.applications
  set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_at = now()
  where id = payment_row.application_id and status = 'draft';

  if not found and not exists (
    select 1 from public.applications
    where id = payment_row.application_id and status in ('submitted', 'under_review', 'approved', 'rejected')
  ) then
    raise exception 'Application cannot be submitted';
  end if;

  update public.payments
  set status = 'verified',
      verified_at = coalesce(verified_at, now())
  where id = payment_row.id;

  return payment_row.application_id;
end;
$$;
revoke all on function public.finalize_verified_payment(text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text) to service_role;

insert into public.programmes (slug, name, category, summary, duration, price_minor, price_approved, is_published, is_listed)
values
  ('solar-pv-installation-maintenance', 'Solar PV Installation and Maintenance', 'Solar PV', '', null, null, false, false, true),
  ('inverter-installation-troubleshooting', 'Inverter Installation and Troubleshooting', 'Inverters', '', null, null, false, false, true),
  ('solar-system-design-sizing', 'Solar System Design and Sizing', 'Design', '', null, null, false, false, true),
  ('battery-technology-energy-storage', 'Battery Technology and Energy Storage', 'Storage', '', null, null, false, false, true),
  ('off-grid-systems-rural-communities', 'Off-Grid Systems for Rural Communities', 'Design', '', null, null, false, false, true),
  ('solar-business-entrepreneurship', 'Solar Business and Entrepreneurship', 'Business', '', null, null, false, false, true)
on conflict (slug) do nothing;

create or replace function public.create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_student_profile();
