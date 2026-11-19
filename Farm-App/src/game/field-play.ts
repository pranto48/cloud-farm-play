import { consumeCursor, getCursor } from "./item-cursor";
import { addItem, getDirectionVector, isConveyor, isWalkable, loadConveyor, removeItem, STATIC_POINTS, type GameState, type Tile } from "./meadow-life";
import { createItem, type Item } from "./data/items";

export type Point = { x: number; y: number };
export type Wildlife = Point & { id: string; subX: number; subY: number; hp: number; maxHp: number; type: "small" | "medium" | "big" | "behemoth"; heading?: number; attackIn?: number };
export type Signal = { from: Point; to: Point; seconds: number; color: string };
export type Patrol = { nextAt: number; waves: number; repelled: number; active: boolean; target?: Point };

type Weapon = { ammo: readonly string[]; damage: number; range: number; cooldown: number; spread?: number };
const magazine = ["firearm_magazine", "piercing_rounds_magazine", "uranium_rounds_magazine"];
const shells = ["shotgun_shells", "piercing_shotgun_shells"];
const guns: Record<string, Weapon> = {
  pistol: { ammo: magazine, damage: 17, range: 10, cooldown: .34 },
  submachine_gun: { ammo: magazine, damage: 14, range: 12, cooldown: .145 },
  shotgun: { ammo: shells, damage: 28, range: 7, cooldown: .58, spread: 1.8 },
  combat_shotgun: { ammo: shells, damage: 37, range: 8, cooldown: .38, spread: 2.1 },
};

export function inventoryCopy(inventory: (Item | null)[]) {
  return inventory.map(item => item && { ...item });
}

export function equippedWeapon(state: GameState) {
  const cursor = getCursor(state);
  const chosen = cursor && guns[cursor.id] ? cursor : state.inventory.find(item => item?.id === state.player.weaponId && guns[item.id])
    ?? state.inventory.find(item => item && guns[item.id]);
  const spec = chosen ? guns[chosen.id] : undefined;
  return {
    item: chosen,
    spec,
    rounds: spec ? state.inventory.reduce((sum, item) => sum + (item && spec.ammo.includes(item.id) ? item.count : 0), cursor && spec.ammo.includes(cursor.id) ? cursor.count : 0) : 0,
  };
}

function area(state: GameState) {
  return state.inMine ? state.mineGrid : state.inHouse ? state.houseGrid! : state.tiles;
}

function clearLine(grid: Tile[][], from: Point, to: Point) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.ceil(distance * 2);
  for (let step = 1; step < steps; step++) {
    const x = Math.round(from.x + (to.x - from.x) * step / steps);
    const y = Math.round(from.y + (to.y - from.y) * step / steps);
    const tile = grid[y]?.[x];
    if (tile?.kind === "house" || tile?.kind === "tree" || tile?.kind === "mine_wall") return false;
  }
  return true;
}

function flash(state: GameState, from: Point, to: Point, color: string) {
  (state.combatFx ??= []).push({ from, to, seconds: .13, color });
}

function damageFor(id: string) {
  return id.startsWith("uranium") ? 1.75 : id.startsWith("piercing") ? 1.35 : 1;
}

