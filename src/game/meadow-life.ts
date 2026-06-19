import { ITEM_DEFS, createItem, type Item } from "./data/items";
import { shopInventoryForSeason, CROPS, type CropDef, type Season } from "./data/crops";
import { NPCS, getNPCDestination, type NPCDef } from "./npcs";
import { FISH_TYPES, type FishingState } from "./fishing";
import { gameAudio } from "./audio";

export const TILE = 32;
export const COLS = 120;
export const ROWS = 120;

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
  | "ore_uranium"
  | "house_wall"
  | "house_floor"
  | "house_bed"
  | "house_door"
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
  hitPoints?: number;
  lastHitTime?: number;
  lastRustleTime?: number;
  smeltTimer?: number;
  smeltMaxTime?: number;
  smeltOutputId?: string;
  smeltActive?: boolean;
}

export type Tool = "hoe" | "watering_can" | "scythe" | "pickaxe" | "axe" | "sword" | "fishing_rod" | "milk_pail";

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
  type?: "leaf" | "stone" | "water" | "smoke" | "heart" | "dust";
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

export interface Animal {
  id: string;
  type: "chick" | "calf";
  name: string;
  x: number;
  y: number;
  subX: number; // smooth interpolation coords
  subY: number;
  age: number; // in days
  petCount: number;
  hasProduce: boolean;
  walkTimer: number; // seconds until next move
}

export interface MailLetter {
  id: string;
  sender: string;
  content: string;
  giftItemId?: string;
  giftCount?: number;
  claimed: boolean;
}

export interface Pet {
  id: string;
  type: "cat" | "dog";
  name: string;
  x: number;
  y: number;
  subX: number;
  subY: number;
  friendship: number; // 0 - 1000
  pettedToday: boolean;
  bowlX: number;
  bowlY: number;
  walkTimer: number;
}

export interface FarmWorker {
  id: string;
  name: string;
  cabinX: number;
  cabinY: number;
  x: number;
  y: number;
  subX: number;
  subY: number;
  task: "idle" | "water" | "harvest" | "clear" | "auto";
  role: "farming" | "woodcutting" | "water" | "mining" | "idle";
  inventory: import("./data/items").Item | null;
  energy: number; // 0 - 100
  hasEatenToday: boolean;
  walkTimer: number;
  actionTimer: number;
  statusText: string;
  workStartHour?: number;
  workEndHour?: number;
}

export interface GameState {
  version: 1;
  player: {
    x: number;
    y: number;
    subX?: number;
    subY?: number;
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
    axe: number;
  };
  // Overhaul states
  animals: Animal[];
  mailboxLetters: MailLetter[];
  hasUnreadMail: boolean;
  harvestLiftingTimer: number; // freeze remaining duration
  carryItem: Item | null; // visually drawn above head
  pets?: Pet[];
  workers?: FarmWorker[];
  inHouse?: boolean;
  houseGrid?: Tile[][];
  // Extended features
  godMode?: boolean;
  unlockedTechs?: string[];
  researchPoints?: number;
  activeResearchId?: string;
  researchProgress?: number;
  workerAssignments?: Record<string, string>; // workerId -> 'research_center' | 'farm'
  purchasedLands?: string[]; // IDs of purchased land parcels
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
  mailbox: { x: 19, y: 29 },
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

// Land Parcels System
export interface LandParcel {
  id: string;
  name: string;
  type: "farming" | "forest" | "water" | "mining";
  description: string;
  cost: number;
  x: number;
  y: number;
  width: number;
  height: number;
  icon: string;
}

export const LAND_PARCELS: LandParcel[] = [
  { id: "land_farming", name: "Farming Plot", type: "farming", description: "A 20x15 patch of tillable soil.", cost: 2000, x: 26, y: 32, width: 20, height: 15, icon: "🌾" },
  { id: "land_forest", name: "Forest Area", type: "forest", description: "Dense tree zone that auto-grows wood.", cost: 3500, x: 5, y: 70, width: 20, height: 20, icon: "🌲" },
  { id: "land_water", name: "Water Area", type: "water", description: "A large fishing pond expansion.", cost: 4000, x: 40, y: 70, width: 25, height: 15, icon: "🐟" },
  { id: "land_mining", name: "Mining Zone", type: "mining", description: "A surface mining zone with ore deposits.", cost: 5000, x: 80, y: 10, width: 15, height: 20, icon: "⛏️" },
];

// Technology research system
export interface TechDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number; // research points required
  prerequisites: string[];
  unlocks: string; // description of what unlocks
}

export const TECHNOLOGIES: TechDef[] = [
  {
    id: "tech_advanced_tools",
    name: "Advanced Tools",
    description: "Upgrade hoe, pickaxe, and axe efficiency by 50%.",
    icon: "⚙️",
    cost: 100,
    prerequisites: [],
    unlocks: "Tool upgrade multiplier +50%",
  },
  {
    id: "tech_auto_irrigation",
    name: "Auto Irrigation",
    description: "Unlock Quality Sprinkler crafting recipe and reduce watering energy by 30%.",
    icon: "💧",
    cost: 150,
    prerequisites: [],
    unlocks: "Quality Sprinkler recipe + 30% watering energy discount",
  },
  {
    id: "tech_precision_mining",
    name: "Precision Mining",
    description: "Pickaxe yields +1 extra ore and unlocks Uranium mine floors.",
    icon: "⛏️",
    cost: 200,
    prerequisites: ["tech_advanced_tools"],
    unlocks: "Mining yield +1, Uranium mine floors",
  },
  {
    id: "tech_speed_smelting",
    name: "Speed Smelting",
    description: "Furnace smelting time reduced from 8s to 4s.",
    icon: "🔥",
    cost: 180,
    prerequisites: ["tech_advanced_tools"],
    unlocks: "Smelting speed x2",
  },
  {
    id: "tech_crop_genetics",
    name: "Crop Genetics",
    description: "All crops grow 25% faster and have a 15% chance to yield double.",
    icon: "🌱",
    cost: 200,
    prerequisites: ["tech_auto_irrigation"],
    unlocks: "Crop growth +25%, double yield 15% chance",
  },
  {
    id: "tech_animal_husbandry",
    name: "Animal Husbandry",
    description: "Animals produce items every day instead of every 2 days.",
    icon: "🐄",
    cost: 150,
    prerequisites: [],
    unlocks: "Animal produce daily",
  },
  {
    id: "tech_combat_training",
    name: "Combat Training",
    description: "Sword damage +50% and unlock critical hit to 25% (from 15%).",
    icon: "⚔️",
    cost: 250,
    prerequisites: [],
    unlocks: "Sword damage +50%, crit chance 25%",
  },
  {
    id: "tech_energy_efficiency",
    name: "Energy Efficiency",
    description: "All actions cost 30% less energy.",
    icon: "⚡",
    cost: 300,
    prerequisites: ["tech_advanced_tools", "tech_crop_genetics"],
    unlocks: "Action energy cost -30%",
  },
  {
    id: "tech_mass_production",
    name: "Mass Production",
    description: "Crafting queue processes 2 items simultaneously.",
    icon: "🏭",
    cost: 350,
    prerequisites: ["tech_speed_smelting"],
    unlocks: "Dual crafting queue",
  },
  {
    id: "tech_worker_boost",
    name: "Worker Training Program",
    description: "Worker efficiency +100% and energy consumption -50%.",
    icon: "👷",
    cost: 400,
    prerequisites: ["tech_combat_training", "tech_animal_husbandry"],
    unlocks: "Worker speed x2, energy cost -50%",
  },
];

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
    id: "bed",
    name: "Cozy Bed",
    description: "A comfortable bed. Sleep in it to save and start a new day.",
    inputs: [{ itemId: "wood", count: 50 }, { itemId: "fiber", count: 30 }],
    outputId: "bed",
    outputCount: 1,
  },
  {
    id: "stone_path",
    name: "Stone Path",
    description: "A durable path. Prevents debris and slightly increases walk speed.",
    inputs: [{ itemId: "stone", count: 2 }],
    outputId: "stone_path",
    outputCount: 5,
  },
  {
    id: "toolset",
    name: "Advanced Toolset",
    description: "Placeable workstation to upgrade your tools automatically.",
    inputs: [{ itemId: "iron_bar", count: 5 }, { itemId: "wood", count: 40 }],
    outputId: "toolset",
    outputCount: 1,
  },
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
  {
    id: "sprinkler_basic",
    name: "Basic Sprinkler",
    description: "Water 4 adjacent tiles each morning.",
    inputs: [
      { itemId: "copper_bar", count: 1 },
      { itemId: "iron_bar", count: 1 },
      { itemId: "coal", count: 2 },
    ],
    outputId: "sprinkler_basic",
    outputCount: 1,
  },
  {
    id: "sprinkler_quality",
    name: "Quality Sprinkler",
    description: "Water all 8 surrounding tiles each morning.",
    inputs: [
      { itemId: "gold_bar", count: 1 },
      { itemId: "iron_bar", count: 1 },
      { itemId: "coal", count: 1 },
    ],
    outputId: "sprinkler_quality",
    outputCount: 1,
  },
  {
    id: "furnace",
    name: "Stone Furnace",
    description: "Smelts raw copper, iron, gold, and uranium ores into bars.",
    inputs: [
      { itemId: "stone", count: 20 },
      { itemId: "coal", count: 5 },
    ],
    outputId: "furnace",
    outputCount: 1,
  },
  {
    id: "player_store",
    name: "Player Store",
    description: "A shop stand to buy/sell items and hire workers. Costs 30 Wood + 15 Stone + 5 Iron Bars.",
    inputs: [
      { itemId: "wood", count: 30 },
      { itemId: "stone", count: 15 },
      { itemId: "iron_bar", count: 5 },
    ],
    outputId: "player_store",
    outputCount: 1,
  },
  {
    id: "research_center",
    name: "Research Center",
    description: "Technology lab for unlocking new capabilities. Costs 30 Stone + 10 Iron Bars + 5 Copper Bars.",
    inputs: [
      { itemId: "stone", count: 30 },
      { itemId: "iron_bar", count: 10 },
      { itemId: "copper_bar", count: 5 },
    ],
    outputId: "research_center",
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
    // Refund inputs
    for (const input of recipe.inputs) {
      addItem(state.inventory, createItem(input.itemId, input.count));
    }
    return "Inventory full!";
  }

  gameAudio.playCoin();
  return `Crafted ${recipe.name}!`;
}

// Procedural Farm generator
export function applyLandPurchase(tiles: Tile[][], parcel: LandParcel): void {
  for (let y = parcel.y; y < parcel.y + parcel.height; y++) {
    for (let x = parcel.x; x < parcel.x + parcel.width; x++) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        if (parcel.type === "farming") {
          tiles[y][x] = { kind: "soil", age: 0, watered: false };
        } else if (parcel.type === "forest") {
          tiles[y][x] = { kind: Math.random() < 0.6 ? "tree" : "grass", age: 0, watered: false };
        } else if (parcel.type === "water") {
          tiles[y][x] = { kind: "water", age: 0, watered: false };
        } else if (parcel.type === "mining") {
          if (Math.random() < 0.2) tiles[y][x] = { kind: "ore_copper", age: 0, watered: false };
          else if (Math.random() < 0.3) tiles[y][x] = { kind: "ore_iron", age: 0, watered: false };
          else if (Math.random() < 0.4) tiles[y][x] = { kind: "debris_stone", age: 0, watered: false };
          else tiles[y][x] = { kind: "grass", age: 0, watered: false };
        }
      }
    }
  }
}

function makeMap(): Tile[][] {
  const t: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind, age: -1, watered: false }))
  );

  // Farm zone starter plot
  for (let y = 32; y <= 42; y++) {
    for (let x = 8; x <= 22; x++) t[y][x].kind = "soil";
  }

  // Spawn house
  for (let y = 24; y <= 28; y++) {
    for (let x = 12; x <= 17; x++) t[y][x].kind = "house";
  }

  // Mailbox setup next to house
  t[STATIC_POINTS.mailbox.y][STATIC_POINTS.mailbox.x].kind = "placed_item";
  t[STATIC_POINTS.mailbox.y][STATIC_POINTS.mailbox.x].placedItemId = "mailbox";

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

  // Paths
  for (let x = 16; x <= 70; x++) t[44][x].kind = "path";
  for (let y = 29; y <= 44; y++) t[y][16].kind = "path";
  for (let y = 40; y <= 44; y++) t[y][70].kind = "path";
  for (let y = 7; y <= 44; y++) t[y][72].kind = "path";

  // South river / pond
  for (let y = 54; y <= 66; y++) {
    for (let x = 2; x <= 14; x++) {
      if (Math.abs(y - 60) + Math.abs(x - 8) < 10) {
        t[y][x].kind = "water";
      }
    }
  }

  // Seed trees
  const trees: Array<[number, number]> = [
    [6, 12], [8, 10], [20, 18], [24, 22], [28, 40], [36, 38], [46, 18], [60, 44], [58, 12], [40, 52],
    [62, 24], [66, 26], [72, 50], [50, 64], [26, 58], [14, 48], [74, 16], [78, 30],
  ];
  trees.forEach(([x, y]) => {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && t[y][x].kind === "grass") {
      t[y][x].kind = "tree";
    }
  });

  // Overgrown debris across the whole map
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      // Avoid spawning debris directly on top of paths, houses, or water
      if (t[y][x].kind === "grass") {
        const isStartPlot = (x >= 5 && x <= 25 && y >= 20 && y <= 45);
        const spawnRate = isStartPlot ? 0.08 : 0.22;
        if (Math.random() < spawnRate) {
          const rand = Math.random();
          if (rand < 0.45) t[y][x].kind = "debris_weed";
          else if (rand < 0.72) t[y][x].kind = "debris_branch";
          else if (rand < 0.90) t[y][x].kind = "debris_stone";
          else t[y][x].kind = "tree";
        }
      }
    }
  }

  return t;
}

