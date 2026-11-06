update public.applications
set application_reference = 'TAM-' || upper(replace(gen_random_uuid()::text, '-', ''))
where status <> 'draft'
  and application_reference is null;

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

  if current_status <> 'draft' then
    if current_status in ('submitted', 'under_review', 'approved', 'rejected')
       and current_reference is not null then
      return query select p_application_id, current_reference;
      return;
    end if;
    raise exception 'Application is not a draft';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.application_id = p_application_id
      and p.student_id = owner_id
      and p.status = 'successful'
  ) then raise exception 'A verified payment is required before submission'; end if;

  current_reference := 'TAM-' || upper(replace(gen_random_uuid()::text, '-', ''));
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
