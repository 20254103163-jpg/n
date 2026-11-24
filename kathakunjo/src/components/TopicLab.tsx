import { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import {
  DIALECT_OPTIONS,
  DURATION_OPTIONS,
  NARRATOR_POV_OPTIONS,
  THEME_ARCHETYPES,
} from '../data/presets';
import type {
  DialectId,
  DurationId,
  NarratorPovId,
  StoryDnaProfile,
  StoryTopic,
} from '../types/story';
import { generateTopicsApi } from '../utils/api';
import { AudioAuditionBar } from './AudioAuditionBar';

interface TopicLabProps {
  topics: StoryTopic[];
  onTopicsGenerated: (topics: StoryTopic[]) => void;
  savedTopicIds: Set<string>;
  onToggleSaveTopic: (topic: StoryTopic) => void;
  onSendToEngine: (topic: StoryTopic, duration: DurationId) => void;
  activeDna: StoryDnaProfile | null;
  onClearActiveDna: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TopicLab({
  topics,
  onTopicsGenerated,
  savedTopicIds,
  onToggleSaveTopic,
  onSendToEngine,
  activeDna,
  onClearActiveDna,
  theme,
  onToggleTheme,
}: TopicLabProps) {
  const [selectedThemeId, setSelectedThemeId] = useState(THEME_ARCHETYPES[0].id);
  const [dialect, setDialect] = useState<DialectId>('grameen_kottho');
  const [duration, setDuration] = useState<DurationId>('long_18');
  const [narratorPovId, setNarratorPovId] = useState<NarratorPovId>('boro_bhai');
  const [customPov, setCustomPov] = useState('');
  const [customSeed, setCustomSeed] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditionTarget, setAuditionTarget] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const selectedTheme =
    THEME_ARCHETYPES.find((t) => t.id === selectedThemeId) ?? THEME_ARCHETYPES[0];

  const resolvedPov =
    narratorPovId === 'custom' && customPov.trim()
      ? customPov.trim()
      : NARRATOR_POV_OPTIONS.find((p) => p.id === narratorPovId)?.label ?? 'বড় ভাই';

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextTopics = await generateTopicsApi({
        themeLabel: selectedTheme.label,
        themeSummary: selectedTheme.summary,
        dialect,
        narratorPov: resolvedPov,
        duration,
        customSeed: customSeed.trim() || undefined,
        dnaInstruction: activeDna?.reusableSystemPrompt,
      });
      onTopicsGenerated(nextTopics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'টপিক তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-10">
      {/* Split Editorial Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                বাংলা অডিও-স্টোরি ও গ্রামীণ আখ্যান স্টুডিও
              </p>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

            <h1
              className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-[1.22]"
              style={{ textWrap: 'balance' }}
            >
              শ্রোতার বুক ছুঁয়ে যাওয়া বাংলা গল্প ও ভাইরাল টপিক ইঞ্জিন
            </h1>

            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              “আমাগো দরজা এখন সারারাত খোলা থাকে”—এই ঘরানার কাঁচা গ্রামীণ কথ্য ভাষা, প্রথম ২০ সেকেন্ডের শক্তিশালী হুক, প্রতীকী বস্তু আর ৭-অধ্যায়ের পূর্ণাঙ্গ ১৫–২০ মিনিটের অডিও-গল্প স্ক্রিপ্ট তৈরি করুন এক জায়গায়।
            </p>
          </div>

          {/* Active DNA Formula indicator if imported */}
          {activeDna && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  সক্রিয় গল্প-ডিএনএ ফর্মুলা: {activeDna.sourceTitle}
                </p>
                <p className="text-xs text-rose-700/80 dark:text-rose-300/80 truncate mt-0.5">
                  {activeDna.hookFormula}
                </p>
              </div>
              <button
                type="button"
                onClick={onClearActiveDna}
                aria-label="ডিএনএ ফর্মুলা সরান"
                className="p-1.5 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Editorial Craft Formula Strip */}
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="font-mono text-lg font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                0:00 – 0:20
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                তীব্র সংলাপ ও ফ্ল্যাশ-ফরওয়ার্ড হুক
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                ৭ অধ্যায়
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                শৈশব, ফাটল, ঝড়ের রাত ও শেষ প্রতিধ্বনি
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                [মিউজিক] + TTS
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                আবহ সংকেত ও সরাসরি কণ্ঠ অডিশন
              </p>
            </div>
          </div>
        </div>

        {/* Right Column Atmospheric Visual */}
        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 min-h-[260px] lg:h-full bg-zinc-900">
          {!heroImgFailed ? (
            <img
              src={selectedTheme.imageUrl}
              alt={selectedTheme.label}
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-stone-900 to-rose-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs font-medium text-stone-300">নির্বাচিত প্রেক্ষাপট</p>
            <p className="font-serif text-xl font-semibold text-white mt-1">
              {selectedTheme.label}
            </p>
            <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
              প্রতীকী অনুষঙ্গ: {selectedTheme.motifExamples}
            </p>
          </div>
        </div>
      </section>

      {/* Topic Generator Control Panel */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              ০১. গল্পের ঘরানা ও ভাষা নির্ধারণ করুন
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              একবারে ৫টি সম্পূর্ণ মৌলিক গল্পের টপিক, ২০ সেকেন্ডের হুক ও প্রতীকী কাঠামো তৈরি হবে
            </p>
          </div>
        </div>

        {/* Theme Selector Grid */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            গল্পের মূল আবহ ও বিষয়বস্তু
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {THEME_ARCHETYPES.map((item) => {
              const active = item.id === selectedThemeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedThemeId(item.id);
                    setHeroImgFailed(false);
                  }}
                  className={`text-left p-4 rounded-xl border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                    active
                      ? 'bg-stone-100 dark:bg-zinc-800/80 border-rose-700 dark:border-rose-500'
                      : 'bg-stone-50/50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.label}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dialect, Narrator POV, Duration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label
              htmlFor="topic-dialect"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              ভাষার ধরন ও আঞ্চলিক টান
            </label>
            <select
              id="topic-dialect"
              value={dialect}
              onChange={(e) => setDialect(e.target.value as DialectId)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            >
              {DIALECT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-serif">
              {DIALECT_OPTIONS.find((d) => d.id === dialect)?.sample}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="topic-pov"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              কে গল্পটা বলছে? (কথক)
            </label>
            <select
              id="topic-pov"
              value={narratorPovId}
              onChange={(e) => setNarratorPovId(e.target.value as NarratorPovId)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            >
              {NARRATOR_POV_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            {narratorPovId === 'custom' && (
              <input
                type="text"
                value={customPov}
                onChange={(e) => setCustomPov(e.target.value)}
                placeholder="যেমন: গ্রামের বৃদ্ধ ডাকপিয়ন বা ছোট মামা"
                className="w-full px-3.5 py-2 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="topic-duration"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              ভিডিও / অডিওর দৈর্ঘ্য
            </label>
            <select
              id="topic-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value as DurationId)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              আনুমানিক{' '}
              {DURATION_OPTIONS.find((d) => d.id === duration)?.totalWords.toLocaleString(
                'bn-BD'
              )}{' '}
              শব্দের ৭-অধ্যায়ের কাঠামো
            </p>
          </div>
        </div>

        {/* Optional Custom Seed Input */}
        <div className="space-y-2">
          <label
            htmlFor="topic-seed"
            className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            নিজস্ব কোনো ধারণা বা ঘটনা থাকলে লিখুন (ঐচ্ছিক)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="topic-seed"
              type="text"
              value={customSeed}
              onChange={(e) => setCustomSeed(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) handleGenerate();
              }}
              placeholder="যেমন: প্রবাসে থাকা ছোট ভাইয়ের পাঠানো টাকায় বড় ভাই বাড়ি বানালো, কিন্তু ফেরার পর ঘরে জায়গা হলো না..."
              className="flex-1 px-4 py-2.5 text-sm bg-stone-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  টপিক তৈরি হচ্ছে...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  ৫টি ভাইরাল টপিক তৈরি করুন
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg"
          >
            {error}
          </div>
        )}
      </section>

      {/* Active TTS Audition Player */}
      {auditionTarget && (
        <AudioAuditionBar
          title={auditionTarget.title}
          text={auditionTarget.text}
          onClose={() => setAuditionTarget(null)}
        />
      )}

      {/* Generated Topics Editorial Feed */}
      <section className="space-y-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            ০২. তৈরি হওয়া গল্পের টপিক ও ২০ সেকেন্ডের হুক
          </h2>
          {topics.length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              মোট {topics.length}টি মৌলিক ধারণা
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-5">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 animate-pulse space-y-4"
              >
                <div className="h-3.5 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-6 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-16 w-full bg-zinc-100 dark:bg-zinc-800/70 rounded" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-10 bg-zinc-100 dark:bg-zinc-800/70 rounded" />
                  <div className="h-10 bg-zinc-100 dark:bg-zinc-800/70 rounded" />
                  <div className="h-10 bg-zinc-100 dark:bg-zinc-800/70 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-3">
            <p className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              এখনও কোনো টপিক তৈরি করা হয়নি
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
              উপরের ঘরানা ও কথ্য ভাষা বেছে নিয়ে “৫টি ভাইরাল টপিক তৈরি করুন” বাটনে ক্লিক করুন। প্রতিটি টপিকে পাবেন রেডি-টু-রিড ২০ সেকেন্ডের হুক, প্রতীকী বস্তু, চরিত্র ও সমাপ্তির মূল কথা।
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {topics.map((topic, index) => {
              const isSaved = savedTopicIds.has(topic.id);
              const dialectLabel =
                DIALECT_OPTIONS.find((d) => d.id === topic.dialect)?.label ??
                topic.dialect;

              return (
                <article
                  key={topic.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6"
                >
                  {/* Clean Unboxed Metadata Line */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        0{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{dialectLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>কথক: {topic.narratorPov}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{topic.estimatedDuration}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAuditionTarget({
                            title: topic.title,
                            text: topic.coldOpenHook,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        হুক শুনুন
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleSaveTopic(topic)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {isSaved ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                            সংরক্ষিত
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            সংরক্ষণ
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Literary Title */}
                  <div className="space-y-1.5">
                    <h3 className="font-serif text-2xl font-bold text-zinc-950 dark:text-zinc-50 leading-snug">
                      {topic.title}
                    </h3>
                    {topic.youtubeTitles?.[0] && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        ইউটিউব শিরোনাম প্রস্তাব: {topic.youtubeTitles.join('  /  ')}
                      </p>
                    )}
                  </div>

                  {/* 20-Second Spoken Cold Open Hook */}
                  <div className="py-4 px-5 bg-stone-50 dark:bg-zinc-950/70 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2">
                      প্রথম ২০ সেকেন্ডের ওপেনিং হুক (0:00 – 0:20)
                    </p>
                    <p className="font-manuscript text-base sm:text-[17px] text-zinc-900 dark:text-zinc-100">
                      “{topic.coldOpenHook}”
                    </p>
                  </div>

                  {/* Story Architecture Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        প্রতীকী বস্তু ও যাত্রা
                      </p>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                        {topic.anchorObject}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                        {topic.anchorArc}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        মূল দ্বন্দ্ব ও চূড়ান্ত মোড়
                      </p>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">
                        {topic.coreConflict}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        মোড়: {topic.climaxMoment}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        শেষের মর্মস্পর্শী প্রতিধ্বনি
                      </p>
                      <p className="font-serif text-sm text-zinc-900 dark:text-zinc-100 mt-1 leading-relaxed">
                        “{topic.closingMoralLine}”
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                        চরিত্র: {topic.characters.map((c) => `${c.name} (${c.role})`).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Primary Action Row */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onSendToEngine(topic, duration)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      ৭-অধ্যায়ের পূর্ণাঙ্গ গল্প লিখুন
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
