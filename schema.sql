-- Presint 18 Market: database, access policies, image storage, and safe checkout.
-- Run once in the Supabase SQL Editor for project mmhteibirsevueiwsehn.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type text not null default 'buyer' check (account_type in ('buyer', 'seller')),
  department text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_marketplace_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, account_type, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when new.raw_user_meta_data->>'account_type' = 'seller' then 'seller' else 'buyer' end,
    coalesce(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_marketplace on auth.users;
create trigger on_auth_user_created_marketplace
  after insert on auth.users
  for each row execute procedure public.handle_new_marketplace_user();

insert into public.profiles (id, full_name, account_type, department)
select id,
       coalesce(raw_user_meta_data->>'full_name', ''),
       case when raw_user_meta_data->>'account_type' = 'seller' then 'seller' else 'buyer' end,
       coalesce(raw_user_meta_data->>'department', '')
from auth.users
on conflict (id) do nothing;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 80),
  unit_department text not null check (length(trim(unit_department)) between 2 and 120),
  location text not null check (length(trim(location)) between 2 and 160),
  market_id text not null default 'presint-18' check (market_id in ('pejabat-kesihatan-putrajaya','presint-9','presint-11','presint-14','presint-18')),
  category text not null,
  bio text not null default '',
  theme text not null default '#e5dfd1',
  symbol text not null default '✳',
  word text not null default 'made with care',
  cover_image_path text,
  payment_qr_path text,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  category text not null,
  unit_price_rm numeric(10,2) not null check (unit_price_rm > 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  emoji text not null default '✳',
  condition text not null default 'New' check (condition in ('New','Used - like new','Used - good','Used - fair')),
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep these additive migrations for projects where the original schema already exists.
alter table public.shops add column if not exists market_id text not null default 'presint-18';
alter table public.products add column if not exists condition text not null default 'New';

create index if not exists products_shop_active_idx on public.products(shop_id, active);
create index if not exists shops_owner_idx on public.shops(owner_id);

create table if not exists public.daily_highlights (
  feature_date date not null default current_date,
  rank smallint not null check (rank between 1 and 3),
  product_id uuid not null references public.products(id) on delete cascade,
  sponsored boolean not null default false,
  primary key (feature_date, rank)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  buyer_name text not null check (length(trim(buyer_name)) between 2 and 100),
  phone text not null check (length(trim(phone)) between 7 and 30),
  delivery_location text not null check (length(trim(delivery_location)) between 2 and 200),
  payment_method text not null check (payment_method in ('cash', 'qr')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'awaiting_confirmation', 'confirmed')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ready', 'completed', 'cancelled')),
  total_rm numeric(12,2) not null default 0 check (total_rm >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_rm numeric(10,2) not null check (unit_price_rm > 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index if not exists order_items_shop_idx on public.order_items(shop_id, order_id);

create or replace function public.is_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

create or replace function public.can_view_marketplace_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o where o.id = p_order_id and o.buyer_id = auth.uid()
  ) or exists (
    select 1
    from public.order_items oi
    join public.shops s on s.id = oi.shop_id
    where oi.order_id = p_order_id and s.owner_id = auth.uid()
  );
$$;

create or replace function public.place_marketplace_order(
  p_buyer_name text,
  p_phone text,
  p_delivery_location text,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_total numeric(12,2) := 0;
  v_count integer := 0;
  v_line record;
  v_product record;
begin
  if v_user is null then raise exception 'Sign in before placing an order.'; end if;
  if length(trim(coalesce(p_buyer_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if length(trim(coalesce(p_phone, ''))) < 7 then raise exception 'Enter a valid phone or WhatsApp number.'; end if;
  if length(trim(coalesce(p_delivery_location, ''))) < 2 then raise exception 'Enter your unit or delivery location.'; end if;
  if p_payment_method not in ('cash', 'qr') then raise exception 'Choose a supported payment method.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;

  insert into public.orders (buyer_id, buyer_name, phone, delivery_location, payment_method, payment_status)
  values (v_user, trim(p_buyer_name), trim(p_phone), trim(p_delivery_location), p_payment_method,
          case when p_payment_method = 'qr' then 'awaiting_confirmation' else 'unpaid' end)
  returning id into v_order_id;

  for v_line in
    select product_id, quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_line.quantity is null or v_line.quantity < 1 then raise exception 'Each item quantity must be at least one.'; end if;
    select p.id, p.shop_id, p.name, p.unit_price_rm, p.stock_qty
      into v_product
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = v_line.product_id and p.active and s.status = 'active'
      for update of p;
    if not found then raise exception 'An item in your cart is no longer available.'; end if;
    if v_product.stock_qty < v_line.quantity then raise exception 'Not enough stock for %.', v_product.name; end if;

    update public.products set stock_qty = stock_qty - v_line.quantity, updated_at = now()
      where id = v_product.id;
    insert into public.order_items (order_id, shop_id, product_id, product_name, quantity, unit_price_rm)
      values (v_order_id, v_product.shop_id, v_product.id, v_product.name, v_line.quantity, v_product.unit_price_rm);
    v_total := v_total + v_product.unit_price_rm * v_line.quantity;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'Your cart is empty.'; end if;
  update public.orders set total_rm = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.daily_highlights enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "Active shops are visible to signed-in users" on public.shops;
create policy "Active shops are visible to signed-in users" on public.shops
  for select to authenticated using (status = 'active' or owner_id = auth.uid() or public.is_marketplace_admin());
drop policy if exists "Sellers create their own shops" on public.shops;
create policy "Sellers create their own shops" on public.shops
  for insert to authenticated with check (
    owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'seller')
  );
drop policy if exists "Sellers update their own shops" on public.shops;
create policy "Sellers update their own shops" on public.shops
  for update to authenticated using (owner_id = auth.uid() or public.is_marketplace_admin())
  with check (owner_id = auth.uid() or public.is_marketplace_admin());
drop policy if exists "Sellers delete their own shops" on public.shops;
create policy "Sellers delete their own shops" on public.shops
  for delete to authenticated using (owner_id = auth.uid() or public.is_marketplace_admin());

drop policy if exists "Active products are visible to signed-in users" on public.products;
create policy "Active products are visible to signed-in users" on public.products
  for select to authenticated using (
    (active and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'active'))
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
    or public.is_marketplace_admin()
  );
drop policy if exists "Shop owners create products" on public.products;
create policy "Shop owners create products" on public.products
  for insert to authenticated with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  );
drop policy if exists "Shop owners update products" on public.products;
create policy "Shop owners update products" on public.products
  for update to authenticated using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()) or public.is_marketplace_admin()
  ) with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()) or public.is_marketplace_admin()
  );
