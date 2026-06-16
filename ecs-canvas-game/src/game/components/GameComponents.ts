import { Component } from "../ecs/Component";
import { findPath as aStarFindPath } from "../utils/AStar";

export class PositionComponent extends Component {
  public x: number;
  public y: number;
  public renderX: number;
  public renderY: number;

  // Linear interpolation fields for grid-decoupled visual movement
  public startX: number;
  public startY: number;
  public moveTimer: number = 0;
  public moveDuration: number = 0;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
    this.renderX = x;
    this.renderY = y;
    this.startX = x;
    this.startY = y;
  }
}

export class VelocityComponent extends Component {
  public vx: number;
  public vy: number;

  constructor(vx: number = 0, vy: number = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
  }
}

export class RenderComponent extends Component {
  public draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
    entityId: string
  ) => void;

  constructor(
    draw: (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      time: number,
      entityId: string
    ) => void
  ) {
    super();
    this.draw = draw;
  }
}

export class InputComponent extends Component {
  public keys: Record<string, boolean> = {};
  public mouseX: number = 0;
  public mouseY: number = 0;
  public mouseClicked: boolean = false;
  public mouseRightClicked: boolean = false;
  
  constructor() {
    super();
  }
}

export type BuildTool = "belt" | "inserter" | "drill" | "furnace" | "assembler" | "chest" | "pole" | "generator" | "road" | "storage_house" | "worker_house" | "advanced_drill" | "advanced_furnace" | "fast_road";

export class PlayerComponent extends Component {
  public inventory: Record<string, number> = {};
  public activeTool: BuildTool = "belt";
  public buildRotation: 0 | 90 | 180 | 270 = 90; // Default facing Right
  public researchPoints: number = 0;
  public unlockedTechs: Record<string, boolean> = {};

  // Customization fields
  public skinColor: string = "pale";
  public hairStyle: string = "spiky";
  public hairColor: string = "#f1c40f";
  public clothingStyle: string = "overalls";
  public clothingColor: string = "#8a5a3b";
  public shirtColor: string = "#c0392b";
  public accessoryStyle: string = "straw_hat";
  public accessoryColor: string = "#f1c40f";
  
  constructor() {
    super();
    // Start player with some basic items for construction
    this.inventory["iron_plate"] = 25;
    this.inventory["gear"] = 15;
    this.inventory["copper_wire"] = 20;
    this.inventory["coal"] = 10;
  }
}

export type TileType = "grass" | "water" | "stone" | "forest" | "iron" | "copper" | "coal" | "road" | "fast_road";

export class MapComponent extends Component {
  public width: number;
  public height: number;
  public tileSize: number;
  public tiles: TileType[][];
  public weights: number[][];

  constructor(tiles: TileType[][], width: number = 100, height: number = 100, tileSize: number = 64) {
    super();
    this.tiles = tiles;
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    
    // Initialize weights
    this.weights = [];
    for (let r = 0; r < height; r++) {
      const row: number[] = [];
      for (let c = 0; c < width; c++) {
        row.push(this.getTileWeight(tiles[r][c]));
      }
      this.weights.push(row);
    }
  }

  public getTileWeight(type: TileType): number {
    if (type === "fast_road") return 0.25;
    if (type === "road") return 1.0;
    if (type === "grass") return 3.0;
    if (type === "water" || type === "forest" || type === "stone") return Infinity;
    return 3.0; // ores / veins behave like grass
  }

  public updateTile(row: number, col: number, type: TileType): void {
    if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
      this.tiles[row][col] = type;
      this.weights[row][col] = this.getTileWeight(type);
      console.log(`[Pathfinding Graph] Updated tile at (${row}, ${col}) to ${type}. Weight: ${this.weights[row][col]}`);
    }
  }

  public findPath(startRow: number, startCol: number, goalRow: number, goalCol: number): [number, number][] | null {
    const path = aStarFindPath(this, { r: startRow, c: startCol }, { r: goalRow, c: goalCol });
    if (!path) return null;
    return path.map(node => [node.r, node.c]);
  }
}

export type ItemType = 
  | "wood"
  | "stone"
  | "iron_ore"
  | "copper_ore"
  | "coal"
  | "iron_plate"
  | "copper_plate"
  | "gear"
  | "copper_wire"
  | "electronic_circuit"
  | "science_pack"
  | "wheat"
  | "food"
  | "fish";

export class ItemComponent extends Component {
  public type: ItemType;
  public isHeld: boolean = false;
  public currentBeltId: string | null = null;
  public progressOnBelt: number = 0; // 0 to 1 progress on current belt tile

  constructor(type: ItemType) {
    super();
    this.type = type;
  }
}

export type StructureType = 
  | "belt" 
  | "inserter" 
  | "drill" 
  | "furnace" 
  | "assembler" 
  | "chest" 
  | "pole" 
  | "generator"
  | "storage_house"
  | "worker_house"
  | "crop"
  | "advanced_drill"
  | "advanced_furnace";

