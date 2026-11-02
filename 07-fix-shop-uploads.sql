-- PKDPJ Market: fix "You do not have permission" when uploading a shop banner / profile picture / QR.
-- Safe to run more than once.

-- 1) Make sure the image bucket exists with the right limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-images', 'marketplace-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2) One helper that decides who may manage a shop's files: the shop owner or a market admin.
--    SECURITY DEFINER so the check is not blocked by row-level security on the shops table.
create or replace function public.can_manage_shop_files(p_object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_marketplace_admin()
    or exists (
      select 1 from public.shops s
      where s.id::text = split_part(p_object_name, '/', 1)
        and s.owner_id = auth.uid()
    )
  )
$$;
revoke all on function public.can_manage_shop_files(text) from public, anon;
grant execute on function public.can_manage_shop_files(text) to authenticated;

-- 3) Re-create the image policies using the helper.
drop policy if exists "Signed-in users read marketplace images" on storage.objects;
create policy "Signed-in users read marketplace images" on storage.objects
  for select to authenticated using (bucket_id = 'marketplace-images');

drop policy if exists "Shop owners upload marketplace images" on storage.objects;
create policy "Shop owners upload marketplace images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketplace-images' and public.can_manage_shop_files(name));

drop policy if exists "Shop owners update marketplace images" on storage.objects;
create policy "Shop owners update marketplace images" on storage.objects
  for update to authenticated
  using (bucket_id = 'marketplace-images' and public.can_manage_shop_files(name))
  with check (bucket_id = 'marketplace-images' and public.can_manage_shop_files(name));

drop policy if exists "Shop owners delete marketplace images" on storage.objects;
create policy "Shop owners delete marketplace images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketplace-images' and public.can_manage_shop_files(name));

-- 4) Shop owners (and admins) may update their own shop row, incl. banner / picture paths.
grant update on public.shops to authenticated;
drop policy if exists "Sellers update their own shops" on public.shops;
create policy "Sellers update their own shops" on public.shops
  for update to authenticated using (owner_id = auth.uid() or public.is_marketplace_admin())
  with check (owner_id = auth.uid() or public.is_marketplace_admin());

notify pgrst, 'reload schema';
