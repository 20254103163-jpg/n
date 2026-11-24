/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProceduralSoundscape } from './animation/audio';
import { PRESET_PROJECTS } from './animation/presets';
import { AnimationScene } from './animation/scene';
import { compileScriptPureCode } from './animation/scriptCompiler';
import {
  AI_MASTER_PROMPT,
  ENGINE_JSON_SCHEMA,
  ENGINE_VERSION,
  validateAndNormalizeBlueprint,
} from './animation/engineSchema';
import {
  AnimationProject,
  buildTimeline,
  CharacterConfig,
  DirectorControls,
  FrameMetrics,
  SceneEvents,
  SceneSpec,
} from './animation/types';
import { AgentEnginePanel } from './components/AgentEnginePanel';
import { AnimationStage, AnimationStageHandle } from './components/AnimationStage';
import { DirectorDeck } from './components/DirectorDeck';
import { ScriptStudio } from './components/ScriptStudio';
import { StoryboardPanel } from './components/StoryboardPanel';

interface RainbridgeEngineSDK {
  version: string;
  getSchema: () => typeof ENGINE_JSON_SCHEMA;
  getPrompt: () => string;
  getBlueprint: () => AnimationProject;
  loadBlueprint: (raw: unknown) => { ok: boolean; errors: string[]; warnings: string[] };
  play: () => void;
  pause: () => void;
  seek: (timeSec: number) => void;
  captureFrame: () => string | null;
  exportVideo: () => void;
}

declare global {
  interface Window {
    RainbridgeEngine?: RainbridgeEngineSDK;
  }
}

const DEFAULT_CONTROLS: DirectorControls = {
  timeOfDayOverride: null,
  windMultiplier: 1.0,
  weatherIntensityOverride: null,
  cadence: 60,
  showRigOverlay: false,
  showSubtitles: true,
  playbackSpeed: 1,
};

const INITIAL_PROJECT = PRESET_PROJECTS[0];
const INITIAL_TIMELINE = buildTimeline(INITIAL_PROJECT.scenes);

const INITIAL_METRICS: FrameMetrics = {
  timeSec: 0,
  totalDuration: INITIAL_TIMELINE.totalDuration,
  frameNumber: 0,
  sceneIndex: 0,
  sceneTitle: INITIAL_PROJECT.scenes[0].title,
  sceneNarration: INITIAL_PROJECT.scenes[0].narration,
  hipYOffset: 0,
  leadKneeAngleDeg: 170,
  scarfTension: 0,
  lanternSwingDeg: 0,
  windSpeedMs: 3.1,
  weatherDensityPct: 0,
  activeLanterns: 1,
  activeRipples: 0,
  skyPhaseLabel: 'Golden Dusk',
};

