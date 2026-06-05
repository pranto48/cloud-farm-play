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
  hasItems,
  type GameState,
  type Tile,
  type Enemy,
  type Particle,
  type FloatingText,
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
  Volume2, VolumeX, Backpack, HelpCircle, Compass, Shield, MapPin, X
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
  const [state, setState] = useState<GameState>(() => initialState ?? newGame());
  const stateRef = useRef(state);
  stateRef.current = state;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Menu Overlays
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "crafting" | "social" | "skills">("inventory");
  const [shopOpen, setShopOpen] = useState(false);
  const [chestOpenTile, setChestOpenTile] = useState<{ x: number; y: number } | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<{ npcId: string; dialogue: string } | null>(null);
  const [sleepSummary, setSleepSummary] = useState<GameState["dailyEarnings"] | null>(null);

  // Mute state
  const [muted, setMuted] = useState(gameAudio.isMuted());

  // Inventory drag/drop holding state
  const [heldItem, setHeldItem] = useState<{ item: Item; originalSlot: number; source: "inventory" | "chest" } | null>(null);

  // Keyboard Spacebar tracking for Fishing Minigame
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

  // Animation Frame Loop for Canvas and Particle System
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

          // Handle fishing minigame outcomes
          if (next.fishing!.status === "success") {
            const size = next.fishing!.caughtSize || 10;
            const fishId = next.fishing!.fishId;
            const fishDef = FISH_TYPES[fishId];
            const fishObj = createItem(fishId, 1);

            // Add fish to inventory
            const success = addItem(next.inventory, fishObj);
            gameAudio.playLevelUp();

            // Exp gain
            const expMsg = next.experience.fishing += 20; // manually update
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

      // Draw game onto canvas (Viewport size: width=704, height=480)
      draw(ctx, stateRef.current, 704, 480);

      // Draw particle overlay
      ctx.save();
      const cameraX = Math.max(
        0,
        Math.min(
          (stateRef.current.inMine ? 24 : COLS) * TILE - 704,
          stateRef.current.player.x * TILE + 16 - 352
        )
      );
      const cameraY = Math.max(
        0,
        Math.min(
          (stateRef.current.inMine ? 24 : ROWS) * TILE - 480,
          stateRef.current.player.y * TILE + 16 - 240
        )
      );
      ctx.translate(-cameraX, -cameraY);

      // Draw Particles
      particlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      });

      // Draw Floating Texts
      floatingTextsRef.current.forEach((ft) => {
        ctx.fillStyle = ft.color;
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
      });

      // Draw Fishing Minigame HUD overlay on screen if reeling
      if (curState.fishing && curState.fishing.status === "reeling") {
        ctx.restore(); // cancel camera translation for HUD
        ctx.save();

        const HUD_X = 540;
        const HUD_Y = 100;
        const HUD_W = 40;
        const HUD_H = 240;

        // Overlay backing
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(HUD_X - 10, HUD_Y - 10, HUD_W + 40, HUD_H + 20);

        // Reel gauge channel
        ctx.fillStyle = "#34495e";
        ctx.fillRect(HUD_X, HUD_Y, HUD_W - 15, HUD_H);

        // Green reel bar (the paddle)
        const barSizePct = 16;
        const fState = curState.fishing;
        const barSizePx = (barSizePct / 100) * HUD_H;
        // barY starts from bottom (0) to top (100)
        const barYPx = HUD_Y + HUD_H - ((fState.barY + barSizePct) / 100) * HUD_H;

        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(HUD_X + 1, barYPx, HUD_W - 17, barSizePx);

        // Fish icon
        const fishYPx = HUD_Y + HUD_H - (fState.fishY / 100) * HUD_H;
        ctx.fillStyle = "#e74c3c";
        ctx.beginPath();
        ctx.arc(HUD_X + (HUD_W - 15) / 2, fishYPx, 6, 0, Math.PI * 2);
        ctx.fill();
        // cute tail
        ctx.beginPath();
        ctx.moveTo(HUD_X + (HUD_W - 15) / 2, fishYPx + 6);
        ctx.lineTo(HUD_X + (HUD_W - 15) / 2 - 4, fishYPx + 10);
        ctx.lineTo(HUD_X + (HUD_W - 15) / 2 + 4, fishYPx + 10);
        ctx.fill();

        // Progress meter
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
  }, [isSpacePressed]);

  // Slime enemy AI movements (runs in Mine every 1.5 seconds)
  useEffect(() => {
    const id = setInterval(() => {
      const cur = stateRef.current;
      if (!cur.inMine || cur.mineEnemies.length === 0) return;

      setState((prev) => {
        const next = structuredClone(prev);
        const player = next.player;

        next.mineEnemies.forEach((enemy) => {
          // Simple chase: move toward player
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;

          let sx = enemy.x;
          let sy = enemy.y;

          if (Math.abs(dx) >= Math.abs(dy)) {
            sx += dx > 0 ? 1 : -1;
          } else {
            sy += dy > 0 ? 1 : -1;
          }

          // Walkable check for slime
          if (isWalkable(next.mineGrid[sy][sx])) {
            enemy.x = sx;
            enemy.y = sy;
          }

          // If slimes step on the player, deal damage
          if (enemy.x === player.x && enemy.y === player.y) {
            gameAudio.playHit();
            player.health -= enemy.damage;

            // Spawn floating text
            floatingTextsRef.current.push({
              x: player.x * TILE + 16,
              y: player.y * TILE - 8,
              text: `-${enemy.damage} HP`,
              color: "#e74c3c",
              age: 0,
              maxAge: 0.8,
            });

            // If player passes out
            if (player.health <= 0) {
              toast.error("You collapsed from exhaustion!");
              // Sleep & carry home penalty
              sleep(next);
              next.inMine = false;
              next.mineGrid = [];
              next.mineEnemies = [];
              player.x = STATIC_POINTS.playerSpawn.x;
              player.y = STATIC_POINTS.playerSpawn.y;
              // Deduct gold
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

  // Time Ticks and Auto-Watering Rainy day notifications
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const next = structuredClone(prev);
        // Time progression tick
        const dayEnded = next.time + 10 >= 24 * 60;
        if (dayEnded) {
          sleep(next);
          // Show sleep shipping summary modal
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
      if (tag === "INPUT" || tag === "TEXTAREA" || inventoryOpen || shopOpen || chestOpenTile) return;

      const curState = stateRef.current;

      // W A S D Movement keys
      if (["w", "arrowup", "s", "arrowdown", "a", "arrowleft", "d", "arrowright"].includes(k)) {
        e.preventDefault();
        const now = performance.now();
        const runMultiplier = e.shiftKey ? 70 : 130; // speed
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

            // Trigger mine exit ladder
            if (next.inMine && grid[y][x].kind === "mine_ladder" && x === 3 && y === 3) {
              next.inMine = false;
              next.mineDepth = 0;
              next.player.x = 72; // farm cave entrance coords
              next.player.y = 8;
              toast("Exited the mines.");
            }
            // Trigger mine going deeper ladder
            else if (next.inMine && grid[y][x].kind === "mine_ladder" && (x !== 3 || y !== 3)) {
              next.mineDepth += 1;
              const f = generateMineFloor(next.mineDepth);
              next.mineGrid = f.grid;
              next.mineEnemies = f.enemies;
              next.player.x = 3;
              next.player.y = 3;
              toast.success(`Descended to mine floor ${next.mineDepth}!`);
            }
            // Trigger mine cave entrance entry
            else if (!next.inMine && grid[y][x].kind === "mine_cave") {
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
        setIsSpacePressed(true);

        // Standard tool interactions (tilling, watering, chopping, sword swing)
        const held = curState.inventory[curState.hotbarIndex];

        // Special: Fishing Rod
        if (held && held.id === "fishing_rod" && !curState.inMine) {
          setState((prev) => {
            const next = structuredClone(prev);
            const f = frontTile(next);
            if (!f) return next;

            const t = next.tiles[f.y][f.x];
            // If water, cast line!
            if (t.kind === "water" && !next.fishing) {
              next.fishing = initFishing(next.player.dir);
              next.fishing.bobberX = f.x;
              next.fishing.bobberY = f.y;
              next.fishing.status = "waiting";
              next.fishing.waitTimer = Math.random() * 4 + 2; // wait 2-6s
              gameAudio.playWater();
              toast("Line cast! Waiting for a bite...");
            }
            // If waiting and got a bite, hook it!
            else if (next.fishing && next.fishing.status === "nibble") {
              next.fishing.status = "reeling";
              // Choose random fish based on location
              const fKeys = Object.keys(FISH_TYPES);
              const fishChoice = fKeys[Math.floor(Math.random() * fKeys.length)];
              next.fishing.fishId = fishChoice;
              next.fishing.progress = 35;
              gameAudio.playLevelUp();
              toast("FISH HOOKED! Keep the green bar on the fish.");
            } else if (next.fishing) {
              next.fishing = undefined; // cancel
              toast("Reeled in empty line.");
            }
            return next;
          });
          return;
        }

        // Regular tool act
        setState((prev) => {
          const next = structuredClone(prev);
          const act = interact(next);

          // Add visual particles & feedback text
          if (act.particles.length > 0) {
            particlesRef.current = [...particlesRef.current, ...act.particles];
          }

          if (act.message) {
            toast(act.message);
            // Spawn floating text
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
        // Check front tile for NPCs
        const f = frontTile(curState);
        if (!f) return;

        // In this grid, NPCs exist dynamically via scheduler
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
          // Village Shop
          setShopOpen(true);
        } else if (curState.tiles[f.y][f.x].kind === "placed_item" && curState.tiles[f.y][f.x].placedItemId === "chest") {
          // Open Placed Chest
          setChestOpenTile({ x: f.x, y: f.y });
        }
      }
      // ESC / I Inventory panel
      else if (k === "i" || e.code === "Escape") {
        e.preventDefault();
        setInventoryOpen((o) => !o);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [inventoryOpen, shopOpen, chestOpenTile]);

  // Periodic Fishing Nibble tracker tick
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
          // Nibble trigger!
          fState.status = "nibble";
          fState.nibbleTimer = 1.5; // player has 1.5s to react!
          gameAudio.playWater(); // splat sound
        }

        return next;
      });
    }, 500);

    return () => clearInterval(fInterval);
  }, []);

  // Fishing Nibble timer countdown tick
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
          // Escaped
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

  // Inventory grid click handler supporting slot swapping & chest transfers
  const handleSlotClick = (index: number, source: "inventory" | "chest") => {
    const curGrid = state.inventory;
    const chestGrid = chestOpenTile ? state.tiles[chestOpenTile.y][chestOpenTile.x].chestInventory : null;

    if (heldItem === null) {
      // Pick up item
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
      // Put down held item / Swap slots
      setState((prev) => {
        const next = structuredClone(prev);
        const targetInv = source === "inventory" ? next.inventory : next.tiles[chestOpenTile!.y][chestOpenTile!.x].chestInventory!;
        const targetItem = targetInv[index];

        if (targetItem === null) {
          // Drop directly
          targetInv[index] = heldItem.item;
          setHeldItem(null);
        } else if (targetItem.id === heldItem.item.id && targetItem.type !== "tool") {
          // Merge stack
          targetItem.count += heldItem.item.count;
          setHeldItem(null);
        } else {
          // Swap item in hand with target slot
          const holding = heldItem.item;
          const original = heldItem.originalSlot;
          const originalSrc = heldItem.source;

          // Swap slots
          targetInv[index] = holding;

          // Return targets back to hand
          setHeldItem({ item: targetItem, originalSlot: original, source: originalSrc });
        }
        return next;
      });
    }
  };

  // Give item to NPC as gift
  const handleGiveGift = () => {
    if (!npcDialogue) return;
    const npcId = npcDialogue.npcId;
    const npc = NPCS[npcId];
    const held = state.inventory[state.hotbarIndex];

    if (!held) {
      toast.error("You aren't holding any items!");
      return;
    }

    const react = giftReaction(npcId, held.id);

    setState((prev) => {
      const next = structuredClone(prev);
      // Deduct item
      removeItem(next.inventory, next.hotbarIndex, 1);
      // Award relationship points
      next.npcFriendships[npcId] = (next.npcFriendships[npcId] || 0) + react.points;

      // Update dialog text to reflect NPC reaction
      setNpcDialogue({ npcId, dialogue: `[Gift: ${held.name}] — ${react.dialogue}` });
      return next;
    });

    gameAudio.playCoin();
  };

  // Shop Buy/Sell commands
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
        if (item && (item.type === "crop" || item.type === "fish")) {
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
        toast.error("No harvest crops or fish to sell in inventory.");
      }
      return next;
    });
  };

  // Tool updates at shop
  const handleUpgrade = (toolId: "hoe" | "watering" | "scythe" | "pickaxe") => {
    const cost = 120;
    if (state.coins < cost) {
      toast.error(`Need ${cost}g to upgrade tools!`);
      return;
    }
    if (state.upgrades[toolId] >= 3) {
      toast.error("Tool is already at maximum level.");
      return;
    }

    setState((prev) => {
      const next = structuredClone(prev);
      next.coins -= cost;
      next.upgrades[toolId] += 1;
      toast.success(`${toolId.toUpperCase()} upgraded to Level ${next.upgrades[toolId]}!`);
      return next;
    });
    gameAudio.playCoin();
  };

  // Manual save command
  const handleManualSleep = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      sleep(next);
      setSleepSummary(next.dailyEarnings || null);
      return next;
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl px-2">
      {/* 1. CLOCK / TOP BAR HUD */}
      <div className="flex flex-wrap items-center justify-between w-full p-3 bg-card rounded-lg border border-border shadow-[var(--shadow-soft)] gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            {state.weather === "rainy" ? "🌧" : "☀️"}
          </div>
          <div>
            <div className="text-sm font-bold text-card-foreground capitalize flex items-center gap-1.5">
              <span>{state.season}</span> • <span>Day {state.day}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              <span>{formatTime(state.time)}</span>
            </div>
          </div>
        </div>

        {/* Quest Info */}
        {state.quest && (
          <div className="hidden md:flex items-center gap-2 p-2 bg-muted/40 rounded-md border border-border/50 text-xs max-w-sm">
            <HelpCircle className="h-4 w-4 text-primary shrink-0" />
            <div>
              <span className="font-semibold">Quest: </span>
              <span className="text-muted-foreground">{state.quest.description}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <Button size="icon" variant="outline" onClick={() => setMuted(gameAudio.toggleMute())}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          {/* Coins Hud */}
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm font-bold shadow-sm">
            <Coins className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span>{state.coins}g</span>
          </Badge>
        </div>
      </div>

      {/* 2. GAME SCREEN CANVAS FRAME */}
      <div className="relative overflow-hidden rounded-xl border-4 border-[#3e2723] bg-black shadow-lg" style={{ width: "min(100%, 704px)", height: "auto" }}>
        <canvas
          ref={canvasRef}
          width={704}
          height={480}
          style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
        />

        {/* On-canvas overlays (e.g. holding item visual, inMine depth) */}
        {state.inMine && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 border border-white/20 text-white rounded text-xs font-mono flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-red-400" />
            <span>MINE DEPTH: {state.mineDepth}</span>
          </div>
        )}

        {/* HUD Bars: Energy and Health on Canvas bottom-right */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-2 pointer-events-none">
          {/* Health Bar (Only in Mine or always) */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400">
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
            <div className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] font-bold text-green-400">
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

        {/* Hand pointer overlay when holding an item */}
        {heldItem && (
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 border border-white/20 text-white rounded text-xs flex items-center gap-1">
            <Backpack className="h-3.5 w-3.5 text-amber-300 animate-bounce" />
            <span>Holding: {heldItem.item.name}</span>
          </div>
        )}
      </div>

      {/* 3. HOTBAR HUD */}
      <div className="flex flex-col items-center gap-1.5 w-full max-w-[704px]">
        <div className="grid grid-cols-8 gap-1 w-full bg-[#3e2723] p-1.5 rounded-lg border-2 border-[#5d4037] shadow-md">
          {state.inventory.slice(0, 8).map((item, idx) => {
            const selected = state.hotbarIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setState((prev) => ({ ...prev, hotbarIndex: idx }))}
                className={`relative flex flex-col items-center justify-center h-14 rounded border-2 transition-all ${
                  selected
                    ? "border-amber-400 bg-amber-500/20 scale-[1.05] shadow-[0_0_8px_rgba(241,196,15,0.6)]"
                    : "border-stone-800 bg-[#7c5a3c]/30 hover:bg-[#7c5a3c]/50"
                }`}
              >
                {/* Hotbar index number tag */}
                <span className="absolute top-0.5 left-1 text-[9px] font-bold opacity-60 text-white">
                  {idx + 1}
                </span>

                {item ? (
                  <>
                    <span className="text-xl" style={{ textShadow: "1px 1px 0px rgba(0,0,0,0.5)" }}>
                      {item.iconSymbol || "🎁"}
                    </span>
                    {item.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white leading-none">
                        {item.count}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs opacity-20 text-white">-</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-center text-[10px] text-muted-foreground font-mono">
          Press 1–8 to change slot. Space/Click targets front tile.
        </div>
      </div>

      {/* 4. UTILITY ACTIONS PANEL */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        <Button size="sm" variant="outline" onClick={() => setInventoryOpen(true)}>
          <Backpack className="mr-1.5 h-4 w-4 text-primary" /> Inventory (I)
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShopOpen(true)}>
          <Coins className="mr-1.5 h-4 w-4 text-yellow-500" /> Shop / Upgrades
        </Button>
        <Button size="sm" variant="outline" onClick={handleManualSleep}>
          <Bed className="mr-1.5 h-4 w-4 text-emerald-500" /> Sleep (Save)
        </Button>
      </div>

      {/* 5. OVERLAY MODALS & INTERFACES */}

      {/* A. TABBED INVENTORY SCREEN (ESC / I) */}
      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent className="max-w-xl bg-stone-900 border-stone-800 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Backpack className="h-5 w-5 text-amber-500" />
              <span>Meadow Life Journal</span>
            </DialogTitle>
            <DialogDescription className="text-stone-400">
              Manage items, craft tools, inspect relationships, and level up skills.
            </DialogDescription>
          </DialogHeader>

          {/* Custom Tabs row */}
          <div className="flex border-b border-stone-800 gap-1 mt-2">
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

          <div className="py-4 min-h-[260px] max-h-[360px] overflow-y-auto pr-1">
            {/* TAB 1: INVENTORY GRID */}
            {activeTab === "inventory" && (
              <div className="space-y-4">
                <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                  {state.inventory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "inventory")}
                      className={`relative flex items-center justify-center h-14 rounded border transition-all ${
                        item
                          ? "bg-[#7c5a3c]/20 hover:bg-[#7c5a3c]/40 border-stone-700"
                          : "bg-stone-900/60 border-stone-800/80"
                      }`}
                    >
                      {item ? (
                        <>
                          <span className="text-2xl" style={{ textShadow: "1px 1px 0px rgba(0,0,0,0.5)" }}>
                            {item.iconSymbol || "🎁"}
                          </span>
                          {item.count > 1 && (
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white leading-none">
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
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-400 flex items-center justify-between">
                    <span>Holding: {heldItem.item.name} ({heldItem.item.count}x)</span>
                    <Button size="xs" variant="outline" className="text-xs" onClick={() => setHeldItem(null)}>
                      Discard / Cancel
                    </Button>
                  </div>
                )}
                {!heldItem && (
                  <p className="text-[11px] text-stone-500 italic">
                    Click items to swap/pick up. Close inventory to equip tools on the action bar.
                  </p>
                )}
              </div>
            )}

            {/* TAB 2: CRAFTING recipes */}
            {activeTab === "crafting" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CRAFTING_RECIPES.map((recipe) => {
                  const canCraft = recipe.inputs.every((input) =>
                    hasItems(state.inventory, input.itemId, input.count)
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
                                className={`text-[9px] flex justify-between ${
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
                          const msg = craftItem(recipe, state);
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

            {/* TAB 3: SOCIAL / FRIENDSHIPS */}
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
                          <div className="font-bold text-xs">{npc.name}</div>
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

            {/* TAB 4: SKILLS */}
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
                      <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-800">
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

      {/* B. VILLAGE SHOP & UPGRADES MODAL */}
      <Dialog open={shopOpen} onOpenChange={setShopOpen}>
        <DialogContent className="max-w-xl bg-stone-900 border-stone-800 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Coins className="h-5 w-5 text-amber-500" />
              <span>Pierre's Valley Shop</span>
            </DialogTitle>
            <DialogDescription className="text-stone-400">
              Purchase seasonal seeds or upgrade your farming gear.
            </DialogDescription>
          </DialogHeader>

          {/* Seeds listing */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">
                Available Seeds ({state.season} Season)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {shopInventoryForSeason(state.season).map((crop) => {
                  const seedId = `${crop.id}_seed`;
                  const seedDef = ITEM_DEFS[seedId];
                  return (
                    <div
                      key={crop.id}
                      className="p-3 bg-stone-950/60 rounded-lg border border-stone-800 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: crop.accent }}
                        >
                          {seedDef?.iconSymbol || "⁘"}
                        </span>
                        <div>
                          <div className="font-bold text-xs">{crop.name} Seed</div>
                          <div className="text-[9px] text-stone-400">Grows in {crop.growDays} days</div>
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
            </div>

            {/* Upgrades */}
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2">
                Tool Upgrades (Cost: 120g)
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(["hoe", "watering", "scythe", "pickaxe"] as const).map((tId) => {
                  const lvl = state.upgrades[tId];
                  return (
                    <div
                      key={tId}
                      className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex justify-between items-center text-xs"
                    >
                      <span className="capitalize">{tId} (Lv.{lvl})</span>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={lvl >= 3}
                        onClick={() => handleUpgrade(tId)}
                      >
                        {lvl >= 3 ? "MAX" : "Upgrade"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Crop selling shortcut */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleSellAllCrops}>
                Sell All Crops & Fish in Bag
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="text-xs" onClick={() => setShopOpen(false)}>
              Close Shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C. CHEST STORAGE INTERFACE OVERLAY */}
      <Dialog open={chestOpenTile !== null} onOpenChange={() => setChestOpenTile(null)}>
        <DialogContent className="max-w-md bg-stone-900 border-stone-800 text-stone-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-500">
              <Compass className="h-5 w-5" />
              <span>Wooden Chest Storage</span>
            </DialogTitle>
            <DialogDescription className="text-stone-400">
              Transfer items between chest slots and your bag pack.
            </DialogDescription>
          </DialogHeader>

          {chestOpenTile && (
            <div className="space-y-4 py-2">
              {/* Chest inventory grid (top, 12 slots) */}
              <div>
                <h4 className="text-xs font-bold text-amber-500 mb-2">Chest Contents</h4>
                <div className="grid grid-cols-6 gap-2 bg-[#2d1e18] p-3 rounded-lg border border-stone-800">
                  {(
                    state.tiles[chestOpenTile.y][chestOpenTile.x].chestInventory || []
                  ).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "chest")}
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
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white leading-none">
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

              {/* Player inventory grid (bottom) */}
              <div>
                <h4 className="text-xs font-bold text-stone-400 mb-2">Your Pack Pack</h4>
                <div className="grid grid-cols-6 gap-2 bg-stone-950/55 p-3 rounded-lg border border-stone-850">
                  {state.inventory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(idx, "inventory")}
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
                            <span className="absolute bottom-0.5 right-1 px-1 bg-black/60 rounded text-[9px] font-bold text-white leading-none">
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

              {heldItem && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-400 flex items-center justify-between">
                  <span>Holding: {heldItem.item.name} ({heldItem.item.count}x)</span>
                  <Button size="xs" variant="outline" className="text-xs" onClick={() => setHeldItem(null)}>
                    Discard
                  </Button>
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

      {/* D. INTERACTIVE NPC DIALOGUE & GIFTS OVERLAY */}
      <Dialog open={npcDialogue !== null} onOpenChange={() => setNpcDialogue(null)}>
        {npcDialogue && (
          <DialogContent className="max-w-md bg-stone-900 border-stone-850 text-stone-100">
            <div className="flex gap-4 py-2">
              {/* NPC Portrait block representing character facial card */}
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
                <p className="text-xs text-stone-300 leading-relaxed font-mono">
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
                <span className="text-[10px] text-stone-500 flex items-center">
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

      {/* E. SLEEP OVERNIGHT SHIPPING SUMMARY SCREEN */}
      <Dialog open={sleepSummary !== null} onOpenChange={handleCloseSleepSummary}>
        {sleepSummary && (
          <DialogContent className="max-w-md bg-[#2d1e18] border-[#5d4037] text-stone-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-center text-amber-400 border-b border-[#5d4037] pb-2">
                🌾 Meadow Valley Shipping Ledger 🌾
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 min-h-[150px] max-h-[280px] overflow-y-auto">
              {sleepSummary.items.length === 0 ? (
                <div className="text-center py-6 text-stone-400 text-xs italic">
                  No crops or fish shipped today. Empty bin!
                </div>
              ) : (
                <div className="space-y-2">
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
                </div>
              )}

              <div className="flex justify-between items-center border-t border-[#5d4037] pt-3 font-bold text-sm">
                <span>Overnight Net Profits:</span>
                <span className="text-yellow-400 font-mono text-base">+{sleepSummary.total}g</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="default" className="w-full text-xs font-bold" onClick={handleCloseSleepSummary}>
                Wake Up (Day {state.day})
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* 6. GAME CONTROLS TUTORIAL INSTRUCTIONS */}
      <div className="w-full max-w-[704px] p-3 bg-card rounded-lg border border-border text-xs text-muted-foreground leading-relaxed">
        <p className="font-semibold text-card-foreground mb-1">🎮 GAME CONTROLS:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Move with <span className="font-semibold text-card-foreground">WASD</span> or <span className="font-semibold text-card-foreground">Arrow keys</span> (Hold <span className="font-semibold text-card-foreground">Shift</span> to run).</li>
          <li>Press <span className="font-semibold text-card-foreground">Space</span> or <span className="font-semibold text-card-foreground">E</span> to use the active tool in front of you.</li>
          <li>Press <span className="font-semibold text-card-foreground">F</span> to interact (Talk to villagers, open chests, trade at the store counter).</li>
          <li>Enter the <span className="font-semibold text-card-foreground">Mine Entrance</span> in the top-right corner of the map to descend procedural cave levels, break ore rocks, and fight slimes.</li>
          <li>Cast your <span className="font-semibold text-card-foreground">Fishing Rod</span> adjacent to water, wait for <span className="font-bold text-red-500">"!"</span>, press Space to reel, then hold/release Space to match the fish's height.</li>
        </ul>
      </div>
    </div>
  );
}
