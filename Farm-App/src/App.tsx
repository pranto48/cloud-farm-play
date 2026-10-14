import React, { useState, useEffect, useCallback } from "react";
import { MeadowLife } from "./game/MeadowLife";
import {
  isDesktopRuntime,
  listAllSaves,
  loadGameFromDisk,
  deleteSaveFromDisk,
  openDesktopSavesFolder,
  type DesktopSaveSlot,
} from "./saves/DiskSaveSystem";
import {
  Maximize,
  Minimize,
  HardDrive,
  FolderOpen,
  HelpCircle,
  Save,
  Trash2,
  Play,
  X,
  Keyboard,
  Clock,
  Coins,
  Cpu,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import type { GameState } from "./game/meadow-life";

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveList, setSaveList] = useState<DesktopSaveSlot[]>([]);
  const [activeSaveState, setActiveSaveState] = useState<GameState | null>(null);
  const [gameInstanceKey, setGameInstanceKey] = useState<number>(1);
  const isDesktop = isDesktopRuntime();

  // Load saves from disk
  const refreshSaves = useCallback(async () => {
    const list = await listAllSaves();
    setSaveList(list);
  }, []);

  useEffect(() => {
    if (savesOpen) {
      refreshSaves();
    }
  }, [savesOpen, refreshSaves]);

  const handleToggleFullscreen = async () => {
    if (isDesktop && window.desktopAPI?.toggleFullscreen) {
      const fs = await window.desktopAPI.toggleFullscreen();
      setIsFullscreen(fs);
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleOpenFolder = async () => {
    if (isDesktop) {
      await openDesktopSavesFolder();
      toast.info("Opened saves directory in Windows File Explorer.");
    } else {
      toast.warning("Folder open is only supported in native Windows Desktop runner.");
    }
  };

  const handleLoadSlot = async (slot: DesktopSaveSlot) => {
    const res = await loadGameFromDisk(slot);
    if (res.success && res.state) {
      setActiveSaveState(res.state);
      setGameInstanceKey((k) => k + 1);
      setSavesOpen(false);
      toast.success(`Loaded "${slot.name}" successfully! 🚀`);
    } else {
      toast.error(res.message || "Failed to load save file.");
    }
  };

  const handleDeleteSlot = async (slotId: string, name: string) => {
    if (window.confirm(`Delete save "${name}" from disk?`)) {
      await deleteSaveFromDisk(slotId);
      await refreshSaves();
      toast.info(`Save "${name}" deleted.`);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b0e14] text-slate-100 overflow-hidden select-none font-mono">
      {/* Native Desktop Factorio Steel Titlebar Header */}
      <header className="h-8 bg-[#141820] border-b border-[#252d3a] flex items-center justify-between px-3 z-40 shrink-0 text-xs shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-base select-none">🏭</span>
          <span className="font-black text-[#ff9200] tracking-wider text-xs">
            FARM-APP <span className="text-slate-400 font-medium">| FACTORIO DESKTOP EDITION</span>
          </span>
          <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 border border-emerald-600/60 rounded flex items-center gap-1 font-semibold">
            <HardDrive className="w-3 h-3" />
            <span>PORTABLE DISK SAVES</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          {/* Saves Manager Button */}
          <button
            onClick={() => setSavesOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1a202c] hover:bg-[#252e3e] border border-[#2d3748] hover:border-amber-500/60 text-amber-300 rounded text-[11px] transition-colors cursor-pointer"
            title="Manage Local Disk Save Files (*.json)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Saves</span>
          </button>

          {/* Open Folder in Windows Explorer */}
          {isDesktop && (
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-1 px-2 py-1 bg-[#1a202c] hover:bg-[#252e3e] border border-[#2d3748] hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300 rounded text-[11px] transition-colors cursor-pointer"
              title="Open saves/ folder in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Folder</span>
            </button>
          )}

          {/* Hotkey Guide Modal Button */}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-1 px-2 py-1 bg-[#1a202c] hover:bg-[#252e3e] border border-[#2d3748] hover:border-sky-500/60 text-slate-300 hover:text-sky-300 rounded text-[11px] transition-colors cursor-pointer"
            title="Desktop Controls & Keybindings"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Controls</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            title="Toggle Borderless Fullscreen (F11)"
            className="p-1.5 hover:text-amber-400 hover:bg-[#1f2735] border border-transparent hover:border-[#2d3748] rounded transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Game Surface */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        <MeadowLife key={gameInstanceKey} initialState={activeSaveState} onStateChange={() => {}} />
      </main>

      {/* Saves Manager Dialog */}
      {savesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#141820] border-2 border-[#ff9200]/70 rounded-md w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl font-mono">
            <div className="p-3 bg-[#1a202c] border-b border-[#2d3748] flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <HardDrive className="w-4 h-4" />
                <span>LOCAL DISK SAVES (Farm-App/saves/*.json)</span>
              </div>
              <button
                onClick={() => setSavesOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              {saveList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <p>No disk saves found yet.</p>
                  <p className="mt-1 text-slate-500">
                    Press <strong className="text-amber-400">F5</strong> in game to create a Quick Save checkpoint!
                  </p>
                </div>
              ) : (
                saveList.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-3 bg-[#0d1017] border border-[#2d3748] hover:border-amber-500/60 rounded flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300 text-xs truncate">{slot.name}</span>
                        {slot.id === "quicksave" && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-bold">
                            F5 QUICKSAVE
                          </span>
                        )}
                        {slot.id === "autosave" && (
                          <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded text-[9px] font-bold">
                            AUTOSAVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Day {slot.day} ({slot.season})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-400" />
                          <span>{slot.coins}</span>
                        </span>
                        {slot.machinesCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-emerald-400" />
                            <span>{slot.machinesCount} machines</span>
                          </span>
                        )}
                        <span className="text-slate-500">{new Date(slot.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoadSlot(slot)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-xs transition-colors cursor-pointer"
                        title="Load this save"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Load</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slot.id, slot.name)}
                        className="p-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-700/50 text-rose-300 rounded transition-colors cursor-pointer"
                        title="Delete this save file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-[#1a202c] border-t border-[#2d3748] flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Files saved in: <code className="text-amber-300 font-mono">Farm-App/saves/</code>
              </span>
              <div className="flex items-center gap-2">
                {isDesktop && (
                  <button
                    onClick={handleOpenFolder}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded text-xs cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Folder</span>
                  </button>
                )}
                <button
                  onClick={() => setSavesOpen(false)}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Cheatsheet Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#141820] border-2 border-sky-500/70 rounded-md w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl font-mono text-xs">
            <div className="p-3 bg-[#1a202c] border-b border-[#2d3748] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Keyboard className="w-4 h-4" />
                <span>DESKTOP CONTROLS & KEYBINDINGS</span>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2 text-slate-300 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">W, A, S, D / Arrows</div>
                  <div className="text-slate-400">Move Engineer with smooth collision</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">Shift + Movement</div>
                  <div className="text-slate-400">Sprint Mode (9.5 tiles/sec velocity)</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">F5</div>
                  <div className="text-slate-400">Quick Save Checkpoint directly to PC disk</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">F9</div>
                  <div className="text-slate-400">Quick Load Checkpoint from PC disk</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">Ctrl + S</div>
                  <div className="text-slate-400">Export Save file (.json)</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">Ctrl + O</div>
                  <div className="text-slate-400">Open / Import save file from disk</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">F11 / Alt+Enter</div>
                  <div className="text-slate-400">Toggle Borderless Fullscreen</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">Q</div>
                  <div className="text-slate-400">Pipette Tool (auto-select item)</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">R</div>
                  <div className="text-slate-400">Rotate machine / belt / inserter</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">F / Z</div>
                  <div className="text-slate-400">Item Vacuum (F) / Drop Item (Z)</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">E / I</div>
                  <div className="text-slate-400">Open Factorio Inventory & Crafting GUI</div>
                </div>
                <div className="p-2 bg-[#0d1017] border border-[#2d3748] rounded">
                  <div className="font-bold text-amber-400">P</div>
                  <div className="text-slate-400">Electric Grid & Production Statistics</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#1a202c] border-t border-[#2d3748] flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <Toaster position="bottom-right" richColors theme="dark" />
    </div>
  );
}
