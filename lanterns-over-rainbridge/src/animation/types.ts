export interface Vec2 {
  x: number;
  y: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type SettingType =
  | 'custom_stage'
  | 'attic_discovery'
  | 'veranda_past'
  | 'shantipur_memory'
  | 'rooftop_closure'
  | 'rainbridge'
  | 'village_green'
  | 'mountain_forest'
  | 'coastal_city'
  | 'desert_dunes';

export type TimeOfDayType =
  | 'golden_dusk'
  | 'storm_twilight'
  | 'starry_night'
  | 'moonlit'
  | 'pre_dawn'
  | 'sunny_afternoon';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fireflies' | 'petals';

export type CharacterActionType =
  | 'walk_right'
  | 'walk_left'
  | 'run_right'
  | 'stand_look_sky'
  | 'raise_lantern';

export type PropType = 'lantern' | 'umbrella' | 'staff' | 'none';

export type EngineBackdropType =
  | 'outdoor_landscape'
  | 'night_water'
  | 'sunset_field'
  | 'rooftop'
  | 'veranda'
  | 'indoor_room'
  | 'rural_bengal'
  | 'courtyard';

export type EngineActorAge = 'child' | 'youth' | 'adult' | 'elder';

export type EngineActorPose =
  | 'walk'
  | 'run'
  | 'stand'
  | 'kneel'
  | 'sit'
  | 'reach'
  | 'hold_hands'
  | 'raise_prop'
  | 'look_sky';

export type EngineActorProp =
  | 'none'
  | 'lantern'
  | 'letter'
  | 'red_box'
  | 'umbrella'
  | 'staff'
  | 'book'
  | 'flower'
  | 'deed_paper'
  | 'tasbih'
  | 'cane'
  | 'bag';

export type EngineActorEmotion = 'neutral' | 'smile' | 'tender' | 'wonder' | 'solemn' | 'cry' | 'sad' | 'angry' | 'worried';

export type BengaliCharacterRole =
  | 'elder_father'
  | 'mother'
  | 'brother'
  | 'young_brother'
  | 'daughter'
  | 'wife'
  | 'matobbor'
  | 'traveler';

export interface EngineActorSpec {
  id: string;
  name: string;
  ageStyle?: EngineActorAge;
  characterRole?: BengaliCharacterRole;
  coatColor: string;
  scarfColor?: string;
  hairColor?: string;
  skinTone?: string;
  glasses?: boolean;
  hasTears?: boolean;
  hasLungi?: boolean;
  lungiColor?: string;
  hasTupi?: boolean;
  hasBeard?: boolean;
  hasHijab?: boolean;
  hasSaree?: boolean;
  scale?: number; // 0.6..1.5
  xStart: number; // 0..1
  xEnd?: number; // 0..1
  yGround?: number; // 0.45..0.95
  facing?: 1 | -1;
  pose: EngineActorPose;
  propInHand?: EngineActorProp;
  emotion?: EngineActorEmotion;
  speech?: string;
}

export type EnginePropKind =
  | 'trunk'
  | 'tin_box'
  | 'envelope'
  | 'table'
  | 'easy_chair'
  | 'books_stack'
  | 'lamp'
  | 'clay_pot'
  | 'banyan_tree'
  | 'steam_train'
  | 'boat'
  | 'cottage'
  | 'bridge'
  | 'window_beam'
  | 'curtain'
  | 'kite'
  | 'campfire'
  | 'bench'
  | 'street_lamp'
  | 'tea_stall'
  | 'tin_house'
  | 'bamboo_fence'
  | 'palm_tree'
  | 'banana_tree'
  | 'khatia'
  | 'certificate_frame';

export type EnginePropMotion = 'static' | 'float' | 'sway' | 'move_across' | 'open_reveal';

export interface EnginePropSpec {
  id?: string;
  kind: EnginePropKind;
  x: number; // 0..1
  y: number; // 0..1
  xEnd?: number; // 0..1 (used when motion === 'move_across')
  yEnd?: number;
  scale?: number; // 0.3..2.5
  rotation?: number; // radians
  color?: string;
  accentColor?: string;
  label?: string;
  motion?: EnginePropMotion;
}

export type EngineParticleKind =
  | 'petals'
  | 'dust_motes'
  | 'envelopes'
  | 'fireflies'
  | 'rain'
  | 'snow'
  | 'steam'
  | 'embers'
  | 'birds';

export interface EngineParticleSpec {
  kind: EngineParticleKind;
  count?: number;
  color?: string;
  originX?: number;
  originY?: number;
  intensity?: number; // 0..1
}

export interface EngineCameraSpec {
  zoomStart?: number; // 1.0..1.35
  zoomEnd?: number;
  panXStart?: number; // -0.15..0.15
  panXEnd?: number;
  panYStart?: number; // -0.1..0.1
  panYEnd?: number;
}

export interface CustomStageSpec {
  backdrop: {
    type: EngineBackdropType;
    skyTop?: string;
    skyMid?: string;
    skyHorizon?: string;
    wallColor?: string;
    floorColor?: string;
    floorY?: number; // 0.5..0.92
    waterY?: number; // 0.5..0.85
    sunX?: number;
    sunY?: number;
    showMoon?: boolean;
    showStars?: boolean;
    sunbeam?: boolean;
    sunbeamColor?: string;
  };
  camera?: EngineCameraSpec;
  actors?: EngineActorSpec[];
  props?: EnginePropSpec[];
  particles?: EngineParticleSpec[];
  thumbnailBanner?: {
    title: string;
    subtitle: string;
    tag?: string;
  };
}

export interface CharacterConfig {
  name: string;
  coatColor: string;
  scarfColor: string;
  hairColor: string;
  prop: PropType;
}

export interface SceneEvents {
  passingTrain: boolean;
  skyLanterns: boolean;
  shootingStars: boolean;
  birds: boolean;
  lightning: boolean;
}

export interface SceneSpec {
  id: string;
  title: string;
  narration: string;
  durationSec: number;
  setting: SettingType;
  timeOfDay: TimeOfDayType;
  weather: WeatherType;
  weatherIntensity: number; // 0..1
  windStrength: number; // 0..2.2
  characterAction: CharacterActionType;
  events: SceneEvents;
  stage?: CustomStageSpec;
}

export interface AnimationProject {
  engineVersion?: string;
  title: string;
  tagline: string;
  scriptText: string;
  character: CharacterConfig;
  scenes: SceneSpec[];
}

export interface TimelineSegment {
  scene: SceneSpec;
  index: number;
  startSec: number;
  endSec: number;
}

export function buildTimeline(scenes: SceneSpec[]): {
  segments: TimelineSegment[];
  totalDuration: number;
} {
  let cursor = 0;
  const segments: TimelineSegment[] = scenes.map((scene, index) => {
    const dur = Math.max(3, scene.durationSec);
    const seg: TimelineSegment = {
      scene,
      index,
      startSec: cursor,
      endSec: cursor + dur,
    };
    cursor += dur;
    return seg;
  });
  return { segments, totalDuration: Math.max(cursor, 1) };
}

export type CadenceMode = 60 | 24;

export interface DirectorControls {
  timeOfDayOverride: number | null; // 0..1 or null for scene script lighting
  windMultiplier: number; // 0..2.5 (1.0 default)
  weatherIntensityOverride: number | null; // 0..1 or null for scene script
  cadence: CadenceMode;
  showRigOverlay: boolean;
  showSubtitles: boolean;
  playbackSpeed: number;
}

export interface FrameMetrics {
  timeSec: number;
  totalDuration: number;
  frameNumber: number;
  sceneIndex: number;
  sceneTitle: string;
  sceneNarration: string;
  hipYOffset: number;
  leadKneeAngleDeg: number;
  scarfTension: number;
  lanternSwingDeg: number;
  windSpeedMs: number;
  weatherDensityPct: number;
  activeLanterns: number;
  activeRipples: number;
  skyPhaseLabel: string;
}

export const SETTING_LABELS: Record<SettingType, string> = {
  custom_stage: 'AI Custom Stage (JSON Blueprint)',
  attic_discovery: 'চিলেকোঠা (Attic Trunk)',
  veranda_past: 'বারান্দা (Afternoon Veranda)',
  shantipur_memory: 'শান্তিপুর ঘাট ১৯৬৮ (Banyan & Train)',
  rooftop_closure: 'বিকেলের ছাদ (Golden Rooftop)',
  rainbridge: 'Coastal Rainbridge',
  village_green: 'Village Pond & Grove',
  mountain_forest: 'Alpine Forest',
  coastal_city: 'Harbor Promenade',
  desert_dunes: 'Starlit Dunes',
};

export const TIME_LABELS: Record<TimeOfDayType, string> = {
  golden_dusk: 'Golden Dusk',
  storm_twilight: 'Storm Twilight',
  starry_night: 'Starry Night',
  moonlit: 'Moonlit Bay',
  pre_dawn: 'Pre-Dawn',
  sunny_afternoon: 'Warm Afternoon',
};

export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: 'Clear',
  rain: 'Rain',
  snow: 'Snowfall',
  fireflies: 'Fireflies',
  petals: 'Blossom Petals',
};

export const ACTION_LABELS: Record<CharacterActionType, string> = {
  walk_right: 'Walk Forward',
  walk_left: 'Walk Left',
  run_right: 'Run Forward',
  stand_look_sky: 'Pause & Gaze Up',
  raise_lantern: 'Raise & Release Lantern',
};

export const PROP_LABELS: Record<PropType, string> = {
  lantern: 'Paper Lantern',
  umbrella: 'Rain Umbrella',
  staff: 'Traveler Staff',
  none: 'Empty Hands',
};
