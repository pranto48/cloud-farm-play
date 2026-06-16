import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { PositionComponent, VelocityComponent, BoxColliderComponent } from "../components/GameComponents";

export class MovementSystem extends System {
  readonly requiredComponents = [PositionComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      // Skip entities handled by TileCollisionSystem
      if (world.hasComponent(entity, BoxColliderComponent)) continue;

      const pos = world.getComponent(entity, PositionComponent)!;
      
      // Skip entities undergoing decoupled grid movement
      if (pos.moveDuration && pos.moveDuration > 0) continue;

      const vel = world.getComponent(entity, VelocityComponent)!;

      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;
    }
  }
}
