import {
  spawnPlayer,
  spawnMap,
  spawnParticle,
  spawnWorker,
  spawnTimeWeather,
  spawnCrashSite,
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
  type BuildTool,
  BoxColliderComponent,
  WorkerComponent,
  AnimationComponent,
} from "./components/GameComponents";

// Systems
import { World } from "./ecs/World";
import { InputSystem } from "./systems/InputSystem";
import { TileCollisionSystem } from "./systems/TileCollisionSystem";
import { FactorySystem } from "./systems/FactorySystem";
import { MovementSystem } from "./systems/MovementSystem";
import { ParticleSystem } from "./systems/ParticleSystem";
import { RenderSystem } from "./systems/RenderSystem";
import { WorkerSystem } from "./systems/WorkerSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { TimeWeatherSystem } from "./systems/TimeWeatherSystem";
import { CombatSystem } from "./systems/CombatSystem";
import { toast } from "./utils/Toast";
import { ensureAuthenticated, saveToCloud, loadFromCloud, compressToBinaryString, decompressFromBinaryString } from "./FirebaseSync";

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
  public renderSystem!: RenderSystem;

  // Fixed Timestep variables (separating update loop from render loop)

  private lastTime: number = 0;
  private lag: number = 0;
  private readonly MS_PER_UPDATE = 1000 / 60; // 60 FPS Logic updates (16.67ms)
  private readonly FIXED_DT = 1 / 60;
  private saveTimer: number = 0;

  // Screen mouse coordinates for tracking mouse relative to the lerped camera
  private screenMouseX: number = 0;
  private screenMouseY: number = 0;

  // Firebase Anonymous Auth & loading states
  private uid: string | null = null;
  private isLoaded: boolean = false;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    
    // Prevent default context menu on right clicks
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.resizeCanvas();
    this.initGame();

    window.addEventListener("resize", () => this.resizeCanvas());
    
    (window as any).gameInstance = this;
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  private drawLoadingScreen(text: string): void {
    this.ctx.fillStyle = "#1b1e22";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "20px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
  }

  private async initGame(): Promise<void> {
    this.initWorld();
    this.setupInput();
    this.setupToolbar();
    this.setupDialogs();

    this.drawLoadingScreen("Connecting to database...");

    try {
      const user = await ensureAuthenticated();
      this.uid = user.uid;
      console.log("[Firebase] Authenticated with anonymous UID:", this.uid);

      this.drawLoadingScreen("Loading game from cloud...");
      const cloudLoadSuccess = await this.loadGameFromCloud();
      if (!cloudLoadSuccess) {
        const localLoadSuccess = this.loadGameFromLocal();
        if (!localLoadSuccess) {
          this.initializeFreshWorld();
        }
      }
    } catch (e) {
      console.error("[Firebase] Initialization failed. Falling back to local storage.", e);
      const localLoadSuccess = this.loadGameFromLocal();
      if (!localLoadSuccess) {
        this.initializeFreshWorld();
      }
    }

    // Mark as loaded and start the loop
    this.isLoaded = true;
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
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
    this.world.addSystem(new WorkerSystem());
    this.world.addSystem(new AnimationSystem());
    this.world.addSystem(new TimeWeatherSystem());
    this.world.addSystem(new CombatSystem());

    this.saveTimer = 0;
  }

  private initializeFreshWorld(): void {
    console.log("[Save/Load] Initializing fresh procedural map.");
    const mapData = spawnMap(this.world);
    this.playerEntityId = spawnPlayer(this.world, mapData.playerX, mapData.playerY);
    spawnTimeWeather(this.world);

    // Spawn crashed spaceship pod next to player spawn
    const crashCol = Math.floor(mapData.playerX / 64) + 2;
    const crashRow = Math.floor(mapData.playerY / 64);
    spawnCrashSite(this.world, crashCol * 64 + 32, crashRow * 64 + 32, crashCol, crashRow);

    // Equip player with items for placing

    const playerEnt = this.world.getEntitiesWith([PlayerComponent])[0];
    if (playerEnt) {
      const playerComp = this.world.getComponent(playerEnt, PlayerComponent)!;
      playerComp.inventory["belt"] = 100;
      playerComp.inventory["inserter"] = 30;
      playerComp.inventory["drill"] = 15;
      playerComp.inventory["furnace"] = 10;
      playerComp.inventory["assembler"] = 5;
      playerComp.inventory["chest"] = 10;
      playerComp.inventory["pole"] = 25;
      playerComp.inventory["generator"] = 5;
      playerComp.inventory["road"] = 50;
      playerComp.inventory["storage_house"] = 5;
      playerComp.inventory["worker_house"] = 5;
      
      this.updateUnlockedButtonsVisibility({});
    }
  }

  private setupInput(): void {
    // Keyboard inputs
    window.addEventListener("keydown", (e) => {
      if (!this.isLoaded) return;
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = true;
      }
    });

    window.addEventListener("keyup", (e) => {
      if (!this.isLoaded) return;
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        input.keys[e.key] = false;
      }
    });

    // Mouse movement
    window.addEventListener("mousemove", (e) => {
      this.screenMouseX = e.clientX;
      this.screenMouseY = e.clientY;
      if (!this.isLoaded) return;
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input && this.renderSystem) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const zoom = this.renderSystem.zoom || 1.0;
        input.mouseX = this.renderSystem.camX + width / 2 + (this.screenMouseX - width / 2) / zoom;
        input.mouseY = this.renderSystem.camY + height / 2 + (this.screenMouseY - height / 2) / zoom;
      }
    });

    // Mouse click bindings
    window.addEventListener("mousedown", (e) => {
      if (!this.isLoaded) return;
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
      if (!this.isLoaded) return;
      const input = this.world.getComponent(this.playerEntityId, InputComponent);
      if (input) {
        if (e.button === 0) {
          input.mouseClicked = false;
        } else if (e.button === 2) {
          input.mouseRightClicked = false;
        }
      }
    });

    // Camera scroll-wheel zoom
    window.addEventListener("wheel", (e) => {
      if (!this.isLoaded || !this.renderSystem) return;
      const zoomSpeed = 0.08;
      let newZoom = this.renderSystem.zoom - Math.sign(e.deltaY) * zoomSpeed;
      newZoom = Math.max(0.5, Math.min(4.0, newZoom));
      this.renderSystem.zoom = newZoom;
    }, { passive: true });
  }

  private loop(currentTime: number): void {
    if (!this.isLoaded) return;
    // Sync tool states before updating systems
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    if (player) {
      this.activeTool = player.activeTool;
      this.inputSystem.activeTool = this.activeTool;
      this.renderSystem.activeTool = this.activeTool;
    }

    // Sync mouse world coordinates based on the current camera position, since the camera moves
    const input = this.world.getComponent(this.playerEntityId, InputComponent);
    if (input && this.renderSystem) {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const zoom = this.renderSystem.zoom || 1.0;
      input.mouseX = this.renderSystem.camX + width / 2 + (this.screenMouseX - width / 2) / zoom;
      input.mouseY = this.renderSystem.camY + height / 2 + (this.screenMouseY - height / 2) / zoom;
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
    if (this.saveTimer >= 60.0) {
      this.saveTimer = 0;
      this.saveGame();
    }

    // Execute logic updates in World (ticks Input, AI, Movement, Collisions, Lifetimes, Particles)
    this.world.update(dt);

    // Sync state with React UI
    if ((window as any).onGameUpdate) {
      const playerEnt = this.world.getEntitiesWith([PlayerComponent])[0];
      const player = playerEnt ? this.world.getComponent(playerEnt, PlayerComponent) : null;
      
      const structures = this.world.getEntitiesWith([StructureComponent]);
      const storageHouses = structures.filter(s => this.world.getComponent(s, StructureComponent)!.type === "storage_house");

      const globalStock: Record<string, number> = { wood: 0, stone: 0, iron_plate: 0, coal: 0, food: 0, fish: 0 };
      for (const sh of storageHouses) {
        const struct = this.world.getComponent(sh, StructureComponent)!;
        for (const [item, qty] of Object.entries(struct.inventory)) {
          globalStock[item] = (globalStock[item] || 0) + qty;
        }
      }

      (window as any).onGameUpdate({
        playerInventory: player ? player.inventory : {},
        unlockedTechs: player ? player.unlockedTechs : {},
        activeTool: player ? player.activeTool : "belt",
        globalStock,
        playerCustomization: player ? {
          skinColor: player.skinColor,
          hairStyle: player.hairStyle,
          hairColor: player.hairColor,
          clothingStyle: player.clothingStyle,
          clothingColor: player.clothingColor,
          shirtColor: player.shirtColor,
          accessoryStyle: player.accessoryStyle,
          accessoryColor: player.accessoryColor
        } : null
      });
    }
  }

  private setupToolbar(): void {
    const tools: BuildTool[] = [
      "belt", "inserter", "drill", "furnace", "assembler", "chest", "pole", "generator",
      "road", "storage_house", "worker_house", "advanced_drill", "advanced_furnace", "fast_road"
    ];
    const btnReset = document.getElementById("btn-reset");

    // Tab switching handlers
    const tabFactory = document.getElementById("tab-factory");
    const tabBuilder = document.getElementById("tab-builder");
    const tabTech = document.getElementById("tab-tech");
    const groupFactory = document.getElementById("tools-factory-group");
    const groupBuilder = document.getElementById("tools-builder-group");
    const groupTech = document.getElementById("tools-tech-group");

    if (tabFactory && tabBuilder && tabTech && groupFactory && groupBuilder && groupTech) {
      tabFactory.addEventListener("click", () => {
        tabFactory.classList.add("active");
        tabBuilder.classList.remove("active");
        tabTech.classList.remove("active");
        groupFactory.classList.add("active");
        groupBuilder.classList.remove("active");
        groupTech.classList.remove("active");
        this.canvas.focus();
      });

      tabBuilder.addEventListener("click", () => {
        tabBuilder.classList.add("active");
        tabFactory.classList.remove("active");
        tabTech.classList.remove("active");
        groupBuilder.classList.add("active");
        groupFactory.classList.remove("active");
        groupTech.classList.remove("active");
        this.canvas.focus();
      });

      tabTech.addEventListener("click", () => {
        tabTech.classList.add("active");
        tabFactory.classList.remove("active");
        tabBuilder.classList.remove("active");
        groupTech.classList.add("active");
        groupFactory.classList.remove("active");
        groupBuilder.classList.remove("active");
        this.canvas.focus();
      });
    }

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
        console.log("[Save/Load] Game reset requested.");
        localStorage.removeItem("arcane_survivors_save");
        this.world.clear();
        this.initializeFreshWorld();
        this.saveGame();
        this.canvas.focus();
      });
    }
  }

  private updateToolbarActiveClasses(activeTool: BuildTool): void {
    const tools: BuildTool[] = [
      "belt", "inserter", "drill", "furnace", "assembler", "chest", "pole", "generator",
      "road", "storage_house", "worker_house", "advanced_drill", "advanced_furnace", "fast_road"
    ];
    
    // Auto sync tab display if active tool is changed externally (e.g. via hotkeys)
    const tabFactory = document.getElementById("tab-factory");
    const tabBuilder = document.getElementById("tab-builder");
    const tabTech = document.getElementById("tab-tech");
    const groupFactory = document.getElementById("tools-factory-group");
    const groupBuilder = document.getElementById("tools-builder-group");
    const groupTech = document.getElementById("tools-tech-group");
    
    if (tabFactory && tabBuilder && groupFactory && groupBuilder) {
      const isBuilderTool = activeTool === "road" || activeTool === "fast_road" || activeTool === "storage_house" || activeTool === "worker_house";
      if (isBuilderTool) {
        tabBuilder.classList.add("active");
        tabFactory.classList.remove("active");
        if (tabTech) tabTech.classList.remove("active");
        groupBuilder.classList.add("active");
        groupFactory.classList.remove("active");
        if (groupTech) groupTech.classList.remove("active");
      } else {
        tabFactory.classList.add("active");
        tabBuilder.classList.remove("active");
        if (tabTech) tabTech.classList.remove("active");
        groupFactory.classList.add("active");
        groupBuilder.classList.remove("active");
        if (groupTech) groupTech.classList.remove("active");
      }
    }

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

  public saveGame(): void {
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

    // Save to local storage as double persistence / local cache
    try {
      const compressedStr = compressToBinaryString(saveData);
      localStorage.setItem("arcane_survivors_save", compressedStr);
      console.log("[Save/Load] Autosaved game state to localStorage (gzipped).");
    } catch (err) {
      console.error("[Save/Load] Failed to save to localStorage:", err);
    }

    // Save to Firebase Cloud Firestore with compression
    if (this.uid) {
      saveToCloud(this.uid, saveData)
        .then(() => {
          console.log("[Save/Load] Compressed game state successfully saved to Cloud Firestore 'saves' collection.");
          
          // Spawn green save particles around the player on successful cloud sync
          const pPos = this.world.getComponent(this.playerEntityId, PositionComponent);
          if (pPos) {
            for (let i = 0; i < 5; i++) {
              spawnParticle(this.world, pPos.x, pPos.y, "#2ecc71", 2.5);
            }
          }
        })
        .catch((err) => {
          console.error("[Save/Load] Cloud save failed:", err);
        });
    }
  }

  private loadGameFromLocal(): boolean {
    const saveStr = localStorage.getItem("arcane_survivors_save");
    if (!saveStr) return false;

    try {
      let saveData: any;
      if (saveStr.trim().startsWith("{")) {
        // Fallback for old uncompressed JSON string
        saveData = JSON.parse(saveStr);
      } else {
        saveData = decompressFromBinaryString(saveStr);
      }

      if (!saveData || !saveData.entities) return false;

      this.deserializeGame(saveData);
      console.log(`[Save/Load] Successfully loaded game state from localStorage. Recreated ${saveData.entities.length} entities.`);
      return true;
    } catch (e) {
      console.error("[Save/Load] Failed to load local game state:", e);
      return false;
    }
  }

  private async loadGameFromCloud(): Promise<boolean> {
    if (!this.uid) return false;
    console.log("[Save/Load] Fetching cloud save from Firestore...");
    try {
      const saveData = await loadFromCloud(this.uid);
      if (!saveData) {
        console.log("[Save/Load] No cloud save found in Firestore.");
        return false;
      }
      this.deserializeGame(saveData);
      console.log(`[Save/Load] Successfully loaded game state from Cloud Firestore. Recreated ${saveData.entities.length} entities.`);
      return true;
    } catch (e) {
      console.error("[Save/Load] Failed to load cloud save:", e);
      return false;
    }
  }

  private deserializeGame(saveData: any): void {
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
      WorkerComponent,
      AnimationComponent,
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
    
    // Sync unlocked buttons visibility
    const playerEnt = this.world.getEntitiesWith([PlayerComponent])[0];
    if (playerEnt) {
      const playerComp = this.world.getComponent(playerEnt, PlayerComponent)!;
      if (!playerComp.unlockedTechs) playerComp.unlockedTechs = {};
      this.updateUnlockedButtonsVisibility(playerComp.unlockedTechs);
    }
  }

  private setupDialogs(): void {
    const btnClose = document.getElementById("btn-close-dialog");
    const btnHire = document.getElementById("btn-hire-worker");
    const btnFire = document.getElementById("btn-fire-worker");
    const roleSelect = document.getElementById("worker-role-select") as HTMLSelectElement;
    const dialog = document.getElementById("worker-house-dialog");

    if (btnClose && dialog) {
      btnClose.addEventListener("click", () => {
        dialog.style.display = "none";
        this.canvas.focus();
      });
    }

    if (btnHire) {
      btnHire.addEventListener("click", () => {
        const houseId = (window as any).activeWorkerHouseId;
        const world = (window as any).gameWorld;
        if (!houseId || !world) return;

        const playerEnt = world.getEntitiesWith([PlayerComponent])[0];
        if (!playerEnt) return;
        const player = world.getComponent(playerEnt, PlayerComponent)!;
        
        const woodCount = player.inventory["wood"] || 0;
        const plateCount = player.inventory["iron_plate"] || 0;

        if (woodCount >= 10 && plateCount >= 10) {
          player.inventory["wood"] -= 10;
          player.inventory["iron_plate"] -= 10;

          const housePos = world.getComponent(houseId, PositionComponent)!;
          spawnWorker(world, housePos.x, housePos.y, houseId);

          toast.success("Worker hired successfully!");
          this.refreshWorkerDialog(houseId, world);
        } else {
          toast.error("Insufficient resources! Requires 10 Wood and 10 Iron Plates.");
        }
      });
    }

    if (btnFire) {
      btnFire.addEventListener("click", () => {
        const houseId = (window as any).activeWorkerHouseId;
        const world = (window as any).gameWorld;
        if (!houseId || !world) return;

        const workers = world.getEntitiesWith([WorkerComponent]);
        const workerEnt = workers.find((w: string) => world.getComponent(w, WorkerComponent)!.houseEntityId === houseId);

        if (workerEnt) {
          const playerEnt = world.getEntitiesWith([PlayerComponent])[0];
          if (playerEnt) {
            const player = world.getComponent(playerEnt, PlayerComponent)!;
            player.inventory["wood"] = (player.inventory["wood"] || 0) + 5;
            player.inventory["iron_plate"] = (player.inventory["iron_plate"] || 0) + 5;
          }

          world.destroyEntity(workerEnt);
          toast.info("Worker dismissed. Refunded 5 Wood & 5 Iron Plates.");
          this.refreshWorkerDialog(houseId, world);
        }
      });
    }

    if (roleSelect) {
      roleSelect.addEventListener("change", () => {
        const houseId = (window as any).activeWorkerHouseId;
        const world = (window as any).gameWorld;
        if (!houseId || !world) return;

        const workers = world.getEntitiesWith([WorkerComponent]);
        const workerEnt = workers.find((w: string) => world.getComponent(w, WorkerComponent)!.houseEntityId === houseId);

        if (workerEnt) {
          const wComp = world.getComponent(workerEnt, WorkerComponent)!;
          wComp.role = (roleSelect.value as any) || null;
          wComp.state = "seeking";
          wComp.path = [];
          wComp.pathIndex = 0;

          toast.info(`Assigned role: ${wComp.role ? wComp.role.toUpperCase() : "NONE"}`);
          this.refreshWorkerDialog(houseId, world);
        }
      });
    }

    // Bind window handler for opening modal
    (window as any).refreshWorkerDialog = (houseEntityId: string, worldRef: World) => {
      (window as any).activeWorkerHouseId = houseEntityId;
      (window as any).gameWorld = worldRef;
      if (dialog) dialog.style.display = "flex";
      this.refreshWorkerDialog(houseEntityId, worldRef);
    };

    // Tech tree dialog open/close/research listeners
    const btnOpenTech = document.getElementById("btn-open-tech-tree");
    const techDialog = document.getElementById("tech-tree-dialog");
    const btnCloseTech = document.getElementById("btn-close-tech");

    if (btnOpenTech && techDialog) {
      btnOpenTech.addEventListener("click", () => {
        techDialog.style.display = "flex";
        this.refreshTechTreeUI();
        this.canvas.focus();
      });
    }

    if (btnCloseTech && techDialog) {
      btnCloseTech.addEventListener("click", () => {
        techDialog.style.display = "none";
        this.canvas.focus();
      });
    }

    const btnMining = document.getElementById("btn-research-mining");
    const btnLogistics = document.getElementById("btn-research-logistics");
    const btnSmelting = document.getElementById("btn-research-smelting");

    if (btnMining) {
      btnMining.addEventListener("click", () => this.researchTechnology("advanced_mining"));
    }
    if (btnLogistics) {
      btnLogistics.addEventListener("click", () => this.researchTechnology("high_speed_logistics"));
    }
    if (btnSmelting) {
      btnSmelting.addEventListener("click", () => this.researchTechnology("industrial_smelting"));
    }
  }

  private refreshWorkerDialog(houseEntityId: string, world: World): void {
    const status = document.getElementById("dialog-house-status")!;
    const hireActions = document.getElementById("dialog-hire-actions")!;
    const workerSettings = document.getElementById("dialog-worker-settings")!;
    const roleSelect = document.getElementById("worker-role-select") as HTMLSelectElement;

    const workers = world.getEntitiesWith([WorkerComponent]);
    const workerEnt = workers.find(w => world.getComponent(w, WorkerComponent)!.houseEntityId === houseEntityId);

    if (workerEnt) {
      const wComp = world.getComponent(workerEnt, WorkerComponent)!;
      const hungerStatus = wComp.isStarving ? "STARVING ⚠️" : `${Math.max(0, Math.floor(wComp.hunger))}%`;
      status.innerHTML = `<strong>Role:</strong> ${wComp.role ? wComp.role.toUpperCase() : "NONE"}<br/>
                          <strong>State:</strong> ${wComp.state.toUpperCase().replace("_", " ")}<br/>
                          <strong>Hunger:</strong> <span style="color: ${wComp.isStarving || wComp.hunger < 25 ? '#e74c3c' : '#2ecc71'}; font-weight: bold;">${hungerStatus}</span>`;
      hireActions.style.display = "none";
      workerSettings.style.display = "block";
      roleSelect.value = wComp.role || "";
    } else {
      status.innerHTML = "Status: No worker hired.";
      hireActions.style.display = "block";
      workerSettings.style.display = "none";
    }
  }

  private updateUnlockedButtonsVisibility(unlockedTechs: Record<string, boolean>): void {
    const btnAdvDrill = document.getElementById("btn-advanced_drill");
    const btnAdvFurnace = document.getElementById("btn-advanced_furnace");
    const btnFastRoad = document.getElementById("btn-fast_road");

    if (btnAdvDrill) {
      btnAdvDrill.style.display = unlockedTechs["advanced_mining"] ? "flex" : "none";
    }
    if (btnAdvFurnace) {
      btnAdvFurnace.style.display = unlockedTechs["industrial_smelting"] ? "flex" : "none";
    }
    if (btnFastRoad) {
      btnFastRoad.style.display = unlockedTechs["high_speed_logistics"] ? "flex" : "none";
    }
  }

  private refreshTechTreeUI(): void {
    const playerEnt = this.world.getEntitiesWith([PlayerComponent])[0];
    if (!playerEnt) return;
    const player = this.world.getComponent(playerEnt, PlayerComponent)!;
    if (!player.unlockedTechs) player.unlockedTechs = {};

    // Get costs/stock from storage houses
    const structures = this.world.getEntitiesWith([StructureComponent]);
    const storageHouses = structures.filter(s => this.world.getComponent(s, StructureComponent)!.type === "storage_house");

    const globalStock: Record<string, number> = { wood: 0, stone: 0, iron_plate: 0, coal: 0 };
    for (const sh of storageHouses) {
      const struct = this.world.getComponent(sh, StructureComponent)!;
      for (const [item, qty] of Object.entries(struct.inventory)) {
        globalStock[item] = (globalStock[item] || 0) + qty;
      }
    }

    const techConfigs = [
      {
        id: "advanced_mining",
        cardId: "tech-card-advanced_mining",
        btnId: "btn-research-mining",
        costs: [
          { item: "wood", required: 500, labelId: "tech-req-mining-wood", symbol: "🪵", name: "Wood" },
          { item: "stone", required: 200, labelId: "tech-req-mining-stone", symbol: "🪨", name: "Stone" }
        ]
      },
      {
        id: "high_speed_logistics",
        cardId: "tech-card-high_speed_logistics",
        btnId: "btn-research-logistics",
        costs: [
          { item: "wood", required: 300, labelId: "tech-req-logistics-wood", symbol: "🪵", name: "Wood" },
          { item: "iron_plate", required: 100, labelId: "tech-req-logistics-iron", symbol: "🪙", name: "Iron Plate" }
        ]
      },
      {
        id: "industrial_smelting",
        cardId: "tech-card-industrial_smelting",
        btnId: "btn-research-smelting",
        costs: [
          { item: "stone", required: 400, labelId: "tech-req-smelting-stone", symbol: "🪨", name: "Stone" },
          { item: "coal", required: 150, labelId: "tech-req-smelting-coal", symbol: "⚫", name: "Coal" }
        ]
      }
    ];

    for (const config of techConfigs) {
      const isUnlocked = player.unlockedTechs[config.id] === true;
      const card = document.getElementById(config.cardId);
      const btn = document.getElementById(config.btnId) as HTMLButtonElement;

      let hasMaterials = true;

      for (const cost of config.costs) {
        const stock = globalStock[cost.item] || 0;
        const label = document.getElementById(cost.labelId);
        if (label) {
          label.textContent = `${cost.symbol} ${stock} / ${cost.required} ${cost.name}`;
          if (stock >= cost.required) {
            label.className = "res-cost met";
          } else {
            label.className = "res-cost unmet";
            hasMaterials = false;
          }
        }
      }

      if (card && btn) {
        if (isUnlocked) {
          card.className = "tech-node-card unlocked";
          btn.textContent = "Researched ✓";
          btn.disabled = true;
        } else {
          btn.disabled = false;
          if (hasMaterials) {
            card.className = "tech-node-card available";
            btn.textContent = "Research";
          } else {
            card.className = "tech-node-card locked";
            btn.textContent = "Research";
          }
        }
      }
    }
  }

  public researchTechnology(techId: string): void {
    const playerEnt = this.world.getEntitiesWith([PlayerComponent])[0];
    if (!playerEnt) return;
    const player = this.world.getComponent(playerEnt, PlayerComponent)!;
    if (!player.unlockedTechs) player.unlockedTechs = {};

    if (player.unlockedTechs[techId]) {
      toast.info("Technology already researched!");
      return;
    }

    let reqs: Record<string, number> = {};
    if (techId === "advanced_mining") {
      reqs = { wood: 500, stone: 200 };
    } else if (techId === "high_speed_logistics") {
      reqs = { wood: 300, iron_plate: 100 };
    } else if (techId === "industrial_smelting") {
      reqs = { stone: 400, coal: 150 };
    }

    const structures = this.world.getEntitiesWith([StructureComponent]);
    const storageHouses = structures.filter(s => this.world.getComponent(s, StructureComponent)!.type === "storage_house");

    const globalStock: Record<string, number> = {};
    for (const sh of storageHouses) {
      const struct = this.world.getComponent(sh, StructureComponent)!;
      for (const [item, qty] of Object.entries(struct.inventory)) {
        globalStock[item] = (globalStock[item] || 0) + qty;
      }
    }

    let hasEnough = true;
    for (const [item, reqQty] of Object.entries(reqs)) {
      if ((globalStock[item] || 0) < reqQty) {
        hasEnough = false;
        break;
      }
    }

    if (!hasEnough) {
      toast.error("Insufficient resources in global Storage Houses!");
      return;
    }

    // Deduct resources
    for (const [item, reqQty] of Object.entries(reqs)) {
      let remainingToDeduct = reqQty;
      for (const sh of storageHouses) {
        const struct = this.world.getComponent(sh, StructureComponent)!;
        const count = struct.inventory[item] || 0;
        if (count > 0) {
          const deduct = Math.min(remainingToDeduct, count);
          struct.inventory[item] -= deduct;
          remainingToDeduct -= deduct;
          if (remainingToDeduct <= 0) break;
        }
      }
      player.inventory[item] = Math.max(0, (player.inventory[item] || 0) - reqQty);
    }

    player.unlockedTechs[techId] = true;
    toast.success(`Researched ${techId.toUpperCase().replace(/_/g, " ")}!`);

    this.updateUnlockedButtonsVisibility(player.unlockedTechs);
    this.refreshTechTreeUI();
    this.saveGame();
  }

  public changeActiveTool(tool: BuildTool): void {
    this.activeTool = tool;
    const player = this.world.getComponent(this.playerEntityId, PlayerComponent);
    if (player) {
      player.activeTool = tool;
    }
  }

  public resetGame(): void {
    console.log("[Save/Load] Game reset requested.");
    localStorage.removeItem("arcane_survivors_save");
    this.world.clear();
    this.initializeFreshWorld();
    this.saveGame();
  }
}
