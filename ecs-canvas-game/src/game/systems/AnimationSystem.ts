import { System } from "../ecs/System";
import { World } from "../ecs/World";
import {
  AnimationComponent,
  VelocityComponent,
  WorkerComponent,
  PlayerComponent,
} from "../components/GameComponents";

export class AnimationSystem extends System {
  readonly requiredComponents = [AnimationComponent, VelocityComponent];

  update(world: World, dt: number): void {
    const entities = world.getEntitiesWith(this.requiredComponents);

    for (const entity of entities) {
      const anim = world.getComponent(entity, AnimationComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;
      const worker = world.getComponent(entity, WorkerComponent);
      const player = world.getComponent(entity, PlayerComponent);

      // 1. Determine direction based on velocity vector
      let direction = anim.direction || "down";
      if (vel.vx > 0) {
        direction = "right";
      } else if (vel.vx < 0) {
        direction = "left";
      } else if (vel.vy > 0) {
        direction = "down";
      } else if (vel.vy < 0) {
        direction = "up";
      }
      anim.direction = direction as "down" | "up" | "left" | "right";

      const isMoving = vel.vx !== 0 || vel.vy !== 0;

      // 2. Map actions and states to animation tracks
      let track: "idle" | "walk_up" | "walk_down" | "walk_side" | "work_up" | "work_down" | "work_side" = "idle";

      if (worker) {
        // Worker state machine action coupling
        const isMining = worker.state === "working" && worker.role === "miner";
        const isFarming = worker.state === "working" && worker.role === "farmer";
        const isFishing = worker.state === "working" && worker.role === "fisher";
        const isWoodcutting = worker.state === "working" && worker.role === "woodcutter";

        if (isMining || isFarming || isFishing || isWoodcutting) {
          if (direction === "up") {
            track = "work_up";
          } else if (direction === "down") {
            track = "work_down";
          } else {
            track = "work_side";
          }
        } else if (isMoving) {
          if (direction === "up") {
            track = "walk_up";
          } else if (direction === "down") {
            track = "walk_down";
          } else {
            track = "walk_side";
          }
        } else {
          track = "idle";
        }
      } else {
        // Player/other default entity mapping
        if (isMoving) {
          if (direction === "up") {
            track = "walk_up";
          } else if (direction === "down") {
            track = "walk_down";
          } else {
            track = "walk_side";
          }
        } else {
          track = "idle";
        }
      }

      // 3. Configure spritesheet slicing track configuration
      anim.currentTrack = track as any;

      if (track === "idle") {
        anim.totalFrames = 1;
        anim.animationSpeed = 0;
        anim.currentFrame = 0;
        anim.timer = 0;
      } else if (track.startsWith("walk_")) {
        anim.totalFrames = 2; // 2 frames walking cycle
        anim.animationSpeed = 8; // 8 FPS
      } else if (track.startsWith("work_")) {
        anim.totalFrames = 2; // 2 frames work action swing/loop
        anim.animationSpeed = 6; // 6 FPS
      }

      // 4. Update the frame loop timer
      if (anim.animationSpeed > 0) {
        anim.timer += dt;
        if (anim.timer >= 1 / anim.animationSpeed) {
          anim.timer = 0;
          anim.currentFrame = (anim.currentFrame + 1) % anim.totalFrames;
        }
      }
    }
  }
}
