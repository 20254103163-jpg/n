import { clamp, fbm1D, groundYNormalized, hash1D, lerp } from './math';
import { SettingType, Vec2 } from './types';

export interface VerletNode {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
}

export class VerletChain {
  nodes: VerletNode[] = [];
  segmentLength: number;
  private initialized = false;

  constructor(count: number, segmentLength: number) {
    this.segmentLength = segmentLength;
    for (let i = 0; i < count; i++) {
      this.nodes.push({ x: 0, y: 0, oldX: 0, oldY: 0 });
    }
  }

  reset(anchor: Vec2, dirX = -1): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const x = anchor.x + dirX * i * this.segmentLength;
      const y = anchor.y + i * 1.4;
      this.nodes[i] = { x, y, oldX: x, oldY: y };
    }
    this.initialized = true;
  }

  update(
    anchor: Vec2,
    dt: number,
    windX: number,
    timeSec: number,
    scale: number
  ): number {
    const seg = this.segmentLength * scale;
    if (
      !this.initialized ||
      Math.hypot(this.nodes[0].x - anchor.x, this.nodes[0].y - anchor.y) > seg * 12
    ) {
      this.reset(anchor, windX >= 0 ? 1 : -1);
    }

    const damping = 0.94;
    const gravity = 390 * scale;
    const clampedDt = clamp(dt, 0.001, 0.033);
    const dtSq = clampedDt * clampedDt;

    this.nodes[0].x = anchor.x;
    this.nodes[0].y = anchor.y;
    this.nodes[0].oldX = anchor.x;
    this.nodes[0].oldY = anchor.y;

    for (let i = 1; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const vx = (n.x - n.oldX) * damping;
      const vy = (n.y - n.oldY) * damping;
      n.oldX = n.x;
      n.oldY = n.y;

      const tailFactor = i / (this.nodes.length - 1);
      const flutter =
        Math.sin(timeSec * 11.5 - i * 0.65) * (95 + Math.abs(windX) * 0.45) * tailFactor;
      const lift =
        Math.cos(timeSec * 7.8 - i * 0.5) * 60 * tailFactor - Math.abs(windX) * 0.14;

      const ax = (windX * (0.75 + tailFactor * 0.65) + flutter * 0.35) * scale;
      const ay = gravity + (flutter + lift) * scale;

      n.x += vx + ax * dtSq;
      n.y += vy + ay * dtSq;
    }

    let totalStrain = 0;
    for (let iter = 0; iter < 6; iter++) {
      this.nodes[0].x = anchor.x;
      this.nodes[0].y = anchor.y;

      for (let i = 0; i < this.nodes.length - 1; i++) {
        const a = this.nodes[i];
        const b = this.nodes[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const diff = (dist - seg) / dist;
        if (iter === 0) totalStrain += Math.abs(dist - seg);

        if (i === 0) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.48;
          a.y += dy * diff * 0.48;
          b.x -= dx * diff * 0.52;
          b.y -= dy * diff * 0.52;
        }
      }
    }

    return totalStrain / (this.nodes.length * Math.max(seg, 1));
  }
}

export class LanternPendulum {
  angle = 0.05;
  angularVelocity = 0;
  private lastPivotX = 0;
  private hasPivot = false;

  update(pivot: Vec2, dt: number, windX: number, scale: number): { angle: number; bob: Vec2 } {
    const clampedDt = clamp(dt, 0.001, 0.033);
    const length = 26 * scale;
    const pivotAccelX = this.hasPivot ? (pivot.x - this.lastPivotX) / clampedDt : 0;
    this.lastPivotX = pivot.x;
    this.hasPivot = true;

    const gravityTerm = -(24 / Math.max(scale, 0.4)) * Math.sin(this.angle);
    const windTorque = clamp(windX * 0.0085, -5, 5) * Math.cos(this.angle);
    const inertialTorque = clamp(-pivotAccelX * 0.018, -7, 7) * Math.cos(this.angle);
    const angularAccel = gravityTerm + windTorque + inertialTorque;

    this.angularVelocity =
      (this.angularVelocity + angularAccel * clampedDt) * Math.pow(0.28, clampedDt);
    this.angle = clamp(this.angle + this.angularVelocity * clampedDt, -0.95, 0.95);

    return {
      angle: this.angle,
      bob: {
        x: pivot.x + Math.sin(this.angle) * length,
        y: pivot.y + Math.cos(this.angle) * length,
      },
    };
  }
}