export function firePlayerWeapon(state: GameState, cursor?: Point | null) {
  if (state.inHouse || (state.player.shotCooldown ?? 0) > 0) return false;
  const { spec } = equippedWeapon(state);
  if (!spec) return false;
  const p = state.player;
  const origin = { x: p.subX ?? p.x, y: p.subY ?? p.y };
  const targets = state.inMine ? state.mineEnemies : state.biters ?? [];
  const aim = cursor ?? origin;
  const hits = targets
    .filter(enemy => enemy.hp > 0 && Math.hypot(enemy.x - origin.x, enemy.y - origin.y) <= spec.range)
    .filter(enemy => !cursor || Math.hypot(enemy.x - aim.x, enemy.y - aim.y) <= 4.5)
    .filter(enemy => clearLine(area(state), origin, enemy))
    .sort((a, b) => Math.hypot(a.x - aim.x, a.y - aim.y) - Math.hypot(b.x - aim.x, b.y - aim.y));
  const target = hits[0];
  if (!target) return false;
  const slot = state.inventory.findIndex(item => item && spec.ammo.includes(item.id));
  const held = getCursor(state);
  const heldAmmo = slot < 0 && held && spec.ammo.includes(held.id) ? held : null;
  if (slot < 0 && !heldAmmo && !state.godMode) return false;
  const multiplier = damageFor(state.inventory[slot]?.id ?? heldAmmo?.id ?? "");
  if (!state.godMode) {
    if (heldAmmo) consumeCursor(state);
    else removeItem(state.inventory, slot);
  }
  p.shotCooldown = spec.cooldown;
  p.actionSeconds = .17;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  target.hp -= spec.damage * multiplier;
  if (spec.spread) {
    for (const enemy of hits.slice(1, 4)) {
      if (Math.hypot(enemy.x - target.x, enemy.y - target.y) < spec.spread) enemy.hp -= spec.damage * multiplier * .55;
    }
  }
  flash(state, origin, { x: target.x, y: target.y }, "#f6cf83");
  if (state.inMine) state.mineEnemies = state.mineEnemies.filter(enemy => enemy.hp > 0);
  return true;
}

export function stepPlayer(state: GameState, dx: number, dy: number, sprint: boolean, dt: number, face = true) {
  const grid = area(state);
  const p = state.player;
  const startX = p.subX ?? p.x;
  const startY = p.subY ?? p.y;
  if (face && (dx !== 0 || dy !== 0)) {
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }
  const terrain = grid[p.y]?.[p.x];
  const speed = (sprint ? 10.8 : 7.4) * (terrain?.kind === "path" ? 1.12 : terrain?.kind === "watered" ? .82 : 1);
  const radius = .23;
  const canStand = (x: number, y: number) => {
    for (const cornerX of [x - radius, x + radius]) {
      for (const cornerY of [y - radius, y + radius]) {
        if (!isWalkable(grid[Math.round(cornerY)]?.[Math.round(cornerX)])) return false;
      }
    }
    return true;
  };
  const size = Math.hypot(dx, dy);
  const scale = size > 1 ? speed * dt / size : speed * dt;
  const belt = terrain?.placedItemId && isConveyor(terrain.placedItemId) ? getDirectionVector(terrain.direction) : { dx: 0, dy: 0 };
  const tx = startX + dx * scale + belt.dx * dt * 1.65;
  const ty = startY + dy * scale + belt.dy * dt * 1.65;
  const x = canStand(tx, startY) ? tx : startX;
  const y = canStand(x, ty) ? ty : startY;
  p.subX = x;
  p.subY = y;
  p.x = Math.round(x);
  p.y = Math.round(y);
  const walked = Math.hypot(x - startX, y - startY);
  p.walkSeconds = walked > .001 ? (p.walkSeconds ?? 0) + walked : 0;
}

export function pickupNearby(state: GameState, radius = 2.2) {
  const grid = area(state);
  const items = inventoryCopy(state.inventory);
  let count = 0;
  const p = state.player;
  const replacements: { point: Point; tile: Tile }[] = [];
  for (let y = p.y - 2; y <= p.y + 2; y++) {
    for (let x = p.x - 2; x <= p.x + 2; x++) {
      if (Math.hypot(x - (p.subX ?? p.x), y - (p.subY ?? p.y)) > radius) continue;
      const original = grid[y]?.[x];
      if (!original?.looseItems?.length && !original?.beltItems?.length) continue;
      const tile = { ...original, looseItems: original.looseItems?.slice(), beltItems: original.beltItems?.slice() };
      const before = count;
      tile.looseItems = tile.looseItems?.filter(item => {
        if (!addItem(items, item)) return true;
        count += item.count;
        return false;
      });
      tile.beltItems = tile.beltItems?.filter(item => {
        if (!addItem(items, createItem(item.id))) return true;
        count++;
        return false;
      });
      if (count !== before) replacements.push({ point: { x, y }, tile });
    }
  }
  if (count > 0) {
    for (const { point, tile } of replacements) grid[point.y][point.x] = tile;
    state.inventory = items;
  }
  return count;
}

