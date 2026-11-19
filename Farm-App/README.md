# MeadowLife for Windows

Run the x64 setup file in dist-electron, select the current-user installation option, and choose an installation directory. Start MeadowLife from its Start menu or desktop shortcut. The installed desktop game runs offline. Use the Folder button to find the saves in your Windows profile. The first save-folder access also imports eligible JSON saves from the old Farm-App save directories when they are available.

## Commission the ironworks

Walk east from the farmhouse to the gray iron seam. Place a burner drill on the seam and point it toward a conveyor. Run the conveyor into a stone furnace. Place a burner inserter one tile beyond the furnace and a chest one tile beyond the inserter. Aim the inserter at the chest. Ctrl-click each burner machine to load fuel from your inventory. The work order completes after the furnace smelts ten iron plates.

Copper and coal are available in the same yard. Build a powered assembler for more components and feed science packs into a powered lab to advance research. Carrots can be planted in the original farm plots. A steam generator needs a fueled boiler within three tiles. Place the boiler within three tiles of water.

| Control | Action |
| --- | --- |
| WASD or arrows, Shift | Move or sprint |
| 1 through 0, Q | Select a hotbar slot or sample a hovered building. Press Q over empty ground to clear the selection. |
| Left click, left drag with build materials | Build, interact, or place a row of conveyors, walls, or paving |
| Ctrl + left click | Load fuel into a burner machine |
| Right click | Dismantle a machine, lift paving, or remove a planning mark |
| R, Shift + R | Rotate clockwise or counterclockwise |
| Alt, P | Toggle machine overlays or open production totals |
| M, B, Space | Survey the map, cycle weapons, or fire near the cursor |
| F, Z | Collect nearby items or drop one at the cursor |
| E or I, Enter | Open inventory or interact with the tile ahead |
| Mouse wheel, F11 | Zoom or toggle fullscreen |
| F5, F9 | Save or load a disk checkpoint |

## Workshop update in 1.3

- Open the backpack with **E** or **I**. Left-click a slot to lift its stack. Left-click a second slot to move, merge, or swap it. Right-click to lift half a stack or place one item. Shift-click a compatible machine slot to transfer items.
- Close the backpack to take the selected stack into the yard. **Q** puts it back. With an empty cursor, **Q** samples the building or deposit under the pointer.
- Hover over an inventory item and press **1–0** to link it to the quickbar. The shortcut stays bound when you move, sort, or use up the item. Right-click a shortcut to lift half a stack and middle-click to clear the shortcut.
- Left-click to build. Drag to lay conveyors, walls, and paving. **R** turns equipment. The preview shows orientation, reach, and collisions. Shift-click marks a construction plan without spending stock. Place a matching item to complete the plan or right-click to remove the mark.
- Use stone brick or concrete to pave clear ground. Landfill works on water. Saves retain paving, planning marks, shortcuts, and the stack in hand.

The basin uses original cached tree, ore, water, and item sprites. Shorelines have shallow margins and subdued reflections. Ore, loose cargo, and storage crates use consistent material colors across the map and inventory.

