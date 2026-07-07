create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  password_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null,
  url text not null,
  icon_url text,
  description text,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists links_user_id_idx on public.links(user_id);
create index if not exists links_category_id_idx on public.links(category_id);

alter table public.links add column if not exists icon_url text;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.links enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

create policy "links_select_own"
  on public.links for select
  using (auth.uid() = user_id);

create policy "links_insert_own"
  on public.links for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = links.category_id
        and categories.user_id = auth.uid()
    )
  );

create policy "links_update_own"
  on public.links for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.categories
      where categories.id = links.category_id
        and categories.user_id = auth.uid()
    )
  );

create policy "links_delete_own"
  on public.links for delete
  using (auth.uid() = user_id);