export interface Raindrop {
  x: number;
  y: number;
  depth: number;
  speed: number;
  length: number;
}

export interface PuddleRipple {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  maxRadius: number;
  isWater: boolean;
}

export interface SplashDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
}

export class RainSystem {
  drops: Raindrop[] = [];
  ripples: PuddleRipple[] = [];
  splashes: SplashDrop[] = [];

  constructor(maxDrops = 260) {
    for (let i = 0; i < maxDrops; i++) {
      const depth = 0.35 + hash1D(i * 19.3) * 0.65;
      this.drops.push({
        x: hash1D(i * 7.1),
        y: hash1D(i * 13.7),
        depth,
        speed: lerp(0.55, 1.28, depth),
        length: lerp(0.016, 0.044, depth),
      });
    }
  }

  spawnRipple(nx: number, ny: number, isWater: boolean): void {
    if (this.ripples.length > 65) return;
    this.ripples.push({
      x: nx,
      y: ny,
      age: 0,
      maxAge: isWater ? 0.85 : 0.45,
      maxRadius: isWater ? 0.024 : 0.012,
      isWater,
    });
  }

  update(dt: number, intensity: number, windNorm: number, setting: SettingType): void {
    const clampedDt = clamp(dt, 0.001, 0.04);
    const activeCount = Math.floor(this.drops.length * clamp(intensity, 0, 1));
    const hasWater = setting !== 'desert_dunes';

    for (let i = 0; i < activeCount; i++) {
      const d = this.drops[i];
      d.x += windNorm * 0.14 * d.depth * clampedDt;
      d.y += d.speed * clampedDt;

      const deckY = groundYNormalized(setting, clamp(d.x, 0, 1));
      const hitGround = d.depth > 0.65 && d.y >= deckY && d.y - d.speed * clampedDt < deckY;
      const hitWater = hasWater && d.depth <= 0.65 && d.y >= 0.68 + d.depth * 0.16;

      if (hitGround) {
        this.spawnRipple(d.x, deckY + 0.004, false);
        if (this.splashes.length < 70 && Math.random() < 0.45) {
          for (let s = 0; s < 2; s++) {
            this.splashes.push({
              x: d.x,
              y: deckY,
              vx: (Math.random() - 0.5) * 0.045 + windNorm * 0.012,
              vy: -(0.04 + Math.random() * 0.05),
              age: 0,
              maxAge: 0.24 + Math.random() * 0.14,
            });
          }
        }
        d.y = -Math.random() * 0.15;
        d.x = Math.random();
      } else if (hitWater) {
        if (Math.random() < 0.28) {
          this.spawnRipple(d.x, d.y, true);
        }
        d.y = -Math.random() * 0.12;
        d.x = Math.random();
      } else if (d.y > 1.05) {
        d.y = -0.05;
        d.x = Math.random();
      }

      if (d.x < -0.1) d.x += 1.2;
      if (d.x > 1.1) d.x -= 1.2;
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].age += clampedDt;
      if (this.ripples[i].age >= this.ripples[i].maxAge) {
        this.ripples.splice(i, 1);
      }
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i];
      sp.age += clampedDt;
      sp.x += sp.vx * clampedDt;
      sp.y += sp.vy * clampedDt;
      sp.vy += 0.32 * clampedDt;
      if (sp.age >= sp.maxAge) {
        this.splashes.splice(i, 1);
      }
    }
  }
}

export interface DriftParticle {
  x: number;
  y: number;
  depth: number;
  fallSpeed: number;
  phase: number;
  spin: number;
  size: number;
}

/**
 * Multi-depth drifting snowflakes and tumbling cherry blossom petals.
 */
export class DriftWeatherSystem {
  particles: DriftParticle[] = [];

  constructor(maxCount = 150) {
    for (let i = 0; i < maxCount; i++) {
      const depth = 0.35 + hash1D(i * 37.1) * 0.65;
      this.particles.push({
        x: hash1D(i * 11.3),
        y: hash1D(i * 23.9),
        depth,
        fallSpeed: lerp(0.055, 0.14, depth),
        phase: hash1D(i * 47.7) * Math.PI * 2,
        spin: (hash1D(i * 59.3) - 0.5) * 4.5,
        size: lerp(2.1, 5.2, depth),
      });
    }
  }

