import React, { useState, useEffect, useRef } from "react";
import {
  WorkerComponent,
  PositionComponent,
  PlayerComponent,
  StructureComponent,
  BuildTool,
} from "../game/components/GameComponents";
import { spawnWorker } from "../game/Spawner";
import { toast } from "../game/utils/Toast";
import { CharacterTextureLoader } from "../game/systems/RenderSystem";

interface GameData {
  playerInventory: Record<string, number>;
  unlockedTechs: Record<string, boolean>;
  activeTool: BuildTool;
  globalStock: Record<string, number>;
  playerCustomization?: {
    skinColor: string;
    hairStyle: string;
    hairColor: string;
    clothingStyle: string;
    clothingColor: string;
    shirtColor: string;
    accessoryStyle: string;
    accessoryColor: string;
  } | null;
}

const SKINS = ["pale", "tanned", "dark", "green"];
const HAIRSTYLES = ["spiky", "short", "bob", "curly", "braids", "none"];
const OUTFITS = ["overalls", "shirt", "jacket", "tunic", "dress", "apron"];
const ACCESSORIES = ["none", "straw_hat", "cap", "ribbon"];

const HAIR_COLORS = [
  { name: "Blond", value: "#f1c40f" },
  { name: "Brown", value: "#8a5a3b" },
  { name: "Black", value: "#2c3e50" },
  { name: "Red", value: "#c0392b" },
  { name: "Purple", value: "#9b59b6" },
  { name: "Grey", value: "#7f8c8d" },
  { name: "Pink", value: "#ff7979" },
  { name: "Blue", value: "#3498db" },
];

const OUTFIT_COLORS = [
  { name: "Brown", value: "#8a5a3b" },
  { name: "Blue", value: "#3498db" },
  { name: "Green", value: "#2ecc71" },
  { name: "Red", value: "#e74c3c" },
  { name: "Orange", value: "#e67e22" },
  { name: "Purple", value: "#9b59b6" },
  { name: "Yellow", value: "#f1c40f" },
  { name: "Charcoal", value: "#2c3e50" },
];

const SHIRT_COLORS = [
  { name: "Red", value: "#c0392b" },
  { name: "Blue", value: "#3498db" },
  { name: "Green", value: "#2ecc71" },
  { name: "Yellow", value: "#f1c40f" },
  { name: "Dark Grey", value: "#2c3e50" },
  { name: "White", value: "#ecf0f1" },
  { name: "Pink", value: "#ff7979" },
  { name: "Purple", value: "#9b59b6" },
];

const ACCESSORY_COLORS = [
  { name: "Yellow", value: "#f1c40f" },
  { name: "Red", value: "#e74c3c" },
  { name: "Blue", value: "#3498db" },
  { name: "Green", value: "#2ecc71" },
  { name: "Orange", value: "#e67e22" },
  { name: "Charcoal", value: "#2c3e50" },
  { name: "White", value: "#ffffff" },
];

