import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  RenderComponent,
  PlayerComponent,
  ParticleComponent,
  MapComponent,
  StructureComponent,
  InputComponent,
  ItemComponent,
  ItemType,
  TileType,
} from "../components/GameComponents";

export class RenderSystem extends System {
  readonly requiredComponents = [PositionComponent];
  private time: number = 0;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public activeTool: string = "belt";

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

    // 1. Locate player to focus camera
    const players = world.getEntitiesWith([PlayerComponent, PositionComponent]);
    let camX = 0;
    let camY = 0;
    let playerEntityId = "";
    let playerInventory: Record<string, number> = {};
    let buildRotation = 90;

    let inputComp: InputComponent | undefined;
    if (players.length > 0) {
      playerEntityId = players[0];
      const pPos = world.getComponent(playerEntityId, PositionComponent)!;
      const pComp = world.getComponent(playerEntityId, PlayerComponent)!;
      inputComp = world.getComponent(playerEntityId, InputComponent);
      camX = pPos.x - width / 2;
      camY = pPos.y - height / 2;
      playerInventory = pComp.inventory;
      buildRotation = pComp.buildRotation;
    }

    // 2. Background slate
    this.ctx.fillStyle = "#1b1e22";
    this.ctx.fillRect(0, 0, width, height);

    // Translate view relative to camera
    this.ctx.save();
    this.ctx.translate(-camX, -camY);

    // 3. Render Map
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length > 0) {
      const mapEntity = maps[0];
      const map = world.getComponent(mapEntity, MapComponent)!;
      const ts = map.tileSize;

      // Visible bounds culling
      const startCol = Math.max(0, Math.floor(camX / ts));
      const endCol = Math.min(map.width - 1, Math.ceil((camX + width) / ts));
      const startRow = Math.max(0, Math.floor(camY / ts));
      const endRow = Math.min(map.height - 1, Math.ceil((camY + height) / ts));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const type = map.tiles[r][c];
          const tx = c * ts;
          const ty = r * ts;

          // Draw Biomes
          if (type === "grass") {
            this.ctx.fillStyle = (c + r) % 2 === 0 ? "#55b058" : "#4c9e4f"; // Cozy organic greens
            this.ctx.fillRect(tx, ty, ts, ts);
            // Grass blades
            if ((c * 3 + r * 7) % 13 === 0) {
              this.ctx.fillStyle = "#3d823f";
              this.ctx.fillRect(tx + 12, ty + 16, 2, 4);
              this.ctx.fillRect(tx + 44, ty + 36, 2, 4);
            }
          } else if (type === "water") {
            this.ctx.fillStyle = "#3b6e8c";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Wave shimmers
            const wave = Math.sin(this.time * 2.0 + c * 0.5) * 3;
            this.ctx.fillStyle = "#4c81a3";
            this.ctx.fillRect(tx + 16, ty + 24 + wave, 12, 1.5);
            this.ctx.fillRect(tx + 32, ty + 48 - wave, 16, 1.5);
          } else if (type === "stone") {
            this.ctx.fillStyle = "#7f8c8d";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Cobble lines
            this.ctx.fillStyle = "#6d797a";
            this.ctx.fillRect(tx + 4, ty + 4, ts - 8, ts - 8);
            this.ctx.fillStyle = "#454d4f";
            this.ctx.fillRect(tx + 8, ty + 30, 48, 3);
          } else if (type === "forest") {
            this.ctx.fillStyle = "#4c9e4f";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Green pine cone tree shape
            this.ctx.fillStyle = "#1e5e22";
            this.ctx.beginPath();
            this.ctx.moveTo(tx + ts / 2, ty + 6);
            this.ctx.lineTo(tx + 10, ty + 48);
            this.ctx.lineTo(tx + ts - 10, ty + 48);
            this.ctx.closePath();
            this.ctx.fill();
            // Trunk
            this.ctx.fillStyle = "#4d3013";
            this.ctx.fillRect(tx + ts / 2 - 3, ty + 48, 6, 8);
          } else if (type === "iron") {
            this.ctx.fillStyle = "#6d797a";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Iron nodes
            this.ctx.fillStyle = "#d5dbdb"; // Shiny white-silver ore veins
            this.ctx.fillRect(tx + 12, ty + 12, 12, 12);
            this.ctx.fillRect(tx + 36, ty + 36, 14, 14);
            this.ctx.fillStyle = "#7f8c8d";
            this.ctx.fillRect(tx + 16, ty + 32, 10, 10);
          } else if (type === "copper") {
            this.ctx.fillStyle = "#6d797a";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Copper nodes
            this.ctx.fillStyle = "#d35400"; // Glowing metallic orange copper veins
            this.ctx.fillRect(tx + 14, ty + 14, 10, 10);
            this.ctx.fillRect(tx + 32, ty + 32, 14, 14);
            this.ctx.fillStyle = "#e67e22";
            this.ctx.fillRect(tx + 38, ty + 12, 12, 12);
          } else if (type === "coal") {
            this.ctx.fillStyle = "#6d797a";
            this.ctx.fillRect(tx, ty, ts, ts);
            // Coal nodes
            this.ctx.fillStyle = "#111111"; // Charcoal black chunks
            this.ctx.fillRect(tx + 10, ty + 16, 12, 12);
            this.ctx.fillRect(tx + 34, ty + 32, 14, 14);
            this.ctx.fillStyle = "#2c3e50";
            this.ctx.fillRect(tx + 32, ty + 10, 10, 10);
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
      return { ent, pos, isItem, isStructure, isParticle };
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
    const invW = 540;
    const invH = 65;
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
    const list = Object.entries(inventory).filter(([_, count]) => count > 0);
    let colX = invX + 12;
    this.ctx.font = "11px monospace";

    if (list.length === 0) {
      this.ctx.fillStyle = "#7f8c8d";
      this.ctx.fillText("Empty inventory (mine wood/stone/veins automatically with drills)", invX + 12, invY + 40);
    } else {
      for (const [name, count] of list) {
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

        this.ctx.fillStyle = "#f1c40f";
        this.ctx.fillText(`${symbol} ${name.replace("_", " ")}:`, colX, invY + 42);
        this.ctx.fillStyle = "#fff";
        this.ctx.fillText(count.toString(), colX + this.ctx.measureText(`${symbol} ${name.replace("_", " ")}: `).width, invY + 42);

        colX += 115;
      }
    }
  }
}
