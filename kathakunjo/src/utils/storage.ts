import type { StoryDnaProfile, StoryProject, StoryTopic } from '../types/story';

const TOPICS_KEY = 'kothakunjo_saved_topics_v1';
const PROJECTS_KEY = 'kothakunjo_saved_projects_v1';
const DNA_KEY = 'kothakunjo_saved_dna_v1';
const THEME_KEY = 'kothakunjo_theme_v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSavedTopics(): StoryTopic[] {
  return safeParse<StoryTopic[]>(localStorage.getItem(TOPICS_KEY), []);
}

export function saveTopicsList(topics: StoryTopic[]) {
  localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
}

export function loadSavedProjects(): StoryProject[] {
  return safeParse<StoryProject[]>(localStorage.getItem(PROJECTS_KEY), []);
}

export function saveProjectsList(projects: StoryProject[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadSavedDnas(): StoryDnaProfile[] {
  return safeParse<StoryDnaProfile[]>(localStorage.getItem(DNA_KEY), []);
}

export function saveDnasList(dnas: StoryDnaProfile[]) {
  localStorage.setItem(DNA_KEY, JSON.stringify(dnas));
}

export function loadTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme: 'light' | 'dark') {
  localStorage.setItem(THEME_KEY, theme);
}
