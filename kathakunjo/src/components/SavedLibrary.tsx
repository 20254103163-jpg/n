import { useState } from 'react';
import { ArrowRight, Download, Search, Trash2 } from 'lucide-react';
import { DIALECT_OPTIONS } from '../data/presets';
import type {
  DurationId,
  StoryDnaProfile,
  StoryProject,
  StoryTopic,
} from '../types/story';
import {
  buildExportText,
  countWords,
  downloadTextFile,
  estimateMinutesFromWords,
} from '../utils/api';

interface SavedLibraryProps {
  savedProjects: StoryProject[];
  savedTopics: StoryTopic[];
  savedDnas: StoryDnaProfile[];
  onOpenProject: (project: StoryProject) => void;
  onDeleteProject: (id: string) => void;
  onSendTopicToEngine: (topic: StoryTopic, duration: DurationId) => void;
  onDeleteTopic: (id: string) => void;
  onApplyDna: (dna: StoryDnaProfile) => void;
  onDeleteDna: (id: string) => void;
}

type FilterKind = 'all' | 'projects' | 'topics' | 'dnas';

export function SavedLibrary({
  savedProjects,
  savedTopics,
  savedDnas,
  onOpenProject,
  onDeleteProject,
  onSendTopicToEngine,
  onDeleteTopic,
  onApplyDna,
  onDeleteDna,
}: SavedLibraryProps) {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const filteredProjects = savedProjects.filter(
    (p) =>
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.anchorObject.toLowerCase().includes(q)
  );
  const filteredTopics = savedTopics.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.coldOpenHook.toLowerCase().includes(q)
  );
  const filteredDnas = savedDnas.filter(
    (d) =>
      !q ||
      d.sourceTitle.toLowerCase().includes(q) ||
      d.hookFormula.toLowerCase().includes(q)
  );

  const totalItems =
    savedProjects.length + savedTopics.length + savedDnas.length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            সংরক্ষিত গল্প ও টপিক আর্কাইভ
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
            {savedProjects.length}টি পূর্ণাঙ্গ গল্প · {savedTopics.length}টি টপিক ·{' '}
            {savedDnas.length}টি ডিএনএ ফর্মুলা
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="শিরোনাম বা বস্তু খুঁজুন..."
              className="pl-9 pr-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            {(
              [
                ['all', 'সব'],
                ['projects', 'গল্প'],
                ['topics', 'টপিক'],
                ['dnas', 'ডিএনএ'],
              ] as [FilterKind, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {totalItems === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-2">
          <p className="font-serif text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            আপনার আর্কাইভ এখনও খালি
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            টপিক ল্যাবে পছন্দের আইডিয়া সংরক্ষণ করুন বা গল্প ইঞ্জিনে স্ক্রিপ্ট লিখুন—সবকিছু এখানে নিরাপদে জমা থাকবে।
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Saved Full Stories */}
          {(filter === 'all' || filter === 'projects') &&
            filteredProjects.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  ০১. পূর্ণাঙ্গ ও চলমান গল্পের পাণ্ডুলিপি
                </h2>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  {filteredProjects.map((proj) => {
                    const words = proj.acts.reduce(
                      (s, a) => s + countWords(a.script),
                      0
                    );
                    const doneActs = proj.acts.filter(
                      (a) => a.script.trim().length > 0
                    ).length;
                    const dialectLabel =
                      DIALECT_OPTIONS.find((d) => d.id === proj.dialect)?.label ??
                      proj.dialect;

                    return (
                      <div
                        key={proj.id}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{dialectLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {words.toLocaleString('bn-BD')} শব্দ (
                              {estimateMinutesFromWords(words)})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              অধ্যায় {doneActs}/{proj.acts.length}
                            </span>
                          </div>
                          <h3 className="font-serif text-xl font-bold text-zinc-950 dark:text-zinc-50 truncate">
                            {proj.title}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            প্রতীকী বস্তু: {proj.anchorObject} · কথক: {proj.narratorPov}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {words > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                downloadTextFile(
                                  `${proj.title.slice(0, 35)}.txt`,
                                  buildExportText(proj, {
                                    includeCues: true,
                                    includeActHeaders: true,
                                  })
                                )
                              }
                              aria-label="স্ক্রিপ্ট নামান"
                              className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeleteProject(proj.id)}
                            aria-label="গল্প মুছুন"
                            className="p-2 text-zinc-500 hover:text-rose-700 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenProject(proj)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            ইঞ্জিনে খুলুন
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          {/* Saved Topics */}
          {(filter === 'all' || filter === 'topics') &&
            filteredTopics.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  ০২. সংরক্ষিত টপিক আইডিয়া
                </h2>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  {filteredTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {topic.themeLabel} · কথক: {topic.narratorPov} · প্রতীক:{' '}
                          {topic.anchorObject}
                        </p>
                        <h3 className="font-serif text-lg font-bold text-zinc-950 dark:text-zinc-50">
                          {topic.title}
                        </h3>
                        <p className="font-manuscript text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          “{topic.coldOpenHook}”
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onDeleteTopic(topic.id)}
                          aria-label="টপিক মুছুন"
                          className="p-2 text-zinc-500 hover:text-rose-700 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSendTopicToEngine(topic, 'long_18')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          গল্প লিখুন
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Saved DNAs */}
          {(filter === 'all' || filter === 'dnas') && filteredDnas.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                ০৩. সংরক্ষিত গল্প-ডিএনএ ফর্মুলা
              </h2>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                {filteredDnas.map((dna) => (
                  <div
                    key={dna.id}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-serif text-lg font-bold text-zinc-950 dark:text-zinc-50">
                        {dna.sourceTitle}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {dna.hookFormula}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onDeleteDna(dna.id)}
                        aria-label="ডিএনএ মুছুন"
                        className="p-2 text-zinc-500 hover:text-rose-700 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyDna(dna)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        টপিক ল্যাবে ব্যবহার করুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
