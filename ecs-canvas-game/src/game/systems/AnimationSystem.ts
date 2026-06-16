import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  AnimationComponent,
  ANIMATION_CLIPS,
  type AnimationClip,
  VelocityComponent,
  WorkerComponent,
  PositionComponent,
} from "../components/GameComponents";

/**
 * SpriteAnimationManager — selects and advances per-entity AnimationClips.
 *
 * Pipeline (runs every game tick, before RenderSystem):
 *  1. Read velocity vector → resolve facing direction (preserve last when idle)
 *  2. Read WorkerComponent FSM state + role → choose the correct clip name:
 *       miner  + "working"  → mine_{dir}
 *       farmer + "working"  → farm_{dir}
 *       fisher + "working"  → fish_{dir}
 *       any    + moving     → walk_{dir}
 *       any    + idle/etc   → idle_{dir}
 *  3. Look up the AnimationClip from ANIMATION_CLIPS
 *  4. Reset the frame counter when the clip changes (avoids ghost frames)
 *  5. Advance the per-entity frame timer at the clip's own FPS
 *  6. Write clipName / row / col back to AnimationComponent so
 *     RenderSystem.drawLayeredCharacter() can do a spritesheet slice.
 */
export class AnimationSystem extends System {
  readonly requiredComponents = [AnimationComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      const anim   = world.getComponent(entity, AnimationComponent)!;
      const vel    = world.getComponent(entity, VelocityComponent)!;
      const worker = world.getComponent(entity, WorkerComponent);
      const pos    = world.getComponent(entity, PositionComponent);

      // ── 1. Resolve facing direction from velocity ────────────────────────
      const isMoving = vel.vx !== 0 || vel.vy !== 0;

      if (isMoving) {
        if (Math.abs(vel.vx) >= Math.abs(vel.vy)) {
          anim.direction = vel.vx > 0 ? "right" : "left";
        } else {
          anim.direction = vel.vy > 0 ? "down" : "up";
        }
      }
      // When stationary, anim.direction retains its last value (facing preserved)

      const dir = anim.direction; // "down" | "up" | "left" | "right"

      // ── 2. Select clip name based on entity state ───────────────────────
      let clipName = `idle_${dir}`;

      if (worker) {
        // Worker FSM → animation coupling
        const state = worker.state;
        const role  = worker.role;

        if (state === "working") {
          if (role === "miner" || role === "woodcutter") {
            clipName = `mine_${dir}`;
          } else if (role === "farmer") {
            clipName = `farm_${dir}`;
          } else if (role === "fisher") {
            clipName = `fish_${dir}`;
          } else {
            clipName = `work_${dir}`;
          }
        } else if (state === "eating") {
          clipName = "eat_down";
        } else if (state === "sleeping") {
          clipName = "sleep_down";
        } else if (state === "starving") {
          clipName = `idle_${dir}`; // starving → frozen idle
        } else if (isMoving || state === "seeking" || state === "returning") {
          // Also trigger walk when pos.moveDuration > 0 (lerp in progress)
          const isLerping = pos && pos.moveDuration > 0;
          if (isMoving || isLerping) {
            clipName = `walk_${dir}`;
          } else {
            clipName = `idle_${dir}`;
          }
        } else {
          clipName = `idle_${dir}`;
        }
      } else {
        // Player / generic entity
        const isLerping = pos && pos.moveDuration > 0;
        if (isMoving || isLerping) {
          clipName = `walk_${dir}`;
        } else {
          clipName = `idle_${dir}`;
        }
      }

      // ── 3. Look up the clip ─────────────────────────────────────────────
      const clip: AnimationClip | undefined = ANIMATION_CLIPS[clipName]
        ?? ANIMATION_CLIPS[`idle_${dir}`]
        ?? ANIMATION_CLIPS["idle_down"];

      // ── 4. Reset timer & frame if the clip changed ──────────────────────
      if (anim.clipName !== clipName) {
        anim.clipName = clipName;
        anim.row      = clip.row;
        anim.col      = clip.startCol;
        anim.timer    = 0;

        // Keep legacy fields in sync for serialiser / debug tools
        anim.currentTrack = clipName;
        anim.currentFrame = 0;
        anim.totalFrames  = clip.endCol - clip.startCol + 1;
        anim.animationSpeed = clip.fps;
      } else {
        // Ensure row is always current (direction can change without clip name change
        // only when both roles and direction share the same clip key)
        anim.row = clip.row;
      }

      // ── 5. Advance the per-entity frame timer ───────────────────────────
      if (clip.fps > 0) {
        anim.timer += dt;
        const frameDuration = 1 / clip.fps;

        if (anim.timer >= frameDuration) {
          anim.timer -= frameDuration;

          // Advance column, wrapping within [startCol, endCol]
          anim.col++;
          if (anim.col > clip.endCol) {
            anim.col = clip.loop ? clip.startCol : clip.endCol;
          }

          // Legacy sync
          anim.currentFrame = anim.col - clip.startCol;
        }
      } else {
        // Static clip — always hold startCol
        anim.col   = clip.startCol;
        anim.timer = 0;
        anim.currentFrame = 0;
      }
    }
  }
}

