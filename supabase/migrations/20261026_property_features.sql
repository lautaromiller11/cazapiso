-- Add optional listing details without changing or deleting existing properties.
alter table public.properties
  add column if not exists features jsonb not null default '{}'::jsonb;

comment on column public.properties.features is
  'Optional structured listing details. Missing or unpublished values are omitted.';

-- Ensure PostgREST (used by the extension) immediately sees the new column.
notify pgrst, 'reload schema';
