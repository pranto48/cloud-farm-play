import { ITEM_DEFS, createItem, type Item } from "./data/items";
import { shopInventoryForSeason, CROPS, type CropDef, type Season } from "./data/crops";
import { NPCS, getNPCDestination, type NPCDef } from "./npcs";
import { FISH_TYPES, type FishingState } from "./fishing";
import { gameAudio } from "./audio";

export const TILE = 32;
export const COLS = 80;
export const ROWS = 80;

export type TileKind =
  | "grass"
  | "soil"
  | "watered"
  | "water"
  | "tree"
  | "house"
  | "path"
  | "shop"
  | "npc"
  | "mine_cave"
  | "mine_dirt"
  | "mine_wall"
  | "mine_ladder"
  | "debris_weed"
  | "debris_branch"
  | "debris_stone"
  | "ore_copper"
  | "ore_iron"
  | "ore_gold"
  | "placed_item";

export interface Tile {
  kind: TileKind;
  /** Watered days for growing crops. */
  age: number;
  /** Is crop watered today. */
  watered: boolean;
  /** Crop ID currently growing, references CROPS. */
  cropId?: string;
  /** Placed item details. */
  placedItemId?: string;
  chestInventory?: (Item | null)[];
}

export type Tool = "hoe" | "watering_can" | "scythe" | "pickaxe" | "axe" | "sword" | "fishing_rod";

export interface Enemy {
  id: string;
  type: "green_slime" | "blue_slime" | "red_slime";
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  color: string;
  exp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  maxAge: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

export interface GameState {
  version: 1;
  player: {
    x: number;
    y: number;
    dir: "up" | "down" | "left" | "right";
    health: number;
    maxHealth: number;
  };
  day: number;
  time: number;
  inventory: (Item | null)[];
  hotbarIndex: number;
  coins: number;
  tiles: Tile[][];
  season: Season;
  weather: "sunny" | "rainy";
  energy: number;
  maxEnergy: number;
  skills: {
    farming: number;
    mining: number;
    combat: number;
    fishing: number;
  };
  experience: {
    farming: number;
    mining: number;
    combat: number;
    fishing: number;
  };
  mineDepth: number;
  inMine: boolean;
  mineGrid: Tile[][];
  mineEnemies: Enemy[];
  npcFriendships: Record<string, number>;
  shippingBin: (Item | null)[];
  fishing?: FishingState;
  dailyEarnings?: {
    items: { name: string; count: number; earnings: number; iconColor: string }[];
    total: number;
  };
  quest: {
    description: string;
    targetType: string;
    targetId: string;
    targetCount: number;
    currentCount: number;
    rewardCoins: number;
  } | null;
  upgrades: {
    hoe: number;
    watering: number;
    scythe: number;
    pickaxe: number;
  };
}

export const DAY_START_MINUTES = 6 * 60;
export const DAY_END_MINUTES = 24 * 60;
export const TIME_TICK_MINUTES = 10;
export const TIME_TICK_MS = 6000; // 6s per 10m

// Static points on the Farm map
export const STATIC_POINTS = {
  playerSpawn: { x: 16, y: 30 },
  shopInteract: { x: 70, y: 40 },
  bedSleep: { x: 16, y: 29 },
  shippingBin: { x: 18, y: 29 },
};

// Item utility functions
export function addItem(inventory: (Item | null)[], newItem: Item): boolean {
  // Try to stack first (if not tool/weapon/furniture)
  if (newItem.type !== "tool" && newItem.type !== "weapon" && newItem.type !== "furniture") {
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (item && item.id === newItem.id) {
        item.count += newItem.count;
        return true;
      }
    }
  }

  // Find empty slot
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] === null) {
      inventory[i] = { ...newItem };
      return true;
    }
  }

  return false;
}

export function removeItem(inventory: (Item | null)[], index: number, count = 1): void {
  const item = inventory[index];
  if (!item) return;

  if (item.count <= count) {
    inventory[index] = null;
  } else {
    item.count -= count;
  }
}

export function hasItems(inventory: (Item | null)[], itemId: string, count = 1): boolean {
  let found = 0;
  for (const item of inventory) {
    if (item && item.id === itemId) {
      found += item.count;
    }
  }
  return found >= count;
}

export function deductItems(inventory: (Item | null)[], itemId: string, count = 1): void {
  let remaining = count;
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (item && item.id === itemId) {
      if (item.count <= remaining) {
        remaining -= item.count;
        inventory[i] = null;
      } else {
        item.count -= remaining;
        remaining = 0;
      }
      if (remaining <= 0) break;
    }
  }
}

// Crafting System recipes
export interface Recipe {
  id: string;
  name: string;
  description: string;
  inputs: { itemId: string; count: number }[];
  outputId: string;
  outputCount: number;
}

export const CRAFTING_RECIPES: Recipe[] = [
  {
    id: "chest",
    name: "Wood Chest",
    description: "A wooden chest that stores up to 12 items.",
    inputs: [{ itemId: "wood", count: 40 }],
    outputId: "chest",
    outputCount: 1,
  },
  {
    id: "torch",
    name: "Torch",
    description: "Emits a warm light at night.",
    inputs: [
      { itemId: "wood", count: 2 },
      { itemId: "coal", count: 1 },
    ],
    outputId: "torch",
    outputCount: 3,
  },
  {
    id: "scarecrow",
    name: "Scarecrow",
    description: "Protects your crops from crows.",
    inputs: [
      { itemId: "wood", count: 15 },
      { itemId: "fiber", count: 30 },
    ],
    outputId: "scarecrow",
    outputCount: 1,
  },
  {
    id: "seed_maker",
    name: "Seed Maker",
    description: "Extracts seeds from crops.",
    inputs: [
      { itemId: "wood", count: 30 },
      { itemId: "copper_ore", count: 5 },
    ],
    outputId: "seed_maker",
    outputCount: 1,
  },
];

