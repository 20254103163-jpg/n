import {
  clamp,
  easeInOutCubic,
  hash1D,
  lerp,
  shadeHex,
  smoothstep,
  solveTwoBoneIK,
} from './math';
import {
  CustomStageSpec,
  EngineActorSpec,
  EngineParticleSpec,
  EnginePropSpec,
  SceneSpec,
} from './types';

export interface CustomStageFrameInfo {
  hipYOffset: number;
  leadKneeAngleDeg: number;
  scarfTension: number;
  lanternSwingDeg: number;
  skyPhaseLabel: string;
}

const DEFAULT_SKY_BY_TIME: Record<
  SceneSpec['timeOfDay'],
  { top: string; mid: string; horizon: string; label: string; night: number }
> = {
  sunny_afternoon: {
    top: '#3274b8',
    mid: '#7cb5df',
    horizon: '#f4dfb8',
    label: 'Warm Afternoon',
    night: 0,
  },
  golden_dusk: {
    top: '#1d2b4e',
    mid: '#874c6b',
    horizon: '#f09b5c',
    label: 'Golden Dusk',
    night: 0.22,
  },
  storm_twilight: {
    top: '#101829',
    mid: '#23344f',
    horizon: '#4a6684',
    label: 'Storm Twilight',
    night: 0.62,
  },
  starry_night: {
    top: '#060a16',
    mid: '#101d3b',
    horizon: '#243c64',
    label: 'Starry Night',
    night: 0.94,
  },
  moonlit: {
    top: '#0b142a',
    mid: '#1a2f56',
    horizon: '#3c5f8f',
    label: 'Moonlit Night',
    night: 0.85,
  },
  pre_dawn: {
    top: '#171f40',
    mid: '#5c4b7d',
    horizon: '#db8c74',
    label: 'Pre-Dawn',
    night: 0.38,
  },
};

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stage: CustomStageSpec,
  scene: SceneSpec,
  timeSec: number
): { skyLabel: string; nightAmount: number } {
  const scale = w / 1280;
  const defaults = DEFAULT_SKY_BY_TIME[scene.timeOfDay] ?? DEFAULT_SKY_BY_TIME.golden_dusk;
  const bd = stage.backdrop;
  const skyTop = bd.skyTop || defaults.top;
  const skyMid = bd.skyMid || defaults.mid;
  const skyHorizon = bd.skyHorizon || defaults.horizon;
  const floorY = (bd.floorY ?? 0.78) * h;
  const waterY = (bd.waterY ?? 0.59) * h;

  if (bd.type === 'indoor_room') {
    const wallBase = bd.wallColor || '#2c221b';
    const floorBase = bd.floorColor || '#382518';

    // Warm painterly interior wall
    const wallGrad = ctx.createLinearGradient(0, 0, w, floorY);
    wallGrad.addColorStop(0, shadeHex(wallBase, 0.72));
    wallGrad.addColorStop(0.55, wallBase);
    wallGrad.addColorStop(1, shadeHex(wallBase, 0.6));
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, floorY);

    // Subtle timber rafters
    ctx.fillStyle = shadeHex(wallBase, 0.45);
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(w * (0.04 + i * 0.19), 0, 14 * scale, h * 0.24);
    }
    ctx.fillRect(0, h * 0.14, w, 12 * scale);

    // Wooden floor planks
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, floorBase);
    floorGrad.addColorStop(1, shadeHex(floorBase, 0.52));
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5 * scale;
    for (let i = 0; i < 6; i++) {
      const py = floorY + (i / 6) * (h - floorY);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Optional sunbeam through high window
    if (bd.sunbeam !== false) {
      const wx = (bd.sunX ?? 0.2) * w;
      const wy = (bd.sunY ?? 0.16) * h;
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(wx - 28 * scale, wy - 20 * scale, 56 * scale, 40 * scale);
      ctx.strokeStyle = '#3b2416';
      ctx.lineWidth = 4 * scale;
      ctx.strokeRect(wx - 28 * scale, wy - 20 * scale, 56 * scale, 40 * scale);

      const beamGrad = ctx.createLinearGradient(wx, wy, wx + w * 0.44, floorY + 40 * scale);
      beamGrad.addColorStop(0, bd.sunbeamColor || 'rgba(255, 232, 178, 0.34)');
      beamGrad.addColorStop(0.65, 'rgba(255, 224, 155, 0.12)');
      beamGrad.addColorStop(1, 'rgba(255, 224, 155, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(wx - 22 * scale, wy + 18 * scale);
      ctx.lineTo(wx + 28 * scale, wy - 12 * scale);
      ctx.lineTo(wx + w * 0.56, floorY + 60 * scale);
      ctx.lineTo(wx + w * 0.16, floorY + 60 * scale);
      ctx.closePath();
      ctx.fill();
    }

    return { skyLabel: 'Interior Studio', nightAmount: 0.25 };
  }

  // Sky gradient for all exterior / veranda / rooftop backdrops
  const horizonLimit = bd.type === 'veranda' ? floorY : Math.min(waterY, floorY);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(horizonLimit, h * 0.62));
  skyGrad.addColorStop(0, skyTop);
  skyGrad.addColorStop(0.55, skyMid);
  skyGrad.addColorStop(1, skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  if (bd.showStars ?? defaults.night > 0.5) {
    for (let i = 0; i < 85; i++) {
      const sx = hash1D(i * 19.7) * w;
      const sy = hash1D(i * 37.3) * h * 0.48;
      const twinkle = 0.45 + 0.55 * Math.sin(timeSec * (1.3 + hash1D(i * 7) * 2) + i);
      ctx.fillStyle = `rgba(241, 245, 255, ${(twinkle * 0.82).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (0.8 + hash1D(i * 13) * 1.4) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sun or Moon
  if (bd.showMoon ?? defaults.night > 0.6) {
    const mx = (bd.sunX ?? 0.76) * w;
    const my = (bd.sunY ?? 0.2) * h;
    const mr = 22 * scale;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 5.8);
    glow.addColorStop(0, 'rgba(226, 238, 255, 0.38)');
    glow.addColorStop(0.45, 'rgba(148, 184, 234, 0.14)');
    glow.addColorStop(1, 'rgba(148, 184, 234, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 5.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const sx = (bd.sunX ?? 0.28) * w;
    const sy = (bd.sunY ?? 0.38) * h;
    const glow = ctx.createRadialGradient(sx, sy, 6 * scale, sx, sy, w * 0.34);
    glow.addColorStop(0, 'rgba(255, 244, 206, 0.72)');
    glow.addColorStop(0.28, 'rgba(250, 178, 108, 0.32)');
    glow.addColorStop(1, 'rgba(250, 178, 108, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, w * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft drifting painted clouds
  for (let i = 0; i < 5; i++) {
    const cx = (((i * 0.24 + timeSec * (0.005 + i * 0.0012)) % 1.25) - 0.12) * w;
    const cy = (0.14 + (i % 3) * 0.08) * h;
    ctx.fillStyle = defaults.night > 0.5 ? 'rgba(30, 44, 72, 0.45)' : 'rgba(255, 240, 220, 0.28)';
    for (let p = -1; p <= 1; p++) {
      ctx.beginPath();
      ctx.ellipse(
        cx + p * 38 * scale,
        cy + Math.abs(p) * 6 * scale,
        (56 - Math.abs(p) * 14) * scale,
        (19 - Math.abs(p) * 4) * scale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Backdrop-specific horizon & ground architecture
  if (bd.type === 'night_water' || bd.type === 'outdoor_landscape') {
    // Distant painterly mountains / treeline
    ctx.fillStyle = defaults.night > 0.5 ? '#15223b' : '#4a4e6b';
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let i = 0; i <= 16; i++) {
      const nx = i / 16;
      const ridge = 0.05 + Math.sin(nx * 9.5 + 0.8) * 0.035 + hash1D(i * 11) * 0.03;
      ctx.lineTo(nx * w, waterY - ridge * h);
    }
    ctx.lineTo(w, waterY);
    ctx.closePath();
    ctx.fill();

    // Calm shimmering water plane
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, floorY + 20 * scale);
    waterGrad.addColorStop(0, shadeHex(skyMid, 0.72));
    waterGrad.addColorStop(1, shadeHex(skyTop, 0.55));
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, w, Math.max(0, floorY - waterY + 20 * scale));

    // Shimmer reflection bars
    const refX = (bd.sunX ?? 0.72) * w;
    for (let i = 0; i < 16; i++) {
      const p = i / 16;
      const ry = waterY + 8 * scale + p * Math.max(40, floorY - waterY - 12 * scale);
      const rw = (18 + p * 70 + Math.sin(timeSec * 2.5 + i) * 12) * scale;
      ctx.fillStyle = `rgba(255, 232, 185, ${(0.28 * (1 - p * 0.5)).toFixed(3)})`;
      ctx.fillRect(refX - rw * 0.5 + Math.sin(timeSec * 1.8 + i) * 6 * scale, ry, rw, 2.2 * scale);
    }

    // Foreground embankment / walkway
    const groundCol = bd.floorColor || (defaults.night > 0.5 ? '#141c2c' : '#262b38');
    ctx.fillStyle = groundCol;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const nx = i / 40;
      const gy = floorY + Math.sin(nx * Math.PI * 1.4) * 9 * scale;
      ctx.lineTo(nx * w, gy);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  } else if (bd.type === 'sunset_field') {
    // Rolling golden hills
    ctx.fillStyle = '#4e3e4b';
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.quadraticCurveTo(w * 0.25, floorY - 78 * scale, w * 0.52, floorY - 24 * scale);
    ctx.quadraticCurveTo(w * 0.78, floorY - 92 * scale, w, floorY - 28 * scale);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    const fieldGrad = ctx.createLinearGradient(0, floorY - 10 * scale, 0, h);
    fieldGrad.addColorStop(0, bd.floorColor || '#3c4529');
    fieldGrad.addColorStop(1, '#1b2114');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, floorY - 10 * scale, w, h - floorY + 10 * scale);
  } else if (bd.type === 'rooftop') {
    // Distant skyline silhouettes
    ctx.fillStyle = '#292234';
    for (let i = 0; i < 18; i++) {
      const bx = (i / 18) * w;
      const bh = (40 + hash1D(i * 17.4) * 70) * scale;
      ctx.fillRect(bx, floorY - 52 * scale - bh, w / 16, bh + 60 * scale);
    }

    // Terracotta parapet wall
    const wallCol = bd.wallColor || '#6b3a2e';
    ctx.fillStyle = wallCol;
    ctx.fillRect(0, floorY - 68 * scale, w, 72 * scale);
    ctx.fillStyle = shadeHex(wallCol, 1.24);
    ctx.fillRect(0, floorY - 74 * scale, w, 10 * scale);

    // Rooftop terrace floor
    ctx.fillStyle = bd.floorColor || '#402c27';
    ctx.fillRect(0, floorY, w, h - floorY);
  } else if (bd.type === 'veranda') {
    // Warm sunlit veranda backdrop
    const wallCol = bd.wallColor || '#e2c9a6';
    ctx.fillStyle = wallCol;
    ctx.fillRect(0, 0, w * 0.34, floorY);
    ctx.fillRect(w * 0.78, 0, w * 0.22, floorY);
    ctx.fillRect(0, 0, w, h * 0.14);

    // Balustrade railing across open veranda bay
    ctx.fillStyle = '#4c3426';
    ctx.fillRect(w * 0.34, floorY - 78 * scale, w * 0.44, 10 * scale);
    for (let i = 0; i <= 14; i++) {
      const rx = w * (0.35 + (i / 14) * 0.42);
      ctx.fillRect(rx, floorY - 74 * scale, 6 * scale, 74 * scale);
    }

    // Terracotta floor
    ctx.fillStyle = bd.floorColor || '#6c3e2e';
    ctx.fillRect(0, floorY, w, h - floorY);
  } else if (bd.type === 'rural_bengal' || bd.type === 'courtyard') {
    // Distant Bengali village greenery (আমবাগান, বাঁশঝাড়, সুপারি বাগান)
    const treeCol = defaults.night > 0.5 ? '#162822' : '#324a35';
    ctx.fillStyle = treeCol;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    for (let i = 0; i <= 24; i++) {
      const nx = i / 24;
      const hump = Math.sin(nx * Math.PI * 4.2 + 0.5) * 18 * scale + Math.cos(nx * 14) * 8 * scale;
      ctx.lineTo(nx * w, floorY - 38 * scale - hump);
    }
    ctx.lineTo(w, floorY);
    ctx.closePath();
    ctx.fill();

    // Village courtyard dirt ground (মাটির উঠান)
    const groundGrad = ctx.createLinearGradient(0, floorY - 6 * scale, 0, h);
    groundGrad.addColorStop(0, bd.floorColor || '#8a6245');
    groundGrad.addColorStop(0.35, '#755138');
    groundGrad.addColorStop(1, '#543825');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, floorY - 6 * scale, w, h - floorY + 6 * scale);

    // Subtle earthen soil textures / ground lines
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5 * scale;
    for (let i = 0; i < 5; i++) {
      const gy = floorY + (i + 1) * 24 * scale;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
  }

  return { skyLabel: defaults.label, nightAmount: defaults.night };
}

function drawProceduralProp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  prop: EnginePropSpec,
  sceneProgress: number,
  timeSec: number
): void {
  const s = (prop.scale ?? 1) * (w / 1280);
  const motion = prop.motion ?? 'static';

  let nx = prop.x;
  let ny = prop.y;
  let rot = prop.rotation ?? 0;
  let openAmt = 0;

  if (motion === 'move_across') {
    const t = easeInOutCubic(sceneProgress);
    nx = lerp(prop.x, prop.xEnd ?? prop.x + 0.45, t);
    ny = lerp(prop.y, prop.yEnd ?? prop.y, t);
  } else if (motion === 'float') {
    ny += Math.sin(timeSec * 2.1 + prop.x * 12) * 0.015;
    rot += Math.sin(timeSec * 1.4 + prop.y * 8) * 0.08;
  } else if (motion === 'sway') {
    rot += Math.sin(timeSec * 1.9 + prop.x * 10) * 0.07;
  } else if (motion === 'open_reveal') {
    openAmt = smoothstep(0.18, 0.65, sceneProgress);
  }

  const px = nx * w;
  const py = ny * h;
  const primary = prop.color || '#8c2d24';
  const accent = prop.accentColor || '#f5c76b';

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);

  switch (prop.kind) {
    case 'trunk': {
      ctx.fillStyle = primary || '#4d2718';
      ctx.beginPath();
      ctx.roundRect(-84 * s, -54 * s, 168 * s, 56 * s, 6 * s);
      ctx.fill();
      ctx.fillStyle = shadeHex(primary || '#4d2718', 0.72);
      ctx.fillRect(-88 * s, -60 * s, 176 * s, 12 * s);
      ctx.fillStyle = accent;
      ctx.fillRect(-10 * s, -44 * s, 20 * s, 14 * s);
      break;
    }
    case 'tin_box': {
      const bw = 62 * s;
      const bh = 36 * s;
      ctx.fillStyle = primary || '#9e2620';
      ctx.beginPath();
      ctx.roundRect(-bw * 0.5, -bh, bw, bh, 4 * s);
      ctx.fill();
      // Hinged lid
      ctx.save();
      ctx.translate(-bw * 0.5, -bh);
      ctx.rotate(-openAmt * 1.35);
      ctx.fillStyle = shadeHex(primary || '#9e2620', 1.18);
      ctx.fillRect(-2 * s, -9 * s, bw + 4 * s, 10 * s);
      ctx.restore();
      if (openAmt > 0.2) {
        const glow = ctx.createRadialGradient(0, -bh, 2, 0, -bh - 14 * s, 46 * s);
        glow.addColorStop(0, `rgba(255, 232, 165, ${(openAmt * 0.55).toFixed(3)})`);
        glow.addColorStop(1, 'rgba(255, 232, 165, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -bh - 10 * s, 46 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'envelope': {
      ctx.fillStyle = primary || '#f1dfba';
      ctx.strokeStyle = '#9c7d52';
      ctx.lineWidth = 1.5 * s;
      ctx.fillRect(-26 * s, -16 * s, 52 * s, 32 * s);
      ctx.strokeRect(-26 * s, -16 * s, 52 * s, 32 * s);
      ctx.beginPath();
      ctx.moveTo(-26 * s, -16 * s);
      ctx.lineTo(0, 2 * s);
      ctx.lineTo(26 * s, -16 * s);
      ctx.stroke();
      if (prop.label) {
        ctx.fillStyle = '#5c3f24';
        ctx.font = `600 ${Math.round(9 * s)}px "Noto Sans Bengali", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(prop.label, 0, 12 * s);
      }
      break;
    }
    case 'table': {
      ctx.fillStyle = primary || '#5a3520';
      ctx.fillRect(-52 * s, -48 * s, 104 * s, 9 * s);
      ctx.fillRect(-42 * s, -39 * s, 8 * s, 40 * s);
      ctx.fillRect(34 * s, -39 * s, 8 * s, 40 * s);
      break;
    }
    case 'easy_chair': {
      ctx.strokeStyle = primary || '#4e2e1c';
      ctx.lineWidth = 7 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-42 * s, 0);
      ctx.lineTo(-18 * s, -32 * s);
      ctx.lineTo(44 * s, -32 * s);
      ctx.lineTo(28 * s, 0);
      ctx.moveTo(-18 * s, -32 * s);
      ctx.lineTo(-42 * s, -74 * s);
      ctx.stroke();
      ctx.strokeStyle = accent || '#c9975a';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(-36 * s, -68 * s);
      ctx.quadraticCurveTo(-8 * s, -30 * s, 38 * s, -34 * s);
      ctx.stroke();
      break;
    }
    case 'books_stack': {
      const cols = ['#6b2d26', '#2a4559', '#3f523a', '#785028'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect((-24 + (i % 2) * 4) * s, -(i + 1) * 10 * s, 46 * s, 9 * s);
      }
      break;
    }
    case 'lamp':
    case 'street_lamp': {
      const poleH = prop.kind === 'street_lamp' ? 140 * s : 44 * s;
      ctx.strokeStyle = '#1b2232';
      ctx.lineWidth = (prop.kind === 'street_lamp' ? 4 : 3) * s;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -poleH);
      ctx.stroke();
      const glow = ctx.createRadialGradient(0, -poleH, 2, 0, -poleH, 68 * s);
      glow.addColorStop(0, '#fff7d6');
      glow.addColorStop(0.28, 'rgba(251, 191, 36, 0.55)');
      glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -poleH, 68 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(0, -poleH, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'clay_pot': {
      ctx.fillStyle = primary || '#a45435';
      ctx.beginPath();
      ctx.ellipse(0, -14 * s, 26 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeHex(primary || '#a45435', 0.65);
      ctx.beginPath();
      ctx.ellipse(0, -24 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'banyan_tree': {
      ctx.fillStyle = '#33221a';
      ctx.fillRect(-18 * s, -150 * s, 36 * s, 152 * s);
      // Aerial hanging roots
      ctx.strokeStyle = '#473022';
      ctx.lineWidth = 2.5 * s;
      for (let i = -3; i <= 3; i++) {
        const rx = i * 26 * s;
        const sway = Math.sin(timeSec * 1.4 + i) * 5 * s;
        ctx.beginPath();
        ctx.moveTo(rx, -145 * s);
        ctx.quadraticCurveTo(rx + sway, -75 * s, rx + sway * 1.4, -4 * s);
        ctx.stroke();
      }
      // Wide lush canopy
      ctx.fillStyle = primary || '#1f3b28';
      const puffs = [
        [-75, -165, 62],
        [-25, -195, 74],
        [35, -190, 70],
        [82, -162, 58],
        [0, -158, 86],
      ];
      for (const [dx, dy, r] of puffs) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'steam_train': {
      // Vintage locomotive + 2 passenger coaches
      ctx.fillStyle = primary || '#1f2633';
      ctx.fillRect(-110 * s, -40 * s, 72 * s, 32 * s);
      ctx.fillRect(-118 * s, -54 * s, 28 * s, 22 * s);
      ctx.fillRect(-58 * s, -58 * s, 10 * s, 20 * s);
      // Coaches
      for (let c = 0; c < 2; c++) {
        const cx = -28 * s + c * 92 * s;
        ctx.fillStyle = '#3d2420';
        ctx.fillRect(cx, -42 * s, 84 * s, 34 * s);
        ctx.fillStyle = '#fde68a';
        for (let wi = 0; wi < 4; wi++) {
          ctx.fillRect(cx + (10 + wi * 18) * s, -34 * s, 11 * s, 12 * s);
        }
      }
      // Curling steam puffs
      for (let i = 0; i < 5; i++) {
        const p = ((timeSec * 0.8 + i * 0.2) % 1);
        ctx.fillStyle = `rgba(241, 245, 249, ${((1 - p) * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc((-53 + p * 75) * s, (-64 - p * 46) * s, (7 + p * 18) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'boat': {
      const bob = Math.sin(timeSec * 2.2 + prop.x * 8) * 3.5 * s;
      ctx.translate(0, bob);
      // Hull
      ctx.fillStyle = primary || '#332018';
      ctx.beginPath();
      ctx.moveTo(-64 * s, -8 * s);
      ctx.quadraticCurveTo(0, 16 * s, 66 * s, -12 * s);
      ctx.lineTo(54 * s, 4 * s);
      ctx.quadraticCurveTo(0, 22 * s, -54 * s, 4 * s);
      ctx.closePath();
      ctx.fill();
      // Bamboo canopy (Chhoi)
      ctx.fillStyle = accent || '#6e4b2e';
      ctx.beginPath();
      ctx.arc(-6 * s, -6 * s, 26 * s, Math.PI, 0);
      ctx.fill();
      // Hanging lantern on bow
      const glow = ctx.createRadialGradient(54 * s, -20 * s, 2, 54 * s, -20 * s, 34 * s);
      glow.addColorStop(0, '#fef08a');
      glow.addColorStop(0.4, 'rgba(245, 158, 11, 0.45)');
      glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(54 * s, -20 * s, 34 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cottage': {
      ctx.fillStyle = primary || '#2a2224';
      ctx.fillRect(-56 * s, -68 * s, 112 * s, 68 * s);
      ctx.fillStyle = shadeHex(primary || '#2a2224', 0.68);
      ctx.beginPath();
      ctx.moveTo(-68 * s, -66 * s);
      ctx.lineTo(0, -112 * s);
      ctx.lineTo(68 * s, -66 * s);
      ctx.closePath();
      ctx.fill();
      // Warm lit window
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-16 * s, -48 * s, 32 * s, 26 * s);
      break;
    }
    case 'tea_stall': {
      // Classic Bengal roadside / ghat tea stall with warm bulb & kettle steam
      ctx.fillStyle = '#2d1f18';
      ctx.fillRect(-74 * s, -104 * s, 8 * s, 104 * s);
      ctx.fillRect(66 * s, -104 * s, 8 * s, 104 * s);
      // Slanted tin roof
      ctx.fillStyle = primary || '#3e2d26';
      ctx.beginPath();
      ctx.moveTo(-88 * s, -98 * s);
      ctx.lineTo(86 * s, -112 * s);
      ctx.lineTo(82 * s, -94 * s);
      ctx.lineTo(-84 * s, -84 * s);
      ctx.closePath();
      ctx.fill();
      // Wooden counter
      ctx.fillStyle = '#4f3222';
      ctx.fillRect(-68 * s, -42 * s, 136 * s, 42 * s);
      // Warm hanging tungsten bulb
      const bulbGlow = ctx.createRadialGradient(0, -82 * s, 2, 0, -82 * s, 88 * s);
      bulbGlow.addColorStop(0, '#fffbeb');
      bulbGlow.addColorStop(0.25, 'rgba(251, 191, 36, 0.55)');
      bulbGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = bulbGlow;
      ctx.beginPath();
      ctx.arc(0, -82 * s, 88 * s, 0, Math.PI * 2);
      ctx.fill();
      // Tea kettle + rising steam
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(-22 * s, -50 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const p = ((timeSec * 0.7 + i * 0.25) % 1);
        ctx.fillStyle = `rgba(255,255,255,${((1 - p) * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc((-22 + Math.sin(timeSec * 3 + i) * 6) * s, (-62 - p * 30) * s, (4 + p * 7) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      if (prop.label) {
        ctx.fillStyle = '#fde68a';
        ctx.font = `600 ${Math.round(13 * s)}px "Noto Sans Bengali", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(prop.label, 0, -98 * s);
      }
      break;
    }
    case 'bridge': {
      ctx.fillStyle = primary || '#1e2536';
      ctx.fillRect(-160 * s, -22 * s, 320 * s, 12 * s);
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(i * 68 * s - 6 * s, -20 * s, 12 * s, 60 * s);
      }
      break;
    }
    case 'bench': {
      ctx.fillStyle = primary || '#5a3825';
      ctx.fillRect(-48 * s, -24 * s, 96 * s, 7 * s);
      ctx.fillRect(-46 * s, -42 * s, 92 * s, 7 * s);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-40 * s, -22 * s, 5 * s, 22 * s);
      ctx.fillRect(35 * s, -22 * s, 5 * s, 22 * s);
      break;
    }
    case 'campfire': {
      ctx.fillStyle = '#3b2416';
      ctx.fillRect(-18 * s, -6 * s, 36 * s, 7 * s);
      const flicker = 0.85 + 0.22 * Math.sin(timeSec * 14);
      const fireGlow = ctx.createRadialGradient(0, -14 * s, 3, 0, -14 * s, 74 * s * flicker);
      fireGlow.addColorStop(0, 'rgba(255, 245, 190, 0.9)');
      fireGlow.addColorStop(0.32, 'rgba(249, 115, 22, 0.5)');
      fireGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = fireGlow;
      ctx.beginPath();
      ctx.arc(0, -14 * s, 74 * s * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-12 * s, -4 * s);
      ctx.quadraticCurveTo(0, -34 * s * flicker, 12 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'kite': {
      const sway = Math.sin(timeSec * 3.1 + prop.x * 10) * 10 * s;
      ctx.translate(sway, Math.cos(timeSec * 2.4) * 6 * s);
      ctx.fillStyle = primary || '#e11d48';
      ctx.beginPath();
      ctx.moveTo(0, -24 * s);
      ctx.lineTo(18 * s, 0);
      ctx.lineTo(0, 24 * s);
      ctx.lineTo(-18 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(0, 24 * s);
      ctx.quadraticCurveTo(-18 * s, 44 * s, -8 * s, 68 * s);
      ctx.stroke();
      break;
    }
    case 'curtain': {
      const sway = Math.sin(timeSec * 1.7) * 16 * s;
      ctx.fillStyle = primary || 'rgba(245, 236, 220, 0.78)';
      ctx.beginPath();
      ctx.moveTo(-24 * s, 0);
      ctx.lineTo(24 * s, 0);
      ctx.quadraticCurveTo(30 * s + sway, 90 * s, 14 * s + sway * 1.3, 180 * s);
      ctx.lineTo(-24 * s + sway * 0.7, 180 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'window_beam': {
      const g = ctx.createLinearGradient(0, 0, 180 * s, 260 * s);
      g.addColorStop(0, primary || 'rgba(255, 236, 180, 0.36)');
      g.addColorStop(1, 'rgba(255, 236, 180, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-24 * s, 0);
      ctx.lineTo(24 * s, 0);
      ctx.lineTo(220 * s, 280 * s);
      ctx.lineTo(80 * s, 280 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tin_house': {
      // Corrugated Tin Shed Village House (টিনের ঘর)
      const houseW = 210 * s;
      const wallH = 110 * s;
      const roofH = 75 * s;

      // Earthen Foundation / Plinth (ভিটা)
      ctx.fillStyle = '#6e4f3a';
      ctx.fillRect(-houseW * 0.52, -12 * s, houseW * 1.04, 14 * s);

      // Mud / Plaster Wall
      ctx.fillStyle = primary || '#9c7c5d';
      ctx.strokeStyle = '#2b1d14';
      ctx.lineWidth = 2.4 * s;
      ctx.fillRect(-houseW * 0.48, -wallH, houseW * 0.96, wallH - 10 * s);
      ctx.strokeRect(-houseW * 0.48, -wallH, houseW * 0.96, wallH - 10 * s);

      // Corrugated Tin Roof (টিনের চাল) with metallic ridges
      const roofLeft = -houseW * 0.58;
      const roofRight = houseW * 0.58;
      const ridgeY = -wallH - roofH;
      const eaveY = -wallH + 6 * s;

      ctx.fillStyle = accent || '#4a5b6c';
      ctx.beginPath();
      ctx.moveTo(roofLeft, eaveY);
      ctx.lineTo(0, ridgeY);
      ctx.lineTo(roofRight, eaveY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Corrugated vertical sheen lines
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1.8 * s;
      for (let i = -10; i <= 10; i++) {
        const t = i / 10;
        ctx.beginPath();
        ctx.moveTo(0, ridgeY);
        ctx.lineTo(t * houseW * 0.56, eaveY);
        ctx.stroke();
      }

      // Tin ridge cap (মটকা)
      ctx.fillStyle = '#2d3b4a';
      ctx.beginPath();
      ctx.moveTo(-16 * s, ridgeY + 4 * s);
      ctx.lineTo(0, ridgeY - 6 * s);
      ctx.lineTo(16 * s, ridgeY + 4 * s);
      ctx.closePath();
      ctx.fill();

      // Wooden Window with Vertical Grill Bars (গ্রিল/শিক দেওয়া জানালা)
      const winW = 46 * s;
      const winH = 46 * s;
      const winX = -houseW * 0.22;
      const winY = -wallH + 28 * s;
      ctx.fillStyle = '#1c1512';
      ctx.fillRect(winX - winW * 0.5, winY, winW, winH);
      ctx.strokeStyle = '#3d2516';
      ctx.lineWidth = 3 * s;
      ctx.strokeRect(winX - winW * 0.5, winY, winW, winH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8 * s;
      for (let g = 1; g <= 4; g++) {
        const gx = winX - winW * 0.5 + (g / 5) * winW;
        ctx.beginPath();
        ctx.moveTo(gx, winY);
        ctx.lineTo(gx, winY + winH);
        ctx.stroke();
      }

      // Wooden Door Frame
      const doorW = 38 * s;
      const doorH = 78 * s;
      const doorX = houseW * 0.22;
      const doorY = -wallH + 24 * s;
      ctx.fillStyle = '#3a2417';
      ctx.fillRect(doorX - doorW * 0.5, doorY, doorW, doorH);
      ctx.strokeStyle = '#1a100a';
      ctx.lineWidth = 2.5 * s;
      ctx.strokeRect(doorX - doorW * 0.5, doorY, doorW, doorH);
      ctx.beginPath();
      ctx.moveTo(doorX, doorY);
      ctx.lineTo(doorX, doorY + doorH);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(doorX - 4 * s, doorY + doorH * 0.5, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bamboo_fence': {
      // Rustic Village Bamboo Boundary Fence (বাঁশের চাঁচ / সীমানা বেড়া)
      const fw = 140 * s;
      const fh = 95 * s;
      ctx.strokeStyle = '#2b1b11';
      ctx.lineWidth = 2.2 * s;
      for (let i = 0; i < 9; i++) {
        const bx = -fw * 0.5 + (i / 8) * fw;
        const poleH = fh + ((i % 3) - 1) * 8 * s;
        ctx.fillStyle = (i % 2 === 0) ? '#d4a373' : '#bc8a5f';
        ctx.fillRect(bx - 3.2 * s, -poleH, 6.4 * s, poleH);
        ctx.strokeRect(bx - 3.2 * s, -poleH, 6.4 * s, poleH);
        ctx.strokeStyle = '#7f5539';
        ctx.lineWidth = 1.4 * s;
        for (let n = 1; n <= 4; n++) {
          const ny = -poleH * (n / 5);
          ctx.beginPath();
          ctx.moveTo(bx - 3.2 * s, ny);
          ctx.lineTo(bx + 3.2 * s, ny);
          ctx.stroke();
        }
      }
      for (let h = 1; h <= 3; h++) {
        const hy = -fh * (h / 3.8);
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-fw * 0.52, hy - 2.5 * s, fw * 1.04, 5 * s);
        ctx.strokeStyle = '#382313';
        ctx.strokeRect(-fw * 0.52, hy - 2.5 * s, fw * 1.04, 5 * s);
      }
      break;
    }
    case 'palm_tree': {
      // Coconut / Areca Betel Nut Palm Tree (নারকেল ও সুপারি গাছ)
      const trunkH = 220 * s;
      const bend = Math.sin(timeSec * 0.8) * 6 * s;
      ctx.strokeStyle = '#5a3d28';
      ctx.lineWidth = 12 * s;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(bend * 0.4, -trunkH * 0.5, bend, -trunkH);
      ctx.stroke();

      ctx.strokeStyle = '#3b2518';
      ctx.lineWidth = 1.8 * s;
      for (let i = 1; i <= 14; i++) {
        const py = -trunkH * (i / 15);
        const px = (bend * (i / 15));
        ctx.beginPath();
        ctx.moveTo(px - 6 * s, py);
        ctx.lineTo(px + 6 * s, py);
        ctx.stroke();
      }

      const cx = bend;
      const cy = -trunkH;
      ctx.fillStyle = '#65a30d';
      for (let c = 0; c < 5; c++) {
        const ang = (c / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * 7 * s, cy + 8 * s + Math.sin(ang) * 5 * s, 5.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      const sway = Math.sin(timeSec * 2.1) * 0.08;
      ctx.save();
      ctx.translate(cx, cy);
      for (let f = 0; f < 8; f++) {
        const baseAngle = -Math.PI * 0.5 + (f - 3.5) * 0.42 + sway;
        const frondLen = (78 + (f % 3) * 12) * s;
        ctx.strokeStyle = (f % 2 === 0) ? '#2d6a4f' : '#1e4d38';
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const tipX = Math.cos(baseAngle) * frondLen;
        const tipY = Math.sin(baseAngle) * frondLen + 22 * s;
        ctx.quadraticCurveTo(tipX * 0.5, tipY * 0.2, tipX, tipY);
        ctx.stroke();

        ctx.fillStyle = (f % 2 === 0) ? '#40916c' : '#2d6a4f';
        for (let b = 3; b <= 9; b++) {
          const bt = b / 10;
          const bx = tipX * bt;
          const by = tipY * bt * bt;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - 6 * s, by + 12 * s);
          ctx.lineTo(bx + 4 * s, by + 4 * s);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      break;
    }
    case 'banana_tree': {
      // Broad-leaved Bengali Banana Tree (কলা গাছ)
      const bh = 110 * s;
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(-7 * s, -bh, 14 * s, bh);
      ctx.strokeStyle = '#3f6212';
      ctx.lineWidth = 1.8 * s;
      ctx.strokeRect(-7 * s, -bh, 14 * s, bh);

      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI * 0.5 + (i - 2) * 0.52;
        const lw = 75 * s;
        const leafSway = Math.sin(timeSec * 1.8 + i) * 4 * s;
        ctx.save();
        ctx.translate(0, -bh);
        ctx.rotate(ang);
        ctx.fillStyle = (i % 2 === 0) ? '#4ade80' : '#22c55e';
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.ellipse(lw * 0.45, leafSway * 0.3, lw * 0.48, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(lw * 0.9, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'certificate_frame': {
      // Framed SSC / Educational Certificate (বড় পোলা স্টাইল)
      const fw = 68 * s;
      const fh = 48 * s;
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-fw * 0.5, -fh, fw, fh);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-fw * 0.44, -fh + 4 * s, fw * 0.88, fh - 8 * s);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(fw * 0.24, -fh * 0.32, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.2 * s;
      for (let l = 1; l <= 4; l++) {
        ctx.beginPath();
        ctx.moveTo(-fw * 0.36, -fh + l * 7 * s);
        ctx.lineTo(fw * 0.12, -fh + l * 7 * s);
        ctx.stroke();
      }
      if (prop.label) {
        ctx.fillStyle = '#78350f';
        ctx.font = `700 ${Math.round(8 * s)}px "Noto Sans Bengali", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(prop.label, 0, -fh + 12 * s);
      }
      break;
    }
    case 'khatia': {
      // Traditional Jute Rope Bed / Khatia (খাটিয়া)
      const kw = 130 * s;
      const kh = 32 * s;
      ctx.fillStyle = '#3e2723';
      ctx.strokeStyle = '#1a0c02';
      ctx.lineWidth = 2 * s;
      ctx.fillRect(-kw * 0.45, -kh, 9 * s, kh);
      ctx.strokeRect(-kw * 0.45, -kh, 9 * s, kh);
      ctx.fillRect(kw * 0.45 - 9 * s, -kh, 9 * s, kh);
      ctx.strokeRect(kw * 0.45 - 9 * s, -kh, 9 * s, kh);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(-kw * 0.5, -kh - 8 * s, kw, 8 * s);
      ctx.strokeRect(-kw * 0.5, -kh - 8 * s, kw, 8 * s);
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 1.6 * s;
      for (let i = -kw * 0.46; i <= kw * 0.46; i += 12 * s) {
        ctx.beginPath();
        ctx.moveTo(i, -kh - 7 * s);
        ctx.lineTo(i + 8 * s, -kh - 1 * s);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

function drawEngineActor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  actor: EngineActorSpec,
  sceneProgress: number,
  timeSec: number,
  showRig: boolean
): { hipYOffset: number; kneeDeg: number } {
  const baseScale = (w / 1280) * (actor.scale ?? 1);
  const ageScale =
    actor.ageStyle === 'child' ? 0.78 : actor.ageStyle === 'elder' ? 0.96 : 1.0;
  const s = baseScale * ageScale;

  const isMoving = actor.pose === 'walk' || actor.pose === 'run';
  const moveT = isMoving ? sceneProgress : easeInOutCubic(smoothstep(0, 0.7, sceneProgress));
  const nx =
    actor.xEnd !== undefined ? lerp(actor.xStart, actor.xEnd, moveT) : actor.xStart;
  const ny = actor.yGround ?? 0.79;
  const x = nx * w;
  const y = ny * h;

  const facing: 1 | -1 =
    actor.facing ?? (actor.xEnd !== undefined && actor.xEnd < actor.xStart ? -1 : 1);

  const freq = actor.pose === 'run' ? 9.5 : 5.4;
  const phase = timeSec * freq + hash1D(actor.xStart * 99) * Math.PI * 2;
  const strideLen = (actor.pose === 'run' ? 28 : 19) * s;
  const stepLift = (actor.pose === 'run' ? 14 : 8.5) * s;

  const thighLen = 30 * s;
  const shinLen = 29 * s;
  const torsoLen = 40 * s;
  const upperArmLen = 22 * s;
  const foreArmLen = 21 * s;

  let hipYOffset = 0;
  if (actor.pose === 'walk' || actor.pose === 'run') {
    hipYOffset = -Math.abs(Math.sin(phase)) * 4.5 * s;
  } else if (actor.pose === 'kneel') {
    hipYOffset = 22 * s;
  } else if (actor.pose === 'sit') {
    hipYOffset = 18 * s;
  } else {
    hipYOffset = Math.sin(timeSec * 2.2) * 1.4 * s;
  }

  const hip = { x, y: y - 55 * s + hipYOffset };
  const lean =
    actor.pose === 'run'
      ? 0.22 * facing
      : actor.pose === 'kneel'
      ? 0.16 * facing
      : actor.pose === 'reach'
      ? 0.12 * facing
      : actor.ageStyle === 'elder'
      ? 0.08 * facing
      : 0.03 * facing;
  const shoulder = {
    x: hip.x + Math.sin(lean) * torsoLen,
    y: hip.y - Math.cos(lean) * torsoLen,
  };
  const head = {
    x: shoulder.x + facing * 2 * s,
    y: shoulder.y - 16 * s,
  };

  // Foot IK targets
  const backFootTarget = isMoving
    ? {
        x: x + Math.sin(phase + Math.PI) * strideLen * facing,
        y: y - Math.max(0, Math.cos(phase + Math.PI)) * stepLift,
      }
    : actor.pose === 'sit'
    ? { x: x + 26 * s * facing, y: y - 2 * s }
    : actor.pose === 'kneel'
    ? { x: x - 20 * s * facing, y: y }
    : { x: x - 8 * s * facing, y };

  const leadFootTarget = isMoving
    ? {
        x: x + Math.sin(phase) * strideLen * facing,
        y: y - Math.max(0, Math.cos(phase)) * stepLift,
      }
    : actor.pose === 'sit'
    ? { x: x + 36 * s * facing, y }
    : actor.pose === 'kneel'
    ? { x: x + 16 * s * facing, y }
    : { x: x + 10 * s * facing, y };

  const kneeBend: 1 | -1 = facing === 1 ? -1 : 1;
  const backLeg = solveTwoBoneIK(hip, backFootTarget, thighLen, shinLen, kneeBend);
  const leadLeg = solveTwoBoneIK(hip, leadFootTarget, thighLen, shinLen, kneeBend);

  // Hand IK target
  let handTarget = {
    x: shoulder.x + facing * 18 * s,
    y: shoulder.y + 30 * s + Math.sin(timeSec * 2.5) * 2 * s,
  };
  if (actor.pose === 'raise_prop') {
    const lift = smoothstep(0.15, 0.7, sceneProgress);
    handTarget = {
      x: shoulder.x + facing * (24 + lift * 10) * s,
      y: shoulder.y + lerp(16, -24, lift) * s,
    };
  } else if (actor.pose === 'reach' || actor.pose === 'hold_hands') {
    handTarget = {
      x: shoulder.x + facing * 34 * s,
      y: shoulder.y + 12 * s,
    };
  } else if (actor.pose === 'kneel') {
    handTarget = {
      x: shoulder.x + facing * 26 * s,
      y: shoulder.y + 24 * s,
    };
  } else if (isMoving) {
    handTarget = {
      x: shoulder.x + facing * (12 + Math.sin(phase + Math.PI) * 14) * s,
      y: shoulder.y + 28 * s,
    };
  }
  const leadArm = solveTwoBoneIK(shoulder, handTarget, upperArmLen, foreArmLen, facing);

  // Palette & Archetype Config
  const skin = actor.skinTone || '#f6d5b8';
  const coat = actor.coatColor || '#f8fafc';
  const hair = actor.hairColor || (actor.ageStyle === 'elder' ? '#f1f5f9' : '#18181b');
  const isElder = actor.ageStyle === 'elder' || actor.characterRole === 'elder_father' || actor.characterRole === 'mother';
  const hasLungi = actor.hasLungi ?? (actor.characterRole === 'elder_father' || actor.characterRole === 'brother' || actor.characterRole === 'matobbor');
  const hasTupi = actor.hasTupi ?? (actor.characterRole === 'elder_father' || actor.characterRole === 'matobbor');
  const hasBeard = actor.hasBeard ?? (actor.characterRole === 'elder_father' || actor.characterRole === 'matobbor');
  const hasSareeOrHijab = actor.hasSaree || actor.hasHijab || actor.characterRole === 'mother' || actor.characterRole === 'daughter' || actor.characterRole === 'wife';
  const isCrying = actor.hasTears ?? (actor.emotion === 'cry' || actor.emotion === 'sad' || actor.emotion === 'solemn');

  ctx.save();

  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * s, 25 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs & Lungi / Trousers
  const drawCartLimb = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, color: string, lw: number) => {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = lw + 2.8 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  };

  const legColor = hasLungi ? skin : '#334155';
  drawCartLimb(hip, backLeg.joint, backLeg.end, legColor, 7.5 * s);
  drawCartLimb(hip, leadLeg.joint, leadLeg.end, legColor, 8 * s);

  // Bengali Lungi Drape (checked pattern with folds)
  if (hasLungi) {
    const lungiBase = actor.lungiColor || '#0284c7';
    const lungiW = 28 * s;
    const lungiH = 34 * s;

    ctx.save();
    ctx.fillStyle = lungiBase;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(hip.x - lungiW * 0.5, hip.y - 4 * s);
    ctx.lineTo(hip.x + lungiW * 0.5, hip.y - 4 * s);
    ctx.lineTo(hip.x + lungiW * 0.6, hip.y + lungiH);
    ctx.lineTo(hip.x - lungiW * 0.6, hip.y + lungiH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Woven checked pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.2 * s;
    for (let c = -2; c <= 2; c++) {
      const cx = hip.x + c * 5.5 * s;
      ctx.beginPath();
      ctx.moveTo(cx, hip.y - 4 * s);
      ctx.lineTo(cx, hip.y + lungiH);
      ctx.stroke();
    }
    for (let r = 1; r <= 4; r++) {
      const ry = hip.y + r * 6.5 * s;
      ctx.beginPath();
      ctx.moveTo(hip.x - lungiW * 0.55, ry);
      ctx.lineTo(hip.x + lungiW * 0.55, ry);
      ctx.stroke();
    }

    // Rolled waist fold (কোঁচানো ভাঁজ)
    ctx.fillStyle = shadeHex(lungiBase, 0.78);
    ctx.beginPath();
    ctx.ellipse(hip.x, hip.y - 3 * s, lungiW * 0.48, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Bengali Panjabi / Shirt Torso
  ctx.save();
  ctx.fillStyle = coat;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 14 * s, shoulder.y - 3 * s);
  ctx.lineTo(shoulder.x + 14 * s, shoulder.y - 3 * s);
  ctx.lineTo(hip.x + 17 * s, hip.y + 16 * s);
  ctx.lineTo(hip.x - 17 * s, hip.y + 16 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Band Collar (ব্যান্ড কলার)
  ctx.fillStyle = shadeHex(coat, 0.9);
  ctx.beginPath();
  ctx.roundRect(shoulder.x - 7 * s, shoulder.y - 6 * s, 14 * s, 5 * s, 2 * s);
  ctx.fill();
  ctx.stroke();

  // Front Button Placket with buttons
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y - 2 * s);
  ctx.lineTo(shoulder.x, shoulder.y + 22 * s);
  ctx.stroke();
  for (let b = 1; b <= 3; b++) {
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(shoulder.x, shoulder.y + b * 6 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chest Pocket
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.4 * s;
  ctx.strokeRect(shoulder.x + facing * 5 * s, shoulder.y + 5 * s, 7 * s, 8 * s);
  ctx.restore();

  // Head Center with bob
  const headRadius = 24 * s;
  const hBob = Math.sin(timeSec * 2.2) * 1.2 * s;
  const hxPos = head.x;
  const hyPos = head.y + hBob;

  // Ears
  ctx.fillStyle = skin;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.arc(hxPos - facing * headRadius * 0.95, hyPos, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Big 2D Cartoon Head Silhouette
  ctx.fillStyle = skin;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.8 * s;
  ctx.beginPath();
  ctx.ellipse(hxPos, hyPos, headRadius * 0.88, headRadius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Forehead Wrinkles for Elders
  if (isElder) {
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 1.4 * s;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      ctx.arc(hxPos + facing * 2 * s, hyPos - headRadius * 0.52 + w * 3.5 * s, 10 * s, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  // Expressive Cartoon Eyes
  const eyeOffset = facing * 6.5 * s;
  const eyeY = hyPos - 1.5 * s;
  const eyeW = 7.5 * s;
  const eyeH = 10 * s;

  const blink = (timeSec * 1.2) % 4.2;
  const isBlinking = blink > 4.05;

  const drawOneEye = (ex: number) => {
    ctx.save();
    if (isBlinking) {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1 * s, eyeW * 0.7, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else {
      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeW * 0.7, eyeH * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Black Pupil
      const pupilX = ex + facing * 1.5 * s;
      const pupilY = isCrying ? eyeY + 1 * s : eyeY;
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(pupilX, pupilY, 3.4 * s, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine catchlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pupilX - 1.2 * s, pupilY - 1.2 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();

      // Under-eye bag / grief wrinkle for elders
      if (isElder) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.arc(ex, eyeY + 7 * s, eyeW * 0.65, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  drawOneEye(hxPos - 4.5 * s + eyeOffset);
  drawOneEye(hxPos + 7.5 * s + eyeOffset);

  // Eyebrows
  ctx.strokeStyle = isElder ? '#94a3b8' : '#111827';
  ctx.lineWidth = 2.8 * s;
  ctx.lineCap = 'round';
  const browY = eyeY - 8.5 * s;
  if (actor.emotion === 'angry') {
    ctx.beginPath();
    ctx.moveTo(hxPos + eyeOffset - 7 * s, browY - 2 * s);
    ctx.lineTo(hxPos + eyeOffset - 1 * s, browY + 3 * s);
    ctx.moveTo(hxPos + eyeOffset + 2 * s, browY + 3 * s);
    ctx.lineTo(hxPos + eyeOffset + 10 * s, browY - 2 * s);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(hxPos + eyeOffset - 8 * s, browY + 2 * s);
    ctx.quadraticCurveTo(hxPos + eyeOffset - 4 * s, browY - 4 * s, hxPos + eyeOffset, browY);
    ctx.moveTo(hxPos + eyeOffset + 3 * s, browY);
    ctx.quadraticCurveTo(hxPos + eyeOffset + 7 * s, browY - 4 * s, hxPos + eyeOffset + 12 * s, browY + 2 * s);
    ctx.stroke();
  }

  // Spectacles / Glasses (like "বড় পোলা", "খাটিয়ার চার কোণা")
  if (actor.glasses || (isElder && !hasSareeOrHijab)) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(hxPos - 4.5 * s + eyeOffset, eyeY, 6.5 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hxPos + 7.5 * s + eyeOffset, eyeY, 6.5 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hxPos - 4.5 * s + eyeOffset + 6.5 * s, eyeY);
    ctx.lineTo(hxPos + 7.5 * s + eyeOffset - 6.5 * s, eyeY);
    ctx.stroke();
  }

  // Nose
  ctx.strokeStyle = '#5a3d28';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hxPos + eyeOffset + 1 * s, eyeY + 2 * s);
  ctx.lineTo(hxPos + eyeOffset + 2.5 * s, eyeY + 8 * s);
  ctx.lineTo(hxPos + eyeOffset - 1.5 * s, eyeY + 8.5 * s);
  ctx.stroke();

  // Cartoon Mouth (animated speaking or down-turned sorrow)
  const mouthY = hyPos + 13 * s;
  const mouthX = hxPos + eyeOffset;
  const isTalking = Math.abs(Math.sin(timeSec * 7)) > 0.45;
  if (isTalking && !isBlinking) {
    ctx.fillStyle = '#881337';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, 4.2 * s, (2 + Math.abs(Math.sin(timeSec * 7.5)) * 3.5) * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.arc(mouthX, mouthY + 5 * s, 5 * s, Math.PI + 0.35, Math.PI * 2 - 0.35);
    ctx.stroke();
  }

  // Streaming Animated Tears (Iconic Social Story Detail)
  if (isCrying) {
    ctx.save();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.95)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 1.4 * s;

    const tearStream = (tx: number) => {
      ctx.beginPath();
      ctx.moveTo(tx, eyeY + 6 * s);
      ctx.quadraticCurveTo(tx + Math.sin(timeSec * 3) * 1.5 * s, hyPos + 10 * s, tx, hyPos + 20 * s);
      ctx.stroke();

      const dropY = hyPos + 16 * s + ((timeSec * 14) % (8 * s));
      ctx.beginPath();
      ctx.arc(tx, dropY, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tx - 0.6 * s, dropY - 0.6 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
    };

    tearStream(hxPos - 4.5 * s + eyeOffset);
    tearStream(hxPos + 7.5 * s + eyeOffset);
    ctx.restore();
  }

  // White Muslim Prayer Cap (টুপি / Islamic Skullcap)
  if (hasTupi) {
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.ellipse(hxPos, hyPos - headRadius * 0.72, headRadius * 0.88, 10 * s, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2 * s;
    for (let t = -3; t <= 3; t++) {
      ctx.beginPath();
      ctx.moveTo(hxPos + t * 4 * s, hyPos - headRadius * 0.72);
      ctx.lineTo(hxPos + t * 2 * s, hyPos - headRadius * 0.95);
      ctx.stroke();
    }
  }

  // White / Henna Beard (দাঢ়ি)
  if (hasBeard) {
    const beardColor = actor.characterRole === 'matobbor' ? '#c2410c' : '#f1f5f9';
    ctx.fillStyle = beardColor;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(hxPos - headRadius * 0.7, hyPos + 4 * s);
    ctx.quadraticCurveTo(hxPos - headRadius * 0.8, hyPos + headRadius * 1.15, hxPos, hyPos + headRadius * 1.35);
    ctx.quadraticCurveTo(hxPos + headRadius * 0.8, hyPos + headRadius * 1.15, hxPos + headRadius * 0.7, hyPos + 4 * s);
    ctx.quadraticCurveTo(hxPos + eyeOffset, hyPos + 18 * s, hxPos - headRadius * 0.7, hyPos + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY - 3 * s, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draped Saree / Hijab / Orna for Women
  if (hasSareeOrHijab) {
    const ornaColor = actor.scarfColor || '#1e3a8a';
    ctx.fillStyle = ornaColor;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.arc(hxPos, hyPos - 4 * s, headRadius * 1.18, Math.PI * 0.85, Math.PI * 2.15);
    ctx.quadraticCurveTo(hxPos + headRadius * 1.1, hyPos + 24 * s, hxPos + headRadius * 0.6, shoulder.y + 18 * s);
    ctx.lineTo(hxPos - headRadius * 0.6, shoulder.y + 18 * s);
    ctx.quadraticCurveTo(hxPos - headRadius * 1.1, hyPos + 24 * s, hxPos - headRadius * 0.9, hyPos - 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.arc(hxPos, hyPos - 4 * s, headRadius * 1.15, Math.PI * 0.88, Math.PI * 2.12);
    ctx.stroke();
  } else if (!hasTupi) {
    // Neat Parted Cartoon Hair (for young men)
    ctx.fillStyle = hair;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.arc(hxPos, hyPos - headRadius * 0.45, headRadius * 0.95, Math.PI * 0.8, Math.PI * 2.2);
    ctx.quadraticCurveTo(hxPos + headRadius * 0.95, hyPos - 4 * s, hxPos + headRadius * 0.75, hyPos + 4 * s);
    ctx.lineTo(hxPos + headRadius * 0.45, hyPos - 6 * s);
    ctx.lineTo(hxPos - headRadius * 0.45, hyPos - 6 * s);
    ctx.lineTo(hxPos - headRadius * 0.75, hyPos + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Lead arm
  drawCartLimb(shoulder, leadArm.joint, leadArm.end, coat, 8.5 * s);

  // Hand
  const hxArm = leadArm.end.x;
  const hyArm = leadArm.end.y;
  ctx.fillStyle = skin;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.arc(hxArm, hyArm, 4.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Props in Hand
  if (actor.propInHand === 'deed_paper') {
    // Land Deed Document (দলিল)
    ctx.save();
    ctx.translate(hxArm, hyArm);
    ctx.rotate(facing * 0.25);
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.6 * s;
    ctx.fillRect(-6 * s, -12 * s, 18 * s, 26 * s);
    ctx.strokeRect(-6 * s, -12 * s, 18 * s, 26 * s);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(3 * s, -6 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.2 * s;
    for (let l = 1; l <= 4; l++) {
      ctx.beginPath();
      ctx.moveTo(-4 * s, -3 * s + l * 5 * s);
      ctx.lineTo(10 * s, -3 * s + l * 5 * s);
      ctx.stroke();
    }
    ctx.restore();
  } else if (actor.propInHand === 'tasbih') {
    // Muslim Prayer Beads (তসবিহ)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.ellipse(hxArm + 2 * s, hyArm + 12 * s, 6 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let b = 0; b < 10; b++) {
      const ang = (b / 10) * Math.PI * 2;
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(hxArm + 2 * s + Math.cos(ang) * 6 * s, hyArm + 12 * s + Math.sin(ang) * 14 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (actor.propInHand === 'cane' || actor.propInHand === 'staff') {
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(hxArm, hyArm);
    ctx.lineTo(hxArm, y);
    ctx.stroke();
  } else if (actor.propInHand === 'lantern') {
    const swing = Math.sin(timeSec * 3.1) * 6 * s;
    const lx = hxArm + swing;
    const ly = hyArm + 18 * s;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(hxArm, hyArm);
    ctx.lineTo(lx, ly - 7 * s);
    ctx.stroke();
    const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46 * s);
    lg.addColorStop(0, '#fffbeb');
    lg.addColorStop(0.3, 'rgba(251, 191, 36, 0.65)');
    lg.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, 46 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.roundRect(lx - 5.5 * s, ly - 7 * s, 11 * s, 14 * s, 3 * s);
    ctx.fill();
  } else if (actor.propInHand === 'letter') {
    ctx.fillStyle = '#f3e3c2';
    ctx.fillRect(hxArm - 2 * s, hyArm - 6 * s, 16 * s, 11 * s);
  } else if (actor.propInHand === 'red_box') {
    ctx.fillStyle = '#9e2620';
    ctx.fillRect(hxArm - 4 * s, hyArm - 8 * s, 20 * s, 14 * s);
  }

  // Optional Rig X-Ray Overlay
  if (showRig) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.lineTo(hip.x, hip.y);
    ctx.lineTo(leadLeg.joint.x, leadLeg.joint.y);
    ctx.lineTo(leadLeg.end.x, leadLeg.end.y);
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(leadArm.joint.x, leadArm.joint.y);
    ctx.lineTo(leadArm.end.x, leadArm.end.y);
    ctx.stroke();

    for (const pt of [head, shoulder, hip, leadLeg.joint, leadLeg.end, leadArm.joint, leadArm.end]) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e0f2fe';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${actor.name} [${actor.pose}]`, head.x, head.y - 20 * s);
  }

  ctx.restore();
  return { hipYOffset, kneeDeg: leadLeg.kneeAngleDeg };
}

function drawEngineParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  emitters: EngineParticleSpec[],
  timeSec: number
): void {
  const scale = w / 1280;
  for (let ei = 0; ei < emitters.length; ei++) {
    const em = emitters[ei];
    const count = clamp(em.count ?? 28, 4, 140);
    const intensity = clamp(em.intensity ?? 0.85, 0.1, 1);

    for (let i = 0; i < count; i++) {
      const seed = ei * 1000 + i * 17.3;
      const u = hash1D(seed);
      const v = hash1D(seed + 41.9);

      if (em.kind === 'petals' || em.kind === 'envelopes') {
        const px = (((u + timeSec * (0.04 + v * 0.03)) % 1.1) - 0.05) * w;
        const py = (((v + timeSec * (0.03 + u * 0.025)) % 1.05) - 0.02) * h;
        const rot = timeSec * (1.2 + u) + i;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.globalAlpha = 0.78 * intensity;
        if (em.kind === 'petals') {
          ctx.fillStyle = em.color || '#fef7e6';
          ctx.beginPath();
          ctx.ellipse(0, 0, 5.5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = em.color || '#f2e0be';
          ctx.fillRect(-7 * scale, -4.5 * scale, 14 * scale, 9 * scale);
        }
        ctx.restore();
      } else if (em.kind === 'dust_motes' || em.kind === 'fireflies' || em.kind === 'embers') {
        const ox = em.originX !== undefined ? em.originX * w : w * 0.5;
        const oy = em.originY !== undefined ? em.originY * h : h * 0.55;
        const spreadX = em.originX !== undefined ? w * 0.35 : w;
        const spreadY = em.originY !== undefined ? h * 0.42 : h * 0.7;
        const px =
          ox + (u - 0.5) * spreadX + Math.sin(timeSec * (0.8 + v) + i) * 24 * scale;
        const py =
          em.kind === 'embers'
            ? oy - (((timeSec * 0.25 + v) % 1) * spreadY)
            : oy + (v - 0.5) * spreadY + Math.cos(timeSec * (0.9 + u) + i) * 18 * scale;
        const pulse = 0.45 + 0.55 * Math.sin(timeSec * 3.4 + i * 1.9);
        const col =
          em.color ||
          (em.kind === 'embers'
            ? '#fb923c'
            : em.kind === 'fireflies'
            ? '#fde047'
            : '#fff5d6');
        ctx.fillStyle = col;
        ctx.globalAlpha = pulse * intensity * 0.85;
        ctx.beginPath();
        ctx.arc(px, py, (em.kind === 'dust_motes' ? 2.1 : 3.2) * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (em.kind === 'birds') {
        const bx = (((u + timeSec * 0.055) % 1.2) - 0.1) * w;
        const by = (0.14 + v * 0.28) * h + Math.sin(timeSec * 2 + i) * 10 * scale;
        const flap = Math.sin(timeSec * 7.5 + i * 2) * 5 * scale;
        ctx.strokeStyle = em.color || '#1e293b';
        ctx.lineWidth = 1.6 * scale;
        ctx.globalAlpha = 0.75 * intensity;
        ctx.beginPath();
        ctx.moveTo(bx - 8 * scale, by + flap);
        ctx.quadraticCurveTo(bx - 3 * scale, by - 3 * scale, bx, by);
        ctx.quadraticCurveTo(bx + 3 * scale, by - 3 * scale, bx + 8 * scale, by + flap);
        ctx.stroke();
      } else if (em.kind === 'rain' || em.kind === 'snow') {
        const px = (((u - timeSec * 0.08) % 1 + 1) % 1) * w;
        const py = (((v + timeSec * (em.kind === 'rain' ? 0.95 : 0.14)) % 1)) * h;
        ctx.globalAlpha = 0.58 * intensity;
        if (em.kind === 'rain') {
          ctx.strokeStyle = em.color || '#cbd5e1';
          ctx.lineWidth = 1.2 * scale;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - 4 * scale, py + 15 * scale);
          ctx.stroke();
        } else {
          ctx.fillStyle = em.color || '#f8fafc';
          ctx.beginPath();
          ctx.arc(px, py, 2.5 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (em.kind === 'steam') {
        const ox = (em.originX ?? 0.5) * w;
        const oy = (em.originY ?? 0.65) * h;
        const p = ((timeSec * 0.35 + v) % 1);
        ctx.fillStyle = em.color || '#f1f5f9';
        ctx.globalAlpha = (1 - p) * 0.32 * intensity;
        ctx.beginPath();
        ctx.arc(
          ox + (u - 0.5) * 32 * scale + p * 36 * scale,
          oy - p * 95 * scale,
          (8 + p * 22) * scale,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function renderCustomStageScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: SceneSpec,
  sceneProgress: number,
  timeSec: number,
  showRigOverlay: boolean
): CustomStageFrameInfo {
  const stage: CustomStageSpec = scene.stage ?? {
    backdrop: { type: 'outdoor_landscape' },
    actors: [
      {
        id: 'lead',
        name: 'Traveler',
        coatColor: '#2a3c59',
        scarfColor: '#dc2626',
        xStart: 0.25,
        xEnd: 0.68,
        yGround: 0.79,
        pose: 'walk',
        propInHand: 'lantern',
      },
    ],
  };

  // Cinematic camera zoom / pan interpolation
  const cam = stage.camera;
  const camT = easeInOutCubic(sceneProgress);
  const zoom = lerp(cam?.zoomStart ?? 1.0, cam?.zoomEnd ?? 1.04, camT);
  const panX = lerp(cam?.panXStart ?? 0, cam?.panXEnd ?? 0, camT) * width;
  const panY = lerp(cam?.panYStart ?? 0, cam?.panYEnd ?? 0, camT) * height;

  ctx.save();
  ctx.translate(width * 0.5 + panX, height * 0.5 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-width * 0.5, -height * 0.5);

  const { skyLabel } = drawBackdrop(ctx, width, height, stage, scene, timeSec);

  // Draw background/midground props sorted by vertical depth
  const props = [...(stage.props ?? [])].sort((a, b) => a.y - b.y);
  for (const prop of props) {
    drawProceduralProp(ctx, width, height, prop, sceneProgress, timeSec);
  }

  // Draw articulated 2-bone IK actors
  let leadHipYOffset = 0;
  let leadKneeDeg = 165;
  const actors = stage.actors ?? [];
  actors.forEach((actor, idx) => {
    const res = drawEngineActor(
      ctx,
      width,
      height,
      actor,
      sceneProgress,
      timeSec,
      showRigOverlay
    );
    if (idx === 0) {
      leadHipYOffset = res.hipYOffset;
      leadKneeDeg = res.kneeDeg;
    }
  });

  // Draw declarative particle emitters
  if (stage.particles && stage.particles.length > 0) {
    drawEngineParticles(ctx, width, height, stage.particles, timeSec);
  }

  ctx.restore();

  // Cinematic Bengali Story Title Overlay Banner (Matching Viral 2D Story Thumbnails)
  const scale = width / 1280;
  const banner = stage.thumbnailBanner || (scene.title ? { title: scene.title, subtitle: scene.narration, tag: 'পুরা গল্প' } : null);
  if (banner && banner.title) {
    ctx.save();
    const bx = 42 * scale;
    const by = 38 * scale;

    // Red Pill Badge ("পুরা গল্প" / "পুরা ঘটনা • ৩ পর্ব")
    const badgeText = banner.tag || 'পুরা গল্প';
    const badgeW = Math.max(76 * scale, (badgeText.length * 11 + 20) * scale);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(bx, by + 48 * scale, badgeW, 24 * scale, 4 * scale);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(13 * scale)}px "Noto Sans Bengali", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, bx + badgeW * 0.5, by + 65 * scale);

    // Giant Bold Yellow Title (e.g. "এক হাত জমি", "বড় পোলা")
    ctx.font = `900 ${Math.round(40 * scale)}px "Noto Sans Bengali", sans-serif`;
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7 * scale;
    ctx.lineJoin = 'round';
    ctx.strokeText(banner.title, bx, by + 36 * scale);
    ctx.fillStyle = '#facc15';
    ctx.fillText(banner.title, bx, by + 36 * scale);

    // White Subtitle Narrative Quote
    if (banner.subtitle) {
      ctx.font = `700 ${Math.round(18 * scale)}px "Noto Sans Bengali", sans-serif`;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4.5 * scale;
      ctx.lineJoin = 'round';
      ctx.strokeText(banner.subtitle, bx, by + 98 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(banner.subtitle, bx, by + 98 * scale);
    }

    // Cinematic Soft Vignette
    const vig = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.32, width * 0.5, height * 0.5, width * 0.74);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  return {
    hipYOffset: leadHipYOffset,
    leadKneeAngleDeg: leadKneeDeg,
    scarfTension: 0.28,
    lanternSwingDeg: Math.sin(timeSec * 3.1) * 9,
    skyPhaseLabel: skyLabel,
  };
}
