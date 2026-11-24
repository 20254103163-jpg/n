import { clamp, easeInOutCubic, hash1D, lerp, shadeHex, smoothstep, solveTwoBoneIK } from './math';
import { CharacterConfig, Vec2 } from './types';

export interface StorySceneRenderInfo {
  leadKneeAngleDeg: number;
  hipYOffset: number;
  scarfTension: number;
  lanternSwingDeg: number;
  skyPhaseLabel: string;
}

function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  alpha = 1,
  stampLabel?: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = clamp(alpha, 0, 1);

  // Aged yellowed 1968 paper body
  ctx.fillStyle = '#f3e3b8';
  ctx.strokeStyle = '#9c7c4a';
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.beginPath();
  ctx.roundRect(-w * 0.5, -h * 0.5, w, h, Math.max(1.5, w * 0.06));
  ctx.fill();
  ctx.stroke();

  // Envelope V-flap
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h * 0.46);
  ctx.lineTo(0, h * 0.08);
  ctx.lineTo(w * 0.48, -h * 0.46);
  ctx.stroke();

  // Small crimson wax seal dot
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(0, h * 0.06, Math.max(1.8, w * 0.085), 0, Math.PI * 2);
  ctx.fill();

  if (stampLabel && w > 54) {
    ctx.fillStyle = '#6b4f2a';
    ctx.font = `500 ${Math.round(w * 0.11)}px "Noto Sans Bengali", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(stampLabel, 0, h * 0.34);
  }
  ctx.restore();
}

function drawGandharajPetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  alpha: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  // Warm dried cream-ivory gardenia/gandharaj petal
  const grad = ctx.createRadialGradient(-size * 0.2, 0, size * 0.1, 0, 0, size);
  grad.addColorStop(0, '#fffef7');
  grad.addColorStop(0.65, '#f6ecd1');
  grad.addColorStop(1, '#dfd0a8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.15, size * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRedTinBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  lidOpenProgress: number
): void {
  const bw = 54 * scale;
  const bh = 28 * scale;

  ctx.save();
  ctx.translate(x, y);

  // Subtle shadow underneath box
  ctx.fillStyle = 'rgba(10, 6, 4, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, bh * 0.52, bw * 0.58, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inside dark shadow + peek of envelopes when lid opens
  if (lidOpenProgress > 0.05) {
    ctx.fillStyle = '#3b1010';
    ctx.fillRect(-bw * 0.47, -bh * 0.5, bw * 0.94, bh * 0.28);
    drawEnvelope(ctx, -6 * scale, -bh * 0.44 - lidOpenProgress * 3 * scale, 22 * scale, 13 * scale, -0.14, 0.95);
    drawEnvelope(ctx, 8 * scale, -bh * 0.46 - lidOpenProgress * 4 * scale, 22 * scale, 13 * scale, 0.1, 0.95);
  }

  // Rusted vintage red tin front face
  const boxGrad = ctx.createLinearGradient(-bw * 0.5, -bh * 0.5, bw * 0.5, bh * 0.5);
  boxGrad.addColorStop(0, '#b91c1c');
  boxGrad.addColorStop(0.55, '#991b1b');
  boxGrad.addColorStop(1, '#6b1414');
  ctx.fillStyle = boxGrad;
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 3 * scale);
  ctx.fill();

  // Subtle weathered rust patina patches & brass clasp
  ctx.fillStyle = 'rgba(120, 53, 15, 0.42)';
  ctx.fillRect(-bw * 0.46, bh * 0.12, bw * 0.24, bh * 0.3);
  ctx.fillRect(bw * 0.24, -bh * 0.32, bw * 0.18, bh * 0.28);

  ctx.fillStyle = '#d97706';
  ctx.fillRect(-5 * scale, -bh * 0.46, 10 * scale, 7 * scale);

  // Hinged lid opening smoothly from back-left corner
  ctx.save();
  ctx.translate(-bw * 0.5, -bh * 0.48);
  ctx.rotate(-lidOpenProgress * 1.95);
  ctx.fillStyle = '#c81e1e';
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.roundRect(0, -6 * scale, bw, 7.5 * scale, 2.5 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawStylizedPerson(params: {
  ctx: CanvasRenderingContext2D;
  hip: Vec2;
  shoulder: Vec2;
  head: Vec2;
  footL: Vec2;
  footR: Vec2;
  handBack: Vec2;
  handFront: Vec2;
  facing: 1 | -1;
  scale: number;
  shirtColor: string;
  trouserColor: string;
  hairColor: string;
  skinColor: string;
  isElder?: boolean;
  smileAmount?: number;
  eyesClosed?: boolean;
  timeSec: number;
  shawlColor?: string;
  showRig?: boolean;
}): number {
  const {
    ctx,
    hip,
    shoulder,
    head,
    footL,
    footR,
    handBack,
    handFront,
    facing,
    scale: s,
    shirtColor,
    trouserColor,
    hairColor,
    skinColor,
    isElder = false,
    smileAmount = 0,
    eyesClosed = false,
    timeSec,
    shawlColor,
    showRig = false,
  } = params;

  const thigh = 28 * s;
  const shin = 28 * s;
  const uArm = 21 * s;
  const fArm = 20 * s;

  const kneeBend: 1 | -1 = facing === 1 ? -1 : 1;
  const elbowBend: 1 | -1 = facing === 1 ? 1 : -1;

  const legB = solveTwoBoneIK(hip, footL, thigh, shin, kneeBend);
  const legF = solveTwoBoneIK(hip, footR, thigh, shin, kneeBend);
  const armB = solveTwoBoneIK(shoulder, handBack, uArm, fArm, elbowBend);
  const armF = solveTwoBoneIK(shoulder, handFront, uArm, fArm, elbowBend);

  const limb = (a: Vec2, b: Vec2, c: Vec2, width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  };

  // Back arm & back leg
  limb(shoulder, armB.joint, armB.end, 7.2 * s, shadeHex(shirtColor, 0.72));
  limb(hip, legB.joint, legB.end, 9 * s, shadeHex(trouserColor, 0.72));

  // Front leg
  limb(hip, legF.joint, legF.end, 9.4 * s, trouserColor);

  // Torso (panjabi / kurta / shirt silhouette)
  const torsoGrad = ctx.createLinearGradient(shoulder.x - 14 * s, shoulder.y, shoulder.x + 14 * s, hip.y + 18 * s);
  torsoGrad.addColorStop(0, shirtColor);
  torsoGrad.addColorStop(1, shadeHex(shirtColor, 0.76));
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - facing * 10 * s, shoulder.y - 3 * s);
  ctx.lineTo(shoulder.x + facing * 11 * s, shoulder.y - 2 * s);
  ctx.quadraticCurveTo(hip.x + facing * 14 * s, hip.y + 6 * s, hip.x + facing * 15 * s, hip.y + 18 * s);
  ctx.quadraticCurveTo(hip.x, hip.y + 21 * s, hip.x - facing * 15 * s, hip.y + 17 * s);
  ctx.closePath();
  ctx.fill();

  // Draped shawl for grandfather (gently fluttering in breeze)
  if (shawlColor) {
    const wave = Math.sin(timeSec * 3.8) * 6 * s;
    ctx.fillStyle = shawlColor;
    ctx.beginPath();
    ctx.moveTo(shoulder.x - facing * 11 * s, shoulder.y - 2 * s);
    ctx.quadraticCurveTo(shoulder.x + facing * 8 * s, shoulder.y + 8 * s, hip.x + facing * 6 * s, hip.y + 10 * s);
    ctx.quadraticCurveTo(hip.x - facing * 14 * s, hip.y + 14 * s + wave * 0.4, shoulder.x - facing * 22 * s, hip.y + 6 * s + wave);
    ctx.closePath();
    ctx.fill();
  }

  // Head & expressive facial features
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.scale(facing, 1);

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, 0, 10.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.arc(-1.5 * s, -2.5 * s, 10.8 * s, Math.PI * 0.75, Math.PI * 2.05);
  ctx.quadraticCurveTo(10.5 * s, -5 * s, 7.5 * s, -1.5 * s);
  ctx.quadraticCurveTo(1 * s, -5 * s, -3 * s, 3 * s);
  ctx.quadraticCurveTo(-11.5 * s, 5 * s, -11 * s, -1.5 * s);
  ctx.closePath();
  ctx.fill();

  // Eye (blinking or peacefully closed)
  const blink = !eyesClosed && timeSec % 4.4 > 4.24;
  ctx.strokeStyle = '#1c1917';
  ctx.fillStyle = '#1c1917';
  ctx.lineWidth = 1.4 * s;
  if (eyesClosed || blink) {
    ctx.beginPath();
    ctx.arc(5 * s, -0.5 * s, 2.2 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(5.2 * s, -1 * s, 1.3 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Elder glasses + soft white mustache
  if (isElder) {
    ctx.strokeStyle = '#d4a359';
    ctx.lineWidth = 1.15 * s;
    ctx.beginPath();
    ctx.arc(5.4 * s, -0.8 * s, 3.6 * s, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.ellipse(6.2 * s, 3.4 * s, 3.4 * s, 1.3 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle serene smile
  if (smileAmount > 0.05) {
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.arc(5.5 * s, 4.2 * s, 2.8 * s, 0.15, Math.PI * 0.72 * smileAmount + 0.35);
    ctx.stroke();
  }
  ctx.restore();

  // Front arm & hand
  limb(shoulder, armF.joint, armF.end, 7.6 * s, shirtColor);
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(armF.end.x, armF.end.y, 3.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Optional live 2-bone IK rig overlay
  if (showRig) {
    ctx.save();
    const rigLine = (a: Vec2, b: Vec2, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const rigDot = (p: Vec2, color: string) => {
      ctx.fillStyle = '#0b0d11';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    rigLine(hip, shoulder, '#38bdf8');
    rigLine(shoulder, head, '#38bdf8');
    rigLine(hip, legF.joint, '#38bdf8');
    rigLine(legF.joint, legF.end, '#38bdf8');
    rigLine(shoulder, armF.joint, '#f59e0b');
    rigLine(armF.joint, armF.end, '#f59e0b');
    rigDot(hip, '#38bdf8');
    rigDot(shoulder, '#38bdf8');
    rigDot(legF.joint, '#38bdf8');
    rigDot(legF.end, '#34d399');
    rigDot(armF.joint, '#f59e0b');
    rigDot(armF.end, '#f59e0b');
    ctx.restore();
  }

  return legF.kneeAngleDeg;
}

// =========================================================================
// SCENE 1: চিলেকোঠার আবিষ্কার (ATTIC DISCOVERY — MORNING SUNBEAM & RED BOX)
// =========================================================================
export function renderAtticDiscoveryScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneProgress: number,
  timeSec: number,
  character: CharacterConfig,
  showRig: boolean
): StorySceneRenderInfo {
  const s = Math.min(w / 1280, h / 720);

  // 1. Deep warm wooden attic room backdrop
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1e1612');
  bg.addColorStop(0.55, '#2b1e16');
  bg.addColorStop(1, '#160f0b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Slanted timber rafters overhead
  ctx.strokeStyle = '#120b08';
  ctx.lineWidth = 18 * s;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.22);
  ctx.lineTo(w * 0.52, -10);
  ctx.lineTo(w, h * 0.28);
  ctx.stroke();

  // Vintage wooden plank floor
  const floorY = h * 0.79;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
  floorGrad.addColorStop(0, '#362318');
  floorGrad.addColorStop(1, '#1b110b');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5 * s;
  for (let i = 1; i <= 5; i++) {
    const py = floorY + (i / 5) * (h - floorY);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  }

  // Dusty wooden bookshelf & stacked vintage books on right wall
  ctx.fillStyle = '#241610';
  ctx.fillRect(w * 0.72, h * 0.34, w * 0.22, floorY - h * 0.34);
  for (let row = 0; row < 3; row++) {
    const sy = h * (0.45 + row * 0.11);
    ctx.fillStyle = '#3c261a';
    ctx.fillRect(w * 0.72, sy, w * 0.22, 6 * s);
    // Books on shelf
    for (let b = 0; b < 9; b++) {
      const bx = w * 0.735 + b * 24 * s;
      const bh = (26 + hash1D(row * 13 + b * 7) * 18) * s;
      const colors = ['#7c2d12', '#1e3a5f', '#3f4f3c', '#581c3a', '#785028'];
      ctx.fillStyle = colors[(row * 3 + b) % colors.length];
      ctx.fillRect(bx, sy - bh, 16 * s, bh);
    }
  }

  // Round attic ventilator window (ঘুলঘুলি) on top-left pouring golden morning sun
  const winX = w * 0.16;
  const winY = h * 0.21;
  const winR = 46 * s;
  const winGlow = ctx.createRadialGradient(winX, winY, 6 * s, winX, winY, winR * 2.8);
  winGlow.addColorStop(0, '#fffbeb');
  winGlow.addColorStop(0.35, 'rgba(254, 215, 130, 0.7)');
  winGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = winGlow;
  ctx.beginPath();
  ctx.arc(winX, winY, winR * 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(winX, winY, winR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#241711';
  ctx.lineWidth = 6 * s;
  ctx.stroke();
  // Ventilator bars
  ctx.lineWidth = 3.5 * s;
  ctx.beginPath();
  ctx.moveTo(winX - winR, winY);
  ctx.lineTo(winX + winR, winY);
  ctx.moveTo(winX, winY - winR);
  ctx.lineTo(winX, winY + winR);
  ctx.stroke();

  // Giant Mahogany Wooden Trunk (মেহগনি কাঠের সিন্দুক) at center
  const trunkX = w * 0.45;
  const trunkY = floorY;
  const trunkW = 240 * s;
  const trunkH = 112 * s;

  // Open trunk lid angled back
  ctx.fillStyle = '#3b1e12';
  ctx.beginPath();
  ctx.moveTo(trunkX - trunkW * 0.5, trunkY - trunkH);
  ctx.lineTo(trunkX - trunkW * 0.44, trunkY - trunkH - 54 * s);
  ctx.lineTo(trunkX + trunkW * 0.46, trunkY - trunkH - 54 * s);
  ctx.lineTo(trunkX + trunkW * 0.5, trunkY - trunkH);
  ctx.closePath();
  ctx.fill();

  // Trunk front mahogany body
  const mahogGrad = ctx.createLinearGradient(trunkX - trunkW * 0.5, trunkY - trunkH, trunkX + trunkW * 0.5, trunkY);
  mahogGrad.addColorStop(0, '#692d1b');
  mahogGrad.addColorStop(0.5, '#4e2013');
  mahogGrad.addColorStop(1, '#33140b');
  ctx.fillStyle = mahogGrad;
  ctx.beginPath();
  ctx.roundRect(trunkX - trunkW * 0.5, trunkY - trunkH, trunkW, trunkH, 6 * s);
  ctx.fill();

  // Brass iron straps & keyhole lock on mahogany trunk
  ctx.fillStyle = '#a16207';
  ctx.fillRect(trunkX - trunkW * 0.34, trunkY - trunkH, 12 * s, trunkH);
  ctx.fillRect(trunkX + trunkW * 0.28, trunkY - trunkH, 12 * s, trunkH);
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.roundRect(trunkX - 14 * s, trunkY - trunkH + 14 * s, 28 * s, 24 * s, 4 * s);
  ctx.fill();

  // Scattered old books beside the trunk on floor
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(trunkX + trunkW * 0.55, floorY - 14 * s, 44 * s, 14 * s);
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(trunkX + trunkW * 0.58, floorY - 27 * s, 38 * s, 13 * s);

  // Arka kneeling/leaning over the trunk, lifting & opening the red tin box!
  const liftT = smoothstep(0.08, 0.34, sceneProgress);
  const openT = easeInOutCubic(smoothstep(0.32, 0.56, sceneProgress));

  const arkaHip: Vec2 = { x: trunkX - 165 * s, y: floorY - 58 * s + Math.sin(timeSec * 2) * 1.2 * s };
  const lean = lerp(0.32, 0.16, liftT);
  const arkaShoulder: Vec2 = {
    x: arkaHip.x + Math.sin(lean) * 44 * s,
    y: arkaHip.y - Math.cos(lean) * 44 * s,
  };
  const arkaHead: Vec2 = { x: arkaShoulder.x + 12 * s, y: arkaShoulder.y - 19 * s };
  const boxCenter: Vec2 = {
    x: lerp(trunkX - 36 * s, trunkX - 68 * s, liftT),
    y: lerp(trunkY - trunkH + 8 * s, trunkY - trunkH - 18 * s, liftT),
  };

  const kneeDeg = drawStylizedPerson({
    ctx,
    hip: arkaHip,
    shoulder: arkaShoulder,
    head: arkaHead,
    footL: { x: arkaHip.x - 24 * s, y: floorY },
    footR: { x: arkaHip.x + 22 * s, y: floorY },
    handBack: { x: boxCenter.x - 18 * s, y: boxCenter.y + 4 * s },
    handFront: { x: boxCenter.x + 12 * s, y: boxCenter.y - openT * 10 * s },
    facing: 1,
    scale: s * 1.15,
    shirtColor: character.coatColor,
    trouserColor: '#1f2937',
    hairColor: character.hairColor,
    skinColor: '#e9c4a6',
    smileAmount: openT * 0.7,
    timeSec,
    showRig,
  });

  // The rusted Red Tin Box!
  drawRedTinBox(ctx, boxCenter.x, boxCenter.y, s * 1.25, openT);

  // Burst of dried white Gandharaj petals & aged 1968 envelopes swirling out when box opens!
  if (openT > 0.08) {
    const burst = smoothstep(0.34, 0.92, sceneProgress);
    for (let i = 0; i < 18; i++) {
      const seed = i * 17.3;
      const spreadX = (hash1D(seed) - 0.35) * 260 * s * burst;
      const riseY = -(25 + hash1D(seed + 4.1) * 185) * s * burst;
      const sway = Math.sin(timeSec * 2.6 + i) * 16 * s * burst;
      drawGandharajPetal(
        ctx,
        boxCenter.x + spreadX + sway,
        boxCenter.y + riseY,
        (5.5 + hash1D(seed + 9.2) * 5) * s,
        timeSec * 1.6 + seed,
        Math.min(1, openT * 1.4) * (1 - burst * 0.25)
      );
    }

    // Hero glowing 1968 envelope floating gently into the morning sunbeam
    const envAlpha = smoothstep(0.45, 0.65, sceneProgress);
    if (envAlpha > 0.02) {
      const ex = boxCenter.x + 135 * s + Math.sin(timeSec * 1.5) * 8 * s;
      const ey = boxCenter.y - 105 * s + Math.cos(timeSec * 1.9) * 6 * s;
      drawEnvelope(ctx, ex, ey, 118 * s, 72 * s, -0.07 + Math.sin(timeSec) * 0.03, envAlpha, 'শুভ্রা · ১৯৬৮');
    }
  }

  // Diagonal Volumetric Morning Sunbeam streaming from ventilator across the trunk & box
  const beamGrad = ctx.createLinearGradient(winX, winY, trunkX + 120 * s, floorY);
  beamGrad.addColorStop(0, 'rgba(254, 240, 185, 0.36)');
  beamGrad.addColorStop(0.55, 'rgba(253, 224, 130, 0.16)');
  beamGrad.addColorStop(1, 'rgba(253, 224, 130, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(winX - 36 * s, winY + 22 * s);
  ctx.lineTo(winX + 38 * s, winY - 24 * s);
  ctx.lineTo(trunkX + 260 * s, floorY + 20 * s);
  ctx.lineTo(trunkX - 140 * s, floorY + 20 * s);
  ctx.closePath();
  ctx.fill();

  // Floating golden dust motes inside the sunbeam
  for (let i = 0; i < 34; i++) {
    const u = hash1D(i * 23.7);
    const v = hash1D(i * 41.3);
    const dx = lerp(winX, trunkX + 140 * s, u) + Math.sin(timeSec * 0.9 + i) * 18 * s;
    const dy = lerp(winY, floorY - 10 * s, u) + (v - 0.5) * 130 * s * u + Math.cos(timeSec * 0.7 + i) * 10 * s;
    const pulse = 0.4 + 0.6 * Math.sin(timeSec * 2.2 + i);
    ctx.fillStyle = `rgba(254, 243, 199, ${(0.55 * pulse).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(dx, dy, (1.4 + (i % 3) * 0.7) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    leadKneeAngleDeg: kneeDeg,
    hipYOffset: Math.sin(timeSec * 2) * 1.2,
    scarfTension: 0.04,
    lanternSwingDeg: 0,
    skyPhaseLabel: 'সকালের রোদ (Morning Attic)',
  };
}

// =========================================================================
// SCENE 2: অনুচ্চারিত অতীত (SUNLIT AFTERNOON VERANDA — GRANDFATHER & ARKA)
// =========================================================================
export function renderVerandaPastScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneProgress: number,
  timeSec: number,
  character: CharacterConfig,
  showRig: boolean
): StorySceneRenderInfo {
  const s = Math.min(w / 1280, h / 720);

  // 1. Bright warm afternoon sky & lush garden visible beyond veranda railing
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  skyGrad.addColorStop(0, '#5a94c8');
  skyGrad.addColorStop(0.55, '#a8cde0');
  skyGrad.addColorStop(1, '#f7e6c4');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h * 0.72);

  // Soft garden trees outside veranda
  ctx.fillStyle = '#3b6647';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc((0.12 + i * 0.12) * w, h * (0.48 + (i % 2) * 0.04), (68 + (i % 3) * 18) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Veranda wall & overhead warm cream archway
  const floorY = h * 0.80;
  ctx.fillStyle = '#2e241d';
  ctx.fillRect(0, 0, w * 0.09, h);
  ctx.fillRect(w * 0.91, 0, w * 0.09, h);
  ctx.fillRect(0, 0, w, h * 0.11);

  // Traditional Bengal veranda wooden balustrade railing
  const railTop = h * 0.55;
  ctx.fillStyle = '#4a3121';
  ctx.fillRect(w * 0.08, railTop, w * 0.84, 10 * s);
  ctx.fillRect(w * 0.08, floorY - 12 * s, w * 0.84, 12 * s);
  for (let x = w * 0.11; x < w * 0.90; x += 28 * s) {
    ctx.fillRect(x, railTop, 6 * s, floorY - railTop);
  }

  // Terracotta veranda tiled floor with slanted afternoon sun stripes
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
  floorGrad.addColorStop(0, '#7c3f2c');
  floorGrad.addColorStop(1, '#432016');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, w, h - floorY);

  // Warm afternoon sunlight stripes slanting across the floor
  ctx.fillStyle = 'rgba(254, 235, 180, 0.18)';
  for (let i = 0; i < 6; i++) {
    const sx = w * (0.14 + i * 0.13);
    ctx.beginPath();
    ctx.moveTo(sx, railTop);
    ctx.lineTo(sx + 56 * s, railTop);
    ctx.lineTo(sx + 135 * s, h);
    ctx.lineTo(sx + 65 * s, h);
    ctx.closePath();
    ctx.fill();
  }

  // Gently swaying sheer cream veranda curtain on left
  const sway = Math.sin(timeSec * 1.8) * 18 * s;
  ctx.fillStyle = 'rgba(254, 249, 235, 0.72)';
  ctx.beginPath();
  ctx.moveTo(w * 0.09, h * 0.10);
  ctx.lineTo(w * 0.21, h * 0.10);
  ctx.quadraticCurveTo(w * 0.18 + sway, h * 0.46, w * 0.22 + sway * 1.3, floorY - 18 * s);
  ctx.lineTo(w * 0.09, floorY - 10 * s);
  ctx.closePath();
  ctx.fill();

  // Wooden Easy-Chair (ইজিচেয়ার) on right side
  const chairX = w * 0.68;
  const chairY = floorY;
  const rock = Math.sin(timeSec * 1.1) * 0.015;
  ctx.save();
  ctx.translate(chairX, chairY);
  ctx.rotate(rock);
  ctx.strokeStyle = '#5c341d';
  ctx.lineWidth = 8 * s;
  ctx.lineCap = 'round';
  // Reclined back frame + armrest + leg rest
  ctx.beginPath();
  ctx.moveTo(54 * s, -124 * s);
  ctx.lineTo(8 * s, -48 * s);
  ctx.lineTo(-68 * s, -32 * s);
  ctx.moveTo(38 * s, -90 * s);
  ctx.lineTo(-42 * s, -72 * s);
  ctx.moveTo(30 * s, -54 * s);
  ctx.lineTo(44 * s, 0);
  ctx.moveTo(-36 * s, -44 * s);
  ctx.lineTo(-52 * s, 0);
  ctx.stroke();
  ctx.restore();

  // Wooden Tea-Table (টি-টেবিল) at center-left
  const tableX = w * 0.49;
  const tableY = floorY - 56 * s;
  ctx.fillStyle = '#5a331c';
  ctx.beginPath();
  ctx.roundRect(tableX - 48 * s, tableY, 96 * s, 10 * s, 3 * s);
  ctx.fill();
  ctx.fillRect(tableX - 38 * s, tableY + 10 * s, 8 * s, 46 * s);
  ctx.fillRect(tableX + 30 * s, tableY + 10 * s, 8 * s, 46 * s);

  // Choreography:
  // 0.0..0.32 Arka walks gently up to tea-table and places the Red Tin Box
  // 0.32..1.0 Grandfather opens his eyes and lifts a yellowed letter with trembling fingers
  const walkT = smoothstep(0, 0.32, sceneProgress);
  const boxPlaced = sceneProgress >= 0.28;
  const grandpaReach = easeInOutCubic(smoothstep(0.36, 0.62, sceneProgress));
  const eyesClosed = sceneProgress < 0.33;

  // Draw Grandfather seated in Easy-Chair (facing left toward table & Arka)
  const gHip: Vec2 = { x: chairX + 8 * s, y: floorY - 54 * s };
  const gShoulder: Vec2 = { x: chairX + 26 * s, y: floorY - 98 * s };
  const gHead: Vec2 = { x: chairX + 22 * s, y: floorY - 122 * s };
  const tremorX = grandpaReach > 0.4 ? Math.sin(timeSec * 22) * 1.4 * s : 0;
  const tremorY = grandpaReach > 0.4 ? Math.cos(timeSec * 19) * 1.1 * s : 0;
  const gHandFront: Vec2 = {
    x: lerp(chairX - 18 * s, tableX + 36 * s, grandpaReach) + tremorX,
    y: lerp(floorY - 72 * s, tableY - 26 * s, grandpaReach) + tremorY,
  };

  drawStylizedPerson({
    ctx,
    hip: gHip,
    shoulder: gShoulder,
    head: gHead,
    footL: { x: chairX - 60 * s, y: floorY - 14 * s },
    footR: { x: chairX - 48 * s, y: floorY - 6 * s },
    handBack: { x: chairX - 24 * s, y: floorY - 68 * s },
    handFront: gHandFront,
    facing: -1,
    scale: s * 1.18,
    shirtColor: '#f3ede0',
    trouserColor: '#d6cfc2',
    hairColor: '#e2e8f0',
    skinColor: '#dfb796',
    isElder: true,
    eyesClosed,
    shawlColor: '#92400e',
    timeSec,
    showRig,
  });

  // Draw Arka walking quietly beside the tea-table
  const arkaX = lerp(w * 0.24, w * 0.37, walkT);
  const stride = Math.sin(walkT * Math.PI * 3) * (1 - smoothstep(0.26, 0.33, sceneProgress));
  const arkaHip: Vec2 = { x: arkaX, y: floorY - 58 * s - Math.abs(stride) * 3 * s };
  const arkaShoulder: Vec2 = { x: arkaX + 4 * s, y: arkaHip.y - 42 * s };
  const arkaHead: Vec2 = { x: arkaShoulder.x + 5 * s, y: arkaShoulder.y - 20 * s };
  const arkaFrontHand: Vec2 = {
    x: lerp(arkaX + 26 * s, tableX - 16 * s, smoothstep(0.18, 0.32, sceneProgress)),
    y: lerp(arkaShoulder.y + 18 * s, tableY - 8 * s, smoothstep(0.18, 0.32, sceneProgress)),
  };

  const kneeDeg = drawStylizedPerson({
    ctx,
    hip: arkaHip,
    shoulder: arkaShoulder,
    head: arkaHead,
    footL: { x: arkaX - stride * 20 * s - 5 * s, y: floorY },
    footR: { x: arkaX + stride * 20 * s + 5 * s, y: floorY },
    handBack: { x: arkaX - 10 * s, y: arkaShoulder.y + 26 * s },
    handFront: arkaFrontHand,
    facing: 1,
    scale: s * 1.12,
    shirtColor: character.coatColor,
    trouserColor: '#1f2937',
    hairColor: character.hairColor,
    skinColor: '#e9c4a6',
    timeSec,
    showRig,
  });

  // Red tin box either in Arka's hand or resting open on tea-table
  const boxX = boxPlaced ? tableX : arkaFrontHand.x + 12 * s;
  const boxY = boxPlaced ? tableY - 12 * s : arkaFrontHand.y;
  drawRedTinBox(ctx, boxX, boxY, s * 1.0, boxPlaced ? smoothstep(0.32, 0.48, sceneProgress) : 0);

  // Trembling yellowed 1968 letter lifted by Grandfather
  if (grandpaReach > 0.35) {
    drawEnvelope(
      ctx,
      gHandFront.x - 10 * s,
      gHandFront.y - 4 * s,
      34 * s,
      21 * s,
      -0.25 + Math.sin(timeSec * 16) * 0.04,
      smoothstep(0.35, 0.5, grandpaReach)
    );
  }

  return {
    leadKneeAngleDeg: kneeDeg,
    hipYOffset: Math.abs(stride) * -3,
    scarfTension: 0.08,
    lanternSwingDeg: 0,
    skyPhaseLabel: 'দুপুরের বারান্দা (Afternoon Veranda)',
  };
}

