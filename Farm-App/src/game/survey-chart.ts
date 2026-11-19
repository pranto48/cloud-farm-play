import type { GameState, Tile } from "./meadow-life";

type Mode = "local" | "radar" | "region";
type Waypoint = { x: number; y: number; color: string; name: string };
const palette: Partial<Record<Tile["kind"], number>> = {
  grass: 0xff535e4d, water: 0xff53402a, tree: 0xff354738, path: 0xff898375,
  soil: 0xff4a473d, watered: 0xff3a3b32, house: 0xff9e927b, shop: 0xff9e927b,
  ore_iron: 0xffbcb8a6, ore_copper: 0xff6589c4, ore_coal: 0xff292b23,
  ore_uranium: 0xff72a89b, ore_gold: 0xff6daecc, ore_aluminum: 0xff989c99,
  ore_silver: 0xffaea89a, ore_crude_oil: 0xff422f37, debris_stone: 0xff7c7d6f,
  mine_wall: 0xff2b2b23, mine_ladder: 0xff77c9de, house_wall: 0xff786751,
  house_floor: 0xff697464,
};

const cache = new WeakMap<HTMLCanvasElement, { image: HTMLCanvasElement; key: string; map: Tile[][]; drawnAt: number }>();

export function drawChart(canvas: HTMLCanvasElement, state: GameState, mode: Mode, pollution: boolean, waypoints: Waypoint[] = []) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const map = state.inMine ? state.mineGrid : state.inHouse ? state.houseGrid! : state.tiles;
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  if (!rows || !cols) return;
  const extent = mode === "radar" ? 46 : 86;
  const colsShown = mode === "region" ? cols : Math.min(cols, extent);
  const rowsShown = mode === "region" ? rows : Math.min(rows, Math.round(extent * canvas.height / canvas.width));
  const left = Math.max(0, Math.min(cols - colsShown, state.player.x - Math.floor(colsShown / 2)));
  const top = Math.max(0, Math.min(rows - rowsShown, state.player.y - Math.floor(rowsShown / 2)));
  const width = Math.min(colsShown, 250);
  const height = Math.min(rowsShown, 250);
  const key = `${mode}:${left}/${top}/${width}/${height}/${colsShown}/${rowsShown}/${pollution}`;
  const now = performance.now();
  let background = cache.get(canvas);
  if (!background) {
    background = { image: document.createElement("canvas"), key: "", map, drawnAt: -Infinity };
    cache.set(canvas, background);
  }
  if (background.key !== key || background.map !== map || now - background.drawnAt > (pollution ? 1500 : 4000)) {
    background.key = key;
    background.map = map;
    background.drawnAt = now;
    if (background.image.width !== width || background.image.height !== height) {
      background.image.width = width;
      background.image.height = height;
    }
    const raster = background.image.getContext("2d")!;
    const pixels = raster.createImageData(width, height);
    const data = new Uint32Array(pixels.data.buffer);
    for (let py = 0; py < height; py++) {
      const y = top + Math.floor(py * rowsShown / height);
      for (let px = 0; px < width; px++) {
        const x = left + Math.floor(px * colsShown / width);
        const tile = map[y]?.[x];
        if (!tile) continue;
        const emissions = !state.inHouse && !state.inMine && pollution ? state.pollutionGrid?.[y]?.[x] ?? 0 : 0;
        data[py * width + px] = emissions > 35 ? 0xff575aac
          : tile.placedItemId === "gun_turret" || tile.placedItemId === "laser_turret" ? 0xff72b9cb
          : tile.placedItemId === "stone_wall" ? 0xff959c90
          : tile.placedItemId ? 0xff54929b
          : palette[tile.kind] ?? 0xff475546;
      }
    }
    raster.putImageData(pixels, 0, 0);
  }

  const sx = canvas.width / colsShown;
  const sy = canvas.height / rowsShown;
  const mark = (x: number, y: number, color: string, size: number) => {
    ctx.fillStyle = color;
    ctx.fillRect((x - left + .5) * sx - size / 2, (y - top + .5) * sy - size / 2, size, size);
  };
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(background.image, 0, 0, canvas.width, canvas.height);
  if (mode === "local") {
    ctx.strokeStyle = "rgba(213,207,173,.16)";
    ctx.beginPath();
    for (let x = Math.ceil(left / 10) * 10; x < left + colsShown; x += 10) {
      ctx.moveTo((x - left) * sx, 0);
      ctx.lineTo((x - left) * sx, canvas.height);
    }
    for (let y = Math.ceil(top / 10) * 10; y < top + rowsShown; y += 10) {
      ctx.moveTo(0, (y - top) * sy);
      ctx.lineTo(canvas.width, (y - top) * sy);
    }
    ctx.stroke();
    for (let y = top; y < top + rowsShown; y++) {
      for (let x = left; x < left + colsShown; x++) {
        const tile = map[y]?.[x];
        if (tile?.placedItemId !== "gun_turret" && tile?.placedItemId !== "laser_turret") continue;
        const range = tile.placedItemId === "gun_turret" ? 8.5 : 10;
        ctx.strokeStyle = "rgba(225,186,105,.56)";
        ctx.beginPath();
        ctx.ellipse((x - left + .5) * sx, (y - top + .5) * sy, range * sx, range * sy, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }
  if (!state.inMine && !state.inHouse) {
    for (const scout of state.biters ?? []) mark(scout.subX, scout.subY, "#ed8a72", 5);
    for (const point of waypoints) mark(point.x, point.y, point.color, 4);
  }
  mark(state.player.subX ?? state.player.x, state.player.subY ?? state.player.y, "#f7edb9", mode === "radar" ? 4 : 7);
}