export function craftItem(recipe: Recipe, state: GameState): string {
  // Check inputs
  for (const input of recipe.inputs) {
    if (!hasItems(state.inventory, input.itemId, input.count)) {
      return `Need ${input.count}x ${input.itemId.replace("_", " ")}`;
    }
  }

  // Deduct inputs
  for (const input of recipe.inputs) {
    deductItems(state.inventory, input.itemId, input.count);
  }

  // Add output
  const output = createItem(recipe.outputId, recipe.outputCount);
  const success = addItem(state.inventory, output);

  if (!success) {
    // Inventory full, refund inputs
    for (const input of recipe.inputs) {
      addItem(state.inventory, createItem(input.itemId, input.count));
    }
    return "Inventory full!";
  }

  gameAudio.playCoin();
  return `Crafted ${recipe.name}!`;
}

// Procedural Farm generator (seeding weeds, stones, branches, farmhouses, caves)
function makeMap(): Tile[][] {
  const t: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind, age: -1, watered: false }))
  );

  // Farm zone starter plot (cleared grass, ready for tilling)
  for (let y = 32; y <= 42; y++) {
    for (let x = 8; x <= 22; x++) t[y][x].kind = "soil";
  }

  // Spawn house
  for (let y = 24; y <= 28; y++) {
    for (let x = 12; x <= 17; x++) t[y][x].kind = "house";
  }

  // Mine Cave entrance in the top right
  t[6][72].kind = "mine_cave";

  // Shop counter in the town zone (right side)
  for (let y = 32; y <= 40; y++) {
    for (let x = 64; x <= 74; x++) t[y][x].kind = "house";
  }
  t[40][70].kind = "shop";

  // NPC spawn zones near town
  for (let x = 67; x <= 72; x++) {
    t[41][x].kind = "path";
  }

  // Paths connecting locations
  for (let x = 16; x <= 70; x++) t[44][x].kind = "path";
  for (let y = 29; y <= 44; y++) t[y][16].kind = "path";
  for (let y = 40; y <= 44; y++) t[y][70].kind = "path";
  for (let y = 7; y <= 44; y++) t[y][72].kind = "path"; // Path to mine cave

  // South river / pond
  for (let y = 54; y <= 66; y++) {
    for (let x = 2; x <= 14; x++) {
      // make it rounded
      if (Math.abs(y - 60) + Math.abs(x - 8) < 10) {
        t[y][x].kind = "water";
      }
    }
  }

  // Seed scattered trees
  const trees: Array<[number, number]> = [
    [6, 12], [8, 10], [20, 18], [24, 22], [28, 40], [36, 38], [46, 18], [60, 44], [58, 12], [40, 52],
    [62, 24], [66, 26], [72, 50], [50, 64], [26, 58], [14, 48], [74, 16], [78, 30],
  ];
  trees.forEach(([x, y]) => {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && t[y][x].kind === "grass") {
      t[y][x].kind = "tree";
    }
  });

  // Seed overgrown debris (weeds, stones, branches) on the farm area
  for (let y = 25; y < 65; y++) {
    for (let x = 3; x < 35; x++) {
      if (t[y][x].kind === "grass" && Math.random() < 0.22) {
        const rand = Math.random();
        if (rand < 0.5) t[y][x].kind = "debris_weed";
        else if (rand < 0.78) t[y][x].kind = "debris_branch";
        else t[y][x].kind = "debris_stone";
      }
    }
  }

  return t;
}

// Procedural Mine Generator
export function generateMineFloor(depth: number): { grid: Tile[][]; enemies: Enemy[] } {
  const size = 24;
  const grid: Tile[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ kind: "mine_dirt", age: -1, watered: false }))
  );

  // Borders
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y === 0 || x === 0 || y === size - 1 || x === size - 1) {
        grid[y][x].kind = "mine_wall";
      }
    }
  }

  // Exit ladder (back to farm)
  grid[3][3].kind = "mine_ladder";

  // Distribute obstacles
  const rocksToHideLadder: { x: number; y: number }[] = [];
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (y === 3 && x === 3) continue; // spawn protection
      const rand = Math.random();
      if (rand < 0.25) {
        grid[y][x].kind = "debris_stone"; // normal breakable rock
        rocksToHideLadder.push({ x, y });
      } else if (rand < 0.28) {
        // Ore nodes based on depth
        if (depth >= 9 && Math.random() < 0.4) {
          grid[y][x].kind = "ore_gold";
        } else if (depth >= 4 && Math.random() < 0.5) {
          grid[y][x].kind = "ore_iron";
        } else {
          grid[y][x].kind = "ore_copper";
        }
      } else if (rand < 0.32) {
        grid[y][x].kind = "mine_wall"; // solid walls
      }
    }
  }

  // Hide the progression ladder under one random rock
  if (rocksToHideLadder.length > 0) {
    const choice = rocksToHideLadder[Math.floor(Math.random() * rocksToHideLadder.length)];
    // Store in metadata that this rock conceals a ladder!
    grid[choice.y][choice.x].age = 999; // sentinel value: breaking this spawns ladder
  }

  // Spawn Slimes
  const enemies: Enemy[] = [];
  const numEnemies = Math.floor(Math.random() * 3) + 2; // 2 to 4 enemies
  for (let i = 0; i < numEnemies; i++) {
    let ex = 0;
    let ey = 0;
    // Find walkable spot away from player spawn
    for (let attempt = 0; attempt < 50; attempt++) {
      ex = Math.floor(Math.random() * (size - 6)) + 5;
      ey = Math.floor(Math.random() * (size - 6)) + 5;
      if (grid[ey][ex].kind === "mine_dirt") break;
    }

    const type: "green_slime" | "blue_slime" | "red_slime" =
      depth >= 9 ? "red_slime" : depth >= 5 ? "blue_slime" : "green_slime";

    const hp = type === "red_slime" ? 85 : type === "blue_slime" ? 50 : 30;
    const damage = type === "red_slime" ? 18 : type === "blue_slime" ? 11 : 6;
    const color = type === "red_slime" ? "#e74c3c" : type === "blue_slime" ? "#3498db" : "#2ecc71";
    const name = type.replace("_", " ").toUpperCase();
    const exp = type === "red_slime" ? 15 : type === "blue_slime" ? 8 : 4;

    enemies.push({
      id: `slime_${depth}_${i}`,
      type,
      name,
      x: ex,
      y: ey,
      hp,
      maxHp: hp,
      damage,
      color,
      exp,
    });
  }

  return { grid, enemies };
}

