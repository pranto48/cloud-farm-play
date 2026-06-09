import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { ProjectileComponent } from "../components/GameComponents";

export class LifetimeSystem extends System {
  readonly requiredComponents = [ProjectileComponent];

  update(world: World, dt: number): void {
    const projectiles = world.getEntitiesWith(this.requiredComponents);
    for (const proj of projectiles) {
      const pComp = world.getComponent(proj, ProjectileComponent)!;
      pComp.lifeSpan -= dt;
      if (pComp.lifeSpan <= 0) {
        world.destroyEntity(proj);
      }
    }
  }
}
