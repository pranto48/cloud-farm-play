import { World } from "./ecs/World";
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
  AnimationComponent,
  TimeWeatherComponent,
} from "./components/GameComponents";
import type { ItemType } from "./components/GameComponents";

export function spawnPlayer(world: World, x: number, y: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new VelocityComponent(0, 0));
  world.addComponent(entity, new InputComponent());
  world.addComponent(entity, new PlayerComponent());
  world.addComponent(entity, new BoxColliderComponent(24, 24));
  world.addComponent(entity, new AnimationComponent(1, 32, 32, 10));
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

// Procedural Perlin noise map generation for chunk-based infinite map
export function spawnMap(world: World): { entity: string; playerX: number; playerY: number } {
  const width = 2000;
  const height = 2000;
  const tileSize = 64;

  const mapEntity = world.createEntity();
  const mapComp = new MapComponent([], width, height, tileSize);
  world.addComponent(mapEntity, mapComp);

  // Pre-generate 5x5 chunks around center (1000, 1000)
  const centerChunkRow = Math.floor(1000 / 16);
  const centerChunkCol = Math.floor(1000 / 16);
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const cr = centerChunkRow + dr;
      const cc = centerChunkCol + dc;
      mapComp.getTile(cr * 16, cc * 16); // Reading a tile triggers chunk generation
    }
  }

  // Find a grass tile starting coordinate near the center
  let playerCol = 1000;
  let playerRow = 1000;
  let found = false;

  for (let searchRad = 0; searchRad < 35; searchRad++) {
    for (let dr = -searchRad; dr <= searchRad; dr++) {
      for (let dc = -searchRad; dc <= searchRad; dc++) {
        const tc = 1000 + dc;
        const tr = 1000 + dr;
        if (tc >= 0 && tc < width && tr >= 0 && tr < height) {
          if (mapComp.getTile(tr, tc) === "grass") {
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
  const skinColors = ["pale", "tanned", "dark", "green"];
  const hairStyles = ["short", "spiky", "bob", "curly", "braids", "none"];
  const hairColors = ["#f1c40f", "#8a5a3b", "#2c3e50", "#c0392b", "#9b59b6", "#7f8c8d"];
  const clothingStyles = ["shirt", "jacket", "overalls", "tunic", "dress", "apron"];
  const clothingColors = ["#e67e22", "#3498db", "#2ecc71", "#9b59b6", "#c0392b", "#1abc9c"];
  const shirtColors = ["#2c3e50", "#ecf0f1", "#f39c12", "#27ae60", "#c0392b"];
  const accessoryStyles = ["none", "none", "none", "cap", "ribbon"];
  const accessoryColors = ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71"];

  wComp.skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];
  wComp.hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
  wComp.hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
  wComp.clothingStyle = clothingStyles[Math.floor(Math.random() * clothingStyles.length)];
  wComp.clothingColor = clothingColors[Math.floor(Math.random() * clothingColors.length)];
  wComp.shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
  wComp.accessoryStyle = accessoryStyles[Math.floor(Math.random() * accessoryStyles.length)];
  wComp.accessoryColor = accessoryColors[Math.floor(Math.random() * accessoryColors.length)];

  world.addComponent(entity, wComp);
  world.addComponent(entity, new AnimationComponent(1, 32, 32, 10));
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

export function spawnResourceBurst(
  world: World,
  x: number,
  y: number,
  resourceType: "wood" | "stone" | "iron" | "copper" | "coal",
  count: number = 8
): void {
  const colors = {
    wood: ["#8a5a3b", "#704214", "#27ae60", "#2ecc71"],
    stone: ["#7f8c8d", "#95a5a6", "#bdc3c7"],
    iron: ["#78909c", "#b0bec5", "#cfd8dc", "#eceff1"],
    copper: ["#d35400", "#e67e22", "#ff7043", "#ffaa66"],
    coal: ["#212121", "#37474f", "#455a64", "#2c3e50"]
  };

  const palette = colors[resourceType] || ["#ffffff"];
  for (let i = 0; i < count; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const size = 3 + Math.random() * 3;
    const decay = 0.015 + Math.random() * 0.02;

    const entity = world.createEntity();
    world.addComponent(entity, new PositionComponent(x, y));
    world.addComponent(entity, new VelocityComponent(vx, vy));
    world.addComponent(entity, new ParticleComponent(color, size, vx, vy, 1.0, decay));
  }
}

export function spawnTimeWeather(world: World): string {
  const entity = world.createEntity();
  world.addComponent(entity, new TimeWeatherComponent());
  return entity;
}

export function spawnSplitter(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("splitter", gridX, gridY, rotation));
  return entity;
}

export function spawnUndergroundBelt(world: World, x: number, y: number, gridX: number, gridY: number, rotation: 0 | 90 | 180 | 270): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("underground_belt", gridX, gridY, rotation));
  return entity;
}

export function spawnGunTurret(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("gun_turret", gridX, gridY, 90));
  world.addComponent(entity, new BoxColliderComponent(48, 48));
  return entity;
}

export function spawnLaserTurret(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("laser_turret", gridX, gridY, 90));
  world.addComponent(entity, new BoxColliderComponent(48, 48));
  return entity;
}

export function spawnWall(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("wall", gridX, gridY, 90));
  world.addComponent(entity, new BoxColliderComponent(60, 60));
  return entity;
}

export function spawnSolarPanel(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("solar_panel", gridX, gridY, 90));
  world.addComponent(entity, new BoxColliderComponent(60, 60));
  return entity;
}

export function spawnBattery(world: World, x: number, y: number, gridX: number, gridY: number): string {
  const entity = world.createEntity();
  world.addComponent(entity, new PositionComponent(x, y));
  world.addComponent(entity, new StructureComponent("battery", gridX, gridY, 90));
  world.addComponent(entity, new BoxColliderComponent(60, 60));
  return entity;
}