export function newGame(): GameState {
  const inv = Array.from({ length: 24 }, () => null as Item | null);

  // Equip standard tools
  inv[0] = createItem("hoe");
  inv[1] = createItem("watering_can");
  inv[2] = createItem("scythe");
  inv[3] = createItem("pickaxe");
  inv[4] = createItem("axe");
  inv[5] = createItem("sword");
  inv[6] = createItem("parsnip_seed", 15); // Starter seeds

  return {
    version: 1,
    player: {
      x: STATIC_POINTS.playerSpawn.x,
      y: STATIC_POINTS.playerSpawn.y,
      dir: "down",
      health: 100,
      maxHealth: 100,
    },
    day: 1,
    time: DAY_START_MINUTES,
    inventory: inv,
    hotbarIndex: 0,
    coins: 100, // Starter cash
    tiles: makeMap(),
    season: "spring",
    weather: "sunny",
    energy: 270,
    maxEnergy: 270,
    skills: { farming: 0, mining: 0, combat: 0, fishing: 0 },
    experience: { farming: 0, mining: 0, combat: 0, fishing: 0 },
    mineDepth: 0,
    inMine: false,
    mineGrid: [],
    mineEnemies: [],
    npcFriendships: { robin: 0, haley: 0, lewis: 0 },
    shippingBin: Array.from({ length: 12 }, () => null),
    quest: {
      description: "Till soil, plant and harvest a Parsnip to sell at the shop.",
      targetType: "harvest",
      targetId: "parsnip",
      targetCount: 1,
      currentCount: 0,
      rewardCoins: 50,
    },
    upgrades: { hoe: 1, watering: 1, scythe: 1, pickaxe: 1 },
  };
}

export function isWalkable(t: Tile): boolean {
  if (!t) return false;
  return (
    t.kind !== "water" &&
    t.kind !== "tree" &&
    t.kind !== "house" &&
    t.kind !== "shop" &&
    t.kind !== "npc" &&
    t.kind !== "mine_wall" &&
    t.kind !== "debris_stone" &&
    t.kind !== "debris_branch" &&
    t.kind !== "ore_copper" &&
    t.kind !== "ore_iron" &&
    t.kind !== "ore_gold" &&
    t.kind !== "placed_item" // chest/furniture blocks movement
  );
}

export function frontTile(state: GameState): { x: number; y: number } | null {
  let { x, y } = state.player;
  if (state.player.dir === "up") y -= 1;
  if (state.player.dir === "down") y += 1;
  if (state.player.dir === "left") x -= 1;
  if (state.player.dir === "right") x += 1;

  const maxCols = state.inMine ? 24 : COLS;
  const maxRows = state.inMine ? 24 : ROWS;

  if (x < 0 || y < 0 || x >= maxCols || y >= maxRows) return null;
  return { x, y };
}

// Add experience points and handle level ups
export function addExperience(state: GameState, skill: keyof GameState["skills"], amount: number): string | null {
  state.experience[skill] += amount;
  const curLevel = state.skills[skill];
  // Basic level bracket formula: 100 * Level
  const targetXp = (curLevel + 1) * 100;

  if (state.experience[skill] >= targetXp) {
    state.skills[skill] += 1;
    // Level up effects
    if (skill === "farming") state.maxEnergy += 10;
    if (skill === "combat") state.player.maxHealth += 10;
    state.energy = state.maxEnergy;
    state.player.health = state.player.maxHealth;

    gameAudio.playLevelUp();
    return `Level Up! ${skill.toUpperCase()} is now Level ${state.skills[skill]}!`;
  }
  return null;
}

