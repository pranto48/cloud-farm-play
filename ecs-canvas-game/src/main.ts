import "./style.css";
import { Game } from "./game/Game";

// Initialize game on window load
window.addEventListener("load", () => {
  new Game("game-canvas");
});
