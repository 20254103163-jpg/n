import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Type } from '@google/genai';
import {
  getGeminiClient,
  TEXT_MODEL,
  FALLBACK_TEXT_MODEL,
  TTS_MODEL,
  withRetry,
  withModelFallback,
  isTransientModelError,
  formatGeminiError,
} from './server/gemini';
import {
  buildTopicsPrompt,
  buildBlueprintPrompt,
  buildWriteActPrompt,
  buildRewriteActPrompt,
  buildPackagingPrompt,
  buildDnaAnalyzePrompt,
} from './server/prompts';
import type { DialectId, DurationId, StoryAct, StoryProject } from './src/types/story';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '4mb' }));

// 1. Generate Viral Bengali Story Topics
app.post('/api/topics/generate', async (req, res) => {
  try {
    const {
      themeLabel,
      themeSummary,
      dialect,
      narratorPov,
      duration,
      customSeed,
      dnaInstruction,
    } = req.body as {
      themeLabel: string;
      themeSummary: string;
      dialect: DialectId;
      narratorPov: string;
      duration: DurationId;
      customSeed?: string;
      dnaInstruction?: string;
    };

    const ai = getGeminiClient();
    const prompt = buildTopicsPrompt({
      themeLabel: themeLabel || 'পারিবারিক আবেগ ও অভিমান',
      themeSummary: themeSummary || 'বাস্তব জীবনের হৃদয়স্পর্শী পারিবারিক গল্প',
      dialect: dialect || 'grameen_kottho',
      narratorPov: narratorPov || 'বড় ভাই',
      duration: duration || 'long_18',
      customSeed,
      dnaInstruction,
    });

    const response = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                youtubeTitles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                coldOpenHook: { type: Type.STRING },
                anchorObject: { type: Type.STRING },
                anchorArc: { type: Type.STRING },
                coreConflict: { type: Type.STRING },
                climaxMoment: { type: Type.STRING },
                closingMoralLine: { type: Type.STRING },
                estimatedDuration: { type: Type.STRING },
                characters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      role: { type: Type.STRING },
                      trait: { type: Type.STRING },
                    },
                    required: ['name', 'role', 'trait'],
                  },
                },
              },
              required: [
                'title',
                'youtubeTitles',
                'coldOpenHook',
                'anchorObject',
                'anchorArc',
                'coreConflict',
                'climaxMoment',
                'closingMoralLine',
                'estimatedDuration',
                'characters',
              ],
            },
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '[]').trim());
    const now = new Date().toISOString();
    const topics = (Array.isArray(parsed) ? parsed : []).map((item, idx) => ({
      ...item,
      id: `topic_${Date.now()}_${idx}`,
      dialect: dialect || 'grameen_kottho',
      narratorPov: narratorPov || 'বড় ভাই',
      themeLabel: themeLabel || 'পারিবারিক আবেগ',
      createdAt: now,
    }));

    res.json({ topics });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 2. Build 7-Act Story Blueprint