// Apply tool action to the front tile
export function interact(state: GameState): { message: string | null; particles: Particle[] } {
  const result: { message: string | null; particles: Particle[] } = { message: null, particles: [] };

  // Check exhausted speed penalty
  const isExhausted = state.energy <= 0;

  const f = frontTile(state);
  if (!f) return result;

  const grid = state.inMine ? state.mineGrid : state.tiles;
  const tile = grid[f.y][f.x];
  const px = f.x * TILE + TILE / 2;
  const py = f.y * TILE + TILE / 2;

  const heldItem = state.inventory[state.hotbarIndex];

  // Tool energy costs
  const toolEnergyCost = 2;

  // 1. Sword Combat swing
  if (heldItem && heldItem.id === "sword") {
    gameAudio.playSwing();
    if (isExhausted) {
      result.message = "Too tired to swing!";
      return result;
    }

    // Check hit against slimes
    if (state.inMine && state.mineEnemies.length > 0) {
      // Find enemies adjacent or facing
      const hitRadius = 1.6;
      for (const enemy of state.mineEnemies) {
        const dx = enemy.x - state.player.x;
        const dy = enemy.y - state.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= hitRadius) {
          gameAudio.playHit();
          const damage = heldItem.damage || 10;
          enemy.hp -= damage;

          // Hit particles
          for (let i = 0; i < 8; i++) {
            result.particles.push({
              x: enemy.x * TILE + 16,
              y: enemy.y * TILE + 16,
              vx: (Math.random() * 2 - 1) * 80,
              vy: (Math.random() * 2 - 1) * 80,
              color: enemy.color,
              age: 0,
              maxAge: 0.2,
            });
          }

          if (enemy.hp <= 0) {
            // Defeated!
            state.mineEnemies = state.mineEnemies.filter((e) => e.id !== enemy.id);
            // Drop coal or ores
            const lootRoll = Math.random();
            if (lootRoll < 0.25) {
              addItem(state.inventory, createItem("coal", 1));
            } else if (lootRoll < 0.45) {
              addItem(state.inventory, createItem("copper_ore", 1));
            }
            state.coins += 5;
            const lvlMsg = addExperience(state, "combat", enemy.exp);
            result.message = `Defeated ${enemy.name}! +5g` + (lvlMsg ? `. ${lvlMsg}` : "");
          } else {
            result.message = `Hit ${enemy.name} for ${damage} dmg!`;
          }
          return result;
        }
      }
    }
    return result;
  }

  // 2. Clear Debris / Farming Tools
  if (!heldItem) return result;

  switch (heldItem.id) {
    case "hoe":
      if (tile.kind === "grass") {
        if (state.energy < toolEnergyCost) {
          result.message = "No energy!";
          return result;
        }
        state.energy -= toolEnergyCost;
        tile.kind = "soil";
        gameAudio.playTill();

        // Tilling particles
        for (let i = 0; i < 5; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 30,
            vy: -Math.random() * 50 - 10,
            color: "#8a5a3b",
            age: 0,
            maxAge: 0.3,
          });
        }
        result.message = "Tilled soil";
      }
      break;

    case "watering_can":
      if (tile.kind === "soil" || tile.cropId) {
        if (state.energy < toolEnergyCost) {
          result.message = "No energy!";
          return result;
        }
        state.energy -= toolEnergyCost;
        tile.watered = true;
        if (tile.kind === "soil") tile.kind = "watered";
        gameAudio.playWater();

        // Water particles
        for (let i = 0; i < 8; i++) {
          result.particles.push({
            x: px + (Math.random() * 16 - 8),
            y: py - 4,
            vx: (Math.random() * 2 - 1) * 20,
            vy: Math.random() * 20 + 20,
            color: "#2980b9",
            age: 0,
            maxAge: 0.25,
          });
        }
        result.message = "Watered soil";
      }
      break;

    case "scythe":
      // Harvest mature crop
      if (tile.cropId && tile.age >= (CROPS[tile.cropId]?.growDays || 3)) {
        const cropId = tile.cropId;
        const cropDef = CROPS[cropId];
        gameAudio.playChop();

        const gathered = createItem(cropId, 1);
        const success = addItem(state.inventory, gathered);

        if (success) {
          tile.kind = "soil";
          tile.cropId = undefined;
          tile.age = -1;
          tile.watered = false;

          // Check Quest progress
          if (state.quest && state.quest.targetType === "harvest" && state.quest.targetId === cropId) {
            state.quest.currentCount += 1;
            if (state.quest.currentCount >= state.quest.targetCount) {
              state.coins += state.quest.rewardCoins;
              result.message = `Quest Complete! Harvested Parsnip. +${state.quest.rewardCoins}g`;
              state.quest = null;
            }
          }

          if (!result.message) {
            result.message = `Harvested ${cropDef.name}!`;
          }

          // Farming exp
          const lvlMsg = addExperience(state, "farming", 12);
          if (lvlMsg) result.message += ` ${lvlMsg}`;

          for (let i = 0; i < 6; i++) {
            result.particles.push({
              x: px,
              y: py,
              vx: (Math.random() * 2 - 1) * 40,
              vy: -Math.random() * 30 - 10,
              color: cropDef.accent,
              age: 0,
              maxAge: 0.35,
            });
          }
        } else {
          result.message = "Inventory full!";
        }
      }
      // Cut weeds
      else if (tile.kind === "debris_weed") {
        tile.kind = "grass";
        gameAudio.playChop();
        addItem(state.inventory, createItem("fiber", 1));

        for (let i = 0; i < 6; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 30,
            vy: -Math.random() * 30 - 10,
            color: "#27ae60",
            age: 0,
            maxAge: 0.25,
          });
        }
        result.message = "Cleared weeds. +1 fiber";
      }
      break;

    case "pickaxe":
      if (state.energy < toolEnergyCost) {
        result.message = "No energy!";
        return result;
      }
      // Break rocks
      if (tile.kind === "debris_stone") {
        state.energy -= toolEnergyCost;
        tile.kind = state.inMine ? "mine_dirt" : "grass";
        gameAudio.playMine();

        addItem(state.inventory, createItem("stone", 1));
        // Small chance for coal
        if (Math.random() < 0.15) {
          addItem(state.inventory, createItem("coal", 1));
        }

        const expGained = 4;
        const lvlMsg = addExperience(state, "mining", expGained);
        result.message = "Broke stone" + (lvlMsg ? `. ${lvlMsg}` : "");

        // Hidden progression ladder roll in mine
        if (state.inMine && tile.age === 999) {
          tile.kind = "mine_ladder";
          result.message = "Discovered a ladder leading down!";
        }

        // Stone particles
        for (let i = 0; i < 6; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 35,
            vy: -Math.random() * 40 - 10,
            color: "#7f8c8d",
            age: 0,
            maxAge: 0.3,
          });
        }
      }
      // Mine ores
      else if (tile.kind === "ore_copper" || tile.kind === "ore_iron" || tile.kind === "ore_gold") {
        state.energy -= toolEnergyCost;
        const oreMap = {
          ore_copper: { item: "copper_ore", xp: 8, color: "#d35400" },
          ore_iron: { item: "iron_ore", xp: 15, color: "#95a5a6" },
          ore_gold: { item: "gold_ore", xp: 30, color: "#f1c40f" },
        };
        const config = oreMap[tile.kind as keyof typeof oreMap];
        tile.kind = "mine_dirt";
        gameAudio.playMine();

        addItem(state.inventory, createItem(config.item, Math.floor(Math.random() * 2) + 1));
        const lvlMsg = addExperience(state, "mining", config.xp);
        result.message = `Mined ${config.item.replace("_", " ")}` + (lvlMsg ? `. ${lvlMsg}` : "");

        for (let i = 0; i < 10; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 40,
            vy: -Math.random() * 45 - 10,
            color: config.color,
            age: 0,
            maxAge: 0.3,
          });
        }
      }
      // Remove placed item (chest, torch, scarecrow)
      else if (tile.kind === "placed_item" && tile.placedItemId) {
        state.energy -= toolEnergyCost;
        const itemObj = createItem(tile.placedItemId, 1);

        // If chest, return items to inventory or drop them on floor
        if (tile.placedItemId === "chest" && tile.chestInventory) {
          // Put all items in chest back to player inventory
          for (const item of tile.chestInventory) {
            if (item) addItem(state.inventory, item);
          }
        }

        tile.kind = "grass";
        tile.placedItemId = undefined;
        tile.chestInventory = undefined;
        addItem(state.inventory, itemObj);
        result.message = `Picked up placed item`;
      }
      break;

    case "axe":
      if (state.energy < toolEnergyCost) {
        result.message = "No energy!";
        return result;
      }
      // Chop trees
      if (tile.kind === "tree") {
        state.energy -= toolEnergyCost;
        tile.kind = "grass";
        gameAudio.playChop();

        addItem(state.inventory, createItem("wood", Math.floor(Math.random() * 4) + 3));
        const lvlMsg = addExperience(state, "farming", 8); // farming/foraging
        result.message = "Chopped down tree" + (lvlMsg ? `. ${lvlMsg}` : "");

        for (let i = 0; i < 10; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 35,
            vy: -Math.random() * 50 - 15,
            color: "#27ae60",
            age: 0,
            maxAge: 0.35,
          });
        }
      }
      // Clear logs
      else if (tile.kind === "debris_branch") {
        state.energy -= toolEnergyCost;
        tile.kind = "grass";
        gameAudio.playChop();
        addItem(state.inventory, createItem("wood", 2));
        result.message = "Cleared branch. +2 wood";

        for (let i = 0; i < 6; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 30,
            vy: -Math.random() * 30 - 10,
            color: "#8e6345",
            age: 0,
            maxAge: 0.25,
          });
        }
      }
      break;
  }

  // 3. Plant Seeds / Place Furniture
  if (heldItem && heldItem.type === "seed" && tile.kind === "soil") {
    // Determine crop type from seed ID
    const cropId = heldItem.id.replace("_seed", "");
    if (CROPS[cropId]) {
      tile.kind = "placed_item"; // or keeps soil background visually
      tile.cropId = cropId;
      tile.age = 0;
      tile.watered = false;

      removeItem(state.inventory, state.hotbarIndex, 1);
      gameAudio.playWater();
      result.message = `Planted ${CROPS[cropId].name}`;
    }
  } else if (heldItem && heldItem.type === "furniture") {
    // Place item (Chests, Torches, Scarecrows)
    if (tile.kind === "grass" || tile.kind === "mine_dirt" || tile.kind === "soil") {
      tile.kind = "placed_item";
      tile.placedItemId = heldItem.id;
      if (heldItem.id === "chest") {
        tile.chestInventory = Array.from({ length: 12 }, () => null);
      }
      removeItem(state.inventory, state.hotbarIndex, 1);
      gameAudio.playTill();
      result.message = `Placed ${heldItem.name}`;
    }
  }

  return result;
}

