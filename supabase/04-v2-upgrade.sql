-- =====================================================================
-- PKDPJ Market — v2 upgrade (for the new multi-page website)
-- ADDITIVE and safe to run more than once. It keeps every existing
-- account, shop, item and order. Run AFTER 01, 02 and 03.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Profiles: phone number, self-edit, become a seller
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check
  check (phone = '' or phone ~ '^\+?[0-9][0-9 ()-]{6,23}$');

-- People may edit only these three columns of their own profile.
-- (account_type and is_admin stay protected.)
grant update (full_name, department, phone) on public.profiles to authenticated;
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Save phone from sign-up too.
create or replace function public.handle_new_marketplace_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, account_type, department, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 100),
    case when new.raw_user_meta_data->>'account_type' = 'seller' then 'seller' else 'buyer' end,
    left(coalesce(new.raw_user_meta_data->>'department', ''), 120),
    case when coalesce(new.raw_user_meta_data->>'phone','') ~ '^\+?[0-9][0-9 ()-]{6,23}$'
         then new.raw_user_meta_data->>'phone' else '' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_marketplace_user() from public, anon, authenticated;

create or replace function public.become_marketplace_seller(p_department text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(trim(coalesce(p_department, ''))) not between 2 and 120 then
    raise exception 'Enter your unit or department (2–120 characters).';
  end if;
  update public.profiles set account_type = 'seller', department = trim(p_department) where id = auth.uid();
  if not found then raise exception 'Profile not found. Sign out and in again.'; end if;
end;
$$;
revoke all on function public.become_marketplace_seller(text) from public, anon;
grant execute on function public.become_marketplace_seller(text) to authenticated;

-- Admins can make another account admin (or remove it). Never yourself.
create or replace function public.admin_set_marketplace_admin(p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marketplace_admin() then raise exception 'Admin access required.'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own admin access.'; end if;
  update public.profiles set is_admin = coalesce(p_admin, false) where id = p_user;
  if not found then raise exception 'Account not found.'; end if;
end;
$$;
revoke all on function public.admin_set_marketplace_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_marketplace_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Shops: WhatsApp contact; owners may pause / reopen an approved shop
-- ---------------------------------------------------------------------
alter table public.shops add column if not exists whatsapp text not null default '';
alter table public.shops drop constraint if exists shops_whatsapp_check;
alter table public.shops add constraint shops_whatsapp_check
  check (whatsapp = '' or whatsapp ~ '^\+?[0-9][0-9 ()-]{6,23}$');

create or replace function public.guard_marketplace_shop_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_marketplace_admin() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' and new.status <> 'pending' then
    raise exception 'New shops must be submitted for approval.';
  end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then raise exception 'Shop owner cannot be changed.'; end if;
    -- Owners may switch an approved shop between open (active) and paused.
    if new.status is distinct from old.status
       and not (old.status in ('active', 'paused') and new.status in ('active', 'paused')) then
      raise exception 'Only a marketplace admin can change shop approval status.';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists guard_marketplace_shop_status_trigger on public.shops;
create trigger guard_marketplace_shop_status_trigger before insert or update on public.shops
  for each row execute function public.guard_marketplace_shop_status();

-- ---------------------------------------------------------------------
-- Products: description, display order
-- ---------------------------------------------------------------------
alter table public.products add column if not exists description text not null default '';
alter table public.products drop constraint if exists products_description_check;
alter table public.products add constraint products_description_check check (length(description) <= 600);
alter table public.products add column if not exists sort_order integer not null default 0;

-- ---------------------------------------------------------------------
-- Orders: one order per shop, notes, cancellation, stock return
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists shop_id uuid references public.shops(id) on delete set null;
alter table public.orders add column if not exists checkout_id uuid;
alter table public.orders add column if not exists note text not null default '';
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists inventory_returned boolean not null default false;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
create index if not exists orders_shop_created_idx on public.orders(shop_id, created_at desc);
create index if not exists orders_checkout_idx on public.orders(buyer_id, checkout_id);

-- Checkout: splits the bag into one order per shop, so each seller
-- manages (and gets paid for) only their own items. Prices and stock
-- are checked here, never trusted from the browser. Re-sending the same
-- p_request_key returns the orders already created (safe retries).
create or replace function public.place_marketplace_checkout(
  p_buyer_name text, p_phone text, p_delivery_location text, p_fulfillment text,
  p_payment_method text, p_note text, p_items jsonb, p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_existing jsonb;
  v_result jsonb := '[]'::jsonb;
  v_shop record;
  v_line record;
  v_product record;
  v_order uuid;
  v_total numeric(12,2);
begin
  if v_user is null then raise exception 'Sign in before placing an order.'; end if;
  if p_request_key is null then raise exception 'Missing checkout key. Refresh and try again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_request_key::text, 0));
  select jsonb_agg(jsonb_build_object('order_id', id, 'shop_id', shop_id) order by created_at)
    into v_existing from public.orders where buyer_id = v_user and checkout_id = p_request_key;
  if v_existing is not null then return v_existing; end if;

  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 100 then raise exception 'Enter your name.'; end if;
  if trim(coalesce(p_phone, '')) !~ '^\+?[0-9][0-9 ()-]{6,23}$' then raise exception 'Enter a valid phone or WhatsApp number.'; end if;
  if length(trim(coalesce(p_delivery_location, ''))) not between 2 and 200 then raise exception 'Enter your unit or location.'; end if;
  if p_fulfillment not in ('delivery', 'collection') then raise exception 'Choose delivery or self-collect.'; end if;
  if p_payment_method not in ('cash', 'qr') then raise exception 'Choose cash or QR payment.'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Note must be 500 characters or fewer.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your bag is empty.'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'Too many different items in one checkout.'; end if;
  if (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'An item appears twice in your bag. Refresh and try again.';
  end if;

  for v_shop in
    select s.id, s.name, s.owner_id, s.status, s.payment_qr_path
    from public.shops s
    where s.id in (select p.shop_id from public.products p
                   where p.id in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x))
    order by s.id
    for share
  loop
    if v_shop.status <> 'active' then raise exception '% is not taking orders right now.', v_shop.name; end if;
    if v_shop.owner_id = v_user then raise exception 'You cannot order from your own shop (%).', v_shop.name; end if;
    if p_payment_method = 'qr' and v_shop.payment_qr_path is null then
      raise exception '% has not set up QR payment yet. Choose cash instead.', v_shop.name;
    end if;

    insert into public.orders (buyer_id, buyer_name, phone, delivery_location, fulfillment_method, payment_method,
      payment_status, status, total_rm, shop_id, checkout_id, note)
    values (v_user, trim(p_buyer_name), trim(p_phone), trim(p_delivery_location), p_fulfillment, p_payment_method,
      'unpaid', 'pending', 0, v_shop.id, p_request_key, trim(coalesce(p_note, '')))
    returning id into v_order;
    v_total := 0;

    for v_line in
      select (x->>'product_id')::uuid as product_id, x->'quantity' as qty, x->'expected_price' as expected
      from jsonb_array_elements(p_items) x
      order by 1
    loop
      select p.id, p.shop_id, p.name, p.unit_price_rm, p.stock_qty, p.active into v_product
        from public.products p where p.id = v_line.product_id for update;
      if not found then raise exception 'An item in your bag was removed. Refresh your bag.'; end if;
      continue when v_product.shop_id <> v_shop.id;
      if not v_product.active then raise exception '% is no longer available.', v_product.name; end if;
      if jsonb_typeof(v_line.qty) <> 'number' or (v_line.qty)::text !~ '^[0-9]{1,2}$' or (v_line.qty)::text::int < 1 then
        raise exception 'Quantity for % must be 1–99.', v_product.name;
      end if;
      if v_line.expected is not null and (v_line.expected)::text::numeric <> v_product.unit_price_rm then
        raise exception 'The price of % changed. Please review your bag.', v_product.name;
      end if;
      if v_product.stock_qty < (v_line.qty)::text::int then
        raise exception 'Only % left of %. Please reduce the quantity.', v_product.stock_qty, v_product.name;
      end if;
      update public.products set stock_qty = stock_qty - (v_line.qty)::text::int, updated_at = now() where id = v_product.id;
      insert into public.order_items (order_id, shop_id, product_id, product_name, quantity, unit_price_rm)
        values (v_order, v_shop.id, v_product.id, v_product.name, (v_line.qty)::text::int, v_product.unit_price_rm);
      v_total := v_total + v_product.unit_price_rm * (v_line.qty)::text::int;
    end loop;

    update public.orders set total_rm = v_total where id = v_order;
    v_result := v_result || jsonb_build_array(jsonb_build_object('order_id', v_order, 'shop_id', v_shop.id));
  end loop;

  if jsonb_array_length(v_result) = 0 then raise exception 'Your bag is empty or its items are no longer available.'; end if;
  return v_result;
end;
$$;
revoke all on function public.place_marketplace_checkout(text,text,text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.place_marketplace_checkout(text,text,text,text,text,text,jsonb,uuid) to authenticated;

-- Returns stock for a cancelled order exactly once.
create or replace function public.return_marketplace_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_item record;
begin
  for v_item in
    select product_id, sum(quantity)::int as qty from public.order_items
    where order_id = p_order_id and product_id is not null group by product_id order by product_id
  loop
    update public.products set stock_qty = stock_qty + v_item.qty, updated_at = now() where id = v_item.product_id;
  end loop;
  update public.orders set inventory_returned = true where id = p_order_id;
end;
$$;
revoke all on function public.return_marketplace_stock(uuid) from public, anon, authenticated;

-- Seller (or admin) updates an order. Same name/arguments as before.
create or replace function public.manage_marketplace_order(p_order_id uuid, p_status text, p_payment_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_admin boolean := public.is_marketplace_admin(); v_seller boolean;
begin
  if auth.uid() is null then raise exception 'Sign in before updating an order.'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.shop_id is not null then
    select exists(select 1 from public.shops s where s.id = v_order.shop_id and s.owner_id = auth.uid()) into v_seller;
  else
    select exists(select 1 from public.order_items oi join public.shops s on s.id = oi.shop_id
      where oi.order_id = p_order_id and s.owner_id = auth.uid()) into v_seller;
  end if;
  if not v_admin and not v_seller then raise exception 'Only the shop owner or a marketplace admin can update this order.'; end if;
  if p_status not in ('pending','accepted','ready','completed','cancelled') then raise exception 'Invalid order status.'; end if;
  if p_payment_status not in ('unpaid','awaiting_confirmation','confirmed') then raise exception 'Invalid payment status.'; end if;
  if v_order.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened. Ask the buyer to order again.';
  end if;
  if p_payment_status = 'confirmed' and v_order.payment_method = 'qr' and v_order.payment_receipt_path is null then
    raise exception 'A QR receipt must be reviewed before confirming payment.';
  end if;
  if p_status = 'cancelled' and v_order.status <> 'cancelled' and not v_order.inventory_returned and v_order.created_at is not null then
    perform public.return_marketplace_stock(p_order_id);
  end if;
  update public.orders set status = p_status, payment_status = p_payment_status,
    paid_at = case when p_payment_status = 'confirmed' then coalesce(paid_at, now()) else null end,
    cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
    updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.manage_marketplace_order(uuid,text,text) from public, anon;
grant execute on function public.manage_marketplace_order(uuid,text,text) to authenticated;

-- Buyer cancels an order the seller has not accepted yet.
create or replace function public.buyer_cancel_marketplace_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id is distinct from auth.uid() then raise exception 'Order not found.'; end if;
  if v_order.status <> 'pending' then raise exception 'The seller has already accepted this order. Please contact them to cancel.'; end if;
  if length(coalesce(p_reason, '')) > 300 then raise exception 'Reason is too long.'; end if;
  if not v_order.inventory_returned then perform public.return_marketplace_stock(p_order_id); end if;
  update public.orders set status = 'cancelled', cancelled_at = now(),
    cancel_reason = nullif(trim(coalesce(p_reason, '')), ''), updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.buyer_cancel_marketplace_order(uuid,text) from public, anon;
grant execute on function public.buyer_cancel_marketplace_order(uuid,text) to authenticated;

-- Receipts: allow replacing a receipt while payment is still being checked.
create or replace function public.attach_marketplace_receipt(p_order_id uuid, p_receipt_path text, p_reference text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in before submitting a payment receipt.'; end if;
  if length(coalesce(p_reference, '')) > 120 then raise exception 'Reference is too long.'; end if;
  update public.orders
    set payment_receipt_path = p_receipt_path,
        payment_reference = nullif(trim(coalesce(p_reference, '')), ''),
        payment_status = 'awaiting_confirmation', updated_at = now()
    where id = p_order_id and buyer_id = auth.uid() and payment_method = 'qr'
      and status <> 'cancelled' and payment_status in ('unpaid', 'awaiting_confirmation')
      and p_receipt_path like auth.uid()::text || '/' || p_order_id::text || '/%'
      and exists (select 1 from storage.objects where bucket_id = 'marketplace-receipts' and name = p_receipt_path);
  if not found then raise exception 'This receipt could not be attached. Upload it again.'; end if;
end;
$$;
revoke all on function public.attach_marketplace_receipt(uuid,text,text) from public, anon;
grant execute on function public.attach_marketplace_receipt(uuid,text,text) to authenticated;

drop policy if exists "Marketplace receipt owner uploads" on storage.objects;
create policy "Marketplace receipt owner uploads" on storage.objects for insert to authenticated
with check (bucket_id = 'marketplace-receipts' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[2]
    and o.buyer_id = auth.uid() and o.payment_method = 'qr'
    and o.status <> 'cancelled' and o.payment_status in ('unpaid', 'awaiting_confirmation')));

-- Admins may see every account (for the Members list). Already allowed by
-- the existing profiles policy; nothing else in profiles is public.

commit;
