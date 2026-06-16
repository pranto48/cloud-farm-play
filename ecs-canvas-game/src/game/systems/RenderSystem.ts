import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { ImprovedNoise } from "../utils/Noise";
import {
  PositionComponent,
  PlayerComponent,
  ParticleComponent,
  MapComponent,
  StructureComponent,
  InputComponent,
  ItemComponent,
  ItemType,
  TileType,
  WorkerComponent,
} from "../components/GameComponents";

export class RenderSystem extends System {
  readonly requiredComponents = [PositionComponent];
  private time: number = 0;
  private noiseBase = new ImprovedNoise();

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public activeTool: string = "belt";

  // Camera coordinates for smooth follow
  public camX: number = 0;
  public camY: number = 0;
  private camInitialized: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) {
    super();
    this.canvas = canvas;
    this.ctx = ctx;
  }

  private getGrassColor(c: number, r: number): string {
    const val = this.noiseBase.noise(c * 0.07, r * 0.07, 0);
    const t = Math.max(0, Math.min(1, (val + 0.3) / 0.6));
    const rCol = Math.round(67 + t * 25);
    const gCol = Math.round(142 + t * 42);
    const bCol = Math.round(70 + t * 26);
    return `rgb(${rCol}, ${gCol}, ${bCol})`;
  }

  private seedRandom(s: number): number {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  private drawOrganicBlob(
    ctx: CanvasRenderingContext2D,
    r: number,
    c: number,
    map: MapComponent,
    ts: number,
    type: TileType,
    color: string,
    radiusRatio: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    const tx = c * ts + offsetX;
    const ty = r * ts + offsetY;
    const cx = tx + ts / 2;
    const cy = ty + ts / 2;
    const rad = ts * radiusRatio;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();

    const checkType = (nr: number, nc: number) => {
      if (nr < 0 || nr >= map.height || nc < 0 || nc >= map.width) return false;
      return map.tiles[nr][nc] === type;
    };

    const width = rad * 2;
    if (checkType(r - 1, c)) {
      ctx.fillRect(cx - rad, ty, width, ts / 2);
    }
    if (checkType(r + 1, c)) {
      ctx.fillRect(cx - rad, cy, width, ts / 2);
    }
    if (checkType(r, c - 1)) {
      ctx.fillRect(tx, cy - rad, ts / 2, width);
    }
    if (checkType(r, c + 1)) {
      ctx.fillRect(cx, cy - rad, ts / 2, width);
    }
  }

  private drawOrganicTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5c3a21";
    ctx.fillRect(-3, 0, 6, 16);

    ctx.fillStyle = "#1b4d22";
    ctx.beginPath();
    ctx.arc(-8, -6, 10, 0, Math.PI * 2);
    ctx.arc(8, -6, 10, 0, Math.PI * 2);
    ctx.arc(0, -16, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2d7a3a";
    ctx.beginPath();
    ctx.arc(-6, -8, 8, 0, Math.PI * 2);
    ctx.arc(6, -8, 8, 0, Math.PI * 2);
    ctx.arc(0, -16, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4c9e4f";
    ctx.beginPath();
    ctx.arc(-2, -12, 6, 0, Math.PI * 2);
    ctx.arc(2, -12, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  update(world: World, dt: number): void {
    this.time += dt;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Locate player to focus camera
    const players = world.getEntitiesWith([PlayerComponent, PositionComponent]);
    let playerEntityId = "";
    let playerInventory: Record<string, number> = {};
    let buildRotation = 90;

    let inputComp: InputComponent | undefined;
    if (players.length > 0) {
      playerEntityId = players[0];
      const pPos = world.getComponent(playerEntityId, PositionComponent)!;
      const pComp = world.getComponent(playerEntityId, PlayerComponent)!;
      inputComp = world.getComponent(playerEntityId, InputComponent);
      
      const targetCamX = pPos.x - width / 2;
      const targetCamY = pPos.y - height / 2;

      if (!this.camInitialized) {
        this.camX = targetCamX;
        this.camY = targetCamY;
        this.camInitialized = true;
      } else {
        // Smooth camera follow using linear interpolation (lerp)
        const lerpSpeed = 6.0;
        const lerpFactor = Math.min(1.0, lerpSpeed * dt);
        this.camX += (targetCamX - this.camX) * lerpFactor;
        this.camY += (targetCamY - this.camY) * lerpFactor;
      }

      playerInventory = pComp.inventory;
      buildRotation = pComp.buildRotation;
    }

    // Ensure image smoothing is disabled for crisp retro pixel art
    this.ctx.imageSmoothingEnabled = false;

    // 2. Background slate
    this.ctx.fillStyle = "#1b1e22";
    this.ctx.fillRect(0, 0, width, height);

    // Translate view relative to camera (round to integer pixels to prevent sub-pixel rendering blur)
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false; // Set it again inside the saved state
    this.ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

    // 3. Render Map
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length > 0) {
      const mapEntity = maps[0];
      const map = world.getComponent(mapEntity, MapComponent)!;
      const ts = map.tileSize;

      // Visible bounds culling
      const startCol = Math.max(0, Math.floor(this.camX / ts));
      const endCol = Math.min(map.width - 1, Math.ceil((this.camX + width) / ts));
      const startRow = Math.max(0, Math.floor(this.camY / ts));
      const endRow = Math.min(map.height - 1, Math.ceil((this.camY + height) / ts));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const type = map.tiles[r][c];
          const tx = c * ts;
          const ty = r * ts;

          // Draw Biomes
          if (type === "grass") {
            // Smooth noise-based grass color
            this.ctx.fillStyle = this.getGrassColor(c, r);
            this.ctx.fillRect(tx, ty, ts, ts);

            // Draw organic grass tufts
            const seed = c * 13 + r * 37;
            if (this.seedRandom(seed) < 0.15) {
              const ox = ts * 0.2 + this.seedRandom(seed + 1) * ts * 0.6;
              const oy = ts * 0.2 + this.seedRandom(seed + 2) * ts * 0.6;
              this.ctx.strokeStyle = "rgba(56, 122, 58, 0.45)";
              this.ctx.lineWidth = 1.5;
              this.ctx.beginPath();
              // Blade 1
              this.ctx.moveTo(tx + ox, ty + oy);
              this.ctx.quadraticCurveTo(tx + ox - 3, ty + oy - 6, tx + ox - 5, ty + oy - 8);
              // Blade 2
              this.ctx.moveTo(tx + ox, ty + oy);
              this.ctx.quadraticCurveTo(tx + ox + 1, ty + oy - 8, tx + ox + 3, ty + oy - 10);
              this.ctx.stroke();
            }

            // Draw pretty flower patches
            if (this.seedRandom(seed + 5) < 0.08) {
              const fx = tx + ts * 0.25 + this.seedRandom(seed + 6) * ts * 0.5;
              const fy = ty + ts * 0.25 + this.seedRandom(seed + 7) * ts * 0.5;
              
              // Draw petals (white/yellow/red)
              const petalColor = this.seedRandom(seed + 8) < 0.5 ? "#ffffff" : "#f1c40f";
              this.ctx.fillStyle = petalColor;
              this.ctx.beginPath();
              this.ctx.arc(fx - 2, fy, 1.5, 0, Math.PI * 2);
              this.ctx.arc(fx + 2, fy, 1.5, 0, Math.PI * 2);
              this.ctx.arc(fx, fy - 2, 1.5, 0, Math.PI * 2);
              this.ctx.arc(fx, fy + 2, 1.5, 0, Math.PI * 2);
              this.ctx.fill();

              // Draw orange center
              this.ctx.fillStyle = "#e67e22";
              this.ctx.beginPath();
              this.ctx.arc(fx, fy, 1.2, 0, Math.PI * 2);
              this.ctx.fill();
            }
          } else if (type === "water") {
            // Draw sandy shore underneath
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "water", "#e5cbb3", 0.70);
            // Draw shallow water edge
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "water", "#4c81a3", 0.66);
            // Draw deep water body
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "water", "#3b6e8c", 0.62);

            // Crisp 3-frame flow animation loop (integer-snapped offsets to preserve pixelated rendering)
            const waterFrame = Math.floor((this.time * 3) % 3);
            const cx = tx + ts / 2;
            const cy = ty + ts / 2;
            this.ctx.fillStyle = "#5d97bc";

            if (waterFrame === 0) {
              this.ctx.fillRect(Math.round(cx - 16), Math.round(cy - 8), 12, 2);
              this.ctx.fillRect(Math.round(cx + 4), Math.round(cy + 12), 16, 2);
            } else if (waterFrame === 1) {
              this.ctx.fillRect(Math.round(cx - 12), Math.round(cy - 6), 12, 2);
              this.ctx.fillRect(Math.round(cx + 8), Math.round(cy + 14), 16, 2);
            } else {
              this.ctx.fillRect(Math.round(cx - 8), Math.round(cy - 4), 12, 2);
              this.ctx.fillRect(Math.round(cx + 12), Math.round(cy + 16), 16, 2);
            }
          } else if (type === "stone") {
            // Draw drop shadow
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "stone", "rgba(0, 0, 0, 0.2)", 0.66, 0, 4);
            // Draw dark outline
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "stone", "#4d5656", 0.64);
            // Draw stone body
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "stone", "#788282", 0.58);

            // Cracked stone details
            const cx = tx + ts / 2;
            const cy = ty + ts / 2;
            this.ctx.strokeStyle = "#586161";
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 12, cy - 6);
            this.ctx.lineTo(cx + 8, cy - 10);
            this.ctx.lineTo(cx + 14, cy + 4);
            this.ctx.stroke();
          } else if (type === "forest") {
            // Forest grass background
            this.ctx.fillStyle = this.getGrassColor(c, r);
            this.ctx.fillRect(tx, ty, ts, ts);

            // Dense trees sorted by Y coordinate
            const seed = c * 53 + r * 29;
            const numTrees = 2 + Math.floor(this.seedRandom(seed) * 2); // 2 or 3 trees
            const trees = [];
            for (let i = 0; i < numTrees; i++) {
              const ox = ts * 0.15 + this.seedRandom(seed + i * 7) * ts * 0.7;
              const oy = ts * 0.15 + this.seedRandom(seed + i * 11) * ts * 0.7;
              trees.push({
                x: tx + ox,
                y: ty + oy,
                scale: 0.85 + this.seedRandom(seed + i * 31) * 0.35,
              });
            }
            trees.sort((a, b) => a.y - b.y);
            for (const tree of trees) {
              this.drawOrganicTree(this.ctx, tree.x, tree.y, tree.scale);
            }
          } else if (type === "iron" || type === "copper" || type === "coal") {
            // Base background underneath the ore (stone if in mountainous terrain, grass otherwise)
            const baseVal = this.noiseBase.noise(c * 0.07, r * 0.07, 0);
            if (baseVal > 0.2) {
              // Draw stone background blob
              this.drawOrganicBlob(this.ctx, r, c, map, ts, type, "#788282", 0.65);
            } else {
              // Draw grass background
              this.ctx.fillStyle = this.getGrassColor(c, r);
              this.ctx.fillRect(tx, ty, ts, ts);
            }

            // Scatter shiny ore chunk deposits
            const seed = c * 73 + r * 37;
            const numChunks = 4 + Math.floor(this.seedRandom(seed) * 3); // 4 to 6 chunks

            let oreColor = "#bdc3c7";
            let highlightColor = "#ffffff";
            let shadowColor = "rgba(0,0,0,0.3)";

            if (type === "iron") {
              oreColor = "#a6b1b9";
              highlightColor = "#eef2f5";
            } else if (type === "copper") {
              oreColor = "#d35400";
              highlightColor = "#ff7f50";
            } else if (type === "coal") {
              oreColor = "#111111";
              highlightColor = "#34495e";
            }

            for (let i = 0; i < numChunks; i++) {
              const ox = ts * 0.2 + this.seedRandom(seed + i * 13) * ts * 0.6;
              const oy = ts * 0.2 + this.seedRandom(seed + i * 29) * ts * 0.6;
              const size = 5 + this.seedRandom(seed + i * 47) * 7; // size 5 to 12px

              const px = tx + ox;
              const py = ty + oy;

              // Draw shadow
              this.ctx.fillStyle = shadowColor;
              this.ctx.beginPath();
              this.ctx.arc(px, py + 1.5, size, 0, Math.PI * 2);
              this.ctx.fill();

              // Draw chunk
              this.ctx.fillStyle = oreColor;
              this.ctx.beginPath();
              this.ctx.arc(px, py, size, 0, Math.PI * 2);
              this.ctx.fill();

              // Draw highlights
              this.ctx.fillStyle = highlightColor;
              this.ctx.beginPath();
              this.ctx.arc(px - size * 0.3, py - size * 0.3, size * 0.35, 0, Math.PI * 2);
              this.ctx.fill();
            }
          } else if (type === "road") {
            // Draw dusty gravel road with rounded organic borders
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "road", "#b88c60", 0.44); // edge
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "road", "#d5a980", 0.38); // body

            // Draw pebbles/gravel chunks on the road
            const seed = c * 83 + r * 19;
            this.ctx.fillStyle = "#a87c50";
            for (let i = 0; i < 3; i++) {
              const ox = ts * 0.3 + this.seedRandom(seed + i * 3) * ts * 0.4;
              const oy = ts * 0.3 + this.seedRandom(seed + i * 7) * ts * 0.4;
              this.ctx.fillRect(tx + ox, ty + oy, 2, 2);
            }
          } else if (type === "fast_road") {
            // High-speed futuristic metal road with glowing cyan chevrons/stripe
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "fast_road", "#1e272c", 0.48); // outer metal panel
            this.drawOrganicBlob(this.ctx, r, c, map, ts, "fast_road", "#2c3e50", 0.42); // inner plate

            const cx = tx + ts / 2;
            const cy = ty + ts / 2;

            const checkType = (nr: number, nc: number) => {
              if (nr < 0 || nr >= map.height || nc < 0 || nc >= map.width) return false;
              return map.tiles[nr][nc] === "fast_road";
            };

            // Glowing neon stripe connecting to adjacent fast road tiles
            this.ctx.save();
            this.ctx.strokeStyle = "rgba(52, 231, 228, 0.85)";
            this.ctx.shadowColor = "#34e7e4";
            this.ctx.shadowBlur = 4;
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = "round";

            if (checkType(r - 1, c)) { // Up
              this.ctx.beginPath();
              this.ctx.moveTo(cx, cy);
              this.ctx.lineTo(cx, ty);
              this.ctx.stroke();
            }
            if (checkType(r + 1, c)) { // Down
              this.ctx.beginPath();
              this.ctx.moveTo(cx, cy);
              this.ctx.lineTo(cx, ty + ts);
              this.ctx.stroke();
            }
            if (checkType(r, c - 1)) { // Left
              this.ctx.beginPath();
              this.ctx.moveTo(cx, cy);
              this.ctx.lineTo(tx, cy);
              this.ctx.stroke();
            }
            if (checkType(r, c + 1)) { // Right
              this.ctx.beginPath();
              this.ctx.moveTo(cx, cy);
              this.ctx.lineTo(tx + ts, cy);
              this.ctx.stroke();
            }

            // Central glowing node
            this.ctx.fillStyle = "#34e7e4";
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
          }

          // Pathfinding weights overlay when using builder tools
          const isBuilderTool = this.activeTool === "road" || this.activeTool === "fast_road" || this.activeTool === "storage_house" || this.activeTool === "worker_house";
          if (isBuilderTool) {
            const weight = map.weights[r]?.[c];
            if (weight !== undefined && weight !== Infinity) {
              this.ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
              this.ctx.font = "bold 9px monospace";
              this.ctx.textAlign = "left";
              this.ctx.textBaseline = "top";
              this.ctx.fillText(weight.toFixed(1), tx + 4, ty + 4);
            }
          }
        }
      }

      // Draw active blueprint preview grid
      if (inputComp) {
        const mouseCol = Math.floor(inputComp.mouseX / ts);
        const mouseRow = Math.floor(inputComp.mouseY / ts);

        if (mouseCol >= 0 && mouseCol < map.width && mouseRow >= 0 && mouseRow < map.height) {
          const tileType = map.tiles[mouseRow][mouseCol];
          const isClear = tileType !== "water" && tileType !== "stone";
          
          this.ctx.save();
          this.ctx.strokeStyle = isClear ? "#2ecc71" : "#e74c3c";
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([4, 4]);
          this.ctx.strokeRect(mouseCol * ts + 1, mouseRow * ts + 1, ts - 2, ts - 2);
          this.ctx.fillStyle = isClear ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)";
          this.ctx.fillRect(mouseCol * ts + 1, mouseRow * ts + 1, ts - 2, ts - 2);

          // Draw rotation indicator arrow inside preview
          this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          this.ctx.translate(mouseCol * ts + ts / 2, mouseRow * ts + ts / 2);
          this.ctx.rotate((buildRotation * Math.PI) / 180);
          this.ctx.beginPath();
          this.ctx.moveTo(12, 0);
          this.ctx.lineTo(2, -6);
          this.ctx.lineTo(2, -2);
          this.ctx.lineTo(-10, -2);
          this.ctx.lineTo(-10, 2);
          this.ctx.lineTo(2, 2);
          this.ctx.lineTo(2, 6);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.restore();
        }
      }
    }

    // 4. Draw power grid connection lines (Wood pole cables)
    const structures = world.getEntitiesWith([StructureComponent, PositionComponent]);
    const poles = structures.filter(ent => world.getComponent(ent, StructureComponent)!.type === "pole");
    
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(44, 62, 80, 0.65)";
    this.ctx.lineWidth = 2.0;
    
    // Draw wire links between poles within 320px
    for (let i = 0; i < poles.length; i++) {
      const posA = world.getComponent(poles[i], PositionComponent)!;
      const structA = world.getComponent(poles[i], StructureComponent)!;
      for (let j = i + 1; j < poles.length; j++) {
        const posB = world.getComponent(poles[j], PositionComponent)!;
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        if (dx * dx + dy * dy <= 320 * 320) {
          // Draw hanging cable using quadratic bezier curve
          this.ctx.beginPath();
          this.ctx.moveTo(posA.x, posA.y - 20); // attach top of pole
          const midX = (posA.x + posB.x) / 2;
          const midY = (posA.y + posB.y) / 2 + 10; // dip down
          this.ctx.quadraticCurveTo(midX, midY, posB.x, posB.y - 20);
          this.ctx.stroke();
        }
      }
    }
    this.ctx.restore();

    // 5. Gather all entities and sort by Y coordinate (for realistic 2.5D overlap depth)
    const entities = world.getEntitiesWith([PositionComponent]);
    const renderableList = entities.map((ent) => {
      const pos = world.getComponent(ent, PositionComponent)!;
      const isItem = world.hasComponent(ent, ItemComponent);
      const isStructure = world.hasComponent(ent, StructureComponent);
      const isParticle = world.hasComponent(ent, ParticleComponent);
      const isWorker = world.hasComponent(ent, WorkerComponent);
      return { ent, pos, isItem, isStructure, isParticle, isWorker };
    });

    renderableList.sort((a, b) => {
      // Items and Belts draw first (ground level)
      const aBelt = a.isStructure && world.getComponent(a.ent, StructureComponent)!.type === "belt";
      const bBelt = b.isStructure && world.getComponent(b.ent, StructureComponent)!.type === "belt";

      if (aBelt && !bBelt) return -1;
      if (!aBelt && bBelt) return 1;

      if (a.isItem && !b.isItem) return -1;
      if (!a.isItem && b.isItem) return 1;

      if (a.isParticle && !b.isParticle) return 1;
      if (!a.isParticle && b.isParticle) return -1;

      return a.pos.y - b.pos.y;
    });

    // 6. Draw entities
    for (const item of renderableList) {
      const entId = item.ent;
      const px = item.pos.x;
      const py = item.pos.y;

      if (item.isParticle) {
        const part = world.getComponent(entId, ParticleComponent)!;
        this.ctx.save();
        this.ctx.globalAlpha = part.alpha;
        this.ctx.fillStyle = part.color;
        this.ctx.fillRect(px - part.size / 2, py - part.size / 2, part.size, part.size);
        this.ctx.restore();
      } else if (item.isItem) {
        const it = world.getComponent(entId, ItemComponent)!;
        this.drawItemIcon(this.ctx, px, py, it.type);
      } else if (item.isStructure) {
        const struct = world.getComponent(entId, StructureComponent)!;
        this.drawStructure(this.ctx, px, py, struct, entId);
      } else if (item.isWorker) {
        const wComp = world.getComponent(entId, WorkerComponent)!;
        this.drawWorker(this.ctx, px, py, wComp);

        const isBuilderTool = this.activeTool === "road" || this.activeTool === "fast_road" || this.activeTool === "storage_house" || this.activeTool === "worker_house";
        if (isBuilderTool && wComp.path && wComp.path.length > 0) {
          const mapComp = world.getComponent(maps[0], MapComponent)!;
          this.drawWorkerPath(this.ctx, wComp, mapComp.tileSize);
        }
      } else if (entId === playerEntityId) {
        this.drawPlayer(this.ctx, px, py);
      }
    }

    this.ctx.restore(); // restore transform

    // 7. HUD Rendering (Inventory, Selected Blueprint)
    this.drawFactoryHUD(width, height, playerInventory);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    ctx.save();
    ctx.translate(px, py);

    // Little round feet shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body body overalls (brown)
    ctx.fillStyle = "#8a5a3b";
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(8, 12);
    ctx.lineTo(6, -2);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();

    // Red flannel shirt
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(-5, -6, 10, 4);

    // Head
    ctx.fillStyle = "#f5d0a9";
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, Math.PI * 2);
    ctx.fill();

    // Stardew farmer straw hat
    ctx.fillStyle = "#f1c40f";
    ctx.beginPath();
    ctx.ellipse(0, -14, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4ac0d";
    ctx.beginPath();
    ctx.arc(0, -16, 4, Math.PI, 0, false);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(-2, -11, 1, 1.5);
    ctx.fillRect(1, -11, 1, 1.5);

    ctx.restore();
  }

  private drawItemIcon(ctx: CanvasRenderingContext2D, px: number, py: number, type: ItemType): void {
    ctx.save();
    ctx.translate(px, py);

    // Little shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.fill();

    let symbol = "🪵";
    let color = "#fff";

    switch (type) {
      case "wood": symbol = "🪵"; break;
      case "stone": symbol = "🪨"; break;
      case "iron_ore": symbol = "⚪"; color = "#bdc3c7"; break;
      case "copper_ore": symbol = "🟤"; color = "#d35400"; break;
      case "coal": symbol = "⚫"; color = "#2c3e50"; break;
      case "iron_plate": symbol = "🪙"; color = "#ecf0f1"; break;
      case "copper_plate": symbol = "🪙"; color = "#e67e22"; break;
      case "gear": symbol = "⚙️"; break;
      case "copper_wire": symbol = "🧶"; color = "#f39c12"; break;
      case "electronic_circuit": symbol = "📟"; color = "#2ecc71"; break;
      case "science_pack": symbol = "🧪"; color = "#3498db"; break;
      case "wheat": symbol = "🌾"; color = "#f1c40f"; break;
      case "food": symbol = "🍞"; color = "#e67e22"; break;
      case "fish": symbol = "🐟"; color = "#3498db"; break;
    }

    ctx.fillStyle = color;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, 0, 0);
    ctx.restore();
  }

  private drawStructure(ctx: CanvasRenderingContext2D, px: number, py: number, s: StructureComponent, entId: string): void {
    const ts = 64;
    ctx.save();
    ctx.translate(px, py);

    switch (s.type) {
      case "belt": {
        // Draw Conveyor belt background (steel rollers panel)
        ctx.fillStyle = "#34495e";
        ctx.fillRect(-ts/2 + 2, -ts/2 + 2, ts - 4, ts - 4);
        ctx.strokeStyle = "#2c3e50";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-ts/2 + 2, -ts/2 + 2, ts - 4, ts - 4);

        // Animated scrolling conveyor lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 3;
        ctx.save();
        ctx.rotate((s.rotation * Math.PI) / 180);
        
        const scrollSpeed = 64; // px per sec
        const offset = (this.time * scrollSpeed) % 24;
        
        for (let lx = -ts/2 + offset - 24; lx < ts/2 + 24; lx += 24) {
          ctx.beginPath();
          ctx.moveTo(lx, -ts/4);
          ctx.lineTo(lx + 8, 0);
          ctx.lineTo(lx, ts/4);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case "inserter": {
        // Base plate circle
        ctx.fillStyle = "#7f8c8d";
        ctx.strokeStyle = "#34495e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Arm swing rendering
        ctx.save();
        ctx.rotate((s.rotation * Math.PI) / 180);
        ctx.rotate(s.inserterAngle); // Swing animation rotation angle

        ctx.strokeStyle = "#34495e";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, 0); // Extended arm
        ctx.stroke();

        ctx.strokeStyle = "#bdc3c7";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw claw
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(24, -4, 4, 8);

        // If holding an item, draw the item icon at the claw tip
        if (s.inserterHeldItemType) {
          ctx.translate(28, 0);
          ctx.rotate(-(s.rotation * Math.PI) / 180 - s.inserterAngle); // cancel rotations
          this.drawItemIcon(ctx, 0, 0, s.inserterHeldItemType);
        }
        ctx.restore();
        break;
      }

      case "drill": {
        // Heavy steel casing
        ctx.fillStyle = "#34495e";
        ctx.beginPath();
        ctx.roundRect(-24, -24, 48, 48, 6);
        ctx.fill();
        
        // Electric warning bulb showing power state
        ctx.fillStyle = s.isPowered ? "#2ecc71" : "#e74c3c";
        ctx.beginPath();
        ctx.arc(-16, -16, 4, 0, Math.PI * 2);
        ctx.fill();

        // Drilling core gear head spinning
        ctx.save();
        const spinSpeed = s.isPowered ? this.time * 9 : 0;
        ctx.rotate(spinSpeed);
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(-12, -4, 24, 8);
        ctx.fillRect(-4, -12, 8, 24);
        ctx.fillStyle = "#f1c40f";
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Direction indicator arrow
        ctx.save();
        ctx.rotate((s.rotation * Math.PI) / 180);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(12, -4);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Drill tag text
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DRILL", 0, 32);
        break;
      }
      case "advanced_drill": {
        // Heavy gold/steel casing
        ctx.fillStyle = "#d4ac0d"; // gold casing
        ctx.beginPath();
        ctx.roundRect(-24, -24, 48, 48, 6);
        ctx.fill();
        
        ctx.strokeStyle = "#9a7d0a";
        ctx.lineWidth = 2;
        ctx.strokeRect(-24, -24, 48, 48);

        // Electric warning bulb showing power state (cyan when powered)
        ctx.fillStyle = s.isPowered ? "#34e7e4" : "#e74c3c";
        ctx.beginPath();
        ctx.arc(-16, -16, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Drilling core gear head spinning (2x faster!)
        ctx.save();
        const spinSpeed = s.isPowered ? this.time * 18 : 0;
        ctx.rotate(spinSpeed);
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(-14, -5, 28, 10);
        ctx.fillRect(-5, -14, 10, 28);
        ctx.fillStyle = "#34e7e4"; // glowing drill tip
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Direction indicator arrow
        ctx.save();
        ctx.rotate((s.rotation * Math.PI) / 180);
        ctx.fillStyle = "rgba(52, 231, 228, 0.7)";
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(12, -6);
        ctx.lineTo(12, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Tag text
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ADV DRILL", 0, 32);
        break;
      }

      case "furnace": {
        // Stone brick kiln shape
        ctx.fillStyle = "#7f8c8d";
        ctx.beginPath();
        ctx.roundRect(-22, -22, 44, 44, 4);
        ctx.fill();
        ctx.strokeStyle = "#5d6d7e";
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -22, 44, 44);

        // Kiln chimney hole
        ctx.fillStyle = "#2c3e50";
        ctx.beginPath();
        ctx.arc(0, -10, 6, 0, Math.PI * 2);
        ctx.fill();

        // Fire opening
        ctx.fillStyle = "#1c2833";
        ctx.fillRect(-10, 4, 20, 12);

        // Smelting furnace flames animation
        if (s.fuel > 0) {
          const flameSize = 3 + Math.sin(this.time * 15) * 2;
          const fireGradient = ctx.createRadialGradient(0, 10, 1, 0, 10, flameSize + 2);
          fireGradient.addColorStop(0, "#fff");
          fireGradient.addColorStop(0.3, "#f1c40f");
          fireGradient.addColorStop(0.8, "#e67e22");
          fireGradient.addColorStop(1, "rgba(230,126,34,0)");
          ctx.fillStyle = fireGradient;
          ctx.beginPath();
          ctx.arc(0, 10, flameSize + 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Process progress bar
        if (s.progress > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(-16, -30, 32, 3);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(-16, -30, 32 * s.progress, 3);
        }

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FURNACE", 0, 32);
        break;
      }
      case "advanced_furnace": {
        // High-tech Electric Furnace (Steel-blue dual chimney furnace with glowing blue fire core)
        ctx.fillStyle = "#45aaf2"; // Electric steel blue casing
        ctx.beginPath();
        ctx.roundRect(-22, -22, 44, 44, 6);
        ctx.fill();
        ctx.strokeStyle = "#4b7bec";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-22, -22, 44, 44);

        // Dual chimneys
        ctx.fillStyle = "#2d98da";
        ctx.fillRect(-14, -28, 6, 8);
        ctx.fillRect(8, -28, 6, 8);

        // Electric power state bulb
        ctx.fillStyle = s.isPowered ? "#34e7e4" : "#e74c3c";
        ctx.beginPath();
        ctx.arc(-16, -16, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Energy Core opening
        ctx.fillStyle = "#1e272c";
        ctx.fillRect(-12, 2, 24, 14);

        // Electric plasma smelting glow
        if (s.isPowered && s.progress > 0) {
          const glowSize = 4 + Math.sin(this.time * 22) * 2;
          const plasmaGradient = ctx.createRadialGradient(0, 9, 1, 0, 9, glowSize + 3);
          plasmaGradient.addColorStop(0, "#fff");
          plasmaGradient.addColorStop(0.3, "#00d2d3"); // cyan glow
          plasmaGradient.addColorStop(0.8, "#54a0ff"); // blue glow
          plasmaGradient.addColorStop(1, "rgba(84,160,255,0)");
          ctx.fillStyle = plasmaGradient;
          ctx.beginPath();
          ctx.arc(0, 9, glowSize + 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Process progress bar
        if (s.progress > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(-16, -32, 32, 3);
          ctx.fillStyle = "#34e7e4";
          ctx.fillRect(-16, -32, 32 * s.progress, 3);
        }

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("E-FURNACE", 0, 32);
        break;
      }

      case "assembler": {
        // Industrial factory assembly machine casing
        ctx.fillStyle = "#2ecc71"; // green structure
        ctx.beginPath();
        ctx.roundRect(-24, -24, 48, 48, 8);
        ctx.fill();
        ctx.strokeStyle = "#27ae60";
        ctx.lineWidth = 2;
        ctx.strokeRect(-24, -24, 48, 48);

        // Electric power state indicator
        ctx.fillStyle = s.isPowered ? "#34e7e4" : "#e74c3c";
        ctx.beginPath();
        ctx.arc(-16, -16, 4, 0, Math.PI * 2);
        ctx.fill();

        // Assembly gear rotating animation
        ctx.save();
        const spin = s.isPowered && s.progress > 0 ? this.time * 6 : 0;
        ctx.translate(0, -2);
        ctx.rotate(spin);
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillStyle = "#2c3e50";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Production progress bar
        if (s.progress > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(-16, -32, 32, 3);
          ctx.fillStyle = "#34e7e4";
          ctx.fillRect(-16, -32, 32 * s.progress, 3);
        }

        // Active recipe tag symbol
        if (s.activeRecipe) {
          ctx.fillStyle = "#fff";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          let label = "⚙️";
          if (s.activeRecipe === "copper_wire") label = "🧶";
          else if (s.activeRecipe === "electronic_circuit") label = "📟";
          else if (s.activeRecipe === "science_pack") label = "🧪";
          ctx.fillText(label, 0, 16);
        }

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ASSEMBLER", 0, 32);
        break;
      }

      case "chest": {
        // Wooden storage box
        ctx.fillStyle = "#d35400";
        ctx.beginPath();
        ctx.roundRect(-20, -18, 40, 36, 3);
        ctx.fill();
        ctx.strokeStyle = "#5c3a21";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-20, -18, 40, 36);

        // Iron bands
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(-14, -18, 3, 36);
        ctx.fillRect(11, -18, 3, 36);
        
        // Iron latch
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(-3, -4, 6, 8);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CHEST", 0, 30);
        break;
      }

      case "pole": {
        // Wooden post shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 16, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wooden pole vertical shaft
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(-3, -20, 6, 36);
        
        // Crossbar
        ctx.fillRect(-14, -14, 28, 5);

        // Ceramic insulators (top connector nodes)
        ctx.fillStyle = "#ecf0f1";
        ctx.fillRect(-14, -18, 4, 4);
        ctx.fillRect(10, -18, 4, 4);
        break;
      }

      case "generator": {
        // Generator structure (dark iron boiler casing)
        ctx.fillStyle = "#2c3e50";
        ctx.beginPath();
        ctx.roundRect(-26, -22, 52, 44, 6);
        ctx.fill();
        ctx.strokeStyle = "#1a252f";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-26, -22, 52, 44);

        // Exhaust smoke pipe stack
        ctx.fillStyle = "#34495e";
        ctx.fillRect(12, -34, 8, 14);

        // Fire opening
        ctx.fillStyle = "#111";
        ctx.fillRect(-14, 6, 28, 12);

        // Generator fuel flame pulse
        if (s.fuel > 0) {
          const flameSize = 4 + Math.sin(this.time * 20) * 2;
          const fireGradient = ctx.createRadialGradient(0, 12, 1, 0, 12, flameSize + 3);
          fireGradient.addColorStop(0, "#fff");
          fireGradient.addColorStop(0.3, "#f1c40f");
          fireGradient.addColorStop(0.8, "#e67e22");
          fireGradient.addColorStop(1, "rgba(230,126,34,0)");
          ctx.fillStyle = fireGradient;
          ctx.beginPath();
          ctx.arc(0, 12, flameSize + 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GENERATOR", 0, 32);
        break;
      }

      case "storage_house": {
        // Red barn style storage house
        // Roof shadow
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(-22, 12, 44, 4);

        // Main walls (red wood)
        ctx.fillStyle = "#962d2d";
        ctx.beginPath();
        ctx.roundRect(-20, -14, 40, 28, 3);
        ctx.fill();
        ctx.strokeStyle = "#5a1818";
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -14, 40, 28);

        // Barn roof (dark gray/black metal slats)
        ctx.fillStyle = "#353b48";
        ctx.beginPath();
        ctx.moveTo(-24, -14);
        ctx.lineTo(0, -32);
        ctx.lineTo(24, -14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#2f3640";
        ctx.stroke();

        // Big wooden double doors
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(-12, 2, 24, 12);
        ctx.strokeStyle = "#4d3013";
        ctx.strokeRect(-12, 2, 24, 12);
        // Center split line
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, 14);
        ctx.stroke();

        // Barn window
        ctx.fillStyle = "#f1c40f"; // yellow glowing window
        ctx.fillRect(-6, -10, 12, 6);
        ctx.strokeStyle = "#2f3640";
        ctx.strokeRect(-6, -10, 12, 6);

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("STORAGE", 0, 26);
        break;
      }

      case "worker_house": {
        // Blue cozy cottage style worker house
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(-20, 14, 40, 3);

        // Cottage walls (light blue wood panels)
        ctx.fillStyle = "#4682b4";
        ctx.beginPath();
        ctx.roundRect(-18, -12, 36, 26, 3);
        ctx.fill();
        ctx.strokeStyle = "#244d70";
        ctx.lineWidth = 2;
        ctx.strokeRect(-18, -12, 36, 26);

        // Roof (slanted warm orange clay tiles)
        ctx.fillStyle = "#d35400";
        ctx.beginPath();
        ctx.moveTo(-22, -12);
        ctx.lineTo(0, -28);
        ctx.lineTo(22, -12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#a04000";
        ctx.stroke();

        // Little chimney
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(8, -26, 6, 12);

        // Cozy front door
        ctx.fillStyle = "#8a5a3b";
        ctx.fillRect(-10, 2, 8, 12);
        ctx.fillStyle = "#f1c40f"; // brass doorknob
        ctx.beginPath();
        ctx.arc(-4, 8, 1, 0, Math.PI * 2);
        ctx.fill();

        // Cozy square window
        ctx.fillStyle = "#3b8c88"; // glass blue
        ctx.fillRect(4, -2, 8, 8);
        ctx.strokeStyle = "#244d70";
        ctx.strokeRect(4, -2, 8, 8);
        // Window cross
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.beginPath();
        ctx.moveTo(8, -2); ctx.lineTo(8, 6);
        ctx.moveTo(4, 2); ctx.lineTo(12, 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WORKER HS", 0, 26);
        break;
      }
      case "crop": {
        // Draw soil patch under the crop (dark brown if watered, dry brown if dry)
        ctx.fillStyle = s.isWatered ? "#3e2723" : "#8d6e63";
        ctx.beginPath();
        ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        if (s.cropGrowth < 0.4) {
          // Stage 1: Small green shoots
          ctx.strokeStyle = "#2ecc71"; // vibrant green
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          // Left shoot
          ctx.beginPath();
          ctx.moveTo(-6, 10);
          ctx.quadraticCurveTo(-10, 2, -8, -2);
          ctx.stroke();
          // Right shoot
          ctx.beginPath();
          ctx.moveTo(6, 10);
          ctx.quadraticCurveTo(10, 4, 8, 0);
          ctx.stroke();
          // Center shoot
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.quadraticCurveTo(0, 0, 2, -4);
          ctx.stroke();
        } else if (s.cropGrowth < 0.85) {
          // Stage 2: Growing taller, yellowish-green
          ctx.strokeStyle = "#a3cb38"; // yellowish green
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          
          // Left stalk
          ctx.beginPath();
          ctx.moveTo(-8, 10);
          ctx.quadraticCurveTo(-14, -2, -10, -10);
          ctx.stroke();
          // Right stalk
          ctx.beginPath();
          ctx.moveTo(8, 10);
          ctx.quadraticCurveTo(14, 0, 10, -8);
          ctx.stroke();
          // Center stalk
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.quadraticCurveTo(-2, -6, 0, -14);
          ctx.stroke();
        } else {
          // Stage 3: Fully grown golden wheat
          ctx.strokeStyle = "#f1c40f"; // golden yellow
          ctx.lineWidth = 3.5;
          ctx.lineCap = "round";
          
          // Draw three stalks of golden wheat
          // Stalk 1 (Left)
          ctx.beginPath();
          ctx.moveTo(-10, 10);
          ctx.quadraticCurveTo(-18, -4, -12, -18);
          ctx.stroke();
          // Stalk 2 (Center)
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.quadraticCurveTo(-2, -10, 0, -22);
          ctx.stroke();
          // Stalk 3 (Right)
          ctx.beginPath();
          ctx.moveTo(10, 10);
          ctx.quadraticCurveTo(18, -2, 12, -16);
          ctx.stroke();

          // Draw golden wheat heads (little ovals/filled circles at the top of stalks)
          ctx.fillStyle = "#f39c12"; // dark orange-yellow for depth
          ctx.beginPath();
          ctx.arc(-12, -18, 4, 0, Math.PI * 2);
          ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
          ctx.arc(12, -16, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Draw growth percentage text if not fully grown
        if (s.cropGrowth < 1.0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.font = "8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${Math.floor(s.cropGrowth * 100)}%`, 0, -28);

          if (!s.isWatered) {
            ctx.fillStyle = "#3498db";
            ctx.font = "10px sans-serif";
            ctx.fillText("💧", 0, -38);
          }
        } else {
          ctx.fillStyle = "#f1c40f";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("READY", 0, -28);
        }
        break;
      }
    }

    ctx.restore();
  }

  private drawFactoryHUD(width: number, height: number, inventory: Record<string, number>): void {
    // 1. Draw Active build preview panel in Top Right
    const toolW = 200;
    const toolH = 80;
    this.ctx.fillStyle = "rgba(44, 62, 80, 0.8)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.roundRect(width - toolW - 16, 16, toolW, toolH, 8);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 13px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText("Active Blueprint", width - toolW, 36);

    this.ctx.fillStyle = "#f1c40f";
    this.ctx.font = "bold 15px sans-serif";
    this.ctx.fillText(this.activeTool.toUpperCase(), width - toolW, 58);
    this.ctx.fillStyle = "#bdc3c7";
    this.ctx.font = "10px sans-serif";
    this.ctx.fillText("Press [R] to rotate blueprint", width - toolW, 76);

    // 2. Draw Bottom Inventory Grid panel
    const list = Object.entries(inventory).filter(([_, count]) => count > 0);
    const itemsPerRow = 4;
    const rows = Math.max(1, Math.ceil(list.length / itemsPerRow));
    const invW = 540;
    const invH = 30 + rows * 20;
    const invX = (width - invW) / 2;
    const invY = height - invH - 75; // above instructions

    this.ctx.fillStyle = "rgba(30, 39, 44, 0.85)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.roundRect(invX, invY, invW, invH, 8);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#fff";
    this.ctx.font = "bold 10px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText("PLAYER INVENTORY STOCK:", invX + 12, invY + 18);

    // Draw inventory columns
    let colX = invX + 12;
    let currentY = invY + 38;
    this.ctx.font = "11px monospace";

    if (list.length === 0) {
      this.ctx.fillStyle = "#7f8c8d";
      this.ctx.fillText("Empty inventory (mine wood/stone/veins automatically with drills)", invX + 12, invY + 38);
    } else {
      let idx = 0;
      for (const [name, count] of list) {
        if (idx > 0 && idx % itemsPerRow === 0) {
          colX = invX + 12;
          currentY += 20;
        }

        let symbol = "📦";
        if (name === "wood") symbol = "🪵";
        else if (name === "stone") symbol = "🪨";
        else if (name === "iron_ore") symbol = "⚪";
        else if (name === "copper_ore") symbol = "🟤";
        else if (name === "coal") symbol = "⚫";
        else if (name === "iron_plate") symbol = "🪙";
        else if (name === "copper_plate") symbol = "銅";
        else if (name === "gear") symbol = "⚙️";
        else if (name === "copper_wire") symbol = "🧶";
        else if (name === "electronic_circuit") symbol = "📟";
        else if (name === "science_pack") symbol = "🧪";
        else if (name === "road") symbol = "🛣️";
        else if (name === "storage_house") symbol = "🏠";
        else if (name === "worker_house") symbol = "🏡";
        else if (name === "wheat") symbol = "🌾";
        else if (name === "food") symbol = "🍞";

        this.ctx.fillStyle = "#f1c40f";
        this.ctx.fillText(`${symbol} ${name.replace("_", " ")}:`, colX, currentY);
        this.ctx.fillStyle = "#fff";
        this.ctx.fillText(count.toString(), colX + this.ctx.measureText(`${symbol} ${name.replace("_", " ")}: `).width, currentY);

        colX += 130;
        idx++;
      }
    }
  }

  private drawWorker(ctx: CanvasRenderingContext2D, px: number, py: number, w: WorkerComponent): void {
    ctx.save();
    ctx.translate(px, py);

    // Draw shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (warm orange worker shirt / dungarees)
    ctx.fillStyle = "#e67e22";
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(6, 10);
    ctx.lineTo(5, -2);
    ctx.lineTo(-5, -2);
    ctx.closePath();
    ctx.fill();

    // Dark grey pants
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(-6, 8, 12, 3);

    // Head
    ctx.fillStyle = "#f3d1b0";
    ctx.beginPath();
    ctx.arc(0, -7, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Worker Cap (Safety yellow hard hat)
    ctx.fillStyle = "#f1c40f";
    ctx.beginPath();
    ctx.ellipse(0, -11, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -12, 3.5, Math.PI, 0, false);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#000";
    ctx.fillRect(-2, -8, 1, 1);
    ctx.fillRect(1, -8, 1, 1);

    // Draw tool held in hand based on role
    ctx.strokeStyle = "#7f8c8d";
    ctx.lineWidth = 1.5;
    
    if (w.role === "woodcutter") {
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(-10, -6);
      ctx.stroke();
      
      ctx.fillStyle = "#bdc3c7";
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(-14, -8);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-8, -10);
      ctx.closePath();
      ctx.fill();
    } else if (w.role === "miner") {
      ctx.beginPath();
      ctx.moveTo(-4, 2);
      ctx.lineTo(-10, -6);
      ctx.stroke();

      ctx.strokeStyle = "#7f8c8d";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(-13, -9, 5, -Math.PI / 4, Math.PI / 2);
      ctx.stroke();
    } else if (w.role === "farmer") {
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(-12, -8);
      ctx.stroke();

      ctx.strokeStyle = "#f1c40f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(-16, -11);
      ctx.moveTo(-12, -8);
      ctx.lineTo(-14, -13);
      ctx.moveTo(-12, -8);
      ctx.lineTo(-10, -11);
      ctx.stroke();
    }

    // Draw held item on their head if carrying resources
    if (w.heldItem) {
      ctx.save();
      ctx.translate(0, -24);
      this.drawItemIcon(ctx, 0, 0, w.heldItem);
      ctx.restore();
    }

    // Draw Hunger Status Bar / Warning Bubble
    if (w.isStarving) {
      // Blinking red warning bubble
      const pulse = Math.abs(Math.sin(this.time * 6.0));
      ctx.fillStyle = `rgba(231, 76, 60, ${0.45 + pulse * 0.55})`;
      ctx.beginPath();
      ctx.roundRect(-24, -22, 48, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 6.5px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("STARVING", 0, -18);
    } else if (w.hunger < 25) {
      // Low hunger warning bar
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(-10, -18, 20, 3);
      ctx.fillStyle = "#e67e22"; // orange warning
      ctx.fillRect(-10, -18, 20 * (w.hunger / 100), 3);
    }

    ctx.restore();
  }

  private drawWorkerPath(ctx: CanvasRenderingContext2D, w: WorkerComponent, ts: number): void {
    ctx.save();
    ctx.strokeStyle = "rgba(52, 231, 228, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();

    const startNode = w.path[w.pathIndex];
    if (startNode) {
      ctx.moveTo(startNode[1] * ts + ts / 2, startNode[0] * ts + ts / 2);
      for (let i = w.pathIndex + 1; i < w.path.length; i++) {
        const node = w.path[i];
        ctx.lineTo(node[1] * ts + ts / 2, node[0] * ts + ts / 2);
      }
      ctx.stroke();
      
      const endNode = w.path[w.path.length - 1];
      if (endNode) {
        ctx.fillStyle = "rgba(52, 231, 228, 0.6)";
        ctx.beginPath();
        ctx.arc(endNode[1] * ts + ts / 2, endNode[0] * ts + ts / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
