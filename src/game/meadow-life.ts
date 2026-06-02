/**
 * Meadow Life — original cozy farming demo for CloudFarm Arcade.
 * No external assets, no copyrighted content. Pure canvas drawing.
 */

export const TILE = 32;
export const COLS = 80;
export const ROWS = 80;

export type TileKind =
  | "grass"
  | "soil"
  | "seeded"
  | "watered"
  | "growing"
  | "grown"
  | "water"
  | "tree"
  | "house"
  | "path"
  | "shop"
  | "npc";

export type Tile = {
  kind: TileKind;
  /** Days since the crop was planted; -1 if not a crop. */
  age: number;
  /** Whether the crop was watered today. */
  watered: boolean;
};

export type Tool = "hoe" | "seed" | "water" | "scythe" | "pickaxe";

export type GameState = {
  version: 1;
  player: { x: number; y: number; dir: "up" | "down" | "left" | "right" };
  day: number;
  /** Minutes since midnight. Day starts at 06:00 and ends at 24:00. */
  time: number;
  inventory: { seeds: number; crops: number; coins: number; wood: number; planks: number };
  tool: Tool;
  tiles: Tile[][];
  season: "spring" | "summer" | "fall" | "winter";
  weather: "sunny" | "rainy";
  energy: number;
  ore: number;
  mineDepth: number;
  upgrades: { hoe: number; watering: number; scythe: number; pickaxe: number };
};

export type StaticPoints = {
  playerSpawn: { x: number; y: number };
  shopInteract: { x: number; y: number };
  bedSleep: { x: number; y: number };
  shippingBin: { x: number; y: number };
};

export const SEED_PRICE = 8;
export const CROP_PRICE = 14;
export const GROW_DAYS = 3;
export const PLANK_WOOD_COST = 3;
export const DAY_START_MINUTES = 6 * 60;
export const DAY_END_MINUTES = 24 * 60;
export const TIME_TICK_MINUTES = 10;
export const TIME_TICK_MS = 5_000;
export const STATIC_POINTS: StaticPoints = {
  playerSpawn: { x: 16, y: 30 },
  shopInteract: { x: 70, y: 40 },
  bedSleep: { x: 16, y: 29 },
  shippingBin: { x: 18, y: 29 },
};

function makeMap(): Tile[][] {
  const t: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind, age: -1, watered: false })),
  );

  // Farm zone: starter plots near the player's home (left side of map).
  for (let y = 32; y <= 42; y++) {
    for (let x = 8; x <= 22; x++) t[y][x].kind = "soil";
  }

  // Farm house / wake-up area.
  for (let y = 24; y <= 28; y++) {
    for (let x = 12; x <= 17; x++) t[y][x].kind = "house";
  }

  // Shipping bin near the home for easy access.
  t[29][18].kind = "shop";

  // Tiny town/shop zone (right side of map).
  for (let y = 32; y <= 40; y++) {
    for (let x = 64; x <= 74; x++) t[y][x].kind = "house";
  }
  // Shop counter tile.
  t[40][70].kind = "shop";

  // NPC standing/walking area.
  t[41][68].kind = "npc";
  t[41][69].kind = "npc";
  t[41][70].kind = "npc";

  // Transition path connecting farm to town (no scene transitions).
  for (let x = 16; x <= 70; x++) t[44][x].kind = "path";
  for (let y = 29; y <= 44; y++) t[y][16].kind = "path";
  for (let y = 40; y <= 44; y++) t[y][70].kind = "path";

  // Decorative elements.
  for (let y = 54; y <= 66; y++) for (let x = 2; x <= 10; x++) t[y][x].kind = "water";
  const trees: Array<[number, number]> = [
    [6, 12], [8, 10], [20, 18], [24, 22], [28, 40], [36, 38], [46, 18], [60, 44], [58, 12], [40, 52],
    [62, 24], [66, 26], [72, 50], [50, 64], [26, 58], [14, 48], [74, 16], [78, 30],
  ];
  trees.forEach(([x, y]) => {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && t[y][x].kind === "grass") t[y][x].kind = "tree";
  });

  return t;
}

