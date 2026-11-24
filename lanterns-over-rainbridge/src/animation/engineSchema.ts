import {
  AnimationProject,
  CharacterActionType,
  CustomStageSpec,
  EngineActorAge,
  EngineActorEmotion,
  EngineActorPose,
  EngineActorProp,
  EngineActorSpec,
  EngineBackdropType,
  EngineParticleKind,
  EngineParticleSpec,
  EnginePropKind,
  EnginePropMotion,
  EnginePropSpec,
  PropType,
  SceneSpec,
  SettingType,
  TimeOfDayType,
  WeatherType,
} from './types';

export const ENGINE_VERSION = '1.0.0';

export const VALID_SETTINGS: SettingType[] = [
  'custom_stage',
  'attic_discovery',
  'veranda_past',
  'shantipur_memory',
  'rooftop_closure',
  'rainbridge',
  'village_green',
  'mountain_forest',
  'coastal_city',
  'desert_dunes',
];

export const VALID_TIMES: TimeOfDayType[] = [
  'golden_dusk',
  'storm_twilight',
  'starry_night',
  'moonlit',
  'pre_dawn',
  'sunny_afternoon',
];

export const VALID_WEATHERS: WeatherType[] = [
  'clear',
  'rain',
  'snow',
  'fireflies',
  'petals',
];

export const VALID_ACTIONS: CharacterActionType[] = [
  'walk_right',
  'walk_left',
  'run_right',
  'stand_look_sky',
  'raise_lantern',
];

export const VALID_BACKDROPS: EngineBackdropType[] = [
  'outdoor_landscape',
  'night_water',
  'sunset_field',
  'rooftop',
  'veranda',
  'indoor_room',
  'rural_bengal',
  'courtyard',
];

export const VALID_POSES: EngineActorPose[] = [
  'walk',
  'run',
  'stand',
  'kneel',
  'sit',
  'reach',
  'hold_hands',
  'raise_prop',
  'look_sky',
];

export const VALID_ACTOR_PROPS: EngineActorProp[] = [
  'none',
  'lantern',
  'letter',
  'red_box',
  'umbrella',
  'staff',
  'book',
  'flower',
  'deed_paper',
  'tasbih',
  'cane',
  'bag',
];

export const VALID_PROP_KINDS: EnginePropKind[] = [
  'trunk',
  'tin_box',
  'envelope',
  'table',
  'easy_chair',
  'books_stack',
  'lamp',
  'clay_pot',
  'banyan_tree',
  'steam_train',
  'boat',
  'cottage',
  'bridge',
  'window_beam',
  'curtain',
  'kite',
  'campfire',
  'bench',
  'street_lamp',
  'tea_stall',
  'tin_house',
  'bamboo_fence',
  'palm_tree',
  'banana_tree',
  'khatia',
  'certificate_frame',
];

export const VALID_PARTICLE_KINDS: EngineParticleKind[] = [
  'petals',
  'dust_motes',
  'envelopes',
  'fireflies',
  'rain',
  'snow',
  'steam',
  'embers',
  'birds',
];

const VALID_AGES: EngineActorAge[] = ['child', 'youth', 'adult', 'elder'];
const VALID_EMOTIONS: EngineActorEmotion[] = [
  'neutral',
  'smile',
  'tender',
  'wonder',
  'solemn',
];
const VALID_MOTIONS: EnginePropMotion[] = [
  'static',
  'float',
  'sway',
  'move_across',
  'open_reveal',
];

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

export interface BlueprintValidationResult {
  ok: boolean;
  project?: AnimationProject;
  errors: string[];
  warnings: string[];
}

