import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  MonsterComponent,
  PlayerComponent,
} from "../components/GameComponents";

export class AISystem extends System {
  readonly requiredComponents = [MonsterComponent, PositionComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const monsters = world.getEntitiesWith(this.requiredComponents);
    const players = world.getEntitiesWith([PlayerComponent, PositionComponent]);
    if (players.length === 0) return;

    const playerEntity = players[0];
    const playerPos = world.getComponent(playerEntity, PositionComponent)!;
    const playerComp = world.getComponent(playerEntity, PlayerComponent)!;

    if (playerComp.hp <= 0) {
      // If player is dead, monsters stand still
      for (const monster of monsters) {
        const vel = world.getComponent(monster, VelocityComponent)!;
        vel.vx = 0;
        vel.vy = 0;
      }
      return;
    }

    for (const monster of monsters) {
      const mComp = world.getComponent(monster, MonsterComponent)!;
      const pos = world.getComponent(monster, PositionComponent)!;
      const vel = world.getComponent(monster, VelocityComponent)!;

      const dx = playerPos.x - pos.x;
      const dy = playerPos.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        vel.vx = (dx / dist) * mComp.speed;
        vel.vy = (dy / dist) * mComp.speed;
      } else {
        vel.vx = 0;
        vel.vy = 0;
      }

      // Tick damage cooldowns
      if (mComp.damageCooldown > 0) {
        mComp.damageCooldown -= dt;
      }
    }
  }
}
