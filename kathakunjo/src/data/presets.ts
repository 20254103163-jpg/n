import type { DialectId, DurationId, NarratorPovId } from '../types/story';

export interface DialectOption {
  id: DialectId;
  label: string;
  sample: string;
  instruction: string;
}

export interface ThemeArchetype {
  id: string;
  label: string;
  summary: string;
  motifExamples: string;
  imageUrl: string;
}

export const DIALECT_OPTIONS: DialectOption[] = [
  {
    id: 'grameen_kottho',
    label: 'বাংলাদেশি গ্রামীণ কথ্য',
    sample: '“কইয়া, আমাগো, মাইয়া, চইলা গেল, দরজায় খিল”',
    instruction:
      'Authentic Bangladeshi rural/semi-urban colloquial Bengali spoken voice (like Mymensingh/Dhaka-division/rural storytelling YouTube channels). Use natural oral forms such as কইয়া, আমাগো, তোমাগো, মাইয়া, পোলা, চইলা গেল, আইসা, জিগাইল, কান্দে, পইড়া, দেইখা, খাইয়া, কইল, বাইচা, রাখমু, যামু. Keep sentences crisp, natural, unforced, and deeply human—never caricatured or comical.',
  },
  {
    id: 'mofossol_intimate',
    label: 'মফস্বল আবেগঘন কথ্য',
    sample: '“আব্বা চুপ কইরা রইলেন, আমি আর ডাক দিলাম না”',
    instruction:
      'Warm Bangladeshi small-town (মফস্বল) intimate spoken Bengali—blending everyday natural spoken cadence (আব্বা, আম্মা, ভাইয়া, আপু, ওকে, বললো, গেলো, করতো) with soft colloquial warmth without heavy regionalisms.',
  },
  {
    id: 'promito_editorial',
    label: 'প্রমিত সাহিত্যিক চলিত',
    sample: '“দরজাটা তখনও ভেজানো ছিল, শুধু মানুষটা আর ফেরেনি”',
    instruction:
      'Clean, poetic, understated standard colloquial Bengali (প্রমিত চলিত ভাষা) suited for literary late-night audio stories and podcast narration. Short sentences, rich visual imagery, zero melodrama.',
  },
  {
    id: 'dhakaiya_rural',
    label: 'ঢাকা-মানিকগঞ্জ অঞ্চলের টান',
    sample: '“আইজ থেইকা আর ওই বাড়ির নাম মুখে আনবি না”',
    instruction:
      'Warm central-Bengal village spoken cadence (Manikganj/Munshiganj/Gazipur rural flavor) with natural everyday expressions like আইজ, থেইকা, হইবো, করমু, কইস না, গেছিলো, আইলো.',
  },
  {
    id: 'uttarbongo_earthy',
    label: 'নদীর পাড় ও উত্তরবঙ্গের টান',
    sample: '“বর্ষার রাইতে হারিকেনের আলো নিইভা গেছিলো”',
    instruction:
      'Earthy, tender rural river-belt & northern-Bengal flavored colloquial Bengali (রাইতে, ক্যাঁদে, হামার/আমাগো subtle touch, পাড়ার মানুষ, চরের হাওয়া) kept completely intelligible to all Bengali listeners.',
  },
];

export const DURATION_OPTIONS: {
  id: DurationId;
  label: string;
  minutes: string;
  totalWords: number;
  wordsPerAct: number;
}[] = [
  {
    id: 'short_6',
    label: 'সংক্ষিপ্ত (৬–৮ মিনিট)',
    minutes: '৬–৮ মিনিট',
    totalWords: 1100,
    wordsPerAct: 160,
  },
  {
    id: 'medium_12',
    label: 'মাঝারি (১২–১৪ মিনিট)',
    minutes: '১২–১৪ মিনিট',
    totalWords: 1950,
    wordsPerAct: 280,
  },
  {
    id: 'long_18',
    label: 'পূর্ণদৈর্ঘ্য (১৬–২০ মিনিট)',
    minutes: '১৬–২০ মিনিট',
    totalWords: 2800,
    wordsPerAct: 400,
  },
];

export const NARRATOR_POV_OPTIONS: { id: NarratorPovId; label: string }[] = [
  { id: 'boro_bhai', label: 'বড় ভাই (অনুশোচনা ও দায়িত্ববোধ)' },
  { id: 'baba', label: 'বাবা (নীরব ভালোবাসা ও জেদ)' },
  { id: 'ma', label: 'মা (নিঃশব্দ অপেক্ষা ও মমতা)' },
  { id: 'choto_bon', label: 'ছোট বোন / মেয়ে (ভুল থেকে ঘুরে দাঁড়ানো)' },
  { id: 'probashi_swami', label: 'প্রবাসী ছেলে / স্বামী (দূরদেশের একাকিত্ব)' },
  { id: 'protibeshi', label: 'প্রতিবেশী / শৈশবের বন্ধু (সাক্ষীর চোখ)' },
  { id: 'custom', label: 'নিজস্ব চরিত্র লিখুন' },
];

