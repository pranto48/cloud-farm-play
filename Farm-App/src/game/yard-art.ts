import type { Tile, TileKind } from "./meadow-life";

const groundTextures = new Map<string, HTMLCanvasElement>();
const orePalette: Partial<Record<TileKind, [string, string, string]>> = {
  ore_iron: ["#343233", "#817b79", "#b7a590"],
  ore_copper: ["#392a27", "#94604a", "#e0a478"],
  ore_coal: ["#1e2120", "#3c4544", "#8e9690"],
  ore_gold: ["#4a3e29", "#ad8649", "#dfbb69"],
  ore_silver: ["#373c40", "#819296", "#c4cfcb"],
  ore_aluminum: ["#3e3c38", "#797b70", "#afb09c"],
  ore_uranium: ["#293622", "#678653", "#b9c87f"],
};

function polygon(ctx: CanvasRenderingContext2D, color: string, points: number[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function paintGround(ctx: CanvasRenderingContext2D, variant: number, palette?: [string, string, string], gravel = false) {
  let seed = (variant + 1) * 812731;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 54; i++) {
    const x = random() * 32;
    const y = random() * 32;
    const highlight = i % 3 === 0;
    ctx.fillStyle = highlight ? "rgba(228,201,148,.15)" : "rgba(29,28,17,.23)";
    ctx.fillRect(x, y, 0.7 + random() * (gravel ? 3.8 : 2), 0.6 + random() * 1.3);
  }

  if (palette) {
    for (let i = 0; i < 13; i++) {
      const x = 2 + random() * 28;
      const y = 2 + random() * 28;
      const r = 1.3 + random() * 3.6;
      polygon(ctx, palette[0], [x - r, y, x - r * .65, y - r * .65, x + r * .55, y - r, x + r, y, x + r * .3, y + r * .65]);
      polygon(ctx, palette[1], [x - r * .82, y - .8, x - r * .6, y - r * .6, x + r * .55, y - r, x + r * .5, y + .4]);
      polygon(ctx, palette[2], [x - r * .4, y - r * .38, x + r * .55, y - r, x + r * .23, y - r * .35]);
    }
  } else if (!gravel && variant % 3 === 0) {
    for (let i = 0; i < 6; i++) {
      const x = 3 + random() * 26;
      const y = 5 + random() * 24;
      polygon(ctx, i % 2 === 0 ? "#7f8253" : "#50543a", [x - .8, y, x - 1.9, y - 3.2, x, y - 1.2, x + 1.4, y - 4.6, x + .9, y]);
    }
  }
}

export function drawGroundDetail(ctx: CanvasRenderingContext2D, x: number, y: number, kind: TileKind) {
  const variant = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 19;
  const palette = orePalette[kind];
  const gravel = kind === "path";
  const key = `${palette ? kind : gravel ? "gravel" : "grass"}/${variant}`;
  let texture = groundTextures.get(key);
  if (!texture) {
    texture = document.createElement("canvas");
    texture.width = texture.height = 32;
    paintGround(texture.getContext("2d")!, variant, palette, gravel);
    groundTextures.set(key, texture);
  }
  ctx.drawImage(texture, x * 32, y * 32);
}

const directionAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function drawConveyor(ctx: CanvasRenderingContext2D, px: number, py: number, tile: Tile, now: number) {
  const id = tile.placedItemId!;
  const color = id.includes("turbo") ? "#8eab72" : id.includes("express") ? "#76a6aa" : id.includes("fast") ? "#bf7259" : "#b79c62";
  const rate = id.includes("turbo") ? 7.2 : id.includes("express") ? 5.4 : id.includes("fast") ? 3.6 : 1.8;
  ctx.save();
  ctx.translate(px + 16, py + 16);
  ctx.rotate(directionAngle[tile.direction ?? "right"]);
  ctx.fillStyle = "#242523";
  ctx.fillRect(-16, -13, 32, 27);
  ctx.fillStyle = "#4a4b43";
  ctx.fillRect(-16, -10, 32, 20);
  ctx.fillStyle = "#30332f";
  ctx.fillRect(-16, -9, 32, 8);
  ctx.fillRect(-16, 1, 32, 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-16, -9, 32, 18);
  ctx.clip();
  const shift = (now * rate * .032) % 4;
  for (let x = -20 + shift; x < 17; x += 4) {
    ctx.fillStyle = "#53554d";
    ctx.fillRect(x, -9, .8, 18);
    ctx.fillStyle = "#242823";
    ctx.fillRect(x + 1.1, -9, 1, 18);
  }
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fillRect(-16, -12, 32, 2);
  ctx.fillRect(-16, 10, 32, 2);
  polygon(ctx, color, [3, -2, 7, 0, 3, 2, 4.5, 0]);
  if (id.includes("underground") || id.includes("splitter") || id.includes("loader")) {
    ctx.fillStyle = "#6d7266";
    ctx.fillRect(-15, -14, 8, 28);
    ctx.fillStyle = color;
    ctx.fillRect(-14, -12, 2, 24);
  }
  for (const item of tile.beltItems ?? []) {
    const x = -15 + item.offset * 30;
    const y = item.lane === 0 ? -5.5 : 5.5;
    const ore = item.id.includes("ore") || item.id === "coal" || item.id === "stone";
    const material = item.id.includes("copper") ? "#d99775" : item.id === "coal" ? "#646d65" : "#c2c8ba";
    if (ore) {
      polygon(ctx, "#1c231e", [x - 3.5, y, x - 2, y - 2.5, x + 1.8, y - 2.9, x + 3.4, y + 1, x + 1.5, y + 3, x - 2.5, y + 2.5]);
      polygon(ctx, material, [x - 2.7, y - .3, x - 1.6, y - 2.2, x + 1.6, y - 2.6, x + 2, y]);
    } else {
      polygon(ctx, "#222724", [x - 3.5, y - 1, x + 1, y - 2.7, x + 3.5, y + 1, x - 1, y + 3]);
      polygon(ctx, material, [x - 3.2, y - 1.7, x + 1, y - 3.5, x + 3.1, y, x - 1.3, y + 1.6]);
    }
  }
  ctx.restore();
}

export function drawYardMachine(ctx: CanvasRenderingContext2D, px: number, py: number, t: Tile, now: number): boolean {
  const id = t.placedItemId!;
  const drill = id.includes("drill");
  const furnace = id === "furnace" || id.endsWith("_furnace");
  const inserter = id.includes("inserter");
  if (!drill && !furnace && !inserter) return false;

  const running = t.machineStatus === "running";
  ctx.save();
  ctx.translate(px + 16, py + 17);
  ctx.fillStyle = "rgba(17,22,17,.28)";
  ctx.beginPath();
  ctx.ellipse(4, 8, inserter ? 10 : 16, inserter ? 6 : 10, -.18, 0, Math.PI * 2);
  ctx.fill();

  if (furnace) {
    const stone = id === "stone_furnace" || id === "furnace";
    polygon(ctx, "#252925", [-13, 11, -12, -6, -7, -13, 8, -13, 13, -6, 13, 9, 8, 14, -8, 14]);
    polygon(ctx, stone ? "#81715f" : "#65736d", [-11, -6, -7, -12, 7, -12, 11, -6, 10, 8, -10, 8]);
    polygon(ctx, stone ? "#a79a80" : "#93a397", [-11, -6, -7, -12, 7, -12, 11, -6, 7, -4, -8, -4]);
    ctx.fillStyle = stone ? "#625440" : "#47554e";
    ctx.fillRect(-10, 7, 20, 6);
    ctx.fillStyle = "#272822";
    ctx.fillRect(-5, -11, 10, 4);
    ctx.fillRect(-7, 0, 14, 9);
    if (running) {
      const flare = 1.6 + Math.sin(now * .015) * .8;
      ctx.fillStyle = "#ab542c";
      ctx.fillRect(-6, 2, 12, 6);
      polygon(ctx, "#ffc57e", [-4, 7, -3, 3, -1, 5, 1, 5 - flare, 4, 7]);
    }
    ctx.fillStyle = stone ? "#ad9a77" : "#9cb2a5";
    ctx.fillRect(-9, -2, 2, 10);
    ctx.fillRect(7, -2, 2, 10);
  } else {
    ctx.rotate(directionAngle[t.direction ?? "right"]);
    if (drill) {
      ctx.fillStyle = "#252e28";
      ctx.fillRect(-15, -12, 28, 24);
      ctx.fillStyle = "#666852";
      ctx.fillRect(-14, -11, 24, 5);
      ctx.fillRect(-14, 6, 24, 5);
      ctx.fillStyle = "#afa178";
      ctx.fillRect(-13, -10, 22, 1);
      ctx.fillRect(-13, 7, 22, 1);
      polygon(ctx, "#3e4942", [-12, 5, -12, -6, -8, -10, 6, -10, 9, 3, 7, 6]);
      ctx.fillStyle = id === "burner_drill" ? "#b36e49" : "#779891";
      ctx.fillRect(-10, -7, 16, 11);
      ctx.fillStyle = "#373c34";
      for (let x = -8; x <= 2; x += 2.5) ctx.fillRect(x, -5, 1.2, 7);
      polygon(ctx, "#918b73", [6, -5, 13, -4, 16, -2, 16, 3, 12, 4, 6, 2]);
      ctx.fillStyle = "#392f25";
      ctx.fillRect(12, -2, 4, 4);
      ctx.fillStyle = running ? "#f3c98b" : "#655d46";
      ctx.fillRect(-11, 2, 3, 2);
    } else {
      ctx.fillStyle = "#343c35";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeStyle = "#858575";
      ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.rotate(t.inserterArmAngle ?? -Math.PI);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#292e26";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(6, -3);
      ctx.lineTo(13, 0);
      ctx.stroke();
      ctx.strokeStyle = id === "burner_inserter" ? "#b08451" : "#a1a98a";
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.fillStyle = "#292e26";
      ctx.fillRect(11, -2.5, 4, 5);
      if (t.inserterHolding) {
        ctx.fillStyle = "#e1bb89";
        ctx.fillRect(13, -1.6, 3, 3.2);
      }
    }
  }
  ctx.restore();

  if (running && (drill || furnace) && id !== "electric_furnace" && id !== "electric_drill") {
    for (let i = 0; i < (furnace ? 4 : 2); i++) {
      const phase = ((now * .00085 + i * .27 + px * .007 + py * .003) % 1 + 1) % 1;
      ctx.fillStyle = `rgba(112,109,91,${(1 - phase) * .25})`;
      ctx.beginPath();
      ctx.ellipse(px + 15 + phase * 22, py + 7 - phase * 31, 2 + phase * 8, 2 + phase * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return true;
}

const hotbarIcons = new Map<string, string>();
export function getYardItemIcon(id: string): string | undefined {
  if (!/drill|furnace|inserter|transport_belt/.test(id) || typeof document === "undefined") return;
  const cached = hotbarIcons.get(id);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);
  const tile: Tile = { kind: "placed_item", age: 0, watered: false, placedItemId: id };
  if (id.includes("transport_belt")) drawConveyor(ctx, 0, 0, tile, 0);
  else if (!drawYardMachine(ctx, 0, 0, tile, 0)) return;
  const icon = canvas.toDataURL();
  hotbarIcons.set(id, icon);
  return icon;
}