drop policy if exists "Shop owners delete products" on public.products;
create policy "Shop owners delete products" on public.products
  for delete to authenticated using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()) or public.is_marketplace_admin()
  );

drop policy if exists "Signed-in users read today's highlights" on public.daily_highlights;
create policy "Signed-in users read today's highlights" on public.daily_highlights
  for select to authenticated using (feature_date = current_date);
drop policy if exists "Admins manage highlights" on public.daily_highlights;
create policy "Admins manage highlights" on public.daily_highlights
  for all to authenticated using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

drop policy if exists "Buyers and relevant sellers read orders" on public.orders;
create policy "Buyers and relevant sellers read orders" on public.orders
  for select to authenticated using (public.can_view_marketplace_order(id) or public.is_marketplace_admin());
drop policy if exists "Buyers and relevant sellers read order items" on public.order_items;
create policy "Buyers and relevant sellers read order items" on public.order_items
  for select to authenticated using (public.can_view_marketplace_order(order_id) or public.is_marketplace_admin());

revoke all on function public.handle_new_marketplace_user() from public, anon, authenticated;
revoke all on function public.is_marketplace_admin() from public, anon;
grant execute on function public.is_marketplace_admin() to authenticated;
revoke all on function public.can_view_marketplace_order(uuid) from public, anon;
grant execute on function public.can_view_marketplace_order(uuid) to authenticated;
revoke all on function public.place_marketplace_order(text, text, text, text, jsonb) from public, anon;
grant execute on function public.place_marketplace_order(text, text, text, text, jsonb) to authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.shops, public.products to authenticated;
grant select, insert, update, delete on public.daily_highlights to authenticated;
grant select on public.orders, public.order_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-images', 'marketplace-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Signed-in users read marketplace images" on storage.objects;
create policy "Signed-in users read marketplace images" on storage.objects
  for select to authenticated using (bucket_id = 'marketplace-images');
drop policy if exists "Shop owners upload marketplace images" on storage.objects;
create policy "Shop owners upload marketplace images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'marketplace-images' and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()
    )
  );
drop policy if exists "Shop owners update marketplace images" on storage.objects;
create policy "Shop owners update marketplace images" on storage.objects
  for update to authenticated using (
    bucket_id = 'marketplace-images' and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()
    )
  ) with check (
    bucket_id = 'marketplace-images' and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()
    )
  );
drop policy if exists "Shop owners delete marketplace images" on storage.objects;
create policy "Shop owners delete marketplace images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'marketplace-images' and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()
    )
  );

commit;

-- To grant marketplace highlight administration after creating an account:
-- update public.profiles set is_admin = true where id = '<auth user UUID>';
