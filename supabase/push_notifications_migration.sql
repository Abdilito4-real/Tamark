create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;
create index if not exists push_subscriptions_student_idx on public.push_subscriptions (student_id);

alter table public.notifications add column if not exists payment_reference text;
create unique index if not exists notifications_payment_reference_unique_idx
  on public.notifications (payment_reference)
  where payment_reference is not null;

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

  if payment_row.status <> 'verified' then
    insert into public.notifications (student_id, title, body, payment_reference)
    values (
      payment_row.student_id,
      'Payment verified',
      'Your payment has been verified and your application has been submitted.',
      p_reference
    )
    on conflict (payment_reference) where payment_reference is not null do nothing;
  end if;

  return payment_row.application_id;
end;
$$;
revoke all on function public.finalize_verified_payment(text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text) to service_role;
