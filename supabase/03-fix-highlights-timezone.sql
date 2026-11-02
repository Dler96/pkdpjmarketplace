-- Small additive fix (safe to run more than once).
-- Today's highlights are saved using the Malaysia date, but the original policy compared
-- against the database's UTC date, so picks were invisible between midnight and 8 am MYT.
begin;
drop policy if exists "Signed-in users read today's highlights" on public.daily_highlights;
create policy "Signed-in users read today's highlights" on public.daily_highlights
  for select to authenticated
  using (feature_date = (now() at time zone 'Asia/Kuala_Lumpur')::date or public.is_marketplace_admin());
commit;
