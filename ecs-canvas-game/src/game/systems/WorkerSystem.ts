import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  WorkerComponent,
  MapComponent,
  StructureComponent,
  PlayerComponent,
  type ItemType,
} from "../components/GameComponents";
import { spawnCrop, spawnParticle, spawnResourceBurst } from "../Spawner";
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
          // Crops only grow if they have been watered
          if (sc.isWatered) {
            sc.cropGrowth += dt / 8.0; // Grows fully in 8 seconds
          }
          if (sc.cropGrowth > 1.0) sc.cropGrowth = 1.0;

          // Grow particles
          if (sc.isWatered && Math.random() < 0.04) {
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
      // 2. HUNGER & ENERGY DECAY SYSTEMS
      // ==========================================
      // Hunger decays by 1.67 points per second (reaches 0 in 60s)
      wComp.hunger -= 1.67 * dt;
      if (wComp.hunger < 0) wComp.hunger = 0;

      // Energy decays by 0.83 points per second (reaches 0 in 120s)
      wComp.energy -= 0.83 * dt;
      if (wComp.energy < 0) wComp.energy = 0;

      // Starving state triggers at hunger = 0
      if (wComp.hunger <= 0) {
        wComp.isStarving = true;
        wComp.state = "starving";
        vel.vx = 0;
        vel.vy = 0;
      }

      // Check for hunger interrupts
      if (wComp.hunger < 25 && wComp.state !== "eating" && wComp.state !== "starving") {
        const storageHouses = structures.filter(st => {
          const sc = world.getComponent(st, StructureComponent)!;
          return sc.type === "storage_house";
        });

        if (storageHouses.length > 0) {
          wComp.previousState = wComp.state as any;
          wComp.state = "eating";
          wComp.path = [];
          wComp.pathIndex = 0;
          vel.vx = 0;
          vel.vy = 0;
        }
      }

      // Check for energy/sleep interrupts
      if (wComp.energy < 15 && wComp.state !== "eating" && wComp.state !== "starving" && wComp.state !== "sleeping") {
        wComp.previousState = wComp.state as any;
        wComp.state = "sleeping";
        wComp.path = [];
        wComp.pathIndex = 0;
        vel.vx = 0;
        vel.vy = 0;
      }

      // Starving state behaviors
      if (wComp.state === "starving") {
        vel.vx = 0;
        vel.vy = 0;

        // Verify if food is available in any Storage House
        const storageWithFood = structures.filter(st => {
          const sc = world.getComponent(st, StructureComponent)!;
          return sc.type === "storage_house" && ((sc.inventory["food"] || 0) > 0 || (sc.inventory["fish"] || 0) > 0);
        });

        if (storageWithFood.length > 0) {
          // Food is available! Seek it
          wComp.isStarving = false;
          wComp.state = "eating";
          wComp.path = [];
          wComp.pathIndex = 0;
        } else {
          // Starving: Freeze completely
          continue;
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
          // Seek and move to target if path is empty
          if (wComp.path.length === 0) {
            vel.vx = 0;
            vel.vy = 0;

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
                const dist = Math.abs(cStruct.gridY - row) + Math.abs(cStruct.gridX - col);
                if (dist < minCropDist) {
                  minCropDist = dist;
                  targetCropEntity = cEnt;
                }
              }

              if (targetCropEntity) {
                const sc = world.getComponent(targetCropEntity, StructureComponent)!;
                wComp.path = [[sc.gridY, sc.gridX]];
                wComp.pathIndex = 0;
                break;
              }

              // Priority 2: Seek closest unwatered crop
              const dryCrops = structures.filter(st => {
                const sc = world.getComponent(st, StructureComponent)!;
                return sc.type === "crop" && sc.cropGrowth < 1.0 && !sc.isWatered;
              });

              let targetDryEntity: string | null = null;
              let minDryDist = Infinity;

              for (const dEnt of dryCrops) {
                const dStruct = world.getComponent(dEnt, StructureComponent)!;
                const dist = Math.abs(dStruct.gridY - row) + Math.abs(dStruct.gridX - col);
                if (dist < minDryDist) {
                  minDryDist = dist;
                  targetDryEntity = dEnt;
                }
              }

              if (targetDryEntity) {
                const sc = world.getComponent(targetDryEntity, StructureComponent)!;
                wComp.path = [[sc.gridY, sc.gridX]];
                wComp.pathIndex = 0;
                break;
              }

              // Priority 3: Seek empty grass tile near cottage to plant seeds
              const cottage = structures.find(st => st === wComp.houseEntityId);
              if (cottage) {
                const houseStruct = world.getComponent(cottage, StructureComponent)!;
                const hX = houseStruct.gridX;
                const hY = houseStruct.gridY;

                let plantR = -1;
                let plantC = -1;
                let minPlantDist = Infinity;

                for (let dr = -6; dr <= 6; dr++) {
                  for (let dc = -6; dc <= 6; dc++) {
                    const r = hY + dr;
                    const c = hX + dc;

                    if (r >= 0 && r < map.height && c >= 0 && c < map.width) {
                      if (map.tiles[r][c] === "grass") {
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
                  wComp.path = [[plantR, plantC]];
                  wComp.pathIndex = 0;
                } else {
                  wComp.state = "idle";
                }
              } else {
                wComp.state = "idle";
              }
            } else if (wComp.role === "miner") {
              // Seeks nearest mining resource tile: iron, copper, coal, or stone
              let targetRow = -1;
              let targetCol = -1;
              let minDist = Infinity;

              for (let r = 0; r < map.height; r++) {
                for (let c = 0; c < map.width; c++) {
                  const tile = map.tiles[r][c];
                  const isMatch = tile === "iron" || tile === "copper" || tile === "coal" || tile === "stone" || tile === "silver" || tile === "aluminum" || tile === "gold";

                  if (isMatch) {
                    const isOccupied = structures.some(st => {
                      const sc = world.getComponent(st, StructureComponent)!;
                      return sc.gridX === c && sc.gridY === r && sc.type !== "crop";
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
                wComp.path = [[targetRow, targetCol]];
                wComp.pathIndex = 0;
              } else {
                wComp.state = "idle";
              }
            } else if (wComp.role === "fisher") {
              // Seeks nearest water tile to fish
              let targetRow = -1;
              let targetCol = -1;
              let minDist = Infinity;

              for (let r = 0; r < map.height; r++) {
                for (let c = 0; c < map.width; c++) {
                  if (map.tiles[r][c] === "water" || map.tiles[r][c] === "river") {
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
                wComp.path = [[targetRow, targetCol]];
                wComp.pathIndex = 0;
              } else {
                wComp.state = "idle";
              }
            } else if (wComp.role === "woodcutter") {
              // Woodcutter fallback
              let targetRow = -1;
              let targetCol = -1;
              let minDist = Infinity;

              for (let r = 0; r < map.height; r++) {
                for (let c = 0; c < map.width; c++) {
                  if (map.tiles[r][c] === "forest") {
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
                wComp.path = [[targetRow, targetCol]];
                wComp.pathIndex = 0;
              } else {
                wComp.state = "idle";
              }
            }
          }

          // Fly along aerial trajectory
          if (wComp.path.length > 0) {
            this.flyPath(world, pos, vel, wComp, map, ts, dt, () => {
              vel.vx = 0;
              vel.vy = 0;
              wComp.path = [];
              wComp.pathIndex = 0;

              const finalCol = Math.floor(pos.x / ts);
              const finalRow = Math.floor(pos.y / ts);
              
              if (wComp.role === "farmer") {
                const crop = structures.find(st => {
                  const sc = world.getComponent(st, StructureComponent)!;
                  return sc.type === "crop" && Math.abs(sc.gridX - finalCol) <= 1 && Math.abs(sc.gridY - finalRow) <= 1;
                });
                
                if (crop) {
                  const sc = world.getComponent(crop, StructureComponent)!;
                  if (sc.cropGrowth >= 1.0) {
                    wComp.timer = 1.5; // 1.5s harvest scan
                  } else if (!sc.isWatered) {
                    wComp.timer = 1.0; // 1s watering laser
                  }
                } else {
                  wComp.timer = 1.0; // 1s plant
                }
              } else if (wComp.role === "miner") {
                wComp.timer = 1.5; // 1.5s mining laser
              } else if (wComp.role === "fisher") {
                wComp.timer = 1.5; // 1.5s fish beam
              } else if (wComp.role === "woodcutter") {
                wComp.timer = 1.5;
              }
              wComp.state = "working";
            });
          }
          break;
        }

        case "working": {
          vel.vx = 0;
          vel.vy = 0;
          wComp.timer -= dt;

          if (Math.random() < 0.25) {
            let pColor = "#bdc3c7";
            if (wComp.role === "woodcutter") pColor = "#8a5a3b";
            else if (wComp.role === "miner") pColor = "#f1c40f";
            else if (wComp.role === "farmer") pColor = "#2ecc71";
            else if (wComp.role === "fisher") pColor = "#3498db";
            spawnParticle(world, pos.x, pos.y, pColor, 2.5);
          }

          if (wComp.timer <= 0) {
            const finalCol = Math.floor(pos.x / ts);
            const finalRow = Math.floor(pos.y / ts);

            if (wComp.role === "farmer") {
              const crop = structures.find(st => {
                const sc = world.getComponent(st, StructureComponent)!;
                return sc.type === "crop" && Math.abs(sc.gridX - finalCol) <= 1 && Math.abs(sc.gridY - finalRow) <= 1;
              });

              if (crop) {
                const sc = world.getComponent(crop, StructureComponent)!;
                if (sc.cropGrowth >= 1.0) {
                  // Harvest wheat -> yield food
                  wComp.heldItem = "food";
                  world.destroyEntity(crop);
                  wComp.state = "returning";
                } else if (!sc.isWatered) {
                  // Water the crop
                  sc.isWatered = true;
                  toast.success("Farmer watered the crop!");
                  wComp.state = "seeking";
                } else {
                  wComp.state = "seeking";
                }
              } else {
                // Plant crop at current cell if grass
                let plantR = finalRow;
                let plantC = finalCol;
                if (map.tiles[plantR]?.[plantC] !== "grass") {
                  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                  for (const [dr, dc] of dirs) {
                    const nr = finalRow + dr;
                    const nc = finalCol + dc;
                    if (map.tiles[nr]?.[nc] === "grass") {
                      const occupied = structures.some(st => {
                        const sc = world.getComponent(st, StructureComponent)!;
                        return sc.gridX === nc && sc.gridY === nr;
                      });
                      if (!occupied) {
                        plantR = nr;
                        plantC = nc;
                        break;
                      }
                    }
                  }
                }

                if (map.tiles[plantR]?.[plantC] === "grass") {
                  const spawnX = plantC * ts + ts / 2;
                  const spawnY = plantR * ts + ts / 2;
                  spawnCrop(world, spawnX, spawnY, plantC, plantR);
                  toast.success("Farmer planted seeds!");
                }
                wComp.state = "seeking";
              }
            } else if (wComp.role === "miner") {
              // Check adjacent tiles for resources
              let minedType: ItemType = "stone";
              let resourceTile: "iron" | "copper" | "coal" | "stone" = "stone";
              const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
              for (const [dr, dc] of dirs) {
                const nr = finalRow + dr;
                const nc = finalCol + dc;
                const tile = map.tiles[nr]?.[nc];
                if (tile === "iron") { minedType = "iron_ore"; resourceTile = "iron"; break; }
                if (tile === "copper") { minedType = "copper_ore"; resourceTile = "copper"; break; }
                if (tile === "coal") { minedType = "coal"; resourceTile = "coal"; break; }
                if (tile === "silver") { minedType = "silver_ore"; resourceTile = "iron"; break; }
                if (tile === "aluminum") { minedType = "aluminum_ore"; resourceTile = "iron"; break; }
                if (tile === "gold") { minedType = "gold_ore"; resourceTile = "copper"; break; }
                if (tile === "stone") { minedType = "stone"; resourceTile = "stone"; break; }
              }
              wComp.heldItem = minedType;
              spawnResourceBurst(world, pos.x, pos.y, resourceTile, 8);
              wComp.state = "returning";
            } else if (wComp.role === "fisher") {
              // Catch fish adjacent to water
              let caught = false;
              const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
              for (const [dr, dc] of dirs) {
                const nr = finalRow + dr;
                const nc = finalCol + dc;
                if (map.tiles[nr]?.[nc] === "water" || map.tiles[nr]?.[nc] === "river") {
                  caught = true;
                  break;
                }
              }
              if (caught) {
                wComp.heldItem = "fish";
              }
              wComp.state = "returning";
            } else if (wComp.role === "woodcutter") {
              wComp.heldItem = "wood";
              spawnResourceBurst(world, pos.x, pos.y, "wood", 8);
              wComp.state = "returning";
            }
          }
          break;
        }

        case "returning": {
          if (wComp.path.length === 0) {
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
              } else {
                this.depositItem(world, entity, wComp, structures, playerEnt);
              }
            } else {
              this.depositItem(world, entity, wComp, structures, playerEnt);
            }
          }

          if (wComp.path.length > 0) {
            this.flyPath(world, pos, vel, wComp, map, ts, dt, () => {
              vel.vx = 0;
              vel.vy = 0;
              wComp.path = [];
              wComp.pathIndex = 0;
              this.depositItem(world, entity, wComp, structures, playerEnt);
            });
          }
          break;
        }

        case "eating": {
          if (wComp.path.length === 0) {
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
              const path = [[houseStruct.gridY, houseStruct.gridX]] as [number, number][];

              if (path && path.length > 0) {
                wComp.path = path;
                wComp.pathIndex = 0;
              } else {
                this.eatFood(world, entity, wComp, structures);
              }
            } else {
              wComp.state = "idle";
            }
          }

          if (wComp.path.length > 0) {
            this.flyPath(world, pos, vel, wComp, map, ts, dt, () => {
              vel.vx = 0;
              vel.vy = 0;
              wComp.path = [];
              wComp.pathIndex = 0;
              this.eatFood(world, entity, wComp, structures);
            });
          }
          break;
        }

        case "sleeping": {
          if (wComp.path.length === 0 && wComp.timer <= 0) {
            vel.vx = 0;
            vel.vy = 0;

            const cottage = structures.find(st => st === wComp.houseEntityId);
            if (cottage) {
              const houseStruct = world.getComponent(cottage, StructureComponent)!;
              const path = [[houseStruct.gridY, houseStruct.gridX]] as [number, number][];

              if (path && path.length > 0) {
                wComp.path = path;
                wComp.pathIndex = 0;
              } else {
                wComp.timer = 5.0; // sleep for 5 seconds
              }
            } else {
              wComp.state = "idle";
            }
          }

          if (wComp.path.length > 0) {
            this.flyPath(world, pos, vel, wComp, map, ts, dt, () => {
              vel.vx = 0;
              vel.vy = 0;
              wComp.path = [];
              wComp.pathIndex = 0;
              wComp.timer = 5.0;
            });
          }

          // At cottage sleeping
          if (wComp.path.length === 0 && wComp.timer > 0) {
            wComp.timer -= dt;
            wComp.energy += 20 * dt; // fully restores in 5s
            
            if (Math.random() < 0.15) {
              spawnParticle(world, pos.x, pos.y, "#9b59b6", 2.0); // purple sleep Zzzs
            }

            if (wComp.energy >= 100 || wComp.timer <= 0) {
              wComp.energy = 100;
              wComp.timer = 0;
              wComp.state = wComp.previousState || "seeking";
              wComp.previousState = null;
              toast.success("Worker woke up refreshed!");
            }
          }
          break;
        }
      }
    }
  }

  private flyPath(
    world: World,
    pos: PositionComponent,
    vel: VelocityComponent,
    wComp: WorkerComponent,
    _map: MapComponent,
    ts: number,
    dt: number,
    onReach: () => void
  ): void {
    if (wComp.pathIndex >= wComp.path.length) {
      vel.vx = 0;
      vel.vy = 0;
      onReach();
      return;
    }

    const targetNode = wComp.path[wComp.pathIndex];
    const targetX = targetNode[1] * ts + ts / 2;
    const targetY = targetNode[0] * ts + ts / 2;

    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const flightSpeed = 220; // High speed aerial drone flight velocity

    if (dist <= 8) {
      pos.x = targetX;
      pos.y = targetY;
      pos.renderX = targetX;
      pos.renderY = targetY;
      vel.vx = 0;
      vel.vy = 0;
      wComp.pathIndex++;
      if (wComp.pathIndex >= wComp.path.length) {
        onReach();
      }
      return;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;

    vel.vx = dirX * flightSpeed;
    vel.vy = dirY * flightSpeed;

    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
    pos.renderX = pos.x;
    pos.renderY = pos.y;

    // Thruster spark / ion particle trail behind flying drone
    if (Math.random() < 0.4) {
      spawnParticle(world, pos.x - dirX * 10, pos.y - dirY * 10 - 14, wComp.ledColor || "#00f3ff", 1.2);
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

    // Fish caught is deposited as food to sustain workers
    const depositedItem: ItemType = (item === "fish") ? "food" : item;

    if (targetHouse) {
      const sc = world.getComponent(targetHouse, StructureComponent)!;
      sc.inventory[depositedItem] = (sc.inventory[depositedItem] || 0) + 1;
      toast.success(`Drone stored ${depositedItem.replace("_", " ")} in Storage Box!`);
    }

    if (playerEnt) {
      const pComp = world.getComponent(playerEnt, PlayerComponent)!;
      pComp.inventory[depositedItem] = (pComp.inventory[depositedItem] || 0) + 1;
      
      for (let i = 0; i < 3; i++) {
        spawnParticle(world, pos.x, pos.y, "#00f3ff", 2.5);
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
      const fishCount = sc.inventory["fish"] || 0;

      if (foodCount > 0 || fishCount > 0) {
        if (foodCount > 0) {
          sc.inventory["food"]--;
        } else {
          sc.inventory["fish"]--;
        }
        
        const playerEnt = world.getEntitiesWith([PlayerComponent])[0];
        if (playerEnt) {
          const player = world.getComponent(playerEnt, PlayerComponent)!;
          if (foodCount > 0) {
            if (player.inventory["food"] > 0) player.inventory["food"]--;
          } else {
            if (player.inventory["fish"] > 0) player.inventory["fish"]--;
          }
        }

        wComp.hunger = 100;
        wComp.isStarving = false;
        
        wComp.state = wComp.previousState || "seeking";
        wComp.previousState = null;
        wComp.path = [];
        wComp.pathIndex = 0;
        
        toast.success("Logistics Drone recharged battery!");

        for (let i = 0; i < 4; i++) {
          spawnParticle(world, pos.x, pos.y, "#e74c3c", 2.5);
        }
      } else {
        wComp.hunger = 0;
        wComp.isStarving = true;
        wComp.state = "starving";
        wComp.path = [];
        wComp.pathIndex = 0;
      }
    } else {
      wComp.hunger = 0;
      wComp.isStarving = true;
      wComp.state = "starving";
      wComp.path = [];
      wComp.pathIndex = 0;
    }
  }
}