export function newGame(): GameState {
  return {
    version: 1,
    player: { x: STATIC_POINTS.playerSpawn.x, y: STATIC_POINTS.playerSpawn.y, dir: "down" },
    day: 1,
    time: DAY_START_MINUTES,
    inventory: { seeds: 5, crops: 0, coins: 30, wood: 0, planks: 0 },
    tool: "hoe",
    tiles: makeMap(),
    season: "spring",
    weather: "sunny",
    energy: 100,
    ore: 0,
    mineDepth: 0,
    upgrades: { hoe: 1, watering: 1, scythe: 1, pickaxe: 1 },
  };
}

export function isWalkable(t: Tile): boolean {
  return t.kind !== "water" && t.kind !== "tree" && t.kind !== "house" && t.kind !== "shop" && t.kind !== "npc";
}

export function frontTile(state: GameState): { x: number; y: number } | null {
  let { x, y } = state.player;
  if (state.player.dir === "up") y -= 1;
  if (state.player.dir === "down") y += 1;
  if (state.player.dir === "left") x -= 1;
  if (state.player.dir === "right") x += 1;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return { x, y };
}

/** Apply current tool to the tile in front of the player. Returns a status message or null. */
export function interact(state: GameState): string | null {
  const f = frontTile(state);
  if (!f) return null;
  const tile = state.tiles[f.y][f.x];

  switch (state.tool) {
    case "hoe":
      if (tile.kind === "grass") {
        tile.kind = "soil";
        return "Tilled soil";
      }
      return null;
    case "seed":
      if (tile.kind === "soil" && state.inventory.seeds > 0) {
        tile.kind = "seeded";
        tile.age = 0;
        tile.watered = false;
        state.inventory.seeds -= 1;
        return "Planted a seed";
      }
      return null;
    case "water":
      if (tile.kind === "seeded" || tile.kind === "growing") {
        if (!tile.watered) {
          tile.watered = true;
          if (tile.kind === "seeded") tile.kind = "watered";
          return "Watered crop";
        }
      }
      return null;
    case "scythe":
      if (tile.kind === "grown") {
        tile.kind = "soil";
        tile.age = -1;
        tile.watered = false;
        state.inventory.crops += 1;
        return "Harvested! +1 crop";
      }
      return null;
    case "pickaxe":
      if (tile.kind === "tree") {
        tile.kind = "grass";
        state.inventory.wood += 1;
        return "Chopped tree! +1 wood";
      }
      return null;
  }
  return null;
}

export function craftPlank(state: GameState): string {
  if (state.inventory.wood < PLANK_WOOD_COST) return `Need ${PLANK_WOOD_COST} wood`;
  state.inventory.wood -= PLANK_WOOD_COST;
  state.inventory.planks += 1;
  return "Crafted 1 plank";
}

export function buySeed(state: GameState): string {
  if (state.inventory.coins < SEED_PRICE) return "Not enough coins";
  state.inventory.coins -= SEED_PRICE;
  state.inventory.seeds += 1;
  return `Bought 1 seed (-${SEED_PRICE}c)`;
}

export function sellCrop(state: GameState): string {
  if (state.inventory.crops <= 0) return "No crops to sell";
  state.inventory.crops -= 1;
  state.inventory.coins += CROP_PRICE;
  return `Sold 1 crop (+${CROP_PRICE}c)`;
}

const UPGRADE_COST = 80;
export function upgradeTool(
  state: GameState,
  tool: "hoe" | "watering" | "scythe" | "pickaxe",
): string {
  if (state.upgrades[tool] >= 3) return `${tool} already maxed`;
  if (state.inventory.coins < UPGRADE_COST) return `Need ${UPGRADE_COST}c to upgrade`;
  state.inventory.coins -= UPGRADE_COST;
  state.upgrades[tool] += 1;
  return `${tool} upgraded to Lv.${state.upgrades[tool]}`;
}

