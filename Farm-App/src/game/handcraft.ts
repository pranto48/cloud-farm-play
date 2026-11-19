import { CRAFTING_RECIPES, type GameState, type Recipe } from "./meadow-life";

type StackCount = { itemId: string; count: number };
const byProduct = new Map<string, Recipe>();
for (const recipe of CRAFTING_RECIPES) {
  if (!byProduct.has(recipe.outputId)) byProduct.set(recipe.outputId, recipe);
}

export function planHandcraft(state: GameState, target: Recipe, count: number) {
  const available = new Map<string, number>();
  for (const item of state.inventory) {
    if (item) available.set(item.id, (available.get(item.id) ?? 0) + item.count);
  }
  const reserved = new Map<string, number>();
  const intermediate = new Map<string, number>();
  const missingItems: { itemId: string; need: number; has: number; canAutoCraft: boolean }[] = [];
  const unlocked = new Set(state.unlockedTechs);
  const active = new Set<string>();
  let seconds = 0;
  let units = 0;
  let fail = false;

  const produce = (recipe: Recipe, batches: number): boolean => {
    if (active.size >= 10 || units > 4000 || active.has(recipe.id) || recipe.techRequired && !unlocked.has(recipe.techRequired)) return false;
    active.add(recipe.id);
    for (const input of recipe.inputs) {
      const id = input.itemId;
      const need = input.count * batches;
      const fromIntermediate = Math.min(need, intermediate.get(id) ?? 0);
      const fromBackpack = Math.min(need - fromIntermediate, available.get(id) ?? 0);
      const remainder = need - fromIntermediate - fromBackpack;
      intermediate.set(id, (intermediate.get(id) ?? 0) - fromIntermediate);
      available.set(id, (available.get(id) ?? 0) - fromBackpack);
      if (fromBackpack) reserved.set(id, (reserved.get(id) ?? 0) + fromBackpack);
      if (!remainder) continue;

      const sub = byProduct.get(id);
      if (!sub || !produce(sub, Math.ceil(remainder / sub.outputCount))) {
        if (!fail) missingItems.push({ itemId: id, need, has: need - remainder, canAutoCraft: Boolean(sub) });
        fail = true;
        return false;
      }
      intermediate.set(id, (intermediate.get(id) ?? 0) - remainder);
    }
    seconds += (recipe.craftTimeSeconds ?? .5) * batches;
    units += batches;
    intermediate.set(recipe.outputId, (intermediate.get(recipe.outputId) ?? 0) + recipe.outputCount * batches);
    active.delete(recipe.id);
    return true;
  };

  const free = state.freeCraft || state.godMode;
  const canCraft = free || produce(target, count);
  const stacks = (pool: Map<string, number>): StackCount[] =>
    [...pool].filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, count: quantity }));
  return {
    canCraft,
    missingItems,
    seconds: free ? .25 : seconds,
    inputs: free ? [] : stacks(reserved),
    outputs: free ? [{ itemId: target.outputId, count: count * target.outputCount }] : stacks(intermediate),
    intermediates: Math.max(0, units - count),
  };
}