app.post('/api/story/blueprint', async (req, res) => {
  try {
    const {
      title,
      premise,
      coldOpenHook,
      anchorObject,
      anchorArc,
      narratorPov,
      dialect,
      duration,
      characters,
      dnaInstruction,
    } = req.body;

    if (!title && !premise) {
      res.status(400).json({ error: 'গল্পের শিরোনাম বা মূল ধারণা দেওয়া প্রয়োজন।' });
      return;
    }

    const ai = getGeminiClient();
    const prompt = buildBlueprintPrompt({
      title: title || 'নতুন গল্প',
      premise: premise || title,
      coldOpenHook,
      anchorObject: anchorObject || 'পুরান পারিবারিক স্মৃতিচিহ্ন',
      anchorArc: anchorArc || 'গল্পের শুরু থেকে শেষ পর্যন্ত আবেগের প্রতীক হিসেবে ফিরে আসা',
      narratorPov: narratorPov || 'বড় ভাই',
      dialect: dialect || 'grameen_kottho',
      duration: duration || 'long_18',
      characters: Array.isArray(characters) ? characters : [],
      dnaInstruction,
    });

    const response = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              refinedTitle: { type: Type.STRING },
              anchorObject: { type: Type.STRING },
              anchorArc: { type: Type.STRING },
              closingMoralLine: { type: Type.STRING },
              characters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    trait: { type: Type.STRING },
                  },
                  required: ['name', 'role', 'trait'],
                },
              },
              acts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    actNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    timestampRange: { type: Type.STRING },
                    emotionalGoal: { type: Type.STRING },
                    keyBeats: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    sensoryDetail: { type: Type.STRING },
                    musicMood: { type: Type.STRING },
                    targetWords: { type: Type.INTEGER },
                  },
                  required: [
                    'actNumber',
                    'title',
                    'timestampRange',
                    'emotionalGoal',
                    'keyBeats',
                    'sensoryDetail',
                    'musicMood',
                    'targetWords',
                  ],
                },
              },
            },
            required: [
              'refinedTitle',
              'anchorObject',
              'anchorArc',
              'closingMoralLine',
              'characters',
              'acts',
            ],
          },
        },
      })
    );

    const blueprint = JSON.parse((response.text ?? '{}').trim());
    res.json({ blueprint });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function streamPromptWithFallback(
  ai: ReturnType<typeof getGeminiClient>,
  prompt: string,
  res: express.Response
) {
  const attempts: { model: string; delayMs: number }[] = [
    { model: TEXT_MODEL, delayMs: 0 },
    { model: TEXT_MODEL, delayMs: 1200 },
    { model: FALLBACK_TEXT_MODEL, delayMs: 500 },
    { model: FALLBACK_TEXT_MODEL, delayMs: 1500 },
  ];

  let emittedAnyChunk = false;
  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    try {
      const stream = await ai.models.generateContentStream({
        model: attempt.model,
        contents: prompt,
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
          }
          emittedAnyChunk = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } catch (err) {
      lastError = err;
      if (emittedAnyChunk || !isTransientModelError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

// 3. Stream-Write an Individual Act (SSE)
app.post('/api/story/write-act', async (req, res) => {
  try {
    const { project, actNumber } = req.body as {
      project: StoryProject;
      actNumber: number;
    };

    const act = project?.acts?.find((a) => a.actNumber === actNumber);
    if (!project || !act) {
      res.status(400).json({ error: 'অধ্যায়ের তথ্য পাওয়া যায়নি।' });
      return;
    }

    const previousActsSummary = project.acts
      .filter((a) => a.actNumber < actNumber && a.script.trim().length > 0)
      .map((a) => {
        const tail = a.script.length > 750 ? `...${a.script.slice(-750)}` : a.script;
        return `[অধ্যায় ${a.actNumber} — ${a.title}]:\n${tail}`;
      })
      .join('\n\n');

    const ai = getGeminiClient();
    const prompt = buildWriteActPrompt({ project, act, previousActsSummary });
    await streamPromptWithFallback(ai, prompt, res);
  } catch (err) {
    const formatted = formatGeminiError(err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
      res.end();
    } else {
      res.status(formatted.status).json({ error: formatted.message });
    }
  }
});

// 4. Rewrite / Deepen an Act (SSE)
app.post('/api/story/rewrite-act', async (req, res) => {
  try {
    const { project, act, instruction } = req.body as {
      project: StoryProject;
      act: StoryAct;
      instruction: string;
    };

    if (!project || !act || !instruction?.trim()) {
      res.status(400).json({ error: 'পুনর্লিখনের নির্দেশনা প্রয়োজন।' });
      return;
    }

    const ai = getGeminiClient();
    const prompt = buildRewriteActPrompt({ project, act, instruction });
    await streamPromptWithFallback(ai, prompt, res);
  } catch (err) {
    const formatted = formatGeminiError(err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
      res.end();
    } else {
      res.status(formatted.status).json({ error: formatted.message });
    }
  }
});

// 5. Generate YouTube / Facebook Packaging & Music Sheet
app.post('/api/story/packaging', async (req, res) => {
  try {
    const { project } = req.body as { project: StoryProject };
    if (!project) {
      res.status(400).json({ error: 'গল্পের তথ্য পাওয়া যায়নি।' });
      return;
    }

    const ai = getGeminiClient();
    const prompt = buildPackagingPrompt(project);

    const response = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              youtubeTitles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              thumbnails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    overlayText: { type: Type.STRING },
                    visualScene: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                  },
                  required: ['overlayText', 'visualScene', 'imagePrompt'],
                },
              },
              description: { type: Type.STRING },
              pinnedComment: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              musicCueSheet: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    actNumber: { type: Type.INTEGER },
                    cueTiming: { type: Type.STRING },
                    instrumentMood: { type: Type.STRING },
                  },
                  required: ['actNumber', 'cueTiming', 'instrumentMood'],
                },
              },
            },
            required: [
              'youtubeTitles',
              'thumbnails',
              'description',
              'pinnedComment',
              'tags',
              'musicCueSheet',
            ],
          },
        },
      })
    );

    const packaging = JSON.parse((response.text ?? '{}').trim());
    res.json({ packaging });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 6. Reverse-Engineer Story DNA from Pasted Transcript
