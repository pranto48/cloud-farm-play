export interface NPCScheduleItem {
  time: number; // in minutes from 06:00 (e.g. 6*60 = 360)
  x: number;
  y: number;
  label: string;
}

export interface NPCDef {
  id: string;
  name: string;
  description: string;
  color: string; // for canvas rendering representation
  portraitColor: string; // for dialog portraits
  schedules: NPCScheduleItem[];
  defaultDialogue: string[];
  giftPreferences: {
    love: string[]; // item IDs
    like: string[];
    dislike: string[];
    hate: string[];
  };
  giftDialogues: {
    love: string;
    like: string;
    dislike: string;
    hate: string;
  };
}

export const NPCS: Record<string, NPCDef> = {
  robin: {
    id: "robin",
    name: "Chief Engineer Kane",
    description: "Senior Automation & Logistics Director. Manages factory belt networks and power grids.",
    color: "#d35400",
    portraitColor: "#e67e22",
    schedules: [
      { time: 6 * 60, x: 68, y: 36, label: "Engineering Command Hub" },
      { time: 10 * 60, x: 14, y: 15, label: "Inspecting Automated Belt Lines" },
      { time: 15 * 60, x: 70, y: 40, label: "Reviewing Assembly Blueprints" },
      { time: 19 * 60, x: 68, y: 36, label: "Heading back to Command" },
    ],
    defaultDialogue: [
      "Greetings, Engineer. Keep the conveyor belts running and smelting lines saturated!",
      "The factory must grow! Ensure your power grid satisfaction stays strictly at 100%.",
      "Have you upgraded to Red Belts and Stack Inserters yet? Throughput is everything.",
    ],
    giftPreferences: {
      love: ["electronic_circuit", "advanced_circuit", "processing_unit", "steel_plate"],
      like: ["iron_bar", "copper_bar", "transport_belt", "fast_transport_belt", "inserter"],
      dislike: ["wood", "stone"],
      hate: ["coal", "spoilage"],
    },
    giftDialogues: {
      love: "Sensational! High-density microchips and processed circuits are the lifeblood of our automation. Outstanding work!",
      like: "Thank you, Engineer! Clean raw plates and conveyor logistics components will immediately boost assembly throughput.",
      dislike: "Unprocessed rough stone or timber? We have heavy electric drills for this.",
      hate: "Dirty unrefined coal or bio-waste? Keep contaminants away from our high-precision circuitry.",
    },
  },
  haley: {
    id: "haley",
    name: "Dr. Evelyn Vance",
    description: "Chief Science Officer & Chemical Synthesis Director. Researches advanced tech trees.",
    color: "#3498db",
    portraitColor: "#2980b9",
    schedules: [
      { time: 6 * 60, x: 72, y: 37, label: "Science Research Laboratory" },
      { time: 11 * 60, x: 67, y: 41, label: "Calibrating Spectrometer Array" },
      { time: 15 * 60, x: 8, y: 58, label: "Collecting Chemical Samples" },
      { time: 18 * 60, x: 72, y: 37, label: "Analyzing Tech Tree Vectors" },
    ],
    defaultDialogue: [
      "Welcome to the Research Lab. Automation Science and Logistic Science are ready for deployment.",
      "Every new tech unlocked brings us closer to launching orbital platforms and space rockets.",
      "Watch your pollution cloud. High emissions agitate planetary biomes.",
    ],
    giftPreferences: {
      love: ["automation_science_pack", "logistic_science_pack", "chemical_science_pack", "utility_science_pack"],
      like: ["battery", "solar_panel", "accumulator", "copper_wire", "yumako"],
      dislike: ["burner_drill", "stone_furnace"],
      hate: ["spoilage"],
    },
    giftDialogues: {
      love: "Fascinating! A pure Science Pack flask. I can immediately synthesize this to accelerate our active research project!",
      like: "Thank you! Clean energy accumulators and micro-capacitors will power our particle analyzers.",
      dislike: "Primitive burner technology? We need clean electric and chemical automation.",
      hate: "Decomposed bio-spoilage? Please sterilize your hazard suit before entering the cleanroom!",
    },
  },
  lewis: {
    id: "lewis",
    name: "Commander Bradley",
    description: "Planetary Defense & Logistics Commander. Coordinates orbital drops and base defense.",
    color: "#27ae60",
    portraitColor: "#2ecc71",
    schedules: [
      { time: 6 * 60, x: 70, y: 35, label: "Planetary Defense Headquarters" },
      { time: 9 * 60, x: 19, y: 29, label: "Inspecting Perimeter Defense Line" },
      { time: 14 * 60, x: 70, y: 40, label: "Checking Ammunition Stockpiles" },
      { time: 18 * 60, x: 66, y: 41, label: "Reviewing Turret Placement" },
      { time: 21 * 60, x: 70, y: 35, label: "Securing Command Bunker" },
    ],
    defaultDialogue: [
      "Attention, Engineer. Maintain turret defensive rings around your primary pollution emitters.",
      "Our orbital logistics pods will process all container shipments and deliver credits upon orbital pass.",
      "The native biters evolve rapidly with cumulative emissions. Keep weapons and armor loaded at all times.",
    ],
    giftPreferences: {
      love: ["laser_turret", "power_armor", "rocket", "uranium_rounds_magazine"],
      like: ["firearm_magazine", "piercing_rounds_magazine", "gun_turret", "steel_plate", "radar"],
      dislike: ["wood", "copper_wire"],
      hate: ["spoilage"],
    },
    giftDialogues: {
      love: "Superior military ordinance! Heavy laser turrets and power armor ensure impenetrable defensive superiority. Excellent work, soldier!",
      like: "Ammunition and reinforced alloy plates will keep our automated defense turrets fully supplied.",
      dislike: "Wood and basic copper coils? We are preparing for heavy biter sieges, not craft woodwork.",
      hate: "Disgusting bio-sludge. Keep biological contaminants away from military armories.",
    },
  },
};

export function getNPCDestination(npcId: string, time: number): { x: number; y: number; label: string } {
  const npc = NPCS[npcId];
  if (!npc) return { x: 70, y: 40, label: "Shop" };

  // Find the schedule item that is active for the current time
  // The schedules are sorted by time. We find the last schedule item <= current time
  let active = npc.schedules[0];
  for (const item of npc.schedules) {
    if (time >= item.time) {
      active = item;
    } else {
      break;
    }
  }
  return { x: active.x, y: active.y, label: active.label };
}

export function giftReaction(npcId: string, itemId: string): { type: "love" | "like" | "dislike" | "hate"; dialogue: string; points: number } {
  const npc = NPCS[npcId];
  if (!npc) return { type: "like", dialogue: "Thanks.", points: 20 };

  const prefs = npc.giftPreferences;
  if (prefs.love.includes(itemId)) {
    return { type: "love", dialogue: npc.giftDialogues.love, points: 80 };
  }
  if (prefs.like.includes(itemId)) {
    return { type: "like", dialogue: npc.giftDialogues.like, points: 45 };
  }
  if (prefs.hate.includes(itemId)) {
    return { type: "hate", dialogue: npc.giftDialogues.hate, points: -40 };
  }
  if (prefs.dislike.includes(itemId)) {
    return { type: "dislike", dialogue: npc.giftDialogues.dislike, points: -20 };
  }

  // Default fallback reaction
  return { type: "like", dialogue: `Thanks for the ${itemId}!`, points: 20 };
}