export function placeLooseItem(state: GameState, point: Point, id: string) {
  const tile = area(state)[point.y]?.[point.x];
  if (!tile) return false;
  if (tile.placedItemId && isConveyor(tile.placedItemId)) {
    return loadConveyor(tile, { id, lane: 0, offset: .12 }) || loadConveyor(tile, { id, lane: 1, offset: .12 });
  }
  if (!isWalkable(tile)) return false;
  const items = tile.looseItems ??= [];
  const stack = items.find(item => item.id === id && item.count < 99);
  if (stack) stack.count++;
  else if (items.length < 4) items.push(createItem(id));
  else return false;
  return true;
}

export function loadDefenseAmmo(tile: Tile, inventory: (Item | null)[]) {
  if (tile.placedItemId !== "gun_turret") return 0;
  const ammo = tile.chestInventory ??= [null];
  const stack = ammo[0];
  const slot = inventory.findIndex(item => item && magazine.includes(item.id) && (!stack || stack.id === item.id));
  if (slot < 0) return 0;
  const item = inventory[slot]!;
  const amount = Math.min(12 - (stack?.count ?? 0), item.count);
  if (amount <= 0) return 0;
  if (stack) stack.count += amount;
  else ammo[0] = createItem(item.id, amount);
  removeItem(inventory, slot, amount);
  return amount;
}

