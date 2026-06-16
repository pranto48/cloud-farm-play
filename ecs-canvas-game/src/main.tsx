import "./style.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { ToolBuilderOverlay } from "./components/ToolBuilderOverlay";
import { Game } from "./game/Game";

// Initialize vanilla ECS Game engine on window load
window.addEventListener("load", () => {
  new Game("game-canvas");
});

// Render React UI Overlay on top
const container = document.getElementById("react-ui-root");
if (container) {
  const root = createRoot(container);
  root.render(<ToolBuilderOverlay />);
}
