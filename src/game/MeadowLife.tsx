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
  updateEntities,
  migrateState,
  addItem,
  removeItem,
  deductItems,
  TECHNOLOGIES,
  LAND_PARCELS,
  applyLandPurchase,
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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Sprout, Wheat, Bed, Hammer, Droplets, Scissors, Pickaxe,
  Heart, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Hand, Swords,
  Volume2, VolumeX, Backpack, HelpCircle, Compass, Shield, MapPin, X,
  Mail, Calendar, Trophy, Maximize, Minimize, Flame
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
  initialState: GameState | null;
  onStateChange: (s: GameState) => void;
};

export function MeadowLife({ initialState, onStateChange }: Props) {
  const [state, setState] = useState<GameState>(() => migrateState(initialState ?? newGame()));
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Menu Overlays
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "crafting" | "social" | "skills" | "workers">("inventory");
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"seeds" | "animals" | "upgrades" | "sell" | "hire">("seeds");

  const recipesByCategory = useMemo(() => {
    return {
      logistics: CRAFTING_RECIPES.filter((r) =>
        ["chest", "sprinkler_basic", "sprinkler_quality", "transport_belt", "inserter", "logistics_drone", "drone_hub", "drone_recharger", "power_pole"].includes(r.id)
      ),
      production: CRAFTING_RECIPES.filter((r) =>
        ["furnace", "seed_maker", "research_center", "assembling_machine", "electric_drill", "generator", "solar_panel", "battery", "wood_cutter", "stone_cutter", "rocket_silo"].includes(r.id)
      ),
      materials: CRAFTING_RECIPES.filter((r) =>
        ["iron_gear", "copper_wire", "electronic_circuit", "electrical_cable", "steel_plate", "iron_bar", "copper_bar", "silver_bar", "gold_bar", "rocket_fuel", "rocket_part", "satellite", "torch", "scarecrow", "player_store", "bed", "stone_path", "toolset"].includes(r.id)
      ),
    };
  }, []);

  const [chestOpenTile, setChestOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<{ npcId: string; dialogue: string } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<GameState["dailyEarnings"] | null>(null);

  // New overhauls states
  const [sleepConfirmOpen, setSleepConfirmOpen] = useState(false);
  const [shippingBinOpen, setShippingBinOpen] = useState(false);
  const [furnaceOpenTile, setFurnaceOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [craftingCategory, setCraftingCategory] = useState<"logistics" | "production" | "materials">("logistics");
  const [craftingQueue, setCraftingQueue] = useState<{ id: string; recipeId: string; name: string; iconSymbol: string; iconColor: string; progress: number; duration: number; remainingTime: number }[]>([]);
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
  const [canvasSize, setCanvasSize] = useState({ width: 704, height: 480 });
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  // Zoning Mode
  const [zoningMode, setZoningMode] = useState<"none" | "farming" | "mining" | "woodcutting" | "water" | "erase">("none");
  const isDraggingZone = useRef(false);


  // Hovered item for tooltips inspection
  const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
  
  const chargingToolRef = useRef<{ toolId: string; startTime: number; maxLevel: number } | null>(null);

  // Sync isFullscreen with standard document events (e.g. Esc key exits fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setCanvasSize({ width: 704, height: 480 });
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Update canvas size dynamically when fullscreen is active
  useEffect(() => {
    const updateSize = () => {
      if (isFullscreen) {
        setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
      } else {
        setCanvasSize({ width: 704, height: 480 });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    if (!mainContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await mainContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  // Inventory holding slot
  const [heldItem, setHeldItem] = useState<{ item: Item; originalSlot: number; source: "inventory" | "chest" | "shipping" | "furnace" } | null>(null);

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
    const canvasX = clickX * scaleX;
    const canvasY = clickY * scaleY;

    const p = stateRef.current.player;
    const pSubX = p.subX !== undefined ? p.subX : p.x;
    const pSubY = p.subY !== undefined ? p.subY : p.y;

    const gridCols = stateRef.current.inHouse ? 10 : (stateRef.current.inMine ? 24 : COLS);
    const gridRows = stateRef.current.inHouse ? 10 : (stateRef.current.inMine ? 24 : ROWS);

    let cameraX = 0;
    if (gridCols * TILE < canvasSize.width) {
      cameraX = -(canvasSize.width - gridCols * TILE) / 2;
    } else {
      cameraX = Math.max(
        0,
        Math.min(gridCols * TILE - canvasSize.width, pSubX * TILE + 16 - canvasSize.width / 2)
      );
    }

    let cameraY = 0;
    if (gridRows * TILE < canvasSize.height) {
      cameraY = -(canvasSize.height - gridRows * TILE) / 2;
    } else {
      cameraY = Math.max(
        0,
        Math.min(gridRows * TILE - canvasSize.height, pSubY * TILE + 16 - canvasSize.height / 2)
      );
    }

    const worldX = canvasX + cameraX;
    const worldY = canvasY + cameraY;

    const tileX = Math.floor(worldX / TILE);
    const tileY = Math.floor(worldY / TILE);

    return { x: tileX, y: tileY };
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    if (!coords) return;
    const { x: tileX, y: tileY } = coords;

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

  // Synchronize state changes to parent (save handler)
  useEffect(() => {
    onStateChange(state);
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
    let raf = 0;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setState((prev) => {
        const next = structuredClone(prev);
        
        // Smoothly interpolate player coordinates
        if (next.player.subX === undefined) next.player.subX = next.player.x;
        if (next.player.subY === undefined) next.player.subY = next.player.y;
        next.player.subX += (next.player.x - next.player.subX) * 0.2;
        next.player.subY += (next.player.y - next.player.subY) * 0.2;

        updateEntities(next, dt);

        if (!next.animals) next.animals = [];
        next.animals.forEach((animal) => {
          if (!animal) return;
          animal.subX += (animal.x - animal.subX) * 0.08;
          animal.subY += (animal.y - animal.subY) * 0.08;
        });

        if (next.pets) {
          next.pets.forEach((pet) => {
            if (!pet) return;
            pet.subX += (pet.x - pet.subX) * 0.08;
            pet.subY += (pet.y - pet.subY) * 0.08;
          });
        }

        if (next.workers) {
          next.workers.forEach((worker) => {
            if (!worker) return;
            worker.subX += (worker.x - worker.subX) * 0.08;
            worker.subY += (worker.y - worker.subY) * 0.08;
          });
        }

        if (next.harvestLiftingTimer > 0) {
          next.harvestLiftingTimer = Math.max(0, next.harvestLiftingTimer - dt);
          if (next.harvestLiftingTimer <= 0) {
            next.carryItem = null;
          }
        }
        return next;
      });

      // Ambient particle spawning (on visible screen only)
      const currentGrid = stateRef.current.inMine ? stateRef.current.mineGrid : stateRef.current.tiles;
      if (currentGrid && currentGrid.length > 0) {
        const p = stateRef.current.player;
        const pSubX = p.subX !== undefined ? p.subX : p.x;
        const pSubY = p.subY !== undefined ? p.subY : p.y;
        
        const cameraX = Math.max(
          0,
          Math.min(
            (stateRef.current.inMine ? 24 : COLS) * TILE - canvasSize.width,
            pSubX * TILE + 16 - canvasSize.width / 2
          )
        );
        const cameraY = Math.max(
          0,
          Math.min(
            (stateRef.current.inMine ? 24 : ROWS) * TILE - canvasSize.height,
            pSubY * TILE + 16 - canvasSize.height / 2
          )
        );
        const startCol = Math.max(0, Math.floor(cameraX / TILE));
        const endCol = Math.min(stateRef.current.inMine ? 24 : COLS, Math.ceil((cameraX + canvasSize.width) / TILE));
        const startRow = Math.max(0, Math.floor(cameraY / TILE));
        const endRow = Math.min(stateRef.current.inMine ? 24 : ROWS, Math.ceil((cameraY + canvasSize.height) / TILE));

        for (let y = startRow; y < endRow; y++) {
          for (let x = startCol; x < endCol; x++) {
            const t = currentGrid[y][x];
            
            // 1. Ambient tree leaves
            if (t.kind === "tree" && Math.random() < 0.004) {
              particlesRef.current.push({
                x: x * TILE + 16 + (Math.random() * 20 - 10),
                y: y * TILE + 4 + (Math.random() * 8 - 4),
                vx: -15 - Math.random() * 20, // drift left (wind)
                vy: 20 + Math.random() * 15,  // fall down
                color: Math.random() < 0.2 ? "#e67e22" : Math.random() < 0.1 ? "#f1c40f" : "#2ecc71", // orange/yellow/green
                age: 0,
                maxAge: 1.8 + Math.random() * 1,
                type: "leaf"
              });
            }

            // 2. Active sprinkler water spray
            if (t.kind === "placed_item" && (t.placedItemId === "sprinkler_basic" || t.placedItemId === "sprinkler_quality")) {
              const isQuality = t.placedItemId === "sprinkler_quality";
              if (Math.random() < 0.12) {
                const directions = isQuality ? 8 : 4;
                const angleOffset = (Date.now() / 180) % (Math.PI * 2);
                for (let d = 0; d < directions; d++) {
                  const angle = angleOffset + (d * (Math.PI * 2)) / directions;
                  const speed = 40 + Math.random() * 25;
                  particlesRef.current.push({
                    x: x * TILE + 16,
                    y: y * TILE + 8,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 15, // slight upward arc
                    color: "rgba(52, 152, 219, 0.75)",
                    age: 0,
                    maxAge: 0.35 + Math.random() * 0.15,
                    type: "water"
                  });
                }
              }
            }

            // 3. Chimney smoke particles (Farm House at (16,24) and Shop at (72,32))
            if (t.kind === "house" && Math.random() < 0.05) {
              if ((x === 16 && y === 24) || (x === 72 && y === 32)) {
                particlesRef.current.push({
                  x: x * TILE + 14,
                  y: y * TILE - 8,
                  vx: 5 + Math.random() * 8, // drift right slightly
                  vy: -25 - Math.random() * 15, // float up
                  color: "rgba(220, 220, 220, 0.35)",
                  age: 0,
                  maxAge: 1.5 + Math.random() * 0.5,
                  type: "smoke"
                });
              }
            }

            // 4. Hired worker cabins chimney smoke
            if (t.kind === "placed_item" && t.placedItemId === "worker_cabin" && Math.random() < 0.05) {
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

        // 3. Falling Rain weather particles
        if (stateRef.current.weather === "rainy" && Math.random() < 0.45) {
          for (let i = 0; i < 4; i++) {
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
          const next = structuredClone(prev);
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

      // Draw game onto canvas
      draw(ctx, stateRef.current, canvasSize.width, canvasSize.height, hoveredTileRef.current);

      // Draw particle overlay
      ctx.save();
      const p = stateRef.current.player;
      const pSubX = p.subX !== undefined ? p.subX : p.x;
      const pSubY = p.subY !== undefined ? p.subY : p.y;
      const gridCols = stateRef.current.inHouse ? 10 : (stateRef.current.inMine ? 24 : COLS);
      const gridRows = stateRef.current.inHouse ? 10 : (stateRef.current.inMine ? 24 : ROWS);

      let cameraX = 0;
      if (gridCols * TILE < canvasSize.width) {
        cameraX = -(canvasSize.width - gridCols * TILE) / 2;
      } else {
        cameraX = Math.max(0, Math.min(gridCols * TILE - canvasSize.width, pSubX * TILE + 16 - canvasSize.width / 2));
      }

      let cameraY = 0;
      if (gridRows * TILE < canvasSize.height) {
        cameraY = -(canvasSize.height - gridRows * TILE) / 2;
      } else {
        cameraY = Math.max(0, Math.min(gridRows * TILE - canvasSize.height, pSubY * TILE + 16 - canvasSize.height / 2));
      }
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
        const p = curState.player;
        const ppx = (p.subX !== undefined ? p.subX : p.x) * TILE + 16;
        const ppy = (p.subY !== undefined ? p.subY : p.y) * TILE - 8;

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
      if (miniCanvas) {
        const miniCtx = miniCanvas.getContext("2d");
        if (miniCtx) {
          drawMinimap(miniCtx, stateRef.current, canvasSize.width, canvasSize.height);
        }
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

  // Animal Wandering AI updates (Runs every 3 seconds)
  useEffect(() => {
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (cur.animals.length === 0) return;

      setState((prev) => {
        const next = structuredClone(prev);
        const grid = next.inMine ? next.mineGrid : next.tiles;

        if (!next.animals) next.animals = [];
        next.animals.forEach((animal) => {
          if (!animal) return;
          // Wander randomly
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          const choice = dirs[Math.floor(Math.random() * dirs.length)];
          const nx = animal.x + choice[1];
          const ny = animal.y + choice[0];

          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < grid[0].length &&
            ny < grid.length &&
            isWalkable(grid[ny][nx])
          ) {
            animal.x = nx;
            animal.y = ny;
          }
        });

        return next;
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  // Time Ticks and Auto-Watering Rainy day notifications
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const next = structuredClone(prev);
        const dayEnded = next.time + 10 >= 24 * 60;
        if (dayEnded) {
          sleep(next);
          setSleepSummary(next.dailyEarnings || null);
          toast.success(`Day ${next.day} begins!`);
        } else {
          next.time += 10;
        }
        return next;
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

      // "h" toggles the about page
      if (k === "h" && tag !== "INPUT" && tag !== "TEXTAREA" && !inventoryOpen && !shopOpen && !chatOpen) {
        e.preventDefault();
        setAboutOpen((o) => !o);
        return;
      }

      if (tag === "INPUT" || tag === "TEXTAREA" || inventoryOpen || shopOpen || chestOpenTile || mailboxOpen || chatOpen) return;

      const curState = stateRef.current;

      // Freeze movement when harvesting carrying crop
      if (curState.harvestLiftingTimer > 0) return;


      // W A S D Movement keys
      if (["w", "arrowup", "s", "arrowdown", "a", "arrowleft", "d", "arrowright"].includes(k)) {
        e.preventDefault();
        const now = performance.now();
        const runMultiplier = e.shiftKey ? 70 : 130;
        if (now - lastMove < runMultiplier) return;
        lastMove = now;

        setState((prev) => {
          const next = structuredClone(prev);
          let { x, y } = next.player;

          if (k === "w" || k === "arrowup") {
            next.player.dir = "up";
            y -= 1;
          } else if (k === "s" || k === "arrowdown") {
            next.player.dir = "down";
            y += 1;
          } else if (k === "a" || k === "arrowleft") {
            next.player.dir = "left";
            x -= 1;
          } else if (k === "d" || k === "arrowright") {
            next.player.dir = "right";
            x += 1;
          }

          const grid = next.inHouse
            ? next.houseGrid!
            : (next.inMine ? next.mineGrid : next.tiles);
          const gridRows = grid.length;
          const gridCols = grid[0]?.length || 0;

          if (next.inHouse && x === 5 && y === 9) {
            next.inHouse = false;
            next.player.x = 15;
            next.player.y = 29;
            next.player.subX = 15;
            next.player.subY = 29;
            toast("Exited Farm House");
          } else if (!next.inHouse && !next.inMine && x === 15 && y === 28) {
            next.inHouse = true;
            next.player.x = 5;
            next.player.y = 8;
            next.player.subX = 5;
            next.player.subY = 8;
            toast("Entered Farm House");
                    } else if (!next.inHouse && !next.inMine && x === 70 && y === 40) {
            setTimeout(() => setShopOpen(true), 0);
          } else if (x >= 0 && y >= 0 && x < gridCols && y < gridRows && isWalkable(grid[y][x])) {
            next.player.x = x;
            next.player.y = y;

            // Trigger rustle sway and spawn particles when player walks through crops or weeds
            const stepTile = grid[y][x];
            if (stepTile.cropId || stepTile.kind === "debris_weed") {
              stepTile.lastRustleTime = Date.now();
              const pColor = stepTile.kind === "debris_weed" ? "#2ecc71" : (CROPS[stepTile.cropId!]?.accent || "#2ecc71");
              const px = x * TILE + 16;
              const py = y * TILE + 24;
              for (let i = 0; i < 3; i++) {
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

            if (next.inMine && grid[y][x].kind === "mine_ladder" && x === 3 && y === 3) {
              next.inMine = false;
              next.mineDepth = 0;
              next.player.x = 72;
              next.player.y = 8;
              toast("Exited the mines.");
            } else if (next.inMine && grid[y][x].kind === "mine_ladder" && (x !== 3 || y !== 3)) {
              next.mineDepth += 1;
              const f = generateMineFloor(next.mineDepth);
              next.mineGrid = f.grid;
              next.mineEnemies = f.enemies;
              next.player.x = 3;
              next.player.y = 3;
              toast.success(`Descended to mine floor ${next.mineDepth}!`);
            } else if (!next.inMine && grid[y][x].kind === "mine_cave") {
              next.inMine = true;
              next.mineDepth = 1;
              const f = generateMineFloor(1);
              next.mineGrid = f.grid;
              next.mineEnemies = f.enemies;
              next.player.x = 3;
              next.player.y = 3;
              toast.success("Entered the mines. Watch out for slimes!");
            }
          }
          return next;
        });
      }
      // Space / E Action Key
      else if (e.code === "Space") {
        e.preventDefault();

        const held = curState.inventory[curState.hotbarIndex];

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
        setState((prev) => {
          const next = structuredClone(prev);
          const targetCoords = hoveredTileRef.current || frontTile(next) || next.player;
          const act = interact(next, 1, hoveredTileRef.current || undefined);

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
      }
      // Hotbar selection numbers
      else if (["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].includes(k)) {
        const idx = k === "0" ? 9 : parseInt(k) - 1;
        setState((prev) => ({ ...prev, hotbarIndex: idx }));
      }
      // Dialogue talk
      else if (k === "f") {
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
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "furnace") {
            setFurnaceOpenTile({ x: f.x, y: f.y });
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "player_store") {
            setPlayerStoreTile({ x: f.x, y: f.y });
            setPlayerStoreTab("buy");
            setPlayerStoreOpen(true);
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "research_center") {
            setResearchCenterOpen(true);
          } else if (facingTile.kind === "placed_item" && facingTile.placedItemId === "mailbox") {
            setMailboxOpen(true);
          } else if (facingTile.kind === "placed_item" && (facingTile.placedItemId === "chest" || facingTile.placedItemId === "worker_cabin")) {
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
      // ESC / I Inventory panel
      else if (k === "i" || k === "e" || e.code === "Escape") {
        e.preventDefault();
        setInventoryOpen((o) => !o);
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
            const targetCoords = hoveredTileRef.current || frontTile(next) || next.player;
            const act = interact(next, chargeLevel, hoveredTileRef.current || undefined);

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
      setCraftingQueue((prevQueue) => {
        if (prevQueue.length === 0) return prevQueue;

        const nextQueue = prevQueue.map((item, idx) => {
          if (idx === 0) {
            const timeStep = 0.1; // 100ms
            const remaining = Math.max(0, item.remainingTime - timeStep);
            const duration = item.duration || 2;
            const progress = Math.round(((duration - remaining) / duration) * 100);
            return { ...item, remainingTime: remaining, progress };
          }
          return item;
        });

        const active = nextQueue[0];
        if (active.remainingTime <= 0) {
          setState((prev) => {
            const next = structuredClone(prev);
            const recipe = CRAFTING_RECIPES.find((r) => r.id === active.recipeId);
            if (recipe) {
              const output = createItem(recipe.outputId, recipe.outputCount);
              const success = addItem(next.inventory, output);
              if (success) {
                toast.success(`Crafted ${recipe.name}! 🛠️`);
                gameAudio.playCoin();
              } else {
                toast.warning(`Inventory full! Added to backpack extra slots.`);
                next.inventory.push(output);
              }
            }
            return next;
          });
          return nextQueue.slice(1);
        }

        return nextQueue;
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

  const deductGlobalItems = (gameState: GameState, itemId: string, count: number) => {
    let remaining = count;
    for (let i = 0; i < gameState.inventory.length; i++) {
      const itm = gameState.inventory[i];
      if (itm && itm.id === itemId) {
        if (itm.count >= remaining) {
          itm.count -= remaining;
          if (itm.count === 0) gameState.inventory[i] = null;
          return;
        } else {
          remaining -= itm.count;
          gameState.inventory[i] = null;
        }
      }
    }
    if (remaining > 0) {
      const grids = [gameState.tiles, gameState.houseGrid, gameState.mineGrid].filter(Boolean) as Tile[][][];
      for (const grid of grids) {
        for (const row of grid) {
          for (const tile of row) {
            if (tile.kind === "placed_item" && tile.placedItemId === "chest" && tile.chestInventory) {
              for (let i = 0; i < tile.chestInventory.length; i++) {
                const itm = tile.chestInventory[i];
                if (itm && itm.id === itemId) {
                  if (itm.count >= remaining) {
                    itm.count -= remaining;
                    if (itm.count === 0) tile.chestInventory[i] = null;
                    return;
                  } else {
                    remaining -= itm.count;
                    tile.chestInventory[i] = null;
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  const handleStartCrafting = (recipe: Recipe) => {
    if (recipe.techRequired && !(state.unlockedTechs || []).includes(recipe.techRequired)) {
      const tech = TECHNOLOGIES.find((t) => t.id === recipe.techRequired);
      toast.error(`🔒 Research "${tech?.name || recipe.techRequired}" at the Research Center first!`);
      return;
    }

    let hasAll = true;
    setState((prev) => {
      const next = structuredClone(prev);
      for (const input of recipe.inputs) {
        if (!checkGlobalItems(next, input.itemId, input.count)) {
          hasAll = false;
          break;
        }
      }

      if (!hasAll) {
        toast.error(`Not enough ingredients to craft ${recipe.name}!`);
        return prev;
      }

      for (const input of recipe.inputs) {
        deductGlobalItems(next, input.itemId, input.count);
      }

      const itemDef = ITEM_DEFS[recipe.outputId];
      const duration = 1.5;
      setCraftingQueue((prevQueue) => [
        ...prevQueue,
        {
          id: `${recipe.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recipeId: recipe.id,
          name: recipe.name,
          iconSymbol: itemDef?.iconSymbol || "⚙",
          iconColor: itemDef?.iconColor || "#94a3b8",
          progress: 0,
          duration,
          remainingTime: duration,
        },
      ]);

      toast.info(`Queued ${recipe.name} for crafting...`);
      return next;
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    hoveredTileRef.current = coords;

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
    if (zoningMode !== "none" && e.button === 0) {
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
  };

  const handleCanvasMouseUp = () => {
    isDraggingZone.current = false;
  };


  const handleCanvasMouseLeave = () => {
    hoveredTileRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (zoningMode !== "none") return;
    const coords = getMouseTileCoords(e.clientX, e.clientY);
    if (!coords) return;

    const curState = stateRef.current;
    const p = curState.player;
    const dist = Math.abs(coords.x - p.x) + Math.abs(coords.y - p.y);
    if (dist > 5) {
      toast.error("Target tile is out of reach!");
      return;
    }

    const grid = curState.inHouse ? curState.houseGrid! : (curState.inMine ? curState.mineGrid : curState.tiles);
    const tile = grid[coords.y]?.[coords.x];
    const held = curState.inventory[curState.hotbarIndex];

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
        tile.placedItemId === "chest" ||
        tile.placedItemId === "water_tank" ||
        tile.placedItemId === "mailbox" ||
        tile.placedItemId === "worker_cabin" ||
        tile.placedItemId === "chicken_egg"
      )) ||
      (!curState.inMine && !curState.inHouse && coords.x === 18 && coords.y === 29)
    );

    const hasEntity = clickedAnimal || clickedPet || clickedWorker || clickedNpc;
    const isTool = held && (held.type === "tool" || held.id === "fishing_rod");

    if ((isInteractive || hasEntity) && !isTool) {
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
        } else if (tile.kind === "placed_item" && tile.placedItemId === "furnace") {
          setFurnaceOpenTile({ x: coords.x, y: coords.y });
        } else if (tile.kind === "placed_item" && tile.placedItemId === "mailbox") {
          setMailboxOpen(true);
        } else if (tile.kind === "placed_item" && (tile.placedItemId === "chest" ||
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
      setState((prev) => {
        const next = structuredClone(prev);
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
        return next;
      });
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

  // Inventory slot clicks
  const handleSlotClick = (index: number, source: "inventory" | "chest" | "shipping" | "furnace", e?: React.MouseEvent) => {
    if (e && e.shiftKey && chestOpenTile && (source === "inventory" || source === "chest")) {
      e.preventDefault();
      setState(prev => {
        const next = structuredClone(prev);
        const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
        const chestInv = grid[chestOpenTile.y][chestOpenTile.x].chestInventory!;
        
        if (source === "inventory") {
          const itm = next.inventory[index];
          if (itm) {
            const success = addItem(chestInv, structuredClone(itm));
            if (success) {
              next.inventory[index] = null;
              gameAudio.playLevelUp();
            } else toast.error("Chest is full!");
          }
        } else if (source === "chest") {
          const itm = chestInv[index];
          if (itm) {
            const success = addItem(next.inventory, structuredClone(itm));
            if (success) {
              chestInv[index] = null;
              gameAudio.playLevelUp();
            } else toast.error("Inventory is full!");
          }
        }
        return next;
      });
      return;
    }
    if (heldItem === null) {
      let item = null;
      if (source === "inventory") {
        item = state.inventory[index];
      } else if (source === "shipping") {
        item = state.shippingBin[index];
      } else if (source === "chest" && chestOpenTile) {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        item = grid[chestOpenTile.y]?.[chestOpenTile.x]?.chestInventory?.[index];
      } else if (source === "furnace" && furnaceOpenTile) {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        item = grid[furnaceOpenTile.y]?.[furnaceOpenTile.x]?.chestInventory?.[index];
      }

      if (item) {
        setHeldItem({ item, originalSlot: index, source });
        setState((prev) => {
          const next = structuredClone(prev);
          if (source === "inventory") {
            next.inventory[index] = null;
          } else if (source === "shipping") {
            next.shippingBin[index] = null;
          } else if (source === "chest" && chestOpenTile) {
            const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
            grid[chestOpenTile.y][chestOpenTile.x].chestInventory![index] = null;
          } else if (source === "furnace" && furnaceOpenTile) {
            const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
            grid[furnaceOpenTile.y][furnaceOpenTile.x].chestInventory![index] = null;
          }
          return next;
        });
      }
    } else {
      const itemToPlace = heldItem.item;

      // Validate furnace insertion rules
      if (source === "furnace") {
        if (index === 2) {
          toast.error("Output slot is retrieve-only!");
          return;
        }
        if (index === 0) {
          const validOres = ["copper_ore", "iron_ore", "gold_ore", "uranium_ore"];
          if (!validOres.includes(itemToPlace.id)) {
            toast.error("Only copper, iron, gold, or uranium ores can be placed in the input slot!");
            return;
          }
        }
        if (index === 1) {
          const validFuels = ["coal", "wood"];
          if (!validFuels.includes(itemToPlace.id)) {
            toast.error("Only coal or wood can be placed in the fuel slot!");
            return;
          }
        }
      }

      setState((prev) => {
        const next = structuredClone(prev);
        let targetInv: (Item | null)[] = [];
        if (source === "inventory") {
          targetInv = next.inventory;
        } else if (source === "shipping") {
          targetInv = next.shippingBin;
        } else if (source === "chest" && chestOpenTile) {
          const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
          targetInv = grid[chestOpenTile.y][chestOpenTile.x].chestInventory!;
        } else if (source === "furnace" && furnaceOpenTile) {
          const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
          targetInv = grid[furnaceOpenTile.y][furnaceOpenTile.x].chestInventory!;
        }

        const targetItem = targetInv[index];

        if (targetItem === null) {
          targetInv[index] = itemToPlace;
          setHeldItem(null);
        } else if (targetItem.id === itemToPlace.id && targetItem.type !== "tool") {
          targetItem.count += itemToPlace.count;
          setHeldItem(null);
        } else {
          const holding = itemToPlace;
          const original = heldItem.originalSlot;
          const originalSrc = heldItem.source;

          targetInv[index] = holding;
          setHeldItem({ item: targetItem, originalSlot: original, source: originalSrc });
        }
        return next;
      });
    }
  };

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

  const handleSlotRightClick = (e: React.MouseEvent, index: number, source: "inventory" | "chest" | "shipping" | "furnace") => {
    e.preventDefault(); // Prevent context menu
    let curGrid = state.inventory;
    if (source === "inventory") {
      curGrid = state.inventory;
    } else if (source === "shipping") {
      curGrid = state.shippingBin;
    } else if (source === "chest" && chestOpenTile) {
      const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
      curGrid = grid[chestOpenTile.y]?.[chestOpenTile.x]?.chestInventory || [];
    } else if (source === "furnace" && furnaceOpenTile) {
      const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
      curGrid = grid[furnaceOpenTile.y]?.[furnaceOpenTile.x]?.chestInventory || [];
    }

    if (heldItem === null) {
      const item = curGrid[index];
      if (item && item.count > 1 && item.type !== "tool" && item.type !== "weapon") {
        const halfCount = Math.ceil(item.count / 2);
        const remainCount = item.count - halfCount;

        const heldObj = { ...item, count: halfCount };
        setHeldItem({ item: heldObj, originalSlot: index, source });

        setState((prev) => {
          const next = structuredClone(prev);
          let targetInv: (Item | null)[] = [];
          if (source === "inventory") {
            targetInv = next.inventory;
          } else if (source === "shipping") {
            targetInv = next.shippingBin;
          } else if (source === "chest" && chestOpenTile) {
            const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
            targetInv = grid[chestOpenTile.y][chestOpenTile.x].chestInventory!;
          } else if (source === "furnace" && furnaceOpenTile) {
            const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
            targetInv = grid[furnaceOpenTile.y][furnaceOpenTile.x].chestInventory!;
          }

          if (targetInv && targetInv[index]) {
            if (remainCount <= 0) {
              targetInv[index] = null;
            } else {
              targetInv[index]!.count = remainCount;
            }
          }
          return next;
        });
      } else if (item) {
        handleSlotClick(index, source);
      }
    } else {
      const itemToPlace = heldItem.item;

      // Validate furnace insertion rules
      if (source === "furnace") {
        if (index === 2) {
          toast.error("Output slot is retrieve-only!");
          return;
        }
        if (index === 0) {
          const validOres = ["copper_ore", "iron_ore", "gold_ore", "uranium_ore"];
          if (!validOres.includes(itemToPlace.id)) {
            toast.error("Only copper, iron, gold, or uranium ores can be placed in the input slot!");
            return;
          }
        }
        if (index === 1) {
          const validFuels = ["coal", "wood"];
          if (!validFuels.includes(itemToPlace.id)) {
            toast.error("Only coal or wood can be placed in the fuel slot!");
            return;
          }
        }
      }

      setState((prev) => {
        const next = structuredClone(prev);
        let targetInv: (Item | null)[] = [];
        if (source === "inventory") {
          targetInv = next.inventory;
        } else if (source === "shipping") {
          targetInv = next.shippingBin;
        } else if (source === "chest" && chestOpenTile) {
          const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
          targetInv = grid[chestOpenTile.y][chestOpenTile.x].chestInventory!;
        } else if (source === "furnace" && furnaceOpenTile) {
          const grid = next.inHouse ? next.houseGrid! : (next.inMine ? next.mineGrid : next.tiles);
          targetInv = grid[furnaceOpenTile.y][furnaceOpenTile.x].chestInventory!;
        }

        if (targetInv) {
          const targetItem = targetInv[index];
          if (targetItem === null) {
            targetInv[index] = { ...itemToPlace, count: 1 };
            setHeldItem((prevHeld) => {
              if (!prevHeld) return null;
              const newCount = prevHeld.item.count - 1;
              if (newCount <= 0) return null;
              return { ...prevHeld, item: { ...prevHeld.item, count: newCount } };
            });
          } else if (targetItem.id === itemToPlace.id && targetItem.type !== "tool" && targetItem.type !== "weapon") {
            targetItem.count += 1;
            setHeldItem((prevHeld) => {
              if (!prevHeld) return null;
              const newCount = prevHeld.item.count - 1;
              if (newCount <= 0) return null;
              return { ...prevHeld, item: { ...prevHeld.item, count: newCount } };
            });
          }
        }
        return next;
      });
    }
  };

  // Give item to NPC
  const handleGiveGift = () => {
    if (!npcDialogue) return;
    const npcId = npcDialogue.npcId;
    const held = state.inventory[state.hotbarIndex];

    if (!held) {
      toast.error("You aren't holding any items!");
      return;
    }

    const react = giftReaction(npcId, held.id);

    setState((prev) => {
      const next = structuredClone(prev);
      removeItem(next.inventory, next.hotbarIndex, 1);
      next.npcFriendships[npcId] = (next.npcFriendships[npcId] || 0) + react.points;
      setNpcDialogue({ npcId, dialogue: `[Gift: ${held.name}] — ${react.dialogue}` });
      return next;
    });

    gameAudio.playCoin();
  };

  // Shop purchase
  const handleBuy = (seedId: string, price: number) => {
    if (state.coins < price) {
      toast.error("Not enough coins!");
      return;
    }
    const item = createItem(seedId, 1);
    setState((prev) => {
      const next = structuredClone(prev);
      const success = addItem(next.inventory, item);
      if (success) {
        next.coins -= price;
        toast.success(`Bought ${item.name}! (-${price}g)`);
      } else {
        toast.error("Inventory full!");
      }
      return next;
    });
    gameAudio.playCoin();
  };

  const handleSellAllCrops = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      let totalSold = 0;
      let totalGained = 0;

      for (let i = 0; i < next.inventory.length; i++) {
        const item = next.inventory[i];
        if (item && (item.type === "crop" || item.type === "fish" || item.id === "chicken_egg" || item.id === "milk")) {
          totalSold += item.count;
          totalGained += item.price * item.count;
          next.inventory[i] = null;
        }
      }

      if (totalSold > 0) {
        next.coins += totalGained;
        toast.success(`Sold ${totalSold} items for +${totalGained}g!`);
        gameAudio.playCoin();
      } else {
        toast.error("No harvest crops, eggs, milk, or fish in inventory.");
      }
      return next;
    });
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
        const msg = next.godMode ? "GOD MODE ENABLED ✨ (Infinite energy & invincibility)" : "God mode disabled";
        addHistory(msg, next.godMode ? "#fbbf24" : "#94a3b8");
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
      addHistory("/god — Toggle God Mode (infinite energy + invincibility)", "#e2e8f0");
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


  return (
    <div 
      ref={mainContainerRef} 
      className={`flex flex-col items-center justify-center w-full px-2 transition-all duration-300 ${
        isFullscreen 
          ? "bg-[#18110e] p-0 min-h-screen text-slate-200" 
          : "max-w-4xl"
      }`}
    >
      {/* Game Screen Frame */}
      <div 
        className={`relative overflow-hidden bg-black transition-all duration-300 ${
          isFullscreen 
            ? "border-0 rounded-none w-screen h-screen" 
            : "rounded-xl border-4 border-[#2d3033] bg-[#141517] shadow-2xl"
        }`} 
        style={{ 
          height: isFullscreen ? "100vh" : `${canvasSize.height}px`,
          width: isFullscreen ? "100vw" : "704px",
          maxWidth: isFullscreen ? "none" : "704px" 
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onContextMenu={handleCanvasContextMenu}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => { handleCanvasMouseLeave(); isDraggingZone.current = false; }}
          onClick={handleCanvasClick}
          style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", cursor: "crosshair" }}
        />

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
                className={`text-[10px] font-bold uppercase rounded-none transition-all ${
                  zoningMode === mode 
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

        {/* Floating Top-Left Action Bar */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#202224]/80 border border-slate-700 p-1 font-mono shadow-md">
          {/* Backpack Journal Button */}
          <button
            onClick={() => { setInventoryOpen(true); setActiveTab("inventory"); }}
            title="Backpack Journal (I)"
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs"
          >
            <Backpack className="h-4 w-4 text-[#ff9200]" />
          </button>
          
          {/* Pierre's Shop Button */}
          <button
            onClick={() => setShopOpen(true)}
            title="Pierre's Shop"
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs"
          >
            <Coins className="h-4 w-4 text-yellow-500" />
          </button>

          {/* Mailbox Button (shown if letters exist) */}
          {state.mailboxLetters.length > 0 && (
            <button
              onClick={() => setMailboxOpen(true)}
              title={`Mailbox (${state.mailboxLetters.filter(l => !l.claimed).length} unread)`}
              className={`w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs ${
                state.hasUnreadMail ? "animate-pulse border-red-500 text-red-500 bg-red-500/10" : ""
              }`}
            >
              <Mail className="h-4 w-4" />
            </button>
          )}

          {/* Sleep (Save & Grow) Button */}
          <button
            onClick={handleManualSleep}
            title="Sleep (Save & Grow)"
            className="w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#ff9200]/20 border border-slate-600 hover:border-[#ff9200] text-slate-100 transition-all cursor-pointer font-bold text-xs"
          >
            <Bed className="h-4 w-4 text-emerald-400" />
          </button>

          {/* About / Game Guide Button (H) */}
          <button
            onClick={() => setAboutOpen(true)}
            title="About & Cheats (H)"
            className="h-8 px-2 flex items-center justify-center gap-1 bg-[#2a2c2e] hover:bg-[#22d3ee]/20 border border-slate-600 hover:border-[#22d3ee] text-slate-100 transition-all cursor-pointer font-bold text-xs"
          >
            <HelpCircle className="h-4 w-4 text-[#22d3ee]" />
            <span className="text-[#22d3ee]">About & Cheats (H)</span>
          </button>

          {/* Cheat Console Button (/) */}
          <button
            onClick={() => { setChatOpen(true); setTimeout(() => chatInputRef.current?.focus(), 50); }}
            title="Cheat Console (/)"
            className={`w-8 h-8 flex items-center justify-center bg-[#2a2c2e] hover:bg-[#a78bfa]/20 border transition-all cursor-pointer font-bold text-xs font-mono ${state.godMode ? "border-amber-500 bg-amber-500/10 animate-pulse" : "border-slate-600 hover:border-[#a78bfa]"}`}
          >
            <span className={`text-sm font-black ${state.godMode ? "text-amber-400" : "text-[#a78bfa]"}`}>/</span>
          </button>


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

        {/* Mine Depth label */}
        {state.inMine && (
          <div className="absolute top-[52px] left-3 px-2 py-1 bg-[#202224]/80 border border-slate-700 text-red-400 rounded-none text-[10px] font-mono flex items-center gap-1 z-20 shadow-md">
            <Shield className="h-3 w-3 text-red-400 animate-bounce" />
            <span>MINE LEVEL: {state.mineDepth}</span>
          </div>
        )}

        {/* Floating Top-Right Radar / Minimap & Info Panel */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 w-[160px] bg-[#202224]/90 border border-slate-700 p-1 font-mono text-[9px] text-slate-200 shadow-xl select-none">
          {/* Header Title */}
          <div className="flex justify-between items-center px-1 text-slate-400 border-b border-slate-700/80 pb-0.5">
            <span className="font-bold tracking-wider text-[#ff9200]">RADAR COMPASS</span>
            <span>{state.weather === "rainy" ? "🌧" : "☀️"}</span>
          </div>

          {/* Minimap Canvas Container */}
          <div className="w-[150px] h-[150px] bg-[#141517] border border-slate-800 relative mx-auto flex items-center justify-center">
            <canvas
              ref={minimapRef}
              width={148}
              height={148}
              className="block"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          {/* Dashboard stats */}
          <div className="flex flex-col gap-0.5 px-1 py-0.5 leading-normal text-slate-300">
            <div className="flex justify-between">
              <span>LOC:</span>
              <span className="font-bold text-slate-100 truncate max-w-[100px]">
                {state.inMine ? `MINES (L${state.mineDepth})` : "MEADOW FARM"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>DATE:</span>
              <span className="font-bold text-slate-100 capitalize">
                {state.season} D{state.day}
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
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 bg-[#202224]/90 border border-slate-700 p-1 shadow-2xl">
            {state.inventory.slice(0, 10).map((item, idx) => {
              const selected = state.hotbarIndex === idx;
              const slotKey = idx === 9 ? "0" : (idx + 1).toString();
              return (
                <button
                  key={idx}
                  onClick={() => setState((prev) => ({ ...prev, hotbarIndex: idx }))}
                  className={`relative flex flex-col items-center justify-center w-[46px] h-[46px] transition-all cursor-pointer select-none rounded-none ${
                    selected
                      ? "border-2 border-[#ff9200] bg-[#ff9200]/15 scale-[1.08] shadow-[0_0_8px_rgba(255,146,0,0.5)] z-10"
                      : "border border-slate-700 bg-[#141517] hover:bg-slate-800"
                  }`}
                >
                  {/* Slot numeric shortcut overlay */}
                  <span className="absolute top-0.5 left-1 text-[8px] font-bold text-slate-500 leading-none">
                    {slotKey}
                  </span>
                  
                  {item ? (
                    <>
                      <span className="text-2xl mt-1 select-none" style={{ textShadow: "1px 1px 0px rgba(0,0,0,0.5)" }}>
                        {item.iconSymbol || "🎁"}
                      </span>
                      {item.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 px-0.5 bg-black/75 text-[8px] font-bold text-white font-mono leading-none">
                          {item.count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] opacity-10 text-white font-mono">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Crafting Queue HUD Overlay */}
        {craftingQueue.length > 0 && (
          <div className="absolute bottom-16 left-3 z-20 flex flex-col gap-1.5 bg-zinc-950/90 border border-zinc-705 p-2 font-mono shadow-md text-zinc-100 min-w-[150px] rounded-sm">
            <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800 pb-1 flex justify-between items-center">
              <span>Crafting Queue</span>
              <span className="text-orange-400 bg-orange-950/50 px-1 rounded font-extrabold text-[8px]">
                {craftingQueue.length} items
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xl bg-zinc-900 p-1 border border-zinc-800 rounded">
                {craftingQueue[0].iconSymbol}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-zinc-200 truncate">
                  {craftingQueue[0].name}
                </div>
                <div className="w-full bg-zinc-800 h-1.5 border border-zinc-750 mt-1 rounded-none overflow-hidden relative">
                  <div 
                    className="bg-orange-500 h-full transition-all duration-100"
                    style={{ width: `${craftingQueue[0].progress}%` }}
                  />
                </div>
              </div>
            </div>

            {craftingQueue.length > 1 && (
              <div className="text-[8px] text-zinc-500 font-bold text-right pt-0.5">
                +{craftingQueue.length - 1} more queued
              </div>
            )}
          </div>
        )}

        {/* Floating monospaced guide helper in bottom left */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-col text-[8px] font-mono text-slate-500 leading-normal bg-black/30 p-1 pointer-events-none select-none">
          <span>KEYS 1-0: SELECT SLOT</span>
          <span>SPACE / E: USE ITEM</span>
          <span>F: TALK / SHOP / MAIL</span>
          <span>I: BACKPACK JOURNAL</span>
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

        {/* Floating Carry/Hold info */}
        {heldItem && (
          <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 bg-[#202224]/90 border border-slate-700 text-amber-400 rounded-none text-[10px] flex items-center gap-1.5 font-mono shadow-md animate-bounce">
            <Backpack className="h-3 w-3 text-amber-400" />
            <span>Holding: {heldItem.item.name} ({heldItem.item.count}x)</span>
          </div>
        )}
      </div>

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
          <div className="flex border-b border-slate-800 gap-1 my-2">
            {(["seeds", "animals", "upgrades", "sell", "hire"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setShopTab(tab)}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-none ${
                  shopTab === tab
                    ? "bg-[#2d3748] text-white border-t-2 border-[#38b2ac] shadow-inner"
                    : "bg-[#2f3136] text-slate-400 hover:text-slate-200 border-t-2 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="py-2 min-h-[220px] max-h-[320px] overflow-y-auto pr-1">
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
                          <div className="text-[9px] text-slate-400">Qty: {item.count}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-emerald-500/25 hover:border-emerald-500 hover:text-emerald-400 rounded-none font-mono"
                        onClick={() => {
                          setState(prev => {
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
                        Sell 1x (+{item.price}g)
                      </Button>
                    </div>
                  );
                })}
                {state.inventory.every(item => !item || !item.price) && (
                  <div className="col-span-1 sm:col-span-2 text-center text-slate-500 text-xs py-8">
                    You have no sellable items in your inventory.
                  </div>
                )}
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
                        Requires a vacant Worker Cabin to house them.<br/>
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
            <Button size="sm" variant="outline" className="flex-1 text-xs text-slate-300 border-slate-700 hover:bg-slate-800 rounded-none" onClick={handleSellAllCrops}>
              Sell All Crops, Eggs, & Milk in Bag
            </Button>
            <Button size="sm" className="text-xs bg-[#ff9200] hover:bg-[#ff9200]/80 text-[#141517] font-bold rounded-none" onClick={() => setShopOpen(false)}>
              Close Shop
            </Button>
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
                  className={`w-full p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                    letter.claimed
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
              <Button w-full className="text-xs font-bold" onClick={handleCloseSleepSummary}>
                Wake Up (Day {state.day})
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* D. TABBED JOURNAL / BACKPACK */}
      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-3xl bg-[#141517] border-[3px] border-[#4a5568] text-slate-100 rounded-sm font-mono shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2 text-[#e2e8f0] border-b border-[#4a5568] pb-3 bg-[#1e222a] -mt-6 -mx-6 px-6 pt-6">
              <Backpack className="h-5 w-5 text-[#ff9200]" />
              <span>Backpack Journal</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex border-b border-slate-800 gap-1 my-1">
            {(["inventory", "crafting", "workers", "social", "skills"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-none ${
                  activeTab === tab
                    ? "bg-[#2d3748] text-white border-t-2 border-[#38b2ac] shadow-inner"
                    : "bg-[#2f3136] text-slate-400 hover:text-slate-200 border-t-2 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="py-2 min-h-[250px] max-h-[330px] overflow-y-auto">
            {activeTab === "inventory" && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-[10px] h-6 px-2.5 bg-[#3a3f44] border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono" 
                    onClick={handleSortInventory}
                  >
                    Sort Inventory
                  </Button>
                </div>
                <div className="grid grid-cols-10 gap-1 bg-[#1a202c] p-3 border-2 border-[#2d3748] rounded-sm">
                  {state.inventory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handleSlotClick(idx, "inventory", e)}
                      onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                      onMouseEnter={() => item && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center h-[44px] transition-all rounded-none ${
                        item
                          ? "bg-[#2d3748] hover:bg-[#4a5568] border-2 border-[#4a5568] hover:border-[#38b2ac] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] text-slate-100"
                          : "bg-[#1a202c] border-2 border-[#2d3748] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] text-slate-600"
                      }`}
                    >
                      {idx < 10 && (
                        <span className="absolute top-0.5 left-1 text-[8px] font-bold text-slate-500 leading-none">
                          {idx === 9 ? "0" : idx + 1}
                        </span>
                      )}
                      {item ? (
                        <>
                          <span className="text-2xl mt-1 select-none">{item.iconSymbol || "🎁"}</span>
                          {item.count > 1 && (
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                              {item.count}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs opacity-10 text-stone-100">-</span>
                      )}
                    </button>
                  ))}
                </div>

                {heldItem && (
                  <div className="p-2 bg-[#ff9200]/10 border border-[#ff9200]/20 rounded-none text-[10px] text-[#ff9200] flex items-center justify-between font-mono">
                    <span>Holding: {heldItem.item.name} ({heldItem.item.count}x)</span>
                    <Button size="sm" variant="outline" className="text-[10px] h-5 px-1.5 rounded-none border-slate-700 hover:bg-slate-800" onClick={() => setHeldItem(null)}>
                      Clear
                    </Button>
                  </div>
                )}

                {/* Detailed Hover Inspection Tooltip */}
                {hoveredItem ? (
                  <div className="p-2 bg-[#141517] border border-slate-700 rounded-none flex items-start gap-2.5 transition-all font-mono">
                    <span className="text-2xl bg-[#1e2022] p-1 rounded-none border border-slate-800">{hoveredItem.iconSymbol || "🎁"}</span>
                    <div className="flex-1 text-[11px] leading-snug">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#ff9200]">{hoveredItem.name}</span>
                        {hoveredItem.price > 0 && <span className="font-bold text-yellow-500">{hoveredItem.price}g</span>}
                      </div>
                      <p className="text-slate-350 text-[10px] mt-0.5">{hoveredItem.description}</p>
                      {(hoveredItem.energyRestore !== undefined || hoveredItem.healthRestore !== undefined) && (
                        <div className="flex gap-2 mt-1 text-[9px] font-bold">
                          {hoveredItem.energyRestore !== undefined && hoveredItem.energyRestore !== 0 && (
                            <span className="text-emerald-450">⚡ Energy: {hoveredItem.energyRestore > 0 ? "+" : ""}{hoveredItem.energyRestore}</span>
                          )}
                          {hoveredItem.healthRestore !== undefined && hoveredItem.healthRestore !== 0 && (
                            <span className="text-red-400">❤️ Health: {hoveredItem.healthRestore > 0 ? "+" : ""}{hoveredItem.healthRestore}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-[#141517]/30 border border-dashed border-slate-800 rounded-none text-center text-slate-500 text-[10px] py-3 font-mono">
                    Hover over an item to inspect details. Right-click to split stacks.
                  </div>
                )}

                {/* Global Storage Section */}
                <div className="mt-4 border-t border-[#ff9200]/30 pt-3">
                  <h3 className="text-[#ff9200] font-bold mb-2 flex items-center gap-2">
                    <span>📦</span> Global Storage (All Chests)
                  </h3>
                  <div className="flex flex-wrap gap-1 bg-[#1a202c] p-3 border-2 border-[#2d3748] rounded-sm max-h-[120px] overflow-y-auto">
                    {getGlobalStorageItems(state).length === 0 ? (
                      <div className="text-slate-500 text-xs italic">No items stored in chests.</div>
                    ) : (
                      getGlobalStorageItems(state).map((item, idx) => (
                        <div key={idx} className="w-10 h-10 bg-[#2d3748] border border-slate-600 flex items-center justify-center relative rounded text-2xl">
                          <span title={item.name}>{item.iconSymbol}</span>
                          <span className="absolute bottom-0.5 right-1 text-[9px] font-black text-white outline-text">{item.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "crafting" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                {/* Left side: Category Selectors & Recipe Grid */}
                <div className="md:col-span-2 space-y-4">
                  {/* Factorio-style Tab buttons */}
                  <div className="flex gap-1.5 border-b border-zinc-700 pb-2">
                    <button
                      onClick={() => setCraftingCategory("logistics")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border font-bold transition-all ${
                        craftingCategory === "logistics"
                          ? "bg-zinc-850 border-orange-500 text-orange-400 font-extrabold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <Backpack className="h-3.5 w-3.5" />
                      Logistics
                    </button>
                    <button
                      onClick={() => setCraftingCategory("production")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border font-bold transition-all ${
                        craftingCategory === "production"
                          ? "bg-zinc-850 border-orange-500 text-orange-400 font-extrabold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <Hammer className="h-3.5 w-3.5" />
                      Production
                    </button>
                    <button
                      onClick={() => setCraftingCategory("materials")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border font-bold transition-all ${
                        craftingCategory === "materials"
                          ? "bg-zinc-850 border-orange-500 text-orange-400 font-extrabold"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Materials
                    </button>
                  </div>

                  {/* Recipes Grid */}
                  <div className="grid grid-cols-6 gap-2 p-3 bg-zinc-950/80 rounded border border-zinc-800/80 min-h-[160px]">
                    {(recipesByCategory[craftingCategory] || []).map((recipe) => {
                      const itemDef = ITEM_DEFS[recipe.outputId];
                      const isTechLocked = recipe.techRequired && !(state.unlockedTechs || []).includes(recipe.techRequired);
                      const canCraft = !isTechLocked && recipe.inputs.every((input) =>
                        checkGlobalItems(state, input.itemId, input.count)
                      );

                      return (
                        <button
                          key={recipe.id}
                          onMouseEnter={() => setHoveredRecipe(recipe)}
                          onMouseLeave={() => setHoveredRecipe(null)}
                          onClick={() => handleStartCrafting(recipe)}
                          className={`relative flex flex-col items-center justify-center h-14 w-14 rounded border-2 transition-all ${
                            isTechLocked
                              ? "bg-purple-950/40 border-violet-900/60 opacity-60 text-purple-300 hover:border-violet-500 cursor-pointer"
                              : canCraft
                              ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800 hover:border-orange-500 text-zinc-200"
                              : "bg-zinc-950/60 border-zinc-900 opacity-45 desaturate-50 text-zinc-500 cursor-not-allowed"
                          }`}
                        >
                          <span className="text-2xl">{itemDef?.iconSymbol || "⚙"}</span>
                          {isTechLocked && (
                            <span className="absolute top-0.5 right-0.5 text-xs animate-pulse">🔒</span>
                          )}
                          {recipe.outputCount > 1 && (
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white">
                              {recipe.outputCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Detailed Recipe Inspector */}
                <div className="bg-[#141517] p-3 rounded border border-slate-700 flex flex-col justify-between min-h-[220px]">
                  {hoveredRecipe ? (() => {
                    const itemDef = ITEM_DEFS[hoveredRecipe.outputId];
                    const isTechLocked = hoveredRecipe.techRequired && !(state.unlockedTechs || []).includes(hoveredRecipe.techRequired);
                    const techDef = isTechLocked ? TECHNOLOGIES.find(t => t.id === hoveredRecipe.techRequired) : null;
                    return (
                      <div className="space-y-3 flex-1 flex flex-col justify-between font-mono">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                            <span className="text-2xl bg-zinc-900 p-1 border border-zinc-800 rounded">
                              {itemDef?.iconSymbol || "⚙"}
                            </span>
                            <div>
                              <h4 className="font-extrabold text-sm text-orange-400 flex items-center gap-1">
                                {hoveredRecipe.name}
                                {isTechLocked && <span className="text-purple-400 text-xs">🔒</span>}
                              </h4>
                              <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                Produces x{hoveredRecipe.outputCount}
                              </span>
                            </div>
                          </div>

                          {isTechLocked && (
                            <div className="p-2 bg-purple-950/60 border border-purple-800/80 rounded text-[10px] text-purple-200 space-y-1">
                              <div className="font-bold flex items-center gap-1 text-purple-300">
                                <span>🔒 Locked Technology</span>
                              </div>
                              <div>Research <strong>{techDef?.name || hoveredRecipe.techRequired}</strong> at the Research Center to craft this item!</div>
                              <button
                                onClick={() => {
                                  setInventoryOpen(false);
                                  setResearchCenterOpen(true);
                                }}
                                className="mt-1 px-2 py-0.5 bg-violet-700 hover:bg-violet-600 text-white rounded text-[9px] font-bold"
                              >
                                🔬 Open Research Center
                              </button>
                            </div>
                          )}
                          
                          <p className="text-[10px] text-zinc-400 leading-normal">
                            {hoveredRecipe.description}
                          </p>

                          {/* Ingredient Checklist */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                              Ingredients:
                            </span>
                            {hoveredRecipe.inputs.map((input) => {
                              const playerHas = getGlobalItemCount(state, input.itemId);
                              const hasEnough = playerHas >= input.count;
                              const inputDef = ITEM_DEFS[input.itemId];
                              return (
                                <div
                                  key={input.itemId}
                                  className={`text-[10px] flex justify-between items-center p-1 bg-zinc-900/40 rounded border font-mono ${
                                    hasEnough ? "border-green-950 text-green-400" : "border-red-950 text-red-400"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span>{inputDef?.iconSymbol || "📦"}</span>
                                    <span>{inputDef?.name || input.itemId.replace("_", " ")}</span>
                                  </span>
                                  <span className="font-bold">
                                    {playerHas}/{input.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-800 text-center">
                          {isTechLocked ? (
                            <span className="text-[10px] text-purple-400 font-bold">
                              🔒 RESEARCH REQUIRED IN LAB
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartCrafting(hoveredRecipe)}
                              className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-xs transition-all shadow"
                            >
                              ⚙ CRAFT {hoveredRecipe.name.toUpperCase()}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="flex flex-col items-center justify-center text-center text-zinc-500 text-[10px] py-8 h-full flex-1">
                      <span>⚙ Hover over a recipe to view costs & research requirements.</span>
                      <span className="mt-1">Click to queue crafting.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

                        {activeTab === "workers" && (
              <div className="space-y-3">
                                <div className="flex justify-between items-center border-b border-[#ff9200]/30 pb-2 mb-2">
                  <h3 className="text-[#ff9200] font-bold">Worker Management</h3>
                  <Button 
                    size="sm"
                    className="bg-[#2a2c2e] border border-[#ff9200]/50 text-[#ff9200] hover:bg-[#ff9200] hover:text-white text-[10px] font-bold uppercase rounded-none px-3"
                    onClick={() => {
                      setZoningMode("farming");
                      setInventoryOpen(false);
                    }}
                  >
                    🖌️ Paint Work Zones
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {state.workers && state.workers.length > 0 ? state.workers.map(w => (
                    <div key={w.id} className="bg-[#141517] p-2 border border-slate-700 rounded-none flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#2f3136] border border-slate-600">👷</div>
                      <div className="flex-1 text-xs">
                        <div className="font-bold text-[#ff9200]">{w.name} <span className="text-[9px] text-slate-500 font-normal">({w.role})</span></div>
                        <div className="text-slate-400 text-[10px]">Energy: {Math.floor(w.energy)}%</div>
                        <div className="text-slate-400 text-[10px]">Status: {w.statusText}</div>
                        <div className="text-slate-500 text-[9px] mt-1 italic">
                          {w.role === "idle" ? "Assign a role and paint a zone to start." : `Searching for work inside painted zones.`}
                        </div>
                        {w.inventory && (
                          <div className="text-emerald-400 text-[10px]">Holding: {w.inventory.name} ({w.inventory.count}x)</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <select 
                          className="bg-[#2f3136] border border-slate-600 text-xs px-2 py-1 text-slate-200 outline-none hover:border-[#ff9200] transition-colors"
                          value={w.role}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setState(prev => {
                              const next = structuredClone(prev);
                              const target = next.workers?.find(x => x.id === w.id);
                              if (target) {
                                target.role = val;
                                target.task = "idle";
                              }
                              return next;
                            });
                          }}
                        >
                          <option value="idle">Idle (Resting)</option>
                          <option value="farming">Farming (Water/Harvest)</option>
                          <option value="woodcutting">Woodcutting (Chop/Clear)</option>
                          <option value="water">Water Collection</option>
                          <option value="mining">Mining</option>
                        </select>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-slate-500 text-xs py-4">No workers hired. Hire them from the Shop tab.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "social" && (
              <div className="space-y-3">
                {Object.keys(NPCS).map((id) => {
                  const npc = NPCS[id];
                  const points = state.npcFriendships[id] || 0;
                  const hearts = Math.min(10, Math.floor(points / 250));
                  return (
                    <div
                      key={id}
                      className="p-3 bg-stone-900/40 rounded-lg border border-stone-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full border border-stone-700 flex items-center justify-center font-bold"
                          style={{ backgroundColor: npc.portraitColor }}
                        >
                          {npc.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-stone-200">{npc.name}</div>
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            {npc.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <Heart
                            key={i}
                            className={`h-3 w-3 ${
                              i < hearts ? "text-red-500 fill-red-500" : "text-stone-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "skills" && (
              <div className="space-y-4">
                {(["farming", "mining", "combat", "fishing"] as const).map((skill) => {
                  const lvl = state.skills[skill];
                  const xp = state.experience[skill];
                  const needed = (lvl + 1) * 100;
                  const percent = Math.min(100, (xp / needed) * 100);

                  return (
                    <div key={skill} className="space-y-1.5 p-3 bg-stone-900/40 rounded-lg border border-stone-800">
                      <div className="flex justify-between items-center text-xs">
                        <span className="capitalize font-bold text-amber-400">{skill}</span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          Level {lvl} ({xp}/{needed} XP)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-850">
                        <div
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="text-xs" onClick={() => setInventoryOpen(false)}>
              Back to Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E. CHEST STORAGE INTERFACE */}
      {chestOpenTile && (() => {
        const grid = state.inHouse ? state.houseGrid! : (state.inMine ? state.mineGrid : state.tiles);
        const tile = grid[chestOpenTile.y]?.[chestOpenTile.x];
        if (!tile) return null;

        const isCabin = tile.placedItemId === "worker_cabin";
        const chestInventory = tile.chestInventory || [];

        return (
          <Dialog open={true} onOpenChange={() => setChestOpenTile(null)}>
            <DialogContent container={mainContainerRef.current} className="max-w-md bg-stone-900 border-stone-850 text-stone-100 rounded-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-500 border-b border-stone-800 pb-2">
                  <Compass className="h-5 w-5" />
                  <span>{isCabin ? "Worker Cabin Feed Box" : "Wooden Chest Storage"}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-amber-500 font-mono">{isCabin ? "Cabin Feed Box Contents" : "Chest Contents"}</h4>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-[10px] h-6 px-2 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                        onClick={handleSortChest}
                      >
                        Sort Chest
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-[10px] h-6 px-2 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                        onClick={handleQuickStack}
                      >
                        Quick Stack
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                    {chestInventory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSlotClick(idx, "chest", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "chest")}
                        onMouseEnter={() => item && setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative flex items-center justify-center h-12 rounded border transition-all ${
                          item
                            ? "bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40 border-stone-700"
                            : "bg-stone-900/60 border-stone-800/80"
                        }`}
                      >
                        {item ? (
                          <>
                            <span className="text-xl">{item.iconSymbol || "🎁"}</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs opacity-10 text-stone-100">-</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-stone-400 font-mono">Your Pack Pack</h4>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-[10px] h-6 px-2 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                      onClick={handleSortInventory}
                    >
                      Sort Inventory
                    </Button>
                  </div>
                  <div className="grid grid-cols-6 gap-2 bg-stone-950/55 p-3 rounded-lg border border-stone-850">
                    {state.inventory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleSlotClick(idx, "inventory", e)}
                        onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                        onMouseEnter={() => item && setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative flex items-center justify-center h-12 rounded border transition-all ${
                          item
                            ? "bg-[#7c5a3c]/15 hover:bg-[#7c5a3c]/35 border-stone-850"
                            : "bg-stone-900/40 border-stone-800/80"
                        }`}
                      >
                        {item ? (
                          <>
                            <span className="text-xl">{item.iconSymbol || "🎁"}</span>
                            {item.count > 1 && (
                              <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white font-mono">
                                {item.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs opacity-10 text-stone-100">-</span>
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
                      className={`relative flex items-center justify-center h-12 rounded border transition-all ${
                        item
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
                      className={`relative flex items-center justify-center h-12 rounded border transition-all ${
                        item
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
                  <span>Stone Furnace</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-2">
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded border border-zinc-800">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold">INPUT (3 Ores)</span>
                    <button
                      onClick={() => handleSlotClick(0, "furnace")}
                      onContextMenu={(e) => handleSlotRightClick(e, 0, "furnace")}
                      onMouseEnter={() => inputItem && setHoveredItem(inputItem)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center w-14 h-14 rounded border-2 transition-all ${
                        inputItem
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
                      className={`relative flex items-center justify-center w-14 h-14 rounded border-2 transition-all ${
                        fuelItem
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
                      className={`relative flex items-center justify-center w-16 h-16 rounded border-2 transition-all ${
                        outputItem
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
                        className={`relative flex items-center justify-center h-12 rounded border transition-all ${
                          item
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
              {state.inventory[state.hotbarIndex] ? (
                <Button size="sm" variant="outline" className="text-xs" onClick={handleGiveGift}>
                  🎁 Give Held Gift ({state.inventory[state.hotbarIndex]?.name})
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
                      className={`h-full transition-all duration-500 ${
                        activeWorker.energy <= 20 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
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
                          className={`p-2 rounded border text-left transition-all text-xs ${
                            isActive
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

      {/* === ABOUT PAGE DIALOG === */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent container={mainContainerRef.current} className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0f1117] border-2 border-[#334155] text-slate-100 rounded-xl font-mono">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-emerald-400">
              <span>🌿</span>
              <span>Meadow Life — Game Guide</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              A cozy farming RPG with automation, crafting, and research. Version 2.0
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2 text-xs">
            {/* Overview */}
            <div className="p-3 bg-[#1e293b] border border-[#334155] rounded-lg space-y-1.5">
              <h3 className="font-bold text-emerald-400 text-sm mb-2">📖 About the Game</h3>
              <p className="text-slate-300 leading-relaxed">
                Meadow Life is a cozy top-down farming game. Grow crops, raise animals, mine for ores, 
                craft tools, hire workers, and research advanced technology to automate your farm and 
                conquer the mines. Press <kbd className="bg-slate-700 px-1 rounded text-white">WASD</kbd> to move, 
                <kbd className="bg-slate-700 px-1 rounded text-white mx-1">E/Space</kbd> to interact, and 
                <kbd className="bg-slate-700 px-1 rounded text-white mx-1">/</kbd> for cheats!
              </p>
            </div>

            {/* Controls */}
            <div>
              <h3 className="font-bold text-sky-400 text-sm mb-2">🎮 Controls</h3>
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
                  className={`px-4 py-1.5 text-xs font-bold rounded transition-all capitalize ${
                    playerStoreTab === tab
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
                          className={`flex items-center gap-2 p-2 rounded border text-left transition-all ${
                            canAfford
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
                        className={`relative flex flex-col items-center justify-center h-14 rounded border transition-all ${
                          item
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
                          className={`p-2 rounded border text-center text-xs transition-all ${
                            state.coins >= 1000
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
                        <div key={parcel.id} className={`p-3 rounded-lg border-2 flex flex-col relative transition-all ${
                          owned ? "bg-amber-950/20 border-amber-900/40 opacity-70" :
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
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded ${
                                    canAfford 
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
                      })} className={`px-3 py-1.5 rounded border text-xs font-bold transition-all flex items-center gap-1 ${
                        assigned ? "bg-violet-700/50 border-violet-500 text-violet-200" : "bg-stone-900/60 border-stone-700 text-stone-400 hover:bg-stone-800"
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
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all relative ${
                        unlocked
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

      {/* 6. INFO CARD */}
      <div className="w-full max-w-[704px] p-4 bg-[#0d1117] border-2 border-[#1e293b] text-xs text-slate-300 leading-relaxed rounded-lg shadow-md font-mono">
        <p className="font-bold text-emerald-400 mb-1">🎮 Meadow Life — Keyboard Shortcuts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-400">
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">WASD</kbd> Move</span>
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">E/Space</kbd> Interact</span>
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">I/Esc</kbd> Inventory</span>
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">F</kbd> Talk / Pet</span>
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">/</kbd> Cheat Console</span>
          <span><kbd className="bg-slate-800 px-1 rounded text-white text-[9px]">H</kbd> Game Guide</span>
        </div>
      </div>
    </div>
  );

}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewWidth: number,
  viewHeight: number
) {
  const isMine = state.inMine;
  const grid = isMine ? state.mineGrid : state.tiles;
  if (!grid || grid.length === 0) return;
  const rows = grid.length;
  const cols = grid[0].length;

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Clear canvas
  ctx.fillStyle = "#141517";
  ctx.fillRect(0, 0, w, h);

  const scaleX = w / cols;
  const scaleY = h / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = grid[y][x];
      if (!tile) continue;

      let color = "#346933";
      switch (tile.kind) {
        case "grass":
          color = "#346933";
          break;
        case "water":
          color = "#1f5673";
          break;
        case "path":
          color = "#9c8e77";
          break;
        case "soil":
          color = "#6a5247";
          break;
        case "watered":
          color = "#4a3931";
          break;
        case "tree":
          color = "#1e4d2b";
          break;
        case "house":
        case "shop":
          color = "#8d4536";
          break;
        case "mine_cave":
          color = "#000000";
          break;
        case "mine_dirt":
          color = "#3d312a";
          break;
        case "mine_wall":
          color = "#2b2521";
          break;
        case "mine_ladder":
          color = "#ffd700";
          break;
        case "debris_weed":
          color = "#4c8a48";
          break;
        case "debris_branch":
          color = "#8b7355";
          break;
        case "debris_stone":
          color = "#707070";
          break;
        case "ore_copper":
          color = "#d35400";
          break;
        case "ore_iron":
          color = "#7f8c8d";
          break;
        case "ore_gold":
          color = "#f1c40f";
          break;
        case "placed_item":
          if (tile.placedItemId === "mailbox") color = "#34495e";
          else if (tile.placedItemId === "chest") color = "#d35400";
          else if (tile.placedItemId && tile.placedItemId.startsWith("sprinkler")) color = "#3498db";
          else color = "#ab47bc";
          break;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
    }
  }

  if (state.workers) {
    ctx.fillStyle = "#f39c12";
    state.workers.forEach((w) => {
      ctx.fillRect(w.x * scaleX, w.y * scaleY, Math.max(2, scaleX * 1.2), Math.max(2, scaleY * 1.2));
    });
  }

  if (state.animals) {
    ctx.fillStyle = "#f1f1f1";
    state.animals.forEach((a) => {
      ctx.fillRect(a.x * scaleX, a.y * scaleY, Math.max(2, scaleX * 1.2), Math.max(2, scaleY * 1.2));
    });
  }

  const flash = Math.floor(Date.now() / 250) % 2 === 0;
  ctx.fillStyle = flash ? "#ff3d00" : "#ffeb3b";
  const px = state.player.x;
  const py = state.player.y;
  ctx.beginPath();
  ctx.arc((px + 0.5) * scaleX, (py + 0.5) * scaleY, Math.max(3, scaleX * 1.5), 0, Math.PI * 2);
  ctx.fill();

  const TILE = 32;
  const gridCols = isMine ? 24 : COLS;
  const gridRows = isMine ? 24 : ROWS;
  const p = state.player;
  const pSubX = p.subX !== undefined ? p.subX : p.x;
  const pSubY = p.subY !== undefined ? p.subY : p.y;
  const cameraX = Math.max(
    0,
    Math.min(gridCols * TILE - viewWidth, pSubX * TILE + 16 - viewWidth / 2)
  );
  const cameraY = Math.max(
    0,
    Math.min(gridRows * TILE - viewHeight, pSubY * TILE + 16 - viewHeight / 2)
  );

  const startCol = cameraX / TILE;
  const endCol = (cameraX + viewWidth) / TILE;
  const startRow = cameraY / TILE;
  const endRow = (cameraY + viewHeight) / TILE;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(
    startCol * scaleX,
    startRow * scaleY,
    (endCol - startCol) * scaleX,
    (endRow - startRow) * scaleY
  );
}
