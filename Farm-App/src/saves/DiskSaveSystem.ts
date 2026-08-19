import { GameState, prepareStateForSave, migrateState } from "../game/meadow-life";

export interface DesktopSaveSlot {
  id: string;
  name: string;
  timestamp: number;
  day: number;
  time: number;
  season: string;
  coins: number;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
  machinesCount: number;
  data: unknown;
}

declare global {
  interface Window {
    desktopAPI?: {
      isDesktop: boolean;
      listSaves: () => Promise<{ success: boolean; saves: DesktopSaveSlot[]; error?: string }>;
      saveGame: (payload: { name: string; slotId?: string; data: unknown; metadata: Partial<DesktopSaveSlot> }) => Promise<{ success: boolean; id?: string; error?: string }>;
      loadGame: (slotId: string) => Promise<{ success: boolean; slot?: DesktopSaveSlot; error?: string }>;
      deleteSave: (slotId: string) => Promise<{ success: boolean; error?: string }>;
      toggleFullscreen: () => Promise<boolean>;
    };
  }
}

export const isDesktopRuntime = (): boolean => {
  return typeof window !== "undefined" && !!window.desktopAPI?.isDesktop;
};

// Count placed machines on grid
export const countPlacedMachines = (s: GameState): number => {
  let count = 0;
  if (s.tiles) {
    for (const row of s.tiles) {
      for (const t of row) {
        if (t && t.placedItemId) count++;
      }
    }
  }
  return count;
};

// List all saves from Disk or LocalStorage
export async function listAllSaves(): Promise<DesktopSaveSlot[]> {
  if (isDesktopRuntime()) {
    try {
      const res = await window.desktopAPI!.listSaves();
      if (res.success && Array.isArray(res.saves)) {
        return res.saves;
      }
    } catch (err) {
      console.error("Desktop disk save list error:", err);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem("farm_app_factorio_saves") || localStorage.getItem("meadow_life_factorio_saves");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

// Save current game to Disk or LocalStorage
export async function saveGameToDisk(state: GameState, customName?: string, existingSlotId?: string): Promise<{ success: boolean; slot?: DesktopSaveSlot; message?: string }> {
  const name = customName?.trim() || `Nauvis Factory - Day ${state.day}`;
  const slotId = existingSlotId || `save_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const prepared = prepareStateForSave(state);

  const metadata: Partial<DesktopSaveSlot> = {
    day: state.day,
    time: state.time,
    season: state.season,
    coins: state.coins,
    energy: Math.round(state.energy),
    maxEnergy: state.maxEnergy,
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    machinesCount: countPlacedMachines(state),
  };

  const newSlot: DesktopSaveSlot = {
    id: slotId,
    name,
    timestamp: Date.now(),
    day: metadata.day!,
    time: metadata.time!,
    season: metadata.season!,
    coins: metadata.coins!,
    energy: metadata.energy!,
    maxEnergy: metadata.maxEnergy!,
    health: metadata.health!,
    maxHealth: metadata.maxHealth!,
    machinesCount: metadata.machinesCount!,
    data: prepared,
  };

  if (isDesktopRuntime()) {
    try {
      const res = await window.desktopAPI!.saveGame({
        name,
        slotId,
        data: prepared,
        metadata,
      });
      if (res.success) {
        return { success: true, slot: newSlot, message: `Saved directly to disk: saves/${slotId}.json` };
      }
    } catch (err) {
      console.error("Desktop disk save error:", err);
    }
  }

  // Fallback to localStorage
  try {
    const current = await listAllSaves();
    let updated: DesktopSaveSlot[] = [];
    if (existingSlotId) {
      updated = current.map((s) => (s.id === existingSlotId ? newSlot : s));
    } else {
      updated = [newSlot, ...current.filter((s) => s.id !== slotId)];
    }
    localStorage.setItem("farm_app_factorio_saves", JSON.stringify(updated));
    return { success: true, slot: newSlot, message: `Saved locally as "${name}"` };
  } catch (err) {
    return { success: false, message: "Storage quota exceeded or write failed" };
  }
}

// Load game from Disk or LocalStorage
export async function loadGameFromDisk(slot: DesktopSaveSlot): Promise<{ success: boolean; state?: GameState; message?: string }> {
  try {
    let rawData = slot.data;
    if (isDesktopRuntime()) {
      const res = await window.desktopAPI!.loadGame(slot.id);
      if (res.success && res.slot) {
        rawData = res.slot.data || res.slot;
      }
    }
    const migrated = migrateState(rawData);
    return { success: true, state: migrated, message: `Loaded save "${slot.name}" successfully!` };
  } catch (err) {
    return { success: false, message: "Failed to deserialize save data" };
  }
}

// Delete save from Disk or LocalStorage
export async function deleteSaveFromDisk(slotId: string): Promise<boolean> {
  if (isDesktopRuntime()) {
    try {
      await window.desktopAPI!.deleteSave(slotId);
      return true;
    } catch (err) {
      console.error("Desktop disk delete error:", err);
    }
  }

  // Fallback to localStorage
  try {
    const current = await listAllSaves();
    const updated = current.filter((s) => s.id !== slotId);
    localStorage.setItem("farm_app_factorio_saves", JSON.stringify(updated));
    return true;
  } catch (err) {
    return false;
  }
}
