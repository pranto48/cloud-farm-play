import { Component } from "../ecs/Component";

export class PositionComponent extends Component {
  constructor(public x: number = 0, public y: number = 0) {
    super();
  }
}

export class VelocityComponent extends Component {
  constructor(public vx: number = 0, public vy: number = 0) {
    super();
  }
}

export class RenderComponent extends Component {
  constructor(
    public draw: (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      time: number,
      entityId: string
    ) => void
  ) {
    super();
  }
}

export class InputComponent extends Component {
  public keys: Record<string, boolean> = {};
  public mouseX: number = 0;
  public mouseY: number = 0;
  public mouseClicked: boolean = false;
  constructor() {
    super();
  }
}

export class PlayerComponent extends Component {
  constructor(
    public hp: number = 100,
    public maxHp: number = 100,
    public score: number = 0,
    public level: number = 1,
    public xp: number = 0,
    public maxXp: number = 100,
    public fireRateTimer: number = 0
  ) {
    super();
  }
}

export class MonsterComponent extends Component {
  constructor(
    public hp: number = 15,
    public maxHp: number = 15,
    public speed: number = 55,
    public damage: number = 10,
    public damageCooldown: number = 0
  ) {
    super();
  }
}

export class ProjectileComponent extends Component {
  constructor(
    public damage: number = 5,
    public speed: number = 300,
    public lifeSpan: number = 1.2
  ) {
    super();
  }
}

export class ColliderComponent extends Component {
  constructor(
    public radius: number = 12,
    public type: "player" | "monster" | "projectile" | "gem"
  ) {
    super();
  }
}

export class GemComponent extends Component {
  constructor(
    public value: number = 10,
    public isCollected: boolean = false
  ) {
    super();
  }
}

export class ParticleComponent extends Component {
  constructor(
    public color: string = "#fff",
    public size: number = 3,
    public vx: number = 0,
    public vy: number = 0,
    public alpha: number = 1.0,
    public decay: number = 0.02
  ) {
    super();
  }
}
