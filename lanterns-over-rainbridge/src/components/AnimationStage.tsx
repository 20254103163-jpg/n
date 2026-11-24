import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Bone,
  Download,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ProceduralSoundscape } from '../animation/audio';
import { AnimationScene } from '../animation/scene';
import {
  AnimationProject,
  buildTimeline,
  DirectorControls,
  FrameMetrics,
} from '../animation/types';

export interface AnimationStageHandle {
  startVideoExport: () => void;
  captureFrame: () => string | null;
}

interface AnimationStageProps {
  stageRef?: React.Ref<AnimationStageHandle>;
  sceneRef: React.MutableRefObject<AnimationScene>;
  soundRef: React.MutableRefObject<ProceduralSoundscape>;
  project: AnimationProject;
  controls: DirectorControls;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSetPlaying: (playing: boolean) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  onToggleRig: () => void;
  onToggleSubtitles: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  seekRequest: { timeSec: number; nonce: number } | null;
  onMetricsUpdate: (metrics: FrameMetrics) => void;
  metrics: FrameMetrics;
  onExportStateChange?: (exporting: boolean) => void;
}

function formatTimecode(sec: number, total: number): string {
  const clamped = ((sec % total) + total) % total;
  const whole = Math.floor(clamped);
  const tenths = Math.floor((clamped - whole) * 10);
  const m = Math.floor(whole / 60).toString().padStart(2, '0');
  const s = (whole % 60).toString().padStart(2, '0');
  return `${m}:${s}.${tenths}`;
}

