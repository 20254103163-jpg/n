import { DIALECT_OPTIONS, DURATION_OPTIONS } from '../src/data/presets';
import type { DialectId, DurationId, MusicDensity, StoryAct, StoryProject } from '../src/types/story';

export function getDialectInstruction(dialectId: DialectId): string {
  const found = DIALECT_OPTIONS.find((d) => d.id === dialectId);
  return found ? `${found.label}: ${found.instruction}` : DIALECT_OPTIONS[0].instruction;
}

export function getDurationSpec(durationId: DurationId) {
  return DURATION_OPTIONS.find((d) => d.id === durationId) ?? DURATION_OPTIONS[2];
}

export const MASTER_STORYTELLING_CRAFT_RULES = `
You are a master Bangladeshi emotional audio-storyteller and scriptwriter who creates viral 12–20 minute spoken-word Bengali YouTube & Facebook audio stories (like the celebrated "আমাগো দরজা এখন সারারাত খোলা থাকে" / Ruma's story style).

CORE CRAFT PRINCIPLES YOU MUST ALWAYS FOLLOW:
1. ORAL CADENCE FIRST: Every sentence is meant to be spoken aloud slowly into a microphone. Use short, rhythmic, breath-friendly sentences. Never write stiff newspaper Bengali, academic prose, or robotic translated clichés.
2. SHOW-DON'T-TELL MICRO-DETAILS: Convey heartbreak through concrete everyday Bangladeshi domestic details—e.g. a mother accidentally setting one extra rice plate at night and quietly putting it back; a father walking with his head bowed past the village tea stall; a bruise briefly glimpsed under a cotton saree aanchol; a child flinching at a door sound.
3. PHYSICAL ANCHOR OBJECT: Every great story revolves around one ordinary physical object (wooden door latch, vintage bicycle, brass tiffin box, old sewing machine, father's cracked spectacles, kerosene lantern) that carries emotional meaning in Act 1, breaks or stays locked in the middle, and transforms in the finale.
4. COLD OPEN HOOK: Always open in media res in the first 15–20 seconds with a visceral spoken dialogue line + sudden rupture + haunting flash-forward detail that makes the listener refuse to click away.
5. EMOTIONAL RESTRAINT OVER MELODRAMA: Real tears come from understatement—a father who only says "ভিজা গেছস, ভিতরে আয়", a sister who says "ভাইয়া" after two years and eight months. Never over-explain emotions with "আমার খুব কষ্ট হচ্ছিল" when a physical action says it ten times harder.
6. REALISTIC BANGLADESHI SETTING: Authentic rural/semi-urban details—হাটের দিন, আষাঢ় মাসের ঝুম বৃষ্টি, টিনের চালে বৃষ্টির শব্দ, হারিকেন, উঠান, পাড়ার চাচি, চায়ের দোকান, উপজেলা সদর, রিকশা, সেলাই মেশিন, কাজী অফিস, প্রবাসের ফোনকল.
7. MORAL ECHO CLOSING: End with a quiet, unforgettable 2–3 sentence philosophical truth rooted directly in the anchor object.
`;

