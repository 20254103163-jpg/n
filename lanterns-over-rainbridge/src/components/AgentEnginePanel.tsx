import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Download,
  Play,
  Plug,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  AGENT_DEMO_BLUEPRINT,
  AI_MASTER_PROMPT,
  buildAgentToolManifest,
  ENGINE_VERSION,
  validateAndNormalizeBlueprint,
} from '../animation/engineSchema';
import { AnimationProject } from '../animation/types';

interface AgentEnginePanelProps {
  project: AnimationProject;
  onApplyBlueprint: (project: AnimationProject) => void;
  bridgeConnected: boolean;
  lastAgentSync: { source: string; timeLabel: string; count: number } | null;
}

type EngineTab = 'blueprint' | 'bridge';
type SnippetTab = 'curl' | 'python' | 'tools' | 'browser';

export const AgentEnginePanel: React.FC<AgentEnginePanelProps> = ({
  project,
  onApplyBlueprint,
  bridgeConnected,
  lastAgentSync,
}) => {
  const [activeTab, setActiveTab] = useState<EngineTab>('blueprint');
  const [snippetTab, setSnippetTab] = useState<SnippetTab>('curl');
  const [jsonDraft, setJsonDraft] = useState<string>(() =>
    JSON.stringify(project, null, 2)
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState<boolean>(false);

  // Sync editor whenever project changes externally (presets, script compile, or incoming AI agent push)
  useEffect(() => {
    setJsonDraft(JSON.stringify(project, null, 2));
  }, [project]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'http://localhost:3000';
    return window.location.origin;
  }, []);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      setValidationError('Clipboard permission blocked in this iframe—please select and copy manually.');
    }
  };

  const handleApplyJson = () => {
    setValidationError(null);
    setStatusMessage(null);
    try {
      const parsed = JSON.parse(jsonDraft);
      const res = validateAndNormalizeBlueprint(parsed);
      if (!res.ok || !res.project) {
        setValidationError(res.errors.join(' '));
        return;
      }
      onApplyBlueprint(res.project);
      setStatusMessage(
        `Rendered "${res.project.title}" (${res.project.scenes.length} scenes) live on canvas.`
      );
    } catch (err) {
      setValidationError(
        err instanceof Error ? `Invalid JSON syntax: ${err.message}` : 'Invalid JSON syntax.'
      );
    }
  };

  const handleLoadDemo = () => {
    setValidationError(null);
    onApplyBlueprint(AGENT_DEMO_BLUEPRINT);
    setStatusMessage(
      'Loaded 100% declarative Custom Stage demo ("সন্ধ্যার খেয়াঘাট"). Inspect or edit its JSON below.'
    );
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rainbridge-blueprint-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  const handleTestLiveApiPush = async () => {
    setTestingApi(true);
    setValidationError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/engine/blueprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Name': 'studio-self-test',
        },
        body: JSON.stringify(AGENT_DEMO_BLUEPRINT),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setValidationError(data.errors?.join(' ') || 'Live API test failed.');
      } else {
        setStatusMessage(
          `HTTP POST /api/engine/blueprint -> rev #${data.revision} pushed live to ${data.pushedToViewers} viewer(s) via SSE.`
        );
      }
    } catch (err) {
      setValidationError(
        err instanceof Error ? `API bridge unreachable: ${err.message}` : 'API bridge unreachable.'
      );
    } finally {
      setTestingApi(false);
    }
  };

  const snippets: Record<SnippetTab, string> = useMemo(() => {
    const toolManifest = JSON.stringify(buildAgentToolManifest(baseUrl), null, 2);
    return {
      curl: `# 1. Inspect full JSON schema & AI prompt
curl ${baseUrl}/api/engine/schema

# 2. Push a 2D animation JSON blueprint from ANY AI agent (updates canvas live!)
curl -X POST ${baseUrl}/api/engine/blueprint \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Name: my-ai-agent" \\
  -d '{
    "title": "মুনলিট খেয়া",
    "scenes": [{
      "id": "s1",
      "title": "জোছনা নদী",
      "narration": "চাঁদের আলোয় নৌকা ভাসে নীরব নদীর বুকে।",
      "durationSec": 7,
      "setting": "custom_stage",
      "timeOfDay": "moonlit",
      "stage": {
        "backdrop": { "type": "night_water", "showMoon": true, "showStars": true },
        "camera": { "zoomStart": 1.0, "zoomEnd": 1.08 },
        "props": [{ "kind": "boat", "x": 0.22, "y": 0.72, "xEnd": 0.74, "motion": "move_across", "scale": 1.2 }],
        "actors": [{ "id": "a1", "name": "মাঝি", "coatColor": "#2a3c59", "scarfColor": "#d97706", "xStart": 0.24, "xEnd": 0.76, "yGround": 0.7, "pose": "stand", "propInHand": "lantern" }],
        "particles": [{ "kind": "fireflies", "count": 30 }]
      }
    }]
  }'`,
      python: `import requests, json

ENGINE_URL = "${baseUrl}"

# Step 1: Fetch the engine schema & system prompt for ANY LLM (OpenAI / Claude / DeepSeek / Ollama)
schema_info = requests.get(f"{ENGINE_URL}/api/engine/schema").json()
system_prompt = schema_info["masterPrompt"]

# Step 2: Ask your preferred AI / Agent to produce the blueprint JSON, then push it live:
blueprint = {
    "title": "বিকেলের ছাদ",
    "scenes": [
        {
            "id": "scene-1",
            "title": "ঘুড়ি ও সোনালি আকাশ",
            "narration": "বিকেলের নরম রোদে ছাদের ওপর লাল ঘুড়ি উড়ছে।",
            "durationSec": 7,
            "setting": "custom_stage",
            "timeOfDay": "golden_dusk",
            "stage": {
                "backdrop": {"type": "rooftop", "floorY": 0.81},
                "camera": {"zoomStart": 1.0, "zoomEnd": 1.07},
                "props": [{"kind": "kite", "x": 0.68, "y": 0.26, "color": "#e11d48"}],
                "actors": [{
                    "id": "kid", "name": "অর্ক", "ageStyle": "youth",
                    "coatColor": "#2a3c59", "scarfColor": "#d97706",
                    "xStart": 0.35, "yGround": 0.81, "pose": "raise_prop",
                    "propInHand": "lantern", "emotion": "smile"
                }],
                "particles": [{"kind": "petals", "count": 24}]
            }
        }
    ]
}

res = requests.post(f"{ENGINE_URL}/api/engine/blueprint", json=blueprint)
print("Live Render Result:", res.json())`,
      tools: toolManifest,
      browser: `// Control the 2D Animation Engine directly from browser agents, Playwright, or parent iframes
const schema = window.RainbridgeEngine.getSchema();

window.RainbridgeEngine.loadBlueprint({
  title: "Rainy Station",
  scenes: [{
    id: "st-1",
    title: "Evening Train",
    narration: "A warm steam train rolls past the banyan tree in the dusk.",
    durationSec: 7,
    setting: "custom_stage",
    timeOfDay: "golden_dusk",
    stage: {
      backdrop: { type: "outdoor_landscape", floorY: 0.79 },
      props: [
        { kind: "banyan_tree", x: 0.16, y: 0.78, scale: 1.1 },
        { kind: "steam_train", x: 0.92, y: 0.72, xEnd: 0.32, motion: "move_across", scale: 1.0 }
      ],
      actors: [
        { id: "p1", name: "Traveler", coatColor: "#2a3c59", scarfColor: "#dc2626", xStart: 0.28, yGround: 0.8, pose: "stand", propInHand: "lantern" }
      ],
      particles: [{ kind: "petals", count: 20 }]
    }
  }]
});

// Vision-capable agents can capture the current Canvas PNG frame to inspect & refine:
const framePngDataUrl = window.RainbridgeEngine.captureFrame();
// Trigger full WebM video download:
window.RainbridgeEngine.exportVideo();`,
    };
  }, [baseUrl]);

  return (
    <section
      id="engine"
      className="mt-6 rounded-xl border border-[#1F242D] bg-[#10141C] p-5"
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#1F242D] pb-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-medium tracking-tight text-white">
              Universal 2D Animation Engine &amp; AI Agent Bridge
            </h2>
            <span className="font-mono text-xs text-slate-400">
              v{ENGINE_VERSION} · Model-Agnostic JSON + HTTP/SSE + JS SDK
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Connect ChatGPT, Claude, DeepSeek, Gemini, Ollama, Python agents, or MCP tools to direct identical painterly 2D animations (camera dolly, multi-actor 2-bone IK, 20 procedural props, particles, and `.webm` export).
          </p>
        </div>

        {/* Clean 2-Tab Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-[#242B38] bg-[#0B0E14] p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('blueprint')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'blueprint'
                ? 'bg-[#202736] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>AI Blueprint JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bridge')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'bridge'
                ? 'bg-[#202736] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plug className="h-3.5 w-3.5" />
            <span>Agent API &amp; SDK</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {validationError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}
      {statusMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {activeTab === 'blueprint' ? (
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Quick AI Workflow Actions */}
          <div className="flex flex-col justify-between gap-4 lg:col-span-4">
            <div className="space-y-3">
              <div className="rounded-lg border border-[#1E2430] bg-[#0B0E14] p-3.5">
                <p className="text-xs font-medium text-white">
                  1. Copy Universal Prompt to Any AI
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Paste this prompt into ChatGPT, Claude, DeepSeek, or Gemini along with your story. The AI outputs exact engine JSON.
                </p>
                <button
                  type="button"
                  onClick={() => copyText('prompt', AI_MASTER_PROMPT)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-500/12 px-3 py-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  {copiedKey === 'prompt' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied AI Master Prompt</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy AI Master Prompt</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg border border-[#1E2430] bg-[#0B0E14] p-3.5">
                <p className="text-xs font-medium text-white">
                  2. Try Declarative Custom Stage Demo
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  See a 3-scene Bengali story (“সন্ধ্যার খেয়াঘাট”) built 100% from JSON—tea stall, moonlit boat, campfire, camera dolly &amp; 2-bone IK actors.
                </p>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#283040] bg-[#151A25] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Load Custom-Stage Demo</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#1E2430] bg-[#0B0E14] px-3.5 py-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Live SSE Agent Stream</span>
                <span className="font-mono text-slate-300">
                  {bridgeConnected ? 'Connected' : 'Standalone'}
                </span>
              </div>
              {lastAgentSync && (
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Last push: {lastAgentSync.source} · {lastAgentSync.timeLabel} (#{lastAgentSync.count})
                </p>
              )}
            </div>
          </div>

          {/* Right: Live JSON Blueprint Editor */}
          <div className="flex flex-col lg:col-span-8">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="blueprint-json-editor"
                className="text-xs font-medium text-slate-300"
              >
                Active Engine Blueprint JSON (Paste AI output here &amp; click Render)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText('json', jsonDraft)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#242B38] bg-[#151A25] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  {copiedKey === 'json' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedKey === 'json' ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1 rounded-md border border-[#242B38] bg-[#151A25] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  <Download className="h-3 w-3" />
                  <span>Save .json</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyJson}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400"
                >
                  <Play className="h-3 w-3" />
                  <span>Render Blueprint</span>
                </button>
              </div>
            </div>
            <textarea
              id="blueprint-json-editor"
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              spellCheck={false}
              rows={13}
              className="w-full flex-1 resize-y rounded-lg border border-[#242B38] bg-[#090C11] p-3.5 font-mono text-xs leading-relaxed text-slate-200 focus:border-amber-500/70 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Endpoints Directory */}
          <div className="space-y-3 lg:col-span-5">
            <div className="rounded-lg border border-[#1E2430] bg-[#0B0E14] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white">Live HTTP &amp; SSE Endpoints</p>
                <span className="font-mono text-[11px] text-slate-400">CORS Enabled</span>
              </div>
              <dl className="mt-3 space-y-2.5 font-mono text-[11px]">
                <div>
                  <dt className="text-amber-300">GET /api/engine/schema</dt>
                  <dd className="text-slate-400">JSON Schema + AI Master Prompt + capabilities</dd>
                </div>
                <div>
                  <dt className="text-amber-300">GET /api/engine/tools</dt>
                  <dd className="text-slate-400">OpenAI / Anthropic / MCP tool definitions</dd>
                </div>
                <div>
                  <dt className="text-emerald-300">POST /api/engine/blueprint</dt>
                  <dd className="text-slate-400">Push full JSON blueprint → updates live canvas via SSE</dd>
                </div>
                <div>
                  <dt className="text-emerald-300">POST /api/engine/scene</dt>
                  <dd className="text-slate-400">Append or update a single scene incrementally</dd>
                </div>
                <div>
                  <dt className="text-emerald-300">POST /api/engine/command</dt>
                  <dd className="text-slate-400">Remote play, pause, seek, toggle_rig, lantern_burst</dd>
                </div>
                <div>
                  <dt className="text-sky-300">GET /api/engine/events</dt>
                  <dd className="text-slate-400">Server-Sent Events live stream to studio player</dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={testingApi}
                onClick={handleTestLiveApiPush}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>
                  {testingApi ? 'Pushing via HTTP POST...' : 'Test Live Agent API Push'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Ready-to-Use Integration Code */}
          <div className="flex flex-col lg:col-span-7">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-[#242B38] bg-[#0B0E14] p-0.5">
                {(
                  [
                    ['curl', 'cURL'],
                    ['python', 'Python Agent'],
                    ['tools', 'MCP / Tool Schema'],
                    ['browser', 'JS SDK'],
                  ] as [SnippetTab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSnippetTab(key)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                      snippetTab === key
                        ? 'bg-[#202736] font-medium text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => copyText(snippetTab, snippets[snippetTab])}
                className="inline-flex items-center gap-1 rounded-md border border-[#242B38] bg-[#151A25] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
              >
                {copiedKey === snippetTab ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <pre className="max-h-[340px] flex-1 overflow-auto rounded-lg border border-[#242B38] bg-[#090C11] p-3.5 font-mono text-xs leading-relaxed text-slate-200">
              <code>{snippets[snippetTab]}</code>
            </pre>
          </div>
        </div>
      )}
    </section>
  );
};
