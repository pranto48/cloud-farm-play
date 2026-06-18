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
  shipItem,
  generateMineFloor,
  STATIC_POINTS,
  sortInventory,
  quickStackToChest,
  hasItems,
  updateEntities,
  migrateState,
  type GameState,
  type Tile,
  type Enemy,
  type Particle,
  type FloatingText,
  type MailLetter,
  type Animal,
} from "./meadow-life";
import { shopInventoryForSeason, CROPS } from "./data/crops";
import { ITEM_DEFS, createItem, type Item } from "./data/items";
import { NPCS, giftReaction, type NPCDef } from "./npcs";
import { FISH_TYPES, initFishing, updateFishingPhysics } from "./fishing";
import { gameAudio } from "./audio";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Sprout, Wheat, Bed, Hammer, Droplets, Scissors, Pickaxe,
  Heart, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Hand, Swords,
  Volume2, VolumeX, Backpack, HelpCircle, Compass, Shield, MapPin, X,
  Mail, Calendar, Trophy, Maximize, Minimize
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
  const [activeTab, setActiveTab] = useState<"inventory" | "crafting" | "social" | "skills">("inventory");
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<"seeds" | "animals" | "upgrades">("seeds");
  const [chestOpenTile, setChestOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<{ npcId: string; dialogue: string } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<GameState["dailyEarnings"] | null>(null);

  // New overhauls states
  const [sleepConfirmOpen, setSleepConfirmOpen] = useState(false);
  const [shippingBinOpen, setShippingBinOpen] = useState(false);
  const [furnaceOpenTile, setFurnaceOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [craftingCategory, setCraftingCategory] = useState<"logistics" | "production" | "materials">("logistics");
  const [craftingQueue, setCraftingQueue] = useState<{ id: string; name: string; iconSymbol: string; iconColor: string; progress: number }[]>([]);
  const hoveredTileRef = useRef<{ x: number; y: number } | null>(null);

  // Mailbox Mail overlay
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [readingLetter, setReadingLetter] = useState<MailLetter | null>(null);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Layout toggle settings
  const [useSidebar, setUseSidebar] = useState(false); // default to false since we use Factorio bottom hotbar

  // Audio mute
  const [muted, setMuted] = useState(gameAudio.isMuted());

  // Fullscreen state and canvas size
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 704, height: 480 });
  const mainContainerRef = useRef<HTMLDivElement | null>(null);

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
  const [heldItem, setHeldItem] = useState<{ item: Item; originalSlot: number; source: "inventory" | "chest" } | null>(null);

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
      if (tag === "INPUT" || tag === "TEXTAREA" || inventoryOpen || shopOpen || chestOpenTile || mailboxOpen) return;

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
      else if (k === "e" || e.code === "Space") {
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
          const act = interact(next);

          if (act.particles.length > 0) {
            particlesRef.current = [...particlesRef.current, ...act.particles];
          }

          if (act.message) {
            toast(act.message);
            floatingTextsRef.current.push({
              x: next.player.x * TILE + 16,
              y: next.player.y * TILE - 8,
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

        if (foundNpc) {
          const lines = (foundNpc as NPCDef).defaultDialogue;
          const choice = lines[Math.floor(Math.random() * lines.length)];
          setNpcDialogue({ npcId: foundNpcId, dialogue: choice });
        } else if (curState.tiles[f.y][f.x].kind === "shop") {
          setShopOpen(true);
        } else if (curState.tiles[f.y][f.x].kind === "placed_item" && curState.tiles[f.y][f.x].placedItemId === "mailbox") {
          setMailboxOpen(true);
        } else if (curState.tiles[f.y][f.x].kind === "placed_item" && (curState.tiles[f.y][f.x].placedItemId === "chest" || curState.tiles[f.y][f.x].placedItemId === "worker_cabin")) {
          setChestOpenTile({ x: f.x, y: f.y });
        } else if (curState.tiles[f.y][f.x].kind === "placed_item" && curState.tiles[f.y][f.x].placedItemId === "chicken_egg") {
          // Collect Chicken Egg
          setState((prev) => {
            const next = structuredClone(prev);
            const egg = createItem("chicken_egg", 1);
            const success = addItem(next.inventory, egg);
            if (success) {
              next.tiles[f.y][f.x].kind = "grass";
              next.tiles[f.y][f.x].placedItemId = undefined;
              toast.success("Collected a Chicken Egg! 🥚");
              gameAudio.playCoin();
            } else {
              toast.error("Inventory full!");
            }
            return next;
          });
        }
      }
      // ESC / I Inventory panel
      else if (k === "i" || e.code === "Escape") {
        e.preventDefault();
        setInventoryOpen((o) => !o);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "Space" || code === "KeyE") {
        setIsSpacePressed(false);

        if (chargingToolRef.current) {
          const charging = chargingToolRef.current;
          const duration = Date.now() - charging.startTime;
          const chargeLevel = Math.min(charging.maxLevel, Math.floor(duration / 500) + 1);

          setState((prev) => {
            const next = structuredClone(prev);
            const act = interact(next, chargeLevel);

            if (act.particles.length > 0) {
              particlesRef.current = [...particlesRef.current, ...act.particles];
            }

            if (act.message) {
              toast(act.message);
              floatingTextsRef.current.push({
                x: next.player.x * TILE + 16,
                y: next.player.y * TILE - 8,
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
  }, [inventoryOpen, shopOpen, chestOpenTile, mailboxOpen]);

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
  const handleSlotClick = (index: number, source: "inventory" | "chest") => {
    const curGrid = state.inventory;
    const chestGrid = chestOpenTile ? state.tiles[chestOpenTile.y][chestOpenTile.x].chestInventory : null;

    if (heldItem === null) {
      const item = source === "inventory" ? curGrid[index] : chestGrid?.[index];
      if (item) {
        setHeldItem({ item, originalSlot: index, source });
        setState((prev) => {
          const next = structuredClone(prev);
          if (source === "inventory") {
            next.inventory[index] = null;
          } else if (chestOpenTile) {
            next.tiles[chestOpenTile.y][chestOpenTile.x].chestInventory![index] = null;
          }
          return next;
        });
      }
    } else {
      setState((prev) => {
        const next = structuredClone(prev);
        const targetInv = source === "inventory" ? next.inventory : next.tiles[chestOpenTile!.y][chestOpenTile!.x].chestInventory!;
        const targetItem = targetInv[index];

        if (targetItem === null) {
          targetInv[index] = heldItem.item;
          setHeldItem(null);
        } else if (targetItem.id === heldItem.item.id && targetItem.type !== "tool") {
          targetItem.count += heldItem.item.count;
          setHeldItem(null);
        } else {
          const holding = heldItem.item;
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
      const chestTile = next.tiles[chestOpenTile.y][chestOpenTile.x];
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
      const chestTile = next.tiles[chestOpenTile.y][chestOpenTile.x];
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

  const handleSlotRightClick = (e: React.MouseEvent, index: number, source: "inventory" | "chest") => {
    e.preventDefault(); // Prevent context menu
    const curGrid = state.inventory;
    const chestGrid = chestOpenTile ? state.tiles[chestOpenTile.y][chestOpenTile.x].chestInventory : null;

    if (heldItem === null) {
      const item = source === "inventory" ? curGrid[index] : chestGrid?.[index];
      if (item && item.count > 1 && item.type !== "tool" && item.type !== "weapon") {
        const halfCount = Math.ceil(item.count / 2);
        const remainCount = item.count - halfCount;

        const heldObj = { ...item, count: halfCount };
        setHeldItem({ item: heldObj, originalSlot: index, source });

        setState((prev) => {
          const next = structuredClone(prev);
          const targetInv = source === "inventory" ? next.inventory : next.tiles[chestOpenTile!.y][chestOpenTile!.x].chestInventory!;
          if (remainCount <= 0) {
            targetInv[index] = null;
          } else {
            targetInv[index]!.count = remainCount;
          }
          return next;
        });
      } else if (item) {
        // If it's 1 item or a non-stackable tool, treat like normal click
        handleSlotClick(index, source);
      }
    } else {
      // Place exactly 1 item from held stack
      setState((prev) => {
        const next = structuredClone(prev);
        const targetInv = source === "inventory" ? next.inventory : next.tiles[chestOpenTile!.y][chestOpenTile!.x].chestInventory!;
        const targetItem = targetInv[index];

        if (targetItem === null) {
          targetInv[index] = { ...heldItem.item, count: 1 };
          setHeldItem((prevHeld) => {
            if (!prevHeld) return null;
            const newCount = prevHeld.item.count - 1;
            if (newCount <= 0) return null;
            return { ...prevHeld, item: { ...prevHeld.item, count: newCount } };
          });
        } else if (targetItem.id === heldItem.item.id && targetItem.type !== "tool" && targetItem.type !== "weapon") {
          targetItem.count += 1;
          setHeldItem((prevHeld) => {
            if (!prevHeld) return null;
            const newCount = prevHeld.item.count - 1;
            if (newCount <= 0) return null;
            return { ...prevHeld, item: { ...prevHeld.item, count: newCount } };
          });
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
    setState((prev) => {
      const next = structuredClone(prev);
      sleep(next);
      setSleepSummary(next.dailyEarnings || null);
      return next;
    });
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
          style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
        />

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
        <DialogContent className="max-w-xl bg-[#242628] border-2 border-slate-700 text-slate-100 rounded-none font-mono">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#ff9200] border-b border-slate-800 pb-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span>Pierre's Village Depot</span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab buttons */}
          <div className="flex border-b border-slate-800 gap-1 my-2">
            {(["seeds", "animals", "upgrades"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setShopTab(tab)}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-none ${
                  shopTab === tab
                    ? "bg-[#141517] text-[#ff9200] border-t-2 border-[#ff9200]"
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
                        size="xs"
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
                      size="xs"
                      className="bg-[#3a3f44] border border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono"
                      onClick={() => handleBuy(item.id, item.price)}
                    >
                      Buy: {item.price}g
                    </Button>
                  </div>
                ))}
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
                        size="xs"
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
        <DialogContent className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100">
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
                    size="xs"
                    disabled={readingLetter.claimed}
                    onClick={() => handleClaimMailGift(readingLetter.id)}
                  >
                    {readingLetter.claimed ? "Claimed" : "Claim Gift"}
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button size="xs" variant="outline" onClick={() => setReadingLetter(null)}>
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
          <DialogContent className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100">
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
        <DialogContent className="max-w-xl bg-[#242628] border-2 border-slate-700 text-slate-100 rounded-none font-mono">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#ff9200] border-b border-slate-800 pb-2">
              <Backpack className="h-5 w-5 text-[#ff9200]" />
              <span>Backpack Journal</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex border-b border-slate-800 gap-1 my-1">
            {(["inventory", "crafting", "social", "skills"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-xs font-bold uppercase transition-all rounded-none ${
                  activeTab === tab
                    ? "bg-[#141517] text-[#ff9200] border-t-2 border-[#ff9200]"
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
                    size="xs" 
                    variant="outline" 
                    className="text-[10px] h-6 px-2.5 bg-[#3a3f44] border-slate-700 text-slate-200 hover:bg-[#ff9200]/25 hover:border-[#ff9200] rounded-none font-mono" 
                    onClick={handleSortInventory}
                  >
                    Sort Inventory
                  </Button>
                </div>
                <div className="grid grid-cols-10 gap-1 bg-[#141517] p-2 border border-slate-800 rounded-none">
                  {state.inventory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "inventory")}
                      onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                      onMouseEnter={() => item && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center h-[44px] transition-all rounded-none ${
                        item
                          ? "bg-[#2f3136] hover:bg-[#3f4248] border border-slate-600 text-slate-100"
                          : "bg-[#181a1c] border border-slate-800/80 text-slate-600"
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
                    <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5 rounded-none border-slate-700 hover:bg-slate-800" onClick={() => setHeldItem(null)}>
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
              </div>
            )}

            {activeTab === "crafting" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CRAFTING_RECIPES.map((recipe) => {
                  const canCraft = recipe.inputs.every((input) =>
                    state.inventory.reduce(
                      (sum, item) => (item && item.id === input.itemId ? sum + item.count : sum),
                      0
                    ) >= input.count
                  );
                  return (
                    <div
                      key={recipe.id}
                      className="p-3 bg-stone-900/40 rounded-lg border border-stone-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <span className="text-amber-400">
                            {ITEM_DEFS[recipe.outputId]?.iconSymbol || "⚙"}
                          </span>
                          <span>{recipe.name}</span>
                        </div>
                        <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                          {recipe.description}
                        </p>
                        <div className="mt-2.5 space-y-1">
                          {recipe.inputs.map((input) => {
                            const playerHas = state.inventory.reduce(
                              (sum, item) => (item && item.id === input.itemId ? sum + item.count : sum),
                              0
                            );
                            return (
                              <div
                                key={input.itemId}
                                className={`text-[9px] flex justify-between font-mono ${
                                  playerHas >= input.count ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                <span>{input.itemId.replace("_", " ")}</span>
                                <span>
                                  {playerHas}/{input.count}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant={canCraft ? "default" : "outline"}
                        disabled={!canCraft}
                        className="mt-3 text-xs w-full"
                        onClick={() => {
                          setState((prev) => {
                            const next = structuredClone(prev);
                            const act = craftItem(recipe, next);
                            toast(act);
                            return next;
                          });
                        }}
                      >
                        Craft x{recipe.outputCount}
                      </Button>
                    </div>
                  );
                })}
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
      {chestOpenTile && (
      <Dialog open={true} onOpenChange={() => setChestOpenTile(null)}>
        <DialogContent className="max-w-md bg-stone-900 border-stone-850 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-500 border-b border-stone-800 pb-2">
              <Compass className="h-5 w-5" />
              <span>{state.tiles[chestOpenTile.y]?.[chestOpenTile.x]?.placedItemId === "worker_cabin" ? "Worker Cabin Feed Box" : "Wooden Chest Storage"}</span>
            </DialogTitle>
          </DialogHeader>


          {chestOpenTile && (
            <div className="space-y-4 py-2">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-amber-500 font-mono">{state.tiles[chestOpenTile.y]?.[chestOpenTile.x]?.placedItemId === "worker_cabin" ? "Cabin Feed Box Contents" : "Chest Contents"}</h4>
                  <div className="flex gap-2">
                    <Button 
                      size="xs" 
                      variant="outline" 
                      className="text-[10px] h-6 px-2 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                      onClick={handleSortChest}
                    >
                      Sort Chest
                    </Button>
                    <Button 
                      size="xs" 
                      variant="outline" 
                      className="text-[10px] h-6 px-2 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                      onClick={handleQuickStack}
                    >
                      Quick Stack
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                  {(
                    state.tiles[chestOpenTile.y]?.[chestOpenTile.x]?.chestInventory || []
                  ).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "chest")}
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
                    size="xs" 
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
                      onClick={() => handleSlotClick(idx, "inventory")}
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
          )}

          <DialogFooter>
            <Button variant="outline" className="text-xs" onClick={() => setChestOpenTile(null)}>
              Close Chest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* F. NPC DIALOG OVERLAY */}

      <Dialog open={npcDialogue !== null} onOpenChange={() => setNpcDialogue(null)}>
        {npcDialogue && (
          <DialogContent className="max-w-md bg-stone-900 border-stone-850 text-stone-100">
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
                <Button size="xs" variant="outline" className="text-xs" onClick={handleGiveGift}>
                  🎁 Give Held Gift ({state.inventory[state.hotbarIndex]?.name})
                </Button>
              ) : (
                <span className="text-[10px] text-stone-500 flex items-center font-mono">
                  Hold an item to offer a gift
                </span>
              )}
              <Button size="xs" onClick={() => setNpcDialogue(null)}>
                Good Bye
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* G. WORKER SETTINGS DIALOG */}
      <Dialog open={selectedWorkerId !== null} onOpenChange={() => setSelectedWorkerId(null)}>
        <DialogContent className="max-w-md bg-stone-900 border-stone-850 text-stone-100 font-mono">
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

      {/* 6. TUTORIAL CARD */}
      <div className="w-full max-w-[704px] p-4 bg-[#2d1e18] border-2 border-[#5d4037] text-xs text-stone-200 leading-relaxed rounded-lg shadow-md font-mono">
        <p className="font-bold text-amber-400 mb-1">🎮 NEW FEATURES ADDED:</p>
        <ul className="list-disc list-inside space-y-1 text-stone-300">
          <li><span className="text-amber-300">Animal Husbandry:</span> Buy chicks or calves from Pierre's. Release them on the farm! Cows produce milk (milk them using the <span className="font-bold">Milk Pail</span> tool), and chickens lay eggs on the floor.</li>
          <li><span className="text-amber-300">Automatic Sprinklers:</span> Craft basic or quality sprinklers to water adjacent tiles automatically each morning!</li>
          <li><span className="text-amber-300">Mailbox System:</span> Interact with the mailbox next to your cabin to read letters and claim attachments.</li>
          <li><span className="text-amber-300">Animations:</span> Tilling, watering, and crop harvesting now freeze the character and show carrying popups above the head!</li>
        </ul>
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
