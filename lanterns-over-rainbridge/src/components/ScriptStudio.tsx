import React from 'react';
import { Clapperboard, Loader2, AlertCircle } from 'lucide-react';
import { PRESET_PROJECTS } from '../animation/presets';
import {
  AnimationProject,
  CharacterConfig,
  PROP_LABELS,
  PropType,
} from '../animation/types';

interface ScriptStudioProps {
  scriptText: string;
  onChangeScript: (val: string) => void;
  onCompileScript: () => void;
  isCompiling: boolean;
  compileError: string | null;
  project: AnimationProject;
  onSelectPreset: (preset: AnimationProject) => void;
  onUpdateCharacter: (patch: Partial<CharacterConfig>) => void;
}

const COAT_SWATCHES = ['#2a3c59', '#3f523a', '#373052', '#5c342e', '#1f2937'];
const SCARF_SWATCHES = ['#dc2626', '#d97706', '#e11d48', '#0284c7', '#10b981'];

export const ScriptStudio: React.FC<ScriptStudioProps> = ({
  scriptText,
  onChangeScript,
  onCompileScript,
  isCompiling,
  compileError,
  project,
  onSelectPreset,
  onUpdateCharacter,
}) => {
  return (
    <aside
      id="script"
      className="flex h-full flex-col justify-between rounded-xl border border-[#1F242D] bg-[#10141C] p-5"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium tracking-tight text-white">
            Story Script
          </h2>
          <span className="text-xs text-slate-400">100% Pure Code · বাংলা / EN</span>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Write your scenes in Bengali, Banglish, or English. The built-in TypeScript compiler parses every scene instantaneously in your browser—no external AI API needed.
        </p>

        {/* Preset Quick-Loaders */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {PRESET_PROJECTS.map((preset) => {
            const active = project.title === preset.title;
            const isBangla = /[\u0980-\u09FF]/.test(preset.title);
            const shortLabel = isBangla
              ? preset.title.includes('পোস্টবক্স')
                ? 'পোস্টবক্স ৪২'
                : 'বৃষ্টি ও ফানুস'
              : preset.title.split(' ').slice(0, 2).join(' ');
            return (
              <button
                key={preset.title}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-amber-500/50 bg-amber-500/12 font-medium text-amber-300'
                    : 'border-[#242B38] bg-[#151A25] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>

        {/* Script Input */}
        <div className="mt-3.5">
          <label htmlFor="story-script-input" className="sr-only">
            Story Script
          </label>
          <textarea
            id="story-script-input"
            value={scriptText}
            onChange={(e) => onChangeScript(e.target.value)}
            rows={7}
            placeholder="বাংলা, Banglish বা English-এ আপনার গল্পের স্ক্রিপ্ট লিখুন... (যেমন: সন্ধ্যাবেলা বৃষ্টির মধ্যে একজন পথিক ব্রিজ পার হচ্ছে, পাশে ট্রেন চলে যায়, তারপর সে আকাশে ফানুস উড়ায়)"
            className="w-full resize-none rounded-lg border border-[#242B38] bg-[#0B0E14] p-3.5 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:border-amber-500/70 focus:outline-none"
          />
        </div>

        {compileError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>{compileError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onCompileScript}
          disabled={isCompiling || scriptText.trim().length < 6}
          className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap"
        >
          {isCompiling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Directing 2D Scenes...</span>
            </>
          ) : (
            <>
              <Clapperboard className="h-4 w-4" />
              <span>Generate Animation</span>
            </>
          )}
        </button>
      </div>

      {/* Protagonist Wardrobe & Prop Quick Controls */}
      <div className="mt-5 border-t border-[#1F242D] pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-200">Protagonist Style</span>
          <span className="text-slate-400">{project.character.name}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-[11px] text-slate-400">Coat</p>
            <div className="flex items-center gap-1.5">
              {COAT_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onUpdateCharacter({ coatColor: hex })}
                  aria-label={`Set coat color ${hex}`}
                  className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                    project.character.coatColor.toLowerCase() === hex
                      ? 'border-white ring-2 ring-amber-400/70'
                      : 'border-white/20'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] text-slate-400">Scarf</p>
            <div className="flex items-center gap-1.5">
              {SCARF_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onUpdateCharacter({ scarfColor: hex })}
                  aria-label={`Set scarf color ${hex}`}
                  className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                    project.character.scarfColor.toLowerCase() === hex
                      ? 'border-white ring-2 ring-amber-400/70'
                      : 'border-white/20'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[11px] text-slate-400">Held Prop</p>
          <div className="grid grid-cols-4 gap-1 rounded-lg border border-[#242B38] bg-[#0B0E14] p-0.5">
            {(['lantern', 'umbrella', 'staff', 'none'] as PropType[]).map((prop) => (
              <button
                key={prop}
                type="button"
                onClick={() => onUpdateCharacter({ prop })}
                className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors truncate ${
                  project.character.prop === prop
                    ? 'bg-[#222836] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={PROP_LABELS[prop]}
              >
                {prop === 'lantern'
                  ? 'Lantern'
                  : prop === 'umbrella'
                  ? 'Umbrella'
                  : prop === 'staff'
                  ? 'Staff'
                  : 'None'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
