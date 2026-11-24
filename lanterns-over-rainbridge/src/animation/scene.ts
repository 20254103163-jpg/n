import { AnimatedTraveler, CharacterRenderState } from './character';
import {
  bridgeDeckYNormalized,
  clamp,
  fbm1D,
  groundYNormalized,
  hash1D,
  lerp,
  lerpColor,
  rgbaToCss,
  rgbToCss,
  smoothstep,
} from './math';
import {
  DriftWeatherSystem,
  FireflySystem,
  LanternSystem,
  RainSystem,
  ReedCluster,
  ShootingStarSystem,
} from './physics';
import { renderCustomStageScene } from './customStage';
import {
  renderAtticDiscoveryScene,
  renderRooftopClosureScene,
  renderShantipurMemoryScene,
  renderVerandaPastScene,
} from './storyScenes';
import {
  AnimationProject,
  buildTimeline,
  DirectorControls,
  FrameMetrics,
  RGB,
  SceneSpec,
  TIME_LABELS,
  TimeOfDayType,
} from './types';

interface SkyPalette {
  zenith: RGB;
  mid: RGB;
  horizon: RGB;
  mountainFar: RGB;
  mountainMid: RGB;
  waterTop: RGB;
  waterBottom: RGB;
  cloudShadow: RGB;
  cloudRim: RGB;
  nightAmount: number;
  sunStrength: number;
  moonStrength: number;
  starStrength: number;
}

const TIME_PALETTES: Record<TimeOfDayType, SkyPalette> = {
  sunny_afternoon: {
    zenith: { r: 44, g: 108, b: 178 },
    mid: { r: 106, g: 164, b: 214 },
    horizon: { r: 236, g: 222, b: 192 },
    mountainFar: { r: 94, g: 126, b: 158 },
    mountainMid: { r: 54, g: 82, b: 108 },
    waterTop: { r: 78, g: 132, b: 178 },
    waterBottom: { r: 26, g: 58, b: 92 },
    cloudShadow: { r: 196, g: 212, b: 226 },
    cloudRim: { r: 255, g: 252, b: 244 },
    nightAmount: 0.0,
    sunStrength: 0.85,
    moonStrength: 0,
    starStrength: 0,
  },
  golden_dusk: {
    zenith: { r: 22, g: 37, b: 68 },
    mid: { r: 94, g: 68, b: 102 },
    horizon: { r: 234, g: 141, b: 82 },
    mountainFar: { r: 62, g: 56, b: 82 },
    mountainMid: { r: 34, g: 38, b: 58 },
    waterTop: { r: 92, g: 68, b: 84 },
    waterBottom: { r: 17, g: 24, b: 40 },
    cloudShadow: { r: 58, g: 48, b: 74 },
    cloudRim: { r: 252, g: 186, b: 122 },
    nightAmount: 0.2,
    sunStrength: 1.0,
    moonStrength: 0,
    starStrength: 0.08,
  },
  storm_twilight: {
    zenith: { r: 12, g: 20, b: 36 },
    mid: { r: 28, g: 43, b: 66 },
    horizon: { r: 56, g: 82, b: 106 },
    mountainFar: { r: 29, g: 42, b: 60 },
    mountainMid: { r: 17, g: 26, b: 40 },
    waterTop: { r: 31, g: 48, b: 68 },
    waterBottom: { r: 9, g: 15, b: 26 },
    cloudShadow: { r: 20, g: 30, b: 48 },
    cloudRim: { r: 92, g: 120, b: 148 },
    nightAmount: 0.65,
    sunStrength: 0,
    moonStrength: 0.1,
    starStrength: 0.1,
  },
  starry_night: {
    zenith: { r: 5, g: 9, b: 20 },
    mid: { r: 12, g: 22, b: 44 },
    horizon: { r: 27, g: 46, b: 76 },
    mountainFar: { r: 16, g: 26, b: 46 },
    mountainMid: { r: 10, g: 16, b: 30 },
    waterTop: { r: 16, g: 28, b: 48 },
    waterBottom: { r: 6, g: 10, b: 19 },
    cloudShadow: { r: 13, g: 21, b: 38 },
    cloudRim: { r: 104, g: 136, b: 178 },
    nightAmount: 0.95,
    sunStrength: 0,
    moonStrength: 0.65,
    starStrength: 1.0,
  },
  moonlit: {
    zenith: { r: 9, g: 16, b: 34 },
    mid: { r: 21, g: 36, b: 64 },
    horizon: { r: 44, g: 70, b: 106 },
    mountainFar: { r: 24, g: 38, b: 62 },
    mountainMid: { r: 14, g: 22, b: 38 },
    waterTop: { r: 24, g: 42, b: 68 },
    waterBottom: { r: 8, g: 14, b: 26 },
    cloudShadow: { r: 20, g: 32, b: 54 },
    cloudRim: { r: 146, g: 178, b: 214 },
    nightAmount: 0.85,
    sunStrength: 0,
    moonStrength: 1.0,
    starStrength: 0.82,
  },
  pre_dawn: {
    zenith: { r: 18, g: 26, b: 52 },
    mid: { r: 74, g: 62, b: 98 },
    horizon: { r: 204, g: 126, b: 104 },
    mountainFar: { r: 48, g: 46, b: 74 },
    mountainMid: { r: 26, g: 30, b: 50 },
    waterTop: { r: 72, g: 58, b: 82 },
    waterBottom: { r: 14, g: 19, b: 34 },
    cloudShadow: { r: 48, g: 44, b: 72 },
    cloudRim: { r: 242, g: 172, b: 138 },
    nightAmount: 0.4,
    sunStrength: 0.55,
    moonStrength: 0.18,
    starStrength: 0.28,
  },
};

function blendPalettes(a: SkyPalette, b: SkyPalette, t: number): SkyPalette {
  return {
    zenith: lerpColor(a.zenith, b.zenith, t),
    mid: lerpColor(a.mid, b.mid, t),
    horizon: lerpColor(a.horizon, b.horizon, t),
    mountainFar: lerpColor(a.mountainFar, b.mountainFar, t),
    mountainMid: lerpColor(a.mountainMid, b.mountainMid, t),
    waterTop: lerpColor(a.waterTop, b.waterTop, t),
    waterBottom: lerpColor(a.waterBottom, b.waterBottom, t),
    cloudShadow: lerpColor(a.cloudShadow, b.cloudShadow, t),
    cloudRim: lerpColor(a.cloudRim, b.cloudRim, t),
    nightAmount: lerp(a.nightAmount, b.nightAmount, t),
    sunStrength: lerp(a.sunStrength, b.sunStrength, t),
    moonStrength: lerp(a.moonStrength, b.moonStrength, t),
    starStrength: lerp(a.starStrength, b.starStrength, t),
  };
}

function sampleOverridePalette(phase: number): { palette: SkyPalette; label: string } {
  const order: TimeOfDayType[] = [
    'sunny_afternoon',
    'golden_dusk',
    'storm_twilight',
    'starry_night',
    'moonlit',
    'pre_dawn',
  ];
  const scaled = clamp(phase, 0, 0.999) * order.length;
  const idx = Math.floor(scaled);
  const nextIdx = (idx + 1) % order.length;
  const frac = scaled - idx;
  return {
    palette: blendPalettes(TIME_PALETTES[order[idx]], TIME_PALETTES[order[nextIdx]], frac),
    label: TIME_LABELS[order[idx]],
  };
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  tint: string;
}

interface Cloud {
  baseX: number;
  y: number;
  scale: number;
  speed: number;
  puffs: { dx: number; dy: number; rx: number; ry: number }[];
}

export class AnimationScene {
  private traveler = new AnimatedTraveler();
  private rain = new RainSystem(260);
  private driftWeather = new DriftWeatherSystem(150);
  private meteors = new ShootingStarSystem();
  private lanterns = new LanternSystem();
  private reeds = new ReedCluster();
  private fireflies = new FireflySystem(24);
  private stars: Star[] = [];
  private clouds: Cloud[] = [];

  private userGustX: number | null = null;
  private userGustForce = 0;

