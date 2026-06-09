import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { PositionComponent, ParticleComponent } from "../components/GameComponents";

export class ParticleSystem extends System {
  readonly requiredComponents = [ParticleComponent, PositionComponent];

  update(world: World, dt: number): void {
    const particles = world.getEntitiesWith(this.requiredComponents);
    for (const part of particles) {
      const pComp = world.getComponent(part, ParticleComponent)!;
      const pos = world.getComponent(part, PositionComponent)!;

      // Apply air friction / drag to make particles float and settle
      pComp.vx *= 0.96;
      pComp.vy *= 0.96;

      pos.x += pComp.vx * dt;
      pos.y += pComp.vy * dt;

      pComp.alpha -= pComp.decay;
      if (pComp.alpha <= 0) {
        world.destroyEntity(part);
      }
    }
  }
}