export default function App() {
  const sceneRef = useRef<AnimationScene>(new AnimationScene());
  const soundRef = useRef<ProceduralSoundscape>(new ProceduralSoundscape());
  const stageRef = useRef<AnimationStageHandle>(null);

  const [project, setProject] = useState<AnimationProject>(INITIAL_PROJECT);
  const [scriptText, setScriptText] = useState<string>(INITIAL_PROJECT.scriptText);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  const [controls, setControls] = useState<DirectorControls>(DEFAULT_CONTROLS);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<FrameMetrics>(INITIAL_METRICS);
  const [seekRequest, setSeekRequest] = useState<{ timeSec: number; nonce: number } | null>(null);
  const [bridgeConnected, setBridgeConnected] = useState<boolean>(false);
  const [lastAgentSync, setLastAgentSync] = useState<{
    source: string;
    timeLabel: string;
    count: number;
  } | null>(null);

  const projectRef = useRef<AnimationProject>(project);
  projectRef.current = project;

  useEffect(() => {
    const sound = soundRef.current;
    return () => {
      sound.dispose();
    };
  }, []);

  const applyExternalBlueprint = useCallback((nextProject: AnimationProject) => {
    setProject(nextProject);
    setScriptText(nextProject.scriptText);
    setCompileError(null);
    setSelectedSceneIndex(0);
    setControls((prev) => ({
      ...prev,
      timeOfDayOverride: null,
      weatherIntensityOverride: null,
    }));
    setSeekRequest({ timeSec: 0, nonce: Date.now() });
    setIsPlaying(true);
  }, []);

  // Live SSE Agent Bridge: listens for incoming HTTP POST /api/engine/blueprint & /api/engine/command
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/engine/events');

    es.addEventListener('connected', () => {
      setBridgeConnected(true);
    });

    es.addEventListener('blueprint', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data);
        const res = validateAndNormalizeBlueprint(payload.blueprint);
        if (res.ok && res.project) {
          applyExternalBlueprint(res.project);
          const nowStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastAgentSync((prev) => ({
            source: payload.source || 'external-agent',
            timeLabel: nowStr,
            count: (prev?.count ?? 0) + 1,
          }));
        }
      } catch {
        // Ignore malformed SSE payload
      }
    });

    es.addEventListener('command', (ev) => {
      try {
        const cmd = JSON.parse((ev as MessageEvent).data);
        if (cmd.action === 'play') setIsPlaying(true);
        else if (cmd.action === 'pause') setIsPlaying(false);
        else if (cmd.action === 'seek' && typeof cmd.timeSec === 'number') {
          setSeekRequest({ timeSec: cmd.timeSec, nonce: Date.now() });
        } else if (cmd.action === 'toggle_rig') {
          setControls((prev) => ({ ...prev, showRigOverlay: !prev.showRigOverlay }));
        } else if (cmd.action === 'toggle_subtitles') {
          setControls((prev) => ({ ...prev, showSubtitles: !prev.showSubtitles }));
        } else if (cmd.action === 'lantern_burst') {
          sceneRef.current.triggerLanternBurst();
          soundRef.current.playLanternChime();
        }
      } catch {
        // Ignore malformed command payload
      }
    });

    es.onerror = () => {
      setBridgeConnected(false);
    };

    return () => {
      es.close();
    };
  }, [applyExternalBlueprint]);

  // Global Browser JS SDK (window.RainbridgeEngine) & window.postMessage Bridge
  useEffect(() => {
    const sdk: RainbridgeEngineSDK = {
      version: ENGINE_VERSION,
      getSchema: () => ENGINE_JSON_SCHEMA,
      getPrompt: () => AI_MASTER_PROMPT,
      getBlueprint: () => projectRef.current,
      loadBlueprint: (raw: unknown) => {
        const res = validateAndNormalizeBlueprint(raw);
        if (res.ok && res.project) {
          applyExternalBlueprint(res.project);
        }
        return { ok: res.ok, errors: res.errors, warnings: res.warnings };
      },
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
      seek: (timeSec: number) => setSeekRequest({ timeSec, nonce: Date.now() }),
      captureFrame: () => stageRef.current?.captureFrame() ?? null,
      exportVideo: () => stageRef.current?.startVideoExport(),
    };

    window.RainbridgeEngine = sdk;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== 'rainbridge-agent') return;
      if (data.action === 'loadBlueprint') {
        const res = sdk.loadBlueprint(data.payload);
        event.source?.postMessage(
          { source: 'rainbridge-engine', replyTo: 'loadBlueprint', result: res },
          { targetOrigin: '*' }
        );
      } else if (data.action === 'play') {
        sdk.play();
      } else if (data.action === 'pause') {
        sdk.pause();
      } else if (data.action === 'seek' && typeof data.timeSec === 'number') {
        sdk.seek(data.timeSec);
      } else if (data.action === 'exportVideo') {
        sdk.exportVideo();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      delete window.RainbridgeEngine;
    };
  }, [applyExternalBlueprint]);

  const handleUpdateControls = useCallback((patch: Partial<DirectorControls>) => {
    setControls((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetControls = useCallback(() => {
    setControls(DEFAULT_CONTROLS);
  }, []);

  const handleSelectPreset = useCallback((preset: AnimationProject) => {
    setProject(preset);
    setScriptText(preset.scriptText);
    setCompileError(null);
    setSelectedSceneIndex(0);
    setControls(DEFAULT_CONTROLS);
    setSeekRequest({ timeSec: 0, nonce: Date.now() });
    setIsPlaying(true);
  }, []);

  const handleCompileScript = useCallback(() => {
    const trimmed = scriptText.trim();
    if (trimmed.length < 4) {
      setCompileError('অনুগ্রহ করে অন্তত একটি বাক্য লিখুন / Please enter a short story script first.');
      return;
    }

    setIsCompiling(true);
    setCompileError(null);

    // 100% pure client-side TypeScript script compiler — zero external AI API calls
    const compiledProject = compileScriptPureCode(trimmed);
    setProject(compiledProject);
    setSelectedSceneIndex(0);
    setControls((prev) => ({
      ...prev,
      timeOfDayOverride: null,
      weatherIntensityOverride: null,
    }));
    setSeekRequest({ timeSec: 0, nonce: Date.now() });
    setIsPlaying(true);
    setIsCompiling(false);
  }, [scriptText]);

  const handleUpdateCharacter = useCallback((patch: Partial<CharacterConfig>) => {
    setProject((prev) => ({
      ...prev,
      character: { ...prev.character, ...patch },
    }));
  }, []);

  const handleSelectScene = useCallback((index: number, startSec: number) => {
    setSelectedSceneIndex(index);
    setSeekRequest({ timeSec: startSec, nonce: Date.now() });
  }, []);

  const handleUpdateScene = useCallback((index: number, patch: Partial<SceneSpec>) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) => (i === index ? { ...sc, ...patch } : sc)),
    }));
  }, []);

  const handleUpdateSceneEvents = useCallback((index: number, patch: Partial<SceneEvents>) => {
    setProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, i) =>
        i === index ? { ...sc, events: { ...sc.events, ...patch } } : sc
      ),
    }));
  }, []);

  const handleAddScene = useCallback(() => {
    setProject((prev) => {
      if (prev.scenes.length >= 8) return prev;
      const last = prev.scenes[prev.scenes.length - 1];
      const nextIdx = prev.scenes.length;
      const newScene: SceneSpec = {
        id: `scene-${Date.now()}`,
        title: `Scene ${nextIdx + 1}`,
        narration: 'The journey continues under a shifting sky.',
        durationSec: 6,
        setting: last?.setting ?? 'rainbridge',
        timeOfDay: 'moonlit',
        weather: 'fireflies',
        weatherIntensity: 0.6,
        windStrength: 0.7,
        characterAction: 'walk_right',
        events: {
          passingTrain: false,
          skyLanterns: true,
          shootingStars: false,
          birds: false,
          lightning: false,
        },
      };
      setSelectedSceneIndex(nextIdx);
      return { ...prev, scenes: [...prev.scenes, newScene] };
    });
  }, []);

  const handleDeleteScene = useCallback((index: number) => {
    setProject((prev) => {
      if (prev.scenes.length <= 1) return prev;
      const nextScenes = prev.scenes.filter((_, i) => i !== index);
      setSelectedSceneIndex((curr) => Math.min(curr, nextScenes.length - 1));
      return { ...prev, scenes: nextScenes };
    });
  }, []);

  const handleTriggerBurst = useCallback(() => {
    sceneRef.current.triggerLanternBurst();
    soundRef.current.playLanternChime();
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = soundRef.current.toggle();
    setSoundEnabled(next);
  }, []);

  const { totalDuration } = buildTimeline(project.scenes);

  return (
    <div className="min-h-screen bg-[#0B0D11] text-[#E6EAF2]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-[#1A1F28] bg-[#0B0D11]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-5 py-4 sm:px-8">
          <a
            href="#stage"
            className="font-display text-lg font-medium tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Lanterns Over Rainbridge
          </a>

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#script" className="transition-colors hover:text-white whitespace-nowrap shrink-0">
              Script
            </a>
            <a href="#stage" className="transition-colors hover:text-white whitespace-nowrap shrink-0">
              Stage
            </a>
            <a href="#storyboard" className="transition-colors hover:text-white whitespace-nowrap shrink-0">
              Storyboard
            </a>
            <a href="#engine" className="transition-colors hover:text-white whitespace-nowrap shrink-0">
              Engine API
            </a>
            <a href="#controls" className="transition-colors hover:text-white whitespace-nowrap shrink-0">
              Controls
            </a>
          </nav>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => stageRef.current?.startVideoExport()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          >
            {isExporting ? 'Rendering Video...' : 'Export Video'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 pt-6 pb-16 sm:px-8">
        {/* Compact Studio Header */}
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-white [text-wrap:balance] sm:text-3xl">
              Script-to-2D Animation Studio
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Write any story script in English or Bengali/Banglish to direct procedural 2D scenes and export downloadable video.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
            <span>{project.scenes.length} scenes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalDuration.toFixed(0)}s runtime</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{controls.cadence} fps</span>
          </div>
        </div>

        {/* 2-Column Studio Workspace: Script Compiler + Live Cinema Stage */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ScriptStudio
              scriptText={scriptText}
              onChangeScript={setScriptText}
              onCompileScript={handleCompileScript}
              isCompiling={isCompiling}
              compileError={compileError}
              project={project}
              onSelectPreset={handleSelectPreset}
              onUpdateCharacter={handleUpdateCharacter}
            />
          </div>

          <div className="lg:col-span-8">
            <AnimationStage
              stageRef={stageRef}
              sceneRef={sceneRef}
              soundRef={soundRef}
              project={project}
              controls={controls}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onSetPlaying={setIsPlaying}
              onSetPlaybackSpeed={(speed) => handleUpdateControls({ playbackSpeed: speed })}
              onToggleRig={() =>
                handleUpdateControls({ showRigOverlay: !controls.showRigOverlay })
              }
              onToggleSubtitles={() =>
                handleUpdateControls({ showSubtitles: !controls.showSubtitles })
              }
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              seekRequest={seekRequest}
              onMetricsUpdate={setMetrics}
              metrics={metrics}
              onExportStateChange={setIsExporting}
            />
          </div>
        </div>

        {/* Storyboard & Scene Editor */}
        <StoryboardPanel
          scenes={project.scenes}
          activeSceneIndex={metrics.sceneIndex}
          selectedSceneIndex={selectedSceneIndex}
          onSelectScene={handleSelectScene}
          onUpdateScene={handleUpdateScene}
          onUpdateSceneEvents={handleUpdateSceneEvents}
          onAddScene={handleAddScene}
          onDeleteScene={handleDeleteScene}
        />

        {/* Universal AI-Connectable 2D Animation Engine & Live Agent Bridge */}
        <AgentEnginePanel
          project={project}
          onApplyBlueprint={applyExternalBlueprint}
          bridgeConnected={bridgeConnected}
          lastAgentSync={lastAgentSync}
        />

        {/* Real-Time Overrides & Procedural Math Inspector */}
        <DirectorDeck
          controls={controls}
          metrics={metrics}
          onUpdateControls={handleUpdateControls}
          onResetControls={handleResetControls}
          onTriggerBurst={handleTriggerBurst}
        />
      </main>

      <footer className="border-t border-[#1A1F28] py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-3 px-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-8">
          <p>Lanterns Over Rainbridge · Procedural Script-to-2D Animation Studio</p>
          <p>Rendered live via Canvas 2D, 2-bone IK, Verlet physics, Web Audio, and MediaRecorder WebM export.</p>
        </div>
      </footer>
    </div>
  );
}