  constructor() {
    const tints = ['#ffffff', '#dbeafe', '#fef3c7', '#e0e7ff'];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: hash1D(i * 17.31),
        y: 0.02 + hash1D(i * 29.17) * 0.45,
        size: 0.7 + hash1D(i * 43.9) * 1.45,
        phase: hash1D(i * 59.7) * Math.PI * 2,
        speed: 1.2 + hash1D(i * 71.1) * 2.4,
        tint: tints[i % tints.length],
      });
    }

    for (let i = 0; i < 7; i++) {
      const puffCount = 4 + (i % 3);
      const puffs = [];
      for (let p = 0; p < puffCount; p++) {
        const u = p / (puffCount - 1) - 0.5;
        puffs.push({
          dx: u * 0.13 + (hash1D(i * 11 + p * 3.7) - 0.5) * 0.02,
          dy: -Math.abs(u) * 0.015 + (hash1D(i * 17 + p * 5.3) - 0.5) * 0.018,
          rx: 0.036 + (1 - Math.abs(u)) * 0.032,
          ry: 0.016 + (1 - Math.abs(u)) * 0.018,
        });
      }
      this.clouds.push({
        baseX: (i / 7) * 1.15 - 0.07,
        y: 0.11 + hash1D(i * 31.3) * 0.24,
        scale: 0.78 + hash1D(i * 23.7) * 0.58,
        speed: 0.0055 + hash1D(i * 13.9) * 0.0065,
        puffs,
      });
    }
  }

  releaseUserLantern(nx: number, ny: number): void {
    this.lanterns.spawnUserLantern(nx, ny);
    if (ny > 0.58 && ny < 0.85) {
      this.rain.spawnRipple(nx, ny, true);
    }
  }

  triggerLanternBurst(): void {
    this.lanterns.spawnStoryBurst(0.5, 0.64);
  }

  applyPointerWind(nx: number, forceX: number): void {
    this.userGustX = nx;
    this.userGustForce = clamp(this.userGustForce * 0.4 + forceX * 0.6, -2.5, 2.5);
  }

  renderFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timeSec: number,
    dt: number,
    project: AnimationProject,
    controls: DirectorControls,
    onAutoLanternRelease?: () => void
  ): FrameMetrics {
    const { segments, totalDuration } = buildTimeline(project.scenes);
    const wrappedTime = ((timeSec % totalDuration) + totalDuration) % totalDuration;

    const seg =
      segments.find((s) => wrappedTime >= s.startSec && wrappedTime < s.endSec) ?? segments[0];
    const scene: SceneSpec = seg.scene;
    const nextSeg = segments[(seg.index + 1) % segments.length];
    const sceneDur = Math.max(seg.endSec - seg.startSec, 0.1);
    const sceneProgress = clamp((wrappedTime - seg.startSec) / sceneDur, 0, 1);

    // Smoothly cross-blend sky palette during final 15% when same setting or soft fade on cut
    let palette = TIME_PALETTES[scene.timeOfDay];
    let skyLabel = TIME_LABELS[scene.timeOfDay];
    if (controls.timeOfDayOverride !== null) {
      const ov = sampleOverridePalette(controls.timeOfDayOverride);
      palette = ov.palette;
      skyLabel = ov.label;
    } else if (nextSeg && nextSeg.scene.setting === scene.setting && sceneProgress > 0.8) {
      const blendT = smoothstep(0.8, 1.0, sceneProgress);
      palette = blendPalettes(palette, TIME_PALETTES[nextSeg.scene.timeOfDay], blendT);
    }

    // Decay pointer wind gust
    this.userGustForce *= Math.pow(0.08, clamp(dt, 0.001, 0.05));
    if (Math.abs(this.userGustForce) < 0.02) {
      this.userGustForce = 0;
      this.userGustX = null;
    }

    const weatherIntensity =
      controls.weatherIntensityOverride !== null
        ? controls.weatherIntensityOverride
        : scene.weatherIntensity;
    const rainIntensity = scene.weather === 'rain' ? weatherIntensity : 0;
    const snowIntensity = scene.weather === 'snow' ? weatherIntensity : 0;
    const petalIntensity = scene.weather === 'petals' ? weatherIntensity : 0;
    const fireflyStrength =
      scene.weather === 'fireflies'
        ? Math.max(0.35, weatherIntensity)
        : palette.nightAmount * 0.45;

    const gustWave = fbm1D(wrappedTime * 0.42, 3);
    const baseWindNorm =
      (-0.32 * scene.windStrength + gustWave * (0.38 * scene.windStrength)) *
        controls.windMultiplier +
      this.userGustForce * 0.9;
    const windPixels = baseWindNorm * 220;
    const windSpeedMs = Math.abs(baseWindNorm) * 6.8 + 0.9;

    // Update physics
    this.rain.update(dt, rainIntensity, baseWindNorm, scene.setting);
    this.driftWeather.update(
      dt,
      wrappedTime,
      Math.max(snowIntensity, petalIntensity),
      baseWindNorm
    );
    this.meteors.update(dt, scene.events.shootingStars);
    this.lanterns.update(dt, wrappedTime, scene.events.skyLanterns ? 1 : 0, baseWindNorm);
    this.reeds.update(dt, wrappedTime, baseWindNorm, this.userGustX, this.userGustForce);
    this.fireflies.update(dt, wrappedTime, baseWindNorm);

    // Check if this scene uses the universal AI custom_stage or one of the dedicated narrative stages
    if (
      scene.setting === 'custom_stage' ||
      scene.setting === 'attic_discovery' ||
      scene.setting === 'veranda_past' ||
      scene.setting === 'shantipur_memory' ||
      scene.setting === 'rooftop_closure'
    ) {
      let info;
      if (scene.setting === 'custom_stage') {
        info = renderCustomStageScene(
          ctx,
          width,
          height,
          scene,
          sceneProgress,
          wrappedTime,
          controls.showRigOverlay
        );
      } else if (scene.setting === 'attic_discovery') {
        info = renderAtticDiscoveryScene(
          ctx,
          width,
          height,
          sceneProgress,
          wrappedTime,
          project.character,
          controls.showRigOverlay
        );
      } else if (scene.setting === 'veranda_past') {
        info = renderVerandaPastScene(
          ctx,
          width,
          height,
          sceneProgress,
          wrappedTime,
          project.character,
          controls.showRigOverlay
        );
      } else if (scene.setting === 'shantipur_memory') {
        info = renderShantipurMemoryScene(
          ctx,
          width,
          height,
          sceneProgress,
          wrappedTime,
          controls.showRigOverlay
        );
      } else {
        info = renderRooftopClosureScene(
          ctx,
          width,
          height,
          sceneProgress,
          wrappedTime,
          project.character,
          controls.showRigOverlay
        );
      }

      // Allow user-spawned lanterns, shooting stars, and optional weather overlays on top
      this.drawShootingStars(ctx, width, height);
      this.drawSkyLanterns(ctx, width, height, wrappedTime, 0, 2.0);
      if (rainIntensity > 0.05) {
        this.drawRainAndSplashes(ctx, width, height, rainIntensity, baseWindNorm);
      }
      if (snowIntensity > 0.05) {
        this.drawDriftParticles(ctx, width, height, snowIntensity, 'snow', wrappedTime);
      }
      if (petalIntensity > 0.05) {
        this.drawDriftParticles(ctx, width, height, petalIntensity, 'petals', wrappedTime);
      }
      this.drawCinemaVignette(ctx, width, height, rainIntensity);

      const isSettingChangeIn =
        seg.index > 0 && segments[seg.index - 1].scene.setting !== scene.setting;
      const isSettingChangeOut = nextSeg && nextSeg.scene.setting !== scene.setting;
      const fadeIn = isSettingChangeIn ? 1 - smoothstep(0, 0.09, sceneProgress) : 0;
      const fadeOut = isSettingChangeOut ? smoothstep(0.91, 1, sceneProgress) : 0;
      const cutFade = Math.max(fadeIn, fadeOut);
      if (cutFade > 0.01) {
        ctx.fillStyle = `rgba(6, 8, 14, ${(cutFade * 0.94).toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (controls.showSubtitles && scene.narration.trim() && !scene.stage?.thumbnailBanner) {
        const subAlpha =
          smoothstep(0.03, 0.12, sceneProgress) * (1 - smoothstep(0.88, 0.98, sceneProgress));
        this.drawSubtitle(ctx, width, height, scene.narration, subAlpha);
      }

      return {
        timeSec: wrappedTime,
        totalDuration,
        frameNumber: Math.floor(wrappedTime * controls.cadence),
        sceneIndex: seg.index,
        sceneTitle: scene.title,
        sceneNarration: scene.narration,
        hipYOffset: info.hipYOffset,
        leadKneeAngleDeg: info.leadKneeAngleDeg,
        scarfTension: info.scarfTension,
        lanternSwingDeg: info.lanternSwingDeg,
        windSpeedMs,
        weatherDensityPct: Math.round(weatherIntensity * 100),
        activeLanterns: this.lanterns.lanterns.length,
        activeRipples: this.rain.ripples.length,
        skyPhaseLabel: info.skyPhaseLabel,
      };
    }

    const charState = this.traveler.updateAndGetState({
      sceneKey: `${scene.id}-${seg.index}`,
      sceneProgress,
      globalTimeSec: wrappedTime,
      dt,
      width,
      height,
      windX: windPixels,
      rainIntensity,
      setting: scene.setting,
      action: scene.characterAction,
      config: project.character,
      onReleaseLantern: (lx, ly) => {
        this.lanterns.spawnUserLantern(lx, ly);
        onAutoLanternRelease?.();
      },
    });

    const horizonY = height * 0.585;

    // Occasional lightning flash if enabled
    const lightningPulse =
      scene.events.lightning && Math.sin(wrappedTime * 5.7) > 0.965 && Math.cos(wrappedTime * 19.3) > 0.35
        ? 0.55
        : 0;

    // 1. Sky + Sun/Moon/Stars + Shooting Stars
    this.drawSky(ctx, width, height, horizonY, palette, wrappedTime, lightningPulse);
    this.drawShootingStars(ctx, width, height);

    // 2. Painted Volumetric Clouds
    this.drawClouds(ctx, width, height, palette, wrappedTime, baseWindNorm, rainIntensity);

    // 3. Setting-specific Background + Midground + Water
    let transitState = { x: 0, length: 0, visible: false };
    if (scene.setting === 'rainbridge') {
      this.drawRainbridgeMountainsAndLighthouse(ctx, width, height, horizonY, palette, wrappedTime);
      transitState = this.drawViaductAndTrain(
        ctx,
        width,
        height,
        horizonY,
        palette,
        sceneProgress,
        scene.events.passingTrain,
        palette.nightAmount,
        wrappedTime
      );
      this.drawBayWater(ctx, width, height, horizonY, palette, wrappedTime, transitState);
    } else if (scene.setting === 'village_green') {
      this.drawVillageBackdrop(ctx, width, height, horizonY, palette, wrappedTime);
      this.drawBayWater(ctx, width, height, horizonY, palette, wrappedTime, transitState);
    } else if (scene.setting === 'mountain_forest') {
      this.drawAlpineBackdrop(ctx, width, height, horizonY, palette, wrappedTime);
      this.drawBayWater(ctx, width, height, horizonY, palette, wrappedTime, transitState);
    } else if (scene.setting === 'coastal_city') {
      this.drawCitySkylineBackdrop(ctx, width, height, horizonY, palette, wrappedTime);
      transitState = this.drawHarborFerry(
        ctx,
        width,
        height,
        horizonY,
        sceneProgress,
        scene.events.passingTrain
      );
      this.drawBayWater(ctx, width, height, horizonY, palette, wrappedTime, transitState);
    } else {
      this.drawDesertBackdrop(ctx, width, height, horizonY, palette, wrappedTime);
    }

    // 4. Articulated Birds
    if (scene.events.birds) {
      this.drawSeabirds(ctx, width, height, wrappedTime, palette.nightAmount);
    }

    // 5. Distant Sky Lanterns
    this.drawSkyLanterns(ctx, width, height, wrappedTime, 0, 0.72);

    // 6. Setting-specific Ground / Architecture behind Character
    if (scene.setting === 'rainbridge') {
      this.drawStoneBridgeBack(ctx, width, height, palette, wrappedTime, charState);
    } else if (scene.setting === 'village_green') {
      this.drawVillageGroundAndCottage(ctx, width, height, palette, wrappedTime, charState);
    } else if (scene.setting === 'mountain_forest') {
      this.drawAlpineTrailAndCabin(ctx, width, height, palette, wrappedTime, charState);
    } else if (scene.setting === 'coastal_city') {
      this.drawCityPromenade(ctx, width, height, palette, wrappedTime, charState);
    } else {
      this.drawDesertForegroundDune(ctx, width, height, palette, charState);
    }

    // 7. Articulated 2D Protagonist (2-bone IK + Verlet scarf + props)
    this.traveler.draw(
      ctx,
      charState,
      project.character,
      wrappedTime,
      palette.nightAmount,
      baseWindNorm
    );

    // 8. Foreground details: puddle ripples, close lanterns, rain/snow/petals, fireflies, reeds
    this.drawDeckRipples(ctx, width, height, charState);
    this.drawSkyLanterns(ctx, width, height, wrappedTime, 0.72, 2.0);
    this.drawRainAndSplashes(ctx, width, height, rainIntensity, baseWindNorm);
    if (snowIntensity > 0.01) {
      this.drawDriftParticles(ctx, width, height, snowIntensity, 'snow', wrappedTime);
    }
    if (petalIntensity > 0.01) {
      this.drawDriftParticles(ctx, width, height, petalIntensity, 'petals', wrappedTime);
    }
    this.drawFireflies(ctx, width, height, wrappedTime, fireflyStrength);

    if (scene.setting !== 'desert_dunes') {
      this.drawForegroundReeds(ctx, width, height, palette.nightAmount);
    }

    // 9. Cinema Vignette & Smooth Scene Cross-Cut Fade
    this.drawCinemaVignette(ctx, width, height, rainIntensity);

    const isSettingChangeIn =
      seg.index > 0 && segments[seg.index - 1].scene.setting !== scene.setting;
    const isSettingChangeOut =
      nextSeg && nextSeg.scene.setting !== scene.setting;
    const fadeIn = isSettingChangeIn ? 1 - smoothstep(0, 0.08, sceneProgress) : 0;
    const fadeOut = isSettingChangeOut ? smoothstep(0.92, 1, sceneProgress) : 0;
    const cutFade = Math.max(fadeIn, fadeOut);
    if (cutFade > 0.01) {
      ctx.fillStyle = `rgba(6, 8, 14, ${(cutFade * 0.92).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 10. Optional Burned-In Cinema Subtitles (also included in exported video!)
    if (controls.showSubtitles && scene.narration.trim()) {
      const subAlpha =
        smoothstep(0.03, 0.12, sceneProgress) * (1 - smoothstep(0.88, 0.98, sceneProgress));
      this.drawSubtitle(ctx, width, height, scene.narration, subAlpha);
    }

    // 11. Optional Rig & Physics X-Ray Overlay
    if (controls.showRigOverlay) {
      this.drawWindAndGroundRigOverlay(ctx, width, height, scene.setting, baseWindNorm, wrappedTime);
      this.traveler.drawRigOverlay(ctx, charState);
    }

    return {
      timeSec: wrappedTime,
      totalDuration,
      frameNumber: Math.floor(wrappedTime * controls.cadence),
      sceneIndex: seg.index,
      sceneTitle: scene.title,
      sceneNarration: scene.narration,
      hipYOffset: charState.hipYOffset,
      leadKneeAngleDeg: charState.leadKneeAngleDeg,
      scarfTension: charState.scarfTension,
      lanternSwingDeg: charState.lanternSwingDeg,
      windSpeedMs,
      weatherDensityPct: Math.round(weatherIntensity * 100),
      activeLanterns: this.lanterns.lanterns.length + (charState.holdingLantern ? 1 : 0),
      activeRipples: this.rain.ripples.length,
      skyPhaseLabel: skyLabel,
    };
  }

  private drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number,
    lightningPulse: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, rgbToCss(palette.zenith));
    grad.addColorStop(0.56, rgbToCss(palette.mid));
    grad.addColorStop(1, rgbToCss(palette.horizon));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizonY + 2);

    if (lightningPulse > 0) {
      ctx.fillStyle = `rgba(219, 234, 254, ${lightningPulse.toFixed(3)})`;
      ctx.fillRect(0, 0, w, horizonY);
    }

    if (palette.sunStrength > 0.02) {
      const sunX = w * 0.28;
      const sunY = palette.nightAmount < 0.05 ? horizonY * 0.36 : horizonY * 0.94;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, w * 0.38);
      sunGlow.addColorStop(0, `rgba(255, 234, 184, ${(0.55 * palette.sunStrength).toFixed(3)})`);
      sunGlow.addColorStop(0.32, `rgba(244, 152, 92, ${(0.25 * palette.sunStrength).toFixed(3)})`);
      sunGlow.addColorStop(1, 'rgba(234, 141, 82, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, w, horizonY + 4);
    }

    if (palette.starStrength > 0.02) {
      for (const st of this.stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(timeSec * st.speed + st.phase);
        ctx.globalAlpha = palette.starStrength * twinkle * (1 - st.y * 1.1);
        ctx.fillStyle = st.tint;
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h, st.size * (w / 1280), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (palette.moonStrength > 0.02) {
      const mx = w * 0.74;
      const my = h * 0.19;
      const r = 20 * (w / 1280);

      const halo = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r * 6.5);
      halo.addColorStop(0, `rgba(226, 238, 255, ${(0.34 * palette.moonStrength).toFixed(3)})`);
      halo.addColorStop(0.35, `rgba(147, 184, 232, ${(0.14 * palette.moonStrength).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(147, 184, 232, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, r * 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalAlpha = palette.moonStrength;
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgbToCss(lerpColor(palette.zenith, palette.mid, my / horizonY));
      ctx.beginPath();
      ctx.arc(mx - r * 0.44, my - r * 0.14, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawShootingStars(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const m of this.meteors.meteors) {
      const life = 1 - m.age / m.maxAge;
      const alpha = Math.sin(clamp(m.age / m.maxAge, 0, 1) * Math.PI) * 0.9;
      const x1 = m.x * w;
      const y1 = m.y * h;
      const len = m.length * w * (0.4 + 0.6 * life);
      const speedMag = Math.hypot(m.vx, m.vy) || 1;
      const x2 = x1 - (m.vx / speedMag) * len;
      const y2 = y1 - (m.vy / speedMag) * len;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.35, `rgba(186, 230, 253, ${(alpha * 0.55).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2 * (w / 1280);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    timeSec: number,
    windNorm: number,
    rainIntensity: number
  ): void {
    const cloudOpacity = lerp(0.55, 0.84, rainIntensity);
    for (const c of this.clouds) {
      const drift = timeSec * c.speed * (1 + Math.abs(windNorm) * 0.35);
      const cx = ((((c.baseX - drift) % 1.3) + 1.3) % 1.3 - 0.15) * w;
      const cy = c.y * h;

      ctx.save();
      ctx.fillStyle = rgbaToCss(palette.cloudRim, cloudOpacity * 0.38);
      for (const p of c.puffs) {
        ctx.beginPath();
        ctx.ellipse(
          cx + p.dx * w * c.scale,
          cy + (p.dy - 0.004) * h * c.scale,
          p.rx * w * c.scale,
          p.ry * h * c.scale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.fillStyle = rgbaToCss(palette.cloudShadow, cloudOpacity * 0.85);
      for (const p of c.puffs) {
        ctx.beginPath();
        ctx.ellipse(
          cx + p.dx * w * c.scale,
          cy + (p.dy + 0.003) * h * c.scale,
          p.rx * w * c.scale * 0.96,
          p.ry * h * c.scale * 0.9,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ==================== SETTING 1: RAINBRIDGE ====================
  private drawRainbridgeMountainsAndLighthouse(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number
  ): void {
    const nightAmount = palette.nightAmount;
    ctx.fillStyle = rgbToCss(palette.mountainFar);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    const farPts: [number, number][] = [
      [0.0, 0.48], [0.12, 0.44], [0.24, 0.49], [0.37, 0.42],
      [0.50, 0.47], [0.64, 0.41], [0.77, 0.46], [0.91, 0.43], [1.0, 0.48],
    ];
    for (let i = 0; i < farPts.length; i++) {
      const [px, py] = farPts[i];
      if (i === 0) ctx.lineTo(px * w, py * h);
      else {
        const [prevX, prevY] = farPts[i - 1];
        ctx.quadraticCurveTo(prevX * w, prevY * h, ((prevX + px) * 0.5) * w, ((prevY + py) * 0.5) * h);
      }
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    const mistGrad = ctx.createLinearGradient(0, horizonY - h * 0.14, 0, horizonY);
    mistGrad.addColorStop(0, rgbaToCss(palette.horizon, 0));
    mistGrad.addColorStop(1, rgbaToCss(palette.horizon, 0.22));
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, horizonY - h * 0.14, w, h * 0.14);

    ctx.fillStyle = rgbToCss(palette.mountainMid);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(0, h * 0.49);
    ctx.quadraticCurveTo(w * 0.09, h * 0.485, w * 0.17, h * 0.525);
    ctx.quadraticCurveTo(w * 0.25, h * 0.56, w * 0.34, horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w * 0.62, horizonY);
    ctx.quadraticCurveTo(w * 0.74, h * 0.535, w * 0.85, h * 0.505);
    ctx.quadraticCurveTo(w * 0.94, h * 0.485, w, h * 0.51);
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    const villageLit = 0.3 + nightAmount * 0.7;
    for (let i = 0; i < 18; i++) {
      const vx = w * (0.71 + hash1D(i * 19.3) * 0.26);
      const vy = h * (0.535 + hash1D(i * 31.7) * 0.042);
      const flicker = 0.85 + 0.15 * Math.sin(timeSec * 3.1 + i * 2.4);
      ctx.fillStyle = `rgba(255, 206, 118, ${(villageLit * flicker * 0.82).toFixed(2)})`;
      ctx.fillRect(vx, vy, 2.4 * (w / 1280), 2.8 * (w / 1280));
    }

    const lx = w * 0.142;
    const baseY = h * 0.513;
    const scale = w / 1280;
    const towerH = 32 * scale;
    ctx.fillStyle = '#182234';
    ctx.beginPath();
    ctx.moveTo(lx - 4.5 * scale, baseY);
    ctx.lineTo(lx - 2.6 * scale, baseY - towerH);
    ctx.lineTo(lx + 2.6 * scale, baseY - towerH);
    ctx.lineTo(lx + 4.5 * scale, baseY);
    ctx.closePath();
    ctx.fill();

    const lampY = baseY - towerH - 3.5 * scale;
    ctx.fillStyle = '#0e1522';
    ctx.fillRect(lx - 4 * scale, baseY - towerH - 1 * scale, 8 * scale, 2.2 * scale);
    ctx.beginPath();
    ctx.moveTo(lx - 3.6 * scale, lampY - 2.5 * scale);
    ctx.lineTo(lx, lampY - 7.5 * scale);
    ctx.lineTo(lx + 3.6 * scale, lampY - 2.5 * scale);
    ctx.closePath();
    ctx.fill();

    const sweepAngle = Math.sin(timeSec * 0.78) * 0.95;
    const beamReach = Math.cos(sweepAngle);
    if (beamReach > 0.05) {
      const beamLength = w * 0.42 * (0.5 + 0.5 * beamReach);
      const targetAngle = -0.05 + sweepAngle * 0.16;
      const spread = 0.048;
      ctx.save();
      ctx.translate(lx, lampY);
      const beamGrad = ctx.createLinearGradient(0, 0, Math.cos(targetAngle) * beamLength, Math.sin(targetAngle) * beamLength);
      const intensity = (0.14 + nightAmount * 0.18) * beamReach;
      beamGrad.addColorStop(0, `rgba(255, 240, 190, ${(intensity * 1.4).toFixed(3)})`);
      beamGrad.addColorStop(0.35, `rgba(255, 226, 154, ${(intensity * 0.55).toFixed(3)})`);
      beamGrad.addColorStop(1, 'rgba(255, 226, 154, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(targetAngle - spread) * beamLength, Math.sin(targetAngle - spread) * beamLength);
      ctx.lineTo(Math.cos(targetAngle + spread) * beamLength, Math.sin(targetAngle + spread) * beamLength);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const coreGlow = ctx.createRadialGradient(lx, lampY, 1, lx, lampY, 16 * scale);
    coreGlow.addColorStop(0, '#fffbeb');
    coreGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.72)');
    coreGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(lx, lampY, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawViaductAndTrain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    sceneProgress: number,
    showTrain: boolean,
    nightAmount: number,
    timeSec: number
  ): { x: number; length: number; visible: boolean } {
    const deckY = horizonY - h * 0.022;
    const viaductColor = rgbToCss(lerpColor(palette.mountainMid, { r: 10, g: 14, b: 24 }, 0.35));

    ctx.fillStyle = viaductColor;
    ctx.fillRect(w * 0.2, deckY, w * 0.64, h * 0.008);

    const archCount = 12;
    const spanW = (w * 0.64) / archCount;
    for (let i = 0; i <= archCount; i++) {
      const px = w * 0.2 + i * spanW;
      ctx.fillRect(px - spanW * 0.08, deckY, spanW * 0.16, horizonY - deckY + 2);
      if (i < archCount) {
        ctx.beginPath();
        ctx.moveTo(px + spanW * 0.08, deckY + h * 0.008);
        ctx.lineTo(px + spanW * 0.92, deckY + h * 0.008);
        ctx.lineTo(px + spanW * 0.92, deckY + h * 0.016);
        ctx.quadraticCurveTo(px + spanW * 0.5, deckY + h * 0.004, px + spanW * 0.08, deckY + h * 0.016);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (!showTrain) return { x: 0, length: 0, visible: false };

    const trainLen = w * 0.24;
    const trainX = lerp(w * 0.95, w * 0.08 - trainLen, sceneProgress);
    const carCount = 5;
    const carGap = 2.5 * (w / 1280);
    const carW = (trainLen - carGap * (carCount - 1)) / carCount;
    const carH = h * 0.017;
    const carY = deckY - carH;

    const hlGrad = ctx.createLinearGradient(trainX, carY + carH * 0.5, trainX - w * 0.09, carY + carH * 0.6);
    hlGrad.addColorStop(0, `rgba(255, 238, 185, ${(0.45 + nightAmount * 0.3).toFixed(2)})`);
    hlGrad.addColorStop(1, 'rgba(255, 238, 185, 0)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.moveTo(trainX, carY + carH * 0.35);
    ctx.lineTo(trainX - w * 0.09, carY - carH * 0.4);
    ctx.lineTo(trainX - w * 0.09, carY + carH * 1.4);
    ctx.lineTo(trainX, carY + carH * 0.7);
    ctx.closePath();
    ctx.fill();

    for (let c = 0; c < carCount; c++) {
      const cx = trainX + c * (carW + carGap);
      ctx.fillStyle = '#151c2c';
      ctx.beginPath();
      ctx.roundRect(cx, carY, carW, carH, 2);
      ctx.fill();

      const winCount = 5;
      const pad = carW * 0.09;
      const ww = (carW - pad * 2) / winCount - 2;
      ctx.fillStyle = '#fde68a';
      for (let wi = 0; wi < winCount; wi++) {
        ctx.fillRect(cx + pad + wi * (ww + 2), carY + carH * 0.26, ww, carH * 0.42);
      }

      if (c === 1 && Math.sin(timeSec * 37) > 0.94) {
        ctx.fillStyle = 'rgba(147, 197, 253, 0.9)';
        ctx.beginPath();
        ctx.arc(cx + carW * 0.5, carY - 2, 2.5 * (w / 1280), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return { x: trainX, length: trainLen, visible: true };
  }

  private drawStoneBridgeBack(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    timeSec: number,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;
    const nightAmount = palette.nightAmount;

    ctx.strokeStyle = '#192131';
    ctx.lineWidth = 2.4 * scale;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const nx = i / 48;
      const x = nx * w;
      const y = bridgeDeckYNormalized(nx) * h - 34 * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.lineWidth = 1.4 * scale;
    ctx.strokeStyle = 'rgba(24, 32, 48, 0.85)';
    for (let i = 1; i < 48; i++) {
      const nx = i / 48;
      const x = nx * w;
      const dy = bridgeDeckYNormalized(nx) * h;
      ctx.beginPath();
      ctx.moveTo(x, dy);
      ctx.lineTo(x, dy - 34 * scale);
      ctx.stroke();
    }

    const lampPositions = [0.22, 0.78];
    for (const lnx of lampPositions) {
      this.drawVintageLamp(ctx, lnx * w, bridgeDeckYNormalized(lnx) * h, scale, nightAmount, timeSec + lnx * 20);
    }

    // Cozy cottage on right bank
    const cotX = w * 0.905;
    const cotY = bridgeDeckYNormalized(0.94) * h;
    ctx.fillStyle = '#121826';
    ctx.fillRect(cotX, cotY - 76 * scale, w * 0.12, 90 * scale);
    ctx.beginPath();
    ctx.moveTo(cotX - 10 * scale, cotY - 74 * scale);
    ctx.lineTo(cotX + 42 * scale, cotY - 116 * scale);
    ctx.lineTo(w * 1.03, cotY - 74 * scale);
    ctx.closePath();
    ctx.fill();
    this.drawWarmWindow(ctx, cotX + 18 * scale, cotY - 52 * scale, 22 * scale, 28 * scale, scale);

    // Arched bridge body
    const bridgeColor = rgbToCss(lerpColor(palette.mountainMid, { r: 14, g: 18, b: 28 }, 0.55));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      ctx.lineTo(nx * w, bridgeDeckYNormalized(nx) * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const arches = [
      { cx: 0.21, rx: 0.135, topY: 0.805 },
      { cx: 0.50, rx: 0.155, topY: 0.775 },
      { cx: 0.79, rx: 0.135, topY: 0.805 },
    ];
    for (const a of arches) {
      ctx.moveTo((a.cx - a.rx) * w, h + 4);
      ctx.lineTo((a.cx - a.rx) * w, (a.topY + 0.11) * h);
      ctx.quadraticCurveTo(a.cx * w, (a.topY - 0.04) * h, (a.cx + a.rx) * w, (a.topY + 0.11) * h);
      ctx.lineTo((a.cx + a.rx) * w, h + 4);
      ctx.closePath();
    }
    ctx.fillStyle = bridgeColor;
    ctx.fill('evenodd');

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      const x = nx * w;
      const y = bridgeDeckYNormalized(nx) * h + 1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const lnx of lampPositions) {
      this.drawGroundSheen(ctx, lnx * w, bridgeDeckYNormalized(lnx) * h, 64 * scale, 0.24 + nightAmount * 0.18, scale);
    }
    if (charState.holdingLantern) {
      this.drawGroundSheen(ctx, charState.lanternPos.x, charState.y, 54 * scale, 0.42, scale);
    }
    ctx.restore();
  }

  // ==================== SETTING 2: ALPINE MOUNTAIN FOREST ====================
  private drawAlpineBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number
  ): void {
    // Jagged snow-capped alpine peaks
    const peaks: [number, number][] = [
      [0, 0.54], [0.11, 0.34], [0.22, 0.46], [0.36, 0.27], [0.51, 0.44],
      [0.65, 0.29], [0.78, 0.43], [0.90, 0.33], [1.0, 0.49],
    ];
    ctx.fillStyle = rgbToCss(palette.mountainFar);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (const [px, py] of peaks) ctx.lineTo(px * w, py * h);
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Snow ridge accents on tall peaks
    ctx.fillStyle = rgbaToCss(palette.cloudRim, 0.45);
    for (const [px, py] of [peaks[1], peaks[3], peaks[5], peaks[7]]) {
      ctx.beginPath();
      ctx.moveTo(px * w, py * h);
      ctx.lineTo((px - 0.032) * w, (py + 0.058) * h);
      ctx.lineTo(px * w, (py + 0.042) * h);
      ctx.lineTo((px + 0.038) * w, (py + 0.064) * h);
      ctx.closePath();
      ctx.fill();
    }

    // Pine tree forest ridge along lake horizon
    ctx.fillStyle = rgbToCss(palette.mountainMid);
    ctx.fillRect(0, horizonY - h * 0.04, w, h * 0.045);
    for (let i = 0; i < 44; i++) {
      const tx = (i / 43) * w;
      const treeH = (24 + hash1D(i * 19.7) * 34) * (w / 1280);
      const sway = Math.sin(timeSec * 1.6 + i * 0.7) * 1.5;
      ctx.beginPath();
      ctx.moveTo(tx - treeH * 0.28, horizonY);
      ctx.lineTo(tx + sway, horizonY - treeH);
      ctx.lineTo(tx + treeH * 0.28, horizonY);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawAlpineTrailAndCabin(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    timeSec: number,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;

    // Timber mountain cabin on right hill with chimney smoke
    const cabX = w * 0.82;
    const cabY = groundYNormalized('mountain_forest', 0.87) * h;

    // Chimney smoke puffs rising
    for (let i = 0; i < 6; i++) {
      const p = ((timeSec * 0.22 + i / 6) % 1);
      const sx = cabX + 82 * scale + p * 34 * scale + Math.sin(timeSec * 2 + i) * 5;
      const sy = cabY - 96 * scale - p * 68 * scale;
      ctx.fillStyle = `rgba(226, 232, 240, ${((1 - p) * 0.24).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (6 + p * 14) * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#181415';
    ctx.fillRect(cabX + 74 * scale, cabY - 104 * scale, 12 * scale, 32 * scale);
    ctx.fillRect(cabX, cabY - 62 * scale, 108 * scale, 68 * scale);
    ctx.beginPath();
    ctx.moveTo(cabX - 14 * scale, cabY - 58 * scale);
    ctx.lineTo(cabX + 54 * scale, cabY - 102 * scale);
    ctx.lineTo(cabX + 122 * scale, cabY - 58 * scale);
    ctx.closePath();
    ctx.fill();
    this.drawWarmWindow(ctx, cabX + 24 * scale, cabY - 42 * scale, 22 * scale, 22 * scale, scale);
    this.drawWarmWindow(ctx, cabX + 62 * scale, cabY - 42 * scale, 22 * scale, 22 * scale, scale);

    // Tall framing pine silhouettes on left side
    ctx.fillStyle = '#0d151d';
    for (const pnx of [0.04, 0.11, 0.18]) {
      const px = pnx * w;
      const py = groundYNormalized('mountain_forest', pnx) * h + 10;
      const th = (145 + hash1D(pnx * 91) * 55) * scale;
      for (let tier = 0; tier < 3; tier++) {
        const ty = py - th * (0.28 + tier * 0.25);
        const tw = (36 - tier * 8) * scale;
        ctx.beginPath();
        ctx.moveTo(px - tw, ty + 28 * scale);
        ctx.lineTo(px, ty - 28 * scale);
        ctx.lineTo(px + tw, ty + 28 * scale);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Forest ridge ground bank
    const groundColor = rgbToCss(lerpColor(palette.mountainMid, { r: 12, g: 18, b: 24 }, 0.55));
    ctx.fillStyle = groundColor;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      ctx.lineTo(nx * w, groundYNormalized('mountain_forest', nx) * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    if (charState.holdingLantern) {
      this.drawGroundSheen(ctx, charState.lanternPos.x, charState.y, 58 * scale, 0.36, scale);
    }
  }

  // ==================== SETTING 3: COASTAL CITY PROMENADE ====================
  private drawCitySkylineBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number
  ): void {
    const scale = w / 1280;
    const night = palette.nightAmount;

    // Distant harbor suspension bridge
    ctx.strokeStyle = rgbToCss(palette.mountainFar);
    ctx.lineWidth = 2.2 * scale;
    const t1 = w * 0.26;
    const t2 = w * 0.62;
    const towerTop = horizonY - 82 * scale;
    ctx.beginPath();
    ctx.moveTo(t1, horizonY);
    ctx.lineTo(t1, towerTop);
    ctx.moveTo(t2, horizonY);
    ctx.lineTo(t2, towerTop);
    ctx.moveTo(w * 0.1, horizonY - 18 * scale);
    ctx.lineTo(w * 0.8, horizonY - 18 * scale);
    ctx.moveTo(w * 0.12, horizonY - 18 * scale);
    ctx.quadraticCurveTo(t1, towerTop + 8 * scale, t1, towerTop);
    ctx.quadraticCurveTo((t1 + t2) * 0.5, horizonY - 22 * scale, t2, towerTop);
    ctx.quadraticCurveTo(t2, towerTop + 8 * scale, w * 0.78, horizonY - 18 * scale);
    ctx.stroke();

    // Glowing skyline towers on left & right harbor banks
    const bldgColor = rgbToCss(lerpColor(palette.mountainMid, { r: 10, g: 14, b: 24 }, 0.4));
    for (let i = 0; i < 24; i++) {
      const bx = (i / 24) * w;
      if (bx > w * 0.32 && bx < w * 0.58) continue; // open harbor channel
      const bw = (28 + hash1D(i * 13.7) * 34) * scale;
      const bh = (42 + hash1D(i * 27.3) * 105) * scale;
      ctx.fillStyle = bldgColor;
      ctx.fillRect(bx, horizonY - bh, bw, bh + 2);

      // Lit office/apartment windows
      const litAlpha = 0.25 + night * 0.72;
      const rows = Math.floor(bh / (11 * scale));
      const cols = Math.max(2, Math.floor(bw / (9 * scale)));
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (hash1D(i * 71 + r * 17 + c * 5) > 0.52) continue;
          const warm = hash1D(i * 31 + r * 11 + c) > 0.35;
          ctx.fillStyle = warm
            ? `rgba(253, 214, 130, ${(litAlpha * 0.78).toFixed(2)})`
            : `rgba(186, 224, 255, ${(litAlpha * 0.52).toFixed(2)})`;
          ctx.fillRect(bx + 4 * scale + c * 8 * scale, horizonY - bh + r * 10 * scale, 4 * scale, 4.5 * scale);
        }
      }

      // Red aviation beacon on tallest spire
      if (bh > 118 * scale && Math.sin(timeSec * 3 + i) > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx + bw * 0.5, horizonY - bh - 3 * scale, 2.2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawHarborFerry(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    sceneProgress: number,
    showFerry: boolean
  ): { x: number; length: number; visible: boolean } {
    if (!showFerry) return { x: 0, length: 0, visible: false };
    const scale = w / 1280;
    const ferryLen = 96 * scale;
    const fx = lerp(w * 0.88, w * 0.14 - ferryLen, sceneProgress);
    const fy = horizonY + h * 0.055;

    ctx.fillStyle = '#141c2c';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + ferryLen, fy);
    ctx.lineTo(fx + ferryLen - 10 * scale, fy + 11 * scale);
    ctx.lineTo(fx + 10 * scale, fy + 11 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(fx + 14 * scale, fy - 11 * scale, ferryLen - 28 * scale, 11 * scale);
    ctx.fillStyle = '#fde68a';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(fx + (20 + i * 9) * scale, fy - 8 * scale, 5.5 * scale, 4.5 * scale);
    }

    return { x: fx, length: ferryLen, visible: true };
  }

  private drawCityPromenade(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    timeSec: number,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;
    const deckY = groundYNormalized('coastal_city', 0.5) * h;

    // Steel waterfront railing
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(0, deckY - 34 * scale);
    ctx.lineTo(w, deckY - 34 * scale);
    ctx.stroke();

    for (let x = 20; x < w; x += 38 * scale) {
      ctx.beginPath();
      ctx.moveTo(x, deckY);
      ctx.lineTo(x, deckY - 34 * scale);
      ctx.stroke();
    }

    // Modern waterfront lamps
    for (const lnx of [0.16, 0.5, 0.84]) {
      this.drawVintageLamp(ctx, lnx * w, deckY, scale, palette.nightAmount, timeSec + lnx * 14);
    }

    // Wet slate promenade deck
    ctx.fillStyle = '#111722';
    ctx.fillRect(0, deckY, w, h - deckY);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.fillRect(0, deckY, w, 2 * scale);

    for (const lnx of [0.16, 0.5, 0.84]) {
      this.drawGroundSheen(ctx, lnx * w, deckY, 72 * scale, 0.25 + palette.nightAmount * 0.2, scale);
    }
    if (charState.holdingLantern) {
      this.drawGroundSheen(ctx, charState.lanternPos.x, charState.y, 58 * scale, 0.4, scale);
    }
  }

  // ==================== SETTING 5: VILLAGE POND & MANGO GROVE ====================
  private drawVillageBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number
  ): void {
    const scale = w / 1280;

    // Distant lush treeline & mango groves along the village pond horizon
    const farGrove = rgbToCss(lerpColor(palette.mountainFar, { r: 28, g: 58, b: 42 }, 0.45));
    ctx.fillStyle = farGrove;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let i = 0; i <= 28; i++) {
      const nx = i / 28;
      const canopy = 0.045 + Math.abs(Math.sin(nx * 19 + 0.6)) * 0.045 + hash1D(i * 7.3) * 0.02;
      ctx.lineTo(nx * w, horizonY - canopy * h);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Tall Bengal betel-nut / palm tree silhouettes rising above the grove
    const palmColor = rgbToCss(lerpColor(palette.mountainMid, { r: 16, g: 34, b: 26 }, 0.5));
    ctx.strokeStyle = palmColor;
    ctx.fillStyle = palmColor;
    for (const pnx of [0.11, 0.16, 0.23, 0.72, 0.78, 0.89]) {
      const px = pnx * w;
      const trunkH = (62 + hash1D(pnx * 47) * 42) * scale;
      const sway = Math.sin(timeSec * 1.4 + pnx * 14) * 4 * scale;
      ctx.lineWidth = 3.2 * scale;
      ctx.beginPath();
      ctx.moveTo(px, horizonY + 2);
      ctx.quadraticCurveTo(px + sway * 0.4, horizonY - trunkH * 0.55, px + sway, horizonY - trunkH);
      ctx.stroke();

      const cx = px + sway;
      const cy = horizonY - trunkH;
      ctx.lineWidth = 1.9 * scale;
      for (let f = 0; f < 6; f++) {
        const ang = -Math.PI + f * (Math.PI / 2.7) + Math.sin(timeSec * 2 + f) * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
          cx + Math.cos(ang) * 14 * scale,
          cy + Math.sin(ang) * 10 * scale - 4 * scale,
          cx + Math.cos(ang) * 24 * scale,
          cy + Math.sin(ang) * 15 * scale + 7 * scale
        );
        ctx.stroke();
      }
    }

    // Mid mango & banyan tree dome clusters framing the pond bank
    ctx.fillStyle = palmColor;
    for (const [cxn, r] of [
      [0.06, 0.09],
      [0.19, 0.07],
      [0.34, 0.055],
      [0.64, 0.06],
      [0.84, 0.085],
      [0.95, 0.075],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cxn * w, horizonY - r * h * 0.32, r * w * 0.95, r * h * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawVillageGroundAndCottage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    timeSec: number,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;

    // Gently bobbing pond lotus / water-lily pads on the water
    for (let i = 0; i < 9; i++) {
      const lx = (0.14 + hash1D(i * 29.1) * 0.68) * w;
      const ly = h * (0.64 + hash1D(i * 17.7) * 0.09);
      const bob = Math.sin(timeSec * 2.2 + i * 1.4) * 1.6 * scale;
      ctx.fillStyle = 'rgba(26, 62, 46, 0.72)';
      ctx.beginPath();
      ctx.ellipse(lx, ly + bob, 9 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(251, 207, 232, 0.82)';
        ctx.beginPath();
        ctx.arc(lx + 1 * scale, ly + bob - 1.5 * scale, 2.4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Rustic village home with curved tin/thatch roof and warm hurricane-lamp window
    const hutX = w * 0.79;
    const hutY = groundYNormalized('village_green', 0.84) * h;

    ctx.fillStyle = '#181c1a';
    ctx.fillRect(hutX, hutY - 58 * scale, 114 * scale, 66 * scale);
    // Traditional curved Bengal chala roof
    ctx.beginPath();
    ctx.moveTo(hutX - 16 * scale, hutY - 52 * scale);
    ctx.quadraticCurveTo(hutX + 57 * scale, hutY - 104 * scale, hutX + 130 * scale, hutY - 52 * scale);
    ctx.quadraticCurveTo(hutX + 57 * scale, hutY - 62 * scale, hutX - 16 * scale, hutY - 52 * scale);
    ctx.closePath();
    ctx.fill();

    this.drawWarmWindow(ctx, hutX + 26 * scale, hutY - 38 * scale, 22 * scale, 22 * scale, scale);
    this.drawWarmWindow(ctx, hutX + 66 * scale, hutY - 38 * scale, 22 * scale, 22 * scale, scale);

    // Overhanging mango tree branch silhouette on left side
    ctx.fillStyle = '#0e1914';
    ctx.beginPath();
    ctx.ellipse(w * 0.04, h * 0.56, 86 * scale, 58 * scale, 0.15, 0, Math.PI * 2);
    ctx.ellipse(w * 0.11, h * 0.60, 62 * scale, 42 * scale, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.02, h * 0.58, 16 * scale, h * 0.25);

    // Foreground grassy meadow & village earth path
    const meadowColor = rgbToCss(lerpColor(palette.mountainMid, { r: 24, g: 46, b: 30 }, 0.55));
    ctx.fillStyle = meadowColor;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      ctx.lineTo(nx * w, groundYNormalized('village_green', nx) * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle sunlit dusty village path ridge
    ctx.strokeStyle = rgbaToCss(palette.horizon, 0.22);
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      const x = nx * w;
      const y = groundYNormalized('village_green', nx) * h + 1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (charState.holdingLantern) {
      this.drawGroundSheen(ctx, charState.lanternPos.x, charState.y, 58 * scale, 0.38, scale);
    }
  }

  // ==================== SETTING 4: STARLIT DESERT DUNES ====================
  private drawDesertBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number
  ): void {
    // Far sculpted sand dunes
    const farDune = rgbToCss(lerpColor(palette.mountainFar, { r: 162, g: 112, b: 78 }, 0.35));
    ctx.fillStyle = farDune;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const nx = i / 40;
      const y = horizonY - h * 0.04 + Math.sin(nx * Math.PI * 2.4 + 0.6) * h * 0.045;
      ctx.lineTo(nx * w, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Mid dune wave
    const midDune = rgbToCss(lerpColor(palette.mountainMid, { r: 118, g: 76, b: 54 }, 0.35));
    ctx.fillStyle = midDune;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 40; i++) {
      const nx = i / 40;
      const y = horizonY + h * 0.07 + Math.cos(nx * Math.PI * 1.9) * h * 0.042;
      ctx.lineTo(nx * w, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Oasis palm silhouette on far right dune
    const scale = w / 1280;
    const px = w * 0.82;
    const py = horizonY + h * 0.075;
    ctx.strokeStyle = '#12121d';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - 6 * scale, py - 24 * scale, px + 4 * scale, py - 46 * scale);
    ctx.stroke();

    const crownX = px + 4 * scale;
    const crownY = py - 46 * scale;
    ctx.lineWidth = 2.2 * scale;
    for (let f = 0; f < 5; f++) {
      const ang = -Math.PI * 0.9 + f * 0.52 + Math.sin(timeSec * 1.8 + f) * 0.05;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(
        crownX + Math.cos(ang) * 14 * scale,
        crownY + Math.sin(ang) * 12 * scale - 4 * scale,
        crownX + Math.cos(ang) * 24 * scale,
        crownY + Math.sin(ang) * 16 * scale + 6 * scale
      );
      ctx.stroke();
    }
  }

  private drawDesertForegroundDune(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;
    const fgDune = rgbToCss(lerpColor(palette.mountainMid, { r: 62, g: 42, b: 36 }, 0.5));
    ctx.fillStyle = fgDune;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      ctx.lineTo(nx * w, groundYNormalized('desert_dunes', nx) * h);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Rim-lit dune ridge
    ctx.strokeStyle = rgbaToCss(palette.cloudRim, 0.25);
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const nx = i / 50;
      const x = nx * w;
      const y = groundYNormalized('desert_dunes', nx) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (charState.holdingLantern) {
      this.drawGroundSheen(ctx, charState.lanternPos.x, charState.y, 54 * scale, 0.34, scale);
    }
  }

  // ==================== SHARED WATER, LAMPS, WEATHER, SUBTITLES ====================
  private drawVintageLamp(
    ctx: CanvasRenderingContext2D,
    lx: number,
    baseY: number,
    scale: number,
    nightAmount: number,
    phase: number
  ): void {
    const topY = baseY - 100 * scale;
    const flicker = 0.94 + 0.06 * Math.sin(phase * 7.2);
    const glowAlpha = (0.3 + nightAmount * 0.7) * flicker;

    ctx.strokeStyle = '#111622';
    ctx.lineWidth = 3.6 * scale;
    ctx.beginPath();
    ctx.moveTo(lx, baseY);
    ctx.lineTo(lx, topY);
    ctx.stroke();

    ctx.fillStyle = '#0f1420';
    ctx.beginPath();
    ctx.moveTo(lx - 9 * scale, topY + 2 * scale);
    ctx.lineTo(lx, topY - 10 * scale);
    ctx.lineTo(lx + 9 * scale, topY + 2 * scale);
    ctx.closePath();
    ctx.fill();

    const halo = ctx.createRadialGradient(lx, topY + 6 * scale, 2, lx, topY + 6 * scale, 96 * scale);
    halo.addColorStop(0, `rgba(255, 232, 162, ${(0.68 * glowAlpha).toFixed(3)})`);
    halo.addColorStop(0.28, `rgba(245, 158, 11, ${(0.24 * glowAlpha).toFixed(3)})`);
    halo.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lx, topY + 6 * scale, 96 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.roundRect(lx - 4.5 * scale, topY + 1.5 * scale, 9 * scale, 11 * scale, 2 * scale);
    ctx.fill();
  }

  private drawWarmWindow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rw: number,
    rh: number,
    scale: number
  ): void {
    const glow = ctx.createRadialGradient(x + rw * 0.5, y + rh * 0.5, 2, x + rw * 0.5, y + rh * 0.5, 62 * scale);
    glow.addColorStop(0, 'rgba(255, 214, 130, 0.45)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x + rw * 0.5, y + rh * 0.5, 62 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = 1.8 * scale;
    ctx.strokeRect(x, y, rw, rh);
    ctx.beginPath();
    ctx.moveTo(x + rw * 0.5, y);
    ctx.lineTo(x + rw * 0.5, y + rh);
    ctx.moveTo(x, y + rh * 0.5);
    ctx.lineTo(x + rw, y + rh * 0.5);
    ctx.stroke();
  }

  private drawGroundSheen(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radiusX: number,
    alpha: number,
    scale: number
  ): void {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, radiusX);
    g.addColorStop(0, `rgba(255, 206, 118, ${alpha.toFixed(3)})`);
    g.addColorStop(0.55, `rgba(245, 158, 11, ${(alpha * 0.35).toFixed(3)})`);
    g.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * scale, radiusX, 11 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBayWater(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    palette: SkyPalette,
    timeSec: number,
    transitState: { x: number; length: number; visible: boolean }
  ): void {
    const waterH = h - horizonY;
    const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    waterGrad.addColorStop(0, rgbToCss(palette.waterTop));
    waterGrad.addColorStop(0.42, rgbToCss(lerpColor(palette.waterTop, palette.waterBottom, 0.55)));
    waterGrad.addColorStop(1, rgbToCss(palette.waterBottom));
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, horizonY, w, waterH);

    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      const y = horizonY + Math.pow(t, 1.45) * waterH * 0.72;
      const waveShift = Math.sin(timeSec * 1.4 + i * 0.85) * 18 * (0.4 + t);
      ctx.fillStyle = rgbaToCss(palette.horizon, 0.04 + (1 - t) * 0.05);
      ctx.fillRect(waveShift, y, w, 1.2 + t * 2.1);
    }

    if (palette.sunStrength > 0.04) {
      this.drawWaterShimmerColumn(ctx, w * 0.28, horizonY, waterH * 0.56, 70 * (w / 1280), '252, 180, 108', palette.sunStrength * 0.4, timeSec);
    }
    if (palette.moonStrength > 0.04) {
      this.drawWaterShimmerColumn(ctx, w * 0.74, horizonY, waterH * 0.6, 34 * (w / 1280), '214, 232, 255', palette.moonStrength * 0.48, timeSec);
    }

    if (transitState.visible) {
      for (let i = 0; i < 12; i++) {
        const rx = transitState.x + (i / 11) * transitState.length;
        this.drawWaterShimmerColumn(
          ctx,
          rx,
          horizonY + 2,
          waterH * 0.24,
          7 * (w / 1280),
          '253, 224, 130',
          0.26 + palette.nightAmount * 0.24,
          timeSec + i * 0.4
        );
      }
    }

    for (const l of this.lanterns.lanterns) {
      if (l.alpha < 0.08 || l.y > 0.62) continue;
      const distAbove = clamp(0.62 - l.y, 0.05, 0.65);
      const refAlpha = l.alpha * (0.28 - distAbove * 0.22);
      if (refAlpha <= 0.02) continue;
      this.drawWaterShimmerColumn(
        ctx,
        l.x * w,
        horizonY + 4,
        waterH * 0.32 * l.depth,
        9 * l.depth * (w / 1280),
        '251, 185, 76',
        refAlpha,
        timeSec + l.phase
      );
    }

    for (const rp of this.rain.ripples) {
      if (!rp.isWater) continue;
      const p = rp.age / rp.maxAge;
      const radiusX = rp.maxRadius * p * w;
      ctx.strokeStyle = `rgba(195, 220, 245, ${((1 - p) * 0.34).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rp.x * w, rp.y * h, radiusX, radiusX * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawWaterShimmerColumn(
    ctx: CanvasRenderingContext2D,
    cx: number,
    startY: number,
    length: number,
    baseWidth: number,
    rgbStr: string,
    alpha: number,
    timeSec: number
  ): void {
    const slices = 12;
    for (let i = 0; i < slices; i++) {
      const t = i / slices;
      const y = startY + Math.pow(t, 1.35) * length;
      const wobble = Math.sin(timeSec * 3.8 + i * 1.35) * baseWidth * (0.25 + t * 0.45);
      const sw = baseWidth * (0.35 + t * 1.25) * (0.75 + 0.25 * Math.cos(timeSec * 2.5 + i));
      const a = alpha * (1 - t * 0.85);
      ctx.fillStyle = `rgba(${rgbStr}, ${a.toFixed(3)})`;
      ctx.fillRect(cx + wobble - sw * 0.5, y, sw, 1.6 + t * 1.4);
    }
  }

  private drawSeabirds(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    nightAmount: number
  ): void {
    ctx.strokeStyle = nightAmount > 0.5 ? 'rgba(15, 23, 42, 0.85)' : 'rgba(26, 28, 46, 0.82)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const speed = 0.036 + (i % 3) * 0.004;
      const progress = ((timeSec * speed + i * 0.19 + 0.12) % 1.35) - 0.18;
      const bx = progress * w;
      const by = (0.28 + Math.sin(progress * 4 + i) * 0.025 + i * 0.018) * h;
      const wingSpan = (7.5 + (i % 2) * 2.5) * (w / 1280);
      const flap = Math.sin(timeSec * 6.4 + i * 1.4) * wingSpan * 0.55;

      ctx.lineWidth = 1.6 * (w / 1280);
      ctx.beginPath();
      ctx.moveTo(bx - wingSpan, by - flap);
      ctx.quadraticCurveTo(bx - wingSpan * 0.45, by - wingSpan * 0.35 - flap * 0.3, bx, by);
      ctx.quadraticCurveTo(bx + wingSpan * 0.45, by - wingSpan * 0.35 - flap * 0.3, bx + wingSpan, by - flap);
      ctx.stroke();
    }
  }

  private drawSkyLanterns(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    minDepth: number,
    maxDepth: number
  ): void {
    const baseScale = w / 1280;
    for (const l of this.lanterns.lanterns) {
      if (l.depth < minDepth || l.depth >= maxDepth || l.alpha <= 0.01) continue;
      const x = l.x * w;
      const y = l.y * h;
      const s = l.depth * baseScale;
      const flicker = 0.92 + 0.08 * Math.sin(timeSec * 9.5 + l.phase);

      const haloR = 36 * s * flicker;
      const halo = ctx.createRadialGradient(x, y, 1, x, y, haloR);
      halo.addColorStop(0, `rgba(255, 224, 140, ${(0.52 * l.alpha).toFixed(3)})`);
      halo.addColorStop(0.38, `rgba(245, 158, 11, ${(0.22 * l.alpha).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(timeSec * 1.4 + l.phase) * 0.08);
      ctx.globalAlpha = l.alpha;

      const bodyW = 9.5 * s;
      const bodyH = 13.5 * s;
      const lGrad = ctx.createLinearGradient(0, -bodyH * 0.5, 0, bodyH * 0.5);
      lGrad.addColorStop(0, '#ea580c');
      lGrad.addColorStop(0.45, '#f59e0b');
      lGrad.addColorStop(0.82, '#fde68a');
      lGrad.addColorStop(1, '#fffbeb');
      ctx.fillStyle = lGrad;

      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.38, bodyH * 0.48);
      ctx.quadraticCurveTo(-bodyW * 0.62, 0, -bodyW * 0.44, -bodyH * 0.48);
      ctx.quadraticCurveTo(0, -bodyH * 0.64, bodyW * 0.44, -bodyH * 0.48);
      ctx.quadraticCurveTo(bodyW * 0.62, 0, bodyW * 0.38, bodyH * 0.48);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawDeckRipples(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    charState: CharacterRenderState
  ): void {
    const scale = w / 1280;
    for (const rp of this.rain.ripples) {
      if (rp.isWater) continue;
      const p = rp.age / rp.maxAge;
      const rx = rp.maxRadius * p * w;
      const nearLantern =
        charState.holdingLantern && Math.abs(rp.x * w - charState.lanternPos.x) < 90 * scale;
      ctx.strokeStyle = nearLantern
        ? `rgba(253, 211, 128, ${((1 - p) * 0.6).toFixed(3)})`
        : `rgba(186, 212, 238, ${((1 - p) * 0.42).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(rp.x * w, rp.y * h, rx, rx * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawRainAndSplashes(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rainIntensity: number,
    windNorm: number
  ): void {
    if (rainIntensity <= 0.01 && this.rain.splashes.length === 0) return;

    const activeCount = Math.floor(this.rain.drops.length * clamp(rainIntensity, 0, 1));
    ctx.lineCap = 'round';
    for (let i = 0; i < activeCount; i++) {
      const d = this.rain.drops[i];
      const x1 = d.x * w;
      const y1 = d.y * h;
      const dx = windNorm * 0.14 * d.length * w;
      const dy = d.length * h;

      ctx.strokeStyle = `rgba(198, 220, 244, ${(0.12 + d.depth * 0.28).toFixed(3)})`;
      ctx.lineWidth = 0.7 + d.depth * 0.9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dx, y1 + dy);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(214, 232, 250, 0.55)';
    for (const sp of this.rain.splashes) {
      ctx.globalAlpha = (1 - sp.age / sp.maxAge) * 0.65;
      ctx.beginPath();
      ctx.arc(sp.x * w, sp.y * h, 1.35 * (w / 1280), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawDriftParticles(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    intensity: number,
    mode: 'snow' | 'petals',
    timeSec: number
  ): void {
    const scale = w / 1280;
    const active = Math.floor(this.driftWeather.particles.length * clamp(intensity, 0, 1));
    for (let i = 0; i < active; i++) {
      const p = this.driftWeather.particles[i];
      const x = p.x * w;
      const y = p.y * h;
      const r = p.size * scale;

      if (mode === 'snow') {
        ctx.fillStyle = `rgba(241, 245, 249, ${(0.35 + p.depth * 0.5).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(timeSec * p.spin + p.phase);
        ctx.fillStyle = `rgba(251, 182, 206, ${(0.55 + p.depth * 0.35).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.15, r * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawFireflies(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    timeSec: number,
    strength: number
  ): void {
    if (strength <= 0.04) return;
    const scale = w / 1280;
    for (const f of this.fireflies.flies) {
      const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 2.4 + f.phase), 2);
      const x = f.x * w;
      const y = f.y * h;
      const r = f.size * 5.2 * scale;
      const glow = ctx.createRadialGradient(x, y, 0.5, x, y, r);
      glow.addColorStop(0, `rgba(254, 240, 138, ${(0.85 * pulse * strength).toFixed(3)})`);
      glow.addColorStop(0.4, `rgba(250, 204, 21, ${(0.3 * pulse * strength).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawForegroundReeds(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    nightAmount: number
  ): void {
    const scale = w / 1280;
    const reedColor = nightAmount > 0.45 ? '#070a12' : '#0d1320';
    ctx.strokeStyle = reedColor;
    ctx.fillStyle = reedColor;
    ctx.lineCap = 'round';
    for (const b of this.reeds.blades) {
      const x0 = b.baseX * w;
      const y0 = b.baseY * h;
      const len = b.height * h;
      const ctrlX = x0 + Math.sin(b.angle * 0.55) * len * 0.55;
      const ctrlY = y0 - Math.cos(b.angle * 0.55) * len * 0.55;
      const tipX = x0 + Math.sin(b.angle) * len;
      const tipY = y0 - Math.cos(b.angle) * len;

      ctx.lineWidth = b.thickness * scale;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();

      if (b.hasSeedHead) {
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(b.angle);
        ctx.beginPath();
        ctx.ellipse(0, 4 * scale, 2.6 * scale, 8.5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawCinemaVignette(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    rainIntensity: number
  ): void {
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.48, w * 0.28, w * 0.5, h * 0.5, w * 0.72);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, `rgba(4, 6, 12, ${(0.4 + rainIntensity * 0.14).toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSubtitle(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    text: string,
    alpha: number
  ): void {
    if (alpha <= 0.02) return;
    const scale = w / 1280;
    const fontSize = Math.max(13, Math.round(21 * scale));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 ${fontSize}px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = w * 0.78;
    const measured = Math.min(ctx.measureText(text).width, maxWidth);
    const padX = 18 * scale;
    const boxH = fontSize * 1.75;
    const y = h - 38 * scale;

    ctx.fillStyle = 'rgba(7, 9, 14, 0.62)';
    ctx.beginPath();
    ctx.roundRect(w * 0.5 - measured * 0.5 - padX, y - boxH * 0.5, measured + padX * 2, boxH, 8 * scale);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(text, w * 0.5, y, maxWidth);
    ctx.restore();
  }

  private drawWindAndGroundRigOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    setting: SceneSpec['setting'],
    windNorm: number,
    timeSec: number
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const nx = i / 40;
      const x = nx * w;
      const y = groundYNormalized(setting, nx) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)';
    ctx.lineWidth = 1.1;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        const vx = ((c + 0.5) / 6) * w;
        const vy = (0.14 + r * 0.16) * h;
        const localWind = windNorm + fbm1D(timeSec * 0.6 + c * 0.7, 2) * 0.25;
        const dx = clamp(localWind * 36, -48, 48);
        const dy = Math.sin(timeSec * 1.5 + c) * 5;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(vx + dx, vy + dy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vx + dx, vy + dy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
