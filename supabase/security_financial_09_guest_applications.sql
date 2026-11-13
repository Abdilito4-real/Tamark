begin;

alter table public.applications
  alter column student_id drop not null,
  add column if not exists public_submission_key uuid;

create unique index if not exists applications_public_submission_key_unique_idx
  on public.applications (public_submission_key)
  where public_submission_key is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_guest_submissions_must_be_submitted'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_guest_submissions_must_be_submitted
      check (student_id is not null or status <> 'draft');
  end if;
end;
$$;

comment on column public.applications.public_submission_key is
  'Opaque retry key for the public application form; never grants access to the application record.';

commit;