export const THEME_ARCHETYPES: ThemeArchetype[] = [
  {
    id: 'baper_barir_dorja',
    label: 'বাপের বাড়ির দরজা ও পারিবারিক অভিমান',
    summary: 'একটি ভুল সিদ্ধান্ত, বন্ধ দরজা, নীরব দুই বছর এবং ঝড়ের রাতে ফিরে আসার মর্মস্পর্শী আখ্যান।',
    motifExamples: 'কাঠের খিল, পুরান সাইকেল, বাড়তি ভাতের প্লেট',
    imageUrl: '/src/assets/images/monsoon_wooden_door_1795519383876.jpg',
  },
  {
    id: 'babar_nirob_lorai',
    label: 'বাবার নীরব ত্যাগ ও বড় ভাইয়ের দায়িত্ব',
    summary: 'ভাঙা সাইকেল, বাজারের পুরান থলি আর মধ্যবিত্ত সংসারের না-বলা আত্মত্যাগের গল্প।',
    motifExamples: 'রঙচটা সাইকেল, ছেঁড়া পাঞ্জাবি, হাটের বাজারের থলি',
    imageUrl: '/src/assets/images/rural_dusk_bicycle_1795519380753.jpg',
  },
  {
    id: 'ghure_darano',
    label: 'নীরব ক্ষত পেরিয়ে নিজের পায়ে দাঁড়ানো',
    summary: 'সমাজের কানাকানি আর শ্বশুরবাড়ির অবহেলা পেরিয়ে আত্মমর্যাদা ফিরে পাওয়ার বাস্তব গল্প।',
    motifExamples: 'পুরান সেলাই মেশিন, জমানো কয়েন, মাঝপথে ছাড়া কলেজ বই',
    imageUrl: '/src/assets/images/vintage_sewing_window_1795519380503.jpg',
  },
  {
    id: 'probashi_onushochona',
    label: 'প্রবাসী জীবনের অদৃশ্য ক্ষত ও ফেরা',
    summary: 'টাকা পাঠাতে গিয়ে কাছের মানুষদের শেষ হাসিটুকু মিস করে ফেলার গভীর অনুশোচনা।',
    motifExamples: 'ভাঙা চশমা, অডিও ক্যাসেট / ভয়েস মেসেজ, পিতলের তালা',
    imageUrl: '/src/assets/images/monsoon_wooden_door_1795519383876.jpg',
  },
  {
    id: 'mayer_chithi',
    label: 'মায়ের শেষ চিঠি ও অবহেলিত শৈশব',
    summary: 'শহরের ব্যস্ততায় ফেলে আসা গ্রামের বাড়ি আর মায়ের জমানো ছোট ছোট স্মৃতির ধাক্কা।',
    motifExamples: 'মাটির ব্যাংক, আঁচলে বাঁধা চাবি, পুরান হারিকেন',
    imageUrl: '/src/assets/images/rural_dusk_bicycle_1795519380753.jpg',
  },
  {
    id: 'somajer_deyal',
    label: 'গ্রামের পাড়া-প্রতিবেশী ও মানবিক বদল',
    summary: 'যে মানুষগুলো একদিন কানাকানি করতো, বিপদের দিনে তারাই কীভাবে ঢাল হয়ে দাঁড়ায়।',
    motifExamples: 'উঠানের চুলা, চা-দোকানের বেঞ্চ, মসজিদের মাইক',
    imageUrl: '/src/assets/images/vintage_sewing_window_1795519380503.jpg',
  },
];

export const TTS_VOICES = [
  { id: 'Fenrir', label: 'Fenrir — ভরাট, দৃঢ় ও নাটকীয় কণ্ঠ (ডিফল্ট)', style: 'Grounded, deep, resonant Bangladeshi rural male storyteller narrating an emotional family story with dramatic weight and gentle pauses' },
  { id: 'Charon', label: 'Charon — গম্ভীর ও দরদি পুরুষ কণ্ঠ', style: 'Deep, warm, emotionally restrained Bangladeshi storytelling narrator speaking slowly with natural pauses' },
  { id: 'Enceladus', label: 'Enceladus — নরম ও দরদি কণ্ঠ', style: 'Warm, empathetic Bangladeshi male narrator telling an emotional memory softly' },
  { id: 'Kore', label: 'Kore — মায়াময় ও আবেগী নারী কণ্ঠ', style: 'Tender, heartfelt female narrator delivering an emotional rural Bengali memoir with gentle pauses' },
  { id: 'Zephyr', label: 'Zephyr — কোমল ও শান্ত কথক কণ্ঠ', style: 'Soft, reflective nocturnal storyteller voice with calm pacing and intimate warmth' },
];

