import { System } from "../ecs/System";
import { World } from "../ecs/World";
import { TimeWeatherComponent, StructureComponent } from "../components/GameComponents";
import { toast } from "../utils/Toast";

export class TimeWeatherSystem extends System {
  readonly requiredComponents = [TimeWeatherComponent];

  update(world: World, dt: number): void {
    const timeWeatherEntities = world.getEntitiesWith(this.requiredComponents);
    if (timeWeatherEntities.length === 0) return;
    const timeWeather = world.getComponent(timeWeatherEntities[0], TimeWeatherComponent)!;

    // 1. Advance the clock (timeOfDay is in hours, e.g. 6.0 is 6:00 AM)
    timeWeather.timeOfDay += dt * timeWeather.timeScale;
    if (timeWeather.timeOfDay >= 24) {
      timeWeather.timeOfDay = 0;
    }

    // 2. Weather state transitions
    timeWeather.weatherTimer -= dt;
    if (timeWeather.weatherTimer <= 0) {
      // Toggle rain
      timeWeather.isRaining = !timeWeather.isRaining;
      
      // Clear sky lasts 60 to 90 seconds, rain lasts 30 to 45 seconds
      timeWeather.weatherTimer = timeWeather.isRaining
        ? 30 + Math.random() * 15
        : 60 + Math.random() * 30;

      if (timeWeather.isRaining) {
        toast.info("A light rain shower has begun! All crops will be watered automatically.");
      } else {
        toast.info("The rain has stopped. Clear sky ahead!");
      }
    }

    // 3. Auto-water crops if it is raining
    if (timeWeather.isRaining) {
      const structures = world.getEntitiesWith([StructureComponent]);
      for (const ent of structures) {
        const sc = world.getComponent(ent, StructureComponent)!;
        if (sc.type === "crop" && !sc.isWatered) {
          sc.isWatered = true;
        }
      }
    }
  }
}