  update(dt: number, timeSec: number, intensity: number, windNorm: number): void {
    const clampedDt = clamp(dt, 0.001, 0.04);
    const active = Math.floor(this.particles.length * clamp(intensity, 0, 1));
    for (let i = 0; i < active; i++) {
      const p = this.particles[i];
      p.y += p.fallSpeed * clampedDt;
      p.x += (windNorm * 0.08 * p.depth + Math.sin(timeSec * 1.8 + p.phase) * 0.025) * clampedDt;
      if (p.y > 1.04) {
        p.y = -0.04;
        p.x = Math.random();
      }
      if (p.x < -0.05) p.x += 1.1;
      if (p.x > 1.05) p.x -= 1.1;
    }
  }
}

export interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  length: number;
}

export class ShootingStarSystem {
  meteors: ShootingStar[] = [];

  update(dt: number, enabled: boolean): void {
    const clampedDt = clamp(dt, 0.001, 0.04);
    if (enabled && this.meteors.length < 3 && Math.random() < clampedDt * 0.85) {
      this.meteors.push({
        x: 0.18 + Math.random() * 0.72,
        y: 0.05 + Math.random() * 0.22,
        vx: -(0.38 + Math.random() * 0.24),
        vy: 0.16 + Math.random() * 0.12,
        age: 0,
        maxAge: 0.7 + Math.random() * 0.45,
        length: 0.065 + Math.random() * 0.05,
      });
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += clampedDt;
      m.x += m.vx * clampedDt;
      m.y += m.vy * clampedDt;
      if (m.age >= m.maxAge) {
        this.meteors.splice(i, 1);
      }
    }
  }
}

export interface SkyLantern {
  id: number;
  x: number;
  y: number;
  depth: number;
  riseSpeed: number;
  phase: number;
  swayAmp: number;
  userSpawned: boolean;
  alpha: number;
  age: number;
}

export class LanternSystem {
  lanterns: SkyLantern[] = [];
  private nextId = 1;

  spawnUserLantern(nx: number, ny: number): void {
    this.lanterns.push({
      id: this.nextId++,
      x: clamp(nx, 0.03, 0.97),
      y: clamp(ny, 0.12, 0.88),
      depth: 0.72 + Math.random() * 0.35,
      riseSpeed: 0.022 + Math.random() * 0.015,
      phase: Math.random() * Math.PI * 2,
      swayAmp: 0.014 + Math.random() * 0.012,
      userSpawned: true,
      alpha: 0,
      age: 0,
    });
    if (this.lanterns.length > 48) {
      const idx = this.lanterns.findIndex((l) => l.userSpawned);
      if (idx >= 0) this.lanterns.splice(idx, 1);
    }
  }

  spawnStoryBurst(centerX: number, centerY: number): void {
    for (let i = 0; i < 6; i++) {
      this.spawnUserLantern(
        centerX + (Math.random() - 0.5) * 0.24,
        centerY + (Math.random() - 0.5) * 0.12
      );
    }
  }

  update(dt: number, timeSec: number, storyReleaseStrength: number, windNorm: number): void {
    const clampedDt = clamp(dt, 0.001, 0.04);

    const desiredAmbient = Math.floor(storyReleaseStrength * 16);
    const currentAmbient = this.lanterns.filter((l) => !l.userSpawned).length;
    if (currentAmbient < desiredAmbient && Math.random() < clampedDt * 5.5) {
      const depth = 0.36 + Math.random() * 0.58;
      this.lanterns.push({
        id: this.nextId++,
        x: 0.12 + Math.random() * 0.76,
        y: 0.69 + Math.random() * 0.07,
        depth,
        riseSpeed: lerp(0.014, 0.03, depth),
        phase: Math.random() * Math.PI * 2,
        swayAmp: lerp(0.007, 0.016, depth),
        userSpawned: false,
        alpha: 0,
        age: 0,
      });
    }

    for (let i = this.lanterns.length - 1; i >= 0; i--) {
      const l = this.lanterns[i];
      l.age += clampedDt;
      l.y -= l.riseSpeed * clampedDt;
      l.x +=
        (Math.sin(timeSec * 1.1 + l.phase) * l.swayAmp + windNorm * 0.012 * l.depth) *
        clampedDt;

      const fadeIn = clamp(l.age / 0.85, 0, 1);
      const fadeOutTop = clamp((l.y + 0.06) / 0.14, 0, 1);
      const storyFade = l.userSpawned ? 1 : clamp(storyReleaseStrength * 1.4, 0, 1);
      l.alpha =
        fadeIn *
        fadeOutTop *
        (l.userSpawned ? 1 : Math.max(storyFade, l.age > 0.2 ? 0.15 : 0));

      if (l.y < -0.09 || (!l.userSpawned && storyReleaseStrength < 0.02 && l.age > 6)) {
        this.lanterns.splice(i, 1);
      }
    }
  }
}

