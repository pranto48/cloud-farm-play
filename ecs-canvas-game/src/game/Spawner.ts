import { World } from "./ecs/World";
import { ImprovedNoise } from "./utils/Noise";
import {
  PositionComponent,
  VelocityComponent,
  RenderComponent,
  InputComponent,
  PlayerComponent,
  MonsterComponent,
  ProjectileComponent,
  ColliderComponent,
  GemComponent,
  ParticleComponent,
  MapComponent,
  BoxColliderComponent,
  WorkerComponent,
} from "./components/GameComponents";
import type { TileType } from "./components/GameComponents";

export function spawnPlayer(world: World, x: number, y: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new InputComponent());
  world.addComponent(entity, new PlayerComponent());
  world.addComponent(entity, new ColliderComponent(14, "player"));
  world.addComponent(entity, new BoxColliderComponent(20, 20));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, time) => {
      // Draw wizard staff rotation
      const staffAngle = time * 2;
      ctx.save();
      ctx.translate(px, py);
      
      // Magical base circle (rotating runes look)
      ctx.strokeStyle = "rgba(52, 152, 219, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 16, 16 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.rotate(-staffAngle * 0.5);
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.restore();

      // Wizard body / robe (blue)
      ctx.fillStyle = "#2980b9";
      ctx.beginPath();
      ctx.moveTo(-10, 16);
      ctx.lineTo(10, 16);
      ctx.lineTo(0, -6);
      ctx.closePath();
      ctx.fill();

      // Wizard cloak (dark blue)
      ctx.fillStyle = "#1b4f72";
      ctx.beginPath();
      ctx.moveTo(-8, 16);
      ctx.lineTo(8, 16);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();

      // Head / face
      ctx.fillStyle = "#f5d0a9";
      ctx.beginPath();
      ctx.arc(0, -8, 6, 0, Math.PI * 2);
      ctx.fill();

      // Wizard hat (conical blue)
      ctx.fillStyle = "#2980b9";
      ctx.beginPath();
      ctx.moveTo(-9, -10);
      ctx.lineTo(9, -10);
      ctx.lineTo(0, -26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f1c40f"; // yellow gold buckle
      ctx.fillRect(-3, -11, 6, 2);

      // Glowing wizard eyes
      ctx.fillStyle = "#34e7e4";
      ctx.fillRect(-3, -9, 2, 2);
      ctx.fillRect(1, -9, 2, 2);

      // Wizard staff (held on right side)
      ctx.save();
      ctx.translate(12, 0);
      ctx.rotate(Math.sin(time * 3) * 0.1);
      ctx.strokeStyle = "#8e44ad"; // dark staff
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(0, -18);
      ctx.stroke();
      // Staff crystal (glowing cyan diamond)
      ctx.fillStyle = "#00d2d3";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00d2d3";
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(4, -18);
      ctx.lineTo(0, -12);
      ctx.lineTo(-4, -18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();
    })
  );
  return entity;
}

export function spawnMonster(world: World, x: number, y: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new MonsterComponent());
  world.addComponent(entity, new ColliderComponent(12, "monster"));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, time) => {
      // Squish animation based on bounce
      const bounce = Math.abs(Math.sin(time * 6));
      const scaleX = 1 + bounce * 0.15;
      const scaleY = 1 - bounce * 0.15;

      ctx.save();
      ctx.translate(px, py + 12);
      ctx.scale(scaleX, scaleY);

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Monster body (creepy purple slime/ghost)
      ctx.fillStyle = "#8e44ad";
      ctx.beginPath();
      ctx.arc(0, -12, 10, Math.PI, 0, false);
      ctx.lineTo(10, 0);
      ctx.lineTo(6, -4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();

      // Inner glowing core
      ctx.fillStyle = "#a569bd";
      ctx.beginPath();
      ctx.arc(0, -10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Glowing red eyes
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(-4, -13, 2, 2);
      ctx.fillRect(2, -13, 2, 2);

      ctx.restore();
    })
  );
  return entity;
}

export function spawnPlayerSpell(world: World, x: number, y: number, angle: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  
  const proj = new ProjectileComponent();
  const vx = Math.cos(angle) * proj.speed;
  const vy = Math.sin(angle) * proj.speed;
  
  world.addComponent(entity, new VelocityComponent(vx, vy));
  world.addComponent(entity, proj);
  world.addComponent(entity, new ColliderComponent(6, "projectile"));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, time) => {
      // Fireball spell (orange/yellow pulse)
      ctx.save();
      ctx.translate(px, py);

      // Light glow
      const glowRad = 12 + Math.sin(time * 20) * 3;
      const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, glowRad);
      gradient.addColorStop(0, "#fff");
      gradient.addColorStop(0.3, "#f1c40f");
      gradient.addColorStop(0.8, "rgba(230, 126, 34, 0.4)");
      gradient.addColorStop(1, "rgba(230, 126, 34, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
      ctx.fill();

      // Core sphere
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    })
  );

  return entity;
}

