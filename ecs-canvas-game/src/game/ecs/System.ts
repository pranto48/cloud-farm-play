import { World } from "./World";

export abstract class System {
  /** Components required by this system */
  abstract readonly requiredComponents: Function[];

  /** Called once per engine tick */
  abstract update(world: World, dt: number): void;
}