// Talk to shopkeeper
export function talkToShopkeeper(state: GameState): string {
  const lines = [
    `Welcome! It is day ${state.day} of ${state.season}.`,
    state.weather === "rainy" ? "Nice rain today, saves me watering my own flower patch." : "Great day for some local farming.",
    state.coins < 20 ? "Sell me your crops in town and you'll make a tidy sum." : "Let me know what seeds you need.",
  ];
  return lines.join(" ");
}

// Sell items overnight at shipping bin
export function shipItem(state: GameState, slotIndex: number): string | null {
  const item = state.inventory[slotIndex];
  if (!item) return null;

  if (item.price <= 0) {
    return "Cannot sell this item!";
  }

  // Add to shipping bin
  const success = addItem(state.shippingBin, item);
  if (success) {
    state.inventory[slotIndex] = null;
    return `Shipped ${item.name} (${item.price * item.count}g)`;
  }
  return "Shipping bin full!";
}

// End of Day (Sleep & Shipping Summary calc)
export function sleep(state: GameState): void {
  // 1. Calculate shipping bin profits
  const earningsList: { name: string; count: number; earnings: number; iconColor: string }[] = [];
  let totalEarnings = 0;

  for (const item of state.shippingBin) {
    if (item) {
      const value = item.price * item.count;
      totalEarnings += value;
      // Aggregate by item name
      const existing = earningsList.find((e) => e.name === item.name);
      if (existing) {
        existing.count += item.count;
        existing.earnings += value;
      } else {
        earningsList.push({
          name: item.name,
          count: item.count,
          earnings: value,
          iconColor: item.iconColor,
        });
      }
    }
  }

  state.coins += totalEarnings;
  // Clear shipping bin
  state.shippingBin = Array.from({ length: 12 }, () => null);

  // Set earnings for visual summary overlay
  state.dailyEarnings = {
    items: earningsList,
    total: totalEarnings,
  };

  // 2. Advance Days & grow crops
  state.day += 1;
  state.time = DAY_START_MINUTES;

  // Refill Energy and Health
  state.energy = state.maxEnergy;
  state.player.health = state.player.maxHealth;

  // Loop through all tiles to grow watered crops, clear water states
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.tiles[y][x];

      // Clean overnight weeds spreading occasionally
      if (t.kind === "grass" && Math.random() < 0.005) {
        t.kind = "debris_weed";
      }

      // Dry out soil if unwatered
      if (t.kind === "watered") {
        t.kind = "soil";
      }

      if (t.cropId) {
        const cropDef = CROPS[t.cropId];
        // If watered, it grows
        if (t.watered || state.weather === "rainy") {
          t.age += 1;
        }
        t.watered = false;
      }
    }
  }

  // 3. Roll weather for tomorrow (20% rainy, 80% sunny)
  state.weather = Math.random() < 0.2 ? "rainy" : "sunny";

  gameAudio.playSleep();
}

