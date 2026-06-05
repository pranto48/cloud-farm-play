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
  // Overhaul states
  animals: Animal[];
  mailboxLetters: MailLetter[];
  hasUnreadMail: boolean;
  harvestLiftingTimer: number; // freeze remaining duration
  carryItem: Item | null; // visually drawn above head
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

  // Overgrown debris
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
        if (depth >= 9 && Math.random() < 0.4) {
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

export function newGame(): GameState {
  const inv = Array.from({ length: 24 }, () => null as Item | null);

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
    upgrades: { hoe: 1, watering: 1, scythe: 1, pickaxe: 1 },
    // Overhaul elements
    animals: [],
    mailboxLetters: initialLetters,
    hasUnreadMail: true,
    harvestLiftingTimer: 0,
    carryItem: null,
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
    t.kind !== "placed_item" // chests & sprinklers block movement
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

// Interact tool calculations
export function interact(state: GameState): { message: string | null; particles: Particle[] } {
  const result: { message: string | null; particles: Particle[] } = { message: null, particles: [] };

  // Harvest freeze check
  if (state.harvestLiftingTimer > 0) return result;

  const isExhausted = state.energy <= 0;
  const f = frontTile(state);
  if (!f) return result;

  const grid = state.inMine ? state.mineGrid : state.tiles;
  const tile = grid[f.y][f.x];
  const px = f.x * TILE + TILE / 2;
  const py = f.y * TILE + TILE / 2;

  const heldItem = state.inventory[state.hotbarIndex];
  const toolEnergyCost = 2;

  // 1. Milking Cows logic with milk_pail
  if (heldItem && heldItem.id === "milk_pail") {
    // Check if facing a Calf/Cow animal
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
    case "hoe":
      if (tile.kind === "grass") {
        if (state.energy < toolEnergyCost) {
          result.message = "No energy!";
          return result;
        }
        state.energy -= toolEnergyCost;
        tile.kind = "soil";
        gameAudio.playTill();

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
      if (tile.kind === "debris_stone") {
        state.energy -= toolEnergyCost;
        tile.kind = state.inMine ? "mine_dirt" : "grass";
        gameAudio.playMine();

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
      } else if (tile.kind === "ore_copper" || tile.kind === "ore_iron" || tile.kind === "ore_gold") {
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
      } else if (tile.kind === "placed_item" && tile.placedItemId) {
        // Break sprinklers/fences/chests
        state.energy -= toolEnergyCost;
        const id = tile.placedItemId;
        const itemObj = createItem(id, 1);

        if (id === "chest" && tile.chestInventory) {
          for (const item of tile.chestInventory) {
            if (item) addItem(state.inventory, item);
          }
        }

        // Fences return grass backdrop
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
      if (tile.kind === "tree") {
        state.energy -= toolEnergyCost;
        tile.kind = "grass";
        gameAudio.playChop();

        addItem(state.inventory, createItem("wood", Math.floor(Math.random() * 4) + 3));
        // Chance of dropping saplings/apples
        if (Math.random() < 0.2) {
          addItem(state.inventory, createItem("parsnip_seed", 1)); // stand in for tree seed
        }
        const lvlMsg = addExperience(state, "farming", 8);
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
      } else if (tile.kind === "debris_branch") {
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
  state.animals.forEach((animal) => {
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

      if (t.kind === "grass" && Math.random() < 0.005) {
        t.kind = "debris_weed";
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

    const choice = letters[Math.floor(Math.random() * letters.length)];
    state.mailboxLetters.push(choice);
    state.hasUnreadMail = true;
  }

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

// ----------------------------- OVERHAUL GRAPHICS RENDERER -----------------------------
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

  const p = state.player;
  const playerPx = p.x * TILE + TILE / 2;
  const playerPy = p.y * TILE + TILE / 2;

  const cameraX = Math.max(
    0,
    Math.min(gridCols * TILE - viewWidth, playerPx - viewWidth / 2)
  );
  const cameraY = Math.max(
    0,
    Math.min(gridRows * TILE - viewHeight, playerPy - viewHeight / 2)
  );

  ctx.fillStyle = state.inMine ? "#231f20" : "#7ec77a";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  const startCol = Math.max(0, Math.floor(cameraX / TILE));
  const endCol = Math.min(gridCols, Math.ceil((cameraX + viewWidth) / TILE));
  const startRow = Math.max(0, Math.floor(cameraY / TILE));
  const endRow = Math.min(gridRows, Math.ceil((cameraY + viewHeight) / TILE));

  // 1. Terrain Tiles Layer
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (t.kind === "grass") {
        // Detailed seamless grass drawing
        ctx.fillStyle = (x + y) % 2 === 0 ? "#7ec77a" : "#74bf72";
        ctx.fillRect(px, py, TILE, TILE);

        // draw cute floral accents
        if ((x * 17 + y * 23) % 9 === 0) {
          ctx.fillStyle = "#8ad186";
          ctx.fillRect(px + 4, py + 8, 2, 4);
          ctx.fillRect(px + 20, py + 18, 2, 3);
        }
        if ((x * 11 + y * 7) % 20 === 0) {
          ctx.fillStyle = "#f39c12"; // orange bloom
          ctx.fillRect(px + 14, py + 12, 3, 3);
        }
      } else if (t.kind === "mine_dirt") {
        // stone paving texture
        ctx.fillStyle = (x + y) % 2 === 0 ? "#3d312a" : "#352b25";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#2c231e";
        if ((x * 3 + y) % 5 === 0) ctx.fillRect(px + 6, py + 14, 8, 2);
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
      } else if (t.kind === "path") {
        ctx.fillStyle = "#ceb48a"; // sandy path
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#bd9e72";
        if ((x + y) % 4 === 0) {
          ctx.fillRect(px, py, 4, 4);
          ctx.fillRect(px + 16, py + 16, 4, 4);
        }
      } else if (t.kind === "water") {
        // Wave Crest Ripple calculations
        const wave = Math.sin(Date.now() / 250 + x * 0.4) * 2;
        ctx.fillStyle = "#3498db";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5dade2";
        ctx.fillRect(px + 4, py + 8 + wave, 6, 2);
        ctx.fillRect(px + 18, py + 20 - wave, 8, 2);

        // Stepping water lily pads
        if ((x * 13 + y * 9) % 23 === 0) {
          ctx.fillStyle = "#27ae60";
          ctx.beginPath();
          ctx.arc(px + 16, py + 16, 5, 0, Math.PI * 1.75);
          ctx.fill();
        }
      } else if (t.kind === "soil" || t.kind === "watered") {
        ctx.fillStyle = t.kind === "watered" ? "#4a3120" : "#8a5a3b";
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else if (t.kind === "house") {
        // Detailed Stardew wood cabin drawing
        ctx.fillStyle = "#935116"; // rustic siding
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5c330e";
        // horizontal boards
        for (let i = 6; i < TILE; i += 8) {
          ctx.fillRect(px, py + i, TILE, 2);
        }
      } else if (t.kind === "shop") {
        ctx.fillStyle = "#965d34";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#e59866";
        ctx.fillRect(px + 4, py + 14, TILE - 8, 10); // display counter
      } else if (t.kind === "mine_cave") {
        ctx.fillStyle = "#7ec77a";
        ctx.fillRect(px, py, TILE, TILE);
        // cave arch
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 6);
        ctx.fillStyle = "#17202a";
        ctx.fillRect(px + 8, py + 12, TILE - 16, TILE - 12);
      }

      // Draw weeds/branches/stones debris
      if (t.kind === "debris_weed") {
        ctx.fillStyle = "#27ae60";
        ctx.fillRect(px + 8, py + 16, 16, 12);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(px + 12, py + 8, 8, 10);
      } else if (t.kind === "debris_branch") {
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(px + 6, py + 18, 20, 5);
        ctx.fillRect(px + 18, py + 12, 5, 8);
      } else if (t.kind === "debris_stone" || t.kind === "ore_copper" || t.kind === "ore_iron" || t.kind === "ore_gold") {
        ctx.fillStyle = t.kind === "debris_stone" ? "#839192" : "#566573";
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 26);
        ctx.lineTo(px + 16, py + 6);
        ctx.lineTo(px + 26, py + 26);
        ctx.fill();

        if (t.kind === "ore_copper") {
          ctx.fillStyle = "#e67e22";
          ctx.fillRect(px + 14, py + 14, 4, 4);
        } else if (t.kind === "ore_iron") {
          ctx.fillStyle = "#bdc3c7";
          ctx.fillRect(px + 14, py + 14, 4, 4);
        } else if (t.kind === "ore_gold") {
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(px + 13, py + 12, 5, 5);
        }
      }

      // Draw placed objects (Basic/Quality Sprinklers, Fences, Torches)
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
          ctx.fillRect(px + 4, py + 8, 24, 4); // hat rim
          ctx.fillRect(px + 10, py + 2, 12, 6);
          ctx.fillStyle = "#5c3a21";
          ctx.fillRect(px + 15, py + 24, 2, 8);
        } else if (id === "sprinkler_basic" || id === "sprinkler_quality") {
          // Sprinkler render
          ctx.fillStyle = id === "sprinkler_basic" ? "#2980b9" : "#f1c40f";
          ctx.fillRect(px + 10, py + 18, 12, 8); // base
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 15, py + 8, 2, 10); // rod

          // Draw spinning sprinkler arms based on time rotation
          ctx.save();
          ctx.translate(px + 16, py + 8);
          ctx.rotate(Date.now() / 150);
          ctx.fillStyle = "#95a5a6";
          ctx.fillRect(-6, -1, 12, 2);
          ctx.restore();
        } else if (id === "chicken_egg") {
          // Egg dropped on ground
          ctx.fillStyle = "#f9e79f";
          ctx.beginPath();
          ctx.arc(px + 16, py + 20, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "mailbox") {
          // Mailbox next to player house
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 10, py + 16, 12, 12);
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 14, py + 28, 4, 4); // stand

          // Unread mail flag indicator
          if (state.hasUnreadMail) {
            ctx.fillStyle = "#e74c3c";
            ctx.fillRect(px + 20, py + 10, 4, 6); // red flag up
          } else {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(px + 20, py + 22, 6, 2); // flag down
          }
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

        if (currentAge === 0) {
          ctx.fillStyle = "#d2b48c";
          ctx.fillRect(cropPx - 2, cropPy - 2, 4, 3);
        } else if (!isMature) {
          const progress = currentAge / days;
          const size = Math.floor(progress * 12) + 4;
          ctx.fillStyle = def.stem;
          ctx.fillRect(cropPx - 3, cropPy - size, 6, size);
          ctx.fillRect(cropPx - 6, cropPy - size + 2, 3, 3);
          ctx.fillRect(cropPx + 3, cropPy - size + 2, 3, 3);
        } else {
          ctx.fillStyle = def.stem;
          ctx.fillRect(cropPx - 4, cropPy - 14, 8, 14);
          ctx.fillStyle = def.accent;
          ctx.beginPath();
          ctx.arc(cropPx, cropPy - 14, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // 3. Draw Farm Animals
  if (!state.inMine) {
    state.animals.forEach((animal) => {
      const ax = animal.x * TILE;
      const ay = animal.y * TILE;

      // Squish animation on hop
      const squish = 1 + Math.sin(Date.now() / 120) * 0.08;

      ctx.save();
      ctx.translate(ax + 16, ay + 24);
      ctx.scale(squish, 2 - squish);

      if (animal.type === "chick") {
        // Chick render
        ctx.fillStyle = "#f1c40f"; // yellow
        ctx.beginPath();
        ctx.arc(0, -6, 6, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = "#e67e22";
        ctx.fillRect(3, -8, 3, 2);
        // Feet
        ctx.fillRect(-4, 0, 2, 2);
        ctx.fillRect(2, 0, 2, 2);
      } else {
        // Calf / Cow render
        ctx.fillStyle = "#ba4a00"; // brown calf
        ctx.fillRect(-8, -12, 16, 12);
        // Spots
        ctx.fillStyle = "#fff";
        ctx.fillRect(-4, -9, 4, 4);
        ctx.fillRect(2, -5, 3, 3);
        // Head bobbing
        ctx.fillStyle = "#ba4a00";
        ctx.fillRect(4, -15, 6, 6);
      }

      ctx.restore();

      // Show milk drops if ready to milk
      if (animal.hasProduce && animal.type === "calf") {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.fillText("🥛", ax + 12, ay - 4);
      }
    });
  }

  // 4. Draw NPCs
  if (!state.inMine) {
    Object.keys(NPCS).forEach((id) => {
      const npc = NPCS[id];
      const target = getNPCDestination(id, state.time);
      const nx = target.x * TILE;
      const ny = target.y * TILE;

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

  // 5. Draw Mine Enemies
  if (state.inMine) {
    state.mineEnemies.forEach((slime) => {
      const sx = slime.x * TILE;
      const sy = slime.y * TILE;
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
  const walkBob = Math.sin(Date.now() / 100) * 1.5;
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(px + 9 - cameraX, py + 18 - cameraY, 14, 8);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(px + 8 - cameraX, py + 8 + walkBob - cameraY, 16, 11);
  ctx.fillStyle = "#f5d0a9";
  ctx.fillRect(px + 10 - cameraX, py + 2 + walkBob - cameraY, 12, 8);
  ctx.fillStyle = "#8a5a3b";
  ctx.fillRect(px + 9 - cameraX, py + walkBob - cameraY, 14, 3);

  ctx.fillStyle = "#000";
  if (p.dir === "down") {
    ctx.fillRect(px + 12 - cameraX, py + 6 + walkBob - cameraY, 2, 2);
    ctx.fillRect(px + 18 - cameraX, py + 6 + walkBob - cameraY, 2, 2);
  } else if (p.dir === "up") {
    ctx.fillStyle = "#8a5a3b";
    ctx.fillRect(px + 10 - cameraX, py + 2 + walkBob - cameraY, 12, 6);
  } else if (p.dir === "left") {
    ctx.fillRect(px + 11 - cameraX, py + 6 + walkBob - cameraY, 2, 2);
  } else if (p.dir === "right") {
    ctx.fillRect(px + 19 - cameraX, py + 6 + walkBob - cameraY, 2, 2);
  }

  // 7. Draw carry item above head (Lifting animation)
  if (state.harvestLiftingTimer > 0 && state.carryItem) {
    ctx.fillStyle = state.carryItem.iconColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      state.carryItem.iconSymbol || "🥬",
      playerPx - cameraX,
      playerPy - 24 - cameraY
    );
  }

  // Active Tool Swipe arc
  const f = frontTile(state);
  if (f && state.harvestLiftingTimer <= 0) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x * TILE + 2 - cameraX, f.y * TILE + 2 - cameraY, TILE - 4, TILE - 4);

    const held = state.inventory[state.hotbarIndex];
    if (held && held.id === "sword" && Math.sin(Date.now() / 60) > 0.6) {
      ctx.strokeStyle = "rgba(236, 240, 241, 0.75)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        playerPx + (f.x - p.x) * 18 - cameraX,
        playerPy + (f.y - p.y) * 18 - cameraY,
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
      ctx.moveTo(playerPx - cameraX, playerPy - 4 - cameraY);
      ctx.lineTo(bx - cameraX, by - cameraY);
      ctx.stroke();

      const bBob = Math.sin(Date.now() / 200) * 2;
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(bx - 3 - cameraX, by - 3 + bBob - cameraY, 6, 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx - 3 - cameraX, by - 3 + bBob - cameraY, 6, 2);

      if (fState.status === "nibble") {
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", bx - cameraX, by - 12 + bBob - cameraY);
      }
    }
  }

  ctx.restore(); // restore viewport transform

  // 9. Ambient Lighting filter
  const phase = getTimePhase(state.time);
  if (phase !== "morning") {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = viewWidth;
    tempCanvas.height = viewHeight;
    const tCtx = tempCanvas.getContext("2d");

    if (tCtx) {
      tCtx.fillStyle = phase === "night" ? "rgba(10, 15, 40, 0.72)" : "rgba(230, 126, 34, 0.28)";
      tCtx.fillRect(0, 0, viewWidth, viewHeight);

      tCtx.globalCompositeOperation = "destination-out";

      // player lighting radius
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

      // Placed torches radius
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
