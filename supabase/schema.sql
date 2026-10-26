-- =========================================================
-- Skuddkart – database i Supabase (versjon 2.0, fase 1)
--
-- Kjøres ÉN gang i Supabase: SQL Editor → New query → lim inn alt → Run.
-- Trygt å kjøre på nytt: alt opprettes bare hvis det ikke finnes.
--
-- Tabeller:
--   members  – hvem som har tilgang (administrator eller trener for et lag)
--   teams    – ett lag med spillere og innstillinger (JSON)
--   matches  – én kamp med skudd og hendelser (JSON)
--
-- Tilgang (Row Level Security): en innlogget bruker ser bare lag hun er
-- trener for. Administrator ser og kan endre alt. Uten innlogging: ingenting.
-- =========================================================

-- ---------- Tabeller ----------

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  role       text not null check (role in ('admin', 'coach')),
  team_id    text,                         -- tom for administrator
  created_at timestamptz not null default now()
);
create unique index if not exists members_email_team
  on public.members (lower(email), coalesce(team_id, ''));

create table if not exists public.teams (
  id         text primary key,             -- samme id som i appen
  data       jsonb not null,               -- navn, omgangslengde, spillere (fornavn + nummer)
  archived   boolean not null default false,
  deleted    boolean not null default false,   -- slettet i appen (for synkronisering)
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.matches (
  id         text primary key,             -- samme id som i appen
  team_id    text not null references public.teams (id) on delete cascade,
  data       jsonb not null,               -- motstander, dato, klokke, skudd, hendelser
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists matches_team on public.matches (team_id);

-- ---------- Hjelpefunksjoner for tilgang ----------

-- E-posten til den som er logget inn (små bokstaver)
create or replace function public.current_email()
returns text language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.members
    where lower(email) = public.current_email() and role = 'admin'
  )
$$;

create or replace function public.can_access_team(t text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.members
    where lower(email) = public.current_email() and team_id = t
  )
$$;

-- Tidsstempel og hvem som endret, settes automatisk
create or replace function public.touch()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := public.current_email();
  return new;
end
$$;

drop trigger if exists teams_touch on public.teams;
create trigger teams_touch before insert or update on public.teams
  for each row execute function public.touch();

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before insert or update on public.matches
  for each row execute function public.touch();

-- ---------- Tilgangsregler (Row Level Security) ----------

alter table public.members enable row level security;
alter table public.teams   enable row level security;
alter table public.matches enable row level security;

-- Ingen tilgang uten innlogging
revoke all on public.members, public.teams, public.matches from anon;

drop policy if exists "members: les egne, admin alle" on public.members;
create policy "members: les egne, admin alle" on public.members
  for select using (lower(email) = public.current_email() or public.is_admin());

drop policy if exists "members: admin legger til" on public.members;
create policy "members: admin legger til" on public.members
  for insert with check (public.is_admin());

drop policy if exists "members: admin endrer" on public.members;
create policy "members: admin endrer" on public.members
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members: admin sletter" on public.members;
create policy "members: admin sletter" on public.members
  for delete using (public.is_admin());

drop policy if exists "teams: les" on public.teams;
create policy "teams: les" on public.teams
  for select using (public.can_access_team(id));

drop policy if exists "teams: admin oppretter" on public.teams;
create policy "teams: admin oppretter" on public.teams
  for insert with check (public.is_admin());

drop policy if exists "teams: endre" on public.teams;
create policy "teams: endre" on public.teams
  for update using (public.can_access_team(id)) with check (public.can_access_team(id));

drop policy if exists "teams: admin sletter" on public.teams;
create policy "teams: admin sletter" on public.teams
  for delete using (public.is_admin());

drop policy if exists "matches: les" on public.matches;
create policy "matches: les" on public.matches
  for select using (public.can_access_team(team_id));

drop policy if exists "matches: opprett" on public.matches;
create policy "matches: opprett" on public.matches
  for insert with check (public.can_access_team(team_id));

drop policy if exists "matches: endre" on public.matches;
create policy "matches: endre" on public.matches
  for update using (public.can_access_team(team_id)) with check (public.can_access_team(team_id));

drop policy if exists "matches: slett" on public.matches;
create policy "matches: slett" on public.matches
  for delete using (public.can_access_team(team_id));

-- ---------- Første bruker: administrator ----------
-- Trenere (for eksempel Kent Trinborg, J13) legges til fra appen senere.

insert into public.members (email, name, role)
select 'eklonteig@gmail.com', 'Eirik Klonteig', 'admin'
where not exists (
  select 1 from public.members where lower(email) = 'eklonteig@gmail.com' and role = 'admin'
);
