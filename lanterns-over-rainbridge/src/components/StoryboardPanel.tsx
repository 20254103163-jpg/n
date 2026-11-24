import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  ACTION_LABELS,
  buildTimeline,
  CharacterActionType,
  SceneEvents,
  SceneSpec,
  SETTING_LABELS,
  SettingType,
  TIME_LABELS,
  TimeOfDayType,
  WEATHER_LABELS,
  WeatherType,
} from '../animation/types';

interface StoryboardPanelProps {
  scenes: SceneSpec[];
  activeSceneIndex: number;
  selectedSceneIndex: number;
  onSelectScene: (index: number, startSec: number) => void;
  onUpdateScene: (index: number, patch: Partial<SceneSpec>) => void;
  onUpdateSceneEvents: (index: number, patch: Partial<SceneEvents>) => void;
  onAddScene: () => void;
  onDeleteScene: (index: number) => void;
}

export const StoryboardPanel: React.FC<StoryboardPanelProps> = ({
  scenes,
  activeSceneIndex,
  selectedSceneIndex,
  onSelectScene,
  onUpdateScene,
  onUpdateSceneEvents,
  onAddScene,
  onDeleteScene,
}) => {
  const { segments, totalDuration } = buildTimeline(scenes);
  const safeSelected = Math.min(selectedSceneIndex, Math.max(scenes.length - 1, 0));
  const selectedScene = scenes[safeSelected];

  return (
    <section id="storyboard" className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight text-white">
            Storyboard &amp; Scene Editor
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {scenes.length} scenes · {totalDuration.toFixed(0)}s total runtime · Click any scene to jump and customize
          </p>
        </div>

        <button
          type="button"
          onClick={onAddScene}
          disabled={scenes.length >= 8}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#242B38] bg-[#141923] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Scene</span>
        </button>
      </div>

      {/* Horizontal Scene Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {segments.map((seg) => {
          const isPlayingNow = activeSceneIndex === seg.index;
          const isSelected = safeSelected === seg.index;
          return (
            <button
              key={seg.scene.id}
              type="button"
              onClick={() => onSelectScene(seg.index, seg.startSec)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-amber-500/60 bg-[#161C29]'
                  : isPlayingNow
                  ? 'border-slate-600 bg-[#131823]'
                  : 'border-[#1F242D] bg-[#10141C] hover:border-[#2E3646] hover:bg-[#141923]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className={isSelected || isPlayingNow ? 'font-medium text-amber-400' : ''}>
                  Scene {String(seg.index + 1).padStart(2, '0')}
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {seg.startSec.toFixed(0)}s – {seg.endSec.toFixed(0)}s
                </span>
              </div>

              <p className="mt-2 font-display text-base font-medium text-white truncate">
                {seg.scene.title}
              </p>

              <p className="mt-1.5 text-xs text-slate-400 truncate">
                {SETTING_LABELS[seg.scene.setting]} · {TIME_LABELS[seg.scene.timeOfDay]}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                {WEATHER_LABELS[seg.scene.weather]} · {ACTION_LABELS[seg.scene.characterAction]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Scene Property Inspector */}
      {selectedScene && (
        <div className="rounded-xl border border-[#1F242D] bg-[#10141C] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F242D] pb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-amber-400">
                Editing Scene {String(safeSelected + 1).padStart(2, '0')}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-sm font-medium text-white">{selectedScene.title}</span>
            </div>

            {scenes.length > 1 && (
              <button
                type="button"
                onClick={() => onDeleteScene(safeSelected)}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 transition-colors hover:text-rose-300 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Scene</span>
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Scene Title</label>
              <input
                type="text"
                value={selectedScene.title}
                onChange={(e) => onUpdateScene(safeSelected, { title: e.target.value })}
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white focus:border-amber-500/70 focus:outline-none"
              />
            </div>

            {/* Environment */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Environment</label>
              <select
                value={selectedScene.setting}
                onChange={(e) =>
                  onUpdateScene(safeSelected, { setting: e.target.value as SettingType })
                }
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white focus:border-amber-500/70 focus:outline-none"
              >
                {(Object.keys(SETTING_LABELS) as SettingType[]).map((key) => (
                  <option key={key} value={key}>
                    {SETTING_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Lighting */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Time &amp; Lighting</label>
              <select
                value={selectedScene.timeOfDay}
                onChange={(e) =>
                  onUpdateScene(safeSelected, { timeOfDay: e.target.value as TimeOfDayType })
                }
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white focus:border-amber-500/70 focus:outline-none"
              >
                {(Object.keys(TIME_LABELS) as TimeOfDayType[]).map((key) => (
                  <option key={key} value={key}>
                    {TIME_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Character Action */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Character Action</label>
              <select
                value={selectedScene.characterAction}
                onChange={(e) =>
                  onUpdateScene(safeSelected, {
                    characterAction: e.target.value as CharacterActionType,
                  })
                }
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white focus:border-amber-500/70 focus:outline-none"
              >
                {(Object.keys(ACTION_LABELS) as CharacterActionType[]).map((key) => (
                  <option key={key} value={key}>
                    {ACTION_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtitle / Narration */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs text-slate-400">Subtitle Caption</label>
              <input
                type="text"
                value={selectedScene.narration}
                onChange={(e) => onUpdateScene(safeSelected, { narration: e.target.value })}
                placeholder="Shown on screen and burned into exported video"
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500/70 focus:outline-none"
              />
            </div>

            {/* Weather */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Weather</label>
              <select
                value={selectedScene.weather}
                onChange={(e) =>
                  onUpdateScene(safeSelected, { weather: e.target.value as WeatherType })
                }
                className="w-full rounded-lg border border-[#242B38] bg-[#0B0E14] px-3 py-2 text-xs text-white focus:border-amber-500/70 focus:outline-none"
              >
                {(Object.keys(WEATHER_LABELS) as WeatherType[]).map((key) => (
                  <option key={key} value={key}>
                    {WEATHER_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Scene Duration</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {selectedScene.durationSec}s
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={12}
                step={1}
                value={selectedScene.durationSec}
                onChange={(e) =>
                  onUpdateScene(safeSelected, { durationSec: parseInt(e.target.value, 10) })
                }
                className="studio-slider mt-2 w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Scene Special Event Toggles */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1F242D] pt-4">
            <span className="mr-2 text-xs text-slate-400">Scene Events:</span>
            {(
              [
                ['passingTrain', 'Passing Train / Ferry'],
                ['skyLanterns', 'Sky Lanterns'],
                ['shootingStars', 'Shooting Stars'],
                ['birds', 'Gliding Birds'],
                ['lightning', 'Storm Lightning'],
              ] as [keyof SceneEvents, string][]
            ).map(([key, label]) => {
              const active = selectedScene.events[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdateSceneEvents(safeSelected, { [key]: !active })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-[#242B38] bg-[#141923] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