app.post('/api/dna/analyze', async (req, res) => {
  try {
    const { transcript } = req.body as { transcript: string };
    if (!transcript || transcript.trim().length < 60) {
      res.status(400).json({
        error: 'বিশ্লেষণের জন্য অন্তত কয়েক লাইনের একটি বাংলা গল্পের অংশ পেস্ট করুন।',
      });
      return;
    }

    const ai = getGeminiClient();
    const prompt = buildDnaAnalyzePrompt(transcript);

    const response = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sourceTitle: { type: Type.STRING },
              hookFormula: { type: Type.STRING },
              dialectFingerprint: { type: Type.STRING },
              symbolicMotifs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              pacingArchitecture: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              empathyTriggers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              sensoryDetailsUsed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              reusableSystemPrompt: { type: Type.STRING },
            },
            required: [
              'sourceTitle',
              'hookFormula',
              'dialectFingerprint',
              'symbolicMotifs',
              'pacingArchitecture',
              'empathyTriggers',
              'sensoryDetailsUsed',
              'reusableSystemPrompt',
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const dna = {
      ...parsed,
      id: `dna_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    res.json({ dna });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 7. Expressive Bengali Voiceover Audition — Permanently routed via Voice Library (:3000)
const VOICE_LIBRARY_URL = (process.env.VOICE_LIBRARY_URL || 'http://localhost:3000').replace(/\/$/, '');

app.post('/api/audio/tts', async (req, res) => {
  try {
    const { text, voiceName, style } = req.body as {
      text: string;
      voiceName?: string;
      style?: string;
    };

    if (!text?.trim()) {
      res.status(400).json({ error: 'ভয়েসওভারের জন্য কোনো টেক্সট পাওয়া যায়নি।' });
      return;
    }

    const vlRes = await fetch(`${VOICE_LIBRARY_URL}/api/voice-library/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName: voiceName || 'Fenrir',
        style:
          style ||
          'Deep, heartfelt Bangladeshi storyteller narrating an emotional rural family story slowly with gentle pauses',
      }),
    });

    const data = (await vlRes.json()) as {
      ok?: boolean;
      audioBase64?: string;
      mimeType?: string;
      model?: string;
      voiceName?: string;
      source?: string;
      error?: string;
    };

    if (!vlRes.ok || !data.audioBase64) {
      res.status(vlRes.status || 502).json({
        error: data.error || `Voice Library (${VOICE_LIBRARY_URL}) থেকে অডিও পাওয়া যায়নি।`,
      });
      return;
    }

    res.json({
      audioBase64: data.audioBase64,
      mimeType: data.mimeType || 'audio/wav',
      source: 'voice-library',
      model: data.model,
      voiceName: data.voiceName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      res.status(503).json({
        error: `Voice Library (${VOICE_LIBRARY_URL}) চালু নেই! অনুগ্রহ করে আগে voice-library চালু করুন।`,
      });
      return;
    }
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 8. Multi-Pipe Health & Disk Export + Rainbridge 2D Animation Bridge
const PIPELINE_OUTPUT_DIR = path.join(__dirname, 'output');
fs.mkdirSync(PIPELINE_OUTPUT_DIR, { recursive: true });
const RAINBRIDGE_URL = (process.env.RAINBRIDGE_URL || 'http://localhost:3001').replace(/\/$/, '');

app.get('/api/pipeline/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'কথাকুঞ্জ — বাংলা গল্প ও টপিক ইঞ্জিন (Multi-Pipe Edition)',
    port: Number(process.env.PORT) || 3002,
    textModel: TEXT_MODEL,
    fallbackModel: FALLBACK_TEXT_MODEL,
    ttsSource: 'voice-library',
    voiceLibraryUrl: VOICE_LIBRARY_URL,
    rainbridgeUrl: RAINBRIDGE_URL,
  });
});

