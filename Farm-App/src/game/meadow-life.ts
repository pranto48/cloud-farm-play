import { consumeCursor, getCursor, QUICKBAR_SIZE } from "./item-cursor";
import { tickDefense, type Patrol, type Signal, type Wildlife } from "./field-play";
import { drawBasinWater, drawConveyor, drawEvergreen, drawGroundDetail, drawIndustrialSurface, drawWorkshopItem, drawYardMachine } from "./yard-art";
import { ITEM_DEFS, createItem, type Item } from "./data/items";
import { shopInventoryForSeason, CROPS, type CropDef, type Season } from "./data/crops";
import { NPCS, getNPCDestination, type NPCDef } from "./npcs";
import { FISH_TYPES, type FishingState } from "./fishing";
import { gameAudio } from "./audio";

export const TILE = 32;
export const COLS = 500;
export const ROWS = 500;

let _cachedLightCanvas: HTMLCanvasElement | null = null;

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
  | "ore_silver"
  | "ore_aluminum"
  | "ore_coal"
  | "ore_uranium"
  | "ore_crude_oil"
  | "house_wall"
  | "house_floor"
  | "house_bed"
  | "house_door"
  | "placed_item";

type BeltItem = { id: string; offset: number; lane: 0 | 1 };

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
  direction?: "up" | "down" | "left" | "right";
  chestInventory?: (Item | null)[];
  chestBarLimit?: number;
  beltItems?: BeltItem[];
  looseItems?: Item[];
  structureHp?: number;
  aimAngle?: number;
  fireCooldown?: number;
  foundation?: TileKind;
  paving?: string;
  pavingUnderlay?: TileKind;
  buildPlan?: { id: string; direction: NonNullable<Tile["direction"]> };
  depositRemaining?: number;
  fuelSeconds?: number;
  splitterOutput?: 0 | 1;
  labSeconds?: number;
  machineStatus?: "running" | "idle" | "blocked" | "fuel" | "power" | "depleted" | "damaged";
  /** Factorio Robotic Inserter state */
  inserterArmAngle?: number;
  inserterHolding?: Item | null;
  /** Factorio Assembling Machine state */
  assemblerRecipeId?: string;
  assemblerProgress?: number;
  assemblerMaxProgress?: number;
  /** Factorio Mining Drill state */
  drillTimer?: number;
  drillMaxTime?: number;
  drillTargetOre?: string;
  /** Power grid attributes */
  powerDemandKw?: number;
  powerProductionKw?: number;
  powerSupplyRadius?: number;
  /** Assigned work zone. */
  zone?: "farming" | "mining" | "woodcutting" | "water";
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
  type?: "leaf" | "stone" | "water" | "smoke" | "heart" | "dust" | "spark";
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

export interface HandcraftJob {
  id: string;
  recipeId: string;
  name: string;
  iconSymbol: string;
  iconColor: string;
  progress: number;
  duration: number;
  remainingTime: number;
  refundInputs: { itemId: string; count: number }[];
  outputs: { itemId: string; count: number }[];
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
    shield?: number;
    maxShield?: number;
    reachDistance?: number;
    lastDamageTime?: number;
    walkSeconds?: number;
    actionSeconds?: number;
    shotCooldown?: number;
    weaponId?: string;
    isCharacterDetached?: boolean;
    dressColor?: string;
    secondaryColor?: string;
    suitType?: "engineer" | "heavy" | "modular" | "power_armor";
    helmetType?: "none" | "cap" | "visor" | "helmet" | "power_visor";
    skinTone?: "default" | "tan" | "fair" | "dark";
  };
  characterCorpses?: {
    id: string;
    x: number;
    y: number;
    items: (Item | null)[];
    timestamp: number;
  }[];
  settings?: {
    fpsLimit: 30 | 60 | 120 | 144 | 0;
    graphicsQuality: "low" | "medium" | "high" | "ultra";
    showGrid: boolean;
    showPollution?: boolean;
    showFpsOverlay: boolean;
    shadowsEnabled: boolean;
    particleDensity: "low" | "medium" | "high";
    desktopMode: boolean;
  };
  cloudSave?: {
    lastCloudSaveTimestamp: number | null;
    cloudStatus: "synced" | "saving" | "idle" | "error";
  };
  blueprint?: {
    mode: "copy" | "stamp" | "deconstruct" | null;
    startTile?: { x: number; y: number } | null;
    currentTile?: { x: number; y: number } | null;
    savedEntities?: { relX: number; relY: number; placedItemId: string; direction?: Tile["direction"]; recipeId?: string }[];
  } | null;
  day: number;
  time: number;
  inventory: (Item | null)[];
  handcraftQueue?: HandcraftJob[];
  hotbarIndex: number;
  quickbar: (string | null)[];
  cursorStack?: Item | null;
  cursorOrigin?: number;
  cursorRefill?: boolean;
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
  freeCraft?: boolean;
  unlockedTechs?: string[];
  researchPoints?: number;
  activeResearchId?: string;
  researchProgress?: number;
  workerAssignments?: Record<string, string>; // workerId -> 'research_center' | 'farm'
  purchasedLands?: string[]; // IDs of purchased land parcels
  currentRoomId?: string;
  currentRoomCode?: string;
  remotePlayers?: RemotePlayer[];
  savedRoomMaps?: Record<string, Tile[][]>; // Separate map instance per room!
  /** Factorio Power Grid state */
  powerGridStats?: {
    capacityKw: number;
    demandKw: number;
    satisfaction: number;
    accumulatorStorageMj: number;
    maxStorageMj: number;
  };
  /** Factorio Pollution Grid (pollution per tile) */
  pollutionGrid?: number[][];
  /** Factorio Biter Evolution Factor (0.0 to 1.0) */
  evolutionFactor?: number;
  /** Factorio Factory Production Stats (P-key window) */
  productionStats?: {
    produced: Record<string, number>;
    consumed: Record<string, number>;
    powerProducedKw: number;
    powerConsumedKw: number;
    pollutionTotal: number;
  };
  biters?: Wildlife[];
  patrol?: Patrol;
  combatFx?: Signal[];
  placementDirection?: "up" | "down" | "left" | "right";
  activeInspectorTile?: { x: number; y: number } | null;
  /** Factorio Alt-Mode info overlay toggle */
  altMode?: boolean;
}

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  subX: number;
  subY: number;
  dir: "up" | "down" | "left" | "right";
  color: string;
  avatarSymbol: string;
  statusText?: string;
  pingMs?: number;
}

