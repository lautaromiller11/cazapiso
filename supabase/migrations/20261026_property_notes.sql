-- Store each personal note as a separate, dated entry.
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
      where p.id = property_notes.property_id
        and b.user_id = auth.uid()
    )
  );

drop policy if exists "property_notes_insert" on public.property_notes;
create policy "property_notes_insert" on public.property_notes
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.properties p
      join public.boards b on b.id = p.board_id
      where p.id = property_notes.property_id
        and b.user_id = auth.uid()
    )
  );

drop policy if exists "property_notes_delete" on public.property_notes;
create policy "property_notes_delete" on public.property_notes
  for delete using (auth.uid() = user_id);

-- Migrate existing single notes, keeping their original text and an approximate date.
insert into public.property_notes (property_id, user_id, content, created_at)
select p.id, b.user_id, p.notes, coalesce(p.updated_at, p.created_at, now())
from public.properties p
join public.boards b on b.id = p.board_id
where p.notes is not null and length(btrim(p.notes)) > 0
  and not exists (
    select 1 from public.property_notes pn
    where pn.property_id = p.id and pn.content = p.notes
  );

update public.properties
set notes = null
where notes is not null and length(btrim(notes)) > 0;
