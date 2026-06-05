export type ItemType =
  | "tool"
  | "seed"
  | "crop"
  | "fish"
  | "resource"
  | "weapon"
  | "furniture"
  | "trash";

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  /** Stack count. Only non-tool items stack. */
  count: number;
  /** Market value (sell price). 0 if not sellable. */
  price: number;
  /** Custom properties. */
  damage?: number;
  energyRestore?: number;
  healthRestore?: number;
  /** Color representing its icon in the grid-based inventory inventory. */
  iconColor: string;
  iconSymbol?: string;
}

export const ITEM_DEFS: Record<string, Omit<Item, "count">> = {
  // Tools
  hoe: {
    id: "hoe",
    name: "Hoe",
    type: "tool",
    description: "Used to till soil.",
    price: 0,
    iconColor: "#7c5a3c",
    iconSymbol: "⛏",
  },
  watering_can: {
    id: "watering_can",
    name: "Watering Can",
    type: "tool",
    description: "Used to water crops.",
    price: 0,
    iconColor: "#4ea5d9",
    iconSymbol: "💧",
  },
  scythe: {
    id: "scythe",
    name: "Scythe",
    type: "tool",
    description: "Used to harvest crops and cut weeds.",
    price: 0,
    iconColor: "#a0a0a0",
    iconSymbol: "🌾",
  },
  pickaxe: {
    id: "pickaxe",
    name: "Pickaxe",
    type: "tool",
    description: "Used to break rocks and mine ore.",
    price: 0,
    iconColor: "#505058",
    iconSymbol: "⛏",
  },
  axe: {
    id: "axe",
    name: "Axe",
    type: "tool",
    description: "Used to chop trees and branches.",
    price: 0,
    iconColor: "#8e6345",
    iconSymbol: "🪓",
  },
  fishing_rod: {
    id: "fishing_rod",
    name: "Fishing Rod",
    type: "tool",
    description: "Cast into water to catch fish.",
    price: 150,
    iconColor: "#b58452",
    iconSymbol: "🎣",
  },
  sword: {
    id: "sword",
    name: "Rusty Sword",
    type: "weapon",
    description: "Basic defense against slimes.",
    price: 50,
    damage: 15,
    iconColor: "#b0c4de",
    iconSymbol: "⚔",
  },

  // Seeds
  parsnip_seed: {
    id: "parsnip_seed",
    name: "Parsnip Seed",
    type: "seed",
    description: "Grows in Spring. Takes 3 days.",
    price: 4,
    iconColor: "#d2b48c",
    iconSymbol: "⁘",
  },
  potato_seed: {
    id: "potato_seed",
    name: "Potato Seed",
    type: "seed",
    description: "Grows in Spring. Takes 4 days.",
    price: 7,
    iconColor: "#e6c280",
    iconSymbol: "⁘",
  },
  cauliflower_seed: {
    id: "cauliflower_seed",
    name: "Cauli Seed",
    type: "seed",
    description: "Grows in Spring. Takes 8 days.",
    price: 20,
    iconColor: "#dfdfdf",
    iconSymbol: "⁘",
  },
  strawberry_seed: {
    id: "strawberry_seed",
    name: "Strawb Seed",
    type: "seed",
    description: "Grows in Spring. Takes 6 days.",
    price: 30,
    iconColor: "#ff4d4d",
    iconSymbol: "⁘",
  },
  blueberry_seed: {
    id: "blueberry_seed",
    name: "Blueb Seed",
    type: "seed",
    description: "Grows in Summer. Takes 7 days.",
    price: 25,
    iconColor: "#4d4dff",
    iconSymbol: "⁘",
  },
  starflower_seed: {
    id: "starflower_seed",
    name: "Starb Seed",
    type: "seed",
    description: "Grows in Summer. Takes 12 days.",
    price: 100,
    iconColor: "#d94dff",
    iconSymbol: "⁘",
  },

  // Crops
  parsnip: {
    id: "parsnip",
    name: "Parsnip",
    type: "crop",
    description: "A spring tuber.",
    price: 14,
    energyRestore: 15,
    healthRestore: 6,
    iconColor: "#f2c14e",
    iconSymbol: "🥬",
  },
  potato: {
    id: "potato",
    name: "Potato",
    type: "crop",
    description: "Common root crop.",
    price: 28,
    energyRestore: 25,
    healthRestore: 10,
    iconColor: "#c9a36b",
    iconSymbol: "🥔",
  },
  cauliflower: {
    id: "cauliflower",
    name: "Cauliflower",
    type: "crop",
    description: "Large white flower.",
    price: 110,
    energyRestore: 60,
    healthRestore: 24,
    iconColor: "#f3efe6",
    iconSymbol: "🥦",
  },
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    type: "crop",
    description: "Sweet spring berry.",
    price: 95,
    energyRestore: 45,
    healthRestore: 18,
    iconColor: "#e64a4a",
    iconSymbol: "🍓",
  },
  blueberry: {
    id: "blueberry",
    name: "Blueberry",
    type: "crop",
    description: "Plump summer berry.",
    price: 35,
    energyRestore: 30,
    healthRestore: 12,
    iconColor: "#4a6cd6",
    iconSymbol: "🫐",
  },
  starflower: {
    id: "starflower",
    name: "Starflower",
    type: "crop",
    description: "Exotic summer bloom.",
    price: 600,
    energyRestore: 120,
    healthRestore: 48,
    iconColor: "#a76ce6",
    iconSymbol: "🌸",
  },

  // Materials / Ores
  wood: {
    id: "wood",
    name: "Wood",
    type: "resource",
    description: "Chopped from trees.",
    price: 2,
    iconColor: "#a6683c",
    iconSymbol: "🪵",
  },
  stone: {
    id: "stone",
    name: "Stone",
    type: "resource",
    description: "Mined from rocks.",
    price: 2,
    iconColor: "#7a7a7a",
    iconSymbol: "🪨",
  },
  fiber: {
    id: "fiber",
    name: "Fiber",
    type: "resource",
    description: "Scythe-cut weeds.",
    price: 1,
    iconColor: "#3a7f3a",
    iconSymbol: "🌿",
  },
  coal: {
    id: "coal",
    name: "Coal",
    type: "resource",
    description: "Used for crafting.",
    price: 10,
    iconColor: "#1a1a1a",
    iconSymbol: "🪨",
  },
  copper_ore: {
    id: "copper_ore",
    name: "Copper Ore",
    type: "resource",
    description: "Raw copper mineral.",
    price: 5,
    iconColor: "#d95f2a",
    iconSymbol: "🔸",
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    type: "resource",
    description: "Raw iron mineral.",
    price: 10,
    iconColor: "#9c9ca3",
    iconSymbol: "🔸",
  },
  gold_ore: {
    id: "gold_ore",
    name: "Gold Ore",
    type: "resource",
    description: "Precious raw gold.",
    price: 25,
    iconColor: "#f4c430",
    iconSymbol: "🔸",
  },
  copper_bar: {
    id: "copper_bar",
    name: "Copper Bar",
    type: "resource",
    description: "Smelted copper.",
    price: 30,
    iconColor: "#e67e22",
    iconSymbol: "🧱",
  },
  iron_bar: {
    id: "iron_bar",
    name: "Iron Bar",
    type: "resource",
    description: "Smelted iron.",
    price: 60,
    iconColor: "#bdc3c7",
    iconSymbol: "🧱",
  },
  gold_bar: {
    id: "gold_bar",
    name: "Gold Bar",
    type: "resource",
    description: "Smelted gold.",
    price: 150,
    iconColor: "#f1c40f",
    iconSymbol: "🧱",
  },
  plank: {
    id: "plank",
    name: "Plank",
    type: "resource",
    description: "Refined wood plank.",
    price: 8,
    iconColor: "#d2b48c",
    iconSymbol: "🪵",
  },

  // Placeables
  chest: {
    id: "chest",
    name: "Wood Chest",
    type: "furniture",
    description: "Stores up to 12 items.",
    price: 10,
    iconColor: "#a0522d",
    iconSymbol: "📦",
  },
  torch: {
    id: "torch",
    name: "Torch",
    type: "furniture",
    description: "Emits light at night.",
    price: 2,
    iconColor: "#f39c12",
    iconSymbol: "🕯",
  },
  scarecrow: {
    id: "scarecrow",
    name: "Scarecrow",
    type: "furniture",
    description: "Keeps crows off crops.",
    price: 50,
    iconColor: "#d35400",
    iconSymbol: "🎎",
  },
  seed_maker: {
    id: "seed_maker",
    name: "Seed Maker",
    type: "furniture",
    description: "Extracts seeds from crops.",
    price: 80,
    iconColor: "#7f8c8d",
    iconSymbol: "⚙",
  },

  // Fish
  sardine: {
    id: "sardine",
    name: "Sardine",
    type: "fish",
    description: "A small ocean fish.",
    price: 40,
    energyRestore: 13,
    healthRestore: 5,
    iconColor: "#95a5a6",
    iconSymbol: "🐟",
  },
  carp: {
    id: "carp",
    name: "Carp",
    type: "fish",
    description: "Common lake fish.",
    price: 30,
    energyRestore: 13,
    healthRestore: 5,
    iconColor: "#8e8e34",
    iconSymbol: "🐟",
  },
  salmon: {
    id: "salmon",
    name: "Salmon",
    type: "fish",
    description: "Strong river swimmer.",
    price: 75,
    energyRestore: 38,
    healthRestore: 15,
    iconColor: "#fa8072",
    iconSymbol: "🐟",
  },
  legend: {
    id: "legend",
    name: "Legend Fish",
    type: "fish",
    description: "King of the waters!",
    price: 500,
    energyRestore: 200,
    healthRestore: 80,
    iconColor: "#3498db",
    iconSymbol: "👑",
  },
};

export function createItem(id: string, count = 1): Item {
  const def = ITEM_DEFS[id];
  if (!def) {
    return {
      id,
      name: id.toUpperCase(),
      type: "trash",
      description: "Unknown item",
      count,
      price: 0,
      iconColor: "#7f8c8d",
    };
  }
  return { ...def, count };
}
