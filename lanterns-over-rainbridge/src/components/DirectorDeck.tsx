import React, { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import {
  CadenceMode,
  DirectorControls,
  FrameMetrics,
} from '../animation/types';

interface DirectorDeckProps {
  controls: DirectorControls;
  metrics: FrameMetrics;
  onUpdateControls: (patch: Partial<DirectorControls>) => void;
  onResetControls: () => void;
  onTriggerBurst: () => void;
}

type CodeTabId = 'ik' | 'verlet' | 'water' | 'export';

const CODE_TABS: { id: CodeTabId; label: string; summary: string; snippet: string }[] = [
  {
    id: 'ik',
    label: '2-Bone IK',
    summary:
      'Analytical Law of Cosines solves hip-to-foot knee joints every frame against each environment’s mathematical ground curve.',
    snippet: `const dist = clamp(Math.hypot(dx, dy), minDist, maxDist);
const baseAngle = Math.atan2(dy, dx);
const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
const upperAngle = baseAngle + bendSign * Math.acos(clamp(cosA, -1, 1));

const knee = {
  x: hip.x + Math.cos(upperAngle) * l1,
  y: hip.y + Math.sin(upperAngle) * l1,
};`,
  },
  {
    id: 'verlet',
    label: 'Verlet Scarf',
    summary:
      'A 14-node Verlet ribbon integrates velocity implicitly with traveling flutter harmonics and 6 distance-relaxation passes per frame.',
    snippet: `const vx = (node.x - node.oldX) * 0.94;
const vy = (node.y - node.oldY) * 0.94;
const flutter = Math.sin(t * 11.5 - i * 0.65) * (95 + Math.abs(windX) * 0.45);
node.x += vx + (windX * (0.75 + tail * 0.65)) * dt * dt;
node.y += vy + (gravity + flutter) * dt * dt;

// 6x iterative distance constraint solver
const diff = (dist - segmentLength) / dist;
b.x -= dx * diff * 0.52;  b.y -= dy * diff * 0.52;`,
  },
  {
    id: 'water',
    label: 'Water Reflections',
    summary:
      'Dynamic reflection columns mirror the moon, passing commuter trains or ferries, and rising sky lanterns across oscillating wave slices.',
    snippet: `for (let i = 0; i < 12; i++) {
  const k = i / 12;
  const y = horizonY + Math.pow(k, 1.35) * length;
  const wobble = Math.sin(t * 3.8 + i * 1.35) * width * (0.25 + k * 0.45);
  ctx.fillStyle = \`rgba(251, 185, 76, \${alpha * (1 - k * 0.85)})\`;
  ctx.fillRect(cx + wobble - sliceW * 0.5, y, sliceW, 1.6 + k * 1.4);
}`,
  },
  {
    id: 'export',
    label: 'Video Export',
    summary:
      'Real-time canvas frames and synthesized Web Audio are muxed directly in-browser via captureStream() and MediaRecorder into .webm video.',
    snippet: `const videoStream = canvas.captureStream(30);
const audioStream = soundscape.getAudioStream();
const combined = new MediaStream([
  ...videoStream.getVideoTracks(),
  ...(audioStream ? audioStream.getAudioTracks() : []),
]);
const recorder = new MediaRecorder(combined, {
  mimeType: 'video/webm;codecs=vp9,opus',
  videoBitsPerSecond: 6_000_000,
});`,
  },
];

function skyPhaseLabelFromValue(val: number): string {
  if (val < 0.17) return 'Warm Afternoon';
  if (val < 0.34) return 'Golden Dusk';
  if (val < 0.52) return 'Storm Twilight';
  if (val < 0.7) return 'Starry Night';
  if (val < 0.86) return 'Moonlit Bay';
  return 'Pre-Dawn';
}

export const DirectorDeck: React.FC<DirectorDeckProps> = ({
  controls,
  metrics,
  onUpdateControls,
  onResetControls,
  onTriggerBurst,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<CodeTabId>('ik');
  const currentTab = CODE_TABS.find((t) => t.id === activeCodeTab) ?? CODE_TABS[0];

  const isCustomTime = controls.timeOfDayOverride !== null;
  const isCustomWeather = controls.weatherIntensityOverride !== null;

  return (
    <div className="mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
      {/* Left Column: Real-Time Director Overrides */}
      <section
        id="controls"
        className="flex flex-col justify-between rounded-xl border border-[#1F242D] bg-[#10141C] p-6 lg:col-span-5"
      >
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-medium tracking-tight text-white">
              Live Physics &amp; Lighting Overrides
            </h2>
            <button
              type="button"
              onClick={onResetControls}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            Override sky lighting, wind force, weather density, and animation frame cadence live while previewing or exporting.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-200">Sky &amp; Lighting</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-slate-400">
                    {isCustomTime
                      ? skyPhaseLabelFromValue(controls.timeOfDayOverride ?? 0)
                      : `Script · ${metrics.skyPhaseLabel}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateControls({
                        timeOfDayOverride: isCustomTime ? null : 0.25,
                      })
                    }
                    className="text-amber-400 hover:text-amber-300 whitespace-nowrap"
                  >
                    {isCustomTime ? 'Follow Script' : 'Override'}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={isCustomTime ? controls.timeOfDayOverride ?? 0 : 0.25}
                onChange={(e) =>
                  onUpdateControls({ timeOfDayOverride: parseFloat(e.target.value) })
                }
                aria-label="Sky lighting override"
                className="studio-slider w-full cursor-pointer"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-200">Wind Multiplier</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {metrics.windSpeedMs.toFixed(1)} m/s ({controls.windMultiplier.toFixed(1)}×)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.1}
                value={controls.windMultiplier}
                onChange={(e) =>
                  onUpdateControls({ windMultiplier: parseFloat(e.target.value) })
                }
                aria-label="Wind velocity multiplier"
                className="studio-slider w-full cursor-pointer"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-200">Weather Density</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-slate-400">
                    {isCustomWeather
                      ? `${Math.round((controls.weatherIntensityOverride ?? 0) * 100)}%`
                      : `Script · ${metrics.weatherDensityPct}%`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateControls({
                        weatherIntensityOverride: isCustomWeather
                          ? null
                          : metrics.weatherDensityPct / 100,
                      })
                    }
                    className="text-amber-400 hover:text-amber-300 whitespace-nowrap"
                  >
                    {isCustomWeather ? 'Follow Script' : 'Override'}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={
                  isCustomWeather
                    ? controls.weatherIntensityOverride ?? 0
                    : metrics.weatherDensityPct / 100
                }
                onChange={(e) =>
                  onUpdateControls({ weatherIntensityOverride: parseFloat(e.target.value) })
                }
                aria-label="Weather intensity override"
                className="studio-slider w-full cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#1F242D] pt-4">
              <div>
                <p className="text-xs font-medium text-slate-200">Frame Cadence</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Smooth 60 fps or classic hand-drawn 24 fps
                </p>
              </div>
              <div className="flex items-center rounded-lg border border-[#242B38] bg-[#0B0E14] p-0.5">
                {([60, 24] as CadenceMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateControls({ cadence: mode })}
                    className={`rounded-md px-3 py-1.5 font-mono text-xs tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      controls.cadence === mode
                        ? 'bg-[#222836] font-medium text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode} fps
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-[#1F242D] pt-5">
          <button
            type="button"
            onClick={onTriggerBurst}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Release Lantern Cluster</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateControls({ showRigOverlay: !controls.showRigOverlay })}
            className="inline-flex items-center justify-center rounded-lg border border-[#242B38] bg-[#161B26] px-4 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0"
          >
            {controls.showRigOverlay ? 'Hide Rig' : 'Inspect Rig'}
          </button>
        </div>
      </section>

      {/* Right Column: Live Procedural Source Math */}
      <section
        id="source-math"
        className="flex flex-col justify-between rounded-xl border border-[#1F242D] bg-[#10141C] p-6 lg:col-span-7"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-medium tracking-tight text-white">
              Procedural Engine Inspector
            </h2>

            <div className="flex items-center rounded-lg border border-[#242B38] bg-[#0B0E14] p-0.5">
              {CODE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCodeTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === tab.id
                      ? 'bg-[#222836] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
            {currentTab.summary}
          </p>

          <pre className="mt-4 overflow-x-auto rounded-lg border border-[#1E2430] bg-[#090C11] p-4 font-mono text-xs leading-relaxed text-slate-300">
            <code>{currentTab.snippet}</code>
          </pre>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#1F242D] pt-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Lead Knee Angle</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {metrics.leadKneeAngleDeg.toFixed(1)}°
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hip Vertical Bob</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {metrics.hipYOffset >= 0 ? '+' : ''}
              {metrics.hipYOffset.toFixed(2)} px
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Lantern Swing</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {metrics.lanternSwingDeg >= 0 ? '+' : ''}
              {metrics.lanternSwingDeg.toFixed(1)}°
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Scarf Ribbon Strain</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {(metrics.scarfTension * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Active Sky Lanterns</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {metrics.activeLanterns}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Water &amp; Deck Ripples</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-slate-100">
              {metrics.activeRipples}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