app.post('/api/pipeline/save-disk', (req, res) => {
  try {
    const { title, fullScript, project } = req.body as {
      title?: string;
      fullScript?: string;
      project?: unknown;
    };
    if (!fullScript?.trim()) {
      res.status(400).json({ ok: false, error: 'সেভ করার মতো কোনো স্ক্রিপ্ট পাওয়া যায়নি।' });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const id = `kathakunjo_${stamp}`;
    const dir = path.join(PIPELINE_OUTPUT_DIR, id);
    fs.mkdirSync(dir, { recursive: true });

    const cleanTts = fullScript
      .replace(/\[মিউজিক\]/g, '')
      .replace(/\[নীরবতা[^\]]*\]/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    fs.writeFileSync(path.join(dir, 'story_full.txt'), `# ${title || 'বাংলা গল্প'}\n\n${fullScript}\n`, 'utf8');
    fs.writeFileSync(path.join(dir, 'story_clean_tts.txt'), cleanTts + '\n', 'utf8');
    if (project) {
      fs.writeFileSync(path.join(dir, 'story_project.json'), JSON.stringify(project, null, 2), 'utf8');
    }

    res.json({ ok: true, id, dir });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ ok: false, error: formatted.message });
  }
});

app.post('/api/pipeline/push-to-rainbridge', async (req, res) => {
  try {
    const { title, fullScript, rainbridgeUrl } = req.body as {
      title?: string;
      fullScript?: string;
      rainbridgeUrl?: string;
    };
    if (!fullScript?.trim()) {
      res.status(400).json({ ok: false, error: 'অ্যানিমেশনে পাঠানোর জন্য আগে গল্প লিখুন।' });
      return;
    }

    const base = (rainbridgeUrl || RAINBRIDGE_URL).replace(/\/$/, '');
    const schemaRes = await fetch(`${base}/api/engine/schema`);
    if (!schemaRes.ok) {
      res.status(502).json({
        ok: false,
        error: `Rainbridge 2D অ্যানিমেশন ইঞ্জিন (${base}) চালু নেই বা সাড়া দিচ্ছে না।`,
      });
      return;
    }
    const schemaData = (await schemaRes.json()) as {
      masterPrompt?: string;
      capabilities?: unknown;
    };

    const ai = getGeminiClient();
    const prompt = `${schemaData.masterPrompt || ''}

নিচের বাংলা গল্পটির সবচেয়ে আবেগঘন ও ভিজ্যুয়াল ৪টি দৃশ্য নির্বাচন করে Rainbridge 2D Animation Engine-এর জন্য একটি সম্পূর্ণ বৈধ JSON Blueprint তৈরি করো।
সব subtitle ও title বাংলায় রাখো, কিন্তু schema-এর enum মানগুলো (setting, backdrop, pose, prop, particles ইত্যাদি) অবশ্যই নিচের allowed capabilities থেকে exact ইংরেজি মান ব্যবহার করো:

Allowed capabilities:
${JSON.stringify(schemaData.capabilities, null, 2)}

গল্পের শিরোনাম: ${title || 'বাংলা গল্প'}
গল্পের স্ক্রিপ্ট:
${fullScript.slice(0, 7500)}

শুধু বৈধ JSON object রিটার্ন করো।`;

    const response = await withModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      })
    );

    const raw = (response.text ?? '{}')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const blueprint = JSON.parse(raw);

    const pushRes = await fetch(`${base}/api/engine/blueprint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-name': 'kathakunjo-story-engine',
      },
      body: JSON.stringify({ blueprint }),
    });
    const pushResult = (await pushRes.json()) as Record<string, unknown>;
    if (!pushRes.ok || !pushResult.ok) {
      res.status(400).json({
        ok: false,
        error: `Rainbridge validation failed: ${JSON.stringify(pushResult.errors || pushResult)}`,
      });
      return;
    }

    res.json({ ok: true, ...pushResult, viewerUrl: base });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ ok: false, error: formatted.message });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kothakunjo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
