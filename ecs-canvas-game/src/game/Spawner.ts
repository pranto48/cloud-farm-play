import { World } from "./ecs/World";
import { ImprovedNoise } from "./utils/Noise";
import {
  PositionComponent,
  VelocityComponent,
  InputComponent,
  PlayerComponent,
  ParticleComponent,
  MapComponent,
  BoxColliderComponent,
  StructureComponent,
  ItemComponent,
  WorkerComponent,
} from "./components/GameComponents";
import type { TileType, ItemType, StructureType } from "./components/GameComponents";

export function spawnPlayer(world: World, x: number, y: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new InputComponent());
  world.addComponent(entity, new PlayerComponent());
  
  // AABB collider for tile collisions (24x24 px bounds)
  world.addComponent(entity, new BoxColliderComponent(24, 24));
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

  const vx = (Math.random() * 2 - 1) * 60;
  const vy = (Math.random() * 2 - 1) * 60;
  const decay = 0.02 + Math.random() * 0.02;

  world.addComponent(entity, new VelocityComponent(vx, vy));
  world.addComponent(entity, new ParticleComponent(color, size, vx, vy, 1.0, decay));
  return entity;
}

// Procedural Perlin noise map generation
export function spawnMap(world: World): { entity: string; playerX: number; playerY: number } {
  const width = 100;
  const height = 100;
  const tileSize = 64;
  const tiles: TileType[][] = [];

  const noiseBase = new ImprovedNoise();
  const noiseOre = new ImprovedNoise();
  const scale = 0.07;

  for (let r = 0; r < height; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < width; c++) {
      const val = noiseBase.noise(c * scale, r * scale, 0);
      const oreVal1 = noiseOre.noise(c * 0.15, r * 0.15, 10.0);
      const oreVal2 = noiseOre.noise(c * 0.15, r * 0.15, 20.0);
      const oreVal3 = noiseOre.noise(c * 0.15, r * 0.15, 30.0);

      let type: TileType = "grass";

      if (val < -0.25) {
        type = "water";
      } else if (val < -0.15) {
        // Sand/shoreline, walkable
        type = "grass";
      } else if (val > 0.4) {
        type = "forest";
      } else if (val > 0.2) {
        type = "stone";
      } else {
        type = "grass";
      }

      // Overlay ores in grass/stone areas
      if (type === "grass" || type === "stone") {
        if (oreVal1 > 0.45) {
          type = "iron";
        } else if (oreVal2 > 0.45) {
          type = "copper";
        } else if (oreVal3 > 0.45) {
          type = "coal";
        }
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

// Spawners for placeable factory structures
export function spawnBelt(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("belt", gridX, gridY, rotation));
  return entity;
}

export function spawnInserter(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("inserter", gridX, gridY, rotation);
  struct.workDuration = 1.0; // swing takes 1s
  world.addComponent(entity, struct);
  return entity;
}

export function spawnDrill(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("drill", gridX, gridY, rotation);
  struct.workDuration = 4.0; // mining takes 4s
  world.addComponent(entity, struct);
  return entity;
}

export function spawnAdvancedDrill(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("advanced_drill", gridX, gridY, rotation);
  struct.workDuration = 2.0; // advanced drill mines in 2s (twice as fast!)
  world.addComponent(entity, struct);
  return entity;
}

export function spawnFurnace(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("furnace", gridX, gridY, rotation);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnAdvancedFurnace(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("advanced_furnace", gridX, gridY, rotation);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnAssembler(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("assembler", gridX, gridY, rotation);
  struct.activeRecipe = "gear"; // Default to gear recipe
  world.addComponent(entity, struct);
  return entity;
}

export function spawnChest(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("chest", gridX, gridY, rotation);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnPowerPole(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("pole", gridX, gridY, 90);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnGenerator(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("generator", gridX, gridY, rotation);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnStorageHouse(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("storage_house", gridX, gridY, 90);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnWorkerHouse(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("worker_house", gridX, gridY, 90);
  world.addComponent(entity, struct);
  return entity;
}

export function spawnWorker(world: World, x: number, y: number, houseEntityId: string): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));

  const wComp = new WorkerComponent(houseEntityId);
  
  // Randomize worker appearance
  const hairStyles = ["short", "spiky", "bob", "curly", "braids", "none"];
  const hairColors = ["#f1c40f", "#8a5a3b", "#2c3e50", "#c0392b", "#9b59b6", "#7f8c8d"];
  const clothingStyles = ["shirt", "jacket", "overalls", "tunic"];
  const clothingColors = ["#e67e22", "#3498db", "#2ecc71", "#9b59b6", "#c0392b", "#1abc9c"];
  const shirtColors = ["#2c3e50", "#ecf0f1", "#f39c12", "#27ae60", "#c0392b"];

  wComp.hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
  wComp.hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
  wComp.clothingStyle = clothingStyles[Math.floor(Math.random() * clothingStyles.length)];
  wComp.clothingColor = clothingColors[Math.floor(Math.random() * clothingColors.length)];
  wComp.shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];

  world.addComponent(entity, wComp);
  return entity;
}

export function spawnCrop(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  const struct = new StructureComponent("crop", gridX, gridY, 90);
  struct.cropGrowth = 0;
  struct.isWatered = false;
  world.addComponent(entity, struct);
  return entity;
}

export function spawnItemEntity(world: World, x: number, y: number, type: ItemType): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new ItemComponent(type));
  return entity;
}
