import { Component } from "./Component";
import { System } from "./System";

export class World {
  private entities = new Set<string>();
  private componentsByEntity = new Map<string, Map<Function, Component>>();
  private systems: System[] = [];

  createEntity(): string {
    const id = `entity_${Math.random().toString(36).substring(2, 11)}`;
    this.entities.add(id);
    this.componentsByEntity.set(id, new Map());
    return id;
  }

  destroyEntity(entity: string): void {
    this.entities.delete(entity);
    this.componentsByEntity.delete(entity);
  }

  addComponent(entity: string, component: Component): void {
    const entityComponents = this.componentsByEntity.get(entity);
    if (entityComponents) {
      entityComponents.set(component.constructor, component);
    }
  }

  removeComponent(entity: string, componentClass: Function): void {
    const entityComponents = this.componentsByEntity.get(entity);
    if (entityComponents) {
      entityComponents.delete(componentClass);
    }
  }

  getComponent<T extends Component>(entity: string, componentClass: new (...args: any[]) => T): T | undefined {
    const entityComponents = this.componentsByEntity.get(entity);
    if (entityComponents) {
      return entityComponents.get(componentClass) as T;
    }
    return undefined;
  }

  hasComponent(entity: string, componentClass: Function): boolean {
    const entityComponents = this.componentsByEntity.get(entity);
    return entityComponents ? entityComponents.has(componentClass) : false;
  }

  hasComponents(entity: string, componentClasses: Function[]): boolean {
    const entityComponents = this.componentsByEntity.get(entity);
    if (!entityComponents) return false;
    for (const cls of componentClasses) {
      if (!entityComponents.has(cls)) return false;
    }
    return true;
  }

  getEntitiesWith(componentClasses: Function[]): string[] {
    const result: string[] = [];
    for (const entity of this.entities) {
      if (this.hasComponents(entity, componentClasses)) {
        result.push(entity);
      }
    }
    return result;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(dt: number): void {
    for (const system of this.systems) {
      system.update(this, dt);
    }
  }
}
