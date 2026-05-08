# CloudFarm Arcade

CloudFarm Arcade is a browser-based 2D gaming portal built with TanStack Start + React, with Supabase-backed authentication and cloud save support.

## Current architecture (analysis)

- **Frontend:** React 19 + TanStack Router/Start, Vite build pipeline.
- **Auth + data:** Supabase (`@supabase/supabase-js`) for users, games, saves, and play sessions.
- **Playable game route:** `/play/$slug` renders a 2D game (currently `meadow-life`) and provides save/load UX.
- **Cloud saves:** Saved to `cloud_saves` table keyed by `user_id + game_id + slot_name`.

## Online play + user save flow

1. User signs in.
2. User opens a game in `/play/$slug`.
3. App checks if cloud save exists:
   - Prompt to continue saved run, or start new game.
4. During gameplay:
   - State updates mark session dirty.
   - Auto-save runs every 60 seconds.
   - Manual save button writes immediately.
5. User can review/delete saves from `/saves`.

## Deploy to GitHub + Vercel

### 1) Push code to GitHub

```bash
git init
git add .
git commit -m "Initial CloudFarm Arcade setup"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### 2) Create Supabase project

- Create a Supabase project.
- Run the SQL migrations in `supabase/migrations/`.
- Copy:
  - Project URL
  - Publishable (anon) key

### 3) Import into Vercel

1. Go to Vercel dashboard → **Add New Project**.
2. Import your GitHub repository.
3. Keep framework as **Other** (project uses custom `vercel.json`).
4. Add environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
5. Deploy.

### 4) Verify after deploy

- Sign up/login works.
- Library and game list load.
- `meadow-life` launches in `/play/meadow-life`.
- Save / load / auto-save work.
- `/saves` shows cloud save records.

## Local development

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

## Notes

- `vite.config.ts` automatically disables the Cloudflare plugin on Vercel (`VERCEL` env present).
- `vercel.json` deploys the Vite client build from `dist/client` and rewrites routes to `index.html` for SPA navigation.
