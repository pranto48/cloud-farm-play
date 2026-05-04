
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles: select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id);

-- games (catalog)
create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  genre text,
  cover_url text,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "Games: select for authenticated" on public.games for select to authenticated using (true);

-- user_games
create table public.user_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  added_at timestamptz not null default now(),
  last_played_at timestamptz,
  unique (user_id, game_id)
);
alter table public.user_games enable row level security;
create policy "UserGames: select own" on public.user_games for select using (auth.uid() = user_id);
create policy "UserGames: insert own" on public.user_games for insert with check (auth.uid() = user_id);
create policy "UserGames: update own" on public.user_games for update using (auth.uid() = user_id);
create policy "UserGames: delete own" on public.user_games for delete using (auth.uid() = user_id);

-- cloud_saves
create table public.cloud_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  slot_name text not null default 'Auto Save',
  save_data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, game_id, slot_name)
);
alter table public.cloud_saves enable row level security;
create policy "CloudSaves: select own" on public.cloud_saves for select using (auth.uid() = user_id);
create policy "CloudSaves: insert own" on public.cloud_saves for insert with check (auth.uid() = user_id);
create policy "CloudSaves: update own" on public.cloud_saves for update using (auth.uid() = user_id);
create policy "CloudSaves: delete own" on public.cloud_saves for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger cloud_saves_touch
before update on public.cloud_saves
for each row execute function public.touch_updated_at();

-- play_sessions
create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer
);
alter table public.play_sessions enable row level security;
create policy "PlaySessions: select own" on public.play_sessions for select using (auth.uid() = user_id);
create policy "PlaySessions: insert own" on public.play_sessions for insert with check (auth.uid() = user_id);
create policy "PlaySessions: update own" on public.play_sessions for update using (auth.uid() = user_id);

-- seed sample game
insert into public.games (title, slug, description, genre, cover_url)
values (
  'Meadow Life',
  'meadow-life',
  'Grow crops, collect resources, and relax in a peaceful pixel-style village.',
  'Cozy Farming RPG',
  null
);

-- handle_new_user trigger: create profile + grant sample game
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

  select id into meadow_id from public.games where slug = 'meadow-life' limit 1;
  if meadow_id is not null then
    insert into public.user_games (user_id, game_id)
    values (new.id, meadow_id)
    on conflict (user_id, game_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
