import { World } from "./ecs/World";
import { spawnPlayer, spawnMonster, spawnMap, spawnWorker, spawnParticle } from "./Spawner";
import {
  InputComponent,
  PlayerComponent,
  PositionComponent,
  MonsterComponent,
  MapComponent,
  WorkerComponent,
} from "./components/GameComponents";

// Systems
import { InputSystem } from "./systems/InputSystem";
import { AISystem } from "./systems/AISystem";
import { MovementSystem } from "./systems/MovementSystem";
import { CollisionSystem } from "./systems/CollisionSystem";
import { LifetimeSystem } from "./systems/LifetimeSystem";
import { ParticleSystem } from "./systems/ParticleSystem";
import { RenderSystem } from "./systems/RenderSystem";
import { TileCollisionSystem } from "./systems/TileCollisionSystem";
import { WorkerSystem } from "./systems/WorkerSystem";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world!: World;
  private playerEntityId!: string;
  public activeTool: "spell" | "road" = "spell";

  // Systems
  private inputSystem!: InputSystem;
  private aiSystem!: AISystem;
  private tileCollisionSystem!: TileCollisionSystem;
  private workerSystem!: WorkerSystem;
  private movementSystem!: MovementSystem;
  private collisionSystem!: CollisionSystem;
  private lifetimeSystem!: LifetimeSystem;
  private particleSystem!: ParticleSystem;
  private renderSystem!: RenderSystem;

  // Timestep variables
  private lastTime: number = 0;
  private lag: number = 0;
  private readonly MS_PER_UPDATE = 1000 / 60; // 60 FPS Logic updates (16.67ms)
  private readonly FIXED_DT = 1 / 60;

  // Spawn settings
  private monsterSpawnTimer: number = 0;
  private readonly MONSTER_SPAWN_INTERVAL = 1.6; // Spawns every 1.6 seconds

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
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

    // Spawn Perlin noise tilemap
    const mapData = spawnMap(this.world);

    // Spawn player at valid starting grass tile
    this.playerEntityId = spawnPlayer(this.world, mapData.playerX, mapData.playerY);

    // Initialize logic systems
    this.inputSystem = new InputSystem();
    this.aiSystem = new AISystem();
    this.tileCollisionSystem = new TileCollisionSystem();
    this.workerSystem = new WorkerSystem();
    this.movementSystem = new MovementSystem();
    this.collisionSystem = new CollisionSystem();
    this.lifetimeSystem = new LifetimeSystem();
    this.particleSystem = new ParticleSystem();

    // Initialize rendering system (drawn on canvas)
    this.renderSystem = new RenderSystem(this.canvas, this.ctx);

    // Register logic systems in World (Inputs -> AI -> Tile Collisions -> Workers -> Standard Movement -> Collisions)
    this.world.addSystem(this.inputSystem);
    this.world.addSystem(this.aiSystem);
    this.world.addSystem(this.tileCollisionSystem);
    this.world.addSystem(this.workerSystem);
    this.world.addSystem(this.movementSystem);
    this.world.addSystem(this.collisionSystem);
    this.world.addSystem(this.lifetimeSystem);
    this.world.addSystem(this.particleSystem);

    this.monsterSpawnTimer = 0;

    // Spawn initial workers near the player
    for (let i = 0; i < 3; i++) {
      spawnWorker(
        this.world,
        mapData.playerX + (Math.random() * 80 - 40),
        mapData.playerY + (Math.random() * 80 - 40)
      );
    }

    // Spawn initial monsters
    for (let i = 0; i < 4; i++) {
      this.spawnMonsterOffscreen();
    }
  }

  private setupInput(): void {
    // Keyboard inputs
    window.addEventListener("keydown", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = true;
      }

      // Enter key to restart
      if (e.key === "Enter") {
        const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
        if (player && player.hp <= 0) {
          this.initWorld();
        }
      }

      // P key to spawn a worker
      if (e.key === "p" || e.key === "P") {
        const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
        if (pPos) {
          spawnWorker(this.world, pPos.x, pPos.y);
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = false;
      }
    });

    // Mouse inputs
    window.addEventListener("mousemove", (e) => {
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      const pos = this.world.getComponent(this.playerEntityId, PositionComponent);
      if (input && pos) {
        // Convert screen coordinates to world coordinates (centered at player)
        const screenX = e.clientX;
        const screenY = e.clientY;
        const camX = pos.x - this.canvas.width / 2;
        const camY = pos.y - this.canvas.height / 2;
        input.mouseX = screenX + camX;
        input.mouseY = screenY + camY;
      }
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        const input = this.world.getComponent(this.playerEntityId, InputComponent);
        const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
        if (input) {
          input.mouseClicked = true;
        }

        // Click to restart
        if (player && player.hp <= 0) {
          this.initWorld();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        const input = this.world.getComponent(this.playerEntityId, InputComponent);
        if (input) {
          input.mouseClicked = false;
        }
      }
    });
  }

  private loop(currentTime: number): void {
    // Sync tool states before updating systems
    this.inputSystem.activeTool = this.activeTool;
    this.renderSystem.activeTool = this.activeTool;

    // Delta time calculation
    const elapsed = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Cap maximum elapsed time to prevent "spiral of death" during lag spikes
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
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
    const input = this.world.getComponent(this.playerEntityId, InputComponent);

    if (player && player.hp > 0 && pPos) {
      // Drag-to-build dirt roads if held down in road mode
      if (this.activeTool === "road" && input && input.mouseClicked) {
        this.buildRoadAtMouse(input.mouseX, input.mouseY);
      }

      // Spawn new monsters over time
      this.monsterSpawnTimer += dt;
      if (this.monsterSpawnTimer >= this.MONSTER_SPAWN_INTERVAL) {
        this.monsterSpawnTimer = 0;
        
        // Count active monsters to avoid crowding
        const activeMonsters = this.world.getEntitiesWith([MonsterComponent]).length;
        if (activeMonsters < 80) {
          const spawnCount = player.level + Math.floor(Math.random() * 2);
          for (let i = 0; i < spawnCount; i++) {
            this.spawnMonsterOffscreen();
          }
        }
      }
    }

    // Execute logic updates in World (ticks Input, AI, Movement, Collisions, Lifetimes, Particles)
    this.world.update(dt);
  }

  private spawnMonsterOffscreen(): void {
    const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
    if (!pPos) return;

    // Choose random angle
    const angle = Math.random() * Math.PI * 2;
    // Choose random radius outside view width/height (typically 300 to 500 px)
    const dist = 320 + Math.random() * 200;

    const spawnX = pPos.x + Math.cos(angle) * dist;
    const spawnY = pPos.y + Math.sin(angle) * dist;

    spawnMonster(this.world, spawnX, spawnY);
  }

  private setupToolbar(): void {
    const btnSpell = document.getElementById("btn-spell");
    const btnRoad = document.getElementById("btn-road");

    if (btnSpell && btnRoad) {
      btnSpell.addEventListener("click", () => {
        this.activeTool = "spell";
        btnSpell.classList.add("active");
        btnRoad.classList.remove("active");
        
        // Refocus canvas so WASD keys work instantly
        this.canvas.focus();
      });

      btnRoad.addEventListener("click", () => {
        this.activeTool = "road";
        btnRoad.classList.add("active");
        btnSpell.classList.remove("active");
        
        this.canvas.focus();
      });
    }
  }

  private buildRoadAtMouse(worldX: number, worldY: number): void {
    const maps = this.world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const map = this.world.getComponent(mapEntity, MapComponent)!;
    const ts = map.tileSize;

    const col = Math.floor(worldX / ts);
    const row = Math.floor(worldY / ts);

    // Bounds check
    if (col >= 0 && col < map.width && row >= 0 && row < map.height) {
      if (map.tiles[row][col] === "grass") {
        map.tiles[row][col] = "road";

        // Dynamic recalculation: Set active moving/seeking workers to seek paths immediately
        const workers = this.world.getEntitiesWith([WorkerComponent]);
        for (const workerId of workers) {
          const worker = this.world.getComponent(workerId, WorkerComponent)!;
          if (worker.state === "Moving" || worker.state === "Seeking Path") {
            worker.state = "Seeking Path";
            worker.searchCooldown = 0; // force immediate pathfind
          }
        }

        // Spawn placement dust particles
        const particleX = col * ts + ts / 2;
        const particleY = row * ts + ts / 2;
        for (let i = 0; i < 4; i++) {
          spawnParticle(
            this.world,
            particleX + (Math.random() * 24 - 12),
            particleY + (Math.random() * 24 - 12),
            "#b8863b",
            2 + Math.random() * 2
          );
        }
      }
    }
  }
}