// =========================================================================
// SCENE 3: খামের ভেতরের কথা (1968 SHANTIPUR BANYAN GHAT & VINTAGE TRAIN)
// =========================================================================
export function renderShantipurMemoryScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneProgress: number,
  timeSec: number,
  showRig: boolean
): StorySceneRenderInfo {
  const s = Math.min(w / 1280, h / 720);
  const horizonY = h * 0.58;

  // 1. Nostalgic warm golden-sepia 1968 sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#5c4738');
  sky.addColorStop(0.5, '#b68356');
  sky.addColorStop(1, '#f3d19c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 2);

  // Soft nostalgic sun disc over Shantipur river
  const sunX = w * 0.72;
  const sunY = horizonY * 0.64;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8 * s, sunX, sunY, 210 * s);
  sunGlow.addColorStop(0, 'rgba(255, 246, 214, 0.85)');
  sunGlow.addColorStop(0.35, 'rgba(244, 185, 110, 0.35)');
  sunGlow.addColorStop(1, 'rgba(244, 185, 110, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 210 * s, 0, Math.PI * 2);
  ctx.fill();

  // Calm Shantipur River reflecting golden sepia sun
  const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  waterGrad.addColorStop(0, '#c89b6e');
  waterGrad.addColorStop(0.5, '#6b4e38');
  waterGrad.addColorStop(1, '#312319');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Shimmering river reflections
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const ry = horizonY + Math.pow(t, 1.3) * (h - horizonY) * 0.6;
    const wobble = Math.sin(timeSec * 2.8 + i * 1.2) * 18 * s;
    ctx.fillStyle = `rgba(255, 236, 190, ${(0.34 * (1 - t)).toFixed(2)})`;
    ctx.fillRect(sunX - (48 + t * 55) * s + wobble, ry, (96 + t * 110) * s, 2.2 * s);
  }

  // Far railway embankment & Vintage 1968 Steam Train gliding to a halt under the banyan shade!
  const trackY = horizonY + 6 * s;
  ctx.fillStyle = '#3c2a1e';
  ctx.fillRect(0, trackY, w, 12 * s);

  // Train slows gracefully into Shantipur station
  const trainEase = 1 - Math.pow(1 - clamp(sceneProgress * 1.15, 0, 1), 2.2);
  const trainX = lerp(w * 0.98, w * 0.38, trainEase);
  const carW = 78 * s;
  const carH = 26 * s;

  // Vintage steam locomotive + 3 heritage carriages
  // Drifting steam puffs from locomotive funnel
  for (let i = 0; i < 8; i++) {
    const p = (timeSec * 0.5 + i / 8) % 1;
    const px = trainX + 18 * s + p * 75 * s;
    const py = trackY - carH - 12 * s - p * 68 * s;
    ctx.fillStyle = `rgba(250, 240, 220, ${((1 - p) * 0.42).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(px, py, (7 + p * 22) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Locomotive engine
  ctx.fillStyle = '#241812';
  ctx.beginPath();
  ctx.roundRect(trainX, trackY - carH, 54 * s, carH, 4 * s);
  ctx.fill();
  ctx.fillRect(trainX + 12 * s, trackY - carH - 13 * s, 10 * s, 14 * s); // funnel
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(trainX + 2 * s, trackY - carH * 0.45, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();

  for (let c = 0; c < 3; c++) {
    const cx = trainX + 58 * s + c * (carW + 5 * s);
    ctx.fillStyle = '#3b2117';
    ctx.beginPath();
    ctx.roundRect(cx, trackY - carH, carW, carH, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#fcd99a';
    for (let wi = 0; wi < 5; wi++) {
      ctx.fillRect(cx + (8 + wi * 13.5) * s, trackY - carH + 6 * s, 9 * s, 9 * s);
    }
  }

  // Foreground Shantipur Stone Ghat Embankment
  const groundY = h * 0.77;
  ctx.fillStyle = '#2d1e15';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, groundY - 12 * s);
  ctx.quadraticCurveTo(w * 0.42, groundY - 4 * s, w * 0.78, groundY + 18 * s);
  ctx.lineTo(w, groundY + 26 * s);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Monumental Ancient Banyan Tree (শান্তিপুরের বটগাছ) on left with swaying aerial roots!
  const treeX = w * 0.17;
  ctx.fillStyle = '#21150e';
  ctx.beginPath();
  ctx.moveTo(treeX - 36 * s, groundY + 10 * s);
  ctx.quadraticCurveTo(treeX - 18 * s, h * 0.56, treeX - 24 * s, h * 0.40);
  ctx.lineTo(treeX + 26 * s, h * 0.40);
  ctx.quadraticCurveTo(treeX + 18 * s, h * 0.56, treeX + 42 * s, groundY + 10 * s);
  ctx.closePath();
  ctx.fill();

  // Lush sweeping banyan canopy
  const canopyGrad = ctx.createRadialGradient(treeX + 40 * s, h * 0.34, 20 * s, treeX + 20 * s, h * 0.34, 230 * s);
  canopyGrad.addColorStop(0, '#3a4228');
  canopyGrad.addColorStop(1, '#1d2215');
  ctx.fillStyle = canopyGrad;
  for (const [dx, dy, rx, ry] of [
    [-40, -10, 120, 74],
    [60, -28, 145, 82],
    [155, 8, 108, 62],
    [-85, 22, 92, 54],
  ]) {
    ctx.beginPath();
    ctx.ellipse(treeX + dx * s, h * 0.36 + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hanging banyan aerial roots swaying gently in the river breeze
  ctx.strokeStyle = '#2c1e15';
  ctx.lineWidth = 2.4 * s;
  for (let r = 0; r < 11; r++) {
    const rx = treeX - 80 * s + r * 31 * s;
    const len = (95 + hash1D(r * 19.3) * 110) * s;
    const sway = Math.sin(timeSec * 1.9 + r * 0.7) * 11 * s;
    ctx.beginPath();
    ctx.moveTo(rx, h * 0.41);
    ctx.quadraticCurveTo(rx + sway * 0.5, h * 0.41 + len * 0.55, rx + sway, h * 0.41 + len);
    ctx.stroke();
  }

  // Young 1968 Grandfather (Postman) standing under banyan shade holding unmailed letters
  const postX = w * 0.34;
  const pHip: Vec2 = { x: postX, y: groundY - 56 * s };
  const pShoulder: Vec2 = { x: postX + 3 * s, y: pHip.y - 42 * s };
  const pHead: Vec2 = { x: pShoulder.x + 4 * s, y: pShoulder.y - 19 * s };
  const letterHand: Vec2 = { x: pShoulder.x + 28 * s, y: pShoulder.y + 12 * s };

  const kneeDeg = drawStylizedPerson({
    ctx,
    hip: pHip,
    shoulder: pShoulder,
    head: pHead,
    footL: { x: postX - 9 * s, y: groundY },
    footR: { x: postX + 11 * s, y: groundY },
    handBack: { x: pShoulder.x - 10 * s, y: pShoulder.y + 26 * s },
    handFront: letterHand,
    facing: 1,
    scale: s * 1.12,
    shirtColor: '#a68b67', // vintage 1968 khaki postman shirt
    trouserColor: '#4a3d2d',
    hairColor: '#181412',
    skinColor: '#e2b996',
    timeSec,
    showRig,
  });

  // Postman leather satchel strap & unmailed letter in hand
  ctx.strokeStyle = '#5c2d16';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(pShoulder.x - 6 * s, pShoulder.y);
  ctx.lineTo(pHip.x + 12 * s, pHip.y + 10 * s);
  ctx.stroke();
  drawEnvelope(ctx, letterHand.x + 8 * s, letterHand.y - 3 * s, 26 * s, 16 * s, -0.18);

  // Drifting unmailed letters & white Gandharaj petals sweeping across the 1968 breeze
  for (let i = 0; i < 16; i++) {
    const u = ((timeSec * 0.11 + hash1D(i * 13.7)) % 1.2) - 0.1;
    const py = h * (0.22 + hash1D(i * 29.1) * 0.52) + Math.sin(timeSec * 2 + i) * 14 * s;
    if (i % 4 === 0) {
      drawEnvelope(ctx, u * w, py, 36 * s, 22 * s, Math.sin(timeSec * 1.4 + i) * 0.35, 0.78);
    } else {
      drawGandharajPetal(ctx, u * w, py, (5 + (i % 3) * 2) * s, timeSec * 1.8 + i, 0.85);
    }
  }

  // Warm nostalgic vintage sepia tint glaze
  ctx.fillStyle = 'rgba(180, 120, 60, 0.11)';
  ctx.fillRect(0, 0, w, h);

  return {
    leadKneeAngleDeg: kneeDeg,
    hipYOffset: 0,
    scarfTension: 0.12,
    lanternSwingDeg: 0,
    skyPhaseLabel: '১৯৬৮ শান্তিপুর (Memory Flashback)',
  };
}

// =========================================================================
// SCENE 4: পূর্ণতা (GOLDEN AFTERNOON ROOFTOP — ARKA & GRANDFATHER TOGETHER)
// =========================================================================
export function renderRooftopClosureScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneProgress: number,
  timeSec: number,
  character: CharacterConfig,
  showRig: boolean
): StorySceneRenderInfo {
  const s = Math.min(w / 1280, h / 720);
  const horizonY = h * 0.62;

  // 1. Radiant late-afternoon golden-apricot sunset sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#2a3d66');
  sky.addColorStop(0.45, '#9d6272');
  sky.addColorStop(0.78, '#e8955e');
  sky.addColorStop(1, '#fbd392');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 2);

  // Warm afternoon sun low on left horizon
  const sunX = w * 0.24;
  const sunY = horizonY * 0.86;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 10 * s, sunX, sunY, 320 * s);
  sunGlow.addColorStop(0, 'rgba(255, 246, 210, 0.92)');
  sunGlow.addColorStop(0.32, 'rgba(251, 186, 114, 0.44)');
  sunGlow.addColorStop(1, 'rgba(234, 141, 82, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 320 * s, 0, Math.PI * 2);
  ctx.fill();

  // Soft sunlit sunset clouds
  for (let i = 0; i < 5; i++) {
    const cx = (((i * 0.24 + timeSec * 0.008) % 1.25) - 0.12) * w;
    const cy = h * (0.16 + (i % 3) * 0.09);
    ctx.fillStyle = 'rgba(254, 215, 170, 0.34)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 96 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 48 * s, cy - 6 * s, 68 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flock of birds gliding home across the golden sky
  ctx.strokeStyle = 'rgba(42, 26, 36, 0.72)';
  ctx.lineWidth = 1.8 * s;
  for (let i = 0; i < 6; i++) {
    const bx = (((timeSec * 0.045 + i * 0.14) % 1.2) - 0.1) * w;
    const by = h * (0.24 + i * 0.025 + Math.sin(timeSec * 2 + i) * 0.015);
    const flap = Math.sin(timeSec * 6.5 + i * 1.2) * 5 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 9 * s, by - flap);
    ctx.quadraticCurveTo(bx - 4 * s, by - 4 * s, bx, by);
    ctx.quadraticCurveTo(bx + 4 * s, by - 4 * s, bx + 9 * s, by - flap);
    ctx.stroke();
  }

  // Distant neighborhood rooftops & Bengal coconut palm silhouettes
  ctx.fillStyle = '#332534';
  for (let i = 0; i < 14; i++) {
    const bx = (i / 14) * w;
    const bh = (38 + hash1D(i * 19.3) * 52) * s;
    ctx.fillRect(bx, horizonY - bh, w / 13.5, bh + 30);
  }

  // Terracotta Rooftop Floor & Brick Parapet Wall (ছাদের পাঁচিল)
  const parapetY = h * 0.69;
  const floorY = h * 0.84;

  // Parapet wall
  const wallGrad = ctx.createLinearGradient(0, parapetY, 0, floorY);
  wallGrad.addColorStop(0, '#7c3a2b');
  wallGrad.addColorStop(1, '#4a2119');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, parapetY, w, floorY - parapetY);

  // Sunlit parapet top ledge
  ctx.fillStyle = '#b45c44';
  ctx.fillRect(0, parapetY - 8 * s, w, 10 * s);

  // Rooftop cement deck
  ctx.fillStyle = '#2d1c19';
  ctx.fillRect(0, floorY, w, h - floorY);

  // Earthen Clay Bowl (মাটির পাত্র) & Open Red Tin Box resting on the parapet
  const bowlX = w * 0.67;
  const bowlY = parapetY - 8 * s;
  ctx.fillStyle = '#9a4326';
  ctx.beginPath();
  ctx.arc(bowlX, bowlY - 12 * s, 24 * s, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c2413';
  ctx.beginPath();
  ctx.ellipse(bowlX, bowlY - 12 * s, 24 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const boxX = w * 0.58;
  const boxY = parapetY - 22 * s;
  drawRedTinBox(ctx, boxX, boxY, s * 1.05, 0.92);

  // Arka steps close and holds Grandfather's hand warmly; Grandfather smiles peacefully!
  const stepClose = smoothstep(0.05, 0.35, sceneProgress);
  const handHold = easeInOutCubic(smoothstep(0.28, 0.55, sceneProgress));
  const smileT = smoothstep(0.42, 0.72, sceneProgress);

  const gX = w * 0.47;
  const gHip: Vec2 = { x: gX, y: floorY - 62 * s };
  const gShoulder: Vec2 = { x: gX + 2 * s, y: gHip.y - 44 * s };
  const gHead: Vec2 = { x: gShoulder.x + 3 * s, y: gShoulder.y - 20 * s };

  const aX = lerp(w * 0.34, w * 0.40, stepClose);
  const aHip: Vec2 = { x: aX, y: floorY - 58 * s };
  const aShoulder: Vec2 = { x: aX + 3 * s, y: aHip.y - 42 * s };
  const aHead: Vec2 = { x: aShoulder.x + 5 * s, y: aShoulder.y - 19 * s };

  const joinedHand: Vec2 = { x: (aX + gX) * 0.5 + 4 * s, y: floorY - 72 * s };

  // Draw Grandfather
  drawStylizedPerson({
    ctx,
    hip: gHip,
    shoulder: gShoulder,
    head: gHead,
    footL: { x: gX - 8 * s, y: floorY },
    footR: { x: gX + 10 * s, y: floorY },
    handBack: {
      x: lerp(gX - 10 * s, joinedHand.x, handHold),
      y: lerp(gShoulder.y + 26 * s, joinedHand.y, handHold),
    },
    handFront: { x: gX + 22 * s, y: parapetY - 8 * s },
    facing: 1,
    scale: s * 1.18,
    shirtColor: '#f3ede0',
    trouserColor: '#cbd5e1',
    hairColor: '#f1f5f9',
    skinColor: '#dfb796',
    isElder: true,
    smileAmount: smileT,
    shawlColor: '#b45309',
    timeSec,
    showRig,
  });

  // Draw Arka gently holding Grandfather's hand
  const kneeDeg = drawStylizedPerson({
    ctx,
    hip: aHip,
    shoulder: aShoulder,
    head: aHead,
    footL: { x: aX - 8 * s, y: floorY },
    footR: { x: aX + 9 * s, y: floorY },
    handBack: { x: aX - 10 * s, y: aShoulder.y + 26 * s },
    handFront: {
      x: lerp(aX + 16 * s, joinedHand.x, handHold),
      y: lerp(aShoulder.y + 24 * s, joinedHand.y, handHold),
    },
    facing: 1,
    scale: s * 1.12,
    shirtColor: character.coatColor,
    trouserColor: '#1f2937',
    hairColor: character.hairColor,
    skinColor: '#e9c4a6',
    smileAmount: 0.85,
    timeSec,
    showRig,
  });

  // Fragrant stream of dried white Gandharaj petals rising freely from the Red Tin Box into the sunset breeze!
  const streamBoost = 0.35 + 0.65 * smoothstep(0.32, 0.9, sceneProgress);
  for (let i = 0; i < 32; i++) {
    const phase = (timeSec * 0.22 + i / 32) % 1;
    const px = boxX + phase * w * 0.55 - Math.sin(phase * 4 + i) * 45 * s;
    const py = boxY - phase * h * 0.58 - Math.sin(phase * Math.PI) * 35 * s;
    const alpha = Math.sin(phase * Math.PI) * streamBoost;
    drawGandharajPetal(ctx, px, py, (4.5 + (i % 4) * 1.8) * s, timeSec * 2.2 + i, alpha);
  }

  return {
    leadKneeAngleDeg: kneeDeg,
    hipYOffset: 0,
    scarfTension: 0.18,
    lanternSwingDeg: 0,
    skyPhaseLabel: 'বিকেলের ছাদ (Golden Rooftop)',
  };
}
