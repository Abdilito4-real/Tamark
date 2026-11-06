drop function if exists public.save_student_application(uuid, jsonb, jsonb);

create function public.save_student_application(
  p_programme_id uuid,
  p_personal_details jsonb,
  p_contact_details jsonb,
  p_application_id uuid,
  p_expected_updated_at timestamptz
)
returns table(application_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  application_row public.applications%rowtype;
  result_id uuid;
  result_updated_at timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles
  where id = owner_id and role = 'student' and suspended_at is null
  for update;
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

  if p_application_id is null then
    if p_expected_updated_at is not null then
      raise exception 'Application draft version is invalid';
    end if;

    select a.* into application_row
    from public.applications a
    where a.student_id = owner_id
      and a.programme_id = p_programme_id
      and a.status = 'draft'
    order by a.created_at desc
    limit 1
    for update;

    if found then
      if application_row.personal_details is distinct from p_personal_details
         or application_row.contact_details is distinct from p_contact_details then
        raise exception using
          errcode = '40001',
          message = 'Application draft changed; load the latest version before saving';
      end if;
      return query select application_row.id, application_row.updated_at;
      return;
    end if;

    if exists (
      select 1 from public.applications
      where student_id = owner_id and programme_id = p_programme_id
        and status in ('submitted', 'under_review', 'approved')
    ) then raise exception 'An active application already exists'; end if;

    insert into public.applications as inserted (
      student_id, programme_id, status, personal_details, contact_details, education_details
    ) values (
      owner_id, p_programme_id, 'draft', p_personal_details, p_contact_details, '{}'::jsonb
    )
    returning inserted.id, inserted.updated_at into result_id, result_updated_at;
  else
    select a.* into application_row
    from public.applications a
    where a.id = p_application_id
      and a.student_id = owner_id
      and a.programme_id = p_programme_id
      and a.status = 'draft'
    for update;
    if not found then raise exception 'Application draft is unavailable or no longer a draft'; end if;

    if p_expected_updated_at is null
       or application_row.updated_at is distinct from p_expected_updated_at then
      if application_row.personal_details is distinct from p_personal_details
         or application_row.contact_details is distinct from p_contact_details then
        raise exception using
          errcode = '40001',
          message = 'Application draft changed; load the latest version before saving';
      end if;
      return query select application_row.id, application_row.updated_at;
      return;
    end if;

    update public.applications a
    set personal_details = p_personal_details,
        contact_details = p_contact_details,
        updated_at = clock_timestamp()
    where a.id = application_row.id
    returning a.id, a.updated_at into result_id, result_updated_at;
  end if;

  perform public.write_audit_log(owner_id, 'application.draft_saved', result_id::text);
  return query select result_id, result_updated_at;
end;
$$;

revoke all on function public.save_student_application(uuid, jsonb, jsonb, uuid, timestamptz) from public, anon;
grant execute on function public.save_student_application(uuid, jsonb, jsonb, uuid, timestamptz) to authenticated;
