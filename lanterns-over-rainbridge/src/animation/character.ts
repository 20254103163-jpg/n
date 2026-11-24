import {
  clamp,
  easeInOutCubic,
  groundSlopeNormalized,
  groundYNormalized,
  lerp,
  shadeHex,
  smoothstep,
  solveTwoBoneIK,
  TwoBoneIKResult,
} from './math';
import { LanternPendulum, VerletChain } from './physics';
import {
  CharacterActionType,
  CharacterConfig,
  PropType,
  SettingType,
  Vec2,
} from './types';

export interface CharacterRenderState {
  x: number;
  y: number;
  nx: number;
  facing: 1 | -1;
  scale: number;
  walkSpeed: number;
  isRunning: boolean;
  prop: PropType;
  holdingLantern: boolean;
  lanternPos: Vec2;
  lanternSwingDeg: number;
  leadKneeAngleDeg: number;
  hipYOffset: number;
  scarfTension: number;
  hip: Vec2;
  shoulder: Vec2;
  headCenter: Vec2;
  neckAnchor: Vec2;
  frontLeg: TwoBoneIKResult;
  backLeg: TwoBoneIKResult;
  frontArm: TwoBoneIKResult;
  backArm: TwoBoneIKResult;
  handPivot: Vec2;
}

export class AnimatedTraveler {
  scarf = new VerletChain(14, 5.4);
  pendulum = new LanternPendulum();
  private releasedSceneKey = '';

