# Meadow Life MVP GDD (Vertical Slice)

## 1) Project Decision: Engine Choice

**Chosen engine: Godot 4 (2D).**

Why:
- Fast iteration for 2D tilemap games.
- Easy scene system for farm/town/world composition.
- Lightweight for an indie vertical slice.
- GDScript allows rapid gameplay scripting.

Alternative:
- Unity is viable, but Godot is the faster MVP path for this scope.

---

## 2) Vision & Pillars

**Game fantasy:** cozy meadow life where you farm, sell, and slowly improve your routine.

**MVP pillars:**
1. Relaxed day loop.
2. Satisfying farming interactions.
3. Clear short-term progression through money and inventory.

---

## 3) Vertical Slice Scope (20–30 min)

### Core loop
Wake up → farm tasks (water/harvest/replant) → sell items → buy seeds/tools → sleep → next day.

### Content lock
- 1 continuous map (farm + small town/shop).
- 1 season (Spring).
- 5–8 crops (MVP can start with 1 crop complete and add more after playtest).
- 2 NPCs (shopkeeper + villager).
- Basic shop.
- Simple inventory.

### Out of scope
- Combat, romance, multiplayer, deep crafting trees, festivals.

---

## 4) Systems Requirements

### World/Scene data
- Tilemap layers: Ground / Collision / Interactables / Decoration.
- Static points: player spawn, shop interaction point, bed/sleep point, shipping bin.

### Time/day cycle
- Day starts 6:00 AM.
- Day ends 12:00 AM.
- 10 in-game minutes every 5 real seconds.
- ~12 real minutes/day.
- Lighting phases:
  - Morning (6:00–12:00)
  - Evening (12:00–20:00)
  - Night (20:00–24:00)

### Farming
- Hoe on grass → soil.
- Plant seed on soil.
- Water seed/growing crop.
- Crop advances on new day if watered.
- Harvest grown crop.

### Economy
- Sell harvested crops for coins.
- Buy seeds from shop.

### Inventory
- Track seeds, crops, coins.
- (Current prototype also includes wood/planks; keep as optional extension.)

---

## 5) 2–3 Day Prototype Build Plan

## Day 1
- Project setup and scene skeleton.
- Player movement and collisions.
- Camera and tilemap setup.
- World static points + interact prompt.

**Done when:** player can move farm↔shop on one map.

## Day 2
- Time manager singleton.
- Clock UI and fixed tick rate.
- Day rollover (sleep + auto at midnight).
- Lighting overlays (morning/evening/night).

**Done when:** full day runs from 6:00 AM to 12:00 AM with visible phase changes.

## Day 3
- One crop end-to-end:
  - till → plant → water → grow over days → harvest → sell.
- Seed buy flow.
- Basic balancing pass.

**Done when:** player can repeat complete farm economy loop for at least 3 in-game days.

---

## 6) One-Crop End-to-End Acceptance Criteria

A crop implementation is complete only if:
1. Seed purchase reduces coins and increases seed count.
2. Planting consumes seed.
3. Watering marks the crop for day growth.
4. Sleeping/new day grows crop stage.
5. Mature crop can be harvested into inventory.
6. Selling increases coins and removes crop item.

---

## 7) Playtest Plan (Internal)

### Session structure
- 3 runs x 20 minutes each.
- Observe first-time friction points.

### What to track
- Time to first harvest.
- Number of full loop completions per session.
- Average remaining energy/time at day end.
- Confusion events (where controls/goals are unclear).

### Tuning knobs
- Seed price.
- Crop sell price.
- Growth days.
- Player movement speed/run cooldown.
- Day length tick values.

---

## 8) Immediate Next Tasks Checklist

- [ ] Confirm Godot 4 as final engine for MVP branch.
- [ ] Freeze this GDD for vertical-slice scope.
- [ ] Ship movement + day-cycle prototype in 2–3 days.
- [ ] Keep only one crop until loop is fun and readable.
- [ ] Run 3 playtests and tune pacing before adding more content.

