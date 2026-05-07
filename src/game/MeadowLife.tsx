import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLS,
  ROWS,
  TILE,
  draw,
  interact,
  isWalkable,
  newGame,
  sellCrop,
  buySeed,
  sleep,
  type GameState,
  type Tool,
} from "./meadow-life";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Sprout,
  Wheat,
  Bed,
  Hammer,
  Droplets,
  Scissors,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Hand,
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

const TOOL_ITEMS: Array<{ id: Tool; label: string; icon: typeof Hammer; key: string }> = [
  { id: "hoe", label: "Hoe", icon: Hammer, key: "1" },
  { id: "seed", label: "Seed", icon: Sprout, key: "2" },
  { id: "water", label: "Water", icon: Droplets, key: "3" },
  { id: "scythe", label: "Scythe", icon: Scissors, key: "4" },
];

export function MeadowLife({ initialState, onStateChange }: Props) {
  const [state, setState] = useState<GameState>(() => initialState ?? newGame());
  const stateRef = useRef(state);
  stateRef.current = state;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const lastTapRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    onStateChange(state);
  }, [state, onStateChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = () => {
      draw(ctx, stateRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let lastMove = 0;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (["w", "arrowup", "s", "arrowdown", "a", "arrowleft", "d", "arrowright"].includes(k)) {
        e.preventDefault();
        const now = performance.now();
        if (now - lastMove < 110) return;
        lastMove = now;
        setState((prev) => {
          const next = structuredClone(prev);
          let { x, y } = next.player;
          if (k === "w" || k === "arrowup") { next.player.dir = "up"; y -= 1; }
          else if (k === "s" || k === "arrowdown") { next.player.dir = "down"; y += 1; }
          else if (k === "a" || k === "arrowleft") { next.player.dir = "left"; x -= 1; }
          else if (k === "d" || k === "arrowright") { next.player.dir = "right"; x += 1; }
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS && isWalkable(next.tiles[y][x])) {
            next.player.x = x;
            next.player.y = y;
          }
          return next;
        });
      } else if (k === "e" || k === " ") {
        e.preventDefault();
        setState((prev) => {
          const next = structuredClone(prev);
          const msg = interact(next);
          if (msg) toast(msg);
          return next;
        });
      } else if (["1", "2", "3", "4"].includes(k)) {
        const tool = TOOL_ITEMS.find((t) => t.key === k);
        if (tool) setState((prev) => ({ ...prev, tool: tool.id }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Move one step in a direction (also turns to face it).
  function step(dir: GameState["player"]["dir"]) {
    setState((prev) => {
      const next = structuredClone(prev);
      let { x, y } = next.player;
      next.player.dir = dir;
      if (dir === "up") y -= 1;
      else if (dir === "down") y += 1;
      else if (dir === "left") x -= 1;
      else if (dir === "right") x += 1;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS && isWalkable(next.tiles[y][x])) {
        next.player.x = x;
        next.player.y = y;
      }
      return next;
    });
  }

  function doInteract() {
    setState((prev) => {
      const next = structuredClone(prev);
      const msg = interact(next);
      if (msg) toast(msg);
      return next;
    });
  }

  // Tap a tile: face & step toward it. Tap the tile in front of you (or your own
  // tile) to use the current tool. Double-tap any tile to interact.
  function handleCanvasPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor(cy / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;

    const now = performance.now();
    const last = lastTapRef.current;
    const isDouble = last && last.x === tx && last.y === ty && now - last.t < 350;
    lastTapRef.current = { x: tx, y: ty, t: now };

    const cur = stateRef.current;
    const dx = tx - cur.player.x;
    const dy = ty - cur.player.y;

    // Tap your own tile = interact with the tile in front
    if (dx === 0 && dy === 0) {
      doInteract();
      return;
    }
    // Double-tap = interact (after orienting toward the tile)
    const dir: GameState["player"]["dir"] =
      Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

    // Adjacent tile: face it. If walkable, step onto it. Otherwise just face & interact.
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      const target = cur.tiles[ty][tx];
      if (isWalkable(target)) {
        step(dir);
      } else {
        // turn to face it
        setState((prev) => ({ ...prev, player: { ...prev.player, dir } }));
        doInteract();
        return;
      }
    } else {
      step(dir);
    }

    if (isDouble) doInteract();
  }

  const W = COLS * TILE;
  const H = ROWS * TILE;

  const onSleep = () => {
    setState((prev) => {
      const next = structuredClone(prev);
      sleep(next);
      toast.success(`Day ${next.day} begins`);
      return next;
    });
  };
  const onBuy = () => setState((prev) => {
    const next = structuredClone(prev);
    toast(buySeed(next));
    return next;
  });
  const onSell = () => setState((prev) => {
    const next = structuredClone(prev);
    toast(sellCrop(next));
    return next;
  });

  const tools = useMemo(() => TOOL_ITEMS, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <Badge variant="secondary" className="gap-1"><Bed className="h-3 w-3" /> Day {state.day}</Badge>
        <Badge variant="secondary" className="gap-1"><Sprout className="h-3 w-3" /> Seeds {state.inventory.seeds}</Badge>
        <Badge variant="secondary" className="gap-1"><Wheat className="h-3 w-3" /> Crops {state.inventory.crops}</Badge>
        <Badge variant="secondary" className="gap-1"><Coins className="h-3 w-3" /> {state.inventory.coins}c</Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-border shadow-[var(--shadow-soft)]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={handleCanvasPointer}
          style={{ width: "min(100%, 720px)", height: "auto", display: "block", imageRendering: "pixelated" }}
        />
      </div>

      {/* On-screen D-pad + action button for touch devices (also works with mouse) */}
      <div className="grid grid-cols-3 gap-2 sm:hidden" aria-label="Touch controls">
        <div />
        <Button size="icon" variant="outline" aria-label="Move up" onClick={() => step("up")}>
          <ArrowUp className="h-5 w-5" />
        </Button>
        <div />
        <Button size="icon" variant="outline" aria-label="Move left" onClick={() => step("left")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="default" aria-label="Use tool" onClick={doInteract}>
          <Hand className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="outline" aria-label="Move right" onClick={() => step("right")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div />
        <Button size="icon" variant="outline" aria-label="Move down" onClick={() => step("down")}>
          <ArrowDown className="h-5 w-5" />
        </Button>
        <div />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {tools.map((t) => {
          const active = state.tool === t.id;
          const Icon = t.icon;
          return (
            <Button key={t.id} size="sm" variant={active ? "default" : "outline"} onClick={() => setState((prev) => ({ ...prev, tool: t.id }))}>
              <Icon className="mr-1 h-4 w-4" /> {t.label} <span className="ml-1 text-xs opacity-60">({t.key})</span>
            </Button>
          );
        })}
        <Button size="sm" variant="outline" onClick={() => setShopOpen(true)}><Coins className="mr-1 h-4 w-4" /> Shop</Button>
        <Button size="sm" variant="outline" onClick={onSleep}><Bed className="mr-1 h-4 w-4" /> Sleep</Button>
      </div>

      <p className="max-w-md text-center text-xs text-muted-foreground">
        Desktop: WASD / arrows to move, E or Space to use the tool, 1–4 to switch tools.
        Touch: tap a tile to walk toward it, tap an obstacle to face & use the tool, or use the on-screen pad.
      </p>

      <Dialog open={shopOpen} onOpenChange={setShopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Village Shop</DialogTitle>
            <DialogDescription>Trade crops for coins, or buy seeds to plant more.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span>Buy 1 seed</span>
              <Button size="sm" onClick={onBuy}><Coins className="mr-1 h-3 w-3" /> 8c</Button>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span>Sell 1 crop</span>
              <Button size="sm" variant="outline" onClick={onSell}>+14c</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
