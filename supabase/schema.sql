-- ============================================================
-- CazaPiso — Supabase Schema
-- Execute this script in the Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- BOARDS
-- ============================================================
create table if not exists public.boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Mi búsqueda',
  created_at timestamptz not null default now()
);

create index if not exists idx_boards_user_id on public.boards(user_id);

alter table public.boards enable row level security;

-- Policies: users can only access their own boards
drop policy if exists "boards_select" on public.boards;
create policy "boards_select" on public.boards
  for select using (auth.uid() = user_id);

drop policy if exists "boards_insert" on public.boards;
create policy "boards_insert" on public.boards
  for insert with check (auth.uid() = user_id);

drop policy if exists "boards_update" on public.boards;
create policy "boards_update" on public.boards
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "boards_delete" on public.boards;
create policy "boards_delete" on public.boards
  for delete using (auth.uid() = user_id);

-- ============================================================
-- PROPERTIES
-- ============================================================

-- Status enum (safe creation)
do $$ begin
  create type public.property_status as enum (
    'guardado',
    'contactado',
    'visita',
    'descartado'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.properties (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards(id) on delete cascade,
  original_url text,
  title        text not null,
  price        numeric,
  image_url    text,
  description  text,
  features     jsonb not null default '{}'::jsonb,
  status       public.property_status not null default 'guardado',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_properties_board_id on public.properties(board_id);
create index if not exists idx_properties_status   on public.properties(status);

-- ============================================================
-- PERSONAL PROPERTY NOTES
-- ============================================================
create table if not exists public.property_notes (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content     text not null check (length(btrim(content)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_property_notes_property_created
  on public.property_notes(property_id, created_at desc);

alter table public.property_notes enable row level security;

drop policy if exists "property_notes_select" on public.property_notes;
create policy "property_notes_select" on public.property_notes
  for select using (
    exists (
      select 1 from public.properties p
      join public.boards b on b.id = p.board_id
      where p.id = property_notes.property_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "property_notes_insert" on public.property_notes;
create policy "property_notes_insert" on public.property_notes
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.properties p
      join public.boards b on b.id = p.board_id
      where p.id = property_notes.property_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "property_notes_delete" on public.property_notes;
create policy "property_notes_delete" on public.property_notes
  for delete using (auth.uid() = user_id);

alter table public.properties enable row level security;

-- Policies: users can only access properties belonging to their boards
drop policy if exists "properties_select" on public.properties;
create policy "properties_select" on public.properties
  for select using (
    exists (
      select 1 from public.boards
      where boards.id = properties.board_id
        and boards.user_id = auth.uid()
    )
  );

drop policy if exists "properties_insert" on public.properties;
create policy "properties_insert" on public.properties
  for insert with check (
    exists (
      select 1 from public.boards
      where boards.id = properties.board_id
        and boards.user_id = auth.uid()
    )
  );

drop policy if exists "properties_update" on public.properties;
create policy "properties_update" on public.properties
  for update using (
    exists (
      select 1 from public.boards
      where boards.id = properties.board_id
        and boards.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.boards
      where boards.id = properties.board_id
        and boards.user_id = auth.uid()
    )
  );

drop policy if exists "properties_delete" on public.properties;
create policy "properties_delete" on public.properties
  for delete using (
    exists (
      select 1 from public.boards
      where boards.id = properties.board_id
        and boards.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER: auto-update updated_at on properties
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
  before update on public.properties
  for each row execute function public.handle_updated_at();
