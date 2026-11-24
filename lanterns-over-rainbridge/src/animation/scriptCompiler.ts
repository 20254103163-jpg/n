import {
  AnimationProject,
  CharacterActionType,
  CharacterConfig,
  PropType,
  SceneSpec,
  SettingType,
  TimeOfDayType,
  WeatherType,
} from './types';

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function countMatches(text: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) count++;
  }
  return count;
}

function isBengaliScript(text: string): boolean {
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) ?? []).length;
  return bengaliChars >= 4;
}

interface RawBeat {
  title: string;
  body: string;
}

/**
 * Splits a natural language story (Bengali, Banglish, or English) into 2-6 dramatic scenes.
 */
function splitIntoSceneBeats(rawScript: string, useBangla: boolean): RawBeat[] {
  const normalized = rawScript.replace(/\r\n/g, '\n').trim();

  // 1. Try splitting by explicit scene headings (দৃশ্য ১, Scene 1, Act 1, etc.)
  const headingRegex =
    /(?:^|\n)\s*(?:দৃশ্য\s*[০-৯0-9]+|scene\s*[0-9]+|act\s*[0-9IVX]+|[০-৯0-9]+[.)])\s*(?:\(([^)]+)\))?\s*[:\-–—]?\s*/gi;

  const matches: { index: number; end: number; parenTitle?: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(normalized)) !== null) {
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      parenTitle: m[1]?.trim(),
    });
  }

  if (matches.length >= 2) {
    const beats: RawBeat[] = [];
    for (let i = 0; i < matches.length && beats.length < 6; i++) {
      const start = matches[i].end;
      const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
      const body = normalized.slice(start, end).trim();
      if (!body) continue;
      const fallbackTitle = useBangla ? `দৃশ্য ${i + 1}` : `Scene ${i + 1}`;
      beats.push({
        title: matches[i].parenTitle || fallbackTitle,
        body,
      });
    }
    if (beats.length > 0) return beats;
  }

  // 2. Try paragraph / newline breaks
  const paragraphs = normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);

  if (paragraphs.length >= 2) {
    return paragraphs.slice(0, 6).map((p, idx) => {
      const colonMatch = p.match(/^([^:।.]{3,32}):\s*(.+)$/);
      if (colonMatch) {
        return {
          title: colonMatch[1].replace(/[()]/g, '').trim(),
          body: colonMatch[2].trim(),
        };
      }
      return {
        title: useBangla ? `দৃশ্য ${idx + 1}` : `Scene ${idx + 1}`,
        body: p,
      };
    });
  }

  // 3. Split single paragraph along sentence boundaries (। . ! ? ;)
  const sentences = normalized
    .split(/(?<=[।.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length >= 2) {
    const targetCount = Math.min(4, sentences.length);
    const perGroup = Math.ceil(sentences.length / targetCount);
    const beats: RawBeat[] = [];
    for (let i = 0; i < sentences.length && beats.length < 6; i += perGroup) {
      const chunk = sentences.slice(i, i + perGroup).join(' ');
      beats.push({
        title: useBangla ? `দৃশ্য ${beats.length + 1}` : `Scene ${beats.length + 1}`,
        body: chunk,
      });
    }
    return beats;
  }

  // 4. Single short sentence -> expand into a 3-scene mini story arc
  return [
    {
      title: useBangla ? 'শুরুর মুহূর্ত' : 'Opening Moment',
      body: normalized,
    },
    {
      title: useBangla ? 'গল্পের মাঝপথ' : 'Turning Point',
      body: normalized,
    },
    {
      title: useBangla ? 'শেষ দৃশ্য' : 'Quiet Finale',
      body: normalized,
    },
  ];
}

function detectSetting(text: string, fallback: SettingType): SettingType {
  const scores: Record<SettingType, number> = {
    custom_stage: 0,
    attic_discovery: countMatches(text, [
      'চিলেকোঠা', 'ঘুলঘুলি', 'সিন্দুক', 'মেহগনি', 'টিনের', 'লাল বাক্স', 'বাক্স', 'আবিষ্কার',
      'বই ঘাঁট', 'attic', 'trunk', 'chest', 'tin box', 'discovery', 'old books',
    ]),
    veranda_past: countMatches(text, [
      'বারান্দা', 'ইজিচেয়ার', 'ইজিচেয়ার', 'টি-টেবিল', 'টেবিল', 'দাদু', 'অনুচ্চারিত',
      'জানালা', 'veranda', 'balcony', 'easy chair', 'grandfather', 'grandpa', 'tea table',
    ]),
    shantipur_memory: countMatches(text, [
      'শান্তিপুর', 'বটের ছায়া', 'বটের ছায়া', 'বটগাছ', 'ডাকপিয়ন', 'ডাকপিয়ন', '১৯৬৮',
      'খামের ভেতর', 'ঘাটে', 'postman', 'banyan', '1968', 'shantipur', 'vintage train', 'memory',
    ]),
    rooftop_closure: countMatches(text, [
      'ছাদ', 'ছাদে', 'মাটির পাত্র', 'পূর্ণতা', 'দাদুর হাত', 'হিমেল হাওয়া', 'হিমেল হাওয়া',
      'প্রশান্তির হাসি', 'rooftop', 'terrace', 'roof', 'parapet', 'closure', 'clay bowl',
    ]),
    village_green: countMatches(text, [
      'গ্রাম', 'পুকুর', 'আমবাগান', 'বাগান', 'মাঠ', 'স্কুল', 'ফুটবল', 'বাড়ি', 'বাড়ি',
      'ঘর', 'হারিকেন', 'কাঁথা', 'গাছ', 'খেত', 'পাড়া', 'পাড়া', 'মা', 'ছোটবেলা',
      'gram', 'pukur', 'bagan', 'math', 'school', 'football', 'village', 'pond',
      'orchard', 'garden', 'meadow', 'field', 'rural', 'farm', 'cottage', 'home',
      'house', 'mango', 'tree', 'trees', 'park', 'yard',
    ]),
    rainbridge: countMatches(text, [
      'ব্রিজ', 'সেতু', 'রেলসেতু', 'বাতিঘর', 'সাগর', 'সমুদ্র', 'নদী', 'খাল',
      'ফানুস', 'bridge', 'railway', 'viaduct', 'lighthouse',
      'bay', 'sea', 'ocean', 'river', 'arch', 'rainbridge', 'canal',
    ]),
    mountain_forest: countMatches(text, [
      'পাহাড়', 'পাহাড়', 'পর্বত', 'বন', 'জঙ্গল', 'বরফ', 'তুষার', 'শীত', 'কেবিন',
      'ঝরনা', 'অরণ্য', 'pahar', 'bon', 'jongol', 'baraf', 'mountain', 'alpine',
      'forest', 'pine', 'snow', 'cabin', 'woods', 'peak', 'valley', 'hill', 'hike',
    ]),
    coastal_city: countMatches(text, [
      'শহর', 'নগর', 'রাস্তা', 'বন্দর', 'জাহাজ', 'ফেরি', 'দালান', 'অফিস', 'ফুটপাত',
      'shohor', 'rasta', 'city', 'harbor', 'skyline', 'promenade', 'ferry',
      'street', 'urban', 'building', 'tower', 'town', 'downtown', 'metro',
    ]),
    desert_dunes: countMatches(text, [
      'মরুভূমি', 'মরু', 'বালি', 'উট', 'মরূদ্যান', 'morubhumi', 'bali',
      'desert', 'dune', 'dunes', 'sand', 'oasis', 'caravan', 'sahara',
    ]),
  };

  let best: SettingType = fallback;
  let maxScore = 0;
  for (const key of Object.keys(scores) as SettingType[]) {
    if (scores[key] > maxScore) {
      maxScore = scores[key];
      best = key;
    }
  }
  return maxScore > 0 ? best : fallback;
}

function detectTimeOfDay(text: string, sceneIndex: number, totalScenes: number): TimeOfDayType {
  if (
    hasAny(text, [
      'দুপুর', 'ঝাঁঝা', 'কাঠফাটা', 'রোদ', 'বৈশাখ', 'সকাল', 'সূর্য', 'রৌদ্র',
      'dupur', 'rod', 'shokal', 'noon', 'afternoon', 'sunny', 'sunlight', 'morning', 'daylight', 'midday',
    ])
  ) {
    return 'sunny_afternoon';
  }
  if (
    hasAny(text, [
      'ঝড়', 'ঝড়', 'কালবৈশাখী', 'বজ্র', 'মেঘলা', 'ঝুম বৃষ্টি', 'দমকা', 'ঘন মেঘ',
      'jhor', 'megh', 'storm', 'thunder', 'cloudburst', 'tempest', 'squall', 'downpour',
    ])
  ) {
    return 'storm_twilight';
  }
  if (
    hasAny(text, [
      'চাঁদ', 'জ্যোৎস্না', 'পূর্ণিমা', 'রূপালি', 'চাঁদের',
      'chand', 'jyotsna', 'moon', 'moonlit', 'moonlight', 'lunar', 'crescent',
    ])
  ) {
    return 'moonlit';
  }
  if (
    hasAny(text, [
      'ভোর', 'উষা', 'প্রথম আলো', 'সুর্যোদয়', 'সূর্যোদয়',
      'bhor', 'dawn', 'sunrise', 'first light', 'daybreak',
    ])
  ) {
    return 'pre_dawn';
  }
  if (
    hasAny(text, [
      'রাত', 'নিস্তব্ধ', 'তারা', 'নক্ষত্র', 'হারিকেন', 'ঘুম', 'মধ্যরাত', 'অন্ধকার', 'জোনাকি',
      'raat', 'rat', 'tara', 'night', 'midnight', 'starry', 'stars', 'sleep', 'dark', 'meteor',
    ])
  ) {
    return 'starry_night';
  }
  if (
    hasAny(text, [
      'পড়ন্ত', 'পড়ন্ত', 'বিকেল', 'গোধূলি', 'সন্ধ্যা', 'সূর্যাস্ত', 'আলো-আঁধারি',
      'bikel', 'shondhya', 'godhuli', 'dusk', 'sunset', 'evening', 'golden', 'twilight',
    ])
  ) {
    return 'golden_dusk';
  }

  // Natural narrative progression if time wasn't stated explicitly
  const progression: TimeOfDayType[] = ['golden_dusk', 'storm_twilight', 'starry_night', 'moonlit', 'pre_dawn'];
  const idx = Math.floor((sceneIndex / Math.max(totalScenes, 1)) * progression.length);
  return progression[Math.min(idx, progression.length - 1)];
}

function detectWeather(text: string, timeOfDay: TimeOfDayType): { weather: WeatherType; intensity: number } {
  if (
    hasAny(text, [
      'বৃষ্টি', 'বর্ষা', 'ঝুম', 'ভিজ', 'বজ্র', 'বাদল', 'ঝড়', 'ঝড়',
      'brishti', 'borsha', 'rain', 'rainy', 'drizzle', 'storm', 'shower', 'downpour', 'wet',
    ])
  ) {
    const heavy = hasAny(text, ['ঝুম', 'প্রবল', 'ঝড়', 'ঝড়', 'heavy', 'storm', 'cloudburst']);
    return { weather: 'rain', intensity: heavy ? 0.92 : 0.7 };
  }
  if (
    hasAny(text, [
      'তুষার', 'বরফ', 'শীত', 'হিম', 'কুয়াশা', 'কুয়াশা',
      'baraf', 'snow', 'snowfall', 'blizzard', 'frost', 'winter',
    ])
  ) {
    return { weather: 'snow', intensity: 0.78 };
  }
  if (
    hasAny(text, [
      'ফুল', 'পাপড়ি', 'পাপড়ি', 'বসন্ত', 'কৃষ্ণচূড়া', 'শিমুল', 'শিউলি', 'বাতাসে ধুলো', 'ধুলো',
      'phul', 'petal', 'petals', 'blossom', 'sakura', 'flower', 'spring',
    ])
  ) {
    return { weather: 'petals', intensity: 0.75 };
  }
  if (
    hasAny(text, [
      'জোনাকি', 'নিস্তব্ধ', 'হারিকেন', 'লণ্ঠন', 'ফানুস', 'রাত',
      'jonaki', 'firefly', 'fireflies', 'glow', 'lantern', 'quiet',
    ]) ||
    timeOfDay === 'starry_night' ||
    timeOfDay === 'moonlit'
  ) {
    return { weather: 'fireflies', intensity: 0.65 };
  }
  return { weather: 'clear', intensity: 0 };
}

function detectAction(text: string, sceneIndex: number): CharacterActionType {
  if (
    hasAny(text, [
      'দৌড়', 'দৌড়', 'ছুট', 'তাড়া', 'তাড়া', 'লাফ', 'ঝাঁপ', 'ফুটবল', 'খেলা', 'যুদ্ধ', 'উল্লাস',
      'dour', 'chut', 'run', 'running', 'sprint', 'chase', 'race', 'rush', 'jump', 'football', 'play', 'hurry',
    ])
  ) {
    return 'run_right';
  }
  if (
    hasAny(text, [
      'ফানুস', 'উড়ান', 'উড়ান', 'উড়িয়ে', 'উড়িয়ে', 'আকাশে ওড়ানো', 'আকাশে ওড়ানো', 'লণ্ঠন তোল',
      'fanush', 'release', 'raise', 'lift', 'lantern',
    ]) &&
    hasAny(text, ['উড়', 'উড়', 'তোল', 'release', 'raise', 'float', 'sky', 'আকাশ'])
  ) {
    return 'raise_lantern';
  }
  if (
    hasAny(text, [
      'দাঁড়িয়ে', 'দাঁড়িয়ে', 'থাম', 'তাকিয়ে', 'তাকিয়ে', 'ঘুম', 'টেবিল', 'বসে', 'নিস্তব্ধ', 'চোখ',
      'dariye', 'stand', 'pause', 'stop', 'gaze', 'watch', 'look up', 'sleep', 'rest', 'sit', 'quiet',
    ])
  ) {
    return 'stand_look_sky';
  }
  if (
    hasAny(text, [
      'ফিরে', 'ফেরা', 'ফেরত', 'উল্টো', 'বাড়ি ফেরা', 'বাড়ি ফেরা',
      'fire', 'return', 'back', 'left',
    ]) &&
    sceneIndex > 0
  ) {
    return 'walk_left';
  }
  return 'walk_right';
}

function detectCharacterConfig(fullLower: string, useBangla: boolean): CharacterConfig {
  let prop: PropType = 'lantern';
  if (hasAny(fullLower, ['ছাতা', 'chata', 'umbrella'])) {
    prop = 'umbrella';
  } else if (hasAny(fullLower, ['লাঠি', 'lathi', 'staff', 'stick', 'হাইকিং', 'hike'])) {
    prop = 'staff';
  } else if (
    hasAny(fullLower, ['লণ্ঠন', 'হারিকেন', 'প্রদীপ', 'ফানুস', 'hariken', 'lonthon', 'lantern', 'lamp'])
  ) {
    prop = 'lantern';
  } else if (hasAny(fullLower, ['ফুটবল', 'খালি পায়ে', 'পুকুর', 'আমবাগান', 'football', 'barefoot', 'swim'])) {
    prop = 'none';
  }

  let coatColor = '#2a3c59';
  let scarfColor = '#dc2626';
  if (hasAny(fullLower, ['গ্রাম', 'আমবাগান', 'পুকুর', 'স্কুল', 'ফুটবল', 'village', 'meadow', 'forest', 'পাহাড়'])) {
    coatColor = '#3f523a';
    scarfColor = '#d97706';
  } else if (hasAny(fullLower, ['শহর', 'বন্দর', 'ফুল', 'বসন্ত', 'city', 'harbor', 'petal'])) {
    coatColor = '#373052';
    scarfColor = '#e11d48';
  } else if (hasAny(fullLower, ['মরুভূমি', 'desert', 'dune'])) {
    coatColor = '#5c342e';
    scarfColor = '#d97706';
  }

  return {
    name: hasAny(fullLower, ['অর্ক', 'arka']) ? 'অর্ক' : useBangla ? 'পথিক' : 'Traveler',
    coatColor,
    scarfColor,
    hairColor: '#141926',
    prop,
  };
}

function makeConciseSubtitle(body: string): string {
  const cleaned = body.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 92) return cleaned;
  const firstClause = cleaned.split(/[।.!?;]/)[0]?.trim() ?? cleaned;
  if (firstClause.length >= 18 && firstClause.length <= 96) {
    return firstClause;
  }
  return `${cleaned.slice(0, 88).trim()}...`;
}

