import React, { useState, useEffect } from "react";
import MeadowLife from "./game/MeadowLife";
import { isDesktopRuntime } from "./saves/DiskSaveSystem";
import { Maximize, Minimize, Minus, X, HardDrive, Sparkles } from "lucide-react";
import { Toaster } from "sonner";

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDesktop = isDesktopRuntime();

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

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b0e14] text-slate-100 overflow-hidden select-none font-mono">
      {/* Native Desktop Factorio Steel Titlebar Header */}
      {isDesktop && (
        <header className="h-7 bg-[#141820] border-b border-[#252d3a] flex items-center justify-between px-3 z-50 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">🏭</span>
            <span className="font-extrabold text-[#ff9200] tracking-wider text-[11px]">
              FARM-APP <span className="text-slate-400 font-normal">| FACTORIO DESKTOP EDITION</span>
            </span>
            <span className="text-[9px] bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 border border-emerald-600/60 rounded flex items-center gap-1">
              <HardDrive className="w-2.5 h-2.5" />
              <span>PORTABLE DISK SAVES</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen (F11)"
              className="p-1 hover:text-amber-400 hover:bg-[#1f2735] rounded transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>
      )}

      {/* Main Game Surface */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        <MeadowLife />
      </main>

      {/* High-contrast notifications */}
      <Toaster position="bottom-right" richColors theme="dark" />
    </div>
  );
}
