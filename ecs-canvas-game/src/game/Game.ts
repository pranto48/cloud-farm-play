import {
  spawnPlayer,
  spawnMap,
  spawnParticle,
} from "./Spawner";
import {
  InputComponent,
  PlayerComponent,
  PositionComponent,
  MapComponent,
  StructureComponent,
  ItemComponent,
  VelocityComponent,
  ParticleComponent,
  BuildTool,
  BoxColliderComponent,
} from "./components/GameComponents";

// Systems
import { World } from "./ecs/World";
import { InputSystem } from "./systems/InputSystem";
import { TileCollisionSystem } from "./systems/TileCollisionSystem";
import { FactorySystem } from "./systems/FactorySystem";
import { MovementSystem } from "./systems/MovementSystem";
import { ParticleSystem } from "./systems/ParticleSystem";
import { RenderSystem } from "./systems/RenderSystem";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world!: World;
  private playerEntityId!: string;
  public activeTool: BuildTool = "belt";

  // Systems
  private inputSystem!: InputSystem;
  private tileCollisionSystem!: TileCollisionSystem;
  private factorySystem!: FactorySystem;
  private movementSystem!: MovementSystem;
  private particleSystem!: ParticleSystem;
  private renderSystem!: RenderSystem;

  // Fixed Timestep variables (separating update loop from render loop)
  private lastTime: number = 0;
  private lag: number = 0;
  private readonly MS_PER_UPDATE = 1000 / 60; // 60 FPS Logic updates (16.67ms)
  private readonly FIXED_DT = 1 / 60;
  private saveTimer: number = 0;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    // Prevent default context menu on right clicks
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.resizeCanvas();
    this.initWorld();
    this.setupInput();
    this.setupToolbar();

    window.addEventListener("resize", () => this.resizeCanvas());
    
    // Start game loop
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initWorld(): void {
    this.world = new World();

    // Initialize systems
    this.inputSystem = new InputSystem();
    this.tileCollisionSystem = new TileCollisionSystem();
    this.factorySystem = new FactorySystem();
    this.movementSystem = new MovementSystem();
    this.particleSystem = new ParticleSystem();

    // Rendering system
    this.renderSystem = new RenderSystem(this.canvas, this.ctx);

    // Register logic systems in World
    this.world.addSystem(this.inputSystem);
    this.world.addSystem(this.tileCollisionSystem);
    this.world.addSystem(this.factorySystem);
    this.world.addSystem(this.movementSystem);
    this.world.addSystem(this.particleSystem);

    this.saveTimer = 0;

    // Load game from localStorage or initialize new procedural map
    const loadSuccess = this.loadGame();

    if (!loadSuccess) {
      console.log("[Save/Load] No save game found, initializing fresh procedural map.");
      const mapData = spawnMap(this.world);
      this.playerEntityId = spawnPlayer(this.world, mapData.playerX, mapData.playerY);

      // Equip player with items for placing
      const playerComp = this.world.getComponent(this.playerEntityId, PlayerComponent)!;
      playerComp.inventory["belt"] = 25;
      playerComp.inventory["inserter"] = 12;
      playerComp.inventory["drill"] = 6;
      playerComp.inventory["furnace"] = 4;
      playerComp.inventory["assembler"] = 2;
      playerComp.inventory["chest"] = 5;
      playerComp.inventory["pole"] = 15;
      playerComp.inventory["generator"] = 2;
    }
  }

  private setupInput(): void {
    // Keyboard inputs
    window.addEventListener("keydown", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = true;
      }
    });

    window.addEventListener("keyup", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = false;
      }
    });

    // Mouse movement
    window.addEventListener("mousemove", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      const pos = this.world.getComponent(this.playerEntityId, PositionComponent);
      if (input && pos) {
        // Convert screen coordinates to world coordinates relative to camera centered on player
        const screenX = e.clientX;
        const screenY = e.clientY;
        const camX = pos.x - this.canvas.width / 2;
        const camY = pos.y - this.canvas.height / 2;
        input.mouseX = screenX + camX;
        input.mouseY = screenY + camY;
      }
    });

    // Mouse click bindings
    window.addEventListener("mousedown", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        if (e.button === 0) {
          input.mouseClicked = true;
        } else if (e.button === 2) {
          input.mouseRightClicked = true;
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        if (e.button === 0) {
          input.mouseClicked = false;
        } else if (e.button === 2) {
          input.mouseRightClicked = false;
        }
      }
    });
  }

  private loop(currentTime: number): void {
    // Sync tool states before updating systems
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    if (player) {
      this.activeTool = player.activeTool;
      this.inputSystem.activeTool = this.activeTool;
      this.renderSystem.activeTool = this.activeTool;
    }

    const elapsed = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap maximum elapsed time to prevent lag spikes
    this.lag += Math.min(250, elapsed);

    // 1. Fixed Timestep Loop for Physics and AI logic updates
    while (this.lag >= this.MS_PER_UPDATE) {
      this.updateLogic(this.FIXED_DT);
      this.lag -= this.MS_PER_UPDATE;
    }

    // 2. Render loop runs at full requestAnimationFrame refresh rate (60Hz / 120Hz / 144Hz etc.)
    const frameDt = elapsed / 1000;
    this.renderSystem.update(this.world, frameDt);

    requestAnimationFrame((time) => this.loop(time));
  }

  private updateLogic(dt: number): void {
    // Autosave timer
    this.saveTimer += dt;
    if (this.saveTimer >= 30.0) {
      this.saveTimer = 0;
      this.saveGame();
    }

    // Execute logic updates in World (ticks Input, AI, Movement, Collisions, Lifetimes, Particles)
    this.world.update(dt);
  }

  private setupToolbar(): void {
    const tools: BuildTool[] = ["belt", "inserter", "drill", "furnace", "assembler", "chest", "pole", "generator"];
    const btnReset = document.getElementById("btn-reset");

    tools.forEach((tool) => {
      const btn = document.getElementById(`btn-${tool}`);
      if (btn) {
        btn.addEventListener("click", () => {
          this.activeTool = tool;
          const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
          if (player) {
            player.activeTool = tool;
          }
          this.updateToolbarActiveClasses(tool);
          this.canvas.focus();
        });
      }
    });

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        localStorage.removeItem("arcane_survivors_save");
        console.log("[Save/Load] Game reset requested. Wiped localStorage.");
        this.initWorld();
        this.canvas.focus();
      });
    }
  }

  private updateToolbarActiveClasses(activeTool: BuildTool): void {
    const tools: BuildTool[] = ["belt", "inserter", "drill", "furnace", "assembler", "chest", "pole", "generator"];
    tools.forEach((tool) => {
      const btn = document.getElementById(`btn-${tool}`);
      if (btn) {
        if (tool === activeTool) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  }

  private saveGame(): void {
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    if (!player) return;

    const serializedEntities: any[] = [];
    const entities = this.world.getEntities();

    for (const ent of entities) {
      const components = this.world.getEntityComponents(ent);
      const serializedComponents: any[] = [];

      for (const comp of components) {
        const type = comp.constructor.name;
        const data: any = {};
        for (const key of Object.keys(comp)) {
          data[key] = (comp as any)[key];
        }

        serializedComponents.push({ type, data });
      }

      if (serializedComponents.length > 0) {
        serializedEntities.push({
          id: ent,
          components: serializedComponents,
        });
      }
    }

    const saveData = {
      playerEntityId: this.playerEntityId,
      entities: serializedEntities,
      activeTool: this.activeTool,
      timestamp: Date.now(),
    };

    localStorage.setItem("arcane_survivors_save", JSON.stringify(saveData));
    console.log("[Save/Load] Autosaved game state to localStorage.");

    const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
    if (pPos) {
      for (let i = 0; i < 5; i++) {
        spawnParticle(this.world, pPos.x, pPos.y, "#2ecc71", 2.5);
      }
    }
  }

  private loadGame(): boolean {
    const saveStr = localStorage.getItem("arcane_survivors_save");
    if (!saveStr) return false;

    try {
      const saveData = JSON.parse(saveStr);
      if (!saveData || !saveData.entities) return false;

      this.world.clear();
      this.playerEntityId = saveData.playerEntityId;
      this.activeTool = saveData.activeTool || "belt";

      const COMPONENT_REGISTRY: Record<string, any> = {
        PositionComponent,
        VelocityComponent,
        PlayerComponent,
        MapComponent,
        StructureComponent,
        ItemComponent,
        ParticleComponent,
        InputComponent,
        BoxColliderComponent,
      };

      for (const serializedEnt of saveData.entities) {
        const entId = serializedEnt.id;
        this.world.createEntity(entId);

        for (const serializedComp of serializedEnt.components) {
          const ClassRef = COMPONENT_REGISTRY[serializedComp.type];
          if (!ClassRef) continue;

          const compInstance = new ClassRef();
          Object.assign(compInstance, serializedComp.data);
          this.world.addComponent(entId, compInstance);
        }
      }

      this.updateToolbarActiveClasses(this.activeTool);
      console.log(`[Save/Load] Successfully loaded game state. Recreated ${saveData.entities.length} entities.`);
      return true;
    } catch (e) {
      console.error("[Save/Load] Failed to load game state:", e);
      return false;
    }
  }
}
