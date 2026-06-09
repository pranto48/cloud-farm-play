import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  RenderComponent,
  PlayerComponent,
  ParticleComponent,
} from "../components/GameComponents";

export class RenderSystem extends System {
  readonly requiredComponents = [PositionComponent, RenderComponent];
  private time: number = 0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) {
    super();
    this.canvas = canvas;
    this.ctx = ctx;
  }

  update(world: World, dt: number): void {
    this.time += dt;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Find player to align camera
    const players = world.getEntitiesWith([PlayerComponent, PositionComponent]);
    let camX = 0;
    let camY = 0;
    let playerEntityId = "";
    let playerHP = 100;
    let playerMaxHP = 100;
    let playerScore = 0;
    let playerLevel = 1;
    let playerXP = 0;
    let playerMaxXP = 100;
    let damageFlash = 0;
    let levelFlash = 0;

    if (players.length > 0) {
      playerEntityId = players[0];
      const pPos = world.getComponent(playerEntityId, PositionComponent)!;
      const pComp = world.getComponent(playerEntityId, PlayerComponent)!;
      camX = pPos.x - width / 2;
      camY = pPos.y - height / 2;
      playerHP = pComp.hp;
      playerMaxHP = pComp.maxHp;
      playerScore = pComp.score;
      playerLevel = pComp.level;
      playerXP = pComp.xp;
      playerMaxXP = pComp.maxXp;
      damageFlash = pComp.damageFlashTimer;
      levelFlash = pComp.levelUpFlashTimer;
    }

    // Smooth camera limits could go here, but free tracking is great for open arenas.

    // 2. Clear canvas
    this.ctx.fillStyle = "#1e272c"; // dark slate slate color
    this.ctx.fillRect(0, 0, width, height);

    // 3. Tiled Grass Grid (translated)
    this.ctx.save();
    this.ctx.translate(-camX, -camY);

    const tileSize = 64;
    const arenaSize = 800;

    // Draw grid border limits
    this.ctx.fillStyle = "#2c3e50";
    this.ctx.fillRect(-arenaSize - 20, -arenaSize - 20, arenaSize * 2 + 40, arenaSize * 2 + 40);
    this.ctx.fillStyle = "#16a085"; // beautiful dark green/emerald arena grass
    this.ctx.fillRect(-arenaSize, -arenaSize, arenaSize * 2, arenaSize * 2);

    // Draw subtle grid tiles within camera bounds
    this.ctx.strokeStyle = "#148f77";
    this.ctx.lineWidth = 1;
    const startX = Math.max(-arenaSize, Math.floor(camX / tileSize) * tileSize);
    const endX = Math.min(arenaSize, Math.ceil((camX + width) / tileSize) * tileSize);
    const startY = Math.max(-arenaSize, Math.floor(camY / tileSize) * tileSize);
    const endY = Math.min(arenaSize, Math.ceil((camY + height) / tileSize) * tileSize);

    for (let x = startX; x <= endX; x += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, Math.max(-arenaSize, camY));
      this.ctx.lineTo(x, Math.min(arenaSize, camY + height));
      this.ctx.stroke();
    }
    for (let y = startY; y <= endY; y += tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(Math.max(-arenaSize, camX), y);
      this.ctx.lineTo(Math.min(arenaSize, camX + width), y);
      this.ctx.stroke();
    }

    // 4. Gather and Y-Sort entities (for depth sorting)
    const entities = world.getEntitiesWith(this.requiredComponents);
    const renderableList = entities.map((ent) => {
      const pos = world.getComponent(ent, PositionComponent)!;
      const render = world.getComponent(ent, RenderComponent)!;
      const isParticle = world.hasComponent(ent, ParticleComponent);
      return { ent, pos, render, isParticle };
    });

    renderableList.sort((a, b) => {
      // Particles draw on top of solid entities
      if (a.isParticle && !b.isParticle) return 1;
      if (!a.isParticle && b.isParticle) return -1;
      return a.pos.y - b.pos.y;
    });

    // 5. Draw entities
    for (const item of renderableList) {
      item.render.draw(this.ctx, item.pos.x, item.pos.y, this.time, item.ent);
    }

    this.ctx.restore(); // restore viewport transform

    // 6. Draw damage screen flash
    if (damageFlash > 0) {
      this.ctx.fillStyle = `rgba(231, 76, 60, ${damageFlash * 1.5})`;
      this.ctx.fillRect(0, 0, width, height);
    }

    // 7. Draw level up golden screen flash
    if (levelFlash > 0) {
      this.ctx.fillStyle = `rgba(241, 196, 15, ${levelFlash * 0.8})`;
      this.ctx.fillRect(0, 0, width, height);
    }

    // 8. Draw HUD (Level, HP, XP, Score)
    this.drawHUD(width, height, playerHP, playerMaxHP, playerXP, playerMaxXP, playerLevel, playerScore);
  }

  private drawHUD(
    width: number,
    height: number,
    hp: number,
    maxHp: number,
    xp: number,
    maxXp: number,
    level: number,
    score: number
  ): void {
    // Glassmorphism HUD Panel at top-left
    const panelW = 260;
    const panelH = 95;
    this.ctx.fillStyle = "rgba(44, 62, 80, 0.75)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.roundRect(16, 16, panelW, panelH, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Player level & Score
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 15px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText(`LVL ${level} Wizard`, 26, 38);
    
    this.ctx.textAlign = "right";
    this.ctx.fillStyle = "#f1c40f";
    this.ctx.fillText(`Score: ${score.toLocaleString()}`, 16 + panelW - 12, 38);

    // HP Bar
    const barW = panelW - 24;
    const hpY = 48;
    this.ctx.fillStyle = "#c0392b"; // dark red background
    this.ctx.beginPath();
    this.ctx.roundRect(26, hpY, barW, 14, 4);
    this.ctx.fill();

    const hpPercent = Math.max(0, hp / maxHp);
    if (hpPercent > 0) {
      this.ctx.fillStyle = "#2ecc71"; // vibrant green fill
      this.ctx.beginPath();
      this.ctx.roundRect(26, hpY, barW * hpPercent, 14, 4);
      this.ctx.fill();
    }
    
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 9px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText(`HP: ${hp} / ${maxHp}`, 26 + barW / 2, hpY + 11);

    // XP Bar
    const xpY = 70;
    this.ctx.fillStyle = "#34495e"; // dark blue background
    this.ctx.beginPath();
    this.ctx.roundRect(26, xpY, barW, 12, 4);
    this.ctx.fill();

    const xpPercent = Math.max(0, xp / maxXp);
    if (xpPercent > 0) {
      this.ctx.fillStyle = "#3498db"; // sky blue fill
      this.ctx.beginPath();
      this.ctx.roundRect(26, xpY, barW * xpPercent, 12, 4);
      this.ctx.fill();
    }

    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 8px monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillText(`XP: ${xp} / ${maxXp}`, 26 + barW / 2, xpY + 9);

    // Key instructions at bottom center
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    this.ctx.font = "11px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      "Controls: [W][A][S][D] or [Arrows] to move  |  [Mouse Left Click] or [Space] to shoot spells",
      width / 2,
      height - 24
    );

    // GAME OVER Screen
    if (hp <= 0) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      this.ctx.fillRect(0, 0, width, height);

      this.ctx.fillStyle = "#e74c3c";
      this.ctx.font = "bold 44px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("GAME OVER", width / 2, height / 2 - 20);

      this.ctx.fillStyle = "#fff";
      this.ctx.font = "20px sans-serif";
      this.ctx.fillText(`Final Score: ${score.toLocaleString()}`, width / 2, height / 2 + 20);
      
      this.ctx.font = "14px sans-serif";
      this.ctx.fillStyle = "#95a5a6";
      this.ctx.fillText("Press [Enter] or click anywhere to respawn", width / 2, height / 2 + 55);
    }
  }
}
