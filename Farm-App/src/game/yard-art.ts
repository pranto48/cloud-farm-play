import type { Tile, TileKind } from "./meadow-life";

const groundTextures = new Map<string, HTMLCanvasElement>();
const orePalette: Partial<Record<TileKind, [string, string, string]>> = {
  ore_iron: ["#333b39", "#6f8586", "#b3bcaa"],
  ore_copper: ["#452f23", "#a16b46", "#d4a377"],
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
    for (let i = 0; i < 17; i++) {
      const x = 2 + random() * 28;
      const y = 2 + random() * 28;
      const r = 1.8 + random() * 4.2;
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
  if (typeof document === "undefined") return;
  const cached = hotbarIcons.get(id);
  if (cached !== undefined) return cached || undefined;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);
  const icon = drawWorkshopItem(ctx, id, 0, 0) ? canvas.toDataURL() : "";
  hotbarIcons.set(id, icon);
  return icon || undefined;
}

function artRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const trees = new Map<string, HTMLCanvasElement>();
export function drawEvergreen(ctx: CanvasRenderingContext2D, x: number, y: number, season: string, shake: number, shadows: boolean) {
  const variant = ((Math.imul(x, 43103) ^ Math.imul(y, 59797)) >>> 0) % 12;
  const key = `${season}/${variant}`;
  let sprite = trees.get(key);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = 66;
    sprite.height = 78;
    const paint = sprite.getContext("2d")!;
    const rand = artRandom(variant + 3141);
    const palette = season === "fall" ? ["#45442b", "#6b6640", "#a18b51"]
      : season === "winter" ? ["#334338", "#4f6256", "#9eaea1"]
      : ["#29352a", "#4a573b", "#77805a"];
    polygon(paint, "#443d2d", [29, 72, 28, 42, 33, 26, 37, 72, 43, 76, 25, 76]);
    polygon(paint, "#827053", [30, 72, 32, 45, 34, 69, 36, 74]);
    const spruce = variant % 4 !== 3;
    if (spruce) {
      const tip = 3 + Math.floor(rand() * 10);
      for (let layer = 4; layer >= 0; layer--) {
        const y0 = tip + layer * 8;
        const width = 9 + layer * 4.6 + rand() * 3;
        const lean = (rand() - .5) * 7;
        polygon(paint, palette[0], [33 + lean, y0, 33 + width, y0 + 17, 37 + width * .8, y0 + 20, 35, y0 + 24, 29, y0 + 21, 33 - width, y0 + 22, 31 - width, y0 + 18]);
        polygon(paint, palette[1], [33 + lean, y0 + 1, 33 + width * .61, y0 + 16, 31, y0 + 18, 30 - width * .82, y0 + 19]);
        for (let tuft = 0; tuft < 12; tuft++) {
          const sx = 32 + (rand() - .55) * width * 1.56;
          const sy = y0 + 7 + rand() * 12;
          const distance = Math.abs(sx - 32);
          if (distance > (sy - y0) * width / 21) continue;
          polygon(paint, tuft % 3 ? palette[1] : palette[2], [sx, sy - 3, sx + 2, sy, sx + (rand() - .5) * 5, sy + 1]);
        }
      }
    } else {
      for (let n = 0; n < 29; n++) {
        const angle = rand() * Math.PI * 2;
        const radius = Math.sqrt(rand());
        const x = 32 + Math.cos(angle) * 19 * radius;
        const y = 34 + Math.sin(angle) * 25 * radius;
        const r = 4.5 + rand() * 8;
        paint.fillStyle = palette[n > 21 && y < 39 ? 2 : n > 10 ? 1 : 0];
        paint.beginPath();
        paint.ellipse(x, y, r, r * .8, .42, 0, Math.PI * 2);
        paint.fill();
      }
    }
    trees.set(key, sprite);
  }
  const px = x * 32;
  const py = y * 32;
  if (shadows) {
    ctx.fillStyle = "rgba(28,32,21,.28)";
    ctx.beginPath();
    ctx.ellipse(px + 25, py + 26, 26, 10, -.31, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(sprite, px - 17 + shake, py - 45);
}

const waters = new Map<string, HTMLCanvasElement>();
export function drawBasinWater(ctx: CanvasRenderingContext2D, x: number, y: number, shore: number, now: number, animate: boolean) {
  const variant = ((Math.imul(x, 41143) ^ Math.imul(y, 569)) >>> 0) % 6;
  const key = `${variant}/${shore}`;
  let image = waters.get(key);
  if (!image) {
    image = document.createElement("canvas");
    image.width = image.height = 32;
    const paint = image.getContext("2d")!;
    const rand = artRandom(1201 + variant * 47);
    paint.fillStyle = "#263f3e";
    paint.fillRect(0, 0, 32, 32);
    for (let n = 0; n < 32; n++) {
      paint.fillStyle = n % 3 ? "rgba(97,131,117,.11)" : "rgba(19,33,32,.16)";
      const x0 = rand() * 32;
      const y0 = rand() * 32;
      paint.fillRect(x0, y0, 3 + rand() * 6, .6 + rand());
    }
    for (let edge = 0; edge < 4; edge++) {
      if (!(shore & 1 << edge)) continue;
      paint.save();
      paint.translate(16, 16);
      paint.rotate(edge * Math.PI * .5);
      paint.translate(-16, -16);
      polygon(paint, "#48554a", [0, 0, 32, 0, 32, 8, 26, 10, 18, 7, 13, 9, 6, 8, 0, 7]);
      polygon(paint, "#6e6d50", [0, 0, 32, 0, 32, 3, 26, 6, 16, 4, 11, 5, 4, 3, 0, 4]);
      paint.fillStyle = "rgba(166,174,141,.40)";
      for (let n = 0; n < 9; n++) paint.fillRect(rand() * 30, 1.2 + rand() * 4, 1 + rand() * 2, .7);
      paint.strokeStyle = "#626e5a";
      paint.beginPath();
      paint.moveTo(2, 10);
      paint.bezierCurveTo(11, 7, 18, 12, 29, 8);
      paint.stroke();
      paint.restore();
    }
    waters.set(key, image);
  }
  ctx.drawImage(image, x * 32, y * 32);
  if (animate && (x * 13 + y * 29) % 7 === 0) {
    const cycle = (Math.sin(now * .0021 + x * .67 + y) + 1) * .5;
    ctx.fillStyle = `rgba(146,176,152,${cycle * .2})`;
    ctx.fillRect(x * 32 + 7 + cycle * 5, y * 32 + 18, 11 - cycle * 3, .9);
  }
}

export function drawIndustrialSurface(ctx: CanvasRenderingContext2D, px: number, py: number, id: string) {
  const stone = id === "stone_brick";
  const safety = id === "hazard_concrete";
  ctx.fillStyle = stone ? "#635e50" : id === "refined_concrete" ? "#827f71" : "#6f6b60";
  ctx.fillRect(px, py, 32, 32);
  ctx.fillStyle = "rgba(34,36,29,.35)";
  ctx.fillRect(px, py + 31, 32, 1);
  ctx.fillRect(px + 31, py, 1, 32);
  if (stone) {
    ctx.fillRect(px, py + 15, 32, 2);
    ctx.fillRect(px + 17, py, 2, 15);
    ctx.fillRect(px + 11, py + 17, 2, 14);
  }
  if (safety) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 1, py + 1, 30, 30);
    ctx.clip();
    for (let i = -24; i < 49; i += 14) {
      polygon(ctx, "#b4a16a", [px + i, py, px + i + 6, py, px + i + 36, py + 32, px + i + 30, py + 32]);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(219,210,173,.18)";
    ctx.fillRect(px + 1, py + 1, 30, 1);
    ctx.fillRect(px + 2, py + 4, 9, 1);
    ctx.fillRect(px + 11, py + 24, 13, 1);
  }
}