function deriveFilmTitle(beats: RawBeat[], fullLower: string, useBangla: boolean): string {
  if (hasAny(fullLower, ['শান্তিপুর', 'পোস্টবক্স', 'শুভ্রা'])) {
    return 'পোস্টবক্স নম্বর ৪২, শান্তিপুর';
  }
  if (beats.length > 0 && beats[0].title && !/^(scene|দৃশ্য)\s*[0-9০-৯]+$/i.test(beats[0].title)) {
    const first = beats[0].title;
    const last = beats[beats.length - 1].title;
    if (beats.length > 1 && last && last !== first && !/^(scene|দৃশ্য)\s*[0-9০-৯]+$/i.test(last)) {
      return `${first} ও ${last}`.slice(0, 56);
    }
    return first.slice(0, 56);
  }

  if (useBangla) {
    if (hasAny(fullLower, ['আমবাগান', 'পুকুর', 'ফুটবল', 'হারিকেন', 'ছোটবেলা'])) return 'হারানো শৈশবের দিনগুলো';
    if (hasAny(fullLower, ['বৃষ্টি', 'ফানুস', 'ব্রিজ'])) return 'বৃষ্টিভেজা সেতু ও ফানুস';
    if (hasAny(fullLower, ['পাহাড়', 'পাহাড়', 'তুষার', 'বরফ'])) return 'পাহাড়ি পথে তুষারপাত';
    if (hasAny(fullLower, ['শহর', 'ফেরি', 'বন্দর'])) return 'রাতের বন্দরে আলোর খেলা';
    if (hasAny(fullLower, ['মরুভূমি', 'বালি'])) return 'তারার নিচে মরুযাত্রা';
    return 'প্রসিডিউরাল বাংলা অ্যানিমেশন';
  }

  if (hasAny(fullLower, ['snow', 'mountain', 'alpine', 'cabin'])) return 'Journey Through Alpine Snow';
  if (hasAny(fullLower, ['city', 'harbor', 'ferry', 'street'])) return 'Lights Along the Harbor';
  if (hasAny(fullLower, ['desert', 'dune', 'oasis'])) return 'Under Starlit Dunes';
  if (hasAny(fullLower, ['village', 'pond', 'orchard', 'football'])) return 'Days of the Village Meadow';
  return 'Scripted 2D Short Film';
}