The interaction reference was Factorio’s public description of quickbar links, cursor stacks, and construction planning. [Quickbar](https://wiki.factorio.com/Quickbar) · [Controls](https://wiki.factorio.com/Controls) · [Construction ghosts](https://wiki.factorio.com/Ghost)

## Field update in 1.2

| Area | MeadowLife behavior |
| --- | --- |
| Movement and actions | Normalized diagonals, radius-based collisions with wall sliding, a sprint modifier, conveyor motion, and a stride tied to distance traveled. Hold right-click over a resource with the pickaxe or axe. |
| Survey map | Press **M** for yard and region views. The yard shows metals, scout positions, and turret coverage. Emissions can be toggled. The radar follows the engineer. |
| Inventory and crafting | **E** or **I** opens the backpack, a searchable recipe catalog, and an actual equipment and ammunition display. The workbench reserves carried materials, supplies intermediate recipes, and resumes jobs after loading. |
| Collection | **Z** drops one selected item on a belt or the ground. Hold **F** to collect nearby stacks or belt cargo. Items stay in the world if the backpack is full. |
| Weapons | **B** equips the next carried weapon and clears the building selection. Aim near a scout and hold **Space** to fire. The pistol, automatic weapon, and shotguns use compatible ammunition and have different firing intervals. |
| Defenses and progression | Processing emissions draw scouts toward active machinery. Stock a gun turret with Ctrl-click, defend it with walls, and Shift-click damaged equipment with a repair pack. After smelting and perimeter defense, craft a research bench, solar panels, and science packs from basic materials. |

The audit used Factorio’s public controls and documented pollution, combat, and update systems as design references. [Controls](https://wiki.factorio.com/Keyboard_bindings) · [Pollution](https://wiki.factorio.com/Pollution) · [Performance](https://wiki.factorio.com/Tutorial:Diagnosing_performance_issues)

### Frame stalls

The same Windows desktop test pressed **F** sixteen times with an empty pickup radius. Before the update, the worst measured animation-frame gap was 1,583 ms and the 95th percentile was 1,550 ms. In the final installed build, the worst gap was 16.9 ms and the 95th percentile was 16.8 ms, with zero browser long tasks during pickup. The test used the packaged game at a 1266 × 683 logical-pixel viewport.

The largest input stall came from cloning the full world for a pickup operation. Crafting had a separate full-map inventory scan for each recipe check. The update restricts pickup to nearby tiles, reads backpack stock for handcrafting, caches static terrain in chunks, and rate-limits radar rendering. World updates run independently of the frame cap. Turn on the performance overlay in Graphics Settings to see FPS, factory updates per second, and peak frame time.

## Desktop assessment

The redesign uses mining, conveyors, smelting, power, and research as the reference for the factory loop. [Factorio game overview](https://www.factorio.com/game/content)

| Area | Findings from the previous desktop build | Change in this release |
| --- | --- | --- |
| Startup and layout | Terrain noise was initialized before its class declaration. The desktop renderer occupied a fixed-width frame, and two keyboard handlers toggled inventory on the same press. | Fixed the initialization order and inventory shortcut. The canvas fills the window, and pointer targeting follows the camera at different resolutions. |
| Early production | A drill lost the underlying ore type when placed. Blocked outputs could discard items, and inserters could take raw material or fuel from a furnace. | Drills retain finite mineral deposits. Belts queue items in two lanes, drills buffer blocked output, and inserters extract from machine output slots. Burner machines consume measured fuel as they run. |
| Factory feedback | The production window showed example rates. Power figures could show capacity with an idle generator. | The game counts actual machine output, material use, and fuel use. Electricity responds to daylight, weather, and nearby fueled boilers. Hovering over machinery shows its operating state. |
| Construction | Stamp could create entities without deducting items, and dismantling could discard machine contents. | Placement previews show reach and direction. Blueprints preserve orientation and recipes, consume inventory, and use the normal placement rules. Dismantling returns the contents when the inventory fits. |
| Saves | Compressed saves omitted belt cargo, orientation, and other live machine fields. Quick Save serialized the raw world into browser storage before attempting disk I/O. | Desktop saves write directly to the profile. Compressed snapshots keep equipment orientation, cargo, machine progress, fuel, deposit counts, and production totals. Older JSON saves remain readable. |

Electricity uses one shared grid. Several late-game systems remain prototypes, and the desktop room interface is a local simulation. The tested path covers early factory progression, perimeter defense, and the supporting save, power, and construction mechanics.

## Build

From Farm-App, run npm ci, npm run typecheck, and npm run desktop:build. The last command writes the NSIS setup executable to dist-electron. Build-Windows-Installer.bat runs the installer build on Windows.
