import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  InputComponent,
  PlayerComponent,
} from "../components/GameComponents";
import { spawnPlayerSpell } from "../Spawner";

export class InputSystem extends System {
  readonly requiredComponents = [PlayerComponent, InputComponent, PositionComponent, VelocityComponent];
  public activeTool: "spell" | "road" = "spell";

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);
    for (const entity of entities) {
      const player = world.getComponent(entity, PlayerComponent)!;
      const input = world.getComponent(entity, InputComponent)!;
      const pos = world.getComponent(entity, PositionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;

      if (player.hp <= 0) {
        vel.vx = 0;
        vel.vy = 0;
        continue;
      }

      // Handle keyboard movement keys
      let dx = 0;
      let dy = 0;

      if (input.keys["w"] || input.keys["arrowup"] || input.keys["W"]) dy -= 1;
      if (input.keys["s"] || input.keys["arrowdown"] || input.keys["S"]) dy += 1;
      if (input.keys["a"] || input.keys["arrowleft"] || input.keys["A"]) dx -= 1;
      if (input.keys["d"] || input.keys["arrowright"] || input.keys["D"]) dx += 1;

      // Normalize diagonal speeds
      const playerSpeed = 160;
      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }

      vel.vx = dx * playerSpeed;
      vel.vy = dy * playerSpeed;

      // Handle spell casting cooldowns
      if (player.fireRateTimer > 0) {
        player.fireRateTimer -= dt;
      }

      // Shoot spells when clicked or Space pressed (only in spell mode)
      if (this.activeTool === "spell" && (input.mouseClicked || input.keys[" "]) && player.fireRateTimer <= 0) {
        player.fireRateTimer = 0.25; // Casting interval in seconds

        let targetX = pos.x;
        let targetY = pos.y - 100; // default straight up

        if (input.mouseClicked) {
          targetX = input.mouseX;
          targetY = input.mouseY;
        } else if (dx !== 0 || dy !== 0) {
          targetX = pos.x + dx * 100;
          targetY = pos.y + dy * 100;
        }

        const angle = Math.atan2(targetY - pos.y, targetX - pos.x);
        spawnPlayerSpell(world, pos.x, pos.y, angle);
      }
    }
  }
}
