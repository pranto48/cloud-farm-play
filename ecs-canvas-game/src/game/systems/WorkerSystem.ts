import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  WorkerComponent,
  MapComponent,
} from "../components/GameComponents";
import { findPath } from "../utils/AStar";
import { spawnGem, spawnParticle } from "../Spawner";

export class WorkerSystem extends System {
  readonly requiredComponents = [PositionComponent, VelocityComponent, WorkerComponent];

  update(world: World, dt: number): void {
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const mapComp = world.getComponent(mapEntity, MapComponent)!;
    const ts = mapComp.tileSize;

    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;
      const worker = world.getComponent(entity, WorkerComponent)!;

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
          break;
        }

        case "Moving": {
          if (
            !worker.path ||
            worker.path.length === 0 ||
            !worker.targetTile ||
            mapComp.tiles[worker.targetTile.r][worker.targetTile.c] !== "forest"
          ) {
            worker.state = "Seeking Path";
            break;
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
          break;
        }
      }
    }
  }
}