const PreviewCanvas = ({ customization }: { customization: any }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const loader = new CharacterTextureLoader();
    let animationId: number;
    let time = 0;

    const tick = () => {
      time += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const skinColor = customization?.skinColor || "pale";
      const hairStyle = customization?.hairStyle || "spiky";
      const hairColor = customization?.hairColor || "#f1c40f";
      const clothingStyle = customization?.clothingStyle || "overalls";
      const clothingColor = customization?.clothingColor || "#8a5a3b";
      const shirtColor = customization?.shirtColor || "#c0392b";
      const accessoryStyle = customization?.accessoryStyle || "none";
      const accessoryColor = customization?.accessoryColor || "#e74c3c";

      // 1. Draw Ground Shadow (vector)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(64, 96, 40, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Walking animation column cycle
      const frameCol = 1 + Math.floor((time * 6) % 2);

      // Walking direction row cycle (Down, Left, Up, Right)
      const dirIndex = Math.floor((time / 1.5) % 4);
      const directionRows = [0, 2, 1, 3];
      const frameRow = directionRows[dirIndex];

      const bodyTex = loader.getTexture("body", skinColor, "", "");
      const outfitTex = loader.getTexture("outfit", clothingStyle, clothingColor, shirtColor);
      const hairTex = loader.getTexture("hair", hairStyle, hairColor, "");
      const accessoryTex = loader.getTexture("accessory", accessoryStyle, accessoryColor, "");

      const drawLayer = (tex: any) => {
        if (!tex) return;
        ctx.drawImage(
          tex,
          frameCol * 32,
          frameRow * 32,
          32,
          32,
          0,
          0,
          128,
          128
        );
      };

      ctx.save();
      drawLayer(bodyTex);
      drawLayer(outfitTex);
      drawLayer(hairTex);
      drawLayer(accessoryTex);
      ctx.restore();

      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [customization]);

  return (
    <canvas
      ref={canvasRef}
      width={128}
      height={128}
      style={{
        imageRendering: "pixelated",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "12px",
        border: "2px solid rgba(52, 231, 228, 0.3)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        display: "block",
        margin: "0 auto 12px auto",
      }}
    />
  );
};

