alter table public.programmes
  add column if not exists is_listed boolean not null default false,
  add column if not exists image_path text;

update public.programmes
set is_listed = true
where slug in (
  'solar-pv-installation-maintenance',
  'inverter-installation-troubleshooting',
  'solar-system-design-sizing',
  'battery-technology-energy-storage',
  'off-grid-systems-rural-communities',
  'solar-business-entrepreneurship'
) or (is_published and price_approved);

drop policy if exists "Published programmes are public" on public.programmes;
drop policy if exists "Listed programmes and published programmes are public" on public.programmes;
create policy "Listed programmes and published programmes are public"
  on public.programmes for select to anon, authenticated
  using (is_listed or (is_published and price_approved) or (select public.current_user_is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('programme-images', 'programme-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view programme images" on storage.objects;
create policy "Public can view programme images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'programme-images');

drop policy if exists "Admins can upload programme images" on storage.objects;
create policy "Admins can upload programme images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'programme-images'
    and (select public.current_user_is_admin())
  );

drop policy if exists "Admins can update programme images" on storage.objects;
create policy "Admins can update programme images"
  on storage.objects for update to authenticated
  using (bucket_id = 'programme-images' and (select public.current_user_is_admin()))
  with check (bucket_id = 'programme-images' and (select public.current_user_is_admin()));

drop policy if exists "Admins can delete programme images" on storage.objects;
create policy "Admins can delete programme images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'programme-images' and (select public.current_user_is_admin()));
