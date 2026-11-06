update public.payments set status = 'successful' where status = 'verified';

drop index if exists public.payments_one_pending_per_application_idx;
create unique index payments_one_pending_per_application_idx
  on public.payments (application_id)
  where status in ('initiated', 'pending');

create or replace function public.enforce_payment_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'initiated' and new.status in ('pending', 'failed', 'abandoned'))
    or (old.status = 'pending' and new.status in ('successful', 'failed', 'abandoned'))
    or (old.status = 'successful' and new.status in ('reversed', 'refunded', 'partially_refunded'))
    or (old.status = 'partially_refunded' and new.status in ('refunded', 'reversed'))
  ) then
    raise exception 'Invalid payment status transition: % to %', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_status_transition on public.payments;
create trigger payments_status_transition
  before update of status on public.payments
  for each row execute function public.enforce_payment_status_transition();

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

  if payment_row.status = 'successful' then return payment_row.application_id; end if;
  if payment_row.status not in ('initiated', 'pending') then
    raise exception 'Payment cannot transition to successful from %', payment_row.status;
  end if;

  update public.payments
  set status = 'successful', verified_at = coalesce(verified_at, now())
  where id = payment_row.id;

  insert into public.notifications (student_id, title, body, payment_reference)
  values (
    payment_row.student_id,
    'Payment verified',
    'Your payment has been verified. Review and submit your application to complete it.',
    p_reference
  )
  on conflict (payment_reference) where payment_reference is not null do nothing;

  perform public.write_audit_log(
    payment_row.student_id,
    'payment.verified',
    payment_row.id::text,
    jsonb_build_object('amount_minor', payment_row.amount_minor, 'currency', payment_row.currency)
  );
  return payment_row.application_id;
end;
$$;
revoke all on function public.finalize_verified_payment(text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text) to service_role;

create or replace function public.submit_paid_application(p_application_id uuid)
returns table(application_id uuid, application_reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_status public.application_status;
  current_reference text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  select a.status, a.application_reference
  into current_status, current_reference
  from public.applications a
  where a.id = p_application_id and a.student_id = owner_id
  for update;
  if not found then raise exception 'Application not found'; end if;
  if current_status <> 'draft' then raise exception 'Application is not a draft'; end if;
  if not exists (
    select 1 from public.payments p
    where p.application_id = p_application_id
      and p.student_id = owner_id
      and p.status = 'successful'
  ) then raise exception 'A verified payment is required before submission'; end if;

  current_reference := 'TAM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  update public.applications
  set status = 'submitted',
      application_reference = current_reference,
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id;

  perform public.write_audit_log(
    owner_id,
    'application.submitted',
    p_application_id::text,
    jsonb_build_object('application_reference', current_reference)
  );

  return query select p_application_id, current_reference;
end;
$$;
revoke all on function public.submit_paid_application(uuid) from public, anon;
grant execute on function public.submit_paid_application(uuid) to authenticated;

revoke insert, update on public.applications from authenticated;

create or replace function public.save_student_application(
  p_programme_id uuid,
  p_personal_details jsonb,
  p_contact_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  existing_id uuid;
  result_id uuid;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles where id = owner_id and role = 'student' and suspended_at is null for update;
  if not found then raise exception 'Student account is unavailable'; end if;
  if jsonb_typeof(p_personal_details) <> 'object'
     or jsonb_typeof(p_contact_details) <> 'object'
     or octet_length(p_personal_details::text) > 10000
     or octet_length(p_contact_details::text) > 10000 then
    raise exception 'Application details are invalid';
  end if;
  if coalesce(length(trim(p_personal_details->>'firstName')), 0) not between 1 and 80
     or coalesce(length(trim(p_personal_details->>'lastName')), 0) not between 1 and 80
     or coalesce(length(p_personal_details->>'dateOfBirth'), 0) <> 10
     or coalesce(p_personal_details->>'gender', '') not in ('Female', 'Male', 'Prefer not to say')
     or coalesce(length(trim(p_contact_details->>'email')), 0) not between 3 and 254
     or coalesce(p_contact_details->>'phone', '') !~ '^[0-9]{7,15}$'
     or coalesce(length(p_contact_details->>'address'), 0) > 300 then
    raise exception 'Application details are invalid';
  end if;
  if (p_personal_details->>'dateOfBirth')::date >= current_date then
    raise exception 'Date of birth must be in the past';
  end if;
  if not exists (
    select 1 from public.programmes p
    where p.id = p_programme_id
      and p.is_published
      and p.price_approved
      and p.price_minor > 0
      and p.currency = 'NGN'
  ) then raise exception 'Programme is unavailable for application'; end if;

  select id into existing_id
  from public.applications
  where student_id = owner_id and programme_id = p_programme_id and status = 'draft'
  order by created_at desc
  limit 1
  for update;
  if existing_id is not null then
    update public.applications
    set personal_details = p_personal_details,
        contact_details = p_contact_details,
        updated_at = now()
    where id = existing_id;
    result_id := existing_id;
  else
    if exists (
      select 1 from public.applications
      where student_id = owner_id and programme_id = p_programme_id
        and status in ('submitted', 'under_review', 'approved')
    ) then raise exception 'An active application already exists'; end if;
    insert into public.applications (
      student_id, programme_id, status, personal_details, contact_details, education_details
    ) values (
      owner_id, p_programme_id, 'draft', p_personal_details, p_contact_details, '{}'::jsonb
    ) returning id into result_id;
  end if;

  perform public.write_audit_log(owner_id, 'application.draft_saved', result_id::text);
  return result_id;
end;
$$;
revoke all on function public.save_student_application(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_student_application(uuid, jsonb, jsonb) to authenticated;

create or replace function public.admin_payment_summary()
returns table (currency text, payment_count bigint, revenue_minor numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.currency, count(*)::bigint, sum(p.amount_minor)::numeric
  from public.payments p
  where p.status in ('successful', 'partially_refunded')
  group by p.currency
  order by p.currency;
$$;
revoke all on function public.admin_payment_summary() from public, anon, authenticated;
grant execute on function public.admin_payment_summary() to service_role;

create or replace function public.record_refund_provider_result(
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_status text,
  p_response jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  refund_row public.refunds%rowtype;
  next_status text;
begin
  if p_provider_status not in ('pending', 'processed', 'failed') then
    raise exception 'Unsupported provider refund status';
  end if;

  select * into refund_row from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if refund_row.status = 'processed' then return refund_row.status; end if;

  next_status := p_provider_status;
  update public.refunds
  set status = next_status,
      provider_reference = coalesce(p_provider_reference, provider_reference),
      provider_response = coalesce(p_response, '{}'::jsonb),
      updated_at = now()
  where id = refund_row.id;

  if next_status = 'processed' then
    update public.payments
    set status = 'refunded'
    where id = refund_row.payment_id and status = 'successful';
    if not found then raise exception 'Original payment is not eligible for refund completion'; end if;
  end if;

  perform public.write_audit_log(
    refund_row.requested_by,
    'refund.' || next_status,
    refund_row.id::text,
    jsonb_build_object('payment_id', refund_row.payment_id, 'amount_minor', refund_row.amount_minor)
  );
  return next_status;
end;
$$;
revoke all on function public.record_refund_provider_result(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_refund_provider_result(uuid, text, text, jsonb) to service_role;