const OptionSelector = ({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#34e7e4", letterSpacing: "0.5px" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "4px 8px" }}>
        <button 
          onClick={onPrev}
          style={{ background: "none", border: "none", color: "#34e7e4", fontSize: "14px", fontWeight: "bold", cursor: "pointer", padding: "0 4px" }}
        >
          &lt;
        </button>
        <span style={{ flex: 1, textAlign: "center", fontSize: "12px", fontWeight: "bold", textTransform: "capitalize", color: "#fff" }}>
          {value.replace("_", " ")}
        </span>
        <button 
          onClick={onNext}
          style={{ background: "none", border: "none", color: "#34e7e4", fontSize: "14px", fontWeight: "bold", cursor: "pointer", padding: "0 4px" }}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

const ColorSwatchGrid = ({ label, selectedColor, colors, onChange }: { label: string; selectedColor: string; colors: { name: string; value: string }[]; onChange: (val: string) => void }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#34e7e4", letterSpacing: "0.5px" }}>{label}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "6px" }}>
        {colors.map((c) => {
          const isSelected = selectedColor?.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              onClick={() => onChange(c.value)}
              title={c.name}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: c.value,
                border: isSelected ? "2px solid #34e7e4" : "1.5px solid rgba(255,255,255,0.3)",
                boxShadow: isSelected ? "0 0 6px #34e7e4" : "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s ease",
                transform: isSelected ? "scale(1.15)" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export function ToolBuilderOverlay() {
  const [activeTab, setActiveTab] = useState<"factory" | "town" | "research">("factory");
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [gameData, setGameData] = useState<GameData>({
    playerInventory: {},
    unlockedTechs: {},
    activeTool: "belt",
    globalStock: {},
    playerCustomization: null,
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

  // Player Customization logic
  const updatePlayerCustomization = (field: string, value: string) => {
    const world = (window as any).gameWorld;
    if (!world) return;
    const playerEnt = world.getEntitiesWith([PlayerComponent])[0];
    if (playerEnt) {
      const player = world.getComponent(playerEnt, PlayerComponent);
      player[field] = value;
      setGameData(prev => ({
        ...prev,
        playerCustomization: prev.playerCustomization ? {
          ...prev.playerCustomization,
          [field]: value
        } : null
      }));
    }
  };

  const cycleOption = (field: string, list: string[], direction: number) => {
    const current = (gameData.playerCustomization as any)?.[field] || list[0];
    const idx = list.indexOf(current);
    const nextIdx = (idx + direction + list.length) % list.length;
    updatePlayerCustomization(field, list[nextIdx]);
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
          <button
            className="tab-btn"
            style={{ border: "1.5px solid rgba(52, 231, 228, 0.4)", color: "#34e7e4", background: "rgba(52, 231, 228, 0.05)" }}
            onClick={() => setIsWardrobeOpen(true)}
          >
            👗 Wardrobe
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

                <div className="customizer-section" style={{ borderTop: "1px solid #34495e", paddingTop: "10px", marginTop: "10px", marginBottom: "15px" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#fff" }}>🎨 Custom Appearance</h4>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div className="form-group" style={{ marginBottom: "5px" }}>
                      <label className="form-label" style={{ display: "block", marginBottom: "3px", fontSize: "11px", opacity: 0.8, color: "#fff" }}>Hair Style:</label>
                      <select
                        className="dialog-select"
                        value={workerInfo.comp.hairStyle || "short"}
                        onChange={(e) => {
                          workerInfo.comp.hairStyle = e.target.value;
                          setActiveCottage({ ...activeCottage });
                        }}
                        style={{ width: "100%", padding: "4px", background: "#2c3e50", color: "#fff", border: "1px solid #34495e", fontSize: "12px", borderRadius: "4px", cursor: "pointer" }}
                      >
                        <option value="short">Short</option>
                        <option value="spiky">Spiky</option>
                        <option value="bob">Bob</option>
                        <option value="curly">Curly</option>
                        <option value="braids">Braids</option>
                        <option value="none">Bald</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: "5px" }}>
                      <label className="form-label" style={{ display: "block", marginBottom: "3px", fontSize: "11px", opacity: 0.8, color: "#fff" }}>Hair Color:</label>
                      <select
                        className="dialog-select"
                        value={workerInfo.comp.hairColor || "#34495e"}
                        onChange={(e) => {
                          workerInfo.comp.hairColor = e.target.value;
                          setActiveCottage({ ...activeCottage });
                        }}
                        style={{ width: "100%", padding: "4px", background: "#2c3e50", color: "#fff", border: "1px solid #34495e", fontSize: "12px", borderRadius: "4px", cursor: "pointer" }}
                      >
                        <option value="#f1c40f">Blond</option>
                        <option value="#8a5a3b">Brown</option>
                        <option value="#2c3e50">Black</option>
                        <option value="#c0392b">Red</option>
                        <option value="#9b59b6">Purple</option>
                        <option value="#7f8c8d">Grey</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: "5px" }}>
                      <label className="form-label" style={{ display: "block", marginBottom: "3px", fontSize: "11px", opacity: 0.8, color: "#fff" }}>Outfit Style:</label>
                      <select
                        className="dialog-select"
                        value={workerInfo.comp.clothingStyle || "shirt"}
                        onChange={(e) => {
                          workerInfo.comp.clothingStyle = e.target.value;
                          setActiveCottage({ ...activeCottage });
                        }}
                        style={{ width: "100%", padding: "4px", background: "#2c3e50", color: "#fff", border: "1px solid #34495e", fontSize: "12px", borderRadius: "4px", cursor: "pointer" }}
                      >
                        <option value="shirt">Shirt</option>
                        <option value="jacket">Jacket</option>
                        <option value="overalls">Overalls</option>
                        <option value="tunic">Tunic</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: "5px" }}>
                      <label className="form-label" style={{ display: "block", marginBottom: "3px", fontSize: "11px", opacity: 0.8, color: "#fff" }}>Outfit Color:</label>
                      <select
                        className="dialog-select"
                        value={workerInfo.comp.clothingColor || "#e67e22"}
                        onChange={(e) => {
                          workerInfo.comp.clothingColor = e.target.value;
                          setActiveCottage({ ...activeCottage });
                        }}
                        style={{ width: "100%", padding: "4px", background: "#2c3e50", color: "#fff", border: "1px solid #34495e", fontSize: "12px", borderRadius: "4px", cursor: "pointer" }}
                      >
                        <option value="#e67e22">Orange</option>
                        <option value="#3498db">Blue</option>
                        <option value="#2ecc71">Green</option>
                        <option value="#9b59b6">Purple</option>
                        <option value="#c0392b">Red</option>
                        <option value="#1abc9c">Teal</option>
                      </select>
                    </div>
                  </div>
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

      {/* Wardrobe Modal */}
      {isWardrobeOpen && (
        <div className="dialog-overlay" style={{ display: "flex" }}>
          <div className="dialog-content" style={{ width: "440px", gap: "16px" }}>
            <h3 style={{ margin: "0" }}>👗 Player Wardrobe Customizer</h3>
            <p className="dialog-desc" style={{ margin: "0" }}>
              Design your farmer's style. Changes will apply instantly to your character in the world!
            </p>

            <div style={{ display: "flex", gap: "24px", textAlign: "left", width: "100%" }}>
              {/* Left Column: Preview */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "140px", flexShrink: 0 }}>
                <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#34e7e4", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Live Preview
                </span>
                <PreviewCanvas customization={gameData.playerCustomization} />
                <span style={{ fontSize: "10px", color: "#a4b0be", fontStyle: "italic" }}>
                  Walking Cycle
                </span>
              </div>

              {/* Right Column: Cyclers & Swatches */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", maxHeight: "330px", overflowY: "auto", paddingRight: "6px" }}>
                {/* 1. Skin Selector */}
                <OptionSelector
                  label="Skin Tone"
                  value={gameData.playerCustomization?.skinColor || "pale"}
                  onPrev={() => cycleOption("skinColor", SKINS, -1)}
                  onNext={() => cycleOption("skinColor", SKINS, 1)}
                />

                {/* 2. Hair Style Selector */}
                <OptionSelector
                  label="Hair Style"
                  value={gameData.playerCustomization?.hairStyle || "spiky"}
                  onPrev={() => cycleOption("hairStyle", HAIRSTYLES, -1)}
                  onNext={() => cycleOption("hairStyle", HAIRSTYLES, 1)}
                />

                {/* 3. Hair Color Swatches */}
                <ColorSwatchGrid
                  label="Hair Color"
                  selectedColor={gameData.playerCustomization?.hairColor || "#f1c40f"}
                  colors={HAIR_COLORS}
                  onChange={(val) => updatePlayerCustomization("hairColor", val)}
                />

                {/* 4. Outfit Style Selector */}
                <OptionSelector
                  label="Outfit Style"
                  value={gameData.playerCustomization?.clothingStyle || "overalls"}
                  onPrev={() => cycleOption("clothingStyle", OUTFITS, -1)}
                  onNext={() => cycleOption("clothingStyle", OUTFITS, 1)}
                />

                {/* 5. Outfit Color Swatches */}
                <ColorSwatchGrid
                  label="Outfit Color"
                  selectedColor={gameData.playerCustomization?.clothingColor || "#8a5a3b"}
                  colors={OUTFIT_COLORS}
                  onChange={(val) => updatePlayerCustomization("clothingColor", val)}
                />

                {/* 6. Shirt Color Swatches */}
                <ColorSwatchGrid
                  label="Shirt Color"
                  selectedColor={gameData.playerCustomization?.shirtColor || "#c0392b"}
                  colors={SHIRT_COLORS}
                  onChange={(val) => updatePlayerCustomization("shirtColor", val)}
                />

                {/* 7. Accessory/Hat Style Selector */}
                <OptionSelector
                  label="Accessory / Hat"
                  value={gameData.playerCustomization?.accessoryStyle || "none"}
                  onPrev={() => cycleOption("accessoryStyle", ACCESSORIES, -1)}
                  onNext={() => cycleOption("accessoryStyle", ACCESSORIES, 1)}
                />

                {/* 8. Accessory Color Swatches */}
                <ColorSwatchGrid
                  label="Accessory Color"
                  selectedColor={gameData.playerCustomization?.accessoryColor || "#e74c3c"}
                  colors={ACCESSORY_COLORS}
                  onChange={(val) => updatePlayerCustomization("accessoryColor", val)}
                />
              </div>
            </div>

            <button
              className="dialog-btn success"
              onClick={() => {
                setIsWardrobeOpen(false);
                if (gameInstance) {
                  gameInstance.saveGame();
                }
              }}
              style={{ width: "100%", marginTop: "8px" }}
            >
              Save & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