// Tick time forward
export function tickTime(state: GameState): boolean {
  state.time += TIME_TICK_MINUTES;
  if (state.time >= DAY_END_MINUTES) {
    sleep(state);
    return true; // Day ended
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

export function getTimePhase(minutes: number): "morning" | "evening" | "night" {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "evening";
  return "night";
}

// ----------------------------- RENDER ENGINE -----------------------------
export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewWidth: number,
  viewHeight: number
) {
  ctx.imageSmoothingEnabled = false;

  const currentGrid = state.inMine ? state.mineGrid : state.tiles;
  const gridRows = currentGrid.length;
  const gridCols = currentGrid[0]?.length || 0;

  // Viewport camera calculation (center on player)
  const p = state.player;
  const playerPx = p.x * TILE + TILE / 2;
  const playerPy = p.y * TILE + TILE / 2;

  // Camera limits to keep inside borders
  const cameraX = Math.max(
    0,
    Math.min(gridCols * TILE - viewWidth, playerPx - viewWidth / 2)
  );
  const cameraY = Math.max(
    0,
    Math.min(gridRows * TILE - viewHeight, playerPy - viewHeight / 2)
  );

  ctx.fillStyle = state.inMine ? "#2c3e50" : "#7ec77a"; // Dirt vs Grass base
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // Translate by camera offset
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // Visible column & row indices to draw only what is seen (Performance optimization)
  const startCol = Math.max(0, Math.floor(cameraX / TILE));
  const endCol = Math.min(gridCols, Math.ceil((cameraX + viewWidth) / TILE));
  const startRow = Math.max(0, Math.floor(cameraY / TILE));
  const endRow = Math.min(gridRows, Math.ceil((cameraY + viewHeight) / TILE));

  // 1. Draw Ground / Obstacle Layers
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      // Base textures
      if (t.kind === "grass") {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#7ec77a" : "#75be71";
        ctx.fillRect(px, py, TILE, TILE);

        // draw cute weeds blades
        ctx.fillStyle = "#8ed48a";
        if ((x * 7 + y * 13) % 5 === 0) {
          ctx.fillRect(px + 4, py + 8, 2, 4);
          ctx.fillRect(px + 12, py + 16, 2, 3);
        }
      } else if (t.kind === "mine_dirt") {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#4a3c31" : "#43362c";
        ctx.fillRect(px, py, TILE, TILE);
      } else if (t.kind === "mine_wall") {
        ctx.fillStyle = "#2c231a";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#1e1812";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (t.kind === "mine_ladder") {
        ctx.fillStyle = "#43362c";
        ctx.fillRect(px, py, TILE, TILE);
        // Draw ladder rungs
        ctx.fillStyle = "#b58452";
        ctx.fillRect(px + 6, py + 2, 4, TILE - 4);
        ctx.fillRect(px + 22, py + 2, 4, TILE - 4);
        for (let i = 4; i < TILE - 4; i += 6) {
          ctx.fillRect(px + 6, py + i, 20, 2);
        }
      } else if (t.kind === "path") {
        ctx.fillStyle = "#ceb48a";
        ctx.fillRect(px, py, TILE, TILE);
      } else if (t.kind === "water") {
        const bounce = Math.sin(Date.now() / 320 + x * 0.5) * 2;
        ctx.fillStyle = "#4aa3df";
        ctx.fillRect(px, py, TILE, TILE);
        // Wave details
        ctx.fillStyle = "#7bc0eb";
        ctx.fillRect(px + 4, py + 8 + bounce, 8, 2);
        ctx.fillRect(px + 18, py + 20 - bounce, 8, 2);
      } else if (t.kind === "soil") {
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (t.kind === "watered") {
        ctx.fillStyle = "#4a3120"; // Dark wet soil
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        // sheen shine
        ctx.fillStyle = "#634734";
        ctx.fillRect(px + 4, py + 4, 3, 2);
      } else if (t.kind === "house") {
        ctx.fillStyle = "#c08157";
        ctx.fillRect(px, py, TILE, TILE);
        // Roof
        ctx.fillStyle = "#7a3e23";
        ctx.fillRect(px, py, TILE, 8);
      } else if (t.kind === "shop") {
        ctx.fillStyle = "#965d34";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#f5d0a9";
        ctx.fillRect(px + 6, py + 12, TILE - 12, 12); // counter
      } else if (t.kind === "mine_cave") {
        ctx.fillStyle = "#7ec77a";
        ctx.fillRect(px, py, TILE, TILE);
        // Cave archway
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(px + 4, py + 8, TILE - 8, TILE - 8);
        ctx.fillStyle = "#111";
        ctx.fillRect(px + 8, py + 14, TILE - 16, TILE - 14);
      }

      // Draw debris details (weed sprigs, branches, grey stones)
      if (t.kind === "debris_weed") {
        // weed blades
        ctx.fillStyle = "#27ae60";
        ctx.beginPath();
        ctx.arc(px + 10, py + 22, 6, 0, Math.PI, true);
        ctx.arc(px + 22, py + 25, 7, 0, Math.PI, true);
        ctx.fill();
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(px + 14, py + 10, 4, 8);
      } else if (t.kind === "debris_branch") {
        // wood branch
        ctx.fillStyle = "#8e6345";
        ctx.fillRect(px + 8, py + 18, 16, 4);
        ctx.fillRect(px + 18, py + 12, 4, 8);
        // bud
        ctx.fillStyle = "#27ae60";
        ctx.fillRect(px + 22, py + 10, 3, 3);
      } else if (t.kind === "debris_stone" || t.kind === "ore_copper" || t.kind === "ore_iron" || t.kind === "ore_gold") {
        // rock shapes
        ctx.fillStyle = t.kind === "debris_stone" ? "#7f8c8d" : "#5d6d7e";
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 26);
        ctx.lineTo(px + 16, py + 8);
        ctx.lineTo(px + 24, py + 26);
        ctx.fill();

        // Ores draw bright embedded gems
        if (t.kind === "ore_copper") {
          ctx.fillStyle = "#d35400";
          ctx.fillRect(px + 14, py + 14, 4, 4);
        } else if (t.kind === "ore_iron") {
          ctx.fillStyle = "#bdc3c7";
          ctx.fillRect(px + 14, py + 14, 4, 4);
        } else if (t.kind === "ore_gold") {
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(px + 14, py + 12, 4, 5);
        }
      }

      // Draw placed items (chests, torches, scarecrows)
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        if (id === "chest") {
          ctx.fillStyle = "#7c5a3c";
          ctx.fillRect(px + 6, py + 10, TILE - 12, TILE - 14);
          ctx.fillStyle = "#d4ac0d"; // gold lock
          ctx.fillRect(px + 14, py + 18, 4, 3);
        } else if (id === "torch") {
          ctx.fillStyle = "#8e6345"; // wooden post
          ctx.fillRect(px + 15, py + 14, 2, 14);
          // fire flicker
          const size = 5 + Math.sin(Date.now() / 80) * 2.5;
          ctx.fillStyle = "#e67e22";
          ctx.beginPath();
          ctx.arc(px + 16, py + 10, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f1c40f";
          ctx.beginPath();
          ctx.arc(px + 16, py + 10, size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "scarecrow") {
          // straw shirt
          ctx.fillStyle = "#f39c12";
          ctx.fillRect(px + 8, py + 12, 16, 12);
          // hat
          ctx.fillStyle = "#d35400";
          ctx.fillRect(px + 4, py + 8, 24, 4);
          ctx.fillRect(px + 10, py + 2, 12, 6);
          // post
          ctx.fillStyle = "#7c5a3c";
          ctx.fillRect(px + 15, py + 24, 2, 8);
        } else if (id === "seed_maker") {
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 6, py + 8, TILE - 12, TILE - 12);
          // gear logo
          ctx.fillStyle = "#95a5a6";
          ctx.beginPath();
          ctx.arc(px + 16, py + 18, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Draw Growing Crops Layer
      if (t.cropId) {
        const def = CROPS[t.cropId];
        const days = def.growDays;
        const currentAge = t.age;
        const isMature = currentAge >= days;

        const cropPx = px + TILE / 2;
        const cropPy = py + TILE - 6;

        ctx.fillStyle = t.watered || state.weather === "rainy" ? "#4a3120" : "#8a5a3b";
        ctx.fillRect(px + 4, py + TILE - 8, TILE - 8, 6); // ground pot

        if (currentAge === 0) {
          // Seed dot
          ctx.fillStyle = "#d2b48c";
          ctx.fillRect(cropPx - 2, cropPy - 2, 4, 3);
        } else if (!isMature) {
          // Sprouting / growing leaves
          const progress = currentAge / days;
          const size = Math.floor(progress * 12) + 4;
          ctx.fillStyle = def.stem;
          // draw leaves
          ctx.fillRect(cropPx - 3, cropPy - size, 6, size);
          ctx.fillRect(cropPx - 6, cropPy - size + 2, 3, 3);
          ctx.fillRect(cropPx + 3, cropPy - size + 2, 3, 3);
        } else {
          // Mature Ripe crop
          ctx.fillStyle = def.stem;
          ctx.fillRect(cropPx - 4, cropPy - 14, 8, 14); // stem
          // Fruit accent color
          ctx.fillStyle = def.accent;
          ctx.beginPath();
          ctx.arc(cropPx, cropPy - 14, 6, 0, Math.PI * 2);
          ctx.fill();
          // Glow or details on fruit
          ctx.fillStyle = "#fff";
          ctx.fillRect(cropPx - 2, cropPy - 16, 2, 2);
        }
      }
    }
  }

  // 3. Draw NPCs
  if (!state.inMine) {
    Object.keys(NPCS).forEach((id) => {
      const npc = NPCS[id];
      // Fetch scheduled target for current time
      const target = getNPCDestination(id, state.time);
      // For this cozy implementation, NPCs teleport or stand directly at schedules
      const nx = target.x * TILE;
      const ny = target.y * TILE;

      // Draw NPC body
      ctx.fillStyle = npc.color;
      ctx.fillRect(nx + 8, ny + 8, 16, 16); // body
      // Head
      ctx.fillStyle = "#f5d0a9";
      ctx.fillRect(nx + 10, ny + 2, 12, 8);
      // Hair/Hat
      ctx.fillStyle = npc.portraitColor;
      ctx.fillRect(nx + 9, ny, 14, 4);

      // Name indicator
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(nx - 6, ny - 14, TILE + 12, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(npc.name, nx + TILE / 2, ny - 5);
    });
  }

  // 4. Draw Mine Enemies (Slimes)
  if (state.inMine) {
    state.mineEnemies.forEach((slime) => {
      const sx = slime.x * TILE;
      const sy = slime.y * TILE;

      // Hops/Squish effect
      const squishX = 1 + Math.sin(Date.now() / 150) * 0.15;
      const squishY = 1 - Math.sin(Date.now() / 150) * 0.15;

      ctx.save();
      ctx.translate(sx + 16, sy + 24);
      ctx.scale(squishX, squishY);

      // Slime body
      ctx.fillStyle = slime.color;
      ctx.beginPath();
      ctx.arc(0, -6, 10, 0, Math.PI * 2);
      ctx.fill();

      // Slime face eyes
      ctx.fillStyle = "#000";
      ctx.fillRect(-5, -9, 2, 2);
      ctx.fillRect(3, -9, 2, 2);

      ctx.restore();

      // Slime health bar (if damaged)
      if (slime.hp < slime.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(sx + 4, sy - 8, 24, 4);
        const percent = slime.hp / slime.maxHp;
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(sx + 4, sy - 8, 24 * percent, 4);
      }
    });
  }

  // 5. Draw Player
  const px = p.x * TILE;
  const py = p.y * TILE;
  // Bobbing walk height
  const walkBob = Math.sin(Date.now() / 100) * 1.5;

  ctx.fillStyle = "#2c3e50"; // Pants
  ctx.fillRect(px + 9, py + 18, 14, 8);
  ctx.fillStyle = "#e74c3c"; // Shirt
  ctx.fillRect(px + 8, py + 8 + walkBob, 16, 11);
  ctx.fillStyle = "#f5d0a9"; // Face
  ctx.fillRect(px + 10, py + 2 + walkBob, 12, 8);
  ctx.fillStyle = "#8a5a3b"; // Hair
  ctx.fillRect(px + 9, py + walkBob, 14, 3);

  // Direction face (eyes)
  ctx.fillStyle = "#000";
  if (p.dir === "down") {
    ctx.fillRect(px + 12, py + 6 + walkBob, 2, 2);
    ctx.fillRect(px + 18, py + 6 + walkBob, 2, 2);
  } else if (p.dir === "up") {
    // draw back of head hair
    ctx.fillStyle = "#8a5a3b";
    ctx.fillRect(px + 10, py + 2 + walkBob, 12, 6);
  } else if (p.dir === "left") {
    ctx.fillRect(px + 11, py + 6 + walkBob, 2, 2);
  } else if (p.dir === "right") {
    ctx.fillRect(px + 19, py + 6 + walkBob, 2, 2);
  }

  // Draw active tool/weapon swipe animation if user was acting
  // Rendered as brief overlays in front of player
  const f = frontTile(state);
  if (f) {
    // Draw target tile outline highlighter
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x * TILE + 2, f.y * TILE + 2, TILE - 4, TILE - 4);

    // If using sword, draw swipe arc
    const held = state.inventory[state.hotbarIndex];
    if (held && held.id === "sword" && Math.sin(Date.now() / 60) > 0.6) {
      ctx.strokeStyle = "rgba(236, 240, 241, 0.75)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        px + TILE / 2 + (f.x - p.x) * 18,
        py + TILE / 2 + (f.y - p.y) * 18,
        14,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  // 6. Draw Fishing Bobber & Line
  if (state.fishing && !state.inMine) {
    const fState = state.fishing;
    if (fState.status === "waiting" || fState.status === "nibble" || fState.status === "reeling") {
      // Draw bobber
      const bx = fState.bobberX * TILE + 16;
      const by = fState.bobberY * TILE + 16;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 12);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Bobber floats
      const bBob = Math.sin(Date.now() / 200) * 2;
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(bx - 3, by - 3 + bBob, 6, 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx - 3, by - 3 + bBob, 6, 2);

      // Nibble indicator bubble
      if (fState.status === "nibble") {
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", bx, by - 12 + bBob);
      }
    }
  }

  ctx.restore(); // Exit camera translate

  // 7. Night Overlay Lighting Engine
  const phase = getTimePhase(state.time);
  if (phase !== "morning") {
    // Night color overlay (70% opacity at night, 30% evening)
    const darkness = phase === "night" ? 0.7 : 0.25;

    // Create night lighting overlay using offscreen rendering logic or destination-out masking
    // To make it run natively on canvas without lag:
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = viewWidth;
    tempCanvas.height = viewHeight;
    const tCtx = tempCanvas.getContext("2d");

    if (tCtx) {
      // Fill with dark blue night color
      tCtx.fillStyle = phase === "night" ? "rgba(10, 15, 40, 0.72)" : "rgba(230, 126, 34, 0.28)";
      tCtx.fillRect(0, 0, viewWidth, viewHeight);

      // Draw light cones (destination-out blend to create clear masks)
      tCtx.globalCompositeOperation = "destination-out";

      // A: Player glow
      const plViewX = playerPx - cameraX;
      const plViewY = playerPy - cameraY;
      const rad = phase === "night" ? 75 : 120;
      const gradPl = tCtx.createRadialGradient(plViewX, plViewY, 10, plViewX, plViewY, rad);
      gradPl.addColorStop(0, "rgba(0,0,0,1)");
      gradPl.addColorStop(1, "rgba(0,0,0,0)");
      tCtx.fillStyle = gradPl;
      tCtx.beginPath();
      tCtx.arc(plViewX, plViewY, rad, 0, Math.PI * 2);
      tCtx.fill();

      // B: Placed Torches glow
      for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
          const t = currentGrid[y][x];
          if (t.kind === "placed_item" && t.placedItemId === "torch") {
            const torchViewX = x * TILE + 16 - cameraX;
            const torchViewY = y * TILE + 10 - cameraY;
            const torchRad = 90 + Math.sin(Date.now() / 60) * 4; // flickering light!
            const gradT = tCtx.createRadialGradient(
              torchViewX,
              torchViewY,
              5,
              torchViewX,
              torchViewY,
              torchRad
            );
            gradT.addColorStop(0, "rgba(0,0,0,1)");
            gradT.addColorStop(1, "rgba(0,0,0,0)");
            tCtx.fillStyle = gradT;
            tCtx.beginPath();
            tCtx.arc(torchViewX, torchViewY, torchRad, 0, Math.PI * 2);
            tCtx.fill();
          }
        }
      }

      // Draw the final lit screen overlay onto main canvas
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
}