function rollMineGem(depth: number): string | null {
  const rand = Math.random();
  // 1. Check for Prismatic Shard (very rare, depth >= 10, 0.4% chance)
  if (depth >= 10 && rand < 0.004) {
    return "prismatic_shard";
  }
  // 2. Check for Diamond (depth >= 9, 1.5% chance)
  if (depth >= 9 && rand < 0.015) {
    return "diamond";
  }
  // 3. Check for deep gems (depth >= 8, 4% chance total)
  if (depth >= 8 && rand < 0.04) {
    const choices = ["ruby", "emerald", "fire_quartz"];
    return choices[Math.floor(Math.random() * choices.length)];
  }
  // 4. Check for frozen gems (depth >= 5, 6% chance total)
  if (depth >= 5 && rand < 0.06) {
    const choices = ["frozen_tear", "aquamarine"];
    return choices[Math.floor(Math.random() * choices.length)];
  }
  // 5. Common minerals/gems (depth >= 1, 8% chance total)
  if (rand < 0.08) {
    const choices = ["quartz", "earth_crystal", "amethyst", "topaz"];
    return choices[Math.floor(Math.random() * choices.length)];
  }
  return null;
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

  // Exit ladder
  grid[3][3].kind = "mine_ladder";

  // Distribute obstacles & ore deposits
  const rocksToHideLadder: { x: number; y: number }[] = [];
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (y === 3 && x === 3) continue; // spawn protection
      const rand = Math.random();
      if (rand < 0.25) {
        grid[y][x].kind = "debris_stone";
        rocksToHideLadder.push({ x, y });
      } else if (rand < 0.28) {
        if (depth >= 12 && Math.random() < 0.25) {
          grid[y][x].kind = "ore_uranium";
        } else if (depth >= 9 && Math.random() < 0.4) {
          grid[y][x].kind = "ore_gold";
        } else if (depth >= 4 && Math.random() < 0.5) {
          grid[y][x].kind = "ore_iron";
        } else {
          grid[y][x].kind = "ore_copper";
        }
      } else if (rand < 0.32) {
        grid[y][x].kind = "mine_wall";
      }
    }
  }

  // Hide the progression ladder under one random rock
  if (rocksToHideLadder.length > 0) {
    const choice = rocksToHideLadder[Math.floor(Math.random() * rocksToHideLadder.length)];
    grid[choice.y][choice.x].age = 999;
  }

  // Spawn Slimes
  const enemies: Enemy[] = [];
  const numEnemies = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < numEnemies; i++) {
    let ex = 0;
    let ey = 0;
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

export function generateHouseInterior(): Tile[][] {
  const size = 10;
  const grid: Tile[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ kind: "house_floor" as TileKind, age: -1, watered: false }))
  );

  // Borders
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y === 0 || x === 0 || y === size - 1 || x === size - 1) {
        grid[y][x].kind = "house_wall";
      }
    }
  }

  // Welcome mat/door at exit: x = 5, y = 9
  grid[9][5].kind = "house_door";

  // Bed (vertical) at y = 1, x = 1 (head) and y = 2, x = 1 (foot)
  grid[1][1].kind = "house_bed";
  grid[2][1].kind = "house_bed";

  return grid;
}

export function newGame(): GameState {
  const inv = Array.from({ length: 30 }, () => null as Item | null);

  // Equip standard tools
  inv[0] = createItem("hoe");
  inv[1] = createItem("watering_can");
  inv[2] = createItem("scythe");
  inv[3] = createItem("pickaxe");
  inv[4] = createItem("axe");
  inv[5] = createItem("sword");
  inv[6] = createItem("milk_pail"); // Milking pail
  inv[7] = createItem("parsnip_seed", 15);

  const initialLetters: MailLetter[] = [
    {
      id: "lewis_welcome",
      sender: "Mayor Lewis",
      content: "Welcome to your new farm in Meadow Valley! To help you get started on your crops, I left some free parsnip seeds in this letter. Best of luck!",
      giftItemId: "parsnip_seed",
      giftCount: 5,
      claimed: false,
    },
  ];

  return {
    version: 1,
    player: {
      x: STATIC_POINTS.playerSpawn.x,
      y: STATIC_POINTS.playerSpawn.y,
      subX: STATIC_POINTS.playerSpawn.x,
      subY: STATIC_POINTS.playerSpawn.y,
      dir: "down",
      health: 100,
      maxHealth: 100,
    },
    day: 1,
    time: DAY_START_MINUTES,
    inventory: inv,
    hotbarIndex: 0,
    coins: 200, // starting funds
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
    upgrades: { hoe: 1, watering: 1, scythe: 1, pickaxe: 1, axe: 1 },
    // Overhaul elements
    animals: [],
    mailboxLetters: initialLetters,
    hasUnreadMail: true,
    harvestLiftingTimer: 0,
    carryItem: null,
    pets: [],
    workers: [],
    inHouse: false,
    houseGrid: generateHouseInterior(),
    // Extended features
    godMode: false,
    unlockedTechs: [],
    researchPoints: 0,
    activeResearchId: undefined,
    researchProgress: 0,
    workerAssignments: {},
    purchasedLands: [],
  };
}

/**
 * Migrate / patch a raw cloud-save object (potentially from an older game
 * version) so that every field the current code expects is present.
 * Call this whenever you load a state from cloud storage.
 */
export function migrateState(raw: unknown): GameState {
  // Start from a fresh baseline so every field is guaranteed to exist
  const base = newGame();
  if (!raw || typeof raw !== "object") return base;

  const s = raw as Record<string, unknown>;

  // Shallow-merge top-level scalar fields from the saved state
  const merged: GameState = {
    ...base,
    // Scalars / simple overrides
    version: 1,
    day:          typeof s.day === "number"          ? s.day          : base.day,
    time:         typeof s.time === "number"         ? s.time         : base.time,
    coins:        typeof s.coins === "number"        ? s.coins        : base.coins,
    season:       (s.season as GameState["season"])  ?? base.season,
    weather:      (s.weather as GameState["weather"]) ?? base.weather,
    energy:       typeof s.energy === "number"       ? s.energy       : base.energy,
    maxEnergy:    typeof s.maxEnergy === "number"    ? s.maxEnergy    : base.maxEnergy,
    mineDepth:    typeof s.mineDepth === "number"    ? s.mineDepth    : base.mineDepth,
    inMine:       typeof s.inMine === "boolean"      ? s.inMine       : base.inMine,
    hotbarIndex:  typeof s.hotbarIndex === "number"  ? s.hotbarIndex  : base.hotbarIndex,
    hasUnreadMail: typeof s.hasUnreadMail === "boolean" ? s.hasUnreadMail : base.hasUnreadMail,
    harvestLiftingTimer: 0,
    carryItem: null,

    // Arrays — use saved data or fall back to baseline.
    // Use .filter(Boolean) on entity arrays to strip any null/undefined
    // entries that Firestore may have stored (e.g. from serialization bugs).
    inventory: (() => {
      const savedInv = Array.isArray(s.inventory) ? (s.inventory as (Item | null)[]) : base.inventory;
      return Array.from({ length: 30 }, (_, idx) => savedInv[idx] ?? null);
    })(),
    shippingBin:  Array.isArray(s.shippingBin)   ? (s.shippingBin as (Item | null)[])                   : base.shippingBin,
    mineEnemies:  Array.isArray(s.mineEnemies)   ? (s.mineEnemies as Enemy[]).filter(Boolean)           : base.mineEnemies,
    mailboxLetters: Array.isArray(s.mailboxLetters) ? (s.mailboxLetters as MailLetter[]).filter(Boolean) : base.mailboxLetters,
    animals:      Array.isArray(s.animals)       ? (s.animals as Animal[]).filter(Boolean)              : base.animals,
    // New fields added in recent versions — filter nulls, default to [] if absent
    pets:         Array.isArray(s.pets)          ? (s.pets as Pet[]).filter(Boolean)                    : [],
    workers:      Array.isArray(s.workers)       ? (s.workers as FarmWorker[]).filter(Boolean)          : [],
    // Extended features migration
    godMode: typeof s.godMode === "boolean" ? s.godMode : false,
    unlockedTechs: Array.isArray(s.unlockedTechs) ? (s.unlockedTechs as string[]) : [],
    researchPoints: typeof s.researchPoints === "number" ? s.researchPoints : 0,
    activeResearchId: typeof s.activeResearchId === "string" ? s.activeResearchId : undefined,
    researchProgress: typeof s.researchProgress === "number" ? s.researchProgress : 0,
    workerAssignments: (s.workerAssignments && typeof s.workerAssignments === "object") ? (s.workerAssignments as Record<string, string>) : {},
    purchasedLands: Array.isArray(s.purchasedLands) ? (s.purchasedLands as string[]) : [],
    // Tiles: filter null rows, and within each row, replace null tiles with a safe default
    tiles: (() => {
      if (!Array.isArray(s.tiles)) return base.tiles;
      return (s.tiles as Tile[][]).map((row) => {
        if (!Array.isArray(row)) return Array.from({ length: COLS }, () => ({ kind: "grass" as TileKind, age: 0, watered: false }));
        return row.map((tile) => tile ?? { kind: "grass" as TileKind, age: 0, watered: false });
      });
    })(),
    mineGrid: (() => {
      if (!Array.isArray(s.mineGrid)) return base.mineGrid;
      return (s.mineGrid as Tile[][]).map((row) => {
        if (!Array.isArray(row)) return [];
        return row.map((tile) => tile ?? { kind: "mine_dirt" as TileKind, age: -1, watered: false });
      });
    })(),


    player: (() => {
      const pBase = base.player;
      if (s.player && typeof s.player === "object") {
        const pObj = s.player as Record<string, any>;
        const x = typeof pObj.x === "number" ? pObj.x : pBase.x;
        const y = typeof pObj.y === "number" ? pObj.y : pBase.y;
        return {
          ...pBase,
          ...pObj,
          subX: typeof pObj.subX === "number" ? pObj.subX : x,
          subY: typeof pObj.subY === "number" ? pObj.subY : y,
        };
      }
      return pBase;
    })(),

    skills: s.skills && typeof s.skills === "object"
      ? { ...base.skills, ...(s.skills as Partial<GameState["skills"]>) }
      : base.skills,

    experience: s.experience && typeof s.experience === "object"
      ? { ...base.experience, ...(s.experience as Partial<GameState["experience"]>) }
      : base.experience,

    npcFriendships: s.npcFriendships && typeof s.npcFriendships === "object"
      ? (s.npcFriendships as Record<string, number>)
      : base.npcFriendships,

    // Upgrades — make sure every tool key exists (axe was added later)
    upgrades: {
      hoe:      1,
      watering: 1,
      scythe:   1,
      pickaxe:  1,
      axe:      1,
      ...(s.upgrades && typeof s.upgrades === "object" ? (s.upgrades as Partial<GameState["upgrades"]>) : {}),
    },

    quest: s.quest !== undefined ? (s.quest as GameState["quest"]) : base.quest,
    dailyEarnings: s.dailyEarnings as GameState["dailyEarnings"] ?? undefined,
    fishing: s.fishing as GameState["fishing"] ?? undefined,
    inHouse: typeof s.inHouse === "boolean" ? s.inHouse : false,
    houseGrid: (() => {
      if (!Array.isArray(s.houseGrid)) return generateHouseInterior();
      return (s.houseGrid as Tile[][]).map((row) => {
        if (!Array.isArray(row)) return Array.from({ length: 10 }, () => ({ kind: "house_floor" as TileKind, age: -1, watered: false }));
        return row.map((tile) => tile ?? { kind: "house_floor" as TileKind, age: -1, watered: false });
      });
    })(),
  };

  return merged;
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
    t.kind !== "ore_uranium" &&
    t.kind !== "house_wall" &&
    t.kind !== "house_bed" &&
    t.kind !== "placed_item" // chests & sprinklers block movement
  );
}

export function isWorkerWalkable(t: Tile): boolean {
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
    t.kind !== "ore_uranium" &&
    t.kind !== "house_wall" &&
    t.kind !== "house_bed" &&
    (t.kind !== "placed_item" || t.cropId !== undefined || t.placedItemId === "chicken_egg")
  );
}

export function tickFurnace(tile: Tile, dt: number): void {
  if (!tile.chestInventory) {
    tile.chestInventory = Array.from({ length: 3 }, () => null);
  }

  const input = tile.chestInventory[0];
  const fuel = tile.chestInventory[1];

  const smeltRecipes: Record<string, string> = {
    copper_ore: "copper_bar",
    iron_ore: "iron_bar",
    gold_ore: "gold_bar",
    uranium_ore: "uranium_bar",
  };

  const currentInputId = input?.id;
  const targetOutputId = currentInputId ? smeltRecipes[currentInputId] : null;

  if (tile.smeltActive) {
    if (tile.smeltTimer !== undefined) {
      tile.smeltTimer -= dt;
      if (tile.smeltTimer <= 0) {
        tile.smeltActive = false;
        tile.smeltTimer = 0;

        if (tile.smeltOutputId) {
          const outId = tile.smeltOutputId;
          const outItem = createItem(outId, 1);
          if (tile.chestInventory[2] === null) {
            tile.chestInventory[2] = outItem;
          } else if (tile.chestInventory[2].id === outId) {
            tile.chestInventory[2].count += 1;
          }
        }
        tile.smeltOutputId = undefined;
      }
    }
  } else {
    if (input && targetOutputId && input.count >= 3 && fuel && fuel.count >= 1 && (fuel.id === "coal" || fuel.id === "wood")) {
      const outputSlot = tile.chestInventory[2];
      if (outputSlot === null || (outputSlot.id === targetOutputId && outputSlot.count < 99)) {
        if (input.count <= 3) {
          tile.chestInventory[0] = null;
        } else {
          input.count -= 3;
        }

        if (fuel.count <= 1) {
          tile.chestInventory[1] = null;
        } else {
          fuel.count -= 1;
        }

        tile.smeltActive = true;
        tile.smeltTimer = 8;
        tile.smeltMaxTime = 8;
        tile.smeltOutputId = targetOutputId;
      }
    }
  }
}