export function drawWorkshopItem(ctx: CanvasRenderingContext2D, id: string, px: number, py: number, size = 32) {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(size / 32, size / 32);
  const tile: Tile = { kind: "placed_item", placedItemId: id, age: 0, watered: false };
  if (/belt|loader|splitter/.test(id)) drawConveyor(ctx, 0, 0, tile, 0);
  else if (!drawYardMachine(ctx, 0, 0, tile, 0)) {
    const copper = id.includes("copper");
    const ore = /ore|coal|^stone$/.test(id);
    const tool = /pickaxe|watering_can|scythe|^axe$|^hoe$/.test(id);
    const material = copper ? "#b68154" : id === "coal" ? "#636963" : "#aeae97";
    if (ore) {
      polygon(ctx, "#302d26", [3, 19, 8, 10, 17, 6, 24, 10, 29, 19, 24, 25, 10, 25]);
      polygon(ctx, material, [5, 18, 9, 11, 17, 7, 23, 12, 20, 19, 14, 23]);
      polygon(ctx, "#716954", [17, 7, 24, 11, 28, 19, 24, 23, 20, 19, 23, 12]);
    } else if (/bar|plate|brick|gear|wire|cable|magazine/.test(id)) {
      polygon(ctx, "#494839", [3, 19, 11, 12, 28, 14, 28, 21, 21, 26, 3, 25]);
      polygon(ctx, material, [3, 18, 11, 11, 28, 13, 21, 20]);
      polygon(ctx, "#d1c7a3", [3, 18, 11, 11, 27, 13, 11, 13, 6, 18]);
    } else if (id === "watering_can") {
      polygon(ctx, "#3f514d", [9, 11, 23, 11, 26, 16, 24, 26, 8, 26, 6, 18]);
      polygon(ctx, "#71938a", [10, 12, 22, 12, 24, 17, 22, 24, 10, 24, 8, 17]);
      polygon(ctx, "#9da391", [7, 18, 3, 17, 1, 8, 4, 7, 9, 16]);
      ctx.strokeStyle = "#a8b5a1";
      ctx.beginPath();
      ctx.ellipse(22, 11, 5, 5, .75, Math.PI, Math.PI * 2.28);
      ctx.stroke();
    } else if (tool) {
      polygon(ctx, "#614932", [5, 28, 3, 24, 22, 5, 25, 8, 8, 28]);
      polygon(ctx, "#a78253", [5, 25, 21, 8, 23, 8, 7, 26]);
      if (id === "axe") {
        polygon(ctx, "#6c7066", [17, 6, 25, 3, 31, 12, 27, 19, 21, 15, 19, 10]);
        polygon(ctx, "#cbbaa0", [25, 3, 31, 12, 27, 19, 25, 15, 28, 12]);
      } else if (id === "hoe") {
        polygon(ctx, "#8a9583", [20, 6, 27, 7, 30, 13, 27, 15, 23, 10, 19, 10]);
        polygon(ctx, "#d0c4a4", [27, 7, 30, 13, 27, 15, 26, 12]);
      } else if (id === "scythe") {
        polygon(ctx, "#c0c1aa", [20, 6, 24, 3, 31, 5, 31, 9, 27, 14, 24, 15, 28, 9, 25, 7]);
      } else {
        polygon(ctx, "#b9b7a1", [12, 8, 19, 3, 28, 7, 30, 14, 26, 11, 23, 8, 16, 9]);
      }
    } else if (/concrete|landfill/.test(id)) {
      drawIndustrialSurface(ctx, 2, 1, id);
    } else if (id.includes("chest") || id === "shipping_bin") {
      const metal = id.includes("steel") || id.includes("iron");
      polygon(ctx, "#39382b", [4, 11, 26, 11, 30, 16, 29, 26, 9, 29, 3, 24]);
      polygon(ctx, metal ? "#969686" : "#a38357", [4, 10, 24, 7, 27, 13, 9, 17, 4, 15]);
      polygon(ctx, metal ? "#6d7669" : "#785d3e", [8, 17, 27, 13, 27, 25, 8, 28]);
      ctx.fillStyle = "#c0ad79";
      ctx.fillRect(13, 17, 4, 4);
      ctx.fillRect(22, 15, 2, 10);
    } else {
      ctx.restore();
      return false;
    }
  }
  ctx.restore();
  return true;
}
