import { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Film,
  Loader2,
  Moon,
  PenLine,
  Play,
  RefreshCw,
  Save,
  Square,
  Sun,
  Volume2,
  Wand2,
} from 'lucide-react';
import {
  DIALECT_OPTIONS,
  DURATION_OPTIONS,
  NARRATOR_POV_OPTIONS,
} from '../data/presets';
import type {
  DialectId,
  DurationId,
  MusicDensity,
  NarratorPovId,
  StoryDnaProfile,
  StoryProject,
} from '../types/story';
import {
  buildExportText,
  countWords,
  downloadTextFile,
  estimateMinutesFromWords,
  generateBlueprintApi,
  generatePackagingApi,
  streamRewriteActApi,
  streamWriteActApi,
} from '../utils/api';
import { AudioAuditionBar } from './AudioAuditionBar';

interface StoryEngineProps {
  project: StoryProject | null;
  isBuildingBlueprint: boolean;
  blueprintError: string | null;
  onUpdateProject: (updater: (prev: StoryProject) => StoryProject) => void;
  onCreateCustomProject: (project: StoryProject) => void;
  onSaveProject: (project: StoryProject) => void;
  activeDna: StoryDnaProfile | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

type StudioSubView = 'manuscript' | 'edit' | 'packaging';

function renderFormattedScript(text: string) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  return paragraphs.map((para, pIdx) => {
    const tokens = para.split(/(\[মিউজিক\]|\[নীরবতা[^\]]*\])/g);
    return (
      <p
        key={pIdx}
        className="font-manuscript text-[17px] sm:text-[18px] text-zinc-900 dark:text-zinc-100 mb-5 last:mb-0"
      >
        {tokens.map((token, tIdx) => {
          if (token.startsWith('[মিউজিক') || token.startsWith('[নীরবতা')) {
            return (
              <span
                key={tIdx}
                className="font-sans text-xs font-medium text-rose-700 dark:text-rose-400 mx-1.5 tracking-normal align-middle"
              >
                {token}
              </span>
            );
          }
          return <span key={tIdx}>{token}</span>;
        })}
      </p>
    );
  });
}

