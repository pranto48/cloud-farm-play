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

  // Mailbox Mail overlay
  const [mailboxOpen, setMailboxOpen] = useState(false);
  const [readingLetter, setReadingLetter] = useState<MailLetter | null>(null);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Layout toggle settings
  const [useSidebar, setUseSidebar] = useState(true);

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
    if (!isFullscreen) {
      setCanvasSize({ width: 704, height: 480 });
      return;
    }

    const updateSize = () => {
      const sidebarWidth = useSidebar ? 80 : 0;
      const w = Math.max(704, window.innerWidth - sidebarWidth - 48);
      const h = Math.max(480, window.innerHeight - 150);
      setCanvasSize({ width: w, height: h });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [isFullscreen, useSidebar]);

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


      // Update particles
      particlesRef.current = particlesRef.current
        .map((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 200 * dt; // gravity
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
      draw(ctx, stateRef.current, canvasSize.width, canvasSize.height);

      // Draw particle overlay
      ctx.save();
      const cameraX = Math.max(
        0,
        Math.min(
          (stateRef.current.inMine ? 24 : COLS) * TILE - canvasSize.width,
          stateRef.current.player.x * TILE + 16 - canvasSize.width / 2
        )
      );
      const cameraY = Math.max(
        0,
        Math.min(
          (stateRef.current.inMine ? 24 : ROWS) * TILE - canvasSize.height,
          stateRef.current.player.y * TILE + 16 - canvasSize.height / 2
        )
      );
      ctx.translate(-cameraX, -cameraY);

      // Draw Particles
      particlesRef.current.forEach((p) => {
        if (p.type === "heart") {
          // Draw little heart shapes
          ctx.fillStyle = p.color;
          ctx.font = "8px monospace";
          ctx.fillText("❤️", p.x - 3, p.y);
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
        const ppx = p.x * TILE + 16;
        const ppy = p.y * TILE - 8;

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

          const grid = next.inMine ? next.mineGrid : next.tiles;
          const gridRows = grid.length;
          const gridCols = grid[0]?.length || 0;

          if (x >= 0 && y >= 0 && x < gridCols && y < gridRows && isWalkable(grid[y][x])) {
            next.player.x = x;
            next.player.y = y;

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
      else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(k)) {
        const idx = parseInt(k) - 1;
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
      className={`flex flex-col items-center gap-4 w-full px-2 transition-all duration-300 ${
        isFullscreen 
          ? "bg-[#18110e] p-6 justify-center min-h-screen text-stone-200" 
          : "max-w-4xl"
      }`}
    >
      {/* 1. STARDEW-STYLE WATCH CLOCK HUD & WEATHER DIAL (TOP RIGHT STYLING) */}
      <div className={`flex flex-wrap items-center justify-between w-full p-4 bg-[#3e2723] rounded-lg border-4 border-[#5d4037] shadow-xl gap-3 text-white ${isFullscreen ? "max-w-none" : ""}`}>
        <div className="flex items-center gap-3">
          {/* Classic circular weather/watch face dial */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-400 bg-cyan-900 shadow-inner text-2xl font-bold animate-pulse">
            {state.weather === "rainy" ? "🌧" : "☀️"}
          </div>
          <div>
            <div className="text-base font-extrabold text-amber-400 capitalize flex items-center gap-1.5 font-mono">
              <Calendar className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{state.season}</span> • <span>Day {state.day}</span>
            </div>
            <div className="text-sm font-bold text-stone-200 flex items-center gap-1.5 font-mono mt-0.5">
              <Compass className="h-4 w-4 text-emerald-400" />
              <span>{formatTime(state.time)}</span>
            </div>
          </div>
        </div>

        {/* Quest status */}
        {state.quest && (
          <div className="hidden md:flex items-center gap-2 p-2 bg-[#2d1e18] rounded-md border border-[#5d4037] text-xs max-w-sm">
            <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-400">Quest: </span>
              <span className="text-stone-300">{state.quest.description}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Fullscreen toggle */}
          <Button size="icon" variant="outline" className="bg-[#5d4037] border-stone-800 text-stone-100 hover:bg-[#7c5a3c]" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          {/* Mute toggle */}
          <Button size="icon" variant="outline" className="bg-[#5d4037] border-stone-800 text-stone-100 hover:bg-[#7c5a3c]" onClick={() => setMuted(gameAudio.toggleMute())}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          {/* Money Bag dial */}
          <Badge variant="secondary" className="gap-1.5 px-3 py-2 text-base font-extrabold shadow-md bg-stone-900 border-2 border-amber-400 text-amber-400 font-mono">
            <Coins className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <span>{state.coins}g</span>
          </Badge>
        </div>
      </div>

      {/* 2. MAIN LAYOUT: VERTICAL SIDEBAR TOOL BELT + CANVAS FRAME CONTAINER */}
      <div className="flex flex-row items-start justify-center gap-3 w-full" style={{ maxWidth: isFullscreen ? "none" : "760px" }}>
        {/* Left vertical Stardew tool-belt sidebar */}
        {useSidebar && (
          <div className="flex flex-col gap-1.5 bg-[#3e2723] p-2 rounded-xl border-4 border-[#5d4037] shadow-xl w-16 shrink-0">
            {state.inventory.slice(0, 8).map((item, idx) => {
              const selected = state.hotbarIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setState((prev) => ({ ...prev, hotbarIndex: idx }))}
                  className={`relative flex flex-col items-center justify-center h-14 w-10 mx-auto rounded border-2 transition-all ${
                    selected
                      ? "border-amber-400 bg-amber-500/25 scale-[1.08] shadow-[0_0_10px_rgba(241,196,15,0.7)]"
                      : "border-stone-850 bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40"
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[8px] font-extrabold text-white/50 leading-none">
                    {idx + 1}
                  </span>
                  {item ? (
                    <>
                      <span className="text-xl" style={{ textShadow: "1px 1px 0px rgba(0,0,0,0.5)" }}>
                        {item.iconSymbol || "🎁"}
                      </span>
                      {item.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white leading-none font-mono">
                          {item.count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs opacity-15 text-stone-100 font-mono">-</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Game Screen Frame */}
        <div 
          className="relative overflow-hidden rounded-xl border-4 border-[#3e2723] bg-black shadow-2xl flex-1" 
          style={{ 
            height: `${canvasSize.height}px`,
            maxWidth: isFullscreen ? "none" : "704px" 
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}
          />

          {/* Mine Depth label */}
          {state.inMine && (
            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 border border-white/20 text-white rounded text-xs font-mono flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-red-400 animate-bounce" />
              <span>MINE LEVEL: {state.mineDepth}</span>
            </div>
          )}

          {/* HP and energy bars */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-2 pointer-events-none">
            {/* Health Bar */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 font-mono">
                <Swords className="h-3 w-3" />
                <span>HP {state.player.health}</span>
              </div>
              <div className="w-24 h-2.5 bg-black/80 border border-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(state.player.health / state.player.maxHealth) * 100}%` }}
                />
              </div>
            </div>

            {/* Energy Bar */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-bold text-green-400 font-mono">
                <Droplets className="h-3 w-3" />
                <span>NRG {state.energy}</span>
              </div>
              <div className="w-24 h-2.5 bg-black/80 border border-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${state.energy <= 40 ? "bg-amber-500 animate-pulse" : "bg-green-500"}`}
                  style={{ width: `${(state.energy / state.maxEnergy) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Hand carrying popup */}
          {heldItem && (
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 border border-white/20 text-white rounded text-xs flex items-center gap-1.5 font-mono">
              <Backpack className="h-3.5 w-3.5 text-amber-300 animate-bounce" />
              <span>Holding: {heldItem.item.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Layout Bottom controls / hotbar toggle options */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-[760px] text-xs text-muted-foreground font-mono px-1">
        <div>
          <span>Press 1–8 to change tool. Space to use. F to interact.</span>
        </div>
        <button
          onClick={() => setUseSidebar((s) => !s)}
          className="hover:text-amber-500 underline transition-all"
        >
          Toggle {useSidebar ? "Bottom Hotbar" : "Sidebar Toolbelt"}
        </button>
      </div>

      {/* If bottom hotbar chosen instead */}
      {!useSidebar && (
        <div className="flex flex-col items-center gap-1.5 w-full" style={{ maxWidth: isFullscreen ? "none" : "704px" }}>
          <div className="grid grid-cols-8 gap-1 w-full bg-[#3e2723] p-1.5 rounded-lg border-2 border-[#5d4037]">
            {state.inventory.slice(0, 8).map((item, idx) => {
              const selected = state.hotbarIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setState((prev) => ({ ...prev, hotbarIndex: idx }))}
                  className={`relative flex flex-col items-center justify-center h-14 rounded border-2 transition-all ${
                    selected
                      ? "border-amber-400 bg-amber-500/20 scale-[1.05]"
                      : "border-stone-800 bg-[#7c5a3c]/30 hover:bg-[#7c5a3c]/50"
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-bold text-white/50 leading-none">
                    {idx + 1}
                  </span>
                  {item ? (
                    <>
                      <span className="text-xl">{item.iconSymbol || "🎁"}</span>
                      {item.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white">
                          {item.count}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs opacity-10 text-white">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. UTILITY OVERLAYS TOGGLERS */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        <Button size="sm" variant="outline" onClick={() => setInventoryOpen(true)}>
          <Backpack className="mr-1.5 h-4 w-4 text-amber-500" /> Journal Backpack (I)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShopOpen(true)}>
          <Coins className="mr-1.5 h-4 w-4 text-yellow-500" /> Pierre's Shop
        </Button>
        {state.mailboxLetters.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setMailboxOpen(true)}>
            <Mail className={`mr-1.5 h-4 w-4 ${state.hasUnreadMail ? "text-red-400 animate-bounce" : "text-stone-400"}`} />
            <span>Mailbox ({state.mailboxLetters.filter(l => !l.claimed).length} unread)</span>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleManualSleep}>
          <Bed className="mr-1.5 h-4 w-4 text-emerald-500" /> Sleep (Save & Grow)
        </Button>
      </div>

      {/* 5. COZY DIALOG INTERFACES */}

      {/* A. PIERRE'S OVERHAULED SHOP MODAL */}
      <Dialog open={shopOpen} onOpenChange={setShopOpen}>
        <DialogContent className="max-w-xl bg-stone-900 border-stone-850 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400 border-b border-stone-800 pb-2">
              <Coins className="h-5 w-5 text-amber-500" />
              <span>Pierre's Village Depot</span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab buttons */}
          <div className="flex border-b border-stone-800 gap-1 my-2">
            {(["seeds", "animals", "upgrades"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setShopTab(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded-t ${
                  shopTab === tab
                    ? "bg-[#3e2723] text-amber-400 border-t-2 border-amber-500"
                    : "text-stone-400 hover:text-stone-200"
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
                      className="p-3 bg-stone-950/65 rounded-lg border border-stone-800 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm"
                          style={{ backgroundColor: crop.accent }}
                        >
                          {seedDef?.iconSymbol || "⁘"}
                        </span>
                        <div>
                          <div className="font-bold text-xs">{crop.name} Seed</div>
                          <div className="text-[9px] text-stone-400">Yield: {crop.growDays} days</div>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        className="text-xs"
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
                    className="p-3 bg-stone-950/60 rounded-lg border border-stone-800 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.symbol}</span>
                      <div>
                        <div className="font-bold text-xs">{item.name}</div>
                        <div className="text-[9px] text-stone-400">
                          {ITEM_DEFS[item.id]?.description}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="xs"
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
                      className="p-3 bg-stone-950/65 rounded-lg border border-stone-850 flex flex-col justify-between text-xs"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="capitalize font-extrabold text-amber-400">
                          {tId === "watering" ? "Watering Can" : tId}
                        </span>
                        <span className="text-stone-400 font-bold font-mono">Level {lvl}</span>
                      </div>
                      
                      {cost ? (
                        <div className="text-[10px] text-stone-300 font-mono mb-2 flex flex-col gap-0.5">
                          <span className="text-stone-500">Requires:</span>
                          <span className="text-amber-300 font-bold">{cost.label}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold font-mono mb-2">MAX LEVEL (Lv.4) REACHED</span>
                      )}

                      <Button
                        size="xs"
                        variant="outline"
                        disabled={lvl >= 4}
                        className="w-full text-xs bg-[#5d4037]/20 border-stone-850 hover:bg-[#5d4037]/40 font-mono mt-auto"
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

          <div className="flex gap-2 mt-4 pt-3 border-t border-stone-800">
            <Button size="sm" variant="outline" className="flex-1 text-xs text-stone-300" onClick={handleSellAllCrops}>
              Sell All Crops, Eggs, & Milk in Bag
            </Button>
            <Button size="sm" className="text-xs" onClick={() => setShopOpen(false)}>
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
        <DialogContent className="max-w-xl bg-stone-900 border-stone-850 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400 border-b border-stone-800 pb-2">
              <Backpack className="h-5 w-5 text-amber-500" />
              <span>Backpack Journal</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex border-b border-stone-800 gap-1 my-1">
            {(["inventory", "crafting", "social", "skills"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded-t ${
                  activeTab === tab
                    ? "bg-[#3e2723] text-amber-400 border-t-2 border-amber-500"
                    : "text-stone-400 hover:text-stone-200"
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
                    className="text-[10px] h-6 px-2.5 bg-[#5d4037]/20 border-stone-850 text-stone-300 hover:bg-[#5d4037]/40 font-mono" 
                    onClick={handleSortInventory}
                  >
                    Sort Inventory
                  </Button>
                </div>
                <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                  {state.inventory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "inventory")}
                      onContextMenu={(e) => handleSlotRightClick(e, idx, "inventory")}
                      onMouseEnter={() => item && setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`relative flex items-center justify-center h-14 rounded border transition-all ${
                        item
                          ? "bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40 border-stone-700"
                          : "bg-stone-900/60 border-stone-800/80"
                      }`}
                    >
                      {item ? (
                        <>
                          <span className="text-2xl">{item.iconSymbol || "🎁"}</span>
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
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] text-amber-400 flex items-center justify-between font-mono">
                    <span>Holding: {heldItem.item.name} ({heldItem.item.count}x)</span>
                    <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5" onClick={() => setHeldItem(null)}>
                      Clear
                    </Button>
                  </div>
                )}

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

      {/* F. WORKER GUIDELINES DIALOG OVERLAY */}
      <Dialog open={selectedWorkerId !== null} onOpenChange={() => setSelectedWorkerId(null)}>
        <DialogContent className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100 font-mono">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400 border-b border-[#5d4037] pb-2">
              <span>📋 Worker Guideline & Assignment</span>
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const activeWorker = state.workers?.find((w) => w.id === selectedWorkerId);
            if (!activeWorker) return null;
            return (
              <div className="space-y-4 py-3 text-xs">
                <div className="bg-[#3e2723] p-3 rounded-lg border border-[#5d4037] space-y-1">
                  <div><span className="text-amber-400">Name:</span> {activeWorker.name}</div>
                  <div><span className="text-amber-400">Shift Schedule:</span> 8:00 AM - 5:00 PM</div>
                  <div>
                    <span className="text-amber-400">Energy Level:</span> {Math.floor(activeWorker.energy)} / 100
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400">Daily Food Eaten:</span>{" "}
                    {activeWorker.hasEatenToday ? (
                      <span className="text-emerald-400 font-bold">Yes ✓</span>
                    ) : (
                      <span className="text-red-400 font-bold">No ✗</span>
                    )}
                  </div>
                  <div><span className="text-amber-400">Status:</span> {activeWorker.statusText}</div>
                </div>

                <div className="space-y-2">
                  <label className="block text-amber-500 font-bold">Assign Work Guideline:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["idle", "water", "harvest", "clear"] as const).map((task) => (
                      <button
                        key={task}
                        className={`p-2.5 rounded border capitalize font-bold transition-all text-center ${
                          activeWorker.task === task
                            ? "bg-amber-600 border-amber-400 text-stone-100"
                            : "bg-[#3e2723] border-[#5d4037] text-stone-300 hover:bg-[#5d4037]"
                        }`}
                        onClick={() => {
                          setState((prev) => {
                            const next = structuredClone(prev);
                            const worker = next.workers?.find((w) => w.id === selectedWorkerId);
                            if (worker) {
                              worker.task = task;
                              toast.success(`Assigned ${worker.name} to ${task.toUpperCase()}`);
                            }
                            return next;
                          });
                        }}
                      >
                        {task === "idle" ? "Idle / Rest" : task === "water" ? "Water Soil" : task === "harvest" ? "Harvest Crops" : "Clear Debris"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-stone-400 border-t border-[#5d4037] pt-2 leading-relaxed">
                  <span className="text-amber-300 font-extrabold">Guidelines Note:</span> Hired workers need 1 crop or meal in their Cabin Feed Box daily. If energy drops to 0, they will strike. They work in a 9x9 zone centered on their cabin.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="text-xs bg-[#5d4037]/20 border-[#5d4037] hover:bg-[#5d4037]/40 text-stone-100"
                    onClick={() => {
                      setSelectedWorkerId(null);
                      setChestOpenTile({ x: activeWorker.cabinX, y: activeWorker.cabinY });
                    }}
                  >
                    Open Cabin Chest
                  </Button>
                  <Button className="text-xs" onClick={() => setSelectedWorkerId(null)}>
                    Close
                  </Button>
                </div>
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
