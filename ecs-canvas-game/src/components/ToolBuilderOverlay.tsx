import React, { useState, useEffect } from "react";
import {
  WorkerComponent,
  PositionComponent,
  PlayerComponent,
  StructureComponent,
  BuildTool,
} from "../game/components/GameComponents";
import { spawnWorker } from "../game/Spawner";
import { toast } from "../game/utils/Toast";

interface GameData {
  playerInventory: Record<string, number>;
  unlockedTechs: Record<string, boolean>;
  activeTool: BuildTool;
  globalStock: Record<string, number>;
}

export function ToolBuilderOverlay() {
  const [activeTab, setActiveTab] = useState<"factory" | "town" | "research">("factory");
  const [gameData, setGameData] = useState<GameData>({
    playerInventory: {},
    unlockedTechs: {},
    activeTool: "belt",
    globalStock: {},
  });

  // Modal Dialogs
  const [activeCottage, setActiveCottage] = useState<{ houseId: string; world: any } | null>(null);
  const [showTechTree, setShowTechTree] = useState(false);

  // Sync state from ECS engine tick
  useEffect(() => {
    (window as any).onGameUpdate = (data: GameData) => {
      setGameData(data);
    };

    // Override the vanilla worker dialog handler
    (window as any).refreshWorkerDialog = (houseId: string, worldRef: any) => {
      setActiveCottage({ houseId, world: worldRef });
    };

    return () => {
      delete (window as any).onGameUpdate;
      delete (window as any).refreshWorkerDialog;
    };
  }, []);

  const gameInstance = (window as any).gameInstance;

  const selectTool = (tool: BuildTool) => {
    if (gameInstance) {
      gameInstance.changeActiveTool(tool);
    }
  };

  const handleReset = () => {
    if (gameInstance && window.confirm("Are you sure you want to wipe save state and restart your colony?")) {
      gameInstance.resetGame();
      toast.info("Colony has been reset.");
    }
  };

  // Cottage / Worker logic
  const getCottageWorker = () => {
    if (!activeCottage) return null;
    const workers = activeCottage.world.getEntitiesWith([WorkerComponent]);
    const workerEnt = workers.find(
      (w: string) => activeCottage.world.getComponent(w, WorkerComponent).houseEntityId === activeCottage.houseId
    );
    if (!workerEnt) return null;
    return {
      id: workerEnt,
      comp: activeCottage.world.getComponent(workerEnt, WorkerComponent),
    };
  };

  const hireWorker = () => {
    if (!activeCottage) return;
    const playerEnt = activeCottage.world.getEntitiesWith([PlayerComponent])[0];
    if (!playerEnt) return;

    const player = activeCottage.world.getComponent(playerEnt, PlayerComponent);
    const wood = player.inventory["wood"] || 0;
    const iron = player.inventory["iron_plate"] || 0;

    if (wood >= 10 && iron >= 10) {
      player.inventory["wood"] -= 10;
      player.inventory["iron_plate"] -= 10;

      const housePos = activeCottage.world.getComponent(activeCottage.houseId, PositionComponent);
      spawnWorker(activeCottage.world, housePos.x, housePos.y, activeCottage.houseId);

      toast.success("Worker hired successfully!");
      // Trigger update
      setActiveCottage({ ...activeCottage });
    } else {
      toast.error("Requires 10 Wood and 10 Iron Plates!");
    }
  };

  const dismissWorker = (workerId: string) => {
    if (!activeCottage) return;
    activeCottage.world.destroyEntity(workerId);

    const playerEnt = activeCottage.world.getEntitiesWith([PlayerComponent])[0];
    if (playerEnt) {
      const player = activeCottage.world.getComponent(playerEnt, PlayerComponent);
      player.inventory["wood"] = (player.inventory["wood"] || 0) + 5;
      player.inventory["iron_plate"] = (player.inventory["iron_plate"] || 0) + 5;
    }

    toast.info("Worker dismissed. 5 Wood & 5 Iron refunded.");
    setActiveCottage({ ...activeCottage });
  };

  const changeWorkerRole = (workerComp: any, role: string) => {
    if (!activeCottage) return;
    workerComp.role = role || null;
    workerComp.state = "seeking";
    workerComp.path = [];
    workerComp.pathIndex = 0;
    toast.info(`Assigned worker role to ${role ? role.toUpperCase() : "NONE"}`);
    setActiveCottage({ ...activeCottage });
  };

  // Research logic
  const handleResearch = (techId: string) => {
    if (gameInstance) {
      gameInstance.researchTechnology(techId);
    }
  };

  const workerInfo = getCottageWorker();

  // Tech Tree requirements helper
  const getTechCardClass = (techId: string, cost: Record<string, number>) => {
    if (gameData.unlockedTechs[techId]) return "tech-node-card unlocked";
    let hasMats = true;
    for (const [item, qty] of Object.entries(cost)) {
      if ((gameData.globalStock[item] || 0) < qty) {
        hasMats = false;
        break;
      }
    }
    return hasMats ? "tech-node-card available" : "tech-node-card locked";
  };

  return (
    <div className="react-overlay-wrapper">
      {/* Floating Toolbar Panel */}
      <div id="toolbar-container">
        <div id="toolbar-tabs">
          <button
            className={`tab-btn ${activeTab === "factory" ? "active" : ""}`}
            onClick={() => setActiveTab("factory")}
          >
            Factory Tools
          </button>
          <button
            className={`tab-btn ${activeTab === "town" ? "active" : ""}`}
            onClick={() => setActiveTab("town")}
          >
            Town Builder
          </button>
          <button
            className={`tab-btn ${activeTab === "research" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("research");
              setShowTechTree(true);
            }}
          >
            Research Techs
          </button>
        </div>

        <div id="toolbar-content-row">
          {activeTab === "factory" && (
            <div className="tools-group active">
              {[
                { id: "belt", label: "Conveyor Belt", icon: "🔀", title: "Conveyor Belt (Click/Drag to Place)" },
                { id: "inserter", label: "Inserter", icon: "🦾", title: "Inserter (Click to Place, R to Rotate)" },
                { id: "drill", label: "Drill", icon: "⛏️", title: "Mining Drill (Place on Ore Veins/Trees)" },
                {
                  id: "advanced_drill",
                  label: "Adv Drill",
                  icon: "⚡⛏️",
                  title: "Advanced Drill (Requires Power, Mines 2x faster)",
                  locked: !gameData.unlockedTechs["advanced_mining"],
                },
                { id: "furnace", label: "Furnace", icon: "🔥", title: "Smelting Furnace (Smelts Ore using Coal)" },
                {
                  id: "advanced_furnace",
                  label: "E-Furnace",
                  icon: "⚡🔥",
                  title: "Electric Furnace (Requires Power, Smelts 2x faster, needs no coal)",
                  locked: !gameData.unlockedTechs["industrial_smelting"],
                },
                { id: "assembler", label: "Assembler", icon: "⚙️", title: "Assembly Machine (Crafts items automatically)" },
                { id: "chest", label: "Chest", icon: "📦", title: "Wooden Chest (Stores items)" },
                { id: "pole", label: "Pole", icon: "⚡", title: "Power Pole (Distributes electricity in a grid)" },
                { id: "generator", label: "Generator", icon: "🏭", title: "Coal Generator (Burns coal to power grid)" },
              ].map((tool) => {
                if (tool.locked) return null;
                return (
                  <button
                    key={tool.id}
                    className={`tool-btn ${gameData.activeTool === tool.id ? "active" : ""}`}
                    onClick={() => selectTool(tool.id as BuildTool)}
                    title={tool.title}
                  >
                    <span className="tool-icon">{tool.icon}</span>
                    <span className="tool-label">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "town" && (
            <div className="tools-group active">
              <button
                className={`tool-btn ${gameData.activeTool === "road" ? "active" : ""}`}
                onClick={() => selectTool("road")}
                title="Dirt Road (Place on empty Grass to speed up movement. Cost: 1.0 weight)"
              >
                <span className="tool-icon">🛣️</span>
                <span className="tool-label">Road</span>
              </button>
              {gameData.unlockedTechs["high_speed_logistics"] && (
                <button
                  className={`tool-btn ${gameData.activeTool === "fast_road" ? "active" : ""}`}
                  onClick={() => selectTool("fast_road")}
                  title="High Speed Road (Allows workers and players to walk 4x faster. Cost: 0.25 weight)"
                >
                  <span className="tool-icon">⚡🛣️</span>
                  <span className="tool-label">Fast Road</span>
                </button>
              )}
              <button
                className={`tool-btn ${gameData.activeTool === "storage_house" ? "active" : ""}`}
                onClick={() => selectTool("storage_house")}
                title="Storage House (Red barn for material storage)"
              >
                <span className="tool-icon">🏠</span>
                <span className="tool-label">Storage House</span>
              </button>
              <button
                className={`tool-btn ${gameData.activeTool === "worker_house" ? "active" : ""}`}
                onClick={() => selectTool("worker_house")}
                title="Worker House (Blue cottage for farm workers)"
              >
                <span className="tool-icon">🏡</span>
                <span className="tool-label">Worker House</span>
              </button>
            </div>
          )}

          <div id="toolbar-divider" />

          <button className="tool-btn danger" onClick={handleReset} title="Wipe save state and restart factory">
            <span className="tool-icon">🔄</span>
            <span className="tool-label">Reset</span>
          </button>
        </div>
      </div>

      {/* Cottage Inspector dialog */}
      {activeCottage && (
        <div className="dialog-overlay" style={{ display: "flex" }}>
          <div className="dialog-content">
            <h3>🏡 Hired Worker Cottage</h3>
            {!workerInfo ? (
              <>
                <p>Status: No worker hired.</p>
                <div className="dialog-desc">
                  Hire a dedicated worker for this cottage to automate resource gathering.
                  Each worker cottage has a capacity of exactly 1 worker.
                </div>
                <p className="dialog-cost">Cost: 🪓 10 Wood, 🪙 10 Iron Plate</p>
                <button className="dialog-btn success" onClick={hireWorker}>
                  Buy/Hire Worker
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: "12px", fontSize: "14px", lineHeight: "1.5" }}>
                  <strong>Role:</strong> {workerInfo.comp.role ? workerInfo.comp.role.toUpperCase() : "NONE"}
                  <br />
                  <strong>State:</strong>{" "}
                  <span style={{ color: workerInfo.comp.state === "starving" ? "#e74c3c" : "#3498db", fontWeight: "bold" }}>
                    {workerInfo.comp.state.toUpperCase().replace("_", " ")}
                  </span>
                  <br />
                  <strong>Hunger:</strong>{" "}
                  <span
                    style={{
                      color: workerInfo.comp.isStarving || workerInfo.comp.hunger < 25 ? "#e74c3c" : "#2ecc71",
                      fontWeight: "bold",
                    }}
                  >
                    {workerInfo.comp.isStarving ? "STARVING ⚠️" : `${Math.floor(workerInfo.comp.hunger)}%`}
                  </span>
                  <br />
                  <strong>Energy:</strong>{" "}
                  <span
                    style={{
                      color: workerInfo.comp.energy < 25 ? "#e74c3c" : "#2ecc71",
                      fontWeight: "bold",
                    }}
                  >
                    {Math.floor(workerInfo.comp.energy)}%
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: "15px" }}>
                  <label className="form-label" style={{ display: "block", marginBottom: "6px" }}>
                    Assign Worker Role:
                  </label>
                  <select
                    className="dialog-select"
                    value={workerInfo.comp.role || ""}
                    onChange={(e) => changeWorkerRole(workerInfo.comp, e.target.value)}
                    style={{ width: "100%", padding: "6px", background: "#2c3e50", color: "#fff", border: "1px solid #34495e" }}
                  >
                    <option value="">-- Select Role --</option>
                    <option value="farmer">🌾 Farmer (Plants, Waters & Harvests Crops)</option>
                    <option value="miner">⛏️ Miner (Extracts Iron/Copper/Coal/Stone)</option>
                    <option value="fisher">🎣 Fisher (Harvests adjacent Water tiles)</option>
                  </select>
                </div>

                <button className="dialog-btn danger" onClick={() => dismissWorker(workerInfo.id)}>
                  Dismiss Worker
                </button>
              </>
            )}
            <button className="dialog-btn secondary" onClick={() => setActiveCottage(null)}>
              Close Menu
            </button>
          </div>
        </div>
      )}

      {/* Tech Tree dialog */}
      {showTechTree && (
        <div className="dialog-overlay" style={{ display: "flex" }}>
          <div className="dialog-content tech-dialog">
            <h3>🧬 Technology Tree & Research</h3>
            <p className="dialog-desc">Spend resources from the global Storage Houses to unlock advanced automation blueprints.</p>

            <div className="tech-nodes-container">
              {/* Node 1: Advanced Mining */}
              <div className={getTechCardClass("advanced_mining", { wood: 500, stone: 200 })}>
                <div className="tech-node-header">
                  <span className="tech-node-icon">⛏️</span>
                  <span className="tech-node-title">Advanced Mining</span>
                </div>
                <p className="tech-node-desc">Unlocks the Advanced Drill (mines 2x faster, requires electricity).</p>
                <div className="tech-node-requirements">
                  <strong>Cost:</strong>{" "}
                  <span className={(gameData.globalStock["wood"] || 0) >= 500 ? "res-cost met" : "res-cost unmet"}>
                    🪵 {gameData.globalStock["wood"] || 0} / 500 Wood
                  </span>
                  ,{" "}
                  <span className={(gameData.globalStock["stone"] || 0) >= 200 ? "res-cost met" : "res-cost unmet"}>
                    🪨 {gameData.globalStock["stone"] || 0} / 200 Stone
                  </span>
                </div>
                <button
                  className="dialog-btn success tech-research-btn"
                  disabled={!!gameData.unlockedTechs["advanced_mining"]}
                  onClick={() => handleResearch("advanced_mining")}
                >
                  {gameData.unlockedTechs["advanced_mining"] ? "Researched ✓" : "Research"}
                </button>
              </div>

              {/* Node 2: High-Speed Logistics */}
              <div className={getTechCardClass("high_speed_logistics", { wood: 300, iron_plate: 100 })}>
                <div className="tech-node-header">
                  <span className="tech-node-icon">🛣️</span>
                  <span className="tech-node-title">High-Speed Logistics</span>
                </div>
                <p className="tech-node-desc">Unlocks the High Speed Road (allows workers/player to move 4x faster).</p>
                <div className="tech-node-requirements">
                  <strong>Cost:</strong>{" "}
                  <span className={(gameData.globalStock["wood"] || 0) >= 300 ? "res-cost met" : "res-cost unmet"}>
                    🪵 {gameData.globalStock["wood"] || 0} / 300 Wood
                  </span>
                  ,{" "}
                  <span className={(gameData.globalStock["iron_plate"] || 0) >= 100 ? "res-cost met" : "res-cost unmet"}>
                    🪙 {gameData.globalStock["iron_plate"] || 0} / 100 Iron Plate
                  </span>
                </div>
                <button
                  className="dialog-btn success tech-research-btn"
                  disabled={!!gameData.unlockedTechs["high_speed_logistics"]}
                  onClick={() => handleResearch("high_speed_logistics")}
                >
                  {gameData.unlockedTechs["high_speed_logistics"] ? "Researched ✓" : "Research"}
                </button>
              </div>

              {/* Node 3: Industrial Smelting */}
              <div className={getTechCardClass("industrial_smelting", { stone: 400, coal: 150 })}>
                <div className="tech-node-header">
                  <span className="tech-node-icon">⚡</span>
                  <span className="tech-node-title">Industrial Smelting</span>
                </div>
                <p className="tech-node-desc">Unlocks the Electric Furnace (smelts 2x faster, requires power, needs no coal fuel).</p>
                <div className="tech-node-requirements">
                  <strong>Cost:</strong>{" "}
                  <span className={(gameData.globalStock["stone"] || 0) >= 400 ? "res-cost met" : "res-cost unmet"}>
                    🪨 {gameData.globalStock["stone"] || 0} / 400 Stone
                  </span>
                  ,{" "}
                  <span className={(gameData.globalStock["coal"] || 0) >= 150 ? "res-cost met" : "res-cost unmet"}>
                    ⚫ {gameData.globalStock["coal"] || 0} / 150 Coal
                  </span>
                </div>
                <button
                  className="dialog-btn success tech-research-btn"
                  disabled={!!gameData.unlockedTechs["industrial_smelting"]}
                  onClick={() => handleResearch("industrial_smelting")}
                >
                  {gameData.unlockedTechs["industrial_smelting"] ? "Researched ✓" : "Research"}
                </button>
              </div>
            </div>

            <button className="dialog-btn secondary" onClick={() => setShowTechTree(false)}>
              Close Tree
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
