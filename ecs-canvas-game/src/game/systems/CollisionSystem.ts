import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  ColliderComponent,
  PlayerComponent,
  MonsterComponent,
  ProjectileComponent,
  GemComponent,
} from "../components/GameComponents";
import { spawnParticle, spawnGem } from "../Spawner";

export class CollisionSystem extends System {
  readonly requiredComponents = [PositionComponent, ColliderComponent];

  update(world: World, dt: number): void {
    // 1. Tick down player flash timers
    const players = world.getEntitiesWith([PlayerComponent]);
    for (const playerEntity of players) {
      const pComp = world.getComponent(playerEntity, PlayerComponent)!;
      if (pComp.damageFlashTimer > 0) pComp.damageFlashTimer -= dt;
      if (pComp.levelUpFlashTimer > 0) pComp.levelUpFlashTimer -= dt;
    }

    const colliders = world.getEntitiesWith(this.requiredComponents);
    const toDestroy = new Set<string>();

    // Fast lookups
    const playerEntities = world.getEntitiesWith([PlayerComponent, PositionComponent, ColliderComponent]);
    if (playerEntities.length === 0) return;
    const playerEntity = playerEntities[0];
    const playerPos = world.getComponent(playerEntity, PositionComponent)!;
    const playerComp = world.getComponent(playerEntity, PlayerComponent)!;

    // 2. Gem Magnet pull check
    const gems = world.getEntitiesWith([GemComponent, PositionComponent, ColliderComponent]);
    const magnetRadius = 110;
    const pullSpeed = 220;

    for (const gem of gems) {
      if (toDestroy.has(gem)) continue;
      const gemPos = world.getComponent(gem, PositionComponent)!;
      const dx = playerPos.x - gemPos.x;
      const dy = playerPos.y - gemPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < magnetRadius && playerComp.hp > 0) {
        // Smoothly pull gem to player position
        gemPos.x += (dx / dist) * pullSpeed * dt;
        gemPos.y += (dy / dist) * pullSpeed * dt;
      }
    }

    // 3. Collision resolution loops
    for (let i = 0; i < colliders.length; i++) {
      const entA = colliders[i];
      if (toDestroy.has(entA)) continue;

      const posA = world.getComponent(entA, PositionComponent)!;
      const colA = world.getComponent(entA, ColliderComponent)!;

      for (let j = i + 1; j < colliders.length; j++) {
        const entB = colliders[j];
        if (toDestroy.has(entB) || toDestroy.has(entA)) continue;

        const posB = world.getComponent(entB, PositionComponent)!;
        const colB = world.getComponent(entB, ColliderComponent)!;

        // Check distance
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = colA.radius + colB.radius;

        if (dist < minDist) {
          // Resolve A and B collisions
          this.resolveCollision(world, entA, colA, posA, entB, colB, posB, toDestroy, playerComp, playerPos);
        }
      }
    }

    // 4. Cleanup destroyed entities
    for (const ent of toDestroy) {
      world.destroyEntity(ent);
    }
  }

  private resolveCollision(
    world: World,
    entA: string,
    colA: ColliderComponent,
    posA: PositionComponent,
    entB: string,
    colB: ColliderComponent,
    posB: PositionComponent,
    toDestroy: Set<string>,
    player: PlayerComponent,
    playerPos: PositionComponent
  ): void {
    const typeA = colA.type;
    const typeB = colB.type;

    // Spell vs Monster
    if (
      (typeA === "projectile" && typeB === "monster") ||
      (typeB === "projectile" && typeA === "monster")
    ) {
      const projEnt = typeA === "projectile" ? entA : entB;
      const monsterEnt = typeA === "monster" ? entA : entB;
      const monsterPos = typeA === "monster" ? posA : posB;

      const monster = world.getComponent(monsterEnt, MonsterComponent);
      const proj = world.getComponent(projEnt, ProjectileComponent);

      if (monster && proj) {
        monster.hp -= proj.damage;
        toDestroy.add(projEnt);

        // Spawn hit spark particles (orange)
        const hitX = (posA.x + posB.x) / 2;
        const hitY = (posA.y + posB.y) / 2;
        for (let k = 0; k < 5; k++) {
          spawnParticle(world, hitX, hitY, "#f39c12", 2.5 + Math.random() * 2);
        }

        if (monster.hp <= 0) {
          toDestroy.add(monsterEnt);

          // Explosion particles (purple blast)
          for (let k = 0; k < 12; k++) {
            spawnParticle(world, monsterPos.x, monsterPos.y, "#9b59b6", 3 + Math.random() * 3);
          }

          // Drop XP gem
          spawnGem(world, monsterPos.x, monsterPos.y, 10 + Math.floor(Math.random() * 10));
          player.score += 100;
        }
      }
    }

    // Player vs Monster
    if (
      (typeA === "player" && typeB === "monster") ||
      (typeB === "player" && typeA === "monster")
    ) {
      const monsterEnt = typeA === "monster" ? entA : entB;
      const monster = world.getComponent(monsterEnt, MonsterComponent);

      if (monster && player.hp > 0 && monster.damageCooldown <= 0) {
        player.hp = Math.max(0, player.hp - monster.damage);
        monster.damageCooldown = 0.8; // cooldown between hits
        player.damageFlashTimer = 0.22; // flash red effect duration

        // Red blood spark particles
        const hitX = (posA.x + posB.x) / 2;
        const hitY = (posA.y + posB.y) / 2;
        for (let k = 0; k < 8; k++) {
          spawnParticle(world, hitX, hitY, "#e74c3c", 3 + Math.random() * 3);
        }
      }
    }

    // Player vs Gem
    if (
      (typeA === "player" && typeB === "gem") ||
      (typeB === "player" && typeA === "gem")
    ) {
      const gemEnt = typeA === "gem" ? entA : entB;
      const gem = world.getComponent(gemEnt, GemComponent);

      if (gem && !gem.isCollected) {
        gem.isCollected = true;
        toDestroy.add(gemEnt);

        // Collect green sparkles
        for (let k = 0; k < 3; k++) {
          spawnParticle(world, playerPos.x, playerPos.y, "#2ecc71", 2 + Math.random() * 2);
        }

        // Award XP & Score
        player.xp += gem.value;
        player.score += 15;

        // Level Up check
        if (player.xp >= player.maxXp) {
          player.xp -= player.maxXp;
          player.level += 1;
          player.maxXp = Math.floor(player.maxXp * 1.35);
          player.hp = player.maxHp; // full heal
          player.levelUpFlashTimer = 0.5; // flash gold effect duration
          player.score += 500;

          // Huge golden fireworks burst
          for (let k = 0; k < 30; k++) {
            spawnParticle(world, playerPos.x, playerPos.y, "#f1c40f", 3.5 + Math.random() * 4);
          }
        }
      }
    }
  }
}