export function updateEntities(state: GameState, dt: number): void {
  // Update furnaces on farm
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = state.tiles[y]?.[x];
      if (tile && tile.kind === "placed_item" && tile.placedItemId === "furnace") {
        tickFurnace(tile, dt);
      }
    }
  }

  // Update furnaces inside house
  if (state.houseGrid) {
    for (let y = 0; y < state.houseGrid.length; y++) {
      for (let x = 0; x < state.houseGrid[y].length; x++) {
        const tile = state.houseGrid[y]?.[x];
        if (tile && tile.kind === "placed_item" && tile.placedItemId === "furnace") {
          tickFurnace(tile, dt);
        }
      }
    }
  }

  // Research Center tick - workers assigned to research generate points
  if (!state.inMine && state.activeResearchId) {
    const tech = TECHNOLOGIES.find(t => t.id === state.activeResearchId);
    if (tech) {
      if (!state.researchPoints) state.researchPoints = 0;
      if (!state.researchProgress) state.researchProgress = 0;
      if (!state.workerAssignments) state.workerAssignments = {};
      if (!state.unlockedTechs) state.unlockedTechs = [];

      // Count workers assigned to research
      const researchWorkers = (state.workers || []).filter(
        w => w && state.workerAssignments![w.id] === "research_center"
      ).length;

      // Base rate: 2 RP/sec, +1.5 per assigned worker
      const rpPerSec = 2 + researchWorkers * 1.5;
      state.researchPoints += rpPerSec * dt;

      // Advance research progress
      state.researchProgress! += rpPerSec * dt;

      // Check if research is complete
      if (state.researchProgress! >= tech.cost) {
        state.unlockedTechs.push(state.activeResearchId);
        state.researchProgress = 0;
        state.activeResearchId = undefined;
      }
    }
  }

  if (state.inMine) return; // workers and pets stay on the farm!

  const grid = state.tiles;

  // 1. Pets Wander AI
  if (!state.pets) state.pets = [];
  state.pets.forEach((pet) => {
    if (!pet) return;
    pet.subX += (pet.x - pet.subX) * 0.08;
    pet.subY += (pet.y - pet.subY) * 0.08;

    pet.walkTimer -= dt;
    if (pet.walkTimer <= 0) {
      pet.walkTimer = Math.random() * 4 + 3; // choose new tile in 3-7s

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
      const targetX = pet.x + randomDir[0];
      const targetY = pet.y + randomDir[1];

      if (targetX >= 0 && targetY >= 0 && targetX < COLS && targetY < ROWS) {
        const t = grid[targetY][targetX];
        const distToBowl = Math.abs(targetX - pet.bowlX) + Math.abs(targetY - pet.bowlY);
        if (isWalkable(t) && distToBowl <= 10) {
          pet.x = targetX;
          pet.y = targetY;
        }
      }
    }
  });

  // 2. Hired Workers AI
  if (!state.workers) state.workers = [];
  state.workers.forEach((worker) => {
    if (!worker) return;
    worker.subX += (worker.x - worker.subX) * 0.08;
    worker.subY += (worker.y - worker.subY) * 0.08;

    const startHour = worker.workStartHour ?? 8;
    const endHour = worker.workEndHour ?? 17;
    const startMin = startHour * 60;
    const endMin = endHour * 60;

    let isShiftTime = false;
    if (startMin < endMin) {
      isShiftTime = state.time >= startMin && state.time < endMin;
    } else { // Overnight shift
      isShiftTime = state.time >= startMin || state.time < endMin;
    }
    
    // They sleep between 10 PM and 6 AM, but only if they are not currently working
    const isSleepTime = (state.time >= 22 * 60 || state.time < 6 * 60) && !isShiftTime;
    const isOnStrike = worker.energy <= 0;

    if (worker.actionTimer > 0) {
      worker.actionTimer -= dt;
      return;
    }

    if (!isShiftTime || isOnStrike) {
      if (worker.x !== worker.cabinX || worker.y !== worker.cabinY) {
        worker.walkTimer -= dt;
        if (worker.walkTimer <= 0) {
          worker.walkTimer = 0.5;
          const dx = Math.sign(worker.cabinX - worker.x);
          const dy = Math.sign(worker.cabinY - worker.y);

          let nextX = worker.x + dx;
          let nextY = worker.y;
          if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) {
            worker.x = nextX;
          } else {
            nextX = worker.x;
            nextY = worker.y + dy;
            if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) {
              worker.y = nextY;
            }
          }
        }
      }

      if (isOnStrike) {
        worker.statusText = "On Strike (No Food!)";
      } else if (isSleepTime) {
        worker.statusText = "Sleeping";
      } else {
        worker.statusText = "Relaxing near cabin";
      }
      return;
    }

    // Inventory full check -> find chest
    if (worker.inventory) {
      worker.statusText = "Inventory full, seeking Chest...";
      let nearestChestX = -1;
      let nearestChestY = -1;
      let minChestDist = 9999;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const t = grid[y][x];
          if (t.kind === "placed_item" && t.placedItemId === "chest") {
            const d = Math.abs(x - worker.x) + Math.abs(y - worker.y);
            if (d < minChestDist) {
              minChestDist = d;
              nearestChestX = x;
              nearestChestY = y;
            }
          }
        }
      }

      if (nearestChestX !== -1) {
        if (minChestDist <= 1) {
          // Deposit
          if (worker.actionTimer <= 0) {
            worker.actionTimer = 0.5;
            const chestTile = grid[nearestChestY][nearestChestX];
            if (chestTile.chestInventory) {
              addItem(chestTile.chestInventory!, worker.inventory!);
              worker.inventory = null;
            }
          } else {
            worker.actionTimer -= dt;
          }
          return;
        } else {
          // Move to chest
          worker.walkTimer -= dt;
          if (worker.walkTimer <= 0) {
            worker.walkTimer = 0.4;
            const dx = Math.sign(nearestChestX - worker.x);
            const dy = Math.sign(nearestChestY - worker.y);
            let nextX = worker.x + dx;
            let nextY = worker.y;
            if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) { worker.x = nextX; }
            else {
              nextX = worker.x; nextY = worker.y + dy;
              if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) { worker.y = nextY; }
            }
          }
          return;
        }
      } else {
        worker.statusText = "Inventory full, NO CHEST FOUND!";
        // Drop items on ground? For now, we just destroy or wait. Let's just wait.
        return;
      }
    }

    // Role-based task evaluation
    let activeTask: "idle" | "water" | "harvest" | "clear" | "chop" | "mine" | "fetch_water" = "idle";
    
    const roleRadius = 8;
    let foundTarget = false;
    let targetX = -1;
    let targetY = -1;

    if (worker.role !== "idle") {
      let searchOptions: Array<"water" | "harvest" | "clear" | "chop" | "mine" | "fetch_water"> = [];
      if (worker.role === "farming") searchOptions = ["water", "harvest"];
      else if (worker.role === "woodcutting") searchOptions = ["chop", "clear"];
      else if (worker.role === "mining") searchOptions = ["mine"];
      else if (worker.role === "water") searchOptions = ["fetch_water"];

      for (const opt of searchOptions) {
        if (foundTarget) break;
        for (let dy = -roleRadius; dy <= roleRadius; dy++) {
          if (foundTarget) break;
          for (let dx = -roleRadius; dx <= roleRadius; dx++) {
            const tx = worker.cabinX + dx;
            const ty = worker.cabinY + dy;
            if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) {
              const t = grid[ty][tx];
              if (opt === "water" && (t.kind === "soil" || (t.cropId && !t.watered && t.kind !== "watered"))) {
                foundTarget = true; activeTask = "water"; targetX = tx; targetY = ty; break;
              }
              if (opt === "harvest" && t.cropId && t.age >= (CROPS[t.cropId]?.growDays || 3)) {
                foundTarget = true; activeTask = "harvest"; targetX = tx; targetY = ty; break;
              }
              if (opt === "clear" && (t.kind === "debris_weed" || t.kind === "debris_branch")) {
                foundTarget = true; activeTask = "clear"; targetX = tx; targetY = ty; break;
              }
              if (opt === "chop" && t.kind === "tree") {
                foundTarget = true; activeTask = "chop"; targetX = tx; targetY = ty; break;
              }
              if (opt === "mine" && t.kind === "debris_stone") {
                foundTarget = true; activeTask = "mine"; targetX = tx; targetY = ty; break;
              }
              if (opt === "fetch_water" && t.kind === "water") {
                foundTarget = true; activeTask = "fetch_water"; targetX = tx; targetY = ty; break;
              }
            }
          }
        }
      }
    }

    worker.statusText = `Shift: Role is ${worker.role.toUpperCase()}${activeTask !== "idle" ? ` (${activeTask.toUpperCase()})` : ""}`;

    if (activeTask === "idle") {
      worker.walkTimer -= dt;
      if (worker.walkTimer <= 0) {
        worker.walkTimer = Math.random() * 3 + 2;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]];
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        const tx = worker.cabinX + d[0] * 2;
        const ty = worker.cabinY + d[1] * 2;
        if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && isWorkerWalkable(grid[ty]?.[tx])) {
          worker.x = tx;
          worker.y = ty;
        }
      }
      worker.statusText = "Idle - Shift Time";
      return;
    }

    // Target already found in role search
    if (targetX === -1) {
      worker.walkTimer -= dt;
      if (worker.walkTimer <= 0) {
        worker.walkTimer = Math.random() * 2 + 1;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        const tx = worker.x + d[0];
        const ty = worker.y + d[1];
        if (
          Math.abs(tx - worker.cabinX) <= zoneRadius &&
          Math.abs(ty - worker.cabinY) <= zoneRadius &&
          tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS &&
          isWorkerWalkable(grid[ty]?.[tx])
        ) {
          worker.x = tx;
          worker.y = ty;
        }
      }
      worker.statusText = "Searching for tasks...";
      return;
    }

    const dist = Math.abs(targetX - worker.x) + Math.abs(targetY - worker.y);
    if (dist > 1) {
      worker.walkTimer -= dt;
      if (worker.walkTimer <= 0) {
        worker.walkTimer = 0.4;
        const dx = Math.sign(targetX - worker.x);
        const dy = Math.sign(targetY - worker.y);

        let nextX = worker.x + dx;
        let nextY = worker.y;
        if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) {
          worker.x = nextX;
        } else {
          nextX = worker.x;
          nextY = worker.y + dy;
          if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX])) {
            worker.y = nextY;
          }
        }
      }
      worker.statusText = `Moving to target (${targetX}, ${targetY})`;
    } else {
      if (worker.actionTimer <= 0) {
        worker.actionTimer = 1.2;
      } else {
        worker.actionTimer -= dt;
        if (worker.actionTimer <= 0) {
          const t = grid[targetY]?.[targetX];
          if (t) {
            if (activeTask === "water") {
              if (t.kind === "soil" || (t.cropId && !t.watered)) {
                t.watered = true;
                if (t.kind === "soil") t.kind = "watered";
                worker.energy = Math.max(0, worker.energy - 0.2);
                gameAudio.playWater();
              }
            } else if (activeTask === "harvest") {
              if (t.cropId && t.age >= (CROPS[t.cropId]?.growDays || 3)) {
                const cropId = t.cropId;
                const gathered = createItem(cropId, 1);

                let added = false;
                for (let i = 0; i < state.shippingBin.length; i++) {
                  if (state.shippingBin[i] === null) {
                    state.shippingBin[i] = gathered;
                    added = true;
                    break;
                  } else if (state.shippingBin[i]!.id === gathered.id) {
                    state.shippingBin[i]!.count += 1;
                    added = true;
                    break;
                  }
                }

                if (!added) {
                  const cabinTile = grid[worker.cabinY]?.[worker.cabinX];
                  if (cabinTile && cabinTile.chestInventory) {
                    addItem(cabinTile.chestInventory, gathered);
                  }
                }

                t.kind = "soil";
                t.cropId = undefined;
                t.age = -1;
                t.watered = false;
                worker.energy = Math.max(0, worker.energy - 0.5);
                gameAudio.playChop();
              }
            } else if (activeTask === "clear") {
              if (t.kind === "debris_weed") {
                t.kind = "grass";
                const cabinTile = grid[worker.cabinY]?.[worker.cabinX];
                if (cabinTile && cabinTile.chestInventory) {
                  addItem(cabinTile.chestInventory, createItem("fiber", 1));
                }
                worker.energy = Math.max(0, worker.energy - 0.3);
                gameAudio.playChop();
              } else if (t.kind === "debris_branch") {
                t.kind = "grass";
                const cabinTile = grid[worker.cabinY]?.[worker.cabinX];
                if (cabinTile && cabinTile.chestInventory) {
                  addItem(cabinTile.chestInventory, createItem("wood", 2));
                }
                worker.energy = Math.max(0, worker.energy - 0.4);
                gameAudio.playChop();
              } else if (t.kind === "debris_stone") {
                t.kind = "grass";
                const cabinTile = grid[worker.cabinY]?.[worker.cabinX];
                if (cabinTile && cabinTile.chestInventory) {
                  addItem(cabinTile.chestInventory, createItem("stone", 1));
                }
                worker.energy = Math.max(0, worker.energy - 0.4);
                gameAudio.playMine();
              }
            }
          }
        }
      }
    }
  });

  // Real-time natural resource growth/propagation (Factorio style auto-growth)
  if (!state.inMine) {
    // Grow a random weed/sapling/stone/branch on a random grass tile occasionally based on delta time
    if (Math.random() < 0.08 * dt) {
      const rx = Math.floor(Math.random() * COLS);
      const ry = Math.floor(Math.random() * ROWS);
      const tile = state.tiles[ry]?.[rx];
      if (tile && tile.kind === "grass") {
        const rand = Math.random();
        if (rand < 0.45) tile.kind = "debris_weed";
        else if (rand < 0.72) tile.kind = "debris_branch";
        else if (rand < 0.90) tile.kind = "debris_stone";
        else tile.kind = "tree";
      }
    }
  }
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

export function addExperience(state: GameState, skill: keyof GameState["skills"], amount: number): string | null {
  state.experience[skill] += amount;
  const curLevel = state.skills[skill];
  const targetXp = (curLevel + 1) * 100;

  if (state.experience[skill] >= targetXp) {
    state.skills[skill] += 1;
    if (skill === "farming") state.maxEnergy += 10;
    if (skill === "combat") state.player.maxHealth += 10;
    state.energy = state.maxEnergy;
    state.player.health = state.player.maxHealth;

    gameAudio.playLevelUp();
    return `Level Up! ${skill.toUpperCase()} is now Level ${state.skills[skill]}!`;
  }
  return null;
}