export function tickDefense(state: GameState, dt: number, sites: readonly Point[], power: number, hotSite?: Point) {
  const p = state.player;
  p.shotCooldown = Math.max(0, (p.shotCooldown ?? 0) - dt);
  p.actionSeconds = Math.max(0, (p.actionSeconds ?? 0) - dt);
  if (state.combatFx?.length) state.combatFx = state.combatFx.filter(effect => (effect.seconds -= dt) > 0);
  const patrol = state.patrol ??= { nextAt: 1100, waves: 0, repelled: 0, active: false };
  const population = state.biters ??= [];
  const grid = state.tiles;

  if (!patrol.active && !state.inMine && !state.inHouse && hotSite && (state.productionStats?.pollutionTotal ?? 0) >= patrol.nextAt) {
    const spawn: Point[] = [];
    for (let i = 0; i < 20 && spawn.length < Math.min(7, 3 + patrol.waves); i++) {
      const x = hotSite.x + 12 + i % 4;
      const y = hotSite.y - 7 + i;
      if (isWalkable(grid[y]?.[x])) spawn.push({ x, y });
    }
    if (spawn.length) {
      const hp = 32 + Math.min(65, patrol.waves * 9);
      for (const [index, point] of spawn.entries()) {
        population.push({ ...point, id: `scout_${patrol.waves}_${index}`, subX: point.x, subY: point.y, hp, maxHp: hp, type: hp >= 65 ? "medium" : "small" });
      }
      patrol.waves++;
      patrol.active = true;
      patrol.target = hotSite;
      patrol.nextAt = (state.productionStats?.pollutionTotal ?? 0) + 2300 + patrol.waves * 650;
    }
  }

  if (!population.length) return;
  for (const site of sites) {
    const turret = grid[site.y]?.[site.x];
    const gun = turret?.placedItemId === "gun_turret";
    const laser = turret?.placedItemId === "laser_turret";
    if (!turret || turret.structureHp !== undefined && turret.structureHp <= 0 || (!gun && !laser)) continue;
    turret.fireCooldown = Math.max(0, (turret.fireCooldown ?? 0) - dt);
    const ammo = turret.chestInventory?.findIndex(item => item && magazine.includes(item.id)) ?? -1;
    turret.machineStatus = gun && ammo < 0 ? "fuel" : laser && power < .25 ? "power" : "idle";
    if (turret.machineStatus !== "idle" || turret.fireCooldown > 0) continue;
    const enemy = population.find(unit => unit.hp > 0 && Math.hypot(unit.x - site.x, unit.y - site.y) <= (gun ? 8.5 : 10) && clearLine(grid, site, unit));
    if (!enemy) continue;
    turret.aimAngle = Math.atan2(enemy.y - site.y, enemy.x - site.x);
    turret.fireCooldown = gun ? .34 : .24;
    turret.machineStatus = "running";
    enemy.hp -= gun ? 18 * damageFor(turret.chestInventory![ammo]!.id) : 20 * power;
    if (gun) removeItem(turret.chestInventory!, ammo);
    flash(state, site, { x: enemy.x, y: enemy.y }, gun ? "#ffca76" : "#94e3dc");
  }

  const target = patrol.target ?? hotSite ?? p;
  for (const unit of population) {
    if (unit.hp <= 0) continue;
    unit.attackIn = Math.max(0, (unit.attackIn ?? 0) - dt);
    const nearPlayer = !state.inHouse && !state.inMine && Math.hypot(unit.x - p.x, unit.y - p.y) < 4;
    const aim = nearPlayer ? p : target;
    const dx = aim.x - unit.subX;
    const dy = aim.y - unit.subY;
    const distance = Math.hypot(dx, dy);
    const bite = () => {
      if (unit.attackIn! > 0) return false;
      unit.attackIn = .75;
      return true;
    };
    if (nearPlayer && distance < 1.05) {
      if (!state.godMode && bite()) {
        p.health = Math.max(0, p.health - (unit.type === "medium" ? 12 : 7));
        if (p.health === 0) {
          p.x = p.subX = STATIC_POINTS.playerSpawn.x;
          p.y = p.subY = STATIC_POINTS.playerSpawn.y;
          p.health = p.maxHealth;
        }
      }
      continue;
    }
    if (distance < .28) continue;
    const heading = Math.atan2(dy, dx);
    const speed = unit.type === "medium" ? 2.75 : 3.45;
    for (const turn of [0, .65, -.65, 1.3, -1.3]) {
      const angle = heading + turn;
      const x = unit.subX + Math.cos(angle) * speed * dt;
      const y = unit.subY + Math.sin(angle) * speed * dt;
      const gx = Math.round(x);
      const gy = Math.round(y);
      const tile = grid[gy]?.[gx];
      if (tile?.placedItemId && !isWalkable(tile) && (tile.structureHp ?? 1) > 0) {
        if (bite()) {
          const max = tile.placedItemId === "stone_wall" ? 90 : 54;
          tile.structureHp = (tile.structureHp ?? max) - 7;
          // Disabled equipment remains recoverable with its contents.
          if (tile.structureHp <= 0 && tile.placedItemId === "stone_wall") {
            grid[gy][gx] = { kind: tile.foundation ?? "grass", age: -1, watered: false };
          }
        }
        if (!turn) break;
      }
      if (!isWalkable(tile) && !(tile?.structureHp !== undefined && tile.structureHp <= 0)) continue;
      unit.heading = angle;
      unit.subX = x;
      unit.subY = y;
      unit.x = gx;
      unit.y = gy;
      break;
    }
  }
  state.biters = population.filter(unit => {
    if (unit.hp > 0) return true;
    if (!state.inMine && !state.inHouse) placeLooseItem(state, unit, "fiber");
    return false;
  });
  if (patrol.active && !state.biters.length) {
    patrol.active = false;
    patrol.repelled++;
  }
}
