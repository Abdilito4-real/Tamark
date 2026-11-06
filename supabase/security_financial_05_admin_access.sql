begin;

drop policy if exists "Profiles are visible to their owner and admins" on public.profiles;
drop policy if exists "Students can update their own profile" on public.profiles;
drop policy if exists "Students can view their applications and admins can view all" on public.applications;
drop policy if exists "Students can view their payments and admins can view all" on public.payments;
drop policy if exists "Students and finance admins can view payments" on public.payments;
drop policy if exists "Students and admins can view payments" on public.payments;
drop policy if exists "Students can view and update their own notifications" on public.notifications;
drop policy if exists "Students can mark their own notifications read" on public.notifications;
drop policy if exists "Students can view their refunds" on public.refunds;
drop policy if exists "Students and finance admins can view refunds" on public.refunds;
drop policy if exists "Students and admins can view refunds" on public.refunds;

drop function if exists public.current_user_can_manage_finances();

alter table public.profiles drop column if exists can_manage_finances;

do $$
declare
  role_type oid;
  role_labels text[];
  unexpected_role_columns text[];
begin
  select t.oid, array_agg(e.enumlabel order by e.enumsortorder)
  into role_type, role_labels
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public' and t.typname = 'account_role'
  group by t.oid;

  if role_type is null then
    raise exception 'public.account_role is missing; inspect the schema before applying this migration';
  end if;

  if exists (
    select 1 from unnest(role_labels) as labels(value)
    where value not in ('student', 'admin', 'super_admin')
  ) then
    raise exception 'public.account_role contains unexpected labels; review them before cleanup';
  end if;

  if not role_labels @> array['super_admin']::text[] then
    return;
  end if;

  select array_agg(format('%I.%I.%I', ns.nspname, cls.relname, attr.attname))
  into unexpected_role_columns
  from pg_attribute attr
  join pg_class cls on cls.oid = attr.attrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  where attr.atttypid = role_type
    and attr.attnum > 0
    and not attr.attisdropped
    and not (ns.nspname = 'public' and cls.relname = 'profiles' and attr.attname = 'role');

  if unexpected_role_columns is not null then
    raise exception 'public.account_role is used by other columns (%); review dependencies before cleanup', unexpected_role_columns;
  end if;

  if to_regtype('public.account_role_admin_only') is not null then
    raise exception 'public.account_role_admin_only already exists; inspect the previous migration state';
  end if;

  alter table public.profiles alter column role drop default;
  alter table public.profiles alter column role type text using role::text;
  update public.profiles set role = 'admin' where role = 'super_admin';

  create type public.account_role_admin_only as enum ('student', 'admin');
  alter table public.profiles alter column role type public.account_role_admin_only
    using role::public.account_role_admin_only;
  drop type public.account_role;
  alter type public.account_role_admin_only rename to account_role;
  alter table public.profiles alter column role set default 'student'::public.account_role;
end;
$$;

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

create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_user_is_admin()));
create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'student' and suspended_at is null)
  with check (id = (select auth.uid()) and role = 'student' and suspended_at is null);

create policy "Students can view their applications and admins can view all"
  on public.applications for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));

create policy "Students and admins can view payments"
  on public.payments for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));

create policy "Students can view and update their own notifications"
  on public.notifications for select to authenticated
  using ((student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin()));
create policy "Students can mark their own notifications read"
  on public.notifications for update to authenticated
  using (student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
  with check (student_id = (select auth.uid()) and (select public.current_user_is_active_student()));

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

commit;