export function validateAndNormalizeBlueprint(raw: unknown): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: ['Blueprint must be a JSON object with `title` and `scenes` array.'],
      warnings,
    };
  }

  const obj = raw as Record<string, unknown>;
  const rawScenes = obj.scenes;

  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    return {
      ok: false,
      errors: ['`scenes` must be a non-empty array of 1 to 12 scene objects.'],
      warnings,
    };
  }

  if (rawScenes.length > 12) {
    warnings.push('More than 12 scenes provided; trimmed to the first 12 scenes.');
  }

  const rawChar = (obj.character && typeof obj.character === 'object'
    ? obj.character
    : {}) as Record<string, unknown>;

  const character = {
    name: str(rawChar.name, 'Traveler'),
    coatColor: str(rawChar.coatColor, '#2a3c59'),
    scarfColor: str(rawChar.scarfColor, '#dc2626'),
    hairColor: str(rawChar.hairColor, '#171923'),
    prop: pick<PropType>(rawChar.prop, ['lantern', 'umbrella', 'staff', 'none'], 'lantern'),
  };

  const scenes: SceneSpec[] = [];
  rawScenes.slice(0, 12).forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`scenes[${idx}] must be an object.`);
      return;
    }
    const s = entry as Record<string, unknown>;
    const rawStage = s.stage && typeof s.stage === 'object' ? (s.stage as Record<string, unknown>) : null;
    const setting: SettingType = rawStage
      ? 'custom_stage'
      : pick(s.setting, VALID_SETTINGS, 'rainbridge');

    let stage: CustomStageSpec | undefined;
    if (setting === 'custom_stage' && rawStage) {
      const bd = (rawStage.backdrop && typeof rawStage.backdrop === 'object'
        ? rawStage.backdrop
        : {}) as Record<string, unknown>;

      const actors: EngineActorSpec[] = Array.isArray(rawStage.actors)
        ? rawStage.actors.slice(0, 6).map((a, ai) => {
            const ao = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
            return {
              id: str(ao.id, `actor-${ai + 1}`),
              name: str(ao.name, `Character ${ai + 1}`),
              ageStyle: pick(ao.ageStyle, VALID_AGES, 'adult'),
              coatColor: str(ao.coatColor, character.coatColor),
              scarfColor: str(ao.scarfColor, character.scarfColor),
              hairColor: typeof ao.hairColor === 'string' ? ao.hairColor : undefined,
              skinTone: typeof ao.skinTone === 'string' ? ao.skinTone : undefined,
              glasses: Boolean(ao.glasses),
              scale: num(ao.scale, 1, 0.55, 1.6),
              xStart: num(ao.xStart, 0.3 + ai * 0.2, 0.05, 0.95),
              xEnd: ao.xEnd !== undefined ? num(ao.xEnd, 0.65, 0.05, 0.95) : undefined,
              yGround: num(ao.yGround, 0.79, 0.45, 0.95),
              facing: ao.facing === -1 ? -1 : ao.facing === 1 ? 1 : undefined,
              pose: pick(ao.pose, VALID_POSES, 'walk'),
              propInHand: pick(ao.propInHand, VALID_ACTOR_PROPS, 'none'),
              emotion: pick(ao.emotion, VALID_EMOTIONS, 'neutral'),
              speech: typeof ao.speech === 'string' ? ao.speech : undefined,
            };
          })
        : [];

      const props: EnginePropSpec[] = Array.isArray(rawStage.props)
        ? rawStage.props.slice(0, 24).map((p, pi) => {
            const po = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
            return {
              id: str(po.id, `prop-${pi + 1}`),
              kind: pick(po.kind, VALID_PROP_KINDS, 'lamp'),
              x: num(po.x, 0.5, -0.2, 1.2),
              y: num(po.y, 0.78, 0.05, 1.05),
              xEnd: po.xEnd !== undefined ? num(po.xEnd, 0.8, -0.3, 1.3) : undefined,
              yEnd: po.yEnd !== undefined ? num(po.yEnd, 0.78, 0.05, 1.05) : undefined,
              scale: num(po.scale, 1, 0.25, 2.5),
              rotation: num(po.rotation, 0, -Math.PI, Math.PI),
              color: typeof po.color === 'string' ? po.color : undefined,
              accentColor: typeof po.accentColor === 'string' ? po.accentColor : undefined,
              label: typeof po.label === 'string' ? po.label : undefined,
              motion: pick(po.motion, VALID_MOTIONS, 'static'),
            };
          })
        : [];

      const particles: EngineParticleSpec[] = Array.isArray(rawStage.particles)
        ? rawStage.particles.slice(0, 6).map((pt) => {
            const pto = (pt && typeof pt === 'object' ? pt : {}) as Record<string, unknown>;
            return {
              kind: pick(pto.kind, VALID_PARTICLE_KINDS, 'fireflies'),
              count: num(pto.count, 28, 4, 140),
              color: typeof pto.color === 'string' ? pto.color : undefined,
              originX: pto.originX !== undefined ? num(pto.originX, 0.5, 0, 1) : undefined,
              originY: pto.originY !== undefined ? num(pto.originY, 0.5, 0, 1) : undefined,
              intensity: num(pto.intensity, 0.85, 0.1, 1),
            };
          })
        : [];

      const rawCam =
        rawStage.camera && typeof rawStage.camera === 'object'
          ? (rawStage.camera as Record<string, unknown>)
          : undefined;

      stage = {
        backdrop: {
          type: pick(bd.type, VALID_BACKDROPS, 'outdoor_landscape'),
          skyTop: typeof bd.skyTop === 'string' ? bd.skyTop : undefined,
          skyMid: typeof bd.skyMid === 'string' ? bd.skyMid : undefined,
          skyHorizon: typeof bd.skyHorizon === 'string' ? bd.skyHorizon : undefined,
          wallColor: typeof bd.wallColor === 'string' ? bd.wallColor : undefined,
          floorColor: typeof bd.floorColor === 'string' ? bd.floorColor : undefined,
          floorY: bd.floorY !== undefined ? num(bd.floorY, 0.78, 0.5, 0.94) : undefined,
          waterY: bd.waterY !== undefined ? num(bd.waterY, 0.58, 0.42, 0.85) : undefined,
          sunX: bd.sunX !== undefined ? num(bd.sunX, 0.28, 0.05, 0.95) : undefined,
          sunY: bd.sunY !== undefined ? num(bd.sunY, 0.34, 0.05, 0.75) : undefined,
          showMoon: typeof bd.showMoon === 'boolean' ? bd.showMoon : undefined,
          showStars: typeof bd.showStars === 'boolean' ? bd.showStars : undefined,
          sunbeam: typeof bd.sunbeam === 'boolean' ? bd.sunbeam : undefined,
          sunbeamColor: typeof bd.sunbeamColor === 'string' ? bd.sunbeamColor : undefined,
        },
        camera: rawCam
          ? {
              zoomStart: num(rawCam.zoomStart, 1, 0.9, 1.45),
              zoomEnd: num(rawCam.zoomEnd, 1.05, 0.9, 1.45),
              panXStart: num(rawCam.panXStart, 0, -0.2, 0.2),
              panXEnd: num(rawCam.panXEnd, 0, -0.2, 0.2),
              panYStart: num(rawCam.panYStart, 0, -0.15, 0.15),
              panYEnd: num(rawCam.panYEnd, 0, -0.15, 0.15),
            }
          : undefined,
        actors,
        props,
        particles,
      };
    }

    const rawEvents = (s.events && typeof s.events === 'object'
      ? s.events
      : {}) as Record<string, unknown>;

    scenes.push({
      id: str(s.id, `scene-${idx + 1}`),
      title: str(s.title, `Scene ${idx + 1}`),
      narration: typeof s.narration === 'string' ? s.narration.trim() : '',
      durationSec: num(s.durationSec, 7, 3, 25),
      setting,
      timeOfDay: pick(s.timeOfDay, VALID_TIMES, 'golden_dusk'),
      weather: pick(s.weather, VALID_WEATHERS, 'clear'),
      weatherIntensity: num(s.weatherIntensity, 0.35, 0, 1),
      windStrength: num(s.windStrength, 0.7, 0, 2.2),
      characterAction: pick(s.characterAction, VALID_ACTIONS, 'walk_right'),
      events: {
        passingTrain: Boolean(rawEvents.passingTrain),
        skyLanterns: Boolean(rawEvents.skyLanterns),
        shootingStars: Boolean(rawEvents.shootingStars),
        birds: Boolean(rawEvents.birds),
        lightning: Boolean(rawEvents.lightning),
      },
      stage,
    });
  });

  if (errors.length > 0 || scenes.length === 0) {
    return { ok: false, errors, warnings };
  }

  const project: AnimationProject = {
    engineVersion: ENGINE_VERSION,
    title: str(obj.title, 'Untitled 2D Animation'),
    tagline: str(obj.tagline, 'Directed via Rainbridge 2D Engine Blueprint'),
    scriptText: str(
      obj.scriptText,
      scenes.map((sc, i) => `Scene ${i + 1} (${sc.title}): ${sc.narration}`).join('\n\n')
    ),
    character,
    scenes,
  };

  return { ok: true, project, errors: [], warnings };
}