export const SAMPLE_RUMA_TRANSCRIPT = `আমি সজীবরে ছাড়া বাঁচমু না। এই কথা কইয়া এক রাতে আমার ছোট বোন ঘর ছাইড়া চইলা গেল। আব্বা দরজায় খিল দিয়া কইল, আজ থেকা আমার কোন মাইয়া নাই। দুই বছর পর যেই রাতে রুমা সেই সজীবের ঘর থেকা পালাইয়া আসলো, তার কপাল দিয়া রক্ত পড়তেছিল।

আমাগো ঘরের দরজাটা কাঠের। পুরান, ভারী। আব্বা নিজের হাতে বানাইছিল। যেই বছর রুমা জন্মাইল। রুমা আমার পাঁচ বছরের ছোট। ছোটবেলায় সারাদিন আমার পিছে পিছে ঘুরতো। ভাইয়া আমারেও নেও। আমি সাইকেলে কইরা তারে স্কুলে দিয়া আসতাম। [মিউজিক] পিছের সিটে বইসা আমার জামা খামচাইয়া ধইরা রাখতো। আর সারা রাস্তায় গান গাইতো। হাটের দিন আব্বা বাজার থেকে আইসা দরজায় দাঁড়াইয়া ডাক দিত। আমার মা কই? রুমা দৌড়াইয়া গিয়া আব্বার থলি হাতাইতো।

কলেজে উঠার এক বছর পর থেইকা রুমা একটু বদলাইয়া গেল। রাতে মোবাইল নিয়া উঠানের কোনায় গিয়া কথা কয়। পাশের এলাকার একটা পোলা, নাম সজীব। আব্বা রুমারে ডাকলো, কইল মা ওই পোলা তোর লাইগা না। যেদিন পাত্রপক্ষ দেখতে আসবো তার আগের রাতে রুমা আমার ঘরে আসলো। কইল, ভাইয়া তুমি আব্বারে একটু বুঝাও, আমি সজীবরে ছাড়া বাঁচমু না। [মিউজিক] আমার মাথায় রাগ উইঠা গেল। আমি কইলাম, ওই পোলার লগে গেলে আমারে আর কোনদিন ভাই ডাকিস না।

পরদিন ভোরে রুমার ঘর খালি। বালিশের উপর একটা চিরকুট। রাতে আব্বা উইঠা গিয়া দরজায় খিল লাগাইলো। তারপর থেকা আমাগো ঘরটা চুপ হইয়া গেল। আম্মা প্রতি রাতে ভাত বাড়ার সময় ভুল কইরা একটা প্লেট বেশি নামায়। তারপর আস্তে উঠাইয়া রাখে। ছয় মাস পর বাজারে রুমারে দেখলাম। একবার আঁচল সরল, কবজির উপরে একটা কালো দাগ দেখলাম। আমি ডাক দিলাম না রাগে অভিমানে।

তারপর আষাড় মাসের এক রাত। রাত তখন দুইটা, দরজায় টোকা পড়ল আস্তে। [মিউজিক] দরজার সামনে রুমা দাঁড়াইয়া আছে, সারা গা ভিজা, কোলে ছয় মাসের একটা বাচ্চা। কপালে একটা ব্যান্ডেজ, ভিজা লাল। রুমা কাঁপা গলায় কইল, আম্মা আমারে একটু ঢুকতে দিবা? আব্বা খালি কইলো, ভিজা গেছস ভিতরে আয়।

দুই বছর আট মাস পর ছাদে বইসা রুমা আমার কান্ধে মাথা রাখলো। কইল ভাইয়া। এরপর আম্মার পুরান সেলাই মেশিনটা বাইর করল। আমি সেই পুরান সাইকেলটা ঠিক কইরা দিলাম। এক সন্ধ্যায় আব্বা দরজার কাঠের খিলটা উঠাইয়া চুলার কাছে লাকড়ির সাথে রাইখা দিল। কইল, এই ঘরের দরজায় আর খিল লাগবো না। মাইয়ারা ভুল করতে পারে। কিন্তু বাপের বাড়ির দরজা যদি বন্ধ থাকে তাইলে একটা ভুল সারা জীবনের শাস্তি হইয়া যায়। আমাগো দরজা এখন সারারাত খোলা থাকে।`;