export function talkToShopkeeper(state: GameState): string {
  const lines = [
    `Welcome! It is day ${state.day} of ${state.season}.`,
    state.weather === "rainy" ? "Crops water themselves today — lucky you." : "Fine weather for tilling.",
    state.inventory.coins < 20 ? "Bring me crops and I'll fill your purse." : "Plenty of stock today.",
  ];
  return lines.join(" ");
}

/** End the day: advance growth on watered crops, reset watered flags. */
export function sleep(state: GameState): void {
  state.day += 1;
  state.time = DAY_START_MINUTES;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.tiles[y][x];
      if (t.kind === "watered") {
        t.age += 1;
        t.kind = t.age >= GROW_DAYS ? "grown" : "growing";
      } else if (t.kind === "growing" && t.watered) {
        t.age += 1;
        if (t.age >= GROW_DAYS) t.kind = "grown";
      }
      t.watered = false;
    }
  }
}

export function tickTime(state: GameState): boolean {
  state.time += TIME_TICK_MINUTES;
  if (state.time >= DAY_END_MINUTES) {
    sleep(state);
    return true;
  }
  return false;
}

export function formatTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${suffix}`;
}

export type TimePhase = "morning" | "evening" | "night";
export function getTimePhase(minutes: number): TimePhase {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 20 * 60) return "evening";
  return "night";
}

export type TileLayer = "ground" | "collision" | "interactable" | "decoration";
export function tileLayer(kind: TileKind): TileLayer {
  if (kind === "tree" || kind === "house" || kind === "water") return "collision";
  if (kind === "shop" || kind === "npc") return "interactable";
  if (kind === "path" || kind === "soil" || kind === "seeded" || kind === "watered" || kind === "growing" || kind === "grown") return "ground";
  return "decoration";
}

type TimeEvents = {
  on_time_tick: (state: GameState) => void;
  on_new_day: (state: GameState) => void;
  on_day_end: (state: GameState) => void;
};

export class TimeManager {
  current_day = 1;
  current_time_minutes = DAY_START_MINUTES;
  get is_daytime() {
    return this.current_time_minutes < 20 * 60;
  }
  get is_night() {
    return !this.is_daytime;
  }

  private listeners: { [K in keyof TimeEvents]: Set<TimeEvents[K]> } = {
    on_time_tick: new Set(),
    on_new_day: new Set(),
    on_day_end: new Set(),
  };

  subscribe<K extends keyof TimeEvents>(event: K, fn: TimeEvents[K]) {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  syncFrom(state: GameState) {
    this.current_day = state.day;
    this.current_time_minutes = state.time;
  }

  tick(state: GameState) {
    const ended = tickTime(state);
    this.syncFrom(state);
    this.listeners.on_time_tick.forEach((fn) => fn(state));
    if (ended) {
      this.listeners.on_day_end.forEach((fn) => fn(state));
      this.listeners.on_new_day.forEach((fn) => fn(state));
    }
    return ended;
  }
}

export const timeManager = new TimeManager();

/* ----------------------------- Rendering ----------------------------- */

const COLORS: Record<TileKind, string> = {
  grass: "#7ec77a",
  soil: "#8a5a3b",
  seeded: "#a07350",
  watered: "#6b4632",
  growing: "#6b4632",
  grown: "#6b4632",
  water: "#4aa3df",
  tree: "#3a8b3a",
  house: "#c08157",
  path: "#ceb48a",
  shop: "#c49a6c",
  npc: "#8f4cc9",
};

export function draw(ctx: CanvasRenderingContext2D, state: GameState) {
  const W = COLS * TILE;
  const H = ROWS * TILE;
  ctx.imageSmoothingEnabled = false;

  // Sky/grass base
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.tiles[y][x];
      const px = x * TILE;
      const py = y * TILE;

      // Subtle grass checker
      if (t.kind === "grass") {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#7ec77a" : "#74bf72";
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }

      ctx.fillStyle = COLORS[t.kind];
      ctx.fillRect(px, py, TILE, TILE);

      if (t.kind === "water") {
        ctx.fillStyle = "#7ac4ee";
        ctx.fillRect(px + 4, py + 6, 6, 3);
        ctx.fillRect(px + 16, py + 18, 8, 3);
      } else if (t.kind === "tree") {
        ctx.fillStyle = "#5b3a1f";
        ctx.fillRect(px + 13, py + 18, 6, 12);
        ctx.fillStyle = "#2e6b2e";
        ctx.beginPath();
        ctx.arc(px + 16, py + 14, 12, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.kind === "house") {
        // body
        ctx.fillStyle = "#c08157";
        ctx.fillRect(px, py, TILE, TILE);
        // roof line
        ctx.fillStyle = "#7a3e23";
        ctx.fillRect(px, py, TILE, 6);
      } else if (t.kind === "path") {
        ctx.fillStyle = "#ceb48a";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(160,120,80,0.2)";
        ctx.beginPath();
        ctx.arc(px + 10, py + 16, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.kind === "shop") {
        ctx.fillStyle = "#c49a6c";
        ctx.fillRect(px + 3, py + 5, TILE - 6, TILE - 10);
        ctx.fillStyle = "#7a3e23";
        ctx.fillRect(px + 3, py + 5, TILE - 6, 5);
      } else if (t.kind === "npc") {
        ctx.fillStyle = "#8f4cc9";
        ctx.fillRect(px + 8, py + 8, 16, 16);
        ctx.fillStyle = "#f4c79e";
        ctx.fillRect(px + 11, py + 4, 10, 8);
      } else if (t.kind === "soil") {
        ctx.fillStyle = "#7a4f33";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      } else if (t.kind === "seeded") {
        ctx.fillStyle = "#7a4f33";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "#d6c08a";
        ctx.fillRect(px + 14, py + 14, 4, 4);
      } else if (t.kind === "watered") {
        ctx.fillStyle = "#5a3a26";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "#9ad36b";
        ctx.fillRect(px + 14, py + 12, 4, 8);
      } else if (t.kind === "growing") {
        ctx.fillStyle = "#7a4f33";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "#7ac461";
        ctx.fillRect(px + 12, py + 8, 8, 14);
      } else if (t.kind === "grown") {
        ctx.fillStyle = "#7a4f33";
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "#3aaa3a";
        ctx.fillRect(px + 10, py + 6, 12, 18);
        ctx.fillStyle = "#f2c14e";
        ctx.fillRect(px + 12, py + 6, 8, 6);
      }
    }
  }

  // front tile highlight
  const f = frontTile(state);
  if (f) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x * TILE + 1, f.y * TILE + 1, TILE - 2, TILE - 2);
  }

  // Player
  const p = state.player;
  const px = p.x * TILE;
  const py = p.y * TILE;
  ctx.fillStyle = "#2c2c34";
  ctx.fillRect(px + 8, py + 6, 16, 18);
  ctx.fillStyle = "#f4c79e";
  ctx.fillRect(px + 10, py + 4, 12, 10);
  ctx.fillStyle = "#1d1d20";
  // direction marker (eyes)
  if (p.dir === "down") {
    ctx.fillRect(px + 12, py + 10, 2, 2);
    ctx.fillRect(px + 18, py + 10, 2, 2);
  } else if (p.dir === "up") {
    ctx.fillRect(px + 12, py + 7, 2, 2);
    ctx.fillRect(px + 18, py + 7, 2, 2);
  } else if (p.dir === "left") {
    ctx.fillRect(px + 11, py + 9, 2, 2);
  } else {
    ctx.fillRect(px + 19, py + 9, 2, 2);
  }
  ctx.fillStyle = "#3b8f3b";
  ctx.fillRect(px + 11, py + 2, 10, 4);

  const phase = getTimePhase(state.time);
  if (phase !== "morning") {
    ctx.fillStyle = phase === "evening" ? "rgba(255, 160, 90, 0.10)" : "rgba(30, 40, 90, 0.30)";
    ctx.fillRect(0, 0, W, H);
  }
}
