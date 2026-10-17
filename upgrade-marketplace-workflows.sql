-- Additive workflow upgrade for the existing Presint 18 marketplace schema.
-- Run this after schema.sql. Do not run the Nyamnyam template's new-project SQL here.
begin;

alter table public.shops add column if not exists market_id text not null default 'presint-18';
alter table public.products add column if not exists condition text not null default 'New';
alter table public.products drop constraint if exists products_condition_check;
alter table public.products add constraint products_condition_check check (condition in ('New','Used - like new','Used - good','Used - fair'));

alter table public.shops alter column status set default 'pending';
alter table public.shops drop constraint if exists shops_status_check;
alter table public.shops add constraint shops_status_check check (status in ('pending','active','paused','suspended'));

alter table public.orders add column if not exists payment_receipt_path text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists fulfillment_method text not null default 'delivery';
alter table public.orders drop constraint if exists orders_fulfillment_method_check;
alter table public.orders add constraint orders_fulfillment_method_check check (fulfillment_method in ('delivery','collection'));

create or replace function public.guard_marketplace_shop_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not public.is_marketplace_admin() and new.status <> 'pending' then
    raise exception 'New shops must be submitted for approval.';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and not public.is_marketplace_admin() then
    raise exception 'Only a marketplace admin can change shop approval status.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_marketplace_shop_status_trigger on public.shops;
create trigger guard_marketplace_shop_status_trigger before insert or update on public.shops
for each row execute function public.guard_marketplace_shop_status();

create or replace function public.attach_marketplace_receipt(p_order_id uuid, p_receipt_path text, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in before submitting a payment receipt.'; end if;
  update public.orders
    set payment_receipt_path = p_receipt_path,
        payment_reference = nullif(trim(coalesce(p_reference,'')),''),
        payment_status = 'awaiting_confirmation'
    where id = p_order_id and buyer_id = auth.uid() and payment_method = 'qr'
      and status <> 'cancelled'
      and p_receipt_path like auth.uid()::text || '/' || p_order_id::text || '/%';
  if not found then raise exception 'This QR order or receipt path could not be verified.'; end if;
end;
$$;

create or replace function public.set_marketplace_order_fulfillment(p_order_id uuid, p_fulfillment_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_fulfillment_method not in ('delivery','collection') then raise exception 'Choose delivery to your unit or self-collection.'; end if;
  update public.orders set fulfillment_method=p_fulfillment_method
    where id=p_order_id and buyer_id=auth.uid() and status='pending';
  if not found then raise exception 'Order not found or can no longer be changed.'; end if;
end;
$$;

create or replace function public.manage_marketplace_order(p_order_id uuid, p_status text, p_payment_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_admin boolean := public.is_marketplace_admin(); v_seller boolean;
begin
  if auth.uid() is null then raise exception 'Sign in before updating an order.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  select exists(select 1 from public.order_items oi join public.shops s on s.id=oi.shop_id
    where oi.order_id=p_order_id and s.owner_id=auth.uid()) into v_seller;
  if not v_admin and not v_seller then raise exception 'Only the order seller or marketplace admin can update it.'; end if;
  if p_status not in ('pending','accepted','ready','completed','cancelled') then raise exception 'Invalid order status.'; end if;
  if p_payment_status not in ('unpaid','awaiting_confirmation','confirmed') then raise exception 'Invalid payment status.'; end if;
  if p_payment_status='confirmed' and v_order.payment_method='qr' and v_order.payment_receipt_path is null then
    raise exception 'A QR receipt must be reviewed before confirming payment.';
  end if;
  update public.orders set status=p_status,payment_status=p_payment_status where id=p_order_id;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('marketplace-receipts','marketplace-receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Marketplace receipt owner uploads" on storage.objects;
create policy "Marketplace receipt owner uploads" on storage.objects for insert to authenticated
with check (bucket_id='marketplace-receipts' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.orders o where o.id=((storage.foldername(name))[2])::uuid
    and o.buyer_id=auth.uid() and o.payment_method='qr' and o.payment_receipt_path is null));
drop policy if exists "Marketplace order parties read receipts" on storage.objects;
create policy "Marketplace order parties read receipts" on storage.objects for select to authenticated
using (bucket_id='marketplace-receipts' and exists(select 1 from public.orders o
  where o.id=((storage.foldername(name))[2])::uuid and (
    o.buyer_id=auth.uid() or public.is_marketplace_admin() or exists(
      select 1 from public.order_items oi join public.shops s on s.id=oi.shop_id
      where oi.order_id=o.id and s.owner_id=auth.uid()))));

revoke all on function public.attach_marketplace_receipt(uuid,text,text) from public,anon;
grant execute on function public.attach_marketplace_receipt(uuid,text,text) to authenticated;
revoke all on function public.set_marketplace_order_fulfillment(uuid,text) from public,anon;
grant execute on function public.set_marketplace_order_fulfillment(uuid,text) to authenticated;
revoke all on function public.manage_marketplace_order(uuid,text,text) from public,anon;
grant execute on function public.manage_marketplace_order(uuid,text,text) to authenticated;
grant select on public.orders,public.order_items,public.shops,public.products,public.profiles to authenticated;
grant update on public.shops,public.orders,public.daily_highlights to authenticated;
commit;

