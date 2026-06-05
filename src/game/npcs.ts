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
    name: "Robin",
    description: "The local carpenter. Friendly and hard-working.",
    color: "#d35400",
    portraitColor: "#e67e22",
    schedules: [
      { time: 6 * 60, x: 68, y: 36, label: "Robin's House" },
      { time: 10 * 60, x: 14, y: 15, label: "Chopping Wood in the Forest" },
      { time: 15 * 60, x: 70, y: 40, label: "Visiting the Village Shop" },
      { time: 19 * 60, x: 68, y: 36, label: "Heading back home" },
    ],
    defaultDialogue: [
      "Hi there! Need some wood? A carpenter's job is never finished.",
      "The valley has such beautiful lumber. Remember to replant trees!",
      "I'm working on a blueprint for a new barn. Maybe one day I can build it for you.",
    ],
    giftPreferences: {
      love: ["copper_bar", "iron_bar", "gold_bar", "plank"],
      like: ["wood", "stone", "copper_ore", "iron_ore", "gold_ore"],
      dislike: ["parsnip", "potato", "fiber"],
      hate: ["coal", "sardine", "carp", "legend"],
    },
    giftDialogues: {
      love: "Wow, a refined bar! This is exactly what I need for my carpentry tool upgrades. Thank you so much!",
      like: "Thanks! Wood and stone are always useful around the shop.",
      dislike: "Ah... some farm greens? I don't really have a use for this.",
      hate: "Oh... this is... trash, isn't it? Or smells like one. No thanks.",
    },
  },
  haley: {
    id: "haley",
    name: "Haley",
    description: "A trendy townsperson who loves photography and flowers.",
    color: "#f1c40f",
    portraitColor: "#f39c12",
    schedules: [
      { time: 6 * 60, x: 72, y: 37, label: "Haley's Room" },
      { time: 11 * 60, x: 67, y: 41, label: "Hanging near Town Fountain" },
      { time: 15 * 60, x: 8, y: 58, label: "Taking photos by the South River" },
      { time: 18 * 60, x: 72, y: 37, label: "Heading home before dark" },
    ],
    defaultDialogue: [
      "Oh, a farmer? Your clothes look dusty. Don't stand too close!",
      "I love taking photos of the starflowers. They're so pretty.",
      "I wonder if anyone sells nice makeup in this tiny village.",
    ],
    giftPreferences: {
      love: ["starflower", "strawberry", "legend"],
      like: ["blueberry", "cauliflower"],
      dislike: ["wood", "stone", "fiber", "coal"],
      hate: ["copper_ore", "iron_ore", "gold_ore", "carp", "sardine"],
    },
    giftDialogues: {
      love: "Oh my gosh, a starflower! It's so gorgeous! This is the best gift ever, thank you!",
      like: "Thanks! Fresh sweet berries are quite nice.",
      dislike: "Ew, wood and stones? What am I supposed to do with these?",
      hate: "Gross! Are you trying to make me clean up dirty rocks or smelly fish? Get it away!",
    },
  },
  lewis: {
    id: "lewis",
    name: "Mayor Lewis",
    description: "The long-standing Mayor of Meadow Valley.",
    color: "#27ae60",
    portraitColor: "#2ecc71",
    schedules: [
      { time: 6 * 60, x: 70, y: 35, label: "Mayor's Manor" },
      { time: 9 * 60, x: 19, y: 29, label: "Checking the Farm Shipping Bin" },
      { time: 14 * 60, x: 70, y: 40, label: "Checking on the Shop" },
      { time: 18 * 60, x: 66, y: 41, label: "Strolling in the Town Square" },
      { time: 21 * 60, x: 70, y: 35, label: "Returning home" },
    ],
    defaultDialogue: [
      "Ah, welcome to Meadow Valley! I hope you are taking good care of the old farm.",
      "Our shipping bin handles all exports. Throw items in there and I'll settle your earnings overnight.",
      "A mayor's duty is to ensure the town is peaceful. Let me know if you need anything.",
    ],
    giftPreferences: {
      love: ["gold_bar", "gold_ore", "parsnip", "legend"],
      like: ["potato", "cauliflower", "strawberry", "blueberry"],
      dislike: ["wood", "stone", "fiber", "coal"],
      hate: ["sardine", "carp"],
    },
    giftDialogues: {
      love: "This is remarkable! Gold or a fresh parsnip represents the finest goods in our valley. Thank you!",
      like: "Thank you! Our local crops are the pride of the town.",
      dislike: "Well, thank you, but I have plenty of materials at town hall.",
      hate: "This is... rather unpleasant. I expect better than raw river fish from my citizens.",
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
