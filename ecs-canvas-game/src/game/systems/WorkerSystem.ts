import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  WorkerComponent,
  MapComponent,
  StorageComponent,
  HungerComponent,
  CropComponent,
} from "../components/GameComponents";
import { findPath } from "../utils/AStar";
import { spawnGem, spawnParticle, spawnCrop } from "../Spawner";

export class WorkerSystem extends System {
  readonly requiredComponents = [PositionComponent, VelocityComponent, WorkerComponent, HungerComponent];

  update(world: World, dt: number): void {
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const mapComp = world.getComponent(mapEntity, MapComponent)!;
    const ts = mapComp.tileSize;

    const storages = world.getEntitiesWith([StorageComponent, PositionComponent]);
    let storageEntity: string | null = null;
    let storageComp: StorageComponent | null = null;
    let storagePos: PositionComponent | null = null;

    if (storages.length > 0) {
      storageEntity = storages[0];
      storageComp = world.getComponent(storageEntity, StorageComponent)!;
      storagePos = world.getComponent(storageEntity, PositionComponent)!;
    }

    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;
      const worker = world.getComponent(entity, WorkerComponent)!;
      const hunger = world.getComponent(entity, HungerComponent)!;

      if (worker.state !== "Starving" && worker.state !== "Seeking Storage") {
        hunger.hungerTimer += dt;
        if (hunger.hungerTimer >= 60.0) {
          hunger.isHungry = true;
        }
      }

      if (hunger.isHungry && worker.state !== "Seeking Storage" && worker.state !== "Starving") {
        worker.savedRoleState = worker.state;
        worker.state = "Seeking Storage";
        worker.searchCooldown = 0;
        worker.path = [];
      }

      if (worker.searchCooldown > 0) {
        worker.searchCooldown -= dt;
      }

      switch (worker.state) {
        case "Idle": {
          vel.vx = 0;
          vel.vy = 0;

          if (worker.searchCooldown <= 0) {
            worker.state = "Seeking Path";
          }
          break;
        }

        case "Seeking Path": {
          vel.vx = 0;
          vel.vy = 0;

          const startCol = Math.floor(pos.x / ts);
          const startRow = Math.floor(pos.y / ts);

          if (worker.role === "Woodcutter") {
            const forestTiles: { r: number; c: number; dist: number }[] = [];
            for (let r = 0; r < mapComp.height; r++) {
              for (let c = 0; c < mapComp.width; c++) {
                if (mapComp.tiles[r][c] === "forest") {
                  const dist = Math.abs(c - startCol) + Math.abs(r - startRow);
                  forestTiles.push({ r, c, dist });
                }
              }
            }

            if (forestTiles.length === 0) {
              worker.state = "Idle";
              worker.searchCooldown = 2.0;
              break;
            }

            forestTiles.sort((a, b) => a.dist - b.dist);

            let pathFound = false;
            const limit = Math.min(forestTiles.length, 10);
            for (let i = 0; i < limit; i++) {
              const target = forestTiles[i];
              const path = findPath(mapComp, { r: startRow, c: startCol }, { r: target.r, c: target.c });
              if (path && path.length > 0) {
                worker.path = path;
                worker.currentWaypointIndex = 0;
                worker.targetTile = { r: target.r, c: target.c };
                worker.state = "Moving";
                pathFound = true;
                break;
              }
            }

            if (!pathFound) {
              worker.state = "Idle";
              worker.searchCooldown = 2.5;
            }

          } else if (worker.role === "Miner") {
            const stoneTiles: { r: number; c: number; dist: number }[] = [];
            for (let r = 0; r < mapComp.height; r++) {
              for (let c = 0; c < mapComp.width; c++) {
                if (mapComp.tiles[r][c] === "stone") {
                  const dist = Math.abs(c - startCol) + Math.abs(r - startRow);
                  stoneTiles.push({ r, c, dist });
                }
              }
            }

            if (stoneTiles.length === 0) {
              worker.state = "Idle";
              worker.searchCooldown = 2.0;
              break;
            }

            stoneTiles.sort((a, b) => a.dist - b.dist);

            let pathFound = false;
            const limit = Math.min(stoneTiles.length, 10);
            for (let i = 0; i < limit; i++) {
              const target = stoneTiles[i];
              const path = findPath(mapComp, { r: startRow, c: startCol }, { r: target.r, c: target.c });
              if (path && path.length > 0) {
                worker.path = path;
                worker.currentWaypointIndex = 0;
                worker.targetTile = { r: target.r, c: target.c };
                worker.state = "Moving";
                pathFound = true;
                break;
              }
            }

            if (!pathFound) {
              worker.state = "Idle";
              worker.searchCooldown = 2.5;
            }

          } else if (worker.role === "Farmer") {
            if (worker.isCarryingFood) {
              if (!storagePos) {
                worker.state = "Idle";
                worker.searchCooldown = 2.0;
                break;
              }

              const targetC = Math.floor(storagePos.x / ts);
              const targetR = Math.floor(storagePos.y / ts);
              const path = findPath(mapComp, { r: startRow, c: startCol }, { r: targetR, c: targetC });
              if (path && path.length > 0) {
                worker.path = path;
                worker.currentWaypointIndex = 0;
                worker.targetTile = { r: targetR, c: targetC };
                worker.state = "Moving";
              } else {
                worker.state = "Idle";
                worker.searchCooldown = 2.0;
              }
            } else {
              const crops = world.getEntitiesWith([CropComponent, PositionComponent]);
              const grownCrops: { entity: string; r: number; c: number; dist: number }[] = [];
              for (const cropEnt of crops) {
                const cropComp = world.getComponent(cropEnt, CropComponent)!;
                const cropPos = world.getComponent(cropEnt, PositionComponent)!;
                if (cropComp.isFullyGrown) {
                  const cr = Math.floor(cropPos.y / ts);
                  const cc = Math.floor(cropPos.x / ts);
                  const dist = Math.abs(cc - startCol) + Math.abs(cr - startRow);
                  grownCrops.push({ entity: cropEnt, r: cr, c: cc, dist });
                }
              }

              if (grownCrops.length > 0) {
                grownCrops.sort((a, b) => a.dist - b.dist);
                let pathFound = false;
                const limit = Math.min(grownCrops.length, 5);
                for (let i = 0; i < limit; i++) {
                  const targetCrop = grownCrops[i];
                  const path = findPath(mapComp, { r: startRow, c: startCol }, { r: targetCrop.r, c: targetCrop.c });
                  if (path && path.length > 0) {
                    worker.path = path;
                    worker.currentWaypointIndex = 0;
                    worker.targetTile = { r: targetCrop.r, c: targetCrop.c };
                    worker.state = "Moving";
                    pathFound = true;
                    break;
                  }
                }
                if (pathFound) break;
              }

              let targetC = startCol;
              let targetR = startRow;
              let foundGrass = false;
              for (let attempts = 0; attempts < 30; attempts++) {
                const dr = Math.floor(Math.random() * 20 - 10);
                const dc = Math.floor(Math.random() * 20 - 10);
                const tr = startRow + dr;
                const tc = startCol + dc;
                if (tr >= 0 && tr < mapComp.height && tc >= 0 && tc < mapComp.width) {
                  if (mapComp.tiles[tr][tc] === "grass") {
                    const activeCrops = world.getEntitiesWith([CropComponent, PositionComponent]);
                    const hasCrop = activeCrops.some(c => {
                      const cPos = world.getComponent(c, PositionComponent)!;
                      return Math.floor(cPos.x / ts) === tc && Math.floor(cPos.y / ts) === tr;
                    });
                    if (!hasCrop) {
                      targetC = tc;
                      targetR = tr;
                      foundGrass = true;
                      break;
                    }
                  }
                }
              }

              if (foundGrass) {
                const path = findPath(mapComp, { r: startRow, c: startCol }, { r: targetR, c: targetC });
                if (path && path.length > 0) {
                  worker.path = path;
                  worker.currentWaypointIndex = 0;
                  worker.targetTile = { r: targetR, c: targetC };
                  worker.state = "Moving";
                } else {
                  worker.state = "Idle";
                  worker.searchCooldown = 1.0;
                }
              } else {
                worker.state = "Idle";
                worker.searchCooldown = 1.5;
              }
            }
          }
          break;
        }

        case "Moving": {
          if (!worker.path || worker.path.length === 0 || !worker.targetTile) {
            worker.state = "Seeking Path";
            break;
          }

          if (worker.role === "Woodcutter") {
            if (mapComp.tiles[worker.targetTile.r][worker.targetTile.c] !== "forest") {
              worker.state = "Seeking Path";
              break;
            }
          } else if (worker.role === "Miner") {
            if (mapComp.tiles[worker.targetTile.r][worker.targetTile.c] !== "stone") {
              worker.state = "Seeking Path";
              break;
            }
          } else if (worker.role === "Farmer") {
            if (worker.isCarryingFood) {
              if (!storagePos) {
                worker.state = "Seeking Path";
                break;
              }
            } else {
              const tileType = mapComp.tiles[worker.targetTile.r][worker.targetTile.c];
              if (tileType === "water" || tileType === "stone") {
                worker.state = "Seeking Path";
                break;
              }
            }
          }

          const wp = worker.path[worker.currentWaypointIndex];
          const tx = wp.c * ts + ts / 2;
          const ty = wp.r * ts + ts / 2;

          const dx = tx - pos.x;
          const dy = ty - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 6) {
            worker.currentWaypointIndex++;

            if (worker.currentWaypointIndex >= worker.path.length) {
              vel.vx = 0;
              vel.vy = 0;
              worker.workTimer = worker.workDuration;
              worker.state = "Working";
            }
          } else {
            const angle = Math.atan2(dy, dx);
            vel.vx = Math.cos(angle) * worker.speed;
            vel.vy = Math.sin(angle) * worker.speed;
          }
          break;
        }

        case "Working": {
          vel.vx = 0;
          vel.vy = 0;

          if (worker.role === "Woodcutter") {
            if (!worker.targetTile || mapComp.tiles[worker.targetTile.r][worker.targetTile.c] !== "forest") {
              worker.state = "Seeking Path";
              break;
            }

            worker.workTimer -= dt;

            if (Math.random() < 0.25) {
              const px = worker.targetTile.c * ts + ts / 2 + (Math.random() * 24 - 12);
              const py = worker.targetTile.r * ts + ts / 2 + (Math.random() * 24 - 12);
              const color = Math.random() < 0.5 ? "#a0522d" : "#228b22";
              spawnParticle(world, px, py, color, 3 + Math.random() * 3);
            }

            if (worker.workTimer <= 0) {
              mapComp.tiles[worker.targetTile.r][worker.targetTile.c] = "grass";
              const gemX = worker.targetTile.c * ts + ts / 2;
              const gemY = worker.targetTile.r * ts + ts / 2;
              spawnGem(world, gemX, gemY, 15);
              for (let i = 0; i < 8; i++) {
                spawnParticle(world, gemX, gemY, "#f1c40f", 4);
                spawnParticle(world, gemX, gemY, "#a0522d", 3);
              }
              worker.targetTile = null;
              worker.state = "Seeking Path";
            }

          } else if (worker.role === "Miner") {
            if (!worker.targetTile || mapComp.tiles[worker.targetTile.r][worker.targetTile.c] !== "stone") {
              worker.state = "Seeking Path";
              break;
            }

            worker.workTimer -= dt;

            if (Math.random() < 0.25) {
              const px = worker.targetTile.c * ts + ts / 2 + (Math.random() * 24 - 12);
              const py = worker.targetTile.r * ts + ts / 2 + (Math.random() * 24 - 12);
              spawnParticle(world, px, py, "#7f8c8d", 3 + Math.random() * 2);
            }

            if (worker.workTimer <= 0) {
              mapComp.tiles[worker.targetTile.r][worker.targetTile.c] = "grass";
              const gemX = worker.targetTile.c * ts + ts / 2;
              const gemY = worker.targetTile.r * ts + ts / 2;
              spawnGem(world, gemX, gemY, 20);
              for (let i = 0; i < 8; i++) {
                spawnParticle(world, gemX, gemY, "#f1c40f", 4);
                spawnParticle(world, gemX, gemY, "#7f8c8d", 3);
              }
              worker.targetTile = null;
              worker.state = "Seeking Path";
            }

          } else if (worker.role === "Farmer") {
            worker.workTimer -= dt;

            if (worker.isCarryingFood) {
              if (worker.workTimer <= 0) {
                if (storageComp) {
                  storageComp.foodCount++;
                  if (storagePos) {
                    for (let i = 0; i < 5; i++) {
                      spawnParticle(world, storagePos.x, storagePos.y, "#2ecc71", 3);
                    }
                  }
                }
                worker.isCarryingFood = false;
                worker.targetTile = null;
                worker.state = "Seeking Path";
              }
            } else {
              if (!worker.targetTile) {
                worker.state = "Seeking Path";
                break;
              }

              const tr = worker.targetTile.r;
              const tc = worker.targetTile.c;

              const activeCrops = world.getEntitiesWith([CropComponent, PositionComponent]);
              const cropEnt = activeCrops.find(c => {
                const cPos = world.getComponent(c, PositionComponent)!;
                return Math.floor(cPos.x / ts) === tc && Math.floor(cPos.y / ts) === tr;
              });

              if (cropEnt) {
                const cropComp = world.getComponent(cropEnt, CropComponent)!;
                if (!cropComp.isFullyGrown) {
                  worker.state = "Seeking Path";
                  break;
                }

                if (Math.random() < 0.25) {
                  spawnParticle(world, tc * ts + ts / 2, tr * ts + ts / 2, "#f1c40f", 3);
                }

                if (worker.workTimer <= 0) {
                  world.destroyEntity(cropEnt);
                  worker.isCarryingFood = true;
                  worker.targetTile = null;
                  worker.state = "Seeking Path";
                }
              } else {
                if (mapComp.tiles[tr][tc] !== "grass") {
                  worker.state = "Seeking Path";
                  break;
                }

                if (Math.random() < 0.2) {
                  spawnParticle(world, tc * ts + ts / 2, tr * ts + ts / 2, "#2ecc71", 2);
                }

                if (worker.workTimer <= 0) {
                  spawnCrop(world, tc * ts + ts / 2, tr * ts + ts / 2, 60.0);
                  worker.targetTile = null;
                  worker.state = "Seeking Path";
                }
              }
            }
          }
          break;
        }

        case "Seeking Storage": {
          vel.vx = 0;
          vel.vy = 0;

          if (!storagePos) {
            worker.state = "Starving";
            break;
          }

          const targetC = Math.floor(storagePos.x / ts);
          const targetR = Math.floor(storagePos.y / ts);
          const startCol = Math.floor(pos.x / ts);
          const startRow = Math.floor(pos.y / ts);

          const dx = storagePos.x - pos.x;
          const dy = storagePos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 40) {
            if (storageComp && storageComp.foodCount > 0) {
              storageComp.foodCount--;
              hunger.isHungry = false;
              hunger.hungerTimer = 0;

              for (let i = 0; i < 6; i++) {
                spawnParticle(world, pos.x, pos.y, "#2ecc71", 3);
              }

              worker.state = "Seeking Path";
            } else {
              worker.state = "Starving";
            }
          } else {
            if (worker.searchCooldown <= 0) {
              const path = findPath(mapComp, { r: startRow, c: startCol }, { r: targetR, c: targetC });
              if (path && path.length > 0) {
                worker.path = path;
                worker.currentWaypointIndex = 0;
                worker.targetTile = { r: targetR, c: targetC };
                worker.state = "Moving";
              } else {
                worker.state = "Starving";
              }
              worker.searchCooldown = 1.0;
            }
          }
          break;
        }

        case "Starving": {
          vel.vx = 0;
          vel.vy = 0;

          if (worker.searchCooldown <= 0) {
            if (storageComp && storageComp.foodCount > 0) {
              worker.state = "Seeking Storage";
              worker.searchCooldown = 0;
            } else {
              spawnParticle(world, pos.x, pos.y - 12, "#e74c3c", 2);
              worker.searchCooldown = 1.5;
            }
          }
          break;
        }
      }
    }
  }
}