export function getChargedTargetTiles(
  state: GameState,
  px: number,
  py: number,
  dir: "up" | "down" | "left" | "right",
  chargeLevel: number
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  const maxCols = state.inMine ? 24 : COLS;
  const maxRows = state.inMine ? 24 : ROWS;

  const pushValid = (tx: number, ty: number) => {
    if (tx >= 0 && ty >= 0 && tx < maxCols && ty < maxRows) {
      tiles.push({ x: tx, y: ty });
    }
  };

  // Level 1: 1 tile in front
  if (chargeLevel <= 1) {
    let tx = px, ty = py;
    if (dir === "up") ty -= 1;
    else if (dir === "down") ty += 1;
    else if (dir === "left") tx -= 1;
    else if (dir === "right") tx += 1;
    pushValid(tx, ty);
    return tiles;
  }

  // Level 2: 1x3 line in front
  if (chargeLevel === 2) {
    let dx = 0, dy = 0;
    if (dir === "up") dy = -1;
    else if (dir === "down") dy = 1;
    else if (dir === "left") dx = -1;
    else if (dir === "right") dx = 1;

    for (let i = 1; i <= 3; i++) {
      pushValid(px + dx * i, py + dy * i);
    }
    return tiles;
  }

  // Level 3: 1x5 line in front
  if (chargeLevel === 3) {
    let dx = 0, dy = 0;
    if (dir === "up") dy = -1;
    else if (dir === "down") dy = 1;
    else if (dir === "left") dx = -1;
    else if (dir === "right") dx = 1;

    for (let i = 1; i <= 5; i++) {
      pushValid(px + dx * i, py + dy * i);
    }
    return tiles;
  }

  // Level 4: 3x3 square centered 2 tiles in front
  if (chargeLevel >= 4) {
    let cx = px, cy = py;
    if (dir === "up") { cx = px; cy = py - 2; }
    else if (dir === "down") { cx = px; cy = py + 2; }
    else if (dir === "left") { cx = px - 2; cy = py; }
    else if (dir === "right") { cx = px + 2; cy = py; }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        pushValid(cx + dx, cy + dy);
      }
    }
    return tiles;
  }

  return tiles;
}

// Interact tool calculations
export function interact(
  state: GameState,
  chargeLevel: number = 1,
  targetTile?: { x: number; y: number }
): { message: string | null; particles: Particle[] } {
  const result: { message: string | null; particles: Particle[] } = { message: null, particles: [] };

  // Harvest freeze check
  if (state.harvestLiftingTimer > 0) return result;

  const isExhausted = state.energy <= 0 && !state.godMode;
  const f = targetTile || frontTile(state);
  if (!f) return result;

  const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
  const tile = grid[f.y]?.[f.x];
  if (!tile) return result;

  const px = f.x * TILE + TILE / 2;
  const py = f.y * TILE + TILE / 2;

  const heldItem = state.inventory[state.hotbarIndex];
  // God mode: tools cost no energy
  const toolEnergyCost = state.godMode ? 0 : 2;

  // 1. Milking Cows logic with milk_pail
  if (heldItem && heldItem.id === "milk_pail") {
    // Check if facing a Calf/Cow animal
    if (!state.animals) state.animals = [];
    const adjacentAnimal = state.animals.find((a) => {
      const dx = Math.abs(a.x - f.x);
      const dy = Math.abs(a.y - f.y);
      return dx + dy === 0; // standing on the front tile
    });

    if (adjacentAnimal && adjacentAnimal.type === "calf") {
      if (adjacentAnimal.age < 3) {
        result.message = `${adjacentAnimal.name} is too young to produce milk!`;
        return result;
      }

      if (adjacentAnimal.hasProduce) {
        if (state.energy < toolEnergyCost) {
          result.message = "No energy!";
          return result;
        }
        state.energy -= toolEnergyCost;
        adjacentAnimal.hasProduce = false;

        const milk = createItem("milk", 1);
        const added = addItem(state.inventory, milk);

        if (added) {
          gameAudio.playWater();
          const lvl = addExperience(state, "farming", 15);
          result.message = `Collected Fresh Milk!` + (lvl ? ` ${lvl}` : "");

          // Squirt milk particles
          for (let i = 0; i < 6; i++) {
            result.particles.push({
              x: px,
              y: py,
              vx: (Math.random() * 2 - 1) * 20,
              vy: -Math.random() * 40 - 10,
              color: "#ffffff",
              age: 0,
              maxAge: 0.25,
            });
          }
        } else {
          result.message = "Inventory full!";
        }
      } else {
        result.message = `${adjacentAnimal.name} has no milk today.`;
      }
      return result;
    }
  }

  // 2. Sword Combat swing
  if (heldItem && heldItem.id === "sword") {
    gameAudio.playSwing();
    if (isExhausted) {
      result.message = "Too tired to swing!";
      return result;
    }

    if (state.inMine && state.mineEnemies.length > 0) {
      const hitRadius = 1.6;
      for (const enemy of state.mineEnemies) {
        const dx = enemy.x - state.player.x;
        const dy = enemy.y - state.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= hitRadius) {
          gameAudio.playHit();
          // Random Critical Hit rolls (15% chance, 2x damage)
          const isCrit = Math.random() < 0.15;
          const damage = (heldItem.damage || 10) * (isCrit ? 2 : 1);
          enemy.hp -= damage;

          // Hit damage floating text
          result.message = isCrit ? `CRITICAL HIT! ${damage} dmg` : `Hit ${enemy.name} for ${damage} dmg`;

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
            state.mineEnemies = state.mineEnemies.filter((e) => e.id !== enemy.id);
            const lootRoll = Math.random();
            if (lootRoll < 0.3) {
              addItem(state.inventory, createItem("coal", 1));
            } else if (lootRoll < 0.5) {
              addItem(state.inventory, createItem("copper_ore", 1));
            }
            state.coins += 5;
            const lvlMsg = addExperience(state, "combat", enemy.exp);
            result.message = `Defeated ${enemy.name}! +5g` + (lvlMsg ? `. ${lvlMsg}` : "");
          }
          return result;
        }
      }
    }
    return result;
  }

  // 3. Clear Debris / Farming Tools
  if (!heldItem) return result;

  switch (heldItem.id) {
    case "hoe": {
      const actionCost = Math.ceil(toolEnergyCost * (1 + (chargeLevel - 1) * 0.5));
      if (state.energy < actionCost) {
        result.message = "No energy!";
        return result;
      }
      state.energy -= actionCost;
      gameAudio.playTill();

      const targets = targetTile ? [f] : getChargedTargetTiles(state, state.player.x, state.player.y, state.player.dir, chargeLevel);
      let tilledCount = 0;

      for (const coord of targets) {
        const t = grid[coord.y]?.[coord.x];
        if (t && t.kind === "grass") {
          t.kind = "soil";
          tilledCount++;

          const tpx = coord.x * TILE + TILE / 2;
          const tpy = coord.y * TILE + TILE / 2;
          for (let i = 0; i < 3; i++) {
            result.particles.push({
              x: tpx,
              y: tpy,
              vx: (Math.random() * 2 - 1) * 30,
              vy: -Math.random() * 40 - 10,
              color: "#8a5a3b",
              age: 0,
              maxAge: 0.3,
            });
          }
        }
      }

      result.message = tilledCount > 0 ? `Tilled ${tilledCount} soil` : "Tilled ground";
      break;
    }

    case "watering_can": {
      const actionCost = Math.ceil(toolEnergyCost * (1 + (chargeLevel - 1) * 0.5));
      if (state.energy < actionCost) {
        result.message = "No energy!";
        return result;
      }
      state.energy -= actionCost;
      gameAudio.playWater();

      const targets = targetTile ? [f] : getChargedTargetTiles(state, state.player.x, state.player.y, state.player.dir, chargeLevel);
      let wateredCount = 0;

      for (const coord of targets) {
        const t = grid[coord.y][coord.x];
        if (t.kind === "soil" || t.cropId) {
          t.watered = true;
          if (t.kind === "soil") t.kind = "watered";
          wateredCount++;

          const tpx = coord.x * TILE + TILE / 2;
          const tpy = coord.y * TILE + TILE / 2;
          for (let i = 0; i < 4; i++) {
            result.particles.push({
              x: tpx + (Math.random() * 16 - 8),
              y: tpy - 4,
              vx: (Math.random() * 2 - 1) * 15,
              vy: Math.random() * 15 + 15,
              color: "#2980b9",
              age: 0,
              maxAge: 0.25,
            });
          }
        }
      }

      result.message = wateredCount > 0 ? `Watered ${wateredCount} soil` : "Watered soil";
      break;
    }

    case "scythe":
      // Harvest mature crop -> Trigger carrying animation
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

          // Set harvest holding freeze state
          state.harvestLiftingTimer = 0.8;
          state.carryItem = gathered;

          // Quest update
          if (state.quest && state.quest.targetType === "harvest" && state.quest.targetId === cropId) {
            state.quest.currentCount += 1;
            if (state.quest.currentCount >= state.quest.targetCount) {
              state.coins += state.quest.rewardCoins;
              result.message = `Quest Complete! Shipped Parsnip. +${state.quest.rewardCoins}g`;
              state.quest = null;
            }
          }

          if (!result.message) {
            result.message = `Harvested ${cropDef.name}!`;
          }

          const lvlMsg = addExperience(state, "farming", 12);
          if (lvlMsg) result.message += ` ${lvlMsg}`;

          for (let i = 0; i < 8; i++) {
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
      const pickLvl = state.upgrades.pickaxe || 1;
      const pickDmg = pickLvl === 1 ? 1 : pickLvl === 2 ? 2 : pickLvl === 3 ? 3 : 5;

      if (tile.kind === "debris_stone") {
        tile.lastHitTime = Date.now();
        if (tile.hitPoints === undefined) tile.hitPoints = 3;
        tile.hitPoints -= pickDmg;
        state.energy -= toolEnergyCost;
        gameAudio.playMine();

        if (tile.hitPoints <= 0) {
          tile.kind = state.inMine ? "mine_dirt" : "grass";
          tile.hitPoints = undefined;
          addItem(state.inventory, createItem("stone", 1));
          if (Math.random() < 0.15) {
            addItem(state.inventory, createItem("coal", 1));
          }

          let gemMsg = "";
          if (state.inMine && Math.random() < 0.05) {
            const gemId = rollMineGem(state.mineDepth);
            if (gemId) {
              const gemItem = createItem(gemId, 1);
              if (addItem(state.inventory, gemItem)) {
                gemMsg = `. Found ${gemItem.name}!`;
              }
            }
          }

          const expGained = 4;
          const lvlMsg = addExperience(state, "mining", expGained);
          result.message = `Broke stone${gemMsg}` + (lvlMsg ? `. ${lvlMsg}` : "");

          if (state.inMine && tile.age === 999) {
            tile.kind = "mine_ladder";
            result.message = "Discovered a ladder leading down!";
          }
        } else {
          result.message = `Struck stone (${tile.hitPoints} HP left)`;
        }

        for (let i = 0; i < 4; i++) {
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
      } else if (tile.kind === "ore_copper" || tile.kind === "ore_iron" || tile.kind === "ore_gold" || tile.kind === "ore_uranium") {
        tile.lastHitTime = Date.now();
        const oreMap = {
          ore_copper: { item: "copper_ore", xp: 8, color: "#d35400" },
          ore_iron: { item: "iron_ore", xp: 15, color: "#95a5a6" },
          ore_gold: { item: "gold_ore", xp: 30, color: "#f1c40f" },
          ore_uranium: { item: "uranium_ore", xp: 50, color: "#2ecc71" },
        };
        const config = oreMap[tile.kind as keyof typeof oreMap];

        if (tile.hitPoints === undefined) tile.hitPoints = 4;
        tile.hitPoints -= pickDmg;
        state.energy -= toolEnergyCost;
        gameAudio.playMine();

        if (tile.hitPoints <= 0) {
          tile.kind = state.inMine ? "mine_dirt" : "grass";
          tile.hitPoints = undefined;
          addItem(state.inventory, createItem(config.item, Math.floor(Math.random() * 2) + 1));

          let gemMsg = "";
          if (state.inMine && Math.random() < 0.15) {
            const gemId = rollMineGem(state.mineDepth);
            if (gemId) {
              const gemItem = createItem(gemId, 1);
              if (addItem(state.inventory, gemItem)) {
                gemMsg = `. Found ${gemItem.name}!`;
              }
            }
          }

          const lvlMsg = addExperience(state, "mining", config.xp);
          result.message = `Mined ${config.item.replace("_", " ")}${gemMsg}` + (lvlMsg ? `. ${lvlMsg}` : "");
        } else {
          result.message = `Struck ore vein (${tile.hitPoints} HP left)`;
        }

        for (let i = 0; i < 6; i++) {
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
      } else if (tile.kind === "placed_item" && tile.placedItemId) {
        state.energy -= toolEnergyCost;
        const id = tile.placedItemId;
        const itemObj = createItem(id, 1);

        if (id === "chest" && tile.chestInventory) {
          for (const item of tile.chestInventory) {
            if (item) addItem(state.inventory, item);
          }
        }

        tile.kind = "grass";
        tile.placedItemId = undefined;
        tile.chestInventory = undefined;
        addItem(state.inventory, itemObj);
        result.message = `Picked up ${itemObj.name}`;
      }
      break;

    case "axe":
      if (state.energy < toolEnergyCost) {
        result.message = "No energy!";
        return result;
      }
      const axeLvl = state.upgrades.axe || 1;
      const axeDmg = axeLvl === 1 ? 1 : axeLvl === 2 ? 2 : axeLvl === 3 ? 3 : 5;

      if (tile.kind === "tree") {
        tile.lastHitTime = Date.now();
        if (tile.hitPoints === undefined) tile.hitPoints = 5;
        tile.hitPoints -= axeDmg;
        state.energy -= toolEnergyCost;
        gameAudio.playChop();

        if (tile.hitPoints <= 0) {
          tile.kind = "grass";
          tile.hitPoints = undefined;
          addItem(state.inventory, createItem("wood", Math.floor(Math.random() * 4) + 3));
          if (Math.random() < 0.2) {
            addItem(state.inventory, createItem("parsnip_seed", 1)); // stand in for tree seed
          }
          const lvlMsg = addExperience(state, "farming", 8);
          result.message = "Chopped down tree" + (lvlMsg ? `. ${lvlMsg}` : "");
        } else {
          result.message = `Struck tree (${tile.hitPoints} HP left)`;
        }

        for (let i = 0; i < 6; i++) {
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
      } else if (tile.kind === "debris_branch") {
        tile.lastHitTime = Date.now();
        if (tile.hitPoints === undefined) tile.hitPoints = 2;
        tile.hitPoints -= axeDmg;
        state.energy -= toolEnergyCost;
        gameAudio.playChop();

        if (tile.hitPoints <= 0) {
          tile.kind = "grass";
          tile.hitPoints = undefined;
          addItem(state.inventory, createItem("wood", 2));
          result.message = "Cleared branch. +2 wood";
        } else {
          result.message = `Struck branch (${tile.hitPoints} HP left)`;
        }

        for (let i = 0; i < 4; i++) {
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

  // 4. Plant Seeds
  if (heldItem && heldItem.type === "seed" && tile.kind === "soil") {
    const cropId = heldItem.id.replace("_seed", "");
    if (CROPS[cropId]) {
      tile.kind = "placed_item";
      tile.cropId = cropId;
      tile.age = 0;
      tile.watered = false;

      removeItem(state.inventory, state.hotbarIndex, 1);
      gameAudio.playWater();
      result.message = `Planted ${CROPS[cropId].name}`;
    }
  }
  // 5. Place Placeable Objects (Sprinklers, Fences, Animals)
  else if (heldItem && heldItem.type === "furniture") {
    // Check if placing a Chick or Calf onto the farm!
    if (heldItem.id === "chick" || heldItem.id === "calf") {
      if (tile.kind === "grass" || tile.kind === "soil" || tile.kind === "path") {
        const type = heldItem.id as "chick" | "calf";
        const name = type === "chick" ? "Little Chick" : "Sweet Calf";

        // Spawn new animal
        state.animals.push({
          id: `${type}_${Date.now()}`,
          type,
          name,
          x: f.x,
          y: f.y,
          subX: f.x,
          subY: f.y,
          age: 0,
          petCount: 0,
          hasProduce: false,
          walkTimer: Math.random() * 3 + 2,
        });

        removeItem(state.inventory, state.hotbarIndex, 1);
        gameAudio.playCoin();
        result.message = `Placed ${name} on the farm!`;

        // Pet heart particles
        for (let i = 0; i < 8; i++) {
          result.particles.push({
            x: px,
            y: py,
            vx: (Math.random() * 2 - 1) * 20,
            vy: -Math.random() * 30 - 10,
            color: "#ff3366",
            age: 0,
            maxAge: 0.4,
          });
        }
      }
      return result;
    }

    // Regular Placeables
    if (tile.kind === "grass" || tile.kind === "mine_dirt" || tile.kind === "soil" || tile.kind === "house_floor") {
      tile.kind = "placed_item";
      tile.placedItemId = heldItem.id;

      if (heldItem.id === "chest") {
        tile.chestInventory = Array.from({ length: 12 }, () => null);
      } else if (heldItem.id === "furnace") {
        tile.chestInventory = Array.from({ length: 3 }, () => null);
      } else if (heldItem.id === "worker_cabin") {
        tile.chestInventory = Array.from({ length: 12 }, () => null);
        if (!state.workers) state.workers = [];
        state.workers.push({
          id: `worker_${Date.now()}`,
          name: "Helper Bob",
          cabinX: f.x,
          cabinY: f.y,
          x: f.x,
          y: f.y,
          subX: f.x,
          subY: f.y,
          task: "idle",
          energy: 100,
          hasEatenToday: false,
          walkTimer: Math.random() * 3 + 2,
          actionTimer: 0,
          statusText: "Idle",
        });
      } else if (heldItem.id === "pet_bowl_dog" || heldItem.id === "pet_bowl_cat") {
        if (!state.pets) state.pets = [];
        const isDog = heldItem.id === "pet_bowl_dog";
        state.pets.push({
          id: `pet_${Date.now()}`,
          type: isDog ? "dog" : "cat",
          name: isDog ? "Buddy" : "Mimi",
          x: f.x,
          y: f.y,
          subX: f.x,
          subY: f.y,
          friendship: 100, // starts with a little friendship
          pettedToday: false,
          bowlX: f.x,
          bowlY: f.y,
          walkTimer: Math.random() * 3 + 2,
        });
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
    `Welcome to Pierre's! It is day ${state.day} of ${state.season}.`,
    state.weather === "rainy" ? "Nice rainy weather outside. The crops will drink well!" : "Beautiful day to work in the tilled soil.",
    state.coins < 20 ? "Sell me your harvested crops and fish here for gold." : "We have plenty of fresh seeds today.",
  ];
  return lines.join(" ");
}

// Sleep summary calculations
export function sleep(state: GameState): void {
  // 1. Calculate shipping bin earnings
  const earningsList: { name: string; count: number; earnings: number; iconColor: string }[] = [];
  let totalEarnings = 0;

  for (const item of state.shippingBin) {
    if (item) {
      const value = item.price * item.count;
      totalEarnings += value;
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
  state.shippingBin = Array.from({ length: 12 }, () => null);
  state.dailyEarnings = {
    items: earningsList,
    total: totalEarnings,
  };

  // 2. Advance Days & grow crops
  state.day += 1;
  state.time = DAY_START_MINUTES;

  state.energy = state.maxEnergy;
  state.player.health = state.player.maxHealth;

  // 3. Animal growth, pet count resets, egg/milk produce ticks
  if (!state.animals) state.animals = [];
  state.animals.forEach((animal) => {
    if (!animal) return;
    animal.age += 1;
    animal.petCount = 0; // reset petting

    // Chick laying egg
    if (animal.type === "chick") {
      // 50% chance chick lays an egg on its tile if grass/soil
      if (Math.random() < 0.6) {
        const farmTile = state.tiles[animal.y][animal.x];
        if (farmTile.kind === "grass" || farmTile.kind === "soil") {
          farmTile.kind = "placed_item";
          farmTile.placedItemId = "chicken_egg"; // can be picked up
        }
      }
    }
    // Calf produce milk
    else if (animal.type === "calf") {
      if (animal.age >= 3) {
        animal.hasProduce = true; // can be milked with milk_pail
      }
    }
  });

  // 4. Sprinklers automation (Waters surrounding soil BEFORE drying them out)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = state.tiles[y][x];
      if (tile.kind === "placed_item" && tile.placedItemId) {
        if (tile.placedItemId === "sprinkler_basic") {
          const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          adj.forEach(([dy, dx]) => {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
              const target = state.tiles[ny][nx];
              target.watered = true;
              if (target.kind === "soil") target.kind = "watered";
            }
          });
        } else if (tile.placedItemId === "sprinkler_quality") {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
                const target = state.tiles[ny][nx];
                target.watered = true;
                if (target.kind === "soil") target.kind = "watered";
              }
            }
          }
        }
      }
    }
  }

  // 5. Tilled Soil update (Dries watered soil, advances crop growth)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.tiles[y][x];

      // Spreading / growing weeds, branches, stones, and trees overnight
      if (t.kind === "debris_weed" && Math.random() < 0.08) {
        const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const [dy, dx] = adj[Math.floor(Math.random() * adj.length)];
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
          const target = state.tiles[ny][nx];
          if (target.kind === "grass") {
            target.kind = "debris_weed";
          }
        }
      }
      
      if (t.kind === "tree" && Math.random() < 0.02) {
        const range = 3;
        const rx = x + Math.floor(Math.random() * (range * 2 + 1)) - range;
        const ry = y + Math.floor(Math.random() * (range * 2 + 1)) - range;
        if (rx >= 0 && rx < COLS && ry >= 0 && ry < ROWS) {
          const target = state.tiles[ry][rx];
          if (target.kind === "grass") {
            target.kind = "tree";
          }
        }
      }

      if (t.kind === "grass" && Math.random() < 0.004) {
        const rand = Math.random();
        if (rand < 0.4) t.kind = "debris_weed";
        else if (rand < 0.7) t.kind = "debris_branch";
        else t.kind = "debris_stone";
      }

      if (t.kind === "watered") {
        t.kind = "soil";
      }

      if (t.cropId) {
        if (t.watered || state.weather === "rainy") {
          t.age += 1;
        }
        t.watered = false;
      }
    }
  }

  // 6. Roll weather
  state.weather = Math.random() < 0.2 ? "rainy" : "sunny";

  // 7. Mail Letter Generation
  if (Math.random() < 0.4) {
    const letters = [
      {
        id: `lewis_grant_${state.day}`,
        sender: "Mayor Lewis",
        content: "Hi! The town treasury has a surplus today. I am distributing a small local grant to our valley farmers to help them clear their crop lands. Enjoy!",
        giftItemId: "gold_ore",
        giftCount: 2,
        claimed: false,
      },
      {
        id: `robin_wood_${state.day}`,
        sender: "Robin",
        content: "Hey farmer! I had some leftover wood planks from a barn construction yesterday. I thought you might use it to build a scarecrow or chest. Talk later!",
        giftItemId: "wood",
        giftCount: 15,
        claimed: false,
      },
      {
        id: `haley_bloom_${state.day}`,
        sender: "Haley",
        content: "My sister said I should be more friendly, so here. I found this flower bulb, I think it looks nice. Don't get dirty planting it!",
        giftItemId: "starflower_seed",
        giftCount: 1,
        claimed: false,
      },
    ];

    if (!state.mailboxLetters) state.mailboxLetters = [];
    const choice = letters[Math.floor(Math.random() * letters.length)];
    state.mailboxLetters.push(choice);
    state.hasUnreadMail = true;
  }

  // 8. Overnight Pet Updates
  if (!state.pets) state.pets = [];
  state.pets.forEach((pet) => {
    if (!pet) return;
    const bowlTile = state.tiles[pet.bowlY]?.[pet.bowlX];
    if (bowlTile && bowlTile.kind === "placed_item" && (bowlTile.placedItemId === "pet_bowl_dog" || bowlTile.placedItemId === "pet_bowl_cat")) {
      if (bowlTile.watered) {
        pet.friendship = Math.min(1000, pet.friendship + 12);
        bowlTile.watered = false; // consume water
      } else {
        pet.friendship = Math.max(0, pet.friendship - 2);
      }
    }

    pet.pettedToday = false;

    // Loyalty gift drop (if friendship > 500)
    if (pet.friendship > 500 && Math.random() < 0.20) {
      const dirs = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
      for (const [dy, dx] of dirs) {
        const ny = pet.bowlY + dy, nx = pet.bowlX + dx;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
          const adjTile = state.tiles[ny][nx];
          if ((adjTile.kind === "grass" || adjTile.kind === "soil") && !adjTile.placedItemId && !adjTile.cropId) {
            const gifts = ["clay", "quartz", "fiber", "stone", "wood", "coal"];
            const giftChoice = gifts[Math.floor(Math.random() * gifts.length)];
            adjTile.kind = "placed_item";
            adjTile.placedItemId = giftChoice;
            break;
          }
        }
      }
    }
  });

  // 9. Overnight Worker Updates (Feed checking)
  if (!state.workers) state.workers = [];
  state.workers.forEach((worker) => {
    if (!worker) return;
    worker.hasEatenToday = false;
    const cabinTile = state.tiles[worker.cabinY]?.[worker.cabinX];
    if (cabinTile && cabinTile.kind === "placed_item" && cabinTile.placedItemId === "worker_cabin" && cabinTile.chestInventory) {
      const foodIdx = cabinTile.chestInventory.findIndex((item) =>
        item && (item.type === "crop" || (item.energyRestore && item.energyRestore > 0))
      );

      if (foodIdx !== -1) {
        const foodItem = cabinTile.chestInventory[foodIdx]!;
        foodItem.count -= 1;
        if (foodItem.count <= 0) {
          cabinTile.chestInventory[foodIdx] = null;
        }
        worker.energy = 100;
        worker.hasEatenToday = true;
        worker.statusText = "Sated";
      } else {
        worker.energy = Math.max(0, worker.energy - 20);
        worker.hasEatenToday = false;
        if (worker.energy === 0) {
          worker.statusText = "On Strike (No Food!)";
        } else {
          worker.statusText = "Hungry";
        }
      }
    } else {
      worker.energy = Math.max(0, worker.energy - 20);
      worker.hasEatenToday = false;
      if (worker.energy === 0) {
        worker.statusText = "Exhausted";
      }
    }
  });

  gameAudio.playSleep();
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

class ImprovedNoise {
  private p: number[] = new Array(512);

  constructor() {
    const permutation = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
      140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
      247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
      57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
      74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
      60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
      65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
      200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3,
      64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85,
      212, 207, 206, 59, 227, 47, 162, 112, 72, 80, 60, 51, 190, 2, 144, 146,
      128, 210, 22, 251, 19, 165, 228, 236, 9, 252, 192, 97, 60, 24, 16, 211,
      88, 143, 156, 203, 86, 244, 120, 111, 197, 203, 85, 70, 236, 179, 194,
      172, 97, 148, 15, 219, 74, 223, 50, 224, 43, 99, 192, 219, 54, 223, 50,
      224, 43, 99, 192, 219, 54, 223, 50, 224, 43, 99, 192, 219, 54, 223, 127
    ];
    for (let i = 0; i < 256; i++) {
      this.p[i] = permutation[i] || 0;
      this.p[256 + i] = permutation[i] || 0;
    }
  }

  public noise(x: number, y: number, z: number = 0): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
        this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BA + 1], x - 1, y - 1, z))
      ),
      this.lerp(
        v,
        this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        this.lerp(
          u,
          this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
        )
      )
    );
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}