export interface ReedBlade {
  baseX: number;
  baseY: number;
  height: number;
  thickness: number;
  restAngle: number;
  angle: number;
  angularVel: number;
  stiffness: number;
  seed: number;
  hasSeedHead: boolean;
}

export class ReedCluster {
  blades: ReedBlade[] = [];

  constructor() {
    const createPatch = (startX: number, endX: number, count: number, offsetSeed: number) => {
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(count - 1, 1);
        const seed = offsetSeed + i * 11.7;
        const baseX = lerp(startX, endX, t) + (hash1D(seed) - 0.5) * 0.015;
        const height = 0.085 + hash1D(seed + 3.1) * 0.11;
        this.blades.push({
          baseX,
          baseY: 1.02,
          height,
          thickness: 1.6 + hash1D(seed + 5.7) * 2.2,
          restAngle: (hash1D(seed + 8.3) - 0.5) * 0.22,
          angle: 0,
          angularVel: 0,
          stiffness: 18 + hash1D(seed + 13.1) * 14,
          seed,
          hasSeedHead: hash1D(seed + 17.9) > 0.68,
        });
      }
    };

    createPatch(-0.02, 0.24, 24, 100);
    createPatch(0.76, 1.02, 22, 300);
  }

  update(
    dt: number,
    timeSec: number,
    windNorm: number,
    gustX: number | null,
    gustForce: number
  ): void {
    const clampedDt = clamp(dt, 0.001, 0.033);
    for (const b of this.blades) {
      const wave = fbm1D(timeSec * 1.4 - b.baseX * 3.5 + b.seed * 0.05, 2);
      let targetWind = windNorm * 0.38 + wave * (0.14 + Math.abs(windNorm) * 0.18);

      if (gustX !== null) {
        const dist = Math.abs(b.baseX - gustX);
        if (dist < 0.28) {
          targetWind += gustForce * (1 - dist / 0.28) * 0.65;
        }
      }

      const displacement = b.restAngle + targetWind - b.angle;
      const accel = displacement * b.stiffness - b.angularVel * 3.8;
      b.angularVel += accel * clampedDt;
      b.angle = clamp(b.angle + b.angularVel * clampedDt, -1.05, 1.05);
    }
  }
}

export interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

export class FireflySystem {
  flies: Firefly[] = [];

  constructor(count = 24) {
    for (let i = 0; i < count; i++) {
      this.flies.push({
        x: 0.04 + hash1D(i * 23.1) * 0.92,
        y: 0.62 + hash1D(i * 41.7) * 0.31,
        vx: (hash1D(i * 17.3) - 0.5) * 0.02,
        vy: (hash1D(i * 29.9) - 0.5) * 0.015,
        phase: hash1D(i * 53.3) * Math.PI * 2,
        size: 1.5 + hash1D(i * 61.1) * 1.8,
      });
    }
  }

  update(dt: number, timeSec: number, windNorm: number): void {
    const clampedDt = clamp(dt, 0.001, 0.04);
    for (const f of this.flies) {
      f.vx += (Math.sin(timeSec * 1.7 + f.phase) * 0.018 + windNorm * 0.004) * clampedDt;
      f.vy += Math.cos(timeSec * 2.1 + f.phase * 1.3) * 0.016 * clampedDt;
      f.vx *= 0.985;
      f.vy *= 0.985;
      f.x += f.vx * clampedDt;
      f.y += f.vy * clampedDt;

      if (f.x < 0.02) f.x = 0.98;
      if (f.x > 0.98) f.x = 0.02;
      if (f.y < 0.55) f.vy += 0.02 * clampedDt;
      if (f.y > 0.95) f.vy -= 0.02 * clampedDt;
    }
  }
}
