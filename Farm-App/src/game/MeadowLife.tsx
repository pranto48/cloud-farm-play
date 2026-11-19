import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLS,
  ROWS,
  TILE,
  draw,
  interact,
  isWalkable,
  newGame,
  sleep,
  TIME_TICK_MS,
  formatTime,
  getTimePhase,
  frontTile,
  CRAFTING_RECIPES,
  craftItem,
  generateMineFloor,
  STATIC_POINTS,
  sortInventory,
  quickStackToChest,
  hasItems,
  getGlobalItemCount,
  updateEntities,
  migrateState,
  addItem,
  removeItem,
  deductItems,
  getChestSlotCount,
  isChestBuilding,
  TECHNOLOGIES,
  LAND_PARCELS,
  applyLandPurchase,
  ensureMapExploration,
  getBiomeAt,
  getDirectionVector,
  getWorldCamera,
  makeMap,
  prepareStateForSave,
  getFactoryPlacementIssue,
  getPlacementIssue,
  isBuildableItem,
  isTerrainItem,
  acceptsManualSlot,
  isConveyor,
  fuelMachine,
  dismantleTile,
  type MultiplayerRoom,
  type BiomeInfo,
  type GameState,
  type Tile,
  type Enemy,
  type Particle,
  type FloatingText,
  type MailLetter,
  type Animal,
  type Recipe,
  type TechDef,
} from "./meadow-life";
import { shopInventoryForSeason, CROPS } from "./data/crops";
import { ITEM_DEFS, createItem, type Item } from "./data/items";
import { NPCS, giftReaction, getNPCDestination, type NPCDef } from "./npcs";
import { FISH_TYPES, initFishing, updateFishingPhysics } from "./fishing";
import { gameAudio } from "./audio";
import { getYardItemIcon } from "./yard-art";
import { equippedWeapon, firePlayerWeapon, inventoryCopy, loadDefenseAmmo, pickupNearby, placeLooseItem, stepPlayer } from "./field-play";
import { drawChart } from "./survey-chart";
import { planHandcraft } from "./handcraft";
import { consumeCursor, cursorSlotClick, getCursor, packStack, quickbarStock, returnCursor, selectById, selectQuickbar } from "./item-cursor";
import { listAllSaves, saveGameToDisk } from "../saves/DiskSaveSystem";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Sprout, Wheat, Bed, Hammer, Droplets, Scissors, Pickaxe,
  Heart, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Hand, Swords,
  Volume2, VolumeX, Backpack, HelpCircle, Compass, Shield, MapPin, X,
  Mail, Calendar, Trophy, Maximize, Minimize, Flame, Zap, Users
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  initialState?: GameState | null;
  onStateChange?: (s: GameState) => void;
};

function StackIcon({ item }: { item: Item }) {
  const icon = getYardItemIcon(item.id);
  return icon ? <img src={icon} alt="" draggable={false} className="stack-icon" />
    : <span className="stack-symbol" aria-hidden="true">{item.iconSymbol || item.name.slice(0, 1)}</span>;
}

function FactorioCraftingIcon({
  iconSymbol,
  name,
  count,
  craftableCount,
  canCraft = true,
  isTechLocked = false,
  isSelected = false,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  title,
}: {
  iconSymbol?: string;
  name?: string;
  count?: number;
  craftableCount?: number;
  canCraft?: boolean;
  isTechLocked?: boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title || `${name}\nLeft-Click: Craft 1 | Right-Click: Craft 5 | Shift-Click: Craft All`}
      className={`relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-sm border transition-all duration-150 select-none font-mono cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] ${isTechLocked
          ? "bg-[#181220] border-[#6b21a8] text-purple-400 opacity-60 hover:opacity-100 hover:border-[#a855f7]"
          : canCraft
            ? isSelected
              ? "bg-[#253528] border-[#ff9200] text-amber-200 shadow-[0_0_8px_rgba(255,146,0,0.8)] scale-105 z-10"
              : "bg-[#1c241e] border-[#2e4033] hover:border-[#ff9200] hover:bg-[#263329] text-emerald-100"
            : "bg-[#14161a] border-[#222730] opacity-40 text-stone-500 hover:opacity-70 cursor-not-allowed"
        }`}
    >
      {/* Corner Status Indicator */}
      <span
        className={`absolute top-1 left-1 h-1.5 w-1.5 rounded-full ${isTechLocked
            ? "bg-purple-500"
            : canCraft
              ? "bg-emerald-400 shadow-[0_0_3px_#2ecc71]"
              : "bg-transparent"
          }`}
      />
      {isTechLocked && <span className="absolute top-0.5 right-0.5 text-[8px]">🔒</span>}

      <span className="text-xl filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{iconSymbol || "⚙"}</span>

      {/* Craftable Count Badge */}
      {craftableCount !== undefined && craftableCount > 0 && (
        <span className="absolute bottom-0.5 right-0.5 px-0.5 bg-black/90 border border-emerald-500/40 rounded-[2px] text-[7.5px] font-extrabold text-emerald-300 leading-none">
          {craftableCount}
        </span>
      )}

      {count !== undefined && count > 1 && (
        <span className="absolute bottom-1 right-1 px-1 bg-[#ff9200] text-black font-extrabold rounded-xs text-[9px] font-mono leading-none shadow-md border border-amber-300">
          x{count}
        </span>
      )}
    </button>
  );
}

