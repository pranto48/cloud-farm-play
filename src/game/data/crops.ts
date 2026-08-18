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
  yumako: {
    id: "yumako",
    name: "Yumako Fruit",
    seedPrice: 15,
    sellPrice: 35,
    growDays: 3,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 1,
    accent: "#e67e22",
    stem: "#27ae60",
  },
  jellynut: {
    id: "jellynut",
    name: "Jellynut Fruit",
    seedPrice: 25,
    sellPrice: 60,
    growDays: 4,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 1,
    accent: "#9b59b6",
    stem: "#8e44ad",
  },
  bioflux: {
    id: "bioflux",
    name: "Bioflux Culture",
    seedPrice: 80,
    sellPrice: 220,
    growDays: 6,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 2,
    accent: "#2ecc71",
    stem: "#1abc9c",
  },
  iron_bacteria: {
    id: "iron_bacteria",
    name: "Iron Bacteria Spores",
    seedPrice: 50,
    sellPrice: 130,
    growDays: 5,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 2,
    accent: "#bdc3c7",
    stem: "#34495e",
  },
  copper_bacteria: {
    id: "copper_bacteria",
    name: "Copper Bacteria Spores",
    seedPrice: 50,
    sellPrice: 130,
    growDays: 5,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 2,
    accent: "#d35400",
    stem: "#b9770e",
  },
  tree_seed: {
    id: "tree_seed",
    name: "Nauvis Tree Sapling",
    seedPrice: 10,
    sellPrice: 25,
    growDays: 2,
    seasons: ["spring", "summer", "fall", "winter"],
    tier: 1,
    accent: "#27ae60",
    stem: "#1e8449",
  },
};

export const DEFAULT_CROP_ID = "yumako";

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