export interface Recipe {
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  time: number;
}

export const RECIPES: Record<string, Recipe> = {
  iron_plate: {
    name: "Smelt Iron Plate",
    inputs: { iron_ore: 1, coal: 0.2 }, // 0.2 coal per ore smelted
    outputs: { iron_plate: 1 },
    time: 3.0
  },
  copper_plate: {
    name: "Smelt Copper Plate",
    inputs: { copper_ore: 1, coal: 0.2 },
    outputs: { copper_plate: 1 },
    time: 3.0
  },
  gear: {
    name: "Assemble Iron Gear",
    inputs: { iron_plate: 2 },
    outputs: { gear: 1 },
    time: 1.5
  },
  copper_wire: {
    name: "Assemble Copper Wire",
    inputs: { copper_plate: 1 },
    outputs: { copper_wire: 2 },
    time: 1.0
  },
  electronic_circuit: {
    name: "Assemble Electronic Circuit",
    inputs: { iron_plate: 1, copper_wire: 3 },
    outputs: { electronic_circuit: 1 },
    time: 2.0
  },
  science_pack: {
    name: "Assemble Science Pack",
    inputs: { gear: 1, electronic_circuit: 1 },
    outputs: { science_pack: 1 },
    time: 5.0
  }
};

export class StructureComponent extends Component {
  public type: StructureType;
  public rotation: 0 | 90 | 180 | 270; // 0=Up, 90=Right, 180=Down, 270=Left
  public gridX: number; // Row/Col indices
  public gridY: number;
  
  // Storage chest or internal machine inventories
  public inventory: Record<string, number> = {};
  
  // Machinery processing states
  public activeRecipe: string | null = null;
  public progress: number = 0; // 0 to 1
  public timer: number = 0; // Seconds elapsed
  public fuel: number = 0; // Burning fuel value in seconds
  public maxFuel: number = 0;
  
  // Power poles / energy systems
  public energy: number = 0;
  public maxEnergy: number = 100;
  public isPowered: boolean = false;
  
  // Inserter tracking
  public inserterHeldItemType: ItemType | null = null;
  public inserterAngle: number = 0; // Current swing angle
  public inserterCooldown: number = 0;

  // Crop growth progress
  public cropGrowth: number = 0;
  public isWatered: boolean = false;

  constructor(
    type: StructureType,
    gridX: number,
    gridY: number,
    rotation: 0 | 90 | 180 | 270 = 90
  ) {
    super();
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.rotation = rotation;
  }
}

export class ParticleComponent extends Component {
  public color: string;
  public size: number;
  public vx: number;
  public vy: number;
  public alpha: number;
  public decay: number;

  constructor(
    color: string = "#fff",
    size: number = 3,
    vx: number = 0,
    vy: number = 0,
    alpha: number = 1.0,
    decay: number = 0.02
  ) {
    super();
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.alpha = alpha;
    this.decay = decay;
  }
}

export class BoxColliderComponent extends Component {
  public width: number;
  public height: number;

  constructor(width: number = 0, height: number = 0) {
    super();
    this.width = width;
    this.height = height;
  }
}

export class WorkerComponent extends Component {
  public state: "idle" | "seeking" | "working" | "returning" | "eating" | "sleeping" | "starving";
  public role: "farmer" | "miner" | "fisher" | "woodcutter" | null;
  public houseEntityId: string;
  public path: [number, number][]; // [row, col] grid path
  public pathIndex: number;
  public timer: number;
  public heldItem: ItemType | null;
  public hunger: number;
  public isStarving: boolean;
  public energy: number;
  public sleepTimer: number;
  public previousState: "idle" | "seeking" | "working" | "returning" | null;

  // Customization fields
  public skinColor: string = "pale";
  public hairStyle: string = "short";
  public hairColor: string = "#34495e";
  public clothingStyle: string = "shirt";
  public clothingColor: string = "#e67e22";
  public shirtColor: string = "#2c3e50";
  public accessoryStyle: string = "none";
  public accessoryColor: string = "#e74c3c";

  constructor(houseEntityId: string) {
    super();
    this.state = "idle";
    this.role = null;
    this.houseEntityId = houseEntityId;
    this.path = [];
    this.pathIndex = 0;
    this.timer = 0;
    this.heldItem = null;
    this.hunger = 100;
    this.isStarving = false;
    this.energy = 100;
    this.sleepTimer = 0;
    this.previousState = null;
  }
}

// ─── Sprite Animation Clip Library ────────────────────────────────────────
//
// Spritesheet layout (generated by CharacterTextureLoader):
//   Columns (X) → frames:  0=Idle  1=Walk1  2=Walk2  3=Action1  4=Action2
//   Rows    (Y) → dirs:    0=Down  1=Up     2=Left   3=Right
//
export interface AnimationClip {
  name: string;
  row: number;       // spritesheet direction row
  startCol: number;  // first frame column (inclusive)
  endCol: number;    // last frame column (inclusive)
  fps: number;       // 0 = hold single frame
  loop: boolean;
}

