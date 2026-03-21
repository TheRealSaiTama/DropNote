create table if not exists public.folders (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz default null
);

alter table public.notes add column if not exists folder_id text references public.folders(id) on delete set null;

create index if not exists folders_user_updated on public.folders (user_id, updated_at);

alter table public.folders enable row level security;

drop policy if exists "users manage own folders" on public.folders;
create policy "users manage own folders"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