export const AGENT_DEMO_BLUEPRINT: AnimationProject = {
  engineVersion: ENGINE_VERSION,
  title: 'সন্ধ্যার খেয়াঘাট — Evening Ferry Ghat',
  tagline: '100% Declarative AI-Engine Blueprint Demo (Custom Stage + Multi-Actor IK)',
  scriptText:
    'দৃশ্য ১: নদীর পাড়ে চায়ের দোকানে গোধূলির আলোয় অপেক্ষা।\nদৃশ্য ২: জোছনা রাতে লণ্ঠন জ্বালানো নৌকায় নদী পারাপার।\nদৃশ্য ৩: ভোরের আগে ঘাটে নেমে বটগাছের নিচে ফানুস ওড়ানো।',
  character: {
    name: 'নীরব',
    coatColor: '#2a3c59',
    scarfColor: '#d97706',
    hairColor: '#171923',
    prop: 'lantern',
  },
  scenes: [
    {
      id: 'ghat-1',
      title: 'গোধূলির চায়ের দোকান',
      narration: 'নদীর ঘাটে গোধূলির নরম আলো—চায়ের দোকানের ধোঁয়া আর মাটির ভাঁড়ে অপেক্ষার গল্প।',
      durationSec: 7,
      setting: 'custom_stage',
      timeOfDay: 'golden_dusk',
      weather: 'clear',
      weatherIntensity: 0.2,
      windStrength: 0.6,
      characterAction: 'stand_look_sky',
      events: { passingTrain: false, skyLanterns: false, shootingStars: false, birds: true, lightning: false },
      stage: {
        backdrop: {
          type: 'outdoor_landscape',
          skyTop: '#1d2b4e',
          skyMid: '#8a4d66',
          skyHorizon: '#f29e5e',
          floorColor: '#232026',
          floorY: 0.79,
          waterY: 0.59,
          sunX: 0.22,
          sunY: 0.44,
        },
        camera: { zoomStart: 1.0, zoomEnd: 1.07, panXStart: -0.02, panXEnd: 0.02 },
        props: [
          { kind: 'banyan_tree', x: 0.14, y: 0.78, scale: 1.15, color: '#1b3022' },
          { kind: 'tea_stall', x: 0.76, y: 0.79, scale: 1.08, label: 'ঘাটের চা' },
          { kind: 'bench', x: 0.58, y: 0.8, scale: 0.95 },
          { kind: 'boat', x: 0.34, y: 0.65, scale: 0.72, motion: 'float' },
        ],
        actors: [
          {
            id: 'nirob',
            name: 'নীরব',
            ageStyle: 'youth',
            coatColor: '#2a3c59',
            scarfColor: '#d97706',
            xStart: 0.32,
            xEnd: 0.52,
            yGround: 0.8,
            facing: 1,
            pose: 'walk',
            propInHand: 'lantern',
            emotion: 'wonder',
          },
          {
            id: 'shopkeeper',
            name: 'চা-ওয়ালা',
            ageStyle: 'elder',
            coatColor: '#5c3c2e',
            scarfColor: '#e2c9a6',
            glasses: true,
            xStart: 0.74,
            yGround: 0.79,
            facing: -1,
            pose: 'stand',
            emotion: 'smile',
          },
        ],
        particles: [
          { kind: 'birds', count: 8, intensity: 0.75 },
          { kind: 'dust_motes', count: 24, color: '#fde68a', intensity: 0.65 },
        ],
      },
    },
    {
      id: 'ghat-2',
      title: 'জোছনা নদীর খেয়া',
      narration: 'চাঁদের আলোয় ভাসমান খেয়া নৌকা—নদীর জলে লণ্ঠনের সোনালি প্রতিফলন কেঁপে ওঠে।',
      durationSec: 7.5,
      setting: 'custom_stage',
      timeOfDay: 'moonlit',
      weather: 'fireflies',
      weatherIntensity: 0.7,
      windStrength: 0.8,
      characterAction: 'stand_look_sky',
      events: { passingTrain: false, skyLanterns: true, shootingStars: true, birds: false, lightning: false },
      stage: {
        backdrop: {
          type: 'night_water',
          skyTop: '#070e20',
          skyMid: '#15294c',
          skyHorizon: '#355885',
          floorColor: '#101827',
          floorY: 0.86,
          waterY: 0.55,
          sunX: 0.78,
          sunY: 0.2,
          showMoon: true,
          showStars: true,
        },
        camera: { zoomStart: 1.02, zoomEnd: 1.09, panXStart: 0.02, panXEnd: -0.02 },
        props: [
          { kind: 'cottage', x: 0.88, y: 0.57, scale: 0.62 },
          { kind: 'boat', x: 0.2, y: 0.72, xEnd: 0.72, yEnd: 0.7, scale: 1.25, motion: 'move_across' },
          { kind: 'street_lamp', x: 0.1, y: 0.86, scale: 0.85 },
        ],
        actors: [
          {
            id: 'nirob-boat',
            name: 'নীরব',
            ageStyle: 'youth',
            coatColor: '#2a3c59',
            scarfColor: '#d97706',
            xStart: 0.22,
            xEnd: 0.74,
            yGround: 0.7,
            facing: 1,
            pose: 'stand',
            propInHand: 'lantern',
            emotion: 'tender',
          },
        ],
        particles: [
          { kind: 'fireflies', count: 32, color: '#fde047', intensity: 0.9 },
        ],
      },
    },
    {
      id: 'ghat-3',
      title: 'ভোরের ফানুস ও ক্যাম্পফায়ার',
      narration: 'ওপারের ঘাটে আগুনের ওম আর আকাশে ভেসে যাওয়া ফানুস—সব অপেক্ষা শেষে পূর্ণতা পায়।',
      durationSec: 7.5,
      setting: 'custom_stage',
      timeOfDay: 'pre_dawn',
      weather: 'petals',
      weatherIntensity: 0.55,
      windStrength: 0.7,
      characterAction: 'raise_lantern',
      events: { passingTrain: false, skyLanterns: true, shootingStars: false, birds: false, lightning: false },
      stage: {
        backdrop: {
          type: 'sunset_field',
          skyTop: '#182042',
          skyMid: '#5f4b7e',
          skyHorizon: '#e59272',
          floorColor: '#282c26',
          floorY: 0.79,
          sunX: 0.5,
          sunY: 0.48,
          showStars: true,
        },
        camera: { zoomStart: 1.0, zoomEnd: 1.08, panYStart: 0.01, panYEnd: -0.02 },
        props: [
          { kind: 'banyan_tree', x: 0.84, y: 0.79, scale: 1.2, color: '#1b2b22' },
          { kind: 'campfire', x: 0.5, y: 0.8, scale: 1.15 },
          { kind: 'cottage', x: 0.16, y: 0.78, scale: 0.85 },
        ],
        actors: [
          {
            id: 'nirob-end',
            name: 'নীরব',
            ageStyle: 'youth',
            coatColor: '#2a3c59',
            scarfColor: '#d97706',
            xStart: 0.38,
            yGround: 0.8,
            facing: 1,
            pose: 'raise_prop',
            propInHand: 'lantern',
            emotion: 'smile',
          },
          {
            id: 'friend-end',
            name: 'সঙ্গী',
            ageStyle: 'youth',
            coatColor: '#5c342e',
            scarfColor: '#fbbf24',
            xStart: 0.62,
            yGround: 0.8,
            facing: -1,
            pose: 'hold_hands',
            propInHand: 'flower',
            emotion: 'smile',
          },
        ],
        particles: [
          { kind: 'embers', count: 26, originX: 0.5, originY: 0.78, intensity: 0.9 },
          { kind: 'petals', count: 22, color: '#fef3c7', intensity: 0.75 },
        ],
      },
    },
  ],
};

