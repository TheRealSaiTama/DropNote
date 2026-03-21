create table if not exists public.notes (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',
  preview text not null default '',
  pinned boolean not null default false,
  archived boolean not null default false,
  tags text[] not null default '{}',
  attachments_count integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz default null
);

alter table public.notes enable row level security;

create policy "users manage own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.notes (user_id, updated_at);

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

create policy "users manage own folders"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


create table if not exists public.attachments (
  id text primary key,
  note_id text references public.notes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  name text not null,
  mime_type text not null,
  size integer not null,
  remote_path text default null,
  created_at timestamptz not null,
  deleted_at timestamptz default null,
  media_status text not null default 'uploaded',
  preview_path text default null,
  preview_mime text default null,
  error_code text default null,
  width integer default null,
  height integer default null,
  duration float default null
);

alter table public.attachments
  add column if not exists media_status text not null default 'uploaded',
  add column if not exists preview_path text default null,
  add column if not exists preview_mime text default null,
  add column if not exists error_code text default null,
  add column if not exists width integer default null,
  add column if not exists height integer default null,
  add column if not exists duration float default null;

alter table public.attachments enable row level security;

create policy "users manage own attachments"
  on public.attachments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.attachments (user_id, note_id);


insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict do nothing;

create policy "users upload own attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users read own attachments"
  on storage.objects for select
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users delete own attachments"
  on storage.objects for delete
  using (bucket_id = 'attachments' and auth.uid()::text = (storage.foldername(name))[1]);
