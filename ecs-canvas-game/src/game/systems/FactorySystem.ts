import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  PositionComponent,
  VelocityComponent,
  StructureComponent,
  ItemComponent,
  MapComponent,
  RECIPES,
  ItemType,
} from "../components/GameComponents";
import { spawnItemEntity, spawnParticle } from "../Spawner";

export class FactorySystem extends System {
  readonly requiredComponents = [StructureComponent, PositionComponent];

  update(world: World, dt: number): void {
    const maps = world.getEntitiesWith([MapComponent]);
    if (maps.length === 0) return;
    const mapEntity = maps[0];
    const mapComp = world.getComponent(mapEntity, MapComponent)!;
    const ts = mapComp.tileSize;

    const structures = world.getEntitiesWith(this.requiredComponents);

    // ==========================================
    // 1. POWER SYSTEM: GENERATORS & POWER GRID
    // ==========================================
    const activeGenerators = new Set<string>();
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "generator") {
        if (s.fuel > 0) {
          s.fuel -= dt;
          activeGenerators.add(ent);
          
          // Emit steam particles occasionally
          if (Math.random() < 0.08) {
            const pos = world.getComponent(ent, PositionComponent)!;
            spawnParticle(world, pos.x + (Math.random() * 8 - 4), pos.y - 16, "#bdc3c7", 4);
          }
        } else if (s.inventory["coal"] && s.inventory["coal"] > 0) {
          s.inventory["coal"]--;
          s.fuel = 30.0; // burns coal for 30s
          s.maxFuel = 30.0;
          activeGenerators.add(ent);
        }
      }
    }

    // Build Power Pole connection grid (flood fill)
    const poles = structures.filter(ent => world.getComponent(ent, StructureComponent)!.type === "pole");
    const electrifiedPoles = new Set<string>();

    const poleConnections = new Map<string, string[]>();
    for (let i = 0; i < poles.length; i++) {
      const poleA = poles[i];
      const posA = world.getComponent(poleA, PositionComponent)!;
      const list: string[] = [];
      for (let j = 0; j < poles.length; j++) {
        if (i === j) continue;
        const poleB = poles[j];
        const posB = world.getComponent(poleB, PositionComponent)!;
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        if (dx * dx + dy * dy <= 320 * 320) { // Max connection range 5 tiles (320px)
          list.push(poleB);
        }
      }
      poleConnections.set(poleA, list);
    }

    // Initialize search queue from active generators to poles
    const queue: string[] = [];
    for (const genEnt of activeGenerators) {
      const genPos = world.getComponent(genEnt, PositionComponent)!;
      for (const poleEnt of poles) {
        const polePos = world.getComponent(poleEnt, PositionComponent)!;
        const dx = genPos.x - polePos.x;
        const dy = genPos.y - polePos.y;
        if (dx * dx + dy * dy <= 320 * 320) {
          electrifiedPoles.add(poleEnt);
          queue.push(poleEnt);
        }
      }
    }

    // BFS power transmission
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = poleConnections.get(current) || [];
      for (const neighbor of neighbors) {
        if (!electrifiedPoles.has(neighbor)) {
          electrifiedPoles.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Power consumers (Drills & Assemblers) in range of electrified poles
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "drill" || s.type === "assembler") {
        let powered = false;
        const pos = world.getComponent(ent, PositionComponent)!;
        for (const poleEnt of electrifiedPoles) {
          const polePos = world.getComponent(poleEnt, PositionComponent)!;
          const dx = pos.x - polePos.x;
          const dy = pos.y - polePos.y;
          if (dx * dx + dy * dy <= 192 * 192) { // 3 tiles power coverage (192px)
            powered = true;
            break;
          }
        }
        s.isPowered = powered;
      }
    }

    // ==========================================
    // 2. CONVEYOR BELTS: UPDATE ITEMS LOGISTICS
    // ==========================================
    const items = world.getEntitiesWith([ItemComponent, PositionComponent, VelocityComponent]);
    const beltSpeed = 64; // 1 tile per second (64px/s)

    // Build a map of belts for fast lookup
    const beltMap = new Map<string, StructureComponent>();
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "belt") {
        beltMap.set(`${s.gridX},${s.gridY}`, s);
      }
    }

    for (const itemEnt of items) {
      const item = world.getComponent(itemEnt, ItemComponent)!;
      const pos = world.getComponent(itemEnt, PositionComponent)!;
      const vel = world.getComponent(itemEnt, VelocityComponent)!;

      if (item.isHeld) {
        vel.vx = 0;
        vel.vy = 0;
        continue; // handled by Inserter swing
      }

      const col = Math.floor(pos.x / ts);
      const row = Math.floor(pos.y / ts);
      const belt = beltMap.get(`${col},${row}`);

      if (belt) {
        let bdx = 0;
        let bdy = 0;
        if (belt.rotation === 0) bdy = -1;
        else if (belt.rotation === 90) bdx = 1;
        else if (belt.rotation === 180) bdy = 1;
        else if (belt.rotation === 270) bdx = -1;

        // Check if blocked by another item entity ahead
        let isBlocked = false;
        for (const otherEnt of items) {
          if (otherEnt === itemEnt) continue;
          const otherItem = world.getComponent(otherEnt, ItemComponent)!;
          if (otherItem.isHeld) continue;
          const otherPos = world.getComponent(otherEnt, PositionComponent)!;

          const dx = otherPos.x - pos.x;
          const dy = otherPos.y - pos.y;
          
          if (bdx !== 0) {
            // Horizontal check
            if (Math.abs(dy) < 8 && dx * bdx > 0 && Math.abs(dx) < 22) {
              isBlocked = true;
              break;
            }
          } else if (bdy !== 0) {
            // Vertical check
            if (Math.abs(dx) < 8 && dy * bdy > 0 && Math.abs(dy) < 22) {
              isBlocked = true;
              break;
            }
          }
        }

        if (!isBlocked) {
          // Slowly align item to centerline of the belt
          const tileCenter = {
            x: col * ts + ts / 2,
            y: row * ts + ts / 2
          };

          if (bdx !== 0) {
            pos.y += (tileCenter.y - pos.y) * 0.15; // align vertical
          } else if (bdy !== 0) {
            pos.x += (tileCenter.x - pos.x) * 0.15; // align horizontal
          }

          vel.vx = bdx * beltSpeed;
          vel.vy = bdy * beltSpeed;
        } else {
          vel.vx = 0;
          vel.vy = 0;
        }
      } else {
        // Items on normal grass just stop
        vel.vx = 0;
        vel.vy = 0;
      }

      // Apply velocity updates
      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;

      // Clamp items inside map boundaries
      pos.x = Math.max(8, Math.min(mapComp.width * ts - 8, pos.x));
      pos.y = Math.max(8, Math.min(mapComp.height * ts - 8, pos.y));
    }

    // ==========================================
    // 3. INSERTER SYSTEMS
    // ==========================================
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "inserter") {
        if (s.inserterCooldown > 0) {
          s.inserterCooldown -= dt;
        }

        // Get coordinates behind (pickup) and in front (dropoff)
        let pickupX = s.gridX;
        let pickupY = s.gridY;
        let dropoffX = s.gridX;
        let dropoffY = s.gridY;

        if (s.rotation === 0) { // Facing Up
          pickupY = s.gridY + 1;
          dropoffY = s.gridY - 1;
        } else if (s.rotation === 90) { // Facing Right
          pickupX = s.gridX - 1;
          dropoffX = s.gridX + 1;
        } else if (s.rotation === 180) { // Facing Down
          pickupY = s.gridY - 1;
          dropoffY = s.gridY + 1;
        } else if (s.rotation === 270) { // Facing Left
          pickupX = s.gridX + 1;
          dropoffX = s.gridX - 1;
        }

        if (s.inserterHeldItemType === null) {
          // Try to Pick Up item
          const pickupMachine = structures.find(o => {
            const os = world.getComponent(o, StructureComponent)!;
            return os.gridX === pickupX && os.gridY === pickupY;
          });

          if (pickupMachine) {
            const os = world.getComponent(pickupMachine, StructureComponent)!;
            
            // Find an item we can pull out
            let pulledType: ItemType | null = null;
            if (os.type === "chest") {
              pulledType = Object.keys(os.inventory).find(k => os.inventory[k] > 0) as ItemType || null;
            } else if (os.type === "furnace" || os.type === "assembler") {
              // Only pull completed products
              if (os.type === "furnace" && os.inventory["iron_plate"] > 0) pulledType = "iron_plate";
              else if (os.type === "furnace" && os.inventory["copper_plate"] > 0) pulledType = "copper_plate";
              else if (os.type === "assembler" && os.inventory["gear"] > 0) pulledType = "gear";
              else if (os.type === "assembler" && os.inventory["copper_wire"] > 0) pulledType = "copper_wire";
              else if (os.type === "assembler" && os.inventory["electronic_circuit"] > 0) pulledType = "electronic_circuit";
              else if (os.type === "assembler" && os.inventory["science_pack"] > 0) pulledType = "science_pack";
            }

            if (pulledType && s.inserterCooldown <= 0) {
              os.inventory[pulledType]--;
              s.inserterHeldItemType = pulledType;
              s.inserterAngle = Math.PI; // swing anim starts at 180 deg offset
              s.timer = 0;
              s.inserterCooldown = s.workDuration;
            }
          } else {
            // Try to pick up an item entity from a conveyor belt at pickup coords
            const beltItems = world.getEntitiesWith([ItemComponent, PositionComponent]);
            const onPickupItem = beltItems.find(itemEnt => {
              const ipos = world.getComponent(itemEnt, PositionComponent)!;
              const col = Math.floor(ipos.x / ts);
              const row = Math.floor(ipos.y / ts);
              return col === pickupX && row === pickupY;
            });

            if (onPickupItem && s.inserterCooldown <= 0) {
              const item = world.getComponent(onPickupItem, ItemComponent)!;
              s.inserterHeldItemType = item.type;
              s.inserterAngle = Math.PI;
              s.timer = 0;
              s.inserterCooldown = s.workDuration;
              world.destroyEntity(onPickupItem); // pick it up into slot
            }
          }
        } else {
          // Holding item: swing towards dropoff tile
          s.timer += dt;
          const pct = Math.min(1.0, s.timer / s.workDuration);
          s.inserterAngle = Math.PI - pct * Math.PI; // moves from PI (180deg) to 0 (0deg)

          if (pct >= 1.0) {
            // Try to Deposit/Drop item
            const dropoffMachine = structures.find(o => {
              const os = world.getComponent(o, StructureComponent)!;
              return os.gridX === dropoffX && os.gridY === dropoffY;
            });

            let deposited = false;
            const itemType = s.inserterHeldItemType;

            if (dropoffMachine) {
              const os = world.getComponent(dropoffMachine, StructureComponent)!;
              
              if (os.type === "chest") {
                os.inventory[itemType] = (os.inventory[itemType] || 0) + 1;
                deposited = true;
              } else if (os.type === "generator" && itemType === "coal") {
                os.inventory["coal"] = (os.inventory["coal"] || 0) + 1;
                deposited = true;
              } else if (os.type === "furnace") {
                // Furnace inputs fuel (coal) or smelting ores
                if (itemType === "coal") {
                  os.inventory["coal"] = (os.inventory["coal"] || 0) + 1;
                  deposited = true;
                } else if (itemType === "iron_ore" || itemType === "copper_ore") {
                  os.inventory[itemType] = (os.inventory[itemType] || 0) + 1;
                  deposited = true;
                }
              } else if (os.type === "assembler") {
                // Assembler inputs recipe ingredients
                const recipe = RECIPES[os.activeRecipe || ""];
                if (recipe && recipe.inputs[itemType]) {
                  // Only insert if assembler needs more inputs
                  const currentInSlot = os.inventory[itemType] || 0;
                  if (currentInSlot < recipe.inputs[itemType] * 2) { // Buffer up to 2x recipe
                    os.inventory[itemType] = currentInSlot + 1;
                    deposited = true;
                  }
                }
              }
            } else {
              // Try to drop onto Conveyor Belt
              const dropoffBelt = structures.find(o => {
                const os = world.getComponent(o, StructureComponent)!;
                return os.gridX === dropoffX && os.gridY === dropoffY && os.type === "belt";
              });

              if (dropoffBelt) {
                // Check if space on belt tile center
                const beltItems = world.getEntitiesWith([ItemComponent, PositionComponent]);
                const spaceClear = !beltItems.some(iEnt => {
                  const ipos = world.getComponent(iEnt, PositionComponent)!;
                  const dx = ipos.x - (dropoffX * ts + ts / 2);
                  const dy = ipos.y - (dropoffY * ts + ts / 2);
                  return dx * dx + dy * dy < 20 * 20; // 20px clearance
                });

                if (spaceClear) {
                  spawnItemEntity(world, dropoffX * ts + ts / 2, dropoffY * ts + ts / 2, itemType);
                  deposited = true;
                }
              }
            }

            if (deposited) {
              s.inserterHeldItemType = null;
              s.inserterCooldown = s.workDuration / 2; // return swing cooldown
              s.inserterAngle = 0;
            }
          }
        }
      }
    }

    // ==========================================
    // 4. MINING DRILLS
    // ==========================================
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "drill" && s.isPowered) {
        const type = mapComp.tiles[s.gridY]?.[s.gridX];
        let minedItem: ItemType | null = null;

        if (type === "forest") minedItem = "wood";
        else if (type === "stone") minedItem = "stone";
        else if (type === "iron") minedItem = "iron_ore";
        else if (type === "copper") minedItem = "copper_ore";
        else if (type === "coal") minedItem = "coal";

        if (minedItem) {
          s.timer += dt;
          if (s.timer >= s.workDuration) {
            // Determine output target
            let outX = s.gridX;
            let outY = s.gridY;
            if (s.rotation === 0) outY--;
            else if (s.rotation === 90) outX++;
            else if (s.rotation === 180) outY++;
            else if (s.rotation === 270) outX--;

            // Find chest or belt at output
            const targetStructure = structures.find(o => {
              const os = world.getComponent(o, StructureComponent)!;
              return os.gridX === outX && os.gridY === outY;
            });

            let placed = false;
            if (targetStructure) {
              const os = world.getComponent(targetStructure, StructureComponent)!;
              if (os.type === "chest") {
                os.inventory[minedItem] = (os.inventory[minedItem] || 0) + 1;
                placed = true;
              } else if (os.type === "belt") {
                // Belt spacing check
                const beltItems = world.getEntitiesWith([ItemComponent, PositionComponent]);
                const spaceClear = !beltItems.some(iEnt => {
                  const ipos = world.getComponent(iEnt, PositionComponent)!;
                  const dx = ipos.x - (outX * ts + ts / 2);
                  const dy = ipos.y - (outY * ts + ts / 2);
                  return dx * dx + dy * dy < 20 * 20;
                });
                if (spaceClear) {
                  spawnItemEntity(world, outX * ts + ts / 2, outY * ts + ts / 2, minedItem);
                  placed = true;
                }
              }
            } else {
              // Drop item on the ground
              spawnItemEntity(world, outX * ts + ts / 2, outY * ts + ts / 2, minedItem);
              placed = true;
            }

            if (placed) {
              s.timer = 0;
              // Spark particles
              const pos = world.getComponent(ent, PositionComponent)!;
              for (let i = 0; i < 3; i++) {
                spawnParticle(world, pos.x, pos.y, "#f1c40f", 2.5);
              }
            }
          }
        }
      }
    }

    // ==========================================
    // 5. STONE FURNACES (Smelting)
    // ==========================================
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "furnace") {
        if (s.fuel > 0) {
          s.fuel -= dt;
          
          // Emit fire particles
          if (Math.random() < 0.12) {
            const pos = world.getComponent(ent, PositionComponent)!;
            spawnParticle(world, pos.x + (Math.random() * 6 - 3), pos.y + 4, "#e67e22", 3);
          }
        } else if (s.inventory["coal"] && s.inventory["coal"] > 0) {
          s.inventory["coal"]--;
          s.fuel = 20.0; // burns coal for 20s
          s.maxFuel = 20.0;
        }

        // Process smelting recipes
        if (s.fuel > 0) {
          let chosenRecipe = "";
          if (s.inventory["iron_ore"] && s.inventory["iron_ore"] > 0) {
            chosenRecipe = "iron_plate";
          } else if (s.inventory["copper_ore"] && s.inventory["copper_ore"] > 0) {
            chosenRecipe = "copper_plate";
          }

          if (chosenRecipe) {
            const recipe = RECIPES[chosenRecipe];
            s.timer += dt;
            s.progress = s.timer / recipe.time;

            if (s.timer >= recipe.time) {
              s.timer = 0;
              s.progress = 0;

              // Smelt outputs
              if (chosenRecipe === "iron_plate") {
                s.inventory["iron_ore"]--;
                s.inventory["iron_plate"] = (s.inventory["iron_plate"] || 0) + 1;
              } else {
                s.inventory["copper_ore"]--;
                s.inventory["copper_plate"] = (s.inventory["copper_plate"] || 0) + 1;
              }
            }
          } else {
            s.timer = 0;
            s.progress = 0;
          }
        } else {
          s.timer = 0;
          s.progress = 0;
        }
      }
    }

    // ==========================================
    // 6. ASSEMBLY MACHINES
    // ==========================================
    for (const ent of structures) {
      const s = world.getComponent(ent, StructureComponent)!;
      if (s.type === "assembler" && s.isPowered && s.activeRecipe) {
        const recipe = RECIPES[s.activeRecipe];
        if (recipe) {
          // Check ingredients
          let hasIngredients = true;
          for (const [ingName, ingQty] of Object.entries(recipe.inputs)) {
            if (!s.inventory[ingName] || s.inventory[ingName] < ingQty) {
              hasIngredients = false;
              break;
            }
          }

          if (hasIngredients) {
            s.timer += dt;
            s.progress = s.timer / recipe.time;

            if (s.timer >= recipe.time) {
              s.timer = 0;
              s.progress = 0;

              // Deduct ingredients
              for (const [ingName, ingQty] of Object.entries(recipe.inputs)) {
                s.inventory[ingName] -= ingQty;
              }

              // Produce outputs
              for (const [outName, outQty] of Object.entries(recipe.outputs)) {
                s.inventory[outName] = (s.inventory[outName] || 0) + outQty;
              }

              // Spark particles on completion
              const pos = world.getComponent(ent, PositionComponent)!;
              for (let i = 0; i < 4; i++) {
                spawnParticle(world, pos.x, pos.y, "#34e7e4", 2.5);
              }
            }
          } else {
            s.timer = 0;
            s.progress = 0;
          }
        }
      }
    }
  }
}
