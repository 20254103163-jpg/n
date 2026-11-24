export type DialectId =
  | 'grameen_kottho'
  | 'mofossol_intimate'
  | 'promito_editorial'
  | 'dhakaiya_rural'
  | 'uttarbongo_earthy';

export type DurationId = 'short_6' | 'medium_12' | 'long_18';

export type NarratorPovId =
  | 'boro_bhai'
  | 'baba'
  | 'ma'
  | 'choto_bon'
  | 'probashi_swami'
  | 'protibeshi'
  | 'custom';

export type MusicDensity = 'subtle' | 'balanced' | 'cinematic';

export interface CharacterProfile {
  name: string;
  role: string;
  trait: string;
}

export interface StoryTopic {
  id: string;
  title: string;
  youtubeTitles: string[];
  coldOpenHook: string;
  anchorObject: string;
  anchorArc: string;
  narratorPov: string;
  dialect: DialectId;
  themeLabel: string;
  coreConflict: string;
  climaxMoment: string;
  closingMoralLine: string;
  estimatedDuration: string;
  characters: CharacterProfile[];
  createdAt: string;
}

export interface StoryAct {
  actNumber: number;
  title: string;
  timestampRange: string;
  emotionalGoal: string;
  keyBeats: string[];
  sensoryDetail: string;
  musicMood: string;
  targetWords: number;
  script: string;
  status: 'idle' | 'writing' | 'done' | 'error';
  errorMessage?: string;
}

export interface PackagingKit {
  youtubeTitles: string[];
  thumbnails: {
    overlayText: string;
    visualScene: string;
    imagePrompt: string;
  }[];
  description: string;
  pinnedComment: string;
  tags: string[];
  musicCueSheet: {
    actNumber: number;
    cueTiming: string;
    instrumentMood: string;
  }[];
}

export interface StoryProject {
  id: string;
  title: string;
  topicId?: string;
  dialect: DialectId;
  duration: DurationId;
  narratorPov: string;
  musicDensity: MusicDensity;
  anchorObject: string;
  anchorArc: string;
  closingMoralLine: string;
  premise: string;
  characters: CharacterProfile[];
  acts: StoryAct[];
  packaging?: PackagingKit;
  dnaInspiration?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryDnaProfile {
  id: string;
  sourceTitle: string;
  hookFormula: string;
  dialectFingerprint: string;
  symbolicMotifs: string[];
  pacingArchitecture: string[];
  empathyTriggers: string[];
  sensoryDetailsUsed: string[];
  reusableSystemPrompt: string;
  createdAt: string;
}

export type ActiveTab = 'topics' | 'engine' | 'dna' | 'library';
