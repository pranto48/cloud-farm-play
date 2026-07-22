import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  StructureComponent,
  WorkerComponent,
  HealthComponent,
  EnemyComponent,
} from "../components/GameComponents";
import { spawnParticle } from "../Spawner";

export class CombatSystem extends System {
  readonly requiredComponents = [EnemyComponent, PositionComponent, HealthComponent];
  private spawnTimer: number = 0;

  update(world: World, dt: number): void {
    // 1. Periodically spawn Biter waves near the map boundary
    this.spawnTimer += dt;
    if (this.spawnTimer > 35) { // wave every 35s
      this.spawnTimer = 0;
      this.spawnBiterWave(world, 3);
    }

    // 2. Process Biter AI movement towards nearest structure
    const biters = world.getEntitiesWith(this.requiredComponents);
    const structures = world.getEntitiesWith([StructureComponent, PositionComponent]);

    for (const biterEnt of biters) {
      const bComp = world.getComponent(biterEnt, EnemyComponent)!;
      const bPos = world.getComponent(biterEnt, PositionComponent)!;
      const bHealth = world.getComponent(biterEnt, HealthComponent)!;

      if (bHealth.hp <= 0) {
        // Biter destroyed -> spawn explosion particles
        for (let i = 0; i < 10; i++) {
          spawnParticle(world, bPos.x, bPos.y, "#e74c3c", 4);
        }
        world.destroyEntity(biterEnt);
        continue;
      }

      // Seek nearest structure
      let targetX = bPos.x;
      let targetY = bPos.y;
      let minDist = Infinity;
      let targetStructEnt: string | null = null;

      for (const sEnt of structures) {
        const sPos = world.getComponent(sEnt, PositionComponent)!;
        const dist = Math.hypot(sPos.x - bPos.x, sPos.y - bPos.y);
        if (dist < minDist) {
          minDist = dist;
          targetX = sPos.x;
          targetY = sPos.y;
          targetStructEnt = sEnt;
        }
      }

      if (minDist > 30) {
        // Move towards target structure
        const dx = targetX - bPos.x;
        const dy = targetY - bPos.y;
        const len = Math.hypot(dx, dy) || 1;
        bPos.x += (dx / len) * bComp.speed * dt;
        bPos.y += (dy / len) * bComp.speed * dt;
      } else if (targetStructEnt) {
        // Attack structure
        bComp.attackTimer += dt;
        if (bComp.attackTimer >= 1.0) {
          bComp.attackTimer = 0;
          spawnParticle(world, targetX, targetY, "#f39c12", 5);
        }
      }
    }

    // 3. Process Automated Gun & Laser Turret Targeting
    for (const sEnt of structures) {
      const sc = world.getComponent(sEnt, StructureComponent)!;
      const sPos = world.getComponent(sEnt, PositionComponent)!;

      if (sc.type === "gun_turret" || sc.type === "laser_turret") {
        const range = sc.type === "laser_turret" ? 350 : 250;
        const damage = sc.type === "laser_turret" ? 35 : 20;

        for (const biterEnt of biters) {
          const bPos = world.getComponent(biterEnt, PositionComponent)!;
          const bHealth = world.getComponent(biterEnt, HealthComponent)!;
          const dist = Math.hypot(bPos.x - sPos.x, bPos.y - sPos.y);

          if (dist <= range && bHealth.hp > 0) {
            // Fire laser beam / turret bullets
            bHealth.hp -= damage * dt;
            const beamColor = sc.type === "laser_turret" ? "#00f3ff" : "#f1c40f";
            spawnParticle(world, bPos.x, bPos.y, beamColor, 3);
            break; // Target one biter at a time
          }
        }
      }
    }

    // 4. Process Combat & Repair Drones
    const workers = world.getEntitiesWith([WorkerComponent, PositionComponent]);
    for (const wEnt of workers) {
      const wComp = world.getComponent(wEnt, WorkerComponent)!;
      const wPos = world.getComponent(wEnt, PositionComponent)!;

      if (wComp.role === "combat") {
        // Find nearest biter to engage
        for (const biterEnt of biters) {
          const bPos = world.getComponent(biterEnt, PositionComponent)!;
          const bHealth = world.getComponent(biterEnt, HealthComponent)!;
          const dist = Math.hypot(bPos.x - wPos.x, bPos.y - wPos.y);

          if (dist <= 300 && bHealth.hp > 0) {
            bHealth.hp -= 40 * dt;
            spawnParticle(world, bPos.x, bPos.y, "#00ff66", 4);
            break;
          }
        }
      }
    }
  }

  private spawnBiterWave(world: World, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1200 + Math.random() * 400;
      const bx = 1000 + Math.cos(angle) * dist;
      const by = 1000 + Math.sin(angle) * dist;

      const entity = world.createEntity();
      world.addComponent(entity, new PositionComponent(bx, by));
      world.addComponent(entity, new HealthComponent(60));
      world.addComponent(entity, new EnemyComponent("biter_small"));
    }
  }
}
