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
import { spawnCrop, spawnParticle } from "../Spawner";
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

    // ==========================================
    // 1. CROP GROWTH SYSTEM
    // ==========================================
    for (const ent of structures) {
      const sc = world.getComponent(ent, StructureComponent)!;
      if (sc.type === "crop") {
        if (sc.cropGrowth < 1.0) {
          sc.cropGrowth += dt / 8.0; // Grows fully in 8 seconds
          if (sc.cropGrowth > 1.0) sc.cropGrowth = 1.0;

          // Grow particles
          if (Math.random() < 0.04) {
            const pos = world.getComponent(ent, PositionComponent)!;
            spawnParticle(world, pos.x + (Math.random() * 8 - 4), pos.y + (Math.random() * 8 - 4), "#2ecc71", 2.0);
          }
        }
      }
    }

    for (const entity of workerEntities) {
      const wComp = world.getComponent(entity, WorkerComponent)!;
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;

      // ==========================================
      // 2. HUNGER DECAY & STARVATION SYSTEM
      // ==========================================
      // Decays by 1.67 points per second (reaches 0 in 60s)
      wComp.hunger -= 1.67 * dt;
      if (wComp.hunger < 0) wComp.hunger = 0;

      // Critical hunger threshold check: if hunger < 25, seek food at Storage House
      if (wComp.hunger < 25 && wComp.state !== "moving_to_eat" && wComp.state !== "eating") {
        const storageHouses = structures.filter(st => {
          const sc = world.getComponent(st, StructureComponent)!;
          return sc.type === "storage_house";
        });

        if (storageHouses.length > 0) {
          // Store previous state to resume after eating
          wComp.previousState = wComp.state;
          wComp.state = "moving_to_eat";
          wComp.path = [];
          wComp.pathIndex = 0;
          vel.vx = 0;
          vel.vy = 0;
        }
      }

      // Starving state triggers at hunger = 0
      if (wComp.hunger <= 0) {
        wComp.isStarving = true;
      }

      if (wComp.isStarving) {
        vel.vx = 0;
        vel.vy = 0;

        // Verify if food exists in any Storage House
        const storageWithFood = structures.filter(st => {
          const sc = world.getComponent(st, StructureComponent)!;
          return sc.type === "storage_house" && (sc.inventory["food"] || 0) > 0;
        });

        if (storageWithFood.length === 0) {
          // Starving: Freeze completely
          continue;
        } else {
          // Food is available! Seek it
          if (wComp.state !== "moving_to_eat") {
            wComp.state = "moving_to_eat";
            wComp.path = [];
            wComp.pathIndex = 0;
          }
        }
      }

      // If no role assigned, worker remains idle
      if (wComp.role === null) {
        wComp.state = "idle";
        vel.vx = 0;
        vel.vy = 0;
        continue;
      }

      const col = Math.floor(pos.x / ts);
      const row = Math.floor(pos.y / ts);

      // ==========================================
      // 3. FSM STATE MACHINE ACTIONS
      // ==========================================
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

          // FARMER ROLE SPECIFIC SEEKING
          if (wComp.role === "farmer") {
            // Priority 1: Seek closest fully-grown crop
            const grownCrops = structures.filter(st => {
              const sc = world.getComponent(st, StructureComponent)!;
              return sc.type === "crop" && sc.cropGrowth >= 1.0;
            });

            let targetCropEntity: string | null = null;
            let minCropDist = Infinity;

            for (const cEnt of grownCrops) {
              const cStruct = world.getComponent(cEnt, StructureComponent)!;
              
              // Ensure no other worker is currently routing to harvest this crop
              const isTargeted = workerEntities.some(oEnt => {
                if (oEnt === entity) return false;
                const oc = world.getComponent(oEnt, WorkerComponent)!;
                if (oc.state === "moving" && oc.path && oc.path.length > 0) {
                  const endNode = oc.path[oc.path.length - 1];
                  return endNode[0] === cStruct.gridY && endNode[1] === cStruct.gridX;
                }
                return false;
              });

              if (!isTargeted) {
                const dist = Math.abs(cStruct.gridY - row) + Math.abs(cStruct.gridX - col);
                if (dist < minCropDist) {
                  minCropDist = dist;
                  targetCropEntity = cEnt;
                }
              }
            }

            if (targetCropEntity) {
              const sc = world.getComponent(targetCropEntity, StructureComponent)!;
              const path = map.findPath(row, col, sc.gridY, sc.gridX);
              if (path && path.length > 0) {
                wComp.path = path;
                wComp.pathIndex = 0;
                wComp.state = "moving";
                break;
              }
            }

            // Priority 2: Seek empty grass tile near their cottage to plant
            const cottage = structures.find(st => st === wComp.houseEntityId);
            if (cottage) {
              const houseStruct = world.getComponent(cottage, StructureComponent)!;
              const hX = houseStruct.gridX;
              const hY = houseStruct.gridY;

              let plantR = -1;
              let plantC = -1;
              let minPlantDist = Infinity;

              // Scan 6-tile radius
              for (let dr = -6; dr <= 6; dr++) {
                for (let dc = -6; dc <= 6; dc++) {
                  const r = hY + dr;
                  const c = hX + dc;

                  if (r >= 0 && r < map.height && c >= 0 && c < map.width) {
                    if (map.tiles[r][c] === "grass") {
                      // Check unoccupied
                      const occupied = structures.some(st => {
                        const sc = world.getComponent(st, StructureComponent)!;
                        return sc.gridX === c && sc.gridY === r;
                      });

                      if (!occupied) {
                        const dist = Math.abs(r - row) + Math.abs(c - col);
                        if (dist < minPlantDist) {
                          minPlantDist = dist;
                          plantR = r;
                          plantC = c;
                        }
                      }
                    }
                  }
                }
              }

              if (plantR !== -1 && plantC !== -1) {
                const path = map.findPath(row, col, plantR, plantC);
                if (path && path.length > 0) {
                  wComp.path = path;
                  wComp.pathIndex = 0;
                  wComp.state = "moving";
                } else {
                  wComp.state = "idle";
                }
              } else {
                wComp.state = "idle";
              }
            } else {
              wComp.state = "idle";
            }
          } else {
            // WOODCUTTER & MINER SEEKING
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
                }

                if (isMatch) {
                  const isOccupied = structures.some(st => {
                    const sc = world.getComponent(st, StructureComponent)!;
                    return sc.gridX === c && sc.gridY === r;
                  });
                  if (isOccupied) continue;

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
              const path = map.findPath(row, col, targetRow, targetCol);
              if (path && path.length > 0) {
                wComp.path = path;
                wComp.pathIndex = 0;
                wComp.state = "moving";
              } else {
                wComp.state = "idle";
              }
            } else {
              wComp.state = "idle";
            }
          }
          break;
        }

        case "moving_to_eat": {
          if (wComp.path.length === 0) {
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
              } else {
                this.eatFood(world, entity, wComp, structures);
                break;
              }
            } else {
              wComp.state = "idle";
              break;
            }
          }

          // Traverse path to eat
          if (wComp.pathIndex >= wComp.path.length) {
            vel.vx = 0;
            vel.vy = 0;
            wComp.path = [];
            wComp.pathIndex = 0;
            this.eatFood(world, entity, wComp, structures);
          } else {
            const targetNode = wComp.path[wComp.pathIndex];
            const targetX = targetNode[1] * ts + ts / 2;
            const targetY = targetNode[0] * ts + ts / 2;

            const dx = targetX - pos.x;
            const dy = targetY - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
              wComp.pathIndex++;
            } else {
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
          }
          break;
        }

        case "moving": {
          if (wComp.pathIndex >= wComp.path.length) {
            vel.vx = 0;
            vel.vy = 0;

            if (wComp.heldItem !== null) {
              // Reached storage house -> Deposit item
              this.depositItem(world, entity, wComp, structures, playerEnt);
            } else {
              // Reached resource tile
              const targetNode = wComp.path[wComp.path.length - 1];
              const targetCrop = structures.find(st => {
                const sc = world.getComponent(st, StructureComponent)!;
                return sc.type === "crop" && sc.gridX === targetNode[1] && sc.gridY === targetNode[0];
              });

              if (wComp.role === "farmer") {
                if (targetCrop) {
                  wComp.timer = 2.0; // 2 seconds to harvest
                } else {
                  wComp.timer = 1.0; // 1 second to plant
                }
              } else {
                wComp.timer = 2.0; // Woodcutter/Miner work cycle
              }
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
            wComp.pathIndex++;
          } else {
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

          if (Math.random() < 0.2) {
            let pColor = "#bdc3c7";
            if (wComp.role === "woodcutter") pColor = "#8a5a3b";
            else if (wComp.role === "miner") pColor = "#f1c40f";
            else if (wComp.role === "farmer") pColor = "#2ecc71";
            spawnParticle(world, pos.x, pos.y, pColor, 2.5);
          }

          if (wComp.timer <= 0) {
            // Find if crop exists at current tile
            const currentCrop = structures.find(st => {
              const sc = world.getComponent(st, StructureComponent)!;
              return sc.type === "crop" && sc.gridX === col && sc.gridY === row;
            });

            if (wComp.role === "farmer") {
              if (currentCrop) {
                // Harvesting crop: get food, destroy crop entity
                wComp.heldItem = "food";
                world.destroyEntity(currentCrop);
                wComp.state = "returning";
              } else {
                // Planting crop: spawn crop entity, return to seeking
                const spawnX = col * ts + ts / 2;
                const spawnY = row * ts + ts / 2;
                spawnCrop(world, spawnX, spawnY, col, row);
                wComp.state = "seeking";
                
                toast.success("Planted wheat crop!");
              }
            } else {
              // Miner & Woodcutter
              const tile = map.tiles[row]?.[col] || "grass";

              if (wComp.role === "woodcutter") {
                wComp.heldItem = "wood";
              } else if (wComp.role === "miner") {
                if (tile === "iron") wComp.heldItem = "iron_ore";
                else if (tile === "copper") wComp.heldItem = "copper_ore";
                else if (tile === "coal") wComp.heldItem = "coal";
                else wComp.heldItem = "stone";
              }
              wComp.state = "returning";
            }
          }
          break;
        }

        case "returning": {
          vel.vx = 0;
          vel.vy = 0;

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
              this.depositItem(world, entity, wComp, structures, playerEnt);
            }
          } else {
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
    }

    if (playerEnt) {
      const pComp = world.getComponent(playerEnt, PlayerComponent)!;
      pComp.inventory[item] = (pComp.inventory[item] || 0) + 1;
      
      for (let i = 0; i < 3; i++) {
        spawnParticle(world, pos.x, pos.y, "#2ecc71", 2.5);
      }
    }

    wComp.heldItem = null;
    wComp.state = "seeking";
  }

  private eatFood(world: World, workerEntity: string, wComp: WorkerComponent, structures: string[]): void {
    const pos = world.getComponent(workerEntity, PositionComponent)!;
    const col = Math.floor(pos.x / 64);
    const row = Math.floor(pos.y / 64);

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
      const foodCount = sc.inventory["food"] || 0;

      if (foodCount > 0) {
        sc.inventory["food"]--;
        
        const playerEnt = world.getEntitiesWith([PlayerComponent])[0];
        if (playerEnt) {
          const player = world.getComponent(playerEnt, PlayerComponent)!;
          if (player.inventory["food"] > 0) {
            player.inventory["food"]--;
          }
        }

        wComp.hunger = 100;
        wComp.isStarving = false;
        
        wComp.state = wComp.previousState || "seeking";
        wComp.previousState = null;
        wComp.path = [];
        wComp.pathIndex = 0;
        
        toast.success("Worker consumed food and returned to work!");

        for (let i = 0; i < 4; i++) {
          spawnParticle(world, pos.x, pos.y, "#e74c3c", 2.5);
        }
      } else {
        wComp.hunger = 0;
        wComp.isStarving = true;
        wComp.state = "moving_to_eat";
        wComp.path = [];
        wComp.pathIndex = 0;
      }
    } else {
      wComp.hunger = 0;
      wComp.isStarving = true;
      wComp.state = "moving_to_eat";
      wComp.path = [];
      wComp.pathIndex = 0;
    }
  }
}
