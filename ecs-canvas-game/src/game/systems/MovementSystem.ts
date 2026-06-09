import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { PositionComponent, VelocityComponent, ColliderComponent } from "../components/GameComponents";

export class MovementSystem extends System {
  readonly requiredComponents = [PositionComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);
    const arenaSize = 800; // boundary limit

    for (const entity of entities) {
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;

      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;

      // Bound player and monster entities to play arena size
      const collider = world.getComponent(entity, ColliderComponent);
      if (collider && (collider.type === "player" || collider.type === "monster")) {
        const padding = collider.radius + 10;
        pos.x = Math.max(-arenaSize + padding, Math.min(arenaSize - padding, pos.x));
        pos.y = Math.max(-arenaSize + padding, Math.min(arenaSize - padding, pos.y));
      }
    }
  }
}
