import { RGB, SettingType, Vec2 } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  const k = clamp(t, 0, 1);
  return {
    r: Math.round(lerp(c1.r, c2.r, k)),
    g: Math.round(lerp(c1.g, c2.g, k)),
    b: Math.round(lerp(c1.b, c2.b, k)),
  };
}

export function rgbToCss(c: RGB): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function rgbaToCss(c: RGB, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { r: 42, g: 60, b: 89 };
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 42, g: 60, b: 89 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function shadeHex(hex: string, factor: number): string {
  const c = hexToRgb(hex);
  return rgbToCss({
    r: clamp(Math.round(c.r * factor), 0, 255),
    g: clamp(Math.round(c.g * factor), 0, 255),
    b: clamp(Math.round(c.b * factor), 0, 255),
  });
}

export function hash1D(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function noise1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1D(i), hash1D(i + 1), u);
}

export function fbm1D(x: number, octaves = 3): number {
  let value = 0;
  let amplitude = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (noise1D(x * freq) * 2 - 1);
    freq *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

export interface TwoBoneIKResult {
  joint: Vec2;
  end: Vec2;
  upperAngle: number;
  kneeAngleDeg: number;
}

/**
 * Analytical 2-bone Inverse Kinematics using the Law of Cosines.
 */
export function solveTwoBoneIK(
  root: Vec2,
  target: Vec2,
  l1: number,
  l2: number,
  bendSign: 1 | -1
): TwoBoneIKResult {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(l1 - l2) + 0.001;
  const maxDist = l1 + l2 - 0.001;
  const dist = clamp(rawDist, minDist, maxDist);

  const baseAngle = Math.atan2(dy, dx);
  const cosAngle1 = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const offsetAngle1 = Math.acos(cosAngle1);
  const upperAngle = baseAngle + bendSign * offsetAngle1;

  const joint: Vec2 = {
    x: root.x + Math.cos(upperAngle) * l1,
    y: root.y + Math.sin(upperAngle) * l1,
  };

  const end: Vec2 = {
    x: root.x + (dx / (rawDist || 1)) * dist,
    y: root.y + (dy / (rawDist || 1)) * dist,
  };

  const cosKnee = clamp((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2), -1, 1);
  const kneeAngleDeg = (Math.acos(cosKnee) * 180) / Math.PI;

  return { joint, end, upperAngle, kneeAngleDeg };
}

export function bridgeDeckYNormalized(nx: number): number {
  const archSpan = nx - 0.5;
  return 0.728 + archSpan * archSpan * 0.21;
}

/**
 * Ground surface curve shared between each procedural environment and character IK feet.
 */
export function groundYNormalized(setting: SettingType, nx: number): number {
  switch (setting) {
    case 'custom_stage':
      return 0.79;
    case 'attic_discovery':
      return 0.805;
    case 'veranda_past':
      return 0.80;
    case 'shantipur_memory':
      return 0.77 + Math.sin(nx * 3.8 + 0.4) * 0.012;
    case 'rooftop_closure':
      return 0.815;
    case 'rainbridge':
      return bridgeDeckYNormalized(nx);
    case 'village_green':
      return 0.774 + Math.sin(nx * 4.4 + 0.3) * 0.014;
    case 'mountain_forest':
      return 0.778 + Math.sin(nx * 5.2 + 0.5) * 0.016;
    case 'coastal_city':
      return 0.768;
    case 'desert_dunes':
      return 0.765 + Math.sin(nx * Math.PI * 1.45 - 0.45) * 0.036;
  }
}

export function groundSlopeNormalized(setting: SettingType, nx: number): number {
  const eps = 0.005;
  return (groundYNormalized(setting, nx + eps) - groundYNormalized(setting, nx - eps)) / (2 * eps);
}