export function spawnGem(world: World, x: number, y: number, value: number = 10): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new GemComponent(value));
  world.addComponent(entity, new ColliderComponent(8, "gem"));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, time) => {
      ctx.save();
      ctx.translate(px, py + Math.sin(time * 4) * 2);

      // Glowing aura
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#2ecc71";
      
      // Cyan/emerald gem diamond
      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();

      // Highlight
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(1.5, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-1.5, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    })
  );
  return entity;
}

export function spawnParticle(
  world: World,
  x: number,
  y: number,
  color: string = "#fff",
  size: number = 3
): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));

  const vx = (Math.random() * 2 - 1) * 80;
  const vy = (Math.random() * 2 - 1) * 80;
  const decay = 0.015 + Math.random() * 0.015;

  world.addComponent(entity, new VelocityComponent(vx, vy));
  world.addComponent(entity, new ParticleComponent(color, size, vx, vy, 1.0, decay));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, _time, entityId) => {
      const part = world.getComponent(entityId, ParticleComponent);
      if (!part) return;

      ctx.save();
      ctx.globalAlpha = part.alpha;
      ctx.fillStyle = part.color;
      ctx.fillRect(px - part.size / 2, py - part.size / 2, part.size, part.size);
      ctx.restore();
    })
  );
  return entity;
}

export function spawnMap(world: World): { entity: string; playerX: number; playerY: number } {
  const width = 100;
  const height = 100;
  const tileSize = 64;
  const tiles: TileType[][] = [];

  const noiseGen = new ImprovedNoise();
  const scale = 0.08;

  for (let r = 0; r < height; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < width; c++) {
      // Perlin Noise values scaled to get organic regions
      const val = noiseGen.noise(c * scale, r * scale, 0);

      let type: TileType = "grass";
      if (val < -0.15) {
        type = "water";
      } else if (val < 0.25) {
        type = "grass";
      } else if (val < 0.5) {
        type = "forest";
      } else {
        type = "stone";
      }
      row.push(type);
    }
    tiles.push(row);
  }

  // Find a grass tile starting coordinate near the center
  let playerCol = 50;
  let playerRow = 50;
  let found = false;

  for (let searchRad = 0; searchRad < 35; searchRad++) {
    for (let dr = -searchRad; dr <= searchRad; dr++) {
      for (let dc = -searchRad; dc <= searchRad; dc++) {
        const tc = 50 + dc;
        const tr = 50 + dr;
        if (tc >= 0 && tc < width && tr >= 0 && tr < height) {
          if (tiles[tr][tc] === "grass") {
            playerCol = tc;
            playerRow = tr;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    if (found) break;
  }

  const mapEntity = world.createEntity();
  world.addComponent(mapEntity, new MapComponent(tiles, width, height, tileSize));

  return {
    entity: mapEntity,
    playerX: playerCol * tileSize + tileSize / 2,
    playerY: playerRow * tileSize + tileSize / 2,
  };
}

export function spawnWorker(world: World, x: number, y: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new WorkerComponent("Idle", 95, 3.5));
  world.addComponent(
    entity,
    new RenderComponent((ctx, px, py, time, entityId) => {
      const worker = world.getComponent(entityId, WorkerComponent);
      if (!worker) return;

      ctx.save();
      ctx.translate(px, py);

      const isMoving = worker.state === "Moving";
      const bounce = isMoving ? Math.abs(Math.sin(time * 8)) : 0;
      const scaleX = 1 + bounce * 0.1;
      const scaleY = 1 - bounce * 0.1;
      ctx.scale(scaleX, scaleY);

      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 14, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#e67e22";
      ctx.beginPath();
      ctx.moveTo(-8, 14);
      ctx.lineTo(8, 14);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#d35400";
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.lineTo(6, 14);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffdbac";
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#e67e22";
      ctx.beginPath();
      ctx.moveTo(-7, -8);
      ctx.lineTo(7, -8);
      ctx.lineTo(0, -20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f1c40f";
      ctx.fillRect(-2, -9, 4, 1.5);

      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(-2, -7, 1.2, 1.2);
      ctx.fillRect(1, -7, 1.2, 1.2);

      if (worker.state === "Working") {
        const swingAngle = Math.sin(time * 16) * 0.6 - 0.4;
        
        ctx.save();
        ctx.translate(6, 4);
        ctx.rotate(-swingAngle);
        ctx.strokeStyle = "#8b4513";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(0, -10);
        ctx.stroke();
        ctx.fillStyle = "#7f8c8d";
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(5, -12);
        ctx.lineTo(5, -7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        const pct = Math.max(0, worker.workTimer / worker.workDuration);
        const barW = 24;
        const barH = 3;
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(-barW / 2, -28, barW, barH);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(-barW / 2, -28, barW * (1 - pct), barH);
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(worker.state.toUpperCase(), 0, -23);

      ctx.restore();
    })
  );
  return entity;
}
