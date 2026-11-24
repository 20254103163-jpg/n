import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: '.env.local' });
dotenv.config();
import {
  AI_MASTER_PROMPT,
  buildAgentToolManifest,
  ENGINE_JSON_SCHEMA,
  ENGINE_VERSION,
  VALID_ACTOR_PROPS,
  VALID_BACKDROPS,
  VALID_PARTICLE_KINDS,
  VALID_POSES,
  VALID_PROP_KINDS,
  VALID_SETTINGS,
  validateAndNormalizeBlueprint,
} from './src/animation/engineSchema.ts';
import { PRESET_PROJECTS } from './src/animation/presets.ts';
import { AnimationProject } from './src/animation/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 5173;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Open CORS for external AI agents, Python/Node scripts, MCP bridges, and automation tools
  app.use('/api/engine', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Live Engine State + Connected Studio Viewers (SSE)
  let currentBlueprint: AnimationProject = PRESET_PROJECTS[0];
  let revision = 1;
  let lastUpdatedAt = new Date().toISOString();
  const sseClients = new Set<express.Response>();

  const broadcastEvent = (eventName: string, payload: unknown) => {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // 1. Health & Engine Capabilities
  app.get('/api/engine/health', (_req, res) => {
    res.json({
      ok: true,
      engine: 'Rainbridge Procedural 2D Animation Engine',
      version: ENGINE_VERSION,
      revision,
      lastUpdatedAt,
      connectedViewers: sseClients.size,
      activeTitle: currentBlueprint.title,
      sceneCount: currentBlueprint.scenes.length,
    });
  });

  // 2. Full Introspectable JSON Schema + Universal AI Prompt
  app.get('/api/engine/schema', (_req, res) => {
    res.json({
      ok: true,
      engineVersion: ENGINE_VERSION,
      schema: ENGINE_JSON_SCHEMA,
      masterPrompt: AI_MASTER_PROMPT,
      capabilities: {
        settings: VALID_SETTINGS,
        backdrops: VALID_BACKDROPS,
        actorPoses: VALID_POSES,
        actorProps: VALID_ACTOR_PROPS,
        sceneProps: VALID_PROP_KINDS,
        particles: VALID_PARTICLE_KINDS,
      },
    });
  });

  // 3. OpenAI / Anthropic / MCP Tool Manifest
  app.get('/api/engine/tools', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
    const baseUrl = `${proto}://${host}`;
    res.json(buildAgentToolManifest(baseUrl));
  });

  // 4. Get Currently Active Blueprint
  app.get('/api/engine/blueprint', (_req, res) => {
    res.json({
      ok: true,
      revision,
      lastUpdatedAt,
      blueprint: currentBlueprint,
    });
  });

  // 5. Push / Render Full Blueprint (from ANY AI Agent or Script)
  const handlePushBlueprint = (req: express.Request, res: express.Response) => {
    const raw =
      req.body && typeof req.body === 'object' && 'blueprint' in req.body
        ? (req.body as { blueprint: unknown }).blueprint
        : req.body;

    const result = validateAndNormalizeBlueprint(raw);
    if (!result.ok || !result.project) {
      res.status(400).json({
        ok: false,
        errors: result.errors,
        hint: 'GET /api/engine/schema to inspect the exact blueprint JSON schema.',
      });
      return;
    }

    currentBlueprint = result.project;
    revision += 1;
    lastUpdatedAt = new Date().toISOString();

    broadcastEvent('blueprint', {
      revision,
      lastUpdatedAt,
      blueprint: currentBlueprint,
      source: typeof req.headers['x-agent-name'] === 'string' ? req.headers['x-agent-name'] : 'external-agent',
    });

    res.json({
      ok: true,
      revision,
      lastUpdatedAt,
      pushedToViewers: sseClients.size,
      warnings: result.warnings,
      title: currentBlueprint.title,
      sceneCount: currentBlueprint.scenes.length,
    });
  };

  app.post('/api/engine/blueprint', handlePushBlueprint);
  app.post('/api/engine/render', handlePushBlueprint);

  // 6. Append or Update a Single Scene Incrementally
  app.post('/api/engine/scene', (req, res) => {
    const sceneInput = req.body?.scene ?? req.body;
    const candidate = {
      ...currentBlueprint,
      scenes: [...currentBlueprint.scenes, sceneInput],
    };

    const result = validateAndNormalizeBlueprint(candidate);
    if (!result.ok || !result.project) {
      res.status(400).json({ ok: false, errors: result.errors });
      return;
    }

    // If an existing scene has the same id, replace it instead of duplicating
    const added = result.project.scenes[result.project.scenes.length - 1];
    const existingIdx = currentBlueprint.scenes.findIndex((s) => s.id === added.id);
    const nextScenes =
      existingIdx >= 0
        ? currentBlueprint.scenes.map((s, i) => (i === existingIdx ? added : s))
        : result.project.scenes;

    currentBlueprint = {
      ...currentBlueprint,
      scenes: nextScenes,
    };
    revision += 1;
    lastUpdatedAt = new Date().toISOString();

    broadcastEvent('blueprint', {
      revision,
      lastUpdatedAt,
      blueprint: currentBlueprint,
      source: 'scene-upsert',
    });

    res.json({
      ok: true,
      revision,
      sceneCount: currentBlueprint.scenes.length,
      pushedToViewers: sseClients.size,
    });
  });

  // 7. Remote Playback & Stage Command Endpoint
  app.post('/api/engine/command', (req, res) => {
    const action = req.body?.action;
    const allowed = ['play', 'pause', 'seek', 'toggle_rig', 'toggle_subtitles', 'lantern_burst'];
    if (typeof action !== 'string' || !allowed.includes(action)) {
      res.status(400).json({
        ok: false,
        errors: [`Invalid action. Allowed actions: ${allowed.join(', ')}`],
      });
      return;
    }

    const payload = {
      action,
      timeSec: typeof req.body?.timeSec === 'number' ? req.body.timeSec : undefined,
      sentAt: new Date().toISOString(),
    };
    broadcastEvent('command', payload);
    res.json({ ok: true, deliveredToViewers: sseClients.size, command: payload });
  });

  // 8. Server-Sent Events (SSE) Live Bridge Stream
  app.get('/api/engine/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        engineVersion: ENGINE_VERSION,
        revision,
        connectedViewers: sseClients.size,
      })}\n\n`
    );

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  if (!IS_PROD) {
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
    console.log(
      `Rainbridge 2D Animation Engine running on http://0.0.0.0:${PORT} (Agent API ready at /api/engine/schema)`
    );
  });
}

startServer();
