alter table public.organization_settings
  add column if not exists whatsapp_phone text not null default '';

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  description text not null default '' check (length(description) <= 1000),
  image_path text not null unique,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gallery_items enable row level security;
grant select on public.gallery_items to anon, authenticated;
grant all on public.gallery_items to service_role;
drop policy if exists "Public can view published gallery items" on public.gallery_items;
create policy "Public can view published gallery items"
  on public.gallery_items for select to anon, authenticated
  using (is_published or (select public.current_user_is_admin()));
drop policy if exists "Admins can manage gallery items" on public.gallery_items;
create policy "Admins can manage gallery items"
  on public.gallery_items for all to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));
create index if not exists gallery_items_published_order_idx
  on public.gallery_items (sort_order, created_at desc) where is_published;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  programme_name text not null default '' check (length(programme_name) <= 160),
  storage_path text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.certificates enable row level security;
grant select on public.certificates to authenticated;
grant all on public.certificates to service_role;
drop policy if exists "Students and admins can view certificates" on public.certificates;
create policy "Students and admins can view certificates"
  on public.certificates for select to authenticated
  using (
    (student_id = (select auth.uid()) and (select public.current_user_is_active_student()))
    or (select public.current_user_is_admin())
  );
create index if not exists certificates_student_created_idx
  on public.certificates (student_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tamark-gallery', 'tamark-gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('student-certificates', 'student-certificates', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view Tamark gallery images" on storage.objects;
create policy "Public can view Tamark gallery images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'tamark-gallery');

drop policy if exists "Admins can manage Tamark gallery images" on storage.objects;
create policy "Admins can manage Tamark gallery images"
  on storage.objects for all to authenticated
  using (bucket_id = 'tamark-gallery' and (select public.current_user_is_admin()))
  with check (bucket_id = 'tamark-gallery' and (select public.current_user_is_admin()));

drop policy if exists "Students and admins can view certificate files" on storage.objects;
create policy "Students and admins can view certificate files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-certificates'
    and (
      (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.current_user_is_active_student())
      )
      or (select public.current_user_is_admin())
    )
  );