export function StoryEngine({
  project,
  isBuildingBlueprint,
  blueprintError,
  onUpdateProject,
  onCreateCustomProject,
  onSaveProject,
  activeDna,
  theme,
  onToggleTheme,
}: StoryEngineProps) {
  // Custom quick-start form state when no project is open
  const [customTitle, setCustomTitle] = useState('');
  const [customPremise, setCustomPremise] = useState('');
  const [customAnchor, setCustomAnchor] = useState('');
  const [customDialect, setCustomDialect] = useState<DialectId>('grameen_kottho');
  const [customDuration, setCustomDuration] = useState<DurationId>('long_18');
  const [customPovId, setCustomPovId] = useState<NarratorPovId>('boro_bhai');
  const [customPovText, setCustomPovText] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customErr, setCustomErr] = useState<string | null>(null);

  // Studio UI states
  const [selectedActNum, setSelectedActNum] = useState<number>(1);
  const [viewMode, setViewMode] = useState<StudioSubView>('manuscript');
  const [showFullStory, setShowFullStory] = useState<boolean>(false);
  const [isWritingAll, setIsWritingAll] = useState(false);
  const [customRewriteText, setCustomRewriteText] = useState('');
  const [isGeneratingPackaging, setIsGeneratingPackaging] = useState(false);
  const [packagingError, setPackagingError] = useState<string | null>(null);
  const [includeCuesExport, setIncludeCuesExport] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [isPushingAnim, setIsPushingAnim] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [auditionTarget, setAuditionTarget] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const latestProjectRef = useRef<StoryProject | null>(project);
  latestProjectRef.current = project;

  const triggerCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleBuildCustomBlueprint = async () => {
    if (!customPremise.trim() && !customTitle.trim()) {
      setCustomErr('অন্তত গল্পের শিরোনাম বা মূল ঘটনাটি সংক্ষেপে লিখুন।');
      return;
    }
    setIsCreatingCustom(true);
    setCustomErr(null);
    try {
      const povLabel =
        customPovId === 'custom' && customPovText.trim()
          ? customPovText.trim()
          : NARRATOR_POV_OPTIONS.find((p) => p.id === customPovId)?.label ?? 'বড় ভাই';

      const bp = await generateBlueprintApi({
        title: customTitle.trim() || customPremise.trim().slice(0, 60),
        premise: customPremise.trim() || customTitle.trim(),
        anchorObject: customAnchor.trim() || undefined,
        narratorPov: povLabel,
        dialect: customDialect,
        duration: customDuration,
        dnaInstruction: activeDna?.reusableSystemPrompt,
      });

      const now = new Date().toISOString();
      const newProject: StoryProject = {
        id: `story_${Date.now()}`,
        title: bp.refinedTitle || customTitle.trim(),
        dialect: customDialect,
        duration: customDuration,
        narratorPov: povLabel,
        musicDensity: 'balanced',
        anchorObject: bp.anchorObject,
        anchorArc: bp.anchorArc,
        closingMoralLine: bp.closingMoralLine,
        premise: customPremise.trim() || customTitle.trim(),
        characters: bp.characters,
        acts: bp.acts.map((a) => ({
          ...a,
          script: '',
          status: 'idle',
        })),
        dnaInspiration: activeDna?.sourceTitle,
        createdAt: now,
        updatedAt: now,
      };
      onCreateCustomProject(newProject);
      setSelectedActNum(1);
    } catch (err) {
      setCustomErr(
        err instanceof Error ? err.message : 'নীলনকশা তৈরি করা যায়নি।'
      );
    } finally {
      setIsCreatingCustom(false);
    }
  };

  const writeSingleAct = async (
    actNumber: number,
    snapshotProject?: StoryProject
  ): Promise<StoryProject | null> => {
    const baseProject = snapshotProject ?? latestProjectRef.current;
    if (!baseProject) return null;

    setSelectedActNum(actNumber);
    setViewMode('manuscript');

    onUpdateProject((prev) => ({
      ...prev,
      acts: prev.acts.map((a) =>
        a.actNumber === actNumber
          ? { ...a, status: 'writing', errorMessage: undefined, script: '' }
          : a
      ),
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const finalText = await streamWriteActApi(
        baseProject,
        actNumber,
        (acc) => {
          onUpdateProject((prev) => ({
            ...prev,
            acts: prev.acts.map((a) =>
              a.actNumber === actNumber ? { ...a, script: acc } : a
            ),
          }));
        },
        controller.signal
      );

      let updatedSnapshot: StoryProject | null = null;
      onUpdateProject((prev) => {
        updatedSnapshot = {
          ...prev,
          updatedAt: new Date().toISOString(),
          acts: prev.acts.map((a) =>
            a.actNumber === actNumber
              ? { ...a, script: finalText, status: 'done', errorMessage: undefined }
              : a
          ),
        };
        return updatedSnapshot;
      });
      return updatedSnapshot ?? {
        ...baseProject,
        acts: baseProject.acts.map((a) =>
          a.actNumber === actNumber ? { ...a, script: finalText, status: 'done' } : a
        ),
      };
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const msg = isAbort
        ? 'লেখা থামানো হয়েছে।'
        : err instanceof Error
          ? err.message
          : 'অধ্যায়টি লিখতে সমস্যা হয়েছে।';

      onUpdateProject((prev) => ({
        ...prev,
        acts: prev.acts.map((a) =>
          a.actNumber === actNumber
            ? {
                ...a,
                status: isAbort && a.script.trim() ? 'done' : 'error',
                errorMessage: isAbort ? undefined : msg,
              }
            : a
        ),
      }));
      return null;
    } finally {
      abortRef.current = null;
    }
  };

  const handleWriteAllActs = async () => {
    if (!project || isWritingAll) return;
    setIsWritingAll(true);
    setShowFullStory(true);
    let currentProj: StoryProject | null = project;

    for (const act of project.acts) {
      if (!currentProj) break;
      const latestAct = currentProj.acts.find((a) => a.actNumber === act.actNumber);
      if (latestAct && latestAct.status === 'done' && latestAct.script.trim().length > 40) {
        continue;
      }
      const nextProj = await writeSingleAct(act.actNumber, currentProj);
      if (!nextProj) break;
      currentProj = nextProj;
    }

    setIsWritingAll(false);
    if (currentProj) {
      onSaveProject(currentProj);
    }
  };

  const handleStopWriting = () => {
    abortRef.current?.abort();
    setIsWritingAll(false);
  };

  const handleRewriteAct = async (actNumber: number, instruction: string) => {
    if (!project || !instruction.trim()) return;
    const act = project.acts.find((a) => a.actNumber === actNumber);
    if (!act || !act.script.trim()) return;

    const controller = new AbortController();
    abortRef.current = controller;

    onUpdateProject((prev) => ({
      ...prev,
      acts: prev.acts.map((a) =>
        a.actNumber === actNumber
          ? { ...a, status: 'writing', errorMessage: undefined }
          : a
      ),
    }));

    try {
      const finalText = await streamRewriteActApi(
        project,
        act,
        instruction,
        (acc) => {
          onUpdateProject((prev) => ({
            ...prev,
            acts: prev.acts.map((a) =>
              a.actNumber === actNumber ? { ...a, script: acc } : a
            ),
          }));
        },
        controller.signal
      );

      onUpdateProject((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        acts: prev.acts.map((a) =>
          a.actNumber === actNumber
            ? { ...a, script: finalText, status: 'done', errorMessage: undefined }
            : a
        ),
      }));
      setCustomRewriteText('');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'পুনর্লিখনে সমস্যা হয়েছে।';
      onUpdateProject((prev) => ({
        ...prev,
        acts: prev.acts.map((a) =>
          a.actNumber === actNumber
            ? { ...a, status: 'done', errorMessage: msg }
            : a
        ),
      }));
    } finally {
      abortRef.current = null;
    }
  };

  const handleGeneratePackaging = async () => {
    if (!project) return;
    setIsGeneratingPackaging(true);
    setPackagingError(null);
    setViewMode('packaging');
    try {
      const kit = await generatePackagingApi(project);
      onUpdateProject((prev) => ({
        ...prev,
        packaging: kit,
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      setPackagingError(
        err instanceof Error ? err.message : 'ইউটিউব প্যাকেজিং তৈরি করা যায়নি।'
      );
    } finally {
      setIsGeneratingPackaging(false);
    }
  };

  // Loading state while building blueprint from Topic Lab
  if (isBuildingBlueprint) {
    return (
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-20 text-center space-y-5">
        <Loader2 className="w-8 h-8 animate-spin text-rose-700 dark:text-rose-400 mx-auto" />
        <h2 className="font-serif text-2xl font-bold text-zinc-950 dark:text-zinc-50">
          ৭-অধ্যায়ের গল্পের নীলনকশা সাজানো হচ্ছে...
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          কোল্ড ওপেন হুক, চরিত্রের দ্বন্দ্ব, প্রতীকী বস্তু, টাইমস্ট্যাম্প ও আবহসংগীতের ছক তৈরি হচ্ছে। কয়েক সেকেন্ড অপেক্ষা করুন।
        </p>
      </div>
    );
  }

  // Empty / Custom Story Creation State
  if (!project) {
    return (
      <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-serif text-3xl font-bold text-zinc-950 dark:text-zinc-50">
              নিজস্ব গল্পের নীলনকশা ও ৭-অধ্যায় স্ক্রিপ্ট ইঞ্জিন
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              টপিক ল্যাব থেকে কোনো ধারণা বেছে নিন, অথবা নিচে নিজের একটি এক-দুই লাইনের ঘটনা লিখে সরাসরি পূর্ণাঙ্গ ১৫–২০ মিনিটের অডিও-গল্পের কাঠামো তৈরি করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                দিনের আলো
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                রাতের মোড
              </>
            )}
          </button>
        </div>

        {blueprintError && (
          <div
            role="alert"
            className="p-4 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl"
          >
            {blueprintError}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label
                htmlFor="custom-title"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                গল্পের শিরোনাম (ঐচ্ছিক)
              </label>
              <input
                id="custom-title"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="যেমন: আব্বার পুরান সাইকেলের ঘণ্টি"
                className="w-full px-4 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="custom-anchor"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                প্রতীকী বস্তু / অনুষঙ্গ (ঐচ্ছিক)
              </label>
              <input
                id="custom-anchor"
                type="text"
                value={customAnchor}
                onChange={(e) => setCustomAnchor(e.target.value)}
                placeholder="যেমন: কাঠের খিল, ভাঙা চশমা, পিতলের টিফিন বাটি"
                className="w-full px-4 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="custom-premise"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              গল্পের মূল ঘটনা বা ধারণা লিখুন
            </label>
            <textarea
              id="custom-premise"
              rows={4}
              value={customPremise}
              onChange={(e) => setCustomPremise(e.target.value)}
              placeholder="যেমন: বড় ভাইয়ের জেদের কারণে ছোট ভাই রাগ করে ঘর ছেড়ে শহরে চলে যায়। পাঁচ বছর পর বর্ষার রাতে বাবার অসুস্থতার খবর পেয়ে সে ফিরে আসে, কিন্তু তখন অনেক কিছু বদলে গেছে..."
              className="w-full px-4 py-3 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label
                htmlFor="custom-dialect"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                ভাষার ধরন
              </label>
              <select
                id="custom-dialect"
                value={customDialect}
                onChange={(e) => setCustomDialect(e.target.value as DialectId)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              >
                {DIALECT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="custom-pov"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                কথক (Narrator POV)
              </label>
              <select
                id="custom-pov"
                value={customPovId}
                onChange={(e) => setCustomPovId(e.target.value as NarratorPovId)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              >
                {NARRATOR_POV_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {customPovId === 'custom' && (
                <input
                  type="text"
                  value={customPovText}
                  onChange={(e) => setCustomPovText(e.target.value)}
                  placeholder="কথকের পরিচয় লিখুন"
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="custom-duration"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                দৈর্ঘ্য
              </label>
              <select
                id="custom-duration"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value as DurationId)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {customErr && (
            <p className="text-sm text-rose-700 dark:text-rose-400">{customErr}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleBuildCustomBlueprint}
              disabled={isCreatingCustom}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isCreatingCustom ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  নীলনকশা তৈরি হচ্ছে...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  ৭-অধ্যায়ের নীলনকশা তৈরি করুন
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Project Studio
  const totalWords = project.acts.reduce(
    (sum, a) => sum + countWords(a.script),
    0
  );
  const completedCount = project.acts.filter(
    (a) => a.script.trim().length > 0 && a.status !== 'writing'
  ).length;
  const isAnyActWriting = project.acts.some((a) => a.status === 'writing');
  const currentAct =
    project.acts.find((a) => a.actNumber === selectedActNum) ?? project.acts[0];

  const handleSaveNow = () => {
    onSaveProject(project);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handleExportTxt = () => {
    const content = buildExportText(project, {
      includeCues: includeCuesExport,
      includeActHeaders: true,
    });
    const safeName = project.title.slice(0, 40).replace(/[^\u0980-\u09FFa-zA-Z0-9]+/g, '_');
    downloadTextFile(`${safeName || 'bangla_story'}_script.txt`, content);
  };

  const handleCopyFullScript = () => {
    const content = buildExportText(project, {
      includeCues: includeCuesExport,
      includeActHeaders: false,
    });
    triggerCopy('full', content);
  };

  const handlePushToRainbridge = async () => {
    const fullScript = buildExportText(project, {
      includeCues: true,
      includeActHeaders: false,
    });
    if (!fullScript.trim()) return;
    setIsPushingAnim(true);
    setPipelineMsg(null);
    try {
      // Save full & clean TTS files to disk for voice-library & scripts
      await fetch('/api/pipeline/save-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: project.title, fullScript, project }),
      }).catch(() => {});

      const res = await fetch('/api/pipeline/push-to-rainbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: project.title, fullScript }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'অ্যানিমেশন ইঞ্জিনে পাঠানো যায়নি।');
      }
      setPipelineMsg({
        ok: true,
        text: `সফল! "${data.title}" (${data.sceneCount} দৃশ্য) ২ডি অ্যানিমেশন ইঞ্জিনে লোড হয়েছে এবং ডিস্কে সেভ হয়েছে।`,
        url: data.viewerUrl || 'http://localhost:3001',
      });
    } catch (err) {
      setPipelineMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'পাইপলাইনে পাঠাতে সমস্যা হয়েছে।',
      });
    } finally {
      setIsPushingAnim(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-6 sm:py-8 space-y-6">
      {/* Project Header & Unboxed Metrics Strip */}
      {pipelineMsg && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg text-xs border ${
            pipelineMsg.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{pipelineMsg.text}</span>
          {pipelineMsg.url && (
            <a
              href={pipelineMsg.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline hover:opacity-80"
            >
              অ্যানিমেশন দেখুন ({pipelineMsg.url}) →
            </a>
          )}
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {DIALECT_OPTIONS.find((d) => d.id === project.dialect)?.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>কথক: {project.narratorPov}</span>
            <span aria-hidden="true">·</span>
            <span>প্রতীকী বস্তু: {project.anchorObject}</span>
            {project.dnaInspiration && (
              <>
                <span aria-hidden="true">·</span>
                <span>অনুপ্রেরণা: {project.dnaInspiration}</span>
              </>
            )}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 leading-snug">
            {project.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 font-mono tabular-nums pt-0.5">
            <span>{totalWords.toLocaleString('bn-BD')} শব্দ</span>
            <span aria-hidden="true">·</span>
            <span>সম্ভাব্য সময় {estimateMinutesFromWords(totalWords)}</span>
            <span aria-hidden="true">·</span>
            <span>
              অধ্যায় {completedCount}/{project.acts.length} সম্পন্ন
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
            {theme === 'dark' ? 'আলো' : 'রাত'}
          </button>

          <button
            type="button"
            onClick={handleSaveNow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {savedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                সংরক্ষিত
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                সংরক্ষণ
              </>
            )}
          </button>

          <button
            type="button"
            disabled={totalWords === 0}
            onClick={handleCopyFullScript}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedKey === 'full' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                কপি হয়েছে
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                সম্পূর্ণ কপি
              </>
            )}
          </button>

          <button
            type="button"
            disabled={totalWords === 0}
            onClick={handleExportTxt}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            .TXT নামান
          </button>

          <button
            type="button"
            disabled={totalWords === 0 || isPushingAnim}
            onClick={handlePushToRainbridge}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPushingAnim ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            {isPushingAnim ? 'পাঠানো হচ্ছে...' : '২ডি অ্যানিমেশনে পাঠান'}
          </button>

          {isWritingAll || isAnyActWriting ? (
            <button
              type="button"
              onClick={handleStopWriting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              লেখা থামান
            </button>
          ) : (
            <button
              type="button"
              onClick={handleWriteAllActs}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {completedCount === 0
                ? 'সম্পূর্ণ ৭ অধ্যায় লিখুন'
                : completedCount < project.acts.length
                  ? 'বাকি অধ্যায়গুলো লিখুন'
                  : 'সব অধ্যায় সম্পন্ন'}
            </button>
          )}
        </div>
      </div>

      {/* TTS Audition Bar */}
      {auditionTarget && (
        <AudioAuditionBar
          title={auditionTarget.title}
          text={auditionTarget.text}
          onClose={() => setAuditionTarget(null)}
        />
      )}

      {/* Main 2-Column Editorial Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar: 7-Act Blueprint Navigator & Settings */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Dialect & Music Controls */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="studio-dialect"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  ভাষার ধরন
                </label>
                <select
                  id="studio-dialect"
                  value={project.dialect}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      dialect: e.target.value as DialectId,
                    }))
                  }
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  {DIALECT_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="studio-music"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                >
                  [মিউজিক] সংকেত মাত্রা
                </label>
                <select
                  id="studio-music"
                  value={project.musicDensity}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      musicDensity: e.target.value as MusicDensity,
                    }))
                  }
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="subtle">কম ও শান্ত</option>
                  <option value="balanced">স্বাভাবিক (প্রস্তাবিত)</option>
                  <option value="cinematic">ঘন ও নাটকীয়</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                চরিত্রসমূহ
              </p>
              <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
                {project.characters.map((c, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {c.name}
                    </span>{' '}
                    ({c.role}) — {c.trait}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 7-Act Outline List */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                ৭-অধ্যায়ের নীলনকশা
              </h2>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {completedCount}/{project.acts.length}
              </span>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {project.acts.map((act) => {
                const isSelected = act.actNumber === selectedActNum && !showFullStory;
                const actWords = countWords(act.script);
                return (
                  <button
                    key={act.actNumber}
                    type="button"
                    onClick={() => {
                      setSelectedActNum(act.actNumber);
                      setShowFullStory(false);
                      if (viewMode === 'packaging') setViewMode('manuscript');
                    }}
                    className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-600 ${
                      isSelected
                        ? 'bg-stone-100/90 dark:bg-zinc-800/80'
                        : 'hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono tabular-nums">
                        0{act.actNumber} · {act.timestampRange}
                      </span>
                      <span
                        className={
                          act.status === 'writing'
                            ? 'text-rose-700 dark:text-rose-400 font-medium'
                            : actWords > 0
                              ? 'text-zinc-700 dark:text-zinc-300 font-mono tabular-nums'
                              : 'text-zinc-400 dark:text-zinc-500'
                        }
                      >
                        {act.status === 'writing'
                          ? 'লিখছে...'
                          : actWords > 0
                            ? `${actWords} শব্দ`
                            : 'বাকি'}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-semibold mt-1 leading-snug ${
                        isSelected
                          ? 'text-rose-800 dark:text-rose-300'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {act.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Main Manuscript / Editor / Packaging Area */}
        <div className="lg:col-span-8 space-y-5">
          {/* Segmented Sub-View Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('manuscript')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'manuscript'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                পাণ্ডুলিপি
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFullStory(false);
                  setViewMode('edit');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                সম্পাদনা
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!project.packaging && !isGeneratingPackaging) {
                    handleGeneratePackaging();
                  } else {
                    setViewMode('packaging');
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'packaging'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                ইউটিউব প্যাকেজিং
              </button>
            </div>

            {viewMode === 'manuscript' && (
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCuesExport}
                    onChange={(e) => setIncludeCuesExport(e.target.checked)}
                    className="accent-rose-700 rounded"
                  />
                  কপি/ডাউনলোডে [মিউজিক] রাখুন
                </label>

                <button
                  type="button"
                  onClick={() => setShowFullStory((s) => !s)}
                  className="font-medium text-rose-700 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {showFullStory ? 'একক অধ্যায় দেখুন' : 'সম্পূর্ণ গল্প একসাথে পড়ুন'}
                </button>
              </div>
            )}
          </div>

          {/* VIEW A: FULL STORY CONTINUOUS MANUSCRIPT */}
          {viewMode === 'manuscript' && showFullStory && (
            <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-10 space-y-10">
              {project.acts.every((a) => !a.script.trim() && a.status !== 'writing') ? (
                <div className="py-12 text-center space-y-4">
                  <p className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    গল্পের লেখা এখনও শুরু হয়নি
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                    “সম্পূর্ণ ৭ অধ্যায় লিখুন” বাটনে ক্লিক করলে প্রতিটি অধ্যায় ধারাবাহিকভাবে লাইভ স্ট্রিমে লেখা হতে থাকবে।
                  </p>
                </div>
              ) : (
                project.acts.map((act) => (
                  <section
                    key={act.actNumber}
                    className="space-y-4 pb-8 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                          অধ্যায় 0{act.actNumber} · {act.timestampRange} · {act.musicMood}
                        </span>
                        <h3 className="font-serif text-xl font-bold text-zinc-950 dark:text-zinc-50 mt-0.5">
                          {act.title}
                        </h3>
                      </div>
                      {act.script.trim() && (
                        <button
                          type="button"
                          onClick={() =>
                            setAuditionTarget({
                              title: `অধ্যায় ${act.actNumber}: ${act.title}`,
                              text: act.script,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          শুনুন
                        </button>
                      )}
                    </div>

                    {act.script.trim() ? (
                      <div>{renderFormattedScript(act.script)}</div>
                    ) : act.status === 'writing' ? (
                      <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        অধ্যায় {act.actNumber} লেখা হচ্ছে...
                      </div>
                    ) : (
                      <div className="py-3 flex items-center justify-between">
                        <span className="text-xs text-zinc-400">
                          এই অধ্যায়টি এখনও লেখা হয়নি।
                        </span>
                        <button
                          type="button"
                          onClick={() => writeSingleAct(act.actNumber)}
                          className="text-xs font-semibold text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          অধ্যায়টি লিখুন
                        </button>
                      </div>
                    )}
                  </section>
                ))
              )}
            </article>
          )}

          {/* VIEW B: SINGLE ACT MANUSCRIPT & REFINEMENT */}
          {viewMode === 'manuscript' && !showFullStory && currentAct && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-9 space-y-7">
              {/* Act Header & Blueprint Summary */}
              <div className="space-y-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      অধ্যায় 0{currentAct.actNumber} · {currentAct.timestampRange} · লক্ষ্য ~
                      {currentAct.targetWords} শব্দ
                    </p>
                    <h2 className="font-serif text-2xl font-bold text-zinc-950 dark:text-zinc-50 mt-1">
                      {currentAct.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentAct.script.trim() && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setAuditionTarget({
                              title: `অধ্যায় ${currentAct.actNumber}: ${currentAct.title}`,
                              text: currentAct.script,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          কণ্ঠে শুনুন
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerCopy(`act_${currentAct.actNumber}`, currentAct.script)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedKey === `act_${currentAct.actNumber}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              কপি হয়েছে
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              কপি
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={isAnyActWriting}
                      onClick={() => writeSingleAct(currentAct.actNumber)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {currentAct.status === 'writing' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          লিখছে...
                        </>
                      ) : currentAct.script.trim() ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          পুনরায় লিখুন
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          অধ্যায়টি লিখুন
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Compact Editorial Direction Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      আবেগের লক্ষ্য:{' '}
                    </span>
                    {currentAct.emotionalGoal}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      সূক্ষ্ম দৃশ্যপট ও আবহ:{' '}
                    </span>
                    {currentAct.sensoryDetail} ({currentAct.musicMood})
                  </div>
                </div>
              </div>

              {currentAct.errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg"
                >
                  {currentAct.errorMessage}
                </div>
              )}

              {/* Script Body */}
              {currentAct.script.trim() ? (
                <div className="max-w-[68ch]">
                  {renderFormattedScript(currentAct.script)}
                </div>
              ) : currentAct.status === 'writing' ? (
                <div className="py-10 flex items-center gap-3 text-sm text-rose-700 dark:text-rose-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  অধ্যায় {currentAct.actNumber} তৈরি হচ্ছে...
                </div>
              ) : (
                <div className="py-8 space-y-4">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    এই অধ্যায়ের পরিকল্পিত ঘটনাক্রম
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {currentAct.keyBeats.map((beat, i) => (
                      <li key={i} className="leading-relaxed">
                        {beat}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Inline Director Polish Bar (when script exists) */}
              {currentAct.script.trim() && currentAct.status !== 'writing' && (
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    এই অধ্যায়টি আরও নিখুঁত করুন
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'আবেগ আরও গভীর করো এবং সংলাপগুলো আরও মর্মস্পর্শী করো',
                      'দৃশ্যটি আরও বিস্তারিত করে প্রায় দ্বিগুণ বড় লেখো, ছোট ছোট মানবিক আচরণ যোগ করো',
                      'কথ্য ভাষার টান আরও বাস্তব ও স্বাভাবিক গ্রামীণ ছন্দে আনো',
                    ].map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={isAnyActWriting}
                        onClick={() => handleRewriteAct(currentAct.actNumber, preset)}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {i === 0
                          ? 'আবেগ গভীর করুন'
                          : i === 1
                            ? 'বিস্তারিত বাড়ান (২x)'
                            : 'কথ্য টান শান দিন'}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <input
                      type="text"
                      value={customRewriteText}
                      onChange={(e) => setCustomRewriteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customRewriteText.trim()) {
                          handleRewriteAct(currentAct.actNumber, customRewriteText);
                        }
                      }}
                      placeholder="নিজস্ব নির্দেশনা লিখুন (যেমন: বাবার সংলাপটা আরও সংযত ও শক্ত করো)..."
                      className="flex-1 px-3.5 py-2 text-xs bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                    />
                    <button
                      type="button"
                      disabled={isAnyActWriting || !customRewriteText.trim()}
                      onClick={() =>
                        handleRewriteAct(currentAct.actNumber, customRewriteText)
                      }
                      className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      পরিমার্জন করুন
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW C: DIRECT MANUSCRIPT EDITOR */}
          {viewMode === 'edit' && currentAct && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    সরাসরি সম্পাদনা · অধ্যায় 0{currentAct.actNumber}
                  </p>
                  <input
                    type="text"
                    value={currentAct.title}
                    onChange={(e) =>
                      onUpdateProject((prev) => ({
                        ...prev,
                        acts: prev.acts.map((a) =>
                          a.actNumber === currentAct.actNumber
                            ? { ...a, title: e.target.value }
                            : a
                        ),
                      }))
                    }
                    className="font-serif text-xl font-bold bg-transparent text-zinc-950 dark:text-zinc-50 border-b border-transparent focus:border-rose-600 focus:outline-none mt-1 w-full"
                  />
                </div>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                  {countWords(currentAct.script)} শব্দ
                </span>
              </div>

              <textarea
                rows={18}
                value={currentAct.script}
                onChange={(e) =>
                  onUpdateProject((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    acts: prev.acts.map((a) =>
                      a.actNumber === currentAct.actNumber
                        ? { ...a, script: e.target.value, status: 'done' }
                        : a
                    ),
                  }))
                }
                placeholder="এখানে সরাসরি গল্পের স্ক্রিপ্ট সম্পাদনা করুন বা [মিউজিক] সংকেত বসান..."
                className="w-full p-4 font-manuscript text-[17px] bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>
          )}

          {/* VIEW D: YOUTUBE & AUDIO PACKAGING KIT */}
          {viewMode === 'packaging' && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                    ইউটিউব ও ফেসবুক প্রোডাকশন কিট
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    হাই-সিটিআর শিরোনাম, থাম্বনেইল কনসেপ্ট, পিনড কমেন্ট, ট্যাগ ও আবহসংগীত তালিকা
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingPackaging}
                  onClick={handleGeneratePackaging}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isGeneratingPackaging ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      তৈরি হচ্ছে...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      পুনরায় তৈরি করুন
                    </>
                  )}
                </button>
              </div>

              {packagingError && (
                <div className="p-3.5 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
                  {packagingError}
                </div>
              )}

              {isGeneratingPackaging ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-700 dark:text-rose-400 mx-auto" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    থাম্বনেইল আইডিয়া, শিরোনাম ও সাউন্ড ডিজাইন শিট তৈরি হচ্ছে...
                  </p>
                </div>
              ) : project.packaging ? (
                <div className="space-y-8">
                  {/* Titles */}
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      ০১. ৫টি আকর্ষণীয় বাংলা শিরোনাম
                    </h3>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      {project.packaging.youtubeTitles.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {t}
                          </p>
                          <button
                            type="button"
                            onClick={() => triggerCopy(`title_${idx}`, t)}
                            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copiedKey === `title_${idx}` ? 'কপি হয়েছে' : 'কপি'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Thumbnails */}
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      ০২. থাম্বনেইল কনসেপ্ট ও ইমেজ প্রম্পট
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {project.packaging.thumbnails.map((thumb, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <p className="font-mono text-xs text-zinc-500">
                              কনসেপ্ট 0{idx + 1}
                            </p>
                            <p className="font-serif text-base font-bold text-rose-700 dark:text-rose-400">
                              “{thumb.overlayText}”
                            </p>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                              {thumb.visualScene}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">
                              AI Image Prompt
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                triggerCopy(`thumb_${idx}`, thumb.imagePrompt)
                              }
                              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-rose-700 cursor-pointer"
                            >
                              {copiedKey === `thumb_${idx}` ? 'কপি হয়েছে' : 'প্রম্পট কপি'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Description & Pinned Comment */}
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          ০৩. ভিডিও ডেসক্রিপশন
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            triggerCopy('desc', project.packaging!.description)
                          }
                          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          {copiedKey === 'desc' ? 'কপি হয়েছে' : 'কপি'}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed p-4 bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                        {project.packaging.description}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            ০৪. পিনড কমেন্ট (শ্রোতার মতামত বাড়াতে)
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              triggerCopy('pin', project.packaging!.pinnedComment)
                            }
                            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                          >
                            {copiedKey === 'pin' ? 'কপি হয়েছে' : 'কপি'}
                          </button>
                        </div>
                        <p className="font-serif text-sm text-zinc-900 dark:text-zinc-100 p-4 bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl leading-relaxed">
                          {project.packaging.pinnedComment}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            ০৫. এসইও ট্যাগসমূহ
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              triggerCopy('tags', project.packaging!.tags.join(', '))
                            }
                            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                          >
                            {copiedKey === 'tags' ? 'কপি হয়েছে' : 'সব ট্যাগ কপি'}
                          </button>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {project.packaging.tags.join(' · ')}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Music Cue Sheet */}
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      ০৬. অধ্যায়ভিত্তিক আবহসংগীত ও সাউন্ড ডিজাইন শিট
                    </h3>
                    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">অধ্যায়</th>
                            <th className="py-2.5 px-4 font-medium">সময় ও প্রবেশ</th>
                            <th className="py-2.5 px-4 font-medium">যন্ত্র ও আবহ নির্দেশনা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {project.packaging.musicCueSheet.map((row) => (
                            <tr key={row.actNumber}>
                              <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                                0{row.actNumber}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                                {row.cueTiming}
                              </td>
                              <td className="py-2.5 px-4">{row.instrumentMood}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