/**
 * 100% Pure-Code Procedural Script Compiler.
 * Runs instantaneously in the browser with zero external API calls.
 */
export function compileScriptPureCode(rawScript: string): AnimationProject {
  const trimmed = rawScript.trim();
  const useBangla = isBengaliScript(trimmed);
  const fullLower = trimmed.toLowerCase();

  const beats = splitIntoSceneBeats(trimmed, useBangla);
  const globalSetting = detectSetting(fullLower, 'rainbridge');
  const character = detectCharacterConfig(fullLower, useBangla);

  const scenes: SceneSpec[] = beats.map((beat, idx) => {
    const lower = beat.body.toLowerCase();
    const combinedLower = `${beat.title.toLowerCase()} ${lower}`;

    const setting = detectSetting(combinedLower, globalSetting);
    const timeOfDay = detectTimeOfDay(combinedLower, idx, beats.length);
    const { weather, intensity } = detectWeather(combinedLower, timeOfDay);
    const characterAction = detectAction(combinedLower, idx);

    const hasStorm = weather === 'rain' && intensity > 0.75;
    const windStrength = hasStorm
      ? 1.55
      : characterAction === 'run_right'
      ? 1.15
      : hasAny(combinedLower, ['বাতাস', 'হাওয়া', 'হাওয়া', 'ঝড়', 'ঝড়', 'ধুলো', 'wind', 'breeze', 'gust'])
      ? 1.35
      : 0.65;

    const events = {
      passingTrain: hasAny(combinedLower, ['ট্রেন', 'রেল', 'ফেরি', 'জাহাজ', 'নৌকা', 'train', 'railway', 'ferry', 'boat']),
      skyLanterns: hasAny(combinedLower, ['ফানুস', 'আকাশে ওড়ানো', 'আকাশে ওড়ানো', 'lantern', 'lanterns', 'fanush']),
      shootingStars:
        hasAny(combinedLower, ['তারা', 'উল্কা', 'নক্ষত্র', 'star', 'meteor', 'wish']) &&
        (timeOfDay === 'starry_night' || timeOfDay === 'moonlit'),
      birds:
        hasAny(combinedLower, ['পাখি', 'আকাশ', 'দুপুর', 'বিকেল', 'পড়ন্ত', 'পড়ন্ত', 'মাঠ', 'bird', 'birds', 'sky', 'afternoon', 'dusk', 'morning']) &&
        weather !== 'rain',
      lightning: hasAny(combinedLower, ['বজ্র', 'বিদ্যুৎ', 'কালবৈশাখী', 'ঝড়', 'ঝড়', 'lightning', 'thunder', 'storm']),
    };

    // Scale scene duration naturally from text length (6s - 9s)
    const durationSec = Math.max(6, Math.min(9, Math.round(5.5 + beat.body.length / 45)));

    // Intelligent Bengali Social Drama Stage Synthesizer
    let stage = undefined;
    if (useBangla || hasAny(combinedLower, ['ভাই', 'জমি', 'বাবা', 'মা', 'গ্রাম', 'ঘর', 'বাড়ি', 'বিচ্ছেদ', 'বিরোধ', 'অপেক্ষা', 'মাতবর', 'টাকা', 'খাটিয়া'])) {
      const isIndoor = hasAny(combinedLower, ['রুম', 'ভেতর', 'ভেতরে', 'সার্টিফিকেট', 'দেয়াল', 'টেবিল']);
      const isLandDispute = hasAny(combinedLower, ['জমি', 'ভাই', 'সীমানা', 'বেড়া', 'বেড়']);
      const isFatherStory = hasAny(combinedLower, ['বাবা', 'আব্বা', 'দাদু', 'সন্তান', 'ছেলে', 'অপেক্ষা']);
      const isMotherDaughter = hasAny(combinedLower, ['মা', 'আম্মা', 'মেয়ে', 'মাইয়া', 'বউ', 'আপা', 'বোন']);
      const isElderSorrow = hasAny(combinedLower, ['খাটিয়া', 'কবর', 'লাশ', 'বয়স', 'বৃদ্ধ']);

      stage = {
        backdrop: {
          type: (isIndoor ? 'indoor_room' : (idx % 2 === 1 ? 'courtyard' : 'rural_bengal')) as any,
          floorY: 0.82,
          floorColor: isIndoor ? '#3b2416' : '#7c5539',
        },
        thumbnailBanner: {
          title: beat.title,
          subtitle: makeConciseSubtitle(beat.body),
          tag: idx === 0 ? 'পুরা গল্প' : 'পুরা ঘটনা • ৩ পর্ব',
        },
        props: isIndoor
          ? [
              { kind: 'certificate_frame' as const, x: 0.28, y: 0.42, scale: 1.1, label: 'এসএসসি' },
              { kind: 'table' as const, x: 0.72, y: 0.82, scale: 1.0 },
              { kind: 'window_beam' as const, x: 0.82, y: 0.35, scale: 1.0 },
            ]
          : isLandDispute
          ? [
              { kind: 'tin_house' as const, x: 0.16, y: 0.77, scale: 0.95 },
              { kind: 'tin_house' as const, x: 0.84, y: 0.77, scale: 0.95 },
              { kind: 'bamboo_fence' as const, x: 0.50, y: 0.82, scale: 1.15 },
              { kind: 'palm_tree' as const, x: 0.06, y: 0.76, scale: 0.95 },
              { kind: 'banana_tree' as const, x: 0.94, y: 0.81, scale: 1.0 },
            ]
          : [
              { kind: 'tin_house' as const, x: 0.20, y: 0.77, scale: 0.95 },
              { kind: (isElderSorrow ? 'khatia' : 'bamboo_fence') as any, x: 0.50, y: 0.82, scale: 1.0 },
              { kind: 'palm_tree' as const, x: 0.88, y: 0.76, scale: 1.0 },
              { kind: 'banana_tree' as const, x: 0.08, y: 0.82, scale: 0.95 },
            ],
        actors: isLandDispute
          ? [
              {
                id: `act-1-${idx}`,
                name: 'বড় ভাই',
                ageStyle: 'elder' as const,
                characterRole: 'elder_father' as const,
                coatColor: '#f8fafc',
                hasLungi: true,
                lungiColor: '#0284c7',
                hasTupi: true,
                hasBeard: true,
                hasTears: true,
                glasses: true,
                emotion: (idx === 0 ? 'cry' : 'sad') as any,
                pose: 'stand' as const,
                propInHand: (idx === 0 ? 'deed_paper' : 'none') as any,
                xStart: 0.34,
                facing: 1 as const,
                scale: 1.08,
              },
              {
                id: `act-2-${idx}`,
                name: idx === 1 ? 'মাতবর' : 'ছোট ভাই',
                ageStyle: 'elder' as const,
                characterRole: (idx === 1 ? 'matobbor' : 'elder_father') as any,
                coatColor: idx === 1 ? '#ffffff' : '#f1f5f9',
                hasLungi: true,
                lungiColor: idx === 1 ? '#334155' : '#16a34a',
                hasTupi: true,
                hasBeard: true,
                hasTears: idx !== 1,
                glasses: true,
                emotion: (idx === 1 ? 'smile' : 'angry') as any,
                pose: 'stand' as const,
                propInHand: (idx === 1 ? 'tasbih' : 'none') as any,
                xStart: idx === 1 ? 0.50 : 0.66,
                facing: -1 as const,
                scale: 1.08,
              },
            ]
          : isMotherDaughter
          ? [
              {
                id: `act-m-${idx}`,
                name: 'আম্মা',
                ageStyle: 'elder' as const,
                characterRole: 'mother' as const,
                coatColor: '#e2e8f0',
                scarfColor: '#1e3a8a',
                hasSaree: true,
                hasTears: true,
                emotion: 'cry' as const,
                pose: 'stand' as const,
                xStart: 0.36,
                facing: 1 as const,
                scale: 1.04,
              },
              {
                id: `act-d-${idx}`,
                name: 'মেয়ে',
                ageStyle: 'youth' as const,
                characterRole: 'daughter' as const,
                coatColor: '#be185d',
                scarfColor: '#1e293b',
                hasHijab: true,
                hasTears: true,
                emotion: 'cry' as const,
                pose: 'stand' as const,
                xStart: 0.64,
                facing: -1 as const,
                scale: 0.98,
              },
            ]
          : [
              {
                id: `act-fa-${idx}`,
                name: 'বাবা',
                ageStyle: 'elder' as const,
                characterRole: 'elder_father' as const,
                coatColor: '#f8fafc',
                hasLungi: true,
                lungiColor: '#0369a1',
                hasTupi: true,
                hasBeard: true,
                hasTears: true,
                glasses: true,
                emotion: 'sad' as const,
                pose: 'stand' as const,
                xStart: 0.38,
                facing: 1 as const,
                scale: 1.08,
              },
              {
                id: `act-so-${idx}`,
                name: 'ছেলে',
                ageStyle: 'youth' as const,
                characterRole: 'young_brother' as const,
                coatColor: '#ca8a04',
                hasLungi: false,
                hasTears: true,
                emotion: 'sad' as const,
                pose: 'stand' as const,
                xStart: 0.64,
                facing: -1 as const,
                scale: 1.0,
              },
            ],
      };
    }

    return {
      id: `coded-scene-${Date.now()}-${idx}`,
      title: beat.title,
      narration: makeConciseSubtitle(beat.body),
      durationSec,
      setting: stage ? ('custom_stage' as const) : setting,
      timeOfDay,
      weather,
      weatherIntensity: intensity,
      windStrength,
      characterAction,
      events,
      stage,
    };
  });

  const title = deriveFilmTitle(beats, fullLower, useBangla);
  const tagline = useBangla
    ? 'সম্পূর্ণ কোড দিয়ে তৈরি প্রসিডিউরাল 2D অ্যানিমেশন।'
    : '100% pure-code procedural 2D animation compiled directly from your script.';

  return {
    title,
    tagline,
    scriptText: trimmed,
    character,
    scenes,
  };
}