export const AnimationStage: React.FC<AnimationStageProps> = ({
  stageRef,
  sceneRef,
  soundRef,
  project,
  controls,
  isPlaying,
  onTogglePlay,
  onSetPlaying,
  onSetPlaybackSpeed,
  onToggleRig,
  onToggleSubtitles,
  soundEnabled,
  onToggleSound,
  seekRequest,
  onMetricsUpdate,
  metrics,
  onExportStateChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef<number>(0);
  const projectRef = useRef<AnimationProject>(project);
  const controlsRef = useRef<DirectorControls>(controls);
  const playingRef = useRef<boolean>(isPlaying);
  const lastUiSyncRef = useRef<number>(0);
  const lastRenderStepRef = useRef<number>(0);

  // Video export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const exportActiveRef = useRef(false);
  const exportDurationRef = useRef(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const pointerDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  projectRef.current = project;
  controlsRef.current = controls;
  playingRef.current = isPlaying;

  const { segments, totalDuration } = buildTimeline(project.scenes);

  const stopExport = (download: boolean) => {
    exportActiveRef.current = false;
    setIsExporting(false);
    setExportProgress(0);
    onExportStateChange?.(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      if (!download) {
        rec.onstop = null;
      }
      rec.stop();
    }
    recorderRef.current = null;
  };

  const startVideoExport = () => {
    const canvas = canvasRef.current;
    if (!canvas || exportActiveRef.current) return;
    setExportError(null);

    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setExportError('Video export is not supported in this browser.');
      return;
    }

    try {
      const { totalDuration: fullDuration } = buildTimeline(projectRef.current.scenes);
      const videoStream = canvas.captureStream(30);
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      const audioStream = soundRef.current.getAudioStream();
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      const chosenMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(
        combinedStream,
        chosenMime ? { mimeType: chosenMime, videoBitsPerSecond: 6_000_000 } : undefined
      );

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: chosenMime || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const safeName = projectRef.current.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName || 'procedural-2d-film'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      };

      // Rewind to start & force normal 1x playback during capture
      timeRef.current = 0;
      exportDurationRef.current = fullDuration;
      exportActiveRef.current = true;
      recorderRef.current = recorder;
      setIsExporting(true);
      setExportProgress(0);
      onExportStateChange?.(true);
      onSetPlaying(true);

      recorder.start(250);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start video recording.';
      setExportError(msg);
      stopExport(false);
    }
  };

  useImperativeHandle(stageRef, () => ({
    startVideoExport,
    captureFrame: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    if (!seekRequest) return;
    const { totalDuration: dur } = buildTimeline(projectRef.current.scenes);
    timeRef.current = ((seekRequest.timeSec % dur) + dur) % dur;
  }, [seekRequest]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTimestamp = performance.now();
    let canvasWidth = 1280;
    let canvasHeight = 720;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasWidth = rect.width;
      canvasHeight = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);

    const tick = (now: number) => {
      const rawDt = Math.min((now - lastTimestamp) / 1000, 0.05);
      lastTimestamp = now;

      const currentControls = controlsRef.current;
      const currentProject = projectRef.current;
      const { totalDuration: dur } = buildTimeline(currentProject.scenes);
      const targetIntervalMs = currentControls.cadence === 24 && !exportActiveRef.current ? 1000 / 24 : 0;

      if (playingRef.current || exportActiveRef.current) {
        const speed = exportActiveRef.current ? 1 : currentControls.playbackSpeed;
        timeRef.current += rawDt * speed;

        if (exportActiveRef.current) {
          const pct = Math.min(100, Math.round((timeRef.current / exportDurationRef.current) * 100));
          setExportProgress(pct);
          if (timeRef.current >= exportDurationRef.current) {
            stopExport(true);
            timeRef.current = 0;
          }
        } else {
          timeRef.current = timeRef.current % dur;
        }
      }

      const shouldPaint =
        targetIntervalMs === 0 || now - lastRenderStepRef.current >= targetIntervalMs - 1;

      if (shouldPaint) {
        const stepDt =
          targetIntervalMs === 0
            ? rawDt
            : Math.min((now - lastRenderStepRef.current) / 1000, 0.05) || 1 / 24;
        lastRenderStepRef.current = now;

        const simDt =
          playingRef.current || exportActiveRef.current
            ? stepDt * (exportActiveRef.current ? 1 : currentControls.playbackSpeed)
            : 0.008;

        const nextMetrics = sceneRef.current.renderFrame(
          ctx,
          canvasWidth,
          canvasHeight,
          timeRef.current,
          simDt,
          currentProject,
          currentControls,
          () => {
            soundRef.current.playLanternChime();
          }
        );

        soundRef.current.update(
          nextMetrics.weatherDensityPct / 100,
          Math.min(nextMetrics.windSpeedMs / 10, 1),
          nextMetrics.timeSec
        );

        if (now - lastUiSyncRef.current > 65) {
          lastUiSyncRef.current = now;
          onMetricsUpdate(nextMetrics);
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      if (exportActiveRef.current) stopExport(false);
    };
  }, [sceneRef, soundRef, onMetricsUpdate]);

  const handleStepFrame = (direction: 1 | -1) => {
    const step = 1 / controls.cadence;
    timeRef.current = (timeRef.current + direction * step + totalDuration) % totalDuration;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      const next = sceneRef.current.renderFrame(
        ctx,
        rect.width,
        rect.height,
        timeRef.current,
        step,
        project,
        controls
      );
      onMetricsUpdate(next);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    timeRef.current = t;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      const next = sceneRef.current.renderFrame(
        ctx,
        rect.width,
        rect.height,
        t,
        0.016,
        project,
        controls
      );
      onMetricsUpdate(next);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerDownRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const dx = nx - pointerDownRef.current.x;
    if (Math.abs(dx) > 0.012) {
      pointerDownRef.current.moved = true;
      sceneRef.current.applyPointerWind(nx, dx * 28);
      pointerDownRef.current.x = nx;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!start || start.moved) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    sceneRef.current.releaseUserLantern(nx, ny);
    soundRef.current.playLanternChime();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <section id="stage" className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#1F242D] bg-[#0F131A]"
      >
        {/* Widescreen 16:9 Procedural Canvas */}
        <div className="relative aspect-[16/9] w-full bg-[#07090E] select-none">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              pointerDownRef.current = null;
            }}
            className="block h-full w-full cursor-crosshair touch-none"
            aria-label={`${project.title} procedural 2D animation canvas`}
          />

          {/* Optional Interactive Hint */}
          <div className="pointer-events-none absolute right-4 top-3 hidden text-xs text-slate-300/60 sm:block">
            Drag for wind
          </div>

          {/* Live WebM Export Progress Overlay */}
          {isExporting && (
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-[#0B0D11]/90 px-4 py-2.5 backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-amber-300">
                    Rendering WebM Video ({metrics.sceneTitle})
                  </span>
                  <span className="font-mono tabular-nums text-white">{exportProgress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-[width] duration-150"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => stopExport(false)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        {/* Cinema Timeline Scrubber & Transport Bar */}
        <div className="flex flex-1 flex-col justify-between border-t border-[#1F242D] bg-[#11151E] px-4 py-3.5 sm:px-5">
          {exportError && (
            <p className="mb-2 text-xs text-rose-300">{exportError}</p>
          )}

          {/* Dynamic Multi-Scene Timeline Track */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={Math.max(totalDuration - 0.05, 0.1)}
              step={0.05}
              value={Math.min(metrics.timeSec, totalDuration)}
              onChange={handleScrub}
              disabled={isExporting}
              aria-label="Animation timeline scrubber"
              className="studio-slider w-full cursor-pointer disabled:opacity-50"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              {segments.map((seg) => (
                <button
                  key={seg.scene.id}
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    timeRef.current = seg.startSec;
                  }}
                  className={`truncate transition-colors hover:text-amber-300 ${
                    metrics.sceneIndex === seg.index
                      ? 'font-medium text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {seg.index + 1}. {seg.scene.title}
                </button>
              ))}
            </div>
          </div>

          {/* Transport Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={onTogglePlay}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleStepFrame(-1)}
                aria-label="Step backward 1 frame"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#242B38] bg-[#161B26] text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-40"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleStepFrame(1)}
                aria-label="Step forward 1 frame"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#242B38] bg-[#161B26] text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-40"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              <div className="ml-1 hidden items-center gap-1.5 font-mono text-xs tabular-nums text-slate-300 xl:flex">
                <span>{formatTimecode(metrics.timeSec, totalDuration)}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-500">{formatTimecode(totalDuration - 0.01, totalDuration)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-[#242B38] bg-[#0D1017] p-0.5">
                {[0.5, 1, 1.5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    disabled={isExporting}
                    onClick={() => onSetPlaybackSpeed(speed)}
                    className={`rounded-md px-2 py-1.5 font-mono text-xs tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      controls.playbackSpeed === speed
                        ? 'bg-[#222836] font-medium text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {speed}×
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onToggleSubtitles}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  controls.showSubtitles
                    ? 'border-amber-500/50 bg-amber-500/12 text-amber-300'
                    : 'border-[#242B38] bg-[#161B26] text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Subtitles className="h-3.5 w-3.5" />
                <span>Captions</span>
              </button>

              <button
                type="button"
                onClick={onToggleRig}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  controls.showRigOverlay
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                    : 'border-[#242B38] bg-[#161B26] text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Bone className="h-3.5 w-3.5" />
                <span>Rig</span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  soundEnabled
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-[#242B38] bg-[#161B26] text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                <span>{soundEnabled ? 'Audio On' : 'Audio Off'}</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={startVideoExport}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#242B38] bg-[#161B26] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export .webm</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#242B38] bg-[#161B26] text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
