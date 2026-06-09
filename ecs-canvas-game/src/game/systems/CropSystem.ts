import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { CropComponent, PositionComponent } from "../components/GameComponents";
import { spawnParticle } from "../Spawner";

export class CropSystem extends System {
  readonly requiredComponents = [CropComponent, PositionComponent];

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      const crop = world.getComponent(entity, CropComponent)!;
      const pos = world.getComponent(entity, PositionComponent)!;

      if (!crop.isFullyGrown) {
        crop.growthTimer -= dt;
        if (crop.growthTimer <= 0) {
          crop.growthTimer = 0;
          crop.isFullyGrown = true;

          for (let i = 0; i < 6; i++) {
            spawnParticle(
              world,
              pos.x + (Math.random() * 16 - 8),
              pos.y + (Math.random() * 16 - 8),
              "#f1c40f",
              2.5 + Math.random() * 2
            );
          }
        }
      }
    }
  }
}