const noiseBase = new ImprovedNoise();

function getGrassColor(x: number, y: number, season: string): string {
  const val = noiseBase.noise(x * 0.08, y * 0.08, 0);
  const t = Math.max(0, Math.min(1, (val + 0.35) / 0.7));
  
  let c1, c2;
  if (season === "summer") {
    c1 = {r: 130, g: 190, b: 60};
    c2 = {r: 95, g: 160, b: 50};
  } else if (season === "fall") {
    c1 = {r: 210, g: 140, b: 60};
    c2 = {r: 180, g: 110, b: 40};
  } else if (season === "winter") {
    c1 = {r: 220, g: 235, b: 240};
    c2 = {r: 190, g: 210, b: 225};
  } else { // spring
    c1 = {r: 126, g: 199, b: 122};
    c2 = {r: 93, g: 168, b: 89};
  }
  
  const rCol = Math.round(c1.r - (c1.r - c2.r) * t);
  const gCol = Math.round(c1.g - (c1.g - c2.g) * t);
  const bCol = Math.round(c1.b - (c1.b - c2.b) * t);
  return `rgb(${rCol}, ${gCol}, ${bCol})`;
}

function seedRandom(s: number): number {
  const x = Math.sin(s) * 10000;
  return x - Math.floor(x);
}

function drawOrganicBlob(
  ctx: CanvasRenderingContext2D,
  y: number,
  x: number,
  grid: Tile[][],
  ts: number,
  checkFn: (t: Tile) => boolean,
  color: string,
  radiusRatio: number,
  offsetX = 0,
  offsetY = 0
): void {
  const tx = x * ts + offsetX;
  const ty = y * ts + offsetY;
  const cx = tx + ts / 2;
  const cy = ty + ts / 2;
  const rad = ts * radiusRatio;
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  const checkType = (nr: number, nc: number) => {
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;
    return checkFn(grid[nr][nc]);
  };

  const width = rad * 2;
  if (checkType(y - 1, x)) {
    ctx.fillRect(cx - rad, ty, width, ts / 2);
  }
  if (checkType(y + 1, x)) {
    ctx.fillRect(cx - rad, cy, width, ts / 2);
  }
  if (checkType(y, x - 1)) {
    ctx.fillRect(tx, cy - rad, ts / 2, width);
  }
  if (checkType(y, x + 1)) {
    ctx.fillRect(cx, cy - rad, ts / 2, width);
  }
}

