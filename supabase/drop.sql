-- Existing projects: run this migration once in the Supabase SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists public.drop_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text', 'file')),
  content text,
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint drop_items_payload_check check (
    (kind = 'text' and length(trim(content)) > 0 and file_path is null)
    or (kind = 'file' and file_path is not null and file_name is not null)
  )
);

create index if not exists drop_items_user_created_idx on public.drop_items(user_id, created_at);
create index if not exists drop_items_expires_at_idx on public.drop_items(expires_at);
alter table public.drop_items enable row level security;

drop policy if exists "drop_items_select_own" on public.drop_items;
drop policy if exists "drop_items_insert_own" on public.drop_items;
drop policy if exists "drop_items_delete_own" on public.drop_items;
create policy "drop_items_select_own" on public.drop_items for select using (auth.uid() = user_id);
create policy "drop_items_insert_own" on public.drop_items for insert
  with check (auth.uid() = user_id and expires_at > now() and expires_at <= now() + interval '90 days 5 minutes');
create policy "drop_items_delete_own" on public.drop_items for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('drop-files', 'drop-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "drop_files_select_own" on storage.objects;
drop policy if exists "drop_files_insert_own" on storage.objects;
drop policy if exists "drop_files_delete_own" on storage.objects;
create policy "drop_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'drop-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "drop_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'drop-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "drop_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'drop-files' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drop_items'
  ) then
    alter publication supabase_realtime add table public.drop_items;
  end if;
end $$;
