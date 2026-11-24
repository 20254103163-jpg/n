import type {
  DialectId,
  DurationId,
  PackagingKit,
  StoryAct,
  StoryDnaProfile,
  StoryProject,
  StoryTopic,
} from '../types/story';

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `সার্ভার ত্রুটি (${res.status})`);
  }
  return data as T;
}

export async function generateTopicsApi(payload: {
  themeLabel: string;
  themeSummary: string;
  dialect: DialectId;
  narratorPov: string;
  duration: DurationId;
  customSeed?: string;
  dnaInstruction?: string;
}): Promise<StoryTopic[]> {
  const res = await fetch('/api/topics/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ topics: StoryTopic[] }>(res);
  return data.topics;
}

export async function generateBlueprintApi(payload: {
  title: string;
  premise: string;
  coldOpenHook?: string;
  anchorObject?: string;
  anchorArc?: string;
  narratorPov: string;
  dialect: DialectId;
  duration: DurationId;
  characters?: { name: string; role: string; trait: string }[];
  dnaInstruction?: string;
}): Promise<{
  refinedTitle: string;
  anchorObject: string;
  anchorArc: string;
  closingMoralLine: string;
  characters: { name: string; role: string; trait: string }[];
  acts: Omit<StoryAct, 'script' | 'status'>[];
}> {
  const res = await fetch('/api/story/blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{
    blueprint: {
      refinedTitle: string;
      anchorObject: string;
      anchorArc: string;
      closingMoralLine: string;
      characters: { name: string; role: string; trait: string }[];
      acts: Omit<StoryAct, 'script' | 'status'>[];
    };
  }>(res);
  return data.blueprint;
}

async function consumeSseStream(
  res: Response,
  onChunk: (chunkText: string) => void
): Promise<string> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `সার্ভার ত্রুটি (${res.status})`);
  }
  if (!res.body) {
    throw new Error('স্ট্রিম পাওয়া যায়নি।');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      const parsed = JSON.parse(jsonStr) as {
        text?: string;
        done?: boolean;
        error?: string;
      };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.text) {
        fullText += parsed.text;
        onChunk(fullText);
      }
    }
  }

  return fullText.trim();
}

export async function streamWriteActApi(
  project: StoryProject,
  actNumber: number,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch('/api/story/write-act', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, actNumber }),
    signal,
  });
  return consumeSseStream(res, onChunk);
}

export async function streamRewriteActApi(
  project: StoryProject,
  act: StoryAct,
  instruction: string,
  onChunk: (accumulatedText: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch('/api/story/rewrite-act', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, act, instruction }),
    signal,
  });
  return consumeSseStream(res, onChunk);
}

export async function generatePackagingApi(
  project: StoryProject
): Promise<PackagingKit> {
  const res = await fetch('/api/story/packaging', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  const data = await parseJsonResponse<{ packaging: PackagingKit }>(res);
  return data.packaging;
}

export async function analyzeDnaApi(transcript: string): Promise<StoryDnaProfile> {
  const res = await fetch('/api/dna/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  const data = await parseJsonResponse<{ dna: StoryDnaProfile }>(res);
  return data.dna;
}

export async function generateTtsAudioApi(payload: {
  text: string;
  voiceName: string;
  style?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const res = await fetch('/api/audio/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ audioBase64: string; mimeType: string }>(res);
}

export function countWords(text: string): number {
  const cleaned = text
    .replace(/\[মিউজিক\]/g, ' ')
    .replace(/\[নীরবতা[^\]]*\]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function estimateMinutesFromWords(words: number): string {
  if (words <= 0) return '0:00';
  const totalSeconds = Math.round((words / 138) * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function buildExportText(
  project: StoryProject,
  options: { includeCues: boolean; includeActHeaders: boolean }
): string {
  const header = `${project.title}\nকথক: ${project.narratorPov} | প্রতীকী বস্তু: ${project.anchorObject}\n${'—'.repeat(42)}\n\n`;

  const body = project.acts
    .filter((a) => a.script.trim())
    .map((act) => {
      let script = act.script.trim();
      if (!options.includeCues) {
        script = script
          .replace(/\[মিউজিক\]/g, '')
          .replace(/\[নীরবতা[^\]]*\]/g, '')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      }
      if (options.includeActHeaders) {
        return `[অধ্যায় ${act.actNumber}: ${act.title} — ${act.timestampRange}]\n(আবহ: ${act.musicMood})\n\n${script}`;
      }
      return script;
    })
    .join('\n\n\n');

  return header + body;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
