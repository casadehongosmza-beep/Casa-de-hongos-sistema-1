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


-- Copias diarias de la última versión sincronizada de cada cuenta.
create table if not exists public.app_state_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, snapshot_date)
);

alter table public.app_state_snapshots enable row level security;

drop policy if exists "Users can read their own app state snapshots" on public.app_state_snapshots;
create policy "Users can read their own app state snapshots"
  on public.app_state_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own app state snapshots" on public.app_state_snapshots;
create policy "Users can create their own app state snapshots"
  on public.app_state_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.app_state_snapshots to authenticated;
revoke all on public.app_state_snapshots from anon;