  updateAndGetState(params: {
    sceneKey: string;
    sceneProgress: number; // 0..1 within active scene
    globalTimeSec: number;
    dt: number;
    width: number;
    height: number;
    windX: number;
    rainIntensity: number;
    setting: SettingType;
    action: CharacterActionType;
    config: CharacterConfig;
    onReleaseLantern: (nx: number, ny: number) => void;
  }): CharacterRenderState {
    const {
      sceneKey,
      sceneProgress,
      globalTimeSec,
      dt,
      width,
      height,
      windX,
      rainIntensity,
      setting,
      action,
      config,
      onReleaseLantern,
    } = params;

    if (sceneProgress < 0.08 && this.releasedSceneKey === sceneKey) {
      this.releasedSceneKey = '';
    }

    const scale = Math.min(width / 1280, height / 720);

    // Derive horizontal path, facing direction, locomotion speed, and gestures from scene action
    let nx = 0.5;
    let facing: 1 | -1 = 1;
    let walkBlend = 0;
    let isRunning = false;
    let armRaise = 0;
    let lookUp = 0;
    let holdingLantern = config.prop === 'lantern';

    switch (action) {
      case 'walk_right':
        nx = lerp(0.14, 0.86, sceneProgress);
        facing = 1;
        walkBlend = 1;
        break;
      case 'walk_left':
        nx = lerp(0.86, 0.14, sceneProgress);
        facing = -1;
        walkBlend = 1;
        break;
      case 'run_right':
        nx = lerp(0.10, 0.90, easeInOutCubic(sceneProgress));
        facing = 1;
        walkBlend = 1;
        isRunning = true;
        break;
      case 'stand_look_sky':
        nx = 0.49;
        facing = 1;
        walkBlend = 0;
        lookUp = smoothstep(0.08, 0.3, sceneProgress) * (1 - smoothstep(0.84, 0.98, sceneProgress));
        break;
      case 'raise_lantern': {
        nx = 0.50;
        facing = 1;
        walkBlend = 0;
        armRaise =
          smoothstep(0.12, 0.45, sceneProgress) * (1 - smoothstep(0.68, 0.92, sceneProgress));
        lookUp = smoothstep(0.14, 0.4, sceneProgress) * (1 - smoothstep(0.82, 0.98, sceneProgress));
        holdingLantern = sceneProgress < 0.54;
        break;
      }
    }

    const groundX = nx * width;
    const groundY = groundYNormalized(setting, nx) * height;
    const slopeAngle = Math.atan(groundSlopeNormalized(setting, nx) * (height / width));

    // Distance-coupled stride phase so feet plant without sliding
    const strideFreq = isRunning ? 30 : 22;
    const strideCycles = (facing === 1 ? nx : 1 - nx) * strideFreq;
    const phase = strideCycles * Math.PI * 2;

    const thighLen = 23 * scale;
    const shinLen = 23 * scale;
    const strideLength = (isRunning ? 31 : 23) * scale * walkBlend;
    const stepLift = (isRunning ? 16 : 10.5) * scale * walkBlend;

    const hipBob = Math.abs(Math.sin(phase)) * (isRunning ? -5.8 : -3.4) * scale * walkBlend;
    const idleBreath = Math.sin(globalTimeSec * 2.1) * 0.9 * scale;
    const hipYOffset = hipBob + idleBreath;

    const hip: Vec2 = {
      x: groundX,
      y: groundY - (isRunning ? 40 : 43) * scale + hipYOffset,
    };

    const computeFootTarget = (legPhase: number, restOffset: number): Vec2 => {
      const s = Math.sin(legPhase);
      const lift = Math.max(0, Math.cos(legPhase));
      const fx = groundX + facing * (s * strideLength + restOffset * (1 - walkBlend));
      const fnx = clamp(fx / width, 0.01, 0.99);
      const fy = groundYNormalized(setting, fnx) * height - lift * stepLift;
      return { x: fx, y: fy };
    };

    const frontFootTarget = computeFootTarget(phase, 5.5 * scale);
    const backFootTarget = computeFootTarget(phase + Math.PI, -5.5 * scale);

    // Knee bends in facing direction (-1 for facing right, +1 for facing left)
    const kneeBendSign: 1 | -1 = facing === 1 ? -1 : 1;
    const frontLeg = solveTwoBoneIK(hip, frontFootTarget, thighLen, shinLen, kneeBendSign);
    const backLeg = solveTwoBoneIK(hip, backFootTarget, thighLen, shinLen, kneeBendSign);

    const leanForward =
      facing *
        ((isRunning ? 0.19 : 0.065) * walkBlend +
          rainIntensity * 0.05 +
          clamp(-facing * windX * 0.00016, -0.04, 0.06)) *
        (1 - lookUp * 0.7) +
      slopeAngle * 0.3;

    const torsoLen = 30 * scale;
    const shoulder: Vec2 = {
      x: hip.x + Math.sin(leanForward) * torsoLen,
      y: hip.y - Math.cos(leanForward) * torsoLen,
    };

    const headTilt = facing * (-lookUp * 0.32 + Math.sin(phase * 2) * 0.025 * walkBlend);
    const headCenter: Vec2 = {
      x: shoulder.x + Math.sin(leanForward + headTilt) * 14 * scale + facing * 1.5 * scale,
      y: shoulder.y - Math.cos(leanForward + headTilt) * 14 * scale,
    };

    const neckAnchor: Vec2 = {
      x: lerp(shoulder.x, headCenter.x, 0.25) - facing * 2 * scale,
      y: lerp(shoulder.y, headCenter.y, 0.3) + 2 * scale,
    };

    const upperArm = 16.5 * scale;
    const foreArm = 15.5 * scale;
    const elbowBendSign: 1 | -1 = facing === 1 ? 1 : -1;

    const walkArmSwing = Math.sin(phase + Math.PI) * (isRunning ? 14 : 6) * scale * walkBlend;
    const propHoldX =
      config.prop === 'umbrella' ? 16 : config.prop === 'staff' ? 17 : config.prop === 'none' ? 8 : 20;
    const propHoldY =
      config.prop === 'umbrella' ? -2 : config.prop === 'staff' ? 10 : config.prop === 'none' ? 20 : 13;

    const frontHandTarget: Vec2 = {
      x:
        shoulder.x +
        facing * (lerp(propHoldX, 27, armRaise) * scale + walkArmSwing * (1 - armRaise)),
      y:
        shoulder.y +
        lerp(propHoldY, -15, armRaise) * scale +
        Math.cos(phase * 2) * 1.8 * scale * walkBlend,
    };

    const backHandTarget: Vec2 = {
      x: shoulder.x + facing * (-5 * scale + Math.sin(phase) * (isRunning ? 18 : 12) * scale * walkBlend),
      y: shoulder.y + 22 * scale - Math.abs(Math.sin(phase)) * (isRunning ? 7 : 2.5) * scale * walkBlend,
    };

    const frontArm = solveTwoBoneIK(shoulder, frontHandTarget, upperArm, foreArm, elbowBendSign);
    const backArm = solveTwoBoneIK(shoulder, backHandTarget, upperArm, foreArm, elbowBendSign);

    const handPivot = frontArm.end;
    const pend = this.pendulum.update(
      handPivot,
      dt,
      windX - facing * walkBlend * (isRunning ? 85 : 46),
      scale
    );

    if (
      action === 'raise_lantern' &&
      sceneProgress >= 0.52 &&
      sceneProgress < 0.6 &&
      this.releasedSceneKey !== sceneKey
    ) {
      this.releasedSceneKey = sceneKey;
      onReleaseLantern(pend.bob.x / width, pend.bob.y / height);
    }

    const scarfWind = windX - facing * walkBlend * (isRunning ? 210 : 115);
    const scarfTension = this.scarf.update(neckAnchor, dt, scarfWind, globalTimeSec, scale);

    return {
      x: groundX,
      y: groundY,
      nx,
      facing,
      scale,
      walkSpeed: walkBlend,
      isRunning,
      prop: action === 'raise_lantern' ? 'lantern' : config.prop,
      holdingLantern: action === 'raise_lantern' ? holdingLantern : config.prop === 'lantern',
      lanternPos: pend.bob,
      lanternSwingDeg: (pend.angle * 180) / Math.PI,
      leadKneeAngleDeg: frontLeg.kneeAngleDeg,
      hipYOffset: hipYOffset / Math.max(scale, 0.1),
      scarfTension,
      hip,
      shoulder,
      headCenter,
      neckAnchor,
      frontLeg,
      backLeg,
      frontArm,
      backArm,
      handPivot,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    state: CharacterRenderState,
    config: CharacterConfig,
    timeSec: number,
    ambientNight: number,
    windNorm: number
  ): void {
    const s = state.scale;
    const warmRim = state.holdingLantern ? 0.85 : lerp(0.5, 0.22, ambientNight);
    const coatDark = shadeHex(config.coatColor, 0.55);
    const coatMid = shadeHex(config.coatColor, 0.82);
    const scarfDark = shadeHex(config.scarfColor, 0.62);

    ctx.save();

    // Soft contact shadow
    ctx.fillStyle = 'rgba(4, 7, 14, 0.45)';
    ctx.beginPath();
    ctx.ellipse(state.x, state.y + 1.5 * s, 18 * s, 4.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back arm
    this.drawLimb(ctx, state.shoulder, state.backArm.joint, state.backArm.end, 6.2 * s, coatDark);

    // Back leg
    this.drawLegAndBoot(ctx, state.hip, state.backLeg, state.facing, s, '#101521', '#1b1d28');

    // Flowing Verlet scarf
    this.drawScarf(ctx, config.scarfColor, scarfDark, s, warmRim, state.facing);

    // Front leg
    this.drawLegAndBoot(ctx, state.hip, state.frontLeg, state.facing, s, '#192234', '#262835');

    // Cel-shaded coat body
    this.drawRaincoat(ctx, state, config.coatColor, coatMid, coatDark, timeSec, s, warmRim);

    // Head, hair, blinking eye
    this.drawHead(ctx, state, config.coatColor, config.hairColor, timeSec, s, warmRim);

    // Front arm
    this.drawLimb(ctx, state.shoulder, state.frontArm.joint, state.frontArm.end, 6.5 * s, coatMid);

    // Hand
    ctx.fillStyle = '#e2b99b';
    ctx.beginPath();
    ctx.arc(state.handPivot.x, state.handPivot.y, 3.1 * s, 0, Math.PI * 2);
    ctx.fill();

    // Character Props
    if (state.holdingLantern) {
      this.drawHandheldLantern(ctx, state.handPivot, state.lanternPos, timeSec, s);
    } else if (state.prop === 'umbrella') {
      this.drawUmbrella(ctx, state.handPivot, state.facing, windNorm, s);
    } else if (state.prop === 'staff') {
      this.drawStaff(ctx, state.handPivot, state.facing, timeSec, s);
    }

    ctx.restore();
  }

  private drawLimb(
    ctx: CanvasRenderingContext2D,
    root: Vec2,
    joint: Vec2,
    end: Vec2,
    width: number,
    color: string
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.lineTo(joint.x, joint.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  private drawLegAndBoot(
    ctx: CanvasRenderingContext2D,
    hip: Vec2,
    leg: TwoBoneIKResult,
    facing: 1 | -1,
    s: number,
    trouserColor: string,
    bootColor: string
  ): void {
    ctx.strokeStyle = trouserColor;
    ctx.lineWidth = 7.4 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(leg.joint.x, leg.joint.y);
    ctx.lineTo(leg.end.x, leg.end.y - 3 * s);
    ctx.stroke();

    const shinAngle = Math.atan2(leg.end.y - leg.joint.y, leg.end.x - leg.joint.x);
    const footAngle = clamp((shinAngle - Math.PI / 2) * 0.25, -0.3, 0.28);

    ctx.save();
    ctx.translate(leg.end.x, leg.end.y - 2 * s);
    ctx.rotate(footAngle);
    ctx.scale(facing, 1);
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.moveTo(-4.2 * s, -4 * s);
    ctx.lineTo(4.2 * s, -3.5 * s);
    ctx.quadraticCurveTo(9.8 * s, -2 * s, 9.5 * s, 2.2 * s);
    ctx.lineTo(-4.5 * s, 2.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawRaincoat(
    ctx: CanvasRenderingContext2D,
    state: CharacterRenderState,
    coatLight: string,
    coatMid: string,
    coatDark: string,
    timeSec: number,
    s: number,
    warmRim: number
  ): void {
    const sh = state.shoulder;
    const hp = state.hip;
    const f = state.facing;
    const hemSway = Math.sin(timeSec * (state.isRunning ? 10 : 6.5)) * 2.5 * s * state.walkSpeed - f * 2.5 * s;

    const coatGrad = ctx.createLinearGradient(sh.x - f * 14 * s, sh.y, sh.x + f * 16 * s, hp.y + 18 * s);
    coatGrad.addColorStop(0, coatLight);
    coatGrad.addColorStop(0.55, coatMid);
    coatGrad.addColorStop(1, coatDark);

    ctx.fillStyle = coatGrad;
    ctx.beginPath();
    ctx.moveTo(sh.x - f * 8 * s, sh.y - 2 * s);
    ctx.lineTo(sh.x + f * 8.5 * s, sh.y - 1 * s);
    ctx.quadraticCurveTo(hp.x + f * 12.5 * s, hp.y + 4 * s, hp.x + f * 15 * s + hemSway * 0.4, hp.y + 16 * s);
    ctx.quadraticCurveTo(hp.x, hp.y + 19 * s, hp.x - f * 16 * s + hemSway, hp.y + 15 * s);
    ctx.quadraticCurveTo(sh.x - f * 12 * s, lerp(sh.y, hp.y, 0.55), sh.x - f * 8 * s, sh.y - 2 * s);
    ctx.closePath();
    ctx.fill();

    if (warmRim > 0.05) {
      ctx.strokeStyle = `rgba(255, 198, 112, ${(0.55 * warmRim).toFixed(2)})`;
      ctx.lineWidth = 1.8 * s;
      ctx.beginPath();
      ctx.moveTo(sh.x + f * 8.2 * s, sh.y);
      ctx.quadraticCurveTo(
        hp.x + f * 12.2 * s,
        hp.y + 4 * s,
        hp.x + f * 14.5 * s + hemSway * 0.4,
        hp.y + 15.5 * s
      );
      ctx.stroke();
    }
  }

  private drawHead(
    ctx: CanvasRenderingContext2D,
    state: CharacterRenderState,
    coatColor: string,
    hairColor: string,
    timeSec: number,
    s: number,
    warmRim: number
  ): void {
    const hc = state.headCenter;
    const f = state.facing;

    ctx.save();
    ctx.translate(hc.x, hc.y);
    ctx.scale(f, 1);

    // Hood resting at collar
    ctx.fillStyle = shadeHex(coatColor, 0.7);
    ctx.beginPath();
    ctx.ellipse(-7.5 * s, 8.5 * s, 8.5 * s, 5.2 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = '#ebd0bc';
    ctx.beginPath();
    ctx.arc(0, 0, 8.2 * s, 0, Math.PI * 2);
    ctx.fill();

    if (warmRim > 0.1) {
      ctx.fillStyle = `rgba(255, 178, 92, ${(0.25 * warmRim).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(3.2 * s, 1.2 * s, 4.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blinking eye
    const blinkCycle = timeSec % 4.3;
    const isBlinking = blinkCycle > 4.12 && blinkCycle < 4.24;
    ctx.fillStyle = '#151924';
    if (isBlinking) {
      ctx.fillRect(3.2 * s, -0.5 * s, 2.6 * s, 0.9 * s);
    } else {
      ctx.beginPath();
      ctx.ellipse(4.4 * s, -0.8 * s, 1.15 * s, 1.55 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hair with wind flutter
    const hairWave = Math.sin(timeSec * 8.5) * 1.4 * s;
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(-1.2 * s, -1.8 * s, 8.6 * s, Math.PI * 0.72, Math.PI * 2.08);
    ctx.quadraticCurveTo(9.2 * s, -4.5 * s, 6.4 * s, -1.2 * s);
    ctx.quadraticCurveTo(1.5 * s, -4.2 * s, -2.2 * s, 2.5 * s);
    ctx.quadraticCurveTo(-10.5 * s, 4.5 * s + hairWave, -9.5 * s, -1.5 * s);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawScarf(
    ctx: CanvasRenderingContext2D,
    scarfColor: string,
    scarfDark: string,
    s: number,
    warmRim: number,
    facing: 1 | -1
  ): void {
    const nodes = this.scarf.nodes;
    if (nodes.length < 3) return;

    ctx.fillStyle = scarfDark;
    ctx.beginPath();
    ctx.ellipse(nodes[0].x + facing * 2 * s, nodes[0].y + 0.5 * s, 8.5 * s, 4.2 * s, facing * 0.15, 0, Math.PI * 2);
    ctx.fill();

    const buildRibbonPath = (offsetY: number) => {
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y + offsetY);
      for (let i = 1; i < nodes.length - 1; i++) {
        const mx = (nodes[i].x + nodes[i + 1].x) * 0.5;
        const my = (nodes[i].y + nodes[i + 1].y) * 0.5 + offsetY;
        ctx.quadraticCurveTo(nodes[i].x, nodes[i].y + offsetY, mx, my);
      }
      const last = nodes[nodes.length - 1];
      ctx.lineTo(last.x, last.y + offsetY);
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = scarfDark;
    ctx.lineWidth = 6.2 * s;
    buildRibbonPath(1.2 * s);
    ctx.stroke();

    ctx.strokeStyle = scarfColor;
    ctx.lineWidth = 4.8 * s;
    buildRibbonPath(0);
    ctx.stroke();

    if (warmRim > 0.1) {
      ctx.strokeStyle = `rgba(255, 224, 196, ${(0.34 * warmRim).toFixed(2)})`;
      ctx.lineWidth = 1.2 * s;
      buildRibbonPath(-1.5 * s);
      ctx.stroke();
    }
  }

  private drawHandheldLantern(
    ctx: CanvasRenderingContext2D,
    pivot: Vec2,
    bob: Vec2,
    timeSec: number,
    s: number
  ): void {
    const flicker = 0.92 + Math.sin(timeSec * 15.2) * 0.05 + Math.cos(timeSec * 23.7) * 0.03;

    const outerGlow = ctx.createRadialGradient(bob.x, bob.y, 2 * s, bob.x, bob.y, 88 * s * flicker);
    outerGlow.addColorStop(0, 'rgba(255, 224, 150, 0.58)');
    outerGlow.addColorStop(0.28, 'rgba(245, 158, 11, 0.25)');
    outerGlow.addColorStop(0.65, 'rgba(217, 119, 6, 0.07)');
    outerGlow.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, 88 * s * flicker, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2d3342';
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(bob.x, bob.y - 7 * s);
    ctx.stroke();

    const angle = Math.atan2(bob.x - pivot.x, bob.y - pivot.y);
    ctx.save();
    ctx.translate(bob.x, bob.y);
    ctx.rotate(-angle);

    const bodyGrad = ctx.createRadialGradient(0, 1 * s, 1 * s, 0, 0, 9.5 * s);
    bodyGrad.addColorStop(0, '#fffbeb');
    bodyGrad.addColorStop(0.45, '#fcd34d');
    bodyGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-5.8 * s, -7.2 * s, 11.6 * s, 14.4 * s, 4.2 * s);
    ctx.fill();

    ctx.fillStyle = '#1f1612';
    ctx.fillRect(-4.5 * s, -8.3 * s, 9 * s, 1.9 * s);
    ctx.fillRect(-4.2 * s, 6.7 * s, 8.4 * s, 1.8 * s);
    ctx.restore();
  }

  private drawUmbrella(
    ctx: CanvasRenderingContext2D,
    pivot: Vec2,
    facing: 1 | -1,
    windNorm: number,
    s: number
  ): void {
    const tilt = facing * 0.14 + clamp(windNorm * 0.12, -0.22, 0.22);
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(tilt);

    // Shaft
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(0, 4 * s);
    ctx.lineTo(0, -48 * s);
    ctx.stroke();

    // Canopy dome
    const domeGrad = ctx.createLinearGradient(-34 * s, -54 * s, 34 * s, -36 * s);
    domeGrad.addColorStop(0, '#334155');
    domeGrad.addColorStop(0.5, '#1e293b');
    domeGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.moveTo(-36 * s, -38 * s);
    ctx.quadraticCurveTo(0, -68 * s, 36 * s, -38 * s);
    ctx.quadraticCurveTo(18 * s, -43 * s, 0, -39 * s);
    ctx.quadraticCurveTo(-18 * s, -43 * s, -36 * s, -38 * s);
    ctx.closePath();
    ctx.fill();

    // Soft rim sheen on canopy top
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(-32 * s, -40 * s);
    ctx.quadraticCurveTo(0, -64 * s, 32 * s, -40 * s);
    ctx.stroke();

    ctx.restore();
  }

  private drawStaff(
    ctx: CanvasRenderingContext2D,
    pivot: Vec2,
    facing: 1 | -1,
    timeSec: number,
    s: number
  ): void {
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(facing * 0.12);

    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 3.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 46 * s);
    ctx.lineTo(0, -34 * s);
    ctx.stroke();

    // Subtle glowing amber crystal at staff tip
    const pulse = 0.88 + 0.12 * Math.sin(timeSec * 4.5);
    const glow = ctx.createRadialGradient(0, -37 * s, 1, 0, -37 * s, 26 * s * pulse);
    glow.addColorStop(0, 'rgba(254, 243, 199, 0.85)');
    glow.addColorStop(0.4, 'rgba(245, 158, 11, 0.25)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -37 * s, 26 * s * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -37 * s, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawRigOverlay(ctx: CanvasRenderingContext2D, state: CharacterRenderState): void {
    const s = state.scale;
    ctx.save();

    const drawBone = (a: Vec2, b: Vec2, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    const drawJoint = (p: Vec2, color: string, radius = 3.2) => {
      ctx.fillStyle = '#0b0d11';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    drawBone(state.hip, state.shoulder, '#38bdf8');
    drawBone(state.shoulder, state.headCenter, '#38bdf8');
    drawBone(state.hip, state.backLeg.joint, '#64748b');
    drawBone(state.backLeg.joint, state.backLeg.end, '#64748b');
    drawBone(state.hip, state.frontLeg.joint, '#38bdf8');
    drawBone(state.frontLeg.joint, state.frontLeg.end, '#38bdf8');
    drawBone(state.shoulder, state.backArm.joint, '#64748b');
    drawBone(state.backArm.joint, state.backArm.end, '#64748b');
    drawBone(state.shoulder, state.frontArm.joint, '#f59e0b');
    drawBone(state.frontArm.joint, state.frontArm.end, '#f59e0b');

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    this.scarf.nodes.forEach((n, idx) => {
      if (idx === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    });
    ctx.stroke();
    this.scarf.nodes.forEach((n, idx) => {
      if (idx % 2 === 0) drawJoint(n, '#fb7185', 2.2);
    });

    if (state.holdingLantern) {
      ctx.setLineDash([3, 3]);
      drawBone(state.handPivot, state.lanternPos, '#fbbf24');
      ctx.setLineDash([]);
      drawJoint(state.lanternPos, '#fbbf24', 3.4);
    }

    drawJoint(state.hip, '#38bdf8', 3.8);
    drawJoint(state.shoulder, '#38bdf8', 3.4);
    drawJoint(state.frontLeg.joint, '#38bdf8', 3.2);
    drawJoint(state.frontLeg.end, '#34d399', 3.4);
    drawJoint(state.backLeg.end, '#34d399', 2.8);
    drawJoint(state.frontArm.joint, '#f59e0b', 3.0);
    drawJoint(state.handPivot, '#f59e0b', 3.0);

    ctx.font = `500 ${Math.max(10, Math.round(11 * s))}px "JetBrains Mono", monospace`;
    ctx.fillStyle = 'rgba(11, 13, 17, 0.78)';
    const label = `IK knee ${state.leadKneeAngleDeg.toFixed(0)}°`;
    const w = ctx.measureText(label).width + 12;
    ctx.fillRect(state.headCenter.x - w / 2, state.headCenter.y - 30 * s, w, 18);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(state.headCenter.x - w / 2, state.headCenter.y - 30 * s, w, 18);
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, state.headCenter.x, state.headCenter.y - 21 * s);

    ctx.restore();
  }
}