export interface MultiplayerRoom {
  id: string;
  name: string;
  code: string;
  mapSeed: number;
  isPrivate: boolean;
  maxPlayers: number;
  players: RemotePlayer[];
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

export function getGlobalItemCount(stateOrInv: any, itemId: string): number {
  const inv = Array.isArray(stateOrInv)
    ? stateOrInv
    : stateOrInv && Array.isArray(stateOrInv.inventory)
    ? stateOrInv.inventory
    : [];
  let found = 0;
  for (const item of inv) {
    if (item && item.id === itemId) {
      found += item.count;
    }
  }
  return found;
}

export function hasItems(inventory: (Item | null)[], itemId: string, count = 1): boolean {
  return getGlobalItemCount(inventory, itemId) >= count;
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

  // Factorio Research Tech Tree
  {
    id: "tech_factorio_logistics",
    name: "Yard Logistics",
    description: "Unlocks expanded burner extraction and opens the electronics branch.",
    icon: "⏩",
    cost: 150,
    prerequisites: ["tech_advanced_tools"],
    unlocks: "Burner drill recipes and electronics research",
  },
  {
    id: "tech_electronics",
    name: "Electronics & Automation",
    description: "Unlocks Green Electronic Circuits, Steel Plates, Inserters, and Assembling Machine 1.",
    icon: "🟩",
    cost: 250,
    prerequisites: ["tech_factorio_logistics"],
    unlocks: "Electronic Circuit, Steel Plate, Inserter, Assembling Machine 1 recipes",
  },
  {
    id: "tech_electricity",
    name: "Electrical Grid & Power",
    description: "Unlocks Steam Generators, Industrial Boilers, Solar Panels, Power Poles, and Electric Mining Drills.",
    icon: "⚡",
    cost: 300,
    prerequisites: ["tech_electronics"],
    unlocks: "Boiler, Generator, Solar Panel, Power Pole, Electric Drill recipes",
  },
  {
    id: "tech_logistics_2",
    name: "Advanced Logistics 2",
    description: "Unlocks Fast Transport Belts, Underground Belts, Conveyor Splitters, and Fast Inserters.",
    icon: "🔀",
    cost: 400,
    prerequisites: ["tech_electronics"],
    unlocks: "Fast Belt, Underground Belt, Splitter, Fast Inserter recipes",
  },
  {
    id: "tech_advanced_material_processing",
    name: "Advanced Material Processing",
    description: "Unlocks Steel Furnaces, Electric Smelting Furnaces, and Assembling Machine 2.",
    icon: "🏭",
    cost: 450,
    prerequisites: ["tech_electricity"],
    unlocks: "Steel Furnace, Electric Furnace, Assembling Machine 2 recipes",
  },
  {
    id: "tech_oil_processing",
    name: "Oil Processing & Chemicals",
    description: "Unlocks Chemical Plants, Plastic Bars, Sulfur, and Advanced Circuits (Red).",
    icon: "🧪",
    cost: 600,
    prerequisites: ["tech_advanced_material_processing"],
    unlocks: "Chemical Plant, Plastic Bar, Sulfur, Advanced Circuit recipes",
  },
  {
    id: "tech_advanced_electronics",
    name: "High-Tech Processing Units",
    description: "Unlocks Engine Units, Electric Engine Units, Processing Units (Blue), and Accumulator Batteries.",
    icon: "🟦",
    cost: 800,
    prerequisites: ["tech_oil_processing"],
    unlocks: "Engine Unit, Electric Engine, Processing Unit, Accumulator recipes",
  },
  {
    id: "tech_drone_logistics",
    name: "Robotics & Logistics Drones",
    description: "Unlocks Flying Robot Frames, Logistics Drones, Drone Station Hubs, and Warehouse Logistics Chests.",
    icon: "🚁",
    cost: 1000,
    prerequisites: ["tech_advanced_electronics"],
    unlocks: "Logistics Drone, Drone Hub, Logistics Chest recipes",
  },
  {
    id: "tech_space_rocket",
    name: "Rocket Silo & Space Exploration",
    description: "Unlocks Solid Rocket Fuel, Rocket Components, Satellites, and Rocket Launch Silo for planetary victory!",
    icon: "🚀",
    cost: 1500,
    prerequisites: ["tech_drone_logistics"],
    unlocks: "Rocket Silo, Rocket Fuel, Rocket Part, Satellite recipes",
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
  techRequired?: string;
  craftTimeSeconds?: number;
}

export const CRAFTING_RECIPES: Recipe[] = [
  // --- Factorio Logistics ---
  {
    id: "transport_belt",
    name: "Transport Belt",
    description: "Automated conveyor belt moving items continuously. Rotate with 'R'.",
    inputs: [{ itemId: "iron_gear", count: 1 }, { itemId: "iron_bar", count: 1 }],
    outputId: "transport_belt",
    outputCount: 2,
    craftTimeSeconds: 0.5,
  },
  {
    id: "fast_transport_belt",
    name: "Fast Transport Belt",
    description: "High-speed red conveyor belt moving items at 2x velocity.",
    inputs: [{ itemId: "transport_belt", count: 1 }, { itemId: "iron_gear", count: 5 }],
    outputId: "fast_transport_belt",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "underground_belt",
    name: "Underground Belt",
    description: "Conveyor tunnel that routes items under obstacles up to 6 tiles.",
    inputs: [{ itemId: "transport_belt", count: 5 }, { itemId: "iron_bar", count: 10 }],
    outputId: "underground_belt",
    outputCount: 2,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 1.0,
  },
  {
    id: "splitter",
    name: "Conveyor Splitter",
    description: "Splits incoming belt items 50/50 evenly across two output lines.",
    inputs: [{ itemId: "transport_belt", count: 4 }, { itemId: "iron_gear", count: 5 }, { itemId: "electronic_circuit", count: 5 }],
    outputId: "splitter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 1.0,
  },
  {
    id: "inserter",
    name: "Robotic Inserter",
    description: "Robotic arm that picks items from behind and inserts them in front.",
    inputs: [{ itemId: "electronic_circuit", count: 1 }, { itemId: "iron_gear", count: 1 }, { itemId: "iron_bar", count: 1 }],
    outputId: "inserter",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "fast_inserter",
    name: "Fast Inserter",
    description: "High-speed electric robotic arm with 2x swing speed.",
    inputs: [{ itemId: "inserter", count: 1 }, { itemId: "electronic_circuit", count: 2 }, { itemId: "iron_bar", count: 2 }],
    outputId: "fast_inserter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "long_inserter",
    name: "Long-Handed Inserter",
    description: "Red inserter that reaches 2 tiles over adjacent belt lines.",
    inputs: [{ itemId: "inserter", count: 1 }, { itemId: "iron_gear", count: 1 }, { itemId: "iron_bar", count: 1 }],
    outputId: "long_inserter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "filter_inserter",
    name: "Filter Inserter",
    description: "Smart robotic inserter that filters and picks only selected item types.",
    inputs: [{ itemId: "fast_inserter", count: 1 }, { itemId: "electronic_circuit", count: 4 }],
    outputId: "filter_inserter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "chest",
    name: "Wood Chest",
    description: "A wooden storage box that holds 12 items.",
    inputs: [{ itemId: "wood", count: 20 }],
    outputId: "chest",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "iron_chest",
    name: "Iron Storage Chest",
    description: "Metal container storing up to 24 item stacks.",
    inputs: [{ itemId: "iron_bar", count: 8 }],
    outputId: "iron_chest",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "steel_chest",
    name: "Steel Storage Container",
    description: "Heavy-duty industrial steel container storing up to 48 item stacks.",
    inputs: [{ itemId: "steel_plate", count: 8 }],
    outputId: "steel_chest",
    outputCount: 1,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 0.5,
  },
  {
    id: "logistics_chest",
    name: "Logistics Warehouse Chest",
    description: "High capacity 60-slot logistics container for automated drone delivery.",
    inputs: [{ itemId: "steel_chest", count: 1 }, { itemId: "electronic_circuit", count: 10 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "logistics_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 1.0,
  },

  // --- Factorio Production Machinery ---
  {
    id: "burner_drill",
    name: "Burner Mining Drill",
    description: "Coal-powered mining drill that extracts ores from ground deposits and ejects them in front.",
    inputs: [{ itemId: "furnace", count: 1 }, { itemId: "iron_gear", count: 3 }, { itemId: "iron_bar", count: 3 }],
    outputId: "burner_drill",
    outputCount: 1,
    techRequired: "tech_factorio_logistics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "electric_drill",
    name: "Electric Mining Drill",
    description: "Electric drill that automatically excavates ground ores directly onto belts.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "iron_gear", count: 5 }, { itemId: "iron_bar", count: 10 }],
    outputId: "electric_drill",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 2.0,
  },
  {
    id: "stone_furnace",
    name: "Stone Furnace",
    description: "Smelts ores into iron, copper, and gold bars using coal fuel.",
    inputs: [{ itemId: "stone", count: 20 }],
    outputId: "stone_furnace",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "steel_furnace",
    name: "Steel Furnace",
    description: "Reinforced steel smelting furnace with 2x smelting speed.",
    inputs: [{ itemId: "stone_furnace", count: 1 }, { itemId: "steel_plate", count: 6 }, { itemId: "stone", count: 10 }],
    outputId: "steel_furnace",
    outputCount: 1,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 3.0,
  },
  {
    id: "electric_furnace",
    name: "Electric Smelting Furnace",
    description: "Clean high-capacity electric furnace powered directly by the power grid.",
    inputs: [{ itemId: "steel_furnace", count: 1 }, { itemId: "steel_plate", count: 10 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "electric_furnace",
    outputCount: 1,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 4.0,
  },
  {
    id: "assembling_machine_1",
    name: "Assembling Machine 1",
    description: "Automated factory machine that crafts parts, belts, circuits, and machinery continuously.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "iron_gear", count: 5 }, { itemId: "iron_bar", count: 9 }],
    outputId: "assembling_machine_1",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "assembling_machine_2",
    name: "Assembling Machine 2",
    description: "Advanced blue factory assembler with 1.5x crafting speed.",
    inputs: [{ itemId: "assembling_machine_1", count: 1 }, { itemId: "electronic_circuit", count: 3 }, { itemId: "iron_gear", count: 5 }, { itemId: "steel_plate", count: 2 }],
    outputId: "assembling_machine_2",
    outputCount: 1,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 2.0,
  },
  {
    id: "assembling_machine_3",
    name: "Assembling Machine 3",
    description: "High-tier yellow assembling machine with maximum speed.",
    inputs: [{ itemId: "assembling_machine_2", count: 1 }, { itemId: "advanced_circuit", count: 4 }, { itemId: "engine_unit", count: 2 }],
    outputId: "assembling_machine_3",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 3.0,
  },
  {
    id: "chemical_plant",
    name: "Chemical Plant",
    description: "Processes petroleum and fluids into plastics, sulfur, and rocket fuel.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "iron_gear", count: 5 }, { itemId: "electronic_circuit", count: 5 }, { itemId: "stone", count: 5 }],
    outputId: "chemical_plant",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 3.0,
  },
  {
    id: "science_lab",
    name: "Science Research Lab",
    description: "An early research bench that processes science packs and requires 60 kW.",
    inputs: [{ itemId: "copper_wire", count: 6 }, { itemId: "iron_gear", count: 6 }, { itemId: "iron_bar", count: 5 }],
    outputId: "science_lab",
    outputCount: 1,
    craftTimeSeconds: 3.0,
  },

  // --- Factorio Power Grid ---
  {
    id: "power_pole",
    name: "Small Power Pole",
    description: "Wooden electric pole providing power coverage to nearby machines.",
    inputs: [{ itemId: "wood", count: 2 }, { itemId: "copper_wire", count: 2 }, { itemId: "iron_bar", count: 1 }],
    outputId: "power_pole",
    outputCount: 2,
    techRequired: "tech_electricity",
    craftTimeSeconds: 0.5,
  },
  {
    id: "medium_power_pole",
    name: "Medium Power Pole",
    description: "Steel electric pole with an expanded power supply area and longer wire reach.",
    inputs: [{ itemId: "steel_plate", count: 1 }, { itemId: "copper_wire", count: 2 }],
    outputId: "medium_power_pole",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 0.5,
  },
  {
    id: "substation",
    name: "Electric Substation",
    description: "High-voltage distribution substation covering a massive 18x18 factory area.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "copper_wire", count: 5 }],
    outputId: "substation",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "boiler",
    name: "Industrial Steam Boiler",
    description: "Burns coal or wood to boil water into high-pressure steam for generators.",
    inputs: [{ itemId: "stone_furnace", count: 1 }, { itemId: "iron_bar", count: 4 }],
    outputId: "boiler",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 1.0,
  },
  {
    id: "generator",
    name: "Steam Power Generator",
    description: "High-output turbine generator converting steam into 500kW electricity for the power grid.",
    inputs: [{ itemId: "boiler", count: 1 }, { itemId: "iron_gear", count: 5 }, { itemId: "iron_bar", count: 5 }],
    outputId: "generator",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 2.0,
  },
  {
    id: "solar_panel",
    name: "Solar Panel",
    description: "Generates 60kW clean electricity during daylight hours.",
    inputs: [{ itemId: "copper_wire", count: 8 }, { itemId: "copper_bar", count: 4 }, { itemId: "iron_bar", count: 6 }],
    outputId: "solar_panel",
    outputCount: 1,
    craftTimeSeconds: 2.0,
  },
  {
    id: "battery",
    name: "Accumulator Battery",
    description: "Stores 5MJ excess electrical energy for nighttime factory operation.",
    inputs: [{ itemId: "iron_bar", count: 5 }, { itemId: "coal", count: 10 }, { itemId: "gold_bar", count: 1 }],
    outputId: "battery",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 2.0,
  },

  // --- Intermediate Machine Parts ---
  {
    id: "iron_gear",
    name: "Iron Gear Wheel",
    description: "Crucial mechanical gear used in machinery and logistics.",
    inputs: [{ itemId: "iron_bar", count: 2 }],
    outputId: "iron_gear",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "copper_wire",
    name: "Copper Cable",
    description: "Conductive copper wire used for electronic circuits and coils.",
    inputs: [{ itemId: "copper_bar", count: 1 }],
    outputId: "copper_wire",
    outputCount: 2,
    craftTimeSeconds: 0.5,
  },
  {
    id: "steel_plate",
    name: "Steel Plate",
    description: "High strength dense steel alloy plate smelted from iron plates.",
    inputs: [{ itemId: "iron_bar", count: 5 }],
    outputId: "steel_plate",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "electronic_circuit",
    name: "Electronic Circuit (Green)",
    description: "Basic green logic circuit board for automated tech and logic.",
    inputs: [{ itemId: "iron_bar", count: 1 }, { itemId: "copper_wire", count: 3 }],
    outputId: "electronic_circuit",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "plastic_bar",
    name: "Plastic Bar",
    description: "Synthetic polymer synthesized in chemical plants.",
    inputs: [{ itemId: "coal", count: 2 }],
    outputId: "plastic_bar",
    outputCount: 2,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 1.0,
  },
  {
    id: "sulfur",
    name: "Sulfur",
    description: "Chemical element for batteries, acids, and chemical science.",
    inputs: [{ itemId: "coal", count: 1 }, { itemId: "stone", count: 1 }],
    outputId: "sulfur",
    outputCount: 2,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 1.0,
  },
  {
    id: "advanced_circuit",
    name: "Advanced Circuit (Red)",
    description: "High-density microchip manufactured from plastics, copper wires, and green circuits.",
    inputs: [{ itemId: "electronic_circuit", count: 2 }, { itemId: "plastic_bar", count: 2 }, { itemId: "copper_wire", count: 4 }],
    outputId: "advanced_circuit",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 1.5,
  },
  {
    id: "processing_unit",
    name: "Processing Unit (Blue)",
    description: "High-tier computing microprocessor for robotics, space satellites, and rocket guidance.",
    inputs: [{ itemId: "electronic_circuit", count: 20 }, { itemId: "advanced_circuit", count: 2 }, { itemId: "sulfur", count: 5 }],
    outputId: "processing_unit",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 3.0,
  },
  {
    id: "engine_unit",
    name: "Engine Unit",
    description: "Internal combustion motor built from steel plates, gears, and pipes.",
    inputs: [{ itemId: "steel_plate", count: 1 }, { itemId: "iron_gear", count: 1 }, { itemId: "iron_bar", count: 2 }],
    outputId: "engine_unit",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "electric_engine",
    name: "Electric Engine Unit",
    description: "High-torque electric motor powered by copper coils and electronic circuits.",
    inputs: [{ itemId: "engine_unit", count: 1 }, { itemId: "electronic_circuit", count: 2 }, { itemId: "copper_wire", count: 2 }],
    outputId: "electric_engine",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 2.5,
  },
  {
    id: "flying_robot_frame",
    name: "Flying Robot Frame",
    description: "Lightweight aerospace chassis for logistics drones.",
    inputs: [{ itemId: "electric_engine", count: 1 }, { itemId: "battery", count: 2 }, { itemId: "steel_plate", count: 1 }, { itemId: "electronic_circuit", count: 3 }],
    outputId: "flying_robot_frame",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 4.0,
  },
  {
    id: "logistics_drone",
    name: "Logistics Drone",
    description: "Factorio flying drone that transports items between logistics chests.",
    inputs: [{ itemId: "flying_robot_frame", count: 1 }, { itemId: "advanced_circuit", count: 2 }],
    outputId: "logistics_drone",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "drone_hub",
    name: "Drone Station Hub",
    description: "Central command station for hovering logistics drones.",
    inputs: [{ itemId: "electronic_circuit", count: 10 }, { itemId: "steel_plate", count: 15 }, { itemId: "battery", count: 5 }],
    outputId: "drone_hub",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 5.0,
  },

  // --- Factorio Science Packs ---
  {
    id: "automation_science_pack",
    name: "Automation Science Pack (Red)",
    description: "Tier 1 research science beaker made from Copper Plates and Iron Gears.",
    inputs: [{ itemId: "copper_bar", count: 1 }, { itemId: "iron_gear", count: 1 }],
    outputId: "automation_science_pack",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "logistic_science_pack",
    name: "Logistic Science Pack (Green)",
    description: "Tier 2 research science beaker made from Inserters and Transport Belts.",
    inputs: [{ itemId: "inserter", count: 1 }, { itemId: "transport_belt", count: 1 }],
    outputId: "logistic_science_pack",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 1.5,
  },
  {
    id: "chemical_science_pack",
    name: "Chemical Science Pack (Blue)",
    description: "Tier 3 research science beaker made from Advanced Circuits, Engine Units, and Sulfur.",
    inputs: [{ itemId: "advanced_circuit", count: 1 }, { itemId: "engine_unit", count: 1 }, { itemId: "sulfur", count: 1 }],
    outputId: "chemical_science_pack",
    outputCount: 2,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 2.5,
  },

  // --- Space Rocket & Victory ---
  {
    id: "rocket_fuel",
    name: "Solid Rocket Fuel",
    description: "Concentrated high-energy solid rocket fuel.",
    inputs: [{ itemId: "coal", count: 10 }, { itemId: "electronic_circuit", count: 2 }],
    outputId: "rocket_fuel",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 3.0,
  },
  {
    id: "rocket_part",
    name: "Rocket Component Part",
    description: "Precision aerospace rocket component used in silo assembly.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "electronic_circuit", count: 5 }, { itemId: "rocket_fuel", count: 1 }],
    outputId: "rocket_part",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 5.0,
  },
  {
    id: "satellite",
    name: "Orbital Satellite",
    description: "High tech communications satellite payload.",
    inputs: [{ itemId: "processing_unit", count: 10 }, { itemId: "steel_plate", count: 10 }, { itemId: "solar_panel", count: 2 }],
    outputId: "satellite",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 5.0,
  },
  {
    id: "rocket_silo",
    name: "Rocket Launch Silo",
    description: "Massive Factorio launch pad for planetary victory!",
    inputs: [{ itemId: "steel_plate", count: 50 }, { itemId: "processing_unit", count: 20 }, { itemId: "rocket_part", count: 10 }],
    outputId: "rocket_silo",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 10.0,
  },

  // --- Smelting Basic Recipes ---
  {
    id: "iron_bar",
    name: "Iron Plate / Bar",
    description: "Smelt Iron Ore.",
    inputs: [{ itemId: "iron_ore", count: 1 }],
    outputId: "iron_bar",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "copper_bar",
    name: "Copper Plate / Bar",
    description: "Smelt Copper Ore.",
    inputs: [{ itemId: "copper_ore", count: 1 }],
    outputId: "copper_bar",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "gold_bar",
    name: "Gold Bar",
    description: "Smelt Gold Ore.",
    inputs: [{ itemId: "gold_ore", count: 1 }],
    outputId: "gold_bar",
    outputCount: 1,
    craftTimeSeconds: 1.5,
  },
  {
    id: "silver_bar",
    name: "Silver Bar",
    description: "Smelt Silver Ore.",
    inputs: [{ itemId: "silver_ore", count: 1 }],
    outputId: "silver_bar",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "uranium_bar",
    name: "Uranium Bar",
    description: "Smelt raw Uranium Ore.",
    inputs: [{ itemId: "uranium_ore", count: 1 }],
    outputId: "uranium_bar",
    outputCount: 1,
    craftTimeSeconds: 2.0,
  },
  {
    id: "landfill",
    name: "Landfill",
    description: "Converts water tiles into solid buildable terrain for factory expansion.",
    inputs: [{ itemId: "stone", count: 20 }],
    outputId: "landfill",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "hazard_concrete",
    name: "Hazard Concrete",
    description: "Concrete with black-and-yellow safety stripes (+140% speed).",
    inputs: [{ itemId: "concrete", count: 10 }],
    outputId: "hazard_concrete",
    outputCount: 10,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 0.25,
  },
  {
    id: "refined_concrete",
    name: "Refined Concrete",
    description: "High-grade reinforced factory flooring offering +150% walk speed.",
    inputs: [{ itemId: "concrete", count: 20 }, { itemId: "steel_plate", count: 1 }, { itemId: "iron_stick", count: 1 }],
    outputId: "refined_concrete",
    outputCount: 10,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 0.25,
  },
  {
    id: "small_lamp",
    name: "Small Electric Lamp",
    description: "Illuminates factory grounds at night when connected to the electric power grid.",
    inputs: [{ itemId: "iron_bar", count: 1 }, { itemId: "copper_wire", count: 3 }, { itemId: "electronic_circuit", count: 1 }],
    outputId: "small_lamp",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 0.5,
  },
  {
    id: "repair_pack",
    name: "Repair Pack",
    description: "Nanite toolkit to repair damaged machines, belts, and walls.",
    inputs: [{ itemId: "electronic_circuit", count: 2 }, { itemId: "iron_gear", count: 2 }],
    outputId: "repair_pack",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },

  // --- Complete Factorio Logic Recipe Set ---
  {
    id: "green_wire",
    name: "Green Wire",
    description: "Insulated green wire for connecting combinators, storage chests, and pumps into circuit networks.",
    inputs: [{ itemId: "copper_wire", count: 1 }, { itemId: "electronic_circuit", count: 1 }],
    outputId: "green_wire",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "red_wire",
    name: "Red Wire",
    description: "Insulated red wire for separate channel signal communication.",
    inputs: [{ itemId: "copper_wire", count: 1 }, { itemId: "electronic_circuit", count: 1 }],
    outputId: "red_wire",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "sulfuric_acid_barrel",
    name: "Sulfuric Acid Barrel",
    description: "Can of 50 units of sulfuric acid for mobile uranium extraction.",
    inputs: [{ itemId: "empty_barrel", count: 1 }, { itemId: "sulfur", count: 2 }],
    outputId: "sulfuric_acid_barrel",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 0.2,
  },
  {
    id: "empty_barrel",
    name: "Empty Barrel",
    description: "Heavy metal container for fluid canning.",
    inputs: [{ itemId: "steel_plate", count: 1 }],
    outputId: "empty_barrel",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 0.5,
  },
  {
    id: "concrete",
    name: "Concrete",
    description: "Paved factory floor concrete that increases walk speed by +140%.",
    inputs: [{ itemId: "stone_brick", count: 5 }, { itemId: "iron_bar", count: 1 }, { itemId: "stone", count: 5 }],
    outputId: "concrete",
    outputCount: 10,
    techRequired: "tech_advanced_material_processing",
    craftTimeSeconds: 10.0,
  },
  {
    id: "stone_brick",
    name: "Stone Brick",
    description: "Refined kiln-baked stone brick block.",
    inputs: [{ itemId: "stone", count: 2 }],
    outputId: "stone_brick",
    outputCount: 1,
    craftTimeSeconds: 3.2,
  },
  {
    id: "iron_stick",
    name: "Iron Stick",
    description: "Rigid metal rod for rails, speakers, and power poles.",
    inputs: [{ itemId: "iron_bar", count: 1 }],
    outputId: "iron_stick",
    outputCount: 2,
    craftTimeSeconds: 0.5,
  },
  {
    id: "pipe",
    name: "Fluid Pipe",
    description: "Conduit for transporting water, steam, and oil.",
    inputs: [{ itemId: "iron_bar", count: 1 }],
    outputId: "pipe",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "energy_shield",
    name: "Energy Shield",
    description: "Personal energy shielding for modular armor.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "energy_shield",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 5.0,
  },
  {
    id: "energy_shield_mk2",
    name: "Energy Shield MK2",
    description: "Advanced personal defense shield absorbing 300 damage.",
    inputs: [{ itemId: "processing_unit", count: 5 }, { itemId: "low_density_structure", count: 5 }, { itemId: "energy_shield", count: 1 }],
    outputId: "energy_shield_mk2",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "belt_immunity_equipment",
    name: "Belt Immunity Equipment",
    description: "Armor module preventing conveyor belts from dragging player.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "belt_immunity_equipment",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "fast_splitter",
    name: "Fast Splitter (Red)",
    description: "2x velocity conveyor splitter.",
    inputs: [{ itemId: "iron_gear", count: 10 }, { itemId: "electronic_circuit", count: 10 }, { itemId: "splitter", count: 1 }],
    outputId: "fast_splitter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "express_splitter",
    name: "Express Splitter (Blue)",
    description: "3x velocity conveyor splitter for heavy factory throughput.",
    inputs: [{ itemId: "iron_gear", count: 10 }, { itemId: "advanced_circuit", count: 10 }, { itemId: "fast_splitter", count: 1 }, { itemId: "lubricant", count: 2 }],
    outputId: "express_splitter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "programmable_speaker",
    name: "Programmable Speaker",
    description: "Alarm playing audio cues from circuit network signals.",
    inputs: [{ itemId: "iron_bar", count: 3 }, { itemId: "copper_wire", count: 5 }, { itemId: "iron_stick", count: 4 }, { itemId: "electronic_circuit", count: 4 }],
    outputId: "programmable_speaker",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 2.0,
  },
  {
    id: "uranium_fuel_cell",
    name: "Uranium Fuel Cell",
    description: "Enriched nuclear fuel cell containing massive energy.",
    inputs: [{ itemId: "iron_bar", count: 10 }, { itemId: "uranium_235", count: 1 }, { itemId: "uranium_238", count: 19 }],
    outputId: "uranium_fuel_cell",
    outputCount: 10,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 10.0,
  },
  {
    id: "train_stop",
    name: "Train Stop Station",
    description: "Automated train terminal stop for railroad scheduling.",
    inputs: [{ itemId: "iron_bar", count: 6 }, { itemId: "steel_plate", count: 3 }, { itemId: "iron_stick", count: 6 }, { itemId: "electronic_circuit", count: 5 }],
    outputId: "train_stop",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "explosives",
    name: "Explosives",
    description: "Volatile powder for grenades and demolition.",
    inputs: [{ itemId: "coal", count: 1 }, { itemId: "sulfur", count: 1 }, { itemId: "stone", count: 1 }],
    outputId: "explosives",
    outputCount: 2,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 4.0,
  },
  {
    id: "personal_roboport",
    name: "Personal Roboport",
    description: "Deploy mobile construction and logistic bots from backpack.",
    inputs: [{ itemId: "steel_plate", count: 20 }, { itemId: "battery", count: 45 }, { itemId: "iron_gear", count: 40 }, { itemId: "advanced_circuit", count: 10 }],
    outputId: "personal_roboport",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "fluid_wagon",
    name: "Fluid Wagon Tanker",
    description: "Train car hauling bulk liquid chemicals and oils.",
    inputs: [{ itemId: "steel_plate", count: 16 }, { itemId: "iron_gear", count: 10 }, { itemId: "pipe", count: 8 }, { itemId: "steel_chest", count: 1 }],
    outputId: "fluid_wagon",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 1.5,
  },
  {
    id: "heat_pipe",
    name: "Heat Pipe",
    description: "Superconducting thermal conduit for nuclear reactors.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "copper_bar", count: 10 }],
    outputId: "heat_pipe",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 1.0,
  },
  {
    id: "efficiency_module",
    name: "Efficiency Module",
    description: "Reduces machine energy consumption by -30%.",
    inputs: [{ itemId: "electronic_circuit", count: 5 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "efficiency_module",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "speed_module",
    name: "Speed Module",
    description: "Increases machine crafting speed by +20%.",
    inputs: [{ itemId: "electronic_circuit", count: 5 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "speed_module",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "productivity_module",
    name: "Productivity Module",
    description: "Produces extra bonus items without consuming ingredients.",
    inputs: [{ itemId: "electronic_circuit", count: 5 }, { itemId: "advanced_circuit", count: 5 }],
    outputId: "productivity_module",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "arithmetic_combinator",
    name: "Arithmetic Combinator",
    description: "Performs math calculations on circuit network signals.",
    inputs: [{ itemId: "copper_wire", count: 5 }, { itemId: "electronic_circuit", count: 5 }],
    outputId: "arithmetic_combinator",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "decider_combinator",
    name: "Decider Combinator",
    description: "Performs boolean conditional logic on network signals.",
    inputs: [{ itemId: "copper_wire", count: 5 }, { itemId: "electronic_circuit", count: 5 }],
    outputId: "decider_combinator",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "cluster_grenade",
    name: "Cluster Grenade",
    description: "Fragments into 7 sub-munitions on detonation.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "explosives", count: 5 }, { itemId: "iron_gear", count: 5 }],
    outputId: "cluster_grenade",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 8.0,
  },
  {
    id: "steam_engine",
    name: "Steam Engine",
    description: "Generates 900kW electric power from heated steam.",
    inputs: [{ itemId: "iron_bar", count: 10 }, { itemId: "iron_gear", count: 8 }, { itemId: "pipe", count: 5 }],
    outputId: "steam_engine",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 0.5,
  },
  {
    id: "radar",
    name: "Radar Station",
    description: "Scans surrounding territory and tracks threats.",
    inputs: [{ itemId: "iron_bar", count: 10 }, { itemId: "iron_gear", count: 5 }, { itemId: "electronic_circuit", count: 5 }],
    outputId: "radar",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "stack_filter_inserter",
    name: "Stack Filter Inserter",
    description: "High speed smart robotic arm moving up to 12 filtered items at once.",
    inputs: [{ itemId: "electronic_circuit", count: 5 }, { itemId: "fast_inserter", count: 1 }],
    outputId: "stack_filter_inserter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "stack_inserter",
    name: "Stack Inserter",
    description: "High speed robotic arm moving up to 12 items at once.",
    inputs: [{ itemId: "iron_gear", count: 15 }, { itemId: "electronic_circuit", count: 15 }, { itemId: "fast_inserter", count: 1 }],
    outputId: "stack_inserter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "active_provider_chest",
    name: "Active Provider Chest (Purple)",
    description: "Logistics chest automatically emptied by drones.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "advanced_circuit", count: 1 }, { itemId: "steel_chest", count: 1 }],
    outputId: "active_provider_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "passive_provider_chest",
    name: "Passive Provider Chest (Red)",
    description: "Logistics chest providing items to requester chests.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "advanced_circuit", count: 1 }, { itemId: "steel_chest", count: 1 }],
    outputId: "passive_provider_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "storage_chest",
    name: "Storage Chest (Yellow)",
    description: "General warehouse storage chest for network logistics.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "advanced_circuit", count: 1 }, { itemId: "steel_chest", count: 1 }],
    outputId: "storage_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "requester_chest",
    name: "Requester Chest (Blue)",
    description: "Logistics chest requesting specified item quotas.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "advanced_circuit", count: 1 }, { itemId: "steel_chest", count: 1 }],
    outputId: "requester_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "buffer_chest",
    name: "Buffer Chest (Green)",
    description: "Logistics chest buffering supplies for requester chests.",
    inputs: [{ itemId: "electronic_circuit", count: 3 }, { itemId: "advanced_circuit", count: 1 }, { itemId: "steel_chest", count: 1 }],
    outputId: "buffer_chest",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 0.5,
  },
  {
    id: "roboport",
    name: "Roboport",
    description: "Logistic and construction bot drone network hub.",
    inputs: [{ itemId: "steel_plate", count: 45 }, { itemId: "iron_gear", count: 45 }, { itemId: "advanced_circuit", count: 45 }],
    outputId: "roboport",
    outputCount: 1,
    techRequired: "tech_drone_logistics",
    craftTimeSeconds: 5.0,
  },
  {
    id: "storage_tank",
    name: "Storage Tank",
    description: "25,000 unit fluid storage tank.",
    inputs: [{ itemId: "iron_bar", count: 20 }, { itemId: "steel_plate", count: 5 }],
    outputId: "storage_tank",
    outputCount: 1,
    craftTimeSeconds: 3.0,
  },
  {
    id: "express_transport_belt",
    name: "Express Transport Belt (Blue)",
    description: "45 items/sec ultra-fast blue belt.",
    inputs: [{ itemId: "fast_transport_belt", count: 1 }, { itemId: "iron_gear", count: 10 }, { itemId: "lubricant", count: 2 }],
    outputId: "express_transport_belt",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "turbo_transport_belt",
    name: "Turbo Transport Belt (Green)",
    description: "60 items/sec turbo green belt.",
    inputs: [{ itemId: "express_transport_belt", count: 1 }, { itemId: "iron_gear", count: 15 }, { itemId: "lubricant", count: 4 }],
    outputId: "turbo_transport_belt",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "fast_underground_belt",
    name: "Fast Underground Belt (Red)",
    description: "8 tile red underground belt.",
    inputs: [{ itemId: "underground_belt", count: 2 }, { itemId: "iron_gear", count: 40 }],
    outputId: "fast_underground_belt",
    outputCount: 2,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "express_underground_belt",
    name: "Express Underground Belt (Blue)",
    description: "10 tile blue underground belt.",
    inputs: [{ itemId: "fast_underground_belt", count: 2 }, { itemId: "iron_gear", count: 80 }, { itemId: "lubricant", count: 4 }],
    outputId: "express_underground_belt",
    outputCount: 2,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "turbo_underground_belt",
    name: "Turbo Underground Belt (Green)",
    description: "12 tile turbo green underground belt.",
    inputs: [{ itemId: "express_underground_belt", count: 2 }, { itemId: "iron_gear", count: 120 }, { itemId: "lubricant", count: 8 }],
    outputId: "turbo_underground_belt",
    outputCount: 2,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "turbo_splitter",
    name: "Turbo Splitter (Green)",
    description: "60 items/sec turbo green splitter.",
    inputs: [{ itemId: "express_splitter", count: 1 }, { itemId: "processing_unit", count: 5 }, { itemId: "lubricant", count: 5 }],
    outputId: "turbo_splitter",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "burner_inserter",
    name: "Burner Inserter",
    description: "Coal fueled mechanical arm.",
    inputs: [{ itemId: "iron_bar", count: 1 }, { itemId: "iron_gear", count: 1 }],
    outputId: "burner_inserter",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "big_electric_pole",
    name: "Big Electric Pole",
    description: "Long distance steel transmission pylon.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "copper_wire", count: 5 }],
    outputId: "big_electric_pole",
    outputCount: 1,
    techRequired: "tech_electricity",
    craftTimeSeconds: 0.5,
  },
  {
    id: "small_pump",
    name: "Electric Pump",
    description: "High speed inline fluid pump.",
    inputs: [{ itemId: "steel_plate", count: 1 }, { itemId: "engine_unit", count: 1 }, { itemId: "pipe", count: 1 }],
    outputId: "small_pump",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 2.0,
  },
  {
    id: "pipe_to_ground",
    name: "Pipe to Ground",
    description: "Subterranean fluid crossing pipe.",
    inputs: [{ itemId: "pipe", count: 10 }, { itemId: "iron_bar", count: 5 }],
    outputId: "pipe_to_ground",
    outputCount: 2,
    craftTimeSeconds: 0.5,
  },
  {
    id: "rail",
    name: "Rail Track",
    description: "Railway tracks for trains.",
    inputs: [{ itemId: "stone", count: 1 }, { itemId: "iron_stick", count: 1 }, { itemId: "steel_plate", count: 1 }],
    outputId: "rail",
    outputCount: 2,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "rail_signal",
    name: "Rail Signal",
    description: "Standard train track block signal.",
    inputs: [{ itemId: "electronic_circuit", count: 1 }, { itemId: "iron_bar", count: 5 }],
    outputId: "rail_signal",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "rail_chain_signal",
    name: "Rail Chain Signal",
    description: "Lookahead junction train signal.",
    inputs: [{ itemId: "electronic_circuit", count: 1 }, { itemId: "iron_bar", count: 5 }],
    outputId: "rail_chain_signal",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 0.5,
  },
  {
    id: "locomotive",
    name: "Diesel Locomotive",
    description: "Heavy train engine running on coal/solid fuel.",
    inputs: [{ itemId: "engine_unit", count: 20 }, { itemId: "electronic_circuit", count: 10 }, { itemId: "steel_plate", count: 30 }],
    outputId: "locomotive",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 4.0,
  },
  {
    id: "cargo_wagon",
    name: "Cargo Wagon",
    description: "Bulk freight wagon with 40 slots.",
    inputs: [{ itemId: "iron_gear", count: 10 }, { itemId: "iron_bar", count: 20 }, { itemId: "steel_plate", count: 20 }],
    outputId: "cargo_wagon",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 1.5,
  },
  {
    id: "artillery_wagon",
    name: "Artillery Wagon",
    description: "Railway super-artillery cannon.",
    inputs: [{ itemId: "engine_unit", count: 64 }, { itemId: "iron_gear", count: 40 }, { itemId: "advanced_circuit", count: 20 }, { itemId: "steel_plate", count: 40 }],
    outputId: "artillery_wagon",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 4.0,
  },
  {
    id: "car",
    name: "Automobile Car",
    description: "Motor vehicle with mounted machine gun.",
    inputs: [{ itemId: "engine_unit", count: 8 }, { itemId: "iron_bar", count: 20 }, { itemId: "steel_plate", count: 5 }],
    outputId: "car",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "tank",
    name: "Combat Tank",
    description: "Heavy armored cannon tank.",
    inputs: [{ itemId: "engine_unit", count: 32 }, { itemId: "steel_plate", count: 50 }, { itemId: "iron_gear", count: 15 }, { itemId: "advanced_circuit", count: 10 }],
    outputId: "tank",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 5.0,
  },
  {
    id: "spidertron",
    name: "Spidertron Mech",
    description: "All-terrain walking combat platform.",
    inputs: [{ itemId: "flying_robot_frame", count: 10 }, { itemId: "fusion_reactor", count: 1 }, { itemId: "processing_unit", count: 16 }, { itemId: "rocket_launcher", count: 4 }],
    outputId: "spidertron",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 10.0,
  },
  {
    id: "lamp",
    name: "Electric Lamp",
    description: "Illuminates factory area.",
    inputs: [{ itemId: "electronic_circuit", count: 1 }, { itemId: "copper_wire", count: 3 }, { itemId: "iron_bar", count: 1 }],
    outputId: "lamp",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "hazard_concrete",
    name: "Hazard Concrete",
    description: "Striped safety concrete.",
    inputs: [{ itemId: "concrete", count: 10 }],
    outputId: "hazard_concrete",
    outputCount: 10,
    craftTimeSeconds: 0.25,
  },
  {
    id: "refined_concrete",
    name: "Refined Concrete",
    description: "Steel reinforced heavy concrete (+150% speed).",
    inputs: [{ itemId: "concrete", count: 20 }, { itemId: "steel_plate", count: 1 }, { itemId: "iron_stick", count: 8 }],
    outputId: "refined_concrete",
    outputCount: 10,
    craftTimeSeconds: 15.0,
  },
  {
    id: "landfill",
    name: "Landfill",
    description: "Fills water tiles into ground.",
    inputs: [{ itemId: "stone", count: 20 }],
    outputId: "landfill",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "cliff_explosives",
    name: "Cliff Explosives",
    description: "Blasts rocky obstacles.",
    inputs: [{ itemId: "explosives", count: 10 }, { itemId: "empty_barrel", count: 1 }],
    outputId: "cliff_explosives",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "nuclear_reactor",
    name: "Nuclear Reactor",
    description: "40MW thermal power reactor.",
    inputs: [{ itemId: "concrete", count: 500 }, { itemId: "steel_plate", count: 500 }, { itemId: "advanced_circuit", count: 500 }, { itemId: "copper_bar", count: 500 }],
    outputId: "nuclear_reactor",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 8.0,
  },
  {
    id: "heat_exchanger",
    name: "Heat Exchanger",
    description: "Turns reactor heat into 500°C steam.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "copper_bar", count: 100 }, { itemId: "pipe", count: 10 }],
    outputId: "heat_exchanger",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 3.0,
  },
  {
    id: "steam_turbine",
    name: "Steam Turbine",
    description: "Generates 5.8MW electricity.",
    inputs: [{ itemId: "iron_gear", count: 50 }, { itemId: "copper_bar", count: 50 }, { itemId: "pipe", count: 20 }],
    outputId: "steam_turbine",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 3.0,
  },
  {
    id: "offshore_pump",
    name: "Offshore Pump",
    description: "Pumps 1,200/s water from lakes.",
    inputs: [{ itemId: "electronic_circuit", count: 2 }, { itemId: "pipe", count: 1 }, { itemId: "iron_gear", count: 1 }],
    outputId: "offshore_pump",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "pumpjack",
    name: "Pumpjack Oil Well",
    description: "Drills crude oil deposits.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "iron_gear", count: 10 }, { itemId: "electronic_circuit", count: 5 }, { itemId: "pipe", count: 10 }],
    outputId: "pumpjack",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 5.0,
  },
  {
    id: "oil_refinery",
    name: "Oil Refinery",
    description: "Cracks crude oil into petroleum fractions.",
    inputs: [{ itemId: "steel_plate", count: 15 }, { itemId: "iron_gear", count: 10 }, { itemId: "stone_brick", count: 10 }, { itemId: "electronic_circuit", count: 10 }, { itemId: "pipe", count: 10 }],
    outputId: "oil_refinery",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 8.0,
  },
  {
    id: "centrifuge",
    name: "Centrifuge",
    description: "Enriches raw uranium isotopes.",
    inputs: [{ itemId: "concrete", count: 100 }, { itemId: "steel_plate", count: 50 }, { itemId: "advanced_circuit", count: 100 }, { itemId: "iron_gear", count: 100 }],
    outputId: "centrifuge",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 4.0,
  },
  {
    id: "beacon",
    name: "Effect Beacon",
    description: "Broadcasts module buffs to machines.",
    inputs: [{ itemId: "electronic_circuit", count: 20 }, { itemId: "advanced_circuit", count: 20 }, { itemId: "steel_plate", count: 10 }, { itemId: "copper_wire", count: 10 }],
    outputId: "beacon",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "speed_module_2",
    name: "Speed Module 2",
    description: "+30% machine speed.",
    inputs: [{ itemId: "speed_module", count: 4 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "speed_module_2",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 30.0,
  },
  {
    id: "speed_module_3",
    name: "Speed Module 3",
    description: "+50% machine speed.",
    inputs: [{ itemId: "speed_module_2", count: 5 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "speed_module_3",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 60.0,
  },
  {
    id: "productivity_module_2",
    name: "Productivity Module 2",
    description: "+6% bonus items.",
    inputs: [{ itemId: "productivity_module", count: 4 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "productivity_module_2",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 30.0,
  },
  {
    id: "productivity_module_3",
    name: "Productivity Module 3",
    description: "+10% bonus items.",
    inputs: [{ itemId: "productivity_module_2", count: 5 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "productivity_module_3",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 60.0,
  },
  {
    id: "efficiency_module_2",
    name: "Efficiency Module 2",
    description: "-40% energy drain.",
    inputs: [{ itemId: "efficiency_module", count: 4 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "efficiency_module_2",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 30.0,
  },
  {
    id: "efficiency_module_3",
    name: "Efficiency Module 3",
    description: "-50% energy drain.",
    inputs: [{ itemId: "efficiency_module_2", count: 5 }, { itemId: "advanced_circuit", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "efficiency_module_3",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 60.0,
  },
  {
    id: "military_science_pack",
    name: "Military Science Pack (Grey)",
    description: "Combat military research beaker.",
    inputs: [{ itemId: "piercing_rounds_magazine", count: 1 }, { itemId: "grenade", count: 1 }, { itemId: "stone_wall", count: 2 }],
    outputId: "military_science_pack",
    outputCount: 2,
    techRequired: "tech_electronics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "production_science_pack",
    name: "Production Science Pack (Purple)",
    description: "Heavy production research beaker.",
    inputs: [{ itemId: "electric_furnace", count: 1 }, { itemId: "productivity_module", count: 1 }, { itemId: "rail", count: 30 }],
    outputId: "production_science_pack",
    outputCount: 3,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 21.0,
  },
  {
    id: "utility_science_pack",
    name: "Utility Science Pack (Yellow)",
    description: "High tech robotics research beaker.",
    inputs: [{ itemId: "processing_unit", count: 2 }, { itemId: "flying_robot_frame", count: 1 }, { itemId: "low_density_structure", count: 3 }],
    outputId: "utility_science_pack",
    outputCount: 3,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 21.0,
  },
  {
    id: "firearm_magazine",
    name: "Firearm Magazine",
    description: "Standard yellow bullet ammo.",
    inputs: [{ itemId: "iron_bar", count: 4 }],
    outputId: "firearm_magazine",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "piercing_rounds_magazine",
    name: "Piercing Rounds Magazine (Red)",
    description: "Red armor piercing bullet ammo.",
    inputs: [{ itemId: "firearm_magazine", count: 1 }, { itemId: "steel_plate", count: 1 }, { itemId: "copper_bar", count: 5 }],
    outputId: "piercing_rounds_magazine",
    outputCount: 1,
    craftTimeSeconds: 3.0,
  },
  {
    id: "uranium_rounds_magazine",
    name: "Uranium Rounds Magazine (Green)",
    description: "Depleted uranium high damage ammo.",
    inputs: [{ itemId: "piercing_rounds_magazine", count: 1 }, { itemId: "uranium_238", count: 1 }],
    outputId: "uranium_rounds_magazine",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 10.0,
  },
  {
    id: "submachine_gun",
    name: "Submachine Gun",
    description: "Rapid fire automatic weapon.",
    inputs: [{ itemId: "iron_gear", count: 10 }, { itemId: "copper_bar", count: 5 }, { itemId: "steel_plate", count: 10 }],
    outputId: "submachine_gun",
    outputCount: 1,
    craftTimeSeconds: 10.0,
  },
  {
    id: "gun_turret",
    name: "Gun Turret",
    description: "Automatic defense turret.",
    inputs: [{ itemId: "iron_gear", count: 10 }, { itemId: "copper_bar", count: 10 }, { itemId: "iron_bar", count: 20 }],
    outputId: "gun_turret",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "laser_turret",
    name: "Laser Turret",
    description: "Electric laser beam defense turret.",
    inputs: [{ itemId: "steel_plate", count: 20 }, { itemId: "electronic_circuit", count: 20 }, { itemId: "battery", count: 12 }],
    outputId: "laser_turret",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 20.0,
  },
  {
    id: "flamethrower_turret",
    name: "Flamethrower Turret",
    description: "Burning liquid perimeter defense turret.",
    inputs: [{ itemId: "steel_plate", count: 30 }, { itemId: "iron_gear", count: 15 }, { itemId: "pipe", count: 10 }, { itemId: "engine_unit", count: 5 }],
    outputId: "flamethrower_turret",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 20.0,
  },
  {
    id: "artillery_turret",
    name: "Artillery Turret",
    description: "Super heavy stationary cannon auto-bombarding distant alien hives.",
    inputs: [{ itemId: "steel_plate", count: 60 }, { itemId: "iron_gear", count: 40 }, { itemId: "advanced_circuit", count: 20 }, { itemId: "concrete", count: 60 }],
    outputId: "artillery_turret",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 40.0,
  },
  {
    id: "rocket_turret",
    name: "Rocket Turret",
    description: "Multi-launch battery firing guided missiles.",
    inputs: [{ itemId: "steel_plate", count: 20 }, { itemId: "iron_gear", count: 10 }, { itemId: "electronic_circuit", count: 10 }],
    outputId: "rocket_turret",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "tesla_turret",
    name: "Tesla Arc Turret",
    description: "High voltage lightning coil zapping incoming biter waves.",
    inputs: [{ itemId: "steel_plate", count: 30 }, { itemId: "superconductor", count: 10 }, { itemId: "processing_unit", count: 10 }],
    outputId: "tesla_turret",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 25.0,
  },
  {
    id: "railgun_turret",
    name: "Railgun Turret",
    description: "Heavy kinetic railgun obliterating massive behemoth enemies.",
    inputs: [{ itemId: "tungsten_plate", count: 40 }, { itemId: "supercapacitor", count: 20 }, { itemId: "quantum_processor", count: 5 }],
    outputId: "railgun_turret",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 45.0,
  },
  {
    id: "pistol",
    name: "Pistol",
    description: "Starter sidearm weapon.",
    inputs: [{ itemId: "copper_bar", count: 5 }, { itemId: "iron_bar", count: 5 }],
    outputId: "pistol",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    description: "Spread damage firearm.",
    inputs: [{ itemId: "iron_gear", count: 5 }, { itemId: "copper_bar", count: 10 }, { itemId: "wood", count: 5 }],
    outputId: "shotgun",
    outputCount: 1,
    craftTimeSeconds: 4.0,
  },
  {
    id: "combat_shotgun",
    name: "Combat Shotgun",
    description: "Semi-automatic heavy combat shotgun.",
    inputs: [{ itemId: "steel_plate", count: 15 }, { itemId: "iron_gear", count: 5 }, { itemId: "wood", count: 10 }],
    outputId: "combat_shotgun",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "rocket_launcher",
    name: "Rocket Launcher",
    description: "Shoulder-fired missile launcher.",
    inputs: [{ itemId: "iron_gear", count: 5 }, { itemId: "electronic_circuit", count: 5 }, { itemId: "steel_plate", count: 5 }],
    outputId: "rocket_launcher",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "flamethrower",
    name: "Flamethrower",
    description: "Incendiary weapon incinerating nests.",
    inputs: [{ itemId: "steel_plate", count: 5 }, { itemId: "iron_gear", count: 10 }],
    outputId: "flamethrower",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 10.0,
  },
  {
    id: "shotgun_shells",
    name: "Shotgun Shells",
    description: "Standard red pellet shotgun ammunition.",
    inputs: [{ itemId: "copper_bar", count: 2 }, { itemId: "iron_bar", count: 2 }],
    outputId: "shotgun_shells",
    outputCount: 1,
    craftTimeSeconds: 3.0,
  },
  {
    id: "piercing_shotgun_shells",
    name: "Piercing Shotgun Shells (Green)",
    description: "Heavy copper/steel pellet ammunition.",
    inputs: [{ itemId: "shotgun_shells", count: 2 }, { itemId: "steel_plate", count: 2 }, { itemId: "copper_bar", count: 5 }],
    outputId: "piercing_shotgun_shells",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "cannon_shell",
    name: "Tank Cannon Shell",
    description: "120mm armor piercing tank round.",
    inputs: [{ itemId: "steel_plate", count: 2 }, { itemId: "plastic_bar", count: 2 }, { itemId: "explosives", count: 1 }],
    outputId: "cannon_shell",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "explosive_cannon_shell",
    name: "Explosive Cannon Shell",
    description: "120mm high explosive tank round.",
    inputs: [{ itemId: "cannon_shell", count: 1 }, { itemId: "explosives", count: 2 }],
    outputId: "explosive_cannon_shell",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "uranium_cannon_shell",
    name: "Uranium Cannon Shell",
    description: "Depleted uranium tank round.",
    inputs: [{ itemId: "cannon_shell", count: 1 }, { itemId: "uranium_238", count: 1 }],
    outputId: "uranium_cannon_shell",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 12.0,
  },
  {
    id: "rocket",
    name: "Rocket Missile",
    description: "Standard explosive payload rocket.",
    inputs: [{ itemId: "electronic_circuit", count: 1 }, { itemId: "explosives", count: 1 }, { itemId: "iron_bar", count: 2 }],
    outputId: "rocket",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "explosive_rocket",
    name: "Explosive Rocket",
    description: "Heavy radius blast missile.",
    inputs: [{ itemId: "rocket", count: 1 }, { itemId: "explosives", count: 2 }],
    outputId: "explosive_rocket",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "atomic_bomb",
    name: "Atomic Bomb",
    description: "Tactical nuclear rocket causing massive mushroom cloud destruction.",
    inputs: [{ itemId: "rocket", count: 1 }, { itemId: "uranium_235", count: 30 }, { itemId: "processing_unit", count: 20 }],
    outputId: "atomic_bomb",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 50.0,
  },
  {
    id: "flamethrower_ammo",
    name: "Flamethrower Fuel Canister",
    description: "Pressurized light oil incendiary fuel.",
    inputs: [{ itemId: "steel_plate", count: 1 }, { itemId: "light_oil", count: 5 }],
    outputId: "flamethrower_ammo",
    outputCount: 1,
    techRequired: "tech_oil_processing",
    craftTimeSeconds: 6.0,
  },
  {
    id: "artillery_shell",
    name: "Artillery Shell",
    description: "Long range super-heavy explosive shell.",
    inputs: [{ itemId: "steel_plate", count: 4 }, { itemId: "explosives", count: 8 }, { itemId: "radar", count: 1 }],
    outputId: "artillery_shell",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 15.0,
  },
  {
    id: "grenade",
    name: "Grenade",
    description: "Fragmentation explosive bomb.",
    inputs: [{ itemId: "iron_bar", count: 5 }, { itemId: "coal", count: 10 }],
    outputId: "grenade",
    outputCount: 1,
    craftTimeSeconds: 4.0,
  },
  {
    id: "poison_capsule",
    name: "Poison Capsule",
    description: "Toxic gas cloud suffocating enemies.",
    inputs: [{ itemId: "steel_plate", count: 3 }, { itemId: "electronic_circuit", count: 3 }, { itemId: "coal", count: 10 }],
    outputId: "poison_capsule",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "slowdown_capsule",
    name: "Slowdown Capsule",
    description: "Sticky slowing chemical reducing enemy speed by 75%.",
    inputs: [{ itemId: "steel_plate", count: 2 }, { itemId: "electronic_circuit", count: 2 }, { itemId: "coal", count: 5 }],
    outputId: "slowdown_capsule",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "defender_capsule",
    name: "Defender Combat Drone",
    description: "Spawns autonomous flying combat robot escort.",
    inputs: [{ itemId: "piercing_rounds_magazine", count: 1 }, { itemId: "electronic_circuit", count: 2 }, { itemId: "iron_gear", count: 3 }],
    outputId: "defender_capsule",
    outputCount: 1,
    techRequired: "tech_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "distractor_capsule",
    name: "Distractor Drone Capsule",
    description: "Deploys 3 stationary laser defense robot decoys.",
    inputs: [{ itemId: "defender_capsule", count: 4 }, { itemId: "advanced_circuit", count: 3 }],
    outputId: "distractor_capsule",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "destroyer_capsule",
    name: "Destroyer Combat Drone",
    description: "Deploys 5 heavy plasma beam combat robots.",
    inputs: [{ itemId: "distractor_capsule", count: 4 }, { itemId: "speed_module", count: 1 }],
    outputId: "destroyer_capsule",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "light_armor",
    name: "Light Armor",
    description: "Basic iron plate body armor.",
    inputs: [{ itemId: "iron_bar", count: 40 }],
    outputId: "light_armor",
    outputCount: 1,
    craftTimeSeconds: 3.0,
  },
  {
    id: "heavy_armor",
    name: "Heavy Armor",
    description: "Steel reinforced combat body armor.",
    inputs: [{ itemId: "steel_plate", count: 40 }, { itemId: "copper_bar", count: 20 }],
    outputId: "heavy_armor",
    outputCount: 1,
    craftTimeSeconds: 8.0,
  },
  {
    id: "modular_armor",
    name: "Modular Armor",
    description: "Grid armor equipped with 5x5 module slots.",
    inputs: [{ itemId: "advanced_circuit", count: 30 }, { itemId: "steel_plate", count: 50 }],
    outputId: "modular_armor",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 15.0,
  },
  {
    id: "power_armor",
    name: "Power Armor",
    description: "Powered exoskeleton with 7x7 equipment grid.",
    inputs: [{ itemId: "processing_unit", count: 40 }, { itemId: "electric_engine", count: 20 }, { itemId: "steel_plate", count: 40 }],
    outputId: "power_armor",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 20.0,
  },
  {
    id: "power_armor_mk2",
    name: "Power Armor MK2",
    description: "Supreme 10x10 modular battle suit.",
    inputs: [{ itemId: "power_armor", count: 1 }, { itemId: "speed_module_3", count: 5 }, { itemId: "efficiency_module_3", count: 5 }, { itemId: "processing_unit", count: 40 }],
    outputId: "power_armor_mk2",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 25.0,
  },
  {
    id: "exoskeleton_equipment",
    name: "Exoskeleton Equipment",
    description: "+30% player sprint speed.",
    inputs: [{ itemId: "processing_unit", count: 10 }, { itemId: "electric_engine", count: 30 }, { itemId: "steel_plate", count: 20 }],
    outputId: "exoskeleton_equipment",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 10.0,
  },
  {
    id: "gate",
    name: "Automated Gate",
    description: "Security gate stopping alien swarms.",
    inputs: [{ itemId: "stone_wall", count: 1 }, { itemId: "steel_plate", count: 2 }, { itemId: "electronic_circuit", count: 2 }],
    outputId: "gate",
    outputCount: 1,
    craftTimeSeconds: 0.5,
  },
  {
    id: "land_mine",
    name: "Land Mine",
    description: "Explosive perimeter trap.",
    inputs: [{ itemId: "steel_plate", count: 1 }, { itemId: "explosives", count: 2 }],
    outputId: "land_mine",
    outputCount: 1,
    craftTimeSeconds: 5.0,
  },
  {
    id: "low_density_structure",
    name: "Low Density Structure",
    description: "Lightweight titanium and plastic composite.",
    inputs: [{ itemId: "steel_plate", count: 2 }, { itemId: "copper_bar", count: 20 }, { itemId: "plastic_bar", count: 5 }],
    outputId: "low_density_structure",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 20.0,
  },
  {
    id: "rocket_control_unit",
    name: "Rocket Control Unit",
    description: "Guidance navigation computer for rockets.",
    inputs: [{ itemId: "processing_unit", count: 1 }, { itemId: "speed_module", count: 1 }],
    outputId: "rocket_control_unit",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 30.0,
  },
  {
    id: "nuclear_fuel",
    name: "Nuclear Fuel",
    description: "1.21 GJ enriched uranium locomotive fuel.",
    inputs: [{ itemId: "rocket_fuel", count: 1 }, { itemId: "uranium_235", count: 1 }],
    outputId: "nuclear_fuel",
    outputCount: 1,
    techRequired: "tech_nuclear_power",
    craftTimeSeconds: 60.0,
  },
  {
    id: "rail_ramp",
    name: "Rail Ramp",
    description: "Incline bridge connecting ground rail to elevated networks.",
    inputs: [{ itemId: "rail", count: 16 }, { itemId: "steel_plate", count: 20 }, { itemId: "concrete", count: 20 }],
    outputId: "rail_ramp",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 10.0,
  },
  {
    id: "rail_support",
    name: "Rail Support Pylon",
    description: "Reinforced support pylon for overhead elevated rail.",
    inputs: [{ itemId: "steel_plate", count: 10 }, { itemId: "concrete", count: 20 }],
    outputId: "rail_support",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 5.0,
  },
  {
    id: "elevated_straight_rail",
    name: "Elevated Straight Rail",
    description: "Overhead railway bridge track.",
    inputs: [{ itemId: "rail", count: 2 }, { itemId: "steel_plate", count: 2 }],
    outputId: "elevated_straight_rail",
    outputCount: 2,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 0.5,
  },
  {
    id: "elevated_curved_rail",
    name: "Elevated Curved Rail",
    description: "Overhead curved railway bridge track.",
    inputs: [{ itemId: "rail", count: 4 }, { itemId: "steel_plate", count: 4 }],
    outputId: "elevated_curved_rail",
    outputCount: 2,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 1.0,
  },
  {
    id: "space_platform_starter_pack",
    name: "Space Platform Starter Pack",
    description: "Orbital space platform foundation module.",
    inputs: [{ itemId: "low_density_structure", count: 100 }, { itemId: "processing_unit", count: 50 }, { itemId: "rocket_fuel", count: 50 }],
    outputId: "space_platform_starter_pack",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 30.0,
  },
  {
    id: "space_platform_hub",
    name: "Space Platform Hub",
    description: "Command flight control center for space platform.",
    inputs: [{ itemId: "space_platform_starter_pack", count: 1 }, { itemId: "quantum_processor", count: 10 }, { itemId: "supercomputer", count: 5 }],
    outputId: "space_platform_hub",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 60.0,
  },
  {
    id: "cargo_bay",
    name: "Platform Cargo Bay",
    description: "Pressurized modular space platform cargo storage.",
    inputs: [{ itemId: "steel_plate", count: 20 }, { itemId: "low_density_structure", count: 10 }],
    outputId: "cargo_bay",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 10.0,
  },
  {
    id: "cargo_landing_pad",
    name: "Cargo Landing Pad",
    description: "Planetary spaceport dock receiving space platform payloads.",
    inputs: [{ itemId: "concrete", count: 200 }, { itemId: "steel_plate", count: 100 }, { itemId: "processing_unit", count: 50 }],
    outputId: "cargo_landing_pad",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 30.0,
  },
  {
    id: "cargo_pod",
    name: "Cargo Re-entry Pod",
    description: "Heat-shielded drop pod for space delivery.",
    inputs: [{ itemId: "low_density_structure", count: 4 }, { itemId: "plastic_bar", count: 4 }],
    outputId: "cargo_pod",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 5.0,
  },
  {
    id: "thruster",
    name: "Space Platform Thruster",
    description: "Rocket engine propelling orbital platforms.",
    inputs: [{ itemId: "steel_plate", count: 20 }, { itemId: "electric_engine", count: 10 }, { itemId: "low_density_structure", count: 10 }],
    outputId: "thruster",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 20.0,
  },
  {
    id: "asteroid_collector",
    name: "Asteroid Collector Arm",
    description: "Reels in orbital metallic and carbonic asteroids.",
    inputs: [{ itemId: "flying_robot_frame", count: 5 }, { itemId: "processing_unit", count: 10 }, { itemId: "steel_plate", count: 20 }],
    outputId: "asteroid_collector",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 15.0,
  },
  {
    id: "loader",
    name: "Conveyor Loader (Yellow)",
    description: "Direct item injector between belts and chests.",
    inputs: [{ itemId: "transport_belt", count: 5 }, { itemId: "inserter", count: 5 }, { itemId: "iron_bar", count: 10 }],
    outputId: "loader",
    outputCount: 1,
    craftTimeSeconds: 1.0,
  },
  {
    id: "fast_loader",
    name: "Fast Loader (Red)",
    description: "Red fast direct conveyor loader.",
    inputs: [{ itemId: "loader", count: 1 }, { itemId: "fast_transport_belt", count: 5 }, { itemId: "fast_inserter", count: 2 }],
    outputId: "fast_loader",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 2.0,
  },
  {
    id: "express_loader",
    name: "Express Loader (Blue)",
    description: "Blue 45 items/sec direct conveyor loader.",
    inputs: [{ itemId: "fast_loader", count: 1 }, { itemId: "express_transport_belt", count: 5 }, { itemId: "stack_inserter", count: 1 }],
    outputId: "express_loader",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 3.0,
  },
  {
    id: "turbo_loader",
    name: "Turbo Loader (Green)",
    description: "Green 60 items/sec turbo conveyor loader.",
    inputs: [{ itemId: "express_loader", count: 1 }, { itemId: "turbo_transport_belt", count: 5 }, { itemId: "lubricant", count: 5 }],
    outputId: "turbo_loader",
    outputCount: 1,
    techRequired: "tech_logistics_2",
    craftTimeSeconds: 4.0,
  },
  {
    id: "battery_equipment",
    name: "Battery Equipment",
    description: "20 MJ armor power battery.",
    inputs: [{ itemId: "battery", count: 5 }, { itemId: "steel_plate", count: 5 }],
    outputId: "battery_equipment",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 8.0,
  },
  {
    id: "battery_mk2_equipment",
    name: "Battery MK2 Equipment",
    description: "100 MJ high density armor battery.",
    inputs: [{ itemId: "battery_equipment", count: 5 }, { itemId: "processing_unit", count: 5 }],
    outputId: "battery_mk2_equipment",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 15.0,
  },
  {
    id: "solar_panel_equipment",
    name: "Solar Panel Equipment",
    description: "30 kW daytime armor solar panel.",
    inputs: [{ itemId: "solar_panel", count: 1 }, { itemId: "advanced_circuit", count: 2 }],
    outputId: "solar_panel_equipment",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 5.0,
  },
  {
    id: "personal_fusion_reactor_equipment",
    name: "Personal Fusion Reactor",
    description: "750 kW compact portable fusion generator.",
    inputs: [{ itemId: "processing_unit", count: 100 }, { itemId: "low_density_structure", count: 50 }],
    outputId: "personal_fusion_reactor_equipment",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 30.0,
  },
  {
    id: "personal_roboport_mk2_equipment",
    name: "Personal Roboport MK2",
    description: "Controls 25 construction bots for Power Armor MK2.",
    inputs: [{ itemId: "personal_roboport", count: 5 }, { itemId: "processing_unit", count: 10 }],
    outputId: "personal_roboport_mk2_equipment",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 20.0,
  },
  {
    id: "night_vision_equipment",
    name: "Nightvision Equipment",
    description: "Full clarity nighttime vision.",
    inputs: [{ itemId: "advanced_circuit", count: 5 }, { itemId: "steel_plate", count: 10 }],
    outputId: "night_vision_equipment",
    outputCount: 1,
    techRequired: "tech_advanced_electronics",
    craftTimeSeconds: 10.0,
  },
  {
    id: "discharge_defense_equipment",
    name: "Discharge Defense",
    description: "Electric shockwave generator knocking back biters.",
    inputs: [{ itemId: "processing_unit", count: 5 }, { itemId: "laser_turret", count: 5 }, { itemId: "steel_plate", count: 20 }],
    outputId: "discharge_defense_equipment",
    outputCount: 1,
    techRequired: "tech_space_rocket",
    craftTimeSeconds: 15.0,
  },
  {
    id: "valve",
    name: "Fluid Control Valve",
    description: "Directional pipeline flow valve.",
    inputs: [{ itemId: "pipe", count: 1 }, { itemId: "steel_plate", count: 1 }],
    outputId: "valve",
    outputCount: 1,
    craftTimeSeconds: 0.5,
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

// Global persistent noise generator for Minecraft-style procedural world

export type BiomeKind = "ocean" | "beach" | "river" | "mountain" | "badlands" | "swamp" | "forest" | "plains";

export interface BiomeInfo {
  kind: BiomeKind;
  name: string;
  nameBn: string;
  subtitle: string;
  groundColor: string;
  foliageColor: string;
  particleType?: "firefly" | "leaf" | "snow" | "dust" | "bubble";
  ambientColor: string;
}

export function getBiomeAt(x: number, y: number): BiomeInfo {
  // 1. Continentalness / Base Elevation Noise (Multi-octave FBM)
  const elev = (
    worldGenNoise.noise(x * 0.007, y * 0.007, 11.2) * 0.65 +
    worldGenNoise.noise(x * 0.018, y * 0.018, 15.7) * 0.25 +
    worldGenNoise.noise(x * 0.045, y * 0.045, 23.4) * 0.10
  );

  // 2. Minecraft River Carvers
  const riverRaw = worldGenNoise.noise(x * 0.011, y * 0.011, 48.9);
  const riverDist = Math.abs(riverRaw);

  // 3. Biome Climate Coordinates
  const temp = (
    worldGenNoise.noise(x * 0.005, y * 0.005, 76.3) * 0.7 +
    worldGenNoise.noise(x * 0.015, y * 0.015, 82.1) * 0.3
  );
  const moisture = (
    worldGenNoise.noise(x * 0.006, y * 0.006, 125.4) * 0.7 +
    worldGenNoise.noise(x * 0.016, y * 0.016, 131.8) * 0.3
  );

  if (elev < -0.27) {
    return {
      kind: "ocean",
      name: "Cerulean Depths",
      nameBn: "নীল মহাসাগর",
      subtitle: "Endless deep ocean and aquatic treasures",
      groundColor: "#123842",
      foliageColor: "#176e3c",
      particleType: "bubble",
      ambientColor: "rgba(18, 56, 66, 0.25)",
    };
  }

  if (elev >= -0.27 && elev < -0.21) {
    return {
      kind: "beach",
      name: "Sunlit Coast",
      nameBn: "সোনালী সৈকত",
      subtitle: "Warm coastal sands and ocean breeze",
      groundColor: "#d2ba77",
      foliageColor: "#27ae60",
      particleType: "dust",
      ambientColor: "rgba(210, 186, 119, 0.15)",
    };
  }

  if (riverDist < 0.052 && elev < 0.38) {
    return {
      kind: "river",
      name: "Verdant Riverway",
      nameBn: "নদী উপত্যকা",
      subtitle: "Freshwater streams and fertile riverbanks",
      groundColor: "#427a3c",
      foliageColor: "#2ecc71",
      particleType: "bubble",
      ambientColor: "rgba(66, 122, 60, 0.15)",
    };
  }

  if (elev > 0.38) {
    const isSnowSummit = elev > 0.48;
    return {
      kind: "mountain",
      name: isSnowSummit ? "Frosted Summit" : "Obsidian Crags",
      nameBn: isSnowSummit ? "তুষারাবৃত শৃঙ্গ" : "পাথুরে পর্বতমালা",
      subtitle: isSnowSummit ? "Frigid mountain peaks dusted with glacial snow" : "High elevation peaks rich with iron, gold, and coal veins",
      groundColor: isSnowSummit ? "#dce6f0" : "#5d676f",
      foliageColor: isSnowSummit ? "#b8d5e5" : "#34495e",
      particleType: isSnowSummit ? "snow" : "dust",
      ambientColor: isSnowSummit ? "rgba(220, 230, 240, 0.2)" : "rgba(93, 103, 111, 0.2)",
    };
  }

  if (temp > 0.18 && moisture < -0.12) {
    return {
      kind: "badlands",
      name: "Crimson Badlands",
      nameBn: "লাল মেসা ও মরুভূমি",
      subtitle: "Arid sandstone ridges, copper veins, and oil reservoirs",
      groundColor: "#ab5a3a",
      foliageColor: "#8e44ad",
      particleType: "dust",
      ambientColor: "rgba(171, 90, 58, 0.2)",
    };
  }

  if (temp > 0.10 && moisture > 0.20) {
    return {
      kind: "swamp",
      name: "Murky Mire",
      nameBn: "রহস্যময় জলাভূমি",
      subtitle: "Warm humid peat marsh with bioluminescent flora",
      groundColor: "#394828",
      foliageColor: "#1e381b",
      particleType: "firefly",
      ambientColor: "rgba(57, 72, 40, 0.25)",
    };
  }

  if (moisture > 0.15) {
    return {
      kind: "forest",
      name: "Whisperwood Taiga",
      nameBn: "প্রাচীন ঘন অরণ্য",
      subtitle: "Dense ancient dark oak and towering pine trees",
      groundColor: "#325726",
      foliageColor: "#1d4416",
      particleType: "leaf",
      ambientColor: "rgba(50, 87, 38, 0.2)",
    };
  }

  // Default Lush Plains
  return {
    kind: "plains",
    name: "Meadow Basin",
    nameBn: "সবুজ ফুলের সমভূমি",
    subtitle: "Lush green grasslands and wildflowers",
    groundColor: "#4f8d38",
    foliageColor: "#27ae60",
    particleType: "leaf",
    ambientColor: "rgba(79, 141, 56, 0.15)",
  };
}

// AI Procedural Multi-Biome Minecraft World Tile Generator
export function generateMinecraftWorldTile(x: number, y: number, season?: Season): Tile {
  const biome = getBiomeAt(x, y);

  // 4. Minecraft Ore Clusters (3D Perlin cluster noise)
  const coalVal = worldGenNoise.noise(x * 0.09, y * 0.09, 210.1);
  const ironVal = worldGenNoise.noise(x * 0.085, y * 0.085, 315.4);
  const copperVal = worldGenNoise.noise(x * 0.085, y * 0.085, 420.7);
  const goldVal = worldGenNoise.noise(x * 0.08, y * 0.08, 525.2);
  const uraniumVal = worldGenNoise.noise(x * 0.075, y * 0.075, 630.9);
  const oilVal = worldGenNoise.noise(x * 0.065, y * 0.065, 745.3);

  // Detail pseudo-random distribution
  const rand = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);

  if (biome.kind === "ocean") {
    return { kind: "water", age: 0, watered: true };
  }

  if (biome.kind === "beach") {
    if (rand < 0.12) return { kind: "debris_weed", age: 0, watered: true };
    return { kind: "path", age: 0, watered: false };
  }

  if (biome.kind === "river") {
    const riverRaw = worldGenNoise.noise(x * 0.011, y * 0.011, 48.9);
    const riverDist = Math.abs(riverRaw);
    if (riverDist < 0.034) {
      return { kind: "water", age: 0, watered: true };
    }
    // Riverbanks
    if (rand < 0.22) return { kind: "debris_weed", age: 0, watered: true };
    if (rand < 0.38) return { kind: "path", age: 0, watered: false };
    return { kind: "grass", age: -1, watered: false };
  }

  if (biome.kind === "mountain") {
    if (ironVal > 0.68) return { kind: "ore_iron", age: 0, watered: false };
    if (coalVal > 0.65) return { kind: "ore_coal", age: 0, watered: false };
    if (goldVal > 0.80) return { kind: "ore_gold", age: 0, watered: false };
    if (rand < 0.32) return { kind: "debris_stone", age: 0, watered: false };
    if (rand < 0.40) return { kind: "debris_branch", age: 0, watered: false };
    return { kind: "grass", age: -1, watered: false };
  }

  if (biome.kind === "badlands") {
    if (copperVal > 0.66) return { kind: "ore_copper", age: 0, watered: false };
    if (goldVal > 0.78) return { kind: "ore_gold", age: 0, watered: false };
    if (oilVal > 0.84) return { kind: "ore_crude_oil", age: 0, watered: false };
    if (rand < 0.45) return { kind: "path", age: 0, watered: false };
    if (rand < 0.52) return { kind: "debris_stone", age: 0, watered: false };
    if (rand < 0.58) return { kind: "debris_branch", age: 0, watered: false };
    return { kind: "grass", age: -1, watered: false };
  }

  if (biome.kind === "swamp") {
    if (oilVal > 0.83) return { kind: "ore_crude_oil", age: 0, watered: false };
    if (rand < 0.18) return { kind: "water", age: 0, watered: true };
    if (rand < 0.38) return { kind: "debris_weed", age: 0, watered: true };
    if (rand < 0.46) return { kind: "soil", age: 0, watered: true };
    if (rand < 0.54) return { kind: "tree", age: 0, watered: false };
    return { kind: "grass", age: -1, watered: false };
  }

  if (biome.kind === "forest") {
    if (rand < 0.38) return { kind: "tree", age: 0, watered: false };
    if (rand < 0.46) return { kind: "debris_branch", age: 0, watered: false };
    if (rand < 0.54) return { kind: "debris_weed", age: 0, watered: false };
    if (coalVal > 0.68) return { kind: "ore_coal", age: 0, watered: false };
    return { kind: "grass", age: -1, watered: false };
  }

  // Plains / Meadows
  if (uraniumVal > 0.87) return { kind: "ore_uranium", age: 0, watered: false };
  if (copperVal > 0.72) return { kind: "ore_copper", age: 0, watered: false };
  if (ironVal > 0.74) return { kind: "ore_iron", age: 0, watered: false };
  if (coalVal > 0.72) return { kind: "ore_coal", age: 0, watered: false };

  if (rand < 0.05) return { kind: "tree", age: 0, watered: false };
  if (rand < 0.09) return { kind: "debris_weed", age: 0, watered: false };
  if (rand < 0.12) return { kind: "debris_branch", age: 0, watered: false };
  if (rand < 0.14) return { kind: "debris_stone", age: 0, watered: false };

  return { kind: "grass", age: -1, watered: false };
}

// Procedural tile generator adapter
export function generateProceduralTile(worldX: number, worldY: number, season?: Season): Tile {
  return generateMinecraftWorldTile(worldX, worldY, season);
}

export function makeMap(): Tile[][] {
  // Generate massive 500x500 procedural Minecraft world
  const t: Tile[][] = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => generateMinecraftWorldTile(x, y))
  );

  // 1. Clear out settlement core (x: 4..85, y: 4..65) of any trees/water that would block spawn
  for (let y = 4; y <= 65; y++) {
    for (let x = 4; x <= 85; x++) {
      if (t[y][x].kind === "water" || t[y][x].kind === "tree") {
        t[y][x] = { kind: "grass", age: -1, watered: false };
      }
    }
  }

  // 2. Farm zone starter plot
  for (let y = 32; y <= 42; y++) {
    for (let x = 8; x <= 22; x++) t[y][x].kind = "soil";
  }

  // A clear work apron and three accessible seams beside the original farm.
  for (let y = 25; y <= 39; y++) {
    for (let x = 22; x <= 39; x++) {
      t[y][x] = { kind: y === 31 || (x === 22 && y <= 33) ? "path" : "grass", age: -1, watered: false };
    }
  }
  const yardDeposits = [
    { x: 25, y: 28, kind: "ore_iron" },
    { x: 31, y: 36, kind: "ore_copper" },
    { x: 37, y: 28, kind: "ore_coal" },
  ] as const;
  for (const seam of yardDeposits) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.hypot(dx, dy) > 2.25) continue;
        t[seam.y + dy][seam.x + dx] = { kind: seam.kind, age: 0, watered: false };
      }
    }
  }

  for (let x = 16; x <= 22; x++) {
    t[30][x] = { kind: "path", age: -1, watered: false };
  }
  for (const [x, y] of [[10, 22], [10, 23], [9, 24], [5, 29], [20, 25], [20, 23], [21, 24], [19, 23], [6, 33], [5, 35]]) {
    t[y][x] = { kind: "tree", age: -1, watered: false };
  }

  // 3. Spawn house
  for (let y = 24; y <= 28; y++) {
    for (let x = 12; x <= 17; x++) t[y][x].kind = "house";
  }

  // 4. Mailbox setup
  t[STATIC_POINTS.mailbox.y][STATIC_POINTS.mailbox.x].kind = "placed_item";
  t[STATIC_POINTS.mailbox.y][STATIC_POINTS.mailbox.x].placedItemId = "mailbox";

  // 5. Mine Cave entrance
  t[6][72].kind = "mine_cave";

  // 6. Shop counter in the town zone
  for (let y = 32; y <= 40; y++) {
    for (let x = 64; x <= 74; x++) t[y][x].kind = "house";
  }
  t[40][70].kind = "shop";

  // 7. Dedicated Factorio Starting Ore Fields (Guaranteed near base)
  // Iron Ore (North-East of house)
  for (let y = 16; y <= 24; y++) {
    for (let x = 28; x <= 38; x++) {
      if (Math.hypot(x - 33, y - 20) <= 4.8 && Math.random() < 0.85) {
        t[y][x] = { kind: "ore_iron", age: 0, watered: false };
      }
    }
  }

  // Copper Ore (East of Iron)
  for (let y = 16; y <= 24; y++) {
    for (let x = 44; x <= 54; x++) {
      if (Math.hypot(x - 49, y - 20) <= 4.6 && Math.random() < 0.85) {
        t[y][x] = { kind: "ore_copper", age: 0, watered: false };
      }
    }
  }

  // Coal Ore (South of farm)
  for (let y = 46; y <= 54; y++) {
    for (let x = 18; x <= 28; x++) {
      if (Math.hypot(x - 23, y - 50) <= 4.5 && Math.random() < 0.85) {
        t[y][x] = { kind: "ore_coal", age: 0, watered: false };
      }
    }
  }

  // Stone Quarry (South-East of farm)
  for (let y = 46; y <= 54; y++) {
    for (let x = 44; x <= 54; x++) {
      if (Math.hypot(x - 49, y - 50) <= 4.5 && Math.random() < 0.85) {
        t[y][x] = { kind: "debris_stone", age: 0, watered: false };
      }
    }
  }

  // Uranium Ore Field
  for (let y = 14; y <= 22; y++) {
    for (let x = 60; x <= 70; x++) {
      if (Math.hypot(x - 65, y - 18) <= 4.2 && Math.random() < 0.80) {
        t[y][x] = { kind: "ore_uranium", age: 0, watered: false };
      }
    }
  }

  // Crude Oil Deposit Field
  for (let y = 56; y <= 64; y++) {
    for (let x = 60; x <= 70; x++) {
      if (Math.hypot(x - 65, y - 60) <= 4.2 && Math.random() < 0.80) {
        t[y][x] = { kind: "ore_crude_oil", age: 0, watered: false };
      }
    }
  }

  // Dedicated Mining Quarry Area near the mine cave
  for (let y = 6; y <= 35; y++) {
    for (let x = 78; x <= 115; x++) {
      if (t[y][x].kind === "mine_cave") continue;
      const rand = Math.random();
      if (rand < 0.20) t[y][x].kind = "debris_stone";
      else if (rand < 0.35) t[y][x].kind = "ore_iron";
      else if (rand < 0.48) t[y][x].kind = "ore_silver";
      else if (rand < 0.60) t[y][x].kind = "ore_aluminum";
      else if (rand < 0.72) t[y][x].kind = "ore_coal";
      else if (rand < 0.84) t[y][x].kind = "ore_copper";
      else if (rand < 0.95) t[y][x].kind = "ore_gold";
      else t[y][x].kind = "path";
    }
  }

  // 8. Settlement Cobblestone Road Network & Highway Outlets to Wilderness
  for (let x = 67; x <= 72; x++) t[41][x].kind = "path";
  for (let x = 16; x <= 70; x++) t[44][x].kind = "path";
  for (let y = 29; y <= 44; y++) t[y][16].kind = "path";
  for (let y = 40; y <= 44; y++) t[y][70].kind = "path";
  for (let y = 7; y <= 44; y++) t[y][72].kind = "path";
  for (let x = 72; x <= 78; x++) t[10][x].kind = "path";

  // Exploration Highways extending into the biomes with stone bridges over rivers
  for (let x = 70; x <= 180; x++) {
    if (t[44][x].kind === "water") t[44][x].kind = "path"; // Stone Bridge across river
    else if (t[44][x].kind !== "house" && t[44][x].kind !== "shop") t[44][x].kind = "path";
  }
  for (let y = 44; y <= 160; y++) {
    if (t[y][70].kind === "water") t[y][70].kind = "path"; // Stone Bridge across river
    else if (t[y][70].kind !== "house" && t[y][70].kind !== "shop") t[y][70].kind = "path";
  }

  // 9. Surface Discoveries: Abandoned Factorio Bunkers, Ancient Portals & Miner Grottos
  const abandonedBunkers = [
    { x: 140, y: 110, loot: ["steel_plate", "processing_unit", "solar_panel", "firearm_magazine"] },
    { x: 280, y: 85,  loot: ["electronic_circuit", "advanced_circuit", "piercing_rounds_magazine", "iron_chest"] },
    { x: 390, y: 260, loot: ["uranium_rounds_magazine", "laser_turret", "steel_plate", "battery"] },
    { x: 190, y: 350, loot: ["fast_transport_belt", "fast_inserter", "steel_plate", "iron_gear"] },
    { x: 360, y: 390, loot: ["electric_furnace", "speed_module", "processing_unit", "low_density_structure"] },
  ];

  for (const b of abandonedBunkers) {
    if (b.x >= 0 && b.x < COLS - 6 && b.y >= 0 && b.y < ROWS - 6) {
      // Clear 6x6 concrete bunker foundation
      for (let dy = 0; dy < 6; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          t[b.y + dy][b.x + dx] = { kind: "path", age: 0, watered: false };
        }
      }
      // Perimeter walls
      for (let dx = 0; dx < 6; dx++) {
        t[b.y][b.x + dx] = { kind: "house", age: 0, watered: false };
        t[b.y + 5][b.x + dx] = { kind: "house", age: 0, watered: false };
      }
      for (let dy = 0; dy < 6; dy++) {
        t[b.y + dy][b.x] = { kind: "house", age: 0, watered: false };
        t[b.y + dy][b.x + 5] = { kind: "house", age: 0, watered: false };
      }
      // Bunker doorway
      t[b.y + 5][b.x + 3] = { kind: "path", age: 0, watered: false };
      // Center ancient tech loot chest!
      const lootItems = b.loot.map(id => createItem(id, Math.floor(Math.random() * 5) + 5));
      while (lootItems.length < 16) lootItems.push(null as any);
      t[b.y + 2][b.x + 3] = {
        kind: "placed_item",
        placedItemId: "iron_chest",
        age: 0,
        watered: false,
        chestInventory: lootItems,
      };
      // Broken machine remnant
      t[b.y + 3][b.x + 2] = { kind: "debris_stone", age: 0, watered: false };
    }
  }

  // Ancient Ruined Portals (Minecraft Nether Portal Ruins)
  const ruinedPortals = [
    { x: 220, y: 70 },
    { x: 330, y: 160 },
    { x: 100, y: 270 },
    { x: 260, y: 410 },
    { x: 430, y: 340 },
  ];

  for (const p of ruinedPortals) {
    if (p.x >= 0 && p.x < COLS - 5 && p.y >= 0 && p.y < ROWS - 5) {
      // Magma / cracked stone platform
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          t[p.y + dy][p.x + dx] = { kind: "debris_stone", age: 0, watered: false };
        }
      }
      // Obsidian pillars
      t[p.y + 1][p.x + 1] = { kind: "mine_wall", age: 0, watered: false };
      t[p.y + 2][p.x + 1] = { kind: "mine_wall", age: 0, watered: false };
      t[p.y + 3][p.x + 1] = { kind: "mine_wall", age: 0, watered: false };
      t[p.y + 1][p.x + 3] = { kind: "mine_wall", age: 0, watered: false };
      t[p.y + 2][p.x + 3] = { kind: "mine_wall", age: 0, watered: false };
      // Gold blocks in the ruin
      t[p.y + 1][p.x + 2] = { kind: "ore_gold", age: 0, watered: false };
      // Ancient portal chest with gold and rare items
      t[p.y + 3][p.x + 2] = {
        kind: "placed_item",
        placedItemId: "chest",
        age: 0,
        watered: false,
        chestInventory: [
          createItem("gold_bar", 8),
          createItem("energy_shield", 1),
          createItem("firearm_magazine", 25),
          createItem("battery", 6),
          null as any, null as any, null as any, null as any,
          null as any, null as any, null as any, null as any,
          null as any, null as any, null as any, null as any,
        ],
      };
    }
  }

  return t;
}

// Dynamically generate and expand world chunks as player explores
export function ensureMapExploration(state: GameState, playerX: number, playerY: number): void {
  // Prevent unshifting / expanding when map is already at max size (ROWS x COLS = 500x500)
  // to avoid huge GC pauses and coordinate shifting at startup
  if (state.inHouse || state.inMine || !state.tiles || state.tiles.length >= ROWS) return;

  const CHUNK_SIZE = 32;
  const BUFFER = 24;
  const rows = state.tiles.length;
  const cols = state.tiles[0]?.length || 0;

  // 1. Expand East (Right)
  if (playerX >= cols - BUFFER) {
    for (let y = 0; y < rows; y++) {
      for (let x = cols; x < cols + CHUNK_SIZE; x++) {
        state.tiles[y].push(generateProceduralTile(x, y, state.season));
      }
    }
  }

  // 2. Expand South (Bottom)
  if (playerY >= rows - BUFFER) {
    const curCols = state.tiles[0]?.length || cols;
    for (let y = rows; y < rows + CHUNK_SIZE; y++) {
      const newRow: Tile[] = [];
      for (let x = 0; x < curCols; x++) {
        newRow.push(generateProceduralTile(x, y, state.season));
      }
      state.tiles.push(newRow);
    }
  }

  // 3. Expand North (Top)
  if (playerY <= BUFFER) {
    const curCols = state.tiles[0]?.length || cols;
    const addedRows: Tile[][] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const newRow: Tile[] = [];
      for (let x = 0; x < curCols; x++) {
        newRow.push(generateProceduralTile(x, y - CHUNK_SIZE, state.season));
      }
      addedRows.push(newRow);
    }
    state.tiles.unshift(...addedRows);

    // Offset all entities
    state.player.y += CHUNK_SIZE;
    if (state.player.subY !== undefined) state.player.subY += CHUNK_SIZE;
    state.animals?.forEach(a => a.y += CHUNK_SIZE);
    state.pets?.forEach(p => { p.y += CHUNK_SIZE; p.bowlY += CHUNK_SIZE; });
    state.workers?.forEach(w => { w.y += CHUNK_SIZE; w.cabinY += CHUNK_SIZE; });
  }

  // 4. Expand West (Left)
  if (playerX <= BUFFER) {
    for (let y = 0; y < state.tiles.length; y++) {
      const addedCols: Tile[] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        addedCols.push(generateProceduralTile(x - CHUNK_SIZE, y, state.season));
      }
      state.tiles[y].unshift(...addedCols);
    }

    // Offset all entities
    state.player.x += CHUNK_SIZE;
    if (state.player.subX !== undefined) state.player.subX += CHUNK_SIZE;
    state.animals?.forEach(a => a.x += CHUNK_SIZE);
    state.pets?.forEach(p => { p.x += CHUNK_SIZE; p.bowlX += CHUNK_SIZE; });
    state.workers?.forEach(w => { w.x += CHUNK_SIZE; w.cabinX += CHUNK_SIZE; });
  }
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

export function newGame(tiles?: Tile[][]): GameState {
  const inv = Array.from({ length: 30 }, () => null as Item | null);

  const supplies: [string, number][] = [
    ["burner_drill", 2], ["stone_furnace", 2], ["transport_belt", 30],
    ["burner_inserter", 2], ["chest", 2], ["coal", 30],
    ["pickaxe", 1], ["axe", 1], ["hoe", 1], ["watering_can", 1],
    ["iron_bar", 15], ["copper_bar", 10], ["wood", 20],
    ["pistol", 1], ["firearm_magazine", 32], ["carrot_seed", 8], ["gun_turret", 1], ["stone_wall", 12], ["shotgun", 1], ["shotgun_shells", 8], ["repair_pack", 5],
  ];
  supplies.forEach(([id, count], index) => { inv[index] = createItem(id, count); });

  const initialLetters: MailLetter[] = [
    {
      id: "factorio_welcome",
      sender: "Meadow Works",
      content: "The east yard is ready. Get the iron line running, then bring the copper and coal seams into production.",
      giftItemId: "iron_bar",
      giftCount: 20,
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
      health: 250,
      maxHealth: 250,
      shield: 0,
      maxShield: 100,
      reachDistance: 10,
      weaponId: "pistol",
      dressColor: "#b4774e",
      secondaryColor: "#1e2430",
      suitType: "engineer",
      helmetType: "visor",
      skinTone: "default",
    },
    characterCorpses: [],
    settings: {
      fpsLimit: 60,
      graphicsQuality: "high",
      showGrid: false,
      showPollution: false,
      showFpsOverlay: false,
      shadowsEnabled: true,
      particleDensity: "medium",
      desktopMode: true,
    },
    cloudSave: {
      lastCloudSaveTimestamp: null,
      cloudStatus: "idle",
    },
    blueprint: {
      mode: null,
      startTile: null,
      currentTile: null,
      savedEntities: [],
    },
    day: 1,
    time: DAY_START_MINUTES + 90,
    inventory: inv,
    hotbarIndex: -1,
    quickbar: inv.slice(0, QUICKBAR_SIZE).map(item => item?.id ?? null),
    cursorStack: null,
    altMode: true,
    coins: 200, // starting funds
    tiles: tiles ?? makeMap(),
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
      description: "Commission the ironworks. Smelt 10 iron plates in a furnace.",
      targetType: "craft",
      targetId: "iron_bar",
      targetCount: 10,
      currentCount: 0,
      rewardCoins: 250,
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

const TILE_KINDS = new Set<TileKind>([
  "grass", "soil", "watered", "water", "tree", "house", "path", "shop", "npc",
  "mine_cave", "mine_dirt", "mine_wall", "mine_ladder", "debris_weed", "debris_branch",
  "debris_stone", "ore_aluminum", "ore_copper", "ore_iron", "ore_gold", "ore_silver", "ore_coal",
  "ore_uranium", "ore_crude_oil", "house_wall", "house_floor", "house_bed", "house_door", "placed_item",
]);

function serializeTile(tile: Tile): Partial<Tile> {
  const minTile: Partial<Tile> = { kind: tile.kind };
  if (tile.age !== undefined && tile.age !== -1 && tile.age !== 0) minTile.age = tile.age;
  else if (tile.age === 0) minTile.age = 0;
  if (tile.watered) minTile.watered = true;
  if (tile.cropId) minTile.cropId = tile.cropId;
  if (tile.placedItemId) minTile.placedItemId = tile.placedItemId;
  if (tile.foundation) minTile.foundation = tile.foundation;
  if (tile.buildPlan) minTile.buildPlan = { ...tile.buildPlan };
  if (tile.paving) minTile.paving = tile.paving;
  if (tile.pavingUnderlay) minTile.pavingUnderlay = tile.pavingUnderlay;
  if (tile.depositRemaining !== undefined) minTile.depositRemaining = tile.depositRemaining;
  if (tile.direction) minTile.direction = tile.direction;
  if (tile.beltItems?.length) minTile.beltItems = tile.beltItems;
  if (tile.looseItems?.length) minTile.looseItems = tile.looseItems;
  if (tile.structureHp !== undefined) minTile.structureHp = tile.structureHp;
  if (tile.aimAngle !== undefined) minTile.aimAngle = tile.aimAngle;
  if (tile.inserterHolding) minTile.inserterHolding = tile.inserterHolding;
  if (tile.inserterArmAngle !== undefined) minTile.inserterArmAngle = tile.inserterArmAngle;
  if (tile.assemblerRecipeId) minTile.assemblerRecipeId = tile.assemblerRecipeId;
  if (tile.assemblerProgress !== undefined) minTile.assemblerProgress = tile.assemblerProgress;
  if (tile.drillTargetOre) minTile.drillTargetOre = tile.drillTargetOre;
  if (tile.drillTimer !== undefined) minTile.drillTimer = tile.drillTimer;
  if (tile.fuelSeconds !== undefined) minTile.fuelSeconds = tile.fuelSeconds;
  if (tile.labSeconds !== undefined) minTile.labSeconds = tile.labSeconds;
  if (tile.splitterOutput !== undefined) minTile.splitterOutput = tile.splitterOutput;
  if (tile.chestBarLimit !== undefined) minTile.chestBarLimit = tile.chestBarLimit;
  if (tile.chestInventory && tile.chestInventory.some((item) => item !== null)) {
    minTile.chestInventory = tile.chestInventory;
  }
  if (tile.zone) minTile.zone = tile.zone;
  if (tile.hitPoints !== undefined) minTile.hitPoints = tile.hitPoints;
  if (tile.lastHitTime !== undefined) minTile.lastHitTime = tile.lastHitTime;
  if (tile.lastRustleTime !== undefined) minTile.lastRustleTime = tile.lastRustleTime;
  if (tile.smeltTimer !== undefined) minTile.smeltTimer = tile.smeltTimer;
  if (tile.smeltMaxTime !== undefined) minTile.smeltMaxTime = tile.smeltMaxTime;
  if (tile.smeltOutputId) minTile.smeltOutputId = tile.smeltOutputId;
  if (tile.smeltActive) minTile.smeltActive = tile.smeltActive;
  return minTile;
}

export function encodeGridRLE(grid: Tile[][]): unknown {
  if (!Array.isArray(grid) || grid.length === 0) return grid;
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (cols === 0) return grid;

  const runs: { r: number; t: Partial<Tile> }[] = [];
  let currentRunTileKey = "";
  let currentRunTileObj: Partial<Tile> = {};
  let currentRunCount = 0;

  for (let y = 0; y < rows; y++) {
    const row = grid[y] || [];
    for (let x = 0; x < cols; x++) {
      const tile = row[x] || { kind: "grass", age: -1, watered: false };
      const minTile = serializeTile(tile);
      const key = Object.keys(minTile).length === 1 ? tile.kind : JSON.stringify(minTile);

      if (key === currentRunTileKey) {
        currentRunCount++;
      } else {
        if (currentRunCount > 0) {
          runs.push({ r: currentRunCount, t: currentRunTileObj });
        }
        currentRunTileKey = key;
        currentRunTileObj = minTile;
        currentRunCount = 1;
      }
    }
  }
  if (currentRunCount > 0) {
    runs.push({ r: currentRunCount, t: currentRunTileObj });
  }

  return { _rle: true, rows, cols, runs };
}

export function decodeGridRLE(data: unknown, fallbackKind: TileKind = "grass"): Tile[][] | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as any;
  if (!obj._rle || !Array.isArray(obj.runs)) return null;

  const rows = obj.rows;
  const cols = obj.cols;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > ROWS || cols > COLS) return null;
  const grid: Tile[][] = Array.from({ length: rows }, () => new Array(cols));

  let currentRunIdx = 0;
  let currentRunRemaining = obj.runs[0]?.r || 0;
  let currentTile: Partial<Tile> = obj.runs[0]?.t || { kind: fallbackKind };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (currentRunRemaining <= 0) {
        currentRunIdx++;
        if (currentRunIdx < obj.runs.length) {
          currentRunRemaining = obj.runs[currentRunIdx].r;
          currentTile = obj.runs[currentRunIdx].t;
        }
      }
      grid[y][x] = {
        kind: currentTile.kind || fallbackKind,
        age: currentTile.age ?? -1,
        watered: !!currentTile.watered,
        ...(currentTile.placedItemId || currentTile.beltItems || currentTile.looseItems || currentTile.buildPlan ? structuredClone(currentTile) : currentTile),
      };
      currentRunRemaining--;
    }
  }

  return grid;
}

export function normalizeGrid(
  rawGrid: unknown,
  targetRows: number,
  targetCols: number,
  defaultTile: Tile,
  fillMinecraftBiomes: boolean = false
): Tile[][] {
  const result: Tile[][] = [];
  const src = Array.isArray(rawGrid) ? rawGrid : [];

  for (let r = 0; r < targetRows; r++) {
    const row: Tile[] = [];
    const srcRow = Array.isArray(src[r]) ? src[r] : [];
    for (let c = 0; c < targetCols; c++) {
      const tileObj = srcRow[c];
      if (tileObj && typeof tileObj === "object" && typeof tileObj.kind === "string") {
        row.push({
          kind: tileObj.kind,
          age: typeof tileObj.age === "number" ? tileObj.age : defaultTile.age,
          watered: typeof tileObj.watered === "boolean" ? tileObj.watered : false,
          ...tileObj,
        });
      } else {
        if (fillMinecraftBiomes) {
          row.push(generateMinecraftWorldTile(c, r));
        } else {
          row.push({ ...defaultTile });
        }
      }
    }
    result.push(row);
  }
  return result;
}

export function prepareStateForSave(rawState: unknown): unknown {
  if (!rawState || typeof rawState !== "object") return rawState;
  const s = { ...(rawState as Record<string, any>) };
  delete s.combatFx;
  if (Array.isArray(s.tiles)) {
    s.tiles = encodeGridRLE(s.tiles);
  }
  if (Array.isArray(s.mineGrid) && s.mineGrid.length > 0) {
    s.mineGrid = encodeGridRLE(s.mineGrid);
  }
  if (Array.isArray(s.houseGrid) && s.houseGrid.length > 0) {
    s.houseGrid = encodeGridRLE(s.houseGrid);
  }
  return s;
}

/**
 * Migrate / patch a raw cloud-save object (potentially from an older game
 * version) so that every field the current code expects is present.
 * Call this whenever you load a state from cloud storage.
 */
export function migrateState(raw: unknown): GameState {
  if (!raw || typeof raw !== "object") return newGame();

  const s = raw as Record<string, unknown>;
  const decodedWorld = decodeGridRLE(s.tiles, "grass");
  const savedWorld = decodedWorld ?? s.tiles;
  const world = decodedWorld?.length === ROWS && decodedWorld[0]?.length === COLS
    ? decodedWorld : Array.isArray(savedWorld)
      ? normalizeGrid(savedWorld, ROWS, COLS, { kind: "grass", age: 0, watered: false }, true)
      : undefined;
  const base = newGame(world);

  // Shallow-merge top-level scalar fields from the saved state
  const merged: GameState = {
    ...base,
    // Scalars / simple overrides
    version: 1,
    settings: { ...base.settings!, ...(s.settings as Partial<GameState["settings"]>) },
    placementDirection: (s.placementDirection as GameState["placementDirection"]) ?? base.placementDirection,
    altMode: typeof s.altMode === "boolean" ? s.altMode : base.altMode,
    productionStats: (s.productionStats as GameState["productionStats"]) ?? base.productionStats,
    pollutionGrid: (s.pollutionGrid as GameState["pollutionGrid"]) ?? base.pollutionGrid,
    powerGridStats: (s.powerGridStats as GameState["powerGridStats"]) ?? base.powerGridStats,
    evolutionFactor: (s.evolutionFactor as GameState["evolutionFactor"]) ?? base.evolutionFactor,
    biters: (s.biters as GameState["biters"]) ?? base.biters,
    patrol: (s.patrol as GameState["patrol"]) ?? {
      nextAt: Math.max(1100, ((s.productionStats as GameState["productionStats"])?.pollutionTotal ?? 0) + 600),
      waves: 0, repelled: 0, active: false,
    },
    handcraftQueue: Array.isArray(s.handcraftQueue) ? s.handcraftQueue as HandcraftJob[] : [],
    characterCorpses: (s.characterCorpses as GameState["characterCorpses"]) ?? base.characterCorpses,
    blueprint: base.blueprint && { ...base.blueprint, savedEntities: (s.blueprint as GameState["blueprint"])?.savedEntities ?? [] },
    day:          typeof s.day === "number"          ? s.day          : base.day,
    time:         typeof s.time === "number"         ? s.time         : base.time,
    coins:        typeof s.coins === "number"        ? s.coins        : base.coins,
    season:       (s.season as GameState["season"])  ?? base.season,
    weather:      (s.weather as GameState["weather"]) ?? base.weather,
    energy:       typeof s.energy === "number"       ? s.energy       : base.energy,
    maxEnergy:    typeof s.maxEnergy === "number"    ? s.maxEnergy    : base.maxEnergy,
    mineDepth:    typeof s.mineDepth === "number"    ? s.mineDepth    : base.mineDepth,
    inMine:       typeof s.inMine === "boolean"      ? s.inMine       : base.inMine,
    hotbarIndex: typeof s.hotbarIndex === "number" && s.cursorStack ? s.hotbarIndex : -1,
    quickbar: Array.from({ length: QUICKBAR_SIZE }, (_, index) => {
      if (Array.isArray(s.quickbar)) return typeof s.quickbar[index] === "string" ? s.quickbar[index] : null;
      return Array.isArray(s.inventory) ? s.inventory[index]?.id ?? null : base.quickbar[index];
    }),
    cursorStack: s.cursorStack && typeof s.cursorStack === "object" && ((s.cursorStack as Item).count ?? 0) > 0 ? s.cursorStack as Item : null,
    cursorOrigin: typeof s.cursorOrigin === "number" ? s.cursorOrigin : undefined,
    cursorRefill: s.cursorRefill === true,
    hasUnreadMail: typeof s.hasUnreadMail === "boolean" ? s.hasUnreadMail : base.hasUnreadMail,
    harvestLiftingTimer: 0,
    carryItem: null,

    // Arrays — use saved data or fall back to baseline.
    // Use .filter(Boolean) on entity arrays to strip any null/undefined
    // entries that Firestore may have stored (e.g. from serialization bugs).
    inventory: (() => {
      const savedInv = Array.isArray(s.inventory) ? (s.inventory as (Item | null)[]) : base.inventory;
      return Array.from({ length: Math.max(30, savedInv.length) }, (_, idx) => {
        const item = savedInv[idx];
        return item?.type === "trash" && item.description === "Unknown item" ? createItem(item.id, item.count) : item ?? null;
      });
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
    // Always restore a complete rectangular farm grid. Older saves can have
    tiles: base.tiles,
    mineGrid: decodeGridRLE(s.mineGrid, "mine_dirt") ?? (
      Array.isArray(s.mineGrid) && s.mineGrid.length > 0
        ? normalizeGrid(s.mineGrid, s.mineGrid.length, Math.max(1, ...s.mineGrid.map((row: any) => Array.isArray(row) ? row.length : 0)), { kind: "mine_dirt", age: -1, watered: false })
        : base.mineGrid
    ),
    houseGrid: decodeGridRLE(s.houseGrid, "house_floor") ?? (
      Array.isArray(s.houseGrid) && s.houseGrid.length > 0
        ? normalizeGrid(s.houseGrid, s.houseGrid.length, Math.max(1, ...s.houseGrid.map((row: any) => Array.isArray(row) ? row.length : 0)), { kind: "house_floor", age: -1, watered: false })
        : base.houseGrid
    ),


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
  };

  return merged;
}


export function isWalkable(t: Tile): boolean {
  if (!t) return false;

  // Factorio items that player CAN walk over (belts, paths, cables, ground items)
  if (t.kind === "placed_item") {
    const id = t.placedItemId;
    if (
      isConveyor(id) ||
      id === "stone_path" ||
      id === "concrete_path" ||
      id === "chicken_egg" ||
      id === "small_electric_pole" ||
      t.cropId !== undefined
    ) {
      return true;
    }
    // Solid buildings (chests, assemblers, furnaces, drills, boilers) block walking
    return false;
  }

  return (
    t.kind !== "water" &&
    t.kind !== "tree" &&
    t.kind !== "house" &&
    t.kind !== "shop" &&
    t.kind !== "npc" &&
    t.kind !== "mine_wall" &&
    t.kind !== "debris_stone" &&
    t.kind !== "debris_branch" &&
    t.kind !== "house_wall" &&
    t.kind !== "house_bed"
  );
}

function isTileInWorkerZone(t: Tile, role: string): boolean {
  if (!t) return false;
  if (t.zone === role) return true;
  if (role === "water_collector" && t.zone === "water") return true;
  return false;
}


function getWorkerSpeed(t?: Tile): number {
  if (!t) return 0.25;
  const isRoad = t.placedItemId === "stone_path" || t.kind === "path";
  return isRoad ? 0.05 : 0.25;
}

export function isWorkerWalkable(t: Tile, workerRole?: string, workerX?: number, workerY?: number, cabinX?: number, cabinY?: number): boolean {
  if (!t) return false;
  
  // Base collision checks
  const isBaseWalkable = (
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
    t.kind !== "ore_silver" &&
    t.kind !== "ore_coal" &&
    t.kind !== "house_wall" &&
    t.kind !== "house_bed" &&
    (t.kind !== "placed_item" || t.cropId !== undefined || t.placedItemId === "chicken_egg" || t.placedItemId === "stone_path")
  );

  return isBaseWalkable;
}

// --- Factorio Industrial Automation Engine ---

export function getDirectionVector(dir?: "up" | "down" | "left" | "right"): { dx: number; dy: number } {
  switch (dir) {
    case "up": return { dx: 0, dy: -1 };
    case "down": return { dx: 0, dy: 1 };
    case "left": return { dx: -1, dy: 0 };
    case "right":
    default:
      return { dx: 1, dy: 0 };
  }
}

export function isChestBuilding(placedItemId?: string): boolean {
  return (
    placedItemId === "chest" ||
    placedItemId === "iron_chest" ||
    placedItemId === "steel_chest" ||
    placedItemId === "logistics_chest" ||
    placedItemId === "worker_cabin"
  );
}

export function getChestSlotCount(placedItemId?: string): number {
  if (placedItemId === "iron_chest") return 24;
  if (placedItemId === "steel_chest") return 48;
  if (placedItemId === "logistics_chest") return 60;
  if (placedItemId === "worker_cabin") return 6;
  return 12;
}

const SMELTING: Record<string, { output: string; seconds: number; count?: number }> = {
  iron_ore: { output: "iron_bar", seconds: 3.2 },
  copper_ore: { output: "copper_bar", seconds: 3.2 },
  silver_ore: { output: "silver_bar", seconds: 3.5 },
  gold_ore: { output: "gold_bar", seconds: 4 },
  uranium_ore: { output: "uranium_bar", seconds: 6 },
  iron_bar: { output: "steel_plate", seconds: 5, count: 5 },
};

const DEPOSITS: Partial<Record<TileKind, string>> = {
  ore_iron: "iron_ore", ore_copper: "copper_ore", ore_coal: "coal",
  ore_uranium: "uranium_ore", ore_gold: "gold_ore", ore_silver: "silver_ore",
  ore_aluminum: "iron_ore", debris_stone: "stone",
};

const FUEL_SECONDS: Record<string, number> = { coal: 24, wood: 10, solid_fuel: 48 };
export function fuelMachine(tile: Tile, inventory: (Item | null)[]): number {
  const id = tile.placedItemId ?? "";
  const slot = isFurnace(id) && id !== "electric_furnace" ? 1
    : ["burner_drill", "burner_inserter", "boiler"].includes(id) ? 0 : -1;
  if (slot < 0) return 0;
  const target = tile.chestInventory ??= Array(isFurnace(id) ? 3 : id === "burner_drill" ? 3 : 1).fill(null);
  const existing = target[slot];
  const limit = 5 - (existing?.count ?? 0);
  const index = inventory.findIndex(item => item && FUEL_SECONDS[item.id] && (!existing || existing.id === item.id));
  if (limit <= 0 || index < 0) return 0;
  const fuel = inventory[index]!;
  const count = Math.min(limit, fuel.count);
  if (existing) existing.count += count;
  else target[slot] = createItem(fuel.id, count);
  removeItem(inventory, index, count);
  return count;
}

const RECIPE_BY_ID = new Map(CRAFTING_RECIPES.map(recipe => [recipe.id, recipe]));

export function isConveyor(id = ""): boolean {
  return id.includes("belt") || id.includes("loader") || id.includes("splitter");
}

export function isFurnace(id = ""): boolean {
  return id === "furnace" || id.endsWith("_furnace");
}

function isProcessor(id = ""): boolean {
  return /assembling_machine|chemical_plant|oil_refinery|centrifuge|electromagnetic|cryogenic|foundry|biochamber/.test(id);
}

type ProductionStats = NonNullable<GameState["productionStats"]>;

function record(stats: ProductionStats | undefined, category: "produced" | "consumed", id: string, count = 1) {
  if (!stats) return;
  stats[category][id] = (stats[category][id] ?? 0) + count;
}

function workingTime(tile: Tile, dt: number, slot: number, stats?: ProductionStats): number {
  const inventory = tile.chestInventory!;
  const fuel = inventory[slot];
  if ((tile.fuelSeconds ?? 0) <= 0 && fuel && FUEL_SECONDS[fuel.id]) {
    tile.fuelSeconds = FUEL_SECONDS[fuel.id];
    record(stats, "consumed", fuel.id);
    removeItem(inventory, slot);
  }
  const elapsed = Math.min(tile.fuelSeconds ?? 0, dt);
  tile.fuelSeconds = (tile.fuelSeconds ?? 0) - elapsed;
  return elapsed;
}

function acceptsStack(item: Item | null | undefined, id: string, count = 1): boolean {
  return !item || (item.id === id && item.count + count <= 99);
}

export function tickFurnace(tile: Tile, dt: number, power = 1, stats?: ProductionStats): string | undefined {
  const inv = tile.chestInventory ??= [null, null, null];
  const input = inv[0];
  const recipe = input && SMELTING[input.id];
  const output = tile.smeltActive ? tile.smeltOutputId : recipe?.output;
  tile.machineStatus = "idle";
  if (!output || (!tile.smeltActive && (!recipe || input!.count < (recipe.count ?? 1)))) return;
  if (!acceptsStack(inv[2], output)) {
    tile.machineStatus = "blocked";
    return;
  }

  const electric = tile.placedItemId === "electric_furnace";
  const speed = electric ? 2.5 : tile.placedItemId === "steel_furnace" ? 2 : 1;
  const timeNeeded = (tile.smeltActive ? tile.smeltTimer ?? 0 : recipe!.seconds) / speed;
  const elapsed = electric ? dt * power : workingTime(tile, Math.min(timeNeeded, dt), 1, stats);
  if (elapsed <= 0 && timeNeeded > 0) {
    tile.machineStatus = electric ? "power" : "fuel";
    return;
  }

  if (!tile.smeltActive) {
    const count = recipe!.count ?? 1;
    record(stats, "consumed", input!.id, count);
    removeItem(inv, 0, count);
    tile.smeltTimer = tile.smeltMaxTime = recipe!.seconds;
    tile.smeltOutputId = output;
    tile.smeltActive = true;
  }
  tile.machineStatus = "running";
  tile.smeltTimer = Math.max(0, (tile.smeltTimer ?? 0) - elapsed * speed);
  if (tile.smeltTimer > 0.000001) return;
  if (inv[2]) inv[2].count++;
  else inv[2] = createItem(output);
  record(stats, "produced", output);
  tile.smeltOutputId = undefined;
  tile.smeltActive = false;
  return output;
}

function insertStack(inv: (Item | null)[], slots: number[], id: string): boolean {
  const slot = slots.find(index => inv[index]?.id === id && acceptsStack(inv[index], id))
    ?? slots.find(index => !inv[index]);
  if (slot === undefined) return false;
  if (inv[slot]) inv[slot]!.count++;
  else inv[slot] = createItem(id);
  return true;
}

const beltSpacing = 0.24;

export function loadConveyor(tile: Tile, item: BeltItem): boolean {
  const items = tile.beltItems ??= [];
  if (items.some(other => other.lane === item.lane && Math.abs(other.offset - item.offset) < beltSpacing - 0.001)) return false;
  items.push(item);
  return true;
}

function deliver(tile: Tile | undefined, item: BeltItem): boolean {
  const id = tile?.placedItemId;
  if (!tile || tile.kind !== "placed_item" || !id) return false;
  if (isConveyor(id)) return loadConveyor(tile, item);
  if (isChestBuilding(id)) {
    const inv = tile.chestInventory ??= Array(getChestSlotCount(id)).fill(null);
    return insertStack(inv, [...inv.keys()].slice(0, tile.chestBarLimit ?? inv.length), item.id);
  }
  if (isFurnace(id)) {
    const inv = tile.chestInventory ??= [null, null, null];
    if (FUEL_SECONDS[item.id] && id !== "electric_furnace") return insertStack(inv, [1], item.id);
    return Boolean(SMELTING[item.id]) && insertStack(inv, [0], item.id);
  }
  if (id === "burner_drill" || id === "burner_inserter" || id === "boiler") {
    const inv = tile.chestInventory ??= [null];
    return Boolean(FUEL_SECONDS[item.id]) && insertStack(inv, [0], item.id);
  }
  if (isProcessor(id)) {
    const recipe = RECIPE_BY_ID.get(tile.assemblerRecipeId ?? "iron_gear");
    const inv = tile.chestInventory ??= [null, null, null, null, null];
    return Boolean(recipe?.inputs.some(input => input.itemId === item.id)) && insertStack(inv, [0, 1, 2, 3], item.id);
  }
  if (id.includes("lab") || id.includes("turret")) {
    const valid = id.includes("lab") ? item.id.endsWith("_science_pack") : /magazine|ammo|bullet/.test(item.id);
    const inv = tile.chestInventory ??= Array(6).fill(null);
    return valid && insertStack(inv, [...inv.keys()], item.id);
  }
  return false;
}

function updateTransportBelt(tile: Tile, grid: Tile[][], x: number, y: number, dt: number, processed: Set<BeltItem>) {
  const items = tile.beltItems;
  if (!items?.length) return;
  const id = tile.placedItemId!;
  const speed = id.includes("turbo") ? 7.2 : id.includes("express") ? 5.4 : id.includes("fast") ? 3.6 : 1.8;
  const { dx, dy } = getDirectionVector(tile.direction);
  const next = grid[y + dy]?.[x + dx];
  const leaders = [Infinity, Infinity];

  items.sort((a, b) => b.offset - a.offset);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (processed.has(item)) {
      leaders[item.lane] = item.offset;
      continue;
    }
    processed.add(item);
    const offset = Math.max(item.offset, Math.min(item.offset + speed * dt, leaders[item.lane] - beltSpacing));
    if (offset >= 1) {
      const previous = item.offset;
      item.offset = Math.min(0.18, offset - 1);
      let transferred = false;
      if (id.includes("splitter")) {
        const side = grid[y + dy + dx]?.[x + dx - dy];
        const route = tile.splitterOutput ?? 0;
        transferred = deliver(route ? side : next, item) || deliver(route ? next : side, item);
        if (transferred) tile.splitterOutput = route ? 0 : 1;
      } else if (next?.placedItemId?.includes("underground") && next.direction === tile.direction) {
        const reach = next.placedItemId.includes("express") ? 10 : next.placedItemId.includes("fast") ? 8 : 5;
        for (let distance = 2; distance <= reach + 1; distance++) {
          const exit = grid[y + dy * distance]?.[x + dx * distance];
          if (exit?.placedItemId === next.placedItemId && exit.direction === tile.direction) {
            transferred = deliver(exit, item);
            break;
          }
        }
      } else {
        const nextDir = getDirectionVector(next?.direction);
        if (!isConveyor(next?.placedItemId) || nextDir.dx !== -dx || nextDir.dy !== -dy) transferred = deliver(next, item);
      }
      if (transferred) {
        items.splice(i--, 1);
        continue;
      }
      item.offset = Math.max(previous, 0.98);
    } else {
      item.offset = offset;
    }
    leaders[item.lane] = item.offset;
  }
}

export function dismantleTile(state: GameState, grid: Tile[][], x: number, y: number): boolean {
  const tile = grid[y]?.[x];
  if (tile?.kind !== "placed_item" || !tile.placedItemId) return false;
  const inventory = state.inventory.map(item => item && { ...item });
  const recovered = [
    createItem(tile.placedItemId), ...(tile.chestInventory ?? []), tile.inserterHolding,
    ...(tile.beltItems ?? []).map(item => createItem(item.id)),
    tile.smeltActive && tile.smeltOutputId ? createItem(tile.smeltOutputId) : null,
  ];
  if (!recovered.every(item => !item || addItem(inventory, item))) return false;
  state.inventory = inventory;
  state.workers = state.workers?.filter(worker => tile.placedItemId !== "worker_cabin" || worker.cabinX !== x || worker.cabinY !== y);
  state.pets = state.pets?.filter(pet => !tile.placedItemId?.startsWith("pet_bowl") || pet.bowlX !== x || pet.bowlY !== y);
  grid[y][x] = {
    kind: tile.depositRemaining === 0 ? "grass" : tile.foundation ?? (state.inMine ? "mine_dirt" : state.inHouse ? "house_floor" : "grass"),
    age: tile.age,
    watered: tile.watered,
    zone: tile.zone,
    depositRemaining: tile.depositRemaining,
    looseItems: tile.looseItems,
    paving: tile.paving,
    pavingUnderlay: tile.pavingUnderlay,
  };
  invalidateMachineCache();
  return true;
}

const pavingMaterials = new Set(["stone_brick", "concrete", "hazard_concrete", "refined_concrete"]);
export function isTerrainItem(id: string) {
  return id === "landfill" || pavingMaterials.has(id);
}

export function isBuildableItem(item: Item | null | undefined): item is Item {
  return Boolean(item && (item.type === "furniture" || isTerrainItem(item.id)));
}

export function getFactoryPlacementIssue(tile: Tile, id: string): string | null {
  if (id === "landfill") return tile.kind === "water" ? null : "Landfill requires water";
  if (pavingMaterials.has(id)) {
    if (tile.cropId || tile.paving) return "Clear the existing surface first";
    return ["grass", "soil", "watered", "path"].includes(tile.kind) ? null : "Paving requires clear land";
  }
  if (id.includes("drill") && (!DEPOSITS[tile.kind] || tile.depositRemaining === 0)) return "Place the drill on a mineral deposit.";
  if (tile.cropId) return "Harvest the crop before building here.";
  if (DEPOSITS[tile.kind] || ["grass", "soil", "watered", "path", "mine_dirt", "house_floor"].includes(tile.kind)) return null;
  return "This tile is blocked.";
}

export function getPlacementIssue(state: GameState, tile: Tile, id: string, position: { x: number; y: number }) {
  if (Math.hypot(position.x - state.player.x, position.y - state.player.y) > (state.player.reachDistance ?? 8)) {
    return "Out of reach";
  }
  if (!isTerrainItem(id) && !isWalkable({ ...tile, kind: "placed_item", placedItemId: id }) &&
      Math.abs(position.x - (state.player.subX ?? state.player.x)) < .72 &&
      Math.abs(position.y - (state.player.subY ?? state.player.y)) < .72) {
    return "Move clear of the footprint";
  }
  return getFactoryPlacementIssue(tile, id);
}

export function acceptsManualSlot(tile: Tile, index: number, item: Item) {
  const id = tile.placedItemId ?? "";
  if (isFurnace(id)) return index === 0 ? Boolean(SMELTING[item.id]) : index === 1 && id !== "electric_furnace" && Boolean(FUEL_SECONDS[item.id]);
  if (isProcessor(id)) return index < 4 && Boolean(RECIPE_BY_ID.get(tile.assemblerRecipeId ?? "iron_gear")?.inputs.some(input => input.itemId === item.id));
  if (id.includes("drill")) return id === "burner_drill" && index === 0 && Boolean(FUEL_SECONDS[item.id]);
  if (id.includes("lab")) return item.id.endsWith("_science_pack");
  return true;
}

function updateMiningDrill(tile: Tile, grid: Tile[][], x: number, y: number, dt: number, power: number, stats: ProductionStats) {
  const inv = tile.chestInventory ??= [null, null, null];
  const ore = tile.drillTargetOre ||= (tile.foundation && DEPOSITS[tile.foundation]) || "stone";
  const electric = tile.placedItemId !== "burner_drill";
  const { dx, dy } = getDirectionVector(tile.direction);
  if (tile.depositRemaining === 0) {
    tile.machineStatus = "depleted";
    return;
  }

  const seconds = electric ? 2.2 : 4;
  tile.drillTimer ??= 0;
  if (tile.drillTimer < 1) {
    const elapsed = electric ? dt * power : workingTime(tile, Math.min(dt, (1 - tile.drillTimer) * seconds), 0, stats);
    if (elapsed <= 0) {
      tile.machineStatus = electric ? "power" : "fuel";
      return;
    }
    tile.machineStatus = "running";
    tile.drillTimer = Math.min(1, tile.drillTimer + elapsed / seconds);
    if (tile.drillTimer < 1 - 0.000001) return;
  }

  const item: BeltItem = { id: ore, offset: 0.06, lane: ((tile.depositRemaining ?? 0) % 2) as 0 | 1 };
  if (!deliver(grid[y + dy]?.[x + dx], item) && !insertStack(inv, [2], ore)) {
    tile.drillTimer = 1;
    tile.machineStatus = "blocked";
    return;
  }
  if (tile.depositRemaining !== undefined) tile.depositRemaining--;
  record(stats, "produced", ore);
  tile.drillTimer = 0;
}

function updateInserter(tile: Tile, grid: Tile[][], x: number, y: number, dt: number, power: number, stats: ProductionStats) {
  const id = tile.placedItemId!;
  const reach = id === "long_inserter" ? 2 : 1;
  const speed = id.includes("fast") || id.includes("stack") ? 7 : 4;
  const burner = id === "burner_inserter";
  const { dx, dy } = getDirectionVector(tile.direction);
  tile.inserterArmAngle ??= -Math.PI;
  tile.machineStatus = "idle";

  if (tile.inserterHolding && tile.inserterArmAngle >= 0) {
    if (deliver(grid[y + dy * reach]?.[x + dx * reach], { id: tile.inserterHolding.id, offset: 0.12, lane: 1 })) {
      tile.inserterHolding = null;
    } else {
      tile.machineStatus = "blocked";
    }
    return;
  }

  if (!tile.inserterHolding && tile.inserterArmAngle <= -Math.PI) {
    const source = grid[y - dy * reach]?.[x - dx * reach];
    if (!source?.placedItemId) return;
    if (burner && !(tile.fuelSeconds || tile.chestInventory?.[0] && FUEL_SECONDS[tile.chestInventory[0].id])) {
      tile.machineStatus = "fuel";
      return;
    }
    if (!burner && power <= 0) {
      tile.machineStatus = "power";
      return;
    }
    if (isConveyor(source.placedItemId)) {
      const index = source.beltItems?.findIndex(item => item.offset >= 0.32) ?? -1;
      if (index >= 0) tile.inserterHolding = createItem(source.beltItems!.splice(index, 1)[0].id);
    } else if (source.chestInventory) {
      const inv = source.chestInventory;
      const slot = isFurnace(source.placedItemId) || source.placedItemId.includes("drill") ? 2
        : isProcessor(source.placedItemId) ? 4
        : isChestBuilding(source.placedItemId) ? inv.findIndex(Boolean) : -1;
      const item = inv[slot];
      if (item) {
        tile.inserterHolding = createItem(item.id);
        removeItem(inv, slot);
      }
    }
    return;
  }

  const elapsed = burner ? workingTime(tile, dt, 0, stats) : dt * power;
  tile.machineStatus = elapsed > 0 ? "running" : burner ? "fuel" : "power";
  if (tile.inserterHolding) tile.inserterArmAngle = Math.min(0, tile.inserterArmAngle + speed * elapsed);
  else tile.inserterArmAngle = Math.max(-Math.PI, tile.inserterArmAngle - speed * elapsed);
}

// Factorio Assembling Machine Simulation
function updateAssemblingMachine(tile: Tile, dt: number, powerSatisfaction: number, stats: ProductionStats) {
  if (!tile.chestInventory) {
    tile.chestInventory = Array.from({ length: 5 }, () => null); // 0..3 inputs, 4 output
  }

  // Default to iron_gear if no recipe assigned
  if (!tile.assemblerRecipeId) {
    tile.assemblerRecipeId = "iron_gear";
  }

  const recipe = RECIPE_BY_ID.get(tile.assemblerRecipeId);
  if (!recipe) return;

  const craftTime = recipe.craftTimeSeconds || 1.5;
  const speedTier = tile.placedItemId === "assembling_machine_3" ? 2.5 : tile.placedItemId === "assembling_machine_2" ? 1.5 : 1.0;

  // Check inputs
  let canCraft = true;
  for (const input of recipe.inputs) {
    let countFound = 0;
    for (let slot = 0; slot < 4; slot++) {
      const item = tile.chestInventory[slot];
      if (item && item.id === input.itemId) {
        countFound += item.count;
      }
    }
    if (countFound < input.count) {
      canCraft = false;
      break;
    }
  }

  // Check output slot space
  const outSlot = tile.chestInventory[4];
  if (outSlot && outSlot.id !== recipe.outputId) canCraft = false;
  if (outSlot && outSlot.count + recipe.outputCount > 99) canCraft = false;
  tile.machineStatus = powerSatisfaction <= 0 ? "power" : canCraft ? "running" : "idle";

  if (canCraft && powerSatisfaction > 0.1) {
    if (tile.assemblerProgress === undefined) tile.assemblerProgress = 0;
    tile.assemblerProgress += (dt * speedTier * powerSatisfaction) / craftTime;

    if (tile.assemblerProgress >= 1.0) {
      tile.assemblerProgress = 0;

      // Deduct inputs
      for (const input of recipe.inputs) {
        record(stats, "consumed", input.itemId, input.count);
        let remaining = input.count;
        for (let slot = 0; slot < 4; slot++) {
          const item = tile.chestInventory[slot];
          if (item && item.id === input.itemId) {
            const take = Math.min(item.count, remaining);
            item.count -= take;
            remaining -= take;
            if (item.count <= 0) tile.chestInventory[slot] = null;
            if (remaining <= 0) break;
          }
        }
      }

      record(stats, "produced", recipe.outputId, recipe.outputCount);
      // Add output
      if (tile.chestInventory[4] === null) {
        tile.chestInventory[4] = createItem(recipe.outputId, recipe.outputCount);
      } else {
        tile.chestInventory[4]!.count += recipe.outputCount;
      }
    }
  }
}

// Factorio Science Lab Simulation
function updateScienceLab(tile: Tile, state: GameState, dt: number, powerSatisfaction = 1.0) {
  if (!tile.chestInventory) tile.chestInventory = Array.from({ length: 6 }, () => null);
  if (!state.activeResearchId || powerSatisfaction <= 0.1) return;

  const tech = TECHNOLOGIES.find((t) => t.id === state.activeResearchId);
  if (!tech) return;

  const packSlot = tile.chestInventory.findIndex(item => item?.id.endsWith("_science_pack"));
  const pack = tile.chestInventory[packSlot];
  if ((tile.labSeconds ?? 0) <= 0 && pack) {
    tile.labSeconds = 6;
    record(state.productionStats, "consumed", pack.id);
    removeItem(tile.chestInventory, packSlot);
  }

  const elapsed = Math.min(tile.labSeconds ?? 0, dt * powerSatisfaction);
  tile.labSeconds = (tile.labSeconds ?? 0) - elapsed;
  tile.machineStatus = elapsed > 0 ? "running" : "idle";
  state.researchPoints = (state.researchPoints || 0) + elapsed * 5;
  state.researchProgress = (state.researchProgress || 0) + elapsed * 5;
  if (state.researchProgress >= tech.cost) {
    if (!state.unlockedTechs) state.unlockedTechs = [];
    if (!state.unlockedTechs.includes(tech.id)) state.unlockedTechs.push(tech.id);
    state.researchProgress = 0;
    state.activeResearchId = undefined;
  }
}

// High-performance placed machine coordinates cache (avoids 115,200 tile scans every 80ms)
let _cachedMachineCoords: { x: number; y: number }[] = [];
let _lastMachineCoordsScan = -Infinity;
let cachedMachineGrid: Tile[][] | undefined;

export function invalidateMachineCache(): void {
  _lastMachineCoordsScan = -Infinity;
}

export function updateEntities(state: GameState, dt: number): void {
  // 1. Calculate Power Grid Metrics across active factory machines
  let totalGenerationKw = 0;
  let totalDemandKw = 0;
  const hours = state.time / 60;
  const isDay = hours >= 6 && hours <= 20;

  const now = performance.now();
  // Refresh cache every 2 seconds or if empty
  if (now - _lastMachineCoordsScan > 2000 || cachedMachineGrid !== state.tiles) {
    cachedMachineGrid = state.tiles;
    _lastMachineCoordsScan = now;
    _cachedMachineCoords = [];
    const tRows = state.tiles?.length || 0;
    const tCols = state.tiles?.[0]?.length || 0;
    for (let y = 0; y < tRows; y++) {
      for (let x = 0; x < tCols; x++) {
        const tile = state.tiles[y]?.[x];
        if (tile && tile.kind === "placed_item" && tile.placedItemId) {
          _cachedMachineCoords.push({ x, y });
        }
      }
    }
  }

  // A boiler can raise steam only within reach of a water source and a steam unit.
  for (const { x, y } of _cachedMachineCoords) {
    const boiler = state.tiles[y][x];
    if (boiler.placedItemId !== "boiler") continue;
    const nearby = (predicate: (tile: Tile | undefined) => boolean) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && predicate(state.tiles[y + dy]?.[x + dx])) return true;
      }
      return false;
    };
    boiler.machineStatus = "idle";
    if (!nearby(tile => tile?.kind === "water") || !nearby(tile => ["generator", "steam_engine", "steam_turbine"].includes(tile?.placedItemId ?? ""))) continue;
    boiler.chestInventory ??= [null];
    boiler.machineStatus = workingTime(boiler, dt, 0, state.productionStats) > 0 ? "running" : "fuel";
  }

  for (let i = 0; i < _cachedMachineCoords.length; i++) {
    const { x, y } = _cachedMachineCoords[i];
    const tile = state.tiles[y]?.[x];
    if (tile && tile.kind === "placed_item" && tile.placedItemId) {
      const id = tile.placedItemId;
      if (id === "burner_drill" || id === "burner_inserter" || tile.structureHp !== undefined && tile.structureHp <= 0) continue;
      if (id === "generator" || id === "steam_engine" || id === "steam_turbine") {
        let hasSteam = false;
        for (let dy = -3; dy <= 3 && !hasSteam; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const source = state.tiles[y + dy]?.[x + dx];
            if (Math.abs(dx) + Math.abs(dy) <= 3 && source?.placedItemId === "boiler" && source.machineStatus === "running") {
              hasSteam = true;
              break;
            }
          }
        }
        tile.machineStatus = hasSteam ? "running" : "idle";
        if (hasSteam) totalGenerationKw += id === "steam_turbine" ? 5800 : 900;
      } else if (id === "nuclear_reactor") {
        totalGenerationKw += 40000;
      } else if (id === "fusion_generator" || id === "fusion_reactor") {
        totalGenerationKw += 250000;
      } else if (id === "solar_panel" && isDay) {
        totalGenerationKw += 60 * Math.min(1, (hours - 6) / 2, (20 - hours) / 2) * (state.weather === "rainy" ? 0.45 : 1);
      } else if (id.includes("drill")) {
        totalDemandKw += id.includes("big") ? 300 : 90;
      } else if (id === "assembling_machine_1") {
        totalDemandKw += 75;
      } else if (id === "assembling_machine_2" || id === "chemical_plant") {
        totalDemandKw += 150;
      } else if (id === "assembling_machine_3" || id === "oil_refinery" || id === "centrifuge") {
        totalDemandKw += 375;
      } else if (id === "electric_furnace" || id === "foundry") {
        totalDemandKw += 180;
      } else if (id === "science_lab" || id === "biolab") {
        totalDemandKw += 60;
      } else if (id.includes("inserter")) {
        totalDemandKw += id.includes("stack") ? 45 : id.includes("fast") ? 30 : 15;
      } else if (id.includes("turret") && id.includes("laser")) {
        totalDemandKw += 1200;
      } else if (id.includes("radar")) {
        totalDemandKw += 300;
      }
    }
  }

  const satisfaction = totalDemandKw > 0 ? Math.min(1, totalGenerationKw / totalDemandKw) : 1;
  state.powerGridStats = {
    capacityKw: totalGenerationKw, demandKw: totalDemandKw, satisfaction,
    accumulatorStorageMj: 0, maxStorageMj: 0,
  };
  // Factorio Character Natural Health & Shield Regeneration
  if (state.player && !state.godMode) {
    if (state.player.health < state.player.maxHealth) {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 0.35 * dt);
    }
    if (state.player.maxShield && (state.player.shield ?? 0) < state.player.maxShield) {
      state.player.shield = Math.min(state.player.maxShield, (state.player.shield ?? 0) + 1.5 * dt);
    }
  }

  // Initialize Pollution Grid & Stats if missing
  if (!state.pollutionGrid) {
    state.pollutionGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }
  if (!state.evolutionFactor) state.evolutionFactor = 0.01;
  if (!state.productionStats) {
    state.productionStats = {
      produced: {},
      consumed: {},
      powerProducedKw: totalGenerationKw,
      powerConsumedKw: totalDemandKw,
      pollutionTotal: 0,
    };
  } else {
    state.productionStats.powerProducedKw = totalGenerationKw;
    state.productionStats.powerConsumedKw = totalDemandKw;
  }

  // 2. Factorio Logistics & Machines Tick Pipeline + Pollution Emission (Cached coordinates only)
  let totalPollutionEmitted = 0;
  let hotSite: { x: number; y: number } | undefined;
  let hotValue = 0;
  const processedBeltItems = new Set<BeltItem>();
  for (let i = 0; i < _cachedMachineCoords.length; i++) {
    const { x, y } = _cachedMachineCoords[i];
    const tile = state.tiles[y]?.[x];
    if (!tile || tile.kind !== "placed_item" || !tile.placedItemId) continue;
    if (tile.structureHp !== undefined && tile.structureHp <= 0) {
      tile.machineStatus = "damaged";
      continue;
    }

    const id = tile.placedItemId;
    let pollutionEmission = 0;

    if (isConveyor(id)) {
      updateTransportBelt(tile, state.tiles, x, y, dt, processedBeltItems);
    } else if (id.includes("drill")) {
      updateMiningDrill(tile, state.tiles, x, y, dt, satisfaction, state.productionStats);
      if (tile.machineStatus === "running") pollutionEmission = (id === "burner_drill" ? 10 : 5) * dt;
    } else if (id.includes("inserter")) {
      updateInserter(tile, state.tiles, x, y, dt, satisfaction, state.productionStats);
    } else if (isProcessor(id)) {
      updateAssemblingMachine(tile, dt, satisfaction, state.productionStats);
      if (tile.machineStatus === "running") pollutionEmission = 4 * dt;
    } else if (isFurnace(id)) {
      const product = tickFurnace(tile, dt, satisfaction, state.productionStats);
      if (tile.machineStatus === "running") pollutionEmission = (id === "electric_furnace" ? 2 : 8) * dt;
      if (product && state.quest?.targetType === "craft" && state.quest.targetId === product) {
        if (++state.quest.currentCount >= state.quest.targetCount) {
          state.coins += state.quest.rewardCoins;
          state.quest = null;
        }
      }
    } else if (id === "boiler" && tile.machineStatus === "running") {
      pollutionEmission = 15 * dt;
    } else if (id.includes("lab")) {
      updateScienceLab(tile, state, dt, satisfaction);
    }

    if (pollutionEmission > 0) {
      state.pollutionGrid[y][x] = Math.min(500, (state.pollutionGrid[y][x] || 0) + pollutionEmission);
      totalPollutionEmitted += pollutionEmission;
      const emitted = state.pollutionGrid[y][x];
      if (emitted > hotValue) {
        hotSite = { x, y };
        hotValue = emitted;
      }
    }
  }

  state.productionStats.pollutionTotal = (state.productionStats.pollutionTotal || 0) + totalPollutionEmitted;
  if (totalPollutionEmitted > 0) {
    state.evolutionFactor = Math.min(1.0, (state.evolutionFactor || 0.01) + 0.00002 * dt);
  }

  tickDefense(state, dt, _cachedMachineCoords, satisfaction, hotSite);

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

    // Companion logic for idle workers
    if (worker.role === "idle") {
      worker.statusText = "Following you";
      const pX = Math.floor(state.player.x);
      const pY = Math.floor(state.player.y);
      const dist = Math.abs(worker.x - pX) + Math.abs(worker.y - pY);
      
      if (dist > 2) {
        worker.walkTimer -= dt;
        if (worker.walkTimer <= 0) {
          worker.walkTimer = getWorkerSpeed(grid[worker.y]?.[worker.x]) * 0.8;
          const dx = Math.sign(pX - worker.x);
          const dy = Math.sign(pY - worker.y);
          let nextX = worker.x + dx;
          let nextY = worker.y;
          if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) { worker.x = nextX; }
          else {
            nextX = worker.x; nextY = worker.y + dy;
            if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) { worker.y = nextY; }
          }
        }
      }
      return;
    }


    if (worker.actionTimer > 0) {
      worker.actionTimer -= dt;
      return;
    }

    if (!isShiftTime || isOnStrike) {
      if (worker.x !== worker.cabinX || worker.y !== worker.cabinY) {
        worker.walkTimer -= dt;
        if (worker.walkTimer <= 0) {
          worker.walkTimer = getWorkerSpeed(grid[worker.y]?.[worker.x]);
          const dx = Math.sign(worker.cabinX - worker.x);
          const dy = Math.sign(worker.cabinY - worker.y);

          let nextX = worker.x + dx;
          let nextY = worker.y;
          if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) {
            worker.x = nextX;
          } else {
            nextX = worker.x;
            nextY = worker.y + dy;
            if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) {
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

    // Inventory full check -> find chest (uses cached machine coords)
    if (worker.inventory) {
      worker.statusText = "Inventory full, seeking Chest...";
      let nearestChestX = -1;
      let nearestChestY = -1;
      let minChestDist = 9999;
      for (let i = 0; i < _cachedMachineCoords.length; i++) {
        const { x, y } = _cachedMachineCoords[i];
        const t = grid[y]?.[x];
        if (t && t.kind === "placed_item" && isChestBuilding(t.placedItemId)) {
          const d = Math.abs(x - worker.x) + Math.abs(y - worker.y);
          if (d < minChestDist) {
            minChestDist = d;
            nearestChestX = x;
            nearestChestY = y;
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
            worker.walkTimer = getWorkerSpeed(grid[worker.y]?.[worker.x]);
            const dx = Math.sign(nearestChestX - worker.x);
            const dy = Math.sign(nearestChestY - worker.y);
            let nextX = worker.x + dx;
            let nextY = worker.y;
            if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) { worker.x = nextX; }
            else {
              nextX = worker.x; nextY = worker.y + dy;
              if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) { worker.y = nextY; }
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

    if (true) {
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
        if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && isWorkerWalkable(grid[ty]?.[tx], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) {
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
          Math.abs(tx - worker.cabinX) <= roleRadius &&
          Math.abs(ty - worker.cabinY) <= roleRadius &&
          tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS &&
          isWorkerWalkable(grid[ty]?.[tx], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)
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
        worker.walkTimer = getWorkerSpeed(grid[worker.y]?.[worker.x]);
        const dx = Math.sign(targetX - worker.x);
        const dy = Math.sign(targetY - worker.y);

        let nextX = worker.x + dx;
        let nextY = worker.y;
        if (dx !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY)) {
          worker.x = nextX;
        } else {
          nextX = worker.x;
          nextY = worker.y + dy;
          if (dy !== 0 && isWorkerWalkable(grid[nextY]?.[nextX], worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY), worker.role, worker.x, worker.y, worker.cabinX, worker.cabinY) {
            worker.y = nextY;
          }
        }
      }
      worker.statusText = `Moving to target (${targetX}, ${targetY})`;
    } else {
      if (worker.actionTimer <= 0) {
        worker.actionTimer = 0.4;
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

function collectToolYield(state: GameState, tile: Tile, item: Item) {
  if (addItem(state.inventory, item)) return;
  const loot = tile.looseItems ??= [];
  const stack = loot.find(drop => drop.id === item.id);
  if (stack) stack.count += item.count;
  else loot.push(item);
}

// Interact tool calculations
export function interact(
  state: GameState,
  chargeLevel: number = 1,
  targetTile?: { x: number; y: number },
  sourceSlot?: number,
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

  const heldItem = sourceSlot === undefined ? getCursor(state) : state.inventory[sourceSlot];
  const useItem = () => sourceSlot === undefined ? consumeCursor(state) : removeItem(state.inventory, sourceSlot, 1);
  if (heldItem?.type === "tool") state.player.actionSeconds = .22;
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
              result.message = `Quest Complete! Harvested ${cropDef.name}. +${state.quest.rewardCoins}g`;
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
          collectToolYield(state, tile, createItem("stone", 1));
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
      } else if (tile.kind === "ore_copper" || tile.kind === "ore_iron" || tile.kind === "ore_gold" || tile.kind === "ore_uranium" || tile.kind === "ore_silver" || tile.kind === "ore_coal") {
        tile.lastHitTime = Date.now();
        const oreMap: Record<string, any> = {
          ore_copper: { item: "copper_ore", xp: 8, color: "#d35400" },
          ore_iron: { item: "iron_ore", xp: 15, color: "#95a5a6" },
          ore_gold: { item: "gold_ore", xp: 30, color: "#f1c40f" },
          ore_uranium: { item: "uranium_ore", xp: 50, color: "#2ecc71" },
          ore_silver: { item: "silver_ore", xp: 20, color: "#bdc3c7" },
          ore_coal: { item: "coal", xp: 10, color: "#2c3e50" },
        };
        const config = oreMap[tile.kind];

        if (tile.hitPoints === undefined) tile.hitPoints = 4;
        tile.hitPoints -= pickDmg;
        state.energy -= toolEnergyCost;
        gameAudio.playMine();

        if (tile.hitPoints <= 0) {
          tile.kind = state.inMine ? "mine_dirt" : "grass";
          tile.hitPoints = undefined;
          collectToolYield(state, tile, createItem(config.item, Math.floor(Math.random() * 2) + 1));

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
        const name = ITEM_DEFS[tile.placedItemId]?.name ?? tile.placedItemId;
        if (dismantleTile(state, grid, f.x, f.y)) {
          state.energy -= toolEnergyCost;
          result.message = `Picked up ${name}`;
        } else {
          result.message = "Make room in your inventory to dismantle this.";
        }
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
          collectToolYield(state, tile, createItem("wood", Math.floor(Math.random() * 4) + 3));
          if (Math.random() < 0.2) {
            collectToolYield(state, tile, createItem("wood", 2));
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
          collectToolYield(state, tile, createItem("wood", 2));
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

      useItem();
      gameAudio.playWater();
      result.message = `Planted ${CROPS[cropId].name}`;
    }
  }
  // 5. Place Placeable Objects (Sprinklers, Fences, Animals)
  else if (heldItem && isTerrainItem(heldItem.id)) {
    const issue = getPlacementIssue(state, tile, heldItem.id, f);
    if (issue) return { ...result, message: issue };
    if (heldItem.id === "landfill") {
      tile.kind = "grass";
      tile.age = -1;
      tile.watered = false;
    } else {
      tile.pavingUnderlay = tile.kind;
      tile.kind = "path";
      tile.paving = heldItem.id;
    }
    delete tile.buildPlan;
    useItem();
    gameAudio.playTill();
    result.message = `Placed ${heldItem.name}`;
  } else if (heldItem && heldItem.type === "furniture") {
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

        useItem();
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

    const issue = getPlacementIssue(state, tile, heldItem.id, f);
    if (issue) {
      result.message = issue;
      return result;
    }
    if (tile.kind !== "placed_item") {
      const foundation = tile.kind;
      tile.kind = "placed_item";
      tile.foundation = foundation;
      tile.placedItemId = heldItem.id;
      tile.direction = tile.buildPlan?.id === heldItem.id ? tile.buildPlan.direction : state.placementDirection ?? "right";
      delete tile.buildPlan;
      invalidateMachineCache();

      if (isChestBuilding(heldItem.id)) {
        tile.chestInventory = Array(getChestSlotCount(heldItem.id)).fill(null);
      } else if (isConveyor(heldItem.id)) {
        tile.beltItems = [];
      } else if (heldItem.id.includes("drill")) {
        tile.chestInventory = [null, null, null];
        tile.drillTargetOre = DEPOSITS[foundation];
        tile.depositRemaining ??= 160 + (f.x * 31 + f.y * 17) % 140;
        tile.drillTimer = 0;
      } else if (heldItem.id.includes("inserter")) {
        tile.inserterArmAngle = -Math.PI;
        tile.inserterHolding = null;
        if (heldItem.id === "burner_inserter") tile.chestInventory = [null];
      } else if (isProcessor(heldItem.id)) {
        tile.chestInventory = [null, null, null, null, null];
        tile.assemblerRecipeId = "iron_gear";
        tile.assemblerProgress = 0;
      } else if (heldItem.id.includes("lab") || heldItem.id.includes("turret")) {
        tile.chestInventory = Array(6).fill(null);
      } else if (isFurnace(heldItem.id)) {
        tile.chestInventory = [null, null, null];
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
          role: "idle",
          inventory: null,
          energy: 100,
          hasEatenToday: false,
          walkTimer: Math.random() * 3 + 2,
          actionTimer: 0,
          statusText: "Just hired!",
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

      useItem();
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

export function regenerateMapResources(state: GameState): void {
  const grid = state.tiles;
  if (!grid) return;

  // 1. Regenerate Mining Quarry Area (x: 78..115, y: 6..35)
  for (let y = 6; y <= 35; y++) {
    for (let x = 78; x <= 115; x++) {
      const t = grid[y]?.[x];
      if (!t || t.kind === "mine_cave" || t.kind === "placed_item" || t.kind === "path" || t.kind === "house" || t.kind === "shop") continue;
      if ((t.kind === "grass" || t.kind === "soil") && Math.random() < 0.35) {
        const rand = Math.random();
        if (rand < 0.20) t.kind = "debris_stone";
        else if (rand < 0.35) t.kind = "ore_iron";
        else if (rand < 0.48) t.kind = "ore_silver";
        else if (rand < 0.60) t.kind = "ore_aluminum";
        else if (rand < 0.72) t.kind = "ore_coal";
        else if (rand < 0.84) t.kind = "ore_copper";
        else if (rand < 0.95) t.kind = "ore_gold";
      }
    }
  }

  // 2. Regenerate trees & wild flora across the world grid (Sampled randomly to maintain high performance)
  const sampleCount = Math.min(200, Math.floor((ROWS * COLS) / 1200));
  for (let i = 0; i < sampleCount; i++) {
    const rx = Math.floor(Math.random() * COLS);
    const ry = Math.floor(Math.random() * ROWS);
    if (rx < 50 && ry < 50) continue;
    const t = grid[ry]?.[rx];
    if (t && t.kind === "grass" && !t.placedItemId) {
      const rand = Math.random();
      if (rand < 0.45) t.kind = "tree";
      else if (rand < 0.75) t.kind = "debris_weed";
      else t.kind = "debris_branch";
    }
  }
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

  // Auto-regenerate map ores, trees, and resources
  regenerateMapResources(state);

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
        const farmTile = state.tiles[animal.y]?.[animal.x];
        if (farmTile && (farmTile.kind === "grass" || farmTile.kind === "soil")) {
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

  // 4. Sprinklers automation (Waters surrounding soil BEFORE drying them out - uses cached machine coords)
  for (let i = 0; i < _cachedMachineCoords.length; i++) {
    const { x, y } = _cachedMachineCoords[i];
    const tile = state.tiles[y]?.[x];
    if (tile?.kind === "placed_item" && tile.placedItemId?.startsWith("sprinkler")) {
      if (tile.placedItemId === "sprinkler_basic") {
        const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        adj.forEach(([dy, dx]) => {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            const target = state.tiles[ny]?.[nx];
            if (!target) return;
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
              const target = state.tiles[ny]?.[nx];
              if (!target) continue;
              target.watered = true;
              if (target.kind === "soil") target.kind = "watered";
            }
          }
        }
      }
    }
  }

  // 5. Tilled Soil update (Dries watered soil, advances crop growth)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = state.tiles[y]?.[x];
      if (!t) continue;

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

const worldGenNoise = new ImprovedNoise();
const noiseBase = new ImprovedNoise();

export function getGrassColor(x: number, y: number, season: string = "spring"): string {
  const b = getBiomeAt(x, y);
  const n = noiseBase.noise(x * 0.08, y * 0.08, 0);
  const tint = (n * 16) | 0;

  if (b.kind === "mountain") {
    if (b.name.includes("Frosted")) {
      const r = Math.min(255, 222 + tint);
      const g = Math.min(255, 232 + tint);
      const bl = Math.min(255, 242 + tint);
      return `rgb(${r}, ${g}, ${bl})`;
    }
    const r = Math.max(0, 95 + tint);
    const g = Math.max(0, 105 + tint);
    const bl = Math.max(0, 115 + tint);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  if (b.kind === "badlands") {
    const r = Math.min(255, Math.max(0, 175 + tint));
    const g = Math.min(255, Math.max(0, 92 + (tint >> 1)));
    const bl = Math.min(255, Math.max(0, 60 + (tint >> 2)));
    return `rgb(${r}, ${g}, ${bl})`;
  }

  if (b.kind === "swamp") {
    const r = Math.max(0, 52 + (tint >> 1));
    const g = Math.max(0, 68 + (tint >> 1));
    const bl = Math.max(0, 40 + (tint >> 2));
    return `rgb(${r}, ${g}, ${bl})`;
  }

  if (b.kind === "forest") {
    const r = Math.max(0, 78 + tint);
    const g = Math.max(0, 98 + tint);
    const bl = Math.max(0, 61 + (tint >> 1));
    return `rgb(${r}, ${g}, ${bl})`;
  }

  if (b.kind === "beach") {
    const r = Math.min(255, 212 + tint);
    const g = Math.min(255, 188 + tint);
    const bl = Math.min(255, 122 + tint);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  // Plains / Meadow: Seasonal shift
  if (season === "fall") {
    return `rgb(${155 + tint}, ${120 + (tint >> 1)}, ${55 + (tint >> 2)})`;
  } else if (season === "winter") {
    return `rgb(${190 + tint}, ${205 + tint}, ${215 + tint})`;
  } else if (season === "summer") {
    return `rgb(${108 + tint}, ${117 + tint}, ${75 + (tint >> 1)})`;
  }
  return `rgb(${104 + tint}, ${110 + tint}, ${75 + (tint >> 1)})`;
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
export function getWorldCamera(state: GameState, width: number, height: number) {
  const grid = state.inHouse ? state.houseGrid! : state.inMine ? state.mineGrid : state.tiles;
  const { player } = state;
  const origin = (position: number, tiles: number, viewport: number) => {
    const size = tiles * TILE;
    if (size < viewport) return (size - viewport) / 2;
    return Math.max(0, Math.min(size - viewport, (position + 0.5) * TILE - viewport / 2));
  };
  return {
    x: origin(player.subX ?? player.x, grid[0]?.length ?? 0, width),
    y: origin(player.subY ?? player.y, grid.length, height),
  };
}

const terrainColors = new Map<Season, string[]>();
function terrainColor(x: number, y: number, season: Season): string {
  let colors = terrainColors.get(season);
  if (!colors) {
    colors = new Array<string>(COLS * ROWS);
    terrainColors.set(season, colors);
  }
  const index = y * COLS + x;
  return colors[index] ??= getGrassColor(x, y, season);
}

const surfaceChunkSize = 10;
const surfaceChunks = new Map<string, { image: HTMLCanvasElement; ore: string }>();
let surfaceSeason: Season | undefined;
let surfaceLowDetail = false;

function surfaceChunk(grid: Tile[][], cx: number, cy: number, season: Season, lowDetail: boolean) {
  if (surfaceSeason !== season || surfaceLowDetail !== lowDetail) {
    surfaceChunks.clear();
    surfaceSeason = season;
    surfaceLowDetail = lowDetail;
  }
  const key = `${cx}:${cy}`;
  const firstX = cx * surfaceChunkSize;
  const firstY = cy * surfaceChunkSize;
  const size = surfaceChunkSize * TILE;
  // Only resource beds and bare ground change the background raster.
  let mineralMask = "";
  for (let y = firstY; y < firstY + surfaceChunkSize; y++) {
    for (let x = firstX; x < firstX + surfaceChunkSize; x++) {
      const tile = grid[y]?.[x];
      const kind = tile?.foundation ?? tile?.kind;
      mineralMask += kind?.startsWith("ore_") || kind === "water" || kind === "path" ? `|${kind}` : "|";
    }
  }
  const cached = surfaceChunks.get(key);
  if (cached?.ore === mineralMask) return cached.image;
  const image = cached?.image ?? document.createElement("canvas");
  if (!cached) image.width = image.height = size;
  const raster = image.getContext("2d")!;
  raster.setTransform(1, 0, 0, 1, -firstX * TILE, -firstY * TILE);
  for (let y = firstY; y < firstY + surfaceChunkSize; y++) {
    for (let x = firstX; x < firstX + surfaceChunkSize; x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;
      const kind = tile.foundation ?? tile.kind;
      raster.fillStyle = terrainColor(x, y, season);
      raster.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (kind !== "water" && kind !== "path" && (!lowDetail || kind.startsWith("ore_"))) drawGroundDetail(raster, x, y, kind);
    }
  }
  if (surfaceChunks.size >= 84) surfaceChunks.delete(surfaceChunks.keys().next().value);
  surfaceChunks.set(key, { image, ore: mineralMask });
  return image;
}

function paintBuildPreview(ctx: CanvasRenderingContext2D, x: number, y: number, id: string, direction: NonNullable<Tile["direction"]>, plan: boolean) {
  const ghost: Tile = { kind: "placed_item", age: 0, watered: false, placedItemId: id, direction };
  ctx.save();
  ctx.globalAlpha = plan ? .46 : .64;
  if (isTerrainItem(id)) drawIndustrialSurface(ctx, x, y, id);
  else if (isConveyor(id)) drawConveyor(ctx, x, y, ghost, 0);
  else if (!drawYardMachine(ctx, x, y, ghost, 0) && !drawWorkshopItem(ctx, id, x, y)) {
    ctx.fillStyle = ITEM_DEFS[id]?.iconColor ?? "#adb590";
    ctx.fillRect(x + 6, y + 6, 20, 20);
    ctx.fillStyle = "#eeead0";
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(ITEM_DEFS[id]?.iconSymbol ?? "+", x + 16, y + 21);
  }
  ctx.globalAlpha = .95;
  if (plan) {
    ctx.strokeStyle = "#93bfaf";
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x + 1, y + 1, 30, 30);
    ctx.setLineDash([]);
  }
  if (isConveyor(id) || /drill|inserter/.test(id)) {
    const { dx, dy } = getDirectionVector(direction);
    const tx = x + 16 + dx * 20, ty = y + 16 + dy * 20;
    ctx.strokeStyle = plan ? "#bee0d3" : "#eee0a1";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 16);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx - dx * 6 - dy * 4, ty - dy * 6 + dx * 4);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - dx * 6 + dy * 4, ty - dy * 6 - dx * 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewWidth: number,
  viewHeight: number,
  hoveredTile?: { x: number; y: number } | null,
  zoom: number = 1.0
) {
  ctx.imageSmoothingEnabled = false;

  const effectiveWidth = viewWidth / zoom;
  const effectiveHeight = viewHeight / zoom;

  const currentGrid = state.inHouse
    ? state.houseGrid!
    : (state.inMine ? state.mineGrid : state.tiles);
  const gridRows = currentGrid.length;
  const gridCols = currentGrid[0]?.length || 0;

  const p = state.player;
  const playerPx = (p.subX !== undefined ? p.subX : p.x) * TILE + TILE / 2;
  const playerPy = (p.subY !== undefined ? p.subY : p.y) * TILE + TILE / 2;

  const { x: cameraX, y: cameraY } = getWorldCamera(state, effectiveWidth, effectiveHeight);

  // Background
  ctx.fillStyle = state.inHouse ? "#100f0f" : (state.inMine ? "#231f20" : "#666b48"); // void background for house interior
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  const startCol = Math.max(0, Math.floor(cameraX / TILE));
  const endCol = Math.min(gridCols, Math.ceil((cameraX + effectiveWidth) / TILE));
  const startRow = Math.max(0, Math.floor(cameraY / TILE));
  const endRow = Math.min(gridRows, Math.ceil((cameraY + effectiveHeight) / TILE));

  const phase = getTimePhase(state.time);
  const frameTime = performance.now();

  // Checker functions for terrains
  const isWater = (t: Tile | undefined) => !!t && t.kind === "water";
  const isPath = (t: Tile | undefined) => !!t && t.kind === "path";
  const isSoil = (t: Tile | undefined) => !!t && (t.kind === "soil" || t.kind === "watered" || t.cropId !== undefined);

  if (!state.inHouse && !state.inMine) {
    for (let cy = Math.floor(startRow / surfaceChunkSize); cy < Math.ceil(endRow / surfaceChunkSize); cy++) {
      for (let cx = Math.floor(startCol / surfaceChunkSize); cx < Math.ceil(endCol / surfaceChunkSize); cx++) {
        const texture = surfaceChunk(currentGrid, cx, cy, state.season, state.settings?.graphicsQuality === "low");
        ctx.drawImage(texture, cx * surfaceChunkSize * TILE, cy * surfaceChunkSize * TILE);
      }
    }
  } else if (state.inMine) {
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#3d312a" : "#352b25";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  // Terrain Tiles Layer (Layer 2: Seamless Factorio Water Lakes, Concrete Paths, and Agricultural Plots)
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (t.paving || (t.foundation ?? t.kind) === "path") {
        drawIndustrialSurface(ctx, px, py, t.paving ?? "concrete");
        drawGroundDetail(ctx, x, y, "path");
      } else if (t.kind === "water") {
        const shore = (y > 0 && currentGrid[y - 1]?.[x]?.kind !== "water" ? 1 : 0)
          | (x + 1 < gridCols && currentGrid[y]?.[x + 1]?.kind !== "water" ? 2 : 0)
          | (y + 1 < gridRows && currentGrid[y + 1]?.[x]?.kind !== "water" ? 4 : 0)
          | (x > 0 && currentGrid[y]?.[x - 1]?.kind !== "water" ? 8 : 0);
        drawBasinWater(ctx, x, y, shore, frameTime, state.settings?.graphicsQuality !== "low");
      } else if (t.kind === "soil" || t.kind === "watered" || t.cropId !== undefined) {
        // Space Age Gleba Bio-Peat Bed / Nutrient Soil (Seamless Organic Blend)
        const isWatered = t.kind === "watered" || t.watered;
        ctx.fillStyle = isWatered ? "#241c14" : "#3a2e22";
        ctx.fillRect(px, py, TILE, TILE);

        for (let furrow = 2; furrow < TILE; furrow += 8) {
          ctx.fillStyle = isWatered ? "#1a1812" : "#2c261c";
          ctx.fillRect(px + furrow, py, 2.5, TILE);
          ctx.fillStyle = isWatered ? "#3a2c20" : "#53412e";
          ctx.fillRect(px + furrow + 3, py, 1.5, TILE);
        }
        drawGroundDetail(ctx, x, y, "path");

        // Organic Soil Edge Granules
        ctx.fillStyle = isWatered ? "#1b140e" : "#4a3b2c";
        const rNoise = seedRandom(x * 19 + y * 31);
        if (rNoise > 0.4) {
          ctx.fillRect(px + 4 + (rNoise * 16), py + 4 + ((rNoise * 33) % 16), 2, 2);
        }

        // Glistening effect on moist soil
        if (isWatered) {
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
        if (x >= 12 && x <= 17 && y >= 24 && y <= 28) {
          const rx = x - 12;
          const ry = y - 24;
          if (ry < 4) {
            ctx.fillStyle = ry < 2 ? "#58655c" : "#42534b";
            ctx.fillRect(px, py, TILE, TILE);
            for (let i = 2; i < TILE; i += 8) {
              ctx.fillStyle = "rgba(22,33,25,.34)";
              ctx.fillRect(px + i, py, 2.5, TILE);
              ctx.fillStyle = "rgba(205,209,179,.15)";
              ctx.fillRect(px + i + 2.5, py, 1, TILE);
            }
            if (ry === 2) {
              ctx.fillStyle = "#788073";
              ctx.fillRect(px, py, TILE, 3);
              ctx.fillStyle = "#303c34";
              ctx.fillRect(px, py + 3, TILE, 1);
            }
            if (ry === 1 && rx === 2) {
              ctx.fillStyle = "#30332c";
              ctx.fillRect(px + 9, py + 6, 12, 17);
              ctx.fillStyle = "#9a735c";
              ctx.fillRect(px + 7, py + 5, 10, 13);
              ctx.fillStyle = "#393932";
              ctx.fillRect(px + 6, py + 4, 12, 5);
            }
          } else {
            ctx.fillStyle = "#75634d";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#3a4037";
            ctx.fillRect(px, py, TILE, 4);
            ctx.fillRect(px, py + 28, TILE, 4);
            if (rx === 3) {
              ctx.fillStyle = "#282f29";
              ctx.fillRect(px + 5, py + 6, 22, 26);
              ctx.fillStyle = "#856c49";
              ctx.fillRect(px + 6, py + 7, 2, 24);
            } else if (rx === 1 || rx === 4) {
              ctx.fillStyle = "#35433b";
              ctx.fillRect(px + 6, py + 10, 20, 13);
              ctx.fillStyle = "#a79b6c";
              ctx.fillRect(px + 7, py + 11, 8, 9);
              ctx.fillRect(px + 17, py + 11, 8, 9);
            }
          }
        } else if (x >= 64 && x <= 74 && y >= 32 && y <= 40) {
          // Factorio Orbital Logistics Depot & Exchange Post
          const rx = x - 64;
          const ry = y - 32;

          // Reinforced Industrial Steel Container Plating
          ctx.fillStyle = ry <= 2 ? "#2c3e50" : "#475569";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(px, py + TILE - 2, TILE, 2);

          // Yellow Crane Girders & Hazard Edge
          if (ry === 0) {
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(px, py, TILE, 4);
          }

          // Glowing Neon Logistics Depot Sign
          if ((rx === 5 || rx === 6) && ry === 3) {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(px, py + 8, TILE, TILE - 16);
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(px + 2, py + 10, TILE - 4, TILE - 20);
            ctx.fillStyle = "#000000";
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "center";
            ctx.fillText(rx === 5 ? "DE" : "POT", px + TILE / 2, py + TILE / 2 + 2);
          }
        } else {
          // Fallback industrial outpost
          ctx.fillStyle = "#334155";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#1e293b";
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

  // Factorio Alt-Grid Overlay Lines
  if (state.settings?.showGrid) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startCol; x <= endCol; x++) {
      ctx.moveTo(x * TILE, startRow * TILE);
      ctx.lineTo(x * TILE, endRow * TILE);
    }
    for (let y = startRow; y <= endRow; y++) {
      ctx.moveTo(startCol * TILE, y * TILE);
      ctx.lineTo(endCol * TILE, y * TILE);
    }
    ctx.stroke();
  }

  // Factorio Industrial Pollution Cloud Visualizer Overlay
  if (state.settings?.showPollution ?? true) {
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const t = currentGrid[y][x];
        if (t.kind === "placed_item" && t.placedItemId) {
          const id = t.placedItemId;
          if (id.includes("drill") || id.includes("furnace") || id.includes("boiler") || id.includes("assembler") || id.includes("refinery")) {
            const px = x * TILE;
            const py = y * TILE;
            const pulse = (Math.sin(Date.now() / 400 + x * 3 + y * 7) + 1) * 0.5;
            ctx.fillStyle = `rgba(180, 40, 20, ${0.12 + pulse * 0.08})`;
            ctx.beginPath();
            ctx.arc(px + 16, py + 16, 28 + pulse * 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  const specialtyStructures: { x: number; y: number; t: Tile }[] = [];
  // Terrain Tiles Layer (Layer 3: Trees, Growing Crops, Debris, and Placed Items)
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (t.kind === "tree") {
        const elapsed = t.lastHitTime ? Date.now() - t.lastHitTime : Infinity;
        const shake = elapsed < 360 ? Math.sin(elapsed * .05) * (1 - elapsed / 360) * 4 : 0;
        drawEvergreen(ctx, x, y, state.season, shake, state.settings?.shadowsEnabled !== false);
      }

      // Render Debris, Rocks, and Factorio Ore Deposits
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

        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 25, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#525a37";
        ctx.beginPath();
        ctx.arc(px + 12 + weedShake, py + 20, 6, 0, Math.PI * 2);
        ctx.arc(px + 20 + weedShake, py + 20, 5, 0, Math.PI * 2);
        ctx.arc(px + 16 + weedShake, py + 15, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#7a7950";
        ctx.beginPath();
        ctx.arc(px + 12 + weedShake, py + 18, 3, 0, Math.PI * 2);
        ctx.arc(px + 18 + weedShake, py + 14, 4, 0, Math.PI * 2);
        ctx.fill();

      } else if (t.kind === "debris_branch") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 23, 12, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#795548";
        ctx.fillRect(px + 6 + debrisShake, py + 18, 20, 4);
        ctx.fillRect(px + 18 + debrisShake, py + 10, 4, 8);
        ctx.fillRect(px + 10 + debrisShake, py + 14, 3, 5);

        ctx.fillStyle = "#a1887f";
        ctx.fillRect(px + 6 + debrisShake, py + 19, 2, 2);
        ctx.fillRect(px + 24 + debrisShake, py + 19, 2, 2);

      } else if (t.kind === "debris_stone") {
        // Factorio Heavy Granite Rock Boulder
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 25, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark Basalt Rock Shadow Base
        ctx.fillStyle = "#373e48";
        ctx.beginPath();
        ctx.moveTo(px + 5 + debrisShake, py + 25);
        ctx.lineTo(px + 9 + debrisShake, py + 11);
        ctx.lineTo(px + 22 + debrisShake, py + 9);
        ctx.lineTo(px + 27 + debrisShake, py + 25);
        ctx.closePath();
        ctx.fill();

        // Chiseled Facet Highlight
        ctx.fillStyle = "#515b69";
        ctx.beginPath();
        ctx.moveTo(px + 9 + debrisShake, py + 11);
        ctx.lineTo(px + 22 + debrisShake, py + 9);
        ctx.lineTo(px + 17 + debrisShake, py + 25);
        ctx.closePath();
        ctx.fill();

        // Specular Edge Highlight
        ctx.strokeStyle = "#758496";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px + 9 + debrisShake, py + 11);
        ctx.lineTo(px + 22 + debrisShake, py + 9);
        ctx.stroke();

        // Rock fissure crack
        ctx.strokeStyle = "#252930";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 15 + debrisShake, py + 11);
        ctx.lineTo(px + 13 + debrisShake, py + 19);
        ctx.stroke();

      } else if (state.inMine && (t.kind === "ore_copper" || t.kind === "ore_iron" || t.kind === "ore_gold" || t.kind === "ore_uranium" || t.kind === "ore_silver" || t.kind === "ore_coal" || t.kind === "ore_aluminum")) {
        // Factorio Metallic Ore Vein Deposit
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 25, 13, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#2c323d"; // Slate host stone
        ctx.beginPath();
        ctx.moveTo(px + 5 + debrisShake, py + 25);
        ctx.lineTo(px + 10 + debrisShake, py + 9);
        ctx.lineTo(px + 23 + debrisShake, py + 11);
        ctx.lineTo(px + 27 + debrisShake, py + 25);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#434b57";
        ctx.beginPath();
        ctx.moveTo(px + 10 + debrisShake, py + 9);
        ctx.lineTo(px + 23 + debrisShake, py + 11);
        ctx.lineTo(px + 18 + debrisShake, py + 25);
        ctx.closePath();
        ctx.fill();

        const oreColors = {
          ore_copper: ["#a04000", "#d35400", "#ff9f43"],
          ore_iron: ["#2980b9", "#3498db", "#74b9ff"],
          ore_gold: ["#b7950b", "#f1c40f", "#fff275"],
          ore_uranium: ["#10ac84", "#2ecc71", "#00ff66"],
          ore_silver: ["#7f8c8d", "#bdc3c7", "#ffffff"],
          ore_coal: ["#121417", "#2c3e50", "#5d6d7e"],
          ore_aluminum: ["#922b21", "#c0392b", "#ecf0f1"]
        }[t.kind as string] || ["#888", "#aaa", "#fff"];

        // Uranium radioactive pulse effect
        const isUranium = t.kind === "ore_uranium";
        const pulse = isUranium ? Math.sin(Date.now() / 200) * 0.3 + 0.7 : 1;

        const crystals = [
          { dx: -5, dy: -5, size: 5 },
          { dx: 5, dy: -2, size: 6 },
          { dx: 0, dy: 4, size: 4.5 }
        ];

        crystals.forEach((c) => {
          const cx = px + 16 + c.dx + debrisShake;
          const cy = py + 14 + c.dy;
          const s = c.size;

          ctx.fillStyle = oreColors[1];
          ctx.globalAlpha = pulse;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s / 1.4, cy);
          ctx.lineTo(cx, cy + s);
          ctx.lineTo(cx - s / 1.4, cy);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = oreColors[2];
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s / 1.4, cy);
          ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Crystalline Metallic Sparkle
          if (Math.sin(Date.now() / 120 + c.dx * 10) > 0.7) {
            ctx.fillStyle = isUranium ? "#00ff66" : "#ffffff";
            ctx.fillRect(cx - 1, cy - s - 1, 2, 2);
          }
        });
      } else if (t.kind === "ore_crude_oil") {
        // Factorio Crude Oil Geyser Spring Pool
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 22, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#11161b";
        ctx.beginPath();
        ctx.ellipse(px + 16 + debrisShake, py + 20, 13, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#2c3e50";
        ctx.beginPath();
        ctx.ellipse(px + 14 + debrisShake, py + 18, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        const oilBubble = (Math.sin(Date.now() / 200 + (x * 7 + y * 13)) + 1) * 0.5;
        ctx.fillStyle = "#f39c12";
        ctx.beginPath();
        ctx.arc(px + 12 + oilBubble * 8 + debrisShake, py + 18, 2 + oilBubble * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t.looseItems?.length) {
        for (const [index, item] of t.looseItems.slice(0, 3).entries()) {
          const x0 = px + 7 + index * 7;
          const y0 = py + 12 - (index % 2) * 5;
          if (!drawWorkshopItem(ctx, item.id, x0, y0, 15)) {
            ctx.fillStyle = "#342f24";
            ctx.fillRect(x0 + 1, y0 + 3, 10, 8);
            ctx.fillStyle = item.iconColor;
            ctx.fillRect(x0 + 2, y0 + 2, 8, 5);
          }
        }
      }
      if (t.buildPlan && !t.placedItemId) {
        paintBuildPreview(ctx, px, py, t.buildPlan.id, t.buildPlan.direction, true);
      }

      // Render placed equipment.
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        if (/roboport|rail|locomotive|cargo_wagon|rocket_silo|combinator|nuclear_reactor|centrifuge|heat_exchanger|steam_turbine|space_platform_hub|cargo_landing_pad|spidertron|foundry|electromagnetic_plant|biochamber|agricultural_tower/.test(id)) specialtyStructures.push({ x, y, t });
        const dir = t.direction || "right";

        if (id.includes("chest")) {
          drawWorkshopItem(ctx, id, px, py);
        } else if (isConveyor(id)) {
          drawConveyor(ctx, px, py, t, frameTime);
        } else if (drawYardMachine(ctx, px, py, t, frameTime)) {
          // Custom-rendered drill, furnace, or inserter.
        } else if (id.includes("pumpjack")) {
          const isElectric = false;
          const isPumpjack = true;
          const drillTime = frameTime / 60;

          if (isPumpjack) {
            // Factorio Pumpjack (Olive Green Nodding Donkey Walking Beam)
            ctx.fillStyle = "#1e272c";
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            // Olive Green Base Frame
            ctx.fillStyle = "#1e824c";
            ctx.fillRect(px + 4, py + 16, TILE - 8, 12);
            // Bobbing Walking Beam / Horse-Head Counterweight
            const pumpBob = Math.sin(Date.now() / 250) * 4;
            ctx.fillStyle = "#27ae60";
            ctx.beginPath();
            ctx.moveTo(px + 6, py + 12 + pumpBob);
            ctx.lineTo(px + 22, py + 6 - pumpBob);
            ctx.lineTo(px + 26, py + 10 - pumpBob);
            ctx.lineTo(px + 10, py + 16 + pumpBob);
            ctx.closePath();
            ctx.fill();
            // Piston Rod
            ctx.strokeStyle = "#ecf0f1";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px + 7, py + 14 + pumpBob);
            ctx.lineTo(px + 7, py + 26);
            ctx.stroke();
          } else if (isElectric) {
            // Factorio Electric Mining Drill (Teal Housing, Yellow Trim & Heavy Dual Legs)
            // Background Ground Shadow
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);

            // Heavy Dark Steel Tripod Strut Legs (Left & Right)
            ctx.fillStyle = "#2d3436";
            ctx.fillRect(px + 3, py + 6, 6, TILE - 10);
            ctx.fillRect(px + TILE - 9, py + 6, 6, TILE - 10);
            ctx.fillStyle = "#636e72";
            ctx.fillRect(px + 5, py + 8, 2, TILE - 14);
            ctx.fillRect(px + TILE - 7, py + 8, 2, TILE - 14);

            // Iconic Cyan/Teal Upper Motor Housing
            ctx.fillStyle = "#00cec9";
            ctx.fillRect(px + 6, py + 3, TILE - 12, 10);
            ctx.fillStyle = "#0984e3";
            ctx.fillRect(px + 9, py + 5, TILE - 18, 6);
            // Yellow Warning Top Bracket
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(px + 8, py + 2, TILE - 16, 2.5);

            // Center Heavy Spiraling Auger Drill Bit (Animated)
            const augerY = (drillTime % 6);
            ctx.fillStyle = "#2d3436";
            ctx.fillRect(px + 12, py + 12, 8, 14);
            ctx.fillStyle = "#b2bec3";
            for (let i = 0; i < 3; i++) {
              const yOffset = (13 + i * 4 + augerY) % 13;
              ctx.fillRect(px + 12, py + 13 + yOffset, 8, 2);
            }

            // Directional Discharge Chute Indicator
            ctx.save();
            ctx.translate(px + TILE / 2, py + TILE / 2);
            if (dir === "up") ctx.rotate(-Math.PI / 2);
            else if (dir === "down") ctx.rotate(Math.PI / 2);
            else if (dir === "left") ctx.rotate(Math.PI);
            ctx.fillStyle = "#e74c3c";
            ctx.fillRect(10, -2.5, 4, 5);
            ctx.restore();
          } else {
            // Factorio Burner Mining Drill (A-Frame Steel Struts, Exhaust & Fuel Hopper)
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);

            // A-Frame Dark Steel Struts
            ctx.fillStyle = "#3d3d3d";
            ctx.beginPath();
            ctx.moveTo(px + 5, py + TILE - 4);
            ctx.lineTo(px + 14, py + 5);
            ctx.lineTo(px + 18, py + 5);
            ctx.lineTo(px + TILE - 5, py + TILE - 4);
            ctx.lineTo(px + TILE - 9, py + TILE - 4);
            ctx.lineTo(px + 16, py + 8);
            ctx.lineTo(px + 9, py + TILE - 4);
            ctx.closePath();
            ctx.fill();

            // Left Chimney Exhaust
            ctx.fillStyle = "#555555";
            ctx.fillRect(px + 4, py + 2, 4, 10);
            ctx.fillStyle = "#777777";
            ctx.fillRect(px + 3, py + 1, 6, 2);

            // Right Rusty Fuel Hopper
            ctx.fillStyle = "#b87333";
            ctx.fillRect(px + TILE - 10, py + 8, 7, 10);
            ctx.fillStyle = "#8c531b";
            ctx.fillRect(px + TILE - 9, py + 9, 5, 8);

            // Central Heavy Rotating Auger
            ctx.fillStyle = "#2d3436";
            ctx.fillRect(px + 12, py + 11, 8, 15);
            ctx.fillStyle = "#95a5a6";
            ctx.fillRect(px + 12, py + 13 + ((drillTime * 0.8) % 8), 8, 2);
          }
        }

        // 3. Factorio Robotic Inserters (All Tiers)
        else if (id.includes("inserter")) {
          const isStack = id.includes("stack");
          const isFast = id.includes("fast");
          const isLong = id.includes("long");
          const isFilter = id.includes("filter");
          const armColor = isStack ? "#2ecc71" : isFilter ? "#9b59b6" : isLong ? "#e74c3c" : isFast ? "#3498db" : "#f1c40f";

          // Heavy Motor Base
          ctx.fillStyle = "#2c3e50";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = armColor;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Multi-Segment Articulated Arm
          const armAngle = (t.inserterArmAngle !== undefined ? t.inserterArmAngle : 0);
          const { dx, dy } = getDirectionVector(dir);
          const baseAngle = Math.atan2(dy, dx);
          const totalAngle = baseAngle + armAngle;

          const armLen = isLong ? 19 : 13;
          const midX = px + TILE / 2 + Math.cos(totalAngle) * (armLen * 0.55);
          const midY = py + TILE / 2 + Math.sin(totalAngle) * (armLen * 0.55) - 3;
          const endX = px + TILE / 2 + Math.cos(totalAngle) * armLen;
          const endY = py + TILE / 2 + Math.sin(totalAngle) * armLen;

          ctx.strokeStyle = armColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + TILE / 2, py + TILE / 2);
          ctx.lineTo(midX, midY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Robotic Hand Claw
          ctx.fillStyle = "#ecf0f1";
          ctx.beginPath();
          ctx.arc(endX, endY, isStack ? 4.5 : 3.2, 0, Math.PI * 2);
          ctx.fill();

          if (t.inserterHolding) {
            ctx.fillStyle = "#f39c12";
            ctx.beginPath();
            ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 4. Factorio Assembling Machines (Matching Attached Reference: 3 Interlocking Silver Cogs on Green Ribbed Base)
        else if (id.includes("assembling_machine") || id.includes("foundry") || id.includes("electromagnetic")) {
          const isT3 = id.includes("3") || id.includes("foundry");
          const isT2 = id.includes("2") || id.includes("electromagnetic");
          const baseColor = isT3 ? "#1e824c" : isT2 ? "#2980b9" : "#2e7d32";
          const darkRibColor = isT3 ? "#145a32" : isT2 ? "#1b4f72" : "#1b5e20";

          // Heavy Ground Chassis Base
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

          // Olive Green Machine Housing
          ctx.fillStyle = baseColor;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);

          // 4 Vertical Ribs / Louvers on Lower Half
          ctx.fillStyle = darkRibColor;
          ctx.fillRect(px + 4, py + 18, 4, 9);
          ctx.fillRect(px + 10, py + 18, 4, 9);
          ctx.fillRect(px + 17, py + 18, 4, 9);
          ctx.fillRect(px + 23, py + 18, 4, 9);

          // Recessed Upper Machinery Chamber (Rusty Bronze Interior)
          ctx.fillStyle = "#8c531b";
          ctx.fillRect(px + 5, py + 5, TILE - 10, 12);
          ctx.fillStyle = "#b87333";
          ctx.fillRect(px + 6, py + 6, TILE - 12, 10);

          // 3 Interlocking Silver-White Gears / Cogs (Animated)
          const cogRot = Date.now() / 150;
          const drawCog = (cx: number, cy: number, radius: number, rot: number) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rot);
            ctx.fillStyle = "#ecf0f1";
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#bdc3c7";
            ctx.fillRect(-radius - 1, -1.5, (radius + 1) * 2, 3);
            ctx.fillRect(-1.5, -radius - 1, 3, (radius + 1) * 2);
            // Center axle hole
            ctx.fillStyle = "#2c3e50";
            ctx.beginPath();
            ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };

          // Gear 1 (Top Left)
          drawCog(px + 10, py + 10, 4.2, cogRot);
          // Gear 2 (Bottom Center)
          drawCog(px + 15, py + 13, 3.8, -cogRot * 1.1);
          // Gear 3 (Top Right)
          drawCog(px + 20, py + 10, 4.2, cogRot);

          // Crafting Progress Bar
          if (t.assemblerProgress !== undefined && t.assemblerProgress > 0) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(px + 4, py + TILE - 4, TILE - 8, 2.5);
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(px + 4, py + TILE - 4, (TILE - 8) * t.assemblerProgress, 2.5);
          }
        }

        // 4b. Factorio Offshore Pump & Fluid In-Line Pumps (Matching Attached Reference: Dual Bronze Chambers & Pipes)
        else if (id.includes("offshore_pump") || id.includes("pump") && !id.includes("jack")) {
          // Machine Shadow & Metal Floor Base
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

          // Interconnecting Grey Conduit Pipes with Joint Flanges
          ctx.strokeStyle = "#7f8c8d";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 10, 0, Math.PI * 2);
          ctx.stroke();

          // Left Main Bronze Distillation Chamber
          ctx.fillStyle = "#d35400";
          ctx.fillRect(px + 5, py + 8, 10, 16);
          ctx.fillStyle = "#e67e22";
          ctx.fillRect(px + 7, py + 10, 6, 12);
          ctx.fillStyle = "#b84e12";
          ctx.fillRect(px + 4, py + 6, 12, 3);

          // Right Secondary Compression Chamber
          ctx.fillStyle = "#d35400";
          ctx.fillRect(px + 18, py + 5, 8, 12);
          ctx.fillStyle = "#e67e22";
          ctx.fillRect(px + 19, py + 6, 6, 9);
          ctx.fillStyle = "#b84e12";
          ctx.fillRect(px + 17, py + 4, 10, 2.5);

          // Central Glass Fluid Sight Gauge
          const waterFlow = (Math.sin(Date.now() / 120) + 1) * 0.5;
          ctx.fillStyle = `rgba(52, 152, 219, ${0.5 + waterFlow * 0.4})`;
          ctx.fillRect(px + 8, py + 12, 4, 7);
        }

        // 5. Factorio Smelting Furnaces (Stone, Steel, Electric, Foundry - Matching Attached Reference)
        else if (id.includes("furnace") || id.includes("foundry")) {
          const isElec = id.includes("electric");
          const isSteel = id.includes("steel");
          const isStone = id.includes("stone") || (!isElec && !isSteel);

          if (isStone) {
            // Factorio Stone Furnace (Stepped Masonry Pyramid with Roaring Hearth Fire)
            // Stepped Pyramid Base
            ctx.fillStyle = "#5a4d3b";
            ctx.fillRect(px + 3, py + 4, TILE - 6, TILE - 6);
            ctx.fillStyle = "#8c7c64";
            ctx.fillRect(px + 5, py + 6, TILE - 10, TILE - 9);
            ctx.fillStyle = "#b59c79";
            ctx.fillRect(px + 7, py + 7, TILE - 14, 6);
            // Top Chimney Hole
            ctx.fillStyle = "#2d241e";
            ctx.fillRect(px + 10, py + 3, TILE - 20, 4);

            // Arched Hearth Door with Roaring Flame
            ctx.fillStyle = "#1e140d";
            ctx.beginPath();
            ctx.arc(px + TILE / 2, py + 22, 6, Math.PI, 0);
            ctx.fillRect(px + TILE / 2 - 6, py + 22, 12, 5);
            ctx.fill();

            const fireGlow = t.smeltActive ? Math.sin(Date.now() / 80) * 0.3 + 0.7 : 0.4;
            ctx.fillStyle = `rgba(230, 126, 34, ${fireGlow})`;
            ctx.beginPath();
            ctx.arc(px + TILE / 2, py + 22, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(241, 196, 15, ${fireGlow})`;
            ctx.fillRect(px + TILE / 2 - 2, py + 20, 4, 4);
          } else if (isSteel) {
            // Factorio Steel Furnace (Heavy Steel Cylindrical Stack & Blast Furnace Hatch)
            ctx.fillStyle = "#2d3436";
            ctx.fillRect(px + 3, py + 4, TILE - 6, TILE - 6);
            ctx.fillStyle = "#636e72";
            ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 9);
            ctx.fillStyle = "#b2bec3";
            // Rivets and Piping
            ctx.fillRect(px + 4, py + 6, TILE - 8, 2);
            ctx.fillRect(px + 6, py + 2, 8, 4); // Steel Chimney
            ctx.fillStyle = "#1e272c";
            ctx.fillRect(px + 7, py + 1, 6, 3);

            // Horizontal Blast Furnace Viewing Hatch
            ctx.fillStyle = "#111827";
            ctx.fillRect(px + 6, py + 18, TILE - 12, 8);
            const blastGlow = t.smeltActive ? Math.sin(Date.now() / 60) * 0.3 + 0.7 : 0.5;
            ctx.fillStyle = `rgba(238, 82, 83, ${blastGlow})`;
            ctx.fillRect(px + 8, py + 19, TILE - 16, 6);
            ctx.fillStyle = `rgba(254, 202, 87, ${blastGlow})`;
            ctx.fillRect(px + 11, py + 20, TILE - 22, 4);
          } else {
            // Electric Furnace / Foundry
            ctx.fillStyle = "#16a085";
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = "#1abc9c";
            ctx.fillRect(px + 4, py + 4, TILE - 8, 4);
            ctx.fillStyle = "#1a252f";
            ctx.fillRect(px + 6, py + 12, TILE - 12, TILE - 16);
            if (t.smeltActive) {
              const glow = Math.sin(Date.now() / 90) * 0.3 + 0.7;
              ctx.fillStyle = `rgba(46, 204, 113, ${glow})`;
              ctx.fillRect(px + 8, py + 14, TILE - 16, TILE - 20);
            }
          }
        }

        // 6. Factorio Electrical Power Grid Poles & Substations
        else if (id.includes("power_pole") || id.includes("pole") || id.includes("substation")) {
          const isSub = id.includes("substation");
          const isMedium = id.includes("medium");
          ctx.fillStyle = isSub ? "#2c3e50" : isMedium ? "#7f8c8d" : "#795548";
          ctx.fillRect(px + 14, py + 4, 4, 24);
          ctx.fillRect(px + 5, py + 7, 22, 3);
          ctx.fillStyle = "#3498db"; // Ceramic insulators
          ctx.fillRect(px + 6, py + 10, 3, 3);
          ctx.fillRect(px + 23, py + 10, 3, 3);
        }

        else if (id === "stone_wall") {
          const connected = (dx: number, dy: number) => currentGrid[y + dy]?.[x + dx]?.placedItemId === "stone_wall";
          ctx.fillStyle = "#302f23";
          ctx.fillRect(px + 4, py + 7, 25, 23);
          ctx.fillStyle = "#7e7966";
          ctx.fillRect(px + 6, py + 5, 20, 20);
          if (connected(1, 0) || connected(-1, 0)) ctx.fillRect(px, py + 8, 32, 14);
          if (connected(0, 1) || connected(0, -1)) ctx.fillRect(px + 8, py, 16, 32);
          ctx.fillStyle = "#aaa28a";
          ctx.fillRect(px + 8, py + 7, 16, 5);
          ctx.fillStyle = "#514e40";
          ctx.fillRect(px + 11, py + 12, 1, 6);
          ctx.fillRect(px + 21, py + 16, 1, 5);
        } else if (id.includes("turret")) {
          const laser = id === "laser_turret";
          ctx.fillStyle = "#333a33";
          ctx.fillRect(px + 4, py + 5, 25, 23);
          ctx.fillStyle = "#737868";
          ctx.fillRect(px + 6, py + 6, 20, 18);
          ctx.fillStyle = "#aaa187";
          ctx.fillRect(px + 7, py + 7, 18, 2);
          ctx.fillStyle = "#2f352d";
          ctx.fillRect(px + 8, py + 17, 4, 6);
          ctx.save();
          ctx.translate(px + 16, py + 15);
          ctx.rotate(t.aimAngle ?? 0);
          ctx.fillStyle = "#222a25";
          ctx.fillRect(-8, -6, 18, 12);
          ctx.fillStyle = laser ? "#739f8d" : "#ae8c56";
          ctx.fillRect(-7, -5, 12, 8);
          ctx.fillStyle = "#b3b5a4";
          ctx.fillRect(3, -2, 13, 4);
          if ((t.fireCooldown ?? 0) > .23) {
            ctx.fillStyle = laser ? "#a3ffdf" : "#ffc977";
            ctx.fillRect(16, -2, 4, 4);
          }
          ctx.restore();
        }

        // 8. Factorio Science Lab
        else if (id.includes("lab")) {
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = "#3498db";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 10, 0, Math.PI * 2);
          ctx.fill();
          const pulse = Math.sin(Date.now() / 150) * 0.4 + 0.6;
          ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // 9. Storage Chests (Factorio 5-color Logistic & Steel Chests)
        else if (id.includes("chest") || id.includes("storage")) {
          const chestColor = id.includes("requester") ? "#2980b9" : id.includes("active") ? "#9b59b6" : id.includes("passive") ? "#e74c3c" : id.includes("buffer") ? "#27ae60" : id.includes("steel") ? "#7f8c8d" : id.includes("iron") ? "#3498db" : "#873600";
          ctx.fillStyle = chestColor;
          ctx.fillRect(px + 4, py + 8, TILE - 8, TILE - 11);
          ctx.fillStyle = "#f4d03f";
          ctx.fillRect(px + 12, py + 16, 8, 4);
        }

        // 10. Radar Station
        else if (id.includes("radar")) {
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 14);
          ctx.save();
          ctx.translate(px + TILE / 2, py + 12);
          ctx.rotate(Date.now() / 600);
          ctx.fillStyle = "#3498db";
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 11. Nuclear Reactors & Fusion Generators
        else if (id.includes("reactor") || id.includes("fusion")) {
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          // Glowing Radioactive Core
          const nucGlow = Math.sin(Date.now() / 120) * 0.3 + 0.7;
          ctx.fillStyle = id.includes("fusion") ? `rgba(0, 210, 211, ${nucGlow})` : `rgba(46, 204, 113, ${nucGlow})`;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // 12. Factorio Chemical Plants (Matching Attached Reference: Yellow Cylindrical Vessel, Bubbling Cyan Window, Right Chimney Stack)
        else if (id.includes("chemical") || id.includes("plant")) {
          // Base Ground Shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);

          // Main Yellow-Amber Reaction Tank Vessel
          ctx.fillStyle = "#7d6608";
          ctx.fillRect(px + 3, py + 7, 20, 19);
          ctx.fillStyle = "#d4ac0d";
          ctx.fillRect(px + 4, py + 8, 18, 17);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(px + 5, py + 9, 16, 4);

          // Top Motorized Agitator & Upper Pipe Elbows
          ctx.fillStyle = "#b7950b";
          ctx.fillRect(px + 7, py + 4, 10, 4);
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(px + 4, py + 3, 5, 4);
          ctx.fillRect(px + 3, py + 3, 2, 8);

          // Wide Curved Cyan/Blue Chemical Reaction Window
          ctx.fillStyle = "#1b2631";
          ctx.fillRect(px + 5, py + 14, 15, 9);
          const chemBubble = (Math.sin(Date.now() / 150) + 1) * 0.5;
          ctx.fillStyle = `rgba(0, 206, 201, ${0.7 + chemBubble * 0.3})`;
          ctx.fillRect(px + 6, py + 15, 13, 7);
          ctx.fillStyle = "#0984e3";
          ctx.fillRect(px + 6, py + 18, 13, 4);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 8 + (chemBubble * 6), py + 16, 2, 2);

          // Right Heavy Exhaust Stack / Distillation Chimney
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 22, py + 4, 7, 22);
          ctx.fillStyle = "#5d6d7e";
          ctx.fillRect(px + 23, py + 5, 5, 20);
          ctx.fillStyle = "#34495e";
          ctx.fillRect(px + 21, py + 2, 9, 3); // Chimney Rim
          ctx.fillRect(px + 22, py + 14, 7, 2); // Center Steel Collar Band
        }

        // 12b. Factorio Oil Refineries
        else if (id.includes("refinery")) {
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "#16a085";
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          // Fractionation distillation columns
          ctx.fillStyle = "#34495e";
          ctx.fillRect(px + 4, py + 5, 6, TILE - 10);
          ctx.fillRect(px + 14, py + 5, 6, TILE - 10);
          ctx.fillRect(px + 23, py + 8, 5, TILE - 13);
          ctx.fillStyle = "#f39c12";
          ctx.fillRect(px + 6, py + 7, 2, 4);
        }

        // 13. Centrifuges (Isotope Separation)
        else if (id.includes("centrifuge")) {
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.save();
          ctx.translate(px + TILE / 2, py + TILE / 2);
          ctx.rotate(Date.now() / 80);
          ctx.fillStyle = "#2ecc71";
          ctx.fillRect(-8, -2, 16, 4);
          ctx.fillRect(-2, -8, 4, 16);
          ctx.restore();
        }

        // 14. Beacons (Transmitting broadcast waves)
        else if (id.includes("beacon")) {
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
          ctx.fillStyle = "#e67e22";
          ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
          // Radio broadcast wave
          const waveRadius = (Date.now() / 40) % 12;
          ctx.strokeStyle = "rgba(52, 152, 219, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, waveRadius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 15. Boilers & Generators
        else if (id.includes("boiler") || id.includes("generator") || id.includes("engine")) {
          ctx.fillStyle = "#34495e";
          ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
          ctx.fillStyle = "#e67e22";
          ctx.fillRect(px + 4, py + 6, 8, 8);
          ctx.fillStyle = "#bdc3c7";
          ctx.beginPath();
          ctx.arc(px + 22, py + 16, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // 16. Factorio Rocket Silo (Iconic Climax from Official Trailer)
        else if (id.includes("rocket_silo") || id.includes("silo")) {
          // Circular Reinforced Launch Pad Base
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = "#34495e";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 13, 0, Math.PI * 2);
          ctx.fill();

          // Yellow/Black Hazard Striped Launch Perimeter Rim
          ctx.fillStyle = "#f1c40f";
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            ctx.fillRect(px + TILE / 2 + Math.cos(a) * 11 - 1.5, py + TILE / 2 + Math.sin(a) * 11 - 1.5, 3, 3);
          }

          // Center Orbital Rocket Fuselage
          ctx.fillStyle = "#ecf0f1"; // White rocket body
          ctx.fillRect(px + TILE / 2 - 3, py + 6, 6, 18);
          // Red Aerodynamic Nose Cone
          ctx.fillStyle = "#e74c3c";
          ctx.beginPath();
          ctx.moveTo(px + TILE / 2, py + 2);
          ctx.lineTo(px + TILE / 2 - 3.5, py + 6);
          ctx.lineTo(px + TILE / 2 + 3.5, py + 6);
          ctx.closePath();
          ctx.fill();
          // Booster Engine Thruster Flare / Steam
          const thrusterSteam = (Math.sin(Date.now() / 90) + 1) * 0.5;
          ctx.fillStyle = `rgba(230, 126, 34, ${0.4 + thrusterSteam * 0.4})`;
          ctx.fillRect(px + TILE / 2 - 2, py + 24, 4, 4);
          ctx.fillStyle = `rgba(241, 196, 15, ${0.6 + thrusterSteam * 0.4})`;
          ctx.fillRect(px + TILE / 2 - 1, py + 24, 2, 2);
        }

        // 17. Factorio Locomotives & Cargo Wagons
        else if (id.includes("train") || id.includes("locomotive") || id.includes("wagon")) {
          const isEngine = id.includes("locomotive") || id.includes("engine");
          ctx.fillStyle = "#1e272c";
          ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 8);
          ctx.fillStyle = isEngine ? "#c0392b" : "#2980b9";
          ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 12);
          if (isEngine) {
            // Cowcatcher and Headlight
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(px + TILE - 6, py + TILE / 2 - 2, 4, 4);
          }
        }

        // 18. Solar Panels & Accumulators
        else if (id.includes("solar_panel")) {
          ctx.fillStyle = "#2980b9";
          ctx.fillRect(px + 2, py + 6, TILE - 4, TILE - 10);
          ctx.fillStyle = "#ecf0f1";
          ctx.fillRect(px + 14, py + 6, 2, TILE - 10);
          ctx.fillRect(px + 2, py + 14, TILE - 4, 2);
        } else if (id.includes("battery") || id.includes("accumulator")) {
          ctx.fillStyle = "#27ae60";
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 10);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(px + 11, py + 12, 10, 5);
        }
      }
    }
  }

  // ==========================================
  // FACTORIO ALT-MODE (ALT) RECIPE & INFO OVERLAYS
  // ==========================================
  if (state.altMode) {
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const t = currentGrid[y]?.[x];
        if (!t || t.kind !== "placed_item" || !t.placedItemId) continue;

        const px = x * TILE;
        const py = y * TILE;
        const id = t.placedItemId;

        // 1. Assembling Machines & Chemical Plants -> Center Recipe Badge
        if (id.includes("assembling_machine") || id.includes("chemical") || id.includes("refinery") || id.includes("centrifuge") || id.includes("foundry")) {
          const recipeId = t.assemblerRecipeId || "iron_gear";
          const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
          const icon = ITEM_DEFS[recipe?.outputId || recipeId]?.iconSymbol || "⚙️";

          ctx.fillStyle = "rgba(18, 24, 34, 0.88)";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ff9200";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, px + TILE / 2, py + TILE / 2 + 1);

          // Mini progress bar if active crafting
          if (t.assemblerProgress && t.assemblerProgress > 0) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(px + 4, py + TILE - 5, TILE - 8, 3);
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(px + 4, py + TILE - 5, (TILE - 8) * t.assemblerProgress, 3);
          }
        }
        // 2. Furnaces -> Center Smelting Item Badge + Flame
        else if (id.includes("furnace") || id === "furnace") {
          const smeltOutput = t.smeltOutputId || "iron_bar";
          const icon = ITEM_DEFS[smeltOutput]?.iconSymbol || "🔩";

          ctx.fillStyle = "rgba(24, 20, 18, 0.88)";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2 - 2, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#e67e22";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, px + TILE / 2, py + TILE / 2 - 1);

          // Fuel / Flame status
          if (t.smeltTimer && t.smeltTimer > 0) {
            ctx.fillStyle = "#f39c12";
            ctx.font = "8px sans-serif";
            ctx.fillText("🔥", px + TILE / 2, py + TILE - 5);
          }
        }
        // 3. Mining Drills -> Output Direction Arrow & Ore Badge
        else if (id.includes("drill")) {
          const ore = t.drillTargetOre || "iron_ore";
          const oreIcon = ITEM_DEFS[ore]?.iconSymbol || "⛏️";

          ctx.fillStyle = "rgba(10, 20, 25, 0.85)";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + 8, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#00cec9";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "7.5px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(oreIcon, px + TILE / 2, py + 8.5);

          // Output Arrow
          const { dx, dy } = getDirectionVector(t.direction);
          const arrowX = px + TILE / 2 + dx * 10;
          const arrowY = py + TILE / 2 + dy * 10;
          ctx.fillStyle = "#f1c40f";
          ctx.beginPath();
          ctx.arc(arrowX, arrowY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // 4. Inserters -> Drop Direction Pointer
        else if (id.includes("inserter")) {
          const { dx, dy } = getDirectionVector(t.direction);
          const reach = id.includes("long") ? 2 : 1;
          const dropX = px + TILE / 2 + dx * (reach * TILE * 0.7);
          const dropY = py + TILE / 2 + dy * (reach * TILE * 0.7);

          ctx.fillStyle = "rgba(241, 196, 15, 0.9)";
          ctx.beginPath();
          ctx.arc(dropX, dropY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // 5. Chests -> Stored Items Count Badge
        else if (isChestBuilding(id) && t.chestInventory) {
          const firstItem = t.chestInventory.find((i) => i && i.count > 0);
          if (firstItem) {
            ctx.fillStyle = "rgba(15, 18, 24, 0.85)";
            ctx.fillRect(px + 4, py + 4, TILE - 8, 14);
            ctx.strokeStyle = "#4a5568";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 4, py + 4, TILE - 8, 14);

            ctx.font = "9px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(firstItem.iconSymbol || "📦", px + 5, py + 11);

            ctx.fillStyle = "#f1c40f";
            ctx.font = "bold 7px monospace";
            ctx.fillText(firstItem.count > 999 ? `${(firstItem.count / 1000).toFixed(1)}k` : `${firstItem.count}`, px + 15, py + 11);
          }
        }
        // 6. Science Labs -> Active Flask Badge
        else if (id.includes("lab")) {
          ctx.fillStyle = "rgba(10, 15, 30, 0.9)";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#3498db";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🧪", px + TILE / 2, py + TILE / 2 + 1);
        }
      }
    }
  }

  // Factorio Pollution Cloud Density Overlay
  if (state.settings?.showPollution && state.pollutionGrid) {
    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const poll = state.pollutionGrid[y]?.[x] || 0;
        if (poll > 5) {
          ctx.fillStyle = `rgba(185, 45, 20, ${Math.min(0.38, poll / 500)})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }

  // Render Factorio Biters
  if (!state.inMine && !state.inHouse) for (const scout of state.biters ?? []) {
    if (scout.x < startCol - 1 || scout.x > endCol + 1 || scout.y < startRow - 1 || scout.y > endRow + 1) continue;
    ctx.save();
    ctx.translate((scout.subX + .5) * TILE, (scout.subY + .5) * TILE);
    ctx.rotate(scout.heading ?? 0);
    const large = scout.type === "medium";
    const stride = Math.sin(frameTime * .017 + scout.x) * 3;
    ctx.strokeStyle = "#3c2c29";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let leg = -1; leg <= 1; leg++) {
      const reach = leg * 5;
      ctx.moveTo(reach, 0);
      ctx.lineTo(reach + stride, -8);
      ctx.moveTo(reach, 0);
      ctx.lineTo(reach - stride, 8);
    }
    ctx.stroke();
    ctx.fillStyle = large ? "#986151" : "#6b5140";
    ctx.beginPath();
    ctx.ellipse(-1, 0, large ? 11 : 8, large ? 6 : 4.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#deae68";
    ctx.fillRect(4, -3, 3, 2);
    ctx.fillRect(4, 1, 3, 2);
    ctx.restore();
  }

  if (!state.inHouse && state.settings?.graphicsQuality !== "low") {
    for (const effect of state.combatFx ?? []) {
      ctx.strokeStyle = effect.color;
      ctx.globalAlpha = effect.seconds / .13;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo((effect.from.x + .5) * TILE, (effect.from.y + .37) * TILE);
      ctx.lineTo((effect.to.x + .5) * TILE, (effect.to.y + .5) * TILE);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ==========================================
  // REAL-TIME POWER GRID COPPER TRANSMISSION WIRES
  // ==========================================
  const powerPoles: { x: number; y: number }[] = [];
  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = currentGrid[y]?.[x];
      if (t && t.kind === "placed_item" && (t.placedItemId?.includes("power_pole") || t.placedItemId?.includes("substation") || t.placedItemId?.includes("pole"))) {
        powerPoles.push({ x: x * TILE + 16, y: y * TILE + 8 });
      }
    }
  }

  if (powerPoles.length > 1) {
    ctx.strokeStyle = "#d35400";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < powerPoles.length; i++) {
      for (let j = i + 1; j < powerPoles.length; j++) {
        const p1 = powerPoles[i];
        const p2 = powerPoles[j];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist <= 9 * TILE) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2 + Math.min(dist * 0.15, 8); // realistic catenary sag
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
  }

  // ==========================================
  // FACTORIO CHARACTER CORPSES
  // ==========================================
  if (state.characterCorpses && state.characterCorpses.length > 0) {
    state.characterCorpses.forEach((corpse) => {
      const cx = corpse.x * TILE + 16;
      const cy = corpse.y * TILE + 16;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7f8c8d";
      ctx.fillRect(cx - 8, cy - 4, 16, 8);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    });
  }

  // ==========================================
  // FACTORIO CHARACTER NIGHT FLASHLIGHT CONE
  // ==========================================
  if (state.time >= 1200 || state.time <= 360 || state.inMine) {
    ctx.save();
    ctx.beginPath();
    const coneDist = 6 * TILE;
    const coneAngle = Math.PI / 3.5;
    let dirAngle = Math.PI / 2; // down
    if (p.dir === "up") dirAngle = -Math.PI / 2;
    else if (p.dir === "left") dirAngle = Math.PI;
    else if (p.dir === "right") dirAngle = 0;

    ctx.moveTo(playerPx, playerPy);
    ctx.arc(playerPx, playerPy, coneDist, dirAngle - coneAngle / 2, dirAngle + coneAngle / 2);
    ctx.closePath();
    const grad = ctx.createRadialGradient(playerPx, playerPy, 4, playerPx, playerPy, coneDist);
    grad.addColorStop(0, "rgba(255, 250, 200, 0.4)");
    grad.addColorStop(0.65, "rgba(255, 240, 180, 0.12)");
    grad.addColorStop(1, "rgba(255, 240, 180, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // ==========================================
  // ==========================================
  // 6. DRAW FACTORIO ENGINEER (MATCHING OFFICIAL MODEL)
  // ==========================================
  const isMoving = (p.walkSeconds ?? 0) > 0;
  const walkTime = (p.walkSeconds ?? 0) * 5.9;
  const walkBob = isMoving ? Math.sin(walkTime * 2) * 1.6 : 0;
  const leftLegOffset = isMoving ? Math.sin(walkTime) * 4.5 : 0;
  const rightLegOffset = isMoving ? -Math.sin(walkTime) * 4.5 : 0;
  const armSwing = (p.actionSeconds ?? 0) > 0 ? -4 * Math.sin(p.actionSeconds! * 13) : isMoving ? Math.sin(walkTime) * 3.5 : 0;

  const dressCol = p.dressColor || "#b4774e";
  const secCol = p.secondaryColor || "#1e2430";
  const suitType = p.suitType || "engineer";
  const helmetType = p.helmetType || "visor";

  // 1. Directional Cast Shadow (Extending to Bottom-Right)
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(playerPx + 6, playerPy + 16, 14, 6, Math.PI / 7, 0, Math.PI * 2);
  ctx.fill();

  // 2. Mechanical Survival Backpack & Over-Shoulder Holster
  ctx.fillStyle = secCol;
  ctx.fillRect(playerPx - 9, playerPy - 6 + walkBob, 18, 12);
  ctx.fillStyle = "#2ecc71"; // active energy LED
  ctx.fillRect(playerPx - 7, playerPy - 4 + walkBob, 2.5, 2.5);
  // Survival Antenna / Holster extending over right shoulder
  ctx.fillStyle = dressCol;
  ctx.fillRect(playerPx + 7, playerPy - 12 + walkBob, 4, 10);
  ctx.fillStyle = "#e67e22";
  ctx.fillRect(playerPx + 8, playerPy - 14 + walkBob, 2, 4);

  // 3. Ribbed Hazard Combat Legs & Steel-Toed Boots
  // Left Leg
  ctx.fillStyle = suitType === "power_armor" ? "#2c3e50" : suitType === "heavy" ? "#34495e" : "#4a5568";
  ctx.fillRect(playerPx - 7, playerPy + 8 + leftLegOffset, 5.5, 9 - leftLegOffset);
  ctx.fillStyle = "#2d3748"; // Ribbed joint lines
  ctx.fillRect(playerPx - 7, playerPy + 11 + leftLegOffset, 5.5, 1.5);
  ctx.fillStyle = dressCol; // Knee Guard
  ctx.fillRect(playerPx - 7.5, playerPy + 13 + leftLegOffset, 6, 3);
  ctx.fillStyle = "#111827"; // Heavy Steel Boot
  ctx.fillRect(playerPx - 8, playerPy + 16 + leftLegOffset, 7, 3);

  // Right Leg
  ctx.fillStyle = suitType === "power_armor" ? "#2c3e50" : suitType === "heavy" ? "#34495e" : "#4a5568";
  ctx.fillRect(playerPx + 1.5, playerPy + 8 + rightLegOffset, 5.5, 9 - rightLegOffset);
  ctx.fillStyle = "#2d3748";
  ctx.fillRect(playerPx + 1.5, playerPy + 11 + rightLegOffset, 5.5, 1.5);
  ctx.fillStyle = dressCol; // Knee Guard
  ctx.fillRect(playerPx + 1, playerPy + 13 + rightLegOffset, 6, 3);
  ctx.fillStyle = "#111827"; // Heavy Steel Boot
  ctx.fillRect(playerPx + 1, playerPy + 16 + rightLegOffset, 7, 3);

  // 4. Arms & Heavy Gauntlets
  // Left Arm
  ctx.fillStyle = suitType === "power_armor" ? "#2980b9" : "#4a5568";
  ctx.fillRect(playerPx - 11, playerPy - 2 + walkBob + armSwing, 4, 9);
  ctx.fillStyle = secCol; // Gauntlet
  ctx.fillRect(playerPx - 11.5, playerPy + 4 + walkBob + armSwing, 4.5, 4);

  // Right Arm
  ctx.fillStyle = suitType === "power_armor" ? "#2980b9" : "#4a5568";
  ctx.fillRect(playerPx + 7, playerPy - 2 + walkBob - armSwing, 4, 9);
  ctx.fillStyle = secCol; // Gauntlet
  ctx.fillRect(playerPx + 7, playerPy + 4 + walkBob - armSwing, 4.5, 4);

  // 5. Signature Ochre Hazard Suit Torso & Heavy Pauldrons
  // Flared Shoulder Pauldrons (Left & Right)
  ctx.fillStyle = dressCol;
  ctx.fillRect(playerPx - 12, playerPy - 6 + walkBob, 6, 5);
  ctx.fillRect(playerPx + 6, playerPy - 6 + walkBob, 6, 5);
  ctx.fillStyle = secCol;
  ctx.fillRect(playerPx - 12, playerPy - 2 + walkBob, 6, 1.5);
  ctx.fillRect(playerPx + 6, playerPy - 2 + walkBob, 6, 1.5);

  // Armored Torso Vest
  ctx.fillStyle = dressCol;
  ctx.fillRect(playerPx - 6.5, playerPy - 5 + walkBob, 13, 14);
  // Dark Reinforced Harness & Utility Pouches
  ctx.fillStyle = secCol;
  ctx.fillRect(playerPx - 5, playerPy - 2 + walkBob, 10, 4);
  ctx.fillRect(playerPx - 4, playerPy + 4 + walkBob, 8, 3.5);
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(playerPx - 3, playerPy + 5 + walkBob, 2, 2);
  ctx.fillRect(playerPx + 1, playerPy + 5 + walkBob, 2, 2);

  // 6. Iconic Factorio Dome Helmet / Cap / Power Visor
  if (helmetType !== "none") {
    // Dome Helmet / Headgear
    ctx.fillStyle = helmetType === "power_visor" ? "#8e44ad" : helmetType === "helmet" ? "#34495e" : dressCol;
    ctx.beginPath();
    ctx.arc(playerPx, playerPy - 11 + walkBob, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = secCol;
    ctx.fillRect(playerPx - 6, playerPy - 7 + walkBob, 12, 2.5);

    // Side Respirators / Filtration Canisters
    ctx.fillStyle = "#2d3748";
    ctx.fillRect(playerPx - 8, playerPy - 10 + walkBob, 2.5, 4);
    ctx.fillRect(playerPx + 5.5, playerPy - 10 + walkBob, 2.5, 4);

    // Optic Sensor / Reflective Visor Lens
    const visorGlow = helmetType === "power_visor" ? "#a855f7" : helmetType === "visor" ? "#38bdf8" : "#f59e0b";
    if (p.dir === "down") {
      ctx.fillStyle = "#1b2631";
      ctx.beginPath();
      ctx.arc(playerPx, playerPy - 10.5 + walkBob, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = visorGlow; // Glowing sensor lens
      ctx.beginPath();
      ctx.arc(playerPx, playerPy - 10.5 + walkBob, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(playerPx - 1, playerPy - 11.5 + walkBob, 1, 1);
    } else if (p.dir === "left") {
      ctx.fillStyle = "#1b2631";
      ctx.fillRect(playerPx - 6, playerPy - 12 + walkBob, 3, 4);
      ctx.fillStyle = visorGlow;
      ctx.fillRect(playerPx - 5.5, playerPy - 11.5 + walkBob, 2, 2.5);
    } else if (p.dir === "right") {
      ctx.fillStyle = "#1b2631";
      ctx.fillRect(playerPx + 3, playerPy - 12 + walkBob, 3, 4);
      ctx.fillStyle = visorGlow;
      ctx.fillRect(playerPx + 3.5, playerPy - 11.5 + walkBob, 2, 2.5);
    } else {
      // Up (Back of Helmet)
      ctx.fillStyle = secCol;
      ctx.fillRect(playerPx - 4, playerPy - 13 + walkBob, 8, 4);
    }
  }

  // Weapon in Hands / Mining Laser targeting beam
  const heldItem = getCursor(state);
  if (heldItem && (heldItem.type === "weapon" || heldItem.type === "tool")) {
    const { dx, dy } = getDirectionVector(p.dir);
    const weaponX = playerPx + dx * 10;
    const weaponY = playerPy + dy * 10;

    // Laser Sight Beam
    ctx.strokeStyle = "rgba(231, 76, 60, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(weaponX, weaponY);
    ctx.lineTo(weaponX + dx * 48, weaponY + dy * 48);
    ctx.stroke();

    // Weapon body
    ctx.fillStyle = "#1e272c";
    ctx.fillRect(weaponX - 2, weaponY - 2, 5, 5);
  }

  // 7. Carry Item above head
  if (state.harvestLiftingTimer > 0 && state.carryItem) {
    ctx.fillStyle = state.carryItem.iconColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      state.carryItem.iconSymbol || "⚙️",
      playerPx,
      playerPy - 24
    );
  }

  // Active Tool Swipe indicator (Factorio style selector box)
  const activeHighlight = hoveredTile || frontTile(state);
  if (activeHighlight && state.harvestLiftingTimer <= 0) {
    const dist = Math.hypot(activeHighlight.x - p.x, activeHighlight.y - p.y);
    const target = currentGrid[activeHighlight.y]?.[activeHighlight.x];
    const selected = getCursor(state);
    const preview = hoveredTile && target && isBuildableItem(selected) && !state.blueprint?.mode;
    const reason = preview ? getPlacementIssue(state, target, selected.id, activeHighlight) : null;
    const inReach = dist <= (p.reachDistance ?? 8) && !reason;
    const ax = activeHighlight.x * TILE;
    const ay = activeHighlight.y * TILE;
    if (preview) {
      const direction = target.buildPlan?.id === selected.id ? target.buildPlan.direction : state.placementDirection ?? "right";
      paintBuildPreview(ctx, ax, ay, selected.id, direction, false);
    }
    ctx.strokeStyle = preview ? (inReach ? "#c6d8a1" : "#cc7863") : inReach ? "#d8c18b" : "#a5806b";
    ctx.lineWidth = 1.5;
    for (const [x, y, sx, sy] of [[ax + 1, ay + 1, 1, 1], [ax + 31, ay + 1, -1, 1], [ax + 1, ay + 31, 1, -1], [ax + 31, ay + 31, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * 7);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * 7, y);
      ctx.stroke();
    }
    if (reason) {
      ctx.font = "10px Segoe UI";
      ctx.textAlign = "center";
      const width = ctx.measureText(reason).width + 10;
      ctx.fillStyle = "#372a22ed";
      ctx.fillRect(ax + 16 - width / 2, ay - 19, width, 15);
      ctx.fillStyle = "#f1b99b";
      ctx.fillText(reason, ax + 16, ay - 8);
    }

    if (hoveredTile && target?.machineStatus && state.altMode) {
      const labels = { running: "Running", idle: "Waiting for input", blocked: "Output backed up", fuel: "Needs fuel", power: "Needs power", depleted: "Deposit depleted", damaged: "Disabled by damage" };
      const label = target.machineStatus === "fuel" && target.placedItemId === "gun_turret" ? "Needs ammo" : labels[target.machineStatus];
      const x = activeHighlight.x * TILE + 16;
      const y = activeHighlight.y * TILE - 7;
      ctx.font = "600 10px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const width = ctx.measureText(label).width + 14;
      ctx.fillStyle = "rgba(28,31,25,.93)";
      ctx.fillRect(x - width / 2, y - 8, width, 16);
      ctx.fillStyle = target.machineStatus === "running" ? "#d1e4ad" : "#e9c693";
      ctx.fillText(label, x, y);
    }

    const held = getCursor(state);
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

  // 8. Render Remote Players on current room map
  if (state.remotePlayers && state.remotePlayers.length > 0) {
    state.remotePlayers.forEach((rp) => {
      const rpx = (rp.subX !== undefined ? rp.subX : rp.x) * TILE + TILE / 2;
      const rpy = (rp.subY !== undefined ? rp.subY : rp.y) * TILE + TILE / 2;

      // Drop Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(rpx, rpy + 10, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Remote player body circle
      ctx.fillStyle = rp.color || "#00cec9";
      ctx.beginPath();
      ctx.arc(rpx, rpy - 2, 10, 0, Math.PI * 2);
      ctx.fill();

      // Avatar symbol / Head
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rp.avatarSymbol || "🧑‍🌾", rpx, rpy - 2);

      // Name Tag Banner
      const nameWidth = Math.max(50, rp.name.length * 7 + 12);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(rpx - nameWidth / 2, rpy - 26, nameWidth, 14);
      ctx.strokeStyle = "#38b2ac";
      ctx.lineWidth = 1;
      ctx.strokeRect(rpx - nameWidth / 2, rpy - 26, nameWidth, 14);

      ctx.fillStyle = "#67e8f9";
      ctx.font = "bold 9px monospace";
      ctx.fillText(rp.name, rpx, rpy - 19);
    });
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


  // 9. Time of day lighting overlay
  if (!state.inHouse && !state.inMine) {
    const hours = state.time / 60;
    let alpha = 0;
    let color = "0,0,0";
    if (hours < 6) { alpha = 0.55; color = "10,10,40"; } // deep night
    else if (hours < 8) { alpha = 0.16 - ((hours - 6) / 2) * 0.16; color = "225,171,100"; } // sunrise
    else if (hours >= 17 && hours < 20) { alpha = ((hours - 17) / 3) * 0.45; color = "255,90,0"; } // sunset
    else if (hours >= 20) { alpha = 0.45 + Math.min(1, (hours - 20) / 4) * 0.1; color = "10,10,40"; } // night

    if (alpha > 0) {
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.fillRect(cameraX, cameraY, effectiveWidth, effectiveHeight);
    }
  }

  ctx.restore(); // restore viewport transform

  // 9. Ambient Night/Evening Lighting filter (Performance Cached Offscreen Canvas)
  if (phase !== "morning" && state.settings?.graphicsQuality !== "low") {
    if (!_cachedLightCanvas) {
      _cachedLightCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    }
    if (_cachedLightCanvas) {
      if (_cachedLightCanvas.width !== viewWidth || _cachedLightCanvas.height !== viewHeight) {
        _cachedLightCanvas.width = viewWidth;
        _cachedLightCanvas.height = viewHeight;
      }
      const tCtx = _cachedLightCanvas.getContext("2d");

      if (tCtx) {
        tCtx.globalCompositeOperation = "source-over";
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

      ctx.drawImage(_cachedLightCanvas, 0, 0);
    }
  }
}

  // 10. Factorio Blueprint, Stamp & Deconstruction Bounding Box Overlay
  if (state.blueprint && state.blueprint.mode) {
    const bp = state.blueprint;
    const start = bp.startTile;
    const curr = bp.currentTile || hoveredTile;

    if (bp.mode === "copy" && start && curr) {
      const minX = Math.min(start.x, curr.x);
      const maxX = Math.max(start.x, curr.x);
      const minY = Math.min(start.y, curr.y);
      const maxY = Math.max(start.y, curr.y);

      const bx = minX * TILE - cameraX;
      const by = minY * TILE - cameraY;
      const bw = (maxX - minX + 1) * TILE;
      const bh = (maxY - minY + 1) * TILE;

      ctx.fillStyle = "rgba(0, 206, 201, 0.25)";
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = "#00cec9";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      ctx.fillStyle = "#00cec9";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`📋 Blueprint Selection: ${maxX - minX + 1}x${maxY - minY + 1} tiles`, bx + 4, Math.max(14, by - 6));
    } else if (bp.mode === "deconstruct" && start && curr) {
      const minX = Math.min(start.x, curr.x);
      const maxX = Math.max(start.x, curr.x);
      const minY = Math.min(start.y, curr.y);
      const maxY = Math.max(start.y, curr.y);

      const bx = minX * TILE - cameraX;
      const by = minY * TILE - cameraY;
      const bw = (maxX - minX + 1) * TILE;
      const bh = (maxY - minY + 1) * TILE;

      ctx.fillStyle = "rgba(235, 77, 75, 0.35)";
      ctx.fillRect(bx, by, bw, bh);

      ctx.strokeStyle = "#eb4d4b";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      ctx.fillStyle = "#eb4d4b";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`✂️ Deconstruction Planner: ${maxX - minX + 1}x${maxY - minY + 1} tiles`, bx + 4, Math.max(14, by - 6));
    } else if (bp.mode === "stamp" && bp.savedEntities && bp.savedEntities.length > 0 && hoveredTile) {
      bp.savedEntities.forEach((ent) => {
        const targetX = hoveredTile.x + ent.relX;
        const targetY = hoveredTile.y + ent.relY;
        const epx = targetX * TILE - cameraX;
        const epy = targetY * TILE - cameraY;

        ctx.fillStyle = "rgba(46, 204, 113, 0.4)";
        ctx.fillRect(epx, epy, TILE, TILE);
        ctx.strokeStyle = "#2ecc71";
        ctx.lineWidth = 1;
        ctx.strokeRect(epx, epy, TILE, TILE);
      });
    }
  }

  if (!specialtyStructures.length) return;
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);
  // 11. Factorio Roboport & Flying Autonomous Drone Bots Renderer
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId === "roboport") {
        const rpx = x * TILE + 16;
        const rpy = y * TILE + 16;

        // Render Roboport 32x32 Logistic Coverage Outer Square
        ctx.strokeStyle = "rgba(142, 68, 173, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rpx - 256, rpy - 256, 512, 512);
        ctx.setLineDash([]);

        // Render Autonomous Flying Drone Swarm Spanning from Roboport
        const tNow = Date.now() / 1000;
        for (let i = 0; i < 4; i++) {
          const droneAngle = tNow * (0.8 + i * 0.2) + i * (Math.PI / 2);
          const orbitR = 60 + Math.sin(tNow + i) * 35;
          const dx = rpx + Math.cos(droneAngle) * orbitR;
          const dy = rpy + Math.sin(droneAngle) * orbitR;

          // Drone shadow on ground
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.beginPath();
          ctx.ellipse(dx, dy + 18, 6, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Drone body sprite
          ctx.fillStyle = i % 2 === 0 ? "#2ecc71" : "#3498db";
          ctx.beginPath();
          ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Glowing Green/Blue Drone LED
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(dx - 1, dy - 1, 2, 2);

          // Drone propeller rotor lines
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dx - 6, dy);
          ctx.lineTo(dx + 6, dy);
          ctx.moveTo(dx, dy - 6);
          ctx.lineTo(dx, dy + 6);
          ctx.stroke();
        }
      }
  }

  // 12. Factorio Railway Tracks & Autonomous Diesel Locomotive Train Engine Renderer
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        const rpx = x * TILE;
        const rpy = y * TILE;

        if (id === "rail") {
          // Wooden Ties & Parallel Steel Rails
          ctx.fillStyle = "#4a3b32";
          ctx.fillRect(rpx + 2, rpy + 4, TILE - 4, 3);
          ctx.fillRect(rpx + 2, rpy + 14, TILE - 4, 3);
          ctx.fillRect(rpx + 2, rpy + 24, TILE - 4, 3);

          ctx.fillStyle = "#b0c4de";
          ctx.fillRect(rpx + 8, rpy, 3, TILE);
          ctx.fillRect(rpx + 21, rpy, 3, TILE);
        } else if (id === "locomotive" || id === "cargo_wagon") {
          // Steel Rail Track Underbed
          ctx.fillStyle = "#4a3b32";
          ctx.fillRect(rpx + 2, rpy + 4, TILE - 4, 3);
          ctx.fillRect(rpx + 2, rpy + 14, TILE - 4, 3);
          ctx.fillRect(rpx + 2, rpy + 24, TILE - 4, 3);
          ctx.fillStyle = "#b0c4de";
          ctx.fillRect(rpx + 8, rpy, 3, TILE);
          ctx.fillRect(rpx + 21, rpy, 3, TILE);

          // Animated Diesel Locomotive Engine / Cargo Wagon Sprite
          const isLoco = id === "locomotive";
          ctx.fillStyle = isLoco ? "#d35400" : "#7f8c8d";
          ctx.fillRect(rpx + 4, rpy + 2, TILE - 8, TILE - 4);

          ctx.fillStyle = isLoco ? "#e67e22" : "#95a5a6";
          ctx.fillRect(rpx + 6, rpy + 4, TILE - 12, TILE - 8);

          // Engine Headlight
          if (isLoco) {
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(rpx + 13, rpy + 2, 6, 3);
            // Light cone
            ctx.fillStyle = "rgba(241, 196, 15, 0.25)";
            ctx.beginPath();
            ctx.moveTo(rpx + 16, rpy + 2);
            ctx.lineTo(rpx + 4, rpy - 24);
            ctx.lineTo(rpx + 28, rpy - 24);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
  }

  // 13. Factorio 9x9 Rocket Silo Industrial Launchpad Renderer
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId === "rocket_silo") {
        const rpx = x * TILE + 16;
        const rpy = y * TILE + 16;

        // Circular Silo Shaft Base
        ctx.fillStyle = "#1e272c";
        ctx.beginPath();
        ctx.arc(rpx, rpy, 42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#2c3e50";
        ctx.beginPath();
        ctx.arc(rpx, rpy, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#11161b";
        ctx.beginPath();
        ctx.arc(rpx, rpy, 24, 0, Math.PI * 2);
        ctx.fill();

        // Rocket Nose Cone in Silo Shaft
        ctx.fillStyle = "#ecf0f1";
        ctx.beginPath();
        ctx.arc(rpx, rpy, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e67e22";
        ctx.beginPath();
        ctx.arc(rpx, rpy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Gantry Structural Beams & Hazard Stripes
        ctx.strokeStyle = "#f39c12";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(rpx - 44, rpy);
        ctx.lineTo(rpx + 44, rpy);
        ctx.moveTo(rpx, rpy - 44);
        ctx.lineTo(rpx, rpy + 44);
        ctx.stroke();
      }
  }

  // 14. Factorio Circuit Network 2.0 Combinators & Signal Wire Connections
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        const cpx = x * TILE + 16;
        const cpy = y * TILE + 16;

        if (id.includes("combinator")) {
          // Microchip PCB base
          ctx.fillStyle = id.includes("decider") ? "#2c3e50" : id.includes("arithmetic") ? "#d35400" : "#27ae60";
          ctx.fillRect(cpx - 12, cpy - 10, 24, 20);

          ctx.strokeStyle = "#f1c40f";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(cpx - 12, cpy - 10, 24, 20);

          // LED Status lights
          ctx.fillStyle = "#2ecc71";
          ctx.fillRect(cpx - 9, cpy - 7, 4, 4);

          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(cpx + 5, cpy - 7, 4, 4);

          // Symbol
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const sym = id.includes("decider") ? "⚖" : id.includes("arithmetic") ? "➕" : "123";
          ctx.fillText(sym, cpx, cpy + 2);
        }
      }
  }

  // 15. Factorio Nuclear Power Grid & Uranium Centrifuge Renderer
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        const npx = x * TILE + 16;
        const npy = y * TILE + 16;

        if (id === "nuclear_reactor") {
          // Nuclear Reactor Core Base with Cherenkov Radiation Glow
          ctx.fillStyle = "#1e272c";
          ctx.beginPath();
          ctx.arc(npx, npy, 28, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#2ecc71";
          ctx.beginPath();
          ctx.arc(npx, npy, 20, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing Cherenkov Cyan Radiation Glow
          const radGlow = 14 + Math.sin(Date.now() / 120) * 3;
          ctx.fillStyle = "rgba(0, 255, 200, 0.75)";
          ctx.beginPath();
          ctx.arc(npx, npy, radGlow, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "centrifuge") {
          // Centrifuge Cylinder Drum Base
          ctx.fillStyle = "#16a085";
          ctx.fillRect(npx - 12, npy - 12, 24, 24);

          // Spinning Centrifuge Rotor
          const spinA = (Date.now() / 150) % (Math.PI * 2);
          ctx.strokeStyle = "#00ff7f";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(npx, npy, 8, spinA, spinA + Math.PI * 1.5);
          ctx.stroke();
        } else if (id === "heat_exchanger" || id === "steam_turbine") {
          // 500°C Thermal Heat Pipe & Plasma Blue Steam Turbine
          ctx.fillStyle = id === "heat_exchanger" ? "#d35400" : "#34495e";
          ctx.fillRect(npx - 14, npy - 10, 28, 20);

          ctx.fillStyle = "#3498db";
          ctx.beginPath();
          ctx.arc(npx, npy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  }

  // 16. Factorio Space Age Space Platform Hub & Orbital Cargo Drop Pod Renderer
  for (const { x, y, t } of specialtyStructures) {
      if (t.kind === "placed_item" && t.placedItemId) {
        const id = t.placedItemId;
        const spx = x * TILE + 16;
        const spy = y * TILE + 16;

        if (id === "space_platform_hub" || id === "cargo_landing_pad") {
          // Target Concentric Target Circles
          ctx.strokeStyle = "#e67e22";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(spx, spy, 22, 0, Math.PI * 2);
          ctx.arc(spx, spy, 12, 0, Math.PI * 2);
          ctx.stroke();

          // Descending Orbital Drop Pod Sprite Animation
          const podProgress = (Date.now() / 2000) % 1;
          const podY = spy - 120 * (1 - podProgress);
          const podScale = 0.4 + podProgress * 0.6;

          // Re-entry Flame Trail
          ctx.fillStyle = "rgba(230, 126, 34, 0.65)";
          ctx.beginPath();
          ctx.arc(spx, podY - 8, 6 * podScale, 0, Math.PI * 2);
          ctx.fill();

          // Drop Pod Capsule
          ctx.fillStyle = "#ecf0f1";
          ctx.beginPath();
          ctx.arc(spx, podY, 7 * podScale, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === "spidertron") {
          // Spidertron Heavy Central Chassis Hull
          ctx.fillStyle = "#e67e22";
          ctx.beginPath();
          ctx.arc(spx, spy, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#d35400";
          ctx.beginPath();
          ctx.arc(spx, spy, 10, 0, Math.PI * 2);
          ctx.fill();

          // 8 Stepping Mechanical Legs Animation
          const legTime = Date.now() / 250;
          ctx.strokeStyle = "#7f8c8d";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4 + Math.sin(legTime + i) * 0.15;
            const legX = spx + Math.cos(angle) * 32;
            const legY = spy + Math.sin(angle) * 32;
            ctx.moveTo(spx, spy);
            ctx.lineTo(legX, legY);

            // Foot Joint
            ctx.fillStyle = "#e74c3c";
            ctx.fillRect(legX - 2, legY - 2, 4, 4);
          }
          ctx.stroke();
        } else if (id === "foundry" || id === "electromagnetic_plant" || id === "biochamber" || id === "agricultural_tower") {
          // Space Age Vulcanus / Fulgora / Gleba Planetary Industrial Facility
          ctx.fillStyle = id === "foundry" ? "#c0392b" : id === "electromagnetic_plant" ? "#8e44ad" : id === "biochamber" ? "#27ae60" : "#16a085";
          ctx.fillRect(spx - 14, spy - 14, 28, 28);

          ctx.strokeStyle = "#f39c12";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(spx - 14, spy - 14, 28, 28);
        }
      }
  }
  ctx.restore();
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
