export interface FishDef {
  id: string;
  name: string;
  price: number;
  difficulty: number; // 0 to 100
  behavior: "float" | "sink" | "sink_float" | "erratic";
  sizeRange: [number, number]; // [min, max] inches
  accentColor: string;
}

export const FISH_TYPES: Record<string, FishDef> = {
  carp: {
    id: "carp",
    name: "Carp",
    price: 30,
    difficulty: 15,
    behavior: "float",
    sizeRange: [15, 30],
    accentColor: "#8e8e34",
  },
  sardine: {
    id: "sardine",
    name: "Sardine",
    price: 40,
    difficulty: 35,
    behavior: "sink_float",
    sizeRange: [4, 10],
    accentColor: "#95a5a6",
  },
  salmon: {
    id: "salmon",
    name: "Salmon",
    price: 75,
    difficulty: 60,
    behavior: "erratic",
    sizeRange: [20, 40],
    accentColor: "#fa8072",
  },
  legend: {
    id: "legend",
    name: "Legend Fish",
    price: 500,
    difficulty: 92,
    behavior: "erratic",
    sizeRange: [45, 60],
    accentColor: "#3498db",
  },
  bream: {
    id: "bream",
    name: "Bream",
    price: 30,
    difficulty: 35,
    behavior: "float",
    sizeRange: [12, 30],
    accentColor: "#85929e",
  },
  largemouth_bass: {
    id: "largemouth_bass",
    name: "Largemouth Bass",
    price: 100,
    difficulty: 50,
    behavior: "sink_float",
    sizeRange: [11, 31],
    accentColor: "#2e4053",
  },
  catfish: {
    id: "catfish",
    name: "Catfish",
    price: 200,
    difficulty: 75,
    behavior: "erratic",
    sizeRange: [12, 72],
    accentColor: "#1c2833",
  },
  pufferfish: {
    id: "pufferfish",
    name: "Pufferfish",
    price: 200,
    difficulty: 80,
    behavior: "float",
    sizeRange: [1, 36],
    accentColor: "#f4d03f",
  },
};

export interface FishingState {
  status: "idle" | "casting" | "waiting" | "nibble" | "reeling" | "success" | "fail";
  castPower: number; // 0 to 100
  castDir: "up" | "down" | "left" | "right";
  bobberX: number;
  bobberY: number;
  waitTimer: number; // frames or ms until bite
  nibbleTimer: number; // time to hook the fish
  // Minigame variables:
  fishId: string;
  fishY: number; // 0 to 100 (bottom to top)
  fishTargetY: number;
  fishTimer: number;
  barY: number; // 0 to 100 (bottom to top)
  barVy: number;
  progress: number; // 0 to 100
  caughtSize?: number;
}

export function initFishing(dir: "up" | "down" | "left" | "right"): FishingState {
  return {
    status: "casting",
    castPower: 0,
    castDir: dir,
    bobberX: 0,
    bobberY: 0,
    waitTimer: 0,
    nibbleTimer: 0,
    fishId: "carp",
    fishY: 30,
    fishTargetY: 30,
    fishTimer: 0,
    barY: 20,
    barVy: 0,
    progress: 30,
  };
}

export function updateFishingPhysics(
  state: FishingState,
  isHoldingSpace: boolean,
  dt = 1 / 60
): void {
  if (state.status !== "reeling") return;

  const def = FISH_TYPES[state.fishId] || FISH_TYPES.carp;

  // 1. Update Reel Bar physics
  const gravity = 150; // pixels per sec^2
  const thrust = 280; // upward force when holding
  const maxVy = 180;
  const barSize = 16; // height size of the green bar in percentage units (e.g. 18%)

  if (isHoldingSpace) {
    state.barVy += thrust * dt;
  } else {
    state.barVy -= gravity * dt;
  }

  // Speed limits
  state.barVy = Math.max(-maxVy, Math.min(maxVy, state.barVy));
  state.barY += state.barVy * dt;

  // Floor / Ceiling bounces
  if (state.barY <= 0) {
    state.barY = 0;
    state.barVy = -state.barVy * 0.35; // bounce slightly
  } else if (state.barY >= 100 - barSize) {
    state.barY = 100 - barSize;
    state.barVy = 0; // stop at top
  }

  // 2. Update Fish AI movement
  state.fishTimer -= dt;
  if (state.fishTimer <= 0) {
    // Choose new target position based on behavior
    const r = Math.random();
    state.fishTargetY = Math.floor(r * 90) + 5; // keep away from absolute edge

    // Erratics move targets rapidly
    if (def.behavior === "erratic") {
      state.fishTimer = Math.max(0.2, Math.random() * 0.8);
    } else if (def.behavior === "sink_float") {
      state.fishTimer = Math.random() * 1.5 + 0.5;
      // Tendency to go to top/bottom
      state.fishTargetY = Math.random() > 0.5 ? 85 : 15;
    } else {
      state.fishTimer = Math.random() * 2.0 + 1.0;
    }
  }

  // Move fish towards target
  const fishSpeed = 15 + def.difficulty * 0.85; // how fast it matches target
  const diff = state.fishTargetY - state.fishY;
  state.fishY += diff * fishSpeed * dt;

  // Clamps
  state.fishY = Math.max(2, Math.min(98, state.fishY));

  // 3. Overlap check & Progress bar update
  // The green bar covers range [barY, barY + barSize]
  const overlap = state.fishY >= state.barY && state.fishY <= state.barY + barSize;
  const progressSpeed = 16; // percent per sec
  const drainSpeed = 12;

  if (overlap) {
    state.progress += progressSpeed * dt;
  } else {
    state.progress -= drainSpeed * dt;
  }

  state.progress = Math.max(0, Math.min(100, state.progress));

  // 4. Win / Loss triggers
  if (state.progress >= 100) {
    state.status = "success";
    const size = Math.floor(
      def.sizeRange[0] + Math.random() * (def.sizeRange[1] - def.sizeRange[0])
    );
    state.caughtSize = size;
  } else if (state.progress <= 0) {
    state.status = "fail";
  }
}
