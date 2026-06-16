import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  BoxColliderComponent,
  MapComponent,
  PlayerComponent,
} from "../components/GameComponents";

export class TileCollisionSystem extends System {
  readonly requiredComponents = [PositionComponent, VelocityComponent, BoxColliderComponent];

  update(world: World, dt: number): void {
    // 1. Get the map tilemap grid
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const mapComp = world.getComponent(mapEntity, MapComponent)!;

    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      if (world.hasComponent(entity, PlayerComponent)) continue;

      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;
      const box = world.getComponent(entity, BoxColliderComponent)!;

      // 2. Resolve X-Axis Movement and Collisions
      if (vel.vx !== 0) {
        pos.x += vel.vx * dt;
        this.resolveCollisionsX(pos, box, mapComp, vel);
      }

      // 3. Resolve Y-Axis Movement and Collisions
      if (vel.vy !== 0) {
        pos.y += vel.vy * dt;
        this.resolveCollisionsY(pos, box, mapComp, vel);
      }
    }
  }

  private resolveCollisionsX(
    pos: PositionComponent,
    box: BoxColliderComponent,
    map: MapComponent,
    vel: VelocityComponent
  ): void {
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const ts = map.tileSize;

    // Define box bounds
    const left = pos.x - halfW;
    const right = pos.x + halfW;
    const top = pos.y - halfH;
    const bottom = pos.y + halfH;

    // Determine adjacent tiles
    const startCol = Math.floor(left / ts);
    const endCol = Math.floor(right / ts);
    const startRow = Math.floor(top / ts);
    const endRow = Math.floor(bottom / ts);

    // Loop through adjacent rows/cols
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        // Grid bounds checks
        if (c < 0 || c >= map.width || r < 0 || r >= map.height) {
          this.pushOutX(pos, c, ts, halfW, vel);
          continue;
        }

        const tileType = map.tiles[r][c];
        if (tileType === "water" || tileType === "river" || tileType === "stone") {
          // Check overlap
          const tLeft = c * ts;
          const tRight = (c + 1) * ts;
          const tTop = r * ts;
          const tBottom = (r + 1) * ts;

          if (right > tLeft && left < tRight && bottom > tTop && top < tBottom) {
            this.pushOutX(pos, c, ts, halfW, vel);
          }
        }
      }
    }
  }

  private pushOutX(
    pos: PositionComponent,
    col: number,
    ts: number,
    halfW: number,
    vel: VelocityComponent
  ): void {
    if (vel.vx > 0) {
      // Moving right -> push left of tile
      pos.x = col * ts - halfW - 0.01;
      vel.vx = 0;
    } else if (vel.vx < 0) {
      // Moving left -> push right of tile
      pos.x = (col + 1) * ts + halfW + 0.01;
      vel.vx = 0;
    }
  }

  private resolveCollisionsY(
    pos: PositionComponent,
    box: BoxColliderComponent,
    map: MapComponent,
    vel: VelocityComponent
  ): void {
    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const ts = map.tileSize;

    // Define box bounds
    const left = pos.x - halfW;
    const right = pos.x + halfW;
    const top = pos.y - halfH;
    const bottom = pos.y + halfH;

    // Determine adjacent tiles
    const startCol = Math.floor(left / ts);
    const endCol = Math.floor(right / ts);
    const startRow = Math.floor(top / ts);
    const endRow = Math.floor(bottom / ts);

    // Loop through adjacent rows/cols
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        // Grid bounds checks
        if (c < 0 || c >= map.width || r < 0 || r >= map.height) {
          this.pushOutY(pos, r, ts, halfH, vel);
          continue;
        }

        const tileType = map.tiles[r][c];
        if (tileType === "water" || tileType === "river" || tileType === "stone") {
          // Check overlap
          const tLeft = c * ts;
          const tRight = (c + 1) * ts;
          const tTop = r * ts;
          const tBottom = (r + 1) * ts;

          if (right > tLeft && left < tRight && bottom > tTop && top < tBottom) {
            this.pushOutY(pos, r, ts, halfH, vel);
          }
        }
      }
    }
  }

  private pushOutY(
    pos: PositionComponent,
    row: number,
    ts: number,
    halfH: number,
    vel: VelocityComponent
  ): void {
    if (vel.vy > 0) {
      // Moving down -> push top of tile
      pos.y = row * ts - halfH - 0.01;
      vel.vy = 0;
    } else if (vel.vy < 0) {
      // Moving up -> push bottom of tile
      pos.y = (row + 1) * ts + halfH + 0.01;
      vel.vy = 0;
    }
  }
}
