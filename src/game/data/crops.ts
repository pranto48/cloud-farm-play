/**
 * Meadow Life — crop data table.
 *
 * Phase A foundation: all crop balancing lives here so tuning seed cost,
 * grow time, and sell price is a one-file change. Original art is rendered
 * procedurally on the canvas — `accent` is the harvested-fruit color and
 * `stem` is the growing-plant color used by `draw()`.
 */

export type Season = "spring" | "summer" | "fall" | "winter";

export type CropDef = {
  id: string;
  name: string;
  /** Coins to buy one seed at the shop. */
  seedPrice: number;
  /** Coins paid by the shipping bin per mature crop. */
  sellPrice: number;
  /** Watered days required from planting to maturity. */
  growDays: number;
  /** Seasons in which the seed will grow. Out-of-season seeds wither. */
  seasons: Season[];
  /** Coarse profitability tier — used for shop sort + tutorial gating. */
  tier: 1 | 2;
  /** Hex color for the ripe fruit/flower at the top of the sprite. */
  accent: string;
  /** Hex color for the leafy stem during the growing/grown stages. */
  stem: string;
};

export const CROPS: Record<string, CropDef> = {
  parsnip: {
    id: "parsnip",
    name: "Parsnip",
    seedPrice: 8,
    sellPrice: 14,
    growDays: 3,
    seasons: ["spring"],
    tier: 1,
    accent: "#f2c14e",
    stem: "#7ac461",
  },
  potato: {
    id: "potato",
    name: "Potato",
    seedPrice: 14,
    sellPrice: 28,
    growDays: 4,
    seasons: ["spring"],
    tier: 1,
    accent: "#c9a36b",
    stem: "#6aae5a",
  },
  cauliflower: {
    id: "cauliflower",
    name: "Cauliflower",
    seedPrice: 40,
    sellPrice: 110,
    growDays: 8,
    seasons: ["spring"],
    tier: 2,
    accent: "#f3efe6",
    stem: "#5fa256",
  },
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    seedPrice: 60,
    sellPrice: 95,
    growDays: 6,
    seasons: ["spring"],
    tier: 2,
    accent: "#e64a4a",
    stem: "#3f9a4a",
  },
  blueberry: {
    id: "blueberry",
    name: "Blueberry",
    seedPrice: 50,
    sellPrice: 35,
    growDays: 7,
    seasons: ["summer"],
    tier: 2,
    accent: "#4a6cd6",
    stem: "#3d8a4a",
  },
  starflower: {
    id: "starflower",
    name: "Starflower",
    seedPrice: 200,
    sellPrice: 600,
    growDays: 12,
    seasons: ["summer"],
    tier: 2,
    accent: "#a76ce6",
    stem: "#356f3a",
  },
  melon: {
    id: "melon",
    name: "Melon",
    seedPrice: 80,
    sellPrice: 250,
    growDays: 12,
    seasons: ["summer"],
    tier: 2,
    accent: "#ff66a3",
    stem: "#27ae60",
  },
  pumpkin: {
    id: "pumpkin",
    name: "Pumpkin",
    seedPrice: 100,
    sellPrice: 320,
    growDays: 13,
    seasons: ["fall"],
    tier: 2,
    accent: "#e67e22",
    stem: "#2ecc71",
  },
  bok_choy: {
    id: "bok_choy",
    name: "Bok Choy",
    seedPrice: 50,
    sellPrice: 80,
    growDays: 4,
    seasons: ["fall"],
    tier: 1,
    accent: "#2ecc71",
    stem: "#a8e6cf",
  },
  cranberries: {
    id: "cranberries",
    name: "Cranberries",
    seedPrice: 240,
    sellPrice: 75,
    growDays: 7,
    seasons: ["fall"],
    tier: 2,
    accent: "#c0392b",
    stem: "#27ae60",
  },
  sweet_gem_berry: {
    id: "sweet_gem_berry",
    name: "Sweet Gem Berry",
    seedPrice: 1000,
    sellPrice: 3000,
    growDays: 24,
    seasons: ["fall", "winter"],
    tier: 2,
    accent: "#ff007f",
    stem: "#4a235a",
  },
};

export const DEFAULT_CROP_ID = "parsnip";

export function getCrop(id: string | undefined | null): CropDef {
  if (id && CROPS[id]) return CROPS[id];
  return CROPS[DEFAULT_CROP_ID];
}

/** Crops available for purchase in a given season, cheapest first. */
export function shopInventoryForSeason(season: Season): CropDef[] {
  return Object.values(CROPS)
    .filter((c) => c.seasons.includes(season))
    .sort((a, b) => a.seedPrice - b.seedPrice);
}