// ----------------------------- OVERHAUL GRAPHICS RENDERER -----------------------------
export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewWidth: number,
  viewHeight: number,
  hoveredTile?: { x: number; y: number } | null
) {
  ctx.imageSmoothingEnabled = false;

  const currentGrid = state.inHouse
    ? state.houseGrid!
    : (state.inMine ? state.mineGrid : state.tiles);
  const gridRows = currentGrid.length;
  const gridCols = currentGrid[0]?.length || 0;

  const p = state.player;
  const playerPx = (p.subX !== undefined ? p.subX : p.x) * TILE + TILE / 2;
  const playerPy = (p.subY !== undefined ? p.subY : p.y) * TILE + TILE / 2;

  let cameraX = 0;
  if (gridCols * TILE < viewWidth) {
    cameraX = -(viewWidth - gridCols * TILE) / 2;
  } else {
    cameraX = Math.max(0, Math.min(gridCols * TILE - viewWidth, playerPx - viewWidth / 2));
  }

  let cameraY = 0;
  if (gridRows * TILE < viewHeight) {
    cameraY = -(viewHeight - gridRows * TILE) / 2;
  } else {
    cameraY = Math.max(0, Math.min(gridRows * TILE - viewHeight, playerPy - viewHeight / 2));
  }

  // Background
  ctx.fillStyle = state.inHouse ? "#100f0f" : (state.inMine ? "#231f20" : "#5da859"); // void background for house interior
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  const startCol = Math.max(0, Math.floor(cameraX / TILE));
  const endCol = Math.min(gridCols, Math.ceil((cameraX + viewWidth) / TILE));
  const startRow = Math.max(0, Math.floor(cameraY / TILE));
  const endRow = Math.min(gridRows, Math.ceil((cameraY + viewHeight) / TILE));

  const phase = getTimePhase(state.time);

  // Checker functions for terrains
  const isWater = (t: Tile | undefined) => !!t && t.kind === "water";
  const isPath = (t: Tile | undefined) => !!t && t.kind === "path";
  const isSoil = (t: Tile | undefined) => !!t && (t.kind === "soil" || t.kind === "watered" || t.cropId !== undefined);

  // 1. Terrain Tiles Layer (Layer 1: Base Grass Background + Base overlay)
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const px = x * TILE;
      const py = y * TILE;

      if (state.inHouse) {
        // Black void padding
        ctx.fillStyle = "#110e0c";
        ctx.fillRect(px, py, TILE, TILE);
      } else if (!state.inMine) {
        // Smooth noise-based grass color
        const grassColor = getGrassColor(x, y, state.season);
        ctx.fillStyle = grassColor;
        ctx.fillRect(px, py, TILE, TILE);

        // Cute floral and blades accents deterministically seeded
        const r = seedRandom(x * 37 + y * 73);
        if (r < 0.15) {
          // Grass blades using curved paths
          ctx.strokeStyle = "#4e8a4a";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const bx = px + 8 + r * 10;
          const by = py + 24 - r * 8;
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - 3, by - 6, bx - 5, by - 12);
          ctx.moveTo(bx + 4, by + 2);
          ctx.quadraticCurveTo(bx + 5, by - 5, bx + 7, by - 10);
          ctx.stroke();
        } else if (r < 0.22) {
          // Tiny flowers
          const fx = px + 8 + r * 14;
          const fy = py + 8 + r * 14;
          const fColor = r < 0.17 ? "#ffffff" : r < 0.20 ? "#f1c40f" : "#9b59b6";
          ctx.fillStyle = fColor;
          ctx.beginPath();
          ctx.arc(fx - 2, fy, 1.8, 0, Math.PI * 2);
          ctx.arc(fx + 2, fy, 1.8, 0, Math.PI * 2);
          ctx.arc(fx, fy - 2, 1.8, 0, Math.PI * 2);
          ctx.arc(fx, fy + 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e67e22";
          ctx.beginPath();
          ctx.arc(fx, fy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Mine dirt tiles
        const t = currentGrid[y][x];
        if (t.kind !== "mine_wall") {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#3d312a" : "#352b25";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#2c231e";
          if ((x * 3 + y) % 5 === 0) ctx.fillRect(px + 6, py + 14, 8, 2);
        }
      }
    }
  }

  // Terrain Tiles Layer (Layer 2: Winding Paths, Connected Shore Water, Connected Soils)
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (t.kind === "path") {
        // Gravel path outer border
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isPath, "#bd9e72", 0.65);
        // Slate/sandy path core
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isPath, "#ceb48a", 0.45);
        
        // Add random tiny gravel pebbles
        const pathR = seedRandom(x * 47 + y * 83);
        if (pathR < 0.25) {
          ctx.fillStyle = "#bd9e72";
          ctx.fillRect(px + 8 + pathR * 12, py + 8 + pathR * 12, 2, 2);
        }
      } else if (t.kind === "water") {
        // 1. Sandy beach shoreline
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isWater, "#e5cbb3", 0.75);
        // 2. Shallow water transition
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isWater, "#4c81a3", 0.6);
        // 3. Deep water core
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isWater, "#2980b9", 0.46);

        // Animated wave ripples inside the deep water core
        const wave = Math.sin(Date.now() / 250 + x * 0.4 + y * 0.2) * 1.5;
        ctx.fillStyle = "#aed6f1";
        ctx.fillRect(px + 10, py + 12 + wave, 6, 1.2);
        ctx.fillRect(px + 16, py + 22 - wave, 6, 1.2);

        // Stepping water lily pads with bobbing and rotation
        if ((x * 13 + y * 9) % 23 === 0) {
          const lilyBob = Math.sin(Date.now() / 700 + (x * 13 + y * 9)) * 1.2;
          const lilyAngle = Math.sin(Date.now() / 1400 + x) * 0.06;
          ctx.save();
          ctx.translate(px + 16, py + 16 + lilyBob);
          ctx.rotate(lilyAngle);

          // Pad
          ctx.fillStyle = "#27ae60";
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 1.75);
          ctx.fill();

          // Pink Lily Flower bloom
          if ((x * 13 + y * 9) % 46 === 0) {
            ctx.fillStyle = "#f48fb1";
            ctx.beginPath();
            ctx.arc(-1.5, -1.5, 2, 0, Math.PI * 2);
            ctx.arc(1.5, 1.5, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (t.kind === "soil" || t.kind === "watered" || t.cropId !== undefined) {
        // Draw connected soil plots with a darker shadow/border first
        const soilShadow = state.season === "winter" ? "#4d423b" : "#5a3b25";
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isSoil, soilShadow, 0.68);
        const baseSoil = state.season === "winter" ? "#7c6c5f" : "#8a5a3b";
        const wetSoil = state.season === "winter" ? "#3a2a20" : "#4a3120";
        const soilColor = (t.kind === "watered" || t.watered) ? wetSoil : baseSoil;
        drawOrganicBlob(ctx, y, x, currentGrid, TILE, isSoil, soilColor, 0.58);

        // Glistening effect on watered soils
        if (t.kind === "watered" || t.watered) {
          const glisten = Math.sin(Date.now() / 350 + (x * 17 + y * 23));
          if (glisten > 0.82) {
            ctx.fillStyle = "rgba(174, 214, 241, 0.75)";
            const gx = px + 6 + ((x * 11 + y * 7) % 18);
            const gy = py + 6 + ((x * 5 + y * 13) % 18);
            ctx.fillRect(gx, gy, 1.5, 1.5);
          }
        }
      } else if (t.kind === "house_floor") {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = "#5d4037";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + TILE / 2);
        ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.moveTo(px + TILE, py);
        ctx.lineTo(px + TILE, py + TILE);
        if ((x + y) % 2 === 0) {
          ctx.moveTo(px + TILE / 2, py);
          ctx.lineTo(px + TILE / 2, py + TILE / 2);
        } else {
          ctx.moveTo(px + TILE / 4, py + TILE / 2);
          ctx.lineTo(px + TILE / 4, py + TILE);
          ctx.moveTo(px + (3 * TILE) / 4, py + TILE / 2);
          ctx.lineTo(px + (3 * TILE) / 4, py + TILE);
        }
        ctx.stroke();
      } else if (t.kind === "house_wall") {
        ctx.fillStyle = "#3e2723";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#271510";
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
        ctx.strokeStyle = "#4e342e";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else if (t.kind === "house_door") {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#d84315";
        ctx.fillRect(px + 4, py + 8, TILE - 8, TILE - 16);
        ctx.strokeStyle = "#ff8a50";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 4, py + 8, TILE - 8, TILE - 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("EXIT", px + TILE / 2, py + TILE / 2 + 3);
      } else if (t.kind === "house_bed") {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        if (y === 1) {
          ctx.fillStyle = "#f5f5f5";
          ctx.fillRect(px + 4, py + 4, TILE - 8, 10);
          ctx.fillStyle = "#c62828";
          ctx.fillRect(px + 4, py + 14, TILE - 8, TILE - 16);
        } else {
          ctx.fillStyle = "#c62828";
          ctx.fillRect(px + 4, py + 2, TILE - 8, TILE - 6);
          ctx.fillStyle = "#b71c1c";
          ctx.fillRect(px + 4, py + 2, TILE - 8, 3);
        }
      } else if (t.kind === "house") {
        // Determine whether this house tile belongs to the Farm House or the Shop storefront
        if (x >= 12 && x <= 17 && y >= 24 && y <= 28) {
          // Farm House building (6x5, rx: 0..5, ry: 0..4)
          const rx = x - 12;
          const ry = y - 24;

          if (ry === 0 || ry === 1) {
            // Dark red brick shingles
            ctx.fillStyle = "#7b241c";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#511812";
            ctx.fillRect(px, py + TILE - 2, TILE, 2);
            for (let i = (ry === 0 ? 0 : 4); i < TILE; i += 8) {
              ctx.fillRect(px + i, py, 2, TILE);
            }
            if (ry === 1) {
              ctx.fillStyle = "#4a2306"; // eaves under roof
              ctx.fillRect(px, py + TILE - 4, TILE, 4);
            }
            // Draw chimney stack on the roof (rx = 4, ry = 0)
            if (rx === 4 && ry === 0) {
              ctx.fillStyle = "#5d6d7e"; // gray stone chimney
              ctx.fillRect(px + 8, py - 10, 12, 20);
              ctx.fillStyle = "#2c3e50"; // rim
              ctx.fillRect(px + 6, py - 12, 16, 4);
            }
          } else {
            // Wall log siding
            ctx.fillStyle = "#a0522d";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#5c2d16";
            for (let i = 6; i < TILE; i += 8) {
              ctx.fillRect(px, py + i, TILE, 2);
            }

            // Window frames + glowing glass
            if ((rx === 1 || rx === 4) && ry === 2) {
              ctx.fillStyle = "#3e2723";
              ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 12);
              const glow = (phase === "night" || phase === "evening") ? "#f1c40f" : "#85c1e9";
              ctx.fillStyle = glow;
              ctx.fillRect(px + 6, py + 8, TILE - 12, TILE - 16);
              ctx.fillStyle = "#3e2723";
              ctx.fillRect(px + TILE / 2 - 1, py + 8, 2, TILE - 16);
              ctx.fillRect(px + 6, py + TILE / 2 - 1, TILE - 12, 2);
            }

            // Doorway at the bottom center
            if (rx === 3 && ry === 4) {
              ctx.fillStyle = "#3e2723"; // frame
              ctx.fillRect(px + 4, py, TILE - 8, TILE);
              ctx.fillStyle = "#795548"; // brown door
              ctx.fillRect(px + 6, py + 2, TILE - 12, TILE - 2);
              ctx.fillStyle = "#d4ac0d"; // knob
              ctx.beginPath();
              ctx.arc(px + TILE - 10, py + TILE / 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (x >= 64 && x <= 74 && y >= 32 && y <= 40) {
          // Shop building (11x9, rx: 0..10, ry: 0..8)
          const rx = x - 64;
          const ry = y - 32;

          if (ry >= 0 && ry <= 2) {
            // Slate blue roof shingles
            ctx.fillStyle = "#2e4053";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#1b2631";
            ctx.fillRect(px, py + TILE - 2, TILE, 2);
            for (let i = (ry % 2 === 0 ? 0 : 4); i < TILE; i += 8) {
              ctx.fillRect(px + i, py, 2, TILE);
            }
            if (ry === 2) {
              ctx.fillStyle = "#2c3e50"; // eaves
              ctx.fillRect(px, py + TILE - 4, TILE, 4);
            }
            // Shop Chimney stack (rx = 8, ry = 0)
            if (rx === 8 && ry === 0) {
              ctx.fillStyle = "#5d6d7e";
              ctx.fillRect(px + 8, py - 10, 12, 20);
              ctx.fillStyle = "#2c3e50";
              ctx.fillRect(px + 6, py - 12, 16, 4);
            }
          } else {
            // Tan siding walls
            ctx.fillStyle = "#ceb48a";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#9c8259";
            for (let i = 6; i < TILE; i += 8) {
              ctx.fillRect(px, py + i, TILE, 2);
            }

            // Display Sign
            if ((rx === 5 || rx === 6) && ry === 3) {
              ctx.fillStyle = "#784212";
              ctx.fillRect(px, py + 8, TILE, TILE - 16);
              ctx.fillStyle = "#f5c542";
              ctx.fillRect(px + 2, py + 10, TILE - 4, TILE - 20);
              ctx.fillStyle = "#784212";
              ctx.font = "bold 8px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText(rx === 5 ? "SH" : "OP", px + TILE / 2, py + TILE / 2 + 2);
            }

            // Large Shop Windows
            if ((rx === 2 || rx === 8) && ry === 4) {
              ctx.fillStyle = "#3e2723";
              ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
              const glow = (phase === "night" || phase === "evening") ? "#f1c40f" : "#85c1e9";
              ctx.fillStyle = glow;
              ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 12);
              ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
              ctx.beginPath();
              ctx.moveTo(px + 6, py + 6);
              ctx.lineTo(px + TILE - 6, py + TILE - 6);
              ctx.lineTo(px + TILE - 9, py + TILE - 6);
              ctx.lineTo(px + 6, py + 9);
              ctx.fill();
            }

            // Storefront Entry Door
            if (rx === 5 && ry === 8) {
              ctx.fillStyle = "#3e2723";
              ctx.fillRect(px + 4, py, TILE - 8, TILE);
              ctx.fillStyle = "#795548";
              ctx.fillRect(px + 6, py + 2, TILE - 12, TILE - 2);
              ctx.fillStyle = "#d4ac0d";
              ctx.beginPath();
              ctx.arc(px + TILE - 10, py + TILE / 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          // Fallback simple house
          ctx.fillStyle = "#935116";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#5c330e";
          for (let i = 6; i < TILE; i += 8) {
            ctx.fillRect(px, py + i, TILE, 2);
          }
        }
      } else if (t.kind === "shop") {
        // Premium Stardew shop counter/register
        ctx.fillStyle = "#ceb48a"; // background siding
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#784212"; // wood table frame
        ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
        ctx.fillStyle = "#a0522d"; // counter top
        ctx.fillRect(px + 1, py + 2, TILE - 2, 4);

        // Gold scale/cash register on counter
        ctx.fillStyle = "#d4ac0d";
        ctx.fillRect(px + 8, py + 6, 6, 6);
        ctx.fillStyle = "#5d6d7e";
        ctx.fillRect(px + 18, py + 4, 8, 8);
      } else if (t.kind === "mine_cave") {
        // Beautiful rock arch cave entrance
        ctx.fillStyle = "#5a3b25"; // background shade
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 2);

        ctx.fillStyle = "#7f8c8d"; // stone arch left
        ctx.fillRect(px + 2, py + 6, 6, TILE - 6);
        ctx.fillRect(px + TILE - 8, py + 6, 6, TILE - 6);
        ctx.fillRect(px + 2, py + 2, TILE - 4, 6); // top arch

        ctx.fillStyle = "#11161b"; // dark deep tunnel
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 8);
      } else if (t.kind === "mine_wall") {
        ctx.fillStyle = "#201814";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#15100d";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (t.kind === "mine_ladder") {
        ctx.fillStyle = "#352b25";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#a87b51";
        ctx.fillRect(px + 8, py + 2, 3, TILE - 4);
        ctx.fillRect(px + 20, py + 2, 3, TILE - 4);
        for (let i = 4; i < TILE - 2; i += 6) {
          ctx.fillRect(px + 8, py + i, 12, 2);
        }
      }
    }
  }

  // Terrain Tiles Layer (Layer 3: Trees, Growing Crops, Debris, and Placed Items)
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      // Render Tree
      if (t.kind === "tree") {
        // 1. Draw organic shadow blob under tree base
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 30, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        let hitShake = 0;
        if (t.lastHitTime) {
          const elapsed = Date.now() - t.lastHitTime;
          if (elapsed < 400) {
            hitShake = Math.sin(elapsed * 0.05) * 3 * (1 - elapsed / 400);
          }
        }

        const windSwayAngle = Math.sin(Date.now() / 900 + x * 0.4) * 0.04;

        ctx.save();
        ctx.translate(px + 16 + hitShake, py + 32);
        ctx.rotate(windSwayAngle);

        // Detailed wood bark trunk
        ctx.fillStyle = "#70482e"; // brown bark
        ctx.fillRect(-4, -22, 8, 22);
        ctx.fillStyle = "#593924"; // vertical bark lines
        ctx.fillRect(-2, -22, 1, 22);
        ctx.fillRect(2, -18, 1, 18);

        // Fluffy leaves (3 overlapping layers)
        const leafSwayX = Math.sin(Date.now() / 400 + y) * 0.8;
        
        let cBase = "#1e7e34", cMid = "#28a745", cHigh = "#5cb85c";
        if (state.season === "fall") {
          cBase = "#b03a2e"; cMid = "#d35400"; cHigh = "#e67e22";
        } else if (state.season === "winter") {
          cBase = "#175d26"; cMid = "#1e7e34"; cHigh = "#a9cce3"; // snowy tops
        } else if (state.season === "summer") {
          cBase = "#145a32"; cMid = "#1e8449"; cHigh = "#27ae60";
        }

        // Layer 1: Dark background leaves
        ctx.fillStyle = cBase;
        ctx.beginPath();
        ctx.arc(0 + leafSwayX, -30, 15, 0, Math.PI * 2);
        ctx.fill();

        // Layer 2: Medium leaves
        ctx.fillStyle = cMid;
        ctx.beginPath();
        ctx.arc(-8 + leafSwayX, -35, 12, 0, Math.PI * 2);
        ctx.arc(8 + leafSwayX, -35, 12, 0, Math.PI * 2);
        ctx.arc(0 + leafSwayX, -42, 13, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: Highlight light green leaves
        ctx.fillStyle = cHigh;
        ctx.beginPath();
        ctx.arc(-5 + leafSwayX, -38, 8, 0, Math.PI * 2);
        ctx.arc(5 + leafSwayX, -38, 8, 0, Math.PI * 2);
        ctx.arc(0 + leafSwayX, -45, 9, 0, Math.PI * 2);
        ctx.fill();

        // Apples (5 deterministic spots)
        if ((x * 7 + y * 13) % 5 === 0) {
          ctx.fillStyle = "#d9534f"; // beautiful red apple
          const apples = [
            [-6, -32], [6, -34], [-2, -40], [4, -42], [-8, -42]
          ];
          apples.forEach(([ax, ay]) => {
            ctx.beginPath();
            ctx.arc(ax + leafSwayX, ay, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // stem
            ctx.fillStyle = "#5c3a21";
            ctx.fillRect(ax + leafSwayX, ay - 4, 1, 2);
          });
        }

        ctx.restore();
      }

      // Render Debris & Ores with hit/rustle shake
      let debrisShake = 0;
      if (t.lastHitTime) {
        const elapsed = Date.now() - t.lastHitTime;
        if (elapsed < 400) {
          debrisShake = Math.sin(elapsed * 0.05) * 3 * (1 - elapsed / 400);
        }
      }

      if (t.kind === "debris_weed") {
        let weedShake = debrisShake;
        if (t.lastRustleTime) {
          const elapsed = Date.now() - t.lastRustleTime;
          if (elapsed < 400) {
            weedShake += Math.sin(elapsed * 0.05) * 2.5 * (1 - elapsed / 400);
          }
        }

        // Mossy weed clump with shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 24, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#27ae60";
        ctx.beginPath();
        ctx.arc(px + 12 + weedShake, py + 20, 6, 0, Math.PI * 2);
        ctx.arc(px + 20 + weedShake, py + 20, 5, 0, Math.PI * 2);
        ctx.arc(px + 16 + weedShake, py + 15, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#5cb85c"; // highlight moss
        ctx.beginPath();
        ctx.arc(px + 12 + weedShake, py + 18, 3, 0, Math.PI * 2);
        ctx.arc(px + 18 + weedShake, py + 14, 4, 0, Math.PI * 2);
        ctx.fill();

      } else if (t.kind === "debris_branch") {
        // Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 22, 12, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Branch stick with node segments
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(px + 6 + debrisShake, py + 18, 20, 4);
        ctx.fillRect(px + 18 + debrisShake, py + 10, 4, 8);
        ctx.fillRect(px + 10 + debrisShake, py + 14, 3, 5);

        ctx.fillStyle = "#ba8b68"; // wood core
        ctx.fillRect(px + 6 + debrisShake, py + 19, 2, 2);
        ctx.fillRect(px + 24 + debrisShake, py + 19, 2, 2);

      } else if (t.kind === "debris_stone") {
        // Gray cracked rock
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 24, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#7f8c8d";
        ctx.beginPath();
        ctx.moveTo(px + 6 + debrisShake, py + 24);
        ctx.lineTo(px + 10 + debrisShake, py + 12);
        ctx.lineTo(px + 20 + debrisShake, py + 10);
        ctx.lineTo(px + 26 + debrisShake, py + 24);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#95a5a6"; // facet highlight
        ctx.beginPath();
        ctx.moveTo(px + 10 + debrisShake, py + 12);
        ctx.lineTo(px + 20 + debrisShake, py + 10);
        ctx.lineTo(px + 16 + debrisShake, py + 24);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#566573"; // rock crack
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 15 + debrisShake, py + 11);
        ctx.lineTo(px + 13 + debrisShake, py + 18);
        ctx.stroke();

      } else if (t.kind === "ore_copper" || t.kind === "ore_iron" || t.kind === "ore_gold" || t.kind === "ore_uranium") {
        // Rich crystalline metallic ore deposit
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 24, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#47525d"; // host stone base
        ctx.beginPath();
        ctx.moveTo(px + 6 + debrisShake, py + 24);
        ctx.lineTo(px + 12 + debrisShake, py + 10);
        ctx.lineTo(px + 22 + debrisShake, py + 12);
        ctx.lineTo(px + 26 + debrisShake, py + 24);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#5c6a77"; // facet
        ctx.beginPath();
        ctx.moveTo(px + 12 + debrisShake, py + 10);
        ctx.lineTo(px + 22 + debrisShake, py + 12);
        ctx.lineTo(px + 18 + debrisShake, py + 24);
        ctx.closePath();
        ctx.fill();

        const gemColors = {
          ore_copper: ["#d35400", "#e67e22", "#f39c12"],
          ore_iron: ["#7f8c8d", "#bdc3c7", "#ecf0f1"],
          ore_gold: ["#d4ac0d", "#f1c40f", "#f9e79f"],
          ore_uranium: ["#145a32", "#2ecc71", "#a3e4d7"]
        }[t.kind as "ore_copper" | "ore_iron" | "ore_gold" | "ore_uranium"] || ["#fff", "#fff", "#fff"];

        const crystals = [
          { dx: -4, dy: -6, size: 4 },
          { dx: 4, dy: -2, size: 5 },
          { dx: 0, dy: 4, size: 4 }
        ];

        crystals.forEach((c) => {
          const cx = px + 16 + c.dx + debrisShake;
          const cy = py + 14 + c.dy;
          const s = c.size;

          ctx.fillStyle = gemColors[1];
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s / 1.5, cy);
          ctx.lineTo(cx, cy + s);
          ctx.lineTo(cx - s / 1.5, cy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = gemColors[2];
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s / 1.5, cy);
          ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();

          // Sparkle glisten dot
          if (Math.sin(Date.now() / 150 + c.dx) > 0.8) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(cx - 1, cy - s - 1, 2, 2);
          }
        });
      }

      // Render Placed Items
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        if (id === "chest") {
          ctx.fillStyle = "#873600";
          ctx.fillRect(px + 6, py + 10, TILE - 12, TILE - 14);
          ctx.fillStyle = "#f4d03f";
          ctx.fillRect(px + 14, py + 18, 4, 3);
        } else if (id === "torch") {
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(px + 15, py + 14, 2, 14);
          const f = 5 + Math.sin(Date.now() / 90) * 2;
          ctx.fillStyle = "#e67e22";
          ctx.beginPath();
          ctx.arc(px + 16, py + 10, f, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "scarecrow") {
          ctx.fillStyle = "#eb984e";
          ctx.fillRect(px + 8, py + 12, 16, 12);
          ctx.fillStyle = "#873600";
          ctx.fillRect(px + 4, py + 8, 24, 4);
          ctx.fillRect(px + 10, py + 2, 12, 6);
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(px + 15, py + 24, 2, 8);
        } else if (id === "sprinkler_basic" || id === "sprinkler_quality") {
          ctx.fillStyle = id === "sprinkler_basic" ? "#2980b9" : "#f1c40f";
          ctx.fillRect(px + 10, py + 18, 12, 8);
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 15, py + 8, 2, 10);

          ctx.save();
          ctx.translate(px + 16, py + 8);
          ctx.rotate(Date.now() / 150);
          ctx.fillStyle = "#95a5a6";
          ctx.fillRect(-6, -1, 12, 2);
          ctx.restore();
        } else if (id === "chicken_egg") {
          ctx.fillStyle = "#f9e79f";
          ctx.beginPath();
          ctx.arc(px + 16, py + 20, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "mailbox") {
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 10, py + 16, 12, 12);
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 14, py + 28, 4, 4);

          if (state.hasUnreadMail) {
            ctx.fillStyle = "#e74c3c";
            ctx.fillRect(px + 20, py + 10, 4, 6);
          } else {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(px + 20, py + 22, 6, 2);
          }
        } else if (id === "pet_bowl_dog" || id === "pet_bowl_cat") {
          ctx.fillStyle = "#8d6e63";
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 22, 9, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (t.watered) {
            ctx.fillStyle = "#3498db";
            ctx.beginPath();
            ctx.ellipse(px + 16, py + 21, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (id === "worker_cabin") {
          // Premium cabin with shadow base and chimneys smoke trigger in app
          ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 28, 14, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#8d6e63";
          ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 12);
          ctx.fillStyle = "#5d4037";
          ctx.fillRect(px + 4, py + 16, TILE - 8, 2);
          ctx.fillRect(px + 4, py + 22, TILE - 8, 2);

          ctx.fillStyle = "#c62828"; // roof
          ctx.beginPath();
          ctx.moveTo(px + 16, py + 2);
          ctx.lineTo(px, py + 12);
          ctx.lineTo(px + TILE, py + 12);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#b71c1c";
          ctx.fillRect(px + 4, py + 10, TILE - 8, 2);

          ctx.fillStyle = "#d84315"; // door
          ctx.fillRect(px + 12, py + 18, 8, 14);
          ctx.fillStyle = "#fdd835";
          ctx.fillRect(px + 13, py + 19, 6, 13);

          ctx.fillStyle = "#3e2723"; // window
          ctx.fillRect(px + 22, py + 16, 6, 6);
          const glow = (phase === "night" || phase === "evening") ? "#f1c40f" : "#85c1e9";
          ctx.fillStyle = glow;
          ctx.fillRect(px + 23, py + 17, 4, 4);
        } else if (id === "furnace") {
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 4, py + 8, TILE - 8, TILE - 8);
          ctx.fillStyle = "#566573";
          ctx.fillRect(px + 4, py + 8, TILE - 8, 2);
          ctx.fillRect(px + 4, py + 8, 2, TILE - 8);
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 10, py + 18, 12, 10);
          if (t.smeltActive) {
            const fireGlow = Math.sin(Date.now() / 90) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(230, 126, 34, ${fireGlow})`;
            ctx.fillRect(px + 12, py + 20, 8, 6);
            ctx.fillStyle = `rgba(241, 196, 15, ${fireGlow})`;
            ctx.fillRect(px + 14, py + 22, 4, 3);
          }
        }
      }

      // Render Growing Crops
      if (t.cropId) {
        const def = CROPS[t.cropId];
        const days = def.growDays;
        const currentAge = t.age;
        const isMature = currentAge >= days;

        const cropPx = px + TILE / 2;
        const cropPy = py + TILE - 6;

        let cropSway = 0;
        if (t.lastRustleTime) {
          const elapsed = Date.now() - t.lastRustleTime;
          if (elapsed < 400) {
            cropSway = Math.sin(elapsed * 0.05) * 3 * (1 - elapsed / 400);
          }
        }
        const windSway = Math.sin(Date.now() / 450 + x * 0.5) * 1.2;
        const totalSway = cropSway + windSway;

        ctx.save();
        ctx.translate(cropPx, cropPy);

        if (currentAge === 0) {
          ctx.fillStyle = "#d2b48c";
          ctx.fillRect(-2, -2, 4, 3);
        } else if (!isMature) {
          const progress = currentAge / days;
          const size = Math.floor(progress * 12) + 4;
          ctx.fillStyle = def.stem;
          ctx.fillRect(-3 + totalSway, -size, 6, size);
          ctx.fillRect(-6 + totalSway, -size + 2, 3, 3);
          ctx.fillRect(3 + totalSway, -size + 2, 3, 3);
        } else {
          ctx.fillStyle = def.stem;
          ctx.fillRect(-4 + totalSway, -14, 8, 14);
          ctx.fillStyle = def.accent;
          ctx.beginPath();
          ctx.arc(0 + totalSway, -14, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        if (t.watered || state.weather === "rainy") {
          const cropGlisten = Math.sin(Date.now() / 400 + (x * 13 + y * 7));
          if (cropGlisten > 0.85) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(cropPx - 3 + totalSway, cropPy - 10, 1.5, 1.5);
          }
        }
      }
    }
  }

  // 3. Draw Farm Animals
  if (!state.inMine) {
    if (!state.animals) state.animals = [];
    state.animals.forEach((animal) => {
      if (!animal) return;
      const ax = animal.x * TILE;
      const ay = animal.y * TILE;

      // Draw shadow under animal feet
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(ax + 16, ay + 24, animal.type === "chick" ? 5 : 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      const squish = 1 + Math.sin(Date.now() / 120) * 0.08;

      ctx.save();
      ctx.translate(ax + 16, ay + 24);
      ctx.scale(squish, 2 - squish);

      if (animal.type === "chick") {
        ctx.fillStyle = "#f1c40f";
        ctx.beginPath();
        ctx.arc(0, -6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e67e22";
        ctx.fillRect(3, -8, 3, 2);
        ctx.fillRect(-4, 0, 2, 2);
        ctx.fillRect(2, 0, 2, 2);
      } else {
        ctx.fillStyle = "#ba4a00";
        ctx.fillRect(-8, -12, 16, 12);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-4, -9, 4, 4);
        ctx.fillRect(2, -5, 3, 3);
        ctx.fillStyle = "#ba4a00";
        ctx.fillRect(4, -15, 6, 6);
      }

      ctx.restore();

      if (animal.hasProduce && animal.type === "calf") {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.fillText("🥛", ax + 12, ay - 4);
      }
    });
  }

  // 3b. Draw Farm Pets
  if (!state.inMine && state.pets) {
    state.pets.forEach((pet) => {
      if (!pet) return;
      const px = pet.subX * TILE;
      const py = pet.subY * TILE;

      // Draw shadow under pet feet
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 23, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      const squish = 1 + Math.sin(Date.now() / 150 + pet.friendship) * 0.05;

      ctx.save();
      ctx.translate(px + 16, py + 24);
      ctx.scale(squish, 2 - squish);

      if (pet.type === "dog") {
        ctx.fillStyle = "#ffb74d";
        ctx.fillRect(-6, -10, 12, 10);
        ctx.fillStyle = "#e65100";
        ctx.fillRect(-8, -12, 4, 5);
        ctx.fillRect(4, -12, 4, 5);

        const tailAngle = Math.sin(Date.now() / 80) * 0.3;
        ctx.save();
        ctx.translate(-5, -3);
        ctx.rotate(tailAngle);
        ctx.fillStyle = "#ffb74d";
        ctx.fillRect(-4, -2, 4, 3);
        ctx.restore();
      } else {
        ctx.fillStyle = "#b0bec5";
        ctx.fillRect(-5, -9, 10, 9);
        ctx.fillStyle = "#37474f";
        ctx.beginPath();
        ctx.moveTo(-5, -9);
        ctx.lineTo(-2, -13);
        ctx.lineTo(-1, -9);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, -9);
        ctx.lineTo(2, -13);
        ctx.lineTo(1, -9);
        ctx.fill();
      }

      ctx.restore();

      if (pet.pettedToday) {
        ctx.fillStyle = "#fff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("❤️", px + 16, py - 4);
      }
    });
  }

  // 3c. Draw Hired Workers
  if (!state.inMine && state.workers) {
    state.workers.forEach((worker) => {
      if (!worker) return;
      const wx = worker.subX * TILE;
      const wy = worker.subY * TILE;

      // Draw shadow under worker feet
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(wx + 16, wy + 26, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shirt + overalls
      ctx.fillStyle = "#2196f3";
      ctx.fillRect(wx + 8, wy + 14, 16, 14);
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(wx + 10, wy + 24, 12, 8);
      ctx.fillStyle = "#ffdbac";
      ctx.fillRect(wx + 10, wy + 4, 12, 10);
      ctx.fillStyle = "#f4d03f";
      ctx.fillRect(wx + 6, wy + 4, 20, 2);
      ctx.fillRect(wx + 11, wy, 10, 4);

      // Status text banner
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(wx - 24, wy - 18, TILE + 48, 11);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${worker.name}: ${worker.statusText}`, wx + TILE / 2, wy - 10);
    });
  }

  // 4. Draw NPCs
  if (!state.inMine) {
    Object.keys(NPCS).forEach((id) => {
      const npc = NPCS[id];
      const target = getNPCDestination(id, state.time);
      const nx = target.x * TILE;
      const ny = target.y * TILE;

      // Shadow under NPC
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(nx + 16, ny + 22, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = npc.color;
      ctx.fillRect(nx + 8, ny + 8, 16, 16);
      ctx.fillStyle = "#f5d0a9";
      ctx.fillRect(nx + 10, ny + 2, 12, 8);
      ctx.fillStyle = npc.portraitColor;
      ctx.fillRect(nx + 9, ny, 14, 4);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(nx - 6, ny - 14, TILE + 12, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(npc.name, nx + TILE / 2, ny - 5);
    });
  }

  // 5. Draw Mine Enemies (Slimes)
  if (state.inMine) {
    state.mineEnemies.forEach((slime) => {
      const sx = slime.x * TILE;
      const sy = slime.y * TILE;

      // Draw shadow under slime
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(sx + 16, sy + 24, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const squishX = 1 + Math.sin(Date.now() / 150) * 0.15;
      const squishY = 1 - Math.sin(Date.now() / 150) * 0.15;

      ctx.save();
      ctx.translate(sx + 16, sy + 24);
      ctx.scale(squishX, squishY);

      ctx.fillStyle = slime.color;
      ctx.beginPath();
      ctx.arc(0, -6, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.fillRect(-5, -9, 2, 2);
      ctx.fillRect(3, -9, 2, 2);

      ctx.restore();

      if (slime.hp < slime.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(sx + 4, sy - 8, 24, 4);
        const percent = slime.hp / slime.maxHp;
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(sx + 4, sy - 8, 24 * percent, 4);
      }
    });
  }

  // 6. Draw Player
  const isMoving = Math.abs(p.x - (p.subX ?? p.x)) > 0.01 || Math.abs(p.y - (p.subY ?? p.y)) > 0.01;
  const walkTime = isMoving ? Date.now() / 80 : 0;
  const walkBob = isMoving ? Math.sin(walkTime * 2) * 2 : 0;
  const leftLegOffset = isMoving ? Math.sin(walkTime) * 3 : 0;
  const rightLegOffset = isMoving ? -Math.sin(walkTime) * 3 : 0;

  // Draw shadow under player
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(playerPx, playerPy + 16, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw legs
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(playerPx - 7, playerPy + 10 + leftLegOffset, 6, 8 - leftLegOffset);
  ctx.fillRect(playerPx + 1, playerPy + 10 + rightLegOffset, 6, 8 - rightLegOffset);

  // Body / Shirt
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(playerPx - 8, playerPy - 4 + walkBob, 16, 14);

  // Head / Skin
  ctx.fillStyle = "#f5d0a9";
  ctx.fillRect(playerPx - 6, playerPy - 14 + walkBob, 12, 10);

  // Hair
  ctx.fillStyle = "#5c3a21";
  ctx.fillRect(playerPx - 6, playerPy - 12 + walkBob, 2, 8);
  ctx.fillRect(playerPx + 4, playerPy - 12 + walkBob, 2, 8);

  // Straw Hat
  ctx.fillStyle = "#d2b48c";
  ctx.fillRect(playerPx - 9, playerPy - 15 + walkBob, 18, 2);
  ctx.fillStyle = "#a0522d";
  ctx.fillRect(playerPx - 6, playerPy - 17 + walkBob, 12, 2);
  ctx.fillStyle = "#d2b48c";
  ctx.fillRect(playerPx - 5, playerPy - 21 + walkBob, 10, 4);

  // Eyes
  ctx.fillStyle = "#000";
  if (p.dir === "down") {
    ctx.fillRect(playerPx - 3, playerPy - 9 + walkBob, 2, 2);
    ctx.fillRect(playerPx + 1, playerPy - 9 + walkBob, 2, 2);
  } else if (p.dir === "up") {
    ctx.fillStyle = "#5c3a21";
    ctx.fillRect(playerPx - 6, playerPy - 14 + walkBob, 12, 8);
  } else if (p.dir === "left") {
    ctx.fillRect(playerPx - 4, playerPy - 9 + walkBob, 2, 2);
  } else if (p.dir === "right") {
    ctx.fillRect(playerPx + 2, playerPy - 9 + walkBob, 2, 2);
  }

  // 7. Draw carry item above head
  if (state.harvestLiftingTimer > 0 && state.carryItem) {
    ctx.fillStyle = state.carryItem.iconColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      state.carryItem.iconSymbol || "🥬",
      playerPx,
      playerPy - 24
    );
  }

  // Active Tool Swipe indicator (Factorio style selector box)
  const activeHighlight = hoveredTile || frontTile(state);
  if (activeHighlight && state.harvestLiftingTimer <= 0) {
    const dist = Math.abs(activeHighlight.x - p.x) + Math.abs(activeHighlight.y - p.y);
    const inReach = dist <= 5;

    ctx.strokeStyle = inReach ? "rgba(46, 204, 113, 0.7)" : "rgba(231, 76, 60, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(activeHighlight.x * TILE + 1, activeHighlight.y * TILE + 1, TILE - 2, TILE - 2);

    ctx.fillStyle = inReach ? "rgba(46, 204, 113, 0.08)" : "rgba(231, 76, 60, 0.08)";
    ctx.fillRect(activeHighlight.x * TILE + 2, activeHighlight.y * TILE + 2, TILE - 4, TILE - 4);

    const held = state.inventory[state.hotbarIndex];
    if (held && held.id === "sword" && Math.sin(Date.now() / 60) > 0.6) {
      ctx.strokeStyle = "rgba(236, 240, 241, 0.75)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        playerPx + (activeHighlight.x - p.x) * 18,
        playerPy + (activeHighlight.y - p.y) * 18,
        14,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  // 8. Draw Fishing bobber lines
  if (state.fishing && !state.inMine) {
    const fState = state.fishing;
    if (fState.status === "waiting" || fState.status === "nibble" || fState.status === "reeling") {
      const bx = fState.bobberX * TILE + 16;
      const by = fState.bobberY * TILE + 16;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playerPx, playerPy - 4);
      ctx.lineTo(bx, by);
      ctx.stroke();

      const bBob = Math.sin(Date.now() / 200) * 2;
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(bx - 3, by - 3 + bBob, 6, 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx - 3, by - 3 + bBob, 6, 2);

      if (fState.status === "nibble") {
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", bx, by - 12 + bBob);
      }
    }
  }

  ctx.restore(); // restore viewport transform

  // 9. Ambient Night/Evening Lighting filter
  if (phase !== "morning") {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = viewWidth;
    tempCanvas.height = viewHeight;
    const tCtx = tempCanvas.getContext("2d");

    if (tCtx) {
      tCtx.fillStyle = phase === "night" ? "rgba(10, 15, 40, 0.72)" : "rgba(230, 126, 34, 0.28)";
      tCtx.fillRect(0, 0, viewWidth, viewHeight);

      tCtx.globalCompositeOperation = "destination-out";

      // Player light radius
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

      // Placed torches light radius
      for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
          const t = currentGrid[y][x];
          if (t.kind === "placed_item" && t.placedItemId === "torch") {
            const torchViewX = x * TILE + 16 - cameraX;
            const torchViewY = y * TILE + 10 - cameraY;
            const torchRad = 90 + Math.sin(Date.now() / 60) * 4;
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

      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
}

export function sortInventory(inventory: (Item | null)[]): (Item | null)[] {
  const items = inventory.filter((item): item is Item => item !== null);
  const typeOrder = ["tool", "weapon", "seed", "crop", "fish", "resource", "furniture", "trash"];
  items.sort((a, b) => {
    const indexA = typeOrder.indexOf(a.type);
    const indexB = typeOrder.indexOf(b.type);
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    return a.name.localeCompare(b.name);
  });
  const newInventory = Array(inventory.length).fill(null);
  for (let i = 0; i < items.length; i++) {
    newInventory[i] = items[i];
  }
  return newInventory;
}

export function quickStackToChest(playerInv: (Item | null)[], chestInv: (Item | null)[]): boolean {
  let movedAny = false;
  for (let i = 0; i < playerInv.length; i++) {
    const pItem = playerInv[i];
    if (pItem && pItem.type !== "tool" && pItem.type !== "weapon" && pItem.type !== "furniture") {
      for (let j = 0; j < chestInv.length; j++) {
        const cItem = chestInv[j];
        if (cItem && cItem.id === pItem.id) {
          cItem.count += pItem.count;
          playerInv[i] = null;
          movedAny = true;
          break;
        }
      }
    }
  }
  return movedAny;
}
