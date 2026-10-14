-- Casa de Hongos: almacenamiento privado por cuenta autenticada.
-- Ejecutar una vez en Supabase > SQL Editor.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Users can read their own app state" on public.app_state;
create policy "Users can read their own app state"
  on public.app_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own app state" on public.app_state;
create policy "Users can create their own app state"
  on public.app_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app state" on public.app_state;
create policy "Users can update their own app state"
  on public.app_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.app_state to authenticated;
revoke all on public.app_state from anon;

