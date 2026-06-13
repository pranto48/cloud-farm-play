import { Component } from "../ecs/Component";

export class PositionComponent extends Component {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
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

export type BuildTool = "belt" | "inserter" | "drill" | "furnace" | "assembler" | "chest" | "pole" | "generator";

export class PlayerComponent extends Component {
  public inventory: Record<string, number> = {};
  public activeTool: BuildTool = "belt";
  public buildRotation: 0 | 90 | 180 | 270 = 90; // Default facing Right
  public researchPoints: number = 0;
  public unlockedTechs: Record<string, boolean> = {};
  
  constructor() {
    super();
    // Start player with some basic items for construction
    this.inventory["iron_plate"] = 25;
    this.inventory["gear"] = 15;
    this.inventory["copper_wire"] = 20;
    this.inventory["coal"] = 10;
  }
}

export type TileType = "grass" | "water" | "stone" | "forest" | "iron" | "copper" | "coal" | "road";

export class MapComponent extends Component {
  public width: number;
  public height: number;
  public tileSize: number;
  public tiles: TileType[][];

  constructor(tiles: TileType[][], width: number = 100, height: number = 100, tileSize: number = 64) {
    super();
    this.tiles = tiles;
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
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
  | "science_pack";

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
  | "generator";

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
