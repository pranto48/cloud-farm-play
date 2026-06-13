import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  WorkerComponent,
  MapComponent,
  StructureComponent,
  PlayerComponent,
  ItemType,
} from "../components/GameComponents";
import { spawnParticle } from "../Spawner";
import { toast } from "../utils/Toast";

export class WorkerSystem extends System {
  readonly requiredComponents = [WorkerComponent, PositionComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const map = world.getComponent(mapEntity, MapComponent)!;
    const ts = map.tileSize;

    const workerEntities = world.getEntitiesWith(this.requiredComponents);
    const structures = world.getEntitiesWith([StructureComponent, PositionComponent]);
    const playerEntities = world.getEntitiesWith([PlayerComponent]);
    const playerEnt = playerEntities.length > 0 ? playerEntities[0] : null;

    for (const entity of workerEntities) {
      const wComp = world.getComponent(entity, WorkerComponent)!;
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;

      // If no role assigned, worker remains idle
      if (wComp.role === null) {
        wComp.state = "idle";
        vel.vx = 0;
        vel.vy = 0;
        continue;
      }

      const col = Math.floor(pos.x / ts);
      const row = Math.floor(pos.y / ts);

      switch (wComp.state) {
        case "idle": {
          vel.vx = 0;
          vel.vy = 0;
          wComp.state = "seeking";
          break;
        }

        case "seeking": {
          vel.vx = 0;
          vel.vy = 0;

          // 1. Locate closest unoccupied resource matching role
          let targetRow = -1;
          let targetCol = -1;
          let minDist = Infinity;

          for (let r = 0; r < map.height; r++) {
            for (let c = 0; c < map.width; c++) {
              const tile = map.tiles[r][c];
              let isMatch = false;

              if (wComp.role === "woodcutter") {
                isMatch = tile === "forest";
              } else if (wComp.role === "miner") {
                isMatch = tile === "iron" || tile === "copper" || tile === "coal";
              } else if (wComp.role === "farmer") {
                isMatch = tile === "grass";
              }

              if (isMatch) {
                // Ensure no structure is built on top of this resource slot
                const isOccupied = structures.some(st => {
                  const sc = world.getComponent(st, StructureComponent)!;
                  return sc.gridX === c && sc.gridY === r;
                });
                if (isOccupied) continue;

                // Manhattan distance from worker to resource cell
                const dist = Math.abs(r - row) + Math.abs(c - col);
                if (dist < minDist) {
                  minDist = dist;
                  targetRow = r;
                  targetCol = c;
                }
              }
            }
          }

          if (targetRow !== -1 && targetCol !== -1) {
            // 2. Compute path using A*
            const path = map.findPath(row, col, targetRow, targetCol);
            if (path && path.length > 0) {
              wComp.path = path;
              wComp.pathIndex = 0;
              wComp.state = "moving";
            } else {
              // Path blocked (e.g. islands/rocks), stay idle
              wComp.state = "idle";
            }
          } else {
            // No resources found matching role, remain idle
            wComp.state = "idle";
          }
          break;
        }

        case "moving": {
          if (wComp.pathIndex >= wComp.path.length) {
            vel.vx = 0;
            vel.vy = 0;
            if (wComp.heldItem !== null) {
              // We reached the storage house -> Deposit item
              this.depositItem(world, entity, wComp, structures, playerEnt);
            } else {
              // We reached the resource -> start working
              wComp.timer = 2.0; // 2 seconds work cycle
              wComp.state = "working";
            }
            break;
          }

          const targetNode = wComp.path[wComp.pathIndex];
          const targetX = targetNode[1] * ts + ts / 2;
          const targetY = targetNode[0] * ts + ts / 2;

          const dx = targetX - pos.x;
          const dy = targetY - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 5) {
            // Advance to next path cell
            wComp.pathIndex++;
          } else {
            // Move towards node. Speed is doubled on roads (weight = 0.5)
            const currentCellWeight = map.weights[row]?.[col] || 1.0;
            const baseSpeed = 100;
            const currentSpeed = baseSpeed / currentCellWeight;

            const dirX = dx / dist;
            const dirY = dy / dist;

            vel.vx = dirX * currentSpeed;
            vel.vy = dirY * currentSpeed;

            pos.x += vel.vx * dt;
            pos.y += vel.vy * dt;
          }
          break;
        }

        case "working": {
          vel.vx = 0;
          vel.vy = 0;
          wComp.timer -= dt;

          // Emit visual work particles
          if (Math.random() < 0.2) {
            let pColor = "#bdc3c7";
            if (wComp.role === "woodcutter") pColor = "#8a5a3b"; // wood dust
            else if (wComp.role === "miner") pColor = "#f1c40f";   // sparks
            else if (wComp.role === "farmer") pColor = "#2ecc71";  // grass leaves

            spawnParticle(world, pos.x, pos.y, pColor, 2.5);
          }

          if (wComp.timer <= 0) {
            // Finished working! Determine resource gathered
            const tile = map.tiles[row]?.[col] || "grass";

            if (wComp.role === "woodcutter") {
              wComp.heldItem = "wood";
            } else if (wComp.role === "miner") {
              if (tile === "iron") wComp.heldItem = "iron_ore";
              else if (tile === "copper") wComp.heldItem = "copper_ore";
              else if (tile === "coal") wComp.heldItem = "coal";
              else wComp.heldItem = "stone";
            } else if (wComp.role === "farmer") {
              wComp.heldItem = "wheat";
            }

            // Move to returning state
            wComp.state = "returning";
          }
          break;
        }

        case "returning": {
          vel.vx = 0;
          vel.vy = 0;

          // Find closest storage house to deliver resource
          const storageHouses = structures.filter(st => {
            const sc = world.getComponent(st, StructureComponent)!;
            return sc.type === "storage_house";
          });

          if (storageHouses.length > 0) {
            let nearestHouse = "";
            let minHouseDist = Infinity;

            for (const h of storageHouses) {
              const hPos = world.getComponent(h, PositionComponent)!;
              const hDist = Math.abs(hPos.x - pos.x) + Math.abs(hPos.y - pos.y);
              if (hDist < minHouseDist) {
                minHouseDist = hDist;
                nearestHouse = h;
              }
            }

            const houseStruct = world.getComponent(nearestHouse, StructureComponent)!;
            const path = map.findPath(row, col, houseStruct.gridY, houseStruct.gridX);

            if (path && path.length > 0) {
              wComp.path = path;
              wComp.pathIndex = 0;
              wComp.state = "moving";
            } else {
              // Path blocked (e.g. road or path closed), fallback to instant deposit
              this.depositItem(world, entity, wComp, structures, playerEnt);
            }
          } else {
            // Fallback: If no Storage House exists, deposit directly into player inventory
            this.depositItem(world, entity, wComp, structures, playerEnt);
          }
          break;
        }
      }
    }
  }

  private depositItem(
    world: World,
    workerEntity: string,
    wComp: WorkerComponent,
    structures: string[],
    playerEnt: string | null
  ): void {
    const item = wComp.heldItem;
    if (!item) {
      wComp.state = "seeking";
      return;
    }

    const pos = world.getComponent(workerEntity, PositionComponent)!;
    const col = Math.floor(pos.x / 64);
    const row = Math.floor(pos.y / 64);

    // Find nearest storage house to update its inventory
    const storageHouses = structures.filter(st => {
      const sc = world.getComponent(st, StructureComponent)!;
      return sc.type === "storage_house";
    });

    let targetHouse: string | null = null;
    let minHouseDist = Infinity;

    for (const h of storageHouses) {
      const hStruct = world.getComponent(h, StructureComponent)!;
      const dist = Math.abs(hStruct.gridY - row) + Math.abs(hStruct.gridX - col);
      if (dist < minHouseDist) {
        minHouseDist = dist;
        targetHouse = h;
      }
    }

    if (targetHouse) {
      const sc = world.getComponent(targetHouse, StructureComponent)!;
      sc.inventory[item] = (sc.inventory[item] || 0) + 1;
      console.log(`[Storage] Deposited 1x ${item} into Storage House at (${sc.gridX}, ${sc.gridY})`);
    }

    // Sync directly to player inventory as well for building/automation use
    if (playerEnt) {
      const pComp = world.getComponent(playerEnt, PlayerComponent)!;
      pComp.inventory[item] = (pComp.inventory[item] || 0) + 1;
      
      // Spawn success floating sparks
      for (let i = 0; i < 3; i++) {
        spawnParticle(world, pos.x, pos.y, "#2ecc71", 2.5);
      }
    }

    wComp.heldItem = null;
    wComp.state = "seeking"; // loop back to seeking a new job
  }
}
