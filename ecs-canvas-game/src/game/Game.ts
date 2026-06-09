import { spawnPlayer, spawnMonster, spawnMap, spawnWorker, spawnParticle, spawnStorage } from "./Spawner";
import {
  InputComponent,
  PlayerComponent,
  PositionComponent,
  MonsterComponent,
  MapComponent,
  WorkerComponent,
  VelocityComponent,
  StorageComponent,
  HungerComponent,
  CropComponent,
  GemComponent,
  ProjectileComponent,
  ColliderComponent,
  BoxColliderComponent,
  RenderComponent,
} from "./components/GameComponents";
import type { WorkerRole } from "./components/GameComponents";

// Systems
import { World } from "./ecs/World";
import { InputSystem } from "./systems/InputSystem";
import { AISystem } from "./systems/AISystem";
import { MovementSystem } from "./systems/MovementSystem";
import { CollisionSystem } from "./systems/CollisionSystem";
import { LifetimeSystem } from "./systems/LifetimeSystem";
import { ParticleSystem } from "./systems/ParticleSystem";
import { RenderSystem } from "./systems/RenderSystem";
import { TileCollisionSystem } from "./systems/TileCollisionSystem";
import { WorkerSystem } from "./systems/WorkerSystem";
import { CropSystem } from "./systems/CropSystem";

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
  private cropSystem!: CropSystem;
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
  private saveTimer: number = 0;

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

    // Initialize logic systems
    this.inputSystem = new InputSystem();
    this.aiSystem = new AISystem();
    this.tileCollisionSystem = new TileCollisionSystem();
    this.workerSystem = new WorkerSystem();
    this.cropSystem = new CropSystem();
    this.movementSystem = new MovementSystem();
    this.collisionSystem = new CollisionSystem();
    this.lifetimeSystem = new LifetimeSystem();
    this.particleSystem = new ParticleSystem();

    // Initialize rendering system (drawn on canvas)
    this.renderSystem = new RenderSystem(this.canvas, this.ctx);

    // Register logic systems in World (Inputs -> AI -> Tile Collisions -> Workers -> Crops -> Standard Movement -> Collisions)
    this.world.addSystem(this.inputSystem);
    this.world.addSystem(this.aiSystem);
    this.world.addSystem(this.tileCollisionSystem);
    this.world.addSystem(this.workerSystem);
    this.world.addSystem(this.cropSystem);
    this.world.addSystem(this.movementSystem);
    this.world.addSystem(this.collisionSystem);
    this.world.addSystem(this.lifetimeSystem);
    this.world.addSystem(this.particleSystem);

    this.monsterSpawnTimer = 0;
    this.saveTimer = 0;

    // Try to load game state from localStorage
    const loadSuccess = this.loadGame();

    if (!loadSuccess) {
      console.log("[Save/Load] No save game found, initializing fresh procedural map.");
      const mapData = spawnMap(this.world);
      this.playerEntityId = spawnPlayer(this.world, mapData.playerX, mapData.playerY);

      // Spawn global Storage building near player spawn
      spawnStorage(this.world, mapData.playerX + 80, mapData.playerY);

      // Spawn initial workers near the player with balanced cycled roles
      const initialRoles: WorkerRole[] = ["Woodcutter", "Miner", "Farmer"];
      for (let i = 0; i < 3; i++) {
        spawnWorker(
          this.world,
          mapData.playerX + (Math.random() * 80 - 40),
          mapData.playerY + (Math.random() * 80 - 40),
          initialRoles[i]
        );
      }

      // Spawn initial monsters
      for (let i = 0; i < 4; i++) {
        this.spawnMonsterOffscreen();
      }
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

      // P key to spawn a worker (cycling roles)
      if (e.key === "p" || e.key === "P") {
        const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
        if (pPos) {
          const currentWorkerCount = this.world.getEntitiesWith([WorkerComponent]).length;
          const roles: WorkerRole[] = ["Woodcutter", "Miner", "Farmer"];
          const assignedRole = roles[currentWorkerCount % 3];
          spawnWorker(this.world, pPos.x, pPos.y, assignedRole);
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
      // Autosave timer
      this.saveTimer += dt;
      if (this.saveTimer >= 30.0) {
        this.saveTimer = 0;
        this.saveGame();
      }

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
    const btnReset = document.getElementById("btn-reset");

    if (btnSpell && btnRoad) {
      btnSpell.addEventListener("click", () => {
        this.activeTool = "spell";
        btnSpell.classList.add("active");
        btnRoad.classList.remove("active");
        this.canvas.focus();
      });

      btnRoad.addEventListener("click", () => {
        this.activeTool = "road";
        btnRoad.classList.add("active");
        btnSpell.classList.remove("active");
        this.canvas.focus();
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        localStorage.removeItem("arcane_survivors_save");
        console.log("[Save/Load] Game reset requested. Wiped localStorage.");
        this.initWorld();
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

    if (col >= 0 && col < map.width && row >= 0 && row < map.height) {
      if (map.tiles[row][col] === "grass") {
        map.tiles[row][col] = "road";

        const workers = this.world.getEntitiesWith([WorkerComponent]);
        for (const workerId of workers) {
          const worker = this.world.getComponent(workerId, WorkerComponent)!;
          if (worker.state === "Moving" || worker.state === "Seeking Path") {
            worker.state = "Seeking Path";
            worker.searchCooldown = 0;
          }
        }

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

  private saveGame(): void {
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    if (!player || player.hp <= 0) return;

    const serializedEntities: any[] = [];
    const entities = this.world.getEntities();

    for (const ent of entities) {
      const components = this.world.getEntityComponents(ent);
      const serializedComponents: any[] = [];

      for (const comp of components) {
        const type = comp.constructor.name;
        if (type === "RenderComponent") continue;

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
        spawnParticle(this.world, pPos.x, pPos.y, "#55efc4", 2.5);
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
      this.activeTool = saveData.activeTool || "spell";

      const COMPONENT_REGISTRY: Record<string, any> = {
        PositionComponent,
        VelocityComponent,
        PlayerComponent,
        MonsterComponent,
        MapComponent,
        WorkerComponent,
        StorageComponent,
        HungerComponent,
        CropComponent,
        GemComponent,
        ProjectileComponent,
        ColliderComponent,
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

      const allEntities = this.world.getEntities();
      for (const ent of allEntities) {
        if (this.world.hasComponent(ent, PlayerComponent)) {
          const playerDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, time: number) => {
            const staffAngle = time * 2;
            ctx.save();
            ctx.translate(px, py);

            ctx.strokeStyle = "rgba(52, 152, 219, 0.35)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 16, 16 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.save();
            ctx.rotate(-staffAngle * 0.5);
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#2980b9";
            ctx.beginPath();
            ctx.moveTo(-10, 16);
            ctx.lineTo(10, 16);
            ctx.lineTo(0, -6);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#1b4f72";
            ctx.beginPath();
            ctx.moveTo(-8, 16);
            ctx.lineTo(8, 16);
            ctx.lineTo(0, -2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#f5d0a9";
            ctx.beginPath();
            ctx.arc(0, -8, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#2980b9";
            ctx.beginPath();
            ctx.moveTo(-9, -10);
            ctx.lineTo(9, -10);
            ctx.lineTo(0, -26);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(-3, -11, 6, 2);

            ctx.fillStyle = "#34e7e4";
            ctx.fillRect(-3, -9, 2, 2);
            ctx.fillRect(1, -9, 2, 2);

            ctx.save();
            ctx.translate(12, 0);
            ctx.rotate(Math.sin(time * 3) * 0.1);
            ctx.strokeStyle = "#8e44ad";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 16);
            ctx.lineTo(0, -18);
            ctx.stroke();
            ctx.fillStyle = "#00d2d3";
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#00d2d3";
            ctx.beginPath();
            ctx.moveTo(0, -24);
            ctx.lineTo(4, -18);
            ctx.lineTo(0, -12);
            ctx.lineTo(-4, -18);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(playerDraw));

        } else if (this.world.hasComponent(ent, WorkerComponent)) {
          const workerDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, time: number, entityId: string) => {
            const worker = this.world.getComponent(entityId, WorkerComponent)!;

            ctx.save();
            ctx.translate(px, py);

            const isMoving = worker.state === "Moving";
            const bounce = isMoving ? Math.abs(Math.sin(time * 8)) : 0;
            const scaleX = 1 + bounce * 0.1;
            const scaleY = 1 - bounce * 0.1;
            ctx.scale(scaleX, scaleY);

            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.beginPath();
            ctx.ellipse(0, 14, 8, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            let primaryColor = "#e67e22";
            let secondaryColor = "#d35400";
            if (worker.role === "Miner") {
              primaryColor = "#7f8c8d";
              secondaryColor = "#34495e";
            } else if (worker.role === "Farmer") {
              primaryColor = "#2ecc71";
              secondaryColor = "#27ae60";
            }

            if (worker.isCarryingFood) {
              ctx.save();
              ctx.translate(-7, 2);
              ctx.rotate(-0.3);
              ctx.strokeStyle = "#d35400";
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(0, 8);
              ctx.lineTo(0, -4);
              ctx.moveTo(-2, 8);
              ctx.lineTo(1, -4);
              ctx.stroke();
              ctx.fillStyle = "#f1c40f";
              ctx.fillRect(-2, -6, 5, 4);
              ctx.restore();
            }

            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.moveTo(-8, 14);
            ctx.lineTo(8, 14);
            ctx.lineTo(0, -2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = secondaryColor;
            ctx.beginPath();
            ctx.moveTo(-6, 14);
            ctx.lineTo(6, 14);
            ctx.lineTo(0, 2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#ffdbac";
            ctx.beginPath();
            ctx.arc(0, -6, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.moveTo(-7, -8);
            ctx.lineTo(7, -8);
            ctx.lineTo(0, -20);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(-2, -9, 4, 1.5);

            ctx.fillStyle = "#2c3e50";
            ctx.fillRect(-2, -7, 1.2, 1.2);
            ctx.fillRect(1, -7, 1.2, 1.2);

            if (worker.state === "Working") {
              const swingAngle = Math.sin(time * 16) * 0.6 - 0.4;
              
              ctx.save();
              ctx.translate(6, 4);
              ctx.rotate(-swingAngle);

              if (worker.role === "Woodcutter") {
                ctx.strokeStyle = "#8b4513";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, 8);
                ctx.lineTo(0, -10);
                ctx.stroke();
                ctx.fillStyle = "#7f8c8d";
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(5, -12);
                ctx.lineTo(5, -7);
                ctx.closePath();
                ctx.fill();
              } else if (worker.role === "Miner") {
                ctx.strokeStyle = "#8b4513";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, 8);
                ctx.lineTo(0, -10);
                ctx.stroke();
                ctx.strokeStyle = "#bdc3c7";
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.arc(0, -10, 5, Math.PI - 0.4, Math.PI * 2 + 0.4);
                ctx.stroke();
              } else if (worker.role === "Farmer") {
                ctx.strokeStyle = "#8b4513";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, 8);
                ctx.lineTo(0, -10);
                ctx.stroke();
                ctx.fillStyle = "#34495e";
                ctx.fillRect(-1.5, -12, 5, 2.5);
              }

              ctx.restore();

              const pct = Math.max(0, worker.workTimer / worker.workDuration);
              const barW = 24;
              const barH = 3;
              ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
              ctx.fillRect(-barW / 2, -28, barW, barH);
              ctx.fillStyle = "#2ecc71";
              ctx.fillRect(-barW / 2, -28, barW * (1 - pct), barH);
            }

            if (worker.state === "Starving") {
              ctx.fillStyle = "#ff7675";
              ctx.font = "bold 9px sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("💀 STARVING", 0, -32);
            }

            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.font = "bold 8px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${worker.role.toUpperCase()} - ${worker.state.toUpperCase()}`, 0, -23);

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(workerDraw));

        } else if (this.world.hasComponent(ent, StorageComponent)) {
          const storageDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, _time: number, entityId: string) => {
            const storage = this.world.getComponent(entityId, StorageComponent)!;
            ctx.save();
            ctx.translate(px, py);

            ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
            ctx.beginPath();
            ctx.ellipse(0, 16, 16, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#922b21";
            ctx.beginPath();
            ctx.roundRect(-14, -22, 28, 36, [4, 4, 0, 0]);
            ctx.fill();

            ctx.fillStyle = "#34495e";
            ctx.beginPath();
            ctx.arc(0, -22, 14, Math.PI, 0, false);
            ctx.fill();

            ctx.fillStyle = "#bdc3c7";
            ctx.fillRect(-14, -10, 28, 2.5);
            ctx.fillRect(-14, 4, 28, 2.5);

            ctx.fillStyle = "#f1c40f";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🌾 Stored: ${storage.foodCount}`, 0, -28);

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(storageDraw));

        } else if (this.world.hasComponent(ent, CropComponent)) {
          const cropDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, time: number, entityId: string) => {
            const crop = this.world.getComponent(entityId, CropComponent)!;
            ctx.save();
            ctx.translate(px, py);

            if (!crop.isFullyGrown) {
              if (crop.growthTimer > 40.0) {
                ctx.fillStyle = "#2ecc71";
                ctx.fillRect(-2, 6, 4, 8);
                ctx.fillRect(-5, 4, 3, 2);
                ctx.fillRect(2, 2, 3, 2);
              } else {
                ctx.fillStyle = "#27ae60";
                ctx.beginPath();
                ctx.ellipse(0, 4, 5, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#2ecc71";
                ctx.fillRect(-1.5, 6, 3, 8);
              }
            } else {
              const wave = Math.sin(time * 3 + px * 0.05) * 0.08;
              ctx.rotate(wave);

              ctx.strokeStyle = "#e67e22";
              ctx.lineWidth = 2.0;
              ctx.beginPath();
              ctx.moveTo(0, 14);
              ctx.lineTo(0, -6);
              ctx.stroke();

              ctx.fillStyle = "#f1c40f";
              ctx.beginPath();
              ctx.arc(0, -8, 4.5, 0, Math.PI * 2);
              ctx.arc(2.5, -12, 3, 0, Math.PI * 2);
              ctx.arc(-2.5, -12, 3, 0, Math.PI * 2);
              ctx.arc(0, -16, 2, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(cropDraw));

        } else if (this.world.hasComponent(ent, MonsterComponent)) {
          const monsterDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, time: number) => {
            const bounce = Math.abs(Math.sin(time * 6));
            const scaleX = 1 + bounce * 0.15;
            const scaleY = 1 - bounce * 0.15;

            ctx.save();
            ctx.translate(px, py + 12);
            ctx.scale(scaleX, scaleY);

            ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#8e44ad";
            ctx.beginPath();
            ctx.arc(0, -12, 10, Math.PI, 0, false);
            ctx.lineTo(10, 0);
            ctx.lineTo(6, -4);
            ctx.lineTo(0, 0);
            ctx.lineTo(-6, -4);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.fillRect(-3, -13, 2, 2);
            ctx.fillRect(1, -13, 2, 2);
            ctx.fillStyle = "#ff7675";
            ctx.fillRect(-2, -12, 1, 1);
            ctx.fillRect(2, -12, 1, 1);

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(monsterDraw));

        } else if (this.world.hasComponent(ent, GemComponent)) {
          const gemDraw = (ctx: CanvasRenderingContext2D, px: number, py: number, time: number) => {
            ctx.save();
            ctx.translate(px, py + Math.sin(time * 4) * 2);

            ctx.shadowBlur = 10;
            ctx.shadowColor = "#2ecc71";
            
            ctx.fillStyle = "#2ecc71";
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(4, 0);
            ctx.lineTo(0, 6);
            ctx.lineTo(-4, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(1.5, 0);
            ctx.lineTo(0, 4);
            ctx.lineTo(-1.5, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(gemDraw));

        } else if (this.world.hasComponent(ent, ProjectileComponent)) {
          const spellDraw = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#34e7e4";
            ctx.fillStyle = "#34e7e4";
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };
          this.world.addComponent(ent, new RenderComponent(spellDraw));
        }
      }

      const btnSpell = document.getElementById("btn-spell");
      const btnRoad = document.getElementById("btn-road");
      if (btnSpell && btnRoad) {
        if (this.activeTool === "spell") {
          btnSpell.classList.add("active");
          btnRoad.classList.remove("active");
        } else {
          btnRoad.classList.add("active");
          btnSpell.classList.remove("active");
        }
      }

      console.log(`[Save/Load] Successfully loaded game state. Recreated ${allEntities.length} entities.`);
      return true;
    } catch (e) {
      console.error("[Save/Load] Failed to load game state:", e);
      return false;
    }
  }
}
