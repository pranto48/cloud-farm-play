# CloudFarm Arcade — Build Plan

A full-stack web game platform with auth, a personal game library, cloud saves, and an original cozy farming demo called **Meadow Life**.

## Tech & foundation
- React + TypeScript on TanStack Start (existing template), Tailwind v4, shadcn/ui.
- Lovable Cloud (Supabase) for auth, database, and cloud save storage.
- Dark mode via `next-themes`-style toggle using existing CSS variables.
- Protected routes via a `_authenticated` layout route + Supabase session gate.

## Pages & routes
```text
/                      Landing (hero, features, CTAs)
/login                 Login + link to forgot password
/signup                Sign up (email + password)
/forgot-password       Request reset email
/reset-password        Set new password (recovery flow)
/_authenticated/
  dashboard            Stats cards + Continue Playing + Recent activity
  library              Grid of user's games, search + genre filter
  games/$slug          Game details, screenshots, cloud save info
  play/$slug           Full game canvas with save/load/fullscreen header
  saves                All cloud saves across games, delete
  profile              Edit display name, avatar URL
```
Sidebar (after login): Dashboard, My Games, Cloud Saves, Profile, Logout.

## Database (Lovable Cloud)
Tables exactly as specified:
- `profiles` (id → auth.users, display_name, avatar_url, created_at)
- `games` (id, title, slug unique, description, genre, cover_url, created_at)
- `user_games` (id, user_id, game_id, added_at, last_played_at)
- `cloud_saves` (id, user_id, game_id, slot_name, save_data jsonb, updated_at)
- `play_sessions` (id, user_id, game_id, started_at, ended_at, duration_seconds)

RLS: every user-owned table restricts SELECT/INSERT/UPDATE/DELETE to `auth.uid() = user_id`. `games` is readable by all authenticated users. `profiles` readable/updatable only by the owner.

Triggers:
- On `auth.users` insert → create row in `profiles` and insert a `user_games` row linking the new user to the seeded **Meadow Life** game.
- `updated_at` auto-update trigger on `cloud_saves`.

Seed: one row in `games` for "Meadow Life", genre "Cozy Farming RPG", description as specified, placeholder cover.

## Auth
- Email + password signup/login with `emailRedirectTo: window.location.origin`.
- Forgot password sends reset email with `redirectTo: /reset-password`.
- `/reset-password` detects recovery token and calls `updateUser({ password })`.
- `onAuthStateChange` listener set up before `getSession()` in an `AuthProvider`.

## Sample game: Meadow Life
Original cozy farming demo, no Stardew assets/names/mechanics copied.

Implementation:
- HTML5 Canvas, 20×14 tile grid, 32px tiles, top-down view.
- Tile types: grass, soil (tilled), seeded, watered, grown, water, house, tree.
- Simple shape/color pixel art drawn in canvas (no external assets).
- Controls: WASD/arrows to move; `E` interact with facing tile; number keys to switch tools (hoe, seed, watering can, scythe).
- Actions: till grass→soil, plant seed on soil→seeded, water seeded→watered, harvest grown→+1 crop, sell crops for coins, buy seeds.
- HUD overlay (React above canvas): inventory (seeds, crops, coins), day counter, "Sleep" button to end day, shop modal.
- Day system: sleeping advances day; watered crops progress one growth stage per day; unwatered crops stall.
- Game state shape (single object) used for save/load:
  ```text
  { player: {x,y,dir}, day, inventory: {seeds, crops, coins}, tiles: TileState[][], version: 1 }
  ```

## Cloud save behavior
- On entering `/play/$slug`: query `cloud_saves` for that user+game.
  - If exists → modal with "Continue from Cloud Save" / "Start New Game".
  - Else → start new.
- Manual **Save Game** button → upsert into `cloud_saves` (one default slot "Auto Save", JSONB).
- Auto-save every 60s using `setInterval`, only when tab visible and state changed.
- Save status indicator in header: idle / Saving… / Saved ✓ / Error (with retry). Toasts via `sonner`.
- On save: also update `user_games.last_played_at`.
- Play sessions: insert row on game open, update `ended_at` + `duration_seconds` on unmount/tab close.

## UI details
- Landing: hero "Play your web games anywhere", Get Started + Login buttons, 4 feature cards (Cloud save, Personal library, Browser-based play, Cozy demo included).
- Dashboard stats cards: Total games, Last played game, Total play sessions, Cloud saves count. Continue Playing CTA links to most recent game.
- Library: responsive grid, search input, genre dropdown filter, cover placeholder gradient + title overlay, last-played badge, cloud-save badge.
- Game details: hero with cover, description, screenshot placeholders, Play Now, cloud save panel (slot, last saved, delete), play history list.
- Play page: full-bleed canvas, sticky header with Back / Save / Load / Fullscreen + status pill.
- Loading screen on game launch (animated logo + tip text) before canvas mounts.
- Empty states for library, saves, history; skeleton loaders for queries.
- Dark mode toggle in sidebar footer; persists to `localStorage`.

## Security
- All user-scoped tables behind RLS using `auth.uid()`.
- `_authenticated` layout route gates all post-login pages; redirects to `/login` if no session.
- Reset password page is public.
- No service-role usage in client code.

## Out of scope (for this MVP)
- Admin panel (structure left clean for later — single `games` table is the catalog).
- Multiple cloud save slots per game (one slot for now; schema already supports more).
- Real avatar upload (URL input only).
- More than one game (architecture supports adding more by inserting `games` rows + a play component).

## Deliverables checklist
1. DB migration: tables, RLS, triggers, seed game.
2. Auth provider + login/signup/forgot/reset pages.
3. Protected layout with sidebar + dark mode.
4. Landing, Dashboard, Library, Game Details, Cloud Saves, Profile pages.
5. Meadow Life canvas game + HUD + save/load integration.
6. Auto-save loop, play session tracking, toasts, loading/empty/error states.