export const ANIMATION_CLIPS: Record<string, AnimationClip> = {
  // Idle (stationary, single frame)
  idle_down:  { name: "idle_down",  row: 0, startCol: 0, endCol: 0, fps: 0, loop: true },
  idle_up:    { name: "idle_up",    row: 1, startCol: 0, endCol: 0, fps: 0, loop: true },
  idle_left:  { name: "idle_left",  row: 2, startCol: 0, endCol: 0, fps: 0, loop: true },
  idle_right: { name: "idle_right", row: 3, startCol: 0, endCol: 0, fps: 0, loop: true },
  // Walk — 2-frame stride cycle @ 8 FPS
  walk_down:  { name: "walk_down",  row: 0, startCol: 1, endCol: 2, fps: 8, loop: true },
  walk_up:    { name: "walk_up",    row: 1, startCol: 1, endCol: 2, fps: 8, loop: true },
  walk_left:  { name: "walk_left",  row: 2, startCol: 1, endCol: 2, fps: 8, loop: true },
  walk_right: { name: "walk_right", row: 3, startCol: 1, endCol: 2, fps: 8, loop: true },
  // Generic work action @ 5 FPS
  work_down:  { name: "work_down",  row: 0, startCol: 3, endCol: 4, fps: 5, loop: true },
  work_up:    { name: "work_up",    row: 1, startCol: 3, endCol: 4, fps: 5, loop: true },
  work_left:  { name: "work_left",  row: 2, startCol: 3, endCol: 4, fps: 5, loop: true },
  work_right: { name: "work_right", row: 3, startCol: 3, endCol: 4, fps: 5, loop: true },
  // Mining — fast pickaxe swing @ 7 FPS
  mine_down:  { name: "mine_down",  row: 0, startCol: 3, endCol: 4, fps: 7, loop: true },
  mine_up:    { name: "mine_up",    row: 1, startCol: 3, endCol: 4, fps: 7, loop: true },
  mine_left:  { name: "mine_left",  row: 2, startCol: 3, endCol: 4, fps: 7, loop: true },
  mine_right: { name: "mine_right", row: 3, startCol: 3, endCol: 4, fps: 7, loop: true },
  // Farming — slow watering-can / hoe stroke @ 4 FPS
  farm_down:  { name: "farm_down",  row: 0, startCol: 3, endCol: 4, fps: 4, loop: true },
  farm_up:    { name: "farm_up",    row: 1, startCol: 3, endCol: 4, fps: 4, loop: true },
  farm_left:  { name: "farm_left",  row: 2, startCol: 3, endCol: 4, fps: 4, loop: true },
  farm_right: { name: "farm_right", row: 3, startCol: 3, endCol: 4, fps: 4, loop: true },
  // Fishing — static cast pose, hold frame 3
  fish_down:  { name: "fish_down",  row: 0, startCol: 3, endCol: 3, fps: 0, loop: true },
  fish_up:    { name: "fish_up",    row: 1, startCol: 3, endCol: 3, fps: 0, loop: true },
  fish_left:  { name: "fish_left",  row: 2, startCol: 3, endCol: 3, fps: 0, loop: true },
  fish_right: { name: "fish_right", row: 3, startCol: 3, endCol: 3, fps: 0, loop: true },
  // Eating / Sleeping — idle pose
  eat_down:   { name: "eat_down",   row: 0, startCol: 0, endCol: 0, fps: 0, loop: true },
  sleep_down: { name: "sleep_down", row: 0, startCol: 0, endCol: 0, fps: 0, loop: true },
};

export class AnimationComponent extends Component {
  // ── Spritesheet slicing (written by AnimationSystem, read by RenderSystem) ──
  /** Active clip name, e.g. "walk_down", "mine_left" */
  public clipName: string = "idle_down";
  /** Spritesheet direction row from the active clip */
  public row: number = 0;
  /** Current frame column within the clip (cycles between startCol..endCol) */
  public col: number = 0;

  // ── Playback state ────────────────────────────────────────────────────────
  public timer: number = 0;
  public direction: "down" | "up" | "left" | "right" = "down";

  // ── Legacy compat (kept so the World serialiser doesn't break) ────────────
  public currentFrame: number = 0;
  public totalFrames: number = 1;
  public frameWidth: number = 32;
  public frameHeight: number = 32;
  public animationSpeed: number = 10;
  public currentTrack: string = "idle";

  constructor(
    totalFrames: number = 1,
    frameWidth: number = 32,
    frameHeight: number = 32,
    animationSpeed: number = 10
  ) {
    super();
    this.totalFrames = totalFrames;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.animationSpeed = animationSpeed;
  }

  get sourceX(): number { return this.col * this.frameWidth; }
  get sourceY(): number { return this.row * this.frameHeight; }
}
