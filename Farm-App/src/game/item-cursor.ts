import type { Item } from "./data/items";
import type { GameState } from "./meadow-life";

export const QUICKBAR_SIZE = 10;

export function getCursor(state: GameState): Item | null {
  return state.cursorStack ?? null;
}

export function stackLimit(item: Item): number {
  if (item.type === "tool" || item.type === "weapon" || item.type === "armor") return 1;
  if (/belt|cable|wire|magazine/.test(item.id)) return 100;
  return 50;
}

export function returnCursor(state: GameState) {
  const cursor = getCursor(state);
  if (cursor) {
    let left = cursor.count;
    const preferred = state.cursorOrigin;
    if (preferred !== undefined && preferred >= 0 && preferred < state.inventory.length && state.inventory[preferred] === null) {
      const count = Math.min(left, stackLimit(cursor));
      state.inventory[preferred] = { ...cursor, count };
      left -= count;
    }
    left = packStack(state.inventory, { ...cursor, count: left });
    if (left > 0) state.inventory.push({ ...cursor, count: left });
  }
  state.cursorStack = null;
  state.cursorOrigin = undefined;
  state.hotbarIndex = -1;
  state.cursorRefill = false;
}

export function packStack(slots: (Item | null)[], item: Item, allowed?: (index: number) => boolean): number {
  // Return the amount still in hand after merging or filling suitable slots.
  let left = item.count;
  for (const merge of [true, false]) {
    for (let index = 0; index < slots.length && left > 0; index++) {
      if (allowed && !allowed(index)) continue;
      const current = slots[index];
      if (merge ? current?.id !== item.id : current !== null) continue;
      const count = Math.min(left, Math.max(0, stackLimit(item) - (current?.count ?? 0)));
      if (!count) continue;
      slots[index] = { ...item, count: (current?.count ?? 0) + count };
      left -= count;
    }
  }
  return left;
}

function lift(state: GameState, slots: (Item | null)[], index: number, split: boolean) {
  const item = slots[index];
  if (!item) return false;
  const count = Math.min(stackLimit(item), split ? Math.ceil(item.count / 2) : item.count);
  slots[index] = count === item.count ? null : { ...item, count: item.count - count };
  state.cursorStack = { ...item, count };
  state.cursorOrigin = slots === state.inventory ? index : undefined;
  return true;
}

export function cursorSlotClick(state: GameState, slots: (Item | null)[], index: number, split: boolean, accepts = true) {
  if (index < 0 || index >= slots.length) return false;
  const current = slots[index];
  const cursor = getCursor(state);
  if (!cursor) {
    if (!lift(state, slots, index, split)) return false;
  } else if (!accepts) {
    return false;
  } else if (!current || current.id === cursor.id) {
    const count = Math.min(split ? 1 : cursor.count, Math.max(0, stackLimit(cursor) - (current?.count ?? 0)));
    if (!count) return false;
    slots[index] = { ...cursor, count: (current?.count ?? 0) + count };
    state.cursorStack = cursor.count === count ? null : { ...cursor, count: cursor.count - count };
    if (!state.cursorStack) state.cursorOrigin = undefined;
  } else if (!split && cursor.count <= stackLimit(cursor)) {
    slots[index] = cursor;
    state.cursorStack = current;
    state.cursorOrigin = slots === state.inventory ? index : undefined;
  } else {
    return false;
  }
  state.hotbarIndex = -1;
  state.cursorRefill = false;
  return true;
}

export function selectById(state: GameState, id: string, index = -1, split = false) {
  returnCursor(state);
  const slot = state.inventory.findIndex(item => item?.id === id);
  if (slot < 0 || !lift(state, state.inventory, slot, split)) return false;
  state.hotbarIndex = index;
  state.cursorRefill = !split;
  return true;
}

export function selectQuickbar(state: GameState, index: number, split = false) {
  const id = state.quickbar[index];
  if (!id || state.hotbarIndex === index && !split) {
    returnCursor(state);
    return;
  }
  selectById(state, id, index, split);
}

export function consumeCursor(state: GameState) {
  const cursor = getCursor(state);
  if (!cursor) return;
  if (cursor.count > 1) {
    state.cursorStack = { ...cursor, count: cursor.count - 1 };
    return;
  }
  const index = state.hotbarIndex;
  const refill = state.cursorRefill;
  state.cursorStack = null;
  state.cursorOrigin = undefined;
  if (refill) {
    const slot = state.inventory.findIndex(item => item?.id === cursor.id);
    if (slot >= 0 && lift(state, state.inventory, slot, false)) {
      state.hotbarIndex = index;
      return;
    }
  }
  state.hotbarIndex = -1;
  state.cursorRefill = false;
}

export function quickbarStock(state: GameState, id: string) {
  return state.inventory.reduce((total, item) => total + (item?.id === id ? item.count : 0),
    state.cursorStack?.id === id ? state.cursorStack.count : 0);
}

