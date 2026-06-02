# Meadow Life — Build Plan & Recommendation Note

## Current state (what's already shipped)

The game lives in the web app at `/play/meadow-life`, built in React + Canvas (not Godot). The codebase already covers most of Milestones 0–3 from your roadmap:

| System | Status | Location |
|---|---|---|
| Player movement + collisions | Done (WASD + arrows + Shift-run) | `MeadowLife.tsx` keyboard handler |
| Tilemap + camera | Done (fixed-screen canvas grid) | `meadow-life.ts` `draw()` |
| Time/day cycle + lighting phases | Done (morning / evening / night overlay) | `timeManager` in `meadow-life.ts` |
| Farming loop (hoe → seed → water → grow → harvest) | Done | `interact()` in `meadow-life.ts` |
| Inventory (seeds, crops, wood, planks, ore, coins) | Done | `GameState.inventory` |
| Shop (buy seeds, sell crops, tool upgrades) | Done | Dialog in `MeadowLife.tsx` |
| Tools (hoe, seed, water, scythe, pickaxe + upgrades) | Done | `TOOL_ITEMS`, `upgradeTool()` |
| NPC dialogue (shopkeeper) | Basic (press F) | `talkToShopkeeper()` |
| Weather (sunny/rainy) | Done | `GameState.weather` |
| Sleep + day rollover | Done | `sleep()` |
| Save/load (cloud saves) | Done via app's save system | `_app.saves.tsx`, `_app.play.$slug.tsx` |
| Touch controls (on-screen D-pad + action) | Done last turn | `MeadowLife.tsx` |

**Decision:** keep React + Canvas, not Godot. The vertical slice is already playable in-browser and shares the app's auth, cloud saves, and library — switching engines would throw all of that away.

## Gaps vs your roadmap

These are the meaningful pieces from your plan that are NOT yet in the code:

1. **Crop variety** — currently one generic crop. Need 5–8 crops with different prices, grow times, seasons.
2. **Second NPC + schedules** — only the shopkeeper exists, and they don't move. No villager, no time-based schedules.
3. **Friendship + gifting** — not implemented.
4. **Mini-quests** — none.
5. **Festival/event** — none.
6. **Audio** — no SFX or music.
7. **Particles / juice** — no feedback effects on harvest, level-up, etc.
8. **Tooltips + inventory sorting** — minimal UI polish.
9. **Save versioning** — saves work but have no schema version field, so future changes will break old saves.
10. **Data-driven crop/item definitions** — currently hardcoded; should move to a `crops.ts` data table for easy balancing.

## Recommended task list (priority order)

### Phase A — Content depth (the highest-leverage work)
1. Refactor crops into a data table (`src/game/data/crops.ts`) with `{id, seedPrice, sellPrice, growDays, season, sprite}`.
2. Add 6 crops total across 2 profitability tiers (parsnip, potato, cauliflower, strawberry, blueberry, starfruit-style rare).
3. Add a second NPC (villager) with a simple 3-stop daily schedule (home → meadow → tavern) driven by `timeManager`.
4. Friendship points per NPC + a one-item-per-day gift action.
5. Two scripted mini-quests (e.g. "bring 5 parsnips", "harvest in the rain") with completion rewards.

### Phase B — Save integrity
6. Add `saveVersion: 1` to `GameState` + a migration function that upgrades old saves on load.

### Phase C — Polish & juice
7. Audio: footstep, till, water, harvest, coin SFX + ambient day/night loop. (Lazy-load on first user gesture.)
8. Particle bursts on harvest, planting, coin pickup.
9. Inventory sorting + hover tooltips on tool buttons.
10. Mobile UX pass: bigger tap targets, persistent HUD, swipe-to-move alternative.

### Phase D — Release prep
11. One festival event (e.g. Spring Fair on day 13) — a temporary map decoration + bonus sell prices.
12. 3 internal playtests, log time-to-first-harvest and loops-per-session, tune `seedPrice`/`sellPrice`/`growDays`.
13. Lock content (no new features), fix top 20 bugs, ship as the demo game in the library.

## Risk controls (carry over from your plan)
- **Scope freeze** after Phase A. Resist adding combat/romance/multiplayer.
- **Balancing spreadsheet** — keep crop economics in `crops.ts` so tuning is a one-file change.
- **Daily playable build** — the dev preview already gives this for free.
- **Save versioning early** — Phase B before Phase C so polish changes don't break testers' saves.

## Suggested next concrete step
Start with Phase A task #1 (extract crops to a data table) — it unblocks tasks 2, 5, and 12 and is a ~1-hour refactor. Want me to do that now?