export function MeadowLife({ initialState, onStateChange }: Props = {}) {
  const [state, setState] = useState<GameState>(() => initialState ?? newGame());
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastEntityTickRef = useRef<number>(0);
  const lastParticleTickRef = useRef<number>(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;

      // F11 / Alt+Enter for Borderless Windows Native Fullscreen
      if (e.key === "F11" || (e.altKey && e.key === "Enter")) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Ctrl + S: Save game file (.json) to Windows PC disk
      if ((e.ctrlKey || e.metaKey) && k === "s") {
        e.preventDefault();
        handleExportSaveFile();
        return;
      }

      // Ctrl + O: Open / Import save file from Windows PC disk
      if ((e.ctrlKey || e.metaKey) && k === "o") {
        e.preventDefault();
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.onchange = (evt: any) => handleImportSaveFile(evt);
        fileInput.click();
        return;
      }

      if (e.key === "F5") {
        e.preventDefault();
        if (e.repeat) return;
        const snapshot = stateRef.current;
        void saveGameToDisk(snapshot, `Quick save · Day ${snapshot.day}`, "quicksave").then(result => {
          if (result.success) toast.success("Quick save created.");
          else toast.error(result.message ?? "Quick save failed.");
        });
        return;
      }

      // F9: Quick Load Checkpoint from PC storage & disk
      if (e.key === "F9") {
        e.preventDefault();
        (async () => {
          try {
            if (typeof window !== "undefined" && window.desktopAPI?.loadGame) {
              const res = await window.desktopAPI.loadGame("quicksave");
              if (res?.success && res.slot) {
                const data = res.slot.data || res.slot;
                setState(migrateState(data));
                toast.success("⚡ Desktop Disk Quick Save Loaded! (F9)");
                return;
              }
            }
            const slot = (await listAllSaves()).find(save => save.id === "quicksave");
            const raw = slot ? JSON.stringify(slot.data) : localStorage.getItem("meadow_life_quicksave");
            if (raw) {
              const parsed = JSON.parse(raw);
              setState(migrateState(parsed));
              toast.success("⚡ Quick Save Checkpoint Loaded! (F9)");
            } else {
              toast.warning("No Quick Save found (press F5 first).");
            }
          } catch (err) {
            toast.error("Failed to quick load.");
          }
        })();
        return;
      }

      if (tag === "INPUT" || tag === "TEXTAREA") return;
      pressedKeysRef.current.add(k);
      if (e.shiftKey) pressedKeysRef.current.add("shift");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      pressedKeysRef.current.delete(k);
      if (!e.shiftKey) pressedKeysRef.current.delete("shift");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const autosave = setInterval(() => {
      const snapshot = stateRef.current;
      void saveGameToDisk(snapshot, `Autosave · Day ${snapshot.day}`, "autosave").then(result => {
        if (!result.success) toast.error(result.message ?? "Autosave failed.");
      });
    }, 180000);
    const clearKeys = () => { pressedKeysRef.current.clear(); miningHold.current = false; };
    window.addEventListener("blur", clearKeys);
    return () => {
      clearInterval(autosave);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);

  // Biome Exploration Banner & Discovery Tracker
  const [biomeBanner, setBiomeBanner] = useState<{ name: string; nameBn: string; subtitle: string } | null>(null);
  const lastBiomeKindRef = useRef<string>("");

  // Exploration Compass Waypoints
  const [customWaypoints, setCustomWaypoints] = useState<Array<{ id: string; name: string; icon: string; x: number; y: number; color: string }>>([
    { id: "home", name: "Farm House", icon: "🏠", x: 16, y: 30, color: "#2ecc71" },
    { id: "shop", name: "Town Shop", icon: "🏪", x: 70, y: 40, color: "#f39c12" },
    { id: "mine", name: "Mine Cave", icon: "⛏️", x: 72, y: 8, color: "#9b59b6" },
  ]);

  // Menu Overlays
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartMode, setChartMode] = useState<"local" | "region">("local");
  const [chartPollution, setChartPollution] = useState(false);
  useEffect(() => {
    if (!chartOpen) return;
    const paint = () => {
      if (chartRef.current) drawChart(chartRef.current, stateRef.current, chartMode, chartPollution);
    };
    const delay = setTimeout(paint, 70);
    const timer = setInterval(paint, 180);
    return () => { clearTimeout(delay); clearInterval(timer); };
  }, [chartOpen, chartMode, chartPollution]);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"inventory" | "crafting" | "social" | "skills" | "workers">("inventory");
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"all_items" | "seeds" | "animals" | "upgrades" | "sell" | "hire">("all_items");
  const [shopSearchTerm, setShopSearchTerm] = useState("");
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>("all");

  // Multiplayer Rooms & Separate Maps
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [availableRooms, setAvailableRooms] = useState<MultiplayerRoom[]>([
    {
      id: "room_global_1",
      name: "🌐 Global Meadow #1",
      code: "MEADOW-1",
      mapSeed: 101,
      isPrivate: false,
      maxPlayers: 4,
      players: [
        { id: "p1", name: "Farmer_Emma", x: 22, y: 32, subX: 22, subY: 32, dir: "down", color: "#2ecc71", avatarSymbol: "👩‍🌾" }
      ]
    },
    {
      id: "room_factorio_2",
      name: "🏭 Meadow Works Co-op",
      code: "FACTORIO-2",
      mapSeed: 202,
      isPrivate: false,
      maxPlayers: 4,
      players: [
        { id: "p2", name: "Engineer_Alex", x: 74, y: 12, subX: 74, subY: 12, dir: "right", color: "#e67e22", avatarSymbol: "👨‍🏭" },
        { id: "p3", name: "Builder_Sam", x: 78, y: 16, subX: 78, subY: 16, dir: "down", color: "#3498db", avatarSymbol: "👷" }
      ]
    },
    {
      id: "room_quarry_3",
      name: "⛏ Mining Quarry #3",
      code: "MINING-3",
      mapSeed: 303,
      isPrivate: false,
      maxPlayers: 4,
      players: [
        { id: "p4", name: "Miner_Jake", x: 85, y: 20, subX: 85, subY: 20, dir: "left", color: "#9b59b6", avatarSymbol: "⛏" }
      ]
    },
    {
      id: "room_wilderness_4",
      name: "🌲 Wilderness Reserve #4",
      code: "WILD-4",
      mapSeed: 404,
      isPrivate: false,
      maxPlayers: 4,
      players: []
    }
  ]);

  const handleSwitchRoom = (targetRoom: MultiplayerRoom) => {
    setState((prev) => {
      const next = structuredClone(prev);
      const currentRoomId = next.currentRoomId || "room_global_1";
      if (!next.savedRoomMaps) next.savedRoomMaps = {};
      next.savedRoomMaps[currentRoomId] = next.tiles;

      if (next.savedRoomMaps[targetRoom.id]) {
        next.tiles = next.savedRoomMaps[targetRoom.id];
      } else {
        const newMap = makeMap();
        next.tiles = newMap;
        next.savedRoomMaps[targetRoom.id] = newMap;
      }

      next.currentRoomId = targetRoom.id;
      next.currentRoomCode = targetRoom.code;
      next.remotePlayers = targetRoom.players;

      toast.success(`Joined ${targetRoom.name}! Switched to separate map.`);
      return next;
    });
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name.");
      return;
    }
    const code = newRoomCode.trim().toUpperCase() || `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
    const seed = Math.floor(Math.random() * 100000);
    const newRoom: MultiplayerRoom = {
      id: `room_${Date.now()}`,
      name: newRoomName.trim(),
      code: code,
      mapSeed: seed,
      isPrivate: false,
      maxPlayers: 4,
      players: []
    };

    setAvailableRooms((prev) => [...prev, newRoom]);
    handleSwitchRoom(newRoom);
    setNewRoomName("");
    setNewRoomCode("");
  };

  const recipesByCategory = useMemo(() => {
    return {
      logistics: CRAFTING_RECIPES.filter((r) =>
        [
          "chest", "iron_chest", "steel_chest", "storage_tank",
          "transport_belt", "fast_transport_belt", "express_transport_belt", "turbo_transport_belt",
          "underground_belt", "fast_underground_belt", "express_underground_belt", "turbo_underground_belt",
          "splitter", "fast_splitter", "express_splitter", "turbo_splitter",
          "loader", "fast_loader", "express_loader", "turbo_loader",
          "burner_inserter", "inserter", "long_inserter", "fast_inserter", "filter_inserter", "stack_inserter", "stack_filter_inserter",
          "power_pole", "medium_power_pole", "big_electric_pole", "substation",
          "pipe", "pipe_to_ground", "small_pump", "valve",
          "rail", "rail_ramp", "rail_support", "elevated_straight_rail", "elevated_curved_rail", "rail_signal", "rail_chain_signal", "train_stop",
          "locomotive", "cargo_wagon", "fluid_wagon", "artillery_wagon",
          "car", "tank", "spidertron", "spidertron_remote",
          "construction_robot", "logistic_robot", "active_provider_chest", "passive_provider_chest", "storage_chest", "buffer_chest", "requester_chest", "roboport",
          "lamp", "red_wire", "green_wire", "arithmetic_combinator", "decider_combinator", "constant_combinator", "selector_combinator", "power_switch", "programmable_speaker", "display_panel",
          "stone_brick", "concrete", "hazard_concrete", "refined_concrete", "refined_hazard_concrete", "landfill", "cliff_explosives"
        ].includes(r.id)
      ),
      production: CRAFTING_RECIPES.filter((r) =>
        [
          "repair_pack", "boiler", "steam_engine", "solar_panel", "battery", "nuclear_reactor", "heat_pipe", "heat_exchanger", "steam_turbine", "fusion_reactor", "fusion_generator",
          "burner_drill", "electric_drill", "big_mining_drill", "offshore_pump", "pumpjack",
          "stone_furnace", "steel_furnace", "electric_furnace", "foundry", "biochamber",
          "assembling_machine_1", "assembling_machine_2", "assembling_machine_3", "oil_refinery", "chemical_plant", "centrifuge", "electromagnetic_plant", "cryogenic_plant", "science_lab", "biolab",
          "beacon",
          "speed_module", "speed_module_2", "speed_module_3",
          "productivity_module", "productivity_module_2", "productivity_module_3",
          "efficiency_module", "efficiency_module_2", "efficiency_module_3",
          "quality_module_1", "quality_module_2", "quality_module_3",
          "agricultural_tower", "captive_biter_spawner"
        ].includes(r.id)
      ),
      intermediates: CRAFTING_RECIPES.filter((r) =>
        [
          "wood", "stone", "coal", "iron_ore", "copper_ore", "uranium_ore", "raw_fish", "ice", "calcite", "tungsten_ore", "holmium_ore", "scrap",
          "iron_bar", "copper_bar", "steel_plate", "tungsten_plate", "plastic_bar", "sulfur", "carbon_fiber",
          "iron_gear", "copper_wire", "iron_stick", "green_wire", "red_wire",
          "electronic_circuit", "advanced_circuit", "processing_unit", "quantum_processor",
          "empty_barrel", "crude_oil_barrel", "heavy_oil_barrel", "light_oil_barrel", "petroleum_gas_barrel", "sulfuric_acid_barrel", "lubricant_barrel", "water_barrel", "lubricant",
          "engine_unit", "electric_engine", "flying_robot_frame",
          "low_density_structure", "rocket_control_unit", "rocket_fuel", "nuclear_fuel", "fusion_fuel_cell",
          "uranium_fuel_cell", "uranium_235", "uranium_238",
          "yumako", "jellynut", "bioflux", "nutrients", "pentapod_egg", "biter_egg"
        ].includes(r.id)
      ),
      space: CRAFTING_RECIPES.filter((r) =>
        [
          "space_platform_starter_pack", "space_platform_hub", "cargo_bay", "cargo_landing_pad", "cargo_pod", "thruster", "asteroid_collector",
          "metallic_asteroid_chunk", "carbonic_asteroid_chunk", "oxide_asteroid_chunk", "promethium_asteroid_chunk",
          "automation_science_pack", "logistic_science_pack", "military_science_pack", "chemical_science_pack", "production_science_pack", "utility_science_pack", "space_science_pack",
          "metallurgic_science_pack", "agricultural_science_pack", "electromagnetic_science_pack", "cryogenic_science_pack", "promethium_science_pack",
          "rocket_part", "satellite", "rocket_silo"
        ].includes(r.id)
      ),
      combat: CRAFTING_RECIPES.filter((r) =>
        [
          "pistol", "submachine_gun", "shotgun", "combat_shotgun", "rocket_launcher", "flamethrower", "railgun", "tesla_gun",
          "firearm_magazine", "piercing_rounds_magazine", "uranium_rounds_magazine",
          "shotgun_shells", "piercing_shotgun_shells", "cannon_shell", "explosive_cannon_shell", "uranium_cannon_shell",
          "rocket", "explosive_rocket", "atomic_bomb", "flamethrower_ammo", "artillery_shell",
          "grenade", "cluster_grenade", "poison_capsule", "slowdown_capsule", "defender_capsule", "distractor_capsule", "destroyer_capsule",
          "light_armor", "heavy_armor", "modular_armor", "power_armor", "power_armor_mk2",
          "solar_panel_equipment", "personal_fusion_reactor_equipment", "battery_equipment", "battery_mk2_equipment", "energy_shield", "energy_shield_mk2",
          "personal_roboport", "personal_roboport_mk2_equipment", "night_vision_equipment", "belt_immunity_equipment", "exoskeleton_equipment",
          "discharge_defense_equipment", "discharge_defense_remote", "personal_laser_defense_equipment",
          "stone_wall", "gate", "land_mine",
          "gun_turret", "laser_turret", "flamethrower_turret", "rocket_turret", "tesla_turret", "railgun_turret", "artillery_turret", "artillery_targeting_remote", "radar", "raw_fish"
        ].includes(r.id)
      ),
    };
  }, []);

  const [chestOpenTile, setChestOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [factorioInspectorTile, setFactorioInspectorTile] = useState<{ x: number; y: number } | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<{ npcId: string; dialogue: string } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<GameState["dailyEarnings"] | null>(null);

  // New overhauls states
  const [sleepConfirmOpen, setSleepConfirmOpen] = useState(false);
  const [shippingBinOpen, setShippingBinOpen] = useState(false);
  const [furnaceOpenTile, setFurnaceOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [craftingCategory, setCraftingCategory] = useState<"logistics" | "production" | "intermediates" | "space" | "combat">("logistics");
  const craftingQueue = state.handcraftQueue ?? [];
  const [hoveredRecipe, setHoveredRecipe] = useState<Recipe | null>(null);
  const hoveredTileRef = useRef<{ x: number; y: number } | null>(null);

  // Mailbox Mail overlay
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [readingLetter, setReadingLetter] = useState<MailLetter | null>(null);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Chat / Cheat Console
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ text: string; color: string }[]>([]);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // About Page
  const [aboutOpen, setAboutOpen] = useState(false);
  const [productionStatsOpen, setProductionStatsOpen] = useState(false);
  const [productionStatsTab, setProductionStatsTab] = useState<"items" | "electricity" | "pollution">("items");

  // Player Store
  const [playerStoreOpen, setPlayerStoreOpen] = useState(false);
  const [playerStoreTile, setPlayerStoreTile] = useState<{ x: number; y: number } | null>(null);
  const [playerStoreTab, setPlayerStoreTab] = useState<"buy" | "sell" | "workers" | "land">("buy");

  // Research Center
  const [researchCenterOpen, setResearchCenterOpen] = useState(false);
  const [hoveredTech, setHoveredTech] = useState<TechDef | null>(null);

  // Layout toggle settings
  const [useSidebar, setUseSidebar] = useState(false); // default to false since we use Factorio bottom hotbar

  // Audio mute
  const [muted, setMuted] = useState(gameAudio.isMuted());

  // Fullscreen state and canvas size
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(false);
  const [radarExpanded, setRadarExpanded] = useState(true);

  const [campaignMinimized, setCampaignMinimized] = useState(false);
  const [, refreshHud] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => refreshHud(tick => tick + 1), 350);
    return () => clearInterval(timer);
  }, []);
  const beltDrag = useRef<{ x: number; y: number } | null>(null);
  const miningHold = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 704, height: 480 });
  const [zoom, setZoom] = useState<number>(1.0);
  const zoomRef = useRef<number>(1.0);
  zoomRef.current = zoom;

  const handleZoomIn = () => setZoom((z) => Math.min(2.0, parseFloat((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))));
  const handleZoomReset = () => setZoom(1.0);

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Factorio Save & Load Game Management State
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const [saveLoadTab, setSaveLoadTab] = useState<"load" | "save">("load");
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveSlots, setSaveSlots] = useState<{
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
    mineDepth: number;
    machinesCount: number;
    data: unknown;
  }[]>([]);

  const loadSavedSlotsFromStorage = () => {
    try {
      const raw = localStorage.getItem("meadow_life_factorio_saves");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSaveSlots(parsed);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setSaveSlots([]);
  };

  useEffect(() => {
    loadSavedSlotsFromStorage();
  }, []);

  // Graphics & FPS Settings, Wardrobe, and Performance Overlay State
  const [graphicsSettingsOpen, setGraphicsSettingsOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [realFps, setRealFps] = useState(60);
  const [realFrameTime, setRealFrameTime] = useState(16.6);
  const [realUps, setRealUps] = useState(20);

  const handleUpdateDress = (updates: Partial<NonNullable<GameState["player"]>>) => {
    setState((prev) => {
      const next = structuredClone(prev);
      next.player = { ...next.player, ...updates };
      toast.success("Player dress & appearance updated! 👕");
      return next;
    });
  };

  const handleUpdateSettings = (updates: Partial<NonNullable<GameState["settings"]>>) => {
    setState((prev) => {
      const next = structuredClone(prev);
      next.settings = {
        fpsLimit: 60,
        graphicsQuality: "low",
        showGrid: true,
        showFpsOverlay: true,
        shadowsEnabled: true,
        particleDensity: "low",
        desktopMode: true,
        ...(next.settings || {}),
        ...updates,
      };
      toast.success("Graphics & FPS settings updated! ⚙️");
      return next;
    });
  };

  // Offline / Online Network Detection State & Local Windows File Export/Import
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("🌐 Online Connected! Auto-syncing saves to Cloud...");
      handleCloudSave();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("📶 Offline Windows Mode Active. Game saving locally to disk.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleExportSaveFile = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `MeadowLife_Save_Day${state.day}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Exported save game file (.json) to Windows PC disk! 💾");
    } catch (e) {
      toast.error("Failed to export save file.");
    }
  };

  const handleImportSaveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const migrated = migrateState(parsed);
        setState(migrated);
        stateRef.current = migrated;
        toast.success("Loaded save game from Windows disk file! 📂");
      } catch (err) {
        toast.error("Invalid save file format.");
      }
    };
    reader.readAsText(file);
  };

  const handleCloudSave = () => {
    if (!isOnline) {
      // Local Storage / Disk save when offline
      try {
        const snapshot = JSON.stringify(state);
        localStorage.setItem("meadow_life_cloud_save_sync", snapshot);
        localStorage.setItem("meadow_life_cloud_backup_auto", snapshot);
        toast.warning("📶 Offline Mode: Game saved locally to disk backup!");
      } catch (e) {
        toast.error("Failed to save locally.");
      }
      return;
    }

    setState((prev) => {
      const next = structuredClone(prev);
      if (!next.cloudSave) next.cloudSave = { lastCloudSaveTimestamp: null, cloudStatus: "idle" };
      next.cloudSave.cloudStatus = "saving";
      return next;
    });

    setTimeout(() => {
      setState((prev) => {
        const next = structuredClone(prev);
        if (!next.cloudSave) next.cloudSave = { lastCloudSaveTimestamp: null, cloudStatus: "idle" };
        next.cloudSave.lastCloudSaveTimestamp = Date.now();
        next.cloudSave.cloudStatus = "synced";

        // Local Storage Automatic Backup
        try {
          const snapshot = JSON.stringify(next);
          localStorage.setItem("meadow_life_cloud_save_sync", snapshot);
          localStorage.setItem("meadow_life_cloud_backup_auto", snapshot);
        } catch (e) {
          console.warn("Local backup warning:", e);
        }

        toast.success("Cloud Save Synced & Local Windows Disk Backup Saved! 🌐💾");
        return next;
      });
    }, 500);
  };

  const countPlacedMachines = (s: GameState) => {
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

  const handleSaveGame = (customName?: string, existingSlotId?: string) => {
    const s = stateRef.current;
    const name = customName?.trim() || saveNameInput.trim() || `Meadow Works · Day ${s.day}`;
    const prepared = prepareStateForSave(s);
    const newSlot = {
      id: existingSlotId || `save_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      timestamp: Date.now(),
      day: s.day,
      time: s.time,
      season: s.season,
      coins: s.coins,
      energy: Math.round(s.energy),
      maxEnergy: s.maxEnergy,
      health: s.player.health,
      maxHealth: s.player.maxHealth,
      mineDepth: s.mineDepth,
      machinesCount: countPlacedMachines(s),
      data: prepared,
    };

    let updated = [];
    if (existingSlotId) {
      updated = saveSlots.map((slot) => (slot.id === existingSlotId ? newSlot : slot));
    } else {
      updated = [newSlot, ...saveSlots.filter((slot) => slot.id !== newSlot.id)];
    }

    try {
      localStorage.setItem("meadow_life_factorio_saves", JSON.stringify(updated));
      setSaveSlots(updated);
      setSaveNameInput("");
      setSaveLoadTab("load");
      toast.success(`Game saved as "${name}" successfully!`);
    } catch (err) {
      toast.error("Failed to save game to storage.");
    }
  };

  const handleLoadGame = (slot: (typeof saveSlots)[0]) => {
    try {
      const migrated = migrateState(slot.data);
      setState(migrated);
      stateRef.current = migrated;
      setSaveLoadOpen(false);
      toast.success(`Loaded "${slot.name}" successfully! (Day ${slot.day})`);
    } catch (err) {
      toast.error("Failed to load save data.");
    }
  };

  const handleDeleteSaveSlot = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saveSlots.filter((s) => s.id !== slotId);
    try {
      localStorage.setItem("meadow_life_factorio_saves", JSON.stringify(updated));
      setSaveSlots(updated);
      toast.success("Save deleted.");
    } catch (err) {
      toast.error("Failed to delete save.");
    }
  };

  // Zoning Mode
  const [zoningMode, setZoningMode] = useState<"none" | "farming" | "mining" | "woodcutting" | "water" | "erase">("none");
  const isDraggingZone = useRef(false);

  // Hovered item for tooltips inspection
  const [hoveredItem, setHoveredItem] = useState<Item | null>(null);

  const chargingToolRef = useRef<{ toolId: string; startTime: number; maxLevel: number } | null>(null);
  const actionHoldIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const joystickVectorRef = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false });
  const [joystickKnobPos, setJoystickKnobPos] = useState({ x: 0, y: 0 });
  const [mobileSprint, setMobileSprint] = useState(false);
  const [controlMode, setControlMode] = useState<"joystick" | "dpad">("joystick");
  const [mobileQuickMenuOpen, setMobileQuickMenuOpen] = useState(false);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const joystickTouchIdRef = useRef<number | null>(null);

  const startContinuousAction = () => {
    if (actionHoldIntervalRef.current) clearInterval(actionHoldIntervalRef.current);
    const doAction = () => {
      setState((prev) => {
        const next = structuredClone(prev);
        const act = interact(next, 1);
        if (act.particles.length > 0) particlesRef.current.push(...act.particles);
        if (act.message) toast(act.message);
        return next;
      });
    };
    doAction();
    actionHoldIntervalRef.current = setInterval(doAction, 180);
  };

  const stopContinuousAction = () => {
    if (actionHoldIntervalRef.current) {
      clearInterval(actionHoldIntervalRef.current);
      actionHoldIntervalRef.current = null;
    }
  };

  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    joystickTouchIdRef.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickCenterRef.current = { x: centerX, y: centerY };
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        resetJoystick();
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickCenterRef.current) return;
    const maxRadius = 42;
    const deltaX = clientX - joystickCenterRef.current.x;
    const deltaY = clientY - joystickCenterRef.current.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance === 0) {
      resetJoystick();
      return;
    }

    const clampedDist = Math.min(distance, maxRadius);
    const angle = Math.atan2(deltaY, deltaX);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setJoystickKnobPos({ x: knobX, y: knobY });

    const normalizedDist = clampedDist / maxRadius;
    const deadzone = 0.15;
    if (normalizedDist < deadzone) {
      joystickVectorRef.current = { dx: 0, dy: 0, active: false };
    } else {
      const moveAmount = (normalizedDist - deadzone) / (1 - deadzone);
      joystickVectorRef.current = {
        dx: Math.cos(angle) * moveAmount,
        dy: Math.sin(angle) * moveAmount,
        active: true,
      };
    }
  };

  const resetJoystick = () => {
    joystickTouchIdRef.current = null;
    joystickCenterRef.current = null;
    setJoystickKnobPos({ x: 0, y: 0 });
    joystickVectorRef.current = { dx: 0, dy: 0, active: false };
  };

  // Detect mobile device on mount
  useEffect(() => {
    const checkMobile = () => {
      const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
      setIsMobile(isTouch);
      setShowTouchControls(isTouch);
      if (window.innerWidth < 640) {
        setRadarExpanded(false); // compact radar by default on small mobile screens
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync isFullscreen with standard document events (e.g. Esc key exits fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      setCanvasSize(old => old.width === width && old.height === height ? old : { width, height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, []);

  const toggleFullscreen = async () => {
    const nextVal = !isFullscreen;
    setIsFullscreen(nextVal);
    if (!mainContainerRef.current) return;
    try {
      if (nextVal) {
        if (mainContainerRef.current.requestFullscreen) {
          await mainContainerRef.current.requestFullscreen();
        } else if ((mainContainerRef.current as any).webkitRequestFullscreen) {
          (mainContainerRef.current as any).webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.log("Fullscreen fallback to CSS full-viewport mode:", err);
    }
  };

  // Inventory holding slot
  const worldActive = useRef(true);
  worldActive.current = !inventoryOpen && !shopOpen && !chestOpenTile && !furnaceOpenTile && !factorioInspectorTile && !mailboxOpen && !chatOpen && !productionStatsOpen && !chartOpen && !graphicsSettingsOpen && !researchCenterOpen && !saveLoadOpen;
  const heldItem = getCursor(state);
  const skippedBuildClick = useRef(false);
  const cursorBadge = useRef<HTMLDivElement | null>(null);
  const cursorPosition = useRef({ x: 30, y: 100 });
  useEffect(() => {
    const follow = (event: PointerEvent) => {
      cursorPosition.current = { x: event.clientX, y: event.clientY };
      if (cursorBadge.current) cursorBadge.current.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 15}px)`;
    };
    window.addEventListener("pointermove", follow, { passive: true });
    return () => window.removeEventListener("pointermove", follow);
  }, []);
  const backpackHover = useRef<string | null>(null);

  // Spacebar trigger for Reel minigame
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const getMouseTileCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;
    const z = zoomRef.current || 1.0;
    const canvasX = (clickX * scaleX) / z;
    const canvasY = (clickY * scaleY) / z;

    const current = stateRef.current;
    const grid = current.inHouse ? current.houseGrid! : current.inMine ? current.mineGrid : current.tiles;
    const gridCols = grid[0]?.length ?? 0;
    const gridRows = grid.length;
    const { x: cameraX, y: cameraY } = getWorldCamera(current, canvasSize.width / z, canvasSize.height / z);

    const worldX = canvasX + cameraX;
    const worldY = canvasY + cameraY;

    const tileX = Math.floor(worldX / TILE);
    const tileY = Math.floor(worldY / TILE);

    return tileX >= 0 && tileY >= 0 && tileX < gridCols && tileY < gridRows ? { x: tileX, y: tileY } : null;
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x: tileX, y: tileY } = coords;

    const current = stateRef.current;
    const grid = current.inHouse ? current.houseGrid! : current.inMine ? current.mineGrid : current.tiles;
    const tile = grid[tileY]?.[tileX];
    if (canHandMine(current, coords)) return;
    if (tile?.buildPlan && !tile.placedItemId) {
      setState(prev => editTile(prev, coords, (_next, world) => { delete world[tileY][tileX].buildPlan; }));
      return;
    }
    if (tile?.paving && !tile.placedItemId && withinReach(current, coords)) {
      setState(prev => editTile(prev, coords, (next, world) => {
        const t = world[tileY][tileX];
        if (!t.paving || packStack(next.inventory, createItem(t.paving))) {
          toast.info("Make room in the backpack first.", { id: "build-issue" });
          return;
        }
        t.kind = t.pavingUnderlay ?? "grass";
        delete t.paving;
        delete t.pavingUnderlay;
      }));
      return;
    }
    if (tile?.placedItemId && tile.placedItemId !== "worker_cabin" && withinReach(current, coords)) {
      setState(prev => editTile(prev, coords, (next, activeGrid) => {
        if (!dismantleTile(next, activeGrid, tileX, tileY)) toast.warning("Make room in your inventory to dismantle this.");
      }));
      return;
    }

    // Check if right clicked on/near a worker or their cabin
    if (state.workers) {
      const clickedWorker = state.workers.find((w) => {
        const workerX = Math.floor(w.subX);
        const workerY = Math.floor(w.subY);

        const onWorker = (Math.abs(w.x - tileX) <= 1 && Math.abs(w.y - tileY) <= 1) ||
          (Math.abs(workerX - tileX) <= 1 && Math.abs(workerY - tileY) <= 1);
        const onCabin = Math.abs(w.cabinX - tileX) <= 1 && Math.abs(w.cabinY - tileY) <= 1;

        return onWorker || onCabin;
      });

      if (clickedWorker) {
        setSelectedWorkerId(clickedWorker.id);
      }
    }
  };

  // Global Keyboard Control Listener (Factorio Controls: WASD, Q, E, R, F, Space, 1-0, Shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" ||
          tag === "SELECT" && !(inventoryOpen && (key === "q" || (/^[0-9]$/.test(key) && backpackHover.current)))) return;
      pressedKeysRef.current.add(key);

      if (e.ctrlKey || e.metaKey || e.repeat) return;
      if (key === "q") {
        const current = stateRef.current;
        if (inventoryOpen || current.cursorStack || current.blueprint?.mode) {
          setState(prev => {
            const next = { ...prev, inventory: inventoryCopy(prev.inventory) };
            returnCursor(next);
            if (next.blueprint?.mode) next.blueprint = { ...next.blueprint, mode: null, startTile: null, currentTile: null };
            return next;
          });
        } else if (worldActive.current) {
          const pos = hoveredTileRef.current;
          setState(prev => {
            const grid = prev.inMine ? prev.mineGrid : prev.inHouse ? prev.houseGrid : prev.tiles;
            const tile = pos && grid?.[pos.y]?.[pos.x];
            const id = tile?.placedItemId ?? tile?.paving ?? tile?.buildPlan?.id ?? (tile?.kind.startsWith("ore_") ? "burner_drill" : undefined);
            if (!id) return prev;
            const next = { ...prev, inventory: inventoryCopy(prev.inventory) };
            selectById(next, id);
            return next;
          });
        }
      } else if (key === "m") {
        setChartOpen(open => !open);
      } else if (key === "b" && worldActive.current) {
        setState(prev => {
          const weapons = prev.inventory.filter(item => item && ["pistol", "submachine_gun", "shotgun", "combat_shotgun"].includes(item.id));
          if (!weapons.length) return prev;
          const index = weapons.findIndex(item => item?.id === equippedWeapon(prev).item?.id);
          const weapon = weapons[(index + 1) % weapons.length]!;
          toast.info(weapon.name, { id: "active-weapon", duration: 1000 });
          const next = { ...prev, inventory: inventoryCopy(prev.inventory), player: { ...prev.player, weaponId: weapon.id } };
          returnCursor(next);
          return next;
        });
      } else if (key === "e" || key === "i") {
        closeInventory(!inventoryOpen);
      } else if (key === "p") {
        setProductionStatsOpen((prev) => !prev);
      } else if (key === "h" && worldActive.current) {
        setAboutOpen((prev) => !prev);
      } else if (key === "r" && worldActive.current) {
        setState((prev) => {
          const dirs: ("right" | "down" | "left" | "up")[] = ["right", "down", "left", "up"];
          const currentIdx = dirs.indexOf(prev.placementDirection || "right");
          const turn = e.shiftKey ? 3 : 1;
          const nextDir = dirs[(currentIdx + turn) % dirs.length];
          if (!getCursor(prev) && hoveredTileRef.current && withinReach(prev, hoveredTileRef.current)) {
            const coords = hoveredTileRef.current;
            const grid = prev.inMine ? prev.mineGrid : prev.inHouse ? prev.houseGrid : prev.tiles;
            const tile = grid?.[coords.y]?.[coords.x];
            if (tile?.buildPlan || tile?.placedItemId && /belt|drill|inserter|loader|splitter/.test(tile.placedItemId)) {
              return editTile(prev, coords, (_next, targetGrid) => {
                const t = targetGrid[coords.y][coords.x];
                if (t.buildPlan) t.buildPlan.direction = dirs[(dirs.indexOf(t.buildPlan.direction) + turn) % dirs.length];
                else t.direction = dirs[(dirs.indexOf(t.direction ?? "right") + turn) % dirs.length];
              });
            }
          }
          return { ...prev, placementDirection: nextDir };
        });
      } else if (key === "f" && worldActive.current) {
        const current = stateRef.current;
        const count = pickupNearby(current);
        if (count) {
          refreshHud(tick => tick + 1);
          toast.success(`Picked up ${count} items`, { id: "field-items", duration: 1200 });
        }
      } else if (key === "z" && worldActive.current) {
        const pos = hoveredTileRef.current ?? frontTile(stateRef.current);
        if (!pos || !withinReach(stateRef.current, pos)) return;
        setState(prev => {
          const item = getCursor(prev);
          if (!item) return prev;
          return editTile(prev, pos, next => {
            if (placeLooseItem(next, pos, item.id)) consumeCursor(next);
          });
        });
      } else if (key === "alt") {
        e.preventDefault();
        setState((prev) => {
          const nextAlt = !prev.altMode;
          toast(`Machine overlay: ${nextAlt ? "ENABLED (Recipe & Info Overlay On) 🔍" : "DISABLED ❌"}`);
          return { ...prev, altMode: nextAlt };
        });
      } else if (/^[0-9]$/.test(key)) {
        const index = key === "0" ? 9 : Number(key) - 1;
        if (inventoryOpen && backpackHover.current) {
          const id = backpackHover.current;
          setState(prev => ({ ...prev, quickbar: prev.quickbar.map((filter, slot) => slot === index ? id : filter) }));
        } else if (worldActive.current) {
          onQuickbar(index);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.delete(key);

    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [inventoryOpen]);

  // Synchronize state changes to parent (save handler)
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Start background ambient music on mount
  useEffect(() => {
    gameAudio.startMusic();
    return () => gameAudio.stopMusic();
  }, []);

  // Animation Frame Loop for Canvas, Particle System, and Animal Slides
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();
    let lastDraw = 0;
    let lastRadar = 0;
    let lastPickup = 0;
    let lastMine = 0;
    let sampleAt = lastTime;
    let rendered = 0;
    let updated = 0;
    let worst = 0;
    let raf = 0;

    const loop = (now: number) => {
      const frameMs = now - lastTime;
      const dt = Math.min(frameMs / 1000, 0.08);
      worst = Math.max(worst, frameMs);
      lastTime = now;

      const cur = stateRef.current;

      // Continuous Vector Player Movement (Keyboard & Virtual Touch Joystick)
      let dx = 0;
      let dy = 0;
      if (joystickVectorRef.current.active) {
        dx = joystickVectorRef.current.dx;
        dy = joystickVectorRef.current.dy;
      } else {
        const keys = pressedKeysRef.current;
        if (keys.size > 0) {
          if (keys.has("w") || keys.has("arrowup")) dy -= 1;
          if (keys.has("s") || keys.has("arrowdown")) dy += 1;
          if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
          if (keys.has("d") || keys.has("arrowright")) dx += 1;

          if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
          }
        }
      }

      const grid = cur.inHouse ? cur.houseGrid! : (cur.inMine ? cur.mineGrid : cur.tiles);
      const rows = grid.length;
      const cols = grid[0]?.length || 0;
      const p = cur.player;

      if (p.subX === undefined) p.subX = p.x;
      if (p.subY === undefined) p.subY = p.y;

      if ((dx !== 0 || dy !== 0) && worldActive.current && cur.harvestLiftingTimer <= 0) {
        const isShift = pressedKeysRef.current.has("shift") || mobileSprint;
        stepPlayer(cur, dx, dy, isShift, dt);

        // Sprint boot running dust particles
        if (isShift && Math.random() < 0.28) {
          particlesRef.current.push({
            x: p.subX * TILE + 16 + (Math.random() * 8 - 4),
            y: p.subY * TILE + 28,
            vx: -dx * 18 + (Math.random() * 8 - 4),
            vy: -dy * 18 - Math.random() * 8,
            color: "#a08c70",
            age: 0,
            maxAge: 0.26,
            type: "smoke"
          });
        }

        // Biome Discovery Banner Trigger
        if (!cur.inMine && !cur.inHouse) {
          const currentBiome = getBiomeAt(p.x, p.y);
          if (currentBiome.kind !== lastBiomeKindRef.current) {
            lastBiomeKindRef.current = currentBiome.kind;
            setBiomeBanner({
              name: currentBiome.name,
              nameBn: currentBiome.nameBn,
              subtitle: currentBiome.subtitle,
            });
            if (gameAudio.playDiscovery) gameAudio.playDiscovery();
            setTimeout(() => {
              setBiomeBanner(prev => (prev?.name === currentBiome.name ? null : prev));
            }, 4500);
          }
        }

        // Rustle sway and particles when walking through crops or weeds
        const stepTile = grid[p.y]?.[p.x];
        if (stepTile && (stepTile.cropId || stepTile.kind === "debris_weed")) {
          const nowMs = performance.now();
          if (!stepTile.lastRustleTime || nowMs - stepTile.lastRustleTime > 250) {
            stepTile.lastRustleTime = nowMs;
            const pColor = stepTile.kind === "debris_weed" ? "#2ecc71" : (CROPS[stepTile.cropId!]?.accent || "#2ecc71");
            const px = p.x * TILE + 16;
            const py = p.y * TILE + 24;
            for (let i = 0; i < 2; i++) {
              particlesRef.current.push({
                x: px + (Math.random() * 12 - 6),
                y: py - (Math.random() * 8),
                vx: (Math.random() * 2 - 1) * 25,
                vy: -Math.random() * 30 - 15,
                color: pColor,
                age: 0,
                maxAge: 0.35 + Math.random() * 0.15,
                type: "leaf"
              });
            }
          }
        }

        // Smooth Zone Transitions (House, Shop, Mines) without costly React state clones
        if (cur.inHouse && p.x === 5 && p.y === 9) {
          cur.inHouse = false;
          p.x = 15; p.y = 29; p.subX = 15; p.subY = 29;
          toast("Exited Farm House");
          setState(prev => ({ ...prev, inHouse: false, player: { ...prev.player, x: 15, y: 29, subX: 15, subY: 29 } }));
        } else if (!cur.inHouse && !cur.inMine && p.x === 15 && p.y === 28) {
          cur.inHouse = true;
          p.x = 5; p.y = 8; p.subX = 5; p.subY = 8;
          toast("Entered Farm House");
          setState(prev => ({ ...prev, inHouse: true, player: { ...prev.player, x: 5, y: 8, subX: 5, subY: 8 } }));
        } else if (!cur.inHouse && !cur.inMine && p.x === 70 && p.y === 40) {
          if (!shopOpen) setShopOpen(true);
        } else if (cur.inMine && grid[p.y]?.[p.x]?.kind === "mine_ladder" && p.x === 3 && p.y === 3) {
          cur.inMine = false;
          cur.mineDepth = 0;
          p.x = 72; p.y = 8; p.subX = 72; p.subY = 8;
          toast("Exited the mines.");
          setState(prev => ({ ...prev, inMine: false, mineDepth: 0, player: { ...prev.player, x: 72, y: 8, subX: 72, subY: 8 } }));
        } else if (cur.inMine && grid[p.y]?.[p.x]?.kind === "mine_ladder" && (p.x !== 3 || p.y !== 3)) {
          cur.mineDepth += 1;
          const f = generateMineFloor(cur.mineDepth);
          cur.mineGrid = f.grid;
          cur.mineEnemies = f.enemies;
          p.x = 3; p.y = 3; p.subX = 3; p.subY = 3;
          toast.success(`Descended to mine floor ${cur.mineDepth}!`);
          setState(prev => ({ ...prev, mineDepth: cur.mineDepth, mineGrid: f.grid, mineEnemies: f.enemies, player: { ...prev.player, x: 3, y: 3, subX: 3, subY: 3 } }));
        } else if (!cur.inMine && !cur.inHouse && grid[p.y]?.[p.x]?.kind === "mine_cave") {
          cur.inMine = true;
          cur.mineDepth = 1;
          const f = generateMineFloor(1);
          cur.mineGrid = f.grid;
          cur.mineEnemies = f.enemies;
          p.x = 3; p.y = 3; p.subX = 3; p.subY = 3;
          toast.success("Entered the mines. Watch out for slimes!");
          setState(prev => ({ ...prev, inMine: true, mineDepth: 1, mineGrid: f.grid, mineEnemies: f.enemies, player: { ...prev.player, x: 3, y: 3, subX: 3, subY: 3 } }));
        }
      }

      if (dx === 0 && dy === 0 || !worldActive.current || cur.harvestLiftingTimer > 0) {
        p.walkSeconds = 0;
        if (worldActive.current) stepPlayer(cur, 0, 0, false, dt, false);
      }

      if (worldActive.current && pressedKeysRef.current.has("f") && now - lastPickup > 130) {
        lastPickup = now;
        pickupNearby(cur);
      }
      if (worldActive.current && miningHold.current && now - lastMine > 260) {
        lastMine = now;
        const target = hoveredTileRef.current;
        if (target && canHandMine(cur, target)) mineTile(target);
      }
      if (worldActive.current && pressedKeysRef.current.has(" ") && getCursor(cur)?.type !== "tool") {
        if (firePlayerWeapon(cur, hoveredTileRef.current)) gameAudio.playDischarge();
      }

      // High Performance Throttled Entity & Machine Updates (10 Ticks / sec)
      if (!lastEntityTickRef.current) lastEntityTickRef.current = now;
      const machineStep = 1 / 20;
      if (now - lastEntityTickRef.current > 250) lastEntityTickRef.current = now - 250;
      while (now - lastEntityTickRef.current >= machineStep * 1000) {
        updateEntities(cur, machineStep);
        updated++;
        lastEntityTickRef.current += machineStep * 1000;
      }

      if (cur.animals) {
        cur.animals.forEach((animal) => {
          if (!animal) return;
          if (animal.subX === undefined) animal.subX = animal.x;
          if (animal.subY === undefined) animal.subY = animal.y;
          animal.subX += (animal.x - animal.subX) * 0.15;
          animal.subY += (animal.y - animal.subY) * 0.15;
        });
      }

      if (cur.pets) {
        cur.pets.forEach((pet) => {
          if (!pet) return;
          if (pet.subX === undefined) pet.subX = pet.x;
          if (pet.subY === undefined) pet.subY = pet.y;
          pet.subX += (pet.x - pet.subX) * 0.15;
          pet.subY += (pet.y - pet.subY) * 0.15;
        });
      }

      if (cur.workers) {
        cur.workers.forEach((worker) => {
          if (!worker) return;
          if (worker.subX === undefined) worker.subX = worker.x;
          if (worker.subY === undefined) worker.subY = worker.y;
          worker.subX += (worker.x - worker.subX) * 0.15;
          worker.subY += (worker.y - worker.subY) * 0.15;
        });
      }

      if (cur.harvestLiftingTimer > 0) {
        cur.harvestLiftingTimer = Math.max(0, cur.harvestLiftingTimer - dt);
        if (cur.harvestLiftingTimer <= 0) {
          cur.carryItem = null;
        }
      }

      // Throttled Ambient Particle Spawning (12 Ticks / sec)
      if (!lastParticleTickRef.current) lastParticleTickRef.current = now;
      if (cur.settings?.particleDensity !== "low" && now - lastParticleTickRef.current >= 110) {
        lastParticleTickRef.current = now;

        const currentGrid = stateRef.current.inMine ? stateRef.current.mineGrid : stateRef.current.tiles;
        if (currentGrid && currentGrid.length > 0) {
          const p = stateRef.current.player;
          const pSubX = p.subX !== undefined ? p.subX : p.x;
          const pSubY = p.subY !== undefined ? p.subY : p.y;

          const inBld = stateRef.current.inMine || stateRef.current.inHouse;
          const curCols = currentGrid[0]?.length || COLS;
          const curRows = currentGrid.length || ROWS;

          const cameraX = inBld
            ? Math.max(0, Math.min(curCols * TILE - canvasSize.width, pSubX * TILE + 16 - canvasSize.width / 2))
            : pSubX * TILE + 16 - canvasSize.width / 2;

          const cameraY = inBld
            ? Math.max(0, Math.min(curRows * TILE - canvasSize.height, pSubY * TILE + 16 - canvasSize.height / 2))
            : pSubY * TILE + 16 - canvasSize.height / 2;

          const startCol = Math.max(0, Math.floor(cameraX / TILE));
          const endCol = Math.min(curCols, Math.ceil((cameraX + canvasSize.width) / TILE));
          const startRow = Math.max(0, Math.floor(cameraY / TILE));
          const endRow = Math.min(curRows, Math.ceil((cameraY + canvasSize.height) / TILE));

          for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
              const t = currentGrid[y]?.[x];
              if (!t) continue;

              // Ambient tree leaves
              if (t.kind === "tree" && Math.random() < 0.02) {
                particlesRef.current.push({
                  x: x * TILE + 16 + (Math.random() * 20 - 10),
                  y: y * TILE + 4 + (Math.random() * 8 - 4),
                  vx: -15 - Math.random() * 20,
                  vy: 20 + Math.random() * 15,
                  color: Math.random() < 0.2 ? "#e67e22" : Math.random() < 0.1 ? "#f1c40f" : "#2ecc71",
                  age: 0,
                  maxAge: 1.8 + Math.random() * 1,
                  type: "leaf"
                });
              }

              // Active sprinkler water spray
              if (t.kind === "placed_item" && (t.placedItemId === "sprinkler_basic" || t.placedItemId === "sprinkler_quality")) {
                const isQuality = t.placedItemId === "sprinkler_quality";
                if (Math.random() < 0.35) {
                  const directions = isQuality ? 8 : 4;
                  const angleOffset = (Date.now() / 180) % (Math.PI * 2);
                  for (let d = 0; d < directions; d++) {
                    const angle = angleOffset + (d * (Math.PI * 2)) / directions;
                    const speed = 40 + Math.random() * 25;
                    particlesRef.current.push({
                      x: x * TILE + 16,
                      y: y * TILE + 8,
                      vx: Math.cos(angle) * speed,
                      vy: Math.sin(angle) * speed - 15,
                      color: "rgba(52, 152, 219, 0.75)",
                      age: 0,
                      maxAge: 0.35 + Math.random() * 0.15,
                      type: "water"
                    });
                  }
                }
              }

              // Chimney smoke
              if (t.kind === "house" && Math.random() < 0.15) {
                if ((x === 16 && y === 24) || (x === 72 && y === 32)) {
                  particlesRef.current.push({
                    x: x * TILE + 14,
                    y: y * TILE - 8,
                    vx: 5 + Math.random() * 8,
                    vy: -25 - Math.random() * 15,
                    color: "rgba(220, 220, 220, 0.35)",
                    age: 0,
                    maxAge: 1.5 + Math.random() * 0.5,
                    type: "smoke"
                  });
                }
              }

              // Worker cabin chimney smoke
              if (t.kind === "placed_item" && t.placedItemId === "worker_cabin" && Math.random() < 0.15) {
                particlesRef.current.push({
                  x: x * TILE + 16,
                  y: y * TILE - 4,
                  vx: 4 + Math.random() * 6,
                  vy: -20 - Math.random() * 10,
                  color: "rgba(220, 220, 220, 0.3)",
                  age: 0,
                  maxAge: 1.4 + Math.random() * 0.4,
                  type: "smoke"
                });
              }
            }
          }

          // Falling Rain weather particles
          if (stateRef.current.weather === "rainy" && Math.random() < 0.5) {
            for (let i = 0; i < 3; i++) {
              particlesRef.current.push({
                x: cameraX + Math.random() * canvasSize.width,
                y: cameraY - 10,
                vx: -35 - Math.random() * 15,
                vy: 320 + Math.random() * 80,
                color: "rgba(174, 214, 241, 0.45)",
                age: 0,
                maxAge: 1.2,
                type: "water"
              });
            }
          }

          // Biome Environmental Atmosphere Particles (Spawn around player viewport)
          if (!inBld) {
            const playerBiome = getBiomeAt(Math.floor(pSubX), Math.floor(pSubY));
            const phase = getTimePhase(stateRef.current.time);

            // Swamp Bioluminescent Fireflies at dusk/night
            if (playerBiome.kind === "swamp" && phase !== "morning" && Math.random() < 0.45) {
              particlesRef.current.push({
                x: (pSubX + (Math.random() * 24 - 12)) * TILE,
                y: (pSubY + (Math.random() * 18 - 9)) * TILE,
                vx: (Math.random() * 2 - 1) * 8,
                vy: -8 - Math.random() * 10,
                color: Math.random() < 0.5 ? "#d4f040" : "#a8e030",
                age: 0,
                maxAge: 2.5 + Math.random() * 1.5,
                type: "spark",
              });
            }

            // Frosted Mountain Peak Snow Flurries
            if (playerBiome.kind === "mountain" && playerBiome.name.includes("Frosted") && Math.random() < 0.60) {
              particlesRef.current.push({
                x: (pSubX + (Math.random() * 28 - 14)) * TILE,
                y: (pSubY - 10) * TILE,
                vx: -18 - Math.random() * 22,
                vy: 22 + Math.random() * 18,
                color: "#f0f8ff",
                age: 0,
                maxAge: 1.8 + Math.random() * 1.0,
                type: "spark",
              });
            }

            // Badlands Desert Wind Dust
            if (playerBiome.kind === "badlands" && Math.random() < 0.35) {
              particlesRef.current.push({
                x: (pSubX + (Math.random() * 24 - 12)) * TILE,
                y: (pSubY + (Math.random() * 16 - 8)) * TILE,
                vx: 18 + Math.random() * 15,
                vy: -4 + (Math.random() * 6 - 3),
                color: "#d38258",
                age: 0,
                maxAge: 1.4 + Math.random() * 0.8,
                type: "smoke",
              });
            }
          }
        }
      }

      // Update particles with custom behavior
      particlesRef.current = particlesRef.current
        .map((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.type === "leaf") {
            // Swaying leaf movement
            p.vx += Math.sin(p.age * 6) * 15 * dt;
            p.vy = 25 + Math.sin(p.age * 3) * 5; // slow drift
          } else if (p.type === "smoke") {
            // Smoke drifts upward, no gravity, slightly sways
            p.vx += Math.sin(p.age * 4) * 8 * dt;
          } else if (p.type === "water" && p.vy > 100) {
            // Rain drops fall fast without gravity acceleration
          } else {
            p.vy += 200 * dt; // gravity
          }
          p.age += dt;
          return p;
        })
        .filter((p) => p.age < p.maxAge);

      // Update floating texts
      floatingTextsRef.current = floatingTextsRef.current
        .map((ft) => {
          ft.y -= 30 * dt; // drift upward
          ft.age += dt;
          return ft;
        })
        .filter((ft) => ft.age < ft.maxAge);

      // Update Fishing reel minigame physics
      const curState = stateRef.current;
      if (curState.fishing && curState.fishing.status === "reeling") {
        setState((prev) => {
          if (!prev.fishing) return prev;
          const next = { ...prev, fishing: { ...prev.fishing }, inventory: inventoryCopy(prev.inventory), skills: { ...prev.skills }, experience: { ...prev.experience } };
          updateFishingPhysics(next.fishing!, isSpacePressed, dt);

          if (next.fishing!.status === "success") {
            const size = next.fishing!.caughtSize || 10;
            const fishId = next.fishing!.fishId;
            const fishDef = FISH_TYPES[fishId];
            const fishObj = createItem(fishId, 1);

            const success = addItem(next.inventory, fishObj);
            gameAudio.playLevelUp();

            // Exp gain
            next.experience.fishing += 20;
            const targetXp = (next.skills.fishing + 1) * 100;
            let lvlMsg = "";
            if (next.experience.fishing >= targetXp) {
              next.skills.fishing += 1;
              lvlMsg = ` Fishing Level up! (Lv.${next.skills.fishing})`;
            }

            toast.success(`You caught a ${fishDef.name}! (${size} in)${lvlMsg}`);
            next.fishing = undefined;
          } else if (next.fishing!.status === "fail") {
            toast.error("The fish got away...");
            next.fishing = undefined;
          }
          return next;
        });
      }

      const limit = cur.settings?.fpsLimit ?? 60;
      const interval = limit ? 1000 / limit : 0;
      if (now - sampleAt >= 1000) {
        if (cur.settings?.showFpsOverlay) {
          setRealFps(Math.round(rendered * 1000 / (now - sampleAt)));
          setRealUps(Math.round(updated * 1000 / (now - sampleAt)));
          setRealFrameTime(Math.round(worst * 10) / 10);
        }
        sampleAt = now;
        rendered = 0;
        updated = 0;
        worst = 0;
      }
      if (interval && now - lastDraw < interval - .6) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastDraw = interval && lastDraw && now - lastDraw < interval * 2 ? now - ((now - lastDraw) % interval) : now;
      rendered++;

      // Render and simulation run independently of the selected frame limit.
      draw(ctx, stateRef.current, canvasSize.width, canvasSize.height, hoveredTileRef.current, zoomRef.current);

      // Draw particle overlay
      ctx.save();
      const z = zoomRef.current || 1.0;
      ctx.scale(z, z);
      const effectiveW = canvasSize.width / z;
      const effectiveH = canvasSize.height / z;

      const { x: cameraX, y: cameraY } = getWorldCamera(stateRef.current, effectiveW, effectiveH);
      ctx.translate(-cameraX, -cameraY);

      // Draw Particles
      particlesRef.current.forEach((p) => {
        if (p.type === "heart") {
          // Draw little heart shapes
          ctx.fillStyle = p.color;
          ctx.font = "8px monospace";
          ctx.fillText("❤️", p.x - 3, p.y);
        } else if (p.type === "leaf") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.age * 5 + (p.x * 0.1)); // rotate as it falls
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "smoke") {
          const ratio = p.age / p.maxAge;
          const radius = 3 + ratio * 8; // expand from 3px to 11px
          const alpha = Math.max(0, 0.4 - ratio * 0.4); // fade out
          ctx.fillStyle = `rgba(220, 220, 220, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "water") {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); // soft round droplet
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
      });

      // Draw Floating Texts
      floatingTextsRef.current.forEach((ft) => {
        ctx.fillStyle = ft.color;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
      });

      if (chargingToolRef.current) {
        const chargingPlayer = curState.player;
        const ppx = (chargingPlayer.subX !== undefined ? chargingPlayer.subX : chargingPlayer.x) * TILE + 16;
        const ppy = (chargingPlayer.subY !== undefined ? chargingPlayer.subY : chargingPlayer.y) * TILE - 8;

        const duration = Date.now() - chargingToolRef.current.startTime;
        const maxLvl = chargingToolRef.current.maxLevel;
        const currentLvl = Math.min(maxLvl, Math.floor(duration / 500) + 1);
        const levelProgress = (duration % 500) / 500;

        ctx.save();
        ctx.beginPath();
        ctx.arc(ppx, ppy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        const colors = ["#e74c3c", "#f39c12", "#3498db", "#f1c40f"];
        ctx.strokeStyle = colors[currentLvl - 1] || "#f1c40f";
        ctx.lineWidth = 3;
        const endAngle = (duration >= (maxLvl - 1) * 500) ? Math.PI * 2 : (levelProgress * Math.PI * 2);
        ctx.arc(ppx, ppy, 8, -Math.PI / 2, -Math.PI / 2 + endAngle);
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`L${currentLvl}`, ppx, ppy);
        ctx.restore();
      }

      // Draw Fishing Minigame HUD overlay on screen if reeling
      if (curState.fishing && curState.fishing.status === "reeling") {
        ctx.restore();
        ctx.save();

        const HUD_X = canvasSize.width - 164;
        const HUD_Y = Math.max(40, canvasSize.height / 2 - 120);
        const HUD_W = 40;
        const HUD_H = 240;

        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(HUD_X - 10, HUD_Y - 10, HUD_W + 40, HUD_H + 20);

        ctx.fillStyle = "#34495e";
        ctx.fillRect(HUD_X, HUD_Y, HUD_W - 15, HUD_H);

        const barSizePct = 16;
        const fState = curState.fishing;
        const barSizePx = (barSizePct / 100) * HUD_H;
        const barYPx = HUD_Y + HUD_H - ((fState.barY + barSizePct) / 100) * HUD_H;

        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(HUD_X + 1, barYPx, HUD_W - 17, barSizePx);

        const fishYPx = HUD_Y + HUD_H - (fState.fishY / 100) * HUD_H;
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.arc(HUD_X + (HUD_W - 15) / 2, fishYPx, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(HUD_X + HUD_W, HUD_Y, 10, HUD_H);
        ctx.fillStyle = "#f1c40f";
        const progHPx = (fState.progress / 100) * HUD_H;
        ctx.fillRect(HUD_X + HUD_W, HUD_Y + HUD_H - progHPx, 10, progHPx);

        ctx.restore();
      } else {
        ctx.restore();
      }

      // Draw minimap on minimap canvas
      const miniCanvas = minimapRef.current;
      if (miniCanvas && now - lastRadar >= 150) {
        lastRadar = now;
        drawChart(miniCanvas, cur, "radar", false, customWaypoints);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isSpacePressed, canvasSize]);

  // Slime enemy AI movements (runs in Mine every 1.5 seconds)
  useEffect(() => {
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.inMine || cur.mineEnemies.length === 0) return;

      setState((prev) => {
        const next = structuredClone(prev);
        const player = next.player;

        next.mineEnemies.forEach((enemy) => {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;

          let sx = enemy.x;
          let sy = enemy.y;

          if (Math.abs(dx) >= Math.abs(dy)) {
            sx += dx > 0 ? 1 : -1;
          } else {
            sy += dy > 0 ? 1 : -1;
          }

          if (isWalkable(next.mineGrid[sy][sx])) {
            enemy.x = sx;
            enemy.y = sy;
          }

          if (enemy.x === player.x && enemy.y === player.y) {
            gameAudio.playHit();
            player.health -= enemy.damage;

            floatingTextsRef.current.push({
              x: player.x * TILE + 16,
              y: player.y * TILE - 8,
              text: `-${enemy.damage} HP`,
              color: "#e74c3c",
              age: 0,
              maxAge: 0.8,
            });

            if (player.health <= 0) {
              toast.error("You collapsed from exhaustion!");
              sleep(next);
              next.inMine = false;
              next.mineGrid = [];
              next.mineEnemies = [];
              player.x = STATIC_POINTS.playerSpawn.x;
              player.y = STATIC_POINTS.playerSpawn.y;
              const penalty = Math.min(200, Math.floor(next.coins * 0.1));
              next.coins -= penalty;

              setSleepSummary(next.dailyEarnings || null);
              toast.error(`Lewis found you collapsed in the mines. (-${penalty}g)`);
            }
          }
        });

        return next;
      });
    }, 1500);

    return () => clearInterval(id);
  }, []);

  // Animal Wandering AI updates (Runs every 3 seconds - Shallow update, no tile cloning)
  useEffect(() => {
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.animals || cur.animals.length === 0) return;

      setState((prev) => {
        if (!prev.animals || prev.animals.length === 0) return prev;
        const grid = prev.inMine ? prev.mineGrid : prev.tiles;
        const rows = grid.length;
        const cols = grid[0]?.length || 0;

        let changed = false;
        const newAnimals = prev.animals.map((animal) => {
          if (!animal) return animal;
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          const choice = dirs[Math.floor(Math.random() * dirs.length)];
          const nx = animal.x + choice[1];
          const ny = animal.y + choice[0];

          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < cols &&
            ny < rows &&
            isWalkable(grid[ny][nx])
          ) {
            changed = true;
            return { ...animal, x: nx, y: ny };
          }
          return animal;
        });

        if (!changed) return prev;
        return { ...prev, animals: newAnimals };
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  // Time Ticks and Auto-Watering Rainy day notifications (Microsecond shallow updates)
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const dayEnded = prev.time + 10 >= 24 * 60;
        if (dayEnded) {
          const next = structuredClone(prev);
          sleep(next);
          setSleepSummary(next.dailyEarnings || null);
          toast.success(`Day ${next.day} begins!`);
          return next;
        } else {
          return {
            ...prev,
            time: prev.time + 10,
          };
        }
      });
    }, TIME_TICK_MS);

    return () => clearInterval(id);
  }, []);

  // Keyboard Controller
  useEffect(() => {
    let lastMove = 0;

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;

      // "/" opens the cheat console regardless of other state (only block if already in INPUT/TEXTAREA)
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && !chatOpen) {
        e.preventDefault();
        setChatOpen(true);
        setTimeout(() => chatInputRef.current?.focus(), 50);
        return;
      }

      if (e.ctrlKey || e.metaKey || tag === "INPUT" || tag === "TEXTAREA" || inventoryOpen || shopOpen || chestOpenTile || mailboxOpen || chatOpen) return;

      const curState = stateRef.current;

      // Freeze movement when harvesting carrying crop
      if (curState.harvestLiftingTimer > 0) return;


      // Space uses the selected item.
      if (e.code === "Space" && worldActive.current) {
        e.preventDefault();

        const held = getCursor(curState);

        if (held && held.id === "fishing_rod" && !curState.inMine) {
          setIsSpacePressed(true);
          setState((prev) => {
            const next = structuredClone(prev);
            const f = frontTile(next);
            if (!f) return next;

            const t = next.tiles[f.y][f.x];
            if (t.kind === "water" && !next.fishing) {
              next.fishing = initFishing(next.player.dir);
              next.fishing.bobberX = f.x;
              next.fishing.bobberY = f.y;
              next.fishing.status = "waiting";
              next.fishing.waitTimer = Math.random() * 4 + 2;
              gameAudio.playWater();
              toast("Line cast! Waiting for a bite...");
            } else if (next.fishing && next.fishing.status === "nibble") {
              next.fishing.status = "reeling";
              const fKeys = Object.keys(FISH_TYPES);
              const fishChoice = fKeys[Math.floor(Math.random() * fKeys.length)];
              next.fishing.fishId = fishChoice;
              next.fishing.progress = 35;
              gameAudio.playLevelUp();
              toast("FISH HOOKED! Keep the green bar on the fish.");
            } else if (next.fishing) {
              next.fishing = undefined;
              toast("Reeled in empty line.");
            }
            return next;
          });
          return;
        }

        if (!held || held.type !== "tool") {
          if (!e.repeat && firePlayerWeapon(curState, hoveredTileRef.current)) gameAudio.playDischarge();
          return;
        }
        if (e.repeat) return;

        // Charged tools logic: Hoe and Watering Can
        if (held && (held.id === "hoe" || held.id === "watering_can")) {
          const tId = held.id === "watering_can" ? "watering" : "hoe";
          const maxLevel = curState.upgrades[tId] || 1;
          if (maxLevel > 1) {
            if (!chargingToolRef.current) {
              chargingToolRef.current = {
                toolId: held.id,
                startTime: Date.now(),
                maxLevel: maxLevel
              };
              setIsSpacePressed(true);
            }
            return;
          }
        }

        setIsSpacePressed(true);
        const targetCoords = hoveredTileRef.current || frontTile(curState);
        if (!targetCoords || !withinReach(curState, targetCoords)) return;
        setState(prev => editTile(prev, targetCoords, next => {
          const act = interact(next, 1, targetCoords);

          if (act.particles.length > 0) {
            particlesRef.current = [...particlesRef.current, ...act.particles];
          }

          if (act.message) {
            toast(act.message);
            floatingTextsRef.current.push({
              x: targetCoords.x * TILE + 16,
              y: targetCoords.y * TILE - 8,
              text: act.message,
              color: "#f1c40f",
              age: 0,
              maxAge: 0.8,
            });
          }
        }));
      }
      // Dialogue talk / Machine Interact
      else if (k === "enter") {
        e.preventDefault();
        const f = frontTile(curState);
        if (!f) return;

        // Check Animal petting
        const facingAnimal = curState.animals.find((a) => a.x === f.x && a.y === f.y);
        if (facingAnimal) {
          setState((prev) => {
            const next = structuredClone(prev);
            const a = next.animals.find((x) => x.id === facingAnimal.id);
            if (a) {
              a.petCount += 1;
              gameAudio.playLevelUp();
              toast.success(`You petted ${a.name}! ❤️`);

              for (let i = 0; i < 5; i++) {
                particlesRef.current.push({
                  x: a.x * TILE + 16,
                  y: a.y * TILE + 16,
                  vx: (Math.random() * 2 - 1) * 30,
                  vy: -Math.random() * 40 - 15,
                  color: "#ff3366",
                  age: 0,
                  maxAge: 0.5,
                  type: "heart",
                });
              }
            }
            return next;
          });
          return;
        }

        // Check Pet petting
        const facingPet = curState.pets?.find((p) => p.x === f.x && p.y === f.y);
        if (facingPet) {
          setState((prev) => {
            const next = structuredClone(prev);
            if (!next.pets) next.pets = [];
            const p = next.pets.find((x) => x.id === facingPet.id);
            if (p) {
              if (!p.pettedToday) {
                p.pettedToday = true;
                p.friendship = Math.min(1000, p.friendship + 10);
                gameAudio.playLevelUp();
                toast.success(`You petted ${p.name}! ❤️`);

                for (let i = 0; i < 5; i++) {
                  particlesRef.current.push({
                    x: p.x * TILE + 16,
                    y: p.y * TILE + 16,
                    vx: (Math.random() * 2 - 1) * 30,
                    vy: -Math.random() * 40 - 15,
                    color: "#ff3366",
                    age: 0,
                    maxAge: 0.5,
                    type: "heart",
                  });
                }
              } else {
                toast(`You already petted ${p.name} today.`);
              }
            }
            return next;
          });
          return;
        }

        // Check Hired Worker interaction
        const facingWorker = curState.workers?.find((w) => w.x === f.x && w.y === f.y);
        if (facingWorker) {
          setSelectedWorkerId(facingWorker.id);
          return;
        }

        // Check NPCs schedules
        let foundNpc: NPCDef | null = null;
        let foundNpcId = "";

        Object.keys(NPCS).forEach((id) => {
          const target = getNPCDestination(id, curState.time);
          if (target.x === f.x && target.y === f.y) {
            foundNpc = NPCS[id];
            foundNpcId = id;
          }
        });

        const grid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
        const facingTile = grid[f.y]?.[f.x];

        if (foundNpc) {
          const lines = (foundNpc as NPCDef).defaultDialogue;
          const choice = lines[Math.floor(Math.random() * lines.length)];
          setNpcDialogue({ npcId: foundNpcId, dialogue: choice });
        } else if (facingTile) {
          if (facingTile.kind === "shop") {
            setShopOpen(true);
          } else if (facingTile.kind === "house_bed") {
            setSleepConfirmOpen(true);
          } else if (facingTile.kind === "placed_item" && (facingTile.placedItemId === "furnace" || facingTile.placedItemId === "stone_furnace" || facingTile.placedItemId === "steel_furnace" || facingTile.placedItemId === "electric_furnace")) {
            setFurnaceOpenTile({ x: f.x, y: f.y });
          } else if (facingTile.kind === "placed_item" && (facingTile.placedItemId?.startsWith("assembling_machine") || facingTile.placedItemId === "chemical_plant" || facingTile.placedItemId === "burner_drill" || facingTile.placedItemId === "electric_drill" || facingTile.placedItemId === "science_lab" || facingTile.placedItemId === "generator" || facingTile.placedItemId === "boiler" || facingTile.placedItemId === "solar_panel" || facingTile.placedItemId === "battery" || facingTile.placedItemId === "power_pole")) {
            setFactorioInspectorTile({ x: f.x, y: f.y });
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "player_store") {
            setPlayerStoreTile({ x: f.x, y: f.y });
            setPlayerStoreTab("buy");
            setPlayerStoreOpen(true);
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "research_center") {
            setResearchCenterOpen(true);
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "mailbox") {
            setMailboxOpen(true);
          } else if (facingTile.kind === "placed_item" && (facingTile.placedItemId === "chest" || facingTile.placedItemId === "iron_chest" || facingTile.placedItemId === "steel_chest" || facingTile.placedItemId === "logistics_chest" || facingTile.placedItemId === "worker_cabin")) {
            setChestOpenTile({ x: f.x, y: f.y });
          } else if (!curState.inMine && !curState.inHouse && f.x === 18 && f.y === 29) {
            setShippingBinOpen(true);
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "chicken_egg") {
            // Collect Chicken Egg
            setState((prev) => {
              const next = structuredClone(prev);
              const nextGrid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
              const egg = createItem("chicken_egg", 1);
              const success = addItem(next.inventory, egg);
              if (success) {
                nextGrid[f.y][f.x].kind = next.inHouse ? "house_floor" : (next.inMine ? "mine_dirt" : "grass");
                nextGrid[f.y][f.x].placedItemId = undefined;
                toast.success("Collected a Chicken Egg! 🥚");
                gameAudio.playCoin();
              } else {
                toast.error("Inventory full!");
              }
              return next;
            });
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "Space") {
        setIsSpacePressed(false);

        if (chargingToolRef.current) {
          const charging = chargingToolRef.current;
          const duration = Date.now() - charging.startTime;
          const chargeLevel = Math.min(charging.maxLevel, Math.floor(duration / 500) + 1);

          setState((prev) => {
            const next = structuredClone(prev);
            const targetCoords = hoveredTileRef.current || frontTile(next);
            if (!targetCoords || !withinReach(next, targetCoords)) return prev;
            const act = interact(next, chargeLevel, targetCoords);

            if (act.particles.length > 0) {
              particlesRef.current = [...particlesRef.current, ...act.particles];
            }

            if (act.message) {
              toast(act.message);
              floatingTextsRef.current.push({
                x: targetCoords.x * TILE + 16,
                y: targetCoords.y * TILE - 8,
                text: act.message,
                color: "#f1c40f",
                age: 0,
                maxAge: 0.8,
              });
            }
            return next;
          });

          chargingToolRef.current = null;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [inventoryOpen, shopOpen, chestOpenTile, mailboxOpen, chatOpen]);

  // Periodic Fishing Nibble tracker ticks
  useEffect(() => {
    const fInterval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.fishing || cur.fishing.status !== "waiting") return;

      setState((prev) => {
        if (!prev.fishing || prev.fishing.status !== "waiting") return prev;
        const next = structuredClone(prev);
        const fState = next.fishing!;

        fState.waitTimer -= 0.5;
        if (fState.waitTimer <= 0) {
          fState.status = "nibble";
          fState.nibbleTimer = 1.5;
          gameAudio.playWater();
        }

        return next;
      });
    }, 500);

    return () => clearInterval(fInterval);
  }, []);

  // Fishing Nibble timer countdown ticks
  useEffect(() => {
    const fInterval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.fishing || cur.fishing.status !== "nibble") return;

      setState((prev) => {
        if (!prev.fishing || prev.fishing.status !== "nibble") return prev;
        const next = structuredClone(prev);
        const fState = next.fishing!;

        fState.nibbleTimer -= 0.1;
        if (fState.nibbleTimer <= 0) {
          fState.status = "idle";
          next.fishing = undefined;
          toast.error("The fish got away...");
        }

        return next;
      });
    }, 100);

    return () => clearInterval(fInterval);
  }, []);

  // Crafting Queue Progress Tick
  useEffect(() => {
    const queueInterval = setInterval(() => {
      if (!stateRef.current.handcraftQueue?.length) return;
      setState(prev => {
        const [active, ...remaining] = prev.handcraftQueue ?? [];
        if (!active) return prev;
        const seconds = Math.max(0, active.remainingTime - .1);
        if (seconds > .000001) {
          const progress = Math.round((1 - seconds / active.duration) * 100);
          return { ...prev, handcraftQueue: [{ ...active, remainingTime: seconds, progress }, ...remaining] };
        }
        const inventory = inventoryCopy(prev.inventory);
        for (const output of active.outputs) {
          const stack = createItem(output.itemId, output.count);
          if (!addItem(inventory, stack)) inventory.push(stack);
        }
        toast.success(`Crafted ${active.name}`, { id: "workbench-complete" });
        gameAudio.playCoin();
        return { ...prev, inventory, handcraftQueue: remaining };
      });
    }, 100);

    return () => clearInterval(queueInterval);
  }, []);

  const handleConfirmSleep = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      sleep(next);
      next.inHouse = true;
      next.player.x = 3;
      next.player.y = 2;
      next.player.subX = 3;
      next.player.subY = 2;
      next.player.dir = "down";
      setSleepSummary(next.dailyEarnings || { items: [], total: 0 });
      return next;
    });
    setSleepConfirmOpen(false);
  };

  const getGlobalStorageItems = (gameState: GameState): Item[] => {
    const items: Item[] = [];
    const grids = [gameState.tiles, gameState.houseGrid, gameState.mineGrid].filter(Boolean) as Tile[][][];
    for (const grid of grids) {
      for (const row of grid) {
        for (const tile of row) {
          if (tile.kind === "placed_item" && tile.placedItemId === "chest" && tile.chestInventory) {
            tile.chestInventory.forEach(itm => {
              if (itm) {
                const existing = items.find(i => i.id === itm.id);
                if (existing) existing.count += itm.count;
                else items.push({ ...itm });
              }
            });
          }
        }
      }
    }
    return items;
  };

  const checkGlobalItems = (gameState: GameState, itemId: string, count: number): boolean => {
    if (hasItems(gameState.inventory, itemId, count)) return true;
    const globalItems = getGlobalStorageItems(gameState);
    const globalItem = globalItems.find(i => i.id === itemId);
    const personalCount = gameState.inventory.filter(i => i?.id === itemId).reduce((a, b) => a + (b?.count || 0), 0);
    return personalCount + (globalItem?.count || 0) >= count;
  };

  const maxCraftable = (s: GameState, recipe: Recipe) => {
    let low = 0;
    let high = 50;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (planHandcraft(s, recipe, mid).canCraft) low = mid;
      else high = mid - 1;
    }
    return low;
  };

  const handleStartCrafting = (recipe: Recipe, multiplier: number = 1, isShift: boolean = false) => {
    const isFree = state.freeCraft || state.godMode;
    if (!isFree && recipe.techRequired && !(state.unlockedTechs || []).includes(recipe.techRequired)) {
      const tech = TECHNOLOGIES.find((t) => t.id === recipe.techRequired);
      toast.error(`🔒 Research "${tech?.name || recipe.techRequired}" at the Research Center first!`);
      return;
    }

    let craftCount = multiplier;
    if (isShift) {
      craftCount = Math.max(1, maxCraftable(state, recipe));
    }

    const plan = planHandcraft(state, recipe, craftCount);
    if (!plan.canCraft) {
      const missingNames = plan.missingItems.map(m => `${ITEM_DEFS[m.itemId]?.name || m.itemId} (need ${m.need}, have ${m.has})`).join(", ");
      toast.error(`Missing ingredients: ${missingNames}`);
      return;
    }

    const itemDef = ITEM_DEFS[recipe.outputId];
    const id = `${recipe.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setState(prev => {
      const job = planHandcraft(prev, recipe, craftCount);
      if (!job.canCraft) return prev;
      const inventory = inventoryCopy(prev.inventory);
      for (const input of job.inputs) deductItems(inventory, input.itemId, input.count);
      return { ...prev, inventory, handcraftQueue: [...prev.handcraftQueue ?? [], {
        id,
        recipeId: recipe.id,
        name: craftCount > 1 ? `${recipe.name} ×${craftCount}` : recipe.name,
        iconSymbol: itemDef?.iconSymbol || "⚙",
        iconColor: itemDef?.iconColor || "#94a3b8",
        progress: 0,
        duration: job.seconds,
        remainingTime: job.seconds,
        refundInputs: job.inputs,
        outputs: job.outputs,
      }] };
    });
    toast.info(`Queued ${craftCount} × ${recipe.name}${plan.intermediates ? ` (+${plan.intermediates} intermediate crafts)` : ""}`, { id: "workbench-queued" });
  };

  const handleCancelQueuedCraft = (index: number) => {
    setState(prev => {
      const job = prev.handcraftQueue?.[index];
      if (!job) return prev;
      const inventory = inventoryCopy(prev.inventory);
      for (const input of job.refundInputs) {
        const stack = createItem(input.itemId, input.count);
        if (!addItem(inventory, stack)) inventory.push(stack);
      }
      toast.info(`Cancelled ${job.name} and refunded materials.`, { id: "workbench-cancelled" });
      return { ...prev, inventory, handcraftQueue: prev.handcraftQueue!.filter((_, position) => position !== index) };
    });
  };

  const withinReach = (current: GameState, coords: { x: number; y: number }) =>
    Math.hypot(coords.x - current.player.x, coords.y - current.player.y) <= (current.player.reachDistance ?? 8);

  const canHandMine = (current: GameState, pos: { x: number; y: number }) => {
    if (!withinReach(current, pos)) return false;
    const tile = (current.inMine ? current.mineGrid : current.inHouse ? current.houseGrid : current.tiles)?.[pos.y]?.[pos.x];
    const tool = getCursor(current)?.id;
    return Boolean(tile && (tool === "pickaxe" && (tile.kind.startsWith("ore_") || tile.kind === "debris_stone")
      || tool === "axe" && (tile.kind === "tree" || tile.kind === "debris_branch")));
  };

  const mineTile = (pos: { x: number; y: number }) => {
    setState(prev => {
      if (!canHandMine(prev, pos)) return prev;
      return editTile(prev, pos, next => {
        const result = interact(next, 1, pos);
        particlesRef.current.push(...result.particles);
        if (result.message) toast(result.message, { id: "mining-result", duration: 1000 });
      });
    });
  };

  // Copy the affected row and inventory to avoid cloning the entire world while dragging belts.
  const editTile = (current: GameState, coords: { x: number; y: number }, edit: (next: GameState, grid: Tile[][]) => void) => {
    const zone = current.inMine ? "mineGrid" : current.inHouse ? "houseGrid" : "tiles";
    const grid = current[zone]!.slice();
    grid[coords.y] = grid[coords.y].slice();
    if (!grid[coords.y]?.[coords.x]) return current;
    grid[coords.y][coords.x] = structuredClone(grid[coords.y][coords.x]);
    const next = {
      ...current, [zone]: grid, inventory: inventoryCopy(current.inventory), player: { ...current.player },
      experience: { ...current.experience }, skills: { ...current.skills }, quest: current.quest && { ...current.quest },
    };
    edit(next, grid);
    return next;
  };

  const layBelt = (coords: { x: number; y: number }, report = false) => {
    setState(prev => {
      const held = getCursor(prev);
      const grid = prev.inHouse ? prev.houseGrid! : prev.inMine ? prev.mineGrid : prev.tiles;
      const tile = grid[coords.y]?.[coords.x];
      if (!held || (!isConveyor(held.id) && held.id !== "stone_wall" && !isTerrainItem(held.id)) || !tile) return prev;
      const issue = getPlacementIssue(prev, tile, held.id, coords);
      if (issue) {
        if (report) toast.info(issue, { id: "build-issue", duration: 1100 });
        return prev;
      }
      return editTile(prev, coords, next => { interact(next, 1, coords); });
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    hoveredTileRef.current = coords;
    const last = beltDrag.current;
    if (last && (e.buttons & 1) && coords && (last.x !== coords.x || last.y !== coords.y)) {
      const dx = coords.x - last.x;
      const dy = coords.y - last.y;
      const steps = Math.min(28, Math.max(Math.abs(dx), Math.abs(dy)));
      let previous = last;
      for (let i = 1; i <= steps; i++) {
        const position = { x: last.x + Math.round(dx * i / steps), y: last.y + Math.round(dy * i / steps) };
        if (previous.x !== position.x && previous.y !== position.y) layBelt({ x: position.x, y: previous.y });
        layBelt(position);
        previous = position;
      }
      beltDrag.current = coords;
    }

    if (zoningMode !== "none" && isDraggingZone.current && coords) {
      const curState = stateRef.current;
      const grid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
      const targetZone = zoningMode === "erase" ? undefined : zoningMode;

      if (grid[coords.y]?.[coords.x] && grid[coords.y][coords.x].zone !== targetZone) {
        setState(prev => {
          const next = structuredClone(prev);
          const gridNext = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
          if (gridNext[coords.y]?.[coords.x]) {
            gridNext[coords.y][coords.x].zone = targetZone;
          }
          return next;
        });
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = getMouseTileCoords(e.clientX, e.clientY);
    if (e.button === 2 && pointer && canHandMine(stateRef.current, pointer)) {
      hoveredTileRef.current = pointer;
      miningHold.current = true;
      mineTile(pointer);
      return;
    }
    if (e.button === 0) {
      skippedBuildClick.current = false;
      const current = stateRef.current;
      const coords = getMouseTileCoords(e.clientX, e.clientY);
      const held = getCursor(current);
      const activeGrid = current.inMine ? current.mineGrid : current.inHouse ? current.houseGrid : current.tiles;
      const pointed = coords && activeGrid?.[coords.y]?.[coords.x];
      if (e.shiftKey && coords && pointed?.structureHp !== undefined && withinReach(current, coords) && (!held || held.id === "repair_pack")) {
        setState(prev => editTile(prev, coords, (next, grid) => {
          const tile = grid[coords.y][coords.x];
          if (tile.structureHp === undefined) return;
          if (getCursor(next)?.id === "repair_pack") {
            tile.structureHp = undefined;
            consumeCursor(next);
            return;
          }
          const slot = next.inventory.findIndex(item => item?.id === "repair_pack");
          if (slot < 0) {
            toast.info("A repair pack is needed.", { id: "repair-needed" });
            return;
          }
          tile.structureHp = undefined;
          removeItem(next.inventory, slot);
          toast.success("Structure repaired.", { id: "repair-complete" });
        }));
        return;
      }
      if (e.shiftKey && !e.ctrlKey && coords && pointed && isBuildableItem(held) && !current.blueprint?.mode) {
        setState(prev => editTile(prev, coords, (next, grid) => {
          const tile = grid[coords.y][coords.x];
          if (getFactoryPlacementIssue(tile, held.id)) return;
          tile.buildPlan = { id: held.id, direction: next.placementDirection ?? "right" };
        }));
        return;
      }
      if (e.ctrlKey && coords && withinReach(current, coords)) {
        setState(prev => editTile(prev, coords, (next, grid) => {
          const tile = grid[coords.y][coords.x];
          const load = tile.placedItemId === "gun_turret" ? loadDefenseAmmo : fuelMachine;
          const cursor = getCursor(next);
          const staged = cursor ? [{ ...cursor }] : [];
          const fromCursor = cursor ? load(tile, staged) : 0;
          for (let i = 0; i < fromCursor; i++) consumeCursor(next);
          const loaded = fromCursor || load(tile, next.inventory);
          if (loaded > 0) toast.success(`Loaded ${loaded} ${tile.placedItemId === "gun_turret" ? "rounds" : "fuel"}.`);
          else toast.info(tile.placedItemId === "gun_turret" ? "Ammo slot full or no compatible ammunition." : "Fuel slot full or no compatible fuel.");
        }));
        return;
      }
      if (zoningMode === "none" && !current.blueprint?.mode && held && (isConveyor(held.id) || held.id === "stone_wall" || isTerrainItem(held.id)) && coords) {
        beltDrag.current = coords;
        skippedBuildClick.current = true;
        layBelt(coords, true);
        return;
      }
      if (zoningMode !== "none") {
        isDraggingZone.current = true;
        const coords = getMouseTileCoords(e.clientX, e.clientY);
        if (coords) {
          const curState = stateRef.current;
          const grid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
          const targetZone = zoningMode === "erase" ? undefined : zoningMode;

          if (grid[coords.y]?.[coords.x] && grid[coords.y][coords.x].zone !== targetZone) {
            setState(prev => {
              const next = structuredClone(prev);
              const gridNext = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
              if (gridNext[coords.y]?.[coords.x]) {
                gridNext[coords.y][coords.x].zone = targetZone;
              }
              return next;
            });
          }
        }
      }
    }
  };

  const handleCanvasMouseUp = () => {
    miningHold.current = false;
    beltDrag.current = null;
    isDraggingZone.current = false;
    stopContinuousAction();
  };

  const handleCanvasMouseLeave = () => {
    miningHold.current = false;
    beltDrag.current = null;
    hoveredTileRef.current = null;
    isDraggingZone.current = false;
    stopContinuousAction();
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(2.0, parseFloat((z + 0.15).toFixed(2))));
    } else {
      setZoom((z) => Math.max(0.5, parseFloat((z - 0.15).toFixed(2))));
    }
  };

  const handleTileInteraction = (coords: { x: number; y: number }) => {
    const curState = stateRef.current;
    if (!curState) return;

    // Handle Factorio Blueprint Copy / Stamp / Deconstruct Click Logic
    if (curState.blueprint && curState.blueprint.mode) {
      const mode = curState.blueprint.mode;
      const bp = curState.blueprint;

      if (mode === "copy") {
        if (!bp.startTile) {
          setState((prev) => ({
            ...prev,
            blueprint: { ...(prev.blueprint || { mode: "copy" }), mode: "copy", startTile: coords, currentTile: coords },
          }));
          toast.info(`Blueprint Copy Start set at (${coords.x}, ${coords.y}). Click end tile!`);
        } else {
          const start = bp.startTile;
          const minX = Math.min(start.x, coords.x);
          const maxX = Math.max(start.x, coords.x);
          const minY = Math.min(start.y, coords.y);
          const maxY = Math.max(start.y, coords.y);

          const curGrid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
          const saved: NonNullable<NonNullable<GameState["blueprint"]>["savedEntities"]> = [];

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const tile = curGrid[y][x];
              if (tile.kind === "placed_item" && tile.placedItemId) {
                saved.push({
                  relX: x - minX,
                  relY: y - minY,
                  placedItemId: tile.placedItemId,
                  direction: tile.direction,
                  recipeId: tile.assemblerRecipeId,
                });
              }
            }
          }

          if (saved.length > 0) {
            setState((prev) => ({
              ...prev,
              blueprint: { mode: "stamp", startTile: null, currentTile: null, savedEntities: saved },
            }));
            toast.success(`📋 Blueprint Copied ${saved.length} entities! Choose the top-left tile to build it!`);
          } else {
            toast.warning("No placed factory entities found in selected rectangle.");
            setState((prev) => ({ ...prev, blueprint: { mode: null, startTile: null, currentTile: null, savedEntities: [] } }));
          }
        }
        return;
      } else if (mode === "deconstruct") {
        if (!bp.startTile) {
          setState((prev) => ({
            ...prev,
            blueprint: { ...(prev.blueprint || { mode: "deconstruct" }), mode: "deconstruct", startTile: coords, currentTile: coords },
          }));
          toast.info(`Deconstruction Start set at (${coords.x}, ${coords.y}). Click end tile!`);
        } else {
          const start = bp.startTile;
          const minX = Math.min(start.x, coords.x);
          const maxX = Math.max(start.x, coords.x);
          const minY = Math.min(start.y, coords.y);
          const maxY = Math.max(start.y, coords.y);

          setState(prev => {
            const next = structuredClone(prev);
            const grid = next.inHouse ? next.houseGrid! : next.inMine ? next.mineGrid : next.tiles;
            let count = 0;
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                if (withinReach(next, { x, y }) && dismantleTile(next, grid, x, y)) count++;
              }
            }
            next.blueprint = { mode: null, startTile: null, currentTile: null, savedEntities: prev.blueprint?.savedEntities || [] };
            toast.info(count ? `Dismantled ${count} entities.` : "No machines dismantled. Check reach and inventory space.", { id: "blueprint-dismantle" });
            return next;
          });
        }
        return;
      } else if (mode === "stamp" && bp.savedEntities && bp.savedEntities.length > 0) {
        setState(prev => {
          const next = structuredClone(prev);
          const grid = next.inHouse ? next.houseGrid! : next.inMine ? next.mineGrid : next.tiles;
          const originalDirection = next.placementDirection;
          let placedCount = 0;

          for (const ent of bp.savedEntities!) {
            const position = { x: coords.x + ent.relX, y: coords.y + ent.relY };
            const target = grid[position.y]?.[position.x];
            const slot = next.inventory.findIndex(item => item?.id === ent.placedItemId);
            if (slot < 0 || !target || !withinReach(next, position) || getFactoryPlacementIssue(target, ent.placedItemId)) continue;
            next.placementDirection = ent.direction;
            interact(next, 1, position, slot);
            if (target.placedItemId === ent.placedItemId) {
              if (ent.recipeId) target.assemblerRecipeId = ent.recipeId;
              placedCount++;
            }
          }

          next.placementDirection = originalDirection;
          next.blueprint = { ...prev.blueprint, mode: null };
          toast.info(`Built ${placedCount} / ${bp.savedEntities!.length} blueprint entities. Check materials and reach for incomplete placements.`, { id: "blueprint-placement" });
          return next;
        });
        return;
      }
    }

    if (!withinReach(curState, coords)) {
      toast.error("Target tile is out of reach!");
      return;
    }

    const grid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
    const tile = grid[coords.y]?.[coords.x];
    const held = getCursor(curState);
    if (tile && (held?.type === "seed" || isBuildableItem(held))) {
      setState(prev => editTile(prev, coords, next => {
        const result = interact(next, 1, coords);
        if (result.message && !result.message.startsWith("Placed ")) toast.info(result.message, { id: "build-issue", duration: 1100 });
      }));
      return;
    }

    const clickedAnimal = curState.animals.find((a) => a.x === coords.x && a.y === coords.y);
    const clickedPet = curState.pets?.find((pt) => pt.x === coords.x && pt.y === coords.y);
    const clickedWorker = curState.workers?.find((w) => w.x === coords.x && w.y === coords.y);

    let clickedNpc: NPCDef | null = null;
    let clickedNpcId = "";
    Object.keys(NPCS).forEach((id) => {
      const target = getNPCDestination(id, curState.time);
      if (target.x === coords.x && target.y === coords.y) {
        clickedNpc = NPCS[id];
        clickedNpcId = id;
      }
    });

    const isInteractive = tile && (
      tile.kind === "shop" ||
      tile.kind === "house_bed" ||
      (tile.kind === "placed_item" && (
        tile.placedItemId === "furnace" ||
        tile.placedItemId === "stone_furnace" ||
        tile.placedItemId === "steel_furnace" ||
        tile.placedItemId === "electric_furnace" ||
        tile.placedItemId?.startsWith("assembling_machine") ||
        tile.placedItemId === "chemical_plant" ||
        tile.placedItemId === "burner_drill" ||
        tile.placedItemId === "electric_drill" ||
        tile.placedItemId === "science_lab" ||
        tile.placedItemId === "generator" ||
        tile.placedItemId === "boiler" ||
        tile.placedItemId === "solar_panel" ||
        tile.placedItemId === "battery" ||
        tile.placedItemId === "power_pole" ||
        tile.placedItemId === "rocket_silo" ||
        tile.placedItemId === "chest" ||
        tile.placedItemId === "iron_chest" ||
        tile.placedItemId === "steel_chest" ||
        tile.placedItemId === "logistics_chest" ||
        tile.placedItemId === "water_tank" ||
        tile.placedItemId === "mailbox" ||
        tile.placedItemId === "worker_cabin" ||
        tile.placedItemId === "chicken_egg"
      )) ||
      (!curState.inMine && !curState.inHouse && coords.x === 18 && coords.y === 29)
    );

    const hasEntity = clickedAnimal || clickedPet || clickedWorker || clickedNpc;
    const isTool = held && (held.type === "tool" || held.id === "fishing_rod");

    if ((isInteractive || hasEntity) && (!isTool || tile?.kind === "placed_item")) {
      if (clickedAnimal) {
        setState((prev) => {
          const next = structuredClone(prev);
          const a = next.animals.find((x) => x.id === clickedAnimal.id);
          if (a) {
            a.petCount += 1;
            gameAudio.playLevelUp();
            toast.success(`You petted ${a.name}! ❤️`);
            for (let i = 0; i < 5; i++) {
              particlesRef.current.push({
                x: a.x * TILE + 16,
                y: a.y * TILE + 16,
                vx: (Math.random() * 2 - 1) * 30,
                vy: -Math.random() * 40 - 15,
                color: "#ff3366",
                age: 0,
                maxAge: 0.5,
                type: "heart",
              });
            }
          }
          return next;
        });
      } else if (clickedPet) {
        setState((prev) => {
          const next = structuredClone(prev);
          if (!next.pets) next.pets = [];
          const pt = next.pets.find((x) => x.id === clickedPet.id);
          if (pt) {
            if (!pt.pettedToday) {
              pt.pettedToday = true;
              pt.friendship = Math.min(1000, pt.friendship + 10);
              gameAudio.playLevelUp();
              toast.success(`You petted ${pt.name}! ❤️`);
              for (let i = 0; i < 5; i++) {
                particlesRef.current.push({
                  x: pt.x * TILE + 16,
                  y: pt.y * TILE + 16,
                  vx: (Math.random() * 2 - 1) * 30,
                  vy: -Math.random() * 40 - 15,
                  color: "#ff3366",
                  age: 0,
                  maxAge: 0.5,
                  type: "heart",
                });
              }
            } else {
              toast(`You already petted ${pt.name} today.`);
            }
          }
          return next;
        });
      } else if (clickedWorker) {
        setSelectedWorkerId(clickedWorker.id);
      } else if (clickedNpc) {
        const lines = (clickedNpc as NPCDef).defaultDialogue;
        const choice = lines[Math.floor(Math.random() * lines.length)];
        setNpcDialogue({ npcId: clickedNpcId, dialogue: choice });
      } else if (tile) {
        if (tile.kind === "shop") {
          setShopOpen(true);
        } else if (tile.kind === "house_bed") {
          setSleepConfirmOpen(true);
        } else if (tile.kind === "placed_item" && (tile.placedItemId === "furnace" || tile.placedItemId === "stone_furnace" || tile.placedItemId === "steel_furnace" || tile.placedItemId === "electric_furnace")) {
          setFurnaceOpenTile({ x: coords.x, y: coords.y });
        } else if (tile.kind === "placed_item" && (tile.placedItemId?.startsWith("assembling_machine") || tile.placedItemId === "chemical_plant" || tile.placedItemId === "burner_drill" || tile.placedItemId === "electric_drill" || tile.placedItemId === "science_lab" || tile.placedItemId === "generator" || tile.placedItemId === "boiler" || tile.placedItemId === "solar_panel" || tile.placedItemId === "battery" || tile.placedItemId === "power_pole")) {
          setFactorioInspectorTile({ x: coords.x, y: coords.y });
        } else if (tile.kind === "placed_item" && tile.placedItemId === "mailbox") {
          setMailboxOpen(true);
        } else if (tile.kind === "placed_item" && (tile.placedItemId === "chest" || tile.placedItemId === "iron_chest" || tile.placedItemId === "steel_chest" || tile.placedItemId === "logistics_chest" ||
          tile.placedItemId === "water_tank" || tile.placedItemId === "worker_cabin")) {
          setChestOpenTile({ x: coords.x, y: coords.y });
        } else if (!curState.inMine && !curState.inHouse && coords.x === 18 && coords.y === 29) {
          setShippingBinOpen(true);
        } else if (tile.kind === "placed_item" && tile.placedItemId === "chicken_egg") {
          setState((prev) => {
            const next = structuredClone(prev);
            const nextGrid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
            const egg = createItem("chicken_egg", 1);
            const success = addItem(next.inventory, egg);
            if (success) {
              nextGrid[coords.y][coords.x].kind = next.inHouse ? "house_floor" : (next.inMine ? "mine_dirt" : "grass");
              nextGrid[coords.y][coords.x].placedItemId = undefined;
              toast.success("Collected a Chicken Egg! 🥚");
              gameAudio.playCoin();
            } else {
              toast.error("Inventory full!");
            }
            return next;
          });
        }
      }
    } else {
      setState(prev => editTile(prev, coords, next => {
        const act = interact(next, 1, coords);
        if (act.particles.length > 0) {
          particlesRef.current = [...particlesRef.current, ...act.particles];
        }
        if (act.message) {
          toast(act.message);
          floatingTextsRef.current.push({
            x: coords.x * TILE + 16,
            y: coords.y * TILE - 8,
            text: act.message,
            color: "#f1c40f",
            age: 0,
            maxAge: 0.8,
          });
        }
      }));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (zoningMode !== "none" || e.ctrlKey || e.shiftKey) return;
    if (skippedBuildClick.current) {
      skippedBuildClick.current = false;
      return;
    }
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    if (coords) handleTileInteraction(coords);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getMouseTileCoords(touch.clientX, touch.clientY);
      if (coords) {
        e.preventDefault();
        handleTileInteraction(coords);
      }
    }
  };

  // Sleep summary close handler
  const handleCloseSleepSummary = () => {
    setSleepSummary(null);
    setState((prev) => {
      const next = structuredClone(prev);
      next.dailyEarnings = undefined;
      return next;
    });
  };

  const closeInventory = (open: boolean) => {
    backpackHover.current = null;
    setInventoryOpen(open);
  };

  const onQuickbar = (index: number, split = false) => {
    setState(prev => {
      if (!prev.quickbar[index] && prev.cursorStack && !split) {
        return { ...prev, hotbarIndex: index, cursorRefill: true,
          quickbar: prev.quickbar.map((id, slot) => slot === index ? prev.cursorStack!.id : id) };
      }
      const next = { ...prev, inventory: inventoryCopy(prev.inventory) };
      selectQuickbar(next, index, split);
      return next;
    });
  };

  type SlotSource = "inventory" | "chest" | "shipping" | "furnace";
  const machineSlot = () => furnaceOpenTile ?? factorioInspectorTile ?? chestOpenTile;

  const useSlot = (index: number, source: SlotSource, split: boolean, quickTransfer: boolean) => {
    setState(prev => {
      const change = (next: GameState, slots: (Item | null)[], tile?: Tile) => {
        if (quickTransfer && tile?.chestInventory) {
          const fromPlayer = source === "inventory";
          const origin = fromPlayer ? next.inventory : slots;
          const target = fromPlayer ? tile.chestInventory : next.inventory;
          const item = origin[index];
          if (!item) return;
          const remaining = packStack(target, item, fromPlayer ? slot => acceptsManualSlot(tile, slot, item) : undefined);
          origin[index] = remaining ? { ...item, count: remaining } : null;
          return;
        }
        const cursor = getCursor(next);
        const accepts = !tile || source === "inventory" || !cursor || acceptsManualSlot(tile, index, cursor);
        if (!accepts) toast.info("This slot doesn't accept that item.", { id: "slot-rule", duration: 1200 });
        cursorSlotClick(next, slots, index, split, accepts);
      };
      const pos = machineSlot();
      if (pos && (source === "chest" || source === "furnace" || source === "inventory" && quickTransfer)) {
        return editTile(prev, pos, (next, grid) => {
          const tile = grid[pos.y][pos.x];
          const slots = source === "inventory" ? next.inventory : tile.chestInventory;
          if (slots) change(next, slots, tile);
        });
      }
      if (source !== "inventory" && source !== "shipping") return prev;
      const next = { ...prev, inventory: inventoryCopy(prev.inventory), shippingBin: inventoryCopy(prev.shippingBin) };
      change(next, source === "inventory" ? next.inventory : next.shippingBin);
      return next;
    });
  };

  const handleSlotClick = (index: number, source: SlotSource, e?: React.MouseEvent) =>
    useSlot(index, source, false, Boolean(e?.shiftKey));

  // Claim Mail Letters attached gifts
  const handleClaimMailGift = (letterId: string) => {
    setState((prev) => {
      const next = structuredClone(prev);
      const letter = next.mailboxLetters.find((l) => l.id === letterId);

      if (letter && !letter.claimed && letter.giftItemId) {
        const itemObj = createItem(letter.giftItemId, letter.giftCount || 1);
        const success = addItem(next.inventory, itemObj);

        if (success) {
          letter.claimed = true;
          toast.success(`Claimed ${itemObj.name} x${itemObj.count}!`);
          gameAudio.playCoin();

          // Check if all letters read
          const allClaimed = next.mailboxLetters.every((l) => l.claimed || !l.giftItemId);
          if (allClaimed) {
            next.hasUnreadMail = false;
          }

          // Update readings
          setReadingLetter({ ...letter, claimed: true });
        } else {
          toast.error("Inventory full! Clear slots first.");
        }
      }
      return next;
    });
  };

  const handleSortInventory = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      next.inventory = sortInventory(next.inventory);
      toast.success("Bag inventory sorted!");
      return next;
    });
  };

  const handleSortChest = () => {
    if (!chestOpenTile) return;
    setState((prev) => {
      const next = structuredClone(prev);
      const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
      const chestTile = grid[chestOpenTile.y][chestOpenTile.x];
      if (chestTile.chestInventory) {
        chestTile.chestInventory = sortInventory(chestTile.chestInventory);
        toast.success("Chest inventory sorted!");
      }
      return next;
    });
  };

  const handleQuickStack = () => {
    if (!chestOpenTile) return;
    setState((prev) => {
      const next = structuredClone(prev);
      const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
      const chestTile = grid[chestOpenTile.y][chestOpenTile.x];
      if (chestTile.chestInventory) {
        const moved = quickStackToChest(next.inventory, chestTile.chestInventory);
        if (moved) {
          toast.success("Matching stacks transferred to chest!");
          gameAudio.playCoin();
        } else {
          toast.info("No matching stacks to transfer.");
        }
      }
      return next;
    });
  };

  const handleSlotRightClick = (event: React.MouseEvent, index: number, source: SlotSource) => {
    event.preventDefault();
    useSlot(index, source, true, false);
  };

  // Give item to NPC
  const handleGiveGift = () => {
    if (!npcDialogue) return;
    const npcId = npcDialogue.npcId;
    const held = getCursor(state);

    if (!held) {
      toast.error("You aren't holding any items!");
      return;
    }

    const react = giftReaction(npcId, held.id);

    setState((prev) => {
      const next = structuredClone(prev);
      consumeCursor(next);
      next.npcFriendships[npcId] = (next.npcFriendships[npcId] || 0) + react.points;
      setNpcDialogue({ npcId, dialogue: `[Gift: ${held.name}] — ${react.dialogue}` });
      return next;
    });

    gameAudio.playCoin();
  };

  // Shop purchase
  const handleBuy = (itemId: string, unitPrice: number, quantity: number = 1) => {
    const totalPrice = unitPrice * quantity;
    if (state.coins < totalPrice) {
      toast.error("Not enough coins!");
      return;
    }
    const item = createItem(itemId, quantity);
    setState((prev) => {
      const next = structuredClone(prev);
      const success = addItem(next.inventory, item);
      if (success) {
        next.coins -= totalPrice;
        toast.success(`Bought ${quantity}x ${item.name}! (-${totalPrice}g)`);
      } else {
        toast.error("Inventory full!");
      }
      return next;
    });
    gameAudio.playCoin();
  };

  const handleSellAllItems = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      let totalSold = 0;
      let totalGained = 0;

      for (let i = 0; i < next.inventory.length; i++) {
        const item = next.inventory[i];
        if (item && item.price > 0) {
          totalSold += item.count;
          totalGained += item.price * item.count;
          next.inventory[i] = null;
        }
      }

      if (totalSold > 0) {
        next.coins += totalGained;
        toast.success(`Sold all ${totalSold} items for +${totalGained}g!`);
        gameAudio.playCoin();
      } else {
        toast.error("No sellable items in inventory.");
      }
      return next;
    });
  };

  const handleSellAllCrops = () => {
    handleSellAllItems();
  };

  const getUpgradeCost = (toolId: "hoe" | "watering" | "scythe" | "pickaxe" | "axe", currentLvl: number) => {
    if (currentLvl === 1) {
      return { coins: 2000, resourceId: "copper_bar", resourceCount: 5, label: "5x Copper Bar + 2,000g" };
    } else if (currentLvl === 2) {
      return { coins: 5000, resourceId: "iron_bar", resourceCount: 5, label: "5x Iron Bar + 5,000g" };
    } else if (currentLvl === 3) {
      return { coins: 10000, resourceId: "gold_bar", resourceCount: 5, label: "5x Gold Bar + 10,000g" };
    }
    return null;
  };

  const handleUpgrade = (toolId: "hoe" | "watering" | "scythe" | "pickaxe" | "axe") => {
    const lvl = state.upgrades[toolId];
    if (lvl >= 4) {
      toast.error("Tool is already at maximum level.");
      return;
    }

    const cost = getUpgradeCost(toolId, lvl);
    if (!cost) return;

    if (state.coins < cost.coins) {
      toast.error(`Need ${cost.coins}g to upgrade!`);
      return;
    }

    if (!hasItems(state.inventory, cost.resourceId, cost.resourceCount)) {
      toast.error(`Need ${cost.resourceCount}x ${cost.resourceId.replace("_", " ").toUpperCase()} to upgrade!`);
      return;
    }

    setState((prev) => {
      const next = structuredClone(prev);
      next.coins -= cost.coins;
      // Deduct resource bars
      let remainingToDeduct = cost.resourceCount;
      for (let i = 0; i < next.inventory.length; i++) {
        const slot = next.inventory[i];
        if (slot && slot.id === cost.resourceId) {
          const deduct = Math.min(slot.count, remainingToDeduct);
          slot.count -= deduct;
          remainingToDeduct -= deduct;
          if (slot.count <= 0) next.inventory[i] = null;
          if (remainingToDeduct <= 0) break;
        }
      }

      next.upgrades[toolId] = (next.upgrades[toolId] || 1) + 1;
      toast.success(`${toolId.toUpperCase()} upgraded to Level ${next.upgrades[toolId]}!`);
      return next;
    });
    gameAudio.playCoin();
  };

  const handleManualSleep = () => {
    setSleepConfirmOpen(true);
  };

  // Player Store - available items for purchase with markup prices
  const STORE_ITEMS = Object.values(ITEM_DEFS).filter(d =>
    d.type === "resource" || d.type === "seed" || d.type === "crop" || d.type === "tool" || d.type === "furniture"
  ).map(d => ({
    ...d,
    buyPrice: d.price > 0 ? Math.round(d.price * 1.5) : 10, // 50% markup for buying from store
    sellPrice: Math.max(1, Math.round(d.price * 0.8)), // 80% of base price for selling
  }));

  // Cheat code parser
  const parseCheatCode = (cmd: string) => {
    const parts = cmd.trim().split(" ");
    const command = parts[0].toLowerCase();
    const addHistory = (text: string, color = "#4ade80") => {
      setChatHistory(h => [...h.slice(-19), { text, color }]);
    };

    if (command === "/god" || command === "/godmode") {
      setState(prev => {
        const next = structuredClone(prev);
        next.godMode = !next.godMode;
        if (next.godMode) {
          next.freeCraft = true;
          next.player.health = next.player.maxHealth;
          next.energy = next.maxEnergy;
        }
        const msg = next.godMode ? "GOD MODE ENABLED ✨ (Infinite HP & Energy + Free Crafting + Invincibility)" : "God mode disabled";
        addHistory(msg, next.godMode ? "#fbbf24" : "#94a3b8");
        return next;
      });
    } else if (command === "/freecraft" || command === "/free" || command === "/craftfree") {
      setState(prev => {
        const next = structuredClone(prev);
        next.freeCraft = !next.freeCraft;
        const msg = next.freeCraft ? "FREE CRAFTING ENABLED 🛠️ (Craft all items for 0 cost and instant speed!)" : "Free crafting disabled";
        addHistory(msg, next.freeCraft ? "#38bdf8" : "#94a3b8");
        return next;
      });
    } else if (command === "/heal") {
      setState(prev => {
        const next = structuredClone(prev);
        next.player.health = next.player.maxHealth;
        next.energy = next.maxEnergy;
        addHistory("Healed to full HP and Energy! ❤️");
        return next;
      });
    } else if (command === "/gold" || command === "/coins") {
      const amount = parseInt(parts[1]) || 1000;
      if (isNaN(amount)) { addHistory("Usage: /gold <amount>", "#f87171"); return; }
      setState(prev => {
        const next = structuredClone(prev);
        next.coins += amount;
        addHistory(`Added ${amount} gold coins! 💰 (Total: ${next.coins}g)`);
        return next;
      });
    } else if (command === "/item") {
      const itemId = parts[1];
      const qty = parseInt(parts[2]) || 1;
      if (!itemId) { addHistory("Usage: /item <item_id> [qty]", "#f87171"); return; }
      if (!ITEM_DEFS[itemId]) { addHistory(`Unknown item: ${itemId}. Check /help for valid IDs.`, "#f87171"); return; }
      setState(prev => {
        const next = structuredClone(prev);
        const item = createItem(itemId, qty);
        const ok = addItem(next.inventory, item);
        if (ok) addHistory(`Spawned ${qty}x ${ITEM_DEFS[itemId].name} ${ITEM_DEFS[itemId].iconSymbol || "📦"}`);
        else addHistory("Inventory is full!", "#f87171");
        return next;
      });
    } else if (command === "/time") {
      const hour = parseFloat(parts[1]);
      if (isNaN(hour) || hour < 0 || hour >= 24) { addHistory("Usage: /time <0-23>", "#f87171"); return; }
      setState(prev => {
        const next = structuredClone(prev);
        next.time = Math.round(hour * 60);
        addHistory(`Time set to ${hour}:00 🕐`);
        return next;
      });
    } else if (command === "/research") {
      const techId = parts[1];
      if (!techId) { addHistory("Usage: /research <tech_id>", "#f87171"); return; }
      const tech = TECHNOLOGIES.find(t => t.id === techId);
      if (!tech) { addHistory(`Unknown tech: ${techId}`, "#f87171"); return; }
      setState(prev => {
        const next = structuredClone(prev);
        if (!next.unlockedTechs) next.unlockedTechs = [];
        if (next.unlockedTechs.includes(techId)) {
          addHistory(`${tech.name} is already unlocked!`, "#94a3b8");
        } else {
          next.unlockedTechs.push(techId);
          addHistory(`Unlocked technology: ${tech.icon} ${tech.name}!`, "#a78bfa");
        }
        return next;
      });
    } else if (command === "/day") {
      const d = parseInt(parts[1]) || (state.day + 1);
      setState(prev => {
        const next = structuredClone(prev);
        next.day = d;
        addHistory(`Day set to Day ${d} 📅`);
        return next;
      });
    } else if (command === "/research_all") {
      setState(prev => {
        const next = structuredClone(prev);
        next.unlockedTechs = TECHNOLOGIES.map(t => t.id);
        next.researchPoints = (next.researchPoints || 0) + 9999;
        addHistory(`All ${TECHNOLOGIES.length} technologies unlocked! 🔬`, "#a78bfa");
        return next;
      });
    } else if (command === "/rp") {
      const pts = parseInt(parts[1]) || 500;
      setState(prev => {
        const next = structuredClone(prev);
        next.researchPoints = (next.researchPoints || 0) + pts;
        addHistory(`Added ${pts} Research Points ⚗️ (Total: ${next.researchPoints})`);
        return next;
      });
    } else if (command === "/worker") {
      setState(prev => {
        const next = structuredClone(prev);
        if (!next.workers) next.workers = [];
        next.workers.push({
          id: `worker_${Date.now()}`,
          name: `Cheat Worker #${next.workers.length + 1}`,
          cabinX: next.player.x,
          cabinY: next.player.y,
          x: next.player.x,
          y: next.player.y,
          subX: next.player.x,
          subY: next.player.y,
          task: "idle",
          role: "idle",
          inventory: null,
          energy: 100,
          hasEatenToday: false,
          walkTimer: Math.random() * 3 + 2,
          actionTimer: 0,
          statusText: "Spawned via cheat!",
        });
        addHistory(`Spawned a worker at your location! 👷`, "#a78bfa");
        return next;
      });
    } else if (command === "/help") {
      addHistory("=== CHEAT CODES ===", "#fbbf24");
      addHistory("/god — Toggle God Mode (invincibility + infinite energy + free crafting)", "#e2e8f0");
      addHistory("/freecraft — Toggle Free Instant Crafting (0 cost, 0 tech lock)", "#e2e8f0");
      addHistory("/heal — Restore full HP and energy", "#e2e8f0");
      addHistory("/gold <n> — Add gold coins", "#e2e8f0");
      addHistory("/item <id> [qty] — Spawn item", "#e2e8f0");
      addHistory("/time <0-23> — Set time of day", "#e2e8f0");
      addHistory("/day <n> — Set day number", "#e2e8f0");
      addHistory("/research <tech_id> — Unlock a technology", "#e2e8f0");
      addHistory("/research_all — Unlock all technologies", "#e2e8f0");
      addHistory("/rp <n> — Add research points", "#e2e8f0");
      addHistory("/worker — Spawn a worker at your location", "#e2e8f0");
    } else {
      addHistory(`Unknown command: ${command}. Type /help for a list.`, "#f87171");
    }
  };


  const loadout = equippedWeapon(state);

  return (
    <div
      ref={mainContainerRef}
      className={isFullscreen ? "fixed inset-0 z-[100] overflow-hidden bg-[#242b22]" : "h-full w-full overflow-hidden bg-[#242b22]"}
    >
      <div className="relative h-full w-full overflow-hidden">
        {/* Real-time Performance & FPS Overlay Bar */}
        {(state.settings?.showFpsOverlay ?? true) && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-2 bg-black/85 border border-emerald-500/60 px-2 py-1 rounded text-[10px] font-mono text-emerald-300 pointer-events-none select-none shadow-md backdrop-blur">
            <span className="font-bold flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {realFps} FPS · {realUps} UPS
            </span>
            <span className="text-slate-500">|</span>
            <span>{realFrameTime} ms</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-300">{(state.settings?.graphicsQuality || "HIGH").toUpperCase()}</span>
            <span className="text-slate-500">|</span>
            <span className="text-amber-300">
              {state.settings?.desktopMode ? "DESKTOP RAM/CPU" : "WEB"}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-sky-300 flex items-center gap-0.5">
              ☁️ {state.cloudSave?.cloudStatus === "saving" ? "SAVING..." : "SYNCED"}
            </span>
          </div>
        )}

        <canvas
          aria-label="MeadowLife world"
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onContextMenu={handleCanvasContextMenu}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onWheel={handleCanvasWheel}
          onMouseLeave={() => { handleCanvasMouseLeave(); isDraggingZone.current = false; }}
          onClick={handleCanvasClick}
          style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", cursor: "crosshair", touchAction: "none" }}
        />

        {/* Biome Discovery Banner HUD */}
        {biomeBanner && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="px-5 py-2.5 bg-[#0b0f17]/95 border-2 border-amber-400/90 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.6)] backdrop-blur text-center font-mono select-none">
              <div className="text-[10px] tracking-widest text-amber-400 font-extrabold uppercase flex items-center justify-center gap-1.5">
                <span>✦</span>
                <span>NEW REGION DISCOVERED</span>
                <span>✦</span>
              </div>
              <div className="text-sm sm:text-base font-black text-white mt-0.5">
                {biomeBanner.name} <span className="text-amber-300 font-bold text-xs">({biomeBanner.nameBn})</span>
              </div>
              <div className="text-[10px] text-slate-300 italic mt-0.5 max-w-[320px]">
                {biomeBanner.subtitle}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Exploration Compass & Waypoint Bar */}
        {!state.inMine && !state.inHouse && (
          <div className="absolute bottom-3 left-3 z-20 hidden xl:flex items-center gap-1.5 bg-black/80 border border-slate-700/80 px-3 py-1 rounded-full text-[10px] font-mono text-slate-200 backdrop-blur shadow-lg select-none">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              🧭 COMPASS
            </span>
            <span className="text-slate-600">|</span>
            {customWaypoints.map((wp) => {
              const p = state.player;
              const dx = wp.x - p.x;
              const dy = wp.y - p.y;
              const dist = Math.round(Math.hypot(dx, dy));
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              let arrow = "→";
              if (angle >= -22.5 && angle < 22.5) arrow = "→";
              else if (angle >= 22.5 && angle < 67.5) arrow = "↘";
              else if (angle >= 67.5 && angle < 112.5) arrow = "↓";
              else if (angle >= 112.5 && angle < 157.5) arrow = "↙";
              else if (angle >= -67.5 && angle < -22.5) arrow = "↗";
              else if (angle >= -112.5 && angle < -67.5) arrow = "↑";
              else if (angle >= -157.5 && angle < -112.5) arrow = "↖";
              else arrow = "←";

              return (
                <div key={wp.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-800" title={`${wp.name} at (${wp.x}, ${wp.y})`}>
                  <span>{wp.icon}</span>
                  <span className="font-bold text-slate-300">{wp.name}</span>
                  <span className="text-amber-300 font-bold">{dist}m</span>
                  <span className="text-emerald-400 font-bold">{arrow}</span>
                </div>
              );
            })}
            <button
              onClick={() => {
                const p = state.player;
                const newWp = {
                  id: `wp_${Date.now()}`,
                  name: `Beacon #${customWaypoints.length + 1}`,
                  icon: "📍",
                  x: p.x,
                  y: p.y,
                  color: "#e74c3c",
                };
                setCustomWaypoints(prev => [...prev.slice(0, 5), newWp]);
                toast.success(`Dropped Beacon at (${p.x}, ${p.y})!`);
              }}
              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/60 text-amber-300 font-bold rounded text-[9px] cursor-pointer"
              title="Drop navigation waypoint at current position"
            >
              + Pin
            </button>
          </div>
        )}

        {/* Zoning Toolbar */}
        {zoningMode !== "none" && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-[#202224]/90 border-[3px] border-[#4a5568] p-2 font-mono shadow-[0_0_15px_rgba(0,0,0,0.8)] rounded-sm">
            <div className="flex items-center text-[#ff9200] font-bold text-xs uppercase px-2 border-r border-[#4a5568] mr-1">
              Zone Painter
            </div>
            {(["farming", "mining", "woodcutting", "water", "erase"] as const).map(mode => (
              <Button
                key={mode}
                size="sm"
                onClick={() => setZoningMode(mode)}
                className={`text-[10px] font-bold uppercase rounded-none transition-all ${zoningMode === mode
                    ? "bg-[#38b2ac] text-white border-2 border-white shadow-[0_0_10px_#38b2ac]"
                    : "bg-[#2f3136] text-slate-400 border-2 border-slate-600 hover:border-[#38b2ac]"
                  }`}
              >
                {mode === "erase" ? "🧹 Erase" : `${mode === 'farming' ? '💧' : mode === 'mining' ? '⛏️' : mode === 'woodcutting' ? '🪓' : '🪣'} ${mode}`}
              </Button>
            ))}
            <Button
              size="sm"
              onClick={() => setZoningMode("none")}
              className="bg-red-900/50 text-red-300 hover:bg-red-900 border border-red-800 text-[10px] font-bold uppercase ml-2 rounded-none"
            >
              Exit (X)
            </Button>
          </div>
        )}

        {!state.inMine && !state.inHouse && (
          <section className="yard-brief absolute top-14 left-3 z-20 select-none" aria-label="Ironworks commissioning">
            <div className="yard-brief__heading">
              <span>Meadow Works</span>
              <button onClick={() => setCampaignMinimized(value => !value)} aria-label={campaignMinimized ? "Expand work order" : "Collapse work order"}>{campaignMinimized ? "+" : "−"}</button>
            </div>
            {!campaignMinimized && (
              <>
                <h2>Commission the ironworks</h2>
                <div className="yard-progress" role="progressbar" aria-label="Iron plates smelted" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(10, state.productionStats?.produced.iron_bar ?? 0)}>
                  <span style={{ width: `${Math.min(100, (state.productionStats?.produced.iron_bar ?? 0) * 10)}%` }} />
                </div>
                <p className="yard-brief__count">{Math.min(10, state.productionStats?.produced.iron_bar ?? 0)} / 10 iron plates smelted</p>
                {(state.productionStats?.produced.iron_bar ?? 0) < 10 ? (
                  <>
                    <p>Find the gray iron seam east of the farmhouse. Build a drill there and point it toward a belt.</p>
                    <p>Run the belt into a furnace. <kbd>Ctrl</kbd> + click each burner machine to load fuel.</p>
                    <p>Put a burner inserter between the furnace and a chest, facing the chest.</p>
                  </>
                ) : (
                  <p>{(state.patrol?.repelled ?? 0) === 0 ? "Iron line commissioned. Build a wall and turret. Ctrl-click the gun turret to load it, and open Survey to check its coverage." : "Perimeter secured. Feed science packs to a powered lab and use a second line for copper."}</p>
                )}
              </>
            )}
          </section>
        )}

        {!state.inMine && !state.inHouse && (
          <div className={`field-alert ${state.patrol?.active ? "field-alert--active" : ""}`} role="status">
            {state.patrol?.active ? "Perimeter breach · Defend the yard" : (state.productionStats?.pollutionTotal ?? 0) >= (state.patrol?.nextAt ?? 1100) * .70 ? "Scouts approaching · Prepare defenses" : (state.patrol?.repelled ?? 0) > 0 ? `${state.patrol!.repelled} raids repelled` : ""}
          </div>
        )}
        <div className="field-loadout">
          <span>{loadout.item?.name ?? "Unarmed"}</span>
          {loadout.item && <span>{loadout.rounds} ammo</span>}
          <kbd>B</kbd>
        </div>

        {/* Floating Top-Left Action Bar (Separated Mobile & Desktop View) */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#222922]/95 border border-[#656853] p-1 font-mono shadow-md select-none">
          {/* Mobile Quick Menu Hamburger Button */}
          <button
            onClick={() => setMobileQuickMenuOpen(true)}
            title="Open Game Menu"
            className="flex items-center gap-1 px-2 h-8 bg-gradient-to-r from-[#ff9200]/20 to-[#ff9200]/10 hover:bg-[#ff9200]/30 border border-[#ff9200]/60 text-[#ff9200] font-black text-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span>☰</span>
            <span className="text-[10px] uppercase tracking-wider hidden sm:inline">MENU</span>
          </button>

          {/* Quick Backpack Button */}
          <button
            onClick={() => { setInventoryOpen(true); setActiveTab("inventory"); }}
            title="Backpack Journal (I)"
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs"
          >
            <Backpack className="h-4 w-4 text-[#ff9200]" />
          </button>

          {/* Desktop Only Buttons */}
          <div className="hidden md:flex items-center gap-1">
            {/* Factorio Alt-Mode Toggle Button */}
            <button
              onClick={() => {
                setState((prev) => {
                  const nextAlt = !prev.altMode;
                  toast(`Machine overlay: ${nextAlt ? "ENABLED (Info Overlay On) 🔍" : "DISABLED ❌"}`);
                  return { ...prev, altMode: nextAlt };
                });
              }}
              title="Factorio Alt-Mode (Alt): Toggle Machine Recipes & Info Overlay"
              className={`h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-yellow-500/20 border transition-all cursor-pointer font-bold text-xs ${state.altMode ? "border-yellow-500 text-yellow-400 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.3)]" : "border-slate-600 text-slate-300 hover:border-yellow-500"}`}
            >
              <span className="text-yellow-400 text-xs">🔍</span>
              <span className="text-yellow-400 text-[10px]">Alt</span>
            </button>

            {/* Factorio Blueprint Copy Tool Button */}
            <button
              onClick={() => {
                setState((prev) => {
                  const currentMode = prev.blueprint?.mode;
                  const nextMode = currentMode === "copy" ? null : "copy";
                  toast(`Blueprint copy: ${nextMode ? "ACTIVE (Drag rectangle to copy factory)" : "OFF"}`);
                  return {
                    ...prev,
                    blueprint: {
                      mode: nextMode,
                      startTile: null,
                      currentTile: null,
                      savedEntities: prev.blueprint?.savedEntities || [],
                    },
                  };
                });
              }}
              title="Copy a rectangular area (Ctrl+C)"
              className={`h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-cyan-500/20 border transition-all cursor-pointer font-bold text-xs ${state.blueprint?.mode === "copy" ? "border-cyan-400 text-cyan-400 bg-cyan-500/20 animate-pulse" : "border-slate-600 text-slate-300 hover:border-cyan-400"}`}
            >
              <span className="text-cyan-400 text-xs">📋</span>
              <span className="text-cyan-400 text-[10px]">Blueprint</span>
            </button>

            {/* Factorio Stamp Tool Button */}
            <button
              onClick={() => {
                if (!state.blueprint?.savedEntities || state.blueprint.savedEntities.length === 0) {
                  toast.error("No blueprint copied yet! Copy a factory layout first.");
                  return;
                }
                setState((prev) => {
                  const currentMode = prev.blueprint?.mode;
                  const nextMode = currentMode === "stamp" ? null : "stamp";
                  toast(`Blueprint placement: ${nextMode ? "ACTIVE (Click to stamp copied layout)" : "OFF"}`);
                  return {
                    ...prev,
                    blueprint: {
                      ...(prev.blueprint || { savedEntities: [] }),
                      mode: nextMode,
                    },
                  };
                });
              }}
              title="Place the copied layout (Ctrl+V)"
              className={`h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-emerald-500/20 border transition-all cursor-pointer font-bold text-xs ${state.blueprint?.mode === "stamp" ? "border-emerald-400 text-emerald-400 bg-emerald-500/20 animate-pulse" : "border-slate-600 text-slate-300 hover:border-emerald-400"}`}
            >
              <span className="text-emerald-400 text-xs">📌</span>
              <span className="text-emerald-400 text-[10px]">Stamp</span>
            </button>

            {/* Factorio Deconstruction Planner Button */}
            <button
              onClick={() => {
                setState((prev) => {
                  const currentMode = prev.blueprint?.mode;
                  const nextMode = currentMode === "deconstruct" ? null : "deconstruct";
                  toast(`Batch dismantle: ${nextMode ? "ACTIVE (Drag red box to batch deconstruct)" : "OFF"}`);
                  return {
                    ...prev,
                    blueprint: {
                      mode: nextMode,
                      startTile: null,
                      currentTile: null,
                      savedEntities: prev.blueprint?.savedEntities || [],
                    },
                  };
                });
              }}
              title="Dismantle a rectangular area (Ctrl+X)"
              className={`h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-red-500/20 border transition-all cursor-pointer font-bold text-xs ${state.blueprint?.mode === "deconstruct" ? "border-red-500 text-red-400 bg-red-500/20 animate-pulse" : "border-slate-600 text-slate-300 hover:border-red-500"}`}
            >
              <span className="text-red-400 text-xs">✂️</span>
              <span className="text-red-400 text-[10px]">Deconstruct</span>
            </button>

            {/* Graphics & FPS Settings Button */}
            <button
              onClick={() => setGraphicsSettingsOpen(true)}
              title="Graphics Quality, FPS Limits, and Performance Settings"
              className="h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-cyan-500/20 border border-slate-600 hover:border-cyan-500 text-slate-100 transition-all cursor-pointer font-bold text-xs"
            >
              <span className="text-cyan-400 text-xs">⚙️</span>
              <span className="text-cyan-400 text-[10px]">Settings</span>
            </button>

            {/* Sleep (Save & Grow) Button */}
            <button
              onClick={handleManualSleep}
              title="Sleep (Save & Grow)"
              className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs"
            >
              <Bed className="h-4 w-4 text-emerald-400" />
            </button>

            {/* About / Guide Button */}
            <button
              onClick={() => setAboutOpen(true)}
              title="About & Cheats (H)"
              className="h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-[#22d3ee]/20 border border-slate-600 hover:border-[#22d3ee] text-slate-100 transition-all cursor-pointer font-bold text-xs"
            >
              <HelpCircle className="h-4 w-4 text-[#22d3ee]" />
              <span className="text-[#22d3ee] text-[10px]">Guide (H)</span>
            </button>

            <button onClick={() => setChartOpen(true)} title="Survey map (M)" className="yard-command h-8 px-2">Survey <kbd>M</kbd></button>
            {/* Production Statistics Button (P) */}
            <button
              onClick={() => setProductionStatsOpen(true)}
              title="Production statistics (P)"
              className="h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-orange-500/20 border border-slate-600 hover:border-orange-500 text-slate-100 transition-all cursor-pointer font-bold text-xs font-mono"
            >
              <span className="text-orange-400 text-sm">📊</span>
              <span className="text-orange-400 text-[10px]">Stats (P)</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center bg-[#202224] border border-slate-700">
              <button
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                className="w-7 h-8 flex items-center justify-center hover:bg-[#ff9200]/20 text-slate-200 hover:text-[#ff9200] font-mono font-black text-xs"
              >
                -
              </button>
              <button
                onClick={handleZoomReset}
                title="Reset Zoom (100%)"
                className="px-1.5 h-8 flex items-center justify-center text-[10px] font-mono font-bold text-amber-400 border-x border-slate-700 hover:bg-slate-800"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                title="Zoom In (+)"
                className="w-7 h-8 flex items-center justify-center hover:bg-[#ff9200]/20 text-slate-200 hover:text-[#ff9200] font-mono font-black text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Mailbox Button (if unread mail exists) */}
          {state.mailboxLetters.length > 0 && (
            <button
              onClick={() => setMailboxOpen(true)}
              title={`Mailbox (${state.mailboxLetters.filter(l => !l.claimed).length} unread)`}
              className={`w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs ${state.hasUnreadMail ? "animate-pulse border-red-500 text-red-500 bg-red-500/10" : ""}`}
            >
              <Mail className="h-4 w-4" />
            </button>
          )}

          <span className="w-[1px] h-5 bg-slate-700 mx-0.5"></span>

          {/* Mute Button */}
          <button
            onClick={() => setMuted(gameAudio.toggleMute())}
            title={muted ? "Unmute Audio" : "Mute Audio"}
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile Quick Menu Drawer (Modal Sheet) */}
        <Dialog open={mobileQuickMenuOpen} onOpenChange={setMobileQuickMenuOpen}>
          <DialogContent container={mainContainerRef.current} className="w-[96vw] max-w-md bg-[#13171e]/95 border-2 border-[#ff9200]/70 text-slate-100 rounded-xl font-mono shadow-[0_0_30px_rgba(0,0,0,0.9)] backdrop-blur-xl p-4">
            <DialogHeader>
              <DialogTitle className="text-base font-black uppercase tracking-wider flex items-center justify-between text-[#ff9200] border-b border-slate-700/80 pb-2">
                <span className="flex items-center gap-2">
                  <span>📱</span>
                  <span>Mobile Game Menu</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Day {state.day} • {state.coins}G</span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2.5 py-3">
              {/* Backpack & Factorio Crafting */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setInventoryOpen(true); setActiveTab("inventory"); }}
                className="p-3 bg-[#1e2530] hover:bg-[#ff9200]/20 border border-slate-700 hover:border-[#ff9200] rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🎒</span>
                <div>
                  <div className="font-bold text-xs text-slate-100">Backpack</div>
                  <div className="text-[9px] text-slate-400">Inventory & Storage</div>
                </div>
              </button>

              {/* Factorio Crafting Tab */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setInventoryOpen(true); setActiveTab("crafting"); }}
                className="p-3 bg-[#1e2530] hover:bg-orange-500/20 border border-slate-700 hover:border-orange-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">⚙️</span>
                <div>
                  <div className="font-bold text-xs text-orange-400">Crafting</div>
                  <div className="text-[9px] text-slate-400">Factory logistics</div>
                </div>
              </button>

              {/* Pierre's Shop */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setShopOpen(true); }}
                className="p-3 bg-[#1e2530] hover:bg-yellow-500/20 border border-slate-700 hover:border-yellow-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🛒</span>
                <div>
                  <div className="font-bold text-xs text-yellow-400">Pierre's Store</div>
                  <div className="text-[9px] text-slate-400">Buy Seeds & Machines</div>
                </div>
              </button>

              {/* Research Center */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setResearchCenterOpen(true); }}
                className="p-3 bg-[#1e2530] hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🔬</span>
                <div>
                  <div className="font-bold text-xs text-cyan-400">Research Tree</div>
                  <div className="text-[9px] text-slate-400">Unlock Techs ({state.researchPoints || 0} RP)</div>
                </div>
              </button>

              {/* Factorio Save & Load Games */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setSaveLoadOpen(true); loadSavedSlotsFromStorage(); }}
                className="p-3 bg-[#1e2530] hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">💾</span>
                <div>
                  <div className="font-bold text-xs text-emerald-400">Save & Load Games</div>
                  <div className="text-[9px] text-slate-400">Manage Named Saves & Slots</div>
                </div>
              </button>

              {/* Sleep & Save Day */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); handleManualSleep(); }}
                className="p-3 bg-[#1e2530] hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🛏️</span>
                <div>
                  <div className="font-bold text-xs text-emerald-400">Sleep & Save</div>
                  <div className="text-[9px] text-slate-400">Advance to next day</div>
                </div>
              </button>

              {/* Multiplayer Rooms */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setMultiplayerOpen(true); }}
                className="p-3 bg-[#1e2530] hover:bg-teal-500/20 border border-slate-700 hover:border-teal-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🌐</span>
                <div>
                  <div className="font-bold text-xs text-teal-400">Multiplayer</div>
                  <div className="text-[9px] text-slate-400">Rooms & Custom Maps</div>
                </div>
              </button>

              {/* Touch Control Mode Switch */}
              <button
                onClick={() => setControlMode(prev => prev === "joystick" ? "dpad" : "joystick")}
                className="p-3 bg-[#1e2530] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🕹️</span>
                <div>
                  <div className="font-bold text-xs text-amber-300">Controls Mode</div>
                  <div className="text-[9px] text-slate-400">Current: {controlMode.toUpperCase()}</div>
                </div>
              </button>

              {/* Sprint Run Toggle */}
              <button
                onClick={() => setMobileSprint(prev => !prev)}
                className="p-3 bg-[#1e2530] hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500 rounded-lg flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <span className="text-2xl">🏃</span>
                <div>
                  <div className="font-bold text-xs text-amber-300">Turbo Sprint</div>
                  <div className="text-[9px] text-slate-400">{mobileSprint ? "Speed: FAST (ON)" : "Speed: WALK (OFF)"}</div>
                </div>
              </button>
            </div>

            {/* Quick Cheats Row in Mobile Drawer */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setState(prev => {
                    const next = structuredClone(prev);
                    next.godMode = !next.godMode;
                    if (next.godMode) {
                      next.freeCraft = true;
                      next.player.health = next.player.maxHealth;
                      next.energy = next.maxEnergy;
                    }
                    toast(next.godMode ? "⚡ God Mode Enabled (Infinite HP/NRG)" : "God Mode Disabled");
                    return next;
                  });
                }}
                className={`py-2 px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-between active:scale-95 transition-all ${
                  state.godMode
                    ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse"
                    : "bg-[#1e2530] border-slate-700 text-slate-300"
                }`}
              >
                <span>⚡ God Mode</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/50">{state.godMode ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={() => {
                  setState(prev => {
                    const next = structuredClone(prev);
                    next.freeCraft = !next.freeCraft;
                    toast(next.freeCraft ? "🛠️ Free Crafting Enabled (0 Cost)" : "Free Crafting Disabled");
                    return next;
                  });
                }}
                className={`py-2 px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-between active:scale-95 transition-all ${
                  state.freeCraft
                    ? "bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    : "bg-[#1e2530] border-slate-700 text-slate-300"
                }`}
              >
                <span>🛠️ Free Craft</span>
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/50">{state.freeCraft ? "ON" : "OFF"}</span>
              </button>
            </div>

            {/* Mobile Zoom Controls Row */}
            <div className="flex items-center justify-between p-2 bg-[#1a222d] border border-slate-700/80 rounded-lg mt-2 font-mono">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <span>🔍</span> Zoom View
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleZoomOut}
                  className="w-8 h-7 bg-[#232f3e] active:bg-[#ff9200] border border-slate-600 rounded text-slate-100 font-black text-sm flex items-center justify-center"
                >
                  -
                </button>
                <button
                  onClick={handleZoomReset}
                  className="px-2 h-7 bg-[#11161d] border border-slate-700 rounded text-amber-400 font-bold text-[10px] flex items-center justify-center"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="w-8 h-7 bg-[#232f3e] active:bg-[#ff9200] border border-slate-600 rounded text-slate-100 font-black text-sm flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              {/* Cheats Console Button */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setChatOpen(true); }}
                className="flex-1 py-2 bg-purple-950/70 border border-purple-700 text-purple-300 text-xs font-bold rounded-lg text-center active:scale-95"
              >
                ⚡ Cheats Console (/)
              </button>
              {/* Game Guide Button */}
              <button
                onClick={() => { setMobileQuickMenuOpen(false); setAboutOpen(true); }}
                className="flex-1 py-2 bg-cyan-950/70 border border-cyan-700 text-cyan-300 text-xs font-bold rounded-lg text-center active:scale-95"
              >
                📖 Game Guide (H)
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mine Depth label */}
        {state.inMine && (
          <div className="absolute top-[52px] left-3 px-2 py-1 bg-[#202224]/80 border border-slate-700 text-red-400 rounded-none text-[10px] font-mono flex items-center gap-1 z-20 shadow-md">
            <Shield className="h-3 w-3 text-red-400 animate-bounce" />
            <span>MINE LEVEL: {state.mineDepth}</span>
          </div>
        )}

        {/* Floating Top-Right Radar / Minimap & Info Panel */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 w-[140px] sm:w-[160px] bg-[#202224]/90 border border-slate-700 p-1 font-mono text-[9px] text-slate-200 shadow-xl select-none">
          {/* Header Title with collapse toggle */}
          <div
            onClick={() => setRadarExpanded(prev => !prev)}
            className="flex justify-between items-center px-1 text-slate-400 border-b border-slate-700/80 pb-0.5 cursor-pointer hover:text-white"
          >
            <span className="font-bold tracking-wider text-[#ff9200]">RADAR {radarExpanded ? "▲" : "▼"}</span>
            <span>{state.weather === "rainy" ? "🌧" : "☀️"}</span>
          </div>

          {/* Minimap Canvas Container (collapsible) */}
          {radarExpanded && (
            <div className="w-[130px] h-[130px] sm:w-[150px] sm:h-[150px] bg-[#141517] border border-slate-800 relative mx-auto flex items-center justify-center">
              <canvas
                ref={minimapRef}
                width={148}
                height={148}
                className="block w-full h-full cursor-crosshair"
                style={{ imageRendering: "pixelated" }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = (e.clientX - rect.left) / rect.width;
                  const clickY = (e.clientY - rect.top) / rect.height;
                  const targetTileX = Math.floor(clickX * COLS);
                  const targetTileY = Math.floor(clickY * ROWS);
                  const newWp = {
                    id: `wp_${Date.now()}`,
                    name: `Pin (${targetTileX}, ${targetTileY})`,
                    icon: "📍",
                    x: targetTileX,
                    y: targetTileY,
                    color: "#e74c3c",
                  };
                  setCustomWaypoints(prev => [...prev.slice(0, 5), newWp]);
                  toast.success(`Beacon pin set at (${targetTileX}, ${targetTileY})!`);
                }}
              />
            </div>
          )}

          {/* Dashboard stats */}
          <div className="flex flex-col gap-0.5 px-1 py-0.5 leading-normal text-slate-300">
            <div className="flex justify-between">
              <span>LOC:</span>
              <span className="font-bold text-slate-100 truncate max-w-[80px] sm:max-w-[100px]" title={!state.inMine && !state.inHouse ? getBiomeAt(state.player.x, state.player.y).name : ""}>
                {state.inMine ? `MINES (L${state.mineDepth})` : (state.inHouse ? "FARM HOUSE" : getBiomeAt(state.player.x, state.player.y).name.toUpperCase())}
              </span>
            </div>
            <div className="flex justify-between">
              <span>TIME:</span>
              <span className="font-bold text-slate-100">{formatTime(state.time)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700/50 mt-0.5 pt-0.5 font-bold text-yellow-450">
              <span>GOLD:</span>
              <span>{state.coins}G</span>
            </div>
          </div>
        </div>

        {/* Bottom-Center Factorio Hotbar */}
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 max-w-[98%]">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#202224]/90 border border-slate-700 p-0.5 sm:p-1 shadow-2xl">
            {state.quickbar.map((id, idx) => {
              const item = id ? createItem(id, quickbarStock(state, id)) : null;
              const selected = state.hotbarIndex === idx;
              const icon = item && getYardItemIcon(item.id);
              const slotKey = idx === 9 ? "0" : (idx + 1).toString();
              return (
                <button
                  key={idx}
                  onClick={() => onQuickbar(idx)}
                  onContextMenu={e => { e.preventDefault(); onQuickbar(idx, true); }}
                  onMouseDown={e => {
                    if (e.button !== 1) return;
                    e.preventDefault();
                    setState(prev => ({ ...prev, quickbar: prev.quickbar.map((filter, slot) => slot === idx ? null : filter) }));
                  }}
                  title={item ? `${item.name} (${slotKey}) · Right-click half · Middle-click clear` : `Empty shortcut (${slotKey}) · Click with an item to bind`}
                  aria-pressed={selected}
                  className={`relative flex flex-col items-center justify-center w-[30px] h-[30px] sm:w-[44px] sm:h-[44px] transition-all cursor-pointer select-none rounded-none ${selected
                      ? "border-2 border-[#ff9200] bg-[#ff9200]/20 scale-[1.06] shadow-[0_0_8px_rgba(255,146,0,0.5)] z-10"
                      : "border border-slate-700 bg-[#141517] hover:bg-slate-800"
                    }`}
                >
                  {/* Slot numeric shortcut overlay */}
                  <span className="absolute top-0.5 left-0.5 text-[7px] sm:text-[8px] font-bold text-slate-500 leading-none">
                    {slotKey}
                  </span>

                  {item ? (
                    <>
                      {icon ? <img src={icon} alt="" className="h-7 w-7 object-contain" draggable={false} /> : (
                        <span className="text-sm sm:text-xl mt-0.5 select-none">{item.iconSymbol || item.name.slice(0, 1)}</span>
                      )}
                      {item.count !== 1 && (
                        <span className="absolute bottom-0 right-0.5 px-0.5 bg-black/85 text-[7px] sm:text-[8px] font-bold text-white font-mono leading-none">
                          {item.count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[8px] sm:text-[10px] opacity-10 text-white font-mono">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Factorio Crafting Queue HUD Bar (Bottom-Left) */}
        {craftingQueue.length > 0 && (
          <div className="absolute bottom-14 left-3 z-20 flex flex-col gap-1 bg-[#141517]/95 border-2 border-slate-700 p-1.5 font-mono shadow-2xl text-zinc-100 rounded-sm">
            <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider flex justify-between items-center gap-2 border-b border-zinc-800 pb-0.5">
              <span className="text-orange-400 font-extrabold flex items-center gap-1">
                <span>🛠️</span> QUEUE ({craftingQueue.length})
              </span>
              <span className="text-[7px] text-zinc-500">Click icon to cancel & refund</span>
            </div>

            {/* Queue Item Icons Strip */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] sm:max-w-[360px] py-0.5">
              {craftingQueue.map((item, idx) => {
                const isActive = idx === 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleCancelQueuedCraft(idx)}
                    title={`Click to cancel crafting ${item.name} & refund ingredients`}
                    className={`relative shrink-0 flex flex-col items-center justify-center w-9 h-9 rounded border transition-all cursor-pointer select-none group ${
                      isActive
                        ? "bg-[#28382b] border-[#ff9200] shadow-[0_0_8px_rgba(255,146,0,0.6)]"
                        : "bg-[#181a1f] border-zinc-700 hover:border-red-500/80 hover:bg-red-950/30"
                    }`}
                  >
                    <span className="text-lg group-hover:scale-95 transition-transform">{item.iconSymbol}</span>

                    {/* Active Crafting Linear Progress Bar */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 overflow-hidden">
                        <div
                          className="bg-orange-500 h-full transition-all duration-100"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Cancel X Badge on hover */}
                    <span className="absolute inset-0 bg-red-950/90 text-red-300 font-black text-xs hidden group-hover:flex items-center justify-center rounded">
                      ✕
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Touch Gaming Suite (Optimized for iPhone & Android) */}
        {showTouchControls && (
          <>
            {/* Movement Controller (Bottom-Left) */}
            <div
              className="absolute z-30 select-none pointer-events-auto touch-none"
              style={{
                bottom: "calc(4.2rem + env(safe-area-inset-bottom, 0px))",
                left: "calc(0.75rem + env(safe-area-inset-left, 0px))"
              }}
            >
              {controlMode === "joystick" ? (
                /* Dynamic Virtual Analog Joystick (360° Vector Tracking) */
                <div className="flex flex-col items-center gap-1">
                  <div
                    onTouchStart={handleJoystickTouchStart}
                    onTouchMove={handleJoystickTouchMove}
                    onTouchEnd={handleJoystickTouchEnd}
                    onTouchCancel={resetJoystick}
                    className="relative w-28 h-28 rounded-full bg-[#12171f]/85 border-2 border-[#3d516b]/80 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center justify-center cursor-pointer active:border-[#ff9200]/80 transition-colors"
                  >
                    {/* Directional ticks */}
                    <span className="absolute top-1 text-[8px] text-slate-500 font-bold">▲</span>
                    <span className="absolute bottom-1 text-[8px] text-slate-500 font-bold">▼</span>
                    <span className="absolute left-1 text-[8px] text-slate-500 font-bold">◀</span>
                    <span className="absolute right-1 text-[8px] text-slate-500 font-bold">▶</span>

                    {/* Outer guide ring */}
                    <div className="w-16 h-16 rounded-full border border-slate-700/40 pointer-events-none" />

                    {/* Glowing Movable Thumb Knob */}
                    <div
                      className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-[#ff9200] to-[#d35400] border-2 border-white shadow-[0_0_12px_rgba(255,146,0,0.7)] flex items-center justify-center text-white text-xs font-bold pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `translate(${joystickKnobPos.x}px, ${joystickKnobPos.y}px)`
                      }}
                    >
                      🕹️
                    </div>
                  </div>

                  {/* Mode switch button */}
                  <button
                    onClick={() => setControlMode("dpad")}
                    className="px-2 py-0.5 bg-[#1b222d]/80 hover:bg-[#ff9200]/30 border border-slate-700 rounded text-[9px] font-mono text-slate-300 active:scale-95"
                  >
                    Switch to D-Pad 🎛️
                  </button>
                </div>
              ) : (
                /* Classic 4-Way D-Pad */
                <div className="flex flex-col items-center">
                  {/* Up Button */}
                  <button
                    onTouchStart={(e) => { e.preventDefault(); pressedKeysRef.current.add("w"); }}
                    onTouchEnd={(e) => { e.preventDefault(); pressedKeysRef.current.delete("w"); }}
                    onTouchCancel={() => pressedKeysRef.current.delete("w")}
                    onMouseDown={() => pressedKeysRef.current.add("w")}
                    onMouseUp={() => pressedKeysRef.current.delete("w")}
                    onMouseLeave={() => pressedKeysRef.current.delete("w")}
                    className="w-12 h-12 bg-[#1a222d]/90 active:bg-[#ff9200]/80 border-2 border-[#3b4c63] active:border-[#ff9200] rounded-t-xl flex items-center justify-center text-white text-lg shadow-xl active:scale-95 transition-transform"
                  >
                    ▲
                  </button>
                  <div className="flex gap-2 -my-0.5">
                    {/* Left Button */}
                    <button
                      onTouchStart={(e) => { e.preventDefault(); pressedKeysRef.current.add("a"); }}
                      onTouchEnd={(e) => { e.preventDefault(); pressedKeysRef.current.delete("a"); }}
                      onTouchCancel={() => pressedKeysRef.current.delete("a")}
                      onMouseDown={() => pressedKeysRef.current.add("a")}
                      onMouseUp={() => pressedKeysRef.current.delete("a")}
                      onMouseLeave={() => pressedKeysRef.current.delete("a")}
                      className="w-12 h-12 bg-[#1a222d]/90 active:bg-[#ff9200]/80 border-2 border-[#3b4c63] active:border-[#ff9200] rounded-l-xl flex items-center justify-center text-white text-lg shadow-xl active:scale-95 transition-transform"
                    >
                      ◀
                    </button>
                    {/* Center Core Switcher */}
                    <button
                      onClick={() => setControlMode("joystick")}
                      className="w-10 h-10 bg-[#11161d]/95 rounded-full border border-slate-700/80 flex items-center justify-center text-[10px] text-amber-400 font-bold active:scale-90"
                      title="Switch to Joystick"
                    >
                      🕹️
                    </button>
                    {/* Right Button */}
                    <button
                      onTouchStart={(e) => { e.preventDefault(); pressedKeysRef.current.add("d"); }}
                      onTouchEnd={(e) => { e.preventDefault(); pressedKeysRef.current.delete("d"); }}
                      onTouchCancel={() => pressedKeysRef.current.delete("d")}
                      onMouseDown={() => pressedKeysRef.current.add("d")}
                      onMouseUp={() => pressedKeysRef.current.delete("d")}
                      onMouseLeave={() => pressedKeysRef.current.delete("d")}
                      className="w-12 h-12 bg-[#1a222d]/90 active:bg-[#ff9200]/80 border-2 border-[#3b4c63] active:border-[#ff9200] rounded-r-xl flex items-center justify-center text-white text-lg shadow-xl active:scale-95 transition-transform"
                    >
                      ▶
                    </button>
                  </div>
                  {/* Down Button */}
                  <button
                    onTouchStart={(e) => { e.preventDefault(); pressedKeysRef.current.add("s"); }}
                    onTouchEnd={(e) => { e.preventDefault(); pressedKeysRef.current.delete("s"); }}
                    onTouchCancel={() => pressedKeysRef.current.delete("s")}
                    onMouseDown={() => pressedKeysRef.current.add("s")}
                    onMouseUp={() => pressedKeysRef.current.delete("s")}
                    onMouseLeave={() => pressedKeysRef.current.delete("s")}
                    className="w-12 h-12 bg-[#1a222d]/90 active:bg-[#ff9200]/80 border-2 border-[#3b4c63] active:border-[#ff9200] rounded-b-xl flex items-center justify-center text-white text-lg shadow-xl active:scale-95 transition-transform"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Action Controls Cluster (Bottom-Right) */}
            <div
              className="absolute z-30 flex flex-col items-end gap-2.5 select-none pointer-events-auto touch-none"
              style={{
                bottom: "calc(4.2rem + env(safe-area-inset-bottom, 0px))",
                right: "calc(0.75rem + env(safe-area-inset-right, 0px))"
              }}
            >
              {/* Secondary Action Buttons Row */}
              <div className="flex items-center gap-2">
                {/* Sprint Turbo Toggle Button */}
                <button
                  onClick={() => setMobileSprint(prev => !prev)}
                  className={`w-11 h-11 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px] border-2 ${
                    mobileSprint
                      ? "bg-amber-500 border-amber-300 text-black animate-pulse shadow-[0_0_10px_#f59e0b]"
                      : "bg-[#1f2937]/90 border-slate-600 text-slate-300"
                  }`}
                  title="Toggle Sprint Run"
                >
                  <span className="text-base">🏃</span>
                  <span className="text-[7px] leading-none font-mono">{mobileSprint ? "RUN" : "WALK"}</span>
                </button>

                {/* Rotate Placement Button (R) */}
                <button
                  onClick={() => {
                    setState((prev) => {
                      const dirs: ("right" | "down" | "left" | "up")[] = ["right", "down", "left", "up"];
                      const currentIdx = dirs.indexOf(prev.placementDirection || "right");
                      const nextDir = dirs[(currentIdx + 1) % dirs.length];
                      toast(`Direction: ${nextDir.toUpperCase()} 🔄`);
                      return { ...prev, placementDirection: nextDir };
                    });
                  }}
                  className="w-11 h-11 bg-amber-950/90 active:bg-amber-600 border-2 border-amber-500/80 text-amber-300 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px]"
                >
                  <span className="text-sm">🔄</span>
                  <span className="text-[7px] leading-none font-mono">ROT</span>
                </button>

                {/* Inspect / Talk Button (F) */}
                <button
                  onClick={() => {
                    const f = frontTile(state);
                    if (f) handleTileInteraction(f);
                  }}
                  className="w-11 h-11 bg-blue-950/90 active:bg-blue-600 border-2 border-blue-500/80 text-blue-300 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px]"
                >
                  <span className="text-sm">💬</span>
                  <span className="text-[7px] leading-none font-mono">INSP</span>
                </button>

                {/* Bag / Crafting Button (I) */}
                <button
                  onClick={() => { setInventoryOpen(true); setActiveTab("inventory"); }}
                  className="w-11 h-11 bg-purple-950/90 active:bg-purple-600 border-2 border-purple-500/80 text-purple-300 rounded-full flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px]"
                >
                  <span className="text-sm">🎒</span>
                  <span className="text-[7px] leading-none font-mono">BAG</span>
                </button>
              </div>

              {/* Primary Action Button (USE / ACTION / PLACE) - supports single tap & hold-to-repeat */}
              <button
                onTouchStart={(e) => { e.preventDefault(); startContinuousAction(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopContinuousAction(); }}
                onTouchCancel={stopContinuousAction}
                onMouseDown={startContinuousAction}
                onMouseUp={stopContinuousAction}
                onMouseLeave={stopContinuousAction}
                className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 active:from-emerald-400 active:to-teal-500 border-[3px] border-emerald-200 text-white rounded-full flex flex-col items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.6)] active:scale-95 transition-transform font-extrabold cursor-pointer"
              >
                <span className="text-2xl drop-shadow">⚡</span>
                <span className="text-[9px] uppercase tracking-wider font-mono font-black drop-shadow">ACTION</span>
              </button>
            </div>

            {/* Quick Hotbar Slot Switchers for Mobile */}
            <div
              className="absolute z-30 flex items-center justify-between w-[96%] max-w-[360px] pointer-events-none left-1/2 -translate-x-1/2"
              style={{
                bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))"
              }}
            >
              <button
                onClick={() => onQuickbar((state.hotbarIndex - 1 + 10) % 10)}
                className="pointer-events-auto w-8 h-8 bg-slate-900/95 border-2 border-slate-600 active:bg-[#ff9200] active:border-white text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xl active:scale-90 transition-transform"
              >
                ◀
              </button>
              <button
                onClick={() => onQuickbar((state.hotbarIndex + 1) % 10)}
                className="pointer-events-auto w-8 h-8 bg-slate-900/95 border-2 border-slate-600 active:bg-[#ff9200] active:border-white text-white rounded-full flex items-center justify-center font-bold text-xs shadow-xl active:scale-90 transition-transform"
              >
                ▶
              </button>
            </div>
          </>
        )}

        {/* Floating monospaced guide helper in bottom left */}
        <div className="hidden flex-col text-[8px] font-mono text-slate-500 leading-normal bg-black/30 p-1 pointer-events-none select-none">
          <span>KEYS 1-0: SELECT SLOT</span>
          <span>SHIFT: SPRINT</span>
        </div>

        {/* Floating HP & Energy Bars in Bottom Right */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5 bg-[#202224]/80 border border-slate-700 p-1.5 font-mono text-[9px] shadow-lg select-none w-28">
          {/* Health Bar */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-red-400 font-bold">
              <span>HP</span>
              <span>{state.player.health}/{state.player.maxHealth}</span>
            </div>
            <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-none overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-200"
                style={{ width: `${(state.player.health / state.player.maxHealth) * 100}%` }}
              />
            </div>
          </div>

          {/* Energy Bar */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-green-400 font-bold">
              <span>NRG</span>
              <span>{state.energy}/{state.maxEnergy}</span>
            </div>
            <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-none overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${state.energy <= 40 ? "bg-amber-500 animate-pulse" : "bg-green-600"}`}
                style={{ width: `${(state.energy / state.maxEnergy) * 100}%` }}
              />
            </div>
          </div>
        </div>

      </div>
      {heldItem && (
        <div ref={cursorBadge} className="workshop-cursor" data-held-item={heldItem.id}
          style={{ transform: `translate(${cursorPosition.current.x + 14}px, ${cursorPosition.current.y + 15}px)` }}>
          <StackIcon item={heldItem} />
          {isBuildableItem(heldItem) && <span className="workshop-cursor-dir" aria-hidden="true">{{ up: "↑", down: "↓", left: "←", right: "→" }[state.placementDirection ?? "right"]}</span>}
          <strong>{heldItem.count}</strong>
        </div>
      )}

      {/* 5. COZY DIALOG INTERFACES */}

      {/* A. PIERRE'S OVERHAULED SHOP MODAL */}
      <Dialog open={shopOpen} onOpenChange={setShopOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-3xl bg-[#141517] border-[3px] border-[#4a5568] text-slate-100 rounded-sm font-mono shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2 text-[#e2e8f0] border-b border-[#4a5568] pb-3 bg-[#1e222a] -mt-6 -mx-6 px-6 pt-6">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span>Pierre's Village Depot</span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab buttons */}
          <div className="flex border-b border-slate-800 gap-1 my-2 overflow-x-auto">
            {(["all_items", "seeds", "animals", "upgrades", "sell", "hire"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setShopTab(tab)}
                className={`px-3 py-1.5 text-xs font-bold uppercase transition-all rounded-none whitespace-nowrap ${shopTab === tab
                    ? "bg-[#2d3748] text-amber-400 border-t-2 border-[#ff9200] shadow-inner"
                    : "bg-[#2f3136] text-slate-400 hover:text-slate-200 border-t-2 border-transparent"
                  }`}
              >
                {tab === "all_items" ? "🛒 All Items Store" : tab}
              </button>
            ))}
          </div>

          <div className="py-2 min-h-[260px] max-h-[360px] overflow-y-auto pr-1">
            {/* 1. ALL ITEMS STORE CATALOG */}
            {shopTab === "all_items" && (
              <div className="space-y-3">
                {/* Search & Category filter header */}
                <div className="flex flex-col sm:flex-row gap-2 justify-between items-center bg-[#1b1e24] p-2 border border-slate-800">
                  <input
                    type="text"
                    placeholder="🔍 Search all items (e.g. Iron, Seed, Drone, Circuit)..."
                    value={shopSearchTerm}
                    onChange={(e) => setShopSearchTerm(e.target.value)}
                    className="w-full sm:w-72 bg-[#111317] border border-slate-700 px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff9200]"
                  />
                  <div className="flex gap-1 overflow-x-auto max-w-full">
                    {(["all", "tool", "seed", "crop", "resource", "logistics"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setShopCategoryFilter(cat)}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase transition-all ${shopCategoryFilter === cat
                            ? "bg-[#ff9200] text-black"
                            : "bg-[#282c34] text-slate-400 hover:bg-[#383e4a]"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {Object.values(ITEM_DEFS)
                    .filter((item) => {
                      const matchSearch =
                        item.name.toLowerCase().includes(shopSearchTerm.toLowerCase()) ||
                        item.description.toLowerCase().includes(shopSearchTerm.toLowerCase()) ||
                        item.id.toLowerCase().includes(shopSearchTerm.toLowerCase());
                      const matchCat =
                        shopCategoryFilter === "all"
                          ? true
                          : shopCategoryFilter === "logistics"
                            ? ["chest", "iron_chest", "steel_chest", "logistics_chest", "sprinkler_basic", "sprinkler_quality", "transport_belt", "inserter", "logistics_drone", "drone_hub", "electric_drill", "furnace", "assembling_machine", "generator", "solar_panel", "battery", "wood_cutter", "stone_cutter"].includes(item.id) || item.type === "resource"
                            : item.type === shopCategoryFilter;
                      return matchSearch && matchCat;
                    })
                    .map((item) => {
                      const buyPrice = item.price > 0 ? Math.ceil(item.price * 1.5) : 25;
                      return (
                        <div
                          key={item.id}
                          className="p-2 bg-[#181a1c] border border-slate-800 flex justify-between items-center gap-2 hover:border-slate-700"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold text-base bg-[#252830] text-white border border-slate-700">
                              {item.iconSymbol || "📦"}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs truncate text-slate-200">{item.name}</div>
                              <div className="text-[9px] text-slate-400 truncate">{item.description || item.type}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              className="text-[10px] px-2 py-1 bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] font-mono"
                              onClick={() => handleBuy(item.id, buyPrice, 1)}
                            >
                              1x ({buyPrice}g)
                            </Button>
                            {item.type !== "tool" && (
                              <Button
                                size="sm"
                                className="text-[10px] px-2 py-1 bg-[#282c34] border border-slate-700 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500 font-mono"
                                onClick={() => handleBuy(item.id, buyPrice, 10)}
                              >
                                10x ({buyPrice * 10}g)
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Seeds catalog */}
            {shopTab === "seeds" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {shopInventoryForSeason(state.season).map((crop) => {
                  const seedId = `${crop.id}_seed`;
                  const seedDef = ITEM_DEFS[seedId];
                  return (
                    <div
                      key={crop.id}
                      className="p-2.5 bg-[#181a1c] border border-slate-800 flex justify-between items-center rounded-none"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-8 h-8 flex items-center justify-center font-bold text-sm rounded-none text-white"
                          style={{ backgroundColor: crop.accent }}
                        >
                          {seedDef?.iconSymbol || "⁘"}
                        </span>
                        <div>
                          <div className="font-bold text-xs">{crop.name} Seed</div>
                          <div className="text-[9px] text-slate-400">Yield: {crop.growDays} days</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono"
                        onClick={() => handleBuy(seedId, crop.seedPrice)}
                      >
                        Buy: {crop.seedPrice}g
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Animals & Milk pail catalog */}
            {shopTab === "animals" && (
              <div className="space-y-2">
                {[
                  { id: "chick", name: "Baby Chick", price: 150, symbol: "🐤" },
                  { id: "calf", name: "Baby Calf", price: 400, symbol: "🐮" },
                  { id: "milk_pail", name: "Milk Pail", price: 30, symbol: "🪣" },
                  { id: "pet_bowl_dog", name: "Dog Bowl", price: 500, symbol: "🥣" },
                  { id: "pet_bowl_cat", name: "Cat Bowl", price: 500, symbol: "🥣" },
                  { id: "worker_cabin", name: "Worker Cabin", price: 1000, symbol: "🛖" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-[#181a1c] border border-slate-805 flex justify-between items-center rounded-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.symbol}</span>
                      <div>
                        <div className="font-bold text-xs">{item.name}</div>
                        <div className="text-[9px] text-slate-400">
                          {ITEM_DEFS[item.id]?.description}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono"
                      onClick={() => handleBuy(item.id, item.price)}
                    >
                      Buy: {item.price}g
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Sell inventory items */}
            {shopTab === "sell" && (
              <div className="space-y-3">
                {/* Sell All Banner */}
                <div className="flex justify-between items-center p-2.5 bg-[#1b1e24] border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">
                    Total Inventory Sell Value:{" "}
                    <span className="text-amber-400 font-extrabold text-sm">
                      {state.inventory.reduce((sum, item) => sum + (item && item.price ? item.price * item.count : 0), 0)}g
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 font-mono rounded-none border border-emerald-400 shadow-md"
                    onClick={handleSellAllItems}
                  >
                    💰 Sell All Items
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {state.inventory.map((item, idx) => {
                    if (!item || !item.price) return null;
                    return (
                      <div
                        key={`${item.id}_${idx}`}
                        className="p-2.5 bg-[#181a1c] border border-slate-800 flex justify-between items-center rounded-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{item.iconSymbol || "📦"}</span>
                          <div>
                            <div className="font-bold text-xs">{item.name}</div>
                            <div className="text-[9px] text-slate-400">Qty: {item.count} | Value: {item.price * item.count}g</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="text-[10px] px-2 py-1 bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-emerald-500/25 hover:border-emerald-500 hover:text-emerald-400 rounded-none font-mono"
                            onClick={() => {
                              setState((prev) => {
                                const next = structuredClone(prev);
                                next.coins += item.price;
                                if (next.inventory[idx]!.count > 1) {
                                  next.inventory[idx]!.count--;
                                } else {
                                  next.inventory[idx] = null;
                                }
                                gameAudio.playCoin();
                                return next;
                              });
                            }}
                          >
                            1x (+{item.price}g)
                          </Button>
                          {item.count > 1 && (
                            <Button
                              size="sm"
                              className="text-[10px] px-2 py-1 bg-emerald-700/50 border border-emerald-500 text-emerald-200 hover:bg-emerald-600 rounded-none font-mono font-bold"
                              onClick={() => {
                                setState((prev) => {
                                  const next = structuredClone(prev);
                                  const totalVal = item.price * item.count;
                                  next.coins += totalVal;
                                  next.inventory[idx] = null;
                                  gameAudio.playCoin();
                                  toast.success(`Sold ${item.count}x ${item.name} for +${totalVal}g!`);
                                  return next;
                                });
                              }}
                            >
                              Stack ({item.count}x)
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {state.inventory.every((item) => !item || !item.price) && (
                    <div className="col-span-1 sm:col-span-2 text-center text-slate-500 text-xs py-8">
                      You have no sellable items in your inventory.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hire Workers */}
            {shopTab === "hire" && (
              <div className="space-y-2">
                <div className="p-3 bg-[#181a1c] border border-slate-805 flex flex-col gap-2 rounded-none">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👷</span>
                    <div>
                      <div className="font-bold text-sm text-[#ff9200]">Hire a Worker</div>
                      <div className="text-xs text-slate-400">
                        Requires a vacant Worker Cabin to house them.<br />
                        Workers automate farming, mining, and woodcutting.
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono mt-2"
                    onClick={() => {
                      // Find an available worker cabin
                      let emptyCabin = null;
                      if (!state.workers) state.workers = [];
                      for (let y = 0; y < state.tiles.length; y++) {
                        for (let x = 0; x < state.tiles[y].length; x++) {
                          const tile = state.tiles[y][x];
                          if (tile.kind === "placed_item" && tile.placedItemId === "worker_cabin") {
                            // Check if this cabin already belongs to a worker
                            const occupant = state.workers.find(w => w.cabinX === x && w.cabinY === y);
                            if (!occupant) {
                              emptyCabin = { x, y };
                              break;
                            }
                          }
                        }
                        if (emptyCabin) break;
                      }

                      if (!emptyCabin) {
                        toast.error("You need to buy and place a Worker Cabin first!");
                        return;
                      }

                      if (state.coins < 1000) {
                        toast.error("Not enough gold to hire a worker (1000g).");
                        return;
                      }

                      setState(prev => {
                        const next = structuredClone(prev);
                        next.coins -= 1000;
                        if (!next.workers) next.workers = [];
                        next.workers.push({
                          id: `worker_${Date.now()}`,
                          name: `Worker #${next.workers.length + 1}`,
                          cabinX: emptyCabin!.x,
                          cabinY: emptyCabin!.y,
                          x: emptyCabin!.x,
                          y: emptyCabin!.y,
                          subX: emptyCabin!.x,
                          subY: emptyCabin!.y,
                          task: "idle",
                          role: "idle",
                          inventory: null,
                          energy: 100,
                          hasEatenToday: false,
                          walkTimer: Math.random() * 3 + 2,
                          actionTimer: 0,
                          statusText: "Just hired!",
                        });
                        gameAudio.playCoin();
                        toast.success("Worker Hired!");
                        return next;
                      });
                    }}
                  >
                    Hire Worker (1000g)
                  </Button>
                </div>
              </div>
            )}

            {/* Tool upgrades */}
            {shopTab === "upgrades" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(["hoe", "watering", "scythe", "pickaxe", "axe"] as const).map((tId) => {
                  const lvl = state.upgrades[tId] || 1;
                  const cost = getUpgradeCost(tId, lvl);
                  return (
                    <div
                      key={tId}
                      className="p-3 bg-[#181a1c] border border-slate-805 flex flex-col justify-between text-xs rounded-none"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="capitalize font-extrabold text-[#ff9200]">
                          {tId === "watering" ? "Watering Can" : tId}
                        </span>
                        <span className="text-slate-400 font-bold font-mono">Level {lvl}</span>
                      </div>

                      {cost ? (
                        <div className="text-[10px] text-slate-350 font-mono mb-2 flex flex-col gap-0.5">
                          <span className="text-slate-500">Requires:</span>
                          <span className="text-amber-400 font-bold">{cost.label}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-450 font-bold font-mono mb-2">MAX LEVEL REACHED</span>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={lvl >= 4}
                        className="w-full text-xs bg-[#3a3f44] border-slate-750 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] font-mono mt-auto rounded-none"
                        onClick={() => handleUpgrade(tId)}
                      >
                        {lvl >= 4 ? "MAX" : `Upgrade to Lv.${lvl + 1}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
            <Button size="sm" variant="outline" className="flex-1 text-xs text-slate-300 border-slate-700 hover:bg-slate-800 rounded-none" onClick={handleSellAllItems}>
              💰 Sell All Items in Inventory
            </Button>
            <Button size="sm" className="text-xs bg-[#ff9200] hover:bg-[#ff9200]/80 text-[#141517] font-bold rounded-none" onClick={() => setShopOpen(false)}>
              Close Shop
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MULTIPLAYER ROOMS & SEPARATE MAPS DIALOG */}
      <Dialog open={multiplayerOpen} onOpenChange={setMultiplayerOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-2xl bg-[#121418] border-[3px] border-[#38b2ac] text-slate-100 rounded-sm font-mono shadow-[0_0_25px_rgba(56,178,172,0.4)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2 text-[#38b2ac] border-b border-[#2d3748] pb-3 bg-[#1a202c] -mt-6 -mx-6 px-6 pt-6">
              <Users className="h-6 w-6 text-[#38b2ac]" />
              <span>Multiplayer Rooms & Separate Maps</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Active Room Info */}
            <div className="p-3 bg-[#1a202c] border border-[#38b2ac]/50 flex justify-between items-center">
              <div>
                <div className="text-xs text-slate-400">Current Joined Room & Map:</div>
                <div className="text-sm font-extrabold text-[#38b2ac] flex items-center gap-2">
                  <span>{availableRooms.find((r) => r.id === (state.currentRoomId || "room_global_1"))?.name || "🌐 Global Meadow #1"}</span>
                  <span className="px-1.5 py-0.5 bg-[#38b2ac]/20 border border-[#38b2ac] text-[10px]">
                    Code: {state.currentRoomCode || "MEADOW-1"}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500 text-xs font-bold animate-pulse">
                🟢 ACTIVE MAP
              </span>
            </div>

            {/* Room List Header */}
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select a Room to Join & Load Its Separate Map:
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {availableRooms.map((room) => {
                const isActive = (state.currentRoomId || "room_global_1") === room.id;
                return (
                  <div
                    key={room.id}
                    className={`p-3 border flex justify-between items-center transition-all ${isActive
                        ? "bg-[#1c2e36] border-[#38b2ac] shadow-[0_0_10px_rgba(56,178,172,0.3)]"
                        : "bg-[#16181d] border-slate-800 hover:border-slate-600"
                      }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span>{room.name}</span>
                        <span className="px-1.5 py-0.5 bg-[#252830] text-amber-400 text-[10px] border border-slate-700">
                          {room.code}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>👥 Players: {room.players.length + (isActive ? 1 : 0)}/{room.maxPlayers}</span>
                        <span>🗺 Map Seed: {room.mapSeed}</span>
                      </div>
                    </div>

                    {isActive ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 border border-emerald-600">
                        Current Map
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-[#38b2ac]/20 border border-[#38b2ac] text-[#38b2ac] hover:bg-[#38b2ac] hover:text-black font-bold text-xs rounded-none font-mono"
                        onClick={() => handleSwitchRoom(room)}
                      >
                        Join & Load Map
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create Custom Room Section */}
            <div className="p-3 bg-[#16181d] border border-slate-800 space-y-2 mt-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <span>➕ Create Custom Multiplayer Room & Separate Map</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Room Name (e.g. Factorio Co-Op)"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="bg-[#0f1115] border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38b2ac]"
                />
                <input
                  type="text"
                  placeholder="Room Code (e.g. FARM-90)"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value)}
                  className="bg-[#0f1115] border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38b2ac]"
                />
              </div>
              <Button
                size="sm"
                className="w-full bg-[#ff9200] hover:bg-amber-500 text-black font-extrabold text-xs py-1.5 font-mono rounded-none shadow-md mt-1"
                onClick={handleCreateRoom}
              >
                🚀 Create Room & Generate Separate Map
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* B. MAILBOX LETTERS DIALOG OVERLAY */}
      <Dialog open={mailboxOpen} onOpenChange={setMailboxOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400 border-b border-[#5d4037] pb-2">
              <Mail className="h-5 w-5 text-amber-500" />
              <span>Your Mailbox Letters</span>
            </DialogTitle>
          </DialogHeader>

          {readingLetter ? (
            /* Open Letter */
            <div className="space-y-4 py-2 font-mono">
              <div className="text-xs border-b border-[#5d4037]/50 pb-1.5 flex justify-between">
                <span>From: <span className="font-bold text-amber-400">{readingLetter.sender}</span></span>
                <span>To: <span className="text-stone-400">Cozy Farmer</span></span>
              </div>
              <p className="text-xs text-stone-200 leading-relaxed bg-[#3e2723]/35 p-3 rounded border border-[#5d4037]/40">
                {readingLetter.content}
              </p>

              {/* Gift attached */}
              {readingLetter.giftItemId && (
                <div className="p-3 bg-stone-900/40 border border-amber-500/20 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {ITEM_DEFS[readingLetter.giftItemId]?.iconSymbol || "🎁"}
                    </span>
                    <span className="text-xs text-amber-400">
                      Gift: {readingLetter.giftItemId.replace("_", " ")} (x{readingLetter.giftCount})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    disabled={readingLetter.claimed}
                    onClick={() => handleClaimMailGift(readingLetter.id)}
                  >
                    {readingLetter.claimed ? "Claimed" : "Claim Gift"}
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setReadingLetter(null)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            /* Letters list */
            <div className="space-y-2 max-h-[260px] overflow-y-auto py-2">
              {state.mailboxLetters.map((letter) => (
                <button
                  key={letter.id}
                  onClick={() => setReadingLetter(letter)}
                  className={`w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all ${letter.claimed
                      ? "bg-[#3e2723]/20 border-[#5d4037]/30 text-stone-400"
                      : "bg-[#3e2723]/50 border-[#5d4037] text-stone-100 hover:bg-[#3e2723]/70"
                    }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className={`h-4 w-4 ${letter.claimed ? "opacity-40" : "text-amber-500"}`} />
                    <div>
                      <span className="font-bold">{letter.sender}</span>
                      <span className="block text-[9px] text-stone-400">
                        {letter.giftItemId && !letter.claimed ? "★ Contains Gift" : "Read Letter"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono">Open →</span>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="text-xs" onClick={() => setMailboxOpen(false)}>
              Close Mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C. SLEEP OVERNIGHT LEDGER (STAYS FOR CONSISTENCY) */}
      <Dialog open={sleepSummary !== null} onOpenChange={handleCloseSleepSummary}>
        {sleepSummary && (
          <DialogContent container={mainContainerRef.current} className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-center text-amber-400 border-b border-[#5d4037] pb-2">
                🌾 Meadow Valley Shipping Ledger 🌾
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2 py-3 max-h-[280px] overflow-y-auto">
              {sleepSummary.items.map((line, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2 bg-[#3e2723]/30 rounded border border-[#5d4037]/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]"
                      style={{ backgroundColor: line.iconColor }}
                    >
                      🌾
                    </span>
                    <span>
                      {line.name} <span className="text-stone-400 font-mono">x{line.count}</span>
                    </span>
                  </div>
                  <span className="font-bold text-amber-400">+{line.earnings}g</span>
                </div>
              ))}

              <div className="flex justify-between items-center border-t border-[#5d4037] pt-3 font-bold text-sm">
                <span>Overnight Net Profits:</span>
                <span className="text-yellow-400 font-mono text-base">+{sleepSummary.total}g</span>
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full text-xs font-bold" onClick={handleCloseSleepSummary}>
                Wake Up (Day {state.day})
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent container={mainContainerRef.current} className="survey-sheet max-w-[850px] w-[96vw]">
          <DialogHeader>
            <DialogTitle>Meadow Basin Survey</DialogTitle>
            <DialogDescription>Locate resources and check the perimeter.</DialogDescription>
          </DialogHeader>
          <div className="survey-tools">
            <button className="yard-command" aria-pressed={chartMode === "local"} onClick={() => setChartMode("local")}>Yard</button>
            <button className="yard-command" aria-pressed={chartMode === "region"} onClick={() => setChartMode("region")}>Region</button>
            <button className="yard-command" aria-pressed={chartPollution} onClick={() => setChartPollution(on => !on)}>Emissions</button>
            <span>E {state.player.x} · N {state.player.y}</span>
          </div>
          <canvas className="survey-canvas" ref={chartRef} width={780} height={460} aria-label="Terrain survey" />
          <div className="survey-key">
            <span><i style={{background: "#f7edb9"}} />Engineer</span>
            <span><i style={{background: "#bcb8a6"}} />Iron</span>
            <span><i style={{background: "#c48965"}} />Copper</span>
            <span><i style={{background: "#292b23"}} />Coal</span>
            <span><i style={{background: "#ed8a72"}} />Scouts</span>
            <span><i style={{background: "#cbb972"}} />Turret range</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* D. FACTORIO CHARACTER & LOGISTICS JOURNAL GUI */}
      {inventoryOpen && (<Dialog open={inventoryOpen} onOpenChange={closeInventory}>
        <DialogContent container={mainContainerRef.current} onOpenAutoFocus={(event) => {
          const firstSlot = (event.target as HTMLElement | null)?.querySelector<HTMLButtonElement>("[data-backpack-slot]");
          if (firstSlot) {
            event.preventDefault();
            firstSlot.focus();
          }
        }} className="w-[98vw] max-w-5xl max-h-[92dvh] bg-[#1d2127] border-[3px] border-[#3a4454] text-slate-100 rounded-sm font-mono shadow-[0_10px_35px_rgba(0,0,0,0.95)] overflow-y-auto p-3 sm:p-4 select-none">
          {/* Factorio Steel Bevel Header Bar */}
          <DialogHeader className="m-0 p-0">
            <DialogTitle className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-between text-[#ff9200] border-b-2 border-[#2d3542] pb-2 bg-[#161a20] -mt-3 -mx-3 sm:-mt-4 sm:-mx-4 px-3 sm:px-4 pt-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🏭</span>
                <span className="text-slate-100 font-extrabold">CHARACTER & CRAFTING</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-yellow-400 font-bold">🪙 {state.coins}G</span>
                <span className="text-emerald-400 font-bold">⚡ {Math.round(state.energy)}/{state.maxEnergy}</span>
                <span className="text-red-400 font-bold">❤️ {state.player.health}/{state.player.maxHealth}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Factorio Main Character GUI (Dual Panel: Inventory Left + Crafting Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2 font-mono">
            {/* ======================================================== */}
            {/* LEFT PANEL: CHARACTER EQUIPMENT & 40-SLOT INVENTORY      */}
            {/* ======================================================== */}
            <div className="bg-[#16191f] p-2.5 border-2 border-[#2c3543] rounded-sm flex flex-col justify-between space-y-2">
              <div>
                {/* Character Equipment Bar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-[#12151a] border border-[#27303d] rounded-sm mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-[10px]">Loadout</span>
                    <select aria-label="Equipped weapon" className="yard-command" value={loadout.item?.id ?? ""} onChange={e => {
                      const weaponId = e.target.value;
                      setState(prev => ({ ...prev, player: { ...prev.player, weaponId } }));
                    }}>
                      {loadout.item ? [...new Set(state.inventory.filter(item => item?.type === "weapon").map(item => item!.id))]
                        .filter(id => ["pistol", "submachine_gun", "shotgun", "combat_shotgun"].includes(id))
                        .map(id => <option key={id} value={id}>{ITEM_DEFS[id].name}</option>) : <option value="">Unarmed</option>}
                    </select>
                    {loadout.item && <span className="text-amber-300 text-xs">{loadout.rounds} ammo</span>}
                  </div>

                  {/* Right action controls */}
                  <div className="flex items-center gap-1">
                    {heldItem && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[9px] h-6 px-1.5 bg-amber-950/80 border-amber-500 text-amber-300 hover:bg-amber-900 rounded-none font-mono"
                        onClick={() => setState(prev => {
                          const next = { ...prev, inventory: inventoryCopy(prev.inventory) };
                          returnCursor(next);
                          return next;
                        })}
                      >
                        Clear (Q)
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[9px] h-6 px-2 bg-[#253041] border-slate-600 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono"
                      onClick={handleSortInventory}
                    >
                      🔄 Sort
                    </Button>
                  </div>
                </div>

                {/* Factorio 40-Slot Character Grid (10 columns x 4 rows) */}
                <div className="bg-[#101318] p-1.5 border border-[#27303d] rounded-sm">
                  <div className="grid grid-cols-10 gap-1">
                    {state.inventory.map((item, idx) => (
                      <button
                        key={idx}
                        data-backpack-slot={idx}
                        onClick={(e) => handleSlotClick(idx, "inventory", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                        onMouseEnter={() => { backpackHover.current = item?.id ?? null; setHoveredItem(item); }}
                        onMouseLeave={() => { backpackHover.current = null; setHoveredItem(null); }}
                        title={item ? `${item.name} · ${item.count}` : "Empty backpack slot"}
                        className={`relative flex items-center justify-center h-9 w-full transition-all rounded-xs ${
                          item && state.quickbar.includes(item.id) ? "border-amber-700/60" : ""
                        } ${item
                            ? "bg-[#1f2633] hover:bg-[#283244] border border-[#3b4759] hover:border-[#ff9200] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] text-slate-100"
                            : "bg-[#13161c] border border-[#222833] shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)] text-slate-700 hover:border-slate-600"
                          }`}
                      >
                        {item ? (
                          <>
                            <StackIcon item={item} />
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 px-0.5 bg-black/90 rounded-[2px] text-[7.5px] font-bold text-amber-300 font-mono border border-black leading-none">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] opacity-10 text-stone-300">-</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hover Details Card */}
              <div className="mt-1">
                {hoveredItem ? (
                  <div className="p-2 bg-[#12151a] border border-[#27303d] rounded-sm flex items-start gap-2 text-[10px]">
                    <span className="text-2xl bg-[#1d222b] p-1 rounded-sm border border-[#27303d]">{hoveredItem.iconSymbol || "🎁"}</span>
                    <div className="flex-1">
                      <div className="flex justify-between font-bold">
                        <span className="text-[#ff9200] text-xs">{hoveredItem.name}</span>
                        {hoveredItem.price > 0 && <span className="text-yellow-400">{hoveredItem.price}g</span>}
                      </div>
                      <p className="text-zinc-400 text-[10px] mt-0.5 leading-tight">{hoveredItem.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-[#12151a]/50 border border-dashed border-[#27303d] rounded-sm text-center text-zinc-500 text-[10px]">
                    Left-click to lift a stack. Right-click to split or place one. Hover over a stack and press 1–0 to bind a shortcut.
                  </div>
                )}
              </div>
            </div>

            {/* ======================================================== */}
            {/* RIGHT PANEL: FACTORIO CRAFTING & RECIPES                 */}
            {/* ======================================================== */}
            <div className="bg-[#16191f] p-2.5 border-2 border-[#2c3543] rounded-sm flex flex-col justify-between space-y-2">
              <div className="space-y-1.5">
                <input type="search" className="yard-recipe-search" aria-label="Search recipes" placeholder="Search all recipes" value={recipeSearch} onChange={event => setRecipeSearch(event.target.value)} />
                {/* Recipe categories */}
                <div className="flex flex-wrap gap-1 border-b border-[#2d3542] pb-1.5">
                  {([
                    { id: "logistics", label: "Logistics", icon: "🚜" },
                    { id: "production", label: "Production", icon: "🏭" },
                    { id: "intermediates", label: "Intermediates", icon: "⚙️" },
                    { id: "space", label: "Space", icon: "🚀" },
                    { id: "combat", label: "Combat", icon: "⚔️" },
                  ] as const).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCraftingCategory(cat.id as any)}
                      className={`flex items-center gap-1 px-2 py-1 text-[10px] border font-bold transition-all rounded-xs cursor-pointer ${
                        craftingCategory === cat.id
                          ? "bg-[#253041] border-[#ff9200] text-amber-300 font-extrabold shadow-sm"
                          : "bg-[#12151a] border-[#27303d] text-zinc-400 hover:bg-[#1d222b] hover:text-slate-200"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                {/* Compact Factorio 8-Column Recipe Grid */}
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 p-1 bg-[#101318] rounded-sm border border-[#27303d] max-h-[220px] overflow-y-auto">
                  {(recipeSearch.trim() ? CRAFTING_RECIPES.filter(recipe => recipe.name.toLowerCase().includes(recipeSearch.trim().toLowerCase()))
                    : (recipesByCategory[craftingCategory] || [])).map((recipe) => {
                      const itemDef = ITEM_DEFS[recipe.outputId];
                      const isFree = state.freeCraft || state.godMode;
                      const isTechLocked = !isFree && recipe.techRequired && !(state.unlockedTechs || []).includes(recipe.techRequired);
                      const plan = planHandcraft(state, recipe, 1);
                      const canCraft = isFree || (!isTechLocked && plan.canCraft);

                      const maxCount = canCraft ? (isFree ? 100 : maxCraftable(state, recipe)) : 0;

                      return (
                        <FactorioCraftingIcon
                          key={recipe.id}
                          iconSymbol={itemDef?.iconSymbol || "⚙"}
                          name={recipe.name}
                          count={recipe.outputCount}
                          craftableCount={maxCount}
                          canCraft={canCraft}
                          isTechLocked={isTechLocked}
                          isSelected={hoveredRecipe?.id === recipe.id}
                          onMouseEnter={() => setHoveredRecipe(recipe)}
                          onMouseLeave={() => setHoveredRecipe(null)}
                          onClick={(e) => handleStartCrafting(recipe, 1, e.shiftKey)}
                          onContextMenu={() => handleStartCrafting(recipe, 5, false)}
                        />
                      );
                    })}
                </div>
              </div>

              {/* Recipe Flow Card Inspector */}
              <div className="bg-[#12151a] p-2 rounded-sm border border-[#27303d] text-[10px]">
                {hoveredRecipe ? (() => {
                  const itemDef = ITEM_DEFS[hoveredRecipe.outputId];
                  const isTechLocked = hoveredRecipe.techRequired && !(state.unlockedTechs || []).includes(hoveredRecipe.techRequired);
                  const plan = planHandcraft(state, hoveredRecipe, 1);

                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center border-b border-[#27303d] pb-1">
                        <span className="font-bold text-[#ff9200] text-xs flex items-center gap-1">
                          {hoveredRecipe.name} {isTechLocked && "🔒"}
                        </span>
                        <span className="text-[9px] text-amber-400">⏱️ {hoveredRecipe.craftTimeSeconds || 0.5}s</span>
                      </div>

                      {/* Ingredient Flow Diagram */}
                      <div className="flex items-center gap-1 overflow-x-auto py-1">
                        {hoveredRecipe.inputs.map((inp) => {
                          const playerHas = getGlobalItemCount(state.inventory, inp.itemId);
                          const hasDirect = playerHas >= inp.count;
                          return (
                            <div key={inp.itemId} className={`px-1.5 py-0.5 rounded-sm border flex items-center gap-1 ${hasDirect ? "border-green-800 bg-green-950/30 text-green-300" : "border-amber-800 bg-amber-950/30 text-amber-300"}`}>
                              <span>{ITEM_DEFS[inp.itemId]?.iconSymbol || "📦"}</span>
                              <span className="font-bold">{playerHas}/{inp.count}</span>
                            </div>
                          );
                        })}
                        <span className="text-orange-400 font-bold">➔</span>
                        <div className="px-1.5 py-0.5 bg-orange-950/50 border border-orange-600 rounded-sm text-orange-300 font-bold flex items-center gap-1">
                          <span>{itemDef?.iconSymbol || "⚙️"}</span>
                          <span>{hoveredRecipe.outputCount}x</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-zinc-800">
                        <button
                          onClick={() => handleStartCrafting(hoveredRecipe, 1, false)}
                          disabled={!plan.canCraft}
                          className={`py-1 rounded-none font-bold text-[9px] cursor-pointer ${plan.canCraft ? "bg-orange-600 hover:bg-orange-500 text-white" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                        >
                          Craft 1
                        </button>
                        <button
                          onClick={() => handleStartCrafting(hoveredRecipe, 5, false)}
                          disabled={!plan.canCraft}
                          className={`py-1 rounded-none font-bold text-[9px] cursor-pointer ${plan.canCraft ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                        >
                          Craft 5
                        </button>
                        <button
                          onClick={() => handleStartCrafting(hoveredRecipe, 1, true)}
                          disabled={!plan.canCraft}
                          className={`py-1 rounded-none font-bold text-[9px] cursor-pointer ${plan.canCraft ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                        >
                          Craft All
                        </button>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-center text-zinc-500 py-1 text-[10px]">
                    Hover recipe to inspect costs. Left-click 1x | Right-click 5x | Shift-click All
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-[#2d3542] pt-2 mt-2 flex justify-end">
            <Button variant="outline" className="text-xs bg-[#161a20] border-slate-600 text-slate-300 hover:bg-[#202836] rounded-none font-mono" onClick={() => closeInventory(false)}>
              Back to Game (E)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>)}

      {/* E. CHEST STORAGE INTERFACE */}
      {chestOpenTile && (() => {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        const tile = grid[chestOpenTile.y]?.[chestOpenTile.x];
        if (!tile) return null;

        const isCabin = tile.placedItemId === "worker_cabin";
        const maxSlotCount = getChestSlotCount(tile.placedItemId);
        if (!tile.chestInventory || tile.chestInventory.length < maxSlotCount) {
          const current = tile.chestInventory || [];
          tile.chestInventory = Array.from({ length: maxSlotCount }, (_, i) => current[i] || null);
        }
        const chestInventory = tile.chestInventory;
        const barLimit = tile.chestBarLimit ?? maxSlotCount;
        const containerTitle = isCabin
          ? "Worker Cabin Feed Box"
          : tile.placedItemId === "iron_chest"
            ? "Iron Chest (24 Slots)"
            : tile.placedItemId === "steel_chest"
              ? "Steel Storage Container (48 Slots)"
              : tile.placedItemId === "logistics_chest"
                ? "Logistics Storage Hub (60 Slots)"
                : "Wood Chest (12 Slots)";

        return (
          <Dialog open={true} onOpenChange={() => setChestOpenTile(null)}>
            <DialogContent container={mainContainerRef.current} className="max-w-xl bg-[#16191e] border-2 border-[#ff9200]/60 text-stone-100 rounded-sm font-mono shadow-[0_0_20px_rgba(0,0,0,0.9)]">
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold flex items-center justify-between text-[#ff9200] border-b border-[#2d3644] pb-2 uppercase tracking-wide">
                  <div className="flex items-center gap-2">
                    <Compass className="h-5 w-5 text-[#ff9200]" />
                    <span>{containerTitle}</span>
                  </div>
                  <Badge variant="outline" className="border-[#ff9200]/40 text-[#ff9200] bg-[#ff9200]/10 text-[10px]">
                    Bar Limit: {barLimit}/{maxSlotCount}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Storage Quick Action Bar */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#1b2027] border border-[#2d3644] rounded-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-6 px-2 bg-[#252c36] border-[#3e4856] text-amber-300 hover:bg-[#ff9200] hover:text-black font-extrabold"
                    onClick={() => {
                      setState((prev) => {
                        const next = structuredClone(prev);
                        const g = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
                        const t = g[chestOpenTile.y]?.[chestOpenTile.x];
                        if (!t || !t.chestInventory) return prev;
                        const existingIds = new Set(t.chestInventory.filter(Boolean).map((i) => i!.id));
                        const max = t.chestBarLimit ?? t.chestInventory.length;
                        let moved = 0;
                        for (let i = 0; i < next.inventory.length; i++) {
                          const item = next.inventory[i];
                          if (item && existingIds.has(item.id)) {
                            for (let s = 0; s < max; s++) {
                              if (t.chestInventory[s] === null) {
                                t.chestInventory[s] = structuredClone(item);
                                next.inventory[i] = null;
                                moved += item.count;
                                break;
                              } else if (t.chestInventory[s]!.id === item.id && t.chestInventory[s]!.count < 99) {
                                const add = Math.min(99 - t.chestInventory[s]!.count, item.count);
                                t.chestInventory[s]!.count += add;
                                item.count -= add;
                                moved += add;
                                if (item.count <= 0) { next.inventory[i] = null; break; }
                              }
                            }
                          }
                        }
                        if (moved > 0) toast.success(`Deposited ${moved} matching items into storage`);
                        return next;
                      });
                    }}
                  >
                    📥 Deposit Matching
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-6 px-2 bg-[#252c36] border-[#3e4856] text-emerald-300 hover:bg-emerald-600 hover:text-white font-extrabold"
                    onClick={() => {
                      setState((prev) => {
                        const next = structuredClone(prev);
                        const g = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
                        const t = g[chestOpenTile.y]?.[chestOpenTile.x];
                        if (!t || !t.chestInventory) return prev;
                        const max = t.chestBarLimit ?? t.chestInventory.length;
                        let moved = 0;
                        for (let i = 0; i < next.inventory.length; i++) {
                          const item = next.inventory[i];
                          if (item && item.type !== "tool") {
                            for (let s = 0; s < max; s++) {
                              if (t.chestInventory[s] === null) {
                                t.chestInventory[s] = structuredClone(item);
                                next.inventory[i] = null;
                                moved += item.count;
                                break;
                              } else if (t.chestInventory[s]!.id === item.id && t.chestInventory[s]!.count < 99) {
                                const add = Math.min(99 - t.chestInventory[s]!.count, item.count);
                                t.chestInventory[s]!.count += add;
                                item.count -= add;
                                moved += add;
                                if (item.count <= 0) { next.inventory[i] = null; break; }
                              }
                            }
                          }
                        }
                        if (moved > 0) toast.success(`Dumped ${moved} items to storage`);
                        return next;
                      });
                    }}
                  >
                    📦 Dump Pack
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-6 px-2 bg-[#252c36] border-[#3e4856] text-cyan-300 hover:bg-cyan-600 hover:text-white font-extrabold"
                    onClick={() => {
                      setState((prev) => {
                        const next = structuredClone(prev);
                        const g = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
                        const t = g[chestOpenTile.y]?.[chestOpenTile.x];
                        if (!t || !t.chestInventory) return prev;
                        let moved = 0;
                        for (let s = 0; s < t.chestInventory.length; s++) {
                          const item = t.chestInventory[s];
                          if (item) {
                            const success = addItem(next.inventory, structuredClone(item));
                            if (success) {
                              t.chestInventory[s] = null;
                              moved += item.count;
                            }
                          }
                        }
                        if (moved > 0) toast.success(`Retrieved ${moved} items from storage`);
                        return next;
                      });
                    }}
                  >
                    📤 Take All
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-6 px-2 bg-[#252c36] border-[#3e4856] text-stone-300 hover:bg-[#3e4856] font-mono"
                    onClick={handleSortChest}
                  >
                    🔀 Sort Storage
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-[10px] h-6 px-2 border font-mono transition-all ${(tile.chestBarLimit ?? maxSlotCount) < maxSlotCount
                        ? "bg-red-950 border-red-700 text-red-300 hover:bg-red-900"
                        : "bg-[#252c36] border-[#3e4856] text-stone-300 hover:bg-red-950/60 hover:text-red-400"
                      }`}
                    onClick={() => {
                      setState((prev) => {
                        const next = structuredClone(prev);
                        const g = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
                        const t = g[chestOpenTile.y]?.[chestOpenTile.x];
                        if (!t) return prev;
                        const currentLimit = t.chestBarLimit ?? maxSlotCount;
                        // Cycle bar limit: max -> 12 -> 6 -> max
                        t.chestBarLimit = currentLimit === maxSlotCount ? Math.max(6, Math.floor(maxSlotCount / 2)) : maxSlotCount;
                        toast.info(`Red Bar Limiter set to ${t.chestBarLimit} slots`);
                        return next;
                      });
                    }}
                  >
                    🔴 Red Bar Limit (Lock)
                  </Button>
                </div>

                {/* Storage Container Grid */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <h4 className="text-xs font-bold text-[#ff9200] uppercase tracking-wider font-mono">
                      Container Slots ({chestInventory.filter(Boolean).length}/{barLimit})
                    </h4>
                  </div>
                  <div className="grid grid-cols-6 gap-2 bg-[#121417] p-3 rounded-sm border border-[#29303c] max-h-[260px] overflow-y-auto">
                    {chestInventory.map((item, idx) => {
                      const isLockedByBar = idx >= barLimit;
                      return (
                        <button
                          key={idx}
                          disabled={isLockedByBar}
                          onClick={(e) => handleSlotClick(idx, "chest", e)}
                          onContextMenu={(e) => handleSlotRightClick(e, idx, "chest")}
                          onMouseEnter={() => item && setHoveredItem(item)}
                          onMouseLeave={() => setHoveredItem(null)}
                          className={`relative flex items-center justify-center h-12 rounded-xs border-2 transition-all select-none ${isLockedByBar
                              ? "bg-red-950/40 border-red-900/80 text-red-500 opacity-60 cursor-not-allowed"
                              : item
                                ? "bg-[#202821] hover:bg-[#2c382e] border-[#3d5241] hover:border-[#ff9200]"
                                : "bg-[#181a1e] border-[#29303c] hover:border-slate-500"
                            }`}
                        >
                          {isLockedByBar ? (
                            <span className="text-xs font-extrabold text-red-500">❌</span>
                          ) : item ? (
                            <>
                              <span className="text-xl filter drop-shadow">{item.iconSymbol || "📦"}</span>
                              {item.count > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 px-1 bg-[#ff9200] text-black font-extrabold rounded-xs text-[9px] font-mono leading-none">
                                  {item.count}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs opacity-10 text-stone-300">-</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Player Inventory Pack */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider font-mono">Player Pack Pack</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[10px] h-5 px-2 bg-[#252c36] border-[#3e4856] text-stone-300 hover:bg-[#3e4856] font-mono"
                      onClick={handleSortInventory}
                    >
                      Sort Pack
                    </Button>
                  </div>
                  <div className="grid grid-cols-6 gap-2 bg-[#121417] p-3 rounded-sm border border-[#29303c]">
                    {state.inventory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSlotClick(idx, "inventory", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                        onMouseEnter={() => item && setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative flex items-center justify-center h-12 rounded-xs border-2 transition-all ${item
                            ? "bg-[#252a32] hover:bg-[#2f3642] border-[#3e4856] hover:border-[#ff9200]"
                            : "bg-[#181a1e] border-[#29303c]"
                          }`}
                      >
                        {item ? (
                          <>
                            <span className="text-xl filter drop-shadow">{item.iconSymbol || "📦"}</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 px-1 bg-black/70 text-white font-extrabold rounded-xs text-[9px] font-mono leading-none border border-slate-700">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs opacity-10 text-stone-400">-</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detailed Hover Inspection Tooltip */}
                {hoveredItem ? (
                  <div className="p-2.5 bg-stone-950/80 border border-[#5d4037] rounded-lg flex items-start gap-2.5 transition-all">
                    <span className="text-2xl bg-stone-900 p-1 rounded">{hoveredItem.iconSymbol || "🎁"}</span>
                    <div className="flex-1 text-[11px] leading-snug">
                      <div className="flex justify-between items-center font-mono">
                        <span className="font-extrabold text-amber-400">{hoveredItem.name}</span>
                        {hoveredItem.price > 0 && <span className="font-bold text-yellow-500">{hoveredItem.price}g</span>}
                      </div>
                      <p className="text-stone-300 text-[10px] mt-0.5 font-mono">{hoveredItem.description}</p>
                      {(hoveredItem.energyRestore !== undefined || hoveredItem.healthRestore !== undefined) && (
                        <div className="flex gap-2 mt-1 text-[9px] font-bold font-mono">
                          {hoveredItem.energyRestore !== undefined && hoveredItem.energyRestore !== 0 && (
                            <span className="text-emerald-400">⚡ Energy: {hoveredItem.energyRestore > 0 ? "+" : ""}{hoveredItem.energyRestore}</span>
                          )}
                          {hoveredItem.healthRestore !== undefined && hoveredItem.healthRestore !== 0 && (
                            <span className="text-red-400">❤️ Health: {hoveredItem.healthRestore > 0 ? "+" : ""}{hoveredItem.healthRestore}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-stone-950/20 border border-dashed border-stone-850 rounded-lg text-center text-stone-500 text-[10px] py-3 font-mono">
                    Hover over an item to inspect details. Right-click to split stacks.
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" className="text-xs" onClick={() => setChestOpenTile(null)}>
                  Close Chest
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* FACTORIO MACHINE & AUTOMATION INSPECTOR DIALOG */}
      {factorioInspectorTile && (() => {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        const tile = grid[factorioInspectorTile.y]?.[factorioInspectorTile.x];
        if (!tile || !tile.placedItemId) return null;

        const id = tile.placedItemId;
        const isAssembler = id.startsWith("assembling_machine") || id === "chemical_plant";
        const isDrill = id === "burner_drill" || id === "electric_drill";
        const isLab = id === "science_lab";
        const isPower = id === "generator" || id === "boiler" || id === "solar_panel" || id === "battery" || id === "power_pole" || id === "medium_power_pole" || id === "substation";

        const machineTitle = isAssembler
          ? (id === "assembling_machine_3" ? "Assembling Machine 3 (Yellow)" : id === "assembling_machine_2" ? "Assembling Machine 2 (Blue)" : id === "chemical_plant" ? "Chemical Processing Plant" : "Assembling Machine 1 (Gray)")
          : isDrill
            ? (id === "electric_drill" ? "Electric Mining Drill" : "Burner Mining Drill")
            : isLab
              ? "Science Research Lab"
              : isPower
                ? (id === "generator" ? "Steam Generator (900 kW)" : id === "solar_panel" ? "Solar Panel (60kW)" : id === "battery" ? "Accumulator Battery (5MJ)" : "Electric Power Pole")
                : "Industrial Machine";

        const powerStats = state.powerGridStats || { capacityKw: 0, demandKw: 0, satisfaction: 1.0 };
        const powerPct = Math.round(powerStats.satisfaction * 100);

        return (
          <Dialog open={true} onOpenChange={() => setFactorioInspectorTile(null)}>
            <DialogContent container={mainContainerRef.current} className="max-w-xl bg-[#14181f] border-2 border-[#ff9200]/70 text-stone-100 rounded-sm font-mono shadow-[0_0_25px_rgba(0,0,0,0.9)]">
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold flex items-center justify-between text-[#ff9200] border-b border-[#2d3644] pb-2 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚙️</span>
                    <span>{machineTitle}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-bold ${powerPct > 80 ? "border-emerald-500/50 text-emerald-400 bg-emerald-950/40" : "border-amber-500/50 text-amber-400 bg-amber-950/40"}`}>
                    ⚡ Power: {powerPct}%
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Power Grid Status Meter */}
                <div className="p-2.5 bg-[#1b222c] border border-[#2d3a4d] rounded-xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">Grid Capacity: {powerStats.capacityKw} kW</span>
                    <span className="text-amber-400 font-bold">Demand: {powerStats.demandKw} kW</span>
                  </div>
                  <div className="w-28 bg-[#10141a] h-2.5 border border-[#3e4c61] rounded-xs overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-200"
                      style={{ width: `${Math.min(100, powerPct)}%` }}
                    />
                  </div>
                </div>

                {(id === "boiler" || id === "generator") && (
                  <p className="text-xs text-stone-300">Place the boiler within three tiles of water and the steam generator. Ctrl + click the boiler to refuel.</p>
                )}
                {/* 1. ASSEMBLING MACHINE RECIPE & INVENTORY */}
                {isAssembler && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-300 uppercase">Assigned Recipe:</span>
                      <select
                        value={tile.assemblerRecipeId || "iron_gear"}
                        onChange={(e) => {
                          const newRecipeId = e.target.value;
                          setState((prev) => {
                            const next = structuredClone(prev);
                            const g = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
                            const t = g[factorioInspectorTile.y]?.[factorioInspectorTile.x];
                            if (t) {
                              t.assemblerRecipeId = newRecipeId;
                              t.assemblerProgress = 0;
                            }
                            return next;
                          });
                        }}
                        className="bg-[#242d3b] border border-[#3e4f68] text-amber-300 text-xs px-2.5 py-1 rounded-xs font-bold font-mono focus:outline-none focus:border-[#ff9200]"
                      >
                        {CRAFTING_RECIPES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>Crafting Progress</span>
                        <span>{Math.round((tile.assemblerProgress || 0) * 100)}%</span>
                      </div>
                      <div className="w-full bg-[#10141a] h-3 border border-[#3e4c61] rounded-xs overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-100"
                          style={{ width: `${Math.round((tile.assemblerProgress || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Machine Input & Output Inventory Slots */}
                    <div className="grid grid-cols-2 gap-3 bg-[#111419] p-3 rounded-xs border border-[#263140]">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold block mb-1">INPUT SLOTS (0-3)</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[0, 1, 2, 3].map((slotIdx) => {
                            const item = tile.chestInventory?.[slotIdx];
                            return (
                              <button
                                key={slotIdx}
                                onClick={() => handleSlotClick(slotIdx, "chest")}
                                onContextMenu={(e) => handleSlotRightClick(e, slotIdx, "chest")}
                                onMouseEnter={() => item && setHoveredItem(item)}
                                onMouseLeave={() => setHoveredItem(null)}
                                className="relative flex items-center justify-center h-12 bg-[#1e2530] hover:bg-[#283242] border border-[#3c4a5e] rounded-xs transition-all"
                              >
                                {item ? (
                                  <>
                                    <span className="text-xl">{item.iconSymbol || "📦"}</span>
                                    <span className="absolute bottom-0.5 right-1 px-1 bg-black/70 rounded text-[9px] font-bold text-white">
                                      {item.count}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-stone-600">Empty</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-emerald-400 font-bold block mb-1">OUTPUT SLOT (4)</span>
                        <div className="flex items-center justify-center h-[100px] bg-[#1a212b] border-2 border-emerald-500/40 rounded-xs">
                          {tile.chestInventory?.[4] ? (
                            <button
                              onClick={() => handleSlotClick(4, "chest")}
                              onContextMenu={(e) => handleSlotRightClick(e, 4, "chest")}
                              onMouseEnter={() => tile.chestInventory?.[4] && setHoveredItem(tile.chestInventory[4])}
                              onMouseLeave={() => setHoveredItem(null)}
                              className="relative flex flex-col items-center justify-center w-full h-full"
                            >
                              <span className="text-3xl">{tile.chestInventory[4]!.iconSymbol || "⚙️"}</span>
                              <span className="text-xs font-bold text-amber-300 mt-1">{tile.chestInventory[4]!.name}</span>
                              <span className="absolute bottom-1 right-2 px-1.5 bg-emerald-950 border border-emerald-500 rounded text-[10px] font-bold text-emerald-300">
                                x{tile.chestInventory[4]!.count}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-stone-500 font-bold">Producing...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. MINING DRILL INSPECTOR */}
                {isDrill && (
                  <div className="space-y-3 bg-[#111419] p-3 rounded-xs border border-[#263140]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-300 font-bold">Target Ore Deposit:</span>
                      <span className="text-amber-400 font-extrabold">{ITEM_DEFS[tile.drillTargetOre ?? "stone"]?.name}{tile.depositRemaining !== undefined && ` · ${tile.depositRemaining} left`}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-300 font-bold">Ejection Direction:</span>
                      <span className="text-emerald-400 font-extrabold uppercase">{tile.direction || "right"}</span>
                    </div>

                    <p className="text-[11px] text-stone-400 capitalize">{tile.machineStatus ?? "idle"} · {Math.round((tile.drillTimer ?? 0) * 100)}% of next extraction</p>
                    {tile.chestInventory?.[2] && (
                      <button type="button" className="text-emerald-300 underline" onClick={() => {
                        setState(prev => editTile(prev, factorioInspectorTile, (next, grid) => {
                          const inv = grid[factorioInspectorTile.y][factorioInspectorTile.x].chestInventory!;
                          if (inv[2] && addItem(next.inventory, inv[2])) inv[2] = null;
                        }));
                      }}>Take {tile.chestInventory[2].count} × {tile.chestInventory[2].name}</button>
                    )}
                    {id === "burner_drill" && (
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold block mb-1">COAL FUEL SLOT</span>
                        <button
                          onClick={() => handleSlotClick(0, "chest")}
                          onContextMenu={(e) => handleSlotRightClick(e, 0, "chest")}
                          className="relative flex items-center justify-center h-12 w-16 bg-[#1e2530] border border-amber-500/40 rounded-xs"
                        >
                          {tile.chestInventory?.[0] ? (
                            <>
                              <span className="text-xl">🪵</span>
                              <span className="absolute bottom-0.5 right-1 px-1 bg-black/70 rounded text-[9px] font-bold text-white">
                                {tile.chestInventory[0]!.count}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-stone-600">Coal</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. SCIENCE LAB INSPECTOR */}
                {isLab && (
                  <div className="space-y-3 bg-[#111419] p-3 rounded-xs border border-[#263140]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-300 font-bold">Active Research:</span>
                      <span className="text-purple-400 font-extrabold">{state.activeResearchId ? TECHNOLOGIES.find(t => t.id === state.activeResearchId)?.name : "No Research Selected"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block mb-1">SCIENCE PACK INPUT SLOTS (Red, Green, Blue)</span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                          const item = tile.chestInventory?.[slotIdx];
                          return (
                            <button
                              key={slotIdx}
                              onClick={() => handleSlotClick(slotIdx, "chest")}
                              onContextMenu={(e) => handleSlotRightClick(e, slotIdx, "chest")}
                              className="relative flex items-center justify-center h-12 bg-[#1e2530] hover:bg-[#283242] border border-[#3c4a5e] rounded-xs transition-all"
                            >
                              {item ? (
                                <>
                                  <span className="text-xl">{item.iconSymbol || "🧪"}</span>
                                  <span className="absolute bottom-0.5 right-1 px-1 bg-black/70 rounded text-[9px] font-bold text-white">
                                    {item.count}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-stone-600">🧪</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Player Inventory Pack (for transferring items) */}
                <div>
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">Player Inventory</h4>
                  <div className="grid grid-cols-6 gap-2 bg-[#121417] p-3 rounded-sm border border-[#29303c]">
                    {state.inventory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSlotClick(idx, "inventory", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                        onMouseEnter={() => item && setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative flex items-center justify-center h-12 rounded-xs border-2 transition-all ${item
                            ? "bg-[#252a32] hover:bg-[#2f3642] border-[#3e4856] hover:border-[#ff9200]"
                            : "bg-[#181a1e] border-[#29303c]"
                          }`}
                      >
                        {item ? (
                          <>
                            <span className="text-xl filter drop-shadow">{item.iconSymbol || "📦"}</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 px-1 bg-black/70 text-white font-extrabold rounded-xs text-[9px] font-mono leading-none border border-slate-700">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs opacity-10 text-stone-400">-</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="text-xs" onClick={() => setFactorioInspectorTile(null)}>
                  Close Inspector
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* STARDEW VALLEY SLEEP CONFIRMATION DIALOG */}
      {sleepConfirmOpen && (
        <Dialog open={true} onOpenChange={() => setSleepConfirmOpen(false)}>
          <DialogContent container={mainContainerRef.current} className="max-w-xs bg-[#2d1e18] border-2 border-[#5d4037] text-stone-100 rounded-lg font-mono">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-center text-amber-400">
                Go to sleep for the night?
              </DialogTitle>
            </DialogHeader>
            <DialogFooter className="flex justify-center gap-4 border-t border-[#5d4037]/50 pt-3 mt-2">
              <Button
                variant="outline"
                className="bg-[#5d4037]/45 border-[#5d4037] text-amber-400 hover:bg-[#5d4037]/85 font-bold px-4"
                onClick={handleConfirmSleep}
              >
                Yes
              </Button>
              <Button
                variant="outline"
                className="bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 font-bold px-4"
                onClick={() => setSleepConfirmOpen(false)}
              >
                No
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* SHIPPING BIN STORAGE INTERFACE */}
      {shippingBinOpen && (
        <Dialog open={true} onOpenChange={() => setShippingBinOpen(false)}>
          <DialogContent container={mainContainerRef.current} className="max-w-md bg-[#2d1e18] border-2 border-[#5d4037] text-stone-100 rounded-lg font-mono">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400 border-b border-[#5d4037] pb-2">
                <span>🌾 Shipping Bin 🌾</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs text-stone-400 mb-2 font-mono">
                  Items placed here will be shipped overnight for gold.
                </p>
                <div className="grid grid-cols-6 gap-2 bg-[#1e120c] p-3 rounded-lg border border-[#5d4037]/60">
                  {state.shippingBin.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "shipping")}
                      onContextMenu={(e) => handleSlotRightClick(e, idx, "shipping")}
                      onMouseEnter={() => item && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center h-12 rounded border transition-all ${item
                          ? "bg-[#5d4037]/40 hover:bg-[#5d4037]/60 border-[#5d4037]"
                          : "bg-stone-950/80 border-stone-800"
                        }`}
                    >
                      {item ? (
                        <>
                          <span className="text-xl">{item.iconSymbol || "📦"}</span>
                          {item.count > 1 && (
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                              {item.count}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-stone-600 font-mono">{idx + 1}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Inventory view */}
              <div>
                <h4 className="text-xs font-bold text-amber-400 font-mono mb-2">My Inventory</h4>
                <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                  {state.inventory.slice(0, 30).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handleSlotClick(idx, "inventory", e)}
                      onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                      onMouseEnter={() => item && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center h-12 rounded border transition-all ${item
                          ? "bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40 border-stone-700"
                          : "bg-stone-900/60 border-stone-800/80"
                        }`}
                    >
                      {item ? (
                        <>
                          <span className="text-xl">{item.iconSymbol || "📦"}</span>
                          {item.count > 1 && (
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                              {item.count}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-stone-700 font-mono">{idx + 1}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="text-xs" onClick={() => setShippingBinOpen(false)}>
                Close Bin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* STONE FURNACE SMELTER INTERFACE */}
      {furnaceOpenTile && (() => {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        const tile = grid[furnaceOpenTile.y]?.[furnaceOpenTile.x];
        if (!tile) return null;

        const smeltTimer = tile.smeltTimer || 0;
        const smeltMaxTime = tile.smeltMaxTime || 8;
        const isActive = tile.smeltActive || false;
        const pct = isActive ? Math.round(((smeltMaxTime - smeltTimer) / smeltMaxTime) * 100) : 0;

        const fInv = tile.chestInventory || [null, null, null];
        const inputItem = fInv[0];
        const fuelItem = fInv[1];
        const outputItem = fInv[2];

        return (
          <Dialog open={true} onOpenChange={() => setFurnaceOpenTile(null)}>
            <DialogContent container={mainContainerRef.current} className="max-w-md bg-zinc-900 border-2 border-zinc-700 text-zinc-100 rounded-none font-mono">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-orange-400 border-b border-zinc-700 pb-2">
                  <Flame className={`h-5 w-5 ${isActive ? "text-orange-500 animate-pulse" : "text-zinc-500"}`} />
                  <span>{ITEM_DEFS[tile.placedItemId ?? "stone_furnace"]?.name ?? "Furnace"}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-2">
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded border border-zinc-800">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold">ORE INPUT</span>
                    <button
                      onClick={() => handleSlotClick(0, "furnace")}
                      onContextMenu={(e) => handleSlotRightClick(e, 0, "furnace")}
                      onMouseEnter={() => inputItem && setHoveredItem(inputItem)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center w-14 h-14 rounded border-2 transition-all ${inputItem
                          ? "bg-zinc-800 border-orange-500/50 hover:bg-zinc-700"
                          : "bg-zinc-900/40 border-zinc-800 border-dashed"
                        }`}
                    >
                      {inputItem ? (
                        <>
                          <span className="text-2xl">{inputItem.iconSymbol}</span>
                          <span className="absolute bottom-0.5 right-1 px-1 bg-black/80 rounded text-[9px] font-bold text-white font-mono">
                            {inputItem.count}
                          </span>
                        </>
                      ) : (
                        <span className="text-[18px] opacity-25">🪨</span>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1 px-4">
                    <div className="w-full bg-zinc-850 h-3 border border-zinc-700 rounded-none relative overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-600 to-yellow-500 h-full transition-all duration-100"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Flame className={`h-4 w-4 ${isActive ? "text-orange-500 animate-bounce" : "text-zinc-650"}`} />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        {isActive ? `SMELTING... ${pct}%` : "IDLE"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold">FUEL (Coal/Wood)</span>
                    <button
                      onClick={() => handleSlotClick(1, "furnace")}
                      onContextMenu={(e) => handleSlotRightClick(e, 1, "furnace")}
                      onMouseEnter={() => fuelItem && setHoveredItem(fuelItem)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center w-14 h-14 rounded border-2 transition-all ${fuelItem
                          ? "bg-zinc-800 border-yellow-600/50 hover:bg-zinc-700"
                          : "bg-zinc-900/40 border-zinc-800 border-dashed"
                        }`}
                    >
                      {fuelItem ? (
                        <>
                          <span className="text-2xl">{fuelItem.iconSymbol}</span>
                          <span className="absolute bottom-0.5 right-1 px-1 bg-black/80 rounded text-[9px] font-bold text-white font-mono">
                            {fuelItem.count}
                          </span>
                        </>
                      ) : (
                        <span className="text-[18px] opacity-25">🪵</span>
                      )}
                    </button>
                  </div>

                  <span className="text-zinc-650 text-lg px-2">➔</span>

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold">OUTPUT</span>
                    <button
                      onClick={() => handleSlotClick(2, "furnace")}
                      onContextMenu={(e) => handleSlotRightClick(e, 2, "furnace")}
                      onMouseEnter={() => outputItem && setHoveredItem(outputItem)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center w-16 h-16 rounded border-2 transition-all ${outputItem
                          ? "bg-zinc-850 border-green-500/70 hover:bg-zinc-700"
                          : "bg-zinc-900/40 border-zinc-850"
                        }`}
                    >
                      {outputItem ? (
                        <>
                          <span className="text-3xl">{outputItem.iconSymbol}</span>
                          <span className="absolute bottom-0.5 right-1 px-1 bg-black/80 rounded text-[10px] font-bold text-white font-mono">
                            {outputItem.count}
                          </span>
                        </>
                      ) : (
                        <span className="text-[20px] opacity-15">🪙</span>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-orange-400 font-mono mb-2">Player Inventory</h4>
                  <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                    {state.inventory.slice(0, 30).map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSlotClick(idx, "inventory", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                        onMouseEnter={() => item && setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative flex items-center justify-center h-12 rounded border transition-all ${item
                            ? "bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40 border-stone-700"
                            : "bg-stone-900/60 border-stone-800/80"
                          }`}
                      >
                        {item ? (
                          <>
                            <span className="text-xl">{item.iconSymbol || "📦"}</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-stone-700 font-mono">{idx + 1}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="text-xs border-zinc-700 text-zinc-300 bg-zinc-800 hover:bg-zinc-700" onClick={() => setFurnaceOpenTile(null)}>
                  Close Smelter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* F. NPC DIALOG OVERLAY */}

      <Dialog open={npcDialogue !== null} onOpenChange={() => setNpcDialogue(null)}>
        {npcDialogue && (
          <DialogContent container={mainContainerRef.current} className="max-w-md bg-stone-900 border-stone-850 text-stone-100">
            <div className="flex gap-4 py-2">
              <div
                className="w-16 h-16 rounded-lg border-2 border-amber-500 flex items-center justify-center text-3xl font-extrabold text-white shrink-0"
                style={{ backgroundColor: NPCS[npcDialogue.npcId]?.portraitColor }}
              >
                {NPCS[npcDialogue.npcId]?.name[0]}
              </div>
              <div className="space-y-2.5">
                <h3 className="font-bold text-sm text-amber-400">
                  {NPCS[npcDialogue.npcId]?.name}
                </h3>
                <p className="text-xs text-stone-200 leading-relaxed font-mono">
                  {npcDialogue.dialogue}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row mt-3 justify-between">
              {getCursor(state) ? (
                <Button size="sm" variant="outline" className="text-xs" onClick={handleGiveGift}>
                  🎁 Give Held Gift ({getCursor(state)?.name})
                </Button>
              ) : (
                <span className="text-[10px] text-stone-500 flex items-center font-mono">
                  Hold an item to offer a gift
                </span>
              )}
              <Button size="sm" onClick={() => setNpcDialogue(null)}>
                Good Bye
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* G. WORKER SETTINGS DIALOG */}
      <Dialog open={selectedWorkerId !== null} onOpenChange={() => setSelectedWorkerId(null)}>
        <DialogContent container={mainContainerRef.current} className="max-w-md bg-stone-900 border-stone-850 text-stone-100 font-mono">
          {selectedWorkerId && (() => {
            const activeWorker = state.workers?.find((w) => w.id === selectedWorkerId);
            if (!activeWorker) return null;

            const startHour = activeWorker.workStartHour ?? 8;
            const endHour = activeWorker.workEndHour ?? 17;

            return (
              <div className="space-y-4 font-mono">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-400 border-b border-stone-800 pb-2">
                    <Compass className="h-5 w-5 text-amber-500" />
                    <span>Worker Settings: {activeWorker.name}</span>
                  </DialogTitle>
                  <DialogDescription className="text-stone-400 text-xs">
                    Configure priority tasks, custom shift schedules, or terminate employment.
                  </DialogDescription>
                </DialogHeader>

                {/* Status Indicator */}
                <div className="p-3 bg-[#2d1e18] border border-stone-850 rounded-lg space-y-1.5 shadow-inner">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-400">Status:</span>
                    <span className="text-stone-200">{activeWorker.statusText}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-400">Energy:</span>
                    <span className="text-stone-200 font-bold">{Math.round(activeWorker.energy)}/100</span>
                  </div>
                  <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-850">
                    <div
                      className={`h-full transition-all duration-500 ${activeWorker.energy <= 20 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                        }`}
                      style={{ width: `${activeWorker.energy}%` }}
                    />
                  </div>
                </div>

                {/* Task Selection Grid */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Assign Task</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "auto", label: "🤖 Auto Work", desc: "Water > Harvest > Clear" },
                      { id: "water", label: "💧 Water Soil", desc: "Water dry crops & soil" },
                      { id: "harvest", label: "🌾 Harvest", desc: "Harvest mature crops" },
                      { id: "clear", label: "🪓 Clear Debris", desc: "Weed, wood, stone" },
                      { id: "idle", label: "💤 Idle / Rest", desc: "Relax and wander" },
                    ].map((opt) => {
                      const isActive = activeWorker.task === opt.id;
                      return (
                        <button
                          key={opt.id}
                          className={`p-2 rounded border text-left transition-all text-xs ${isActive
                              ? "bg-amber-600 border-amber-400 text-stone-100 font-extrabold shadow-[0_0_8px_rgba(243,156,18,0.3)]"
                              : "bg-stone-950/40 border-stone-850 text-stone-300 hover:bg-[#3e2723]/30"
                            }`}
                          onClick={() => {
                            setState((prev) => {
                              const next = structuredClone(prev);
                              const w = next.workers?.find((x) => x.id === activeWorker.id);
                              if (w) {
                                w.task = opt.id as "idle" | "water" | "harvest" | "clear" | "auto";
                                toast.success(`Assigned ${activeWorker.name} to ${opt.label}`);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="font-bold">{opt.label}</div>
                          <div className="text-[9px] text-stone-500 mt-0.5 font-normal leading-tight">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shift Hours Settings */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Work Shift Time</h4>
                  <div className="grid grid-cols-2 gap-3 p-3 bg-stone-950/30 border border-stone-850 rounded-lg">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-stone-400 font-semibold">Shift Start Hour</label>
                      <select
                        value={startHour}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setState((prev) => {
                            const next = structuredClone(prev);
                            const w = next.workers?.find((x) => x.id === activeWorker.id);
                            if (w) w.workStartHour = val;
                            return next;
                          });
                        }}
                        className="bg-stone-900 border border-stone-800 rounded p-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-stone-400 font-semibold">Shift End Hour</label>
                      <select
                        value={endHour}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setState((prev) => {
                            const next = structuredClone(prev);
                            const w = next.workers?.find((x) => x.id === activeWorker.id);
                            if (w) w.workEndHour = val;
                            return next;
                          });
                        }}
                        className="bg-stone-900 border border-stone-800 rounded p-1.5 text-stone-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Guidelines note */}
                <div className="text-[10px] text-stone-400 border-t border-stone-800 pt-2 leading-relaxed">
                  <span className="text-amber-300 font-extrabold">Guidelines:</span> Hired workers need 1 crop/meal in their Cabin Feed Box daily. If energy drops to 0, they will strike. They work in a 9x9 zone around their cabin.
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-stone-800 mt-2 justify-between">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs bg-[#5d4037]/20 border-stone-850 hover:bg-[#5d4037]/45 text-stone-100 font-mono"
                      onClick={() => {
                        setSelectedWorkerId(null);
                        setChestOpenTile({ x: activeWorker.cabinX, y: activeWorker.cabinY });
                      }}
                    >
                      Feed Box
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs bg-red-950/40 border border-red-900 hover:bg-red-900 text-red-200 font-mono"
                      onClick={() => {
                        if (confirm(`Are you sure you want to sell ${activeWorker.name} and remove their cabin? This refunds 500g.`)) {
                          setState((prev) => {
                            const next = structuredClone(prev);
                            next.coins += 500;
                            next.workers = (next.workers || []).filter((w) => w.id !== activeWorker.id);

                            const tile = next.tiles[activeWorker.cabinY]?.[activeWorker.cabinX];
                            if (tile) {
                              tile.kind = "grass";
                              tile.placedItemId = undefined;
                              tile.chestInventory = undefined;
                            }

                            toast.success(`Sold ${activeWorker.name}'s cabin. +500g refunded!`);
                            gameAudio.playCoin();
                            return next;
                          });
                          setSelectedWorkerId(null);
                        }
                      }}
                    >
                      Sell (+500g)
                    </Button>
                  </div>
                  <Button size="sm" onClick={() => setSelectedWorkerId(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* === CHEAT CONSOLE OVERLAY === */}
      {chatOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center pb-8 px-4" onClick={(e) => { if (e.target === e.currentTarget) { setChatOpen(false); setChatInput(""); } }}>
          <div className="w-full max-w-xl bg-[#0d0e10]/95 border-2 border-[#22d3ee]/60 rounded-lg shadow-2xl backdrop-blur-sm font-mono overflow-hidden"
            style={{ boxShadow: "0 0 30px rgba(34,211,238,0.15), inset 0 0 60px rgba(0,0,0,0.4)" }}>
            {/* Console Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#0a0b0c] border-b border-[#22d3ee]/30">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="ml-2 text-[11px] text-[#22d3ee]/70 font-mono">meadow-life ~ cheat console</span>
              </div>
              <button onClick={() => { setChatOpen(false); setChatInput(""); }} className="text-slate-500 hover:text-white text-xs px-2">✕</button>
            </div>
            {/* Console Output */}
            <div className="h-40 overflow-y-auto p-3 space-y-1 bg-[#0a0b0c]">
              {chatHistory.length === 0 && (
                <p className="text-slate-600 text-xs">Type /help for a list of cheat codes. Press Enter to execute.</p>
              )}
              {chatHistory.map((entry, i) => (
                <p key={i} className="text-xs leading-snug" style={{ color: entry.color }}>{entry.text}</p>
              ))}
            </div>
            {/* Console Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-[#22d3ee]/20 bg-[#0d0e10]">
              <span className="text-[#22d3ee] text-sm font-bold">›</span>
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const cmd = chatInput.trim();
                    if (cmd) {
                      setChatHistory(h => [...h.slice(-19), { text: `> ${cmd}`, color: "#94a3b8" }]);
                      parseCheatCode(cmd);
                    }
                    setChatInput("");
                  } else if (e.key === "Escape") {
                    setChatOpen(false);
                    setChatInput("");
                  }
                }}
                placeholder="Type a cheat code (e.g. /god, /gold 1000, /help)..."
                className="flex-1 bg-transparent text-[#e2e8f0] text-xs outline-none placeholder:text-slate-600 font-mono"
              />
              <button onClick={() => {
                const cmd = chatInput.trim();
                if (cmd) {
                  setChatHistory(h => [...h.slice(-19), { text: `> ${cmd}`, color: "#94a3b8" }]);
                  parseCheatCode(cmd);
                }
                setChatInput("");
              }} className="text-xs px-2 py-1 bg-[#22d3ee]/20 border border-[#22d3ee]/40 text-[#22d3ee] rounded hover:bg-[#22d3ee]/30">
                ↵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === GOD MODE HUD INDICATOR === */}
      {state.godMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[190] px-4 py-1.5 bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-black text-xs font-black rounded-full shadow-lg border border-yellow-300/60 animate-pulse font-mono pointer-events-none"
          style={{ boxShadow: "0 0 20px rgba(245,158,11,0.5)" }}>
          ✨ GOD MODE ACTIVE ✨
        </div>
      )}

      {/* === FACTORIO PRODUCTION STATISTICS DIALOG (P-Key Window) === */}
      <Dialog open={productionStatsOpen} onOpenChange={setProductionStatsOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#141517] border-2 border-[#ff9200] text-slate-100 rounded-lg font-mono shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <DialogTitle className="text-xl font-black flex items-center gap-2 text-orange-400">
                <span>📊</span>
                <span>PRODUCTION STATISTICS (P)</span>
              </DialogTitle>
              <div className="flex items-center gap-1">
                {(["items", "electricity", "pollution"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setProductionStatsTab(tab)}
                    className={`px-3 py-1 text-xs font-bold rounded border transition-all ${
                      productionStatsTab === tab
                        ? "bg-orange-600 border-orange-400 text-white shadow-sm"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {tab === "items" && "Items / min"}
                    {tab === "electricity" && "Electric Grid (kW)"}
                    {tab === "pollution" && "Pollution & Evolution"}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Tab 1: Item Production / Consumption Rates */}
          {productionStatsTab === "items" && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded">
                  <span className="text-emerald-400 font-bold block text-sm">PRODUCTION FLOW</span>
                  <span className="text-[10px] text-zinc-400">Items produced by machines</span>
                </div>
                <div className="p-2 bg-red-950/40 border border-red-800/60 rounded">
                  <span className="text-red-400 font-bold block text-sm">CONSUMPTION FLOW</span>
                  <span className="text-[10px] text-zinc-400">Materials and fuel used</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-1.5 max-h-[360px] overflow-y-auto">
                {!state.productionStats || Object.keys(state.productionStats.produced).length + Object.keys(state.productionStats.consumed).length === 0 ? (
                  <p className="p-3 text-zinc-400">Production and consumption totals appear when machinery starts running.</p>
                ) : [...new Set([...Object.keys(state.productionStats.produced), ...Object.keys(state.productionStats.consumed)])].map(id => {
                  const row = {
                    id,
                    name: ITEM_DEFS[id]?.name ?? id,
                    icon: ITEM_DEFS[id]?.iconSymbol ?? "•",
                    prod: state.productionStats!.produced[id] ?? 0,
                    cons: state.productionStats!.consumed[id] ?? 0,
                  };
                  const maxCount = Math.max(row.prod, row.cons, 1);
                  return (
                    <div key={row.id} className="flex items-center gap-3 p-1.5 bg-zinc-900/60 rounded border border-zinc-800 text-[11px]">
                      <span className="text-xl shrink-0">{row.icon}</span>
                      <div className="w-44 truncate font-bold text-zinc-200">{row.name}</div>

                      {/* Production & Consumption Bars */}
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-emerald-400 font-bold w-12 text-right">+{row.prod}</span>
                          <div className="flex-1 bg-zinc-800 h-2 rounded-none overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(row.prod / maxCount) * 100}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-red-400 font-bold w-12 text-right">−{row.cons}</span>
                          <div className="flex-1 bg-zinc-800 h-2 rounded-none overflow-hidden">
                            <div className="bg-red-500 h-full" style={{ width: `${(row.cons / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Electric Power Grid */}
          {productionStatsTab === "electricity" && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-amber-400">
                  <span>POWER SATISFACTION</span>
                  <span>{Math.round((state.powerGridStats?.satisfaction ?? 1.0) * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-3 border border-zinc-700 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-green-400 h-full transition-all"
                    style={{ width: `${Math.min(100, (state.powerGridStats?.satisfaction ?? 1.0) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-emerald-800/60 rounded text-emerald-300">Generation · {Math.round(state.powerGridStats?.capacityKw ?? 0)} kW</div>
                <div className="p-3 border border-red-800/60 rounded text-red-300">Demand · {Math.round(state.powerGridStats?.demandKw ?? 0)} kW</div>
              </div>
            </div>
          )}

          {/* Tab 3: Pollution & Biter Evolution */}
          {productionStatsTab === "pollution" && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-950/40 border border-red-800/80 rounded space-y-1.5">
                  <span className="text-red-400 font-extrabold text-xs block">🌫️ TOTAL EMITTED POLLUTION</span>
                  <div className="text-2xl font-black text-white font-mono">
                    {Math.round(state.productionStats?.pollutionTotal ?? 0)} <span className="text-xs text-red-400 font-normal">units</span>
                  </div>
                  <span className="text-[9px] text-zinc-400">Boilers, Furnaces & Drills contribute to global cloud</span>
                </div>
                <div className="p-3 bg-purple-950/40 border border-purple-800/80 rounded space-y-1.5">
                  <span className="text-purple-400 font-extrabold text-xs block">👾 BITER EVOLUTION FACTOR</span>
                  <div className="text-2xl font-black text-purple-300 font-mono">
                    {((state.evolutionFactor || 0.01) * 100).toFixed(2)}%
                  </div>
                  <span className="text-[9px] text-zinc-400">Higher evolution unlocks Medium and Big biters</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === FACTORIO SAVE GAME & LOAD GAME CHOSEN LIST DIALOG === */}
      <Dialog open={saveLoadOpen} onOpenChange={setSaveLoadOpen}>
        <DialogContent container={mainContainerRef.current} className="w-[98vw] max-w-4xl max-h-[88vh] overflow-y-auto bg-[#14181f] border-[3px] border-[#3a4454] text-slate-100 rounded-sm font-mono shadow-2xl p-4 select-none">
          <DialogHeader className="border-b border-[#2c3543] pb-2.5">
            <DialogTitle className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center justify-between text-[#ff9200]">
              <div className="flex items-center gap-2">
                <span className="text-xl">💾</span>
                <span>MEADOWLIFE SAVES</span>
              </div>
              <span className="text-[10px] text-amber-300 bg-amber-950/80 px-2 py-0.5 border border-amber-600/50 rounded">
                LOCAL STORAGE SAVES
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono mt-1">
              Manage custom named game saves, inspect factory milestones, and choose a save state to load or overwrite.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Switcher (Load Game List vs Create New Save) */}
          <div className="flex items-center gap-2 border-b border-[#2c3543] pt-2 pb-2 text-xs">
            <button
              onClick={() => setSaveLoadTab("load")}
              className={`px-3 py-1.5 font-bold uppercase transition-all rounded-xs flex items-center gap-1.5 cursor-pointer ${
                saveLoadTab === "load"
                  ? "bg-[#ff9200] text-black font-black shadow-md"
                  : "bg-[#1c222c] text-slate-300 hover:bg-[#252d3a] border border-[#2c3543]"
              }`}
            >
              <span>📂</span>
              <span>CHOOSE SAVED GAME ({saveSlots.length})</span>
            </button>
            <button
              onClick={() => setSaveLoadTab("save")}
              className={`px-3 py-1.5 font-bold uppercase transition-all rounded-xs flex items-center gap-1.5 cursor-pointer ${
                saveLoadTab === "save"
                  ? "bg-[#ff9200] text-black font-black shadow-md"
                  : "bg-[#1c222c] text-slate-300 hover:bg-[#252d3a] border border-[#2c3543]"
              }`}
            >
              <span>➕</span>
              <span>CREATE NEW NAMED SAVE</span>
            </button>
          </div>

          {/* TAB 1: CHOOSE SAVED GAME LIST */}
          {saveLoadTab === "load" && (
            <div className="space-y-3 py-2 text-xs">
              {saveSlots.length === 0 ? (
                <div className="p-8 text-center bg-[#101318] border-2 border-dashed border-[#2c3543] rounded-sm space-y-3">
                  <span className="text-4xl block">📭</span>
                  <div className="font-bold text-slate-200 text-sm">No Saved Games Found</div>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    You haven't created any custom named saves yet. Switch to the <b>"CREATE NEW NAMED SAVE"</b> tab above to save your current factory state!
                  </p>
                  <Button
                    onClick={() => setSaveLoadTab("save")}
                    className="bg-[#ff9200] hover:bg-amber-500 text-black font-extrabold px-4 py-1.5 text-xs rounded-none"
                  >
                    💾 Create First Save
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  {saveSlots.map((slot) => {
                    const saveDate = new Date(slot.timestamp);
                    const dateStr = saveDate.toLocaleDateString() + " " + saveDate.toLocaleTimeString();

                    return (
                      <div
                        key={slot.id}
                        className="p-3 bg-[#161a22] border-2 border-[#2b3545] hover:border-[#ff9200]/80 rounded-sm flex flex-col justify-between space-y-2.5 shadow-md transition-all"
                      >
                        {/* Header: Save Name & Timestamp */}
                        <div className="flex items-start justify-between border-b border-[#252f3e] pb-1.5">
                          <div>
                            <div className="font-extrabold text-[#ff9200] text-sm flex items-center gap-1.5">
                              <span>🏭</span>
                              <span>{slot.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">📅 {dateStr}</div>
                          </div>
                          <span className="text-[9px] font-bold bg-zinc-900 px-1.5 py-0.5 border border-zinc-800 text-emerald-400 rounded">
                            DAY {slot.day}
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#101318] rounded-sm text-[10px] text-slate-300">
                          <div>⏰ <b>Time:</b> {formatTime(slot.time)}</div>
                          <div>🍂 <b>Season:</b> {slot.season.toUpperCase()}</div>
                          <div>🪙 <b>Gold:</b> {slot.coins}G</div>
                          <div>⚡ <b>Energy:</b> {slot.energy}/{slot.maxEnergy}</div>
                          <div>❤️ <b>Health:</b> {slot.health}/{slot.maxHealth}</div>
                          <div>🏗️ <b>Machines:</b> {slot.machinesCount || 0} Placed</div>
                        </div>

                        {/* Actions: Play / Overwrite / Delete */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleLoadGame(slot)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] h-7 rounded-none flex items-center justify-center gap-1"
                          >
                            <span>▶</span>
                            <span>LOAD / PLAY</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveGame(slot.name, slot.id)}
                            title="Overwrite with current factory state"
                            className="bg-[#202836] hover:bg-amber-600 hover:text-black border-slate-600 text-amber-300 font-bold text-[10px] h-7 px-2 rounded-none"
                          >
                            <span>💾 Overwrite</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleDeleteSaveSlot(slot.id, e)}
                            title="Delete this save slot"
                            className="bg-[#202836] hover:bg-red-600 hover:text-white border-slate-600 text-red-400 font-bold text-[10px] h-7 px-2 rounded-none"
                          >
                            <span>🗑️</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Windows PC Offline File Backup & Import Controls */}
          <div className="p-3 bg-[#101318] border border-[#ff9200]/40 rounded-sm space-y-2 my-2">
            <span className="font-extrabold text-[#ff9200] text-xs block uppercase">
              💻 Real Offline Windows PC Save File Controls (.json):
            </span>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Button
                size="sm"
                onClick={handleExportSaveFile}
                className="w-full sm:flex-1 bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs rounded-none h-8"
              >
                <span>💾 Export Save File (.json) to Windows Disk</span>
              </Button>
              <label className="w-full sm:flex-1 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-none h-8 flex items-center justify-center cursor-pointer">
                <span>📂 Import Save File (.json) from Windows Disk</span>
                <input type="file" accept=".json" onChange={handleImportSaveFile} className="hidden" />
              </label>
            </div>
          </div>

          {/* TAB 2: CREATE NEW NAMED SAVE */}
          {saveLoadTab === "save" && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 bg-[#161a22] border-2 border-[#2b3545] rounded-sm space-y-3">
                <label className="block text-slate-200 font-bold text-xs uppercase tracking-wide">
                  Save Name:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saveNameInput}
                    onChange={(e) => setSaveNameInput(e.target.value)}
                    placeholder={`e.g. Meadow Works - Day ${state.day}`}
                    className="flex-1 bg-[#101318] border border-slate-600 focus:border-[#ff9200] px-3 py-2 text-slate-100 text-xs font-mono outline-none rounded-none"
                  />
                  <Button
                    onClick={() => handleSaveGame()}
                    className="bg-[#ff9200] hover:bg-amber-500 text-black font-extrabold px-4 py-2 text-xs rounded-none h-auto"
                  >
                    💾 Save Now
                  </Button>
                </div>
              </div>

              {/* Current Factory Preview Card */}
              <div className="p-3 bg-[#101318] border border-[#2b3545] rounded-sm space-y-2">
                <span className="font-extrabold text-[#ff9200] text-xs block uppercase">
                  📊 Current Factory State to Save:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                  <div className="p-2 bg-[#161a22] border border-zinc-800 rounded-sm">
                    <span className="text-slate-400 text-[10px] block">Game Time</span>
                    <span className="font-bold text-slate-100">Day {state.day}, {formatTime(state.time)}</span>
                  </div>
                  <div className="p-2 bg-[#161a22] border border-zinc-800 rounded-sm">
                    <span className="text-slate-400 text-[10px] block">Coins & Tech</span>
                    <span className="font-bold text-yellow-400">{state.coins}G ({state.unlockedTechs?.length || 0} Techs)</span>
                  </div>
                  <div className="p-2 bg-[#161a22] border border-zinc-800 rounded-sm">
                    <span className="text-slate-400 text-[10px] block">Energy & Health</span>
                    <span className="font-bold text-emerald-400">{Math.round(state.energy)}E / {state.player.health}HP</span>
                  </div>
                  <div className="p-2 bg-[#161a22] border border-zinc-800 rounded-sm">
                    <span className="text-slate-400 text-[10px] block">Placed Machines</span>
                    <span className="font-bold text-orange-400">{countPlacedMachines(state)} Machines</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === ABOUT PAGE DIALOG === */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0f1117] border-2 border-[#334155] text-slate-100 rounded-xl font-mono">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-amber-400 font-mono">
              <span>⚙️</span>
              <span>Factorio Engineering Guide & Cheat Sheet</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono">
              Official Factorio build ratios, belt throughputs, and power engineering metrics (factoriocheatsheet.com).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2 text-xs font-mono">
            {/* Factorio Basics: Introduction to Smelting Card */}
            <div className="p-3 bg-[#181a1f] border-2 border-orange-500/70 rounded-lg space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-orange-500/30 pb-1.5">
                <h3 className="font-extrabold text-orange-400 text-sm flex items-center gap-2">
                  <span>🚀</span> Crafting and smelting
                </h3>
                <span className="text-[10px] text-orange-300 font-mono bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/30">
                  wiki.factorio.com/Crafting
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                As an introduction to crafting, let's craft some simple iron plates.
              </p>
              <div className="space-y-1.5 text-[10px]">
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-orange-400 font-bold text-xs">1.</span>
                  <div>
                    <span className="font-bold text-slate-100">Place Burner Mining Drill: </span>
                    <span className="text-zinc-300">Place a <b>Burner mining drill</b> onto an <b>Iron ore</b> resource field. This is a silvery-blue crystalline patch.</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-orange-400 font-bold text-xs">2.</span>
                  <div>
                    <span className="font-bold text-slate-100">Place Stone Furnace: </span>
                    <span className="text-zinc-300">Place a <b>Stone Furnace</b> directly in front of the output arrow, so that the miner outputs the ore directly into the furnace.</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-orange-400 font-bold text-xs">3.</span>
                  <div>
                    <span className="font-bold text-slate-100">Supply Fuel: </span>
                    <span className="text-zinc-300">Fill both the miner and the furnace with <b>Fuel (Coal or Wood logs)</b>.</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-orange-400 font-bold text-xs">4.</span>
                  <div>
                    <span className="font-bold text-slate-100">Collect Smelted Iron Plates: </span>
                    <span className="text-zinc-300">Wait a few seconds. The first piece of <b>Iron plate</b> is smelted and available for collection (<kbd className="bg-zinc-800 px-1 rounded text-orange-300">F</kbd> key) or via an <b>Inserter</b>.</span>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-orange-950/30 rounded border border-orange-500/20 text-[10px] text-orange-300/90 italic">
                💡 This entire process is commonly referred to as 'smelting'. Copper ore must also be smelted.
              </div>
            </div>

            {/* Factorio Advanced: Automated Assembly & Chain Crafting Card */}
            <div className="p-3 bg-[#181a1f] border-2 border-emerald-500/70 rounded-lg space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
                <h3 className="font-extrabold text-emerald-400 text-sm flex items-center gap-2">
                  <span>⚙️</span> Assembly and production chains
                </h3>
                <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  wiki.factorio.com/Assembling_machine
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                Crafting of items can be automated. Place an <b>Assembling machine</b>, select the recipe, and supply ingredients via belts and inserters.
              </p>
              <div className="space-y-1.5 text-[10px]">
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold text-xs">1.</span>
                  <div>
                    <span className="font-bold text-slate-100">Recipe Selection & Machine Tiers: </span>
                    <span className="text-zinc-300">Place an <b>Assembling machine</b> and select the recipe. Note that complex recipes & fluids require higher machine tiers (Assembling Machine 2/3).</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold text-xs">2.</span>
                  <div>
                    <span className="font-bold text-slate-100">No Auto-Chain Crafting: </span>
                    <span className="text-zinc-300">Unlike manual hand-crafting, each step requires its own dedicated assembly machine. For example, crafting a <b>Lamp</b> requires 1 machine for <b>Copper cable</b>, 1 for <b>Iron stick</b>, and 1 for <b>Electronic circuit</b>.</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold text-xs">3.</span>
                  <div>
                    <span className="font-bold text-slate-100">Continuous Belt & Inserter Feeder: </span>
                    <span className="text-zinc-300">To maintain non-stop production, feed ingredients continuously into input slots using <b>Transport Belts</b> and <b>Inserters</b>.</span>
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold text-xs">4.</span>
                  <div>
                    <span className="font-bold text-slate-100">Automated Extraction: </span>
                    <span className="text-zinc-300">Manufactured items are extracted by <b>Output Inserters</b> and sent downstream for further factory usage or science labs.</span>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-emerald-950/30 rounded border border-emerald-500/20 text-[10px] text-emerald-300/90 italic">
                💡 Assembly machines cannot automatically chain-craft like the player avatar — build dedicated sub-assembly lines!
              </div>
            </div>

            {/* Factorio Cheat Sheet Golden Ratios Card */}
            <div className="p-3 bg-[#181a1f] border-2 border-amber-500/50 rounded-lg space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
                <h3 className="font-extrabold text-amber-400 text-sm flex items-center gap-2">
                  <span>📊</span> Factory planning
                </h3>
                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  factoriocheatsheet.com
                </span>
              </div>

              {/* 1. Belt Throughputs */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-orange-300">🚜 Conveyor Belt Throughputs</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                  <div className="p-1.5 bg-zinc-900 rounded border border-yellow-500/40 text-yellow-300">
                    <div className="font-bold">🟡 Yellow Belt</div>
                    <div className="text-zinc-400">15 items/s (7.5/lane)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-red-500/40 text-red-300">
                    <div className="font-bold">🔴 Red Fast Belt</div>
                    <div className="text-zinc-400">30 items/s (15/lane)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-blue-500/40 text-blue-300">
                    <div className="font-bold">🔵 Blue Express</div>
                    <div className="text-zinc-400">45 items/s (22.5/lane)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-emerald-500/40 text-emerald-300">
                    <div className="font-bold">🟢 Turbo Green</div>
                    <div className="text-zinc-400">60 items/s (30/lane)</div>
                  </div>
                </div>
              </div>

              {/* 2. Power Grid Ratios */}
              <div className="space-y-1 pt-1 border-t border-zinc-800">
                <span className="text-[11px] font-bold text-amber-300">⚡ Power Generation Ratios</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-amber-400">Steam Ratio (1:20:40)</div>
                    <div className="text-zinc-400">1 Pump : 20 Boilers : 40 Engines = 36 MW</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-amber-400">Solar / Accumulator</div>
                    <div className="text-zinc-400">0.84 (25 Solar Panels : 21 Accumulators)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-amber-400">2x2 Nuclear (480 MW)</div>
                    <div className="text-zinc-400">4 Reactors : 48 Exchangers : 83 Turbines</div>
                  </div>
                </div>
              </div>

              {/* 3. Smelting & Mining Belt Saturation Ratios */}
              <div className="space-y-1 pt-1 border-t border-zinc-800">
                <span className="text-[11px] font-bold text-emerald-300">⛏️ Mining & Smelting (1 Full Yellow Belt = 15/s)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-stone-300">Stone Furnaces</div>
                    <div className="text-zinc-400">48 Furnaces (24 per side)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-stone-300">Steel / Electric Furnaces</div>
                    <div className="text-zinc-400">24 Furnaces (12 per side)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-stone-300">Electric Drills</div>
                    <div className="text-zinc-400">30 Drills (15 per side)</div>
                  </div>
                </div>
              </div>

              {/* 4. Manufacturing & Science Ratios */}
              <div className="space-y-1 pt-1 border-t border-zinc-800">
                <span className="text-[11px] font-bold text-purple-300">🔬 Production & Science Golden Ratios</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-green-400">Electronic Circuits (Green)</div>
                    <div className="text-zinc-400">3 Copper Cable Assemblers $\rightarrow$ 2 Circuit Assemblers (Direct 3:2)</div>
                  </div>
                  <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800">
                    <div className="font-bold text-purple-400">Science Lab Ratio (5:6:5:12:7:7)</div>
                    <div className="text-zinc-400">5 Red : 6 Green : 5 Gray : 12 Blue : 7 Purple : 7 Yellow</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div>
              <h3 className="font-bold text-sky-400 text-sm mb-2">🎮 Factorio Controls & Shortcuts</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["WASD / Arrow Keys", "Move player"],
                  ["E / Space", "Interact / Use tool (hold for charged)"],
                  ["F", "Talk to NPC / Pet animal"],
                  ["1-9, 0", "Select hotbar slot"],
                  ["I / Esc", "Open / close inventory"],
                  ["/", "Open cheat console"],
                  ["H", "Open this guide"],
                  ["Shift + WASD", "Run (move faster)"],
                  ["Left Click", "Interact with hovered tile"],
                  ["Right Click", "Split item stack"],
                ].map(([key, action]) => (
                  <div key={key} className="flex gap-2 items-start p-1.5 bg-[#1e293b] border border-[#334155]/60 rounded">
                    <kbd className="bg-slate-700/80 px-1.5 py-0.5 rounded text-amber-300 text-[10px] font-bold whitespace-nowrap shrink-0">{key}</kbd>
                    <span className="text-slate-300 text-[10px] leading-tight">{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cheat Codes */}
            <div>
              <h3 className="font-bold text-purple-400 text-sm mb-2">💻 Cheat Codes (Press / to open console)</h3>
              <div className="space-y-1.5">
                {[
                  ["/god", "Toggle God Mode — infinite energy, no damage"],
                  ["/heal", "Restore full HP and energy"],
                  ["/gold <n>", "Add n gold coins (e.g. /gold 5000)"],
                  ["/item <id> <qty>", "Spawn items (e.g. /item iron_bar 20)"],
                  ["/time <0-23>", "Set in-game hour (e.g. /time 6 = dawn)"],
                  ["/day <n>", "Jump to a specific day number"],
                  ["/research <tech_id>", "Instantly unlock a technology"],
                  ["/research_all", "Unlock all technologies at once"],
                  ["/rp <n>", "Add research points"],
                  ["/worker", "Instantly spawn a worker at your location"],
                  ["/help", "List all cheat commands in console"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex gap-3 items-start p-1.5 bg-[#1e293b]/80 border border-purple-900/40 rounded">
                    <code className="text-purple-300 text-[10px] font-bold whitespace-nowrap shrink-0 w-36">{cmd}</code>
                    <span className="text-slate-400 text-[10px] leading-tight">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technologies */}
            <div>
              <h3 className="font-bold text-violet-400 text-sm mb-2">🔬 Technology IDs (for /research cheat)</h3>
              <div className="grid grid-cols-2 gap-1">
                {TECHNOLOGIES.map(t => (
                  <div key={t.id} className="flex gap-2 items-center p-1.5 bg-[#1e293b]/60 border border-violet-900/30 rounded">
                    <span className="text-base">{t.icon}</span>
                    <div>
                      <code className="text-violet-300 text-[9px] block">{t.id}</code>
                      <span className="text-slate-400 text-[9px]">{t.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Catalog */}
            <div>
              <h3 className="font-bold text-amber-400 text-sm mb-2">📦 Items Catalog (for /item cheat)</h3>
              <div className="grid grid-cols-3 gap-1 max-h-60 overflow-y-auto pr-1">
                {Object.values(ITEM_DEFS).map(item => (
                  <div key={item.id} className="flex gap-1.5 items-center p-1.5 bg-[#1e293b]/60 border border-[#334155]/40 rounded">
                    <span className="text-base shrink-0">{item.iconSymbol || "📦"}</span>
                    <div className="overflow-hidden">
                      <span className="text-slate-200 text-[9px] block truncate font-bold">{item.name}</span>
                      <code className="text-slate-500 text-[8px] block truncate">{item.id}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="p-3 bg-[#1e293b] border border-emerald-900/50 rounded-lg">
              <h3 className="font-bold text-emerald-400 text-sm mb-2">💡 Tips & Strategies</h3>
              <ul className="space-y-1 text-slate-300 text-[10px] leading-relaxed list-disc list-inside">
                <li>Use the <strong>Shipping Bin</strong> at (18, 29) to sell crops overnight — they're valued at their full price!</li>
                <li>Assign workers to <strong>research_center</strong> buildings to accelerate tech research progress.</li>
                <li>Craft a <strong>Player Store</strong> to buy bulk resources and hire lifetime workers cheaply.</li>
                <li>Mine to depth 12+ for <strong>Uranium Ore</strong> — smelt it for powerful Uranium Bars.</li>
                <li>Sleep before midnight to get full HP/Energy for the next day.</li>
                <li>Research <strong>Energy Efficiency</strong> to make long farming sessions much more comfortable.</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setAboutOpen(false)} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold">
              Start Farming! 🌱
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === PLAYER STORE DIALOG === */}
      {playerStoreOpen && (
        <Dialog open={true} onOpenChange={() => setPlayerStoreOpen(false)}>
          <DialogContent container={mainContainerRef.current} className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-[#1a0f05] border-2 border-[#d97706] text-stone-100 rounded-xl font-mono">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-xl font-black flex items-center gap-2 text-amber-400 border-b border-amber-900/40 pb-2">
                <span>🏪</span> Player Store
                <span className="ml-auto text-sm font-normal text-amber-300 flex items-center gap-1">
                  <Coins className="w-4 h-4" /> {state.coins}g
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex gap-2 shrink-0 border-b border-amber-900/30 pb-2">
              {(["buy", "sell", "workers", "land"] as const).map(tab => (
                <button key={tab} onClick={() => setPlayerStoreTab(tab)}
                  className={`px-4 py-1.5 text-xs font-bold rounded transition-all capitalize ${playerStoreTab === tab
                      ? "bg-amber-600 text-black border border-amber-400"
                      : "bg-stone-900/60 text-stone-400 border border-stone-800 hover:bg-stone-800"
                    }`}>
                  {tab === "buy" ? "🛒 Buy Items" : tab === "sell" ? "💰 Sell Items" : tab === "workers" ? "👷 Workers" : "📜 Land Expansions"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* BUY TAB */}
              {playerStoreTab === "buy" && (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-amber-200/60">Buy resources, seeds, and materials at a slight markup.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {STORE_ITEMS.filter(d => d.buyPrice > 0 && d.price > 0).map(item => {
                      const canAfford = state.coins >= item.buyPrice;
                      return (
                        <button key={item.id} disabled={!canAfford}
                          onClick={() => {
                            setState(prev => {
                              const next = structuredClone(prev);
                              if (next.coins < item.buyPrice) return next;
                              const newItem = createItem(item.id, 1);
                              const ok = addItem(next.inventory, newItem);
                              if (ok) {
                                next.coins -= item.buyPrice;
                                toast.success(`Bought 1x ${item.name} for ${item.buyPrice}g`);
                                gameAudio.playCoin();
                              } else {
                                toast.error("Inventory full!");
                              }
                              return next;
                            });
                          }}
                          className={`flex items-center gap-2 p-2 rounded border text-left transition-all ${canAfford
                              ? "bg-amber-950/40 border-amber-900/50 hover:bg-amber-900/40 hover:border-amber-600"
                              : "bg-stone-950/40 border-stone-900/40 opacity-50 cursor-not-allowed"
                            }`}>
                          <span className="text-2xl">{item.iconSymbol || "📦"}</span>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold text-stone-200 truncate">{item.name}</div>
                            <div className="text-[10px] text-amber-400 font-bold">{item.buyPrice}g</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SELL TAB */}
              {playerStoreTab === "sell" && (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-amber-200/60">Sell items from your inventory directly at the store.</p>
                  <div className="grid grid-cols-5 gap-2">
                    {state.inventory.map((item, idx) => (
                      <button key={idx} disabled={!item}
                        onClick={() => {
                          if (!item) return;
                          const storeDef = STORE_ITEMS.find(d => d.id === item.id);
                          const sellPrice = storeDef ? storeDef.sellPrice : Math.max(1, Math.round((item.price || 0) * 0.8));
                          setState(prev => {
                            const next = structuredClone(prev);
                            const inv = next.inventory;
                            const slot = inv[idx];
                            if (!slot) return next;
                            const earned = sellPrice * slot.count;
                            next.coins += earned;
                            inv[idx] = null;
                            toast.success(`Sold ${slot.count}x ${slot.name} for ${earned}g!`);
                            gameAudio.playCoin();
                            return next;
                          });
                        }}
                        className={`relative flex flex-col items-center justify-center h-14 rounded border transition-all ${item
                            ? "bg-amber-950/30 border-amber-900/50 hover:bg-amber-900/40 hover:border-amber-600 cursor-pointer"
                            : "bg-stone-950/40 border-stone-900/40 opacity-30 cursor-not-allowed"
                          }`}>
                        {item ? (
                          <>
                            <span className="text-xl">{item.iconSymbol || "📦"}</span>
                            <span className="text-[8px] text-amber-400 font-bold">{Math.max(1, Math.round((item.price || 0) * 0.8))}g</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-1 text-[9px] bg-black/60 px-1 rounded text-white font-bold">{item.count}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-stone-700 text-[10px]">{idx + 1}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* WORKERS TAB */}
              {playerStoreTab === "workers" && (
                <div className="p-3 space-y-4">
                  <p className="text-xs text-amber-200/60">Hire permanent workers or sell your existing ones back.</p>

                  {/* Hire new worker */}
                  <div className="p-3 bg-[#1e120c] border border-amber-900/50 rounded-lg space-y-3">
                    <h4 className="text-sm font-bold text-amber-400">Hire a New Worker — 1,000g (Lifetime)</h4>
                    <p className="text-[10px] text-stone-400">Workers farm automatically: watering, harvesting, and clearing debris. Place a Worker Cabin first!</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Helper Bob", "Farmer Joe", "Ranch Hand Mary", "Plowman Steve", "Harvester Lucy"].map(name => (
                        <button key={name}
                          onClick={() => {
                            if (state.coins < 1000) { toast.error("Not enough gold! Need 1,000g."); return; }
                            // Check if a worker cabin is placed
                            let cabinTile: { x: number; y: number } | null = null;
                            for (let ry = 0; ry < state.tiles.length; ry++) {
                              for (let rx = 0; rx < state.tiles[ry].length; rx++) {
                                const t = state.tiles[ry][rx];
                                if (t.kind === "placed_item" && t.placedItemId === "worker_cabin") {
                                  const taken = (state.workers || []).some(w => w.cabinX === rx && w.cabinY === ry);
                                  if (!taken) { cabinTile = { x: rx, y: ry }; break; }
                                }
                              }
                              if (cabinTile) break;
                            }
                            if (!cabinTile) { toast.error("No free Worker Cabin! Craft and place one first."); return; }
                            const cabin = cabinTile;
                            setState(prev => {
                              const next = structuredClone(prev);
                              next.coins -= 1000;
                              if (!next.workers) next.workers = [];
                              next.workers.push({
                                id: `worker_${Date.now()}`,
                                name,
                                cabinX: cabin.x,
                                cabinY: cabin.y,
                                x: cabin.x,
                                y: cabin.y,
                                subX: cabin.x,
                                subY: cabin.y,
                                task: "idle",
                                role: "farming",
                                inventory: null,
                                energy: 100,
                                hasEatenToday: false,
                                walkTimer: Math.random() * 3 + 2,
                                actionTimer: 0,
                                statusText: "Just hired!",
                              });
                              toast.success(`Hired ${name}! They'll work from 8AM-5PM daily.`);
                              gameAudio.playCoin();
                              return next;
                            });
                          }}
                          className={`p-2 rounded border text-center text-xs transition-all ${state.coins >= 1000
                              ? "bg-amber-700/40 border-amber-700/60 hover:bg-amber-600/50 text-amber-200"
                              : "bg-stone-900/40 border-stone-800 text-stone-600 cursor-not-allowed"
                            }`}>
                          <div className="text-2xl mb-1">👷</div>
                          <div className="font-bold">{name}</div>
                          <div className="text-amber-400 font-bold text-[10px]">1,000g</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Existing workers */}
                  {(state.workers || []).length > 0 && (
                    <div className="p-3 bg-[#1e120c] border border-stone-800 rounded-lg space-y-2">
                      <h4 className="text-sm font-bold text-stone-300">Your Workers ({state.workers?.length || 0})</h4>
                      {(state.workers || []).map(w => (
                        <div key={w.id} className="flex items-center justify-between p-2 bg-stone-900/40 border border-stone-800 rounded">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">👷</span>
                            <div>
                              <div className="text-xs font-bold text-stone-200">{w.name}</div>
                              <div className="text-[9px] text-stone-500">{w.statusText}</div>
                            </div>
                          </div>
                          <button onClick={() => {
                            if (!confirm(`Sell ${w.name} back? Refunds 500g.`)) return;
                            setState(prev => {
                              const next = structuredClone(prev);
                              next.coins += 500;
                              next.workers = (next.workers || []).filter(x => x.id !== w.id);
                              const tile = next.tiles[w.cabinY]?.[w.cabinX];
                              if (tile) { tile.kind = "grass"; tile.placedItemId = undefined; tile.chestInventory = undefined; }
                              toast.success(`Sold ${w.name}. +500g`);
                              return next;
                            });
                          }} className="text-[10px] px-2 py-1 bg-red-950/50 border border-red-900 text-red-300 rounded hover:bg-red-900">
                            Sell (+500g)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LAND TAB */}
              {playerStoreTab === "land" && (
                <div className="p-3 space-y-4">
                  <p className="text-xs text-amber-200/60">Expand your farm by purchasing new land parcels.</p>

                  <div className="grid grid-cols-2 gap-3">
                    {LAND_PARCELS.map(parcel => {
                      const owned = (state.purchasedLands || []).includes(parcel.id);
                      const canAfford = state.coins >= parcel.cost;

                      return (
                        <div key={parcel.id} className={`p-3 rounded-lg border-2 flex flex-col relative transition-all ${owned ? "bg-amber-950/20 border-amber-900/40 opacity-70" :
                            "bg-[#1e120c] border-amber-900/60 hover:border-amber-500 hover:bg-[#2a170d]"
                          }`}>
                          <div className="flex gap-3 mb-2">
                            <div className="text-3xl shrink-0 bg-black/30 p-2 rounded-lg flex items-center justify-center">
                              {parcel.icon}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-sm text-amber-300">{parcel.name}</h4>
                              <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{parcel.description}</p>
                              <div className="text-[9px] text-stone-500 mt-1">Area: {parcel.width}x{parcel.height} ({(parcel.width * parcel.height)} tiles)</div>
                            </div>
                          </div>

                          <div className="mt-auto pt-3 flex items-center justify-between border-t border-amber-900/30">
                            {owned ? (
                              <span className="text-emerald-500 text-xs font-bold ml-auto flex items-center gap-1">
                                ✓ OWNED
                              </span>
                            ) : (
                              <>
                                <span className={`text-xs font-bold flex items-center gap-1 ${canAfford ? 'text-amber-400' : 'text-red-400'}`}>
                                  {parcel.cost}g
                                </span>
                                <button
                                  disabled={!canAfford}
                                  onClick={() => {
                                    setState(prev => {
                                      const next = structuredClone(prev);
                                      if (next.coins < parcel.cost) return next;

                                      next.coins -= parcel.cost;
                                      if (!next.purchasedLands) next.purchasedLands = [];
                                      next.purchasedLands.push(parcel.id);

                                      // Apply terrain changes for this parcel
                                      applyLandPurchase(next.tiles, parcel);

                                      toast.success(`Purchased ${parcel.name}! The land has been cleared and prepared.`);
                                      gameAudio.playCoin();
                                      return next;
                                    });
                                  }}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded ${canAfford
                                      ? "bg-amber-600 text-black hover:bg-amber-500"
                                      : "bg-stone-800 text-stone-500 cursor-not-allowed"
                                    }`}
                                >
                                  PURCHASE DEED
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t border-amber-900/30 pt-2">
              <Button onClick={() => setPlayerStoreOpen(false)} className="bg-amber-700 hover:bg-amber-600 text-black font-bold">
                Close Store
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* === RESEARCH CENTER DIALOG === */}
      {researchCenterOpen && (
        <Dialog open={true} onOpenChange={() => setResearchCenterOpen(false)}>
          <DialogContent container={mainContainerRef.current} className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-[#0d0a1a] border-2 border-[#7c3aed] text-slate-100 rounded-xl font-mono">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-xl font-black flex items-center gap-2 text-violet-400 border-b border-violet-900/50 pb-2">
                <span>🔬</span> Research Center
                <span className="ml-auto text-sm font-normal flex items-center gap-2">
                  <span className="text-violet-300">⚗️ {Math.round(state.researchPoints || 0)} RP</span>
                  {state.activeResearchId && (
                    <span className="text-emerald-400 text-xs animate-pulse">● Researching...</span>
                  )}
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Active Research Progress */}
            {state.activeResearchId && (() => {
              const tech = TECHNOLOGIES.find(t => t.id === state.activeResearchId);
              if (!tech) return null;
              const progress = state.researchProgress || 0;
              const pct = Math.min(100, Math.round((progress / tech.cost) * 100));
              const researchWorkers = (state.workers || []).filter(w => (state.workerAssignments || {})[w.id] === "research_center").length;
              return (
                <div className="shrink-0 p-3 bg-[#1e1535] border border-violet-900/50 rounded-lg space-y-2 mx-0">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{tech.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-violet-300">{tech.name}</div>
                      <div className="text-[10px] text-slate-400">{researchWorkers} worker(s) assigned · {Math.round(2 + researchWorkers * 1.5 * 10) / 10} RP/sec</div>
                    </div>
                    <div className="ml-auto text-xs font-bold text-violet-400">{Math.round(progress)}/{tech.cost} RP</div>
                  </div>
                  <div className="h-3 bg-violet-950 rounded-full overflow-hidden border border-violet-800/50">
                    <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>{pct}% complete</span>
                    <button onClick={() => setState(prev => { const next = structuredClone(prev); next.activeResearchId = undefined; next.researchProgress = 0; return next; })}
                      className="text-red-500 hover:text-red-400">Cancel Research</button>
                  </div>
                </div>
              );
            })()}

            {/* Worker Assignment */}
            {(state.workers || []).length > 0 && (
              <div className="shrink-0 p-3 bg-[#12101e] border border-violet-900/30 rounded-lg">
                <h4 className="text-xs font-bold text-violet-400 mb-2">Assign Workers to Research (+1.5 RP/sec each)</h4>
                <div className="flex gap-2 flex-wrap">
                  {(state.workers || []).map(w => {
                    const assigned = (state.workerAssignments || {})[w.id] === "research_center";
                    return (
                      <button key={w.id} onClick={() => setState(prev => {
                        const next = structuredClone(prev);
                        if (!next.workerAssignments) next.workerAssignments = {};
                        next.workerAssignments[w.id] = assigned ? "farm" : "research_center";
                        return next;
                      })} className={`px-3 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1 ${assigned ? "bg-violet-700/50 border-violet-500 text-violet-200" : "bg-stone-900/60 border-stone-700 text-stone-400 hover:bg-stone-800"
                        }`}>
                        <span>👷</span> {w.name} {assigned ? "🔬" : "🌾"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tech Tree Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 p-1">
              <h4 className="text-xs font-bold text-slate-400 mb-3 px-2">Technology Tree — click to start researching</h4>
              <div className="grid grid-cols-2 gap-3 p-2">
                {TECHNOLOGIES.map(tech => {
                  const unlocked = (state.unlockedTechs || []).includes(tech.id);
                  const canResearch = !unlocked && tech.prerequisites.every(p => (state.unlockedTechs || []).includes(p));
                  const isActive = state.activeResearchId === tech.id;
                  return (
                    <div key={tech.id}
                      onMouseEnter={() => setHoveredTech(tech)}
                      onMouseLeave={() => setHoveredTech(null)}
                      onClick={() => {
                        if (unlocked || isActive) return;
                        if (!canResearch) { toast.error(`Requires: ${tech.prerequisites.join(", ")}`); return; }
                        setState(prev => {
                          const next = structuredClone(prev);
                          next.activeResearchId = tech.id;
                          next.researchProgress = 0;
                          toast.success(`Started researching: ${tech.name}!`);
                          return next;
                        });
                      }}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all relative ${unlocked
                          ? "bg-violet-950/50 border-violet-500/60 opacity-80"
                          : isActive
                            ? "bg-fuchsia-950/60 border-fuchsia-400 shadow-[0_0_15px_rgba(192,38,211,0.3)] animate-pulse"
                            : canResearch
                              ? "bg-[#1e1535] border-violet-800/60 hover:border-violet-500 hover:bg-[#261c45]"
                              : "bg-stone-950/40 border-stone-800/40 opacity-40 cursor-not-allowed"
                        }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-3xl shrink-0">{tech.icon}</span>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-slate-200 truncate">{tech.name}</span>
                            {unlocked && <span className="text-emerald-400 text-xs">✓</span>}
                            {isActive && <span className="text-fuchsia-400 text-xs">⟳</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{tech.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] text-violet-400 font-bold">⚗️ {tech.cost} RP</span>
                            {tech.prerequisites.length > 0 && (
                              <span className="text-[9px] text-slate-600">Req: {tech.prerequisites.length} techs</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t border-violet-900/30 pt-2">
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-slate-500 font-mono">
                  {(state.unlockedTechs || []).length}/{TECHNOLOGIES.length} technologies unlocked
                </span>
                <Button onClick={() => setResearchCenterOpen(false)} className="ml-auto bg-violet-700 hover:bg-violet-600 text-white font-bold">
                  Close Lab
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 7. GRAPHICS & FPS PERFORMANCE SETTINGS DIALOG */}
      {graphicsSettingsOpen && (
        <Dialog open={graphicsSettingsOpen} onOpenChange={setGraphicsSettingsOpen}>
          <DialogContent className="bg-[#161a22] border-2 border-cyan-500/60 text-slate-100 font-mono max-w-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-cyan-400 text-lg flex items-center gap-2 font-bold">
                ⚙️ Graphics & FPS Performance Settings
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Adjust frame rate limiter (40/60/120/144/MAX FPS), graphics quality, Alt-grid lines, and desktop processor resource allocation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* FPS Limiter Setting */}
              <div className="space-y-1.5 p-2.5 bg-zinc-900/80 rounded border border-zinc-800">
                <label className="text-slate-200 font-bold flex justify-between">
                  <span>🚀 Target FPS Limiter:</span>
                  <span className="text-cyan-400 font-bold">
                    {(state.settings?.fpsLimit ?? 60) === 0 ? "UNLIMITED (Max)" : `${state.settings?.fpsLimit ?? 60} FPS`}
                  </span>
                </label>
                <div className="flex gap-1.5 pt-1">
                  {[30, 60, 120, 144, 0].map((fps) => (
                    <Button
                      key={fps}
                      size="sm"
                      onClick={() => handleUpdateSettings({ fpsLimit: fps as any })}
                      className={`flex-1 text-[10px] font-bold ${
                        (state.settings?.fpsLimit ?? 60) === fps
                          ? "bg-cyan-500 text-black hover:bg-cyan-400 border-cyan-400 font-extrabold"
                          : "bg-zinc-800 text-slate-300 border-zinc-700 hover:border-cyan-500"
                      }`}
                    >
                      {fps === 0 ? "MAX" : `${fps}`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Graphics Quality Preset */}
              <div className="space-y-1.5 p-2.5 bg-zinc-900/80 rounded border border-zinc-800">
                <label className="text-slate-200 font-bold flex justify-between">
                  <span>🖼️ Graphics Quality Preset:</span>
                  <span className="text-amber-400 font-bold uppercase">
                    {state.settings?.graphicsQuality || "low"}
                  </span>
                </label>
                <div className="flex gap-1.5 pt-1">
                  {(["low", "medium", "high", "ultra"] as const).map((q) => (
                    <Button
                      key={q}
                      size="sm"
                      onClick={() => handleUpdateSettings({ graphicsQuality: q })}
                      className={`flex-1 text-[10px] font-bold uppercase ${
                        (state.settings?.graphicsQuality || "low") === q
                          ? "bg-amber-500 text-black hover:bg-amber-400 border-amber-400 font-extrabold"
                          : "bg-zinc-800 text-slate-300 border-zinc-700 hover:border-amber-500"
                      }`}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Toggles: Factorio Grid, FPS Overlay, Desktop App Mode */}
              <div className="space-y-2 p-2.5 bg-zinc-900/80 rounded border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">📏 Factorio Alt Grid Lines:</span>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateSettings({ showGrid: !state.settings?.showGrid })}
                    className={`text-[10px] font-bold ${state.settings?.showGrid ? "bg-emerald-500 text-black" : "bg-zinc-800 text-slate-400"}`}
                  >
                    {state.settings?.showGrid ? "ENABLED" : "DISABLED"}
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                  <span className="text-slate-300 font-semibold">☁️ Industrial Pollution Cloud Overlay:</span>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateSettings({ showPollution: !(state.settings?.showPollution ?? true) })}
                    className={`text-[10px] font-bold ${(state.settings?.showPollution ?? true) ? "bg-red-500 text-white" : "bg-zinc-800 text-slate-400"}`}
                  >
                    {(state.settings?.showPollution ?? true) ? "ENABLED" : "DISABLED"}
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                  <span className="text-slate-300 font-semibold">📊 Real-Time FPS Overlay Bar:</span>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateSettings({ showFpsOverlay: !state.settings?.showFpsOverlay })}
                    className={`text-[10px] font-bold ${state.settings?.showFpsOverlay ? "bg-emerald-500 text-black" : "bg-zinc-800 text-slate-400"}`}
                  >
                    {state.settings?.showFpsOverlay ? "ENABLED" : "DISABLED"}
                  </Button>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                  <div>
                    <div className="text-slate-200 font-bold">💻 Desktop App RAM/CPU Optimizer:</div>
                    <div className="text-[10px] text-slate-400">High memory buffer & multi-thread processing</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateSettings({ desktopMode: !state.settings?.desktopMode })}
                    className={`text-[10px] font-bold ${state.settings?.desktopMode ? "bg-cyan-500 text-black" : "bg-zinc-800 text-slate-400"}`}
                  >
                    {state.settings?.desktopMode ? "ACTIVE" : "OFF"}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setGraphicsSettingsOpen(false)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs">
                Close Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 8. CHARACTER WARDROBE / DRESS CUSTOMIZATION DIALOG */}
      {wardrobeOpen && (
        <Dialog open={wardrobeOpen} onOpenChange={setWardrobeOpen}>
          <DialogContent className="bg-[#161a22] border-2 border-orange-500/60 text-slate-100 font-mono max-w-lg shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-orange-400 text-lg flex items-center gap-2 font-bold">
                👕 Character Dress & Outfit Customization
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Customize your Factorio engineer hazard suit colors, armor tiers, helmets, and character appearance.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              {/* Left Column: Live Character Dress Preview */}
              <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/90 rounded border border-orange-500/30">
                <div className="text-xs font-bold text-amber-400 mb-2">Live Character Preview</div>
                <div className="w-28 h-28 bg-[#18110e] border-2 border-orange-500/50 rounded flex items-center justify-center relative overflow-hidden shadow-inner">
                  <svg width="80" height="80" viewBox="0 0 40 40">
                    {/* Backpack */}
                    <rect x="11" y="14" width="18" height="12" fill={state.player.secondaryColor || "#1e2430"} rx="1" />
                    {/* Legs */}
                    <rect x="13" y="24" width="6" height="10" fill={state.player.suitType === "power_armor" ? "#2c3e50" : "#4a5568"} />
                    <rect x="21" y="24" width="6" height="10" fill={state.player.suitType === "power_armor" ? "#2c3e50" : "#4a5568"} />
                    {/* Boots */}
                    <rect x="12" y="32" width="7" height="4" fill="#111827" />
                    <rect x="21" y="32" width="7" height="4" fill="#111827" />
                    {/* Knee Guards */}
                    <rect x="12.5" y="28" width="6.5" height="3" fill={state.player.dressColor || "#d48817"} />
                    <rect x="20.5" y="28" width="6.5" height="3" fill={state.player.dressColor || "#d48817"} />
                    {/* Arms */}
                    <rect x="8" y="15" width="4.5" height="10" fill={state.player.secondaryColor || "#1e2430"} />
                    <rect x="27.5" y="15" width="4.5" height="10" fill={state.player.secondaryColor || "#1e2430"} />
                    {/* Torso Vest */}
                    <rect x="12" y="12" width="16" height="14" fill={state.player.dressColor || "#d48817"} rx="1" />
                    {/* Harness */}
                    <rect x="14" y="16" width="12" height="4" fill={state.player.secondaryColor || "#1e2430"} />
                    {/* Pauldrons */}
                    <rect x="7" y="11" width="6" height="5" fill={state.player.dressColor || "#d48817"} />
                    <rect x="27" y="11" width="6" height="5" fill={state.player.dressColor || "#d48817"} />
                    {/* Helmet */}
                    {(state.player.helmetType || "visor") !== "none" && (
                      <>
                        <circle cx="20" cy="8" r="6" fill={state.player.helmetType === "power_visor" ? "#8e44ad" : state.player.dressColor || "#d48817"} />
                        <circle cx="20" cy="8.5" r="2.8" fill="#1b2631" />
                        <circle cx="20" cy="8.5" r="1.8" fill={state.player.helmetType === "power_visor" ? "#a855f7" : state.player.helmetType === "visor" ? "#38bdf8" : "#f59e0b"} />
                      </>
                    )}
                  </svg>
                </div>
                <div className="mt-2 text-[10px] text-slate-300 font-bold uppercase text-center">
                  {state.player.suitType || "engineer"} suit
                </div>
              </div>

              {/* Right Column: Customization Controls */}
              <div className="space-y-3 text-xs">
                {/* Primary Suit Color */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Primary Suit Color:</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { name: "Orange", hex: "#e67e22" },
                      { name: "Blue", hex: "#2980b9" },
                      { name: "Green", hex: "#27ae60" },
                      { name: "Purple", hex: "#8e44ad" },
                      { name: "Red", hex: "#c0392b" },
                      { name: "Dark", hex: "#34495e" },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleUpdateDress({ dressColor: c.hex })}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded border-2 cursor-pointer transition-transform ${
                          (state.player.dressColor || "#e67e22") === c.hex
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Accent Color */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Secondary Accent Color:</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { name: "Dark Metal", hex: "#1e2430" },
                      { name: "Gold", hex: "#f1c40f" },
                      { name: "White", hex: "#ecf0f1" },
                      { name: "Teal", hex: "#16a085" },
                      { name: "Cyan", hex: "#00cec9" },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleUpdateDress({ secondaryColor: c.hex })}
                        style={{ backgroundColor: c.hex }}
                        className={`w-7 h-7 rounded border-2 cursor-pointer transition-transform ${
                          (state.player.secondaryColor || "#1e2430") === c.hex
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Skin Tone Selector */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Character Skin Tone:</label>
                  <select
                    value={state.player.skinTone || "default"}
                    onChange={(e) => handleUpdateDress({ skinTone: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                  >
                    <option value="default">👤 Default Skin</option>
                    <option value="fair">🏼 Fair Skin</option>
                    <option value="tan">🏽 Tan Skin</option>
                    <option value="dark">🏿 Dark Skin</option>
                  </select>
                </div>

                {/* Suit Armor Tier */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Armor Suit Model:</label>
                  <select
                    value={state.player.suitType || "engineer"}
                    onChange={(e) => handleUpdateDress({ suitType: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                  >
                    <option value="engineer">👷 Engineer Hazard Suit</option>
                    <option value="heavy">🛡️ Heavy Combat Armor</option>
                    <option value="modular">⚡ Modular Tech Suit</option>
                    <option value="power_armor">🤖 Power Armor MK2</option>
                  </select>
                </div>

                {/* Helmet Headgear */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Headgear / Visor:</label>
                  <select
                    value={state.player.helmetType || "visor"}
                    onChange={(e) => handleUpdateDress({ helmetType: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-slate-100 font-mono"
                  >
                    <option value="visor">🥽 Optic Sensor Visor</option>
                    <option value="helmet">🪖 Reinforced Dome Helmet</option>
                    <option value="power_visor">🔮 Power Visor MK2</option>
                    <option value="none">👤 No Helmet</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setWardrobeOpen(false)} className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs">
                Save & Equip Outfit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );

}