export function buildTopicsPrompt(params: {
  themeLabel: string;
  themeSummary: string;
  dialect: DialectId;
  narratorPov: string;
  duration: DurationId;
  customSeed?: string;
  dnaInstruction?: string;
}): string {
  const dialectSpec = getDialectInstruction(params.dialect);
  const durationSpec = getDurationSpec(params.duration);

  return `
${MASTER_STORYTELLING_CRAFT_RULES}

TASK: Generate 5 completely original, deeply moving, high-retention Bengali emotional audio-story topics.
All text fields MUST be written in natural, authentic Bengali matching the requested dialect.

PARAMETERS:
- Theme / World: ${params.themeLabel} (${params.themeSummary})
- Dialect & Voice Style: ${dialectSpec}
- Narrator POV: ${params.narratorPov}
- Target Runtime: ${durationSpec.minutes}
${params.customSeed?.trim() ? `- Creator's Custom Seed Idea (weave strongly into the concepts): ${params.customSeed.trim()}` : ''}
${params.dnaInstruction?.trim() ? `- Special Extracted Story DNA Formula to honor: ${params.dnaInstruction.trim()}` : ''}

REQUIREMENTS FOR EACH OF THE 5 TOPICS:
- Each topic must feel like a completely distinct human story with fresh Bangladeshi names (e.g., সেলিম, পারুল, মিজান, তানিয়া, রফিক, সালেহা, নাজমুল, হাসনা—never repeat Ruma/Sajib!).
- "coldOpenHook" MUST be a ready-to-read 35–55 word spoken Bengali opening hook written in the EXACT target dialect, immediately gripping the listener in 15–20 seconds.
- "anchorObject" MUST be a vivid everyday physical object (e.g., "পিতলের টিফিন ক্যারিয়ার", "আব্বার পুরান রেডিও", "টিনের ট্রাংক") and "anchorArc" explains how it appears early and resolves at the end.
- "youtubeTitles" MUST include 3 compelling Bengali YouTube titles (not clickbait trash—deeply emotional, human curiosity titles).
- "closingMoralLine" MUST be a memorable 1–2 sentence closing reflection tied to the anchor object.
- "characters" MUST list 3–4 core characters with authentic Bengali names, relationship role, and one human flaw or trait.
`;
}

export function buildBlueprintPrompt(params: {
  title: string;
  premise: string;
  coldOpenHook?: string;
  anchorObject: string;
  anchorArc: string;
  narratorPov: string;
  dialect: DialectId;
  duration: DurationId;
  characters: { name: string; role: string; trait: string }[];
  dnaInstruction?: string;
}): string {
  const dialectSpec = getDialectInstruction(params.dialect);
  const durationSpec = getDurationSpec(params.duration);

  return `
${MASTER_STORYTELLING_CRAFT_RULES}

TASK: Design a detailed, emotionally airtight 7-Act Narrative Blueprint in Bengali for this audio story so it can be written act-by-act into a complete ${durationSpec.minutes} (~${durationSpec.totalWords} Bengali words) narration script.

STORY DETAILS:
- Title: ${params.title}
- Premise / Conflict: ${params.premise}
${params.coldOpenHook ? `- Cold Open Hook Seed: ${params.coldOpenHook}` : ''}
- Physical Anchor Object: ${params.anchorObject}
- Anchor Object Arc: ${params.anchorArc}
- Narrator POV: ${params.narratorPov}
- Dialect: ${dialectSpec}
- Characters: ${params.characters.map((c) => `${c.name} (${c.role} — ${c.trait})`).join('; ')}
${params.dnaInstruction ? `- Inspired Story DNA: ${params.dnaInstruction}` : ''}

THE 7-ACT STRUCTURE TO FOLLOW:
- Act 1: কোল্ড ওপেন হুক (0:00–0:30) — In media res visceral opening dialogue, rupture, and haunting flash-forward wound.
- Act 2: শৈশবের মায়া ও প্রতীকী বস্তু (Warm Nostalgia) — Make the listener fall in love with the family through tiny loving daily rituals & introduce the anchor object.
- Act 3: ফাটল, ভুল বোঝাবুঝি ও চরম কথা (The Cracks & Regrettable Words) — Slow tension, realistic warning, stubbornness, and one harsh sentence the narrator will regret for years.
- Act 4: বিচ্ছেদ, নীরব সংসার ও অদৃশ্য ক্ষত (The Rupture & Quiet Years) — The sudden departure/loss, domestic silence, mother's subtle grief habit, and a brief painful glimpse of hidden suffering.
- Act 5: ঝড়ের রাত / প্রত্যাবর্তনের মোড় (The Turning Point) — A rainy night or sudden arrival, visual shock, restrained mercy, and quiet symptoms of hidden trauma.
- Act 6: মুখোমুখি সংঘাত ও সমাজের বদল (Confrontation & Reckoning) — Late-night truth revealed, village/family gossip, dramatic confrontation where quiet dignity wins, unexpected community support or legal/moral stand.
- Act 7: ক্ষমা, ঘুরে দাঁড়ানো ও শেষ প্রতিধ্বনি (Healing, Callback & Moral Echo) — Quiet reconciliation, standing on own feet, transforming the anchor object forever, and the unforgettable closing line.

Set realistic cumulative timestamp ranges across the 7 acts matching ${durationSpec.minutes}, and distribute targetWords across acts totaling roughly ${durationSpec.totalWords} words (Act 1 shorter ~120 words; Acts 2–6 rich & deep; Act 7 emotionally unhurried).
Write all titles, emotional goals, keyBeats, sensoryDetail, and musicMood in natural Bengali.
`;
}

export function buildWriteActPrompt(params: {
  project: StoryProject;
  act: StoryAct;
  previousActsSummary: string;
}): string {
  const dialectSpec = getDialectInstruction(params.project.dialect);
  const musicRule =
    params.project.musicDensity === 'subtle'
      ? 'Insert [মিউজিক] cues sparingly (1–2 times per act, only at the deepest emotional pause).'
      : params.project.musicDensity === 'cinematic'
        ? 'Insert [মিউজিক] cues cinematically (4–6 times per act) at key dialogue beats, silences, and emotional turns, plus occasional [নীরবতা] pauses.'
        : 'Insert [মিউজিক] cues naturally (2–4 times per act) right after heavy spoken lines or scene shifts, matching authentic Bangladeshi audio-story rhythm.';

  return `
${MASTER_STORYTELLING_CRAFT_RULES}

TASK: Write ONLY the complete, spoken-word Bengali narration script for Act ${params.act.actNumber} of "${params.project.title}".

STORY CONTEXT:
- Title: ${params.project.title}
- Narrator POV: ${params.project.narratorPov} (Write strictly in first-person voice of this narrator!)
- Dialect & Voice: ${dialectSpec}
- Physical Anchor Object: ${params.project.anchorObject} (${params.project.anchorArc})
- Characters: ${params.project.characters.map((c) => `${c.name} (${c.role}: ${c.trait})`).join(' | ')}
- Closing Moral Destination (save the actual final punchline ONLY for Act 7): ${params.project.closingMoralLine}

CONTINUITY FROM PREVIOUS ACTS:
${params.previousActsSummary || 'This is Act 1 (the very beginning of the story). Open immediately with an unforgettable cold open hook.'}

CURRENT ACT TO WRITE:
- Act ${params.act.actNumber}: ${params.act.title} (${params.act.timestampRange})
- Emotional Goal: ${params.act.emotionalGoal}
- Required Story Beats:
${params.act.keyBeats.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}
- Signature Sensory Detail to weave naturally: ${params.act.sensoryDetail}
- Background Music Feel: ${params.act.musicMood}
- Target Length: Approximately ${params.act.targetWords}–${Math.round(params.act.targetWords * 1.25)} Bengali words. Do NOT rush or summarize—live inside every dialogue, pause, and gesture!

FORMATTING RULES:
- Output ONLY the spoken Bengali narration script (with natural paragraph breaks and inline [মিউজিক] cues).
- Do NOT output English explanations, markdown headings (#), act numbers, word counts, or meta commentary.
- ${musicRule}
- Write dialogue seamlessly inside the narrator's spoken cadence (just like real spoken Bengali audio narration, e.g. আব্বা কইল, ভিজা গেছস ভিতরে আয়।).
- If this is NOT Act 7, end the act with natural narrative momentum leading seamlessly into the next act.
- If this IS Act 7, bring the physical anchor object full circle and close with a deeply resonant final moral reflection.
`;
}

export function buildRewriteActPrompt(params: {
  project: StoryProject;
  act: StoryAct;
  instruction: string;
}): string {
  const dialectSpec = getDialectInstruction(params.project.dialect);
  return `
${MASTER_STORYTELLING_CRAFT_RULES}

TASK: Rewrite and elevate the Bengali narration script for Act ${params.act.actNumber} ("${params.act.title}") of "${params.project.title}" according to the creator's exact directive.

CREATOR DIRECTIVE: ${params.instruction}

DIALECT & VOICE TO MAINTAIN: ${dialectSpec}
NARRATOR POV: ${params.project.narratorPov}
ANCHOR OBJECT: ${params.project.anchorObject}

CURRENT SCRIPT OF ACT ${params.act.actNumber}:
"""
${params.act.script}
"""

RULES:
- Keep full continuity with the story's characters and plot.
- Preserve authentic oral cadence and natural [মিউজিক] cues.
- Output ONLY the revised Bengali narration text—no explanations, no markdown headers, no notes.
`;
}

export function buildPackagingPrompt(project: StoryProject): string {
  const fullScriptExcerpt = project.acts
    .map((a) => `অধ্যায় ${a.actNumber} (${a.title}):\n${a.script.slice(0, 500)}`)
    .join('\n\n');

  return `
You are a veteran Bangladeshi YouTube & Facebook emotional storytelling producer.
Create a complete, high-CTR production & publishing kit in Bengali for this completed audio story.

STORY TITLE: ${project.title}
PREMISE: ${project.premise}
ANCHOR OBJECT: ${project.anchorObject}
CLOSING LINE: ${project.closingMoralLine}
NARRATOR POV: ${project.narratorPov}
SCRIPT HIGHLIGHTS:
${fullScriptExcerpt}

Generate:
1. "youtubeTitles": 5 deeply compelling Bengali YouTube titles (varied angles: curiosity hook, emotional wound, quote-led, father/family bond, life-lesson).
2. "thumbnails": 3 distinct thumbnail concepts. Each must include:
   - "overlayText": Very short, punchy 3–5 word Bengali text for the thumbnail (e.g., "আব্বা দরজায় খিল দিল!", "২ বছর পর সেই রাত...")
   - "visualScene": Detailed Bengali visual description of the composition, emotion, lighting, and props.
   - "imagePrompt": Rich English cinematic photography prompt (documentary 35mm Bangladeshi rural/domestic lighting, no text in image) ready for an image generator.
3. "description": Engaging Bengali YouTube video description (including emotional teaser + chapter feel + call to share personal stories in comments).
4. "pinnedComment": One heartfelt Bengali question to pin in the comment section that sparks hundreds of authentic viewer replies.
5. "tags": 14 relevant Bengali & Banglish SEO tags (e.g., বাংলা গল্প, হৃদয়স্পর্শী গল্প, বাস্তব জীবনের গল্প, Bangla Emotional Story, etc.).
6. "musicCueSheet": Act-by-act (1 to 7) background audio & sound design recommendations in Bengali (e.g., বাঁশির করুণ সুর, বৃষ্টির অ্যাম্বিয়েন্স + ধীর পিয়ানো, নীরবতা).
`;
}

export function buildDnaAnalyzePrompt(transcript: string): string {
  return `
You are an elite Bengali narrative analyst and viral storytelling architect.
Analyze the following Bengali audio-story transcript and reverse-engineer its exact storytelling DNA in clear, practical Bengali so a creator can replicate this exact emotional power on brand-new original topics.

TRANSCRIPT TO ANALYZE:
"""
${transcript.slice(0, 22000)}
"""

Extract:
1. "sourceTitle": Suggest a sharp literary Bengali title capturing the essence of this transcript.
2. "hookFormula": Explain clearly how the first 15–25 seconds hook the listener (sentence rhythm, dialogue + conflict + time jump).
3. "dialectFingerprint": Describe the exact speech register, key regional/colloquial words, sentence length, and voiceover feel.
4. "symbolicMotifs": List 3–5 recurring physical objects or sensory motifs used across the story.
5. "pacingArchitecture": Break down the 5–7 emotional stages/turns that sustain listener retention.
6. "empathyTriggers": List 4–5 specific human moments that create deep tears/empathy without melodrama.
7. "sensoryDetailsUsed": List 4–6 concrete show-don't-tell domestic details from the text.
8. "reusableSystemPrompt": Write a concise, powerful Bengali + English craft instruction paragraph (80–120 words) summarizing this exact storytelling formula so it can be directly injected into our Topic & Story Engine to generate fresh original stories with the same soul!
`;
}
