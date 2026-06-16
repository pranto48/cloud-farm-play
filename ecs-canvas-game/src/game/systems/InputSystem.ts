import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  InputComponent,
  PlayerComponent,
  MapComponent,
  StructureComponent,
  BuildTool,
  TileType,
  WorkerComponent,
} from "../components/GameComponents";
import { 
  spawnBelt, 
  spawnInserter, 
  spawnDrill, 
  spawnFurnace, 
  spawnAssembler, 
  spawnChest, 
  spawnPowerPole, 
  spawnGenerator,
  spawnStorageHouse,
  spawnWorkerHouse,
  spawnAdvancedDrill,
  spawnAdvancedFurnace
} from "../Spawner";
import { toast } from "../utils/Toast";

export class InputSystem extends System {
  readonly requiredComponents = [PlayerComponent, InputComponent, PositionComponent, VelocityComponent];
  public activeTool: BuildTool = "belt";

  // Prevent multiple structures being spawned on a single click (debounce)
  private placementDebounceTimer: number = 0;
  private keyDebounce: Record<string, boolean> = {};

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);
    if (entities.length === 0) return;

    const playerEntityId = entities[0];
    const player = world.getComponent(playerEntityId, PlayerComponent)!;
    const input = world.getComponent(playerEntityId, InputComponent)!;
    const pos = world.getComponent(playerEntityId, PositionComponent)!;
    const vel = world.getComponent(playerEntityId, VelocityComponent)!;

    if (this.placementDebounceTimer > 0) {
      this.placementDebounceTimer -= dt;
    }

    // 1. Decoupled WASD Grid-Locked Movement
    const isMoving = pos.moveDuration && pos.moveDuration > 0;

    if (!isMoving) {
      let targetRow = Math.floor(pos.y / 64);
      let targetCol = Math.floor(pos.x / 64);
      let moved = false;

      if (input.keys["w"] || input.keys["W"] || input.keys["arrowup"]) {
        targetRow -= 1;
        moved = true;
      } else if (input.keys["s"] || input.keys["S"] || input.keys["arrowdown"]) {
        targetRow += 1;
        moved = true;
      } else if (input.keys["a"] || input.keys["A"] || input.keys["arrowleft"]) {
        targetCol -= 1;
        moved = true;
      } else if (input.keys["d"] || input.keys["D"] || input.keys["arrowright"]) {
        targetCol += 1;
        moved = true;
      }

      if (moved) {
        const maps = world.getEntitiesWith([MapComponent]);
        if (maps.length > 0) {
          const mapComp = world.getComponent(maps[0], MapComponent)!;
          if (targetRow >= 0 && targetRow < mapComp.height && targetCol >= 0 && targetCol < mapComp.width) {
            const tileType = mapComp.tiles[targetRow][targetCol];
            const isWalkable = tileType !== "water" && tileType !== "river" && tileType !== "stone";
            if (isWalkable) {
              const targetX = targetCol * 64 + 32;
              const targetY = targetRow * 64 + 32;

              // Calculate movement duration based on the tile type weight
              const tileWeight = mapComp.getTileWeight(tileType);
              const baseSpeed = 180; // Player base walking speed in px/s
              const speed = baseSpeed / tileWeight;
              const duration = 64 / speed;

              // Update logical position immediately & start visual linear interpolation
              pos.startX = pos.renderX;
              pos.startY = pos.renderY;
              pos.x = targetX;
              pos.y = targetY;
              pos.moveTimer = 0;
              pos.moveDuration = duration;
            }
          }
        }
      }
      vel.vx = 0;
      vel.vy = 0;
    } else {
      // Set velocity for orientation animations based on visual direction
      const dx = pos.x - pos.startX;
      const dy = pos.y - pos.startY;
      vel.vx = dx > 0 ? 180 : (dx < 0 ? -180 : 0);
      vel.vy = dy > 0 ? 180 : (dy < 0 ? -180 : 0);
    }

    // 2. Rotate Placement with R key (one-shot detection)
    if (input.keys["r"] || input.keys["R"]) {
      if (!this.keyDebounce["r"]) {
        this.keyDebounce["r"] = true;
        // Cycle rotation clockwise: 0 -> 90 -> 180 -> 270 -> 0
        player.buildRotation = ((player.buildRotation + 90) % 360) as 0 | 90 | 180 | 270;
        toast.info(`Rotated placement preview: ${this.getRotationName(player.buildRotation)}`);
      }
    } else {
      this.keyDebounce["r"] = false;
    }

    // 3. Hotbar Selection via keys 1-9, 0, -, =, [, ]
    const tools: BuildTool[] = [
      "belt", "inserter", "drill", "furnace", "assembler", "chest", "pole", "generator",
      "road", "storage_house", "worker_house", "advanced_drill", "advanced_furnace", "fast_road"
    ];
    for (let i = 1; i <= 14; i++) {
      let keyStr = "";
      if (i <= 9) keyStr = i.toString();
      else if (i === 10) keyStr = "0";
      else if (i === 11) keyStr = "-";
      else if (i === 12) keyStr = "=";
      else if (i === 13) keyStr = "[";
      else if (i === 14) keyStr = "]";

      if (input.keys[keyStr]) {
        const selected = tools[i - 1];
        if (selected && player.activeTool !== selected) {
          player.activeTool = selected;
          this.activeTool = selected;
          toast.success(`Selected tool: ${selected.toUpperCase().replace("_", " ")}`);
        }
      }
    }

    // 4. Place / Deconstruct structure on mouse action
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const mapComp = world.getComponent(mapEntity, MapComponent)!;
    const ts = mapComp.tileSize;

    const col = Math.floor(input.mouseX / ts);
    const row = Math.floor(input.mouseY / ts);

    // Grid bounds check
    if (col >= 0 && col < mapComp.width && row >= 0 && row < mapComp.height) {
      const tileType = mapComp.tiles[row][col];

      // Query to check if grid slot is already occupied
      const structures = world.getEntitiesWith([StructureComponent]);
      const isOccupied = structures.some(ent => {
        const struct = world.getComponent(ent, StructureComponent)!;
        return struct.gridX === col && struct.gridY === row;
      });

      // 4a. Left Click: Build Structure / Inspect Worker Cottage
      if (input.mouseClicked && this.placementDebounceTimer <= 0) {
        const clickedHouse = structures.find(ent => {
          const struct = world.getComponent(ent, StructureComponent)!;
          return struct.gridX === col && struct.gridY === row && struct.type === "worker_house";
        });

        if (clickedHouse) {
          if ((window as any).refreshWorkerDialog) {
            (window as any).refreshWorkerDialog(clickedHouse, world);
            input.mouseClicked = false;
            this.placementDebounceTimer = 0.3; // 300ms debounce
            return;
          }
        }

        if (this.canBuild(player.activeTool, tileType, isOccupied)) {
          const tool = player.activeTool;
          const count = player.inventory[tool] || 0;

          if (count > 0 || tool === "belt") { // conveyor belt is free or costs 1 plate
            const costItem = this.getCostItem(tool);
            const costCount = this.getCostCount(tool);
            const hasMaterials = !costItem || (player.inventory[costItem] >= costCount);

            if (hasMaterials) {
              // Deduct resources
              if (costItem) {
                player.inventory[costItem] -= costCount;
              }
              
              // Place building
              const spawnX = col * ts + ts / 2;
              const spawnY = row * ts + ts / 2;
              let spawnedEntity = "";

              switch (tool) {
                case "belt":
                  spawnedEntity = spawnBelt(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "inserter":
                  spawnedEntity = spawnInserter(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "drill":
                  spawnedEntity = spawnDrill(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "furnace":
                  spawnedEntity = spawnFurnace(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "assembler":
                  spawnedEntity = spawnAssembler(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "chest":
                  spawnedEntity = spawnChest(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "pole":
                  spawnedEntity = spawnPowerPole(world, spawnX, spawnY, col, row);
                  break;
                case "generator":
                  spawnedEntity = spawnGenerator(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "road":
                  mapComp.updateTile(row, col, "road");
                  spawnedEntity = "road_placed";
                  break;
                case "storage_house":
                  spawnedEntity = spawnStorageHouse(world, spawnX, spawnY, col, row);
                  break;
                case "worker_house":
                  spawnedEntity = spawnWorkerHouse(world, spawnX, spawnY, col, row);
                  break;
                case "advanced_drill":
                  spawnedEntity = spawnAdvancedDrill(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "advanced_furnace":
                  spawnedEntity = spawnAdvancedFurnace(world, spawnX, spawnY, col, row, player.buildRotation);
                  break;
                case "fast_road":
                  mapComp.updateTile(row, col, "fast_road");
                  spawnedEntity = "fast_road_placed";
                  break;
              }

              if (spawnedEntity) {
                this.placementDebounceTimer = 0.15; // 150ms debounce
              }
            } else {
              toast.error(`Not enough materials to build ${tool}! Requires ${costCount}x ${costItem?.replace("_", " ")}`);
              this.placementDebounceTimer = 0.5; // lock warning toasts
            }
          }
        }
      }

      // 4b. Right Click: Deconstruct Structure / Road
      if (input.mouseRightClicked) {
        const occupiedStructureEntity = structures.find(ent => {
          const struct = world.getComponent(ent, StructureComponent)!;
          return struct.gridX === col && struct.gridY === row;
        });

        if (occupiedStructureEntity) {
          const struct = world.getComponent(occupiedStructureEntity, StructureComponent)!;
          const refundItem = this.getCostItem(struct.type);
          const refundCount = this.getCostCount(struct.type);

          // Refund construction cost
          if (refundItem) {
            player.inventory[refundItem] = (player.inventory[refundItem] || 0) + refundCount;
          }

          // Clean up internal inventory items if deconstructing chest or furnace
          for (const [itemKey, itemCount] of Object.entries(struct.inventory)) {
            player.inventory[itemKey] = (player.inventory[itemKey] || 0) + itemCount;
          }

          // Housing capacity constraint: if worker_house, destroy associated worker
          if (struct.type === "worker_house") {
            const workers = world.getEntitiesWith([WorkerComponent]);
            for (const workerEnt of workers) {
              const wComp = world.getComponent(workerEnt, WorkerComponent)!;
              if (wComp.houseEntityId === occupiedStructureEntity) {
                world.destroyEntity(workerEnt);
                toast.warning("Associated worker dismissed due to cottage demolition!");
              }
            }
          }

          world.destroyEntity(occupiedStructureEntity);
          toast.info(`Deconstructed ${struct.type.toUpperCase().replace("_", " ")}`);
          input.mouseRightClicked = false; // Reset trigger
        } else if (mapComp.tiles[row][col] === "road" || mapComp.tiles[row][col] === "fast_road") {
          const isFast = mapComp.tiles[row][col] === "fast_road";
          mapComp.updateTile(row, col, "grass");
          if (isFast) {
            player.inventory["iron_plate"] = (player.inventory["iron_plate"] || 0) + 2; // refund 2 iron plates
            toast.info("Deconstructed FAST ROAD");
          } else {
            player.inventory["road"] = (player.inventory["road"] || 0) + 1;
            toast.info("Deconstructed ROAD");
          }
          input.mouseRightClicked = false;
        }
      }
    }
  }

  private canBuild(tool: BuildTool, tileType: TileType, isOccupied: boolean): boolean {
    if (isOccupied) return false;

    // Road, storage house, and worker house can ONLY be placed on empty grass tiles
    if (tool === "road" || tool === "fast_road" || tool === "storage_house" || tool === "worker_house") {
      return tileType === "grass";
    }

    // General buildings cannot be placed on water, river, or stone
    if (tileType === "water" || tileType === "river" || tileType === "stone") {
      return false;
    }

    // Buildings cannot be placed on trees (forest), except drills which harvest them
    if (tileType === "forest") {
      return tool === "drill" || tool === "advanced_drill";
    }

    return true;
  }

  private getRotationName(rot: number): string {
    switch (rot) {
      case 0: return "NORTH (Up)";
      case 90: return "EAST (Right)";
      case 180: return "SOUTH (Down)";
      case 270: return "WEST (Left)";
      default: return "EAST";
    }
  }

  private getCostItem(tool: string): string | null {
    switch (tool) {
      case "belt": return "iron_plate";
      case "inserter": return "gear";
      case "drill": return "iron_plate";
      case "furnace": return "stone";
      case "assembler": return "electronic_circuit";
      case "chest": return "wood";
      case "pole": return "copper_wire";
      case "generator": return "gear";
      case "road": return "road";
      case "storage_house": return "storage_house";
      case "worker_house": return "worker_house";
      case "advanced_drill": return "iron_plate";
      case "advanced_furnace": return "iron_plate";
      case "fast_road": return "iron_plate";
      default: return null;
    }
  }

  private getCostCount(tool: string): number {
    switch (tool) {
      case "belt": return 1;
      case "inserter": return 2;
      case "drill": return 10;
      case "furnace": return 5;
      case "assembler": return 8;
      case "chest": return 6;
      case "pole": return 5;
      case "generator": return 12;
      case "road": return 1;
      case "storage_house": return 1;
      case "worker_house": return 1;
      case "advanced_drill": return 12;
      case "advanced_furnace": return 15;
      case "fast_road": return 2;
      default: return 0;
    }
  }
}
