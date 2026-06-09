import { Component } from "../ecs/Component";

export class PositionComponent extends Component {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
  }
}

export class VelocityComponent extends Component {
  public vx: number;
  public vy: number;

  constructor(vx: number = 0, vy: number = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
  }
}

export class RenderComponent extends Component {
  public draw: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
    entityId: string
  ) => void;

  constructor(
    draw: (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      time: number,
      entityId: string
    ) => void
  ) {
    super();
    this.draw = draw;
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
  public hp: number;
  public maxHp: number;
  public score: number;
  public level: number;
  public xp: number;
  public maxXp: number;
  public fireRateTimer: number;
  public damageFlashTimer: number;
  public levelUpFlashTimer: number;

  constructor(
    hp: number = 100,
    maxHp: number = 100,
    score: number = 0,
    level: number = 1,
    xp: number = 0,
    maxXp: number = 100,
    fireRateTimer: number = 0,
    damageFlashTimer: number = 0,
    levelUpFlashTimer: number = 0
  ) {
    super();
    this.hp = hp;
    this.maxHp = maxHp;
    this.score = score;
    this.level = level;
    this.xp = xp;
    this.maxXp = maxXp;
    this.fireRateTimer = fireRateTimer;
    this.damageFlashTimer = damageFlashTimer;
    this.levelUpFlashTimer = levelUpFlashTimer;
  }
}

export class MonsterComponent extends Component {
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public damageCooldown: number;

  constructor(
    hp: number = 15,
    maxHp: number = 15,
    speed: number = 55,
    damage: number = 10,
    damageCooldown: number = 0
  ) {
    super();
    this.hp = hp;
    this.maxHp = maxHp;
    this.speed = speed;
    this.damage = damage;
    this.damageCooldown = damageCooldown;
  }
}

export class ProjectileComponent extends Component {
  public damage: number;
  public speed: number;
  public lifeSpan: number;

  constructor(
    damage: number = 5,
    speed: number = 300,
    lifeSpan: number = 1.2
  ) {
    super();
    this.damage = damage;
    this.speed = speed;
    this.lifeSpan = lifeSpan;
  }
}

export class ColliderComponent extends Component {
  public radius: number;
  public type: "player" | "monster" | "projectile" | "gem";

  constructor(
    radius: number = 12,
    type: "player" | "monster" | "projectile" | "gem"
  ) {
    super();
    this.radius = radius;
    this.type = type;
  }
}

export class GemComponent extends Component {
  public value: number;
  public isCollected: boolean;

  constructor(
    value: number = 10,
    isCollected: boolean = false
  ) {
    super();
    this.value = value;
    this.isCollected = isCollected;
  }
}

export class ParticleComponent extends Component {
  public color: string;
  public size: number;
  public vx: number;
  public vy: number;
  public alpha: number;
  public decay: number;

  constructor(
    color: string = "#fff",
    size: number = 3,
    vx: number = 0,
    vy: number = 0,
    alpha: number = 1.0,
    decay: number = 0.02
  ) {
    super();
    this.color = color;
    this.size = size;
    this.vx = vx;
    this.vy = vy;
    this.alpha = alpha;
    this.decay = decay;
  }
}
