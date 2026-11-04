-- =========================================================
-- Skuddkart – klubber og klubbledere (versjon 2.2)
--
-- Kjøres ÉN gang etter schema.sql: SQL Editor → New query → lim inn alt → Run.
-- Trygt å kjøre på nytt.
--
-- Nytt:
--   clubs           – klubbene (for eksempel Tune IL). Hvert lag hører til én klubb.
--   teams.club_id   – hvilken klubb laget hører til
--   members.club_id – hvilken klubb brukeren hører til
--   rollen club_admin (klubbleder): ser alle lag i klubben sin og kan
--   legge til og fjerne trenere der. Administrator ser fortsatt alt.
-- =========================================================

-- ---------- Tabeller ----------

create table if not exists public.clubs (
  id         text primary key,             -- samme id som i appen
  name       text not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.teams   add column if not exists club_id text references public.clubs (id);
alter table public.members add column if not exists club_id text references public.clubs (id);

-- Ny rolle: club_admin (klubbleder)
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('admin', 'club_admin', 'coach'));

-- Samme person kan være klubbleder i flere klubber og trener for flere lag
drop index if exists public.members_email_team;
create unique index if not exists members_email_role_place
  on public.members (lower(email), role, coalesce(club_id, ''), coalesce(team_id, ''));

drop trigger if exists clubs_touch on public.clubs;
create trigger clubs_touch before insert or update on public.clubs
  for each row execute function public.touch();

-- ---------- Hjelpefunksjoner for tilgang ----------

create or replace function public.is_club_admin(c text)
returns boolean language sql stable security definer set search_path = public
as $$
  select c is not null and exists (
    select 1 from public.members
    where lower(email) = public.current_email() and role = 'club_admin' and club_id = c
  )
$$;

create or replace function public.can_access_team(t text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.members
      where lower(email) = public.current_email() and role = 'coach' and team_id = t
    )
    or exists (
      select 1 from public.teams tm
      where tm.id = t and public.is_club_admin(tm.club_id)
    )
$$;

create or replace function public.can_see_club(c text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.members
    where lower(email) = public.current_email() and club_id = c
  )
$$;

-- Et lag kan bare flyttes til en annen klubb av administrator
-- eller klubbleder i den nye klubben.
create or replace function public.guard_team_club()
returns trigger language plpgsql
as $$
begin
  if new.club_id is distinct from old.club_id
     and not (public.is_admin() or public.is_club_admin(new.club_id)) then
    raise exception 'Du kan ikke flytte laget til en annen klubb';
  end if;
  return new;
end
$$;

drop trigger if exists teams_guard_club on public.teams;
create trigger teams_guard_club before update on public.teams
  for each row execute function public.guard_team_club();

-- ---------- Tilgangsregler ----------

alter table public.clubs enable row level security;
revoke all on public.clubs from anon;

drop policy if exists "clubs: les" on public.clubs;
create policy "clubs: les" on public.clubs
  for select using (public.can_see_club(id));

drop policy if exists "clubs: admin oppretter" on public.clubs;
create policy "clubs: admin oppretter" on public.clubs
  for insert with check (public.is_admin());

drop policy if exists "clubs: admin endrer" on public.clubs;
create policy "clubs: admin endrer" on public.clubs
  for update using (public.is_admin()) with check (public.is_admin());

-- Lag: administrator, eller klubbleder i klubben, kan opprette
drop policy if exists "teams: admin oppretter" on public.teams;
drop policy if exists "teams: opprett" on public.teams;
create policy "teams: opprett" on public.teams
  for insert with check (public.is_admin() or public.is_club_admin(club_id));

-- Brukere: klubbleder ser og styrer trenerne i sin egen klubb
drop policy if exists "members: les egne, admin alle" on public.members;
create policy "members: les egne, admin alle" on public.members
  for select using (
    lower(email) = public.current_email() or public.is_admin() or public.is_club_admin(club_id)
  );

drop policy if exists "members: admin legger til" on public.members;
create policy "members: admin legger til" on public.members
  for insert with check (
    public.is_admin()
    or (public.is_club_admin(club_id) and role = 'coach'
        and exists (select 1 from public.teams tm where tm.id = team_id and tm.club_id = members.club_id))
  );

drop policy if exists "members: admin endrer" on public.members;
create policy "members: admin endrer" on public.members
  for update using (public.is_admin() or (public.is_club_admin(club_id) and role = 'coach'))
  with check (
    public.is_admin()
    or (public.is_club_admin(club_id) and role = 'coach'
        and exists (select 1 from public.teams tm where tm.id = team_id and tm.club_id = members.club_id))
  );

drop policy if exists "members: admin sletter" on public.members;
create policy "members: admin sletter" on public.members
  for delete using (public.is_admin() or (public.is_club_admin(club_id) and role = 'coach'));

-- Be API-et lese inn den nye tabellen med en gang
notify pgrst, 'reload schema';
