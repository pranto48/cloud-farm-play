
-- Roles enum + table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- RLS for user_roles
create policy "UserRoles: select own or admin"
on public.user_roles for select
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "UserRoles: admin manage"
on public.user_roles for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view & manage profiles, games, play_sessions, user_games
create policy "Profiles: admin select all"
on public.profiles for select
using (public.has_role(auth.uid(), 'admin'));

create policy "Profiles: admin update all"
on public.profiles for update
using (public.has_role(auth.uid(), 'admin'));

create policy "Games: admin insert"
on public.games for insert
with check (public.has_role(auth.uid(), 'admin'));

create policy "Games: admin update"
on public.games for update
using (public.has_role(auth.uid(), 'admin'));

create policy "Games: admin delete"
on public.games for delete
using (public.has_role(auth.uid(), 'admin'));

create policy "PlaySessions: admin select all"
on public.play_sessions for select
using (public.has_role(auth.uid(), 'admin'));

create policy "UserGames: admin select all"
on public.user_games for select
using (public.has_role(auth.uid(), 'admin'));

create policy "CloudSaves: admin select all"
on public.cloud_saves for select
using (public.has_role(auth.uid(), 'admin'));

-- Update new-user handler to also assign default 'user' role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meadow_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  select id into meadow_id from public.games where slug = 'meadow-life' limit 1;
  if meadow_id is not null then
    insert into public.user_games (user_id, game_id)
    values (new.id, meadow_id)
    on conflict (user_id, game_id) do nothing;
  end if;

  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill: existing users get 'user' role
insert into public.user_roles (user_id, role)
select id, 'user'::app_role from auth.users
on conflict (user_id, role) do nothing;

-- Ensure Meadow Life seed exists
insert into public.games (title, slug, description, genre, cover_url)
values (
  'Meadow Life',
  'meadow-life',
  'A cozy original farming demo. Till soil, plant seeds, water crops, and watch your meadow grow.',
  'Cozy Farming RPG',
  null
)
on conflict (slug) do nothing;
