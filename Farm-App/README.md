# 🏭 Farm-App: Factorio Industrial Simulation (Windows Desktop Edition)

A high-performance standalone Factorio-style industrial automation, power engineering, and farming desktop game designed for Windows.

---

## ⚡ Quick Start (Portable Play)

### Option 1: Direct Desktop Runner
Simply double-click:
```bat
Run-Game.bat
```

### Option 2: Build Single-File Portable Executable (`Farm-App.exe`)
Double-click:
```bat
Build-Portable-Exe.bat
```
The compiled single-file portable `.exe` will be generated inside `Farm-App/dist-electron/Farm-App.exe`.

---

## 🎮 Desktop Keybindings & Controls

| Key | Action | Description |
| :--- | :--- | :--- |
| **W, A, S, D** / **Arrows** | **Move Engineer** | Smooth continuous sub-tile movement with collision sliding |
| **Shift + Movement** | **Sprint Mode** | Run at 9.5 tiles/sec high velocity |
| **Alt** | **Alt-Mode (Info Overlay)** | Toggle real-time recipe badges, smelting progress, inserter direction arrows, and chest counts |
| **Q** | **Pipette Tool** | Point at any placed machine or ore to auto-select that item from inventory into your active hand |
| **R** | **Rotate Placement** | Rotate machines, conveyor belts, inserters, and underground belts |
| **F** | **Item Vacuum** | Magnetically suck up all dropped ores and items from conveyor belts in a 2.5-tile radius |
| **Z** | **Drop Item** | Drop 1 item from active hotbar directly onto the conveyor belt in front of you |
| **E / I** | **Character & Crafting GUI** | Open authentic Factorio Dual-Panel Character, Armor, Logistics, and Recipe Crafting window |
| **P** | **Production Statistics** | Open Production, Consumption, Electric Power Grid & Pollution metrics |
| **1 - 0** | **Hotbar Shortcuts** | Quick-select item from hotbar slot |
| **F11** | **Borderless Fullscreen** | Toggle immersive borderless fullscreen desktop mode |

---

## 💾 Portable Disk Saves

All save games are stored as real JSON files inside:
```
Farm-App/saves/*.json
```
You can easily backup, rename, or transfer your save files across any Windows PC!
