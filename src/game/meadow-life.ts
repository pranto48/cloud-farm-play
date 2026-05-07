/**
 * Meadow Life — original cozy farming demo for CloudFarm Arcade.
 * No external assets, no copyrighted content. Pure canvas drawing.
 */

export const TILE = 32;
export const COLS = 20;
export const ROWS = 14;

export type TileKind =
  | "grass"
  | "soil"
  | "seeded"
  | "watered"
  | "growing"
  | "grown"
  | "water"
  | "tree"
  | "house";

export type Tile = {
  kind: TileKind;
  /** Days since the crop was planted; -1 if not a crop. */
  age: number;
  /** Whether the crop was watered today. */
  watered: boolean;
};

export type Tool = "hoe" | "seed" | "water" | "scythe";

export type GameState = {
  version: 1;
  player: { x: number; y: number; dir: "up" | "down" | "left" | "right" };
  day: number;
  time: number;
  energy: number;
  inventory: { seeds: number; crops: number; coins: number };
  tool: Tool;
  tiles: Tile[][];
};

export const SEED_PRICE = 8;
export const CROP_PRICE = 14;
export const GROW_DAYS = 3;

function makeMap(): Tile[][] {
  const t: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind, age: -1, watered: false })),
  );
  // Pond on the left
  for (let y = 8; y < 12; y++) for (let x = 1; x < 4; x++) t[y][x].kind = "water";
  // Trees scattered
  const trees: Array<[number, number]> = [
    [5, 1], [10, 1], [15, 2], [18, 3], [2, 4], [17, 8], [4, 12], [13, 12],
  ];
  trees.forEach(([x, y]) => (t[y][x].kind = "tree"));
  // House top-right (2x2)
  t[1][16].kind = "house";
  t[1][17].kind = "house";
  t[2][16].kind = "house";
  t[2][17].kind = "house";
  return t;
}

export function newGame(): GameState {
  return {
    version: 1,
    player: { x: 9, y: 7, dir: "down" },
    day: 1,
    time: 360, // 6:00
    energy: 100,
    inventory: { seeds: 5, crops: 0, coins: 30 },
    tool: "hoe",
    tiles: makeMap(),
  };
}

export function isWalkable(t: Tile): boolean {
  return t.kind !== "water" && t.kind !== "tree" && t.kind !== "house";
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
  if (state.energy <= 0) return "Too tired. Sleep to recover energy.";
  const f = frontTile(state);
  if (!f) return null;
  const tile = state.tiles[f.y][f.x];

  switch (state.tool) {
    case "hoe":
      if (tile.kind === "grass") {
        tile.kind = "soil";
        state.energy = Math.max(0, state.energy - 3);
        passTime(state, 7);
        return "Tilled soil";
      }
      return null;
    case "seed":
      if (tile.kind === "soil" && state.inventory.seeds > 0) {
        tile.kind = "seeded";
        tile.age = 0;
        tile.watered = false;
        state.inventory.seeds -= 1;
        state.energy = Math.max(0, state.energy - 1);
        passTime(state, 5);
        return "Planted a seed";
      }
      return null;
    case "water":
      if (tile.kind === "seeded" || tile.kind === "growing") {
        if (!tile.watered) {
          tile.watered = true;
          if (tile.kind === "seeded") tile.kind = "watered";
          state.energy = Math.max(0, state.energy - 2);
          passTime(state, 6);
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
        state.energy = Math.max(0, state.energy - 2);
        passTime(state, 6);
        return "Harvested! +1 crop";
      }
      return null;
  }
  return null;
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

/** End the day: advance growth on watered crops, reset watered flags. */
export function sleep(state: GameState): void {
  state.day += 1;
  state.time = 360;
  state.energy = 100;
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

export function passTime(state: GameState, minutes: number) {
  state.time = Math.min(1320, state.time + minutes); // 22:00 cap
}

export function formatTime(minutes: number) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

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
}