export const ENGINE_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Rainbridge2DEngineBlueprint',
  description:
    'Universal declarative JSON blueprint for the Rainbridge Procedural 2D Animation Engine (2-bone IK actors, painterly stages, props, camera motion, particles, and WebM video export).',
  type: 'object',
  required: ['title', 'scenes'],
  properties: {
    engineVersion: { type: 'string', default: ENGINE_VERSION },
    title: { type: 'string', description: 'Film title (supports Bengali, English, or any Unicode).' },
    tagline: { type: 'string' },
    scriptText: { type: 'string' },
    character: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        coatColor: { type: 'string', description: 'Hex color e.g. #2a3c59' },
        scarfColor: { type: 'string', description: 'Hex color e.g. #dc2626' },
        hairColor: { type: 'string' },
        prop: { type: 'string', enum: ['lantern', 'umbrella', 'staff', 'none'] },
      },
    },
    scenes: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        required: ['title', 'narration', 'durationSec', 'setting', 'timeOfDay'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          narration: { type: 'string', description: 'Burned-in cinema subtitle for this scene.' },
          durationSec: { type: 'number', minimum: 3, maximum: 25 },
          setting: { type: 'string', enum: VALID_SETTINGS },
          timeOfDay: { type: 'string', enum: VALID_TIMES },
          weather: { type: 'string', enum: VALID_WEATHERS },
          weatherIntensity: { type: 'number', minimum: 0, maximum: 1 },
          windStrength: { type: 'number', minimum: 0, maximum: 2.2 },
          characterAction: { type: 'string', enum: VALID_ACTIONS },
          events: {
            type: 'object',
            properties: {
              passingTrain: { type: 'boolean' },
              skyLanterns: { type: 'boolean' },
              shootingStars: { type: 'boolean' },
              birds: { type: 'boolean' },
              lightning: { type: 'boolean' },
            },
          },
          stage: {
            type: 'object',
            description:
              'When setting="custom_stage", compose any custom painterly 2D scene with camera zoom/pan, backdrop, 1-6 IK actors, up to 24 procedural props, and particle emitters.',
            properties: {
              backdrop: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: { type: 'string', enum: VALID_BACKDROPS },
                  skyTop: { type: 'string' },
                  skyMid: { type: 'string' },
                  skyHorizon: { type: 'string' },
                  wallColor: { type: 'string' },
                  floorColor: { type: 'string' },
                  floorY: { type: 'number', minimum: 0.5, maximum: 0.94 },
                  waterY: { type: 'number', minimum: 0.42, maximum: 0.85 },
                  sunX: { type: 'number', minimum: 0.05, maximum: 0.95 },
                  sunY: { type: 'number', minimum: 0.05, maximum: 0.75 },
                  showMoon: { type: 'boolean' },
                  showStars: { type: 'boolean' },
                  sunbeam: { type: 'boolean' },
                },
              },
              camera: {
                type: 'object',
                properties: {
                  zoomStart: { type: 'number', minimum: 0.9, maximum: 1.45 },
                  zoomEnd: { type: 'number', minimum: 0.9, maximum: 1.45 },
                  panXStart: { type: 'number', minimum: -0.2, maximum: 0.2 },
                  panXEnd: { type: 'number', minimum: -0.2, maximum: 0.2 },
                  panYStart: { type: 'number', minimum: -0.15, maximum: 0.15 },
                  panYEnd: { type: 'number', minimum: -0.15, maximum: 0.15 },
                },
              },
              actors: {
                type: 'array',
                maxItems: 6,
                items: {
                  type: 'object',
                  required: ['id', 'name', 'coatColor', 'xStart', 'pose'],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    ageStyle: { type: 'string', enum: VALID_AGES },
                    coatColor: { type: 'string' },
                    scarfColor: { type: 'string' },
                    hairColor: { type: 'string' },
                    skinTone: { type: 'string' },
                    glasses: { type: 'boolean' },
                    scale: { type: 'number', minimum: 0.55, maximum: 1.6 },
                    xStart: { type: 'number', minimum: 0.05, maximum: 0.95 },
                    xEnd: { type: 'number', minimum: 0.05, maximum: 0.95 },
                    yGround: { type: 'number', minimum: 0.45, maximum: 0.95 },
                    facing: { type: 'number', enum: [1, -1] },
                    pose: { type: 'string', enum: VALID_POSES },
                    propInHand: { type: 'string', enum: VALID_ACTOR_PROPS },
                    emotion: { type: 'string', enum: VALID_EMOTIONS },
                  },
                },
              },
              props: {
                type: 'array',
                maxItems: 24,
                items: {
                  type: 'object',
                  required: ['kind', 'x', 'y'],
                  properties: {
                    kind: { type: 'string', enum: VALID_PROP_KINDS },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    xEnd: { type: 'number' },
                    yEnd: { type: 'number' },
                    scale: { type: 'number' },
                    color: { type: 'string' },
                    accentColor: { type: 'string' },
                    label: { type: 'string' },
                    motion: { type: 'string', enum: VALID_MOTIONS },
                  },
                },
              },
              particles: {
                type: 'array',
                maxItems: 6,
                items: {
                  type: 'object',
                  required: ['kind'],
                  properties: {
                    kind: { type: 'string', enum: VALID_PARTICLE_KINDS },
                    count: { type: 'number' },
                    color: { type: 'string' },
                    originX: { type: 'number' },
                    originY: { type: 'number' },
                    intensity: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const AI_MASTER_PROMPT = `You are a 2D Animation Director for the **Rainbridge Procedural 2D Animation Engine (v${ENGINE_VERSION})**.
Return ONLY valid JSON matching the Engine Blueprint schema—no markdown fences or commentary.

STYLE & ENGINE RULES:
- Use \`"setting": "custom_stage"\` with a \`"stage"\` object to direct original painterly 2D scenes with camera zoom/pan, atmospheric lighting, multi-character 2-bone IK actors, procedural props, and particle physics.
- Coordinates are normalized \`0.0\` to \`1.0\` (left->right for x, top->bottom for y; ground is typically y=0.78..0.82).
- Keep subtitles (\`narration\`) poetic and concise (1–2 sentences, Bengali or English matching the user's story).

AVAILABLE VALUES:
- backdrop.type: ${VALID_BACKDROPS.join(' | ')}
- timeOfDay: ${VALID_TIMES.join(' | ')}
- weather: ${VALID_WEATHERS.join(' | ')}
- actor.ageStyle: ${VALID_AGES.join(' | ')}
- actor.pose: ${VALID_POSES.join(' | ')}
- actor.propInHand: ${VALID_ACTOR_PROPS.join(' | ')}
- actor.emotion: ${VALID_EMOTIONS.join(' | ')}
- prop.kind: ${VALID_PROP_KINDS.join(' | ')}
- prop.motion: ${VALID_MOTIONS.join(' | ')}
- particle.kind: ${VALID_PARTICLE_KINDS.join(' | ')}

BLUEPRINT TEMPLATE:
{
  "engineVersion": "${ENGINE_VERSION}",
  "title": "Story Title",
  "tagline": "Short mood line",
  "character": { "name": "Lead", "coatColor": "#2a3c59", "scarfColor": "#d97706", "hairColor": "#171923", "prop": "lantern" },
  "scenes": [
    {
      "id": "scene-1",
      "title": "Scene 1 Title",
      "narration": "Subtitle text in Bengali or English",
      "durationSec": 7,
      "setting": "custom_stage",
      "timeOfDay": "golden_dusk",
      "weather": "clear",
      "weatherIntensity": 0.3,
      "windStrength": 0.7,
      "characterAction": "walk_right",
      "events": { "passingTrain": false, "skyLanterns": true, "shootingStars": false, "birds": true, "lightning": false },
      "stage": {
        "backdrop": { "type": "outdoor_landscape", "floorY": 0.79, "waterY": 0.58, "sunX": 0.25, "sunY": 0.4 },
        "camera": { "zoomStart": 1.0, "zoomEnd": 1.07, "panXStart": -0.02, "panXEnd": 0.02 },
        "props": [
          { "kind": "banyan_tree", "x": 0.16, "y": 0.79, "scale": 1.1 },
          { "kind": "tea_stall", "x": 0.76, "y": 0.79, "scale": 1.0, "label": "চা" }
        ],
        "actors": [
          { "id": "a1", "name": "Hero", "ageStyle": "youth", "coatColor": "#2a3c59", "scarfColor": "#d97706", "xStart": 0.28, "xEnd": 0.56, "yGround": 0.8, "facing": 1, "pose": "walk", "propInHand": "lantern", "emotion": "wonder" }
        ],
        "particles": [
          { "kind": "fireflies", "count": 28, "color": "#fde047", "intensity": 0.85 }
        ]
      }
    }
  ]
}

Now direct a 3-to-5 scene 2D animation JSON blueprint for the following story:`;

export function buildAgentToolManifest(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return {
    engine: 'Rainbridge 2D Procedural Animation Engine',
    version: ENGINE_VERSION,
    endpoints: {
      schema: `${cleanBase}/api/engine/schema`,
      getBlueprint: `${cleanBase}/api/engine/blueprint`,
      renderBlueprint: `${cleanBase}/api/engine/blueprint`,
      upsertScene: `${cleanBase}/api/engine/scene`,
      command: `${cleanBase}/api/engine/command`,
      liveEventsSSE: `${cleanBase}/api/engine/events`,
    },
    tools: [
      {
        type: 'function',
        function: {
          name: 'render_2d_animation_blueprint',
          description:
            'Pushes a declarative Rainbridge 2D Animation Engine JSON blueprint to render live painterly 2D animation with 2-bone IK actors, props, camera motion, particles, and Bengali/English subtitles.',
          parameters: ENGINE_JSON_SCHEMA,
        },
      },
      {
        type: 'function',
        function: {
          name: 'control_2d_animation_playback',
          description:
            'Controls playback on the live 2D animation stage (play, pause, seek, toggle rig overlay, toggle subtitles, or trigger sky lantern burst).',
          parameters: {
            type: 'object',
            required: ['action'],
            properties: {
              action: {
                type: 'string',
                enum: ['play', 'pause', 'seek', 'toggle_rig', 'toggle_subtitles', 'lantern_burst'],
              },
              timeSec: { type: 'number', description: 'Target time in seconds when action="seek".' },
            },
          },
        },
      },
    ],
  };
}
